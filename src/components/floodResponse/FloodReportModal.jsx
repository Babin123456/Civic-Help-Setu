import { useState } from 'react';
import { X, ShieldCheck, AlertCircle, WifiOff } from 'lucide-react';
import {
  UP_PILOT_DISTRICTS,
  INCIDENT_TYPES,
  DEPTH_CATEGORIES,
  DEPTH_LABELS,
} from '../../data/upFloodIncidentContract';

export default function FloodReportModal({
  isOpen,
  onClose,
  onSubmit,
  isOnline,
}) {
  const [district, setDistrict] = useState('Lucknow');
  const [locality, setLocality] = useState('');
  const [ward, setWard] = useState('');
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES.FLOODED_ROAD);
  const [depthCategory, setDepthCategory] = useState(DEPTH_CATEGORIES.KNEE_DEEP);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!locality || locality.trim().length < 3) {
      setError('Please provide a valid locality, crossing, or landmark name (minimum 3 characters).');
      return;
    }

    try {
      onSubmit({
        district,
        locality: locality.trim(),
        ward: ward.trim() || undefined,
        incidentType,
        depthCategory,
        notes: notes.trim() || undefined,
        observedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit report');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #0f172a)',
          color: 'var(--text-primary)',
          borderRadius: '0.75rem',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-light, #334155)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 id="report-modal-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
            Report Flooded Road or Drain Blockage
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Offline Warning */}
        {!isOnline && (
          <div
            style={{
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#facc15',
              padding: '0.6rem 0.8rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <WifiOff size={16} />
            <span>
              You are currently offline. Your report will be saved to the <strong>Offline Draft Queue</strong> and
              submitted automatically once network connection is restored.
            </span>
          </div>
        )}

        {/* Privacy Redaction Guarantee */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: 'var(--text-secondary)',
            padding: '0.6rem 0.8rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <ShieldCheck size={18} color="var(--accent, #38bdf8)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Anonymous &amp; Redacted:</strong> Submissions are anonymous. Exact flat, door, or house numbers are
            automatically removed to protect residential privacy.
          </span>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '0.6rem',
              borderRadius: '0.4rem',
              marginBottom: '1rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* District */}
          <div>
            <label htmlFor="report-district" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              UP District *
            </label>
            <select
              id="report-district"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                background: 'var(--bg-card-hover, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontSize: '0.85rem',
              }}
            >
              {UP_PILOT_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Locality */}
          <div>
            <label htmlFor="report-locality" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Locality / Major Intersection / Landmark *
            </label>
            <input
              id="report-locality"
              type="text"
              placeholder="e.g. Parivartan Chowk Underpass or Hazratganj Main Road"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                background: 'var(--bg-card-hover, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontSize: '0.85rem',
              }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Avoid entering personal house or flat numbers. Use public intersections or landmarks.
            </span>
          </div>

          {/* Ward (Optional) */}
          <div>
            <label htmlFor="report-ward" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Municipal Ward (Optional)
            </label>
            <input
              id="report-ward"
              type="text"
              placeholder="e.g. Ward 12 or Alambagh Ward"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                background: 'var(--bg-card-hover, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Incident Type */}
          <div>
            <label htmlFor="report-type" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Incident Type *
            </label>
            <select
              id="report-type"
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                background: 'var(--bg-card-hover, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontSize: '0.85rem',
              }}
            >
              <option value={INCIDENT_TYPES.FLOODED_ROAD}>Waterlogged / Flooded Road</option>
              <option value={INCIDENT_TYPES.BLOCKED_DRAIN}>Blocked / Overflowing Drain</option>
              <option value={INCIDENT_TYPES.PASSABLE_ROUTE}>Passable / Clear Corridor</option>
            </select>
          </div>

          {/* Depth Category */}
          <div>
            <label htmlFor="report-depth" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Estimated Water Depth Category *
            </label>
            <select
              id="report-depth"
              value={depthCategory}
              onChange={(e) => setDepthCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                background: 'var(--bg-card-hover, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontSize: '0.85rem',
              }}
            >
              <option value={DEPTH_CATEGORIES.ANKLE_DEEP}>{DEPTH_LABELS.ankle_deep}</option>
              <option value={DEPTH_CATEGORIES.KNEE_DEEP}>{DEPTH_LABELS.knee_deep}</option>
              <option value={DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER}>{DEPTH_LABELS.waist_deep_or_higher}</option>
              <option value={DEPTH_CATEGORIES.CLEARED_PASSABLE}>{DEPTH_LABELS.cleared_passable}</option>
              <option value={DEPTH_CATEGORIES.UNKNOWN}>{DEPTH_LABELS.unknown_or_unspecified}</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="report-notes" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Observation Notes (e.g. stalled vehicles, open drains, tree barricades)
            </label>
            <textarea
              id="report-notes"
              rows={3}
              placeholder="Describe condition, traffic impact, or local cautions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.4rem',
                background: 'var(--bg-card-hover, #1e293b)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontSize: '0.85rem',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
              Submit Anonymous Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
