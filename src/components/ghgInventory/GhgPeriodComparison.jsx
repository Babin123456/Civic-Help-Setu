import { ArrowDownRight, ArrowUpRight, Minus, Info } from 'lucide-react';
import { GhgEmptyState, GhgStatusBadge } from './GhgInventoryStates.jsx';

const formatT = (value) =>
  `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} tCO2e`;

const trend = (delta) => {
  if (delta > 0) return { Icon: ArrowUpRight, label: 'increase', tone: 'warning' };
  if (delta < 0) return { Icon: ArrowDownRight, label: 'decrease', tone: 'success' };
  return { Icon: Minus, label: 'no change', tone: 'neutral' };
};

export default function GhgPeriodComparison({ comparison }) {
  if (!comparison) {
    return (
      <GhgEmptyState
        title="No comparison period available"
        message="A comparison needs an earlier reporting period with approved activity data. Create or approve an earlier period to compare against the selected one."
      />
    );
  }

  const { current, previous, comparison: rows, totalChange, methodologyVersion } = comparison;
  const { Icon, label, tone } = trend(totalChange.deltaTCO2e);

  return (
    <section aria-labelledby="ghg-comparison-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h2 id="ghg-comparison-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
          Period comparison
        </h2>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Comparing {current.period.label} with {previous.period.label}. Both totals use the same
          deterministic methodology ({methodologyVersion}); a positive change means more emissions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Current · {current.period.label}
          </span>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.35rem' }}>{formatT(totalChange.currentTCO2e)}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Previous · {previous.period.label}
          </span>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.35rem' }}>{formatT(totalChange.previousTCO2e)}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Change <GhgStatusBadge label={label} tone={tone} icon={Icon} />
          </span>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.35rem' }}>{formatT(totalChange.deltaTCO2e)}</div>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
            {totalChange.percentChange == null
              ? 'No percentage: the previous total was zero.'
              : `${totalChange.percentChange > 0 ? '+' : ''}${totalChange.percentChange}% against the previous period.`}
          </p>
        </div>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Category change</h3>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          <Info size={12} aria-hidden="true" /> The same table is the accessible alternative to any
          chart. Rows are ordered by the largest absolute change.
        </p>
        {rows.length === 0 ? (
          <p style={{ margin: '0.9rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Neither period has approved activity categories yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <caption style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.78rem', paddingBottom: '0.4rem' }}>
                Approved category totals for {current.period.label} compared with {previous.period.label}.
              </caption>
              <thead>
                <tr>
                  {['Category', current.period.label, previous.period.label, 'Change', 'Percent change'].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      style={{ textAlign: heading === 'Category' ? 'left' : 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-main)', whiteSpace: 'nowrap' }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowTrend = trend(row.deltaTCO2e);
                  const RowIcon = rowTrend.Icon;
                  return (
                    <tr key={row.category}>
                      <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
                        {row.label}
                      </th>
                      <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                        {Number(row.currentTCO2e).toFixed(3)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                        {Number(row.previousTCO2e).toFixed(3)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        <RowIcon size={13} aria-hidden="true" /> {Number(row.deltaTCO2e).toFixed(3)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                        {row.percentChange == null ? 'n/a' : `${row.percentChange > 0 ? '+' : ''}${row.percentChange}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(current.warnings.length > 0 || previous.warnings.length > 0) && (
        <div role="status" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem', fontSize: '0.84rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Warnings attached to these totals</h3>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.55 }}>
            {[...current.warnings, ...previous.warnings].slice(0, 8).map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                <strong>{warning.code.replaceAll('_', ' ')}:</strong> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
