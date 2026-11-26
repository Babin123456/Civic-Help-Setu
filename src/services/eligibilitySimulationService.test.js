import { describe, it, expect } from 'vitest';
import {
  simulateEligibility,
  simulateAllRegisteredSchemes,
  OFFICIAL_DETERMINATION_DISCLAIMER,
} from './eligibilitySimulationService.js';

describe('eligibilitySimulationService', () => {
  describe('simulateEligibility', () => {
    it('returns ELIGIBLE and satisfied criteria with provenance citations', () => {
      const profile = {
        employment: 'farmer',
        ownsAgriculturalLand: true,
        annualIncome: 180000,
        hasAadhaar: true,
      };

      const result = simulateEligibility('pm-kisan', profile);
      expect(result.success).toBe(true);
      expect(result.schemeId).toBe('pm-kisan');
      expect(result.status).toBe('CONDITIONAL'); // Needs Patwari verification
      expect(result.criteria.length).toBeGreaterThan(0);

      // Check citations on criteria
      const landCriterion = result.criteria.find((c) => c.id === 'pm_kisan_landholding');
      expect(landCriterion.state).toBe('satisfied');
      expect(landCriterion.citation).toBeDefined();
      expect(landCriterion.citation.authority).toContain('Ministry of Agriculture');

      // Check official disclaimer
      expect(result.disclaimer).toBe(OFFICIAL_DETERMINATION_DISCLAIMER);
    });

    it('identifies boundary income proximity (within 5%)', () => {
      const boundaryProfile = {
        employment: 'farmer',
        ownsAgriculturalLand: true,
        annualIncome: 395000, // Very close to 400000 ceiling
        hasAadhaar: true,
      };

      const result = simulateEligibility('pm-kisan', boundaryProfile);
      expect(result.boundaryWarnings.length).toBeGreaterThan(0);
      expect(result.boundaryWarnings[0].notice).toContain('within 5% of the statutory threshold');
    });

    it('identifies critical boundary date warnings for birth registration', () => {
      const nearDeadlineProfile = {
        birthRegistrationDays: 19, // Day 19 of 21 statutory days
        hasAadhaar: true,
        hasHospitalBirthSlip: true,
      };

      const result = simulateEligibility('birth-certificate-delayed', nearDeadlineProfile);
      expect(result.boundaryWarnings.length).toBeGreaterThan(0);
      expect(result.boundaryWarnings[0].notice).toContain('CRITICAL DEADLINE');
      expect(result.boundaryWarnings[0].notice).toContain('2 day(s) remain');
    });

    it('detects conflicting evidence between declared income and BPL card claims', () => {
      const conflictProfile = {
        ownsPuccaHouse: false,
        annualIncome: 450000, // High income
        hasBplCard: true,     // Conflicting with high income
      };

      const result = simulateEligibility('pmay-u', conflictProfile);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].conflict.message).toContain('exceeds the statutory BPL threshold');
    });

    it('generates actionable counterfactuals when applicant is ineligible', () => {
      const ineligibleProfile = {
        employment: 'salaried',
        ownsAgriculturalLand: false,
        annualIncome: 550000,
        hasAadhaar: false,
      };

      const result = simulateEligibility('pm-kisan', ineligibleProfile);
      expect(result.status).toBe('INELIGIBLE');
      expect(result.counterfactuals.length).toBeGreaterThan(0);
      expect(result.counterfactuals[0].changes.length).toBeGreaterThan(0);
    });

    it('rejects forbidden PII fields at service boundary safely', () => {
      const taintedProfile = {
        annualIncome: 200000,
        aadhaarNumber: '9999-8888-7777', // Forbidden PII
      };

      const result = simulateEligibility('pm-kisan', taintedProfile);
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden identity fields');
    });

    it('handles non-existent scheme gracefully', () => {
      const result = simulateEligibility('imaginary-scheme-xyz', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in registry');
    });
  });

  describe('simulateAllRegisteredSchemes', () => {
    it('evaluates all schemes across the registry successfully', () => {
      const profile = {
        age: 32,
        annualIncome: 200000,
        employment: 'farmer',
        ownsAgriculturalLand: true,
        hasAadhaar: true,
        hasBplCard: false,
      };

      const results = simulateAllRegisteredSchemes(profile);
      expect(results.length).toBeGreaterThanOrEqual(4);
      for (const res of results) {
        expect(res.schemeId).toBeDefined();
        expect(res.disclaimer).toBe(OFFICIAL_DETERMINATION_DISCLAIMER);
      }
    });
  });
});
