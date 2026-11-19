import { describe, it, expect, beforeEach } from 'vitest';
import {
  EVALUATION_OUTCOME,
  TEST_CASE_SEVERITY,
  PUBLISH_READINESS,
  REVIEWER_ROLE,
  STATUTORY_RULE_TEST_DISCLAIMER,
  BUILT_IN_RULES,
  SYNTHETIC_EWS_TEST_CASES,
  evaluateRuleCase,
  runTestSuite,
  compareRuleVersions,
  getAccessibleScenarioMatrix,
  recordReviewDecision,
  getRuleReviewHistory,
  sanitizeRuleReviewRecordForExport,
  _resetRuleReviewStore,
} from './civicServiceRuleTestCaseVisualizerService.js';

describe('CivicServiceRuleTestCaseVisualizerService', () => {
  beforeEach(() => {
    _resetRuleReviewStore();
  });

  describe('evaluateRuleCase (Deterministic Evaluator)', () => {
    it('throws error when rule or test case is invalid', () => {
      expect(() => evaluateRuleCase(null, {})).toThrow('Valid rule with conditions array is required');
      expect(() => evaluateRuleCase(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, null)).toThrow(
        'Valid testCase with inputs object is required'
      );
    });

    it('evaluates standard eligible scenario as PASS', () => {
      const tc = SYNTHETIC_EWS_TEST_CASES.find((c) => c.testCaseId === 'TC_EWS_001_STANDARD_PASS');
      const result = evaluateRuleCase(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, tc);

      expect(result.actualOutcome).toBe(EVALUATION_OUTCOME.PASS);
      expect(result.matchedExpectation).toBe(true);
      expect(result.failureReasons).toHaveLength(0);
      expect(result.evaluatedPath.length).toBe(3);
    });

    it('evaluates income breach scenario as FAIL with explicit failure reason', () => {
      const tc = SYNTHETIC_EWS_TEST_CASES.find((c) => c.testCaseId === 'TC_EWS_002_INCOME_FAIL');
      const result = evaluateRuleCase(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, tc);

      expect(result.actualOutcome).toBe(EVALUATION_OUTCOME.FAIL);
      expect(result.matchedExpectation).toBe(true);
      expect(result.failureReasons.length).toBeGreaterThan(0);
      expect(result.failureReasons[0]).toContain('grossAnnualIncomeINR');
    });

    it('evaluates exact threshold boundary as PASS (inclusive boundary)', () => {
      const tc = SYNTHETIC_EWS_TEST_CASES.find((c) => c.testCaseId === 'TC_EWS_003_INCOME_BOUNDARY_PASS');
      const result = evaluateRuleCase(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, tc);

      expect(result.actualOutcome).toBe(EVALUATION_OUTCOME.PASS);
      expect(result.matchedExpectation).toBe(true);
    });

    it('returns INDETERMINATE without guessing when required parameters are omitted', () => {
      const tc = SYNTHETIC_EWS_TEST_CASES.find((c) => c.testCaseId === 'TC_EWS_006_INDETERMINATE_MISSING_LAND');
      const result = evaluateRuleCase(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, tc);

      expect(result.actualOutcome).toBe(EVALUATION_OUTCOME.INDETERMINATE);
      expect(result.matchedExpectation).toBe(true);
      const missingStep = result.evaluatedPath.find((p) => p.status === 'MISSING_DATA');
      expect(missingStep).toBeDefined();
      expect(missingStep.field).toBe('agriculturalLandAcres');
    });

    it('evaluates conditional exception in V2 correctly', () => {
      const tc = SYNTHETIC_EWS_TEST_CASES.find((c) => c.testCaseId === 'TC_EWS_005_RURAL_EXCEPTION_SHIFT');

      // In V1 (no rural exception): FAIL because 6 acres > 5 acres
      const resultV1 = evaluateRuleCase(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, tc);
      expect(resultV1.actualOutcome).toBe(EVALUATION_OUTCOME.FAIL);

      // In V2 (rural dry land exception threshold is 7.5 acres): PASS because 6 <= 7.5
      const resultV2 = evaluateRuleCase(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V2, tc);
      expect(resultV2.actualOutcome).toBe(EVALUATION_OUTCOME.PASS);
      expect(resultV2.matchedExpectation).toBe(true);
    });
  });

  describe('runTestSuite', () => {
    it('runs full test suite and computes outcome distribution', () => {
      const suiteResult = runTestSuite(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V2, SYNTHETIC_EWS_TEST_CASES);

      expect(suiteResult.ruleId).toBe('RULE_EWS_ELIGIBILITY');
      expect(suiteResult.totalCases).toBe(SYNTHETIC_EWS_TEST_CASES.length);
      expect(suiteResult.distribution.passed).toBeGreaterThan(0);
      expect(suiteResult.distribution.failed).toBeGreaterThan(0);
      expect(suiteResult.distribution.indeterminate).toBeGreaterThan(0);
      expect(suiteResult.publishReadiness).toBe(PUBLISH_READINESS.READY_TO_PUBLISH);
      expect(suiteResult.statutoryDisclaimer).toBe(STATUTORY_RULE_TEST_DISCLAIMER);
    });

    it('flags blocked publish readiness if expected outcomes do not match', () => {
      // In V1, TC_EWS_005 expects PASS (for V2), so evaluating it against V1 triggers a discrepancy
      const suiteV1 = runTestSuite(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, SYNTHETIC_EWS_TEST_CASES);
      expect(suiteV1.publishReadiness).toBe(PUBLISH_READINESS.BLOCKED_BY_FAILURES);
      expect(suiteV1.distribution.matchPercentage).toBeLessThan(100);
    });

    it('returns NO_TEST_CASES_EVALUATED for empty test case array', () => {
      const emptySuite = runTestSuite(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, []);
      expect(emptySuite.publishReadiness).toBe(PUBLISH_READINESS.NO_TEST_CASES_EVALUATED);
      expect(emptySuite.totalCases).toBe(0);
    });

    it('throws error when rule is missing', () => {
      expect(() => runTestSuite(null)).toThrow('Rule is required to run test suite');
    });
  });

  describe('compareRuleVersions (Version Comparison Diff)', () => {
    it('identifies exact outcome shifts between current and draft rules', () => {
      const diffReport = compareRuleVersions(
        BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1,
        BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V2,
        SYNTHETIC_EWS_TEST_CASES
      );

      expect(diffReport.currentVersion).toBe('1.0.0');
      expect(diffReport.draftVersion).toBe('2.0.0');
      expect(diffReport.totalOutcomeShifts).toBe(1);

      const shiftedCase = diffReport.scenarioDiffs.find((d) => d.testCaseId === 'TC_EWS_005_RURAL_EXCEPTION_SHIFT');
      expect(shiftedCase).toBeDefined();
      expect(shiftedCase.hasOutcomeShift).toBe(true);
      expect(shiftedCase.currentOutcome).toBe(EVALUATION_OUTCOME.FAIL);
      expect(shiftedCase.draftOutcome).toBe(EVALUATION_OUTCOME.PASS);
      expect(shiftedCase.shiftExplanation).toContain('Shifted from FAIL');
    });

    it('throws error when rules are missing', () => {
      expect(() => compareRuleVersions(null, BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V2)).toThrow(
        'Both currentRule and draftRule are required'
      );
    });
  });

  describe('getAccessibleScenarioMatrix', () => {
    it('generates accessible tabular summary rows', () => {
      const suite = runTestSuite(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V2, SYNTHETIC_EWS_TEST_CASES);
      const matrix = getAccessibleScenarioMatrix(suite);

      expect(Array.isArray(matrix)).toBe(true);
      expect(matrix.length).toBe(SYNTHETIC_EWS_TEST_CASES.length);

      const firstRow = matrix[0];
      expect(firstRow.testCaseId).toBeDefined();
      expect(firstRow.severity).toBe(TEST_CASE_SEVERITY.STANDARD);
      expect(firstRow.status).toBe('MATCHED');
    });

    it('throws error on invalid suite result', () => {
      expect(() => getAccessibleScenarioMatrix(null)).toThrow('Valid suiteResult with caseResults array is required');
    });
  });

  describe('Review Notes, Decisions & Publication Gatekeeper', () => {
    it('allows CATALOGUE_ADMIN to approve rule with passing test suite', () => {
      const suiteV2 = runTestSuite(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V2, SYNTHETIC_EWS_TEST_CASES);

      const decision = recordReviewDecision({
        ruleId: 'RULE_EWS_ELIGIBILITY',
        ruleVersion: '2.0.0',
        reviewerId: 'admin_officer_verma',
        reviewerRole: REVIEWER_ROLE.CATALOGUE_ADMIN,
        decision: 'APPROVED',
        reviewNotes: 'Comprehensive dry-land rural exception vetted across all synthetic boundary cases.',
        suiteResult: suiteV2,
      });

      expect(decision.decisionId).toBeDefined();
      expect(decision.decision).toBe('APPROVED');
      expect(decision.statutoryDisclaimer).toBe(STATUTORY_RULE_TEST_DISCLAIMER);

      const history = getRuleReviewHistory('RULE_EWS_ELIGIBILITY', REVIEWER_ROLE.CATALOGUE_ADMIN);
      expect(history).toHaveLength(1);
      expect(history[0].reviewerId).toBe('admin_officer_verma');
    });

    it('publication gatekeeper blocks approval when test suite has failures or discrepancies', () => {
      // In V1, discrepancies exist
      const suiteV1 = runTestSuite(BUILT_IN_RULES.RULE_EWS_ELIGIBILITY_V1, SYNTHETIC_EWS_TEST_CASES);

      expect(() =>
        recordReviewDecision({
          ruleId: 'RULE_EWS_ELIGIBILITY',
          ruleVersion: '1.0.0',
          reviewerId: 'admin_officer_verma',
          reviewerRole: REVIEWER_ROLE.CATALOGUE_ADMIN,
          decision: 'APPROVED',
          reviewNotes: 'Attempting to approve prematurely despite failing cases.',
          suiteResult: suiteV1,
        })
      ).toThrow('Publication Gatekeeper: Cannot approve rule while synthetic test cases have unresolved failures');
    });

    it('requires minimum 15 characters in review notes', () => {
      expect(() =>
        recordReviewDecision({
          ruleId: 'RULE_EWS_ELIGIBILITY',
          ruleVersion: '2.0.0',
          reviewerId: 'admin_1',
          reviewerRole: REVIEWER_ROLE.CATALOGUE_ADMIN,
          decision: 'APPROVED',
          reviewNotes: 'Too short',
        })
      ).toThrow('Detailed review notes of at least 15 characters are required');
    });

    it('rejects unauthorized reviewer role', () => {
      expect(() =>
        recordReviewDecision({
          ruleId: 'RULE_EWS_ELIGIBILITY',
          ruleVersion: '2.0.0',
          reviewerId: 'guest_user',
          reviewerRole: REVIEWER_ROLE.VIEWER,
          decision: 'APPROVED',
          reviewNotes: 'Unauthorized citizen review attempt',
        })
      ).toThrow('Permission Denied');
    });

    it('sanitizes review record for export', () => {
      const decision = recordReviewDecision({
        ruleId: 'RULE_EWS_ELIGIBILITY',
        ruleVersion: '2.0.0',
        reviewerId: 'admin_officer_verma',
        reviewerRole: REVIEWER_ROLE.CATALOGUE_ADMIN,
        decision: 'APPROVED',
        reviewNotes: 'Detailed audit verification of synthetic boundary conditions completed.',
      });

      const exported = sanitizeRuleReviewRecordForExport(decision);
      expect(exported.reviewerMasked).toBe('rev_***_rma');
      expect(exported.reviewerId).toBeUndefined();
    });

    it('returns null on invalid export record', () => {
      expect(sanitizeRuleReviewRecordForExport(null)).toBeNull();
    });
  });
});
