/**
 * Grounded Eligibility Explanation Service
 *
 * Synthesizes clear, factual explanations for eligibility assessment outcomes
 * based strictly on evaluated scheme criteria and verified citizen answers.
 *
 * Guarantees:
 * 1. Never recalculates or overrides the existing eligibility engine's status.
 * 2. Strictly distinguishes missing information from confirmed criteria mismatches.
 * 3. References verified criteria only — zero hallucinated rules.
 * 4. Error resilience: AI/formatting errors never block or alter assessment results.
 * 5. Appends mandatory administrative verification notices.
 */

export const ELIGIBILITY_STATUSES = ['eligible', 'conditional', 'ineligible', 'unknown'];

export const STATUS_DESCRIPTORS = {
  eligible: 'Fully Qualified Based on Answers',
  conditional: 'Conditionally Qualified (Action Required)',
  ineligible: 'Does Not Currently Meet Published Criteria',
  unknown: 'Assessment Inconclusive (Insufficient Information)'
};

export const MANDATORY_VERIFICATION_NOTICE =
  'This explanation is an automated summary grounded strictly in the published scheme criteria and the answers you provided. Official eligibility determinations rest exclusively with the designated competent government authority upon verification of original records.';

/**
 * Generates an explainable, grounded analysis of an eligibility assessment.
 *
 * @param {Object} assessment The evaluated result from the eligibility engine
 * @param {Object} [options] Optional configuration
 * @returns {Object} Grounded explanation object
 */
export function explainEligibilityAssessment(assessment, options = {}) {
  try {
    if (!assessment || typeof assessment !== 'object') {
      return createFallbackExplanation({
        status: 'unknown',
        schemeName: 'Civic Scheme',
        reason: 'No assessment data was provided.'
      });
    }

    const originalStatus = ELIGIBILITY_STATUSES.includes(assessment.status)
      ? assessment.status
      : 'unknown';

    const schemeName = assessment.schemeName || assessment.name || 'Civic Welfare Scheme';
    const rawReason = assessment.reason || '';
    const criteria = Array.isArray(assessment.criteria) ? assessment.criteria : [];
    const missingPrerequisites = Array.isArray(assessment.missingPrerequisites)
      ? assessment.missingPrerequisites
      : [];

    // Categorize criteria strictly by verified engine states
    const matchedCriteria = criteria.filter((c) => c.state === 'satisfied');
    const unmatchedCriteria = criteria.filter((c) => c.state === 'missing');
    const unassessedCriteria = criteria.filter((c) => c.state === 'unknown');
    const provisionalCriteria = criteria.filter((c) => c.state === 'confirm');

    // Synthesize narrative without overriding originalStatus
    const narrative = buildNarrative({
      status: originalStatus,
      schemeName,
      rawReason,
      matchedCriteria,
      unmatchedCriteria,
      unassessedCriteria,
      provisionalCriteria,
      missingPrerequisites
    });

    const keyTakeaways = buildKeyTakeaways({
      status: originalStatus,
      matchedCriteria,
      unmatchedCriteria,
      unassessedCriteria,
      missingPrerequisites
    });

    return {
      status: originalStatus, // Preserved without alteration
      statusLabel: STATUS_DESCRIPTORS[originalStatus],
      schemeName,
      engineReason: rawReason,
      narrative,
      keyTakeaways,
      breakdown: {
        matchedCount: matchedCriteria.length,
        unmatchedCount: unmatchedCriteria.length,
        unassessedCount: unassessedCriteria.length,
        provisionalCount: provisionalCriteria.length,
        matched: matchedCriteria.map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
        unmatched: unmatchedCriteria.map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
        unassessed: unassessedCriteria.map((c) => ({ id: c.id, label: c.label, detail: c.detail })),
        provisional: provisionalCriteria.map((c) => ({ id: c.id, label: c.label, detail: c.detail }))
      },
      verificationNotice: MANDATORY_VERIFICATION_NOTICE,
      isGrounded: true
    };
  } catch (error) {
    // Failure resilience: AI/service errors must never block or alter results
    return createFallbackExplanation(assessment, error);
  }
}

/**
 * Builds the natural-language explanation grounded strictly in the criteria.
 */
