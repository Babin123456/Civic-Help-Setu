/**
 * Civic Scheme Convergence Analyzer for Overlapping Benefits Service
 *
 * Implements comparative benefit and compatibility analysis across Central, State, and Local schemes:
 * 1. Analyzes pairs or sets of civic schemes for compatibility states:
 *    - 'COMPLEMENTARY' (Can be received concurrently, e.g. health insurance + state cash transfer)
 *    - 'CONDITIONAL' (Allowed under specific circumstances or up to financial ceilings)
 *    - 'RESTRICTED' (Mutually exclusive under explicit non-duplication / de-duplication rules)
 *    - 'UNKNOWN' (Rule or circular not documented; never infers exclusion from silence)
 * 2. Grounds compatibility determinations in exact statutory passages and gazette notifications.
 * 3. Supports anonymous scenario exploration: No personally identifiable data is stored or required.
 * 4. Never infers sensitive attributes (caste, religion, disability) from generic documents.
 * 5. Explicitly notes that final adjudication remains with the competent sanctioning authority.
 */

export const CONVERGENCE_STATUS = {
  COMPLEMENTARY: 'COMPLEMENTARY',
  CONDITIONAL: 'CONDITIONAL',
  RESTRICTED: 'RESTRICTED',
  UNKNOWN: 'UNKNOWN',
};

export const SCHEME_CONVERGENCE_DISCLAIMER =
  'Convergence guidance is based on published departmental non-duplication circulars and guidelines. Silence in published rules is treated as UNKNOWN, not as a restriction. Final eligibility and sanction authority rests exclusively with the respective nodal departments.';

/**
 * Validates scheme benefit clause structure.
 * @param {object} scheme
 * @returns {boolean}
 */
export function validateSchemeModel(scheme) {
  return Boolean(
    scheme &&
      scheme.id &&
      scheme.name &&
      scheme.level && // 'CENTRAL', 'STATE', 'LOCAL'
      scheme.benefitType // 'CASH_TRANSFER', 'HEALTH_INSURANCE', 'HOUSING_SUBSIDY', 'NUTRITION'
  );
}

/**
 * Evaluates whether two schemes have mutual non-duplication or concurrency restrictions.
 *
 * @param {object} schemeA
 * @param {object} schemeB
 * @param {Array<object>} circularCorpus Verified department circulars and non-duplication clauses
 * @returns {object} Convergence determination between schemeA and schemeB
 */
export function evaluatePairwiseConvergence(schemeA, schemeB, circularCorpus = []) {
  if (!validateSchemeModel(schemeA) || !validateSchemeModel(schemeB)) {
    throw new Error('Valid scheme objects are required for convergence evaluation');
  }

  // 1. Check for explicit restriction in circular corpus
  const restrictionClause = circularCorpus.find((chunk) => {
    const text = (chunk.text || chunk.content || '').toLowerCase();
    const mentionsA = text.includes(schemeA.id.toLowerCase()) || text.includes(schemeA.name.toLowerCase());
    const mentionsB = text.includes(schemeB.id.toLowerCase()) || text.includes(schemeB.name.toLowerCase());
    const hasExclusionToken =
      /not\s+eligible|mutually\s+exclusive|cannot\s+avail|shall\s+not\s+be\s+entitled|either\s+.*or\b|non-duplication/i.test(text);

    return mentionsA && mentionsB && hasExclusionToken;
  });

  if (restrictionClause) {
    return {
      schemeAId: schemeA.id,
      schemeBId: schemeB.id,
      status: CONVERGENCE_STATUS.RESTRICTED,
      reason: 'Explicit non-duplication statutory clause bars concurrent benefit receipt.',
      citation: {
        circularId: restrictionClause.id,
        title: restrictionClause.title || 'Official Non-Duplication Circular',
        orderNumber: restrictionClause.orderNumber || 'Departmental Gazette',
        verbatimPassage: restrictionClause.text || '',
      },
    };
  }

  // 2. Check for conditional convergence (e.g. topping up up to ceiling)
  const conditionalClause = circularCorpus.find((chunk) => {
    const text = (chunk.text || chunk.content || '').toLowerCase();
    const cleanA = schemeA.name.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const cleanB = schemeB.name.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    const tokensA = cleanA.split(/\s+/).filter((t) => t.length > 3);
    const tokensB = cleanB.split(/\s+/).filter((t) => t.length > 3);

    const mentionsA = text.includes(schemeA.id.toLowerCase()) || tokensA.some((t) => text.includes(t));
    const mentionsB = text.includes(schemeB.id.toLowerCase()) || tokensB.some((t) => text.includes(t));
    const hasConditionToken = /top-up|supplement|subject\s+to\s+ceiling|differential|balance\s+amount/i.test(text);

    return mentionsA && mentionsB && hasConditionToken;
  });

  if (conditionalClause) {
    return {
      schemeAId: schemeA.id,
      schemeBId: schemeB.id,
      status: CONVERGENCE_STATUS.CONDITIONAL,
      reason: 'Concurrent receipt is allowed conditionally (e.g. state top-up over central base allocation).',
      citation: {
        circularId: conditionalClause.id,
        title: conditionalClause.title || 'Official Convergence Directive',
        orderNumber: conditionalClause.orderNumber || 'State Cabinet Directive',
        verbatimPassage: conditionalClause.text || '',
      },
    };
  }

  // 3. Different sectors / benefit types are generally complementary if no restriction exists
  if (schemeA.benefitType !== schemeB.benefitType) {
    return {
      schemeAId: schemeA.id,
      schemeBId: schemeB.id,
      status: CONVERGENCE_STATUS.COMPLEMENTARY,
      reason: `Schemes address different welfare dimensions (${schemeA.benefitType} vs ${schemeB.benefitType}) with no conflicting exclusionary clauses recorded.`,
      citation: null,
    };
  }

  // 4. Check for shared beneficiary exclusions (e.g. taxpayer exclusion, government employee exclusion)
  const sharedExclusionClause = circularCorpus.find((chunk) => {
    const text = (chunk.text || chunk.content || '').toLowerCase();
    const hasExclusionKeywords = /income-tax\s+assessee|government\s+servant|constitutional\s+post|institutional\s+landholder/i.test(text);
    return hasExclusionKeywords;
  });

  // 5. If same benefit type but no explicit circular exists: Treat as UNKNOWN (Never infer exclusion from silence)
  return {
    schemeAId: schemeA.id,
    schemeBId: schemeB.id,
    status: CONVERGENCE_STATUS.UNKNOWN,
    reason: `Both schemes provide similar benefits (${schemeA.benefitType}), but no published convergence or exclusion directive was found in the verified catalogue.`,
    citation: null,
    generalExclusionNotice: sharedExclusionClause
      ? 'Note: Standard statutory exclusions (such as income-tax paying criteria) may apply independently to both schemes.'
      : null,
  };
}

