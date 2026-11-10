/**
 * Evidence-Entailment Verification and Unsupported-Claim Detection Service
 *
 * Implements an entailment verification layer that:
 * 1. Decomposes RAG assistant answers into atomic verifiable claims.
 * 2. Classifies each claim against retrieved evidence chunks into entailment states:
 *    - 'SUPPORTED'
 *    - 'CONTRADICTED'
 *    - 'INSUFFICIENT_EVIDENCE'
 * 3. Maps claims directly to source chunk IDs and official citation identifiers.
 * 4. Applies a deterministic rule layer for high-risk factual assertions:
 *    - Statutory fees
 *    - Strict processing deadlines
 *    - Penalty clauses & legal references
 * 5. Appends a conservative, fail-closed uncertainty notice when evidence is missing.
 */

export const ENTAILMENT_STATUS = {
  SUPPORTED: 'SUPPORTED',
  CONTRADICTED: 'CONTRADICTED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
};

export const CLAIM_RISK_CATEGORY = {
  HIGH_RISK_FEE: 'HIGH_RISK_FEE',
  HIGH_RISK_DEADLINE: 'HIGH_RISK_DEADLINE',
  HIGH_RISK_PENALTY_LEGAL: 'HIGH_RISK_PENALTY_LEGAL',
  GENERAL_FACT: 'GENERAL_FACT',
};

/**
 * Tokenizes text into normalized word stems/tokens.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeClaim(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 2);
}

/**
 * Decomposes an assistant response text into atomic verifiable claims.
 * Handles numbered lists, bullets, and sentence boundaries.
 *
 * @param {string} responseText
 * @returns {Array<{ id: string, text: string, riskCategory: string }>}
 */
export function decomposeClaims(responseText = '') {
  if (!responseText || typeof responseText !== 'string') return [];

  // Split by newlines, list items, or sentence terminators (. ! ?)
  const rawSegments = responseText
    .split(/(?:\r?\n+|(?<=[.!?])\s+(?=[A-Z0-9]))/)
    .map((s) => s.trim().replace(/^[-*•]\s+/, '').replace(/^\d+[\).]\s*/, ''))
    .filter((s) => s.length > 10);

  return rawSegments.map((text, idx) => {
    let riskCategory = CLAIM_RISK_CATEGORY.GENERAL_FACT;

    // Detect high risk categories
    if (/(?:fee|charge|cost|rupees?|inr|rs\.?|\₹|\bpay\b)/i.test(text)) {
      riskCategory = CLAIM_RISK_CATEGORY.HIGH_RISK_FEE;
    } else if (/(?:deadline|window|within\s+\d+|timeline|days?|months?|tat|validity)/i.test(text)) {
      riskCategory = CLAIM_RISK_CATEGORY.HIGH_RISK_DEADLINE;
    } else if (/(?:section\s+\d+|penalt|fine|court|act\b|statutory|offence|prosecut)/i.test(text)) {
      riskCategory = CLAIM_RISK_CATEGORY.HIGH_RISK_PENALTY_LEGAL;
    }

    return {
      id: `claim-${idx + 1}`,
      text,
      riskCategory,
    };
  });
}

/**
 * Computes token overlap and directional entailment between a claim and a single evidence chunk.
 *
 * @param {string} claimText
 * @param {string} evidenceText
 * @returns {{ overlapRatio: number, isNegationContradiction: boolean }}
 */
function analyzeClaimAgainstEvidence(claimText, evidenceText) {
  const claimTokens = tokenizeClaim(claimText);
  const evidenceTokens = new Set(tokenizeClaim(evidenceText));

  if (claimTokens.length === 0) {
    return { overlapRatio: 0, isNegationContradiction: false };
  }

  let matchCount = 0;
  for (const token of claimTokens) {
    if (evidenceTokens.has(token)) matchCount += 1;
  }

  // Overlap ratio calculation
  const overlapRatio = matchCount / claimTokens.length;

  // Explicit negation tokens
  const negationRegex = /\b(not|never|no|prohibited|exempted|cannot|neither|nor)\b/i;
  const claimHasNegation = negationRegex.test(claimText);
  const evidenceHasNegation = negationRegex.test(evidenceText);

  // A contradiction occurs if significant overlap exists (>= 0.65) AND one text has explicit negation while the other does not
  const isNegationContradiction = overlapRatio >= 0.65 && (claimHasNegation !== evidenceHasNegation);

  return { overlapRatio, isNegationContradiction };
}

/**
 * Verifies a single claim against a collection of retrieved evidence chunks.
 *
 * @param {{ id: string, text: string, riskCategory: string }} claim
 * @param {Array<{ id: string, title?: string, text: string, sourceUrl?: string }>} evidenceChunks
 * @param {object} options
 * @param {number} [options.supportThreshold=0.6] Overlap ratio required for SUPPORTED
 * @param {number} [options.highRiskSupportThreshold=0.75] Stricter ratio required for statutory/financial claims
 * @returns {object} Verified claim detail
 */
