import { describe, it, expect } from 'vitest';
import {
  computeRetrievalMetrics,
  computeCitationMetrics,
  OfflineRagBenchmarkHarness,
  GOLDEN_RAG_BENCHMARK_DATASET,
} from './offlineRagBenchmarkService';

describe('Offline RAG Evaluation and Regression Benchmark (#613)', () => {
  it('accurately computes Rank, MRR, Recall, and NDCG for Top-1 hit', () => {
    const mockResults = [
      { serviceId: 'aadhaar-update', score: 0.9 },
      { serviceId: 'driving-licence', score: 0.7 },
    ];

    const metrics = computeRetrievalMetrics(mockResults, 'aadhaar-update', 5);
    expect(metrics.hit).toBe(true);
    expect(metrics.rank).toBe(1);
    expect(metrics.recall).toBe(1.0);
    expect(metrics.mrr).toBe(1.0);
    expect(metrics.ndcg).toBe(1.0);
  });

  it('accurately computes metrics for lower rank hits (Rank 2)', () => {
    const mockResults = [
      { serviceId: 'other-service', score: 0.9 },
      { serviceId: 'driving-licence-renewal', score: 0.8 },
    ];

    const metrics = computeRetrievalMetrics(mockResults, 'driving-licence-renewal', 5);
    expect(metrics.hit).toBe(true);
    expect(metrics.rank).toBe(2);
    expect(metrics.mrr).toBe(0.5);
    expect(metrics.ndcg).toBe(Number((1.0 / Math.log2(3)).toFixed(4)));
  });

  it('evaluates complete benchmark suite with latency percentiles', async () => {
    const harness = new OfflineRagBenchmarkHarness();

    // Mock high-performing retriever
    const mockRetriever = async ({ query }) => {
      if (query.includes('Aadhaar')) {
        return { results: [{ serviceId: 'aadhaar-update' }] };
      }
      if (query.includes('driving licence')) {
        return { results: [{ serviceId: 'driving-licence-renewal' }] };
      }
      if (query.includes('pension')) {
        return { results: [{ serviceId: 'old-age-pension-mh' }] };
      }
      if (query.includes('mutation')) {
        return { results: [{ serviceId: 'land-mutation' }] };
      }
      return { results: [] }; // Correctly declines Mars question
    };

    const report = await harness.evaluateRetriever(mockRetriever);
    expect(report.summary.evaluatedCount).toBe(GOLDEN_RAG_BENCHMARK_DATASET.length);
    expect(report.summary.meanRecall).toBeGreaterThanOrEqual(0.8);
    expect(report.summary.meanMrr).toBeGreaterThanOrEqual(0.8);
    expect(report.summary.latencyP50).toBeDefined();
    expect(report.summary.latencyP95).toBeDefined();
  });

  it('detects and blocks regressions when candidate drops below baseline tolerance', () => {
    const harness = new OfflineRagBenchmarkHarness();

    const baseline = { meanNdcg: 0.85, meanMrr: 0.82, meanRecall: 0.90 };
    const regressedCandidate = { meanNdcg: 0.75, meanMrr: 0.70, meanRecall: 0.80 }; // Severe drop
    const improvedCandidate = { meanNdcg: 0.88, meanMrr: 0.85, meanRecall: 0.92 };

    const checkBad = harness.checkRegression({
      candidateSummary: regressedCandidate,
      baselineSummary: baseline,
      maxAllowedDrop: 0.02,
    });
    expect(checkBad.passed).toBe(false);
    expect(checkBad.decision).toContain('CI BLOCKED');

    const checkGood = harness.checkRegression({
      candidateSummary: improvedCandidate,
      baselineSummary: baseline,
      maxAllowedDrop: 0.02,
    });
    expect(checkGood.passed).toBe(true);
    expect(checkGood.decision).toContain('CI PASSED');
  });

  it('validates schema integrity of the golden benchmark dataset', () => {
    for (const item of GOLDEN_RAG_BENCHMARK_DATASET) {
      expect(item.id).toBeDefined();
      expect(item.query).toBeDefined();
      expect(typeof item.answerable).toBe('boolean');
      expect(item.split).toBe('test');
    }
  });

  it('computes correct metrics when target service is missing from candidates', () => {
    const emptyResults = [];
    const metrics = computeRetrievalMetrics(emptyResults, 'missing-service', 5);
    expect(metrics.hit).toBe(false);
    expect(metrics.recall).toBe(0.0);
    expect(metrics.mrr).toBe(0.0);
    expect(metrics.ndcg).toBe(0.0);
  });

  it('computes citation precision and recall accurately', () => {
    const mockGuidance = {
      status: 'SUCCESS',
      claims: [
        {
          claimId: 'c1',
          status: 'SUPPORTED',
          citations: [{ serviceId: 'aadhaar-update', url: 'https://myaadhaar.uidai.gov.in' }],
        },
        {
          claimId: 'c2',
          status: 'UNKNOWN',
          citations: [],
        },
      ],
      unsupportedClaims: [{ claimId: 'c2', text: 'unknown claim' }],
    };

    const expected = [{ serviceId: 'aadhaar-update' }];
    const metrics = computeCitationMetrics(mockGuidance, expected);

    expect(metrics.citationPrecision).toBe(1.0);
    expect(metrics.citationRecall).toBe(1.0);
    expect(metrics.unsupportedClaimRate).toBe(0.5);
  });

  it('evaluates provenance generator through benchmark harness with citation tracking', async () => {
    const harness = new OfflineRagBenchmarkHarness();

    const mockProvenanceGenerator = async ({ query }) => {
      if (query.includes('Aadhaar')) {
        return {
          status: 'SUCCESS',
          serviceId: 'aadhaar-update',
          overallGrounded: true,
          claims: [
            {
              claimId: 'c1',
              status: 'SUPPORTED',
              citations: [{ serviceId: 'aadhaar-update' }],
            },
          ],
          unsupportedClaims: [],
        };
      }
      if (query.includes('Mars')) {
        return {
          status: 'UNSUPPORTED',
          serviceId: null,
          overallGrounded: false,
          claims: [],
          unsupportedClaims: [{ claimId: 'c-mars', text: query }],
        };
      }
      return {
        status: 'SUCCESS',
        serviceId: 'other-service',
        overallGrounded: true,
        claims: [{ claimId: 'c-gen', status: 'SUPPORTED', citations: [{ serviceId: 'other-service' }] }],
        unsupportedClaims: [],
      };
    };

    const report = await harness.evaluateProvenance(mockProvenanceGenerator);
    expect(report.summary.evaluatedCount).toBe(GOLDEN_RAG_BENCHMARK_DATASET.length);
    expect(report.summary.unanswerablePrecision).toBe(1.0);
    expect(report.summary.meanCitationPrecision).toBeGreaterThan(0);
    expect(report.summary.latencyP50).toBeDefined();
  });
});
