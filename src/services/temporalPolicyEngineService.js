/**
 * Temporal Policy Engine for Effective-Dated Civic Rules (#1155)
 *
 * Implements:
 * 1. Strict boundary schema validation, ISO timestamp enforcement, and supersession DAG cycle detection.
 * 2. Point-in-Time ("As-Of") policy resolution with multi-tier jurisdiction fallback.
 * 3. Continuous timeline interval analysis (detecting temporal gaps and overlapping conflicts).
 * 4. Epistemic humility guardrail: Never infer a legal conclusion where source coverage is incomplete or unverified.
 * 5. Deterministic condition evaluation and decision path tracing.
 * 6. Multi-date scenario simulation and "what-if" impact analysis.
 * 7. Immutable audit snapshot creation with deterministic cryptographic digests.
 */

import { sha256Hex } from './privacyIntegrityService';

export const JURISDICTION_LEVELS = {
  CENTRAL: 'central',
  STATE: 'state',
  DISTRICT: 'district',
  LOCAL: 'local',
};

export const EVENT_DATE_TYPES = {
  APPLICATION_DATE: 'APPLICATION_DATE',
  INCIDENT_DATE: 'INCIDENT_DATE',
  EVENT_DATE: 'EVENT_DATE',
  NOTIFICATION_DATE: 'NOTIFICATION_DATE',
};

export const RULE_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED',
};

export const EVALUATION_OUTCOME = {
  ELIGIBLE: 'ELIGIBLE',
  INELIGIBLE: 'INELIGIBLE',
  INDETERMINATE: 'INDETERMINATE',
};

export const INDETERMINATE_REASON = {
  INCOMPLETE_SOURCE_COVERAGE: 'INCOMPLETE_SOURCE_COVERAGE',
  UNVERIFIED_SOURCE_METADATA: 'UNVERIFIED_SOURCE_METADATA',
  TEMPORAL_GAP_DETECTED: 'TEMPORAL_GAP_DETECTED',
  TEMPORAL_CONFLICT_DETECTED: 'TEMPORAL_CONFLICT_DETECTED',
  MISSING_INPUT_FACTS: 'MISSING_INPUT_FACTS',
  NO_APPLICABLE_RULE_FOUND: 'NO_APPLICABLE_RULE_FOUND',
  INVALID_EVENT_DATE: 'INVALID_EVENT_DATE',
};

export const STATUTORY_DISCLAIMER =
  'Civic Help Setu provides assistive temporal policy simulations based on digitized gazettes and departmental circulars. ' +
  'This evaluation does NOT constitute legal advice, statutory certification, or an official government determination. ' +
  'All official benefits, licenses, and concessions are strictly subject to verification and formal adjudication by competent administrative authorities.';

/**
 * Validates an ISO 8601 date string
 */
export function isValidIsoDate(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return false;
  const timestamp = Date.parse(dateStr);
  if (Number.isNaN(timestamp)) return false;
  // Ensure valid date formatting
  return !Number.isNaN(new Date(dateStr).getTime());
}

/**
 * Validates a single effective-dated rule schema at service boundaries
 */
