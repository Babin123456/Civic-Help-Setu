import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock3,
  ClipboardList,
  Gauge,
  Info,
} from 'lucide-react';
import {
  DATA_QUALITY,
  DATA_QUALITY_LABELS,
} from '../../services/ghgInventoryConstants.js';
import { GhgStatusBadge, GhgSummaryTable } from './GhgInventoryStates.jsx';

const qualityTone = {
  [DATA_QUALITY.MEASURED]: 'success',
  [DATA_QUALITY.ESTIMATED]: 'warning',
  [DATA_QUALITY.EXCLUDED]: 'neutral',
};

const qualityIcon = {
  [DATA_QUALITY.MEASURED]: CheckCircle2,
  [DATA_QUALITY.ESTIMATED]: AlertTriangle,
  [DATA_QUALITY.EXCLUDED]: Ban,
};

const formatT = (value) =>
  `${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} tCO2e`;

export default function GhgInventoryDashboard({ summary, onInspectFormula }) {
  if (!summary) return null;
  const { totals, byCategory, lines, warnings, missingSources, period } = summary;
  const measuredPercent =
    totals.tCO2e > 0 ? Math.round((totals.measuredTCO2e / totals.tCO2e) * 1000) / 10 : 0;

  const cards = [
    {
      label: 'Approved emissions',
      value: formatT(totals.tCO2e),
      detail: `${period.label} · ${summary.approvedSubmissionCount} approved submission(s)`,
      icon: Gauge,
    },
    {
      label: 'Measured data',
      value: formatT(totals.measuredTCO2e),
      detail: `${measuredPercent}% of the approved total`,
      icon: CheckCircle2,
    },
    {
      label: 'Labelled estimates',
      value: formatT(totals.estimatedTCO2e),
      detail: totals.estimatedTCO2e > 0 ? 'Reported separately from measured data' : 'No estimates accepted for this period',
      icon: AlertTriangle,
    },
    {
      label: 'Excluded values',
      value: formatT(totals.excludedTCO2e),
      detail: 'Retained with the original value; outside the inventory boundary',
      icon: Ban,
    },
    {
      label: 'Pending review',
      value: String(summary.pendingSubmissionCount || 0),
      detail: `${summary.draftSubmissionCount || 0} draft or returned submission(s)`,
      icon: ClipboardList,
    },
  ];

  return (
    <section aria-labelledby="ghg-overview-heading" style={{ display: 'grid', gap: '1.25rem' }}>
      <h2 id="ghg-overview-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
        Inventory overview
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-main)',
                borderRadius: '0.75rem',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <Icon size={14} aria-hidden="true" /> {card.label}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.35rem' }}>{card.value}</div>
              <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Emissions by category</h3>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Totals use approved activity records and the factor version effective on each activity date.
          </p>
          <GhgSummaryTable
            rows={byCategory}
            caption={`Approved category totals for ${period.label}. The same figures are available in the source table below.`}
          />
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Data quality &amp; completeness</h3>
          <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem', fontSize: '0.84rem', lineHeight: 1.6 }}>
            <li>
              {summary.approvedSubmissionCount} approved submission(s); {summary.pendingSubmissionCount} awaiting review.
            </li>
            <li>
              {missingSources.length === 0
                ? 'Every active source has an approved value for this period.'
                : `${missingSources.length} active source(s) have no approved activity value. Missing is not the same as zero.`}
            </li>
            <li>
              {warnings.length === 0
                ? 'No calculation warnings were raised.'
                : `${warnings.length} warning(s) require a reader's attention.`}
            </li>
            <li>
              Last approved data:{' '}
              {summary.lastApprovedAt ? new Date(summary.lastApprovedAt).toLocaleString() : 'none yet'}.
            </li>
          </ul>
          {missingSources.length > 0 && (
            <details style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Sources with no approved value</summary>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                {missingSources.map((source) => (
                  <li key={source.id}>
                    {source.name} — {source.department}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {warnings.length > 0 && (
        <div
          role="status"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}
        >
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem' }}>
            <AlertTriangle size={17} aria-hidden="true" /> Calculation warnings
          </h3>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.84rem', lineHeight: 1.55 }}>
            {warnings.slice(0, 8).map((warning, index) => (
              <li key={`${warning.code}-${warning.sourceId || index}`}>
                <strong>{warning.code.replaceAll('_', ' ')}:</strong> {warning.message}
              </li>
            ))}
          </ul>
          {warnings.length > 8 && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Showing 8 of {warnings.length} warnings. The full list is included in the export.
            </p>
          )}
        </div>
      )}

      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Source-linked activity</h3>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Original activity values are shown next to the factor version and formula used.
            </p>
          </div>
          <GhgStatusBadge
            label={`Methodology ${summary.methodologyVersion}`}
            tone="info"
            icon={Info}
          />
        </div>

        {lines.length === 0 ? (
          <p style={{ margin: '1rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            There are no approved activity lines for this period yet. Approve a submission and run
            the calculation to populate this table.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <caption style={{ textAlign: 'left', paddingBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                Approved source-linked activity for {period.label}. This table is the accessible alternative to any chart.
              </caption>
              <thead>
                <tr>
                  {['Source', 'Category', 'Activity', 'Factor version', 'Emissions', 'Data quality', 'Formula'].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)', whiteSpace: 'nowrap' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const Icon = qualityIcon[line.dataQuality] || Activity;
                  return (
                    <tr key={line.recordId}>
                      <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
                        {line.sourceName}
                        <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          {line.department}
                        </span>
                      </th>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{line.categoryLabel}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                        {line.originalQuantity.toLocaleString('en-IN')} {line.originalUnit}
                        {line.normalizedUnit !== line.originalUnit && (
                          <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                            = {line.normalizedQuantity.toLocaleString('en-IN')} {line.normalizedUnit}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                        v{line.factorVersionNumber} · {line.factorValue} / {line.normalizedUnit}
                        {line.uncertaintyPercent != null && (
                          <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                            ±{line.uncertaintyPercent}% uncertainty
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap', fontWeight: 700 }}>
                        {line.tCO2e.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                        <GhgStatusBadge
                          label={DATA_QUALITY_LABELS[line.dataQuality] || line.dataQuality}
                          tone={qualityTone[line.dataQuality] || 'neutral'}
                          icon={Icon}
                        />
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)', minWidth: '220px' }}>
                        <button
                          type="button"
                          onClick={() => onInspectFormula?.(line)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            color: 'var(--accent-main)',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            textAlign: 'left',
                          }}
                        >
                          Inspect formula
                        </button>
                        <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                          <Clock3 size={11} aria-hidden="true" /> Factor version retained for audit
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
