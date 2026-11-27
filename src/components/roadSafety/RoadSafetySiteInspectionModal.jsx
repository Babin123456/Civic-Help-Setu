import { useState, useEffect } from 'react';
import { X, ClipboardCheck, AlertCircle, Camera } from 'lucide-react';
import { LIGHTING_QUALITIES } from '../../data/roadSafetyContract';

export default function RoadSafetySiteInspectionModal({
  selectedCase,
  onClose,
  onSubmitInspection,
}) {
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [findings, setFindings] = useState('');
  const [crossingObservations, setCrossingObservations] = useState('');
  const [lightingCondition, setLightingCondition] = useState('poor');
  const [speedSurveyObservedKmph, setSpeedSurveyObservedKmph] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!selectedCase) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!findings.trim() || findings.trim().length < 10) {
      setErrorMsg('Detailed site inspection findings must be at least 10 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const photos = [];
      if (photoUrl.trim()) {
        photos.push({
          name: photoName.trim() || 'Site Photo',
          url: photoUrl.trim(),
          caption: photoCaption.trim(),
        });
      }

      await onSubmitInspection(selectedCase.id, {
        inspectionDate,
        findings: findings.trim(),
        crossingObservations: crossingObservations.trim(),
        lightingCondition,
        speedSurveyObservedKmph: speedSurveyObservedKmph ? Number(speedSurveyObservedKmph) : null,
        evidencePhotos: photos,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to document site inspection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-inspection-modal-title"
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
          maxWidth: '650px',
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
            <ClipboardCheck size={20} color="#10b981" />
            <h2 id="site-inspection-modal-title" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Document Physical Site Inspection
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close site inspection modal"
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
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Document physical ground observations for: <strong style={{ color: 'var(--text-primary)' }}>{selectedCase.segment?.name}</strong>.
          </p>

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label htmlFor="insp-date" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Inspection Date *
              </label>
              <input
                id="insp-date"
                type="date"
                required
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
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
              <label htmlFor="insp-speed-survey" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Observed Spot Speed (km/h)
              </label>
              <input
                id="insp-speed-survey"
                type="number"
                min="10"
                max="160"
                value={speedSurveyObservedKmph}
                onChange={(e) => setSpeedSurveyObservedKmph(e.target.value)}
                placeholder="e.g. 75"
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
          </div>

          <div>
            <label htmlFor="insp-lighting" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Night Illumination Quality Observed
            </label>
            <select
              id="insp-lighting"
              value={lightingCondition}
              onChange={(e) => setLightingCondition(e.target.value)}
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
              {Object.entries(LIGHTING_QUALITIES).map(([k, v]) => (
                <option key={k} value={v}>
                  {v.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="insp-findings" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Physical Audit Findings & Deficiencies (Min 10 characters) *
            </label>
            <textarea
              id="insp-findings"
              required
              rows={3}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Document pavement condition, sight distance, junction geometry, signage defects, or median openings..."
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
            <label htmlFor="insp-crossing" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Pedestrian Movement & Crossing Vulnerability
            </label>
            <textarea
              id="insp-crossing"
              rows={2}
              value={crossingObservations}
              onChange={(e) => setCrossingObservations(e.target.value)}
              placeholder="Observations on pedestrian desire lines, refuge islands, zebra markings, or jaywalking..."
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

          {/* Evidence Photo Reference */}
          <div style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              <Camera size={14} color="var(--accent-main)" />
              Photographic Evidence Reference (HTTPS Only)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                placeholder="Photo label (e.g. Breached median)"
                value={photoName}
                onChange={(e) => setPhotoName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.55rem',
                  borderRadius: '0.35rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                }}
              />
              <input
                type="url"
                placeholder="HTTPS URL"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.55rem',
                  borderRadius: '0.35rem',
                  border: '1px solid var(--border-main)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                }}
              />
            </div>
            <input
              type="text"
              placeholder="Caption or location context"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.55rem',
                borderRadius: '0.35rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
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
              {isSubmitting ? 'Saving...' : 'Save Site Inspection Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

