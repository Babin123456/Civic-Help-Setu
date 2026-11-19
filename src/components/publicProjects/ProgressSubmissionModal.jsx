import { useState } from 'react';
import {
  Shield,
} from 'lucide-react';
import AccessibleModal from '../common/AccessibleModal';

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(\+91[-\s]?)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

const ProgressSubmissionModal = ({
  isOpen,
  onClose,
  project,
  milestone,
  onSubmitProgress,
}) => {
  const [narrative, setNarrative] = useState('');
  const [reportedPercent, setReportedPercent] = useState(100);
  const [photoUrl, setPhotoUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [lat, setLat] = useState(() => project?.locationGeometry?.centerLat || 12.9716);
  const [lng, setLng] = useState(() => project?.locationGeometry?.centerLng || 77.5946);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!narrative || narrative.trim().length < 20) {
      setErrorMessage('Progress narrative must be at least 20 characters long.');
      return;
    }

    const fullText = `${narrative} ${caption}`;
    if (AADHAAR_REGEX.test(fullText) || PAN_REGEX.test(fullText) || PHONE_REGEX.test(fullText) || EMAIL_REGEX.test(fullText)) {
      setErrorMessage('Submission contains personal data (Aadhaar, PAN, phone, or email). Please remove personal identifiers.');
      return;
    }

    const finalPhoto = photoUrl.trim() || `https://storage.civicbridge.internal/evidence/${project.id}/${milestone.id}_capture.jpg`;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      onSubmitProgress({
        projectId: project.id,
        milestoneId: milestone.id,
        narrative: narrative.trim(),
        reportedPercent: Number(reportedPercent),
        evidenceAssets: [
          {
            storageUrl: finalPhoto,
            publicPreviewUrl: finalPhoto,
            caption: caption.trim() || 'Field verification inspection image',
            geoTag: { lat: Number(lat), lng: Number(lng), accuracyMeters: 4 },
          },
        ],
        idempotencyKey: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit milestone progress.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!milestone) return null;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Progress Evidence & Field Observations"
      subtitle={`Stage ${milestone.sequenceOrder}: ${milestone.title}`}
      maxWidth="620px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* Anti-PII Safety Banner */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.8rem',
            color: 'var(--accent-main, #38bdf8)',
          }}
        >
          <Shield size={18} style={{ flexShrink: 0 }} />
          <span>
            Public Transparency Rule: All reports are archived with cryptographic seals. Do not include personal identity numbers or private contact details.
          </span>
        </div>

        {/* Narrative Input */}
        <div>
          <label htmlFor="narrative-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}>
            Work Done / Progress Narrative <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            id="narrative-input"
            rows={3}
            placeholder="Describe physical work completed, materials laid, and current site condition (min 20 characters)..."
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem',
              borderRadius: '6px',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
              background: 'rgba(0,0,0,0.25)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Reported Percentage */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="reported-percent" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}>
              Reported Milestone Completion (%)
            </label>
            <input
              id="reported-percent"
              type="number"
              min="1"
              max="100"
              value={reportedPercent}
              onChange={(e) => setReportedPercent(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label htmlFor="caption-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}>
              Photo Caption / Landmark
            </label>
            <input
              id="caption-input"
              type="text"
              placeholder="e.g. Chainage 1+500 compaction test"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Photo URL or Attachment */}
        <div>
          <label htmlFor="photo-url-input" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}>
            Evidence Photo URL (or leave blank for simulated field capture)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="photo-url-input"
              type="url"
              placeholder="https://example.com/site-evidence.jpg"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              style={{
                flex: 1,
                padding: '0.55rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {/* Geo Coordinates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="lat-input" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.2rem' }}>
              Latitude
            </label>
            <input
              id="lat-input"
              type="number"
              step="0.0001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.8rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label htmlFor="lng-input" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.2rem' }}>
              Longitude
            </label>
            <input
              id="lng-input"
              type="number"
              step="0.0001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                background: 'rgba(0,0,0,0.25)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.8rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div
            style={{
              padding: '0.6rem 0.8rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '0.8rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Seal & Submit Evidence'}
          </button>
        </div>
      </form>
    </AccessibleModal>
  );
};

export default ProgressSubmissionModal;
