/**
 * Multi-Stage Civic Procedure Planner Service
 *
 * Implements a dependency-aware civic procedure graph planner:
 * 1. Models procedure nodes, prerequisites, conditional alternatives, authorities, and outcomes.
 * 2. Enforces that mandatory prerequisite edges have verified, jurisdiction-matched evidence.
 * 3. Detects missing or conflicting evidence and flags procedure nodes as 'UNRESOLVED'.
 * 4. Separates mandatory prerequisites from recommendations and conditional branches.
 * 5. Generates topologically ordered plans with explicit statutory justifications.
 * 6. Allows citizens to correct assumptions (e.g. State, applicant category) and regenerate deterministically.
 */

export const DEPENDENCY_TYPE = {
  MANDATORY: 'MANDATORY',
  RECOMMENDED: 'RECOMMENDED',
  CONDITIONAL: 'CONDITIONAL',
};

export const STEP_STATUS = {
  READY: 'READY',
  BLOCKED: 'BLOCKED',
  UNRESOLVED: 'UNRESOLVED',
  COMPLETED: 'COMPLETED',
};

/**
 * Validates whether an evidence chunk covers a given prerequisite edge in the specified jurisdiction.
 * @param {object} edge
 * @param {Array<object>} evidenceCorpus
 * @param {string} jurisdiction
 * @returns {{ valid: boolean, source: object|null, reason: string }}
 */
export function validateEdgeEvidence(edge, evidenceCorpus = [], jurisdiction = 'ALL_INDIA') {
  if (!edge || !edge.targetStepId) {
    return { valid: false, source: null, reason: 'Invalid edge specification' };
  }

  // If edge is recommended only, strictly verified citation is optional but preferred
  if (edge.type === DEPENDENCY_TYPE.RECOMMENDED) {
    return { valid: true, source: null, reason: 'Recommended step does not require statutory mandate' };
  }

  // Find evidence matching the prerequisite rule
  const matched = evidenceCorpus.find((chunk) => {
    const jMatches =
      !chunk.jurisdiction ||
      chunk.jurisdiction === 'ALL_INDIA' ||
      chunk.jurisdiction.toUpperCase() === jurisdiction.toUpperCase();

    const text = (chunk.text || chunk.content || '').toLowerCase();
    const matchesTarget = text.includes(edge.targetStepId.toLowerCase()) || (edge.keyword && text.includes(edge.keyword.toLowerCase()));

    return jMatches && matchesTarget;
  });

  if (!matched) {
    return {
      valid: false,
      source: null,
      reason: `No verified statutory evidence found for prerequisite '${edge.prerequisiteId}' in jurisdiction '${jurisdiction}'`,
    };
  }

  // Check for conflict marker
  if (matched.isConflicting || matched.status === 'SUPERSEDED') {
    return {
      valid: false,
      source: matched,
      reason: `Evidence for prerequisite '${edge.prerequisiteId}' is marked as superseded or in conflict`,
    };
  }

  return {
    valid: true,
    source: {
      id: matched.id,
      title: matched.title || 'Official Department Guidelines',
      sourceUrl: matched.sourceUrl || null,
      clause: matched.clause || 'General Provisions',
    },
    reason: 'Verified by jurisdiction-matched statutory rule',
  };
}

/**
 * Topologically sorts procedure nodes based on validated dependency edges.
 * Handles cyclic edge guards gracefully.
 *
 * @param {Array<object>} nodes
 * @param {Array<object>} edges
 * @returns {Array<string>} Ordered step IDs
 */
export function topologicalSortSteps(nodes = [], edges = []) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const adj = new Map(nodes.map((n) => [n.id, []]));

  // Build graph with mandatory and active conditional edges
  for (const edge of edges) {
    if (edge.type !== DEPENDENCY_TYPE.RECOMMENDED && nodeMap.has(edge.prerequisiteId) && nodeMap.has(edge.targetStepId)) {
      adj.get(edge.prerequisiteId).push(edge.targetStepId);
      inDegree.set(edge.targetStepId, (inDegree.get(edge.targetStepId) || 0) + 1);
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order = [];
  while (queue.length > 0) {
    const curr = queue.shift();
    order.push(curr);

    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) {
        queue.push(next);
      }
    }
  }

  // If cycle or unvisited nodes exist, append remaining nodes deterministically
  if (order.length < nodes.length) {
    for (const node of nodes) {
      if (!order.includes(node.id)) {
        order.push(node.id);
      }
    }
  }

  return order;
}

/**
 * Builds a multi-stage dependency-aware procedure plan.
 *
 * @param {object} params
 * @param {string} params.goalId Target procedure identifier (e.g., 'DRIVING_LICENCE', 'RATION_CARD_TRANSFER')
 * @param {string} [params.jurisdiction='ALL_INDIA'] State/UT or national scope
 * @param {object} [params.applicantContext={}] Applicant specifics (e.g., hasAadhaar, isMinor)
 * @param {Array<object>} params.procedureCatalog Master list of procedure step definitions
 * @param {Array<object>} params.dependencyEdges Master list of prerequisite links
 * @param {Array<object>} params.evidenceCorpus Curated statutory rules and guidelines
 * @returns {object} Formulated execution plan with status, ordered steps, dependencies, and citations
 */
