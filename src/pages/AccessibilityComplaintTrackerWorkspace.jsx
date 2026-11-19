import { useState, useMemo } from 'react';
import {
  Scale,
  PlusCircle,
  FolderOpen,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  X,
  Building2,
} from 'lucide-react';
import {
  listAccessibilityCases,
  saveAccessibilityCase,
  deleteAccessibilityCase,
  resetToSampleCases,
  exportCaseTimelineJson,
  exportCaseTimelineMarkdown,
  exportAllCasesDossier,
} from '../services/accessibilityEscalationStorage.js';
import {
  addCaseEvent,
  updateCaseEvent,
  deleteCaseEvent,
  FACILITY_TYPES,
  AUTHORITY_TYPES,
} from '../services/accessibilityEscalationService.js';
import CaseSummaryCard from '../components/accessibilityEscalation/CaseSummaryCard.jsx';
import CaseTimelineView from '../components/accessibilityEscalation/CaseTimelineView.jsx';
import EventEditorModal from '../components/accessibilityEscalation/EventEditorModal.jsx';
import FollowUpEscalationDraftModal from '../components/accessibilityEscalation/FollowUpEscalationDraftModal.jsx';

export default function AccessibilityComplaintTrackerWorkspace() {
  const [cases, setCases] = useState(() => listAccessibilityCases());
  const [activeCaseId, setActiveCaseId] = useState(() => {
    const list = listAccessibilityCases();
    return list.length > 0 ? list[0].id : '';
  });

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [notification, setNotification] = useState(null);

  // New Case Modal Form Fields
  const [caseTitle, setCaseTitle] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [facilityType, setFacilityType] = useState('healthcare');
  const [location, setLocation] = useState('');
  const [authorityType, setAuthorityType] = useState('MUNICIPAL_CORPORATION');
  const [authorityContact, setAuthorityContact] = useState('');
  const [officialComplaintNumber, setOfficialComplaintNumber] = useState('');

  const activeCase = useMemo(() => {
    return cases.find((c) => c.id === activeCaseId) || cases[0] || null;
  }, [cases, activeCaseId]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const refreshCases = (newActiveId = null) => {
    const updated = listAccessibilityCases();
    setCases(updated);
    if (newActiveId) {
      setActiveCaseId(newActiveId);
    } else if (!updated.some((c) => c.id === activeCaseId) && updated.length > 0) {
      setActiveCaseId(updated[0].id);
    }
  };

  // Case Status Change
  const handleStatusChange = async (newStatus) => {
    if (!activeCase) return;
    try {
      await saveAccessibilityCase({
        ...activeCase,
        status: newStatus,
      });
      refreshCases();
      showNotification(`Citizen case stage updated to ${newStatus}.`);
    } catch (err) {
      showNotification(`Update failed: ${err.message}`, 'error');
    }
  };

  // Event Add / Edit Handler
  const handleSaveEvent = async (eventData) => {
    if (!activeCase) return;
    try {
      if (eventData.id) {
        await updateCaseEvent(activeCase.id, eventData.id, eventData);
        showNotification('Timeline event updated successfully.');
      } else {
        await addCaseEvent(activeCase.id, eventData);
        showNotification('New timeline event added successfully.');
      }
      refreshCases();
      setIsEventModalOpen(false);
      setEditingEvent(null);
    } catch (err) {
      showNotification(`Could not save event: ${err.message}`, 'error');
    }
  };

  // Event Delete Handler
  const handleDeleteEvent = async (eventId) => {
    if (!activeCase) return;
    if (window.confirm('Delete this timeline event record?')) {
      try {
        await deleteCaseEvent(activeCase.id, eventId);
        refreshCases();
        showNotification('Timeline event removed.');
      } catch (err) {
        showNotification(`Could not delete event: ${err.message}`, 'error');
      }
    }
  };

  // Case Create / Update Handler
  const handleSaveCase = async (e) => {
    e.preventDefault();
    try {
      const saved = await saveAccessibilityCase({
        ...(editingCase || {}),
        title: caseTitle,
        facilityName,
        facilityType,
        location,
        authorityType,
        authorityContact,
        officialComplaintNumber,
        events: editingCase?.events || [],
      });
      refreshCases(saved.id);
      setIsCaseModalOpen(false);
      setEditingCase(null);
      showNotification('Accessibility complaint case saved successfully.');
    } catch (err) {
      showNotification(`Error saving case: ${err.message}`, 'error');
    }
  };

  // Case Delete Handler
  const handleDeleteCase = () => {
    if (!activeCase) return;
    if (window.confirm(`Permanently delete case '${activeCase.title}' and all its timeline records?`)) {
      deleteAccessibilityCase(activeCase.id);
      refreshCases();
      showNotification('Case removed from local storage.');
    }
  };

  const handleOpenNewCaseModal = () => {
    setEditingCase(null);
    setCaseTitle('');
    setFacilityName('');
    setFacilityType('healthcare');
    setLocation('');
    setAuthorityType('MUNICIPAL_CORPORATION');
    setAuthorityContact('');
    setOfficialComplaintNumber('');
    setIsCaseModalOpen(true);
  };

  const handleOpenEditCaseModal = () => {
    if (!activeCase) return;
    setEditingCase(activeCase);
    setCaseTitle(activeCase.title);
    setFacilityName(activeCase.facilityName);
    setFacilityType(activeCase.facilityType);
    setLocation(activeCase.location || '');
    setAuthorityType(activeCase.authorityType);
    setAuthorityContact(activeCase.authorityContact || '');
    setOfficialComplaintNumber(activeCase.officialComplaintNumber || '');
    setIsCaseModalOpen(true);
  };

  const handleExportJson = () => {
    if (!activeCase) return;
    const json = exportCaseTimelineJson(activeCase);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility_case_${activeCase.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported structured case timeline JSON.');
  };

  const handleExportMarkdown = () => {
    if (!activeCase) return;
    const md = exportCaseTimelineMarkdown(activeCase);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility_timeline_${activeCase.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported printable Markdown timeline.');
  };

  const handleExportAllJson = () => {
    const json = JSON.stringify(cases, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility_all_cases_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported all cases as JSON.');
  };

  const handleExportAllDossier = () => {
    const md = exportAllCasesDossier(cases);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility_master_dossier.md`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported master cases dossier (.MD).');
  };

  const handleResetSampleData = () => {
    resetToSampleCases();
    refreshCases();
    showNotification('Reset to initial sample demonstrative cases.');
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        color: 'var(--text-main, #f8fafc)',
      }}
    >
      {/* Toast Notification */}
      {notification && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 10000,
            padding: '0.75rem 1.25rem',
            borderRadius: '0.5rem',
            background: notification.type === 'error' ? '#ef4444' : '#15803d',
            color: '#ffffff',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500,
            fontSize: '0.875rem',
          }}
        >
          {notification.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {notification.msg}
        </div>
      )}

      {/* Main Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              <Scale size={13} /> SECTION 45 RPwD ACT 2016
            </span>
            <span
              style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                padding: '0.25rem 0.6rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Offline Local Vault
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.2rem 0', color: '#ffffff' }}>
            Accessibility Complaint Follow-Up &amp; Escalation Tracker
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0, maxWidth: '750px', lineHeight: 1.5 }}>
            Maintain a local chronological case timeline of correspondence, speed-post acknowledgments, and joint site inspection requests under the Rights of Persons with Disabilities (RPwD) Act, 2016 (Sections 44 &amp; 45 and Harmonised Guidelines 2021). Prepares editable escalation petitions for the State or Chief Commissioner for Persons with Disabilities under Sections 75 &amp; 80.
          </p>
        </div>

        {/* Global Toolbar & Case Selector */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {cases.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FolderOpen size={16} style={{ color: '#94a3b8' }} />
                <select
                  value={activeCaseId}
                  onChange={(e) => setActiveCaseId(e.target.value)}
                  aria-label="Select active accessibility complaint case"
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, #0f172a)',
                    border: '1px solid var(--border-light, #334155)',
                    color: 'var(--text-main, #f8fafc)',
                    fontSize: '0.85rem',
                    maxWidth: '240px',
                  }}
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.facilityName || c.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleExportAllDossier}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <Download size={13} /> Export All Dossier (.MD)
              </button>
              <button
                onClick={handleExportAllJson}
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <Download size={13} /> Export All (.JSON)
              </button>
            </>
          )}

          <button
            onClick={handleResetSampleData}
            type="button"
            title="Reset to default sample cases"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} /> Reset Sample Data
          </button>

          <button
            onClick={handleOpenNewCaseModal}
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: '0.5rem',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <PlusCircle size={15} /> New Case
          </button>
        </div>
      </div>

      {/* Case Summary Card */}
      {activeCase ? (
        <>
          <CaseSummaryCard
            caseData={activeCase}
            onStatusChange={handleStatusChange}
            onEditCase={handleOpenEditCaseModal}
            onDeleteCase={handleDeleteCase}
            onExportJson={handleExportJson}
            onExportMarkdown={handleExportMarkdown}
            onGenerateDraft={() => setIsDraftModalOpen(true)}
          />

          {/* Timeline View */}
          <CaseTimelineView
            events={activeCase.events || []}
            onAddEvent={() => {
              setEditingEvent(null);
              setIsEventModalOpen(true);
            }}
            onEditEvent={(evt) => {
              setEditingEvent(evt);
              setIsEventModalOpen(true);
            }}
            onDeleteEvent={handleDeleteEvent}
          />
        </>
      ) : (
        /* Empty Cases Screen */
        <div
          style={{
            background: 'var(--bg-card, #1e293b)',
            borderRadius: '1rem',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            border: '1px solid var(--border-light, #334155)',
          }}
        >
          <Building2 size={40} style={{ color: '#64748b', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.5rem 0' }}>
            No Accessibility Complaint Cases in Vault
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
            Start tracking accessibility non-compliance at public facilities, hospitals, or transit stations.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
            <button
              onClick={handleOpenNewCaseModal}
              type="button"
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.5rem',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Create Your First Case
            </button>
            <button
              onClick={handleResetSampleData}
              type="button"
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Sample Data
            </button>
          </div>
        </div>
      )}

      {/* Event Editor Modal */}
      {isEventModalOpen && (
        <EventEditorModal
          event={editingEvent}
          onClose={() => {
            setIsEventModalOpen(false);
            setEditingEvent(null);
          }}
          onSave={handleSaveEvent}
        />
      )}

      {/* Follow-Up / Escalation Draft Modal */}
      {isDraftModalOpen && activeCase && (
        <FollowUpEscalationDraftModal
          caseData={activeCase}
          onClose={() => setIsDraftModalOpen(false)}
        />
      )}

      {/* Create / Edit Case Modal */}
      {isCaseModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-modal, #1e293b)',
              borderRadius: '1rem',
              maxWidth: '600px',
              width: '100%',
              border: '1px solid var(--border-light, #334155)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              color: 'var(--text-main, #f8fafc)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-light, #334155)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 id="case-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                {editingCase ? 'Edit Accessibility Case' : 'Create Accessibility Complaint Case'}
              </h2>
              <button
                onClick={() => setIsCaseModalOpen(false)}
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCase} style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Case Title *
                </label>
                <input
                  type="text"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  required
                  placeholder="e.g. Wheelchair Ramp Inaccessibility at Sub-Divisional Hospital"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Facility Name *
                  </label>
                  <input
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    required
                    placeholder="e.g. District Civil Hospital"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Facility Category
                  </label>
                  <select
                    value={facilityType}
                    onChange={(e) => setFacilityType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  >
                    {Object.entries(FACILITY_TYPES).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Location / Address / Ward
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Civil Hospital Road, Ward 7, District Central"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Authority Addressed
                  </label>
                  <select
                    value={authorityType}
                    onChange={(e) => setAuthorityType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  >
                    {Object.entries(AUTHORITY_TYPES).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Official Grievance Docket ID
                  </label>
                  <input
                    type="text"
                    value={officialComplaintNumber}
                    onChange={(e) => setOfficialComplaintNumber(e.target.value)}
                    placeholder="e.g. CPGRAMS/2026/09912"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Authority Nodal Contact / Officer Details
                </label>
                <input
                  type="text"
                  value={authorityContact}
                  onChange={(e) => setAuthorityContact(e.target.value)}
                  placeholder="e.g. Executive Engineer PWD Civil Wing (ee-pwd@gov.in)"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setIsCaseModalOpen(false)}
                  type="button"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.5rem',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {editingCase ? 'Save Changes' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
