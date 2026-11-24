import { describe, it, expect } from 'vitest';
import {
  FACILITY_STATUS,
  TICKET_STATUS,
  TICKET_SEVERITY,
  TICKET_CATEGORIES,
  canTransitionFacilityStatus,
  canTransitionTicketStatus,
  calculateOperatingStatus,
  validatePublicFacility,
  validateCleaningEvent,
  validateMaintenanceTicket,
  validateFeedbackReport,
  containsPII,
  sanitizeText,
  maskPublicFacility,
} from './publicToiletContract.js';

describe('Public Toilet Data Contract & State Transitions (#758)', () => {
  describe('Facility State Transitions', () => {
    it('allows valid transitions between active, temporary closed, and maintenance', () => {
      expect(canTransitionFacilityStatus(FACILITY_STATUS.VERIFIED_ACTIVE, FACILITY_STATUS.TEMPORARILY_CLOSED)).toBe(true);
      expect(canTransitionFacilityStatus(FACILITY_STATUS.TEMPORARILY_CLOSED, FACILITY_STATUS.VERIFIED_ACTIVE)).toBe(true);
      expect(canTransitionFacilityStatus(FACILITY_STATUS.VERIFIED_ACTIVE, FACILITY_STATUS.UNDER_MAINTENANCE)).toBe(true);
      expect(canTransitionFacilityStatus(FACILITY_STATUS.UNDER_MAINTENANCE, FACILITY_STATUS.DECOMMISSIONED)).toBe(true);
    });

    it('blocks transitions from decommissioned (terminal state)', () => {
      expect(canTransitionFacilityStatus(FACILITY_STATUS.DECOMMISSIONED, FACILITY_STATUS.VERIFIED_ACTIVE)).toBe(false);
      expect(canTransitionFacilityStatus(FACILITY_STATUS.DECOMMISSIONED, FACILITY_STATUS.UNDER_MAINTENANCE)).toBe(false);
    });
  });

  describe('Ticket State Transitions', () => {
    it('allows linear ticket progression and rejection', () => {
      expect(canTransitionTicketStatus(TICKET_STATUS.REPORTED, TICKET_STATUS.ACKNOWLEDGED)).toBe(true);
      expect(canTransitionTicketStatus(TICKET_STATUS.ACKNOWLEDGED, TICKET_STATUS.IN_PROGRESS)).toBe(true);
      expect(canTransitionTicketStatus(TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.RESOLVED)).toBe(true);
      expect(canTransitionTicketStatus(TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED)).toBe(true);
      expect(canTransitionTicketStatus(TICKET_STATUS.REPORTED, TICKET_STATUS.REJECTED)).toBe(true);
    });

    it('blocks transitions out of closed or rejected tickets', () => {
      expect(canTransitionTicketStatus(TICKET_STATUS.CLOSED, TICKET_STATUS.IN_PROGRESS)).toBe(false);
      expect(canTransitionTicketStatus(TICKET_STATUS.REJECTED, TICKET_STATUS.REPORTED)).toBe(false);
    });
  });

  describe('Zero-PII Detection & Sanitization', () => {
    it('flags Aadhaar, PAN, phone numbers, and email addresses', () => {
      expect(containsPII('My Aadhaar is 2345 6789 0123 please call')).toBe(true);
      expect(containsPII('Operator PAN is ABCDE1234F')).toBe(true);
      expect(containsPII('Call me at 9876543210 urgently')).toBe(true);
      expect(containsPII('Reach out to admin@example.com for keys')).toBe(true);
      expect(containsPII('Water tap is leaking in stall 2')).toBe(false);
    });

    it('sanitizes text by stripping HTML tags and control chars', () => {
      const dirty = '<script>alert("xss")</script><b>Clean</b>\u0000 rest';
      const clean = sanitizeText(dirty, 100);
      expect(clean).toBe('alert("xss")Clean rest');
    });
  });

  describe('Operating Hours & Closure Calculations', () => {
    it('identifies 24/7 facilities correctly', () => {
      const res = calculateOperatingStatus({ is24x7: true });
      expect(res.isOpen).toBe(true);
      expect(res.label).toBe('Open 24/7');
    });

    it('handles temporary closures with future reopen date', () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const res = calculateOperatingStatus(
        { is24x7: true },
        { isClosed: true, reason: 'Pipe burst repairs', reopenExpectedAt: futureDate }
      );
      expect(res.isOpen).toBe(false);
      expect(res.label).toBe('Temporarily Closed');
      expect(res.reason).toBe('Pipe burst repairs');
    });

    it('ignores temporary closure if reopenExpectedAt has already passed', () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const res = calculateOperatingStatus(
        { is24x7: true },
        { isClosed: true, reason: 'Over', reopenExpectedAt: pastDate }
      );
      expect(res.isOpen).toBe(true);
      expect(res.label).toBe('Open 24/7');
    });

    it('accurately evaluates daytime operating schedules', () => {
      const schedule = [
        { day: 1, open: '06:00', close: '22:00' }, // Monday
      ];
      // Monday 10:00 AM
      const mondayMorning = new Date('2026-05-18T10:00:00'); // Day 1
      const resMorning = calculateOperatingStatus({ is24x7: false, schedule }, null, mondayMorning);
      expect(resMorning.isOpen).toBe(true);
      expect(resMorning.label).toBe('Open Now');

      // Monday 11:30 PM (23:30)
      const mondayNight = new Date('2026-05-18T23:30:00');
      const resNight = calculateOperatingStatus({ is24x7: false, schedule }, null, mondayNight);
      expect(resNight.isOpen).toBe(false);
      expect(resNight.label).toBe('Closed Now');
    });

    it('handles cross-midnight operating schedules', () => {
      const schedule = [
        { day: 5, open: '18:00', close: '03:00' }, // Friday night to Saturday morning
      ];
      // Friday 11:00 PM (23:00)
      const fridayNight = new Date('2026-05-22T23:00:00'); // Day 5
      const res1 = calculateOperatingStatus({ is24x7: false, schedule }, null, fridayNight);
      expect(res1.isOpen).toBe(true);

      // Friday 02:00 AM
      const fridayEarly = new Date('2026-05-22T02:00:00');
      const res2 = calculateOperatingStatus({ is24x7: false, schedule }, null, fridayEarly);
      expect(res2.isOpen).toBe(true);

      // Friday 12:00 PM (Noon)
      const fridayNoon = new Date('2026-05-22T12:00:00');
      const res3 = calculateOperatingStatus({ is24x7: false, schedule }, null, fridayNoon);
      expect(res3.isOpen).toBe(false);
    });
  });

  describe('Validation Engines', () => {
    it('validates a correct PublicFacility object', () => {
      const validFacility = {
        id: 'pt-blr-ward150-001',
        name: 'Koramangala 5th Block Public Toilet',
        category: 'public_convenience_complex',
        jurisdiction: { state: 'Karnataka', district: 'Bengaluru Urban', ward: '150 - Bellandur' },
        location: { latitude: 12.9352, longitude: 77.6245, address: 'Near BDA Complex, 5th Block, Koramangala' },
        status: FACILITY_STATUS.VERIFIED_ACTIVE,
        features: { wheelchairAccessible: true },
      };
      const res = validatePublicFacility(validFacility);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects facility with invalid coordinates or missing address', () => {
      const invalid = {
        id: 'pt-001',
        name: 'Invalid',
        category: 'public_convenience_complex',
        jurisdiction: { state: 'KA', district: 'BLR', ward: '1' },
        location: { latitude: 150, longitude: 77.62, address: '' },
        status: FACILITY_STATUS.VERIFIED_ACTIVE,
      };
      const res = validatePublicFacility(invalid);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Latitude'))).toBe(true);
      expect(res.errors.some((e) => e.includes('address'))).toBe(true);
    });

    it('rejects CleaningEvent with missing required checklist', () => {
      const invalid = {
        id: 'cln-001',
        facilityId: 'pt-001',
        cleanedAt: 'invalid-date',
      };
      const res = validateCleaningEvent(invalid);
      expect(res.valid).toBe(false);
    });

    it('validates MaintenanceTicket and rejects tickets with PII', () => {
      const piiTicket = {
        id: 'tkt-001',
        facilityId: 'pt-001',
        category: TICKET_CATEGORIES.WATER_OUTAGE,
        severity: TICKET_SEVERITY.HIGH,
        status: TICKET_STATUS.REPORTED,
        description: 'Water is not working call caretaker at 9845098450',
      };
      const res = validateMaintenanceTicket(piiTicket);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('personal'))).toBe(true);
    });

    it('validates FeedbackReport and bounds rating to 1..5', () => {
      const outOfBounds = {
        id: 'fb-001',
        facilityId: 'pt-001',
        rating: 6,
      };
      const res = validateFeedbackReport(outOfBounds);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Rating'))).toBe(true);
    });

    it('masks private/staff fields in public facility projection', () => {
      const raw = {
        id: 'pt-001',
        name: 'MG Road Metro Complex',
        internalNotes: 'Contractor penalty pending',
        privateStaffContacts: ['+91 9999999999'],
        auditAccessToken: 'secret-xyz',
      };
      const masked = maskPublicFacility(raw);
      expect(masked.id).toBe('pt-001');
      expect(masked.internalNotes).toBeUndefined();
      expect(masked.privateStaffContacts).toBeUndefined();
      expect(masked.auditAccessToken).toBeUndefined();
    });
  });
});

