import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VERIFIED_CAMPS,
  evaluateReliefRecordFreshness,
  listVerifiedReliefCampsAndEntitlements,
  publishOfficialReliefCamp,
  getOfflineBoardEssentials,
} from './disasterReliefBoardService';

describe('Disaster Relief Entitlement & Camp Information Board Service (#1435)', () => {
  it('flags stale, expired, and unverified records accurately', () => {
    const now = new Date('2026-05-20T12:00:00.000Z');

    const stale = evaluateReliefRecordFreshness(
      {
        source: 'https://rahat.up.gov.in',
        jurisdiction: 'Lucknow',
        effectiveDate: '2026-05-01T00:00:00.000Z',
        verifiedAt: '2026-05-15T08:00:00.000Z',
      },
      now
    );
    expect(stale.isStale).toBe(true);
    expect(stale.statusBadge).toBe('stale');

    const expired = evaluateReliefRecordFreshness(
      {
        source: 'https://rahat.up.gov.in',
        jurisdiction: 'Lucknow',
        effectiveDate: '2026-05-01T00:00:00.000Z',
        verifiedAt: '2026-05-19T08:00:00.000Z',
        expiresAt: '2026-05-19T23:59:59.000Z',
      },
      now
    );
    expect(expired.isExpired).toBe(true);
    expect(expired.statusBadge).toBe('expired');

    const unverified = evaluateReliefRecordFreshness({ ruleStatus: 'unverified' }, now);
    expect(unverified.isUnverified).toBe(true);
    expect(unverified.statusBadge).toBe('unverified');
  });

  it('excludes expired camps unless includeExpired is true and filters by disasterType', () => {
    const now = new Date('2026-05-20T12:00:00.000Z');
    const camps = [
      ...DEFAULT_VERIFIED_CAMPS,
      {
        id: 'expired-camp-1',
        name: 'Expired Temporary Shelter',
        city: 'Lucknow',
        jurisdiction: 'Lucknow',
        authority: 'DDMA Lucknow',
        source: 'https://rahat.up.gov.in',
        effectiveDate: '2026-05-01T00:00:00.000Z',
        verifiedAt: '2026-05-15T08:00:00.000Z',
        expiresAt: '2026-05-18T00:00:00.000Z',
        disasterTypes: ['HEATWAVE'],
        accessible: true,
      },
    ];

    const active = listVerifiedReliefCampsAndEntitlements(camps, { disasterType: 'HEATWAVE' }, now);
    expect(active.some((c) => c.id === 'expired-camp-1')).toBe(false);

    const withExpired = listVerifiedReliefCampsAndEntitlements(
      camps,
      { disasterType: 'HEATWAVE', includeExpired: true },
      now
    );
    expect(withExpired.some((c) => c.id === 'expired-camp-1')).toBe(true);
  });

  it('rejects PII/Aadhaar/OTP in publishOfficialReliefCamp and provides offline essentials', () => {
    const bad = publishOfficialReliefCamp({
      name: 'Relief Camp',
      jurisdiction: 'Lucknow',
      authority: 'DDMA',
      source: 'https://rahat.up.gov.in',
      effectiveDate: '2026-05-01T00:00:00.000Z',
      verifiedAt: '2026-05-15T08:00:00.000Z',
      aadhaar: '234567890123',
    });
    expect(bad.ok).toBe(false);

    const essentials = getOfflineBoardEssentials();
    expect(essentials.helplines.some((h) => h.number === '1077')).toBe(true);
    expect(essentials.survivalChecklist.length).toBeGreaterThan(0);
  });
});
