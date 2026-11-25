/**
 * src/services/waterQualityRulesEngine.js
 * Deterministic rules engine for evaluating water test results against IS 10500:2012.
 *
 * Enforces issue #754 requirements:
 * - NO AI diagnosis or opaque scoring.
 * - Deterministic, rule-based parameter threshold comparison.
 * - Explainable recommendation provenance (ruleset version, citation, input fields).
 * - Human-in-the-loop requirement: all flagged values require human official review.
 */

import { IS_10500_STANDARDS } from '../data/waterQualityContract.js';

export const RULESET_VERSION = 'v1.0.0-IS10500-2012-R2021';

/**
 * Compliance levels for a single parameter
 */
export const COMPLIANCE_LEVELS = Object.freeze({
  ACCEPTABLE: 'acceptable', // Within desirable acceptable limit
  PERMISSIBLE_WARNING: 'permissible_warning', // Exceeds acceptable, but within permissible limit
  HAZARDOUS_EXCEEDED: 'hazardous_exceeded', // Exceeds permissible limit or microbiological failure
  INVALID: 'invalid', // Non-numeric or impossible value
});

/**
 * Evaluates an individual parameter value against IS 10500:2012
 *
 * @param {string} parameterCode - The parameter code (e.g. 'ph', 'tds', 'turbidity', 'e_coli')
 * @param {number|string} testedValue - The measured value
 * @returns {object} Evaluation breakdown with compliance status and explainability
 */
export function evaluateParameterValue(parameterCode, testedValue) {
  const paramDef = IS_10500_STANDARDS.parameters[parameterCode];
  if (!paramDef) {
    return {
      parameterCode,
      level: COMPLIANCE_LEVELS.INVALID,
      message: `Unknown parameter code: ${parameterCode}`,
      compliant: false,
    };
  }

  const numericValue = typeof testedValue === 'number' ? testedValue : parseFloat(testedValue);
  if (isNaN(numericValue) || numericValue < 0) {
    return {
      parameterCode,
      name: paramDef.name,
      level: COMPLIANCE_LEVELS.INVALID,
      message: 'Value must be a valid non-negative number.',
      compliant: false,
    };
  }

  // Bacteriological zero-tolerance check
  if (paramDef.category === 'bacteriological') {
    if (numericValue > 0) {
      return {
        parameterCode,
        name: paramDef.name,
        testedValue: numericValue,
        unit: paramDef.unit,
        level: COMPLIANCE_LEVELS.HAZARDOUS_EXCEEDED,
        compliant: false,
        isMicrobialRisk: true,
        citation: `${IS_10500_STANDARDS.specification} Clause 4.1: Must not be detectable in any 100 mL sample.`,
        message: `Microbiological pathogen detected (${numericValue} ${paramDef.unit}). Immediate disinfection advisory indicated.`,
        acceptableLimit: '0 MPN/100mL',
        permissibleLimit: 'No relaxation',
      };
    }

    return {
      parameterCode,
      name: paramDef.name,
      testedValue: 0,
      unit: paramDef.unit,
      level: COMPLIANCE_LEVELS.ACCEPTABLE,
      compliant: true,
      isMicrobialRisk: false,
      citation: `${IS_10500_STANDARDS.specification} Clause 4.1`,
      message: 'Bacteriological pathogen absent (0 MPN/100mL).',
      acceptableLimit: '0 MPN/100mL',
      permissibleLimit: 'No relaxation',
    };
  }

  // Minimum threshold check (e.g., pH < 6.5 or free residual chlorine < 0.2 in treated piped water)
  const isBelowAcceptableMin = numericValue < paramDef.acceptableMin;
  const isAboveAcceptableMax = numericValue > paramDef.acceptableMax;
  const isBelowPermissibleMin = numericValue < paramDef.permissibleMin;
  const isAbovePermissibleMax = numericValue > paramDef.permissibleMax;

  if (!isBelowAcceptableMin && !isAboveAcceptableMax) {
    return {
      parameterCode,
      name: paramDef.name,
      testedValue: numericValue,
      unit: paramDef.unit,
      level: COMPLIANCE_LEVELS.ACCEPTABLE,
      compliant: true,
      citation: `${IS_10500_STANDARDS.specification}`,
      message: `Within desirable acceptable limit (${paramDef.acceptableMin} - ${paramDef.acceptableMax} ${paramDef.unit}).`,
      acceptableLimit: `${paramDef.acceptableMin} - ${paramDef.acceptableMax} ${paramDef.unit}`,
      permissibleLimit: paramDef.relaxationAllowed
        ? `${paramDef.permissibleMin} - ${paramDef.permissibleMax} ${paramDef.unit}`
        : 'No relaxation',
    };
  }

  // Check if exceeds permissible limits (or below minimums where prohibited)
  if (isBelowPermissibleMin || isAbovePermissibleMax) {
    return {
      parameterCode,
      name: paramDef.name,
      testedValue: numericValue,
      unit: paramDef.unit,
      level: COMPLIANCE_LEVELS.HAZARDOUS_EXCEEDED,
      compliant: false,
      citation: `${IS_10500_STANDARDS.specification}`,
      message: `Exceeds statutory permissible limit (${paramDef.permissibleMax} ${paramDef.unit}). Remedial intervention required.`,
      acceptableLimit: `${paramDef.acceptableMin} - ${paramDef.acceptableMax} ${paramDef.unit}`,
      permissibleLimit: paramDef.relaxationAllowed
        ? `${paramDef.permissibleMin} - ${paramDef.permissibleMax} ${paramDef.unit}`
        : 'No relaxation',
    };
  }

  // Within permissible limit, but exceeds acceptable desirable limit
  return {
    parameterCode,
    name: paramDef.name,
    testedValue: numericValue,
    unit: paramDef.unit,
    level: COMPLIANCE_LEVELS.PERMISSIBLE_WARNING,
    compliant: true, // Statistically usable only in absence of alternative source
    inAbsenceOfAlternative: true,
    citation: `${IS_10500_STANDARDS.specification}`,
    message: `Exceeds desirable limit (${paramDef.acceptableMax} ${paramDef.unit}) but within permissible limit in absence of alternate source (${paramDef.permissibleMax} ${paramDef.unit}).`,
    acceptableLimit: `${paramDef.acceptableMin} - ${paramDef.acceptableMax} ${paramDef.unit}`,
    permissibleLimit: `${paramDef.permissibleMin} - ${paramDef.permissibleMax} ${paramDef.unit}`,
  };
}

