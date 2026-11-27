import { describe, it, expect } from 'vitest';
import {
  evaluateStatusFreshness,
  getBuiltInAnganwadiCentres,
  migrateAnganwadiCalendarState,
  publishOfficialScheduleChange,
  submitCommunityCentreStatus,
  validateNoChildHealthDataOrPii,
} from './anganwadiCalendarService.js';

describe('Public Anganwadi Service Availability & Nutrition-Day Calendar (#1438)', () => {
  it('provides source-backed centre records and detects stale-status expiry', () => {
    const [freshCentre, staleCentre] = getBuiltInAnganwadiCentres();
    expect(freshCentre.officialProvenance.verified).toBe(true);
    expect(freshCentre.officialProvenance.freshnessStatus).toBe('fresh');

    expect(staleCentre.officialProvenance.isStale).toBe(true);
    expect(staleCentre.officialProvenance.freshnessStatus).toBe('stale_expired');

    const unverified = evaluateStatusFreshness('');
    expect(unverified.freshnessStatus).toBe('unverified');
  });

  it('rejects child-level health data and PII in community status and schedule payloads', () => {
    const withChildHealth = validateNoChildHealthDataOrPii({
      childName: 'Minor A',
      samStatus: 'moderate',
    });
    expect(withChildHealth.valid).toBe(false);

    const [centre] = getBuiltInAnganwadiCentres();
    expect(() =>
      submitCommunityCentreStatus(centre, {
        statusType: 'open_normal',
        note: 'MUAC: 11.2 cm recorded; Aadhaar 2345 6789 0123.',
      })
    ).toThrow(/Privacy\/Child-Safety violation/);

    const valid = submitCommunityCentreStatus(centre, {
      statusType: 'open_normal',
      note: 'Centre opened on time at 9 AM.',
    });
    expect(valid.communityStatusReports).toHaveLength(2);
  });

  it('publishes official schedule changes with provenance and migrates legacy state', () => {
    const [centre] = getBuiltInAnganwadiCentres();
    const updated = publishOfficialScheduleChange(centre, {
      actorId: 'admin-1',
      role: 'admin',
      effectiveDate: '2026-11-28',
      openingHours: '09:30 AM – 01:30 PM',
      nutritionDay: 'Every 1st & 3rd Wednesday',
      reason: 'Winter timing adjustment per ICDS circular.',
      officialProvenance: {
        source: 'UP ICDS Winter Circular #19',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-11-28',
        lastVerifiedAt: new Date().toISOString(),
      },
    });

    expect(updated.openingHours).toBe('09:30 AM – 01:30 PM');
    expect(updated.officialScheduleChanges).toHaveLength(1);
    expect(updated.officialProvenance.freshnessStatus).toBe('fresh');

    const migrated = migrateAnganwadiCalendarState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