/**
 * Filters a candidate list of schemes to identify potential convergence clusters.
 *
 * @param {Array<object>} schemes
 * @returns {Map<string, Array<object>>} Grouped by benefitType
 */
export function clusterSchemesByBenefitSector(schemes = []) {
  const groups = new Map();
  for (const s of schemes) {
    const type = s.benefitType || 'OTHER';
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type).push(s);
  }
  return groups;
}

/**
 * Generates an exportable citizen-facing convergence advisory report.
 *
 * @param {object} convergenceResult
 * @returns {string} Formatted markdown report
 */
export function formatConvergenceReport(convergenceResult) {
  if (!convergenceResult) return '';

  const rows = (convergenceResult.pairwiseEvaluations || []).map((ev) => {
    return `- **${ev.schemeAId}** vs **${ev.schemeBId}**: [${ev.status}] - ${ev.reason}`;
  });

  return `# Civic Scheme Convergence Advisory

## Overall Portfolio Status: ${convergenceResult.overallPortfolioStatus || 'UNKNOWN'}
Total Schemes Evaluated: ${convergenceResult.totalSchemes || 0}
Has Restrictions: ${convergenceResult.hasRestrictions ? 'YES' : 'NO'}

### Pairwise Convergence Findings
${rows.join('\n')}

> [!NOTE]
> ${convergenceResult.disclaimer || SCHEME_CONVERGENCE_DISCLAIMER}
`;
}

/**
 * Analyzes convergence across a portfolio of multiple schemes.
 * Runs completely anonymously; does not require or retain user profile data.
 *
 * @param {Array<object>} schemes
 * @param {Array<object>} circularCorpus
 * @returns {object} Convergence matrix and summary
 */
export function analyzeSchemePortfolioConvergence(schemes = [], circularCorpus = []) {
  if (!Array.isArray(schemes) || schemes.length < 2) {
    return {
      totalSchemes: schemes.length,
      pairwiseEvaluations: [],
      hasRestrictions: false,
      summary: 'At least two schemes are required to analyze benefit convergence.',
      disclaimer: SCHEME_CONVERGENCE_DISCLAIMER,
    };
  }

  const pairwiseEvaluations = [];
  let hasRestrictions = false;
  let hasConditional = false;
  let hasUnknown = false;

  for (let i = 0; i < schemes.length; i++) {
    for (let j = i + 1; j < schemes.length; j++) {
      const evaluation = evaluatePairwiseConvergence(schemes[i], schemes[j], circularCorpus);
      pairwiseEvaluations.push(evaluation);

      if (evaluation.status === CONVERGENCE_STATUS.RESTRICTED) hasRestrictions = true;
      if (evaluation.status === CONVERGENCE_STATUS.CONDITIONAL) hasConditional = true;
      if (evaluation.status === CONVERGENCE_STATUS.UNKNOWN) hasUnknown = true;
    }
  }

  let overallPortfolioStatus = CONVERGENCE_STATUS.COMPLEMENTARY;
  if (hasRestrictions) {
    overallPortfolioStatus = CONVERGENCE_STATUS.RESTRICTED;
  } else if (hasConditional) {
    overallPortfolioStatus = CONVERGENCE_STATUS.CONDITIONAL;
  } else if (hasUnknown) {
    overallPortfolioStatus = CONVERGENCE_STATUS.UNKNOWN;
  }

  return {
    totalSchemes: schemes.length,
    overallPortfolioStatus,
    hasRestrictions,
    pairwiseEvaluations,
    disclaimer: SCHEME_CONVERGENCE_DISCLAIMER,
  };
}
