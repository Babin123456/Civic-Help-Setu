import { useState, useEffect } from 'react';
import {
  X,
  GitCompare,
  Plus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Building2,
  MessageSquare,
  FileText,
  Mail,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import {
  ingestStatusEvidence,
  CONFLICT_SEVERITY,
} from '../../services/statusReconciliationEngine.js';
import {
  getCanonicalStatusMeta,
} from '../../services/statusVocabularyNormalizer.js';
import {
  getReconciliationRecord,
  saveReconciliationEvidence,
  removeEvidenceItem,
  purgeReconciliationRecord,
} from '../../services/statusEvidenceStorage.js';
import { useToast } from '../../context/ToastContext.jsx';

const CHANNEL_OPTIONS = [
  { value: 'SMS', label: 'SMS Alert Gateway', icon: MessageSquare },
  { value: 'PORTAL_EXPORT', label: 'Official Web Portal', icon: Building2 },
  { value: 'PAPER_RECEIPT', label: 'Physical Counter Receipt / CSC', icon: FileText },
  { value: 'EMAIL', label: 'Official Department Email', icon: Mail },
  { value: 'USER_NOTE', label: 'Applicant Note / In-person Query', icon: Clock },
];

export default function StatusReconciliationModal({
  application,
  isOpen,
  onClose,
  onRecordUpdated,
}) {
  const { toast } = useToast?.() || {};

  const [prevAppId, setPrevAppId] = useState(application?.id);
  const [record, setRecord] = useState(() =>
    isOpen && application?.id ? getReconciliationRecord(application.id) : null
  );
  const [sourceType, setSourceType] = useState('SMS');
  const [referenceId, setReferenceId] = useState(() => application?.id || '');
  const [evidenceDate, setEvidenceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rawText, setRawText] = useState('');
  const [rawStatus, setRawStatus] = useState('');
  const [channelLabel, setChannelLabel] = useState('');
  const [copiedGuidance, setCopiedGuidance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state during rendering when application prop changes
  if (application?.id !== prevAppId) {
    setPrevAppId(application?.id);
    setRecord(application?.id ? getReconciliationRecord(application.id) : null);
    setReferenceId(application?.id || '');
    setEvidenceDate(new Date().toISOString().split('T')[0]);
    setRawText('');
    setRawStatus('');
    setChannelLabel('');
  }

  // Handle escape key
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

  if (!isOpen || !application) return null;

  const handleAddEvidence = (e) => {
    e.preventDefault();
    if (!rawText.trim() && !rawStatus.trim()) {
      toast?.error?.('Please enter evidence details or status phrase.');
      return;
    }

    setIsSubmitting(true);
    try {
      const evidence = ingestStatusEvidence({
        rawText,
        sourceType,
        referenceId: referenceId.trim() || application.id,
        date: evidenceDate,
        rawStatus,
        channelLabel: channelLabel.trim() || sourceType,
      });

      const updated = saveReconciliationEvidence(application.id, evidence, {
        baseSubmittedDate: application.submittedDate || null,
        slaDays: application.slaDays || 30,
      });

      setRecord(updated);
      setRawText('');
      setRawStatus('');
      setChannelLabel('');
      toast?.success?.('Evidence added and reconciled with existing records.');
      onRecordUpdated?.(updated);
    } catch (err) {
      toast?.error?.(`Failed to save evidence: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveEvidence = (evidenceId) => {
    try {
      const updated = removeEvidenceItem(application.id, evidenceId, {
        baseSubmittedDate: application.submittedDate || null,
        slaDays: application.slaDays || 30,
      });
      setRecord(updated);
      toast?.info?.('Evidence item removed.');
      onRecordUpdated?.(updated);
    } catch (err) {
      toast?.error?.(`Failed to remove evidence: ${err.message}`);
    }
  };

  const handlePurgeAll = () => {
    if (window.confirm?.('Are you sure you want to purge all imported reconciliation evidence for this application?')) {
      purgeReconciliationRecord(application.id);
      setRecord(null);
      toast?.info?.('Reconciliation evidence purged.');
      onRecordUpdated?.(null);
    }
  };

  const handleCopyGuidance = async () => {
    if (record?.lastReport?.guidance?.recommendation && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(record.lastReport.guidance.recommendation);
      setCopiedGuidance(true);
      toast?.success?.('Action recommendation copied to clipboard.');
      setTimeout(() => setCopiedGuidance(false), 2000);
    }
  };

  const report = record?.lastReport;
  const evidenceList = record?.evidenceList || [];
  const statusMeta = report ? getCanonicalStatusMeta(report.consensusStatus) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reconciliation-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: '1rem',
          maxWidth: '850px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
              }}
            >
              <GitCompare className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="reconciliation-modal-title"
                style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}
              >
                Cross-Portal Status Reconciliation Assistant
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                {`Application: ${application.serviceName || 'Civic Service'} (${application.id})`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reconciliation modal"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary, #64748b)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '0.4rem',
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Privacy Note */}
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid #38bdf8',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary, #334155)',
            }}
          >
            <ShieldCheck className="w-5 h-5 text-sky-600" style={{ color: '#0284c7', flexShrink: 0 }} />
            <span>
              <strong>Zero-Scrape &amp; Privacy Protected:</strong> We never scrape password-protected government
              portals or ask for credentials. All text is automatically scrubbed of Aadhaar numbers, phone numbers,
              and secrets on your device before saving.
            </span>
          </div>

          {/* Current Reconciliation Analysis if record exists */}
          {report && (
            <div
              style={{
                background: 'var(--bg-secondary, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Reconciled Consensus Status
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        background: statusMeta.background,
                        color: statusMeta.color,
                      }}
                    >
                      {statusMeta.label}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
                      {statusMeta.description}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                    Reconciliation Confidence
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <div
                      style={{
                        width: '120px',
                        height: '8px',
                        borderRadius: '4px',
                        background: '#e2e8f0',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${report.confidenceScore}%`,
                          height: '100%',
                          background: report.confidenceScore > 75 ? '#10b981' : report.confidenceScore > 50 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <strong style={{ fontSize: '0.9rem' }}>{`${report.confidenceScore}%`}</strong>
                  </div>
                </div>
              </div>

              {/* Detected Conflicts */}
              {report.hasConflicts && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle className="w-4 h-4" />
                    {`Unresolved Discrepancies (${report.conflicts.length})`}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {report.conflicts.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: c.severity === CONFLICT_SEVERITY.HIGH ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                          border: `1px solid ${c.severity === CONFLICT_SEVERITY.HIGH ? '#fca5a5' : '#fde68a'}`,
                          borderRadius: '0.4rem',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.82rem',
                        }}
                      >
                        <strong style={{ color: c.severity === CONFLICT_SEVERITY.HIGH ? '#b91c1c' : '#92400e' }}>
                          {`[${c.severity}] ${c.type.replace(/_/g, ' ')}: `}
                        </strong>
                        <span style={{ color: 'var(--text-primary, #1e293b)' }}>{c.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable Guidance Card */}
              {report.guidance && (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    borderRadius: '0.5rem',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0369a1' }}>
                      {report.guidance.summary}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyGuidance}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary, #64748b)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedGuidance ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedGuidance ? 'Copied' : 'Copy Advice'}
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary, #475569)', lineHeight: 1.5 }}>
                    {report.guidance.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Form: Import New Evidence */}
          <form
            onSubmit={handleAddEvidence}
            style={{
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.98rem', fontWeight: 600 }}>
              Import New Status Evidence
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem', marginBottom: '0.9rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                  Source Channel
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: '0.85rem',
                  }}
                >
                  {CHANNEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                  Reference / Ack Number
                </label>
                <input
                  type="text"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  placeholder="e.g. MH-10293 or 10293/A"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                  Evidence Date
                </label>
                <input
                  type="date"
                  value={evidenceDate}
                  onChange={(e) => setEvidenceDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                  Sender / Channel Label (Optional)
                </label>
                <input
                  type="text"
                  value={channelLabel}
                  onChange={(e) => setChannelLabel(e.target.value)}
                  placeholder="e.g. VZ-MAHAGOV or Taluk Counter #2"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text-primary, #0f172a)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                Status Snippet / SMS Text / Receipt Note
              </label>
              <textarea
                rows={3}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the notification SMS, portal remark, or counter receipt note here..."
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.1rem',
                borderRadius: '0.45rem',
                background: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus className="w-4 h-4" />
              Add Evidence &amp; Reconcile
            </button>
          </form>

          {/* Stored Evidence Items List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
                {`Imported Status Records (${evidenceList.length})`}
              </h3>
              {evidenceList.length > 0 && (
                <button
                  type="button"
                  onClick={handlePurgeAll}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    color: '#ef4444',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Purge All Evidence
                </button>
              )}
            </div>

            {evidenceList.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', fontStyle: 'italic' }}>
                No external evidence imported yet. Paste an SMS or receipt snippet above to compare.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {evidenceList.map((item) => {
                  const itemMeta = getCanonicalStatusMeta(item.normalizedStatus);
                  return (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '0.5rem',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '0.1rem 0.5rem',
                              borderRadius: '0.3rem',
                              background: 'rgba(0,0,0,0.06)',
                            }}
                          >
                            {item.provenance.channelLabel || item.sourceType}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.5rem',
                              borderRadius: '0.3rem',
                              background: itemMeta.background,
                              color: itemMeta.color,
                            }}
                          >
                            {itemMeta.label}
                          </span>
                          {item.extractedReferenceId && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                              {`Ref: ${item.extractedReferenceId}`}
                            </span>
                          )}
                          {item.extractedDate && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                              {`Date: ${item.extractedDate}`}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary, #334155)', wordBreak: 'break-word' }}>
                          {item.rawTextScrubbed || item.rawStatusPhrase}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveEvidence(item.id)}
                        aria-label="Remove evidence item"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          borderRadius: '0.3rem',
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-secondary, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>Civic Help Setu does not issue government decisions or scrape unauthenticated portals.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 1.25rem',
              borderRadius: '0.45rem',
              background: 'var(--border-color, #e2e8f0)',
              color: 'var(--text-primary, #0f172a)',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
