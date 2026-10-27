import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Plus,
  Trash2,
  Calendar,
  CheckSquare,
  Square,
  FileDown,
  Save,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  listGrievanceDrafts,
  getGrievanceDraftById,
  createGrievanceDraft,
  updateGrievanceDraft,
  deleteGrievanceDraft,
  addTimelineEvent,
  removeTimelineEvent,
  toggleEvidenceCheck,
  addCustomEvidenceItem,
  exportGrievanceDossier,
  validateGrievanceDraft,
} from '../../services/grievanceEvidenceService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const GrievanceEvidenceOrganizerModal = ({ isOpen, onClose, defaultServiceId = null }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || 'anonymous_local';

  const [drafts, setDrafts] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState(null);

  // Draft Editor State
  const [draftTitle, setDraftTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [refNumbersText, setRefNumbersText] = useState('');
  const [issueSummary, setIssueSummary] = useState('');
  const [reliefSought, setReliefSought] = useState('');

  // New Timeline Event State
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');

  // New Evidence Item State
  const [newEvidenceLabel, setNewEvidenceLabel] = useState('');

  const [copiedDossier, setCopiedDossier] = useState(false);

  // Load user drafts
  const refreshDrafts = () => {
    const list = listGrievanceDrafts(userId);
    setDrafts(list);
    if (list.length > 0 && !activeDraftId) {
      setActiveDraftId(list[0].id);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDrafts();
    }
  }, [isOpen, userId]);

  // Sync editor fields with active draft
  const activeDraft = drafts.find((d) => d.id === activeDraftId) || null;

  useEffect(() => {
    if (activeDraft) {
      setDraftTitle(activeDraft.title || '');
      setDepartment(activeDraft.department || '');
      setRefNumbersText(
        Array.isArray(activeDraft.officialReferenceNumbers)
          ? activeDraft.officialReferenceNumbers.join(', ')
          : ''
      );
      setIssueSummary(activeDraft.issueSummary || '');
      setReliefSought(activeDraft.reliefSought || '');
    } else {
      setDraftTitle('');
      setDepartment('');
      setRefNumbersText('');
      setIssueSummary('');
      setReliefSought('');
    }
  }, [activeDraftId, activeDraft]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Create new draft
  const handleCreateNewDraft = () => {
    const newDraft = createGrievanceDraft(
      {
        title: 'New Public Grievance Draft',
        department: 'Municipal Corporation / Revenue Office',
        serviceId: defaultServiceId,
      },
      userId
    );
    refreshDrafts();
    setActiveDraftId(newDraft.id);
    toast.success('Created new grievance preparation workspace.');
  };

  // Save active draft
  const handleSaveActiveDraft = () => {
    if (!activeDraftId) return;

    const refs = refNumbersText
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    const updated = updateGrievanceDraft(
      activeDraftId,
      {
        title: draftTitle,
        department,
        officialReferenceNumbers: refs,
        issueSummary,
        reliefSought,
      },
      userId
    );

    if (updated) {
      refreshDrafts();
      toast.success('Grievance draft saved locally.');
    } else {
      toast.error('Failed to save draft.');
    }
  };

  // Delete draft
  const handleDeleteDraft = (draftIdToDelete) => {
    const targetId = draftIdToDelete || activeDraftId;
    if (!targetId) return;

    const ok = deleteGrievanceDraft(targetId, userId);
    if (ok) {
      toast.info('Grievance preparation draft deleted.');
      const remaining = listGrievanceDrafts(userId);
      setDrafts(remaining);
      setActiveDraftId(remaining[0]?.id || null);
    } else {
      toast.error('Could not delete draft.');
    }
  };

  // Add timeline event
  const handleAddTimeline = (e) => {
    e.preventDefault();
    if (!activeDraftId || !newEventTitle.trim()) return;

    addTimelineEvent(
      activeDraftId,
      {
        date: newEventDate,
        title: newEventTitle,
        notes: newEventNotes,
      },
      userId
    );

    refreshDrafts();
    setNewEventTitle('');
    setNewEventNotes('');
    toast.success('Event added to grievance timeline.');
  };

  // Remove timeline event
  const handleRemoveTimeline = (eventId) => {
    if (!activeDraftId || !eventId) return;
    removeTimelineEvent(activeDraftId, eventId, userId);
    refreshDrafts();
  };

  // Toggle evidence item
  const handleToggleEvidence = (itemId, currentCompleted) => {
    if (!activeDraftId) return;
    toggleEvidenceCheck(activeDraftId, itemId, !currentCompleted, userId);
    refreshDrafts();
  };

  // Add custom evidence item
  const handleAddCustomEvidence = (e) => {
    e.preventDefault();
    if (!activeDraftId || !newEvidenceLabel.trim()) return;

    addCustomEvidenceItem(activeDraftId, newEvidenceLabel, userId);
    refreshDrafts();
    setNewEvidenceLabel('');
    toast.success('Evidence checklist item added.');
  };

  // Export summary
  const handleExportDossier = async () => {
    if (!activeDraft) return;
    const dossierText = exportGrievanceDossier(activeDraft);

    try {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(dossierText);
        setCopiedDossier(true);
        toast.success('Grievance dossier copied to clipboard. Ready for CPGRAMS!');
        setTimeout(() => setCopiedDossier(false), 2500);
      }
    } catch {
      toast.error('Could not copy dossier. Please try again.');
    }
  };

  const validation = validateGrievanceDraft(activeDraft);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="grievance-organizer-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #131b2e)',
          border: '1px solid var(--border-main)',
          borderRadius: '1.25rem',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h2
                id="grievance-organizer-title"
                style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}
              >
                Civic Grievance Evidence Organizer
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Private, user-controlled workspace to organize facts, timeline, and evidence before filing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close grievance organizer"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Prominent Legal Disclaimer Banner (Mandatory Acceptance Criteria) */}
        <div
          style={{
            padding: '0.75rem 1.75rem',
            background: 'rgba(234, 179, 8, 0.1)',
            borderBottom: '1px solid rgba(234, 179, 8, 0.25)',
            fontSize: '0.82rem',
            color: '#eab308',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
          }}
        >
          <ShieldAlert size={18} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Preparation Workspace Notice:</strong> Civic Help Setu is an educational platform and DOES NOT
            officially file, submit, or adjudicate grievances. This workspace helps you organize dates, records, and
            proofs on your device so you can lodge your complaint effectively on official government portals like{' '}
            <a
              href="https://pgportal.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent-main)', textDecoration: 'underline' }}
            >
              CPGRAMS (pgportal.gov.in)
            </a>{' '}
            or your state CM helpline.
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Left Sidebar: Draft List */}
          <div
            style={{
              borderRight: '1px solid var(--border-main)',
              background: 'rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '1rem',
            }}
          >
            <button
              type="button"
              onClick={handleCreateNewDraft}
              className="btn btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.55rem',
                marginBottom: '1rem',
              }}
            >
              <Plus size={16} />
              <span>New Draft</span>
            </button>

            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Saved Preparation Drafts ({drafts.length})
            </div>

            {drafts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                No drafts yet. Click "New Draft" to begin preparing your complaint.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {drafts.map((d) => {
                  const isSelected = d.id === activeDraftId;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setActiveDraftId(d.id)}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '0.6rem',
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--glass-bg)',
                        border: `1px solid ${isSelected ? 'var(--accent-main)' : 'var(--border-light)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: isSelected ? 'var(--accent-main)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.title || 'Untitled Draft'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.department}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <Clock size={10} />
                        <span>{new Date(d.updatedAt || d.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Area: Draft Workspace */}
          <div style={{ overflowY: 'auto', padding: '1.5rem', flex: 1 }}>
            {!activeDraft ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-tertiary)' }}>
                <FileText size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <h3>No Grievance Draft Selected</h3>
                <p style={{ fontSize: '0.875rem' }}>
                  Select an existing draft from the left panel or click "New Draft" to begin compiling evidence.
                </p>
                <button type="button" onClick={handleCreateNewDraft} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  Create Preparation Draft
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Draft Metadata Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label
                      htmlFor="draft-title"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.3rem' }}
                    >
                      Grievance / Subject Title:
                    </label>
                    <input
                      id="draft-title"
                      type="text"
                      className="input-field"
                      placeholder="e.g., Delay in Ration Card Delivery Beyond 45-day SLA"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      style={{ width: '100%', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="draft-dept"
                      style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.3rem' }}
                    >
                      Department / Authority:
                    </label>
                    <input
                      id="draft-dept"
                      type="text"
                      className="input-field"
                      placeholder="e.g., Food & Civil Supplies / RTO / Tehsil"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      style={{ width: '100%', fontSize: '0.875rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="draft-refs"
                    style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.3rem' }}
                  >
                    Official Reference / Acknowledgement Numbers (Comma-separated):
                  </label>
                  <input
                    id="draft-refs"
                    type="text"
                    className="input-field"
                    placeholder="e.g., APP-2026-98124, ACK-567812, TR-998811"
                    value={refNumbersText}
                    onChange={(e) => setRefNumbersText(e.target.value)}
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="draft-summary"
                    style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.3rem' }}
                  >
                    Summary of Issue & Grievance Facts:
                  </label>
                  <textarea
                    id="draft-summary"
                    className="input-field"
                    rows="3"
                    placeholder="Explain clearly what service was requested, when it was initiated, how the delay occurred, and any official responses received..."
                    value={issueSummary}
                    onChange={(e) => setIssueSummary(e.target.value)}
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="draft-relief"
                    style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.3rem' }}
                  >
                    Remedy / Relief Sought:
                  </label>
                  <input
                    id="draft-relief"
                    type="text"
                    className="input-field"
                    placeholder="e.g., Immediate issuance of certificate and action against SLA breach"
                    value={reliefSought}
                    onChange={(e) => setReliefSought(e.target.value)}
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>

                {/* Section: Timeline of Events */}
                <div
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.85rem',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Chronological Timeline of Events ({activeDraft.timeline?.length || 0})
                    </h4>
                  </div>

                  <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Record important dates (application filing, in-person visits, fee receipts, reminder emails).
                  </p>

                  {/* Existing Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
                    {(activeDraft.timeline || []).map((event) => (
                      <div
                        key={event.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          padding: '0.65rem 0.85rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: 'var(--accent-main)',
                              }}
                            >
                              {event.date}
                            </span>
                            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              {event.title}
                            </span>
                          </div>
                          {event.notes && (
                            <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {event.notes}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTimeline(event.id)}
                          aria-label={`Remove event ${event.title}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            padding: '0.2rem',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Event Form */}
                  <form
                    onSubmit={handleAddTimeline}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 1fr 1fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="date"
                      className="input-field"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      required
                      style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                    />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Event title (e.g. In-person visit)"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      required
                      style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                    />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Optional notes / Counter number"
                      value={newEventNotes}
                      onChange={(e) => setNewEventNotes(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                    />
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={14} />
                      <span>Add Event</span>
                    </button>
                  </form>
                </div>

                {/* Section: Supporting Evidence Checklist */}
                <div
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '0.85rem',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Supporting Evidence Checklist ({validation.completedEvidenceCount} of {validation.totalEvidenceCount} verified)
                    </h4>
                  </div>

                  <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Check off documents and records you have ready to attach when submitting on CPGRAMS or Jan Sunwai.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {(activeDraft.evidenceChecklist || []).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleEvidence(item.id, item.completed)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.55rem 0.85rem',
                          borderRadius: '0.5rem',
                          background: item.completed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${item.completed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-light)'}`,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {item.completed ? (
                          <CheckSquare size={17} color="var(--success)" />
                        ) : (
                          <Square size={17} color="var(--text-tertiary)" />
                        )}
                        <span
                          style={{
                            color: item.completed ? 'var(--text-primary)' : 'var(--text-secondary)',
                            textDecoration: item.completed ? 'line-through' : 'none',
                          }}
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Add Custom Evidence */}
                  <form onSubmit={handleAddCustomEvidence} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Add another required document or photo evidence to gather..."
                      value={newEvidenceLabel}
                      onChange={(e) => setNewEvidenceLabel(e.target.value)}
                      style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem' }}
                    />
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={14} />
                      <span>Add Evidence Item</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-bg)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {activeDraft ? (
            <button
              type="button"
              onClick={() => handleDeleteDraft(activeDraft.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--error, #ef4444)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Trash2 size={15} />
              <span>Delete Draft</span>
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {activeDraft && (
              <button
                type="button"
                onClick={handleExportDossier}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  padding: '0.5rem 0.95rem',
                }}
              >
                {copiedDossier ? <Check size={15} color="var(--success)" /> : <FileDown size={15} />}
                <span>{copiedDossier ? 'Dossier Copied!' : 'Export Dossier'}</span>
              </button>
            )}

            {activeDraft && (
              <button
                type="button"
                onClick={handleSaveActiveDraft}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  padding: '0.5rem 1.1rem',
                }}
              >
                <Save size={15} />
                <span>Save Draft</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrievanceEvidenceOrganizerModal;
