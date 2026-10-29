import { describe, it, expect } from 'vitest';
import { MOCK_SERVICES } from '../data/services.js';
import { FORBIDDEN_FIELDS } from '../data/serviceContract.js';
import {
  COVERAGE_RULES,
  DEFAULT_FILTERS,
  OPTIONAL_RULES,
  REQUIRED_RULES,
  analyzeCoverage,
  coverageToCsv,
  csvCell,
  filterOptions,
  findGaps,
  isBlocker,
  jurisdictionLabel,
} from './catalogueCoverage.js';

const complete = (overrides = {}) => ({
  id: 'income-certificate',
  name: 'Income Certificate',
  category: 'Certificates',
  shortDescription: 'Proof of annual income.',
  department: 'Revenue',
  steps: [{ title: 'Apply', description: 'Fill the form.' }],
  documents: ['Aadhaar'],
  eligibility: ['Resident of the state'],
  fees: 'Free',
  processingTime: '7 days',
  lastVerified: '2026-09-01',
  officialSources: [{ name: 'State portal', url: 'https://example.gov.in/income' }],
  jurisdiction: 'Maharashtra',
  contacts: [{ label: 'Helpline', phone: '1800-000-000' }],
  warnings: ['Carry originals.'],
  eligibilityRuleKey: 'income',
  ...overrides,
});

const fieldsOf = (record, extra) => findGaps(record, extra).map((g) => g.field);

describe('the rules', () => {
  it('are one list with unique fields, a level and a severity each', () => {
    expect(new Set(COVERAGE_RULES.map((r) => r.field)).size).toBe(COVERAGE_RULES.length);
    for (const rule of COVERAGE_RULES) {
      expect(['required', 'optional']).toContain(rule.level);
      expect(['high', 'medium', 'low']).toContain(rule.severity);
      expect(rule.label.length).toBeGreaterThan(2);
      expect(typeof rule.present).toBe('function');
    }
    expect(REQUIRED_RULES.length + OPTIONAL_RULES.length).toBe(COVERAGE_RULES.length);
  });

  it('cover the gaps the issue names: department, jurisdiction, official source, documents, last-reviewed date', () => {
    const fields = COVERAGE_RULES.map((r) => r.field);
    for (const name of ['department', 'jurisdiction', 'officialSources', 'documents', 'lastVerified']) expect(fields).toContain(name);
  });

  it('only look at fields of the service contract, never at personal data', () => {
    for (const rule of COVERAGE_RULES) expect(FORBIDDEN_FIELDS).not.toContain(rule.field);
  });

  it('make required fields blockers and optional ones not, unless configured', () => {
    const required = COVERAGE_RULES.find((r) => r.level === 'required');
    const optional = COVERAGE_RULES.find((r) => r.field === 'jurisdiction');
    expect(isBlocker(required)).toBe(true);
    expect(isBlocker(optional)).toBe(false);
    expect(isBlocker(optional, ['jurisdiction'])).toBe(true);
    expect(isBlocker(optional, ['contacts'])).toBe(false);
  });
});