/**
 * Evaluates an entire batch of test results for a sampling event.
 * Produces explainable recommendation with provenance metadata.
 *
 * @param {Array<{parameterCode: string, testedValue: number|string}>} results
 * @returns {object} Batch compliance summary and explainable recommendation
 */
export function evaluateSampleResultsBatch(results = []) {
  const evaluations = [];
  const exceededParams = [];
  const warningParams = [];
  let containsMicrobialHazard = false;

  for (const item of results) {
    const evalResult = evaluateParameterValue(item.parameterCode, item.testedValue);
    evaluations.push(evalResult);

    if (evalResult.level === COMPLIANCE_LEVELS.HAZARDOUS_EXCEEDED) {
      exceededParams.push(evalResult);
      if (evalResult.isMicrobialRisk) {
        containsMicrobialHazard = true;
      }
    } else if (evalResult.level === COMPLIANCE_LEVELS.PERMISSIBLE_WARNING) {
      warningParams.push(evalResult);
    }
  }

  const isFullyCompliant = exceededParams.length === 0 && warningParams.length === 0;
  const isConditionallyAcceptable = exceededParams.length === 0 && warningParams.length > 0;

  let overallStatus = 'compliant';
  let suggestedAction = null;

  if (containsMicrobialHazard) {
    overallStatus = 'critical_hazard';
    suggestedAction = {
      actionType: 'chlorination_shock',
      priority: 'high',
      rationale: 'Microbiological contamination detected. Immediate disinfection and boil-water advisory recommended.',
    };
  } else if (exceededParams.length > 0) {
    overallStatus = 'exceeded';
    suggestedAction = {
      actionType: 'source_isolation',
      priority: 'medium',
      rationale: `Parameters exceeded statutory limits: ${exceededParams.map((p) => p.name).join(', ')}. Scrutiny needed.`,
    };
  } else if (warningParams.length > 0) {
    overallStatus = 'warning';
    suggestedAction = {
      actionType: 'filter_replacement',
      priority: 'low',
      rationale: `Parameters within permissible limits but exceed desirable baseline: ${warningParams.map((p) => p.name).join(', ')}.`,
    };
  }

  return {
    isFullyCompliant,
    isConditionallyAcceptable,
    overallStatus,
    evaluations,
    exceededCount: exceededParams.length,
    warningCount: warningParams.length,
    containsMicrobialHazard,
    suggestedAction,
    provenance: {
      rulesetVersion: RULESET_VERSION,
      standard: IS_10500_STANDARDS.specification,
      effectiveDate: IS_10500_STANDARDS.effectiveDate,
      reaffirmedYear: IS_10500_STANDARDS.reaffirmedYear,
      executionTimestamp: new Date().toISOString(),
      influencingParameters: [...exceededParams, ...warningParams].map((p) => ({
        code: p.parameterCode,
        name: p.name,
        testedValue: p.testedValue,
        unit: p.unit,
        level: p.level,
      })),
      humanDecisionRequired: true,
      diagnosticDisclaimer:
        'Deterministic rule-based standard comparison only. Not medical or clinical advice. All public alerts require human officer authorization.',
    },
  };
}