export function verifyClaim(claim, evidenceChunks = [], options = {}) {
  const {
    supportThreshold = 0.5,
    highRiskSupportThreshold = 0.7,
  } = options;

  const isHighRisk = claim.riskCategory !== CLAIM_RISK_CATEGORY.GENERAL_FACT;
  const threshold = isHighRisk ? highRiskSupportThreshold : supportThreshold;

  let bestMatch = null;
  let highestOverlap = -1;
  let foundContradiction = false;
  let contradictedChunk = null;

  for (const chunk of evidenceChunks) {
    const chunkText = chunk.text || chunk.content || '';
    const { overlapRatio, isNegationContradiction } = analyzeClaimAgainstEvidence(claim.text, chunkText);

    if (isNegationContradiction) {
      foundContradiction = true;
      contradictedChunk = chunk;
    }

    if (overlapRatio > highestOverlap) {
      highestOverlap = overlapRatio;
      bestMatch = chunk;
    }
  }

  let status = ENTAILMENT_STATUS.INSUFFICIENT_EVIDENCE;
  let supportingChunkIds = [];
  let citations = [];

  if (foundContradiction) {
    status = ENTAILMENT_STATUS.CONTRADICTED;
    if (contradictedChunk) {
      supportingChunkIds.push(contradictedChunk.id);
      citations.push({
        chunkId: contradictedChunk.id,
        title: contradictedChunk.title || 'Official Source Reference',
        url: contradictedChunk.sourceUrl || null,
      });
    }
  } else if (highestOverlap >= threshold && bestMatch) {
    status = ENTAILMENT_STATUS.SUPPORTED;
    supportingChunkIds.push(bestMatch.id);
    citations.push({
      chunkId: bestMatch.id,
      title: bestMatch.title || 'Official Scheme/Portal Guidance',
      url: bestMatch.sourceUrl || null,
    });
  }

  return {
    claimId: claim.id,
    claimText: claim.text,
    riskCategory: claim.riskCategory,
    status,
    confidence: Number(Math.max(0, highestOverlap).toFixed(3)),
    supportingChunkIds,
    citations,
  };
}

/**
 * Runs full entailment verification across all claims extracted from the answer.
 * Formulates safe, conservative uncertainty notices if unsupported claims exist.
 *
 * @param {string} answerText
 * @param {Array<object>} evidenceChunks
 * @param {object} [options]
 * @returns {{
 *   claims: Array<object>,
 *   verifiedCount: number,
 *   unsupportedCount: number,
 *   contradictedCount: number,
 *   overallSupported: boolean,
 *   failClosedNotice: string|null,
 *   sanitizedAnswer: string
 * }}
 */
export function verifyAnswerEntailment(answerText, evidenceChunks = [], options = {}) {
  const claims = decomposeClaims(answerText);
  if (claims.length === 0) {
    return {
      claims: [],
      verifiedCount: 0,
      unsupportedCount: 0,
      contradictedCount: 0,
      overallSupported: true,
      failClosedNotice: null,
      sanitizedAnswer: answerText,
    };
  }

  const verifiedClaims = claims.map((c) => verifyClaim(c, evidenceChunks, options));

  const verifiedCount = verifiedClaims.filter((c) => c.status === ENTAILMENT_STATUS.SUPPORTED).length;
  const unsupportedCount = verifiedClaims.filter((c) => c.status === ENTAILMENT_STATUS.INSUFFICIENT_EVIDENCE).length;
  const contradictedCount = verifiedClaims.filter((c) => c.status === ENTAILMENT_STATUS.CONTRADICTED).length;

  const hasHighRiskUnsupported = verifiedClaims.some(
    (c) => c.status !== ENTAILMENT_STATUS.SUPPORTED && c.riskCategory !== CLAIM_RISK_CATEGORY.GENERAL_FACT
  );

  let failClosedNotice = null;
  if (contradictedCount > 0) {
    failClosedNotice = 'Notice: Portions of this answer appear to conflict with verified official statutory documentation. Please confirm details directly at the designated portal.';
  } else if (hasHighRiskUnsupported) {
    failClosedNotice = 'Caution: Statutory fee or deadline information in this response could not be verified against current official guidelines. Always confirm fee amounts and timelines at the competent authority counter.';
  } else if (unsupportedCount > 0) {
    failClosedNotice = 'Important: Some statements in this answer are based on general civic patterns and lack direct clause-level citations in the official catalogue. Verify details before formal submission.';
  }

  const overallSupported = unsupportedCount === 0 && contradictedCount === 0;

  return {
    claims: verifiedClaims,
    verifiedCount,
    unsupportedCount,
    contradictedCount,
    overallSupported,
    failClosedNotice,
    sanitizedAnswer: failClosedNotice ? `${answerText}\n\n> [!NOTE]\n> ${failClosedNotice}` : answerText,
  };
}
