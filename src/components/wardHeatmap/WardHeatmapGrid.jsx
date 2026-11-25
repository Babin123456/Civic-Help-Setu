/**
 * src/components/wardHeatmap/WardHeatmapGrid.jsx
 * Accessible Choropleth Grid & Semantic Table Presentation for Ward-Level Civic Issue Heatmap (#763).
 */
import { EyeOff, ArrowUpRight, ArrowDownRight, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function WardHeatmapGrid({
  metrics = [],
  viewMode = 'grid',
  onSelectWard,
  selectedWardId,
}) {
  if (metrics.length === 0) {
    return null;
  }

  if (viewMode === 'table') {
    return (
      <div className="glass-panel" style={{ borderRadius: '1rem', overflowX: 'auto', padding: '1rem' }}>
        <table
          className="ward-metrics-table"
          role="table"
          aria-label="Ward Civic Issues Aggregate Table"
          style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
              <th scope="col" style={{ padding: '0.75rem' }}>Ward</th>
              <th scope="col" style={{ padding: '0.75rem' }}>Zone</th>
              <th scope="col" style={{ padding: '0.75rem' }}>Category</th>
              <th scope="col" style={{ padding: '0.75rem', textAlign: 'right' }}>Count</th>
              <th scope="col" style={{ padding: '0.75rem', textAlign: 'right' }}>Rate / 10k</th>
              <th scope="col" style={{ padding: '0.75rem' }}>Trend Velocity</th>
              <th scope="col" style={{ padding: '0.75rem' }}>Privacy Status</th>
              <th scope="col" style={{ padding: '0.75rem', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr
                key={m.metricId}
                style={{
                  borderBottom: '1px solid var(--border-light)',
                  background: selectedWardId === m.wardId ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                }}
              >
                <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                  {m.wardName} <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>({m.wardId})</span>
                </td>
                <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{m.zone}</td>
                <td style={{ padding: '0.75rem' }}>{m.categoryLabel}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>
                  {m.suppressed ? (
                    <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                      &lt; 5 (Suppressed)
                    </span>
                  ) : (
                    <span>{m.displayCount}</span>
                  )}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                  {m.ratePer10kPopulation !== null ? `${m.ratePer10kPopulation}` : 'N/A'}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '99px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background:
                        m.trendDirection === 'rising'
                          ? 'rgba(239, 68, 68, 0.1)'
                          : m.trendDirection === 'falling'
                          ? 'rgba(34, 197, 94, 0.1)'
                          : 'rgba(100, 116, 139, 0.1)',
                      color:
                        m.trendDirection === 'rising'
                          ? '#ef4444'
                          : m.trendDirection === 'falling'
                          ? '#16a34a'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {m.trendDirection === 'rising' ? <ArrowUpRight size={13} /> : m.trendDirection === 'falling' ? <ArrowDownRight size={13} /> : <ArrowRight size={13} />}
                    {m.trendDirection.toUpperCase()} ({m.percentChange > 0 ? `+${m.percentChange}%` : `${m.percentChange}%`})
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {m.suppressed ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#eab308', fontSize: '0.75rem' }}>
                      <EyeOff size={13} /> Small-Cell Suppressed
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#16a34a', fontSize: '0.75rem' }}>
                      <ShieldCheck size={13} /> Published
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onSelectWard?.(m.wardId)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    aria-label={`View trend details for ${m.wardName}`}
                  >
                    Explore Trend
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Grid / Heatmap Card Mode
  return (
    <div
      role="region"
      aria-label="Ward Civic Issues Heatmap Grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
        gap: '1rem',
      }}
    >
      {metrics.map((m) => {
        const isSelected = selectedWardId === m.wardId;
        const isHighAnomaly = m.anomalyScore > 0.4 && !m.suppressed;

        return (
          <div
            key={m.metricId}
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            onClick={() => onSelectWard?.(m.wardId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectWard?.(m.wardId);
              }
            }}
            className="glass-panel"
            style={{
              borderRadius: '1rem',
              padding: '1.25rem',
              cursor: 'pointer',
              border: isSelected
                ? '2px solid var(--accent-main, #38bdf8)'
                : isHighAnomaly
                ? '1px solid rgba(239, 68, 68, 0.4)'
                : '1px solid var(--border-light)',
              background: isSelected
                ? 'rgba(56, 189, 248, 0.06)'
                : isHighAnomaly
                ? 'rgba(239, 68, 68, 0.03)'
                : 'var(--bg-card)',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '190px',
            }}
          >
            <div>
              {/* Card Header: Ward & Zone */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{m.wardName}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {m.zone} &bull; {m.wardId}
                  </span>
                </div>
                {isHighAnomaly && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '99px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                    }}
                  >
                    <AlertTriangle size={12} /> Hotspot
                  </span>
                )}
              </div>

              {/* Category */}
              <div style={{ marginBottom: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '0.35rem',
                    background: 'var(--accent-light, #bae6fd)',
                    color: 'var(--accent-main, #0369a1)',
                  }}
                >
                  {m.categoryLabel}
                </span>
              </div>

              {/* Metric Counts */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
                {m.suppressed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-tertiary)' }}>
                    <EyeOff size={16} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, fontStyle: 'italic' }}>
                      &lt; 5 (Suppressed)
                    </span>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {m.displayCount}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      issues ({m.ratePer10kPopulation}/10k pop)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Row: Trend and Footer Notice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '0.6rem',
                borderTop: '1px solid var(--border-light)',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    fontWeight: 600,
                    color:
                      m.trendDirection === 'rising'
                        ? '#ef4444'
                        : m.trendDirection === 'falling'
                        ? '#16a34a'
                        : 'var(--text-secondary)',
                  }}
                >
                  {m.trendDirection === 'rising' ? <ArrowUpRight size={14} /> : m.trendDirection === 'falling' ? <ArrowDownRight size={14} /> : <ArrowRight size={14} />}
                  {m.trendDirection.toUpperCase()} ({m.percentChange > 0 ? `+${m.percentChange}%` : `${m.percentChange}%`})
                </span>
              </div>

              <span style={{ color: 'var(--text-tertiary)' }}>
                {m.suppressed ? 'k-Anonymity Guard' : 'Click to Explore'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
