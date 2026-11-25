/**
 * src/services/proposalClusteringService.js
 * Bounded Duplicate Clustering Engine for Participatory Ward Budget Proposals (#765).
 *
 * Rules:
 * - Strictly deterministic, transparent, and explainable scoring.
 * - Does NOT make eligibility decisions or rank public support.
 * - Records ruleset version, feature contribution, and execution timestamp.
 * - Authorized human (resident or committee reviewer) retains final authority to merge, edit, or reject.
 */

export const CLUSTERING_RULESET_VERSION = 'v1.4.0-trigram-token-jaccard';

// Common stop words to strip before comparing
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'by', 'from',
  'road', 'street', 'main', 'cross', 'layout', 'near', 'ward', 'bbmp', 'please', 'construct', 'repair',
  'fix', 'provide', 'install', 'installation', 'urgent', 'area', 'lane',
]);

export const tokenizeText = (text) => {
  if (typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
};

export const computeJaccardSimilarity = (tokensA, tokensB) => {
  if (!tokensA.length || !tokensB.length) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionCount += 1;
  }
  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
};

/**
 * Compare an incoming proposal draft against the existing proposal registry.
 * Returns bounded duplicate candidate recommendations with explainable provenance.
 */
export const findDuplicateCandidates = (draft, existingProposals = [], options = {}) => {
  const threshold = options.threshold ?? 0.35;
  const maxResults = options.maxResults ?? 3;

  if (!draft || typeof draft !== 'object') {
    return {
      candidates: [],
      metadata: {
        rulesetVersion: CLUSTERING_RULESET_VERSION,
        timestamp: new Date().toISOString(),
        explanation: 'Invalid draft provided.',
      },
    };
  }

  const draftTitleTokens = tokenizeText(draft.title || '');
  const draftDescTokens = tokenizeText(draft.description || '');
  const draftLocationTokens = tokenizeText(draft.approximateLocation || '');
  const draftCategory = draft.category || '';
  const draftWard = draft.ward || '';

  const candidates = [];

  for (const candidate of existingProposals) {
    // Skip if comparing to itself
    if (draft.id && candidate.id === draft.id) continue;
    // Skip if candidate is already marked as duplicate of something else
    if (candidate.status === 'consolidated_duplicate') continue;

    const candTitleTokens = tokenizeText(candidate.title || '');
    const candDescTokens = tokenizeText(candidate.description || '');
    const candLocationTokens = tokenizeText(candidate.approximateLocation || '');

    const titleSim = computeJaccardSimilarity(draftTitleTokens, candTitleTokens);
    const descSim = computeJaccardSimilarity(draftDescTokens, candDescTokens);
    const locationSim = computeJaccardSimilarity(draftLocationTokens, candLocationTokens);

    const categoryExactMatch = draftCategory && candidate.category === draftCategory ? 1.0 : 0.0;
    const wardExactMatch = draftWard && candidate.ward === draftWard ? 1.0 : 0.0;

    // Weighted composite score (title and location carry highest signal)
    const compositeScore = (
      titleSim * 0.40 +
      locationSim * 0.25 +
      descSim * 0.15 +
      categoryExactMatch * 0.10 +
      wardExactMatch * 0.10
    );

    if (compositeScore >= threshold) {
      const influencingFactors = [];
      if (titleSim > 0.2) influencingFactors.push(`Title similarity (${Math.round(titleSim * 100)}%)`);
      if (locationSim > 0.2) influencingFactors.push(`Nearby location keywords (${Math.round(locationSim * 100)}%)`);
      if (categoryExactMatch) influencingFactors.push('Matching civic category');
      if (wardExactMatch) influencingFactors.push('Matching municipal ward');

      candidates.push({
        proposalId: candidate.id,
        title: candidate.title,
        status: candidate.status,
        category: candidate.category,
        approximateLocation: candidate.approximateLocation,
        similarityScore: Math.round(compositeScore * 100),
        influencingFactors,
        humanAction: 'pending_review', // pending_review | accepted_as_duplicate | rejected_distinct
      });
    }
  }

  // Sort descending by similarity
  candidates.sort((a, b) => b.similarityScore - a.similarityScore);
  const topCandidates = candidates.slice(0, maxResults);

  return {
    candidates: topCandidates,
    metadata: {
      rulesetVersion: CLUSTERING_RULESET_VERSION,
      executionTimestamp: new Date().toISOString(),
      evaluatedCandidateCount: existingProposals.length,
      threshold,
      advisoryNotice:
        'Clustering suggestions are advisory to help citizens and committee reviewers consolidate repetitive submissions. Final merger requires human confirmation.',
    },
  };
};