export function validateRuleSchema(rule = {}) {
  const errors = [];

  if (!rule || typeof rule !== 'object') {
    return { valid: false, errors: ['Rule must be a valid non-null object'] };
  }

  if (!rule.id || typeof rule.id !== 'string') {
    errors.push('rule.id must be a non-empty string');
  }

  if (!rule.ruleFamilyId || typeof rule.ruleFamilyId !== 'string') {
    errors.push('rule.ruleFamilyId must be a non-empty string');
  }

  if (!rule.version || typeof rule.version !== 'string') {
    errors.push('rule.version must be a non-empty string');
  }

  const validJurisdictionLevels = Object.values(JURISDICTION_LEVELS);
  if (!validJurisdictionLevels.includes(rule.jurisdictionLevel)) {
    errors.push(`rule.jurisdictionLevel must be one of: ${validJurisdictionLevels.join(', ')}`);
  }

  if (!rule.jurisdictionCode || typeof rule.jurisdictionCode !== 'string') {
    errors.push('rule.jurisdictionCode is required');
  }

  if (!isValidIsoDate(rule.effectiveFrom)) {
    errors.push('rule.effectiveFrom must be a valid ISO 8601 timestamp string');
  }

  if (rule.effectiveTo !== null && rule.effectiveTo !== undefined) {
    if (!isValidIsoDate(rule.effectiveTo)) {
      errors.push('rule.effectiveTo must be null or a valid ISO 8601 timestamp string');
    } else if (isValidIsoDate(rule.effectiveFrom)) {
      const fromTime = new Date(rule.effectiveFrom).getTime();
      const toTime = new Date(rule.effectiveTo).getTime();
      if (toTime < fromTime) {
        errors.push('rule.effectiveTo cannot precede rule.effectiveFrom');
      }
    }
  }

  if (!Array.isArray(rule.conditions)) {
    errors.push('rule.conditions must be an array');
  } else {
    rule.conditions.forEach((cond, idx) => {
      if (!cond || typeof cond !== 'object') {
        errors.push(`condition[${idx}] must be an object`);
      } else {
        if (!cond.field) errors.push(`condition[${idx}].field is required`);
        if (!cond.operator) errors.push(`condition[${idx}].operator is required`);
      }
    });
  }

  if (!rule.sourceMetadata || typeof rule.sourceMetadata !== 'object') {
    errors.push('rule.sourceMetadata is required and must be an object');
  } else {
    if (!rule.sourceMetadata.documentType) {
      errors.push('rule.sourceMetadata.documentType is required');
    }
    if (!rule.sourceMetadata.issuingAuthority) {
      errors.push('rule.sourceMetadata.issuingAuthority is required');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detects cyclic dependencies in supersession relationships using DFS
 */
export function detectSupersessionCycles(rules = []) {
  const adj = new Map();
  const allIds = new Set();

  for (const r of rules) {
    if (!r || !r.id) continue;
    allIds.add(r.id);
    if (!adj.has(r.id)) adj.set(r.id, []);

    if (r.supersedesRuleId) {
      // Directed edge: r.id -> r.supersedesRuleId
      adj.get(r.id).push(r.supersedesRuleId);
    }
    if (r.supersededByRuleId) {
      // Directed edge: r.supersededByRuleId -> r.id
      if (!adj.has(r.supersededByRuleId)) adj.set(r.supersededByRuleId, []);
      adj.get(r.supersededByRuleId).push(r.id);
    }
  }

  const visited = new Set();
  const recStack = new Set();
  const cycle = [];

  function dfs(node, path = []) {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path])) return true;
      } else if (recStack.has(neighbor)) {
        cycle.push(...path, neighbor);
        return true;
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const id of allIds) {
    if (!visited.has(id)) {
      if (dfs(id, [])) {
        return { hasCycle: true, cyclePath: cycle };
      }
    }
  }

  return { hasCycle: false, cyclePath: [] };
}

/**
 * Validates an entire rule set for boundary schema correctness and DAG cycle integrity
 */
