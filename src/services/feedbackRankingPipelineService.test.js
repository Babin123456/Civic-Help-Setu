import { describe, it, expect, beforeEach } from 'vitest';
import {
  redactSensitiveFeedbackText,
  PrivacySafeFeedbackPipeline,
} from './feedbackRankingPipelineService';

describe('Privacy-Safe Feedback-to-Ranking Learning Pipeline (#612)', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new PrivacySafeFeedbackPipeline();
  });

  it('redacts sensitive PII (Aadhaar, PAN, phone, email) from queries and notes', () => {
    const raw = 'My name is Ramesh, Aadhaar is 1234 5678 9012, PAN is ABCDE1234F, phone is 9876543210, email test@gov.in';
    const redacted = redactSensitiveFeedbackText(raw);

    expect(redacted).not.toContain('1234 5678 9012');
    expect(redacted).not.toContain('ABCDE1234F');
    expect(redacted).not.toContain('9876543210');
    expect(redacted).not.toContain('test@gov.in');

    expect(redacted).toContain('[REDACTED_AADHAAR]');
    expect(redacted).toContain('[REDACTED_PAN]');
    expect(redacted).toContain('[REDACTED_PHONE]');
    expect(redacted).toContain('[REDACTED_EMAIL]');
  });

  it('blocks feedback recording if explicit consent is absent', () => {
    const res = pipeline.recordFeedback({
      queryText: 'how to apply for ration card',
      retrievedChunkIds: ['c1', 'c2'],
      hasConsent: false,
    });

    expect(res.recorded).toBe(false);
    expect(res.reason).toContain('consent required');
  });

  it('records sanitized feedback when consent is granted', () => {
    const res = pipeline.recordFeedback({
      queryText: 'driving licence fee 9876543210',
      retrievedChunkIds: ['dl-1', 'dl-2'],
      selectedChunkId: 'dl-1',
      rating: 1,
      hasConsent: true,
      feedbackNote: 'Useful for my phone 9876543210',
    });

    expect(res.recorded).toBe(true);
    expect(pipeline.inMemoryRecords.length).toBe(1);
    expect(pipeline.inMemoryRecords[0].note).toContain('[REDACTED_PHONE]');
  });

  it('generates pairwise preference dataset from positive selections', () => {
    pipeline.recordFeedback({
      queryText: 'voter id form 6',
      retrievedChunkIds: ['v1', 'v2', 'v3'],
      selectedChunkId: 'v1',
      rating: 1,
      hasConsent: true,
    });

    const dataset = pipeline.generatePairwiseDataset();
    expect(dataset.totalPairs).toBe(2);
    expect(dataset.pairs[0].winner).toBe('v1');
    expect(dataset.pairs[0].loser).toBe('v2');
    expect(dataset.pairs[1].winner).toBe('v1');
    expect(dataset.pairs[1].loser).toBe('v3');
  });

  it('enforces strict criteria for model promotion gating', () => {
    const baseline = { mrr: 0.65, ndcg: 0.70 };

    // Underperforming candidate
    const failedPromo = pipeline.evaluateAndPromoteModel({
      candidateVersion: '2.0.0-beta',
      candidateMetrics: { mrr: 0.66, ndcg: 0.71 }, // Only +0.01
      baselineMetrics: baseline,
    });
    expect(failedPromo.promoted).toBe(false);

    // Well-performing candidate
    const successfulPromo = pipeline.evaluateAndPromoteModel({
      candidateVersion: '2.0.0',
      candidateMetrics: { mrr: 0.70, ndcg: 0.76 }, // +0.05 and +0.06
      baselineMetrics: baseline,
    });
    expect(successfulPromo.promoted).toBe(true);
    expect(successfulPromo.newActiveVersion).toBe('2.0.0');
  });

  it('allows complete cascading erasure of stored feedback', () => {
    pipeline.recordFeedback({
      queryText: 'query',
      retrievedChunkIds: ['c1'],
      hasConsent: true,
    });
    expect(pipeline.inMemoryRecords.length).toBe(1);

    const purged = pipeline.purgeAllFeedback();
    expect(purged.purgedCount).toBe(1);
    expect(pipeline.inMemoryRecords.length).toBe(0);
  });

  it('rejects feedback submissions with invalid or empty retrievedChunkIds', () => {
    const res = pipeline.recordFeedback({
      queryText: 'valid query',
      retrievedChunkIds: [],
      hasConsent: true,
    });
    expect(res.recorded).toBe(false);
    expect(res.reason).toContain('Invalid query or retrieved chunk references');
  });

  it('preserves version history and logs promotion status', () => {
    expect(pipeline.modelVersions.length).toBeGreaterThan(0);
    const active = pipeline.modelVersions.find((m) => m.status === 'active');
    expect(active).toBeDefined();
    expect(active.version).toBe('1.0.0');
  });
});