describe('jurisdiction in both forms', () => {
  it('counts text and a structured object as present, and a missing, blank or unknown-level one as missing', () => {
    for (const value of ['Kerala', { level: 'national', states: [], districts: [], localBody: '' }, { level: 'state', states: ['Kerala'] }]) {
      expect(fieldsOf(complete({ jurisdiction: value })), JSON.stringify(value)).toEqual([]);
    }
    for (const value of ['', '  ', null, 5, [], {}, { level: 'galaxy' }]) {
      expect(fieldsOf(complete({ jurisdiction: value })), JSON.stringify(value)).toEqual(['jurisdiction']);
    }
  });

  it('names a jurisdiction readably', () => {
    expect(jurisdictionLabel(' Kerala ')).toBe('Kerala');
    expect(jurisdictionLabel({ level: 'national' })).toBe('India (national)');
    expect(jurisdictionLabel({ level: 'state', states: ['Kerala', 'Goa'] })).toBe('Kerala, Goa');
    expect(jurisdictionLabel({ level: 'state' })).toBe('State (not named)');
    expect(jurisdictionLabel({ level: 'district', states: ['Kerala'], districts: ['Kochi'] })).toBe('Kochi, Kerala');
    expect(jurisdictionLabel({ level: 'district' })).toBe('District (not named)');
    expect(jurisdictionLabel({ level: 'local', localBody: 'Kochi Corporation' })).toBe('Kochi Corporation');
    expect(jurisdictionLabel({ level: 'local' })).toBe('Local body (not named)');
    expect(jurisdictionLabel(undefined)).toBeNull();
    expect(jurisdictionLabel({ level: 'galaxy' })).toBeNull();
  });

  it('filters by the readable name, and the real catalogue (structured values) is measured', () => {
    const records = [complete({ id: 'a', name: 'A', jurisdiction: { level: 'national', states: [], districts: [], localBody: '' } }), complete({ id: 'b', name: 'B', jurisdiction: 'Kerala' })];
    expect(analyzeCoverage(records, { jurisdiction: 'India (national)' }).totals.records).toBe(1);
    expect(filterOptions(records).jurisdictions).toEqual(['India (national)', 'Kerala']);
    const real = analyzeCoverage(MOCK_SERVICES);
    expect(real.byField.find((f) => f.field === 'jurisdiction').present).toBeGreaterThan(0);
  });
});

describe('findGaps', () => {
  it('finds nothing in a complete record', () => {
    expect(findGaps(complete())).toEqual([]);
  });

  it('reports each missing required field with its severity', () => {
    const gaps = findGaps(complete({ department: '', documents: [], lastVerified: undefined }));
    expect(gaps.map((g) => [g.field, g.severity, g.level, g.blocker])).toEqual([
      ['department', 'high', 'required', true],
      ['documents', 'medium', 'required', true],
      ['lastVerified', 'medium', 'required', true],
    ]);
  });

  it('treats blank text, empty lists, null and the wrong type as missing', () => {
    expect(fieldsOf(complete({ shortDescription: '   ' }))).toEqual(['shortDescription']);
    expect(fieldsOf(complete({ steps: [] }))).toEqual(['steps']);
    expect(fieldsOf(complete({ steps: null }))).toEqual(['steps']);
    expect(fieldsOf(complete({ documents: 'Aadhaar' }))).toEqual(['documents']);
    expect(fieldsOf(complete({ fees: 5 }))).toEqual(['fees']);
    expect(fieldsOf(complete({ eligibility: [null, ''] }))).toEqual(['eligibility']);
  });

  it('explains a partial gap: a source without an https link, a date that is not real', () => {
    const [source] = findGaps(complete({ officialSources: [{ name: 'Portal', url: 'http://example.gov.in' }] }));
    expect(source).toMatchObject({ field: 'officialSources', detail: 'no source has a name and an https link' });
    const [date] = findGaps(complete({ lastVerified: '2026-02-30' }));
    expect(date).toMatchObject({ field: 'lastVerified', detail: 'not a real YYYY-MM-DD date' });
    expect(findGaps(complete({ officialSources: [{ name: 'Bad', url: 'nope' }, { name: 'Good', url: 'https://example.gov.in' }] }))).toEqual([]);
  });

  it('does not invent a replacement: a missing jurisdiction is a gap even though the app shows India', () => {
    const gaps = findGaps(complete({ jurisdiction: undefined }));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ field: 'jurisdiction', level: 'optional', blocker: false });
  });

  it('does not change the record', () => {
    const record = complete();
    delete record.jurisdiction;
    delete record.contacts;
    const before = JSON.stringify(record);
    findGaps(record);
    analyzeCoverage([record]);
    expect(JSON.stringify(record)).toBe(before);
    expect('jurisdiction' in record).toBe(false);
  });

  it('makes a configured optional field a blocker', () => {
    const gaps = findGaps(complete({ contacts: [] }), ['contacts']);
    expect(gaps[0]).toMatchObject({ field: 'contacts', blocker: true });
  });

  it('copes with records that are not objects', () => {
    for (const value of [null, undefined, 5, 'text', [], true]) expect(findGaps(value)).toEqual([]);
  });

  it('reports a record that is an empty object as missing every field', () => {
    expect(findGaps({})).toHaveLength(COVERAGE_RULES.length);
  });
});

