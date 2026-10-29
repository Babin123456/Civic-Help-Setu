import { useId, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { getAllServices } from '../../services/serviceCatalog';
import {
  COVERAGE_RULES,
  DEFAULT_FILTERS,
  SEVERITY_LABELS,
  analyzeCoverage,
  coverageToCsv,
  filterOptions,
} from '../../services/catalogueCoverage';

const card = {
  border: '1px solid var(--border-light, rgba(255,255,255,0.12))',
  borderRadius: '0.75rem',
  padding: '1rem',
  background: 'var(--glass-bg, rgba(255,255,255,0.04))',
};
const SEVERITY_COLOR = { high: '#fca5a5', medium: '#fcd34d', low: '#93c5fd' };

const Field = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', fontWeight: 600 }}>
    {label}
    {children}
  </label>
);

const Select = ({ value, onChange, options, allLabel = 'All' }) => (
  <select
    className="input-field"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
  >
    <option value="All">{allLabel}</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const Stat = ({ label, value, note }) => (
  <div style={{ ...card, minWidth: '9rem', flex: '1 1 9rem' }}>
    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
    <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{value}</div>
    {note && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{note}</div>}
  </div>
);

/**
 * Catalogue coverage dashboard (admin): which service records are missing which metadata.
 * The rules and the numbers come from services/catalogueCoverage.js (documented in
 * docs/CATALOGUE_COVERAGE.md); this component only shows them.
 *
 * @param {object[]} [services] records to measure; defaults to the whole catalogue as the public pages read it
 * @param {(id: string) => void} [onEditService] opens the record in the admin editor
 * @param {object} [initialFilters]
 * @param {string[]} [initialBlockers] optional fields to treat as publication blockers
 */
const CatalogueCoveragePanel = ({ services, onEditService, initialFilters, initialBlockers = [] }) => {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...initialFilters });
  const [extraBlockers, setExtraBlockers] = useState(initialBlockers);
  const [version, setVersion] = useState(0);
  const headingId = useId();

  // Read the catalogue again whenever the admin presses Refresh (or the records passed in change).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const records = useMemo(() => services ?? getAllServices(), [services, version]);
  const options = useMemo(() => filterOptions(records), [records]);
  const report = useMemo(() => analyzeCoverage(records, filters, { extraBlockers }), [records, filters, extraBlockers]);
  const set = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));
  const toOptions = (values) => values.map((value) => ({ value, label: value }));
  const optionalRules = COVERAGE_RULES.filter((rule) => rule.level === 'optional');

  const download = () => {
    const blob = new Blob([coverageToCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catalogue-coverage-summary.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const { totals } = report;

  return (
    <section aria-labelledby={headingId} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 id={headingId} style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            Catalogue Coverage
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '46rem' }}>
            Which service records are missing which information. Gaps are counted as they are: nothing is filled in. Required fields
            are publication blockers; optional ones are not unless you tick them below.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={download}>
            <Download size={14} aria-hidden="true" /> Download summary (CSV)
          </button>
        </div>
      </header>

      <form
        aria-label="Coverage filters"
        onSubmit={(event) => event.preventDefault()}
        style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}
      >
        <Field label="Category">
          <Select value={filters.category} onChange={set('category')} options={toOptions(options.categories)} />
        </Field>
        <Field label="Jurisdiction">
          <Select value={filters.jurisdiction} onChange={set('jurisdiction')} options={toOptions(options.jurisdictions)} />
        </Field>
        <Field label="Publication state">
          <Select value={filters.publicationState} onChange={set('publicationState')} options={toOptions(options.publicationStates)} />
        </Field>
        <Field label="Missing field">
          <Select value={filters.field} onChange={set('field')} options={options.fields.map((f) => ({ value: f.field, label: f.label }))} />
        </Field>
        <Field label="Severity">
          <Select value={filters.severity} onChange={set('severity')} options={options.severities.map((s) => ({ value: s, label: SEVERITY_LABELS[s] }))} />
        </Field>
        <button type="button" className="btn btn-secondary" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
          Clear filters
        </button>
      </form>

      <fieldset style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <legend style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0 0.4rem' }}>Treat these optional fields as publication blockers</legend>
        {optionalRules.map((rule) => (
          <label key={rule.field} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={extraBlockers.includes(rule.field)}
              onChange={(event) =>
                setExtraBlockers((current) => (event.target.checked ? [...current, rule.field] : current.filter((field) => field !== rule.field)))
              }
            />
            {rule.label}
          </label>
        ))}
      </fieldset>

      <div role="group" aria-label="Summary" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Stat label="Records measured" value={totals.records} note={`${totals.complete} complete`} />
        <Stat label="Records with gaps" value={totals.recordsWithGaps} />
        <Stat label="With publication blockers" value={totals.recordsWithBlockers} />
        <Stat label="Required fields complete" value={`${totals.requiredPercent}%`} note={`${totals.requiredPresent} of ${totals.requiredPossible}`} />
        <Stat label="Optional fields complete" value={`${totals.optionalPercent}%`} note={`${totals.optionalPresent} of ${totals.optionalPossible}`} />
      </div>

      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Completeness by field</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <caption style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)', paddingBottom: '0.4rem' }}>
              For the records matching the category, jurisdiction and publication state above.
            </caption>
            <thead>
              <tr>
                {['Field', 'Level', 'Severity', 'Blocks publication', 'Missing', 'Complete'].map((heading) => (
                  <th key={heading} scope="col" style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.15))' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.byField.map((row) => (
                <tr key={row.field}>
                  <th scope="row" style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontWeight: 600 }}>
                    {row.label}
                  </th>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{row.level}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{SEVERITY_LABELS[row.severity]}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{row.blocker ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>
                    {row.missing} of {row.total}
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>{row.percentComplete}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Records to fix{' '}
          <span role="status" style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ({report.rows.length} shown)
          </span>
        </h3>
        {report.rows.length === 0 ? (
          <p style={{ ...card, fontSize: '0.9rem' }}>
            {totals.records === 0
              ? 'No records match these filters.'
              : 'No record has a gap that matches these filters. Nothing to fix here.'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {report.rows.map((row) => {
              const isPublic = row.publicationState === 'published' && Boolean(row.id);
              return (
                <li key={row.id || row.name} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{row.name}</strong>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {row.category || 'No category'} · {row.jurisdiction}
                        {row.jurisdictionIsDefault ? ' (default)' : ''} · <span>{row.publicationState === 'published' ? 'Public' : row.publicationState === 'draft' ? 'Draft (not public)' : 'Archived (not public)'}</span>
                        {row.publicationStateIsDefault ? ' (default state)' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {onEditService && row.id && (
                        <button type="button" className="btn btn-primary" onClick={() => onEditService(row.id)} aria-label={`Edit ${row.name} in the admin editor`}>
                          Edit record
                        </button>
                      )}
                      {isPublic && (
                        <a className="btn btn-secondary" href={`/services/${encodeURIComponent(row.id)}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${row.name} on the public site (opens in a new tab)`}>
                          View public page
                        </a>
                      )}
                    </div>
                  </div>
                  <ul aria-label={`Missing information for ${row.name}`} style={{ listStyle: 'none', padding: 0, margin: '0.6rem 0 0', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {row.gaps.map((gap) => (
                      <li
                        key={gap.field}
                        style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem', borderRadius: '999px', border: `1px solid ${SEVERITY_COLOR[gap.severity]}`, color: SEVERITY_COLOR[gap.severity] }}
                      >
                        {gap.label}
                        {gap.detail ? `: ${gap.detail}` : ''} · {SEVERITY_LABELS[gap.severity]}
                        {gap.blocker ? ' · blocks publication' : ' · optional'}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default CatalogueCoveragePanel;