function buildNarrative({
  status,
  schemeName,
  rawReason,
  matchedCriteria,
  unmatchedCriteria,
  unassessedCriteria,
  provisionalCriteria,
  missingPrerequisites
}) {
  const parts = [];

  if (status === 'eligible') {
    parts.push(
      `You meet all evaluated requirements for ${schemeName}.`
    );
    if (matchedCriteria.length > 0) {
      const labels = matchedCriteria.map((c) => c.label).join(', ');
      parts.push(`Specifically, your answers satisfy: ${labels}.`);
    }
    if (rawReason) {
      parts.push(`Engine verification note: ${rawReason}`);
    }
    if (provisionalCriteria.length > 0) {
      parts.push(
        `Note that official documentation will still need to be verified in person for: ${provisionalCriteria.map((c) => c.label).join(', ')}.`
      );
    }
  } else if (status === 'conditional') {
    parts.push(
      `You partially qualify for ${schemeName}, but one or more procedural conditions must be completed.`
    );
    if (matchedCriteria.length > 0) {
      parts.push(`Your baseline qualifications were satisfied for: ${matchedCriteria.map((c) => c.label).join(', ')}.`);
    }
    if (missingPrerequisites.length > 0) {
      parts.push(`Pending prerequisite: ${missingPrerequisites.join('; ')}.`);
    }
    if (rawReason) {
      parts.push(`Reason: ${rawReason}`);
    }
    parts.push('Once these conditions are fulfilled, your application can proceed.');
  } else if (status === 'ineligible') {
    parts.push(
      `Your current profile does not qualify for ${schemeName} based on published guidelines.`
    );
    if (unmatchedCriteria.length > 0) {
      const failures = unmatchedCriteria.map((c) => `${c.label} (${c.detail || 'outside published thresholds'})`).join('; ');
      parts.push(`Unmatched requirement(s): ${failures}.`);
    } else if (rawReason) {
      parts.push(`Specific disqualification reason: ${rawReason}`);
    }
    if (matchedCriteria.length > 0) {
      parts.push(`Note that you did meet certain parameters (${matchedCriteria.map((c) => c.label).join(', ')}), but all mandatory criteria must be satisfied simultaneously.`);
    }
  } else {
    // status === 'unknown'
    parts.push(
      `Eligibility for ${schemeName} could not be determined from the available answers.`
    );
    if (unassessedCriteria.length > 0) {
      const missingFields = unassessedCriteria.map((c) => c.label).join(', ');
      parts.push(`Information is currently missing or uncollected for: ${missingFields}.`);
    }
    parts.push('This is not a rejection; answering the missing questionnaire prompts or reviewing official guidelines will enable a definitive assessment.');
  }

  return parts.join(' ');
}

/**
 * Builds bullet-point actionable takeaways.
 */
function buildKeyTakeaways({
  status,
  matchedCriteria,
  unmatchedCriteria,
  unassessedCriteria,
  missingPrerequisites
}) {
  const takeaways = [];

  if (status === 'eligible') {
    takeaways.push('All core eligibility conditions match your declared profile.');
    takeaways.push('Keep original identity and income proofs ready for departmental verification.');
  } else if (status === 'conditional') {
    takeaways.push('Baseline eligibility criteria met; pending administrative action required.');
    if (missingPrerequisites.length > 0) {
      takeaways.push(`Action needed: Complete ${missingPrerequisites[0]}.`);
    }
  } else if (status === 'ineligible') {
    if (unmatchedCriteria.length > 0) {
      takeaways.push(`Confirmed mismatch on: ${unmatchedCriteria[0].label}.`);
    }
    takeaways.push('Review alternative schemes or consult with department if your circumstances change.');
  } else {
    takeaways.push('Missing answers prevent automated determination.');
    if (unassessedCriteria.length > 0) {
      takeaways.push(`Please provide details for: ${unassessedCriteria[0].label}.`);
    }
  }

  return takeaways;
}

/**
 * Fallback generator when input is partial or processing throws.
 */
function createFallbackExplanation(assessment = {}, error = null) {
  const originalStatus = assessment && ELIGIBILITY_STATUSES.includes(assessment.status)
    ? assessment.status
    : 'unknown';

  return {
    status: originalStatus,
    statusLabel: STATUS_DESCRIPTORS[originalStatus] || 'Assessment Result',
    schemeName: assessment?.schemeName || assessment?.name || 'Civic Welfare Scheme',
    engineReason: assessment?.reason || 'Evaluation completed according to scheme rules.',
    narrative: assessment?.reason
      ? `Assessment result: ${assessment.reason}`
      : 'Evaluation generated from available profile answers.',
    keyTakeaways: ['Please verify all parameters against official departmental guidelines.'],
    breakdown: {
      matchedCount: 0,
      unmatchedCount: 0,
      unassessedCount: 0,
      provisionalCount: 0,
      matched: [],
      unmatched: [],
      unassessed: [],
      provisional: []
    },
    verificationNotice: MANDATORY_VERIFICATION_NOTICE,
    isGrounded: true,
    hadErrorFallback: Boolean(error)
  };
}
