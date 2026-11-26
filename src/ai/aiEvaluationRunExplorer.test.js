import { describe, it, expect, beforeEach } from 'vitest';
import {
  AiEvaluationRunExplorer,
  aggregateRunMetrics,
  compareBenchmarkRuns,
  MIN_STATISTICAL_SAMPLE_SIZE
} from './aiEvaluationRunExplorer.js';

describe('aiEvaluationRunExplorer', () => {
  const sampleTestCases = [
    { testCaseId: 'tc_1', retrievalRecall: 0.9, citationCoverage: 1.0, unsupportedClaimFlag: false, completenessScore: 0.95, latencyMs: 400, language: 'en', intent: 'eligibility', domain: 'ration' },
    { testCaseId: 'tc_2', retrievalRecall: 0.8, citationCoverage: 0.9, unsupportedClaimFlag: false, completenessScore: 0.85, latencyMs: 500, language: 'hi', intent: 'eligibility', domain: 'ration' },
    { testCaseId: 'tc_3', retrievalRecall: 0.7, citationCoverage: 0.8, unsupportedClaimFlag: true, completenessScore: 0.70, latencyMs: 600, language: 'en', intent: 'fee_inquiry', domain: 'voter' }
  ];

  describe('aggregateRunMetrics', () => {
    it('computes accurate means and flags low sample size warning', () => {
      const metrics = aggregateRunMetrics(sampleTestCases);
      expect(metrics.sampleSize).toBe(3);
      expect(metrics.isSampleSizeLow).toBe(true);
      expect(metrics.retrievalRecall).toBe(0.8);
      expect(metrics.citationCoverage).toBe(0.9);
      expect(metrics.unsupportedClaimRate).toBe(0.33);
      expect(metrics.meanLatencyMs).toBe(500);
    });

    it('handles empty runs cleanly with zero values', () => {
      const empty = aggregateRunMetrics([]);
      expect(empty.sampleSize).toBe(0);
      expect(empty.isSampleSizeLow).toBe(true);
      expect(empty.meanLatencyMs).toBe(0);
    });
  });

  describe('compareBenchmarkRuns', () => {
    it('compares baseline and candidate runs and identifies regressed cases', () => {
      const baseline = {
        runId: 'run_baseline',
        testCases: [
          { testCaseId: 'tc_1', retrievalRecall: 0.85, citationCoverage: 0.9, unsupportedClaimFlag: false, completenessScore: 0.9, latencyMs: 450 },
          { testCaseId: 'tc_2', retrievalRecall: 0.80, citationCoverage: 0.85, unsupportedClaimFlag: false, completenessScore: 0.85, latencyMs: 480 }
        ]
      };

      const candidate = {
        runId: 'run_candidate',
        testCases: [
          { testCaseId: 'tc_1', retrievalRecall: 0.95, citationCoverage: 0.95, unsupportedClaimFlag: false, completenessScore: 0.95, latencyMs: 400 },
          { testCaseId: 'tc_2', retrievalRecall: 0.75, citationCoverage: 0.80, unsupportedClaimFlag: true, completenessScore: 0.70, latencyMs: 550 } // Regressed!
        ]
      };

      const comparison = compareBenchmarkRuns(baseline, candidate);
      expect(comparison.baselineRunId).toBe('run_baseline');
      expect(comparison.candidateRunId).toBe('run_candidate');
      expect(comparison.regressedCasesCount).toBe(1);
      expect(comparison.regressedCases[0].testCaseId).toBe('tc_2');
      expect(comparison.deltas.unsupportedDelta).toBeGreaterThan(0);
    });

    it('throws error when baseline or candidate run is missing', () => {
      expect(() => compareBenchmarkRuns(null, {})).toThrow(/requires both baseline and candidate/);
    });
  });

  describe('AiEvaluationRunExplorer', () => {
    let explorer;

    beforeEach(() => {
      explorer = new AiEvaluationRunExplorer();
      explorer.registerRun({
        runId: 'eval_2026_01',
        modelId: 'gemini-1.5-pro',
        promptVersion: 'v2.1',
        testCases: sampleTestCases
      });
    });

    it('retrieves run summary with aggregate metrics', () => {
      const summary = explorer.getRunSummary('eval_2026_01');
      expect(summary.runId).toBe('eval_2026_01');
      expect(summary.modelId).toBe('gemini-1.5-pro');
      expect(summary.metrics.sampleSize).toBe(3);
    });

    it('filters test cases by language, intent, and domain slices', () => {
      const hindiCases = explorer.filterRunCases('eval_2026_01', { language: 'hi' });
      expect(hindiCases.length).toBe(1);
      expect(hindiCases[0].testCaseId).toBe('tc_2');

      const voterCases = explorer.filterRunCases('eval_2026_01', { domain: 'voter' });
      expect(voterCases.length).toBe(1);
      expect(voterCases[0].testCaseId).toBe('tc_3');
    });
  });
});
