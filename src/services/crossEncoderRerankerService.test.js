import { describe, it, expect } from 'vitest';
import {
  scoreQueryPassageCrossInteraction,
  deduplicateCandidateChunks,
  enforceDiversity,
  CrossEncoderReranker,
} from './crossEncoderRerankerService';

const MOCK_CANDIDATE_CHUNKS = [
  {
    chunkId: 'aadhaar-1',
    serviceId: 'aadhaar-card',
    serviceTitle: 'Aadhaar Demographic Update',
    text: 'Aadhaar Card Update: Procedure to change address online via UIDAI portal.',
    score: 0.65,
  },
  {
    chunkId: 'aadhaar-1-dup',
    serviceId: 'aadhaar-card',
    serviceTitle: 'Aadhaar Demographic Update',
    text: 'Aadhaar Card Update: Procedure to change residential address online on UIDAI website.', // Near duplicate
    score: 0.63,
  },
  {
    chunkId: 'aadhaar-2',
    serviceId: 'aadhaar-card',
    serviceTitle: 'Aadhaar Demographic Update',
    text: 'Eligibility and age limits for Aadhaar biometric update.',
    score: 0.58,
  },
  {
    chunkId: 'pan-1',
    serviceId: 'pan-card',
    serviceTitle: 'PAN Card Application',
    text: 'Required documents for PAN card: identity proof and address proof.',
    score: 0.60,
  },
  {
    chunkId: 'voter-1',
    serviceId: 'voter-id',
    serviceTitle: 'Voter ID Registration',
    text: 'Apply for new Voter ID card via Election Commission of India portal Form 6.',
    score: 0.55,
  },
];

describe('Cross-Encoder Reranking for Evidence Selection (#608)', () => {
  it('accurately scores query-passage cross interactions', () => {
    const score = scoreQueryPassageCrossInteraction(
      'how to change address on aadhaar card',
      'Aadhaar Card Update: Procedure to change address online via UIDAI portal.'
    );

    expect(score).toBeGreaterThan(0.5);
  });

  it('deduplicates near-identical passages based on Jaccard overlap threshold', () => {
    const deduped = deduplicateCandidateChunks(MOCK_CANDIDATE_CHUNKS, 0.6);
    expect(deduped.length).toBeLessThan(MOCK_CANDIDATE_CHUNKS.length);
    const ids = deduped.map((c) => c.chunkId);
    expect(ids).toContain('aadhaar-1');
    expect(ids).not.toContain('aadhaar-1-dup');
  });

  it('enforces service diversity to prevent single-service monopolization', () => {
    const diverse = enforceDiversity(MOCK_CANDIDATE_CHUNKS, 2);
    const aadhaarCount = diverse.filter((c) => c.serviceId === 'aadhaar-card').length;
    expect(aadhaarCount).toBeLessThanOrEqual(2);
  });

  it('reranks candidate pool prioritizing cross-encoder alignment', async () => {
    const reranker = new CrossEncoderReranker();
    const res = await reranker.rerank({
      query: 'what documents are needed for pan card',
      candidates: MOCK_CANDIDATE_CHUNKS,
      topK: 3,
    });

    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].serviceId).toBe('pan-card');
    expect(res.results[0].crossEncoderScore).toBeGreaterThan(0.5);
    expect(res.diagnostics.fallbackUsed).toBe(false);
  });

  it('gracefully handles empty candidates list', async () => {
    const reranker = new CrossEncoderReranker();
    const res = await reranker.rerank({ query: 'pan', candidates: [] });
    expect(res.results).toEqual([]);
    expect(res.diagnostics.initialCandidatesCount).toBe(0);
  });

  it('falls back safely if execution exceeds latency budget', async () => {
    // Config with 0ms timeout to simulate immediate timeout path
    const reranker = new CrossEncoderReranker({ TIMEOUT_MS: -1 });
    const res = await reranker.rerank({
      query: 'aadhaar',
      candidates: MOCK_CANDIDATE_CHUNKS,
      topK: 2,
    });

    expect(res.results.length).toBe(2);
    expect(res.diagnostics.fallbackUsed).toBe(true);
  });
});