describe('analyzeCoverage: empty and partial catalogues', () => {
  it('handles an empty catalogue without dividing by zero', () => {
    for (const input of [[], null, undefined, 'x', {}]) {
      const report = analyzeCoverage(input);
      expect(report.totals).toMatchObject({ records: 0, recordsWithGaps: 0, recordsWithBlockers: 0, complete: 0, requiredPercent: 100, optionalPercent: 100 });
      expect(report.rows).toEqual([]);
      expect(report.byField).toHaveLength(COVERAGE_RULES.length);
      for (const row of report.byField) expect(row).toMatchObject({ missing: 0, present: 0, total: 0, percentComplete: 100 });
    }
  });

  it('counts a fully complete catalogue as complete', () => {
    const report = analyzeCoverage([complete(), complete({ id: 'b', name: 'B' })]);
    expect(report.totals).toMatchObject({ records: 2, complete: 2, recordsWithGaps: 0, requiredPercent: 100, optionalPercent: 100 });
    expect(report.rows).toEqual([]);
  });

  it('scores required and optional fields separately', () => {
    const report = analyzeCoverage([complete({ contacts: [], warnings: [], eligibilityRuleKey: '', jurisdiction: '' })]);
    expect(report.totals.requiredPercent).toBe(100);
    expect(report.totals.optionalPercent).toBe(0);
    expect(report.totals.recordsWithBlockers).toBe(0);
    expect(report.totals.recordsWithGaps).toBe(1);
  });

  it('counts blockers only for required gaps by default, and for configured optional ones when asked', () => {
    const records = [complete({ department: '' }), complete({ id: 'b', name: 'B', jurisdiction: '' })];
    expect(analyzeCoverage(records).totals.recordsWithBlockers).toBe(1);
    expect(analyzeCoverage(records, {}, { extraBlockers: ['jurisdiction'] }).totals.recordsWithBlockers).toBe(2);
  });

  it('computes per-field counts and percentages', () => {
    const records = [complete(), complete({ id: 'b', name: 'B', documents: [] }), complete({ id: 'c', name: 'C', documents: [] }), complete({ id: 'd', name: 'D' })];
    const documents = analyzeCoverage(records).byField.find((r) => r.field === 'documents');
    expect(documents).toMatchObject({ missing: 2, present: 2, total: 4, percentComplete: 50, severity: 'medium', level: 'required' });
  });

  it('sums missing fields by severity', () => {
    const report = analyzeCoverage([complete({ department: '', documents: [], contacts: [] })]);
    expect(report.bySeverity).toEqual({ high: 1, medium: 1, low: 1 });
  });

  it('puts the records with the most blockers first, then by name', () => {
    const report = analyzeCoverage([
      complete({ id: 'a', name: 'Alpha', contacts: [] }),
      complete({ id: 'b', name: 'Beta', department: '', steps: [] }),
      complete({ id: 'c', name: 'Gamma', department: '' }),
      complete({ id: 'd', name: 'Delta', contacts: [] }),
    ]);
    expect(report.rows.map((r) => r.name)).toEqual(['Beta', 'Gamma', 'Alpha', 'Delta']);
  });

  it('keeps going when records are malformed or repeated', () => {
    const report = analyzeCoverage([null, 5, 'x', [], complete(), {}, { id: 7, name: 9 }]);
    expect(report.totals.records).toBe(3);
    expect(report.rows.every((r) => typeof r.name === 'string' && typeof r.id === 'string')).toBe(true);
    expect(report.rows.find((r) => r.name === '(unnamed record)')).toBeTruthy();
  });
});