export function validateTemporalRuleSet(rules = []) {
  if (!Array.isArray(rules)) {
    return { valid: false, errors: ['Rules must be an array'] };
  }

  const schemaErrors = [];
  rules.forEach((rule, idx) => {
    const res = validateRuleSchema(rule);
    if (!res.valid) {
      schemaErrors.push(`Rule #${idx} (${rule.id || 'unidentified'}): ${res.errors.join('; ')}`);
    }
  });

  if (schemaErrors.length > 0) {
    return { valid: false, errors: schemaErrors };
  }

  const cycleCheck = detectSupersessionCycles(rules);
  if (cycleCheck.hasCycle) {
    return {
      valid: false,
      errors: [`Supersession graph contains a circular dependency: ${cycleCheck.cyclePath.join(' -> ')}`],
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Normalizes jurisdiction code (e.g., 'in-mh' -> 'IN-MH')
 */
export function normalizeJurisdictionCode(code = '') {
  return String(code).trim().toUpperCase();
}

/**
 * Continuous interval analysis: Detects temporal gaps and overlapping conflicts
 * within a rule family and jurisdiction.
 */
export function detectTemporalAnomalies(rules = [], ruleFamilyId = null, jurisdictionCode = null) {
  const gaps = [];
  const conflicts = [];

  // Group rules by family and jurisdiction
  const groups = new Map();

  for (const r of rules) {
    if (!r || !r.ruleFamilyId || !r.jurisdictionCode) continue;
    if (ruleFamilyId && r.ruleFamilyId !== ruleFamilyId) continue;
    if (jurisdictionCode && normalizeJurisdictionCode(r.jurisdictionCode) !== normalizeJurisdictionCode(jurisdictionCode)) {
      continue;
    }

    // Exclude DRAFT or ARCHIVED rules from active timeline interval checks
    if (r.status === RULE_STATUS.ARCHIVED) continue;

    const groupKey = `${r.ruleFamilyId}::${normalizeJurisdictionCode(r.jurisdictionCode)}`;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(r);
  }

  for (const [key, groupRules] of groups.entries()) {
    const [family, jCode] = key.split('::');

    // Sort chronologically by effectiveFrom
    const sorted = [...groupRules].sort((a, b) => {
      const aFrom = new Date(a.effectiveFrom).getTime();
      const bFrom = new Date(b.effectiveFrom).getTime();
      return aFrom - bFrom;
    });

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const curTo = current.effectiveTo ? new Date(current.effectiveTo).getTime() : Infinity;

      // Check against subsequent rules for overlaps (conflicts)
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j];
        const nextFrom = new Date(next.effectiveFrom).getTime();

        // If next starts before current ends, check if it's an uncoordinated overlap
        if (nextFrom < curTo) {
          // If next explicitly supersedes current or current supersedes next, check date consistency
          const isExplicitSupersession =
            current.supersededByRuleId === next.id || next.supersedesRuleId === current.id;

          if (!isExplicitSupersession) {
            conflicts.push({
              ruleFamilyId: family,
              jurisdictionCode: jCode,
              ruleAId: current.id,
              ruleBId: next.id,
              overlapStart: next.effectiveFrom,
              overlapEnd: current.effectiveTo || 'OPEN_ENDED',
              description: `Rules "${current.id}" and "${next.id}" have overlapping effective periods without explicit supersession link.`,
            });
          }
        }
      }

      // Check against the immediately next rule for gaps
      if (i < sorted.length - 1) {
        const next = sorted[i + 1];
        const nextFrom = new Date(next.effectiveFrom).getTime();

        // A continuous boundary may have up to 1000ms offset (e.g. 23:59:59.999Z to 00:00:00.000Z)
        if (curTo !== Infinity && nextFrom - curTo > 1000) {
          gaps.push({
            ruleFamilyId: family,
            jurisdictionCode: jCode,
            priorRuleId: current.id,
            nextRuleId: next.id,
            gapStart: current.effectiveTo,
            gapEnd: next.effectiveFrom,
            description: `Temporal coverage gap detected between "${current.id}" (ends ${current.effectiveTo}) and "${next.id}" (starts ${next.effectiveFrom}).`,
          });
        }
      }
    }
  }

  return { gaps, conflicts };
}

/**
 * Resolves the applicable rule version for a specific event date and jurisdiction ("As-Of" Query)
 */
export function resolveAsOfRule({
  rules = [],
  ruleFamilyId,
  jurisdictionCode,
  asOfDate = new Date().toISOString(),
  fallbackToCentral = true,
}) {
  if (!isValidIsoDate(asOfDate)) {
    return {
      rule: null,
      status: INDETERMINATE_REASON.INVALID_EVENT_DATE,
      error: 'Invalid asOfDate provided',
    };
  }

  const targetTime = new Date(asOfDate).getTime();
  const normalizedTargetJCode = jurisdictionCode ? normalizeJurisdictionCode(jurisdictionCode) : null;

  // Filter family rules
  const familyRules = rules.filter(
    (r) => r.ruleFamilyId === ruleFamilyId && r.status !== RULE_STATUS.ARCHIVED
  );

  if (familyRules.length === 0) {
    return {
      rule: null,
      status: INDETERMINATE_REASON.NO_APPLICABLE_RULE_FOUND,
      error: `No policy rules found for rule family "${ruleFamilyId}".`,
    };
  }

  // 1. Try matching jurisdiction-specific rule
  const matchCandidates = (jCode) => {
    return familyRules.filter((r) => {
      if (normalizeJurisdictionCode(r.jurisdictionCode) !== jCode) return false;
      const fromTime = new Date(r.effectiveFrom).getTime();
      const toTime = r.effectiveTo ? new Date(r.effectiveTo).getTime() : Infinity;
      return targetTime >= fromTime && targetTime <= toTime;
    });
  };

  let candidates = normalizedTargetJCode ? matchCandidates(normalizedTargetJCode) : [];
  let isFallback = false;
  let resolvedJurisdiction = normalizedTargetJCode;

  // 2. If no local/state match and fallback enabled, try CENTRAL jurisdiction
  if (candidates.length === 0 && fallbackToCentral && normalizedTargetJCode !== 'CENTRAL') {
    candidates = matchCandidates('CENTRAL');
    if (candidates.length > 0) {
      isFallback = true;
      resolvedJurisdiction = 'CENTRAL';
    }
  }

  // Check for anomalies at target date
  if (candidates.length === 0) {
    // Check if we are inside a temporal gap
    const anomalies = detectTemporalAnomalies(familyRules, ruleFamilyId, normalizedTargetJCode);
    const activeGap = anomalies.gaps.find((g) => {
      const gStart = new Date(g.gapStart).getTime();
      const gEnd = new Date(g.gapEnd).getTime();
      return targetTime > gStart && targetTime < gEnd;
    });

    if (activeGap) {
      return {
        rule: null,
        status: INDETERMINATE_REASON.TEMPORAL_GAP_DETECTED,
        error: activeGap.description,
        gapDetails: activeGap,
      };
    }

    return {
      rule: null,
      status: INDETERMINATE_REASON.NO_APPLICABLE_RULE_FOUND,
      error: `No rule effective as of ${asOfDate} for jurisdiction "${jurisdictionCode || 'CENTRAL'}".`,
    };
  }

  // If multiple candidates exist for the same jurisdiction, resolve via supersession or flag conflict
  if (candidates.length > 1) {
    // Check if one candidate explicitly superseded the other
    const unSuperseded = candidates.filter((cand) => {
      return !candidates.some((other) => other.supersedesRuleId === cand.id);
    });

    if (unSuperseded.length === 1) {
      return {
        rule: unSuperseded[0],
        status: 'RESOLVED',
        jurisdictionUsed: resolvedJurisdiction,
        isFallback,
      };
    }

    return {
      rule: null,
      status: INDETERMINATE_REASON.TEMPORAL_CONFLICT_DETECTED,
      error: `Conflicting multiple rules active on ${asOfDate}: ${candidates.map((c) => c.id).join(', ')}`,
      candidates,
    };
  }

  return {
    rule: candidates[0],
    status: 'RESOLVED',
    jurisdictionUsed: resolvedJurisdiction,
    isFallback,
  };
}

