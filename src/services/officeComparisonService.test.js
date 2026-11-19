import { describe, it, expect } from 'vitest';
import sample from '../../docs/examples/office-comparison-sample.json';
import {
  COMPARISON_MATCH_STATUS,
  buildComparisonRows,
  buildOfficeComparisonRecord,
  evaluateJurisdictionCoverage,
  getOfficeComparisonRecord,
  hasStaleOrUnknownRecords,
  normalizeOfficeCoordinates,
  normalizeServiceJurisdiction,
  paginateComparisonResults,
  rankOfficeComparisonRecords,
  validateComparisonQuery,
} from './officeComparisonService';

const NOW = Date.parse('2026-11-18T00:00:00Z');

const service = {
  id: 'driving-license',
  name: 'Driving License',
  jurisdiction: { level: 'state', states: ['Delhi'], districts: [], localBody: '' },
  officialSources: [{ name: 'Parivahan', url: 'https://parivahan.gov.in', verified: true, lastVerified: '2026-11-12' }],
};

const verifiedOffice = {
  id: 'test-verified-rto',
  name: 'Alpha Test RTO',
  type: 'Regional Transport Office',
  category: 'Transport',
  serviceIds: ['driving-license'],
  state: 'Delhi',
  district: 'South Delhi',
  city: 'New Delhi',
  pincode: '110001',
  address: '1 Test Road',
  channels: ['in-person', 'phone'],
  coordinates: { lat: 28.6, lng: 77.2 },
  coordinateVerification: {
    verified: true,
    sourceUrl: 'https://transport.delhi.gov.in/office-locations',
    verifiedOn: '2026-11-10',
  },
  contact: {
    phone: '+91 11 1111 1111',
    helpline: '1076',
    email: 'rto@example.gov.in',
    portalUrl: 'https://transport.delhi.gov.in',
  },
  officeHours: { days: 'Monday to Friday', hours: '09:00 - 17:00', openSaturdays: false },
  accessibility: {
    wheelchairRamp: true,
    elevator: true,
    accessibleRestroom: false,
    brailleSignage: null,
    assistiveListening: null,
    signLanguageSupport: null,
    tactilePaving: null,
    accessibleParking: true,
  },
  auditMetadata: {
    verifiedBy: 'Test Transport Audit',
    reviewDate: '2026-11-01',
    sourceUrl: 'https://transport.delhi.gov.in/audit',
  },
};

const staleOffice = {
  ...verifiedOffice,
  id: 'test-stale-rto',
  name: 'Beta Test RTO',
  auditMetadata: {
    verifiedBy: 'Old Audit',
    reviewDate: '2025-01-01',
    sourceUrl: 'https://transport.delhi.gov.in/old-audit',
  },
  coordinateVerification: undefined,
};

const unknownOffice = {
  id: 'test-unknown-office',
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
  coordinates: { lat: 28.61, lng: 77.21 },
  accessibility: {},
  contact: {},
};

