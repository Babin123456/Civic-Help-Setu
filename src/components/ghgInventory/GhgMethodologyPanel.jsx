import {
  Calculator,
  FileSpreadsheet,
  History,
  Info,
  ShieldCheck,
  Sigma,
} from 'lucide-react';
import {
  DATA_QUALITY,
  DATA_QUALITY_LABELS,
} from '../../services/ghgInventoryConstants.js';
import { severityForUncertainty } from '../../data/ghgInventoryContract.js';
import { safeHttpUrl } from '../../utils/safeContent.js';
import { GhgEmptyState, GhgStatusBadge } from './GhgInventoryStates.jsx';

const qualityTone = {
  [DATA_QUALITY.MEASURED]: 'success',
  [DATA_QUALITY.ESTIMATED]: 'warning',
  [DATA_QUALITY.EXCLUDED]: 'neutral',
};

const uncertaintyTone = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  unknown: 'neutral',
};

const number = (value, digits = 4) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits });

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

export default function GhgMethodologyPanel({
  line,
  metadata,
  factorCatalog,
  runs = [],
  selectedRunId = null,
  onSelectRun,
}) {
  const factor = line
    ? (factorCatalog?.factors || []).find(
        (item) => item.id === line.factorId || item.id === line.defaultFactorId
      )
    : null;
  const version = factor
    ? (factor.versions || []).find((item) => item.id === line?.factorVersionId)
    : null;
  const uncertaintySeverity = severityForUncertainty(line?.uncertaintyPercent);
  const sourceUrl = safeHttpUrl(factor?.sourceUrl);

  return (
    <section aria-labelledby="ghg-methodology-heading" style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h2 id="ghg-methodology-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
          Methodology &amp; formula inspection
        </h2>
        <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Every approved line keeps the factor version, uncertainty and arithmetic that produced it.
          Changing a factor never rewrites a historical calculation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <Sigma size={13} aria-hidden="true" /> Methodology
          </span>
          <div style={{ fontWeight: 800, marginTop: '0.35rem' }}>{metadata?.methodologyVersion || '—'}</div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Deterministic calculation. Rounding: {metadata?.roundingDecimals ?? 4} decimal places.
          </p>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <FileSpreadsheet size={13} aria-hidden="true" /> Export schema
          </span>
          <div style={{ fontWeight: 800, marginTop: '0.35rem' }}>{metadata?.exportSchemaVersion || '—'}</div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Exports include the source reference, factor version and content digest.
          </p>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <ShieldCheck size={13} aria-hidden="true" /> Data separation
          </span>
          <div style={{ fontWeight: 800, marginTop: '0.35rem' }}>Measured · Estimated · Excluded</div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Estimates are labelled and additive; excluded values are retained but never counted.
          </p>
        </div>
      </div>

      {line ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>
                <Calculator size={16} aria-hidden="true" /> {line.sourceName}
              </h3>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {line.department} · {line.categoryLabel}
              </p>
            </div>
            <GhgStatusBadge
              label={DATA_QUALITY_LABELS[line.dataQuality] || line.dataQuality}
              tone={qualityTone[line.dataQuality] || 'neutral'}
            />
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', margin: '0.9rem 0 0', fontSize: '0.82rem' }}>
            <div>
              <dt style={{ fontWeight: 700 }}>Activity as recorded</dt>
              <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {number(line.originalQuantity)} {line.originalUnit}
              </dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700 }}>Normalised to factor unit</dt>
              <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {number(line.normalizedQuantity)} {line.normalizedUnit}
              </dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700 }}>Factor version</dt>
              <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {line.factorVersionNumber != null ? `v${line.factorVersionNumber}` : 'Unavailable'}
                {line.factorValue != null ? ` · ${line.factorValue} tCO2e/${line.factorUnit}` : ''}
                {version?.effectiveFrom ? (
                  <span style={{ display: 'block', fontSize: '0.74rem' }}>
                    Effective {version.effectiveFrom}
                    {version.effectiveTo ? ` to ${version.effectiveTo}` : ' onwards'}
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700 }}>Uncertainty</dt>
              <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {line.uncertaintyPercent == null ? 'Not published' : `±${line.uncertaintyPercent}%`}{' '}
                <GhgStatusBadge
                  label={uncertaintySeverity}
                  tone={uncertaintyTone[uncertaintySeverity] || 'neutral'}
                />
              </dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700 }}>Emissions counted</dt>
              <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {line.dataQuality === DATA_QUALITY.EXCLUDED
                  ? '0 tCO2e (excluded from the total)'
                  : `${number(line.tCO2e)} tCO2e`}
              </dd>
            </div>
            <div>
              <dt style={{ fontWeight: 700 }}>Factor source</dt>
              <dd style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {factor?.sourceName || 'Not recorded'}
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ display: 'block', fontSize: '0.74rem' }}
                  >
                    Open published source
                  </a>
                ) : null}
              </dd>
            </div>
          </dl>

          <div
            role="status"
            style={{
              marginTop: '0.9rem',
              padding: '0.75rem',
              borderRadius: '0.6rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-main)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.82rem',
            }}
          >
            {line.formula || 'Formula unavailable because the factor version is missing.'}
          </div>

          {line.dataQuality === DATA_QUALITY.ESTIMATED && (
            <p role="note" style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <Info size={13} aria-hidden="true" /> This line is an accepted, labelled estimate. It is
              added to the estimated bucket and never presented as a measured reading. A later
              measured submission replaces it only through a reviewer decision.
            </p>
          )}
          {line.sourceDocument && (
            <p style={{ margin: '0.6rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Source document reference: {line.sourceDocument.name} ({line.sourceDocument.mimeType},{' '}
              {line.sourceDocument.sizeBytes != null
                ? `${number(line.sourceDocument.sizeBytes, 0)} bytes`
                : 'size not recorded'}
              ). Only metadata is stored; the department retains the original file.
            </p>
          )}
        </div>
      ) : (
        <GhgEmptyState
          title="Select an approved line"
          message="Choose “Inspect formula” on any source-linked activity row to see the exact quantity, factor version and arithmetic behind it."
        />
      )}

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Published factor versions</h3>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          Versions are immutable. A new version closes the previous effective window instead of
          editing history.
        </p>
        <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <caption style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.76rem', paddingBottom: '0.4rem' }}>
              Factor catalogue with every published version, its effective dates and uncertainty.
            </caption>
            <thead>
              <tr>
                {['Factor', 'Version', 'Value', 'Effective', 'Uncertainty', 'Change note'].map((heading) => (
                  <th key={heading} scope="col" style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border-main)', whiteSpace: 'nowrap' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(factorCatalog?.factors || []).flatMap((catalogFactor) =>
                (catalogFactor.versions || []).map((catalogVersion) => (
                  <tr key={catalogVersion.id}>
                    <th scope="row" style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
                      {catalogFactor.name}
                      <span style={{ display: 'block', fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {catalogFactor.sourceName}
                      </span>
                    </th>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                      v{catalogVersion.versionNumber}
                    </td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                      {catalogVersion.factorValue} / {catalogVersion.activityUnit}
                    </td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                      {catalogVersion.effectiveFrom}
                      {catalogVersion.effectiveTo ? ` → ${catalogVersion.effectiveTo}` : ' → open'}
                    </td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                      {catalogVersion.uncertaintyPercent == null ? '—' : `±${catalogVersion.uncertaintyPercent}%`}
                    </td>
                    <td style={{ padding: '0.45rem', borderBottom: '1px solid var(--border-light)', minWidth: '220px', fontSize: '0.75rem' }}>
                      {catalogVersion.changeNote}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '0.75rem', padding: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>
          <History size={16} aria-hidden="true" /> Calculation run history
        </h3>
        {runs.length === 0 ? (
          <p style={{ margin: '0.6rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            No calculation run has been recorded for this period. Run the calculation after
            approving a submission.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '0.6rem 0 0', padding: 0, display: 'grid', gap: '0.5rem' }}>
            {runs.map((run) => {
              const selected = selectedRunId === run.id;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRun?.(run.id)}
                    aria-pressed={selected}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.7rem 0.8rem',
                      borderRadius: '0.55rem',
                      border: selected ? '2px solid var(--accent-main)' : '1px solid var(--border-main)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <strong>{run.id} · {run.status}</strong>
                      <span>{number(run.totals?.tCO2e)} tCO2e</span>
                    </span>
                    <span style={{ display: 'block', marginTop: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                      {formatDate(run.executedAt)} · {run.methodologyVersion} · {run.activityRecordIds?.length || 0} record(s)
                      {run.outputHash ? ` · ${run.outputHash}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
