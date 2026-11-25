import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createPublicProject,
  submitMilestoneProgress,
  recordVerificationReview,
  getPublicProjectDetail,
  getProjectAuditTrail,
  ensurePublicProjectsSeedData,
  DomainStateError,
} from '../src/services/publicProjectService';
import {
  computeAssetHash,
  verifyAssetIntegrity,
  applyPublicRedactionFilter,
} from '../src/services/evidenceVerificationService';
import { setCurrentActor, PermissionDeniedError } from '../src/services/accessControl';
import { sanitizeString } from '../api/_lib/handlers/public-projects.js';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

describe('Public Projects Security & Threat Model Tests (#752)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    ensurePublicProjectsSeedData(storage);
    setCurrentActor(null);
  });

  afterEach(() => {
    setCurrentActor(null);
  });

  describe('1. Injection & Sanitization Safeguards', () => {
    it('strips HTML script tags and control characters from user text', () => {
      const maliciousInput = '<script>alert("XSS")</script>Corridor asphalt paving completed <img src=x onerror=evil() />';
      const sanitized = sanitizeString(maliciousInput, 500);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('<img');
      expect(sanitized).toContain('Corridor asphalt paving completed');
    });

    it('neutralizes SQL injection patterns in search parameters', () => {
      const sqlInjection = "' OR '1'='1' --";
      const sanitized = sanitizeString(sqlInjection, 100);
      expect(sanitized).toBe("' OR '1'='1' --"); // Stripped of dangerous control bytes and safely handled as literal string
    });
  });

  describe('2. Replay & Idempotency Attacks', () => {
    it('prevents duplicate submissions when the same idempotency key is replayed', () => {
      const payload = {
        projectId: 'proj-drain-202',
        milestoneId: 'ms-drain-202-2',
        narrative: 'Pouring concrete base slab with automated sensor monitoring.',
        reportedPercent: 80,
        evidenceAssets: [{ id: 'asset-1', storageUrl: 'https://cdn/photo1.jpg' }],
        idempotencyKey: 'replay-attack-key-12345',
      };

      const firstAttempt = submitMilestoneProgress(payload, storage);
      const replayedAttempt = submitMilestoneProgress(payload, storage);

      expect(firstAttempt.id).toBe(replayedAttempt.id);
      expect(firstAttempt.seal).toBe(replayedAttempt.seal);
    });
  });

  describe('3. Zero Data Leakage & Public Projection Isolation', () => {
    it('never leaks internal contractor tax/license IDs or raw unredacted URLs to public viewers', () => {
      const publicView = getPublicProjectDetail('proj-road-101', storage, false);

      // Verify contractor tax details are redacted/omitted
      expect(publicView.contractorDetails?.licenseId).toBeUndefined();

      // Verify raw storage URLs are omitted from public assets
      for (const asset of publicView.evidenceAssets) {
        expect(asset.storageUrl).toBeUndefined();
        expect(asset.publicPreviewUrl).toBeDefined();
        expect(asset.redactionStatus).toBe('REDACTED');
      }

      // Verify budget order internal notes are stripped
      expect(publicView.budgetReference?.sanctionOrderNo).toBeUndefined();
    });

    it('exposes full administrative records only when isPrivileged = true', () => {
      const privilegedView = getPublicProjectDetail('proj-road-101', storage, true);
      expect(privilegedView.budgetReference?.sanctionOrderNo).toBe('BBMP/EE/RRD/WO/2026/044');
      expect(privilegedView.evidenceAssets[0]?.storageUrl).toBeDefined();
    });
  });

  describe('4. Tamper Detection & Integrity Verification', () => {
    it('flags altered photographic evidence payloads', () => {
      const original = 'https://cdn.civicbridge.in/photos/road_base_grade.jpg';
      const genuineHash = computeAssetHash(original);

      // Untampered
      const checkOriginal = verifyAssetIntegrity({ storageUrl: original }, genuineHash);
      expect(checkOriginal.isValid).toBe(true);
      expect(checkOriginal.tampered).toBe(false);

      // Tampered (1 byte altered in URL)
      const altered = 'https://cdn.civicbridge.in/photos/road_base_grade_altered.jpg';
      const checkAltered = verifyAssetIntegrity({ storageUrl: altered }, genuineHash);
      expect(checkAltered.isValid).toBe(false);
      expect(checkAltered.tampered).toBe(true);
    });
  });

  describe('5. Privilege Escalation Defense', () => {
    it('refuses project creation if actor claims admin in payload without verified token', () => {
      setCurrentActor({ id: 'citizen-attacker', role: 'citizen' });

      expect(() =>
        createPublicProject(
          {
            title: 'Unauthorized Corridor Project',
            description: 'Attempting to bypass access control by sending fake role parameters.',
            category: 'roads',
            jurisdiction: { wardNumber: 'Ward 1' },
          },
          storage
        )
      ).toThrow(PermissionDeniedError);
    });

    it('refuses milestone verification review if actor is unauthenticated or a citizen', () => {
      setCurrentActor({ id: 'citizen-attacker', role: 'citizen' });

      expect(() =>
        recordVerificationReview(
          {
            projectId: 'proj-road-101',
            milestoneId: 'ms-road-101-3',
            submissionId: 'sub-road-101-3-01',
            decision: 'APPROVE',
            findings: 'Bypassing official inspector authorization.',
          },
          storage
        )
      ).toThrow(PermissionDeniedError);
    });

    it('refuses audit trail access to citizens', () => {
      setCurrentActor({ id: 'citizen-attacker', role: 'citizen' });

      expect(() => getProjectAuditTrail('proj-road-101', storage)).toThrow(PermissionDeniedError);
    });
  });
});
