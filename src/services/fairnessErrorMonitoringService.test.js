import { describe, it, expect } from 'vitest';
import {
  calculateRecallAtK,
  calculateNdcgAtK,
  calculateCalibrationScore,
  validateUnbiasedSignals,
  evaluateFairnessAndPerformance,
  checkModelReleaseSafetyGate,
} from './fairnessErrorMonitoringService.js';

describe('Fairness and Error-Monitoring Framework for Civic Recommendation', () => {
  it('calculates Recall@k and nDCG@k correctly', () => {
    const ranked = ['doc-1', 'doc-2', 'doc-3', 'doc-4', 'doc-5'];
    const relevant = ['doc-2', 'doc-5'];

    const recall = calculateRecallAtK(ranked, relevant, 5);
    expect(recall).toBe(1.0);

    const ndcg = calculateNdcgAtK(ranked, relevant, 5);
    expect(ndcg).toBeGreaterThan(0.6);
  });

  it('rejects evaluation instances containing protected attributes', () => {
    const biasedItem = {
      query: 'apply for housing',
      religion: 'hindu', // Prohibited attribute
      relevantServiceIds: ['pmay-1'],
    };

    expect(() => validateUnbiasedSignals(biasedItem)).toThrow(/Protected attribute 'religion' detected/);
  });

  it('computes calibration score accurately', () => {
    const preds = [
      { confidence: 0.9, isAccurate: true }, // error: 0.01
      { confidence: 0.8, isAccurate: true }, // error: 0.04
      { confidence: 0.7, isAccurate: false }, // error: 0.49
    ];

    const score = calculateCalibrationScore(preds);
    expect(score).toBeGreaterThan(0.1);
    expect(score).toBeLessThan(0.3);
  });

  it('evaluates disparity ratio across regional cohorts', () => {
    const evaluationSet = [
      { cohort: 'URBAN_HIGH_BANDWIDTH', query: 'dl renewal', relevantServiceIds: ['dl-1'] },
      { cohort: 'URBAN_HIGH_BANDWIDTH', query: 'ration card', relevantServiceIds: ['pds-1'] },
      { cohort: 'RURAL_LOW_CONNECTIVITY', query: 'kisan samman', relevantServiceIds: ['kisan-1'] },
      { cohort: 'RURAL_LOW_CONNECTIVITY', query: 'ration transfer', relevantServiceIds: ['pds-1'] },
    ];

    const mockRanker = (q) => {
      if (q.includes('dl')) return [{ id: 'dl-1', score: 0.95 }];
      if (q.includes('ration')) return [{ id: 'pds-1', score: 0.9 }];
      if (q.includes('kisan')) return [{ id: 'kisan-1', score: 0.88 }];
      return [];
    };

    const metrics = evaluateFairnessAndPerformance(evaluationSet, mockRanker, 5);

    expect(metrics.evaluatedSamples).toBe(4);
    expect(metrics.cohortBreakdown['URBAN_HIGH_BANDWIDTH'].avgRecallAtK).toBe(1.0);
    expect(metrics.cohortBreakdown['RURAL_LOW_CONNECTIVITY'].avgRecallAtK).toBe(1.0);
    expect(metrics.disparityRatio).toBe(1.0);
  });

  it('blocks deployment when safety thresholds or parity ratio regress', () => {
    const poorMetrics = {
      disparityRatio: 0.65, // Below minimum 0.80
      overallAbstentionRate: 0.4, // Above max 0.35
      cohortBreakdown: {
        RURAL_LOW_CONNECTIVITY: { avgRecallAtK: 0.5 }, // Below 0.65
        URBAN_HIGH_BANDWIDTH: { avgRecallAtK: 0.9 },
      },
    };

    const gate = checkModelReleaseSafetyGate(poorMetrics);
    expect(gate.passed).toBe(false);
    expect(gate.action).toBe('BLOCK_RELEASE_AND_ROLLBACK');
    expect(gate.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('permits deployment when all equity and quality thresholds pass', () => {
    const healthyMetrics = {
      disparityRatio: 0.92,
      overallAbstentionRate: 0.05,
      cohortBreakdown: {
        RURAL_LOW_CONNECTIVITY: { avgRecallAtK: 0.85 },
        URBAN_HIGH_BANDWIDTH: { avgRecallAtK: 0.92 },
      },
    };

    const gate = checkModelReleaseSafetyGate(healthyMetrics);
    expect(gate.passed).toBe(true);
    expect(gate.action).toBe('PROCEED_DEPLOYMENT');
    expect(gate.violations.length).toBe(0);
  });
});