/**
 * Evaluates an individual declarative condition node against citizen facts
 */
export function evaluateCondition(condition, facts = {}) {
  const { field, operator, value, unit } = condition;
  const actual = facts[field];

  if (actual === undefined || actual === null) {
    return {
      conditionId: condition.id || field,
      field,
      operator,
      expected: value,
      actual: null,
      unit,
      passed: false,
      missing: true,
      description: condition.description || `${field} ${operator} ${value}`,
    };
  }

  let passed;

  switch (operator) {
    case 'LESS_THAN_OR_EQUAL':
      passed = Number(actual) <= Number(value);
      break;
    case 'LESS_THAN':
      passed = Number(actual) < Number(value);
      break;
    case 'GREATER_THAN_OR_EQUAL':
      passed = Number(actual) >= Number(value);
      break;
    case 'GREATER_THAN':
      passed = Number(actual) > Number(value);
      break;
    case 'EQUALS':
      passed = String(actual).toLowerCase() === String(value).toLowerCase();
      break;
    case 'NOT_EQUALS':
      passed = String(actual).toLowerCase() !== String(value).toLowerCase();
      break;
    case 'IN_LIST':
      if (Array.isArray(value)) {
        passed = value.map((v) => String(v).toLowerCase()).includes(String(actual).toLowerCase());
      } else {
        passed = false;
      }
      break;
    case 'CONTAINS':
      if (Array.isArray(actual)) {
        passed = actual.map((v) => String(v).toLowerCase()).includes(String(value).toLowerCase());
      } else {
        passed = String(actual).toLowerCase().includes(String(value).toLowerCase());
      }
      break;
    default:
      passed = false;
  }

  return {
    conditionId: condition.id || field,
    field,
    operator,
    expected: value,
    actual,
    unit,
    passed,
    missing: false,
    description: condition.description || `${field} ${operator} ${value}`,
  };
}

/**
 * Computes deterministic SHA-256 digest of a canonical rule representation
 */
export function computeRuleDigest(rule = {}) {
  const canonical = {
    id: rule.id,
    family: rule.ruleFamilyId,
    version: rule.version,
    from: rule.effectiveFrom,
    to: rule.effectiveTo,
    jurisdiction: rule.jurisdictionCode,
    conditions: rule.conditions || [],
    fees: rule.feeStructure || {},
    docs: rule.requiredDocuments || [],
    source: rule.sourceMetadata || {},
  };
  return sha256Hex(JSON.stringify(canonical));
}

/**
 * Core Deterministic Evaluation with Epistemic Humility
 * Never infers a legal conclusion where source coverage is incomplete or unverified.
 */
