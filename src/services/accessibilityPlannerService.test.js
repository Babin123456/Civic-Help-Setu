import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccessibilityCatalog,
  getOfficeAccessibilityProfile,
  isAuditDateStale,
  buildPersonalVisitChecklist,
  savePersonalVisitPlan,
  loadPersonalVisitPlan,
  exportVisitPlanSummary,
  STALE_AUDIT_DAYS_THRESHOLD,
  ACCESSIBILITY_STORAGE_KEY,
} from './accessibilityPlannerService.js';

const createMockStorage = (initial = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
};

describe('accessibilityPlannerService (#144)', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  describe('Feature Catalog', () => {
    it('returns standardized public accessibility feature definitions', () => {
      const catalog = getAccessibilityCatalog();
      expect(catalog.length).toBeGreaterThanOrEqual(6);

      const ids = catalog.map((f) => f.id);
      expect(ids).toContain('step_free_access');
      expect(ids).toContain('elevators');
      expect(ids).toContain('accessible_counters');
      expect(ids).toContain('accessible_washrooms');
      expect(ids).toContain('tactile_paving');
    });
  });

  describe('Acceptance Criteria: Known, Unknown, and Stale Accessibility Details', () => {
    it('returns known verified accessibility features with source dates for audited offices', () => {
      const profile = getOfficeAccessibilityProfile('delhi-south-collectorate');

      expect(profile.officeId).toBe('delhi-south-collectorate');
      expect(profile.hasAuditRecord).toBe(true);
      expect(profile.lastAuditedDate).toBe('2026-09-15');
      expect(profile.auditedBy).toContain('DEPwD');
      expect(profile.officialSource).not.toBeNull();
      expect(profile.officialSource.url).toContain('accessibleindia.gov.in');

      // Check verified feature
      const ramp = profile.features.find((f) => f.id === 'step_free_access');
      expect(ramp.status).toBe('verified_available');
      expect(ramp.statusLabel).toBe('Verified Available');

      // Check verified unavailable feature
      const lift = profile.features.find((f) => f.id === 'elevators');
      expect(lift.status).toBe('verified_unavailable');
      expect(lift.statusLabel).toBe('Verified Not Available');
    });

    it('labels unknown accessibility features as "Not verified" rather than assuming availability', () => {
      // 1. For an audited office, features not audited must be 'not_verified'
      const auditedProfile = getOfficeAccessibilityProfile('delhi-south-collectorate');
      const tactile = auditedProfile.features.find((f) => f.id === 'tactile_paving');
      expect(tactile.status).toBe('not_verified');
      expect(tactile.statusLabel).toBe('Not Verified');

      // 2. For an office with NO audit on record at all
      const unknownOfficeProfile = getOfficeAccessibilityProfile('delhi-dist-court-saket');
      expect(unknownOfficeProfile.hasAuditRecord).toBe(false);
      expect(unknownOfficeProfile.lastAuditedDate).toBeNull();
      expect(unknownOfficeProfile.auditWarning).toContain('unverified');

      for (const feature of unknownOfficeProfile.features) {
        expect(feature.status).toBe('not_verified');
        expect(feature.statusLabel).toBe('Not Verified');
      }
    });

    it('detects and warns about stale audits older than 180 days', () => {
      expect(isAuditDateStale('2026-09-15')).toBe(false); // recent (< 180 days)
      expect(isAuditDateStale('2024-05-10')).toBe(true); // stale (> 180 days)
      expect(isAuditDateStale(null)).toBe(true);

      const staleProfile = getOfficeAccessibilityProfile('delhi-rto-sarai-kale-khan');
      expect(staleProfile.isStale).toBe(true);
      expect(staleProfile.auditWarning).toContain('Caution: The accessibility audit');
      expect(staleProfile.auditWarning).toContain(`over ${STALE_AUDIT_DAYS_THRESHOLD} days ago`);
    });

    it('handles null, undefined, or empty office IDs gracefully', () => {
      const nullProfile = getOfficeAccessibilityProfile(null);
      expect(nullProfile.officeId).toBeNull();
      expect(nullProfile.hasAuditRecord).toBe(false);
      expect(nullProfile.features.every((f) => f.status === 'not_verified')).toBe(true);
    });
  });

  describe('Personal Visit Checklist Builder & Storage', () => {
    it('builds confirmation questions linked to official contacts based on citizen needs', () => {
      const checklist = buildPersonalVisitChecklist('delhi-south-collectorate', [
        'step_free_access',
        'tactile_paving', // unverified in this office
        'elevators', // verified unavailable in this office
      ]);

      expect(checklist.officeName).toContain('District Magistrate Office');
      expect(checklist.officialContacts.phone).toBeDefined();
      expect(checklist.officialContacts.portalUrl).toBeDefined();

      const questions = checklist.questionsToConfirm;
      expect(questions.length).toBe(3);

      const rampQ = questions.find((q) => q.featureId === 'step_free_access');
      expect(rampQ.status).toBe('verified_available');
      expect(rampQ.urgency).toBe('medium');

      const tactileQ = questions.find((q) => q.featureId === 'tactile_paving');
      expect(tactileQ.status).toBe('not_verified');
      expect(tactileQ.urgency).toBe('high'); // Unverified items require confirmation

      const liftQ = questions.find((q) => q.featureId === 'elevators');
      expect(liftQ.status).toBe('verified_unavailable');
      expect(liftQ.urgency).toBe('critical'); // Unavailable accommodation is critical
    });

    it('saves and loads personal visit plans in storage', () => {
      const officeId = 'delhi-south-collectorate';
      const planData = {
        neededFeatureIds: ['step_free_access', 'accessible_washrooms'],
        confirmedQuestionIds: ['step_free_access'],
      };

      const saved = savePersonalVisitPlan(officeId, planData, mockStorage);
      expect(saved).toBe(true);

      const loaded = loadPersonalVisitPlan(officeId, mockStorage);
      expect(loaded.neededFeatureIds).toEqual(['step_free_access', 'accessible_washrooms']);
      expect(loaded.confirmedQuestionIds).toEqual(['step_free_access']);
      expect(loaded.updatedAt).toBeDefined();
    });

    it('exports a plain-text markdown visit summary with official contacts', () => {
      const checklist = buildPersonalVisitChecklist('delhi-south-collectorate', ['step_free_access']);
      checklist.questionsToConfirm[0].confirmed = true;

      const summary = exportVisitPlanSummary(checklist);
      expect(summary).toContain('# ACCESSIBILITY & OFFICE VISIT CHECKLIST');
      expect(summary).toContain('Official Contact:');
      expect(summary).toContain('[x] **Step-Free Entrance & Ramp** [Status: Verified Available]');
      expect(summary).toContain('Confirmation question:');
      expect(summary).toContain('Accommodations are verified based on official audits');
    });

    it('returns empty string if export is called with null', () => {
      expect(exportVisitPlanSummary(null)).toBe('');
    });
  });
});
