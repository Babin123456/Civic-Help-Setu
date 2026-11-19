import { useState } from 'react';
import {
  X,
  Search,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { trackReportByToken } from '../../services/streetlightService';
import {
  REPORT_STATUS_LABELS,
  FAULT_CATEGORY_LABELS,
} from '../../services/streetlightConstants';

export default function StreetlightTrackModal({ onClose }) {
  const [tokenInput, setTokenInput] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please enter a tracking token.');
      return;
    }

    setError('');
    setIsSearching(true);
    try {
      const res = trackReportByToken(tokenInput.trim());
      setReport(res);
    } catch (err) {
      setReport(null);
      setError(err?.message || 'Report not found for this token.');
    } finally {
      setIsSearching(false);
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
      aria-labelledby="track-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '500px',
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
            <Search size={18} style={{ color: 'var(--accent-main)' }} aria-hidden="true" />
            <h2 id="track-modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Track Streetlight Repair Status
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
            aria-label="Close modal"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSearch} style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="e.g. TRK-STLT-789123"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                fontFamily: 'monospace',
              }}
              aria-label="Tracking Token"
            />
            <button
              type="submit"
              disabled={isSearching}
              style={{
                background: 'var(--accent-main)',
                border: '1px solid var(--accent-main)',
                color: '#050505',
                padding: '0.5rem 1.1rem',
                borderRadius: '0.4rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {isSearching ? 'Checking...' : 'Lookup'}
            </button>
          </div>
        </form>

        {error && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              borderRadius: '0.4rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {report && (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-main)',
              borderRadius: '0.5rem',
              padding: '1rem',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-main)' }}>
                {report.trackingToken}
              </span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  background: report.status === 'resolved' ? '#ecfdf5' : '#eff6ff',
                  color: report.status === 'resolved' ? '#065f46' : '#1e40af',
                }}
              >
                {REPORT_STATUS_LABELS[report.status] || report.status}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Fault Type:</strong> {FAULT_CATEGORY_LABELS[report.faultCategory] || report.faultCategory}
              </div>
              {report.assetId && (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Pole ID:</strong> {report.assetId}
                </div>
              )}
              {report.location?.landmark && (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Location:</strong> {report.location.landmark}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-tertiary)', fontSize: '0.775rem', marginTop: '0.35rem' }}>
                <Clock size={13} aria-hidden="true" />
                Reported on: {new Date(report.reportedAt).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
