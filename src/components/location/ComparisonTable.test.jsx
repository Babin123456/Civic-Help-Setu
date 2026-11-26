import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ComparisonTable from './ComparisonTable';
import { buildOfficeComparisonRecord } from '../../services/officeComparisonService';

const NOW = Date.parse('2026-11-18T00:00:00Z');

const service = {
  id: 'driving-license',
  name: 'Driving License',
  jurisdiction: { level: 'state', states: ['Delhi'], districts: [], localBody: '' },
};

const office = {
  id: 'test-rto',
  name: 'Alpha Test RTO',
  type: 'Regional Transport Office',
  category: 'Transport',
  serviceIds: ['driving-license'],
  state: 'Delhi',
  district: 'South Delhi',
  city: 'New Delhi',
  pincode: '110001',
  address: '1 Test Road',
  channels: ['in-person'],
  contact: { phone: '+91 11 1111 1111' },
  accessibility: {},
  auditMetadata: {
    verifiedBy: 'Test Audit',
    reviewDate: '2026-11-01',
    sourceUrl: 'https://transport.delhi.gov.in/audit',
  },
};

const unknownOffice = {
  id: 'test-unknown',
  name: 'Gamma Test Office',
  type: 'Municipal Office',
  category: 'Municipal',
  serviceIds: [],
  state: 'Delhi',
  district: 'New Delhi',
  city: 'New Delhi',
  pincode: '110002',
  address: '2 Unknown Road',
  channels: ['in-person'],
  contact: {},
  accessibility: {},
};

const records = [
  buildOfficeComparisonRecord(office, service, { now: NOW }),
  buildOfficeComparisonRecord(unknownOffice, service, { now: NOW }),
];

const render = (items, props = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ComparisonTable records={items} service={service} {...props} />
    </MemoryRouter>
  );

describe('ComparisonTable (#824)', () => {
  it('renders a semantic, captioned comparison with row and column headers', () => {
    const html = render(records);

    expect(html).toContain('<table class="comparison-table">');
    expect(html).toContain('<caption>');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain('Attribute');
    expect(html).toContain('Service match');
    expect(html).toContain('Jurisdiction');
    expect(html).toContain('Official contact');
    expect(html).toContain('Last verified');
    expect(html).toContain('Map pin');
    expect(html).toContain('Alpha Test RTO');
    expect(html).toContain('Gamma Test Office');
    expect(html).toContain('data version');
    expect(html).toContain('deterministic suggestions, not official decisions');
    expect(html).toContain('href="/office/test-rto?service=driving-license"');
  });

  it('shows explicit Unknown values and links every claim to its source', () => {
    const html = render(records);

    expect(html).toContain('Unknown');
    expect(html).toContain('https://transport.delhi.gov.in/audit');
    expect(html).toContain('No verified pin');
    expect(html).toContain('Source:');
    expect(html).toContain('No contact channel is recorded.');
  });

  it('is keyboard-scrollable and states the horizontal-scroll behaviour', () => {
    const html = render(records);
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('scroll this table horizontally');
    expect(html).toContain('same information is available in the office cards');
  });

  it('offers record and report actions only when the handler is provided', () => {
    const withoutReport = render(records);
    expect(withoutReport).toContain('Open record');
    expect(withoutReport).not.toContain('Report outdated');

    const withReport = render(records, { onReportOutdated: () => {} });
    expect(withReport).toContain('Report outdated');
  });

  it('asks for a second office instead of rendering a one-column table', () => {
    const html = render([records[0]]);
    expect(html).toContain('Select at least two offices');
    expect(html).not.toContain('<table');
  });

  it('handles an empty selection safely', () => {
    const html = render([]);
    expect(html).toContain('Select at least two offices');
    expect(html).toContain('role="status"');
  });
});
