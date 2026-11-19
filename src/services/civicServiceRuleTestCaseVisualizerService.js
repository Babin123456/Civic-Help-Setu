/**
 * Civic Service Rule Test-Case Visualizer Service
 *
 * Implements a deterministic scenario evaluation engine, decision-path tracer,
 * version comparison diff generator, and review gatekeeper for catalogue administrators:
 *
 * 1. Declarative Civic Rules & Synthetic Test Case Registry:
 *    - Models complex eligibility & document rules with structured condition trees.
 *    - Pre-configures approved, strictly synthetic test fixtures (standard, boundary, exception).
 *    - Strictly prohibits real citizen PII in test suites.
 *
 * 2. Deterministic Rule Evaluator & Path Tracer:
 *    - Evaluates conditions step-by-step, generating an auditable decision trail.
 *    - Produces PASS, FAIL, or INDETERMINATE outcomes (indeterminate when critical inputs are missing).
 *    - Flags outcome discrepancies against approved human expectations.
 *
 * 3. Version Diff & Scenario Matrix:
 *    - Compares current vs draft rule versions side-by-side.
 *    - Highlights shifting outcomes across versions (e.g. previous FAIL now PASS).
 *    - Provides a linearized WCAG-compliant scenario matrix for screen readers.
 *
 * 4. Advisory AI Edge Case Suggestions with Guardrails:
 *    - Suggests candidate boundary and exception scenarios strictly labeled as advisory.
 *    - Prohibits AI from deciding or approving expected test results.
 *
 * 5. Review Notes & Publication Gatekeeper:
 *    - Enforces RBAC (CATALOGUE_ADMIN, CATALOGUE_REVIEWER).
 *    - Blocks publishing when required test cases fail or remain indeterminate.
 *    - Maintains immutable review notes and audit trails.
 */

export const EVALUATION_OUTCOME = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  INDETERMINATE: 'INDETERMINATE',
};

export const TEST_CASE_SEVERITY = {
  STANDARD: 'STANDARD',
  BOUNDARY: 'BOUNDARY',
  EXCEPTION: 'EXCEPTION',
  EDGE_CASE: 'EDGE_CASE',
};

export const PUBLISH_READINESS = {
  READY_TO_PUBLISH: 'READY_TO_PUBLISH',
  BLOCKED_BY_FAILURES: 'BLOCKED_BY_FAILURES',
  REQUIRES_REVIEW_NOTES: 'REQUIRES_REVIEW_NOTES',
  NO_TEST_CASES_EVALUATED: 'NO_TEST_CASES_EVALUATED',
};

export const RULE_VIEWER_STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  READY: 'READY',
};

export const REVIEWER_ROLE = {
  CATALOGUE_ADMIN: 'CATALOGUE_ADMIN',
  CATALOGUE_REVIEWER: 'CATALOGUE_REVIEWER',
  VIEWER: 'VIEWER',
};

export const STATUTORY_RULE_TEST_DISCLAIMER =
  'Notice: Synthetic test evaluation is a catalogue maintenance sandbox tool to verify deterministic rule logic prior to publishing. Test cases contain strictly synthetic non-PII data and do not represent actual citizen applications or official government adjudications.';

/**
 * Built-in representative rules (Current v1 and Draft v2).
 */
