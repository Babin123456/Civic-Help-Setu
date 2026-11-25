/**
 * src/services/waterQualityRulesEngine.test.js
 * Unit tests for deterministic IS 10500:2012 evaluation rules engine (#754).
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateParameterValue,
  evaluateSampleResultsBatch,
  COMPLIANCE_LEVELS,
  RULESET_VERSION,
} from './waterQualityRulesEngine.js';

describe('Water Quality Rules Engine - IS 10500:2012 (#754)', () => {
  describe('Single Parameter Evaluations', () => {
    it('evaluates pH within acceptable limits (6.5 - 8.5) as ACCEPTABLE', () => {
      const res = evaluateParameterValue('ph', 7.4);
      expect(res.level).toBe(COMPLIANCE_LEVELS.ACCEPTABLE);
      expect(res.compliant).toBe(true);
      expect(res.citation).toContain('IS 10500:2012');
    });

    it('evaluates pH below 6.5 as HAZARDOUS_EXCEEDED (no relaxation)', () => {
      const res = evaluateParameterValue('ph', 6.1);
      expect(res.level).toBe(COMPLIANCE_LEVELS.HAZARDOUS_EXCEEDED);
      expect(res.compliant).toBe(false);
    });

    it('evaluates TDS between 500 and 2000 as PERMISSIBLE_WARNING', () => {
      const res = evaluateParameterValue('tds', 850);
      expect(res.level).toBe(COMPLIANCE_LEVELS.PERMISSIBLE_WARNING);
      expect(res.inAbsenceOfAlternative).toBe(true);
      expect(res.message).toContain('absence of alternate source');
    });

    it('evaluates TDS above 2000 as HAZARDOUS_EXCEEDED', () => {
      const res = evaluateParameterValue('tds', 2400);
      expect(res.level).toBe(COMPLIANCE_LEVELS.HAZARDOUS_EXCEEDED);
      expect(res.compliant).toBe(false);
    });

    it('flags any presence of E. coli (> 0 MPN/100mL) as critical pathogen hazard', () => {
      const res = evaluateParameterValue('e_coli', 2);
      expect(res.level).toBe(COMPLIANCE_LEVELS.HAZARDOUS_EXCEEDED);
      expect(res.isMicrobialRisk).toBe(true);
      expect(res.compliant).toBe(false);
      expect(res.message).toContain('Microbiological pathogen detected');
    });

    it('evaluates 0 E. coli as ACCEPTABLE', () => {
      const res = evaluateParameterValue('e_coli', 0);
      expect(res.level).toBe(COMPLIANCE_LEVELS.ACCEPTABLE);
      expect(res.compliant).toBe(true);
      expect(res.isMicrobialRisk).toBe(false);
    });
  });

  describe('Batch Evaluation & Explainability Provenance', () => {
    it('evaluates compliant batch and records provenance metadata without AI hallucination', () => {
      const batch = [
        { parameterCode: 'ph', testedValue: 7.2 },
        { parameterCode: 'tds', testedValue: 350 },
        { parameterCode: 'turbidity', testedValue: 0.8 },
        { parameterCode: 'e_coli', testedValue: 0 },
      ];

      const summary = evaluateSampleResultsBatch(batch);
      expect(summary.isFullyCompliant).toBe(true);
      expect(summary.overallStatus).toBe('compliant');
      expect(summary.exceededCount).toBe(0);
      expect(summary.provenance).toBeDefined();
      expect(summary.provenance.rulesetVersion).toBe(RULESET_VERSION);
      expect(summary.provenance.standard).toBe('IS 10500:2012');
      expect(summary.provenance.humanDecisionRequired).toBe(true);
      expect(summary.provenance.diagnosticDisclaimer).toContain('Not medical or clinical advice');
    });

    it('detects pathogen contamination and suggests chlorination shock', () => {
      const batch = [
        { parameterCode: 'ph', testedValue: 7.5 },
        { parameterCode: 'e_coli', testedValue: 4 },
      ];

      const summary = evaluateSampleResultsBatch(batch);
      expect(summary.isFullyCompliant).toBe(false);
      expect(summary.overallStatus).toBe('critical_hazard');
      expect(summary.containsMicrobialHazard).toBe(true);
      expect(summary.suggestedAction.actionType).toBe('chlorination_shock');
      expect(summary.suggestedAction.priority).toBe('high');
    });

    it('detects exceeded chemical parameters and provides explainable factor list', () => {
      const batch = [
        { parameterCode: 'ph', testedValue: 7.5 },
        { parameterCode: 'iron', testedValue: 2.5 }, // Exceeds 1.0 mg/L limit
      ];

      const summary = evaluateSampleResultsBatch(batch);
      expect(summary.overallStatus).toBe('exceeded');
      expect(summary.exceededCount).toBe(1);
      expect(summary.provenance.influencingParameters[0].code).toBe('iron');
    });
  });
});
