import { describe, it, expect, beforeEach } from 'vitest';
import {
  sampleLaplaceNoise,
  applyLaplaceMechanism,
  suppressSparseCell,
} from './differentialPrivacyEngine';
import {
  allocateQueryBudget,
  resetBudgetLedger,
} from './privacyBudgetService';
import {
  createNeighboringProbeDatasets,
  createMulberryPrng,
} from '../test/fixtures/wardAnalyticsFixtures';

describe('Differential Privacy Adversarial & Statistical Evaluation Suite (#1163)', () => {
  beforeEach(() => {
    resetBudgetLedger();
  });

  /**
   * EVALUATION 1: Mathematical Laplace Invariant
   * Verifies that the noise generator conforms to zero-mean and expected variance Var = 2 * (scale^2).
   */
  it('conforms to theoretical Laplace distribution mean and variance', () => {
    const epsilon = 0.5;
    const sensitivity = 1;
    const scale = sensitivity / epsilon; // 2.0
    const theoreticalVariance = 2 * scale * scale; // 8.0

    const prng = createMulberryPrng(42);
    const N = 10000;
    let sum = 0;
    let sumSq = 0;

    for (let i = 0; i < N; i++) {
      const noise = sampleLaplaceNoise(scale, prng);
      sum += noise;
      sumSq += noise * noise;
    }

    const sampleMean = sum / N;
    const sampleVariance = (sumSq / N) - (sampleMean * sampleMean);

    // Mean should be near 0 (within 0.1)
    expect(Math.abs(sampleMean)).toBeLessThan(0.1);
    // Variance should be near 8.0 (within 0.7)
    expect(Math.abs(sampleVariance - theoreticalVariance)).toBeLessThan(0.7);
  });

  /**
   * EVALUATION 2: Small-Cohort Leakage & Suppression
   * Verifies that sensitive cells with low complaints (< tau) are NEVER published.
   */
  it('guarantees complete suppression for small cohorts (< tau)', () => {
    const tau = 5;
    const sparseRawCounts = [0, 1, 2, 3, 4];
    const prng = createMulberryPrng(99);

    sparseRawCounts.forEach((raw) => {
      // Test across 100 random noise draws
      for (let trial = 0; trial < 100; trial++) {
        const noisy = applyLaplaceMechanism(raw, 0.5, 1, { prng });
        const { isSuppressed, publishedCount } = suppressSparseCell(raw, noisy, tau);

        // Invariant: If raw count < tau, cell MUST be suppressed regardless of noisy count
        expect(isSuppressed).toBe(true);
        expect(publishedCount).toBeNull();
      }
    });
  });

  /**
   * EVALUATION 3: Membership Inference Attack (MIA) Simulation
   * Simulates an attacker with prior knowledge attempting to infer if a specific household record
   * is present in D1 vs absent in D0.
   */
  it('bounds empirical membership inference attack advantage under epsilon=0.5', () => {
    const { d0, d1 } = createNeighboringProbeDatasets();
    const epsilon = 0.5;
    const prng = createMulberryPrng(777);

    // D0 ground truth count in WARD-115 public_health is 0
    // D1 ground truth count in WARD-115 public_health is 1 (probe present)
    const countD0 = d0.filter((r) => r.wardId === 'WARD-115' && r.category === 'public_health').length;
    const countD1 = d1.filter((r) => r.wardId === 'WARD-115' && r.category === 'public_health').length;

    expect(countD0).toBe(0);
    expect(countD1).toBe(1);

    // The attacker tries a decision rule: does published output reveal probe?
    // Since both 0 and 1 are below tau = 5, sparse suppression returns null on both!
    const resD0 = suppressSparseCell(countD0, applyLaplaceMechanism(countD0, epsilon, 1, { prng }), 5);
    const resD1 = suppressSparseCell(countD1, applyLaplaceMechanism(countD1, epsilon, 1, { prng }), 5);

    // Output is completely indistinguishable: both null!
    expect(resD0.publishedCount).toBeNull();
    expect(resD1.publishedCount).toBeNull();
    expect(resD0.isSuppressed).toBe(true);
    expect(resD1.isSuppressed).toBe(true);

    // Now test MIA without suppression (e.g. for medium cohort 20 vs 21):
    const countBase = 20;
    const countWithProbe = 21;
    let falsePositives = 0; // Guessing D1 when data is D0
    let truePositives = 0;  // Guessing D1 when data is D1
    const trials = 500;

    for (let t = 0; t < trials; t++) {
      const noisy0 = applyLaplaceMechanism(countBase, epsilon, 1, { prng });
      const noisy1 = applyLaplaceMechanism(countWithProbe, epsilon, 1, { prng });

      // Optimal likelihood threshold for Gaussian/Laplace hypothesis testing: threshold = 20.5
      if (noisy0 >= 21) falsePositives++;
      if (noisy1 >= 21) truePositives++;
    }

    const fpr = falsePositives / trials;
    const tpr = truePositives / trials;
    const attackAdvantage = Math.abs(tpr - fpr);

    // Theoretical maximum advantage for epsilon=0.5 is e^0.5 - 1 ~ 0.648
    // In practice with discrete Laplace rounding, advantage is <= 0.35
    expect(attackAdvantage).toBeLessThan(0.35);
  });

  /**
   * EVALUATION 4: Repeated-Query Database Reconstruction Resistance
   * Verifies that the Privacy Budget Ledger prevents an attacker from issuing multiple queries
   * to average out noise and reconstruct ground truth.
   */
  it('halts repeated-query reconstruction attack via budget exhaustion', () => {
    const clientId = 'attacker-recon-session';
    const trueCount = 27;
    const samples = [];

    // Attacker attempts 20 repeated queries with epsilon=0.5
    let queriesAllowed = 0;
    let queriesBlocked = 0;

    for (let i = 0; i < 20; i++) {
      const decision = allocateQueryBudget({
        clientId,
        epsilon: 0.5,
        queryKey: `recon-query-attempt-${i}`, // varied keys to bypass cache
      });

      if (decision.allowed) {
        queriesAllowed++;
        samples.push(applyLaplaceMechanism(trueCount, 0.5, 1));
      } else {
        queriesBlocked++;
        expect(decision.error).toBe('BUDGET_EXHAUSTED');
      }
    }

    // Must allow only 6 queries (6 * 0.5 = 3.0 budget limit)
    expect(queriesAllowed).toBe(6);
    expect(queriesBlocked).toBe(14);

    // With only 6 noisy samples, standard error of the mean is scale / sqrt(6) = 2.0 / 2.45 ~ 0.82
    // Reconstruction cannot achieve exact deterministic convergence
    expect(samples.length).toBe(6);
  });

  /**
   * EVALUATION 5: Utility vs. Privacy Trade-off Analysis
   * Verifies that Mean Absolute Error (MAE) decreases monotonically as epsilon increases.
   */
  it('empirically verifies monotonic utility improvement as epsilon increases', () => {
    const testCounts = [15, 25, 40, 60, 100];
    const epsilons = [0.2, 0.5, 1.0, 2.0];
    const prng = createMulberryPrng(888);
    const errorMetrics = [];

    epsilons.forEach((eps) => {
      let totalAbsError = 0;
      const runs = 200;

      for (let r = 0; r < runs; r++) {
        testCounts.forEach((cnt) => {
          const noisy = applyLaplaceMechanism(cnt, eps, 1, { prng });
          totalAbsError += Math.abs(noisy - cnt);
        });
      }

      const mae = totalAbsError / (runs * testCounts.length);
      errorMetrics.push({ epsilon: eps, mae });
    });

    // Verify monotonic decrease: MAE(0.2) > MAE(0.5) > MAE(1.0) > MAE(2.0)
    for (let i = 0; i < errorMetrics.length - 1; i++) {
      expect(errorMetrics[i].mae).toBeGreaterThan(errorMetrics[i + 1].mae);
    }
  });
});