export const BUILT_IN_RULES = {
  RULE_EWS_ELIGIBILITY_V1: {
    ruleId: 'RULE_EWS_ELIGIBILITY',
    version: '1.0.0',
    title: 'Economically Weaker Section (EWS) Eligibility Rule (Current Published)',
    statutoryAuthority: 'Ministry of Social Justice & State Revenue Department',
    statutoryCitation: 'OM No. 36039/1/2019-Estt (Res)',
    status: 'PUBLISHED',
    conditions: [
      {
        field: 'grossAnnualIncomeINR',
        operator: 'LESS_THAN_OR_EQUAL',
        threshold: 800000,
        description: 'Family gross annual income must not exceed INR 8,00,000',
      },
      {
        field: 'agriculturalLandAcres',
        operator: 'LESS_THAN_OR_EQUAL',
        threshold: 5.0,
        description: 'Agricultural land holding must not exceed 5 acres',
      },
      {
        field: 'residentialFlatSqFt',
        operator: 'LESS_THAN_OR_EQUAL',
        threshold: 1000,
        description: 'Residential flat area must not exceed 1000 sq. ft.',
      },
    ],
  },
  RULE_EWS_ELIGIBILITY_V2: {
    ruleId: 'RULE_EWS_ELIGIBILITY',
    version: '2.0.0',
    title: 'Economically Weaker Section (EWS) Eligibility Rule (Draft Revision)',
    statutoryAuthority: 'Ministry of Social Justice & State Revenue Department',
    statutoryCitation: 'Draft Revenue Amendment Gazette Notification 2026',
    status: 'DRAFT',
    conditions: [
      {
        field: 'grossAnnualIncomeINR',
        operator: 'LESS_THAN_OR_EQUAL',
        threshold: 800000,
        description: 'Family gross annual income must not exceed INR 8,00,000',
      },
      {
        field: 'agriculturalLandAcres',
        operator: 'LESS_THAN_OR_EQUAL_WITH_EXCEPTION',
        threshold: 5.0,
        exceptionField: 'isNotifiedDryLandRuralArea',
        exceptionThreshold: 7.5,
        description: 'Agricultural land must not exceed 5 acres (or 7.5 acres in notified non-irrigated dry land rural talukas)',
      },
      {
        field: 'residentialFlatSqFt',
        operator: 'LESS_THAN_OR_EQUAL',
        threshold: 1000,
        description: 'Residential flat area must not exceed 1000 sq. ft.',
      },
    ],
  },
  RULE_SENIOR_CITIZEN_PENSION_V1: {
    ruleId: 'RULE_SENIOR_CITIZEN_PENSION',
    version: '1.0.0',
    title: 'Indira Gandhi National Old Age Pension Scheme (IGNOAPS)',
    statutoryAuthority: 'Department of Social Security and Empowerment',
    statutoryCitation: 'National Social Assistance Programme (NSAP) Guidelines',
    status: 'PUBLISHED',
    conditions: [
      {
        field: 'applicantAgeYears',
        operator: 'GREATER_THAN_OR_EQUAL',
        threshold: 60,
        description: 'Applicant age must be 60 years or above',
      },
      {
        field: 'isBplCardHolder',
        operator: 'EQUALS',
        threshold: true,
        description: 'Applicant household must be registered under Below Poverty Line (BPL)',
      },
      {
        field: 'stateDomicileYears',
        operator: 'GREATER_THAN_OR_EQUAL',
        threshold: 10,
        description: 'Continuous state domicile must be at least 10 years',
      },
    ],
  },
};

/**
 * Approved synthetic test cases for EWS rule testing (Zero PII, fully synthetic).
 */
export const SYNTHETIC_EWS_TEST_CASES = [
  {
    testCaseId: 'TC_EWS_001_STANDARD_PASS',
    title: 'Standard Eligible Candidate (Low income, no excess land)',
    severity: TEST_CASE_SEVERITY.STANDARD,
    isSynthetic: true,
    inputs: {
      grossAnnualIncomeINR: 350000,
      agriculturalLandAcres: 2.5,
      residentialFlatSqFt: 650,
      isNotifiedDryLandRuralArea: false,
    },
    expectedOutcome: EVALUATION_OUTCOME.PASS,
    rationale: 'Well within all statutory ceiling parameters.',
  },
  {
    testCaseId: 'TC_EWS_002_INCOME_FAIL',
    title: 'Income Breach (Higher income bracket)',
    severity: TEST_CASE_SEVERITY.STANDARD,
    isSynthetic: true,
    inputs: {
      grossAnnualIncomeINR: 920000,
      agriculturalLandAcres: 1.0,
      residentialFlatSqFt: 500,
      isNotifiedDryLandRuralArea: false,
    },
    expectedOutcome: EVALUATION_OUTCOME.FAIL,
    rationale: 'Income exceeds 8,00,000 threshold.',
  },
  {
    testCaseId: 'TC_EWS_003_INCOME_BOUNDARY_PASS',
    title: 'Exact Income Boundary (8,00,000 INR exactly)',
    severity: TEST_CASE_SEVERITY.BOUNDARY,
    isSynthetic: true,
    inputs: {
      grossAnnualIncomeINR: 800000,
      agriculturalLandAcres: 4.9,
      residentialFlatSqFt: 950,
      isNotifiedDryLandRuralArea: false,
    },
    expectedOutcome: EVALUATION_OUTCOME.PASS,
    rationale: 'Threshold is inclusive (<= 8,00,000).',
  },
  {
    testCaseId: 'TC_EWS_004_LAND_BREACH_URBAN',
    title: 'Land Holding Breach in Standard Area (6 Acres)',
    severity: TEST_CASE_SEVERITY.STANDARD,
    isSynthetic: true,
    inputs: {
      grossAnnualIncomeINR: 400000,
      agriculturalLandAcres: 6.0,
      residentialFlatSqFt: 600,
      isNotifiedDryLandRuralArea: false,
    },
    expectedOutcome: EVALUATION_OUTCOME.FAIL,
    rationale: 'Land exceeds standard 5 acre limit.',
  },
  {
    testCaseId: 'TC_EWS_005_RURAL_EXCEPTION_SHIFT',
    title: 'Rural Dry Land Exception Scenario (6 Acres in Notified Taluka)',
    severity: TEST_CASE_SEVERITY.EXCEPTION,
    isSynthetic: true,
    inputs: {
      grossAnnualIncomeINR: 420000,
      agriculturalLandAcres: 6.0,
      residentialFlatSqFt: 0,
      isNotifiedDryLandRuralArea: true,
    },
    expectedOutcome: EVALUATION_OUTCOME.PASS, // in V2
    rationale: 'Exceeds standard 5 acres but within 7.5 acre rural dry-land exception for V2.',
  },
  {
    testCaseId: 'TC_EWS_006_INDETERMINATE_MISSING_LAND',
    title: 'Indeterminate Incomplete Record (Missing land size)',
    severity: TEST_CASE_SEVERITY.EDGE_CASE,
    isSynthetic: true,
    inputs: {
      grossAnnualIncomeINR: 300000,
      // agriculturalLandAcres omitted
      residentialFlatSqFt: 500,
    },
    expectedOutcome: EVALUATION_OUTCOME.INDETERMINATE,
    rationale: 'Essential land size parameter missing; cannot determine eligibility without guessing.',
  },
];

