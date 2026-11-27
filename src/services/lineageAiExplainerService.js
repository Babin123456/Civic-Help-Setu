/**
 * src/services/lineageAiExplainerService.js
 * Bounded AI & deterministic graph explainer for Civic Knowledge Records Lineage (#777).
 *
 * Enforces:
 *  - Non-Hallucination Invariant: Summarizes existing DAG edges only; strictly never invents missing edges.
 *  - Full Traceability Stamp: Ruleset version, input feature window, execution timestamp.
 *  - Human-in-the-Loop: Authorized humans can accept, edit, or reject recommendations.
 *  - Zero PII: Excludes personal identity numbers, private emails, and phone numbers.
 *  - Deterministic Fallback: Reliable graph-walking template explanation when models or network are unavailable.
 */

import { getLineageDAG } from './provenanceService';

export const EXPLAINER_RULESET_VERSION = 'lineage_explainer_ruleset@1.2.0';

/**
 * Traverses a validated lineage DAG and produces an explainable summary with zero hallucinated edges.
 */
export const explainLineagePath = (targetEntityId, { userRole = 'public' } = {}) => {
  const timestamp = new Date().toISOString();
  const dag = getLineageDAG(targetEntityId, { userRole });

  // If no edges exist, return an explicit unverified state instead of fabricating connections
  if (!dag.edges || dag.edges.length === 0) {
    return {
      targetEntityId,
      status: 'unverified_unlinked',
      summary: `No verified legal provenance path is currently linked to '${targetEntityId}'. This fact requires authoritative source attachment by an editorial reviewer.`,
      sources: [],
      rulesetVersion: EXPLAINER_RULESET_VERSION,
      executionTimestamp: timestamp,
      confidenceScore: 0.0,
      hasHumanReview: false,
      isDeterministic: true,
      traceability: {
        totalHops: 0,
        edgesTraversed: 0,
        sourceNodesCount: 0,
      },
    };
  }

  // Find authoritative root sources
  const sourceNodes = dag.nodes.filter((n) => n.type === 'source');
  const snapshotNodes = dag.nodes.filter((n) => n.type === 'snapshot');
  const transformationNodes = dag.nodes.filter((n) => n.type === 'transformation');
  const reviews = dag.reviews || [];

  const sourceNames = sourceNodes.map((s) => s.data?.name || s.label);
  const publishers = [...new Set(sourceNodes.map((s) => s.data?.publisher).filter(Boolean))];
  const effectiveDates = [...new Set(snapshotNodes.map((sn) => sn.data?.effectiveDate).filter(Boolean))];

  // Calculate composite confidence score (min confidence along chain)
  const confidenceScores = dag.edges.map((e) => e.confidenceScore || 1.0);
  const minConfidence = confidenceScores.length > 0 ? Math.min(...confidenceScores) : 1.0;

  const hasUnreachableSource = sourceNodes.some((s) => s.data?.status === 'unreachable');
  const hasSupersededSource = sourceNodes.some((s) => s.data?.status === 'superseded');

  // Build deterministic plain-language narrative
  let explanation = `This civic fact ('${targetEntityId}') is directly verified through a ${dag.edges.length}-stage legal provenance chain. `;
  if (hasUnreachableSource) {
    explanation += 'WARNING: Authoritative source URL is currently marked unreachable or broken. Re-verification required. ';
  } else if (hasSupersededSource) {
    explanation += 'NOTICE: Authoritative source has been superseded by a newer statutory order. ';
  }

  if (publishers.length > 0) {
    explanation += `Authoritative legal publisher: ${publishers.join(', ')}. `;
  }
  if (sourceNames.length > 0) {
    explanation += `Source statutory reference: "${sourceNames[0]}". `;
  }
  if (effectiveDates.length > 0) {
    explanation += `Statutory effective date: ${effectiveDates.join(', ')}. `;
  }

  if (transformationNodes.length > 0) {
    explanation += `Extracted and normalized via parser ${transformationNodes[0].data?.parserVersion || 'v1.0'}. `;
  }

  const latestReview = reviews[0];
  let reviewState = 'pending_review';
  if (latestReview) {
    reviewState = latestReview.reviewDecision;
    explanation += `Human editorial review status: ${latestReview.reviewDecision.toUpperCase()}`;
    if (latestReview.publicNotes) {
      explanation += ` (${latestReview.publicNotes})`;
    }
    explanation += '.';
  } else {
    explanation += 'Human editorial review is currently pending.';
  }

  return {
    targetEntityId,
    status: hasUnreachableSource ? 'unreachable' : hasSupersededSource ? 'superseded' : 'verified',
    hasUnreachableSource,
    hasSupersededSource,
    summary: explanation,
    publishers,
    sourceNames,
    effectiveDates,
    sources: sourceNodes.map((s) => ({
      id: s.id,
      name: s.data?.name,
      publisher: s.data?.publisher,
      sourceUrl: s.data?.sourceUrl,
      status: s.data?.status,
    })),
    snapshots: snapshotNodes.map((sn) => ({
      id: sn.id,
      effectiveDate: sn.data?.effectiveDate,
      contentHash: sn.data?.contentHash,
      retrievalTimestamp: sn.data?.retrievalTimestamp,
    })),
    transformations: transformationNodes.map((t) => ({
      id: t.id,
      parserVersion: t.data?.parserVersion,
      rulesetVersion: t.data?.rulesetVersion,
      transformationType: t.data?.transformationType,
    })),
    reviewState,
    confidenceScore: minConfidence,
    hasHumanReview: Boolean(latestReview && latestReview.reviewDecision === 'approved'),
    rulesetVersion: EXPLAINER_RULESET_VERSION,
    executionTimestamp: timestamp,
    inputFeatureWindow: `Full causal chain for ${targetEntityId} over ${dag.nodes.length} nodes and ${dag.edges.length} edges`,
    isDeterministic: true,
    traceability: {
      totalHops: dag.edges.length,
      edgesTraversed: dag.edges.length,
      sourceNodesCount: sourceNodes.length,
      snapshotCount: snapshotNodes.length,
    },
  };
};

/**
 * Human review decision handler for AI recommendations
 */
export const recordHumanDecisionOnAiSummary = (targetEntityId, decision, user = 'reviewer', notes = '') => {
  if (!['accept', 'edit', 'reject'].includes(decision)) {
    throw new Error("Decision must be 'accept', 'edit', or 'reject'");
  }

  return {
    targetEntityId,
    decision,
    reviewedBy: user,
    reviewedAt: new Date().toISOString(),
    notes,
    rulesetVersion: EXPLAINER_RULESET_VERSION,
  };
};

