/**
 * Catalogue coverage: which service records are missing which metadata.
 *
 * This reads the records and counts what is absent. It never fills a gap with a default (a record
 * with no `jurisdiction` counts as missing even though the app shows "India" for it), never changes
 * a record, and only looks at fields of the service contract (src/data/serviceContract.js), so no
 * citizen data can appear in a report. It is a quality report for maintainers; it is not the import
 * pipeline (serviceImportService.js) and not the freshness indicator (dataFreshnessTrustService.js).
 *
 * All completeness rules are in COVERAGE_RULES below and documented in docs/CATALOGUE_COVERAGE.md.
 */
import { PUBLICATION_STATES, SERVICE_FALLBACKS } from '../data/serviceContract.js';
import { JURISDICTION_LEVELS } from '../data/jurisdictions.js';

export const SEVERITIES = ['high', 'medium', 'low'];
export const SEVERITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasItems = (value) => Array.isArray(value) && value.length > 0 && value.some((item) => item !== null && item !== undefined && item !== '');
const isRealDate = (value) => {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};
// `jurisdiction` is plain text ("India") or { level, states, districts, localBody } (see serviceContract.js).
const hasJurisdiction = (value) =>
  isText(value) || (value !== null && typeof value === 'object' && !Array.isArray(value) && JURISDICTION_LEVELS.includes(value.level));

/** A short, readable name for a jurisdiction value; null when the record has none. */
export function jurisdictionLabel(value) {
  if (isText(value)) return value.trim();
  if (!hasJurisdiction(value)) return null;
  const list = (items) => (Array.isArray(items) ? items.filter(isText).map((item) => item.trim()) : []);
  const states = list(value.states);
  const districts = list(value.districts);
  switch (value.level) {
    case 'national':
      return 'India (national)';
    case 'state':
      return states.length ? states.join(', ') : 'State (not named)';
    case 'district':
      return districts.length ? `${districts.join(', ')}${states.length ? `, ${states.join(', ')}` : ''}` : 'District (not named)';
    default:
      return isText(value.localBody) ? value.localBody.trim() : 'Local body (not named)';
  }
}

