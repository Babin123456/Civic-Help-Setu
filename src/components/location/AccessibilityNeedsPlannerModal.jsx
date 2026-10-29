import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Compass,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Save,
  FileDown,
  Phone,
  Check,
  Accessibility,
  Eye,
  Building,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { CIVIC_OFFICES } from '../../data/locationOffices.js';
import {
  getOfficeAccessibilityProfile,
  buildPersonalVisitChecklist,
  savePersonalVisitPlan,
  loadPersonalVisitPlan,
  exportVisitPlanSummary,
} from '../../services/accessibilityPlannerService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { safeHttpUrl } from '../../utils/safeContent';

const AccessibilityNeedsPlannerModal = ({ isOpen, onClose, initialOfficeId = null }) => {
  const { toast } = useToast();
  const [selectedOfficeId, setSelectedOfficeId] = useState(
    initialOfficeId || CIVIC_OFFICES[0]?.id || 'delhi-south-collectorate'
  );

  // Selected features citizen needs
  const [neededFeatureIds, setNeededFeatureIds] = useState([
    'step_free_access',
    'accessible_counters',
  ]);

  // Questions confirmed
  const [confirmedQuestionIds, setConfirmedQuestionIds] = useState([]);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // On open or initialOfficeId change
  useEffect(() => {
    if (initialOfficeId) {
      setSelectedOfficeId(initialOfficeId);
    }
  }, [initialOfficeId]);

  // Load saved plan for selected office
  useEffect(() => {
    if (!selectedOfficeId) return;
    const saved = loadPersonalVisitPlan(selectedOfficeId);
    if (saved) {
      if (Array.isArray(saved.neededFeatureIds)) setNeededFeatureIds(saved.neededFeatureIds);
      if (Array.isArray(saved.confirmedQuestionIds)) setConfirmedQuestionIds(saved.confirmedQuestionIds);
    }
  }, [selectedOfficeId]);

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

  const profile = useMemo(() => {
    return getOfficeAccessibilityProfile(selectedOfficeId);
  }, [selectedOfficeId]);

  const visitChecklist = useMemo(() => {
    const cl = buildPersonalVisitChecklist(selectedOfficeId, neededFeatureIds);
    return {
      ...cl,
      questionsToConfirm: cl.questionsToConfirm.map((q) => ({
        ...q,
        confirmed: confirmedQuestionIds.includes(q.featureId),
      })),
    };
  }, [selectedOfficeId, neededFeatureIds, confirmedQuestionIds]);

  if (!isOpen) return null;

  const handleToggleNeed = (featureId) => {
    if (neededFeatureIds.includes(featureId)) {
      setNeededFeatureIds(neededFeatureIds.filter((id) => id !== featureId));
    } else {
      setNeededFeatureIds([...neededFeatureIds, featureId]);
    }
  };

  const handleToggleQuestionConfirmed = (featureId) => {
    if (confirmedQuestionIds.includes(featureId)) {
      setConfirmedQuestionIds(confirmedQuestionIds.filter((id) => id !== featureId));
    } else {
      setConfirmedQuestionIds([...confirmedQuestionIds, featureId]);
    }
  };

  const handleSavePlan = () => {
    const ok = savePersonalVisitPlan(selectedOfficeId, {
      neededFeatureIds,
      confirmedQuestionIds,
      officeName: profile.office?.name,
    });
    if (ok) {
      toast.success('Accessibility visit plan saved locally.');
    } else {
      toast.error('Failed to save visit plan.');
    }
  };

  const handleExportSummary = async () => {
    const summary = exportVisitPlanSummary(visitChecklist);
    try {
      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(summary);
        setCopiedSummary(true);
        toast.success('Accessibility checklist copied to clipboard.');
        setTimeout(() => setCopiedSummary(false), 2500);
      }
    } catch {
      toast.error('Could not copy summary. Please try again.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-planner-title"
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
          maxWidth: '920px',
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
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)',
              }}
            >
              <Accessibility size={22} />
            </div>
            <div>
              <h2
                id="accessibility-planner-title"
                style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}
              >
                Public-Service Accessibility Needs Planner
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Prepare for in-person office visits with verified facility audits & pre-visit confirmation checklists
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close accessibility planner"
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

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '1.5rem 1.75rem', flex: 1 }}>
          {/* Office Selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="accessibility-office-select"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}
            >
              <Building size={16} color="var(--accent-main)" />
              <span>Select Public Service Office:</span>
            </label>
            <select
              id="accessibility-office-select"
              className="input-field"
              value={selectedOfficeId}
              onChange={(e) => setSelectedOfficeId(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
            >
              {CIVIC_OFFICES.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name} ({office.city}, {office.state})
                </option>
              ))}
            </select>
          </div>

          {/* Audit Verification & Stale Warning Banners */}
          {profile.auditWarning && (
            <div
              style={{
                padding: '0.85rem 1rem',
                background: profile.isStale ? 'rgba(234, 179, 8, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${profile.isStale ? 'rgba(234, 179, 8, 0.35)' : 'rgba(239, 68, 68, 0.25)'}`,
                borderRadius: '0.75rem',
                fontSize: '0.82rem',
                color: profile.isStale ? '#eab308' : '#ef4444',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>{profile.isStale ? 'Stale Audit Record Warning:' : 'Unverified Office Facility Notice:'}</strong>
                <div style={{ marginTop: '0.2rem', color: 'var(--text-secondary)' }}>{profile.auditWarning}</div>
              </div>
            </div>
          )}

          {/* Known Audit Metadata Bar */}
          <div
            style={{
              padding: '0.85rem 1rem',
              background: 'var(--glass-bg)',
              borderRadius: '0.75rem',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-tertiary)' }}>Facility Audit Date: </span>
              <strong>{profile.lastAuditedDate ? profile.lastAuditedDate : 'Not Officially Audited'}</strong>
              {profile.auditedBy && (
                <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                  by {profile.auditedBy}
                </span>
              )}
            </div>

            {profile.officialSource && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={15} color="var(--success)" />
                <span style={{ color: 'var(--text-tertiary)' }}>Source:</span>
                <a
                  href={safeHttpUrl(profile.officialSource.url) || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent-main)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                >
                  {profile.officialSource.name}
                  <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>

          {/* Section: Known Accessibility Features */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Known Facility Accommodations (Verified vs Unverified)
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Click checkbox to add to your personal visit confirmation list
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {profile.features.map((feature) => {
                const isNeeded = neededFeatureIds.includes(feature.id);
                const isVerifiedAvailable = feature.status === 'verified_available';
                const isVerifiedUnavailable = feature.status === 'verified_unavailable';
                const isNotVerified = feature.status === 'not_verified';

                return (
                  <div
                    key={feature.id}
                    onClick={() => handleToggleNeed(feature.id)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.75rem',
                      background: isNeeded ? 'rgba(56, 189, 248, 0.08)' : 'var(--glass-bg)',
                      border: `1px solid ${isNeeded ? 'var(--accent-main)' : 'var(--border-light)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isNeeded ? (
                          <CheckSquare size={16} color="var(--accent-main)" />
                        ) : (
                          <Square size={16} color="var(--text-tertiary)" />
                        )}
                        <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {feature.title}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '99px',
                          background: isVerifiedAvailable
                            ? 'rgba(16, 185, 129, 0.15)'
                            : isVerifiedUnavailable
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(255, 255, 255, 0.08)',
                          color: isVerifiedAvailable
                            ? 'var(--success)'
                            : isVerifiedUnavailable
                            ? '#ef4444'
                            : 'var(--text-tertiary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {feature.statusLabel}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {feature.notes}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Personal Visit Checklist & Direct Confirmation */}
          <div
            style={{
              background: 'var(--glass-bg)',
              borderRadius: '0.85rem',
              border: '1px solid var(--border-light)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Personal Pre-Visit Confirmation Checklist ({visitChecklist.questionsToConfirm.filter((q) => q.confirmed).length} of {visitChecklist.questionsToConfirm.length} confirmed)
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Call the office or check their portal to confirm unverified accommodations before travelling.
                </p>
              </div>

              {/* Direct Office Contact Button */}
              {visitChecklist.officialContacts.phone && (
                <a
                  href={`tel:${visitChecklist.officialContacts.phone.replace(/[^0-9+]/g, '')}`}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.75rem',
                  }}
                >
                  <Phone size={14} color="var(--success)" />
                  <span>Call Office ({visitChecklist.officialContacts.phone})</span>
                </a>
              )}
            </div>

            {/* Questions to confirm list */}
            {visitChecklist.questionsToConfirm.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                Select one or more accommodation needs above to generate your pre-visit confirmation questions.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '1rem' }}>
                {visitChecklist.questionsToConfirm.map((q) => (
                  <div
                    key={q.featureId}
                    onClick={() => handleToggleQuestionConfirmed(q.featureId)}
                    style={{
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.6rem',
                      background: q.confirmed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${q.confirmed ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-light)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                    }}
                  >
                    <div style={{ marginTop: '2px' }}>
                      {q.confirmed ? (
                        <CheckSquare size={16} color="var(--success)" />
                      ) : (
                        <Square size={16} color="var(--text-tertiary)" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.85rem', color: q.confirmed ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                          {q.title}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: q.urgency === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                            color: q.urgency === 'critical' ? '#ef4444' : '#eab308',
                            fontWeight: '700',
                          }}
                        >
                          {q.statusLabel}
                        </span>
                      </div>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong>Question to ask: </strong>"{q.question}"
                      </p>
                    </div>
                  </div>
                ))}
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
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
            All accommodation details are sourced from public audits.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleExportSummary}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                padding: '0.5rem 0.95rem',
              }}
            >
              {copiedSummary ? <Check size={15} color="var(--success)" /> : <FileDown size={15} />}
              <span>{copiedSummary ? 'Copied!' : 'Export Checklist'}</span>
            </button>

            <button
              type="button"
              onClick={handleSavePlan}
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
              <span>Save Visit Plan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessibilityNeedsPlannerModal;
