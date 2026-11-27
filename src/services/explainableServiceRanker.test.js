/**
 * src/services/explainableServiceRanker.test.js
 *
 * Unit, fairness, deterministic fallback, and offline evaluation tests for #1430.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeRankingContext,
  rankCivicServices,
  evaluateRankerOffline,
} from './explainableServiceRanker.js';

describe('explainableServiceRanker (#1430)', () => {
  it('strips sensitive attributes and never infers from caste, religion, gender, income, or Aadhaar', () => {
    const clean = sanitizeRankingContext({
      query: 'income certificate',
      caste: 'SC',
      religion: 'X',
      gender: 'F',
      income: 50000,
      aadhaar: '123456789012',
    });
    expect(clean).toEqual({ query: 'income certificate' });

    const r1 = rankCivicServices({ query: 'ration card', caste: 'A', gender: 'F', income: 10000 });
    const r2 = rankCivicServices({ query: 'ration card', caste: 'B', gender: 'M', income: 900000 });
    expect(r1.results.map((r) => r.id)).toEqual(r2.results.map((r) => r.id));
    expect(r1.sensitiveFeaturesExcluded).toBe(true);
  });

  it('provides visible 4-factor explanations and deterministic fallback on empty query', () => {
    const fallback = rankCivicServices({ query: '', jurisdiction: 'All' });
    expect(fallback.fallbackUsed).toBe(true);
    expect(fallback.results.length).toBeGreaterThan(0);
    expect(fallback.results[0].explanationFactors).toHaveLength(4);
  });

  it('supports user intent correction override', () => {
    const res = rankCivicServices({
      query: 'help',
      intentOverride: 'income certificate',
    });
    expect(res.intentOverride).toBe('income certificate');
    expect(res.results[0].title.toLowerCase()).toContain('income');
  });

  it('passes offline evaluation dataset and fairness invariance check', () => {
    const evalReport = evaluateRankerOffline();
    expect(evalReport.totalCases).toBeGreaterThanOrEqual(4);
    expect(evalReport.fairnessInvariantPassed).toBe(true);
    expect(evalReport.mrr).toBeGreaterThan(0.5);
  });
});
