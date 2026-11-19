import { useState, useEffect, useMemo } from 'react';
import { X, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { compareTimePeriods } from '../../services/roadSafetyBlackspotService';

export default function RoadSafetyTimelineComparatorModal({
  segments = [],
  onClose,
}) {
  const [selectedSegmentId, setSelectedSegmentId] = useState(() => segments[0]?.id || '');
  const [periodAStart, setPeriodAStart] = useState('2025-01-01');
  const [periodAEnd, setPeriodAEnd] = useState('2025-06-30');
  const [periodBStart, setPeriodBStart] = useState('2025-10-01');
  const [periodBEnd, setPeriodBEnd] = useState('2025-12-31');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const result = useMemo(() => {
    if (!selectedSegmentId) return null;
    try {
      return compareTimePeriods(
        selectedSegmentId,
        { start: periodAStart, end: periodAEnd },
        { start: periodBStart, end: periodBEnd }
      );
    } catch {
      return null;
    }
  }, [selectedSegmentId, periodAStart, periodAEnd, periodBStart, periodBEnd]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparator-modal-title"
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
          maxWidth: '750px',
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
            <BarChart3 size={20} color="var(--accent-main)" />
            <h2 id="comparator-modal-title" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Timeline & Countermeasure Outcome Comparator
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close timeline comparator"
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

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label htmlFor="compare-segment" style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Select Road Corridor for Comparison
            </label>
            <select
              id="compare-segment"
              value={selectedSegmentId}
              onChange={(e) => setSelectedSegmentId(e.target.value)}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Period A */}
            <div style={{ padding: '0.85rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
                Baseline Window (Period A)
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input
                  type="date"
                  value={periodAStart}
                  onChange={(e) => setPeriodAStart(e.target.value)}
                  style={{ padding: '0.35rem', borderRadius: '0.35rem', border: '1px solid var(--border-main)', fontSize: '0.78rem' }}
                />
                <input
                  type="date"
                  value={periodAEnd}
                  onChange={(e) => setPeriodAEnd(e.target.value)}
                  style={{ padding: '0.35rem', borderRadius: '0.35rem', border: '1px solid var(--border-main)', fontSize: '0.78rem' }}
                />
              </div>
            </div>

            {/* Period B */}
            <div style={{ padding: '0.85rem', background: 'var(--bg-main)', borderRadius: '0.5rem', border: '1px solid var(--border-main)' }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
                Post-Intervention Window (Period B)
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input
                  type="date"
                  value={periodBStart}
                  onChange={(e) => setPeriodBStart(e.target.value)}
                  style={{ padding: '0.35rem', borderRadius: '0.35rem', border: '1px solid var(--border-main)', fontSize: '0.78rem' }}
                />
                <input
                  type="date"
                  value={periodBEnd}
                  onChange={(e) => setPeriodBEnd(e.target.value)}
                  style={{ padding: '0.35rem', borderRadius: '0.35rem', border: '1px solid var(--border-main)', fontSize: '0.78rem' }}
                />
              </div>
            </div>
          </div>

          {/* Results Summary */}
          {result && (
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '0.75rem',
                background: result.improvementDemonstrated ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                border: `1px solid ${result.improvementDemonstrated ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {result.improvementDemonstrated ? (
                  <TrendingDown size={22} color="#10b981" />
                ) : (
                  <TrendingUp size={22} color="#ef4444" />
                )}
                <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  {result.improvementDemonstrated
                    ? 'Measured Crash Risk Reduction'
                    : 'Corridor Variance / Recurrent Crash Pattern'}
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-surface)', borderRadius: '0.4rem', border: '1px solid var(--border-main)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', display: 'block' }}>Period A Crashes</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{result.periodA.stats.total}</strong>
                  <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>{result.periodA.stats.fatal} Fatal</div>
                </div>

                <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-surface)', borderRadius: '0.4rem', border: '1px solid var(--border-main)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', display: 'block' }}>Period B Crashes</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{result.periodB.stats.total}</strong>
                  <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>{result.periodB.stats.fatal} Fatal</div>
                </div>

                <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-surface)', borderRadius: '0.4rem', border: '1px solid var(--border-main)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', display: 'block' }}>Delta Crashes</span>
                  <strong style={{ color: result.deltaTotal <= 0 ? '#10b981' : '#ef4444', fontSize: '1rem' }}>
                    {result.deltaTotal > 0 ? `+${result.deltaTotal}` : result.deltaTotal}
                  </strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{result.percentChange}% Change</div>
                </div>

                <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-surface)', borderRadius: '0.4rem', border: '1px solid var(--border-main)' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', display: 'block' }}>Weighted Score Delta</span>
                  <strong style={{ color: result.deltaWeighted <= 0 ? '#10b981' : '#ef4444', fontSize: '1rem' }}>
                    {result.deltaWeighted > 0 ? `+${result.deltaWeighted}` : result.deltaWeighted}
                  </strong>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Severity Points</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