describe('analyzeCoverage: filters', () => {
  const records = [
    complete({ id: 'a', name: 'A', category: 'Certificates', jurisdiction: 'Maharashtra', publicationState: 'published', department: '' }),
    complete({ id: 'b', name: 'B', category: 'Certificates', jurisdiction: 'Kerala', publicationState: 'draft', documents: [] }),
    complete({ id: 'c', name: 'C', category: 'Transport', jurisdiction: 'Kerala', publicationState: 'archived', contacts: [] }),
    complete({ id: 'd', name: 'D', category: 'Transport', jurisdiction: undefined, department: '', documents: [] }),
    complete({ id: 'e', name: 'E', category: 'Transport', publicationState: 'draft' }),
  ];
  const ids = (report) => report.rows.map((r) => r.id).sort();

  it('has no filter by default', () => {
    expect(DEFAULT_FILTERS).toEqual({ category: 'All', jurisdiction: 'All', publicationState: 'All', field: 'All', severity: 'All' });
    expect(analyzeCoverage(records).totals.records).toBe(5);
  });

  it('filters by category', () => {
    const report = analyzeCoverage(records, { category: 'Certificates' });
    expect(report.totals.records).toBe(2);
    expect(ids(report)).toEqual(['a', 'b']);
  });

  it('filters by jurisdiction, counting a missing one as the default "India"', () => {
    expect(analyzeCoverage(records, { jurisdiction: 'Kerala' }).totals.records).toBe(2);
    const india = analyzeCoverage(records, { jurisdiction: 'India' });
    expect(ids(india)).toEqual(['d']);
    expect(india.rows[0].jurisdictionIsDefault).toBe(true);
  });

  it('separates draft and archived records from public ones', () => {
    expect(ids(analyzeCoverage(records, { publicationState: 'draft' }))).toEqual(['b']);
    expect(analyzeCoverage(records, { publicationState: 'draft' }).totals.records).toBe(2);
    expect(analyzeCoverage(records, { publicationState: 'archived' }).totals.records).toBe(1);
    const published = analyzeCoverage(records, { publicationState: 'published' });
    expect(published.totals.records).toBe(2); // a and d (no state means published)
    expect(published.rows.find((r) => r.id === 'd').publicationStateIsDefault).toBe(true);
  });

  it('combines filters', () => {
    const report = analyzeCoverage(records, { category: 'Transport', jurisdiction: 'Kerala', publicationState: 'archived' });
    expect(report.totals.records).toBe(1);
    expect(ids(report)).toEqual(['c']);
    expect(analyzeCoverage(records, { category: 'Certificates', jurisdiction: 'Kerala', publicationState: 'archived' }).totals.records).toBe(0);
  });

  it('narrows the list to a missing field, and the count matches the field table', () => {
    const report = analyzeCoverage(records, { field: 'documents' });
    expect(ids(report)).toEqual(['b', 'd']);
    expect(report.rows.length).toBe(report.byField.find((r) => r.field === 'documents').missing);
  });

  it('narrows the list to a severity', () => {
    const high = analyzeCoverage(records, { severity: 'high' });
    expect(ids(high)).toEqual(['a', 'd']);
    const low = analyzeCoverage(records, { severity: 'low' });
    expect(ids(low)).toEqual(['c']);
    expect(analyzeCoverage(records, { field: 'contacts', severity: 'high' }).rows).toEqual([]);
  });

  it('reconciles: with no gap filter the list is exactly the records with gaps', () => {
    const groups = [{}, { category: 'Transport' }, { jurisdiction: 'Kerala' }, { publicationState: 'draft' }, { category: 'Certificates', publicationState: 'published' }];
    for (const group of groups) {
      const report = analyzeCoverage(records, group);
      expect(report.rows.length, JSON.stringify(group)).toBe(report.totals.recordsWithGaps);
      expect(report.totals.records).toBe(report.totals.complete + report.totals.recordsWithGaps);
      for (const row of report.byField) expect(row.missing + row.present).toBe(report.totals.records);
    }
  });

  it('reconciles for every field in every group', () => {
    for (const group of [{}, { category: 'Transport' }, { publicationState: 'draft' }]) {
      const base = analyzeCoverage(records, group);
      for (const row of base.byField) {
        expect(analyzeCoverage(records, { ...group, field: row.field }).rows.length, `${row.field} ${JSON.stringify(group)}`).toBe(row.missing);
      }
    }
  });

  it('reports no rows for a group with nothing measured', () => {
    const report = analyzeCoverage(records, { category: 'Nonexistent' });
    expect(report.totals.records).toBe(0);
    expect(report.rows).toEqual([]);
  });

  it('is deterministic', () => {
    expect(analyzeCoverage(records, { category: 'Transport' })).toEqual(analyzeCoverage([...records].reverse(), { category: 'Transport' }));
  });
});