const isHttpsUrl = (value) => {
  try {
    return typeof value === 'string' && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * The single list of rules.
 *   level     'required' fields are part of every complete guide; 'optional' ones improve it.
 *   severity  how much the gap matters to a citizen: high, medium or low.
 *   present   returns true when the record has the field; it may also return a short reason string
 *             (instead of false) to explain a partial gap, e.g. "no https link".
 *
 * Required fields are the publication blockers by default (see isBlocker). Optional ones never are,
 * unless a maintainer lists them in `extraBlockers`.
 */
export const COVERAGE_RULES = [
  { field: 'shortDescription', label: 'Short description', level: 'required', severity: 'high', present: (r) => isText(r.shortDescription) },
  { field: 'department', label: 'Department', level: 'required', severity: 'high', present: (r) => isText(r.department) },
  {
    field: 'officialSources',
    label: 'Official source',
    level: 'required',
    severity: 'high',
    present: (r) => {
      if (!hasItems(r.officialSources)) return false;
      return r.officialSources.some((source) => source && isText(source.name) && isHttpsUrl(source.url)) || 'no source has a name and an https link';
    },
  },
  { field: 'steps', label: 'Application steps', level: 'required', severity: 'high', present: (r) => hasItems(r.steps) },
  { field: 'documents', label: 'Required documents', level: 'required', severity: 'medium', present: (r) => hasItems(r.documents) },
  { field: 'eligibility', label: 'Eligibility criteria', level: 'required', severity: 'medium', present: (r) => hasItems(r.eligibility) },
  { field: 'fees', label: 'Fees', level: 'required', severity: 'medium', present: (r) => isText(r.fees) },
  { field: 'processingTime', label: 'Processing time', level: 'required', severity: 'medium', present: (r) => isText(r.processingTime) },
  {
    field: 'lastVerified',
    label: 'Last-reviewed date',
    level: 'required',
    severity: 'medium',
    present: (r) => (r.lastVerified === undefined || r.lastVerified === null || r.lastVerified === '' ? false : isRealDate(r.lastVerified) || 'not a real YYYY-MM-DD date'),
  },
  { field: 'jurisdiction', label: 'Jurisdiction', level: 'optional', severity: 'medium', present: (r) => hasJurisdiction(r.jurisdiction) },
  { field: 'contacts', label: 'Contacts', level: 'optional', severity: 'low', present: (r) => hasItems(r.contacts) },
  { field: 'warnings', label: 'Warnings / things to know', level: 'optional', severity: 'low', present: (r) => hasItems(r.warnings) },
  { field: 'eligibilityRuleKey', label: 'Eligibility rule key', level: 'optional', severity: 'low', present: (r) => isText(r.eligibilityRuleKey) },
];

export const REQUIRED_RULES = COVERAGE_RULES.filter((rule) => rule.level === 'required');
export const OPTIONAL_RULES = COVERAGE_RULES.filter((rule) => rule.level === 'optional');

/** True when a missing field stops a record from counting as publishable. */
export const isBlocker = (rule, extraBlockers = []) => rule.level === 'required' || extraBlockers.includes(rule.field);

const publicationStateOf = (record) => (PUBLICATION_STATES.includes(record.publicationState) ? record.publicationState : SERVICE_FALLBACKS.publicationState);
const jurisdictionOf = (record) => jurisdictionLabel(record.jurisdiction) ?? SERVICE_FALLBACKS.jurisdiction;

/** Gaps of one record: [{ field, label, level, severity, blocker, detail }]. Nothing is filled in. */
export function findGaps(record, extraBlockers = []) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
  const gaps = [];
  for (const rule of COVERAGE_RULES) {
    const result = rule.present(record);
    if (result === true) continue;
    gaps.push({
      field: rule.field,
      label: rule.label,
      level: rule.level,
      severity: rule.severity,
      blocker: isBlocker(rule, extraBlockers),
      detail: typeof result === 'string' ? result : '',
    });
  }
  return gaps;
}

const percent = (part, whole) => (whole === 0 ? 100 : Math.round((part / whole) * 1000) / 10);

export const DEFAULT_FILTERS = Object.freeze({ category: 'All', jurisdiction: 'All', publicationState: 'All', field: 'All', severity: 'All' });

/** Distinct values the filter menus can offer, taken from the records themselves. */
export function filterOptions(records) {
  const list = (Array.isArray(records) ? records : []).filter((r) => r && typeof r === 'object' && !Array.isArray(r));
  const unique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    categories: unique(list.map((r) => r.category).filter(isText)),
    jurisdictions: unique(list.map(jurisdictionOf)),
    publicationStates: PUBLICATION_STATES,
    fields: COVERAGE_RULES.map((rule) => ({ field: rule.field, label: rule.label })),
    severities: SEVERITIES,
  };
}

/**
 * The report.
 *
 * `category`, `jurisdiction` and `publicationState` choose which records are measured: the totals and
 * the field table are computed on exactly that group. `field` and `severity` then narrow the list of
 * records shown to those that have such a gap. So the numbers always reconcile with the list:
 *   - no gap filter:      rows.length === totals.recordsWithGaps
 *   - field = X:          rows.length === the "missing" count of X in byField
 *
 * @param {object[]} records service records (anything that is not a plain object is ignored)
 * @param {object} [filters] see DEFAULT_FILTERS ('All' means no filter)
 * @param {{ extraBlockers?: string[] }} [options] optional fields to treat as publication blockers
 */
