import { useState } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

export const CounterDemandOverrideModal = ({
  isOpen,
  onClose,
  onConfirm,
  variancePct = 0,
  officeName,
  planDate,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 8) {
      setError('Please provide an operational justification (minimum 8 characters).');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-modal-title"
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          maxWidth: '540px',
          width: '100%',
          padding: '1.5rem',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '50%', background: 'var(--warning-bg, #fef3c7)', color: 'var(--warning-text, #b45309)' }}>
              <AlertTriangle size={20} />
            </div>
            <h3 id="override-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
              Staffing Variance Justification Required
            </h3>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Your draft counter allocation for <strong>{officeName}</strong> on <strong>{planDate}</strong> departs by{' '}
          <strong style={{ color: 'var(--warning-text, #b45309)' }}>{variancePct.toFixed(0)}%</strong> from the Erlang-C mathematical recommendation.
          Per civic audit protocol #764, administrative overrides must be justified and recorded in the permanent audit trail.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="override-reason-input"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              Operational Justification <span style={{ color: 'var(--danger-text, #ef4444)' }}>*</span>
            </label>
            <textarea
              id="override-reason-input"
              rows={3}
              className="form-control"
              placeholder="e.g. Counter 4 offline for biometric scanner maintenance, shifting 2 staff to verification counters."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              style={{
                width: '100%',
                borderRadius: '8px',
                border: error ? '1px solid var(--danger-border, #ef4444)' : '1px solid var(--border)',
                padding: '0.6rem 0.8rem',
                fontSize: '0.875rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
              }}
            />
            {error && (
              <p style={{ color: 'var(--danger-text, #ef4444)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                {error}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <CheckCircle size={16} />
              Confirm &amp; Record Override
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CounterDemandOverrideModal;

