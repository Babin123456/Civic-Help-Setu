import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  READINESS_CATEGORIES,
  APPROVAL_DISCLAIMER_TEXT,
  SERVICE_READINESS_RULES,
  generateReadinessCriteriaForService,
  evaluateDataConfidence,
  calculateReadinessScore,
  saveReadinessProgress,
  getReadinessProgress,
  resetReadinessProgress,
} from './readinessScorecardService';

const makeStorage = () => {
  const store = new Map();
  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, val) => store.set(key, String(val))),
    removeItem: vi.fn((key) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
  };
};

describe('Civic Application Readiness Scorecard Service (#147)', () => {
  let mockStorage;

  const mockServiceWithCustomRules = {
    id: 'birth-certificate',
    name: 'Birth Certificate',
    category: 'Certificates',
    fees: '₹20 - ₹100',
    processingTime: '7 - 30 days',
    officialSources: [{ name: 'Portal', url: 'https://crsorgi.gov.in', verified: true }],
    lastVerified: '2026-01-15',
    documents: ['Discharge Slip', 'Parent ID'],
  };

  const mockServiceWithoutCustomRules = {
    id: 'ration-card',
    name: 'Ration Card NFSA',
    category: 'Food & Civil Supplies',
    fees: 'Nil / Free',
    processingTime: '30 days',
    eligibility: ['Income below poverty line', 'Domicile resident of state'],
    documents: ['Aadhaar Card of all family members', 'Income Certificate', 'Electricity Bill'],
    officialSources: [{ name: 'NFSA Portal', url: 'https://nfsa.gov.in', verified: true }],
    lastVerified: '2026-02-01',
  };

  const mockServiceMissingData = {
    id: 'incomplete-welfare-scheme',
    name: 'Tribal Solar Grant',
    // Missing officialSources, missing lastVerified, missing fees, missing documents
  };

  beforeEach(() => {
    mockStorage = makeStorage();
  });

  describe('Criteria Configuration & Dynamic Synthesis', () => {
    it('loads custom predefined rules for services configured in SERVICE_READINESS_RULES', () => {
      const criteria = generateReadinessCriteriaForService(mockServiceWithCustomRules);
      expect(criteria.length).toBe(SERVICE_READINESS_RULES['birth-certificate'].length);
      expect(criteria.some((c) => c.id === 'bc-eligibility-parent')).toBe(true);
      expect(criteria.some((c) => c.category === READINESS_CATEGORIES.DOCUMENTS)).toBe(true);
    });

    it('synthesizes transparent criteria for unconfigured services based on metadata', () => {
      const criteria = generateReadinessCriteriaForService(mockServiceWithoutCustomRules);
      expect(criteria.length).toBeGreaterThanOrEqual(5);

      // Eligibility criteria generated
      expect(criteria.some((c) => c.id.startsWith('gen-eligibility'))).toBe(true);
      // Documents criteria generated
      expect(criteria.some((c) => c.id.startsWith('gen-doc'))).toBe(true);
      // Official sources criteria generated
      expect(criteria.some((c) => c.id === 'gen-source-verification')).toBe(true);
      // Fees criteria generated
      expect(criteria.some((c) => c.id === 'gen-fees-check')).toBe(true);
      // Procedure criteria generated
      expect(criteria.some((c) => c.id === 'gen-proc-sla')).toBe(true);
    });

    it('gracefully handles missing criteria and synthesizes safe defaults for empty service', () => {
      const criteria = generateReadinessCriteriaForService(mockServiceMissingData);
      expect(criteria.length).toBeGreaterThanOrEqual(4);
      expect(criteria.every((c) => c.title && c.whatToVerify && c.weight > 0)).toBe(true);
    });

    it('returns empty array if service is null or undefined', () => {
      expect(generateReadinessCriteriaForService(null)).toEqual([]);
      expect(generateReadinessCriteriaForService(undefined)).toEqual([]);
    });
  });

  describe('Incomplete Item Guidance & Explanation', () => {
    it('ensures each criterion provides actionable "whatToVerify" instructions', () => {
      const criteria = generateReadinessCriteriaForService(mockServiceWithCustomRules);
      criteria.forEach((item) => {
        expect(item.whatToVerify).toBeDefined();
        expect(typeof item.whatToVerify).toBe('string');
        expect(item.whatToVerify.trim().length).toBeGreaterThan(10);
      });
    });

    it('provides common pitfall alerts on incomplete items where applicable', () => {
      const criteria = generateReadinessCriteriaForService(mockServiceWithCustomRules);
      const withPitfalls = criteria.filter((c) => c.commonPitfalls);
      expect(withPitfalls.length).toBeGreaterThan(0);
    });
  });

  describe('Deterministic Score Calculation (0%, Partial, 100%)', () => {
    it('calculates 0% readiness when no checklist items are ticked', () => {
      const result = calculateReadinessScore(mockServiceWithCustomRules, []);
      expect(result.score).toBe(0);
      expect(result.completedCount).toBe(0);
      expect(result.incompleteCount).toBe(result.totalCriteria);
      expect(result.incompleteItems.length).toBe(result.totalCriteria);
      expect(result.completedItems.length).toBe(0);
      expect(result.isReadyForSubmission).toBe(false);
    });

    it('calculates deterministic partial score based strictly on defined item weights', () => {
      const criteria = generateReadinessCriteriaForService(mockServiceWithCustomRules);
      const firstItem = criteria[0];
      const secondItem = criteria[1];
      const expectedWeight = firstItem.weight + secondItem.weight;
      const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      const expectedPercent = Math.round((expectedWeight / totalWeight) * 100);

      const result = calculateReadinessScore(mockServiceWithCustomRules, [firstItem.id, secondItem.id]);
      expect(result.completedWeight).toBe(expectedWeight);
      expect(result.score).toBe(expectedPercent);
      expect(result.completedCount).toBe(2);
      expect(result.incompleteCount).toBe(criteria.length - 2);

      // Verify category stats tracking
      expect(result.categoryStats[firstItem.category].completedCount).toBeGreaterThanOrEqual(1);
    });

    it('calculates 100% readiness when all items are ticked', () => {
      const criteria = generateReadinessCriteriaForService(mockServiceWithCustomRules);
      const allIds = criteria.map((c) => c.id);

      const result = calculateReadinessScore(mockServiceWithCustomRules, allIds);
      expect(result.score).toBe(100);
      expect(result.completedCount).toBe(result.totalCriteria);
      expect(result.incompleteCount).toBe(0);
      expect(result.incompleteItems).toHaveLength(0);
      expect(result.isReadyForSubmission).toBe(true);
    });
  });

  describe('Mandatory Statutory Non-Guarantee Disclaimer', () => {
    it('always includes explicit statutory approval disclaimer in scorecard output', () => {
      const result = calculateReadinessScore(mockServiceWithCustomRules, []);
      expect(result.disclaimer).toBe(APPROVAL_DISCLAIMER_TEXT);
      expect(result.disclaimer).toContain('does NOT guarantee official government approval');
    });
  });

  describe('Missing or Unverified Service Data Confidence Penalty', () => {
    it('evaluates high confidence for verified services with fresh audit dates', () => {
      const confidence = evaluateDataConfidence(mockServiceWithCustomRules);
      expect(confidence.level).toBe('high');
      expect(confidence.score).toBeGreaterThanOrEqual(85);
      expect(confidence.disclosures).toHaveLength(0);
    });

    it('penalizes data confidence when service records lack sources, fees, or audit dates', () => {
      const confidence = evaluateDataConfidence(mockServiceMissingData);
      expect(confidence.level).toBe('low');
      expect(confidence.score).toBeLessThan(60);
      expect(confidence.disclosures.length).toBeGreaterThan(0);
      expect(confidence.disclosures.some((d) => d.includes('portal link is unverified'))).toBe(true);
      expect(confidence.disclosures.some((d) => d.includes('fee structure is unlisted'))).toBe(true);
    });

    it('discloses confidence penalty in scorecard result for incomplete service', () => {
      const result = calculateReadinessScore(mockServiceMissingData, []);
      expect(result.dataConfidence.level).toBe('low');
      expect(result.dataConfidence.disclosures.length).toBeGreaterThan(0);
      // Even if citizen checks all synthesized items, submission readiness is blocked by low data confidence
      const allIds = result.allCriteria.map((c) => c.id);
      const fullResult = calculateReadinessScore(mockServiceMissingData, allIds);
      expect(fullResult.score).toBe(100);
      expect(fullResult.isReadyForSubmission).toBe(false);
    });
  });

  describe('Local Progress Persistence (Save and Resume Later)', () => {
    it('saves readiness progress to storage and retrieves it', () => {
      const checked = ['bc-eligibility-parent', 'bc-doc-discharge'];
      const saved = saveReadinessProgress('birth-certificate', checked, 'Original hospital letter ready', mockStorage);

      expect(saved).toBeDefined();
      expect(saved.serviceId).toBe('birth-certificate');
      expect(saved.checkedIds).toEqual(checked);
      expect(saved.notes).toBe('Original hospital letter ready');

      const retrieved = getReadinessProgress('birth-certificate', mockStorage);
      expect(retrieved).toBeDefined();
      expect(retrieved.checkedIds).toEqual(checked);
    });

    it('resets saved progress on request', () => {
      saveReadinessProgress('birth-certificate', ['bc-eligibility-parent'], '', mockStorage);
      expect(getReadinessProgress('birth-certificate', mockStorage)).not.toBeNull();

      resetReadinessProgress('birth-certificate', mockStorage);
      expect(getReadinessProgress('birth-certificate', mockStorage)).toBeNull();
    });

    it('returns null safely if serviceId is invalid or absent', () => {
      expect(saveReadinessProgress('', [], '', mockStorage)).toBeNull();
      expect(getReadinessProgress('', mockStorage)).toBeNull();
      expect(resetReadinessProgress('', mockStorage)).toBe(false);
    });
  });
});