export function analyzeCoverage(records, filters = {}, options = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const extraBlockers = Array.isArray(options.extraBlockers) ? options.extraBlockers : [];
  const all = (Array.isArray(records) ? records : []).filter((r) => r && typeof r === 'object' && !Array.isArray(r));

  const population = all.filter(
    (r) =>
      (f.category === 'All' || r.category === f.category) &&
      (f.jurisdiction === 'All' || jurisdictionOf(r) === f.jurisdiction) &&
      (f.publicationState === 'All' || publicationStateOf(r) === f.publicationState),
  );

  const analysed = population.map((record) => {
    const gaps = findGaps(record, extraBlockers);
    const missingRequired = gaps.filter((g) => g.level === 'required').length;
    const missingOptional = gaps.filter((g) => g.level === 'optional').length;
    return {
      id: typeof record.id === 'string' ? record.id : '',
      name: isText(record.name) ? record.name : '(unnamed record)',
      category: isText(record.category) ? record.category : '',
      jurisdiction: jurisdictionOf(record),
      jurisdictionIsDefault: !hasJurisdiction(record.jurisdiction),
      publicationState: publicationStateOf(record),
      publicationStateIsDefault: !PUBLICATION_STATES.includes(record.publicationState),
      gaps,
      blockers: gaps.filter((g) => g.blocker),
      requiredPercent: percent(REQUIRED_RULES.length - missingRequired, REQUIRED_RULES.length),
      optionalPercent: percent(OPTIONAL_RULES.length - missingOptional, OPTIONAL_RULES.length),
    };
  });

  const byField = COVERAGE_RULES.map((rule) => {
    const missing = analysed.filter((row) => row.gaps.some((g) => g.field === rule.field)).length;
    return {
      field: rule.field,
      label: rule.label,
      level: rule.level,
      severity: rule.severity,
      blocker: isBlocker(rule, extraBlockers),
      missing,
      present: analysed.length - missing,
      total: analysed.length,
      percentComplete: percent(analysed.length - missing, analysed.length),
    };
  });

  const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
  const requiredRows = byField.filter((row) => row.level === 'required');
  const optionalRows = byField.filter((row) => row.level === 'optional');
  const requiredPossible = requiredRows.length * analysed.length;
  const optionalPossible = optionalRows.length * analysed.length;

  const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, byField.filter((row) => row.severity === s).reduce((n, row) => n + row.missing, 0)]));

  const gapMatches = (gap) => (f.field === 'All' || gap.field === f.field) && (f.severity === 'All' || gap.severity === f.severity);
  const filteringGaps = f.field !== 'All' || f.severity !== 'All';
  const rows = analysed
    .filter((row) => (filteringGaps ? row.gaps.some(gapMatches) : row.gaps.length > 0))
    .sort((a, b) => b.blockers.length - a.blockers.length || b.gaps.length - a.gaps.length || a.name.localeCompare(b.name));

  return {
    filters: f,
    totals: {
      records: analysed.length,
      recordsWithGaps: analysed.filter((row) => row.gaps.length > 0).length,
      recordsWithBlockers: analysed.filter((row) => row.blockers.length > 0).length,
      complete: analysed.filter((row) => row.gaps.length === 0).length,
      requiredPresent: sum(requiredRows, 'present'),
      requiredPossible,
      requiredPercent: percent(sum(requiredRows, 'present'), requiredPossible),
      optionalPresent: sum(optionalRows, 'present'),
      optionalPossible,
      optionalPercent: percent(sum(optionalRows, 'present'), optionalPossible),
    },
    byField,
    bySeverity,
    rows,
  };
}

// ---- export ---------------------------------------------------------------------------------

/** A CSV cell: quoted when needed, and neutralised when a spreadsheet would read it as a formula. */
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A maintenance summary: totals, one line per field, one line per record with gaps. No citizen data. */
export function coverageToCsv(report) {
  const line = (...cells) => cells.map(csvCell).join(',');
  const t = report.totals;
  const f = report.filters;
  const out = [
    line('Catalogue coverage summary'),
    line('Category', f.category, 'Jurisdiction', f.jurisdiction, 'Publication state', f.publicationState),
    line('Records measured', t.records),
    line('Complete records', t.complete),
    line('Records with gaps', t.recordsWithGaps),
    line('Records with publication blockers', t.recordsWithBlockers),
    line('Required fields complete (%)', t.requiredPercent),
    line('Optional fields complete (%)', t.optionalPercent),
    '',
    line('Field', 'Level', 'Severity', 'Publication blocker', 'Missing', 'Present', 'Records measured', 'Complete (%)'),
    ...report.byField.map((r) => line(r.label, r.level, r.severity, r.blocker ? 'yes' : 'no', r.missing, r.present, r.total, r.percentComplete)),
    '',
    line('Record id', 'Name', 'Category', 'Jurisdiction', 'Publication state', 'Missing fields', 'Blocking fields'),
    ...report.rows.map((row) =>
      line(row.id, row.name, row.category, row.jurisdiction, row.publicationState, row.gaps.map((g) => g.label).join('; '), row.blockers.map((g) => g.label).join('; ')),
    ),
  ];
  return `${out.join('\n')}\n`;
}
