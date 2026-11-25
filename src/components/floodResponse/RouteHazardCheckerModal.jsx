import { useState } from 'react';
import { X, Navigation, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { checkRouteHazard } from '../../services/upFloodResponseService';

export default function RouteHazardCheckerModal({
  isOpen,
  onClose,
  district = 'Lucknow',
}) {
  const [corridorQuery, setCorridorQuery] = useState('');
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleCheck = (e) => {
    e.preventDefault();
    if (!corridorQuery.trim()) return;
    const res = checkRouteHazard(corridorQuery.trim(), district);
    setResult(res);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="route-checker-title"
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
          maxWidth: '560px',
          width: '100%',
          border: '1px solid var(--border-light, #334155)',
          padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 id="route-checker-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Navigation size={20} color="var(--accent, #38bdf8)" />
            Route Hazard &amp; Passability Safety Checker
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

        {/* Safety Invariant Notice */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            padding: '0.6rem 0.8rem',
            borderRadius: '0.5rem',
            fontSize: '0.78rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Safety Invariant:</strong> Civic Help Setu will never route users through a reported waterlogging hazard.
            Stale observations are excluded from active blocking.
          </span>
        </div>

        <form onSubmit={handleCheck} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="e.g. Parivartan Chowk or Lohia Path"
            value={corridorQuery}
            onChange={(e) => setCorridorQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '0.4rem',
              background: 'var(--bg-card-hover, #1e293b)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              fontSize: '0.85rem',
            }}
          />
          <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
            Check Safety
          </button>
        </form>

        {result && (
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.5rem',
              background:
                result.hazardLevel === 'DANGEROUS'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : result.hazardLevel === 'CAUTION'
                  ? 'rgba(234, 179, 8, 0.15)'
                  : 'rgba(16, 185, 129, 0.12)',
              border:
                result.hazardLevel === 'DANGEROUS'
                  ? '1px solid #ef4444'
                  : result.hazardLevel === 'CAUTION'
                  ? '1px solid #eab308'
                  : '1px solid #10b981',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
              {result.hazardLevel === 'DANGEROUS' ? (
                <AlertTriangle size={18} color="#ef4444" />
              ) : result.hazardLevel === 'CAUTION' ? (
                <AlertTriangle size={18} color="#eab308" />
              ) : (
                <CheckCircle size={18} color="#10b981" />
              )}
              <strong
                style={{
                  fontSize: '0.95rem',
                  color:
                    result.hazardLevel === 'DANGEROUS'
                      ? '#fca5a5'
                      : result.hazardLevel === 'CAUTION'
                      ? '#fde047'
                      : '#10b981',
                }}
              >
                {result.hazardLevel === 'DANGEROUS'
                  ? 'CRITICAL HAZARD - OVERLAY ACTIVE'
                  : result.hazardLevel === 'CAUTION'
                  ? 'CAUTION: UNCORROBORATED REPORT'
                  : 'PASSABLE CORRIDOR'}
              </strong>
            </div>

            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
              {result.safetyAdvisory}
            </p>

            {result.hazardsFound && result.hazardsFound.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <strong>Active Hazards Encountered:</strong>
                <ul style={{ margin: '0.3rem 0 0 1rem', padding: 0 }}>
                  {result.hazardsFound.map((h) => (
                    <li key={h.id} style={{ marginBottom: '0.2rem' }}>
                      {h.locality} ({h.depthCategory}) - <em>{h.freshnessLabel}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
