/**
 * @file Tenant Runtime Tests
 *
 * Covers feature flags, SLO metrics, transient retry/backoff,
 * and backward-compatibility for unpartitioned legacy records.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTenantFeatureFlags,
  tenantMetrics,
  TENANT_SLO_TARGETS,
  isTransientTenantError,
  withTenantRetry,
  isLegacyUnpartitionedDoc,
  allowLegacyUnpartitionedRead,
} from './tenantRuntime.js';

describe('Tenant Runtime (Flags, Metrics, Retries, Backward Compat)', () => {
  beforeEach(() => {
    tenantMetrics.reset();
    vi.restoreAllMocks();
  });

  describe('Feature Flags', () => {
    it('defaults to fail-closed isolationEnabled=true and strictMode=true', () => {
      const flags = getTenantFeatureFlags();
      expect(flags.isolationEnabled).toBe(true);
      expect(flags.strictMode).toBe(true);
      expect(flags.maxPageSize).toBe(100);
      expect(flags.retryMaxAttempts).toBe(3);
    });

    it('supports explicit overrides for safe staged rollout', () => {
      const flags = getTenantFeatureFlags({
        isolationEnabled: true,
        strictMode: false,
      });
      expect(flags.isolationEnabled).toBe(true);
      expect(flags.strictMode).toBe(false);
    });
  });

  describe('Metrics & SLO Evaluation', () => {
    it('tracks auth outcomes, queries, and retries', () => {
      tenantMetrics.recordAuthOutcome({ allowed: true, code: 'AUTHORIZED', durationMs: 1.2 });
      tenantMetrics.recordAuthOutcome({ allowed: false, code: 'TENANT_ACCESS_DENIED', durationMs: 0.8 });
      tenantMetrics.recordQuery({ durationMs: 20, error: false });
      tenantMetrics.recordRetry();

      const snap = tenantMetrics.getSnapshot();
      expect(snap.counters.authAllowedTotal).toBe(1);
      expect(snap.counters.authDeniedTotal).toBe(1);
      expect(snap.counters.crossTenantDeniedTotal).toBe(1);
      expect(snap.counters.queryTotal).toBe(1);
      expect(snap.counters.retryAttemptsTotal).toBe(1);
      expect(snap.latencies.queryP99Ms).toBe(20);
    });

    it('reports healthy when within SLO targets and detects violations', () => {
      tenantMetrics.recordQuery({ durationMs: 50, error: false });
      expect(tenantMetrics.evaluateSlos().healthy).toBe(true);

      tenantMetrics.recordQuery({ durationMs: TENANT_SLO_TARGETS.queryP99Ms + 100, error: true });
      const evaluation = tenantMetrics.evaluateSlos();
      expect(evaluation.healthy).toBe(false);
      expect(evaluation.violations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Retry & Backoff', () => {
    it('retries transient errors and succeeds', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce({ code: 'unavailable', message: 'Service unavailable' })
        .mockResolvedValueOnce('ok');

      const result = await withTenantRetry(op, { maxAttempts: 3, baseDelayMs: 1 });
      expect(result).toBe('ok');
      expect(op).toHaveBeenCalledTimes(2);
      expect(tenantMetrics.getSnapshot().counters.retryAttemptsTotal).toBe(1);
    });

    it('does not retry deterministic authorization or permission errors', async () => {
      const op = vi.fn().mockRejectedValue(new Error('TENANT_ACCESS_DENIED: forbidden'));

      await expect(withTenantRetry(op, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(
        'TENANT_ACCESS_DENIED'
      );
      expect(op).toHaveBeenCalledTimes(1);
      expect(isTransientTenantError({ code: 'permission-denied' })).toBe(false);
    });
  });

  describe('Backward Compatibility (Unpartitioned Legacy Records)', () => {
    it('fails closed in strictMode and allows fallback only when strictMode=false', () => {
      const legacyDoc = { id: 'legacy-1', title: 'Old record' };
      const partitionedDoc = { id: 'part-1', tenantId: 'STATE:IN-KA' };

      expect(isLegacyUnpartitionedDoc(legacyDoc)).toBe(true);
      expect(isLegacyUnpartitionedDoc(partitionedDoc)).toBe(false);

      expect(allowLegacyUnpartitionedRead(legacyDoc, { strictMode: true })).toBe(false);
      expect(allowLegacyUnpartitionedRead(legacyDoc, { strictMode: false })).toBe(true);
      expect(allowLegacyUnpartitionedRead(partitionedDoc, { strictMode: false })).toBe(false);
      expect(tenantMetrics.getSnapshot().counters.legacyFallbackReadsTotal).toBe(1);
    });
  });
});
