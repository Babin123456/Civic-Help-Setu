import { describe, it, expect } from 'vitest';
import {
  tokenize,
  extractCriteriaList,
  mapTextToDimension,
  areCriteriaEquivalent,
  explainEligibilityComparison,
  CRITERIA_STATUS,
  NOT_STATED_IN_CATALOGUE,
} from './eligibilityComparisonExplainerService';

describe('eligibilityComparisonExplainerService (#401)', () => {
  const serviceA = {
    id: 'pension-old-age',
    title: 'Senior Citizen Destitute Pension',
    department: 'Social Welfare Department',
    eligibility: [
      'Age must be 60 years or above',
      'Annual family income below ₹50,000 (BPL card holder)',
      'Permanent resident of Karnataka state',
    ],
  };

  const serviceB = {
    id: 'pension-disability',
    title: 'Divyangjan Disability Pension',
    department: 'Department for Empowerment of Persons with Disabilities',
    eligibility: [
      'Person with disability (40% or higher certified benchmark disability)',
      'Annual family income below ₹1,50,000',
      'Permanent resident of Karnataka state',
    ],
  };

  const serviceC = {
    id: 'student-scholarship',
    title: 'Post-Matric Merit Scholarship',
    department: 'Higher Education Department',
    eligibility: [
      'Student enrolled in recognized college or polytechnic',
      'Permanent resident of Karnataka state',
    ],
  };

  describe('criteria extraction and dimension classification', () => {
    it('extracts criteria list from arrays and strings', () => {
      expect(extractCriteriaList(serviceA)).toHaveLength(3);
      expect(extractCriteriaList({ eligibility: 'Rule 1\nRule 2; Rule 3' })).toHaveLength(3);
      expect(extractCriteriaList(null)).toEqual([]);
    });

    it('maps text to proper dimensions correctly', () => {
      expect(mapTextToDimension('Age must be 60 years or above')).toBe('age');
      expect(mapTextToDimension('Annual family income below ₹50,000')).toBe('income');
      expect(mapTextToDimension('Permanent resident of Karnataka state')).toBe('residency');
      expect(mapTextToDimension('Small and marginal farmer with landholding')).toBe('occupation');
    });

    it('tests criteria equivalence accurately', () => {
      expect(
        areCriteriaEquivalent(
          'Permanent resident of Karnataka state',
          'Permanent resident of Karnataka state'
        )
      ).toBe(true);
      expect(
        areCriteriaEquivalent('Annual income under ₹50,000', 'Annual income under ₹2,00,000')
      ).toBe(false);
    });
  });

  describe('two-service comparison', () => {
    it('identifies shared, differing, and service-specific conditions', () => {
      const comparison = explainEligibilityComparison([serviceA, serviceB]);

      expect(comparison.services).toHaveLength(2);
      expect(comparison.dimensions.length).toBeGreaterThan(3);

      // Residency is shared across both (Karnataka resident)
      const residencyDim = comparison.dimensions.find((d) => d.dimensionId === 'residency');
      expect(residencyDim).toBeDefined();
      expect(residencyDim.status).toBe(CRITERIA_STATUS.SHARED);

      // Income is differing (₹50k vs ₹1.5L)
      const incomeDim = comparison.dimensions.find((d) => d.dimensionId === 'income');
      expect(incomeDim).toBeDefined();
      expect(incomeDim.status).toBe(CRITERIA_STATUS.DIFFERING);

      // Age is service-specific (specified for service A, unstated for service B)
      const ageDim = comparison.dimensions.find((d) => d.dimensionId === 'age');
      expect(ageDim).toBeDefined();
      expect(ageDim.status).toBe(CRITERIA_STATUS.SERVICE_SPECIFIC);
      expect(ageDim.serviceEntries.find((e) => e.serviceId === serviceB.id).text).toBe(
        NOT_STATED_IN_CATALOGUE
      );
    });

    it('explicitly distinguishes "not stated in catalogue" from "ineligible"', () => {
      const comparison = explainEligibilityComparison([serviceA, serviceB]);
      const ageEntryB = comparison.dimensions
        .find((d) => d.dimensionId === 'age')
        .serviceEntries.find((e) => e.serviceId === serviceB.id);

      expect(ageEntryB.text).toBe(NOT_STATED_IN_CATALOGUE);
      expect(ageEntryB.hasRequirement).toBe(false);
      expect(comparison.advisoryNotice).toContain(
        'does NOT mean you are ineligible. Always verify with the governing department.'
      );
    });
  });

  describe('three-service comparison with incomplete records', () => {
    it('handles three services and classifies dimensions across all three accurately', () => {
      const comparison = explainEligibilityComparison([serviceA, serviceB, serviceC]);

      expect(comparison.services).toHaveLength(3);

      // Residency is shared across all 3
      const residencyDim = comparison.dimensions.find((d) => d.dimensionId === 'residency');
      expect(residencyDim.status).toBe(CRITERIA_STATUS.SHARED);

      // Occupation: student scholarship specifies student, others do not
      const occDim = comparison.dimensions.find((d) => d.dimensionId === 'occupation');
      expect(occDim.status).toBe(CRITERIA_STATUS.SERVICE_SPECIFIC);

      // Summary counts
      expect(comparison.summary.totalDimensionsCompared).toBe(6);
      expect(comparison.summary.sharedCount).toBeGreaterThanOrEqual(1);
    });

    it('returns empty structure with advisory notice when fewer than 2 services passed', () => {
      const comparison = explainEligibilityComparison([serviceA]);
      expect(comparison.services).toHaveLength(0);
      expect(comparison.advisoryNotice).toContain('Select at least two services');
    });
  });
});
