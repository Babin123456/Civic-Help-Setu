import { describe, it, expect } from 'vitest';
import {
  discoverSchemes,
  extractKeywordsFromQuery,
  calculateNeedAlignmentScore,
  generateSourceGroundedReason,
  DISCOVERY_DISCLAIMER,
} from './schemeDiscoveryService.js';
import { MOCK_SERVICES } from '../data/services.js';

describe('Scheme Discovery Service (#391)', () => {
  describe('extractKeywordsFromQuery', () => {
    it('extracts education-related keywords', () => {
      const result = extractKeywordsFromQuery('I need help with my child education and school fees');
      expect(result.matchedCategories).toContain('education_support');
      expect(result.tokens).toContain('education');
      expect(result.tokens).toContain('school');
      expect(result.tokens).toContain('fees');
    });

    it('extracts livelihood/farmer keywords', () => {
      const result = extractKeywordsFromQuery('I am a farmer looking for financial support and subsidy');
      expect(result.matchedCategories).toContain('livelihood');
      expect(result.tokens).toContain('farmer');
      expect(result.tokens).toContain('financial');
      expect(result.tokens).toContain('subsidy');
    });

    it('extracts certificate-related keywords', () => {
      const result = extractKeywordsFromQuery('I need a birth certificate and caste certificate');
      expect(result.matchedCategories).toContain('certificates');
      expect(result.tokens).toContain('birth');
      expect(result.tokens).toContain('certificate');
      expect(result.tokens).toContain('caste');
    });

    it('extracts pension-related keywords', () => {
      const result = extractKeywordsFromQuery('My elderly mother needs old age pension');
      expect(result.matchedCategories).toContain('pensions');
      expect(result.tokens).toContain('elderly');
      expect(result.tokens).toContain('pension');
    });

    it('handles synonyms and transliterations', () => {
      const result = extractKeywordsFromQuery('I need rashan card for food subsidy');
      expect(result.matchedSynonyms.rashan).toContain('ration card');
      expect(result.matchedCategories).toContain('social_welfare');
    });

    it('returns empty categories for unrelated queries', () => {
      const result = extractKeywordsFromQuery('I want to buy a car');
      expect(result.matchedCategories.length).toBe(0);
    });
  });

  describe('calculateNeedAlignmentScore', () => {
    it('gives high score for primary category match (phrase-based)', () => {
      const service = MOCK_SERVICES.find((s) => s.id === 'pm-kisan');
      const extracted = { matchedCategories: ['livelihood'], primaryCategories: ['livelihood'], tokens: ['farmer', 'support'], matchedSynonyms: {} };
      const result = calculateNeedAlignmentScore(service, extracted);
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.reasons.some((r) => r.includes('livelihood'))).toBe(true);
    });

    it('gives moderate score for secondary category match (token-based)', () => {
      const service = MOCK_SERVICES.find((s) => s.id === 'pm-kisan');
      const extracted = { matchedCategories: ['livelihood'], primaryCategories: [], tokens: ['farmer', 'support'], matchedSynonyms: {} };
      const result = calculateNeedAlignmentScore(service, extracted);
      expect(result.score).toBeGreaterThanOrEqual(15);
      expect(result.reasons.some((r) => r.includes('livelihood'))).toBe(true);
    });

    it('gives score for keyword matches in service text', () => {
      const service = MOCK_SERVICES.find((s) => s.id === 'income-certificate');
      const extracted = { matchedCategories: ['certificates'], tokens: ['income', 'proof'], matchedSynonyms: {} };
      const result = calculateNeedAlignmentScore(service, extracted);
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('returns low score for unrelated service', () => {
      const service = MOCK_SERVICES.find((s) => s.id === 'driving-license');
      const extracted = { matchedCategories: ['education_support'], tokens: ['school', 'fees'], matchedSynonyms: {} };
      const result = calculateNeedAlignmentScore(service, extracted);
      expect(result.score).toBeLessThan(25);
    });
  });

  describe('generateSourceGroundedReason', () => {
    it('includes source information in reason', () => {
      const service = MOCK_SERVICES.find((s) => s.id === 'pm-kisan');
      const alignment = { reasons: ['Matches your mentioned need for livelihood'], score: 50 };
      const extracted = { tokens: ['farmer'], matchedCategories: ['livelihood'], matchedSynonyms: {} };
      const reason = generateSourceGroundedReason(service, alignment, extracted);
      expect(reason).toContain('PM Kisan Portal');
      expect(reason).toContain('pmkisan.gov.in');
    });

    it('includes disclaimer reference', () => {
      const service = MOCK_SERVICES.find((s) => s.id === 'pm-kisan');
      const alignment = { reasons: [], score: 10 };
      const extracted = { tokens: [], matchedCategories: [], matchedSynonyms: {} };
      const reason = generateSourceGroundedReason(service, alignment, extracted);
      expect(reason).toContain('Source:');
    });
  });

  describe('discoverSchemes', () => {
    it('returns results for education support query', () => {
      const result = discoverSchemes('I need financial help for my child education and scholarship');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.some((r) => r.id === 'income-certificate')).toBe(true);
      expect(result.disclaimer).toBe(DISCOVERY_DISCLAIMER);
    });

    it('returns results for farmer livelihood query', () => {
      const result = discoverSchemes('I am a farmer looking for government scheme and subsidy');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.some((r) => r.id === 'pm-kisan')).toBe(true);
      expect(result.results[0].reason).toContain('Source:');
    });

    it('returns results for certificate query', () => {
      const result = discoverSchemes('I need birth certificate for my newborn');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.some((r) => r.id === 'birth-certificate')).toBe(true);
    });

    it('returns results for pension query', () => {
      const result = discoverSchemes('My father needs old age pension');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.some((r) => r.id === 'pf-withdrawal')).toBe(true);
    });

    it('returns results for identity document query', () => {
      const result = discoverSchemes('I want to apply for aadhaar card');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.some((r) => r.id === 'aadhaar-card')).toBe(true);
    });

    it('returns empty results with helpful message for empty query', () => {
      const result = discoverSchemes('');
      expect(result.results).toEqual([]);
      expect(result.message).toContain('Please describe what you need help with');
      expect(result.suggestion).toContain('catalogue search');
    });

    it('returns empty results with fallback for unrelated query', () => {
      const result = discoverSchemes('I want to buy a new car');
      expect(result.results).toEqual([]);
      expect(result.message).toContain('No matching schemes found');
      expect(result.suggestion).toContain('catalogue search');
    });

    it('includes disclaimer in all results', () => {
      const result = discoverSchemes('I need help with education fees');
      for (const r of result.results) {
        expect(r.disclaimer).toBe(DISCOVERY_DISCLAIMER);
      }
    });

    it('includes source-grounded reason in each result', () => {
      const result = discoverSchemes('I am a farmer needing support');
      for (const r of result.results) {
        expect(r.reason).toContain('Source:');
      }
    });

    it('limits results to specified limit', () => {
      const result = discoverSchemes('I need certificate', { limit: 2 });
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('respects minimum score threshold', () => {
      const result = discoverSchemes('I need certificate', { minScore: 100 });
      expect(result.results).toEqual([]);
    });

    it('handles ambiguous query with multiple possible matches', () => {
      const result = discoverSchemes('I need help with documents');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.extracted.matchedCategories).toContain('certificates');
    });

    it('does not infer sensitive traits not provided by user', () => {
      const result = discoverSchemes('I need financial help');
      const serviceNames = result.results.map((r) => r.name);
      expect(serviceNames.join(', ')).not.toContain('caste');
      expect(serviceNames.join(', ')).not.toContain('religion');
      expect(serviceNames.join(', ')).not.toContain('gender');
    });

    it('treats recommendations as discovery help, not eligibility decision', () => {
      const result = discoverSchemes('I am eligible for pension');
      for (const r of result.results) {
        expect(r.disclaimer).toContain('not an eligibility determination');
      }
    });
  });

  describe('Edge cases', () => {
    it('handles very short queries', () => {
      const result = discoverSchemes('help');
      expect(result.results).toEqual([]);
      expect(result.message).toBeDefined();
    });

    it('handles special characters in query', () => {
      const result = discoverSchemes('I need help!!! What @schemes?');
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });

    it('handles multilingual transliteration query', () => {
      const result = discoverSchemes('mujhe kisan yojana chahiye');
      expect(result.results.some((r) => r.id === 'pm-kisan')).toBe(true);
    });

    it('returns consistent results for same query', () => {
      const result1 = discoverSchemes('farmer subsidy help');
      const result2 = discoverSchemes('farmer subsidy help');
      expect(result1.results.map((r) => r.id)).toEqual(result2.results.map((r) => r.id));
    });
  });
});