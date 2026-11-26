import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import OfficeComparisonCard from './OfficeComparisonCard';
import { buildOfficeComparisonRecord } from '../../services/officeComparisonService';

const NOW = Date.parse('2026-11-18T00:00:00Z');

const service = {
  id: 'driving-license',
  name: 'Driving License',
  jurisdiction: { level: 'state', states: ['Delhi'], districts: [], localBody: '' },
  officialSources: [{ name: 'Parivahan', url: 'https://parivahan.gov.in', verified: true }],
};

const verifiedOffice = {
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
  coordinates: { lat: 28.6, lng: 77.2 },
  coordinateVerification: {
    verified: true,
    sourceUrl: 'https://transport.delhi.gov.in/locations',
    verifiedOn: '2026-11-10',
  },
  contact: { phone: '+91 11 1111 1111', portalUrl: 'https://transport.delhi.gov.in' },
  accessibility: { wheelchairRamp: true, elevator: true, accessibleRestroom: false },
  auditMetadata: {
    verifiedBy: 'Test Transport Audit',
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

const render = (record, props = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <OfficeComparisonCard office={record} onToggleCompare={() => {}} {...props} />
    </MemoryRouter>
  );

describe('OfficeComparisonCard (#824)', () => {
  it('shows service capabilities, jurisdiction, contact verification and accessibility without hover', () => {
    const record = buildOfficeComparisonRecord(verifiedOffice, service, { now: NOW });
    const html = render(record, { isSelected: true });

    expect(html).toContain('Alpha Test RTO');
    expect(html).toContain('Driving License');
    expect(html).toContain('South Delhi, Delhi');
    expect(html).toContain('Service capabilities');
    expect(html).toContain('Capability source');
    expect(html).toContain('href="https://transport.delhi.gov.in/audit"');
    expect(html).toContain('Contact recorded in a verified source');
    expect(html).toContain('Wheelchair ramp / step-free entry');
    expect(html).toContain('Available');
    expect(html).toContain('Last verified');
    expect(html).toContain('2026-11-01');
    expect(html).toContain('Suggestion, not an official decision');
    expect(html).toContain('data version');
  });

  it('exposes the compare choice as a labelled checkbox and links to the record and report', () => {
    const record = buildOfficeComparisonRecord(verifiedOffice, service, { now: NOW });
    const html = render(record, { isSelected: true });

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('Selected to compare');
    expect(html).toContain('href="/office/test-rto"');
    expect(html).toContain('href="/office/test-rto?report=1"');
    expect(html).toContain('Report outdated');
  });

  it('keeps an existing service query when building the report link', () => {
    const record = buildOfficeComparisonRecord(verifiedOffice, service, { now: NOW });
    const html = render(record, { detailHref: '/office/test-rto?service=driving-license' });

    expect(html).toContain('href="/office/test-rto?service=driving-license"');
    expect(html).toContain('href="/office/test-rto?service=driving-license&amp;report=1"');
  });

  it('marks absent contact, accessibility and verification data as Unknown', () => {
    const record = buildOfficeComparisonRecord(unknownOffice, service, { now: NOW });
    const html = render(record);

    expect(html).toContain('Contact verification unknown');
    expect(html).toContain('Unknown — no contact channel is recorded.');
    expect(html).toContain('Unknown — no service IDs are recorded for this office.');
    expect(html).toContain('Accessibility evidence is unknown');
    expect(html).toContain('Do not assume a facility is available.');
    expect(html).toContain('Verification not recorded');
    expect(html).toContain('Contact source: not recorded');
    expect(html).toContain('Record source: not recorded');
  });

  it('allows unselecting but disables adding beyond the compare limit', () => {
    const record = buildOfficeComparisonRecord(verifiedOffice, service, { now: NOW });
    const disabled = render(record, { compareDisabled: true, isSelected: false });
    expect(disabled).toContain('disabled');

    const selected = render(record, { compareDisabled: true, isSelected: true });
    expect(selected).not.toContain('disabled=""');
  });

  it('renders nothing when no office is supplied', () => {
    expect(render(null)).toBe('');
  });
});
