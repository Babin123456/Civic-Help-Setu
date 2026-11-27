import { describe, it, expect } from 'vitest';
import {
  JURISDICTION_LEVELS,
  EVALUATION_OUTCOME,
  INDETERMINATE_REASON,
  STATUTORY_DISCLAIMER,
  isValidIsoDate,
  validateRuleSchema,
  detectSupersessionCycles,
  validateTemporalRuleSet,
  detectTemporalAnomalies,
  resolveAsOfRule,
  evaluateCondition,
  computeRuleDigest,
  evaluateEffectiveDatedPolicy,
  createEvaluationSnapshot,
  simulatePolicyAcrossDates,
} from './temporalPolicyEngineService';
import {
  SYNTHETIC_EWS_PROGRESSION_RULES,
  SYNTHETIC_GAP_RULES,
  SYNTHETIC_CONFLICT_RULES,
  SYNTHETIC_CYCLIC_RULES,
  SYNTHETIC_UNVERIFIED_RULE,
  SYNTHETIC_CITIZEN_CASES,
} from '../test/fixtures/temporalPolicyFixtures';

describe('Temporal Policy Engine Service (#1155)', () => {
  describe('ISO Date and Schema Validation Boundary Defense', () => {
    it('accurately identifies valid and invalid ISO 8601 date strings', () => {
      expect(isValidIsoDate('2022-04-01T00:00:00.000Z')).toBe(true);
      expect(isValidIsoDate('2026-11-26')).toBe(true);
      expect(isValidIsoDate('not-a-date')).toBe(false);
      expect(isValidIsoDate('')).toBe(false);
      expect(isValidIsoDate(null)).toBe(false);
      expect(isValidIsoDate(12345678)).toBe(false);
    });

    it('accepts a fully conformant EffectiveDatedRule', () => {
      const validRule = SYNTHETIC_EWS_PROGRESSION_RULES[0];
      const res = validateRuleSchema(validRule);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects rules missing essential identity or jurisdiction attributes', () => {
      const invalidRule = {
        title: 'Malformed Rule',
      };
      const res = validateRuleSchema(invalidRule);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('rule.id'))).toBe(true);
      expect(res.errors.some((e) => e.includes('rule.ruleFamilyId'))).toBe(true);
      expect(res.errors.some((e) => e.includes('rule.jurisdictionLevel'))).toBe(true);
      expect(res.errors.some((e) => e.includes('rule.effectiveFrom'))).toBe(true);
    });

    it('rejects rules where effectiveTo precedes effectiveFrom', () => {
      const invertedRule = {
        ...SYNTHETIC_EWS_PROGRESSION_RULES[0],
        id: 'rule_inverted',
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        effectiveTo: '2023-01-01T00:00:00.000Z',
      };
      const res = validateRuleSchema(invertedRule);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('effectiveTo cannot precede'))).toBe(true);
    });

    it('rejects malformed condition elements', () => {
      const malformedRule = {
        ...SYNTHETIC_EWS_PROGRESSION_RULES[0],
        id: 'rule_bad_cond',
        conditions: [{ field: 'income' /* missing operator */ }],
      };
      const res = validateRuleSchema(malformedRule);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('operator is required'))).toBe(true);
    });
  });

  describe('Supersession DAG Cycle Detection', () => {
    it('passes for linear and acyclic supersession lineages', () => {
      const res = detectSupersessionCycles(SYNTHETIC_EWS_PROGRESSION_RULES);
      expect(res.hasCycle).toBe(false);
      expect(res.cyclePath).toHaveLength(0);
    });

    it('detects and flags circular supersession chains', () => {
      const res = detectSupersessionCycles(SYNTHETIC_CYCLIC_RULES);
      expect(res.hasCycle).toBe(true);
      expect(res.cyclePath.length).toBeGreaterThan(0);
    });

    it('validates an entire rule set, blocking deployment if a cycle is present', () => {
      const setValidation = validateTemporalRuleSet(SYNTHETIC_CYCLIC_RULES);
      expect(setValidation.valid).toBe(false);
      expect(setValidation.errors[0]).toContain('circular dependency');
    });
  });

  describe('Continuous Timeline Interval Analysis (Gaps & Conflicts)', () => {
    it('reports zero gaps and zero conflicts for seamless progressive timelines', () => {
      const anomalies = detectTemporalAnomalies(SYNTHETIC_EWS_PROGRESSION_RULES, 'syn_scheme_ews', 'IN-TEST');
      expect(anomalies.gaps).toHaveLength(0);
      expect(anomalies.conflicts).toHaveLength(0);
    });

    it('identifies uncoordinated overlapping policy rules as conflicts', () => {
      const anomalies = detectTemporalAnomalies(SYNTHETIC_CONFLICT_RULES, 'syn_conflict_scheme', 'IN-CONF');
      expect(anomalies.conflicts.length).toBeGreaterThanOrEqual(1);
      const conflict = anomalies.conflicts[0];
      expect(conflict.ruleAId).toBe('syn_conflict_rule_1');
      expect(conflict.ruleBId).toBe('syn_conflict_rule_2');
      expect(conflict.overlapStart).toBe('2023-01-01T00:00:00.000Z');
    });

    it('detects temporal coverage gaps where no active rule covers an interval', () => {
      const anomalies = detectTemporalAnomalies(SYNTHETIC_GAP_RULES, 'syn_gap_scheme', 'IN-GAP');
      expect(anomalies.gaps).toHaveLength(1);
      const gap = anomalies.gaps[0];
      expect(gap.priorRuleId).toBe('syn_gap_rule_a');
      expect(gap.nextRuleId).toBe('syn_gap_rule_b');
      expect(gap.gapStart).toBe('2021-06-30T23:59:59.999Z');
      expect(gap.gapEnd).toBe('2022-01-01T00:00:00.000Z');
    });
  });

  describe('Point-in-Time ("As-Of") Resolution', () => {
    it('returns NO_APPLICABLE_RULE_FOUND when querying a date before any enactment', () => {
      const res = resolveAsOfRule({
        rules: SYNTHETIC_EWS_PROGRESSION_RULES,
        ruleFamilyId: 'syn_scheme_ews',
        jurisdictionCode: 'IN-TEST',
        asOfDate: '2016-01-01T00:00:00.000Z',
      });
      expect(res.rule).toBeNull();
      expect(res.status).toBe(INDETERMINATE_REASON.NO_APPLICABLE_RULE_FOUND);
    });

    it('resolves historical Phase 1 rule for an event date in 2019', () => {
      const res = resolveAsOfRule({
        rules: SYNTHETIC_EWS_PROGRESSION_RULES,
        ruleFamilyId: 'syn_scheme_ews',
        jurisdictionCode: 'IN-TEST',
        asOfDate: '2019-06-15T12:00:00.000Z',
      });
      expect(res.rule).toBeDefined();
      expect(res.rule.id).toBe('syn_rule_ews_v1');
      expect(res.rule.version).toBe('1.0.0');
    });

    it('resolves boundary cut-offs accurately without off-by-one errors', () => {
      // 1 ms before v2 begins -> matches v1
      const resV1 = resolveAsOfRule({
        rules: SYNTHETIC_EWS_PROGRESSION_RULES,
        ruleFamilyId: 'syn_scheme_ews',
        jurisdictionCode: 'IN-TEST',
        asOfDate: '2021-03-31T23:59:59.999Z',
      });
      expect(resV1.rule.id).toBe('syn_rule_ews_v1');

      // Exactly when v2 begins -> matches v2
      const resV2 = resolveAsOfRule({
        rules: SYNTHETIC_EWS_PROGRESSION_RULES,
        ruleFamilyId: 'syn_scheme_ews',
        jurisdictionCode: 'IN-TEST',
        asOfDate: '2021-04-01T00:00:00.000Z',
      });
      expect(resV2.rule.id).toBe('syn_rule_ews_v2');
    });

    it('resolves active open-ended Phase 3 rule for current / future queries', () => {
      const res = resolveAsOfRule({
        rules: SYNTHETIC_EWS_PROGRESSION_RULES,
        ruleFamilyId: 'syn_scheme_ews',
        jurisdictionCode: 'IN-TEST',
        asOfDate: '2026-11-26T00:00:00.000Z',
      });
      expect(res.rule).toBeDefined();
      expect(res.rule.id).toBe('syn_rule_ews_v3');
      expect(res.rule.effectiveTo).toBeNull();
    });

    it('flags TEMPORAL_GAP_DETECTED when the query falls inside an unlegislated gap', () => {
      const res = resolveAsOfRule({
        rules: SYNTHETIC_GAP_RULES,
        ruleFamilyId: 'syn_gap_scheme',
        jurisdictionCode: 'IN-GAP',
        asOfDate: '2021-09-15T00:00:00.000Z',
      });
      expect(res.rule).toBeNull();
      expect(res.status).toBe(INDETERMINATE_REASON.TEMPORAL_GAP_DETECTED);
      expect(res.gapDetails).toBeDefined();
      expect(res.gapDetails.priorRuleId).toBe('syn_gap_rule_a');
      expect(res.gapDetails.nextRuleId).toBe('syn_gap_rule_b');
    });

    it('flags TEMPORAL_CONFLICT_DETECTED when multiple contradictory un-superseded rules overlap', () => {
      const res = resolveAsOfRule({
        rules: SYNTHETIC_CONFLICT_RULES,
        ruleFamilyId: 'syn_conflict_scheme',
        jurisdictionCode: 'IN-CONF',
        asOfDate: '2024-06-01T00:00:00.000Z',
      });
      expect(res.rule).toBeNull();
      expect(res.status).toBe(INDETERMINATE_REASON.TEMPORAL_CONFLICT_DETECTED);
    });

    it('supports fallback to CENTRAL baseline when state-level rule is missing', () => {
      const centralBaseline = {
        ...SYNTHETIC_EWS_PROGRESSION_RULES[0],
        id: 'rule_central_baseline',
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        jurisdictionCode: 'CENTRAL',
        effectiveFrom: '2015-01-01T00:00:00.000Z',
        effectiveTo: null,
      };

      const res = resolveAsOfRule({
        rules: [centralBaseline],
        ruleFamilyId: 'syn_scheme_ews',
        jurisdictionCode: 'IN-NONEXISTENT',
        asOfDate: '2020-01-01T00:00:00.000Z',
        fallbackToCentral: true,
      });

      expect(res.rule).toBeDefined();
      expect(res.rule.id).toBe('rule_central_baseline');
      expect(res.isFallback).toBe(true);
      expect(res.jurisdictionUsed).toBe('CENTRAL');
    });
  });

  describe('Condition Evaluation Operator Coverage', () => {
    it('evaluates numeric comparisons correctly', () => {
      expect(evaluateCondition({ field: 'age', operator: 'GREATER_THAN_OR_EQUAL', value: 60 }, { age: 65 }).passed).toBe(true);
      expect(evaluateCondition({ field: 'age', operator: 'GREATER_THAN_OR_EQUAL', value: 60 }, { age: 59 }).passed).toBe(false);
      expect(evaluateCondition({ field: 'income', operator: 'LESS_THAN', value: 500 }, { income: 499 }).passed).toBe(true);
      expect(evaluateCondition({ field: 'income', operator: 'LESS_THAN', value: 500 }, { income: 500 }).passed).toBe(false);
    });

    it('evaluates string and boolean matches', () => {
      expect(evaluateCondition({ field: 'category', operator: 'EQUALS', value: 'General' }, { category: 'GENERAL' }).passed).toBe(true);
      expect(evaluateCondition({ field: 'category', operator: 'NOT_EQUALS', value: 'OBC' }, { category: 'General' }).passed).toBe(true);
      expect(evaluateCondition({ field: 'state', operator: 'IN_LIST', value: ['IN-MH', 'IN-KA'] }, { state: 'in-mh' }).passed).toBe(true);
      expect(evaluateCondition({ field: 'state', operator: 'IN_LIST', value: ['IN-MH', 'IN-KA'] }, { state: 'IN-DL' }).passed).toBe(false);
      expect(evaluateCondition({ field: 'tags', operator: 'CONTAINS', value: 'bpl' }, { tags: ['ration', 'bpl', 'ayush'] }).passed).toBe(true);
    });

    it('flags missing condition fields', () => {
      const res = evaluateCondition({ field: 'landAcres', operator: 'LESS_THAN', value: 5 }, {});
      expect(res.passed).toBe(false);
      expect(res.missing).toBe(true);
      expect(res.actual).toBeNull();
    });
  });

  describe('Epistemic Humility & Deterministic Evaluation', () => {
    it('strictly refuses to infer conclusions on unverified source circulars', () => {
      const evalRes = evaluateEffectiveDatedPolicy({
        rule: SYNTHETIC_UNVERIFIED_RULE,
        citizenFacts: SYNTHETIC_CITIZEN_CASES.ELIGIBLE_V1_AND_V2,
        asOfDate: '2024-06-01T00:00:00.000Z',
      });

      expect(evalRes.outcome).toBe(EVALUATION_OUTCOME.INDETERMINATE);
      expect(evalRes.reason).toBe(INDETERMINATE_REASON.UNVERIFIED_SOURCE_METADATA);
      expect(evalRes.explanation).toContain('unverified or awaiting catalogue editor scrutiny');
      expect(evalRes.disclaimer).toBe(STATUTORY_DISCLAIMER);
    });

    it('returns INDETERMINATE with missing fields when required facts are absent', () => {
      const evalRes = evaluateEffectiveDatedPolicy({
        rule: SYNTHETIC_EWS_PROGRESSION_RULES[0],
        citizenFacts: SYNTHETIC_CITIZEN_CASES.MISSING_FACTS,
        asOfDate: '2019-01-01T00:00:00.000Z',
      });

      expect(evalRes.outcome).toBe(EVALUATION_OUTCOME.INDETERMINATE);
      expect(evalRes.reason).toBe(INDETERMINATE_REASON.MISSING_INPUT_FACTS);
      expect(evalRes.missingFields).toContain('agriculturalLandAcres');
    });

    it('determines ELIGIBLE when all statutory conditions are met as of event date', () => {
      const evalRes = evaluateEffectiveDatedPolicy({
        rule: SYNTHETIC_EWS_PROGRESSION_RULES[0], // Phase 1: income <= 6L, land < 5 acres
        citizenFacts: SYNTHETIC_CITIZEN_CASES.ELIGIBLE_V1_AND_V2, // income 4.5L, land 2.5 acres
        asOfDate: '2019-06-01T00:00:00.000Z',
      });

      expect(evalRes.outcome).toBe(EVALUATION_OUTCOME.ELIGIBLE);
      expect(evalRes.feesApplicable.amount).toBe(20);
      expect(evalRes.mandatoryDocuments).toContain('Income Certificate');
      expect(evalRes.citations[0].notificationNumber).toBe('SYN-GAZ-2018-01');
      expect(evalRes.ruleDigestHash).toBeDefined();
      expect(evalRes.disclaimer).toBe(STATUTORY_DISCLAIMER);
    });

    it('determines INELIGIBLE with decision path when conditions are breached', () => {
      const evalRes = evaluateEffectiveDatedPolicy({
        rule: SYNTHETIC_EWS_PROGRESSION_RULES[0],
        citizenFacts: SYNTHETIC_CITIZEN_CASES.INELIGIBLE_EXCESS_LAND, // 6.5 acres
        asOfDate: '2019-06-01T00:00:00.000Z',
      });

      expect(evalRes.outcome).toBe(EVALUATION_OUTCOME.INELIGIBLE);
      expect(evalRes.reason).toContain('Criteria not met');
      const failedCond = evalRes.decisionPath.find((d) => !d.passed);
      expect(failedCond.field).toBe('agriculturalLandAcres');
      expect(failedCond.actual).toBe(6.5);
    });
  });

  describe('Immutable Historical Evaluation Snapshot & PII Sanitization', () => {
    it('creates an immutable snapshot with cryptographic hash and zero PII', () => {
      const rule = SYNTHETIC_EWS_PROGRESSION_RULES[0];
      const evalRes = evaluateEffectiveDatedPolicy({
        rule,
        citizenFacts: SYNTHETIC_CITIZEN_CASES.PII_INFUSED_INPUT,
        asOfDate: '2019-05-10T00:00:00.000Z',
        operatorOrCitizenId: 'desk_officer_42',
      });

      const snapshot = createEvaluationSnapshot({
        evaluationResult: evalRes,
        citizenFacts: SYNTHETIC_CITIZEN_CASES.PII_INFUSED_INPUT,
        asOfDate: '2019-05-10T00:00:00.000Z',
        rule,
        operatorOrCitizenId: 'desk_officer_42',
      });

      expect(snapshot.evaluationId).toMatch(/^eval_\d+_[a-z0-9]+$/);
      expect(snapshot.snapshotHash).toHaveLength(64); // SHA-256 hex length
      expect(snapshot.sanitizedFacts.name).toBeUndefined();
      expect(snapshot.sanitizedFacts.email).toBeUndefined();
      expect(snapshot.sanitizedFacts.phone).toBeUndefined();
      expect(snapshot.sanitizedFacts.aadhaar).toBeUndefined();
      expect(snapshot.sanitizedFacts.annualFamilyIncome).toBe(500000);
      expect(snapshot.sanitizedFacts.agriculturalLandAcres).toBe(2.0);
    });

    it('produces identical rule digest hash for equivalent rule content', () => {
      const digest1 = computeRuleDigest(SYNTHETIC_EWS_PROGRESSION_RULES[0]);
      const digest2 = computeRuleDigest({ ...SYNTHETIC_EWS_PROGRESSION_RULES[0] });
      expect(digest1).toBe(digest2);
      expect(digest1).toHaveLength(64);
    });
  });

  describe('Multi-Date Simulation & What-If Analysis', () => {
    it('simulates temporal shifts showing eligibility changes and fee adjustments over time', () => {
      const dates = [
        '2019-05-01T00:00:00.000Z', // Phase 1: ceiling 6L, fee 20 INR
        '2022-06-01T00:00:00.000Z', // Phase 2: ceiling 8L, fee 35 INR
        '2025-01-01T00:00:00.000Z', // Phase 2 still: ceiling 8L, fee 35 INR
      ];

      // Income 7,50,000 is ineligible in 2019, but becomes eligible in 2022!
      const sim = simulatePolicyAcrossDates({
        rules: SYNTHETIC_EWS_PROGRESSION_RULES,
        ruleFamilyId: 'syn_scheme_ews',
        jurisdictionCode: 'IN-TEST',
        citizenFacts: SYNTHETIC_CITIZEN_CASES.ELIGIBLE_V2_ONLY,
        dates,
      });

      expect(sim.simulations).toHaveLength(3);
      expect(sim.simulations[0].evaluation.outcome).toBe(EVALUATION_OUTCOME.INELIGIBLE);
      expect(sim.simulations[1].evaluation.outcome).toBe(EVALUATION_OUTCOME.ELIGIBLE);
      expect(sim.simulations[2].evaluation.outcome).toBe(EVALUATION_OUTCOME.ELIGIBLE);

      // Verify that shift was captured
      expect(sim.shifts.length).toBeGreaterThanOrEqual(1);
      const shift = sim.shifts[0];
      expect(shift.outcomeShift).toBe('INELIGIBLE -> ELIGIBLE');
      expect(shift.feeShift).toBe('20 -> 35');
    });
  });
});
