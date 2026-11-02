import { describe, it, expect } from 'vitest';
import {
  RENEWAL_URGENCY,
  getStatutoryProfileForDocument,
  calculateDaysRemaining,
  assessDocumentUrgency,
  generateDocumentRenewalDigest,
  formatIcsDate,
  escapeIcsText,
  generateRenewalICalendar,
} from './documentRenewalDigestService.js';

describe('documentRenewalDigestService (#432)', () => {
  const refDate = new Date(2026, 10, 1); // 2026-11-01

  describe('getStatutoryProfileForDocument', () => {
    it('matches passport statutory profile', () => {
      const profile = getStatutoryProfileForDocument({ type: 'Passport', name: 'Indian Passport' });
      expect(profile).not.toBeNull();
      expect(profile.serviceId).toBe('passport');
      expect(profile.recommendedLeadDays).toBe(365);
    });

    it('matches driving license profile', () => {
      const profile = getStatutoryProfileForDocument({ type: 'Driving Licence', name: 'State DL' });
      expect(profile).not.toBeNull();
      expect(profile.serviceId).toBe('driving-license');
    });

    it('returns null for generic unmatched types', () => {
      expect(getStatutoryProfileForDocument({ type: 'Electricity Bill' })).toBeNull();
      expect(getStatutoryProfileForDocument(null)).toBeNull();
    });
  });

  describe('calculateDaysRemaining', () => {
    it('calculates days between reference and future date', () => {
      const future = new Date(2026, 10, 11); // 10 days later
      expect(calculateDaysRemaining(future, refDate)).toBe(10);
    });

    it('returns negative days for past expiration', () => {
      const past = new Date(2026, 9, 25); // 7 days earlier
      expect(calculateDaysRemaining(past, refDate)).toBe(-7);
    });

    it('returns null for missing or invalid dates', () => {
      expect(calculateDaysRemaining(null, refDate)).toBeNull();
      expect(calculateDaysRemaining('invalid', refDate)).toBeNull();
    });
  });

  describe('assessDocumentUrgency', () => {
    it('marks past dates as EXPIRED', () => {
      const res = assessDocumentUrgency({ expiryDate: '2026-10-15' }, refDate);
      expect(res.urgency).toBe(RENEWAL_URGENCY.EXPIRED);
      expect(res.urgencyLabel).toBe('Expired');
    });

    it('marks dates <= 30 days as URGENT', () => {
      const res = assessDocumentUrgency({ expiryDate: '2026-11-15' }, refDate);
      expect(res.urgency).toBe(RENEWAL_URGENCY.URGENT);
      expect(res.daysRemaining).toBe(14);
    });

    it('marks dates <= 90 days as UPCOMING', () => {
      const res = assessDocumentUrgency({ expiryDate: '2026-12-15' }, refDate);
      expect(res.urgency).toBe(RENEWAL_URGENCY.UPCOMING);
    });

    it('marks passport within 365 days as ADVANCE_NOTICE', () => {
      const res = assessDocumentUrgency(
        { type: 'Passport', expiryDate: '2027-05-01' },
        refDate
      );
      expect(res.urgency).toBe(RENEWAL_URGENCY.ADVANCE_NOTICE);
      expect(res.suggestedServiceId).toBe('passport');
    });

    it('marks documents without expiry as NO_EXPIRY', () => {
      const res = assessDocumentUrgency({ name: 'Aadhaar Card' }, refDate);
      expect(res.urgency).toBe(RENEWAL_URGENCY.NO_EXPIRY);
      expect(res.daysRemaining).toBeNull();
    });
  });

  describe('generateDocumentRenewalDigest', () => {
    it('aggregates summary metrics and sorts items by urgency', () => {
      const docs = [
        { id: '1', name: 'Active Passport', type: 'Passport', expiryDate: '2028-01-01' },
        { id: '2', name: 'Expired DL', type: 'Driving Licence', expiryDate: '2026-10-01' },
        { id: '3', name: 'Soon DL', type: 'Driving Licence', expiryDate: '2026-11-20' },
        { id: '4', name: 'PAN Card', type: 'Identity' },
      ];

      const digest = generateDocumentRenewalDigest(docs, refDate);
      expect(digest.summary.total).toBe(4);
      expect(digest.summary.expired).toBe(1);
      expect(digest.summary.urgent).toBe(1);
      expect(digest.summary.healthy).toBe(1);
      expect(digest.summary.noExpiry).toBe(1);
      expect(digest.summary.actionRequiredCount).toBe(2);

      // Expired should be first
      expect(digest.items[0].documentId).toBe('2');
      // Urgent should be second
      expect(digest.items[1].documentId).toBe('3');
    });

    it('handles empty documents array', () => {
      const digest = generateDocumentRenewalDigest([], refDate);
      expect(digest.summary.total).toBe(0);
      expect(digest.items).toEqual([]);
    });
  });

  describe('iCalendar (.ics) generation', () => {
    it('formats date and escapes special characters', () => {
      expect(formatIcsDate('2026-11-05')).toBe('20261105');
      expect(escapeIcsText('Hello, world; test\nline')).toBe('Hello\\, world\\; test\\nline');
    });

    it('generates valid RFC 5545 VCALENDAR text with VALARMs', () => {
      const items = [
        {
          documentId: 'doc-1',
          documentName: 'Passport (Official)',
          documentType: 'Passport',
          expiryDate: '2026-12-01',
          statutoryAdvice: 'Re-issue available.',
        },
      ];

      const ics = generateRenewalICalendar(items);
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('DTSTART;VALUE=DATE:20261201');
      expect(ics).toContain('SUMMARY:[Civic Setu] Renew Passport (Official)');
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('TRIGGER:-P30D');
      expect(ics).toContain('TRIGGER:-P7D');
      expect(ics).toContain('END:VCALENDAR');
    });
  });
});
