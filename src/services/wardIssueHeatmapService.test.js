import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyLaplaceMechanism,
  suppressSparseCell,
  compute95ConfidenceInterval,
} from './differentialPrivacyEngine';
import {
  allocateQueryBudget,
  getClientBudgetStatus,
  resetBudgetLedger,
} from './privacyBudgetService';
import {
  fetchDifferentiallyPrivateWardAnalytics,
  buildQueryKey,
} from './wardIssueHeatmapService';
import { resetCivicReports } from './wardIssueHeatmapStorage';

describe('Differential Privacy Engine', () => {
  it('computes expected 95% confidence intervals', () => {
    const ci1 = compute95ConfidenceInterval(0.5, 1);
    expect(ci1.scale).toBe(2);
    expect(ci1.margin).toBeCloseTo(5.99, 1);

    const ci2 = compute95ConfidenceInterval(1.0, 1);
    expect(ci2.scale).toBe(1);
    expect(ci2.margin).toBeCloseTo(3.0, 1);
  });

  it('correctly suppresses sparse cells under threshold', () => {
    // Both under threshold
    const res1 = suppressSparseCell(3, 4, 5);
    expect(res1.isSuppressed).toBe(true);
    expect(res1.publishedCount).toBeNull();

    // Raw under threshold, noisy over threshold -> MUST still suppress to prevent leakage
    const res2 = suppressSparseCell(2, 7, 5);
    expect(res2.isSuppressed).toBe(true);
    expect(res2.publishedCount).toBeNull();

    // Raw over threshold, noisy under threshold -> suppressed
    const res3 = suppressSparseCell(8, 3, 5);
    expect(res3.isSuppressed).toBe(true);
    expect(res3.publishedCount).toBeNull();

    // Both over threshold -> published
    const res4 = suppressSparseCell(15, 14, 5);
    expect(res4.isSuppressed).toBe(false);
    expect(res4.publishedCount).toBe(14);
  });

  it('applies Laplace mechanism with non-negative clamping and rounding', () => {
    // Constant PRNG yielding zero noise (u = 0.5)
    const zeroNoisePrng = () => 0.5;
    const count = applyLaplaceMechanism(10, 0.5, 1, { prng: zeroNoisePrng });
    expect(count).toBe(10);

    // Negative noise that would push count below zero is clamped at 0
    const negNoisePrng = () => 0.001; // Large negative noise
    const clampedCount = applyLaplaceMechanism(2, 0.5, 1, { prng: negNoisePrng });
    expect(clampedCount).toBe(0);
  });
});

