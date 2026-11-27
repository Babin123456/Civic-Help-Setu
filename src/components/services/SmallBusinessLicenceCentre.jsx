import { useState, useMemo } from 'react';
import {
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Plus,
  Trash2,
  Download,
  RotateCcw,
  BookOpen,
  MapPin,
  Check,
  X
} from 'lucide-react';
import {
  MUNICIPAL_JURISDICTIONS,
  BUSINESS_CATEGORIES,
  DATA_STALENESS_HORIZON_DAYS,
  STATUTORY_LEGAL_DISCLAIMER
} from '../../data/smallBusinessLicenceData.js';
import {
  getLicencesByTrack,
  getAmendmentRequirements,
  getSuspensionRequirements,
  getClosureWorkflow,
  resolveJurisdiction,
  calculateExpiryStatus,
  generateICalendarEvent,
  getEstablishmentProfiles,
  createEstablishmentProfile,
  deleteEstablishmentProfile,
  getEstablishmentProgress,
  toggleChecklistItem,
  resetEstablishmentProgress,
  sanitizeLicenceDataForExport,
  isDataStale,
  submitCorrectionProposal,
  getCorrectionProposals,
  reviewCorrectionProposal
} from '../../services/smallBusinessLicenceService.js';
import './SmallBusinessLicenceCentre.css';

