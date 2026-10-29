import { describe, it, expect, beforeEach } from 'vitest';
import {
  TRUST_DISCLAIMER,
  TRUST_TIERS,
  calculateDataTrustScore,
  recordServiceReview,
  getServiceReviewOverrides,
  saveServiceReviewOverrides,
  getStaleReviewQueue,
  getCatalogFreshnessHealth,
} from './dataFreshnessTrustService';
import { setCurrentActor } from './accessControl';

// These tests are about what the admin features do; who may use them is tested in accessControl.test.js.
setCurrentActor({ role: 'admin', username: 'Test Admin' });

const makeStorage = (initialData = {}) => {
  const map = new Map(Object.entries(initialData));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
};

describe('dataFreshnessTrustService', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeStorage();
  });

  describe('Non-Government Endorsement Disclaimer', () => {
    it('always includes explicit disclaimer that score is informational and not government endorsement', () => {
      const evaluation = calculateDataTrustScore({ id: 'srv-test' }, mockStorage);
      expect(evaluation.disclaimer).toBe(TRUST_DISCLAIMER);
      expect(evaluation.disclaimer).toContain('does not constitute official government endorsement');
      expect(evaluation.disclaimer).toContain('Always verify procedural requirements');
    });
  });

  describe('High Quality & Fresh Record Evaluation', () => {
    it('awards top score for recently reviewed service with .gov.in source and all critical fields', () => {
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
      const completeService = {
        id: 'driving-licence',
        name: 'Driving Licence',
        officialWebsite: 'https://parivahan.gov.in/parivahan',
        officialSources: ['https://morth.nic.in/regulations'],
        lastReviewedAt: recentDate,
        verifiedBy: 'State Transport Cell',
        documents: ['Form 1A Medical Certificate', 'Aadhaar Card', 'Age Proof'],
        steps: [
          { title: 'Apply Online', description: 'Fill form on Sarathi portal' },
          { title: 'Biometrics & Test', description: 'Visit RTO testing track' },
        ],
        fees: 'Rs. 200 application fee + Rs. 300 test fee',
        processingTime: '7-15 business days',
        eligibility: ['Minimum 18 years of age', 'Valid Learner Licence held for >= 30 days'],
      };

      const result = calculateDataTrustScore(completeService, mockStorage);

      expect(result.score).toBe(100);
      expect(result.tier).toBe(TRUST_TIERS.HIGH);
      expect(result.breakdown.provenance).toBe(30);
      expect(result.breakdown.freshness).toBe(30);
      expect(result.breakdown.completeness).toBe(40);
      expect(result.defects.length).toBe(0);
      expect(result.isStale).toBe(false);
      expect(result.positiveNotes.some((n) => n.includes('.gov.in'))).toBe(true);
    });
  });

  describe('Stale Record Evaluation (> 365 Days)', () => {
    it('drops freshness score to 0 and flags staleness when last review is older than a year', () => {
      const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
      const staleService = {
        id: 'old-service',
        name: 'Old Land Mutation Record',
        officialWebsite: 'https://landrecords.gov.in',
        lastReviewedAt: twoYearsAgo,
        documents: ['Title Deed'],
        steps: [
          { title: 'Submit Application', description: 'Submit at Tehsil' },
          { title: 'Verification', description: 'Patwari inspection' },
        ],
        fees: 'Rs. 50',
        processingTime: '30 days',
        eligibility: ['Property owner'],
      };

      const result = calculateDataTrustScore(staleService, mockStorage);

      expect(result.breakdown.freshness).toBe(0);
      expect(result.defects.some((d) => d.includes('Record is stale'))).toBe(true);
      expect(result.isStale).toBe(true);
      expect(result.score).toBeLessThan(75);
    });
  });

  describe('Missing and Incomplete Field Evaluation (Missing Data Never Verified)', () => {
    it('penalizes missing official source domain', () => {
      const unverifiedSourceService = {
        id: 'blog-source-service',
        name: 'Community Guide',
        officialWebsite: 'https://unofficialblog.example.com',
        lastReviewedAt: new Date().toISOString(),
        documents: ['Photo'],
        steps: [{ title: 'Step 1' }, { title: 'Step 2' }],
        fees: 'Free',
        processingTime: '2 days',
        eligibility: ['Residents'],
      };

      const result = calculateDataTrustScore(unverifiedSourceService, mockStorage);
      expect(result.breakdown.provenance).toBe(5);
      expect(result.defects.some((d) => d.includes('No official government domain'))).toBe(true);
    });

    it('penalizes missing fee information and never assumes free/verified', () => {
      const missingFeeService = {
        id: 'no-fee-info',
        name: 'Certificate Without Fee Data',
        officialWebsite: 'https://revenue.gov.in',
        lastReviewedAt: new Date().toISOString(),
        documents: ['Aadhaar'],
        steps: [{ title: 'Step 1' }, { title: 'Step 2' }],
        fees: null, // missing
        processingTime: '10 days',
        eligibility: ['All citizens'],
      };

      const result = calculateDataTrustScore(missingFeeService, mockStorage);
      expect(result.breakdown.completeness).toBe(30); // 40 - 10
      expect(result.defects.some((d) => d.includes('fee information is missing'))).toBe(true);
    });

    it('penalizes missing documents checklist', () => {
      const noDocsService = {
        id: 'no-docs-service',
        name: 'Permit Application',
        officialWebsite: 'https://transport.gov.in',
        lastReviewedAt: new Date().toISOString(),
        documents: [], // empty
        steps: [{ title: 'Apply' }, { title: 'Collect' }],
        fees: 'Rs. 100',
        processingTime: '5 days',
        eligibility: ['Drivers'],
      };

      const result = calculateDataTrustScore(noDocsService, mockStorage);
      expect(result.breakdown.completeness).toBe(30); // 40 - 10
      expect(result.defects.some((d) => d.includes('documents checklist is missing'))).toBe(true);
    });

    it('penalizes single step or missing steps instructions', () => {
      const singleStepService = {
        id: 'single-step-service',
        name: 'Vague Scheme',
        officialWebsite: 'https://welfare.gov.in',
        lastReviewedAt: new Date().toISOString(),
        documents: ['Ration Card'],
        steps: [{ title: 'Only One Step Here' }],
        fees: 'Nil',
        processingTime: '14 days',
        eligibility: ['Families'],
      };

      const result = calculateDataTrustScore(singleStepService, mockStorage);
      expect(result.breakdown.completeness).toBe(35); // 40 - 5 (single step awards 5/10)
      expect(result.defects.some((d) => d.includes('single step'))).toBe(true);
    });

    it('handles completely empty or null service object gracefully', () => {
      const nullResult = calculateDataTrustScore(null, mockStorage);
      expect(nullResult.score).toBe(0);
      expect(nullResult.tier).toBe(TRUST_TIERS.STALE_OR_INCOMPLETE);
      expect(nullResult.defects.length).toBeGreaterThan(0);
    });
  });

  describe('Maintainer Review and Verification Workflow', () => {
    it('records review in storage, elevating freshness score and clearing stale flag', () => {
      const twoYearsAgo = new Date(Date.now() - 700 * 24 * 60 * 60 * 1000).toISOString();
      const service = {
        id: 'pension-scheme',
        name: 'Old Age Pension Scheme',
        officialWebsite: 'https://socialjustice.gov.in',
        lastReviewedAt: twoYearsAgo,
        documents: ['Age Certificate', 'Bank Passbook'],
        steps: [{ title: 'Apply at BDO' }, { title: 'Sanction by District Officer' }],
        fees: 'No fees',
        processingTime: '45 days',
        eligibility: ['Senior citizens >= 60'],
      };

      // Before review: stale
      const before = calculateDataTrustScore(service, mockStorage);
      expect(before.isStale).toBe(true);
      expect(before.breakdown.freshness).toBe(0);

      // Perform maintainer review
      recordServiceReview('pension-scheme', 'Senior Officer Verma', 'Verified with 2026 circular', mockStorage);

      // After review: fresh today
      const after = calculateDataTrustScore(service, mockStorage);
      expect(after.isStale).toBe(false);
      expect(after.breakdown.freshness).toBe(30);
      expect(after.reviewedBy).toBe('Senior Officer Verma');
      expect(after.score).toBeGreaterThan(before.score);
    });
  });

  describe('Stale Review Queue & Catalog Freshness Health', () => {
    it('queues services that fall below the confidence threshold or are older than 180 days', () => {
      const services = [
        {
          id: 'fresh-one',
          name: 'Fresh Service',
          officialWebsite: 'https://gov.in',
          lastReviewedAt: new Date().toISOString(),
          documents: ['Doc 1'],
          steps: [{ title: 'Step 1' }, { title: 'Step 2' }],
          fees: 'Rs 10',
          processingTime: '1 day',
          eligibility: ['All'],
        },
        {
          id: 'stale-one',
          name: 'Stale Service',
          officialWebsite: 'https://gov.in',
          lastReviewedAt: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString(), // 250 days ago
          documents: ['Doc 1'],
          steps: [{ title: 'Step 1' }, { title: 'Step 2' }],
          fees: 'Rs 10',
          processingTime: '1 day',
          eligibility: ['All'],
        },
        {
          id: 'incomplete-one',
          name: 'Incomplete Service',
          officialWebsite: 'https://gov.in',
          lastReviewedAt: new Date().toISOString(),
          documents: [],
          steps: [],
          fees: null,
          processingTime: null,
          eligibility: [],
        },
      ];

      const queue = getStaleReviewQueue(services, mockStorage);
      expect(queue.length).toBe(2);
      expect(queue.some((item) => item.serviceId === 'stale-one')).toBe(true);
      expect(queue.some((item) => item.serviceId === 'incomplete-one')).toBe(true);
      expect(queue.some((item) => item.serviceId === 'fresh-one')).toBe(false);

      // Verify sorted by lowest score first
      expect(queue[0].score).toBeLessThanOrEqual(queue[1].score);
    });

    it('computes catalog health distribution across all services', () => {
      const services = [
        {
          id: 's1',
          name: 'Service 1',
          officialWebsite: 'https://gov.in',
          lastReviewedAt: new Date().toISOString(),
          documents: ['A'],
          steps: [{ title: '1' }, { title: '2' }],
          fees: 'Rs 5',
          processingTime: '1d',
          eligibility: ['X'],
        },
        {
          id: 's2',
          name: 'Service 2',
          officialWebsite: '',
          lastReviewedAt: null,
          documents: [],
          steps: [],
          fees: null,
          processingTime: null,
          eligibility: [],
        },
      ];

      const health = getCatalogFreshnessHealth(services, mockStorage);
      expect(health.total).toBe(2);
      expect(health.highCount).toBe(1);
      expect(health.staleCount).toBe(1);
      expect(health.averageScore).toBeGreaterThan(0);
    });
  });
});
