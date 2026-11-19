import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { recordCleaning } from '../../services/publicToiletService';
import { useToast } from '../../context/ToastContext';

export default function ToiletCleaningLogModal({ facility, onClose, onSuccess }) {
  const { toast } = useToast();
  const [waterSupplyVerified, setWaterSupplyVerified] = useState(true);
  const [floorSanitized, setFloorSanitized] = useState(true);
  const [suppliesRestocked, setSuppliesRestocked] = useState(true);
  const [odorLevelOk, setOdorLevelOk] = useState(true);
  const [fixturesInspected, setFixturesInspected] = useState(true);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [cleanerBadge, setCleanerBadge] = useState('WARD-OPS-CREW-1');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!facility) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      recordCleaning(
        {
          facilityId: facility.id,
          cleanerBadge,
          checklist: {
            waterSupplyVerified,
            floorSanitized,
            suppliesRestocked,
            odorLevelOk,
            fixturesInspected,
          },
          operatorNotes,
        },
        { role: 'operator' }
      );

      toast?.success?.('Cleaning event recorded and facility timestamp updated.');
      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to record cleaning event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cleaning-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '1.25rem',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cleaning log modal"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '0.35rem',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <Sparkles size={20} style={{ color: 'var(--primary-main)' }} />
          <h2 id="cleaning-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Log Supervisor Sanitation Run
          </h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Facility: <strong>{facility.name}</strong> ({facility.jurisdiction?.ward})
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              color: 'var(--danger-main, #ef4444)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Sanitation Checklist */}
          <fieldset style={{ border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
            <legend style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', padding: '0 0.4rem' }}>
              Statutory Cleaning Verification Checklist
            </legend>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={waterSupplyVerified}
                  onChange={(e) => setWaterSupplyVerified(e.target.checked)}
                />
                <span>Water supply & overhead cistern level verified</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={floorSanitized}
                  onChange={(e) => setFloorSanitized(e.target.checked)}
                />
                <span>Floor scrubbed & phenolic disinfectant applied</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={suppliesRestocked}
                  onChange={(e) => setSuppliesRestocked(e.target.checked)}
                />
                <span>Liquid hand soap & consumables refilled</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={odorLevelOk}
                  onChange={(e) => setOdorLevelOk(e.target.checked)}
                />
                <span>Air freshener / ventilation verified (odor controlled)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={fixturesInspected}
                  onChange={(e) => setFixturesInspected(e.target.checked)}
                />
                <span>Taps, flush valves, and door latches inspected</span>
              </label>
            </div>
          </fieldset>

          {/* Supervisor Badge */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="cleaner-badge-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Supervisor / Crew Badge Identifier
            </label>
            <input
              id="cleaner-badge-input"
              type="text"
              value={cleanerBadge}
              onChange={(e) => setCleanerBadge(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="cleaning-notes-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Operator Notes / Observations
            </label>
            <textarea
              id="cleaning-notes-input"
              rows={3}
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="e.g. Deep clean performed, all 4 cabins spotless..."
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Recording...' : 'Submit Cleaning Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

