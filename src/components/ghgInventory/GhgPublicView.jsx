import { Eye, Globe2, Info, ShieldCheck } from 'lucide-react';
import { GhgEmptyState, GhgStatusBadge } from './GhgInventoryStates.jsx';

const formatT = (value) =>
  `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} tCO2e`;

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

export default function GhgPublicView({
  publicData,
  periods = [],
  selectedPeriodLabel,
  onSelectPeriod,
  jurisdictionName = 'Ward 42 — Indiranagar',
}) {
  const summary = publicData?.summary || null;
  const available = Boolean(publicData?.available && summary);

  return (
    <section aria-labelledby="ghg-public-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 id="ghg-public-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
            <Globe2 size={18} aria-hidden="true" /> Public transparency view
          </h2>
          <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '720px' }}>
            Approved municipal totals for {jurisdictionName}. This projection shows aggregate values
            only: no submission identifiers, department notes, reviewer names, contact details or
            source documents are published.
          </p>
        </div>
        {periods.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="ghg-public-period" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
              Approved period
            </label>
            <select
              id="ghg-public-period"
              value={selectedPeriodLabel || ''}
              onChange={(event) => onSelectPeriod?.(event.target.value)}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 6,
                border: '1px solid var(--border-main)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              {periods.map((period) => (
                <option key={period.label} value={period.label}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div
        role="note"
        style={{
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
          padding: '0.8rem 1rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.6rem',
          fontSize: '0.84rem',
        }}
      >
        <ShieldCheck size={17} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>What is published.</strong> Only approved aggregate emissions, their category
          split, the measured/estimated/excluded breakdown and calculation warnings. Estimated values
          remain labelled and are never presented as measured readings.
        </div>
      </div>

      {!available ? (
        <GhgEmptyState
          title="No approved inventory is published yet"
          message={
            publicData?.reason ||
            'Public totals appear after a reviewer approves the period. Open periods and unapproved submissions are not shown here.'
          }
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            {[
              {
                label: 'Approved total',
                value: formatT(summary.totals.tCO2e),
                detail: `${summary.periodLabel} · published ${formatDate(summary.publishedAt)}`,
              },
              {
                label: 'Measured',
                value: formatT(summary.totals.measuredTCO2e),
                detail: 'Meter readings and invoices approved by a reviewer',
              },
              {
                label: 'Estimated',
                value: formatT(summary.totals.estimatedTCO2e),
                detail: 'Labelled estimates accepted by a human reviewer',
              },
              {
                label: 'Excluded',
                value: formatT(summary.totals.excludedTCO2e),
                detail: 'Retained but outside the published inventory boundary',
              },
            ].map((card) => (
              <div key={card.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {card.label}
                </span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '0.35rem' }}>{card.value}</div>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.77rem' }}>{card.detail}</p>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Approved emissions by category</h3>
              <GhgStatusBadge
                label={`Methodology ${summary.methodologyVersion}`}
                tone="info"
                icon={Info}
              />
            </div>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              The table is the accessible alternative to a chart. Shares are calculated from the
              approved period total.
            </p>
            {summary.byCategory.length === 0 ? (
              <p style={{ margin: '0.9rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                This approved period has no category totals to publish.
              </p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <caption style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.78rem', paddingBottom: '0.4rem' }}>
                    Public category totals for {summary.periodLabel}. Individual records and
                    department notes are not published.
                  </caption>
                  <thead>
                    <tr>
                      {['Category', 'Total tCO2e', 'Measured', 'Estimated', 'Share'].map((heading) => (
                        <th key={heading} scope="col" style={{ textAlign: heading === 'Category' ? 'left' : 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byCategory.map((row) => (
                      <tr key={row.categoryLabel}>
                        <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
                          {row.categoryLabel}
                        </th>
                        <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{Number(row.tCO2e).toFixed(3)}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{Number(row.measuredTCO2e).toFixed(3)}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{Number(row.estimatedTCO2e).toFixed(3)}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{row.sharePercent == null ? '—' : `${row.sharePercent}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem', fontSize: '0.84rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>
                <Eye size={15} aria-hidden="true" /> How to read these totals
              </h3>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.6 }}>
                <li>Measured values come from meter readings or invoices accepted by a reviewer.</li>
                <li>Estimated values are labelled and kept in a separate bucket.</li>
                <li>Excluded values are retained for transparency but do not enter the total.</li>
                <li>Missing data is shown as missing, never as an implicit zero.</li>
              </ul>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem', fontSize: '0.84rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Calculation warnings</h3>
              {summary.warnings.length === 0 ? (
                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
                  No calculation warnings apply to the approved aggregates.
                </p>
              ) : (
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', lineHeight: 1.55 }}>
                  {summary.warnings.slice(0, 6).map((warning, index) => (
                    <li key={`${warning.code}-${index}`}>{warning.message}</li>
                  ))}
                </ul>
              )}
              <p style={{ margin: '0.7rem 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                {summary.disclosure}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
