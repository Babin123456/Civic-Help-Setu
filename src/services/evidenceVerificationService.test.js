import { describe, it, expect } from 'vitest';
import {
  computeAssetHash,
  verifyAssetIntegrity,
  auditEvidenceAssetIntegrity,
  applyPublicRedactionFilter,
  generateDiscrepancyHint,
  DISCREPANCY_LEVELS,
  CV_RULESET_VERSION,
} from './evidenceVerificationService';

describe('evidenceVerificationService (#752)', () => {
  describe('computeAssetHash & verifyAssetIntegrity', () => {
    it('produces a deterministic 64-char hex hash', () => {
      const payload = { url: 'https://storage.civicbridge.in/evidence/road-1.jpg', size: 1048576 };
      const h1 = computeAssetHash(payload);
      const h2 = computeAssetHash(payload);
      expect(h1).toBe(h2);
      expect(h1.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(h1)).toBe(true);
    });

    it('detects tampering when payload changes', () => {
      const originalPayload = 'https://storage.civicbridge.in/evidence/site-baseline.jpg';
      const expectedHash = computeAssetHash(originalPayload);

      const untamperedAsset = { storageUrl: originalPayload };
      const check1 = verifyAssetIntegrity(untamperedAsset, expectedHash);
      expect(check1.isValid).toBe(true);
      expect(check1.tampered).toBe(false);

      const tamperedAsset = { storageUrl: 'https://storage.civicbridge.in/evidence/tampered.jpg' };
      const check2 = verifyAssetIntegrity(tamperedAsset, expectedHash);
      expect(check2.isValid).toBe(false);
      expect(check2.tampered).toBe(true);
    });

    it('audits a collection of assets for tampering', () => {
      const assetA = { id: 'a1', data: 'valid-a' };
      const assetB = { id: 'b2', data: 'valid-b' };
      assetA.assetHash = computeAssetHash(assetA.data);
      assetB.assetHash = 'forged_fake_hash_0000000000000000000000000000000000000000000000000000';

      const audit = auditEvidenceAssetIntegrity([assetA, assetB]);
      expect(audit.allValid).toBe(false);
      expect(audit.totalChecked).toBe(2);
      expect(audit.tamperedCount).toBe(1);
    });
  });

  describe('applyPublicRedactionFilter', () => {
    it('redacts private storage URLs and marks faces/license plates masked', () => {
      const rawAsset = {
        id: 'asset-77',
        storageUrl: 'https://private-bucket.internal/photos/raw_unblurred_site.jpg',
        publicPreviewUrl: 'https://cdn.civicbridge.in/previews/blurred_site.webp',
        capturedAt: '2026-11-01T10:00:00Z',
        assetHash: 'abc123hash',
        caption: 'Culvert excavation site',
      };

      const publicAsset = applyPublicRedactionFilter(rawAsset);
      expect(publicAsset.storageUrl).toBeUndefined(); // Raw internal storage URL removed
      expect(publicAsset.publicPreviewUrl).toBe('https://cdn.civicbridge.in/previews/blurred_site.webp');
      expect(publicAsset.redactionStatus).toBe('REDACTED');
      expect(publicAsset.redactionDetails.facesMasked).toBe(true);
      expect(publicAsset.redactionDetails.licensePlatesMasked).toBe(true);
      expect(publicAsset.capturedAt).toBe('2026-11-01T10:00:00Z');
      expect(publicAsset.assetHash).toBe('abc123hash');
    });

    it('handles null safely', () => {
      expect(applyPublicRedactionFilter(null)).toBeNull();
    });
  });

  describe('generateDiscrepancyHint (Bounded Intelligence)', () => {
    it('never auto-approves or marks milestone complete', () => {
      const hint = generateDiscrepancyHint({
        baselineAsset: { capturedAt: '2026-09-01T00:00:00Z' },
        currentAsset: { storageUrl: 'https://preview.jpg', capturedAt: '2026-11-01T00:00:00Z' },
        projectCategory: 'roads',
      });

      expect(hint.requiresHumanSignoff).toBe(true);
      expect(hint.isAutomatedDecision).toBe(false); // Invariant!
      expect(hint.rulesetVersion).toBe(CV_RULESET_VERSION);
      expect(hint.featureWindow.timeSpanDays).toBeGreaterThan(0);
      expect(hint.influencingFactors.length).toBeGreaterThan(0);
      expect(hint.executionTimestamp).toBeDefined();
    });

    it('returns deterministic fallback when evidence or service is unavailable', () => {
      const fallbackHint = generateDiscrepancyHint({ forceFallback: true });
      expect(fallbackHint.discrepancyLevel).toBe(DISCREPANCY_LEVELS.UNAVAILABLE);
      expect(fallbackHint.discrepancyScore).toBeNull();
      expect(fallbackHint.requiresHumanSignoff).toBe(true);
      expect(fallbackHint.isAutomatedDecision).toBe(false);
      expect(fallbackHint.explanation).toContain('Manual visual inspection');
    });

    it('flags moderate variance when elapsed duration is unusually rapid', () => {
      const hint = generateDiscrepancyHint({
        baselineAsset: { capturedAt: '2026-11-01T00:00:00Z' },
        currentAsset: { storageUrl: 'https://preview.jpg', capturedAt: '2026-11-02T00:00:00Z' }, // 1 day elapsed
        projectCategory: 'roads',
      });

      expect(hint.discrepancyScore).toBeGreaterThanOrEqual(0.3);
      expect(hint.discrepancyLevel).toBe(DISCREPANCY_LEVELS.MODERATE);
      expect(hint.influencingFactors.some((f) => f.includes('timeline anomaly'))).toBe(true);
    });
  });
});
