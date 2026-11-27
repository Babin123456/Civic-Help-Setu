/**
 * src/services/civicSearchQueryRecoveryService.test.js
 *
 * Unit tests for Civic Search Query Understanding & Spelling Recovery (#1431).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  understandAndRecoverQuery,
  isLegalIdentifierToken,
  recordReviewedQueryEvaluation,
  listQueryEvaluations,
} from './civicSearchQueryRecoveryService.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('civicSearchQueryRecoveryService (#1431)', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('recovers spelling typos while preserving originalQuery', () => {
    const res = understandAndRecoverQuery('incme certficate');
    expect(res.originalQuery).toBe('incme certficate');
    expect(res.hasCorrection).toBe(true);
    expect(res.correctedQuery).toBe('income certificate');
    expect(res.corrections).toHaveLength(2);
    expect(res.results.length).toBeGreaterThan(0);
  });

  it('never alters legal identifiers (Form 16, Section 80C, RTI/2026/101, PIN 110001)', () => {
    expect(isLegalIdentifierToken('RTI/2026/101')).toBe(true);
    expect(isLegalIdentifierToken('110001')).toBe(true);
    expect(isLegalIdentifierToken('16', 'Form')).toBe(true);
    expect(isLegalIdentifierToken('80C', 'Section')).toBe(true);

    const res = understandAndRecoverQuery('incme certficate Form 16 Section 80C RTI/2026/101 110001');
    expect(res.correctedQuery).toContain('income certificate');
    expect(res.correctedQuery).toContain('Form 16');
    expect(res.correctedQuery).toContain('Section 80C');
    expect(res.correctedQuery).toContain('RTI/2026/101');
    expect(res.correctedQuery).toContain('110001');
    expect(res.lockedLegalTokens).toEqual(expect.arrayContaining(['16', '80C', 'RTI/2026/101', '110001']));
  });

  it('handles Devanagari and Indic colloquial transliteration + curated synonyms', () => {
    const dev = understandAndRecoverQuery('आय प्रमाण पत्र');
    expect(dev.hasCorrection).toBe(true);
    expect(dev.correctedQuery).toContain('income certificate');

    const syn = understandAndRecoverQuery('bijli shikayat');
    expect(syn.hasCorrection).toBe(true);
    expect(syn.correctedQuery).toBe('electricity grievance complaint');
  });

  it('records reviewed query evaluations and rejects PII in evaluation notes', () => {
    const entry = recordReviewedQueryEvaluation({
      originalQuery: 'aay praman patra',
      correctedQuery: 'income certificate',
      accepted: true,
      evaluatorId: 'reviewer-1',
      customStorage: storage,
    });
    expect(entry.accepted).toBe(true);
    expect(listQueryEvaluations(storage)).toHaveLength(1);

    expect(() =>
      recordReviewedQueryEvaluation({
        originalQuery: 'test',
        correctedQuery: 'test',
        accepted: false,
        notes: 'Aadhaar 1234 5678 9012',
        customStorage: storage,
      })
    ).toThrow(/Aadhaar or PAN/i);
  });
});
