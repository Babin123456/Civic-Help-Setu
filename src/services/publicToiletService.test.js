import { describe, it, expect, beforeEach } from 'vitest';
import {
  listToilets,
  createToilet,
  updateToilet,
  setTemporaryClosure,
  recordCleaning,
  reportMaintenanceIssue,
  updateTicketProgress,
  submitFeedback,
  moderateCitizenFeedback,
} from './publicToiletService.js';
import {
  resetToiletStorage,
  getFacilityById,
} from './publicToiletStorage.js';

describe('Public Toilet Service Business Logic & RBAC (#758)', () => {
  beforeEach(() => {
    resetToiletStorage();
  });

  describe('Listing & Filtering', () => {
    it('returns seeded public facilities with pagination', () => {
      const res = listToilets({ page: 1, limit: 10 });
      expect(res.facilities.length).toBeGreaterThan(0);
      expect(res.total).toBeGreaterThan(0);
      expect(res.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('filters by wheelchair accessibility and running water', () => {
      const res = listToilets({ wheelchairOnly: true, runningWaterOnly: true });
      expect(res.facilities.every((f) => f.features?.wheelchairAccessible && f.features?.runningWater)).toBe(true);
    });

    it('filters by state and keyword query', () => {
      const res = listToilets({ state: 'Karnataka', searchQuery: 'metro' });
      expect(res.facilities.length).toBeGreaterThan(0);
      expect(res.facilities[0].name.toLowerCase()).toContain('metro');
    });

    it('masks private fields when queried under citizen role', () => {
      const res = listToilets({ userRole: 'citizen' });
      const facility = res.facilities[0];
      expect(facility.internalNotes).toBeUndefined();
      expect(facility.privateStaffContacts).toBeUndefined();
    });
  });

  describe('RBAC & Jurisdiction Permissions', () => {
    it('blocks citizens from creating facilities', () => {
      const payload = {
        id: 'pt-unauth-01',
        name: 'Unauthorized Toilet',
        category: 'standalone_urinal',
        jurisdiction: { state: 'Karnataka', district: 'Bengaluru Urban', ward: '150' },
        location: { latitude: 12.9, longitude: 77.6, address: 'Road 1' },
        status: 'verified_active',
      };
      expect(() => createToilet(payload, { role: 'citizen' })).toThrow(/Unauthorized/);
    });

    it('allows operators to create valid facilities', () => {
      const payload = {
        id: 'pt-auth-01',
        name: 'Authorized Toilet',
        category: 'standalone_urinal',
        jurisdiction: { state: 'Karnataka', district: 'Bengaluru Urban', ward: '150' },
        location: { latitude: 12.9, longitude: 77.6, address: 'Road 1' },
        status: 'verified_active',
      };
      const created = createToilet(payload, { role: 'operator' });
      expect(created.id).toBe('pt-auth-01');
    });

    it('restricts operators to their assigned ward', () => {
      expect(() =>
        updateToilet('pt-blr-ward150-001', { name: 'New Name' }, { role: 'operator', assignedWard: '999 - Other Ward' })
      ).toThrow(/Permission Denied: Operator jurisdiction/);
    });

    it('blocks citizens from logging cleaning events', () => {
      const cleaningPayload = {
        facilityId: 'pt-blr-ward150-001',
        checklist: { waterSupplyVerified: true, floorSanitized: true, suppliesRestocked: true },
      };
      expect(() => recordCleaning(cleaningPayload, { role: 'citizen' })).toThrow(/Unauthorized/);
    });

    it('allows operators to log cleaning events and updates lastCleanedAt', () => {
      const cleaningPayload = {
        facilityId: 'pt-blr-ward150-001',
        checklist: { waterSupplyVerified: true, floorSanitized: true, suppliesRestocked: true },
        operatorNotes: 'Cleaned thoroughly',
      };
      const log = recordCleaning(cleaningPayload, { role: 'operator' });
      expect(log.id).toBeDefined();

      const facility = getFacilityById('pt-blr-ward150-001');
      expect(facility.lastCleanedAt).toBe(log.cleanedAt);
    });

    it('blocks citizens from declaring temporary closures', () => {
      expect(() =>
        setTemporaryClosure('pt-blr-ward150-001', { isClosed: true, reason: 'Maintenance' }, { role: 'citizen' })
      ).toThrow(/Unauthorized/);
    });

    it('allows operators to set and lift temporary closures', () => {
      const closed = setTemporaryClosure(
        'pt-blr-ward150-001',
        { isClosed: true, reason: 'Emergency plumbing repairs' },
        { role: 'operator' }
      );
      expect(closed.status).toBe('temporarily_closed');
      expect(closed.temporaryClosure.isClosed).toBe(true);

      const reopened = setTemporaryClosure(
        'pt-blr-ward150-001',
        { isClosed: false },
        { role: 'operator' }
      );
      expect(reopened.status).toBe('verified_active');
      expect(reopened.temporaryClosure).toBeNull();
    });
  });

  describe('Maintenance Workflows & Auto-Recovery', () => {
    it('sets facility to under_maintenance when a critical ticket is reported and restores to active upon resolution', () => {
      const facilityId = 'pt-blr-ward150-001';
      expect(getFacilityById(facilityId).status).toBe('verified_active');

      // Citizen reports critical water outage
      const ticket = reportMaintenanceIssue(
        {
          facilityId,
          category: 'water_outage',
          severity: 'critical',
          description: 'No water in all washrooms and cisterns',
        },
        { role: 'citizen' }
      );

      expect(ticket.status).toBe('reported');
      expect(getFacilityById(facilityId).status).toBe('under_maintenance');

      // Operator begins work
      updateTicketProgress(ticket.id, 'in_progress', 'Plumber dispatched', { role: 'operator' });
      expect(getFacilityById(facilityId).status).toBe('under_maintenance');

      // Operator resolves ticket
      updateTicketProgress(ticket.id, 'resolved', 'Main valve replaced and tested', { role: 'operator' });
      expect(getFacilityById(facilityId).status).toBe('verified_active');
    });

    it('blocks invalid ticket state transitions', () => {
      const ticket = reportMaintenanceIssue(
        {
          facilityId: 'pt-blr-ward150-001',
          category: 'lighting_electrical',
          severity: 'low',
          description: 'Flickering bulb in entry hall',
        },
        { role: 'citizen' }
      );

      // Cannot jump straight from reported to closed without resolving
      expect(() =>
        updateTicketProgress(ticket.id, 'closed', 'Done', { role: 'operator' })
      ).toThrow(/Invalid ticket transition/);
    });
  });

  describe('Citizen Feedback & Moderation', () => {
    it('accepts citizen feedback and marks it pending for moderation', () => {
      const report = submitFeedback({
        facilityId: 'pt-blr-ward150-001',
        rating: 4,
        cleanlinessLevel: 'clean',
        comment: 'Good upkeep today, soap dispenser full.',
        idempotencyKey: 'feedback-test-key-1',
      });

      expect(report.moderationStatus).toBe('pending');
      expect(report.comment).toBe('Good upkeep today, soap dispenser full.');
    });

    it('allows reviewers to moderate feedback', () => {
      const report = submitFeedback({
        facilityId: 'pt-blr-ward150-001',
        rating: 5,
        cleanlinessLevel: 'spotless',
        comment: 'Great ramp access',
        idempotencyKey: 'feedback-test-key-2',
      });

      // Citizen cannot moderate
      expect(() => moderateCitizenFeedback(report.id, 'approved', { role: 'citizen' })).toThrow(/Unauthorized/);

      // Reviewer approves
      const approved = moderateCitizenFeedback(report.id, 'approved', { role: 'reviewer' });
      expect(approved.moderationStatus).toBe('approved');
      expect(approved.moderatedBy).toBe('reviewer');
    });
  });
});

