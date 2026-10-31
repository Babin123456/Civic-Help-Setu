import { describe, it, expect, beforeEach } from 'vitest';
import {
  tokenize,
  calculateTokenOverlap,
  calculateStringSimilarity,
  compareUrls,
  computeServiceSimilarity,
  findDuplicateCandidates,
  getReviewStates,
  setPairReviewStatus,
  clearReviewStates,
  getPairId,
  REVIEW_STATUS,
} from './duplicateServiceDetector';

describe('duplicateServiceDetector service (#397)', () => {
  beforeEach(() => {
    clearReviewStates();
  });

  describe('tokenization and similarity primitives', () => {
    it('tokenizes text while removing punctuation and stop words', () => {
      const tokens = tokenize('Pradhan Mantri Awas Yojana for the Urban Citizens and Families');
      expect(tokens).toContain('awas');
      expect(tokens).toContain('urban');
      expect(tokens).not.toContain('for');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('and');
    });

    it('calculates token overlap correctly', () => {
      const overlap = calculateTokenOverlap(['food', 'ration', 'security'], ['ration', 'security', 'card']);
      expect(overlap).toBeGreaterThan(0.4);
      expect(overlap).toBeLessThan(0.8);
    });

    it('calculates Levenshtein similarity for exact and partial strings', () => {
      expect(calculateStringSimilarity('Voter ID Card', 'Voter ID Card')).toBe(1.0);
      expect(calculateStringSimilarity('Birth Certificate', 'Death Certificate')).toBeGreaterThan(0.5);
      expect(calculateStringSimilarity('Passport', 'Driving Licence')).toBeLessThan(0.3);
    });

    it('compares official URLs by host and path', () => {
      expect(compareUrls('https://uidai.gov.in/aadhaar', 'https://uidai.gov.in/aadhaar')).toBe(1.0);
      expect(compareUrls('https://uidai.gov.in/update', 'https://uidai.gov.in/status')).toBe(0.7);
      expect(compareUrls('https://uidai.gov.in', 'https://parivahan.gov.in')).toBe(0.0);
    });
  });

  describe('computeServiceSimilarity', () => {
    it('detects exact and nearly identical service records with high confidence', () => {
      const recordA = {
        id: 'rec-1',
        title: 'Pradhan Mantri Awas Yojana Gramin',
        department: 'Ministry of Rural Development',
        jurisdiction: 'National',
        description: 'Financial assistance for rural housing construction.',
        officialUrl: 'https://pmayg.nic.in',
      };
      const recordB = {
        id: 'rec-2',
        title: 'Pradhan Mantri Awas Yojana - Gramin Housing',
        department: 'Ministry of Rural Development',
        jurisdiction: 'National',
        description: 'Financial grant for rural homeless citizens to build houses.',
        officialUrl: 'https://pmayg.nic.in/portal',
      };

      const result = computeServiceSimilarity(recordA, recordB);
      expect(result.score).toBeGreaterThanOrEqual(0.75);
      expect(result.confidenceLevel).toBe('HIGH');
      expect(result.matchedFields).toContain('title');
      expect(result.matchedFields).toContain('department');
      expect(result.matchedFields).toContain('jurisdiction');
      expect(result.matchedFields).toContain('officialUrl');
      expect(result.reasons.length).toBeGreaterThan(2);
    });

    it('identifies partial near-duplicates and maps differing fields', () => {
      const nationalScheme = {
        id: 'scheme-nat',
        title: 'Ration Card Subsidy Distribution',
        department: 'Department of Food and Public Distribution',
        jurisdiction: 'National',
        description: 'National food grain entitlement distribution.',
        officialUrl: 'https://nfsa.gov.in',
      };
      const stateScheme = {
        id: 'scheme-state',
        title: 'Ration Card Distribution Karnataka',
        department: 'Food Civil Supplies and Consumer Affairs',
        jurisdiction: 'Karnataka',
        description: 'Karnataka state fair price shop ration quota.',
        officialUrl: 'https://ahara.kar.nic.in',
      };

      const result = computeServiceSimilarity(nationalScheme, stateScheme);
      expect(result.matchedFields).toContain('title');
      expect(result.differingFields).toContain('jurisdiction');
      expect(result.differingFields).toContain('officialUrl');
      expect(result.reasons.some((r) => r.includes('Differing jurisdictions'))).toBe(true);
    });

    it('returns low score and distinct categorization for completely different services', () => {
      const passport = {
        id: 'srv-passport',
        title: 'Passport Seva Online Issuance',
        department: 'Ministry of External Affairs',
        jurisdiction: 'National',
        description: 'Apply for fresh or renewal Indian passport book.',
        officialUrl: 'https://passportindia.gov.in',
      };
      const electricity = {
        id: 'srv-power',
        title: 'Agricultural Electricity Tariff Subsidy',
        department: 'Energy Department',
        jurisdiction: 'Punjab',
        description: 'Free power for tube well connections for registered farmers.',
        officialUrl: 'https://pspcl.in',
      };

      const result = computeServiceSimilarity(passport, electricity);
      expect(result.score).toBeLessThan(0.40);
      expect(result.confidenceLevel).toBe('LOW');
      expect(result.matchedFields.length).toBe(0);
    });
  });

  describe('findDuplicateCandidates and review persistence', () => {
    const testServices = [
      {
        id: 's1',
        title: 'Senior Citizen Pension Benefit',
        department: 'Social Welfare',
        jurisdiction: 'Delhi',
        description: 'Monthly pension for senior citizens residing in Delhi.',
        officialUrl: 'https://delhi.gov.in/pension',
      },
      {
        id: 's2',
        title: 'Senior Citizen Monthly Pension Scheme',
        department: 'Social Welfare Department',
        jurisdiction: 'Delhi',
        description: 'Financial pension aid for older residents of Delhi.',
        officialUrl: 'https://delhi.gov.in/social-pension',
      },
      {
        id: 's3',
        title: 'Student Pre-Matric Scholarship',
        department: 'Minority Affairs',
        jurisdiction: 'National',
        description: 'Educational scholarship for eligible students.',
        officialUrl: 'https://scholarships.gov.in',
      },
    ];

    it('surfaces candidate pairs meeting threshold and filters below threshold', () => {
      const candidates = findDuplicateCandidates(testServices, { threshold: 0.60 });
      expect(candidates.length).toBe(1);
      expect(candidates[0].pairId).toBe(getPairId('s1', 's2'));
      expect(candidates[0].reviewStatus).toBe(REVIEW_STATUS.PENDING);
    });

    it('allows administrator to mark pair as duplicate and persists decision', () => {
      const pairId = getPairId('s1', 's2');
      const marked = setPairReviewStatus(pairId, REVIEW_STATUS.CONFIRMED_DUPLICATE, 'Verified identical department program', 'Admin User');
      expect(marked).toBe(true);

      const states = getReviewStates();
      expect(states[pairId].status).toBe(REVIEW_STATUS.CONFIRMED_DUPLICATE);
      expect(states[pairId].notes).toBe('Verified identical department program');

      // Verify findDuplicateCandidates reflects updated status
      const candidates = findDuplicateCandidates(testServices, { threshold: 0.60, statusFilter: REVIEW_STATUS.CONFIRMED_DUPLICATE });
      expect(candidates.length).toBe(1);
      expect(candidates[0].reviewStatus).toBe(REVIEW_STATUS.CONFIRMED_DUPLICATE);
    });

    it('allows administrator to mark pair as distinct when intentional', () => {
      const pairId = getPairId('s1', 's2');
      setPairReviewStatus(pairId, REVIEW_STATUS.MARKED_DISTINCT, 'Two separate tranches with different age brackets');

      const candidates = findDuplicateCandidates(testServices, { threshold: 0.60, statusFilter: REVIEW_STATUS.MARKED_DISTINCT });
      expect(candidates.length).toBe(1);
      expect(candidates[0].reviewStatus).toBe(REVIEW_STATUS.MARKED_DISTINCT);

      const pendingOnly = findDuplicateCandidates(testServices, { threshold: 0.60, statusFilter: REVIEW_STATUS.PENDING });
      expect(pendingOnly.length).toBe(0);
    });

    it('does not alter or delete the underlying services list', () => {
      const initialLength = testServices.length;
      findDuplicateCandidates(testServices, { threshold: 0.60 });
      expect(testServices.length).toBe(initialLength);
      expect(testServices[0].title).toBe('Senior Citizen Pension Benefit');
    });
  });
});