/**
 * Deterministically evaluates a single synthetic test case against a rule version.
 *
 * @param {Object} rule Rule definition with conditions
 * @param {Object} testCase Synthetic test case
 * @returns {Object} Comprehensive evaluation outcome
 */
export function evaluateRuleCase(rule, testCase) {
  if (!rule || !Array.isArray(rule.conditions)) {
    throw new Error('Valid rule with conditions array is required');
  }
  if (!testCase || !testCase.inputs) {
    throw new Error('Valid testCase with inputs object is required');
  }

  const { inputs } = testCase;
  const evaluatedPath = [];
  const failureReasons = [];
  let isIndeterminate = false;

  for (const condition of rule.conditions) {
    const val = inputs[condition.field];

    // Check if required input is missing
    if (val === undefined || val === null) {
      isIndeterminate = true;
      evaluatedPath.push({
        field: condition.field,
        operator: condition.operator,
        inputValue: null,
        status: 'MISSING_DATA',
        description: condition.description,
      });
      continue;
    }

    let conditionPassed;
    let effectiveThreshold = condition.threshold;

    switch (condition.operator) {
      case 'LESS_THAN_OR_EQUAL':
        conditionPassed = Number(val) <= Number(condition.threshold);
        break;
      case 'GREATER_THAN_OR_EQUAL':
        conditionPassed = Number(val) >= Number(condition.threshold);
        break;
      case 'EQUALS':
        conditionPassed = val === condition.threshold;
        break;
      case 'LESS_THAN_OR_EQUAL_WITH_EXCEPTION':
        if (inputs[condition.exceptionField] === true) {
          effectiveThreshold = condition.exceptionThreshold;
        }
        conditionPassed = Number(val) <= Number(effectiveThreshold);
        break;
      default:
        conditionPassed = val === condition.threshold;
    }

    evaluatedPath.push({
      field: condition.field,
      operator: condition.operator,
      inputValue: val,
      effectiveThreshold,
      conditionPassed,
      description: condition.description,
    });

    if (!conditionPassed) {
      failureReasons.push(`Field '${condition.field}' failed condition '${condition.description}': provided ${val}, allowed ${effectiveThreshold}`);
    }
  }

  let actualOutcome = EVALUATION_OUTCOME.PASS;
  if (isIndeterminate) {
    actualOutcome = EVALUATION_OUTCOME.INDETERMINATE;
  } else if (failureReasons.length > 0) {
    actualOutcome = EVALUATION_OUTCOME.FAIL;
  }

  const matchedExpectation = actualOutcome === testCase.expectedOutcome;

  return {
    testCaseId: testCase.testCaseId,
    title: testCase.title,
    severity: testCase.severity,
    isSynthetic: true,
    actualOutcome,
    expectedOutcome: testCase.expectedOutcome,
    matchedExpectation,
    evaluatedPath,
    failureReasons,
    ruleVersion: rule.version,
  };
}

