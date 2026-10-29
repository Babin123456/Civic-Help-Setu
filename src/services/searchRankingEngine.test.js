import { describe, it, expect } from 'vitest';
import {
  calculateServiceRelevance,
  rankAndFilterServices,
  getFuzzyMatchSummary,
  CIVIC_PHONETIC_TRANSLITERATIONS,
} from './searchRankingEngine';

const mockServices = [
  {
    id: 'ration-card',
    name: 'Ration Card',
    category: 'Food & Civil Supplies',
    department: 'Food Department',
    shortDescription: 'Subsidized foodgrains under public distribution system.',
  },
  {
    id: 'income-certificate',
    name: 'Income Certificate',
    category: 'Certificates',
    department: 'Revenue Department',
    shortDescription: 'Proof of annual household income.',
  },
  {
    id: 'driving-license',
    name: 'Driving License',
    category: 'Transport',
    department: 'Transport Department',
    shortDescription: 'Official authorization to operate motor vehicles.',
  },
  {
    id: 'passport',
    name: 'Passport Application',
    category: 'Identity',
    department: 'Ministry of External Affairs',
    shortDescription: 'Official travel document and identity proof.',
  },
];

describe('searchRankingEngine - Phonetic Transliterations & Fuzzy Matching', () => {
  it('correctly matches colloquial Hindi transliterations to official services', () => {
    // "rashan" matches "Ration Card"
    const rationRelevance = calculateServiceRelevance(mockServices[0], 'rashan');
    expect(rationRelevance).toBeGreaterThan(0);

    const results = rankAndFilterServices(mockServices, { searchQuery: 'rashan' });
    expect(results[0].id).toBe('ration-card');
  });

  it('matches regional revenue terms like "aay" to Income Certificate', () => {
    const incomeRelevance = calculateServiceRelevance(mockServices[1], 'aay');
    expect(incomeRelevance).toBeGreaterThan(0);

    const results = rankAndFilterServices(mockServices, { searchQuery: 'aay' });
    expect(results[0].id).toBe('income-certificate');
  });

  it('matches transport queries like "parivahan" or "gaadi" to Driving License', () => {
    const results = rankAndFilterServices(mockServices, { searchQuery: 'parivahan' });
    expect(results[0].id).toBe('driving-license');
  });

  it('tolerates single-character typos with fuzzy Levenshtein matching', () => {
    // "passprot" -> Passport
    const relevance = calculateServiceRelevance(mockServices[3], 'passprot');
    expect(relevance).toBeGreaterThan(0);

    const results = rankAndFilterServices(mockServices, { searchQuery: 'passprot' });
    expect(results[0].id).toBe('passport');
  });

  it('generates citizen feedback summary for transliterations and typos', () => {
    const transSummary = getFuzzyMatchSummary('rashan');
    expect(transSummary).not.toBeNull();
    expect(transSummary.isTransliterated).toBe(true);
    expect(transSummary.suggestedTerm).toContain('ration');

    const typoSummary = getFuzzyMatchSummary('passprot');
    expect(typoSummary).not.toBeNull();
    expect(typoSummary.suggestedTerm).toBe('passport');
  });
});
