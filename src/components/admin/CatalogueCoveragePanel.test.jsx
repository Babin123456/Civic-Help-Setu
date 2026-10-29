import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CatalogueCoveragePanel from './CatalogueCoveragePanel';

const record = (overrides = {}) => ({
  id: 'income-certificate',
  name: 'Income Certificate',
  category: 'Certificates',
  shortDescription: 'Proof of annual income.',
  department: 'Revenue',
  steps: [{ title: 'Apply', description: 'Fill the form.' }],
  documents: ['Aadhaar'],
  eligibility: ['Resident'],
  fees: 'Free',
  processingTime: '7 days',
  lastVerified: '2026-09-01',
  officialSources: [{ name: 'Portal', url: 'https://example.gov.in/x' }],
  jurisdiction: 'Maharashtra',
  contacts: [{ label: 'Helpline', phone: '1800' }],
  warnings: ['Carry originals.'],
  eligibilityRuleKey: 'income',
  ...overrides,
});

const render = (props) => renderToStaticMarkup(<CatalogueCoveragePanel {...props} />);

describe('CatalogueCoveragePanel', () => {
  it('shows an accessible heading, the filters and the summary for an empty catalogue', () => {
    const html = render({ services: [] });
    expect(html).toMatch(/<section aria-labelledby="[^"]+"/);
    expect(html).toContain('Catalogue Coverage');
    expect(html).toContain('aria-label="Coverage filters"');
    expect(html).toContain('Records measured');
    expect(html).toContain('No records match these filters.');
    expect(html).toContain('(0 shown)');
    expect(html).toContain('100%'); // nothing is missing from nothing
  });

  it('lists a gap with its field, severity and whether it blocks publication', () => {
    const html = render({ services: [record({ department: '', contacts: [] })] });
    expect(html).toContain('Department · High · blocks publication');
    expect(html).toContain('Contacts · Low · optional');
    expect(html).toContain('(1 shown)');
    expect(html).toContain('Missing information for Income Certificate');
  });

  it('shows a complete catalogue as nothing to fix', () => {
    const html = render({ services: [record()] });
    expect(html).toContain('No record has a gap that matches these filters. Nothing to fix here.');
    expect(html).toContain('1 complete');
    expect(html).toContain('(0 shown)');
  });

  it('shows the by-field table with proper headers', () => {
    const html = render({ services: [record({ documents: [] }), record({ id: 'b', name: 'B' })] });
    expect(html).toContain('<caption');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toMatch(/Required documents[\s\S]*?1 of 2/);
  });

  it('offers an Edit button only when the admin page gives it a handler, and names the record', () => {
    expect(render({ services: [record({ department: '' })] })).not.toContain('Edit record');
    const html = render({ services: [record({ department: '' })], onEditService: () => {} });
    expect(html).toContain('Edit record');
    expect(html).toContain('aria-label="Edit Income Certificate in the admin editor"');
  });

  it('links public records to their public page and leaves drafts and archived ones without a public link', () => {
    const published = render({ services: [record({ department: '' })] });
    expect(published).toContain('href="/services/income-certificate"');
    expect(published).toContain('rel="noopener noreferrer"');
    expect(published).toContain('Public');
    const draft = render({ services: [record({ department: '', publicationState: 'draft' })] });
    expect(draft).not.toContain('View public page');
    expect(draft).toContain('Draft (not public)');
    const archived = render({ services: [record({ department: '', publicationState: 'archived' })] });
    expect(archived).not.toContain('View public page');
    expect(archived).toContain('Archived (not public)');
  });

  it('says when jurisdiction or state are defaults rather than data', () => {
    const records = [record({ jurisdiction: undefined })];
    const html = render({ services: records });
    expect(html).toContain('India');
    expect(html).toContain('(default)');
    expect(html).toContain('(default state)');
  });

  it('applies the initial filters to the numbers and the list', () => {
    const services = [record({ id: 'a', name: 'Alpha', category: 'Certificates', documents: [] }), record({ id: 'b', name: 'Beta', category: 'Transport', documents: [] })];
    const html = render({ services, initialFilters: { category: 'Transport' } });
    expect(html).toContain('Beta');
    expect(html).not.toContain('>Alpha<');
    expect(html).toContain('(1 shown)');
    expect(html).toContain('1 of 1');
    const empty = render({ services, initialFilters: { category: 'Certificates', field: 'steps' } });
    expect(empty).toContain('(0 shown)');
  });

  it('can treat an optional field as a blocker and shows the checkbox checked', () => {
    const html = render({ services: [record({ contacts: [] })], initialBlockers: ['contacts'] });
    expect(html).toContain('Contacts · Low · blocks publication');
    expect(html).toMatch(/<input type="checkbox" checked=""[^>]*\/>Contacts/);
  });

  it('escapes names instead of treating them as markup', () => {
    const html = render({ services: [record({ name: '<img src=x onerror=alert(1)>', department: '' })] });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('keeps going with malformed records', () => {
    expect(() => render({ services: [null, 5, 'x', {}, { id: 'only-id' }, record()] })).not.toThrow();
  });

  it('has the refresh and download controls with names', () => {
    const html = render({ services: [] });
    expect(html).toContain('Refresh');
    expect(html).toContain('Download summary (CSV)');
    expect(html).toContain('Clear filters');
    expect(html).toContain('Treat these optional fields as publication blockers');
  });
});
