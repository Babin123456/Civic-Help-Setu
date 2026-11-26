/**
 * src/components/wardHeatmap/CivicIssueReportModal.jsx
 * Privacy-preserving citizen intake modal for reporting civic issue events (#763).
 */
import { useState } from 'react';
import { X, ShieldCheck, AlertTriangle, CheckCircle2, FileText, Send } from 'lucide-react';
import {
  MUNICIPAL_WARDS,
  ISSUE_CATEGORIES,
  SEVERITIES,
  containsPii,
} from '../../data/wardIssueHeatmapContract.js';

export default function CivicIssueReportModal({ isOpen, onClose, onSubmitSuccess }) {
  const [wardId, setWardId] = useState('ward-101');
  const [category, setCategory] = useState('potholes_road_damage');
  const [severity, setSeverity] = useState('medium');
  const [coarseLocation, setCoarseLocation] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successReceipt, setSuccessReceipt] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Pre-flight PII check
    if (containsPii(description) || containsPii(coarseLocation)) {
      setErrorMessage(
        'Submission blocked: contains personal identifiable information (phone number, Aadhaar, PAN, or email). Please remove personal details.'
      );
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please provide a short description of the civic issue.');
      return;
    }

    const payload = {
      idempotencyKey: `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      wardId,
      category,
      severity,
      coarseLocation: coarseLocation.trim() || 'General Ward Sector',
      description: description.trim(),
    };

    try {
      const res = onSubmitSuccess(payload);
      setSuccessReceipt(res.event);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit report.');
    }
  };

  const handleReset = () => {
    setSuccessReceipt(null);
    setCoarseLocation('');
    setDescription('');
    setErrorMessage('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intake-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '540px',
          borderRadius: '1.25rem',
          padding: '1.5rem',
          background: 'var(--bg-main)',
          border: '1px solid var(--border-light)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--accent-main)" />
            <h3 id="intake-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Report a Civic Issue for Ward Analytics
            </h3>
          </div>
          <button
            type="button"
            onClick={handleReset}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '0.25rem' }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {successReceipt ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 0.75rem auto' }} />
            <h4 style={{ fontSize: '1.1rem', marginBottom: '0.4rem', fontWeight: 700 }}>
              Report Ingested Successfully
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Your report has been received and mapped to <strong>{successReceipt.wardName}</strong>. Coordinates were snapped to the ward centroid, and your identity remains fully anonymized.
            </p>

            <div
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
              }}
            >
              <div><strong>Receipt Event ID:</strong> {successReceipt.id}</div>
              <div><strong>Ward:</strong> {successReceipt.wardName} ({successReceipt.wardId})</div>
              <div><strong>Category:</strong> {successReceipt.category}</div>
              <div><strong>Anonymous Hash:</strong> {successReceipt.reporterIdHash}</div>
            </div>

            <button type="button" onClick={handleReset} className="btn btn-primary" style={{ width: '100%' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Privacy Guard Notice */}
            <div
              style={{
                display: 'flex',
                gap: '0.6rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                marginBottom: '1rem',
              }}
            >
              <ShieldCheck size={18} color="var(--accent-main)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <div>
                <strong>Zero-PII &amp; Coarse Location Notice:</strong> Do not include your name, phone number, or private house number. Reports are snapped to the ward centroid for aggregate analytics.
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  fontSize: '0.8rem',
                  color: '#ef4444',
                  marginBottom: '1rem',
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Ward select */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="intake-ward-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Municipal Ward:
              </label>
              <select
                id="intake-ward-select"
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {MUNICIPAL_WARDS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.zone} &bull; {w.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Category select */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="intake-category-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Issue Category:
              </label>
              <select
                id="intake-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {Object.values(ISSUE_CATEGORIES).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity select */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="intake-severity-select" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Observed Severity:
              </label>
              <select
                id="intake-severity-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Coarse location landmark */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label htmlFor="intake-location-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Public Landmark / General Area:
              </label>
              <input
                id="intake-location-input"
                type="text"
                placeholder="e.g. Near Community Park perimeter / Main 80-Ft Road junction"
                value={coarseLocation}
                onChange={(e) => setCoarseLocation(e.target.value)}
                maxLength={100}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                Do NOT include private residential address or flat number.
              </span>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="intake-desc-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Issue Description:
              </label>
              <textarea
                id="intake-desc-input"
                rows={3}
                placeholder="Brief factual observation of the civic defect (e.g. deep pothole causing traffic slowdown)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={400}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Submit button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={handleReset} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Send size={15} /> Submit Anonymized Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
