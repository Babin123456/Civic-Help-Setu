import { describe, it, expect } from 'vitest';
import {
  searchWaterPoints,
  nearestWaterPoints,
  getOperationalStatus,
  getQualityStatus,
  describeWaterPoint,
  SAFETY_UNKNOWN_WARNING,
} from './drinkingWaterPointService';

const NOW = new Date('2026-06-10T12:00:00Z').getTime();
const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
const report = (status, h, moderation = 'approved') => ({ status, reportedAt: hoursAgo(h), moderation });

describe('searchWaterPoints and nearestWaterPoints', () => {
  const points = [
    { id: 'a', name: 'Bus Stand Tap', locality: 'Central', sourceType: 'tap', lat: 12.9716, lng: 77.5946 },
    { id: 'b', name: 'Park Handpump', locality: 'Lake Road', sourceType: 'handpump', lat: 12.98, lng: 77.6 },
    { id: 'c', name: 'No coordinates', locality: 'Central', sourceType: 'tank' },
  ];

  it('matches name, locality and source type', () => {
    expect(searchWaterPoints(points, 'central')).toHaveLength(2);
    expect(searchWaterPoints(points, 'handpump')).toHaveLength(1);
    expect(searchWaterPoints(points, '')).toHaveLength(3);
    expect(searchWaterPoints(undefined, 'x')).toEqual([]);
  });

  it('sorts by distance and skips points without coordinates', () => {
    const res = nearestWaterPoints(points, { lat: 12.9717, lng: 77.5947 });
    expect(res.map((r) => r.point.id)).toEqual(['a', 'b']);
    expect(res[0].metres).toBeLessThan(50);
    expect(nearestWaterPoints(points, { lat: 12.9717, lng: 77.5947 }, 1)).toHaveLength(1);
  });
});

describe('getOperationalStatus', () => {
  it('is unknown with no reports', () => {
    expect(getOperationalStatus({}, NOW).status).toBe('unknown');
  });

  it('does not change on a single report', () => {
    expect(getOperationalStatus({ statusReports: [report('broken', 2)] }, NOW).status).toBe('unconfirmed');
  });

  it('confirms a fault after two agreeing reports', () => {
    const res = getOperationalStatus({ statusReports: [report('no_supply', 1), report('no_supply', 5)] }, NOW);
    expect(res).toMatchObject({ status: 'no_supply', reports: 2 });
  });

  it('ignores unapproved, old and invalid reports', () => {
    const point = {
      statusReports: [
        report('broken', 1, 'pending'),
        report('broken', 100),
        report('broken', 3),
        { status: 'on_fire', reportedAt: hoursAgo(1), moderation: 'approved' },
      ],
    };
    expect(getOperationalStatus(point, NOW).status).toBe('unconfirmed');
  });

  it('lets a newer working report outweigh older faults', () => {
    const point = { statusReports: [report('working', 1), report('working', 2), report('broken', 10), report('broken', 12)] };
    expect(getOperationalStatus(point, NOW).status).toBe('working');
  });
});

describe('getQualityStatus', () => {
  const test = { testedAt: daysAgo(10), authority: 'District Water Lab', source: 'Report 42', result: 'pass' };

  it('shows a result only with date, authority and a valid result', () => {
    expect(getQualityStatus({ qualityTest: test }, NOW)).toMatchObject({
      status: 'tested_pass',
      authority: 'District Water Lab',
      source: 'Report 42',
    });
    expect(getQualityStatus({ qualityTest: { ...test, result: 'fail' } }, NOW).status).toBe('tested_fail');
  });

  it('warns when there is no usable test record', () => {
    expect(getQualityStatus({}, NOW)).toEqual({ status: 'unknown', warning: SAFETY_UNKNOWN_WARNING });
    expect(getQualityStatus({ qualityTest: { ...test, authority: '' } }, NOW).status).toBe('unknown');
    expect(getQualityStatus({ qualityTest: { ...test, testedAt: 'soon' } }, NOW).status).toBe('unknown');
  });

  it('expires old tests and keeps the warning', () => {
    const res = getQualityStatus({ qualityTest: { ...test, testedAt: daysAgo(200) } }, NOW);
    expect(res.status).toBe('expired');
    expect(res.warning).toBe(SAFETY_UNKNOWN_WARNING);
  });

  it('never infers quality from working reports', () => {
    const point = { statusReports: [report('working', 1), report('working', 2)] };
    expect(describeWaterPoint({ id: 'x', name: 'X', ...point }, NOW).quality.status).toBe('unknown');
  });
});

describe('describeWaterPoint', () => {
  it('keeps operational and quality status apart', () => {
    const d = describeWaterPoint(
      { id: 'a', name: 'Tap', sourceType: 'tap', accessible: true, maintenanceContact: 'Ward JE', statusReports: [report('broken', 1), report('broken', 2)] },
      NOW
    );
    expect(d.operational.status).toBe('broken');
    expect(d.quality.status).toBe('unknown');
    expect(d).toMatchObject({ accessible: true, maintenanceContact: 'Ward JE' });
  });
});