export function evaluateEffectiveDatedPolicy({
  rule,
  citizenFacts = {},
  asOfDate = new Date().toISOString(),
  operatorOrCitizenId = 'anonymous',
}) {
  // 1. Guardrail: Null rule or unresolved query
  if (!rule) {
    return {
      outcome: EVALUATION_OUTCOME.INDETERMINATE,
      reason: INDETERMINATE_REASON.NO_APPLICABLE_RULE_FOUND,
      explanation: 'No applicable effective-dated civic rule was resolved for the requested date and jurisdiction.',
      decisionPath: [],
      feesApplicable: null,
      mandatoryDocuments: [],
      citations: [],
      disclaimer: STATUTORY_DISCLAIMER,
      ruleDigestHash: null,
    };
  }

  // 2. Epistemic Humility Guardrail: Source provenance validation
  const source = rule.sourceMetadata || {};
  if (!source.isVerified) {
    return {
      outcome: EVALUATION_OUTCOME.INDETERMINATE,
      reason: INDETERMINATE_REASON.UNVERIFIED_SOURCE_METADATA,
      explanation:
        'Official circular or statutory notification for this rule version is unverified or awaiting catalogue editor scrutiny. No legal conclusion can be drawn.',
      decisionPath: [],
      feesApplicable: null,
      mandatoryDocuments: [],
      citations: [
        {
          authority: source.issuingAuthority || 'Unknown Authority',
          notificationNumber: source.notificationNumber || 'Unspecified',
          documentType: source.documentType || 'UNVERIFIED',
          status: 'UNVERIFIED',
        },
      ],
      disclaimer: STATUTORY_DISCLAIMER,
      ruleDigestHash: computeRuleDigest(rule),
    };
  }

  // 3. Evaluate Condition Trees
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  const decisionPath = conditions.map((cond) => evaluateCondition(cond, citizenFacts));

  // 4. Missing Facts Guardrail
  const missingConditions = decisionPath.filter((d) => d.missing);
  if (missingConditions.length > 0) {
    return {
      outcome: EVALUATION_OUTCOME.INDETERMINATE,
      reason: INDETERMINATE_REASON.MISSING_INPUT_FACTS,
      explanation: `Missing required applicant facts: ${missingConditions.map((m) => m.field).join(', ')}.`,
      missingFields: missingConditions.map((m) => m.field),
      decisionPath,
      feesApplicable: rule.feeStructure || null,
      mandatoryDocuments: (rule.requiredDocuments || []).filter((d) => d.mandatory).map((d) => d.title),
      citations: [
        {
          authority: source.issuingAuthority,
          notificationNumber: source.notificationNumber,
          date: source.gazetteDate,
          documentType: source.documentType,
        },
      ],
      disclaimer: STATUTORY_DISCLAIMER,
      ruleDigestHash: computeRuleDigest(rule),
    };
  }

  // 5. Outcome determination
  const allPassed = decisionPath.every((d) => d.passed);
  const outcome = allPassed ? EVALUATION_OUTCOME.ELIGIBLE : EVALUATION_OUTCOME.INELIGIBLE;
  const reason = allPassed
    ? 'All statutory criteria effective as of event date are satisfied.'
    : `Criteria not met: ${decisionPath.filter((d) => !d.passed).map((d) => d.description).join('; ')}`;

  const mandatoryDocs = (rule.requiredDocuments || [])
    .filter((d) => d.mandatory)
    .map((d) => d.title);

  return {
    outcome,
    reason,
    ruleId: rule.id,
    ruleVersion: rule.version,
    ruleFamilyId: rule.ruleFamilyId,
    jurisdictionCode: rule.jurisdictionCode,
    asOfDate,
    decisionPath,
    feesApplicable: rule.feeStructure || { amount: 0, currency: 'INR' },
    mandatoryDocuments: mandatoryDocs,
    citations: [
      {
        authority: source.issuingAuthority,
        notificationNumber: source.notificationNumber,
        date: source.gazetteDate,
        citationUrl: source.citationUrl,
        documentType: source.documentType,
      },
    ],
    disclaimer: STATUTORY_DISCLAIMER,
    ruleDigestHash: computeRuleDigest(rule),
    evaluatedAt: new Date().toISOString(),
    operatorOrCitizenId,
  };
}

/**
 * Creates an immutable historical evaluation snapshot record
 */