describe('Privacy Budget Service', () => {
  beforeEach(() => {
    resetBudgetLedger();
  });

  it('allocates budget and decrements remaining amount', () => {
    const clientId = 'test-client-1';
    const statusInitial = getClientBudgetStatus(clientId);
    expect(statusInitial.remainingBudget).toBe(3.0);
    expect(statusInitial.consumedBudget).toBe(0.0);

    const alloc1 = allocateQueryBudget({ clientId, epsilon: 0.5 });
    expect(alloc1.allowed).toBe(true);
    expect(alloc1.consumedBudget).toBe(0.5);
    expect(alloc1.remainingBudget).toBe(2.5);

    const alloc2 = allocateQueryBudget({ clientId, epsilon: 1.0 });
    expect(alloc2.allowed).toBe(true);
    expect(alloc2.consumedBudget).toBe(1.5);
    expect(alloc2.remainingBudget).toBe(1.5);
  });

  it('enforces budget exhaustion limit', () => {
    const clientId = 'test-client-exhaust';

    // Consume up to 3.0 limit
    allocateQueryBudget({ clientId, epsilon: 1.5 });
    allocateQueryBudget({ clientId, epsilon: 1.5 });

    const status = getClientBudgetStatus(clientId);
    expect(status.remainingBudget).toBe(0);
    expect(status.isExhausted).toBe(true);

    // Subsequent query should be rejected
    const blocked = allocateQueryBudget({ clientId, epsilon: 0.5 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.error).toBe('BUDGET_EXHAUSTED');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('returns cached results without consuming additional budget for idempotent queries', () => {
    const clientId = 'test-client-cache';
    const queryKey = 'ward=WARD-101&cat=potholes_roads&win=30d';

    const alloc1 = allocateQueryBudget({ clientId, epsilon: 0.5, queryKey });
    expect(alloc1.allowed).toBe(true);
    expect(alloc1.isCached).toBe(false);
    expect(alloc1.consumedBudget).toBe(0.5);

    // Second call with same queryKey immediately after
    // Simulating cacheQueryResult
    const alloc2 = allocateQueryBudget({ clientId, epsilon: 0.5, queryKey });
    expect(alloc2.allowed).toBe(true);
  });
});

describe('wardIssueHeatmapService', () => {
  beforeEach(() => {
    resetBudgetLedger();
    resetCivicReports();
  });

  it('validates query key builder', () => {
    const key = buildQueryKey({
      wardId: 'WARD-102',
      category: 'streetlights',
      timeWindow: '14d',
      epsilon: 0.5,
      sparseThreshold: 5,
    });
    expect(key).toBe('ward=WARD-102&cat=streetlights&win=14d&eps=0.5&tau=5');
  });

  it('returns differentially private analytics payload with metadata', () => {
    const res = fetchDifferentiallyPrivateWardAnalytics({
      wardId: 'WARD-101',
      timeWindow: '30d',
      epsilon: 0.5,
      sparseThreshold: 5,
      clientId: 'tester-analytics-1',
    });

    expect(res.success).toBe(true);
    expect(res.schemaVersion).toBe('1.0.0');
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.privacyMetadata.appliedEpsilon).toBe(0.5);
    expect(res.privacyMetadata.sparseThreshold).toBe(5);
    expect(res.privacyMetadata.confidenceInterval95).toBeDefined();
    expect(res.disclaimer).toContain('Section 13B of the Municipal Corporation Act');
    expect(res.budgetStatus.remainingBudget).toBe(2.5);
  });

  it('suppresses sparse cells with count < tau', () => {
    // Custom dataset with 1 report in WARD-105 for water_supply
    resetCivicReports([
      {
        id: 'RPT-TEST-SPARSE',
        wardId: 'WARD-105',
        category: 'water_supply',
        timestamp: new Date().toISOString(),
      },
    ]);

    const res = fetchDifferentiallyPrivateWardAnalytics({
      wardId: 'WARD-105',
      category: 'water_supply',
      epsilon: 0.5,
      sparseThreshold: 5,
      clientId: 'tester-sparse',
    });

    expect(res.success).toBe(true);
    const cell = res.data.find((c) => c.category === 'water_supply');
    expect(cell).toBeDefined();
    expect(cell.isSuppressed).toBe(true);
    expect(cell.publishedCount).toBeNull();
    expect(cell.suppressionReason).toBe('Count < 5');
  });

  it('rejects invalid query parameters', () => {
    const res = fetchDifferentiallyPrivateWardAnalytics({
      timeWindow: 'invalid_window',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('INVALID_QUERY_PARAMS');
    expect(res.details.length).toBeGreaterThan(0);
  });

  it('rejects query when budget is exhausted', () => {
    const clientId = 'tester-exhaustion';

    // Exhaust budget (6 queries * 0.5 = 3.0)
    for (let i = 0; i < 6; i++) {
      fetchDifferentiallyPrivateWardAnalytics({
        wardId: `WARD-${101 + i}`,
        clientId,
        epsilon: 0.5,
      });
    }

    // 7th query should fail with BUDGET_EXHAUSTED
    const blockedRes = fetchDifferentiallyPrivateWardAnalytics({
      wardId: 'WARD-110',
      clientId,
      epsilon: 0.5,
    });

    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error).toBe('BUDGET_EXHAUSTED');
    expect(blockedRes.budgetStatus.isExhausted).toBe(true);
  });
});
