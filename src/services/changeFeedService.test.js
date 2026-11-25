import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  changeFeedService,
  analyzeChangeMateriality,
  computeVersionDiff,
} from './changeFeedService.js';
import { setCurrentActor } from './accessControl.js';
import { saveItem, removeItem } from './savedStorage.js';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
  };
};

describe('changeFeedService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
    changeFeedService.resetChangeFeedStorage();
    setCurrentActor({ id: 'admin-1', role: 'admin' });
  });

  afterEach(() => {
    setCurrentActor(null);
  });

  describe('Materiality Analyzer & Explainability', () => {
    it('flags mandatory document additions as material with explainable reasons', () => {
      const prior = { requiredDocuments: ['Aadhaar'] };
      const next = { requiredDocuments: ['Aadhaar', 'Income Certificate'] };

      const result = analyzeChangeMateriality(prior, next);
      expect(result.isMaterial).toBe(true);
      expect(result.influencedFields).toContain('requiredDocuments');
      expect(result.rulesetVersion).toBeDefined();
      expect(result.executionTimestamp).toBeDefined();
      expect(result.reasons[0]).toContain('Added new mandatory document');
    });

    it('flags statutory fee increases as material', () => {
      const prior = { fees: [{ amount: 50 }] };
      const next = { fees: [{ amount: 150 }] };

      const result = analyzeChangeMateriality(prior, next);
      expect(result.isMaterial).toBe(true);
      expect(result.influencedFields).toContain('fees');
      expect(result.reasons[0]).toContain('fee increased');
    });

    it('treats minor typographical edits without procedural change as non-material', () => {
      const prior = { requiredDocuments: ['Aadhaar'], fees: [{ amount: 50 }], changeType: 'EDITORIAL' };
      const next = { requiredDocuments: ['Aadhaar'], fees: [{ amount: 50 }], changeType: 'EDITORIAL' };

      const result = analyzeChangeMateriality(prior, next);
      expect(result.isMaterial).toBe(false);
      expect(result.reasons[0]).toContain('Editorial');
    });
  });

  describe('Version Diff Engine', () => {
    it('computes structured field-by-field diff between versions', () => {
      const v1 = {
        serviceId: 'trade-licence',
        version: 'v1.0',
        requiredDocuments: ['PAN', 'Rent Agreement'],
        fees: [{ name: 'Application', amount: 500 }],
        slaDays: 30,
      };
      const v2 = {
        serviceId: 'trade-licence',
        version: 'v2.0',
        requiredDocuments: ['PAN', 'Rent Agreement', 'Fire NOC'],
        fees: [{ name: 'Application', amount: 750 }],
        slaDays: 15,
      };

      const diff = computeVersionDiff(v1, v2);
      expect(diff.serviceId).toBe('trade-licence');
      expect(diff.changes.length).toBeGreaterThanOrEqual(3);

      const docChange = diff.changes.find(c => c.field === 'Required Documents');
      expect(docChange.added).toContain('Fire NOC');
    });
  });

  describe('Access Control & Permissions', () => {
    it('denies unauthenticated actors from creating change events', () => {
      setCurrentActor(null);
      expect(() => {
        changeFeedService.createChangeEvent({
          serviceId: 'property-tax',
          changeType: 'POLICY_CHANGE',
          changeReason: 'policy',
          changeTitle: 'New Tax Rules',
          effectiveDate: '2026-12-01',
        });
      }).toThrow();
    });

    it('denies citizens from approving change events', () => {
      setCurrentActor({ id: 'citizen-1', role: 'citizen' });
      expect(() => {
        changeFeedService.approveChange('any-event-id', 'citizen-1');
      }).toThrow(/Permission denied/);
    });

    it('allows admins to create, inspect pending, and approve change events', () => {
      setCurrentActor({ id: 'admin-1', role: 'admin' });

      const created = changeFeedService.createChangeEvent({
        serviceId: 'water-tanker',
        changeType: 'POLICY_CHANGE',
        changeReason: 'regulatory',
        changeTitle: 'Water Booking Quota Update',
        effectiveDate: '2026-11-20',
        requiredDocuments: ['Water Bill', 'Identity Proof'],
      });

      expect(created.success).toBe(true);
      expect(created.eventId).toBeDefined();

      const pending = changeFeedService.listPendingChangeEvents();
      expect(pending.events.some(e => e.id === created.eventId)).toBe(true);

      const approved = changeFeedService.approveChange(created.eventId, 'admin-1', 'Audited and verified');
      expect(approved.success).toBe(true);
      expect(approved.eventStatus).toBe('approved');
    });
  });

  describe('Subscriptions & Idempotent Impact Notifications', () => {
    it('creates subscriptions and delivers notifications on approval', () => {
      // 1. Citizen subscribes
      setCurrentActor({ id: 'citizen-42', role: 'citizen' });
      const sub = changeFeedService.subscribeUser({
        userId: 'citizen-42',
        serviceId: 'birth-certificate',
        frequency: 'immediate',
      });
      expect(sub.success).toBe(true);

      // 2. Admin creates material change event
      setCurrentActor({ id: 'admin-1', role: 'admin' });
      const change = changeFeedService.createChangeEvent({
        serviceId: 'birth-certificate',
        changeType: 'DOCUMENT_SIMPLIFICATION',
        changeReason: 'policy',
        changeTitle: 'Aadhaar made optional for hospital births',
        effectiveDate: '2026-12-01',
      });

      // 3. Admin approves change, triggering notifications
      const approval = changeFeedService.approveChange(change.eventId, 'admin-1');
      expect(approval.dispatchedCount).toBeGreaterThanOrEqual(1);

      // 4. Repeated dispatch is idempotent
      const redispatch = changeFeedService.dispatchImpactNotifications(change.eventId);
      expect(redispatch.dispatchedCount).toBe(1);

      const deliveryAttempts = changeFeedService.listDeliveryAttempts(change.eventId);
      expect(deliveryAttempts.attempts).toHaveLength(1);
      expect(deliveryAttempts.attempts[0].recipientId).toBe('citizen-42');
    });

    it('detects saved-item impact for citizens with bookmarks', () => {
      // 1. Citizen saves a service
      setCurrentActor({ id: 'citizen-saved', role: 'citizen' });
      saveItem('scholarship-portal', 'Education', 'Application notes', 'high');

      // 2. Admin publishes an approved material change for that service
      setCurrentActor({ id: 'admin-1', role: 'admin' });
      const event = changeFeedService.createChangeEvent({
        serviceId: 'scholarship-portal',
        changeType: 'ELIGIBILITY_UPDATE',
        changeReason: 'policy',
        changeTitle: 'New Income Slab Introduced',
        effectiveDate: '2026-12-15',
        priorVersion: { fees: [{ amount: 0 }] },
        newVersion: { requiredDocuments: ['Caste Certificate', 'Income Certificate'] },
      });
      changeFeedService.approveChange(event.eventId, 'admin-1');

      // 3. Citizen checks saved items impact
      setCurrentActor({ id: 'citizen-saved', role: 'citizen' });
      const impactReport = changeFeedService.getSavedItemsImpact('citizen-saved');
      expect(impactReport.success).toBe(true);
      expect(impactReport.totalImpacted).toBe(1);
      expect(impactReport.impacts[0].serviceId).toBe('scholarship-portal');
      expect(impactReport.impacts[0].actionRequired).toBe(true);

      // Cleanup saved item
      removeItem('scholarship-portal');
    });
  });

  describe('Service Version Rollback Procedure', () => {
    it('rolls back by creating a superseding version instead of mutating history', () => {
      setCurrentActor({ id: 'admin-1', role: 'admin' });

      // Version 1
      const v1 = changeFeedService.recordServiceVersion({
        serviceId: 'food-licence',
        version: 'v1.0',
        effectiveDate: '2026-01-01',
        requiredDocuments: ['ID Proof'],
      });

      // Version 2 (Errant policy)
      changeFeedService.recordServiceVersion({
        serviceId: 'food-licence',
        version: 'v2.0',
        effectiveDate: '2026-06-01',
        requiredDocuments: ['ID Proof', 'DNA Sample'],
      });

      // Rollback to v1
      const rollback = changeFeedService.rollbackVersion(
        'food-licence',
        v1.versionId,
        'Cancellation circular 2026/FSSAI/99'
      );

      expect(rollback.success).toBe(true);
      expect(rollback.rollbackRecord.version).toContain('restored');
      expect(rollback.rollbackRecord.rollbackNotice.restoredFrom).toBe(v1.versionId);

      // Check all versions are preserved
      const allVersions = changeFeedService.listServiceVersions('food-licence');
      expect(allVersions.versions).toHaveLength(3);
    });
  });
});
