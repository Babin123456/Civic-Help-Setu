/**
 * src/components/pedestrianBarriers/BarrierReportingModal.jsx
 * Citizen submission modal for newly observed pedestrian obstacles with anti-PII protection (#757).
 */

import { useState } from 'react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import {
  BARRIER_TYPES,
  BARRIER_SEVERITIES,
  checkForForbiddenPII,
} from '../../data/pedestrianBarrierContract.js';

export default function BarrierReportingModal({
  isOpen,
  onClose,
  onSubmit,
  segments = [],
  selectedWard = 'Ward 150 - Bellandur',
  isOnline = true,
}) {
  const [segmentId, setSegmentId] = useState(segments[0]?.id || 'SEG-101-102');
  const [barrierType, setBarrierType] = useState('missing_curb_ramp');
  const [severity, setSeverity] = useState('high_barrier');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const piiWarning = checkForForbiddenPII(description);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (description.trim().length < 15) {
      setErrorMsg('Please provide a description of at least 15 characters detailing the pedestrian obstacle.');
      return;
    }

    if (piiWarning) {
      setErrorMsg(`Privacy Violation: ${piiWarning}. Please remove personal contact numbers or identifiers.`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        segmentId,
        barrierType,
        severity,
        ward: selectedWard,
        description,
        photoUrl,
        coordinates: { lat: 12.915, lng: 77.67 },
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit observation. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          border: '1px solid var(--border-light)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} style={{ color: 'var(--warning, #f59e0b)' }} aria-hidden="true" />
            <h2 id="report-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Report Pedestrian Infrastructure Barrier
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-ghost"
            style={{ padding: '0.25rem', borderRadius: '50%' }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {!isOnline && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              marginBottom: '1rem',
            }}
          >
            ℹ️ <strong>Offline Mode:</strong> Your observation will be safely queued on your device and synchronized once network connectivity resumes.
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: '0.82rem',
              color: 'var(--danger, #ef4444)',
              marginBottom: '1rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.25rem' }}>
            <div>
              <label
                htmlFor="barrier-corridor-select"
                style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
              >
                Affected Footpath / Corridor
              </label>
              <select
                id="barrier-corridor-select"
                value={segmentId}
                onChange={(e) => setSegmentId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-input, var(--bg-card))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.corridorName} ({s.ward})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label
                  htmlFor="barrier-type-select"
                  style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Barrier Category
                </label>
                <select
                  id="barrier-type-select"
                  value={barrierType}
                  onChange={(e) => setBarrierType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, var(--bg-card))',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {Object.entries(BARRIER_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="barrier-severity-select"
                  style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
                >
                  Impedance Severity
                </label>
                <select
                  id="barrier-severity-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    background: 'var(--bg-input, var(--bg-card))',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {Object.entries(BARRIER_SEVERITIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label
                  htmlFor="barrier-description"
                  style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  Physical Description of Obstacle
                </label>
                <span style={{ fontSize: '0.74rem', color: description.length < 15 ? 'var(--text-tertiary)' : 'var(--success, #10b981)' }}>
                  {description.length}/1000 chars (min 15)
                </span>
              </div>
              <textarea
                id="barrier-description"
                rows={3}
                placeholder="Detail the physical obstruction (e.g. 20cm kerb step without ramp, broken paver tiles, open chamber, vendor cart narrowing path to 60cm)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-input, var(--bg-card))',
                  border: piiWarning ? '1px solid var(--danger, #ef4444)' : '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
              {piiWarning && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--danger, #ef4444)', marginTop: '0.25rem' }}>
                  <ShieldAlert size={13} aria-hidden="true" />
                  {piiWarning}. Please do not submit personal contact details.
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="barrier-photo-url"
                style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}
              >
                Supporting Photo (Optional secure URL)
              </label>
              <input
                id="barrier-photo-url"
                type="text"
                placeholder="https://example.com/photos/curb-barrier.jpg"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--bg-input, var(--bg-card))',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
              border: '1px solid var(--border-light)',
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.25rem',
            }}
          >
            🛡️ <strong>Statutory Privacy Notice:</strong> Submissions become part of public municipal defect records. Never submit personal identity cards, Aadhaar, phone numbers, or private medical details.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(piiWarning) || description.length < 15}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              {submitting ? 'Submitting Observation...' : 'Submit Barrier Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
