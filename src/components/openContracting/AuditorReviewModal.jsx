import { useState } from 'react';
import { X, ShieldAlert, Lock } from 'lucide-react';
import {
  REVIEW_STATUSES,
  checkForForbiddenPII,
  generateAuditSeal,
  isValidHttpsUrl,
} from '../../data/openContractingContract.js';

export default function AuditorReviewModal({
  flag,
  onClose,
  onSubmitReview,
}) {
  const [disposition, setDisposition] = useState(
    flag?.status && flag.status !== 'pending_review' ? flag.status : 'under_investigation'
  );
  const [justification, setJustification] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!flag) return null;

  const piiWarning = checkForForbiddenPII(justification);
  const isUrlInvalid = evidenceUrl.trim() !== '' && !isValidHttpsUrl(evidenceUrl);

  const previewSeal = generateAuditSeal(
    flag.id,
    'CURRENT-USER',
    disposition,
    new Date().toISOString().slice(0, 16)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (justification.trim().length < 15) {
      setErrorMsg('Justification must be at least 15 characters explaining your audit rationale.');
      return;
    }

    if (piiWarning) {
      setErrorMsg(`PII detected: ${piiWarning}. Please remove personal contact numbers or identifiers.`);
      return;
    }

    if (isUrlInvalid) {
      setErrorMsg('Evidence URL must be a valid, secure HTTPS link.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitReview({
        flagId: flag.id,
        noticeId: flag.noticeId,
        disposition,
        justification,
        evidenceDocumentUrl: evidenceUrl.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit audit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card modal-content"
        style={{
          width: '100%',
          maxWidth: '600px',
          background: 'var(--bg-card, #0f172a)',
          color: 'var(--text-primary)',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={20} color="#38bdf8" aria-hidden="true" />
            <h2 id="audit-modal-title" style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
              Record Audit Review Outcome
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review modal"
            className="btn btn-secondary"
            style={{ padding: '0.4rem', borderRadius: '50%', minWidth: 'auto' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Flag Overview */}
        <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.25rem' }}>
            {flag.title}
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            Notice Ref: {flag.tenderRefNumber || 'N/A'} • Indicator: {flag.indicatorCode}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Disposition Select */}
          <div>
            <label htmlFor="disposition-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Review Disposition Status:
            </label>
            <select
              id="disposition-select"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: 'var(--bg-elevated, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
              }}
            >
              {Object.values(REVIEW_STATUSES)
                .filter((st) => st.id !== 'pending_review')
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label} - {st.description}
                  </option>
                ))}
            </select>
          </div>

          {/* Documented Justification */}
          <div>
            <label htmlFor="justification-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Documented Justification (Min 15 chars):
            </label>
            <textarea
              id="justification-input"
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Cite administrative files, technical committee minutes, emergency waivers, or market conditions justifying this review outcome..."
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: 'var(--bg-elevated, #1e293b)',
                color: 'var(--text-primary)',
                border: piiWarning
                  ? '1px solid #ef4444'
                  : '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
                fontSize: '0.85rem',
              }}
            />
            {piiWarning && (
              <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.25rem' }}>
                ⚠️ {piiWarning}. PII is strictly forbidden.
              </div>
            )}
          </div>

          {/* Evidence URL */}
          <div>
            <label htmlFor="evidence-url-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Supporting Evidence Document URL (Optional HTTPS):
            </label>
            <input
              id="evidence-url-input"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://agency.gov.in/proceedings/order-2026.pdf"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                background: 'var(--bg-elevated, #1e293b)',
                color: 'var(--text-primary)',
                border: isUrlInvalid
                  ? '1px solid #ef4444'
                  : '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Cryptographic Seal Preview */}
          <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.65rem', borderRadius: '0.375rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={15} color="#38bdf8" aria-hidden="true" />
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Generated Audit Seal: </span>
              <code style={{ color: '#38bdf8', fontWeight: 600 }}>{previewSeal}</code>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                fontSize: '0.8rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(piiWarning) || isUrlInvalid}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
            >
              {isSubmitting ? 'Recording Seal...' : 'Confirm & Issue Audit Seal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