describe('officeComparisonService (#824)', () => {
  it('normalizes structured, legacy-string, national and missing service jurisdictions', () => {
    expect(normalizeServiceJurisdiction(service).label).toBe('Delhi');
    expect(normalizeServiceJurisdiction({ jurisdiction: 'Karnataka' }).label).toBe('Karnataka');
    expect(
      normalizeServiceJurisdiction({ jurisdiction: { level: 'national', states: [], districts: [] } }).label
    ).toBe('National (all India)');
    expect(normalizeServiceJurisdiction({})).toBeNull();
  });

  it('treats a missing jurisdiction as unknown instead of nationwide', () => {
    const coverage = evaluateJurisdictionCoverage(verifiedOffice, { id: 'driving-license', jurisdiction: null });
    expect(coverage.status).toBe('unknown');
    expect(coverage.reason).toContain('does not state a jurisdiction');
  });

  it('detects a conflicting service jurisdiction', () => {
    const coverage = evaluateJurisdictionCoverage(verifiedOffice, {
      id: 'birth-certificate',
      jurisdiction: { level: 'state', states: ['Tamil Nadu'], districts: [] },
    });
    expect(coverage.status).toBe('conflict');
  });

  it('marks a listed service with verified evidence and a covering region as a verified match', () => {
    const record = buildOfficeComparisonRecord(verifiedOffice, service, { now: NOW });
    expect(record.match.status).toBe(COMPARISON_MATCH_STATUS.VERIFIED_MATCH);
    expect(record.match.score).toBe(1);
    expect(record.match.suggestion).toBe(true);
    expect(record.match.dataVersion).toBeTruthy();
  });

  it('marks a stale record as a service match needing re-verification', () => {
    const record = buildOfficeComparisonRecord(staleOffice, service, { now: NOW });
    expect(record.match.status).toBe(COMPARISON_MATCH_STATUS.STALE_MATCH);
    expect(record.verification.status).toBe('stale');
  });

  it('marks a capability with an unknown jurisdiction as review required', () => {
    const noJurisdictionService = { id: 'driving-license', name: 'Driving License' };
    const record = buildOfficeComparisonRecord(verifiedOffice, noJurisdictionService, { now: NOW });
    expect(record.match.status).toBe(COMPARISON_MATCH_STATUS.REVIEW_REQUIRED);
    expect(record.match.requiresReview).toBe(true);
    expect(record.match.explanation).toContain('could not be verified');
  });

  it('keeps missing contact, accessibility and verification fields as Unknown', () => {
    const record = buildOfficeComparisonRecord(unknownOffice, service, { now: NOW });
    expect(record.contact.channels).toEqual([]);
    expect(record.contact.verified).toBe(false);
    expect(record.verification.status).toBe('unknown');
    expect(record.verification.reviewDate).toBeNull();
    expect(record.accessibility.values.wheelchairRamp).toBeNull();
    expect(record.accessibility.verificationStatus).toBe('unknown');
  });

  it('does not treat a future-dated audit as verification evidence', () => {
    const future = buildOfficeComparisonRecord(
      {
        ...verifiedOffice,
        id: 'test-future-audit',
        auditMetadata: {
          verifiedBy: 'Future-dated audit',
          reviewDate: '2027-01-01',
          sourceUrl: 'https://transport.delhi.gov.in/future-audit',
        },
      },
      service,
      { now: NOW }
    );

    expect(future.verification.status).toBe('unknown');
    expect(future.verification.reviewDate).toBeNull();
    expect(future.verification.label).toContain('future');
    expect(future.contact.verified).toBe(false);
    expect(future.accessibility.values.wheelchairRamp).toBeNull();
    expect(future.capabilities[0].source.verified).toBe(false);
  });

  it('links capability claims to the office-record source when one exists', () => {
    const record = buildOfficeComparisonRecord(verifiedOffice, service, { now: NOW });
    const capability = record.capabilities.find((item) => item.id === 'driving-license');
    expect(capability.source.url).toBe('https://transport.delhi.gov.in/audit');
    expect(capability.source.verified).toBe(true);
  });

  it('falls back to the official portal as unverified context when no capability source is recorded', () => {
    const record = buildOfficeComparisonRecord(unknownOffice, service, { now: NOW });
    expect(record.capabilities).toEqual([]);

    const withPortal = buildOfficeComparisonRecord(
      {
        ...unknownOffice,
        serviceIds: ['driving-license'],
        contact: { portalUrl: 'https://delhi.gov.in' },
      },
      service,
      { now: NOW }
    );
    const capability = withPortal.capabilities[0];
    expect(capability.source.url).toBe('https://delhi.gov.in/');
    expect(capability.source.verified).toBe(false);
    expect(capability.verified).toBe(false);
  });

  it('never marks coordinates as verified without an explicit HTTPS coordinate source', () => {
    expect(normalizeOfficeCoordinates(verifiedOffice).verified).toBe(true);
    expect(normalizeOfficeCoordinates(staleOffice).verified).toBe(false);
    expect(normalizeOfficeCoordinates(unknownOffice).verified).toBe(false);
  });

  it('ranks verified capability, then stale capability, then jurisdiction only', () => {
    const ranked = rankOfficeComparisonRecords({
      service,
      offices: [unknownOffice, staleOffice, verifiedOffice],
      now: NOW,
    });
    expect(ranked.results.map((record) => record.id)).toEqual([
      'test-verified-rto',
      'test-stale-rto',
      'test-unknown-office',
    ]);
    expect(ranked.aggregation.capabilityMatches).toBe(2);
  });

  it('is deterministic when scores tie', () => {
    const first = rankOfficeComparisonRecords({
      service,
      offices: [unknownOffice, { ...unknownOffice, id: 'a-office', name: 'A Office' }, verifiedOffice],
      now: NOW,
    });
    const second = rankOfficeComparisonRecords({
      service,
      offices: [verifiedOffice, { ...unknownOffice, id: 'a-office', name: 'A Office' }, unknownOffice],
      now: NOW,
    });
    expect(first.results.map((record) => record.id)).toEqual(second.results.map((record) => record.id));
    expect(first.results[1].id).toBe('a-office');
  });

  it('keeps offices with missing coordinates in the text list', () => {
    const noCoordinates = { ...unknownOffice, id: 'text-only', coordinates: undefined };
    const ranked = rankOfficeComparisonRecords({ service, offices: [noCoordinates], now: NOW });
    expect(ranked.total).toBe(1);
    expect(ranked.results[0].coordinates.valid).toBe(false);
    expect(ranked.results[0].coordinates.verified).toBe(false);
  });

  it('paginates without changing the deterministic order', () => {
    const offices = Array.from({ length: 7 }, (_, index) => ({
      ...unknownOffice,
      id: `office-${index}`,
      name: `Office ${index}`,
    }));
    const first = rankOfficeComparisonRecords({ service, offices, page: 1, pageSize: 3, now: NOW });
    const second = rankOfficeComparisonRecords({ service, offices, page: 3, pageSize: 3, now: NOW });
    expect(first.results.map((record) => record.id)).toEqual(['office-0', 'office-1', 'office-2']);
    expect(second.results.map((record) => record.id)).toEqual(['office-6']);
    expect(second.totalPages).toBe(3);
  });

  it('builds comparison rows with sources and explicit Unknown values', () => {
    const verified = buildOfficeComparisonRecord(verifiedOffice, service, { now: NOW });
    const unknown = buildOfficeComparisonRecord(unknownOffice, service, { now: NOW });
    const rows = buildComparisonRows([verified, unknown]);
    expect(rows.find((row) => row.key === 'contact').cells[1].isUnknown).toBe(true);
    expect(rows.find((row) => row.key === 'lastVerified').cells[0].source.url).toBe(
      'https://transport.delhi.gov.in/audit'
    );
    expect(rows.find((row) => row.key === 'coordinates').cells[1].value).toBe('No verified pin');
  });

  it('validates malformed and unknown ranking queries', () => {
    expect(validateComparisonQuery(null).valid).toBe(false);
    expect(validateComparisonQuery({ serviceId: 'not-a-real-service' }).valid).toBe(false);
    expect(validateComparisonQuery({ serviceId: 'driving-license', page: '0' }).valid).toBe(false);
    expect(validateComparisonQuery({ serviceId: 'driving-license', pageSize: 500 }).valid).toBe(false);
    expect(validateComparisonQuery({ serviceId: 'driving-license', state: ['Delhi'] }).valid).toBe(false);
    expect(validateComparisonQuery({ serviceId: 'driving-license', channel: 'fax' }).valid).toBe(false);
    expect(validateComparisonQuery({ serviceId: 'driving-license', onlyWheelchairAccessible: 'yes' }).valid).toBe(false);

    const valid = validateComparisonQuery({ serviceId: 'driving-license', page: '2', pageSize: '5' });
    expect(valid.valid).toBe(true);
    expect(valid.value.page).toBe(2);
    expect(valid.value.pageSize).toBe(5);
  });

  it('paginates empty or malformed results safely', () => {
    const page = paginateComparisonResults([], 4, 10);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
    expect(page.totalPages).toBe(1);
    expect(page.hasNext).toBe(false);
    expect(page.hasPrevious).toBe(false);

    expect(paginateComparisonResults(null).items).toEqual([]);
    expect(paginateComparisonResults({ nope: true }).total).toBe(0);
  });

  it('flags stale or unverified records for the warning banner', () => {
    const verified = buildOfficeComparisonRecord(verifiedOffice, service, { now: NOW });
    const stale = buildOfficeComparisonRecord(staleOffice, service, { now: NOW });
    expect(hasStaleOrUnknownRecords([verified])).toBe(false);
    expect(hasStaleOrUnknownRecords([verified, stale])).toBe(true);
  });

  it('loads one office by id and reports an unknown id as null', () => {
    expect(getOfficeComparisonRecord('delhi-rto-sarai-kale-khan', service, { now: NOW })?.name).toContain('RTO');
    expect(getOfficeComparisonRecord('missing-office', service, { now: NOW })).toBeNull();
  });

  it('keeps the documented synthetic sample consistent with the ranking contract', () => {
    const ranked = rankOfficeComparisonRecords({
      service: sample.service,
      offices: sample.offices,
      pageSize: 6,
      now: NOW,
    });

    expect(ranked.results.map((record) => record.id)).toEqual(
      sample.expectedRanking.map((expected) => expected.officeId)
    );
    for (const expected of sample.expectedRanking) {
      const record = ranked.results.find((item) => item.id === expected.officeId);
      expect(record.match.status).toBe(expected.status);
      expect(record.match.score).toBe(expected.score);
    }

    const pinned = ranked.results.filter((record) => record.coordinates.verified).map((record) => record.id);
    expect(pinned).toEqual(sample.expectedMapPins);
    const unpinned = ranked.results.filter((record) => !record.coordinates.verified).map((record) => record.id);
    expect(unpinned).toEqual(sample.expectedNoMapPins);

    const gamma = ranked.results.find((record) => record.id === 'sample-gamma-office');
    expect(gamma.contact.channels).toEqual([]);
    expect(gamma.contact.verified).toBe(false);
    expect(gamma.verification.status).toBe('unknown');
    expect(Object.values(gamma.accessibility.values).every((value) => value === null)).toBe(true);
  });
});