export default function SmallBusinessLicenceCentre({
  initialEstablishmentId = null,
  initialTab = 'renewal'
}) {
  const [establishments, setEstablishments] = useState(() => {
    let profiles = getEstablishmentProfiles();
    if (profiles.length === 0) {
      const defaultEst = createEstablishmentProfile({
        establishmentName: 'Primary Retail Store',
        category: 'RETAIL',
        jurisdictionKey: 'DELHI_MCD',
        municipalWard: 'Ward 24',
        selectedLicenceKeys: ['municipal_trade_licence', 'shops_establishment_registration'],
        reminderOffsetDays: 30
      });
      profiles = [defaultEst];
    }
    return profiles;
  });

  const [activeEstId, setActiveEstId] = useState(() => {
    if (initialEstablishmentId) return initialEstablishmentId;
    const profiles = getEstablishmentProfiles();
    return profiles.length > 0 ? profiles[0].id : null;
  });

  const [activeTab, setActiveTab] = useState(initialTab); // 'renewal' | 'amendment' | 'suspension' | 'closure'
  const [licenceTrackFilter, setLicenceTrackFilter] = useState('ALL'); // 'ALL' | 'MUNICIPAL' | 'SECTOR_SPECIFIC'
  const [amendmentType, setAmendmentType] = useState('ADDRESS_CHANGE');

  const [progressMap, setProgressMap] = useState(() => {
    const targetId = initialEstablishmentId || (getEstablishmentProfiles()[0]?.id ?? null);
    return targetId ? getEstablishmentProgress(targetId) : {};
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [proposals, setProposals] = useState(() => getCorrectionProposals());
  const [exportNotice, setExportNotice] = useState(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Form states for new establishment
  const [newEstName, setNewEstName] = useState('');
  const [newEstCategory, setNewEstCategory] = useState('RETAIL');
  const [newEstJurisdiction, setNewEstJurisdiction] = useState('DELHI_MCD');
  const [newEstWard, setNewEstWard] = useState('');

  // Feedback form state
  const [fbSourceUrl, setFbSourceUrl] = useState('');
  const [fbNotes, setFbNotes] = useState('');
  const [fbError, setFbError] = useState('');

  const handleSelectEstablishment = (id) => {
    setActiveEstId(id);
    setProgressMap(getEstablishmentProgress(id));
  };

  const activeEstablishment = useMemo(() => {
    return establishments.find((e) => e.id === activeEstId) || establishments[0] || null;
  }, [establishments, activeEstId]);

  const jurisdiction = useMemo(() => {
    if (!activeEstablishment) return resolveJurisdiction('DELHI_MCD');
    return resolveJurisdiction(activeEstablishment.jurisdictionKey);
  }, [activeEstablishment]);

  const relevantLicences = useMemo(() => {
    const cat = activeEstablishment ? activeEstablishment.category : null;
    return getLicencesByTrack(licenceTrackFilter, cat);
  }, [licenceTrackFilter, activeEstablishment]);

  const amendmentData = useMemo(() => {
    return getAmendmentRequirements(amendmentType);
  }, [amendmentType]);

  const suspensionData = useMemo(() => {
    return getSuspensionRequirements();
  }, []);

  const closureData = useMemo(() => {
    return getClosureWorkflow();
  }, []);

  const handleToggleTask = (taskId) => {
    if (!activeEstId) return;
    const newState = toggleChecklistItem(activeEstId, taskId);
    setProgressMap((prev) => ({ ...prev, [taskId]: newState }));
  };

  const handleResetProgress = () => {
    if (!activeEstId) return;
    if (window.confirm('Reset all completed checklist tasks for this establishment?')) {
      resetEstablishmentProgress(activeEstId);
      setProgressMap({});
    }
  };

  const handleCreateEstablishment = (e) => {
    e.preventDefault();
    if (!newEstName.trim()) return;

    const created = createEstablishmentProfile({
      establishmentName: newEstName.trim(),
      category: newEstCategory,
      jurisdictionKey: newEstJurisdiction,
      municipalWard: newEstWard.trim(),
      selectedLicenceKeys: ['municipal_trade_licence', 'shops_establishment_registration'],
      reminderOffsetDays: 30
    });

    const updatedProfiles = getEstablishmentProfiles();
    setEstablishments(updatedProfiles);
    setActiveEstId(created.id);
    setProgressMap({});
    setNewEstName('');
    setNewEstWard('');
    setShowAddModal(false);
  };

  const handleDeleteEstablishment = (id) => {
    if (establishments.length <= 1) {
      alert('You must keep at least one establishment profile.');
      return;
    }
    if (window.confirm('Delete this establishment profile and its saved checklist progress?')) {
      deleteEstablishmentProfile(id);
      const remaining = getEstablishmentProfiles();
      setEstablishments(remaining);
      const nextId = remaining[0]?.id || null;
      setActiveEstId(nextId);
      setProgressMap(nextId ? getEstablishmentProgress(nextId) : {});
    }
  };

  const handleExportSummary = () => {
    if (!activeEstablishment) return;
    const sanitized = sanitizeLicenceDataForExport(activeEstablishment, progressMap);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sanitized, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `business-licence-summary-${activeEstablishment.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setExportNotice('Export downloaded with personal identifiers automatically redacted.');
    setTimeout(() => setExportNotice(null), 5000);
  };

  const handleDownloadCalendar = (licence) => {
    const today = new Date();
    // Default to end of current financial year if unspecified
    const fyYear = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear();
    const expiryDate = `${fyYear}-03-31`;

    const icsContent = generateICalendarEvent({
      title: licence.title,
      description: licence.officialInstruction,
      expiryDateStr: expiryDate
    });

    if (!icsContent) return;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${licence.key}-renewal-reminder.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setFbError('');
    if (!fbSourceUrl.trim()) {
      setFbError('A verifiable official portal or gazette URL is required.');
      return;
    }

    try {
      submitCorrectionProposal({
        jurisdictionKey: jurisdiction.key,
        stage: activeTab.toUpperCase(),
        officialSourceUrl: fbSourceUrl.trim(),
        notes: fbNotes.trim()
      });
      setProposals(getCorrectionProposals());

      await fetch('/api/business-licence-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionKey: jurisdiction.key,
          stage: activeTab.toUpperCase(),
          officialGazetteOrSourceUrl: fbSourceUrl.trim(),
          submissionNotes: fbNotes.trim()
        })
      });

      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackSuccess(false);
        setShowFeedbackModal(false);
        setFbSourceUrl('');
        setFbNotes('');
      }, 2000);
    } catch {
      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackSuccess(false);
        setShowFeedbackModal(false);
        setFbSourceUrl('');
        setFbNotes('');
      }, 2000);
    }
  };

  const handleReviewProposal = (id, status) => {
    reviewCorrectionProposal(id, {
      status,
      adminNotes: `Moderator reviewed: marked ${status}`
    });
    setProposals(getCorrectionProposals());
  };

  return (
    <div className="sblc-container" data-testid="small-business-licence-centre">
      {/* HEADER SECTION */}
      <header className="sblc-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="sblc-badge-pill">
                <ShieldCheck size={14} color="#2563eb" /> Statutory Compliance Centre
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
              Small-Business Licence Renewal &amp; Closure Checklist Centre
            </h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Comprehensive lifecycle tracking for municipal trade permissions, Shops &amp; Establishments registrations, and sector-specific statutory clearances.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExportSummary}
              title="Download sanitized summary with zero personal identifiers"
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Download size={14} /> Export (Redacted)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowFeedbackModal(true)}
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <BookOpen size={14} /> Propose Correction
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setProposals(getCorrectionProposals());
                setShowAdminModal(true);
              }}
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ShieldAlert size={14} /> Admin Review Queue ({proposals.filter((p) => p.status === 'PENDING_REVIEW').length})
            </button>
          </div>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="sblc-disclaimer-box" role="note">
          <strong>Official Boundary Notice: </strong> {STATUTORY_LEGAL_DISCLAIMER}
        </div>

        {/* Export Notification */}
        {exportNotice && (
          <div style={{ marginTop: '0.75rem', padding: '0.6rem 1rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#047857', fontSize: '0.82rem' }}>
            {exportNotice}
          </div>
        )}
      </header>

      {/* ESTABLISHMENT BAR */}
      <section className="sblc-establishment-bar" aria-label="Establishment Profile Switcher">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Building2 size={20} color="#2563eb" />
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Active Establishment
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={activeEstId || ''}
                onChange={(e) => handleSelectEstablishment(e.target.value)}
                aria-label="Select Establishment Profile"
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.4rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
              >
                {establishments.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.establishmentName} ({BUSINESS_CATEGORIES.find((c) => c.id === est.category)?.label.split('&')[0] || est.category})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddModal(true)}
                title="Add Another Establishment"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Plus size={14} /> Add Branch
              </button>
            </div>
          </div>
        </div>

        {activeEstablishment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
              <MapPin size={14} /> {jurisdiction.city || jurisdiction.authorityName} ({activeEstablishment.municipalWard || 'Unspecified Ward'})
            </span>
            <button
              type="button"
              onClick={() => handleDeleteEstablishment(activeEstablishment.id)}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
              title="Remove this establishment"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </section>

      {/* JURISDICTION STALENESS & UNVERIFIED WARNINGS */}
      {!jurisdiction.isSupported && (
        <div className="sblc-unverified-banner" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <AlertTriangle size={18} />
            Uncatalogued / Unverified Municipal Jurisdiction: {jurisdiction.key}
          </div>
          <p style={{ margin: 0 }}>{jurisdiction.recommendedAction}</p>
        </div>
      )}

      {jurisdiction.isSupported && isDataStale(jurisdiction, DATA_STALENESS_HORIZON_DAYS) && (
        <div className="sblc-stale-banner" role="status">
          <Clock size={18} />
          <div>
            <strong>Stale Data Advisory: </strong> This municipal rulebook was last verified on {jurisdiction.verificationTimestamp || 'an unrecorded date'}. Regulations or municipal fee schedules may have updated. Consult the official portal.
          </div>
        </div>
      )}

      {/* LIFECYCLE STAGE TABS */}
      <nav className="sblc-tabs-nav" role="tablist" aria-label="Licence Lifecycle Stages">
        <button
          type="button"
          role="tab"
          id="tab-renewal"
          aria-selected={activeTab === 'renewal'}
          aria-controls="panel-renewal"
          className={`sblc-tab-btn ${activeTab === 'renewal' ? 'active' : ''}`}
          onClick={() => setActiveTab('renewal')}
        >
          1. Annual Renewal Checklist
        </button>
        <button
          type="button"
          role="tab"
          id="tab-amendment"
          aria-selected={activeTab === 'amendment'}
          aria-controls="panel-amendment"
          className={`sblc-tab-btn ${activeTab === 'amendment' ? 'active' : ''}`}
          onClick={() => setActiveTab('amendment')}
        >
          2. Amendments (Address / Ownership)
        </button>
        <button
          type="button"
          role="tab"
          id="tab-suspension"
          aria-selected={activeTab === 'suspension'}
          aria-controls="panel-suspension"
          className={`sblc-tab-btn ${activeTab === 'suspension' ? 'active' : ''}`}
          onClick={() => setActiveTab('suspension')}
        >
          3. Temporary Suspension
        </button>
        <button
          type="button"
          role="tab"
          id="tab-closure"
          aria-selected={activeTab === 'closure'}
          aria-controls="panel-closure"
          className={`sblc-tab-btn ${activeTab === 'closure' ? 'active' : ''}`}
          onClick={() => setActiveTab('closure')}
        >
          4. Closure &amp; Surrender
        </button>
      </nav>

      {/* TAB PANEL 1: ANNUAL RENEWAL */}
      {activeTab === 'renewal' && (
        <section id="panel-renewal" role="tabpanel" aria-labelledby="tab-renewal">
          {/* Dual-Track Filter Chips */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div className="sblc-filter-group" role="group" aria-label="Licence Track Filter">
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Licence Track:</span>
              <button
                type="button"
                className={`sblc-chip-btn ${licenceTrackFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setLicenceTrackFilter('ALL')}
              >
                All Licences ({relevantLicences.length})
              </button>
              <button
                type="button"
                className={`sblc-chip-btn ${licenceTrackFilter === 'MUNICIPAL' ? 'active' : ''}`}
                onClick={() => setLicenceTrackFilter('MUNICIPAL')}
              >
                Municipal Track Only
              </button>
              <button
                type="button"
                className={`sblc-chip-btn ${licenceTrackFilter === 'SECTOR_SPECIFIC' ? 'active' : ''}`}
                onClick={() => setLicenceTrackFilter('SECTOR_SPECIFIC')}
              >
                Sector-Specific Only
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetProgress}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RotateCcw size={13} /> Reset Checked
            </button>
          </div>

          {/* Cards List or Empty State */}
          {relevantLicences.length === 0 ? (
            <div className="sblc-empty-state" role="status">
              <Building2 size={36} color="var(--text-secondary)" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 700 }}>No Licences Found for this Filter</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Try switching to &quot;All Licences&quot; or updating the establishment business category.
              </p>
            </div>
          ) : (
            <div className="sblc-card-grid">
              {relevantLicences.map((licence) => {
                const taskId = `renewal_${licence.key}`;
                const isChecked = Boolean(progressMap[taskId]);
                const expiryStatus = calculateExpiryStatus('2027-03-31', 30);

                return (
                  <article key={licence.key} className="sblc-licence-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: licence.track === 'MUNICIPAL' ? '#1e3a8a' : '#047857',
                              color: '#ffffff'
                            }}
                          >
                            {licence.track === 'MUNICIPAL' ? 'MUNICIPAL' : 'SECTOR-SPECIFIC'}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Cycle: {licence.renewalCycle}
                          </span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{licence.title}</h2>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          <strong>Authority:</strong> {licence.governingAuthority} | <strong>Act:</strong> {licence.statutoryAct}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.25rem 0.6rem',
                            borderRadius: '9999px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#059669',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          {expiryStatus.badgeLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadCalendar(licence)}
                          className="btn btn-secondary"
                          title="Download .ics Calendar Reminder"
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Calendar size={13} /> Reminder (.ics)
                        </button>
                      </div>
                    </div>

                    {/* Official Statutory Instruction */}
                    <div className="sblc-official-box">
                      <span className="sblc-box-label-official">
                        Official Statutory Instruction
                      </span>
                      <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.45 }}>{licence.officialInstruction}</p>
                    </div>

                    {/* Editorial Explanation */}
                    <div className="sblc-editorial-box">
                      <span className="sblc-box-label-editorial">
                        Citizen Advice &amp; Operational Tip
                      </span>
                      <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                        {licence.editorialExplanation}
                      </p>
                    </div>

                    {/* Task Action & Official Link */}
                    <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTask(taskId)}
                          style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                        />
                        <span>Mark Renewal Verified &amp; Paid</span>
                      </label>

                      {licence.portalUrl && (
                        <a
                          href={licence.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                        >
                          Official Portal <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB PANEL 2: AMENDMENTS */}
      {activeTab === 'amendment' && (
        <section id="panel-amendment" role="tabpanel" aria-labelledby="tab-amendment">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              className={`sblc-chip-btn ${amendmentType === 'ADDRESS_CHANGE' ? 'active' : ''}`}
              onClick={() => setAmendmentType('ADDRESS_CHANGE')}
            >
              Premises Relocation / Address Change
            </button>
            <button
              type="button"
              className={`sblc-chip-btn ${amendmentType === 'OWNERSHIP_CONSTITUTION_CHANGE' ? 'active' : ''}`}
              onClick={() => setAmendmentType('OWNERSHIP_CONSTITUTION_CHANGE')}
            >
              Ownership, Partners &amp; Constitution Change
            </button>
          </div>

          {amendmentData && (
            <div className="sblc-licence-card">
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>{amendmentData.title}</h2>

              <div className="sblc-official-box">
                <span className="sblc-box-label-official">
                  Statutory Rule &amp; Limitation
                </span>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>{amendmentData.officialRule}</p>
              </div>

              <div className="sblc-editorial-box">
                <span className="sblc-box-label-editorial">
                  Advisory Tip
                </span>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{amendmentData.editorialTip}</p>
              </div>

              <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.95rem', fontWeight: 700 }}>
                Admissible Evidence Checklist
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {amendmentData.evidenceChecklist.map((item) => {
                  const taskId = `amendment_${amendmentType}_${item.id}`;
                  const isChecked = Boolean(progressMap[taskId]);

                  return (
                    <div key={item.id} className={`sblc-checklist-item ${isChecked ? 'completed' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTask(taskId)}
                        id={taskId}
                        style={{ marginTop: '0.2rem', accentColor: '#2563eb' }}
                      />
                      <label htmlFor={taskId} style={{ flex: 1, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.label}</span>
                          {item.mandatory && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', background: 'rgba(220, 38, 38, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              MANDATORY
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {item.officialBasis}
                        </p>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB PANEL 3: TEMPORARY SUSPENSION */}
      {activeTab === 'suspension' && (
        <section id="panel-suspension" role="tabpanel" aria-labelledby="tab-suspension">
          <div className="sblc-licence-card">
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>{suspensionData.title}</h2>

            <div className="sblc-official-box">
              <span className="sblc-box-label-official">
                Official Suspension Protocol
              </span>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>{suspensionData.officialRule}</p>
            </div>

            <div className="sblc-editorial-box">
              <span className="sblc-box-label-editorial">
                Operational Advisory
              </span>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{suspensionData.editorialTip}</p>
            </div>

            <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.95rem', fontWeight: 700 }}>
              Voluntary Suspension &amp; Rectification Checkpoints
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {suspensionData.checkpoints.map((cp) => {
                const taskId = `suspension_${cp.id}`;
                const isChecked = Boolean(progressMap[taskId]);

                return (
                  <div key={cp.id} className={`sblc-checklist-item ${isChecked ? 'completed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleTask(taskId)}
                      id={taskId}
                      style={{ marginTop: '0.2rem', accentColor: '#2563eb' }}
                    />
                    <label htmlFor={taskId} style={{ flex: 1, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{cp.label}</span>
                        {cp.mandatory && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', background: 'rgba(220, 38, 38, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            MANDATORY
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {cp.description}
                      </p>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* TAB PANEL 4: CLOSURE & SURRENDER */}
      {activeTab === 'closure' && (
        <section id="panel-closure" role="tabpanel" aria-labelledby="tab-closure">
          <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', color: '#047857', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              <CheckCircle size={16} /> Legal Shield: Surrender Acknowledgement Tracking
            </div>
            {closureData.mandatoryRetainerNote}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {closureData.workflowPhases.map((phase) => (
              <div key={phase.stepId} className="sblc-licence-card">
                <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', fontWeight: 700 }}>{phase.title}</h2>

                <div className="sblc-official-box">
                  <span className="sblc-box-label-official">
                    Statutory Rule
                  </span>
                  <p style={{ margin: 0, fontSize: '0.84rem' }}>{phase.officialRule}</p>
                </div>

                <div className="sblc-editorial-box">
                  <span className="sblc-box-label-editorial">
                    Tip
                  </span>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{phase.editorialTip}</p>
                </div>

                <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {phase.items.map((item) => {
                    const taskId = `closure_${phase.stepId}_${item.id}`;
                    const isChecked = Boolean(progressMap[taskId]);

                    return (
                      <div key={item.id} className={`sblc-checklist-item ${isChecked ? 'completed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTask(taskId)}
                          id={taskId}
                          style={{ marginTop: '0.2rem', accentColor: '#2563eb' }}
                        />
                        <label htmlFor={taskId} style={{ flex: 1, cursor: 'pointer' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{item.label}</span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, marginTop: '0.1rem' }}>
                            Department: {item.department}
                          </span>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {item.action}
                          </p>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL: ADD ESTABLISHMENT */}
      {showAddModal && (
        <div className="sblc-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-est-title">
          <div className="sblc-modal-content">
            <h2 id="add-est-title" style={{ margin: '0 0 1rem', fontSize: '1.2rem', fontWeight: 800 }}>
              Add New Business Establishment
            </h2>

            <form onSubmit={handleCreateEstablishment}>
              <div className="sblc-form-group">
                <label htmlFor="new-est-name">Establishment / Branch Name *</label>
                <input
                  id="new-est-name"
                  type="text"
                  required
                  placeholder="e.g. South Extension Outlet"
                  value={newEstName}
                  onChange={(e) => setNewEstName(e.target.value)}
                />
              </div>

              <div className="sblc-form-group">
                <label htmlFor="new-est-cat">Business Category *</label>
                <select
                  id="new-est-cat"
                  value={newEstCategory}
                  onChange={(e) => setNewEstCategory(e.target.value)}
                >
                  {BUSINESS_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sblc-form-group">
                <label htmlFor="new-est-jur">Municipal Corporation Jurisdiction *</label>
                <select
                  id="new-est-jur"
                  value={newEstJurisdiction}
                  onChange={(e) => setNewEstJurisdiction(e.target.value)}
                >
                  {MUNICIPAL_JURISDICTIONS.map((j) => (
                    <option key={j.key} value={j.key}>
                      {j.authorityName} ({j.state})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sblc-form-group">
                <label htmlFor="new-est-ward">Municipal Ward / Zone</label>
                <input
                  id="new-est-ward"
                  type="text"
                  placeholder="e.g. Ward 45 Central"
                  value={newEstWard}
                  onChange={(e) => setNewEstWard(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Establishment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROPOSE CORRECTION */}
      {showFeedbackModal && (
        <div className="sblc-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="fb-modal-title">
          <div className="sblc-modal-content">
            <h2 id="fb-modal-title" style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 800 }}>
              Propose Regulation Correction
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Help keep our compliance checklist accurate. Submit a verifiable official gazette notification or municipal circular link for administrator verification.
            </p>

            {feedbackSuccess ? (
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#047857', borderRadius: '0.5rem', textAlign: 'center' }}>
                Thank you! Your verified proposal has been logged for administrator review.
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback}>
                {fbError && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', borderRadius: '0.375rem', fontSize: '0.82rem' }}>
                    {fbError}
                  </div>
                )}

                <div className="sblc-form-group">
                  <label htmlFor="fb-url">Dated Gazette or Official Portal URL *</label>
                  <input
                    id="fb-url"
                    type="url"
                    required
                    placeholder="https://mcdonline.nic.in/gazette/..."
                    value={fbSourceUrl}
                    onChange={(e) => setFbSourceUrl(e.target.value)}
                  />
                </div>

                <div className="sblc-form-group">
                  <label htmlFor="fb-notes">Proposed Correction Notes (Zero Personal Details)</label>
                  <textarea
                    id="fb-notes"
                    rows={3}
                    placeholder="Describe revised penalty rule, renewal cutoff, or fee schedule..."
                    value={fbNotes}
                    onChange={(e) => setFbNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowFeedbackModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Submit Proposal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADMINISTRATOR REVIEW QUEUE (#721) */}
      {showAdminModal && (
        <div className="sblc-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <div className="sblc-modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} color="#b45309" />
                <h2 id="admin-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Administrator Review Queue
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                aria-label="Close Admin Modal"
              >
                ×
              </button>
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Moderator review panel for verifying submitted gazette notices, unverified community updates, and circular links.
            </p>

            {proposals.length === 0 ? (
              <div className="sblc-empty-state" style={{ padding: '2rem 1rem' }}>
                <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 700 }}>Review Queue is Clear</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  No pending community submissions require review at this time.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {proposals.map((item) => (
                  <div key={item.id} className={`sblc-admin-item status-${item.status.toLowerCase()}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--glass-bg)', border: '1px solid var(--border-light)' }}>
                        Jurisdiction: {item.jurisdictionKey} | Stage: {item.stage}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: item.status === 'APPROVED' ? '#059669' : item.status === 'REJECTED' ? '#dc2626' : '#b45309'
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.82rem' }}>
                      <strong>Source URL: </strong>
                      <a href={item.officialSourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all' }}>
                        {item.officialSourceUrl}
                      </a>
                    </div>

                    {item.notes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary, rgba(255, 255, 255, 0.04))', padding: '0.5rem', borderRadius: '0.375rem' }}>
                        {item.notes}
                      </div>
                    )}

                    {item.status === 'PENDING_REVIEW' && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleReviewProposal(item.id, 'REJECTED')}
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <X size={12} /> Reject
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleReviewProposal(item.id, 'APPROVED')}
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Check size={12} /> Approve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