describe('filterOptions', () => {
  it('offers the categories and jurisdictions that exist, sorted, and the fixed lists', () => {
    const options = filterOptions([complete({ category: 'Transport' }), complete({ category: 'Certificates', jurisdiction: undefined }), null]);
    expect(options.categories).toEqual(['Certificates', 'Transport']);
    expect(options.jurisdictions).toEqual(['India', 'Maharashtra']);
    expect(options.publicationStates).toEqual(['draft', 'published', 'archived']);
    expect(options.fields.map((f) => f.field)).toEqual(COVERAGE_RULES.map((r) => r.field));
    expect(options.severities).toEqual(['high', 'medium', 'low']);
  });

  it('copes with nothing', () => {
    expect(filterOptions(undefined).categories).toEqual([]);
  });
});

describe('the built-in catalogue', () => {
  it('can be measured, and every row can be found by id', () => {
    const report = analyzeCoverage(MOCK_SERVICES);
    expect(report.totals.records).toBe(MOCK_SERVICES.length);
    const known = new Set(MOCK_SERVICES.map((s) => s.id));
    for (const row of report.rows) expect(known.has(row.id)).toBe(true);
    expect(report.totals.requiredPercent).toBeGreaterThan(50);
  });
});

describe('export', () => {
  const report = analyzeCoverage([complete({ name: '=HYPERLINK("http://evil.example","x")', department: '' }), complete({ id: 'b', name: 'Plain, with comma', contacts: [] })]);
  const csv = coverageToCsv(report);

  it('has the totals, the field table and one line per record with gaps', () => {
    expect(csv).toContain('Records measured,2');
    expect(csv).toContain('Records with gaps,2');
    expect(csv).toContain('Records with publication blockers,1');
    expect(csv).toContain('Field,Level,Severity,Publication blocker,Missing,Present,Records measured,Complete (%)');
    expect(csv).toContain('Department,required,high,yes,1,1,2,50');
    expect(csv).toContain('income-certificate');
    expect(csv.endsWith('\n')).toBe(true);
  });

  it('neutralises spreadsheet formulas and quotes commas', () => {
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(csv).toContain('"Plain, with comma"');
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@x')).toBe("'@x");
    expect(csvCell('safe')).toBe('safe');
    expect(csvCell(null)).toBe('');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('carries no personal data, even if a record wrongly contains some', () => {
    const dirty = complete({ email: 'citizen@example.org', phone: '9876543210', aadhaarNumber: '123412341234', userId: 'u1', department: '' });
    const text = coverageToCsv(analyzeCoverage([dirty]));
    for (const secret of ['citizen@example.org', '9876543210', '123412341234', 'u1,']) expect(text).not.toContain(secret);
  });

  it('works for an empty report', () => {
    const text = coverageToCsv(analyzeCoverage([]));
    expect(text).toContain('Records measured,0');
    expect(text.split('\n').length).toBeGreaterThan(10);
  });
});

describe('the documentation', () => {
  it('lists every rule with its level, severity and blocker setting', async () => {
    const { readFileSync } = await import('node:fs');
    const doc = readFileSync(new URL('../../docs/CATALOGUE_COVERAGE.md', import.meta.url), 'utf8');
    for (const rule of COVERAGE_RULES) {
      const row = `| \`${rule.field}\` | ${rule.label} | ${rule.level} | ${rule.severity} | ${rule.level === 'required' ? 'yes' : 'no'} |`;
      expect(doc, rule.field).toContain(row);
    }
  });
});
