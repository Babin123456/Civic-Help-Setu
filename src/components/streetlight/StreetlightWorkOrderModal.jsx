import { useState } from 'react';
import {
  X,
  Wrench,
} from 'lucide-react';
import {
  PRIORITY_TIERS,
  PRIORITY_TIER_LABELS,
} from '../../services/streetlightConstants';

const TECHNICIAN_OPTIONS = [
  { id: 'TECH-042-A', name: 'Ramesh Kumar (East Division Crew)' },
  { id: 'TECH-084-B', name: 'Suresh Kumar (South Division Crew)' },
  { id: 'TECH-110-C', name: 'Anand Verma (Whitefield Electricals)' },
  { id: 'TECH-EMERGENCY', name: 'Rapid Night Response Unit 1' },
];

export default function StreetlightWorkOrderModal({
  cluster,
  onClose,
  onConfirmDispatch,
}) {
  const [assignedTechnicianId, setAssignedTechnicianId] = useState(TECHNICIAN_OPTIONS[0].id);
  const [priority, setPriority] = useState(cluster?.priorityTier || PRIORITY_TIERS.HIGH);
  const [targetSlaHours, setTargetSlaHours] = useState(cluster?.priorityTier === 'critical' ? 24 : 48);
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!cluster) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const techObj = TECHNICIAN_OPTIONS.find((t) => t.id === assignedTechnicianId);

    setIsSubmitting(true);
    try {
      onConfirmDispatch({
        clusterId: cluster.id,
        assignedTechnicianId,
        assignedTechnicianName: techObj?.name || assignedTechnicianId,
        priority,
        targetSlaHours: Number(targetSlaHours),
        scheduledDate,
        notes,
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to dispatch work order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-order-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-card, #121212)',
          color: 'var(--text-primary)',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-main)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-main)',
            paddingBottom: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Wrench size={20} style={{ color: 'var(--accent-main)' }} aria-hidden="true" />
            <h2 id="work-order-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Dispatch Field Repair Work Order
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.35rem',
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Target Corridor Banner */}
        <div
          style={{
            padding: '0.75rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {cluster.corridorName}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.775rem' }}>
            {cluster.jurisdictionId} • {cluster.poleCount || 1} Streetlights Affected • Priority: {cluster.priorityTier?.toUpperCase()}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '0.6rem 0.8rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              borderRadius: '0.4rem',
              fontSize: '0.825rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '0.85rem', marginBottom: '1.25rem' }}>
            {/* Field Crew / Technician */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                Assigned Repair Crew / Technician *
              </label>
              <select
                value={assignedTechnicianId}
                onChange={(e) => setAssignedTechnicianId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {TECHNICIAN_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority & SLA */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Work Order Priority *
                </label>
                <select
                  value={priority}
                  onChange={(e) => {
                    const newP = e.target.value;
                    setPriority(newP);
                    setTargetSlaHours(newP === 'critical' ? 24 : newP === 'high' ? 48 : 72);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {Object.entries(PRIORITY_TIERS).map(([key, val]) => (
                    <option key={key} value={val} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      {PRIORITY_TIER_LABELS[val]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Target SLA (Hours) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={targetSlaHours}
                  onChange={(e) => setTargetSlaHours(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>

            {/* Scheduled Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                Scheduled Field Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                Instructions / Material Needs for Crew
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Inspect underground feeder junction box and carry 70W LED modules..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.65rem',
                  borderRadius: '0.4rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid var(--border-main)', paddingTop: '0.85rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: '#2563eb',
                border: '1px solid #3b82f6',
                color: '#ffffff',
                padding: '0.45rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