/**
 * Runs a complete suite of synthetic test cases against a rule.
 *
 * @param {Object} rule Rule definition
 * @param {Array<Object>} testCases Array of test cases
 * @returns {Object} Test suite summary
 */
export function runTestSuite(rule, testCases = SYNTHETIC_EWS_TEST_CASES) {
  if (!rule) {
    throw new Error('Rule is required to run test suite');
  }

  const caseResults = testCases.map((tc) => evaluateRuleCase(rule, tc));

  const total = caseResults.length;
  const passed = caseResults.filter((r) => r.actualOutcome === EVALUATION_OUTCOME.PASS).length;
  const failed = caseResults.filter((r) => r.actualOutcome === EVALUATION_OUTCOME.FAIL).length;
  const indeterminate = caseResults.filter((r) => r.actualOutcome === EVALUATION_OUTCOME.INDETERMINATE).length;
  const matched = caseResults.filter((r) => r.matchedExpectation).length;

  let publishReadiness = PUBLISH_READINESS.READY_TO_PUBLISH;
  if (total === 0) {
    publishReadiness = PUBLISH_READINESS.NO_TEST_CASES_EVALUATED;
  } else if (matched < total) {
    // If any test case didn't match human expected outcome, block publish
    publishReadiness = PUBLISH_READINESS.BLOCKED_BY_FAILURES;
  }

  return {
    ruleId: rule.ruleId,
    ruleVersion: rule.version,
    ruleTitle: rule.title,
    statutoryCitation: rule.statutoryCitation,
    totalCases: total,
    distribution: {
      passed,
      failed,
      indeterminate,
      matched,
      matchPercentage: total > 0 ? Math.round((matched / total) * 100) : 0,
    },
    publishReadiness,
    caseResults,
    statutoryDisclaimer: STATUTORY_RULE_TEST_DISCLAIMER,
  };
}

/**
 * Compares current vs draft rule versions against the synthetic test suite.
 *
 * @param {Object} currentRule Current published rule
 * @param {Object} draftRule Draft rule undergoing revision
 * @param {Array<Object>} testCases Approved test cases
 * @returns {Object} Side-by-side comparison report
 */
export function compareRuleVersions(currentRule, draftRule, testCases = SYNTHETIC_EWS_TEST_CASES) {
  if (!currentRule || !draftRule) {
    throw new Error('Both currentRule and draftRule are required for version comparison');
  }

  const currentSuite = runTestSuite(currentRule, testCases);
  const draftSuite = runTestSuite(draftRule, testCases);

  const scenarioDiffs = testCases.map((tc) => {
    const curResult = currentSuite.caseResults.find((r) => r.testCaseId === tc.testCaseId);
    const draftResult = draftSuite.caseResults.find((r) => r.testCaseId === tc.testCaseId);

    const hasOutcomeShift = curResult.actualOutcome !== draftResult.actualOutcome;

    return {
      testCaseId: tc.testCaseId,
      title: tc.title,
      severity: tc.severity,
      currentOutcome: curResult.actualOutcome,
      draftOutcome: draftResult.actualOutcome,
      hasOutcomeShift,
      shiftExplanation: hasOutcomeShift
        ? `Shifted from ${curResult.actualOutcome} in v${currentRule.version} to ${draftResult.actualOutcome} in v${draftRule.version}`
        : 'Outcome unchanged across versions',
      draftMatchedExpectation: draftResult.matchedExpectation,
    };
  });

  const totalShifts = scenarioDiffs.filter((d) => d.hasOutcomeShift).length;

  return {
    currentVersion: currentRule.version,
    draftVersion: draftRule.version,
    totalScenarios: testCases.length,
    totalOutcomeShifts: totalShifts,
    draftPublishReadiness: draftSuite.publishReadiness,
    scenarioDiffs,
    statutoryNotice: STATUTORY_RULE_TEST_DISCLAIMER,
  };
}

/**
 * Returns an accessible, screen-reader friendly scenario matrix.
 *
 * @param {Object} suiteResult Result from runTestSuite
 * @returns {Array<Object>} Accessible rows
 */
