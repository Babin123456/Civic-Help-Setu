/**
 * src/services/civicRecommendationExperimentationEngine.test.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRecommendationExperimentationEngine } from './civicRecommendationExperimentationEngine.js';
import {
  createSeedStore
} from './civicRecommendationExperimentationMigrations.js';
import {
  EXPERIMENT_STATUS,
  EXPERIMENTATION_ERRORS
} from '../data/civicRecommendationExperimentationConstants.js';

describe('civicRecommendationExperimentationEngine', () => {
  let mockStore;
  let engine;

  beforeEach(() => {
    mockStore = createSeedStore({ now: '2026-11-25T10:00:00Z' });
    engine = createRecommendationExperimentationEngine({
      loadStore: () => mockStore,
      persistStore: (updated) => {
        mockStore = updated;
        return updated;
      }
    });
  });

  describe('Validation & Prohibited Attribute Screening', () => {
    it('validates request shapes and rejects non-objects', () => {
      const res = engine.validateRequest('not an object');
      expect(res.valid).toBe(false);
      expect(res.errors[0].code).toBe(EXPERIMENTATION_ERRORS.INVALID_TYPE);
    });

    it('rejects prohibited targeting attributes like caste and religion', () => {
      const res = engine.validateRequest({
        experimentId: 'exp-test',
        context: { caste: 'general', userAge: 30 }
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0].code).toBe(EXPERIMENTATION_ERRORS.PROHIBITED_ATTRIBUTE_TARGETING);
    });

    it('rejects prohibited biometric and identity attributes like aadhaar and pan', () => {
      const res = engine.validateRequest({
        experimentId: 'exp-test',
        audienceCriteria: { hasAadhaarNumber: true }
      });
      expect(res.valid).toBe(false);
      expect(res.errors[0].code).toBe(EXPERIMENTATION_ERRORS.PROHIBITED_ATTRIBUTE_TARGETING);
    });

    it('accepts safe non-sensitive attributes like preferred language and device type', () => {
      const res = engine.validateRequest({
        experimentId: 'exp-test',
        context: { preferredLanguage: 'hi', deviceType: 'mobile', regionCode: 'UP-LKO' }
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('Experiment Lifecycle & Upsert', () => {
    it('upserts a new experiment and creates audit trail', () => {
      const expData = {
        id: 'exp-ranking-test',
        name: 'Ranking Weights Experiment',
        description: 'Test document weights vs speed',
        status: EXPERIMENT_STATUS.ACTIVE,
        variants: [
          { id: 'control', name: 'Baseline', weight: 50 },
          { id: 'speed-first', name: 'Speed First', weight: 50 }
        ],
        optInRequired: true
      };

      const res = engine.upsertExperiment(expData);
      expect(res.ok).toBe(true);
      expect(res.experiment.id).toBe('exp-ranking-test');

      const fetched = engine.getExperiment('exp-ranking-test');
      expect(fetched).toBeDefined();
      expect(fetched.name).toBe('Ranking Weights Experiment');

      const audit = engine.getAuditLog();
      expect(audit.some((a) => a.entityId === 'exp-ranking-test')).toBe(true);
    });

    it('rejects invalid experiment IDs or empty variants', () => {
      const res1 = engine.upsertExperiment({ id: 'INVALID_UPPERCASE', name: 'Bad' });
      expect(res1.ok).toBe(false);

      const res2 = engine.upsertExperiment({ id: 'exp-bad', name: 'Bad', variants: [] });
      expect(res2.ok).toBe(false);
    });

    it('lists all active and draft experiments', () => {
      const list = engine.listExperiments();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].id).toBe('exp-service-discovery-v1');
    });
  });

  describe('Deterministic Variant Assignment', () => {
    it('consistently assigns the exact same variant for the same citizen and experiment', () => {
      const citizenA = 'citizen-12345';
      const citizenB = 'citizen-98765';

      const resA1 = engine.assignVariant({
        experimentId: 'exp-service-discovery-v1',
        citizenId: citizenA,
        optIn: true
      });
      const resA2 = engine.assignVariant({
        experimentId: 'exp-service-discovery-v1',
        citizenId: citizenA,
        optIn: true
      });

      expect(resA1.assigned).toBe(true);
      expect(resA1.variant.id).toBe(resA2.variant.id);
      expect(resA1.bucket).toBe(resA2.bucket);

      // Verify assignment across multiple runs remains consistent
      const resB1 = engine.assignVariant({
        experimentId: 'exp-service-discovery-v1',
        citizenId: citizenB,
        optIn: true
      });
      const resB2 = engine.assignVariant({
        experimentId: 'exp-service-discovery-v1',
        citizenId: citizenB,
        optIn: true
      });
      expect(resB1.variant.id).toBe(resB2.variant.id);
    });

    it('falls back to control when opt-in is required but user has not opted in', () => {
      const res = engine.assignVariant({
        experimentId: 'exp-service-discovery-v1',
        citizenId: 'user-no-optin',
        optIn: false
      });
      expect(res.assigned).toBe(false);
      expect(res.reason).toBe('opt_in_required');
      expect(res.variant.id).toBe('control');
    });

    it('routes to control when experiment is paused or rolled back', () => {
      engine.rollbackExperiment({
        experimentId: 'exp-service-discovery-v1',
        reason: 'Emergency safety concern'
      });

      const res = engine.assignVariant({
        experimentId: 'exp-service-discovery-v1',
        citizenId: 'user-test',
        optIn: true
      });
      expect(res.assigned).toBe(false);
      expect(res.reason).toBe('experiment_rolled_back');
      expect(res.variant.id).toBe('control');
    });
  });

  describe('Metrics & Guardrail Breach Detection', () => {
    it('aggregates metrics safely without citizen identification', () => {
      const res = engine.recordMetric({
        experimentId: 'exp-service-discovery-v1',
        variantId: 'control',
        relevanceScore: 0.95,
        hasLanguageCoverage: true,
        isError: false
      });

      expect(res.ok).toBe(true);
      expect(res.metrics.assignments).toBe(1);
      expect(res.metrics.relevanceSum).toBe(0.95);
      expect(res.breaches.length).toBe(0);
    });

    it('triggers a guardrail breach when error rate exceeds threshold', () => {
      // Record multiple failures
      engine.recordMetric({
        experimentId: 'exp-service-discovery-v1',
        variantId: 'control',
        relevanceScore: 0.20,
        hasLanguageCoverage: false,
        isError: true
      });
      const res2 = engine.recordMetric({
        experimentId: 'exp-service-discovery-v1',
        variantId: 'control',
        relevanceScore: 0.10,
        hasLanguageCoverage: false,
        isError: true
      });

      expect(res2.breaches.length).toBeGreaterThan(0);
      const breachTypes = res2.breaches.map((b) => b.type);
      expect(breachTypes).toContain('max_error_rate');
      expect(breachTypes).toContain('min_relevance');
      expect(breachTypes).toContain('min_language_coverage');
    });

    it('enforces minimum cohort size protection before computing conclusions', () => {
      const metrics = engine.getExperimentMetrics('exp-service-discovery-v1');
      expect(metrics.variants.control.cohortSizeMet).toBe(false);
      expect(metrics.minCohortSize).toBeGreaterThanOrEqual(10);
    });

    it('supports immediate rollback by maintainers', () => {
      const rollbackRes = engine.rollbackExperiment({
        experimentId: 'exp-service-discovery-v1',
        reason: 'High error rate detected in treatment group',
        actorId: 'admin-sec'
      });

      expect(rollbackRes.ok).toBe(true);
      expect(rollbackRes.experiment.status).toBe(EXPERIMENT_STATUS.ROLLED_BACK);
      expect(rollbackRes.experiment.rollbackReason).toContain('High error rate');

      const audit = engine.getAuditLog();
      expect(audit[0].action).toBe('experiment.rollback');
    });
  });
});
