import { useState } from 'react';
import {
  X,
  Lightbulb,
  CheckCircle,
  Copy,
  Shield,
} from 'lucide-react';
import {
  FAULT_CATEGORIES,
  FAULT_CATEGORY_LABELS,
} from '../../services/streetlightConstants';
import { STREETLIGHT_JURISDICTIONS } from '../../data/streetlightSeedData';

export default function StreetlightReportModal({
  assets = [],
  onClose,
  onSubmitReport,
  selectedWard = 'WARD-042',
}) {
  const [assetId, setAssetId] = useState('');
  const [jurisdictionId, setJurisdictionId] = useState(selectedWard === 'all' ? 'WARD-042' : selectedWard);
  const [faultCategory, setFaultCategory] = useState(FAULT_CATEGORIES.COMPLETELY_DARK);
  const [landmark, setLandmark] = useState('');
  const [description, setDescription] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Filter available poles for the selected ward
  const wardAssets = assets.filter((a) => a.jurisdictionId === jurisdictionId);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!assetId && !landmark.trim()) {
      setError('Please provide either a Pole Asset ID or a descriptive street landmark.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = onSubmitReport({
        assetId: assetId || null,
        jurisdictionId,
        faultCategory,
        landmark,
        description,
        contactNumber,
      });
      setSubmissionSuccess(result);
    } catch (err) {
      setError(err?.message || 'Failed to submit report. Please verify your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (submissionSuccess?.trackingToken) {
      navigator.clipboard?.writeText(submissionSuccess.trackingToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
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
      aria-labelledby="report-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-card, #121212)',
          color: 'var(--text-primary)',
          borderRadius: '0.85rem',
          border: '1px solid var(--border-main)',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-main)',
            paddingBottom: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lightbulb size={20} style={{ color: '#d97706' }} aria-hidden="true" />
            <h2 id="report-modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Report Streetlight Fault
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
            aria-label="Close form"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {submissionSuccess ? (
          /* Confirmation View */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle size={48} style={{ color: '#16a34a', margin: '0 auto 0.75rem' }} aria-hidden="true" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
              Fault Report Recorded
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
              Your report has been received and evaluated by the municipal spatial clustering engine.
            </p>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border-main)',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600 }}>
                Anonymous Tracking Token
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent-main)' }}>
                  {submissionSuccess.trackingToken}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-main)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  title="Copy Token"
                >
                  <Copy size={13} aria-hidden="true" />
                  {copiedToken ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem' }}>
              Keep this token to track repair progress anonymously at any time.
            </p>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                background: 'var(--accent-main)',
                border: '1px solid var(--accent-main)',
                color: '#050505',
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.825rem',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gap: '0.85rem', marginBottom: '1rem' }}>
              {/* Ward Jurisdiction */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Ward Jurisdiction *
                </label>
                <select
                  value={jurisdictionId}
                  onChange={(e) => {
                    setJurisdictionId(e.target.value);
                    setAssetId('');
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
                  {STREETLIGHT_JURISDICTIONS.map((j) => (
                    <option key={j.id} value={j.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pole Selection (Optional if approximate landmark provided) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Streetlight Pole Asset (Optional if landmark provided)
                </label>
                <select
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
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
                  <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>-- Select from mapped poles in this ward --</option>
                  {wardAssets.map((a) => (
                    <option key={a.id} value={a.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      {a.id} ({a.street} - {a.landmark})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fault Category */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Fault Category *
                </label>
                <select
                  value={faultCategory}
                  onChange={(e) => setFaultCategory(e.target.value)}
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
                  {Object.entries(FAULT_CATEGORIES).map(([key, val]) => (
                    <option key={key} value={val} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                      {FAULT_CATEGORY_LABELS[val]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Landmark / Location description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Street / Landmark Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 100ft Road opposite Metro Exit B, or near cross junction"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
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

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Details like flickering interval, dark stretch length, or sparks noticed..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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

              {/* SMS Notification (Optional) with Privacy Callout */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  Contact Mobile for SMS Updates (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  <Shield size={12} style={{ color: '#16a34a' }} aria-hidden="true" />
                  <span>Privacy guarantee: Your contact is cryptographically hashed and never made public.</span>
                </div>
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
                  background: 'var(--accent-main)',
                  border: '1px solid var(--accent-main)',
                  color: '#050505',
                  padding: '0.45rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
