import { describe, it, expect } from 'vitest';
import {
  filterStations,
  describeAttribute,
  getAvailability,
  summariseObservations,
  findDuplicateCandidates,
} from './evChargingDirectoryService';

const NOW = new Date('2026-06-01T12:00:00Z').getTime();
const minsAgo = (m) => new Date(NOW - m * 60000).toISOString();

const stations = [
  {
    id: 'a',
    name: 'Mall Charger',
    operator: 'VoltCo',
    locality: 'Sector 5',
    lat: 28.6,
    lng: 77.2,
    connectors: [{ type: 'CCS2', powerKw: 60 }, { type: 'Type2', powerKw: 7 }],
    attributes: {
      hours: { value: '24 hours', source: 'Operator site', verifiedAt: '2026-05-01' },
      payment: { value: 'App only', source: 'Operator site', verifiedAt: '2025-01-01' },
    },
  },
  {
    id: 'b',
    name: 'Depot',
    operator: 'GridGo',
    locality: 'Old Town',
    connectors: [{ type: 'Type2', powerKw: 22 }],
  },
];

describe('filterStations', () => {
  it('filters by connector, power, operator and locality', () => {
    expect(filterStations(stations, { connector: 'CCS2' }).map((s) => s.id)).toEqual(['a']);
    expect(filterStations(stations, { minPowerKw: 20 }).map((s) => s.id)).toEqual(['a', 'b']);
    expect(filterStations(stations, { minPowerKw: 50 }).map((s) => s.id)).toEqual(['a']);
    expect(filterStations(stations, { operator: 'gridgo' }).map((s) => s.id)).toEqual(['b']);
    expect(filterStations(stations, { locality: 'sector' }).map((s) => s.id)).toEqual(['a']);
  });

  it('combines filters and handles empty input', () => {
    expect(filterStations(stations, { connector: 'Type2', operator: 'VoltCo' }).map((s) => s.id)).toEqual(['a']);
    expect(filterStations(stations, {})).toHaveLength(2);
    expect(filterStations(undefined)).toEqual([]);
  });
});

describe('describeAttribute', () => {
  it('shows source and freshness', () => {
    expect(describeAttribute(stations[0], 'hours', NOW)).toMatchObject({ known: true, source: 'Operator site', stale: false });
    expect(describeAttribute(stations[0], 'payment', NOW).stale).toBe(true);
  });

  it('says not known when nothing is recorded', () => {
    expect(describeAttribute(stations[1], 'hours', NOW)).toMatchObject({ known: false, text: 'Not known' });
  });
});

describe('getAvailability', () => {
  it('returns numbers only from a current operator feed', () => {
    const live = { operatorFeed: { updatedAt: minsAgo(3), available: 2, total: 4 } };
    expect(getAvailability(live, NOW)).toMatchObject({ live: true, available: 2, total: 4 });
  });

  it('refuses to guess from an old or missing feed', () => {
    const old = { operatorFeed: { updatedAt: minsAgo(60), available: 2, total: 4 } };
    expect(getAvailability(old, NOW).live).toBe(false);
    expect(getAvailability(old, NOW)).not.toHaveProperty('available');
    expect(getAvailability({}, NOW).live).toBe(false);
  });
});

describe('summariseObservations', () => {
  it('counts only approved, recent, valid reports', () => {
    const station = {
      observations: [
        { status: 'broken', observedAt: minsAgo(30), moderation: 'approved' },
        { status: 'broken', observedAt: minsAgo(90), moderation: 'approved' },
        { status: 'working', observedAt: minsAgo(10), moderation: 'pending' },
        { status: 'working', observedAt: minsAgo(60 * 30), moderation: 'approved' },
        { status: 'exploded', observedAt: minsAgo(5), moderation: 'approved' },
      ],
    };
    const s = summariseObservations(station, NOW);
    expect(s.reports).toBe(2);
    expect(s.counts).toEqual({ working: 0, broken: 2, occupied: 0 });
    expect(s.latestAt).toBe(minsAgo(30));
    expect(s.label).toContain('not confirmed by the operator');
  });

  it('handles no reports', () => {
    expect(summariseObservations({}, NOW)).toMatchObject({ reports: 0, latestAt: null });
  });
});

describe('findDuplicateCandidates', () => {
  it('flags same operator within 50 m and same name in the same locality', () => {
    const list = [
      { id: '1', name: 'X', operator: 'VoltCo', locality: 'A', lat: 28.6, lng: 77.2 },
      { id: '2', name: 'Y', operator: 'VoltCo', locality: 'B', lat: 28.60020, lng: 77.2 },
      { id: '3', name: 'x', operator: 'Other', locality: 'a' },
      { id: '4', name: 'Z', operator: 'VoltCo', locality: 'C', lat: 28.7, lng: 77.2 },
    ];
    expect(findDuplicateCandidates(list)).toEqual([['1', '2'], ['1', '3']]);
  });
});
