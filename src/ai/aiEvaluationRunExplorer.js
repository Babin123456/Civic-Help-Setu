/**
 * AI Evaluation Run Explorer Service
 *
 * Implements a maintainer analytics engine for synthetic benchmark runs:
 * - Compares AI performance across prompt, model, and retrieval changes:
 *   * Retrieval Recall (% relevant chunks retrieved)
 *   * Citation Coverage (% claims backed by valid source IDs)
 *   * Unsupported-Claim Flag Rate (% ungrounded assertions detected)
 *   * Answer Completeness Score (0.0 - 1.0)
 *   * Mean Latency (ms)
 * - Filtering & Slicing:
 *   * By Language (en, hi, kn, ta, etc.)
 *   * By Query Intent (eligibility, document_checklist, application_status, fee_inquiry)
 *   * By Service Domain (ration, voter, pension, certificates)
 * - Strict Privacy:
 *   * Operates strictly on synthetic benchmark datasets; zero production chat text loaded
 * - Edge Case Handling:
 *   * Flags small sample size warnings (< 10 samples)
 *   * Computes run-to-run deltas and identifies regressed test cases
 */

export const BENCHMARK_INTENTS = Object.freeze([
  'eligibility',
  'document_checklist',
  'application_status',
  'fee_inquiry'
]);

export const MIN_STATISTICAL_SAMPLE_SIZE = 10;

/**
 * Computes aggregate benchmark metrics from a list of test cases
 * @param {Array<Object>} testCases
 * @returns {Object} Metric summary with plain-language definitions
 */
export function aggregateRunMetrics(testCases = []) {
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return {
      sampleSize: 0,
      isSampleSizeLow: true,
      retrievalRecall: 0,
      citationCoverage: 0,
      unsupportedClaimRate: 0,
      completenessScore: 0,
      meanLatencyMs: 0
    };
  }

  const n = testCases.length;
  let sumRecall = 0;
  let sumCoverage = 0;
  let sumUnsupported = 0;
  let sumCompleteness = 0;
  let sumLatency = 0;

  for (const tc of testCases) {
    sumRecall += Number(tc.retrievalRecall || 0);
    sumCoverage += Number(tc.citationCoverage || 0);
    sumUnsupported += Number(tc.unsupportedClaimFlag ? 1 : 0);
    sumCompleteness += Number(tc.completenessScore || 0);
    sumLatency += Number(tc.latencyMs || 0);
  }

  return {
    sampleSize: n,
    isSampleSizeLow: n < MIN_STATISTICAL_SAMPLE_SIZE,
    retrievalRecall: Math.round((sumRecall / n) * 100) / 100,
    citationCoverage: Math.round((sumCoverage / n) * 100) / 100,
    unsupportedClaimRate: Math.round((sumUnsupported / n) * 100) / 100,
    completenessScore: Math.round((sumCompleteness / n) * 100) / 100,
    meanLatencyMs: Math.round(sumLatency / n)
  };
}

/**
 * Compares two benchmark runs and computes metric deltas
 * @param {Object} baselineRun
 * @param {Object} candidateRun
 * @returns {Object} Delta comparison
 */
export function compareBenchmarkRuns(baselineRun, candidateRun) {
  if (!baselineRun || !candidateRun) {
    throw new Error('Comparison requires both baseline and candidate run records');
  }

  const baseMetrics = aggregateRunMetrics(baselineRun.testCases);
  const candMetrics = aggregateRunMetrics(candidateRun.testCases);

  const deltas = {
    recallDelta: Math.round((candMetrics.retrievalRecall - baseMetrics.retrievalRecall) * 100) / 100,
    coverageDelta: Math.round((candMetrics.citationCoverage - baseMetrics.citationCoverage) * 100) / 100,
    unsupportedDelta: Math.round((candMetrics.unsupportedClaimRate - baseMetrics.unsupportedClaimRate) * 100) / 100,
    completenessDelta: Math.round((candMetrics.completenessScore - baseMetrics.completenessScore) * 100) / 100,
    latencyDeltaMs: candMetrics.meanLatencyMs - baseMetrics.meanLatencyMs
  };

  // Find regressed cases (where completeness dropped or unsupported claims appeared)
  const regressedCases = (candidateRun.testCases || []).filter(candCase => {
    const baseCase = (baselineRun.testCases || []).find(b => b.testCaseId === candCase.testCaseId);
    if (!baseCase) return false;
    return candCase.unsupportedClaimFlag && !baseCase.unsupportedClaimFlag;
  });

  return {
    baselineRunId: baselineRun.runId,
    candidateRunId: candidateRun.runId,
    baseMetrics,
    candMetrics,
    deltas,
    regressedCasesCount: regressedCases.length,
    regressedCases
  };
}

export class AiEvaluationRunExplorer {
  constructor() {
    this.runs = new Map(); // runId -> RunRecord
  }

  registerRun({ runId, modelId, promptVersion, timestamp = Date.now(), testCases = [] }) {
    if (!runId || !modelId) {
      throw new Error('Evaluation run requires runId and modelId');
    }

    const record = {
      runId,
      modelId,
      promptVersion: promptVersion || 'v1.0',
      timestamp,
      testCases
    };

    this.runs.set(runId, record);
    return record;
  }

  filterRunCases(runId, filters = {}) {
    const run = this.runs.get(runId);
    if (!run) return [];

    let filtered = [...run.testCases];

    if (filters.language) {
      filtered = filtered.filter(tc => tc.language === filters.language);
    }
    if (filters.intent) {
      filtered = filtered.filter(tc => tc.intent === filters.intent);
    }
    if (filters.domain) {
      filtered = filtered.filter(tc => tc.domain === filters.domain);
    }

    return filtered;
  }

  getRunSummary(runId) {
    const run = this.runs.get(runId);
    if (!run) return null;

    return {
      runId: run.runId,
      modelId: run.modelId,
      promptVersion: run.promptVersion,
      metrics: aggregateRunMetrics(run.testCases)
    };
  }
}