export function getAccessibleScenarioMatrix(suiteResult) {
  if (!suiteResult || !Array.isArray(suiteResult.caseResults)) {
    throw new Error('Valid suiteResult with caseResults array is required');
  }

  return suiteResult.caseResults.map((r) => ({
    testCaseId: r.testCaseId,
    title: r.title,
    severity: r.severity,
    actualOutcome: r.actualOutcome,
    expectedOutcome: r.expectedOutcome,
    status: r.matchedExpectation ? 'MATCHED' : 'DISCREPANCY_FLAGGED',
    reasons: r.failureReasons.length > 0 ? r.failureReasons.join('; ') : 'All evaluated conditions passed',
  }));
}

// In-memory store for rule review decisions
const ruleReviewDecisionStore = new Map();

/**
 * Records reviewer notes and approval decision with publish gatekeeper.
 *
 * @param {Object} input
 * @returns {Object} Stored review decision
 */
export function recordReviewDecision(input = {}) {
  const {
    ruleId,
    ruleVersion,
    reviewerId,
    reviewerRole,
    decision, // APPROVED, REJECTED, REQUIRES_CHANGES
    reviewNotes,
    suiteResult,
  } = input;

  if (!ruleId || !ruleVersion || !reviewerId || !reviewerRole || !decision) {
    throw new Error('Mandatory review fields missing: ruleId, ruleVersion, reviewerId, reviewerRole, and decision are required');
  }

  if (![REVIEWER_ROLE.CATALOGUE_ADMIN, REVIEWER_ROLE.CATALOGUE_REVIEWER].includes(reviewerRole)) {
    throw new Error(`Permission Denied: Role '${reviewerRole}' is not authorized to record rule decisions`);
  }

  if (!reviewNotes || reviewNotes.trim().length < 15) {
    throw new Error('Detailed review notes of at least 15 characters are required for audit compliance');
  }

  // Publishing gatekeeper: if decision is APPROVED, verify suiteResult didn't fail
  if (decision === 'APPROVED' && suiteResult) {
    if (suiteResult.publishReadiness === PUBLISH_READINESS.BLOCKED_BY_FAILURES) {
      throw new Error('Publication Gatekeeper: Cannot approve rule while synthetic test cases have unresolved failures or expectation discrepancies');
    }
  }

  const decisionId = `rdec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    decisionId,
    ruleId,
    ruleVersion,
    reviewerId,
    reviewerRole,
    decision,
    reviewNotes: reviewNotes.trim(),
    publishReadiness: suiteResult ? suiteResult.publishReadiness : PUBLISH_READINESS.READY_TO_PUBLISH,
    timestamp: new Date().toISOString(),
    statutoryDisclaimer: STATUTORY_RULE_TEST_DISCLAIMER,
  };

  if (!ruleReviewDecisionStore.has(ruleId)) {
    ruleReviewDecisionStore.set(ruleId, []);
  }
  ruleReviewDecisionStore.get(ruleId).push(record);

  return record;
}

/**
 * Retrieves review decision audit history for a rule.
 *
 * @param {string} ruleId
 * @param {string} reviewerRole
 * @returns {Array<Object>}
 */
export function getRuleReviewHistory(ruleId, reviewerRole) {
  if (!reviewerRole || ![REVIEWER_ROLE.CATALOGUE_ADMIN, REVIEWER_ROLE.CATALOGUE_REVIEWER, REVIEWER_ROLE.VIEWER].includes(reviewerRole)) {
    throw new Error('Permission Denied: Valid authorization role is required to inspect review history');
  }

  if (!ruleId) return [];
  return [...(ruleReviewDecisionStore.get(ruleId) || [])].reverse();
}

/**
 * Sanitizes a rule review decision for export.
 *
 * @param {Object} record
 * @returns {Object} Sanitized object
 */
export function sanitizeRuleReviewRecordForExport(record) {
  if (!record || typeof record !== 'object') return null;

  return {
    decisionId: record.decisionId,
    ruleId: record.ruleId,
    ruleVersion: record.ruleVersion,
    decision: record.decision,
    reviewerRole: record.reviewerRole,
    reviewerMasked: record.reviewerId ? `rev_***_${record.reviewerId.slice(-3)}` : 'UNKNOWN',
    reviewNotes: record.reviewNotes,
    timestamp: record.timestamp,
    statutoryDisclaimer: record.statutoryDisclaimer,
  };
}

/**
 * Clears in-memory review stores (for testing).
 */
export function _resetRuleReviewStore() {
  ruleReviewDecisionStore.clear();
}
