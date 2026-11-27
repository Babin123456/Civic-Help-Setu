import { useState, useEffect, useRef } from 'react';
import { X, Send, ShieldCheck, CheckCircle } from 'lucide-react';
import { logDiagnostic } from '../../utils/diagnostics';

export default function AddressChangeCorrectionModal({ record, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  const [proposedDetails, setProposedDetails] = useState('');
  const [officialSourceUrl, setOfficialSourceUrl] = useState('');
  const [stateScope, setStateScope] = useState('');
  const [moveTypeScope, setMoveTypeScope] = useState('all');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccessSeal, setSubmitSuccessSeal] = useState(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!proposedDetails.trim() || proposedDetails.trim().length < 10) {
      setSubmitError('Proposed correction details must be at least 10 characters.');
      return;
    }

    if (!officialSourceUrl.startsWith('https://')) {
      setSubmitError('Official source URL must be a valid https link pointing to an official portal or gazette.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/address-change-corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: record.id,
          recordName: record.name,
          proposedDetails: proposedDetails.trim(),
          officialSourceUrl: officialSourceUrl.trim(),
          stateScope: stateScope.trim() || 'All States',
          moveTypeScope,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details?.join(', ') || data.message || data.error || 'Submission failed');
      }

      setSubmitSuccessSeal(data.seal);
    } catch (err) {
      logDiagnostic('Address correction submission error:', err);
      setSubmitError(err.message || 'Failed to submit correction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="correction-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1060,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          maxWidth: '580px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 id="correction-modal-title" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Submit Rule Correction or Broken Link
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {submitSuccessSeal ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <CheckCircle size={48} color="#059669" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#059669', marginBottom: '0.5rem' }}>
                Correction Submitted for Review!
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Thank you for contributing. A civic moderator will verify your official source reference before updating the catalog.
              </p>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-main)',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  marginBottom: '1.5rem',
                }}
              >
                Verification Seal: {submitSuccessSeal}
              </div>
              <div>
                <button type="button" onClick={onClose} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                  Close Window
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target Record:</span>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {record?.name} ({record?.authority?.name})
                </div>
              </div>

              {submitError && (
                <div
                  role="alert"
                  style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    color: '#991b1b',
                    fontSize: '0.85rem',
                    marginBottom: '1rem',
                  }}
                >
                  {submitError}
                </div>
              )}

              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '0.375rem',
                  padding: '0.65rem',
                  fontSize: '0.75rem',
                  color: '#166534',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <ShieldCheck size={16} />
                <span>Zero-PII Guardrail: Submissions must not contain phone numbers, emails, passwords, or personal identity numbers.</span>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label
                  htmlFor="correction-details"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}
                >
                  Proposed Details or Gazette Change:
                </label>
                <textarea
                  id="correction-details"
                  required
                  rows={4}
                  placeholder="Describe the updated rule, changed office procedure, or new portal URL..."
                  value={proposedDetails}
                  onChange={(e) => setProposedDetails(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label
                  htmlFor="correction-source-url"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}
                >
                  Official Government Source URL (HTTPS only):
                </label>
                <input
                  id="correction-source-url"
                  type="url"
                  required
                  placeholder="https://state.gov.in/gazette-notification"
                  value={officialSourceUrl}
                  onChange={(e) => setOfficialSourceUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.85rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-main)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label
                    htmlFor="state-scope"
                    style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}
                  >
                    Applicable State / UT:
                  </label>
                  <input
                    id="state-scope"
                    type="text"
                    placeholder="e.g. Karnataka or All States"
                    value={stateScope}
                    onChange={(e) => setStateScope(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.85rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="move-scope"
                    style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}
                  >
                    Move Scope:
                  </label>
                  <select
                    id="move-scope"
                    value={moveTypeScope}
                    onChange={(e) => setMoveTypeScope(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.85rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-main)',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="all">All Move Types</option>
                    <option value="same_city">Same City</option>
                    <option value="inter_district">Inter-District</option>
                    <option value="inter_state">Inter-State</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  disabled={isSubmitting}
                >
                  <Send size={14} /> {isSubmitting ? 'Submitting...' : 'Submit Correction'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