export function buildCivicProcedurePlan({
  goalId,
  jurisdiction = 'ALL_INDIA',
  applicantContext = {},
  procedureCatalog = [],
  dependencyEdges = [],
  evidenceCorpus = [],
}) {
  if (!goalId) {
    throw new Error('Goal ID is required to plan procedure');
  }

  // Filter procedure steps relevant to the goal
  const relevantNodes = procedureCatalog.filter(
    (step) => step.goalId === goalId || step.category === goalId
  );

  if (relevantNodes.length === 0) {
    return {
      goalId,
      jurisdiction,
      planStatus: 'NO_STEPS_FOUND',
      orderedSteps: [],
      unresolvedDependencies: [],
      citations: [],
    };
  }

  const relevantStepIds = new Set(relevantNodes.map((n) => n.id));
  const relevantEdges = dependencyEdges.filter(
    (edge) => relevantStepIds.has(edge.targetStepId) || relevantStepIds.has(edge.prerequisiteId)
  );

  const validatedEdges = [];
  const unresolvedDependencies = [];
  const allCitations = [];

  for (const edge of relevantEdges) {
    // Check if conditional edge applies to current applicant context
    if (edge.type === DEPENDENCY_TYPE.CONDITIONAL && edge.condition) {
      const conditionMet = Boolean(applicantContext[edge.condition]);
      if (!conditionMet) {
        // Skip inapplicable conditional edge
        continue;
      }
    }

    const val = validateEdgeEvidence(edge, evidenceCorpus, jurisdiction);
    if (!val.valid) {
      unresolvedDependencies.push({
        prerequisiteId: edge.prerequisiteId,
        targetStepId: edge.targetStepId,
        type: edge.type,
        reason: val.reason,
      });
    } else {
      validatedEdges.push({
        ...edge,
        evidenceSource: val.source,
      });
      if (val.source) {
        allCitations.push(val.source);
      }
    }
  }

  // Topologically sort steps
  const sortedStepIds = topologicalSortSteps(relevantNodes, validatedEdges);

  // Mark step readiness status
  const completedStepSet = new Set(applicantContext.completedSteps || []);
  const orderedSteps = sortedStepIds.map((stepId, index) => {
    const node = relevantNodes.find((n) => n.id === stepId) || { id: stepId, name: stepId };
    const incomingEdges = validatedEdges.filter((e) => e.targetStepId === stepId);
    const hasUnresolvedPrereq = unresolvedDependencies.some((e) => e.targetStepId === stepId);

    let status = STEP_STATUS.READY;
    if (completedStepSet.has(stepId)) {
      status = STEP_STATUS.COMPLETED;
    } else if (hasUnresolvedPrereq) {
      status = STEP_STATUS.UNRESOLVED;
    } else {
      const allPrereqsMet = incomingEdges
        .filter((e) => e.type === DEPENDENCY_TYPE.MANDATORY)
        .every((e) => completedStepSet.has(e.prerequisiteId));

      if (!allPrereqsMet && incomingEdges.some((e) => e.type === DEPENDENCY_TYPE.MANDATORY)) {
        status = STEP_STATUS.BLOCKED;
      }
    }

    return {
      sequenceNumber: index + 1,
      id: node.id,
      name: node.name,
      description: node.description || '',
      authority: node.authority || 'Competent Authority',
      status,
      prerequisites: incomingEdges.map((e) => ({
        prerequisiteId: e.prerequisiteId,
        type: e.type,
        reason: e.reason || 'Statutory requirement',
        citation: e.evidenceSource,
      })),
      alternatives: node.alternatives || [],
    };
  });

  const planStatus =
    unresolvedDependencies.length > 0
      ? 'UNRESOLVED_DEPENDENCIES'
      : orderedSteps.every((s) => s.status === STEP_STATUS.COMPLETED)
      ? 'ALL_COMPLETED'
      : 'ACTIVE';

  return {
    goalId,
    jurisdiction,
    planStatus,
    orderedSteps,
    unresolvedDependencies,
    citations: Array.from(new Map(allCitations.map((c) => [c.id, c])).values()),
  };
}

/**
 * Calculates graph evaluation metrics (Dependency Precision and Unsupported-Edge Rate).
 *
 * @param {Array<object>} edges
 * @param {Array<object>} evidenceCorpus
 * @param {string} jurisdiction
 * @returns {{ totalEdges: number, supportedEdges: number, precision: number, unsupportedEdgeRate: number }}
 */
export function evaluatePlanGraphQuality(edges = [], evidenceCorpus = [], jurisdiction = 'ALL_INDIA') {
  if (edges.length === 0) {
    return { totalEdges: 0, supportedEdges: 0, precision: 1.0, unsupportedEdgeRate: 0 };
  }

  let supportedCount = 0;
  for (const edge of edges) {
    const val = validateEdgeEvidence(edge, evidenceCorpus, jurisdiction);
    if (val.valid) supportedCount += 1;
  }

  const precision = Number((supportedCount / edges.length).toFixed(3));
  const unsupportedEdgeRate = Number(((edges.length - supportedCount) / edges.length).toFixed(3));

  return {
    totalEdges: edges.length,
    supportedEdges: supportedCount,
    precision,
    unsupportedEdgeRate,
  };
}
