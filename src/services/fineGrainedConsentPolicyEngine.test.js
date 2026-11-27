import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createFineGrainedConsentEngine,
  FG_CONSENT_FIXTURES,
  FG_ACTIVE_GRANTS,
  FG_PURPOSE_REGISTRY,
  FGConsentGrant,
  FGPolicyRule,
  FGConsentPolicy,
  fineGrainedConsentEngine,
} from './fineGrainedConsentPolicyEngine.js';

// -----------------------------------------------------------------------------
// Test Suite: Fine-Grained Consent Policy Engine (#1257)
// -----------------------------------------------------------------------------

const TEST_ACTOR = 'citizen_user';

describe('Fine-Grained Consent Policy Engine (#1257)', () => {
  let engine;

  beforeEach(() => {
    // Reset engine state before each test
    engine = createFineGrainedConsentEngine();
  });

  afterEach(() => {
    // Clean up any stored state
    if (engine.__testables?.store) {
      engine.__testables.store.clear();
    }
  });

  // -------------------------------------------------------------------------
  // Grant Management Tests
  // -------------------------------------------------------------------------

  describe('Grant Upsertion', () => {
    it('should upsert a consent grant successfully', () => {
      const result = engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      expect(result.granted).toBe(true);
      expect(result.grant).toBeDefined();
      expect(result.grant && result.grant.grantId).toBeDefined();
      expect(result.grant && result.grant.categoryId).toBe('personalization');
      expect(result.grant && result.grant.recipientId).toBe('governmentWelfare');
      expect(result.grant && result.grant.purposeId).toBe('ELIGIBILITY_ASSESSMENT');
      expect(result.grant && result.grant.grantedBy).toBe(TEST_ACTOR);
      expect(result.grant && result.grant.grantedAt).toBeDefined();
      expect(result.grant && result.grant.expiresAt).toBeDefined();
      expect(result.grant && result.grant.revokedAt).toBeNull();
    });

    it('should revoke consent when upserting with granted=false', () => {
      // First grant consent
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      // Now revoke
      const result = engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: false,
        actor: TEST_ACTOR,
      });

      expect(result.granted).toBe(false);
      expect(result.grant && result.grant.revokedAt).toBeDefined();
      // Revocation should trigger propagation
      expect(result.actionTaken).toBe('REVOKE_CONSENT');
    });

    it('should throw for invalid category', () => {
      expect(() => {
        engine.upsertGrant({
          categoryId: 'invalid_category',
          recipientId: 'governmentWelfare',
          purposeId: 'ELIGIBILITY_ASSESSMENT',
          granted: true,
        });
      }).toThrow(/Invalid consent category/);
    });

    it('should throw for invalid purpose', () => {
      expect(() => {
        engine.upsertGrant({
          categoryId: 'personalization',
          recipientId: 'governmentWelfare',
          purposeId: 'INVALID_PURPOSE',
          granted: true,
        });
      }).toThrow(/Invalid purpose/);
    });

    it('should throw for invalid recipient', () => {
      expect(() => {
        engine.upsertGrant({
          categoryId: 'personalization',
          recipientId: '',
          purposeId: 'ELIGIBILITY_ASSESSMENT',
          granted: true,
        });
      }).toThrow(/Invalid recipient/);
    });
  });

  // -------------------------------------------------------------------------
  // Grant Inspection Tests
  // -------------------------------------------------------------------------

  describe('Grant Inspection', () => {
    beforeEach(() => {
      // Set up some initial grants
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      engine.upsertGrant({
        categoryId: 'tracking',
        recipientId: 'serviceProvider',
        purposeId: 'OFFICE_VISIT',
        granted: true,
        actor: TEST_ACTOR,
      });
    });

    it('should find a grant by (category, recipient, purpose)', () => {
      const grant = engine.findGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
      });

      expect(grant).toBeDefined();
      expect(grant && grant.grantId).toBeDefined();
      expect(grant && grant.revokedAt).toBeNull();
    });

    it('should return null for non-existent grant', () => {
      const grant = engine.findGrant({
        categoryId: 'personalization',
        recipientId: 'nonexistent',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
      });

      expect(grant).toBeNull();
    });

    it('should inspect active grants filtered by criteria', () => {
      const active = engine.inspectActiveGrants({
        categoryId: 'personalization',
      });

      expect(active.length).toBe(1);
      expect(active[0].purposeId).toBe('ELIGIBILITY_ASSESSMENT');
    });

    it('should inspect active grants without filters', () => {
      const active = engine.inspectActiveGrants();

      expect(active.length).toBe(2); // Both grants are active
    });

    it('should exclude revoked grants from inspection', () => {
      // Revoke one grant
      engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      const active = engine.inspectActiveGrants();
      expect(active.length).toBe(1); // Only the office visit grant remains
      expect(active[0].purposeId).toBe('OFFICE_VISIT');
    });
  });

  // -------------------------------------------------------------------------
  // Consent Evaluation Tests
  // -------------------------------------------------------------------------

  describe('Consent Evaluation', () => {
    beforeEach(() => {
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });
    });

    it('should evaluate consent as permitted when active grant exists', () => {
      const result = engine.evaluateConsent({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        action: 'read',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(true);
      expect(result.decision).toBe('allow');
      expect(result.code).toBe('CONSENT_ALLOWED');
      expect(result.grant).toBeDefined();
    });

    it('should deny consent when no active grant exists and policy is deny-by-default', () => {
      // Engine starts with deny-by-default; no grant = denied
      const result = engine.evaluateConsent({
        categoryId: 'analytics_telemetry',
        recipientId: 'unknownRecipient',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        action: 'read',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(false);
      expect(result.decision).toBe('deny');
      expect(result.code).toBe('NO_CONSENT_GRANT');
    });

    it('should deny consent when grant is expired', () => {
      // Create a grant with past expiry
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'expiredRecipient',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      // Manually set the grant to expired by modifying the store
      const grantsMap = engine.__testables.store.get('grants');
      if (grantsMap) {
        const grant = grantsMap.get('fg_grant_personalization_expiredRecipient_ELIGIBILITY_ASSESSMENT');
        if (grant) {
          grant.expiresAt = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
          grantsMap.set(grant.grantId, grant);
          engine.__testables.store = { ...engine.__testables.store, grants: grantsMap };
        }
      }

      const result = engine.evaluateConsent({
        categoryId: 'personalization',
        recipientId: 'expiredRecipient',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        action: 'read',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(false);
      expect(result.decision).toBe('deny');
      expect(result.code).toBe('CONSENT_EXPIRED');
    });

    it('should require human approval for system-granted consent on high-impact actions', () => {
      // Upsert a system-granted consent
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'systemRecipient',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: 'system',
      });

      const result = engine.evaluateConsent({
        categoryId: 'personalization',
        recipientId: 'systemRecipient',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        action: 'integrate',
        actor: TEST_ACTOR,
        humanApproved: false,
      });

      expect(result.permitted).toBe(false);
      expect(result.decision).toBe('require_approval');
      expect(result.code).toBe('REQUIRES_HUMAN_APPROVAL');
    });

    it('should allow action when human approval is present', () => {
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'systemRecipient',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: 'system',
      });

      const result = engine.evaluateConsent({
        categoryId: 'personalization',
        recipientId: 'systemRecipient',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        action: 'integrate',
        actor: TEST_ACTOR,
        humanApproved: true,
      });

      expect(result.permitted).toBe(true);
      expect(result.decision).toBe('allow');
    });
  });

  // -------------------------------------------------------------------------
  // Revocation Tests
  // -------------------------------------------------------------------------

  describe('Consent Revocation', () => {
    beforeEach(() => {
      // Set up a grant
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });
    });

    it('should revoke a consent grant successfully', () => {
      const result = engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.success).toBe(true);
      expect(result.grantId).toBeDefined();
      expect(result.revokedAt).toBeDefined();
      expect(result.propagationReceiptId).toBeDefined();
    });

    it('should return failure when revoking non-existent grant', () => {
      const result = engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'nonexistent',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('No active consent grant');
    });

    it('should propagate revocation to downstream consumers', () => {
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'downstreamConsumer',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      const result = engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'downstreamConsumer',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.success).toBe(true);
      expect(result.propagationReceiptId).toBeDefined();
    });

    it('should exclude revoked grants from inspection', () => {
      engine.upsertGrant({
        categoryId: 'tracking',
        recipientId: 'grievanceAuthority',
        purposeId: 'GRIEVANCE_REDRESSAL',
        granted: true,
        actor: TEST_ACTOR,
      });

      // Revoke one grant
      engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      const active = engine.inspectActiveGrants();
      expect(active.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Boundary Enforcement Tests
  // -------------------------------------------------------------------------

  describe('Boundary Enforcement', () => {
    beforeEach(() => {
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });
    });

    it('should enforce read boundary with active consent', () => {
      const result = engine.enforceReadBoundary({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(true);
      expect(result.code).toBe('CONSENT_ALLOWED');
    });

    it('should deny read boundary when no consent grant', () => {
      const result = engine.enforceReadBoundary({
        categoryId: 'analytics_telemetry',
        recipientId: 'unknown',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(false);
      expect(result.code).toBe('NO_CONSENT_GRANT');
    });

    it('should enforce export boundary with active consent', () => {
      const result = engine.enforceExportBoundary({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(true);
    });

    it('should enforce integration boundary with active consent', () => {
      const result = engine.enforceIntegrationBoundary({
        categoryId: 'personalization',
        recipientId: 'governmentWelfare',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Policy Management Tests

  describe('Policy Management', () => {
    it('should upsert a fine-grained consent policy', () => {
      const policy = {
        id: 'test-policy-v1',
        name: 'Test Policy',
        version: 1,
        status: 'ACTIVE',
        denyByDefault: true,
        rules: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = engine.upsertPolicy(policy);
      expect(result.ok).toBe(true);
      expect(result.policy.id).toBe('test-policy-v1');
    });

    it('should find an active policy by ID', () => {
      const policy = {
        id: 'existing-policy-v1',
        name: 'Existing Policy',
        version: 1,
        status: 'ACTIVE',
        denyByDefault: true,
        rules: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      engine.upsertPolicy(policy);
      const found = engine.findPolicy('existing-policy-v1');
      expect(found).toBeDefined();
      expect(found && found.name).toBe('Existing Policy');
    });

    it('should return null for non-active policy', () => {
      const policy = {
        id: 'draft-policy-v1',
        name: 'Draft Policy',
        version: 1,
        status: 'DRAFT',
        denyByDefault: true,
        rules: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      engine.upsertPolicy(policy);
      const found = engine.findPolicy('draft-policy-v1');
      expect(found).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Concurrency & Edge Case Tests

  describe('Concurrency & Edge Cases', () => {
    it('should handle concurrent grant upserts without data loss', async () => {
      // Simulate concurrent upserts
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          engine.upsertGrant({
            categoryId: 'personalization',
            recipientId: `recipient_${i}`,
            purposeId: 'ELIGIBILITY_ASSESSMENT',
            granted: true,
            actor: TEST_ACTOR,
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success);
      expect(succeeded.length).toBe(10);
    });

    it('should handle revocation of non-existent grant gracefully', () => {
      const result = engine.revokeGrant({
        categoryId: 'nonexistentCategory',
        recipientId: 'nonexistent',
        purposeId: 'nonexistentPurpose',
        actor: TEST_ACTOR,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should handle expired grant evaluation', () => {
      // Upsert grant and manually expire it
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'toExpire',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      const grantsMap = engine.__testables.store.get('grants');
      if (grantsMap) {
        const grant = grantsMap.get('fg_grant_personalization_toExpire_ELIGIBILITY_ASSESSMENT');
        if (grant) {
          grant.expiresAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
          grantsMap.set(grant.grantId, grant);
        }
      }

      const result = engine.evaluateConsent({
        categoryId: 'personalization',
        recipientId: 'toExpire',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        action: 'read',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(false);
      expect(result.code).toBe('CONSENT_EXPIRED');
    });

    it('should propagate revocation even when grant already revoked', () => {
      // First revoke
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'doubleRevoke',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'doubleRevoke',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      // Try to revoke again - should still succeed but be idempotent
      const result = engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'doubleRevoke',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Fixture Integration Tests

  describe('Fixture Integration', () => {
    it('should integrate with FG_CONSENT_FIXTURES', () => {
      // Load fixtures into the engine
      const grants = Object.values(FG_CONSENT_FIXTURES);

      for (const fixture of grants) {
        engine.upsertGrant({
          categoryId: fixture.categoryId,
          recipientId: fixture.recipientId,
          purposeId: fixture.purposeId,
          granted: true,
          actor: TEST_ACTOR,
        });
      }

      // Verify all grants are active
      const active = engine.inspectActiveGrants();
      expect(active.length).toBe(grants.length);

      // Verify each fixture grant can be found
      for (const fixture of grants) {
        const found = engine.findGrant({
          categoryId: fixture.categoryId,
          recipientId: fixture.recipientId,
          purposeId: fixture.purposeId,
        });
        expect(found).toBeDefined();
        expect(found && found.revokedAt).toBeNull();
      }
    });

    it('should evaluate consent for fixture grants', () => {
      // Load the eligibility assessment fixture
      const fixture = FG_CONSENT_FIXTURES.eligibilityAssessment;

      engine.upsertGrant({
        categoryId: fixture.categoryId,
        recipientId: fixture.recipientId,
        purposeId: fixture.purposeId,
        granted: true,
        actor: TEST_ACTOR,
      });

      const result = engine.evaluateConsent({
        categoryId: fixture.categoryId,
        recipientId: fixture.recipientId,
        purposeId: fixture.purposeId,
        action: 'read',
        actor: TEST_ACTOR,
      });

      expect(result.permitted).toBe(true);
      expect(result.code).toBe('CONSENT_ALLOWED');
      expect(result.grant).toBeDefined();
    });

    it('should inspect active grants matching fixture patterns', () => {
      // Load all fixtures
      const grants = Object.values(FG_CONSENT_FIXTURES);

      for (const fixture of grants) {
        engine.upsertGrant({
          categoryId: fixture.categoryId,
          recipientId: fixture.recipientId,
          purposeId: fixture.purposeId,
          granted: true,
          actor: TEST_ACTOR,
        });
      }

      // Inspect by category
      const personalizationGrants = engine.inspectActiveGrants({
        categoryId: 'personalization',
      });
      expect(personalizationGrants.length).toBe(1); // eligibilityAssessment

      // Inspect by recipient
      const welfareGrants = engine.inspectActiveGrants({
        recipientId: 'governmentWelfare',
      });
      expect(welfareGrants.length).toBe(1);

      // Inspect by purpose
      const eligibilityGrants = engine.inspectActiveGrants({
        purposeId: 'ELIGIBILITY_ASSESSMENT',
      });
      expect(eligibilityGrants.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Revocation Propagation Tests

  describe('Revocation Propagation', () => {
    it('should record revocation in propagation log', () => {
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'propagationTest',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      const result = engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'propagationTest',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.success).toBe(true);
      // The propagation log should have an entry
      const propLogMap = engine.__testables.store?.get('revocationPropagationLog');
      expect(propLogMap).toBeDefined();
    });

    it('should generate receipt ID on revocation', () => {
      engine.upsertGrant({
        categoryId: 'personalization',
        recipientId: 'receiptTest',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        granted: true,
        actor: TEST_ACTOR,
      });

      const result = engine.revokeGrant({
        categoryId: 'personalization',
        recipientId: 'receiptTest',
        purposeId: 'ELIGIBILITY_ASSESSMENT',
        actor: TEST_ACTOR,
      });

      expect(result.propagationReceiptId).toBeDefined();
      expect(result.propagationReceiptId && result.propagationReceiptId.startsWith('fg_revoke_')).toBe(true);
    });
  });
});