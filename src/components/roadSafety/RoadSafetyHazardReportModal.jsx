import { useState, useEffect } from 'react';
import { X, AlertTriangle, ShieldCheck, AlertCircle } from 'lucide-react';
import { HAZARD_TYPES, HAZARD_TYPE_LABELS } from '../../data/roadSafetyContract';

export default function RoadSafetyHazardReportModal({
  segments = [],
  onClose,
  onSubmitReport,
}) {
  const [segmentId, setSegmentId] = useState(() => segments[0]?.id || '');
  const [hazardType, setHazardType] = useState('pothole_surface');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!description.trim() || description.trim().length < 10) {
      setErrorMsg('Please describe the hazard in at least 10 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitReport({
        segmentId,
        hazardType,
        severity,
        description: description.trim(),
        locationHint: locationHint.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit road hazard report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hazard-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-main)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <h2 id="hazard-modal-title" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Report Road Hazard or Defect
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hazard modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            role="note"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
            }}
          >
            <ShieldCheck size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              <strong>Privacy Assurance: </strong>
              Hazard submissions are aggregated into engineering audits. Any phone numbers or personal identifiers are automatically stripped.
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="haz-segment" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Target Corridor / Highway
            </label>
            <select
              id="haz-segment"
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              {segments.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.name} ({seg.jurisdiction?.district})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="haz-type" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Hazard Category *
              </label>
              <select
                id="haz-type"
                value={hazardType}
                onChange={(e) => setHazardType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              >
                {Object.entries(HAZARD_TYPES).map(([k, v]) => (
                  <option key={k} value={v}>
                    {HAZARD_TYPE_LABELS[v] || v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="haz-severity" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Severity
              </label>
              <select
                id="haz-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.45rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              >
                <option value="low">Low (Cosmetic/Minor)</option>
                <option value="medium">Medium (Moderate Brake Hazard)</option>
                <option value="high">High (Severe Impact Risk)</option>
                <option value="critical">Critical (Imminent Danger)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="haz-desc" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Hazard Description (Min 10 characters) *
            </label>
            <textarea
              id="haz-desc"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the defect, obstruction, or missing safety element..."
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <div>
            <label htmlFor="haz-landmark" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Landmark or Nearest Junction Hint
            </label>
            <input
              id="haz-landmark"
              type="text"
              value={locationHint}
              onChange={(e) => setLocationHint(e.target.value)}
              placeholder="e.g. Near Metro Pillar 142 or opposite Petrol Pump"
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: '0.45rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '0.45rem',
                background: 'var(--bg-main)',
                border: '1px solid var(--border-main)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '0.45rem',
                background: 'var(--accent-main)',
                border: 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Citizen Hazard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

