import { describe, it, expect } from 'vitest';
import {
  listSchemeRenewalRules,
  saveSchemeToCalendar,
  listSavedSchemeCalendar,
  updateReminderPreferences,
  exportSchemeCalendarIcs,
  updateSchemeRuleGovernance,
  hasForbiddenPII,
} from './schemeRenewalCalendarService.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('schemeRenewalCalendarService', () => {
  it('saves schemes with official cycles, never auto-completes renewal, and exports RFC 5545 .ics', () => {
    const storage = makeMemoryStorage();
    const rules = listSchemeRenewalRules(storage);
    expect(rules.length).toBeGreaterThanOrEqual(4);

    const saved = saveSchemeToCalendar({
      actorId: 'citizen-1',
      schemeId: 'post_matric_scholarship',
      lastCertifiedDate: '2026-01-15',
      leadDays: 21,
      storage,
    });
    expect(saved.ok).toBe(true);
    expect(saved.entry.nextRenewalDueDate).toBe('2027-01-15');
    expect(saved.entry.autoRenewalClaimed).toBe(false);
    expect(saved.entry.officialRuleMetadata.verificationStatus).toBe('VERIFIED');
    expect(saved.entry.officialRuleMetadata.gracePeriodDays).toBe(30);

    // Custom unknown scheme marked UNVERIFIED
    const custom = saveSchemeToCalendar({
      actorId: 'citizen-1',
      schemeId: 'custom_scheme',
      customSchemeName: 'Local Grant',
      lastCertifiedDate: '2026-03-01',
      storage,
    });
    expect(custom.ok).toBe(true);
    expect(custom.entry.officialRuleMetadata.verificationStatus).toBe('UNVERIFIED');

    const ics = exportSchemeCalendarIcs({ actorId: 'citizen-1', storage });
    expect(ics.ok).toBe(true);
    expect(ics.eventCount).toBe(2);
    const unfolded = ics.icsContent.replace(/\r\n /g, '');
    expect(unfolded).toContain('BEGIN:VCALENDAR');
    expect(unfolded).toContain('Renewal Due: Post-Matric Scholarship Renewal');
    expect(unfolded).toContain('Renewal is NOT auto-completed');
  });

  it('enforces owner isolation, role governance, and rejects PII', () => {
    const storage = makeMemoryStorage();
    expect(hasForbiddenPII('1234 5678 9012')).toBe(true);

    const saved = saveSchemeToCalendar({
      actorId: 'citizen-1',
      schemeId: 'ews_income_asset_cert',
      lastCertifiedDate: '2026-04-01',
      storage,
    });

    const crossUpdate = updateReminderPreferences({
      entryId: saved.entry.entryId,
      actorId: 'citizen-other',
      leadDays: 5,
      storage,
    });
    expect(crossUpdate.ok).toBe(false);
    expect(crossUpdate.code).toBe(403);

    const citizenGov = updateSchemeRuleGovernance({
      schemeId: 'ews_income_asset_cert',
      actorId: 'citizen-1',
      role: 'citizen',
      gracePeriodDays: 10,
      storage,
    });
    expect(citizenGov.ok).toBe(false);
    expect(citizenGov.code).toBe(403);

    expect(listSavedSchemeCalendar({ actorId: 'citizen-other', storage }).entries).toHaveLength(0);
  });
});