export function createEvaluationSnapshot({
  evaluationResult,
  citizenFacts = {},
  asOfDate,
  rule,
  operatorOrCitizenId = 'anonymous',
}) {
  const sanitizedFacts = {};
  // Strip sensitive PII fields like names, mobile, Aadhaar, email
  const piiBlacklist = ['name', 'fullname', 'aadhaar', 'uid', 'phone', 'mobile', 'email', 'address'];
  for (const [k, v] of Object.entries(citizenFacts)) {
    if (!piiBlacklist.includes(k.toLowerCase())) {
      sanitizedFacts[k] = v;
    }
  }

  const snapshot = {
    evaluationId: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    evaluatedAt: new Date().toISOString(),
    asOfDate: asOfDate || evaluationResult.asOfDate,
    ruleFamilyId: evaluationResult.ruleFamilyId || rule?.ruleFamilyId || 'unknown',
    ruleId: evaluationResult.ruleId || rule?.id || 'unknown',
    ruleVersion: evaluationResult.ruleVersion || rule?.version || 'unknown',
    ruleDigestHash: evaluationResult.ruleDigestHash || computeRuleDigest(rule),
    jurisdictionCode: evaluationResult.jurisdictionCode || rule?.jurisdictionCode || 'CENTRAL',
    outcome: evaluationResult.outcome,
    reason: evaluationResult.reason,
    decisionPath: evaluationResult.decisionPath || [],
    sanitizedFacts,
    feesApplicable: evaluationResult.feesApplicable,
    mandatoryDocuments: evaluationResult.mandatoryDocuments || [],
    citations: evaluationResult.citations || [],
    operatorOrCitizenId,
    disclaimer: evaluationResult.disclaimer || STATUTORY_DISCLAIMER,
  };

  snapshot.snapshotHash = sha256Hex(JSON.stringify(snapshot));
  return snapshot;
}

/**
 * Simulates policy evaluations across a chronological list of dates to perform
 * "What-If" timeline shifts and requirement diff analysis.
 */
export function simulatePolicyAcrossDates({
  rules = [],
  ruleFamilyId,
  jurisdictionCode,
  citizenFacts = {},
  dates = [],
}) {
  if (!Array.isArray(dates) || dates.length === 0) {
    return { simulations: [], shifts: [] };
  }

  const sortedDates = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const simulations = [];

  for (const dateStr of sortedDates) {
    const resolution = resolveAsOfRule({
      rules,
      ruleFamilyId,
      jurisdictionCode,
      asOfDate: dateStr,
      fallbackToCentral: true,
    });

    if (!resolution.rule) {
      simulations.push({
        asOfDate: dateStr,
        status: resolution.status,
        error: resolution.error,
        rule: null,
        evaluation: null,
      });
      continue;
    }

    const evaluation = evaluateEffectiveDatedPolicy({
      rule: resolution.rule,
      citizenFacts,
      asOfDate: dateStr,
    });

    simulations.push({
      asOfDate: dateStr,
      status: 'SUCCESS',
      isFallback: resolution.isFallback,
      jurisdictionUsed: resolution.jurisdictionUsed,
      rule: {
        id: resolution.rule.id,
        version: resolution.rule.version,
        effectiveFrom: resolution.rule.effectiveFrom,
        effectiveTo: resolution.rule.effectiveTo,
      },
      evaluation,
    });
  }

  // Identify outcome or requirement shifts between consecutive dates
  const shifts = [];
  for (let i = 1; i < simulations.length; i++) {
    const prev = simulations[i - 1];
    const curr = simulations[i];

    if (prev.evaluation && curr.evaluation) {
      const prevOutcome = prev.evaluation.outcome;
      const currOutcome = curr.evaluation.outcome;
      const prevFee = prev.evaluation.feesApplicable?.amount || 0;
      const currFee = curr.evaluation.feesApplicable?.amount || 0;

      const outcomeShifted = prevOutcome !== currOutcome;
      const feeShifted = prevFee !== currFee;
      const ruleShifted = prev.rule.id !== curr.rule.id;

      if (outcomeShifted || feeShifted || ruleShifted) {
        shifts.push({
          fromDate: prev.asOfDate,
          toDate: curr.asOfDate,
          fromRuleId: prev.rule.id,
          toRuleId: curr.rule.id,
          outcomeShift: outcomeShifted ? `${prevOutcome} -> ${currOutcome}` : null,
          feeShift: feeShifted ? `${prevFee} -> ${currFee}` : null,
          details: `Policy changed between ${prev.asOfDate.slice(0, 10)} and ${curr.asOfDate.slice(0, 10)}.`,
        });
      }
    }
  }

  return { simulations, shifts };
}
