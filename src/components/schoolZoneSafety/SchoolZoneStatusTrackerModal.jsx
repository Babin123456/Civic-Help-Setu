import { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  AUDIT_STATUSES,
  AUDIT_STATUS_LABELS,
  ALLOWED_STATUS_TRANSITIONS,
  HAZARD_TYPE_LABELS,
  ROAD_AUTHORITY_METADATA,
} from '../../data/upSchoolZoneSafetyContract';

export default function SchoolZoneStatusTrackerModal({
  isOpen,
  onClose,
  audit,
  onUpdateStatus,
}) {
  const [targetStatus, setTargetStatus] = useState('');
  const [actorName, setActorName] = useState('Assistant Engineer / Field Officer');
  const [notes, setNotes] = useState('');
  const [transitionError, setTransitionError] = useState('');

  if (!isOpen || !audit) return null;

  const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[audit.status] || [];
  const currentStatusLabel = AUDIT_STATUS_LABELS[audit.status] || audit.status;

  const handleStatusSubmit = (e) => {
    e.preventDefault();
    setTransitionError('');

    if (!targetStatus) {
      setTransitionError('Please select a target status to advance this audit.');
      return;
    }

    try {
      onUpdateStatus({
        reportId: audit.id,
        targetStatus,
        actor: actorName.trim() || 'Civic Authority Officer',
        notes: notes.trim(),
      });
      setNotes('');
      setTargetStatus('');
    } catch (err) {
      setTransitionError(err.message || 'Failed to update status.');
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-tracker-title"
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: '0.75rem',
          maxWidth: '640px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-light, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--primary, #2563eb)',
                fontFamily: 'monospace',
              }}
            >
              {audit.id}
            </span>
            <h2 id="status-tracker-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.15rem 0 0 0' }}>
              Safety Audit Lifecycle Tracker
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary, #94a3b8)',
              padding: '0.25rem',
            }}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Summary Banner */}
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{audit.schoolName}</div>
            <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              UDISE: {audit.udiseCode} • Entrance: {audit.gateId} • Hazard: {HAZARD_TYPE_LABELS[audit.hazardType]}
            </div>
            <div style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>
              <strong>Responsible Road Authority:</strong> {ROAD_AUTHORITY_METADATA[audit.assignedAuthority]?.label || audit.assignedAuthority}
            </div>
          </div>

          {/* Current Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Current Status:</span>
            <span
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 700,
                background:
                  audit.status === AUDIT_STATUSES.RESOLVED
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                color:
                  audit.status === AUDIT_STATUSES.RESOLVED ? '#059669' : '#2563eb',
              }}
            >
              {currentStatusLabel}
            </span>
          </div>

          {/* Historical Status Timeline */}
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Statutory Resolution Audit Trail
            </h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                borderLeft: '2px solid var(--border-light, #cbd5e1)',
                marginLeft: '0.5rem',
                paddingLeft: '0.85rem',
              }}
            >
              {audit.statusHistory?.map((h, i) => (
                <div key={i} style={{ fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--primary, #2563eb)',
                        marginLeft: '-1.15rem',
                      }}
                    />
                    <span>{AUDIT_STATUS_LABELS[h.status] || h.status}</span>
                    <span style={{ color: 'var(--text-tertiary, #94a3b8)', fontWeight: 400, fontSize: '0.74rem' }}>
                      ({new Date(h.timestamp).toLocaleDateString()})
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                    By: {h.actor}
                  </div>
                  {h.notes && (
                    <div style={{ color: 'var(--text-primary, #334155)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                      "{h.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Advance Lifecycle Form */}
          {allowedNextStatuses.length > 0 ? (
            <form
              onSubmit={handleStatusSubmit}
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light, #e2e8f0)',
                background: 'rgba(15, 23, 42, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700 }}>
                Advance Lifecycle Stage
              </h4>

              {transitionError && (
                <div
                  style={{
                    padding: '0.55rem',
                    borderRadius: '0.375rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #f87171',
                    color: '#dc2626',
                    fontSize: '0.8rem',
                  }}
                >
                  {transitionError}
                </div>
              )}

              {/* Statutory Note on AC-4 Invariant */}
              {audit.status === AUDIT_STATUSES.ACKNOWLEDGED && (
                <div
                  style={{
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.375rem',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>
                    <strong>Statutory Rule (AC-4):</strong> Acknowledged reports cannot be marked "Resolved" without a documented field inspection or interim safety measure.
                  </span>
                </div>
              )}

              <div>
                <label htmlFor="target-status-select" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Select Next Permitted Lifecycle Stage
                </label>
                <select
                  id="target-status-select"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">-- Choose next stage --</option>
                  {allowedNextStatuses.map((st) => (
                    <option key={st} value={st}>
                      {AUDIT_STATUS_LABELS[st] || st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="actor-name-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Official / Inspector Actor Name & Designation
                </label>
                <input
                  id="actor-name-input"
                  type="text"
                  value={actorName}
                  onChange={(e) => setActorName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label htmlFor="status-notes-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Inspection Findings / Interim Measure Notes
                </label>
                <textarea
                  id="status-notes-input"
                  rows={2}
                  placeholder="Record physical inspection observations, work orders issued, or interim measures placed..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  alignSelf: 'flex-end',
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  background: 'var(--primary, #2563eb)',
                  color: '#ffffff',
                }}
              >
                Advance Status
              </button>
            </form>
          ) : (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.375rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <CheckCircle2 size={16} />
              <span>This hazard report has reached terminal resolution. Permanent civil infrastructure completed.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
