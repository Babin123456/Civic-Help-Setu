/**
 * src/components/wardHeatmap/TrendComparisonExplorer.jsx
 * Time-windowed trend comparison and multi-ward velocity explorer (#763).
 */
import { useState } from 'react';
import { TrendingUp, EyeOff, BarChart2, Table } from 'lucide-react';
import { MUNICIPAL_WARDS } from '../../data/wardIssueHeatmapContract.js';

export default function TrendComparisonExplorer({
  trendData,
  primaryWardId,
  compareWardId,
  onPrimaryWardChange,
  onCompareWardChange,
}) {
  const [showTable, setShowTable] = useState(false);

  if (!trendData || !trendData.primaryWard) {
    return null;
  }

  const { primaryWard, compareWard, meta } = trendData;

  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        border: '1px solid var(--border-light)',
      }}
    >
      {/* Header and Ward Comparators */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-main)' }}>
            <TrendingUp size={20} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Ward Trend &amp; Issue Velocity Explorer
            </h3>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Compare historical reporting velocity across consecutive intervals while maintaining small-cell privacy.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="primary-ward-select" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.2rem' }}>
              Primary Ward:
            </label>
            <select
              id="primary-ward-select"
              value={primaryWardId}
              onChange={(e) => onPrimaryWardChange(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              {MUNICIPAL_WARDS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="compare-ward-select" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '0.2rem' }}>
              Compare Against (Optional):
            </label>
            <select
              id="compare-ward-select"
              value={compareWardId || ''}
              onChange={(e) => onCompareWardChange(e.target.value || null)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="">None (Single Ward)</option>
              {MUNICIPAL_WARDS.filter((w) => w.id !== primaryWardId).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-end' }}
            aria-label="Toggle trend data between chart and accessible table view"
          >
            {showTable ? <BarChart2 size={15} /> : <Table size={15} />}
            <span>{showTable ? 'View Bars' : 'Accessible Table'}</span>
          </button>
        </div>
      </div>

      {/* Presentation: Accessible Table or Visual Velocity Bars */}
      {showTable ? (
        <div style={{ overflowX: 'auto' }}>
          <table
            className="trend-series-table"
            role="table"
            aria-label={`Trend timeline table for ${primaryWard.ward.name}`}
            style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                <th scope="col" style={{ padding: '0.6rem' }}>Time Slice</th>
                <th scope="col" style={{ padding: '0.6rem' }}>Window Date Range</th>
                <th scope="col" style={{ padding: '0.6rem', textAlign: 'right' }}>
                  {primaryWard.ward.name} Count
                </th>
                {compareWard && (
                  <th scope="col" style={{ padding: '0.6rem', textAlign: 'right' }}>
                    {compareWard.ward.name} Count
                  </th>
                )}
                <th scope="col" style={{ padding: '0.6rem' }}>Privacy Status</th>
              </tr>
            </thead>
            <tbody>
              {primaryWard.series.map((slice, idx) => {
                const compSlice = compareWard?.series?.[idx];
                return (
                  <tr key={slice.label} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 600 }}>{slice.label}</td>
                    <td style={{ padding: '0.6rem', color: 'var(--text-secondary)' }}>
                      {slice.startDate} to {slice.endDate}
                    </td>
                    <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700 }}>
                      {slice.displayCount}
                    </td>
                    {compareWard && (
                      <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700 }}>
                        {compSlice ? compSlice.displayCount : 'N/A'}
                      </td>
                    )}
                    <td style={{ padding: '0.6rem' }}>
                      {slice.suppressed || compSlice?.suppressed ? (
                        <span style={{ color: '#eab308', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                          <EyeOff size={13} /> k &lt; {meta?.privacyThresholdK || 5} Suppressed
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>Published</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Visual Velocity Bars */
        <div style={{ display: 'grid', gridTemplateColumns: compareWard ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          {/* Primary Ward */}
          <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-main)' }}>
              {primaryWard.ward.name} ({primaryWard.ward.zone})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {primaryWard.series.map((s) => (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{s.label} ({s.startDate})</span>
                    <span>{s.displayCount}</span>
                  </div>
                  <div style={{ height: '10px', background: 'var(--border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: s.count ? `${Math.min(100, s.count * 4)}%` : '0%',
                        background: s.suppressed ? '#eab308' : 'var(--accent-main)',
                        borderRadius: '99px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compare Ward */}
          {compareWard && (
            <div style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#8b5cf6' }}>
                {compareWard.ward.name} ({compareWard.ward.zone})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {compareWard.series.map((s) => (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600 }}>{s.label} ({s.startDate})</span>
                      <span>{s.displayCount}</span>
                    </div>
                    <div style={{ height: '10px', background: 'var(--border-light)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: s.count ? `${Math.min(100, s.count * 4)}%` : '0%',
                          background: s.suppressed ? '#eab308' : '#8b5cf6',
                          borderRadius: '99px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
