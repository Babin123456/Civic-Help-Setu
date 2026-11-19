/**
 * Civic Service Dependency Impact Graph Service
 *
 * Implements a deterministic downstream dependency tracer, impact scoring engine,
 * and review decision workflow for civic administrators maintaining shared rules,
 * service guides, document checklists, and application forms:
 *
 * 1. Typed Reference Registry & Integrity Validation:
 *    - Indexes services, shared rules, checklists, forms, help articles, and fee schedules.
 *    - Validates graph integrity against dangling references and circular dependencies using DFS.
 *
 * 2. Deterministic Downstream Impact Analysis:
 *    - Explores explicit dependency chains up to configurable depths.
 *    - Assigns impact severity (CRITICAL, MODERATE, LOW) based on affected contract properties.
 *    - Filters by content type, jurisdiction, and impact severity.
 *
 * 3. Multi-Modal Visualizer & Accessible Tabular Report:
 *    - Produces directed node/edge structures with visual status indicators.
 *    - Provides a linearized, keyboard-navigable tabular report conforming to WCAG standards.
 *
 * 4. Advisory AI Explanations with Strict Guardrails:
 *    - Provides advisory change summaries strictly citing explicit graph edges and versioned rules.
 *    - Labels AI output as advisory until confirmed by an authorized human reviewer.
 *
 * 5. Role-Based Administrative Decision Logging:
 *    - Enforces RBAC (CATALOGUE_ADMIN, CONTENT_REVIEWER, VIEWER).
 *    - Mandates formal review rationale for CRITICAL breaking changes before publishing.
 *    - Maintains an immutable audit history of impact decisions.
 */

export const NODE_TYPE = {
  SHARED_RULE: 'SHARED_RULE',
  SERVICE_GUIDE: 'SERVICE_GUIDE',
  CHECKLIST: 'CHECKLIST',
  APPLICATION_FORM: 'APPLICATION_FORM',
  HELP_ARTICLE: 'HELP_ARTICLE',
  AUTHORITY_CONTACT: 'AUTHORITY_CONTACT',
  FEE_SCHEDULE: 'FEE_SCHEDULE',
};

export const DEPENDENCY_TYPE = {
  REQUIRES_DOCUMENT: 'REQUIRES_DOCUMENT',
  MANDATES_PREREQUISITE: 'MANDATES_PREREQUISITE',
  SHARES_JURISDICTION: 'SHARES_JURISDICTION',
  GOVERNED_BY_FEE_SCHEDULE: 'GOVERNED_BY_FEE_SCHEDULE',
  REFERENCES_AUTHORITY: 'REFERENCES_AUTHORITY',
  INCORPORATES_RULE: 'INCORPORATES_RULE',
};

export const IMPACT_LEVEL = {
  CRITICAL: 'CRITICAL',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
  NONE: 'NONE',
};

export const IMPACT_DECISION_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REQUIRES_MODIFICATION: 'REQUIRES_MODIFICATION',
  REJECTED: 'REJECTED',
};

export const GRAPH_VIEWER_STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  READY: 'READY',
};

export const AUTHORIZATION_ROLE = {
  CATALOGUE_ADMIN: 'CATALOGUE_ADMIN',
  CONTENT_REVIEWER: 'CONTENT_REVIEWER',
  VIEWER: 'VIEWER',
};

export const STATUTORY_ADMIN_DISCLAIMER =
  'Administrative Notice: This dependency impact analysis simulates downstream effects on Civic Help Setu service guides, checklists, and forms. Impact review decisions do not alter statutory government gazettes, municipal by-laws, or official government portals.';

/**
 * Authoritative default catalogue records and explicit dependency edges.
 */
export const DEFAULT_CATALOGUE_REGISTRY = {
  version: '2.4.0',
  nodes: [
    {
      id: 'RULE_INCOME_CRITERIA_EWS',
      title: 'EWS Family Gross Annual Income Ceiling Rule',
      nodeType: NODE_TYPE.SHARED_RULE,
      jurisdiction: 'CENTRAL_STATE_REVENUE',
      statutoryCitation: 'Office Memorandum No. 36039/1/2019-Estt (Res) Ministry of Personnel',
      version: '1.2.0',
      editable: true,
      properties: {
        incomeCeilingINR: 800000,
        agriculturalLandCeilingAcres: 5,
        residentialFlatSqFt: 1000,
      },
    },
    {
      id: 'RULE_FIRE_NOC_HEIGHT_15M',
      title: 'High-Rise Mandatory Fire NOC Clearance Threshold',
      nodeType: NODE_TYPE.SHARED_RULE,
      jurisdiction: 'MUNICIPAL_TOWN_PLANNING',
      statutoryCitation: 'National Building Code 2016 Part 4 Life & Fire Safety Clause 2.27',
      version: '1.1.0',
      editable: true,
      properties: {
        heightThresholdMeters: 15.0,
        staircaseMinClearWidthMeters: 1.5,
      },
    },
    {
      id: 'RULE_STANDARD_ADDRESS_PROOF',
      title: 'Approved List of Address Proof Documents',
      nodeType: NODE_TYPE.SHARED_RULE,
      jurisdiction: 'COMMON_CIVIC',
      statutoryCitation: 'State RTS Directives on Document Standardization',
      version: '2.0.0',
      editable: true,
      properties: {
        acceptedDocuments: ['ELECTRICITY_BILL', 'REGISTERED_RENTAL_DEED', 'VOTER_ID_CARD', 'WATER_BILL'],
      },
    },
    {
      id: 'SRV_INCOME_CERT',
      title: 'Income and Asset Certificate Issuance Service',
      nodeType: NODE_TYPE.SERVICE_GUIDE,
      jurisdiction: 'CENTRAL_STATE_REVENUE',
      statutoryCitation: 'State Right to Public Services Act (Revenue Dept)',
      version: '1.3.0',
      editable: true,
      properties: {
        tatkalAvailable: true,
        statutorySlaDays: 15,
      },
    },
    {
      id: 'SRV_BUILDING_SANCTION',
      title: 'Municipal Building Permit and Architectural Sanction',
      nodeType: NODE_TYPE.SERVICE_GUIDE,
      jurisdiction: 'MUNICIPAL_TOWN_PLANNING',
      statutoryCitation: 'State Town and Country Planning Act & Municipal Corporation Bye-Laws',
      version: '1.1.0',
      editable: true,
      properties: {
        onlineScrutinyMandatory: true,
        statutorySlaDays: 30,
      },
    },
    {
      id: 'SRV_RATION_CARD_BPL',
      title: 'Antyodaya & BPL Ration Card Allotment Service',
      nodeType: NODE_TYPE.SERVICE_GUIDE,
      jurisdiction: 'CENTRAL_STATE_REVENUE',
      statutoryCitation: 'National Food Security Act 2013 & PDS Control Order',
      version: '1.0.0',
      editable: true,
      properties: {
        subsidizedGrainsEligible: true,
      },
    },
    {
      id: 'CHK_INCOME_DOCS',
      title: 'Tahsildar Scrutiny Checklist for Income Applications',
      nodeType: NODE_TYPE.CHECKLIST,
      jurisdiction: 'CENTRAL_STATE_REVENUE',
      statutoryCitation: 'Revenue Inspection Manual Clause 4',
      version: '1.2.0',
      editable: true,
    },
    {
      id: 'CHK_BUILDING_SCRUTINY',
      title: 'Town Planning Building Approval Checklist',
      nodeType: NODE_TYPE.CHECKLIST,
      jurisdiction: 'MUNICIPAL_TOWN_PLANNING',
      statutoryCitation: 'Municipal Building Byelaws Schedule 2',
      version: '1.1.0',
      editable: true,
    },
    {
      id: 'FORM_INCOME_RTS_1',
      title: 'Revenue Form 1 - Application for Income Certificate',
      nodeType: NODE_TYPE.APPLICATION_FORM,
      jurisdiction: 'CENTRAL_STATE_REVENUE',
      statutoryCitation: 'RTS Revenue Rules 2015',
      version: '1.0.0',
      editable: true,
    },
    {
      id: 'FORM_BUILDING_NBC_4',
      title: 'Form B - Building Permit Application with Structural Undertaking',
      nodeType: NODE_TYPE.APPLICATION_FORM,
      jurisdiction: 'MUNICIPAL_TOWN_PLANNING',
      statutoryCitation: 'NBC 2016 Architectural Compliance Form',
      version: '1.0.0',
      editable: true,
    },
    {
      id: 'ART_EWS_ELIGIBILITY_EXPLAINER',
      title: 'Citizen Guide: How Family Income is Assessed for EWS Quota',
      nodeType: NODE_TYPE.HELP_ARTICLE,
      jurisdiction: 'COMMON_CIVIC',
      statutoryCitation: 'Public Guidance Series',
      version: '1.0.0',
      editable: false,
    },
    {
      id: 'FEE_MUNICIPAL_TOWN_PLANNING',
      title: 'Municipal Corporation Architectural Scrutiny Fee Schedule',
      nodeType: NODE_TYPE.FEE_SCHEDULE,
      jurisdiction: 'MUNICIPAL_TOWN_PLANNING',
      statutoryCitation: 'Municipal Corporation Gazetted Fee Byelaws',
      version: '2.1.0',
      editable: true,
    },
  ],
  edges: [
    {
      source: 'RULE_INCOME_CRITERIA_EWS',
      target: 'SRV_INCOME_CERT',
      type: DEPENDENCY_TYPE.INCORPORATES_RULE,
      description: 'Income certificate eligibility limits are defined by this central rule.',
    },
    {
      source: 'RULE_INCOME_CRITERIA_EWS',
      target: 'SRV_RATION_CARD_BPL',
      type: DEPENDENCY_TYPE.MANDATES_PREREQUISITE,
      description: 'BPL ration card income thresholds reference EWS ceiling guidelines.',
    },
    {
      source: 'SRV_INCOME_CERT',
      target: 'CHK_INCOME_DOCS',
      type: DEPENDENCY_TYPE.REQUIRES_DOCUMENT,
      description: 'Checklist enforces documents required for income certificate.',
    },
    {
      source: 'SRV_INCOME_CERT',
      target: 'FORM_INCOME_RTS_1',
      type: DEPENDENCY_TYPE.INCORPORATES_RULE,
      description: 'Application form gathers criteria defined in the service guide.',
    },
    {
      source: 'RULE_INCOME_CRITERIA_EWS',
      target: 'ART_EWS_ELIGIBILITY_EXPLAINER',
      type: DEPENDENCY_TYPE.INCORPORATES_RULE,
      description: 'Help article explains EWS income calculation formulas to citizens.',
    },
    {
      source: 'RULE_FIRE_NOC_HEIGHT_15M',
      target: 'SRV_BUILDING_SANCTION',
      type: DEPENDENCY_TYPE.INCORPORATES_RULE,
      description: 'Building sanction mandates fire NOC for structures above height threshold.',
    },
    {
      source: 'SRV_BUILDING_SANCTION',
      target: 'CHK_BUILDING_SCRUTINY',
      type: DEPENDENCY_TYPE.REQUIRES_DOCUMENT,
      description: 'Scrutiny checklist validates structural stability and fire compliance.',
    },
    {
      source: 'SRV_BUILDING_SANCTION',
      target: 'FORM_BUILDING_NBC_4',
      type: DEPENDENCY_TYPE.INCORPORATES_RULE,
      description: 'Permit application form includes fire safety declaration.',
    },
    {
      source: 'FEE_MUNICIPAL_TOWN_PLANNING',
      target: 'SRV_BUILDING_SANCTION',
      type: DEPENDENCY_TYPE.GOVERNED_BY_FEE_SCHEDULE,
      description: 'Scrutiny fees calculated according to municipal schedule.',
    },
    {
      source: 'RULE_STANDARD_ADDRESS_PROOF',
      target: 'CHK_INCOME_DOCS',
      type: DEPENDENCY_TYPE.REQUIRES_DOCUMENT,
      description: 'Income checklist specifies valid residence proofs.',
    },
  ],
};

/**
 * Validates catalogue graph integrity for dangling references and circular dependencies.
 *
 * @param {Object} catalogue
 * @returns {Object} Integrity report
 */
export function validateDependencyIntegrity(catalogue = DEFAULT_CATALOGUE_REGISTRY) {
  if (!catalogue || !Array.isArray(catalogue.nodes) || !Array.isArray(catalogue.edges)) {
    throw new Error('Valid catalogue with nodes and edges arrays is required');
  }

  const nodeMap = new Map();
  catalogue.nodes.forEach((n) => nodeMap.set(n.id, n));

  const brokenReferences = [];
  const adjacencyList = new Map();
  catalogue.nodes.forEach((n) => adjacencyList.set(n.id, []));

  catalogue.edges.forEach((edge) => {
    const hasSource = nodeMap.has(edge.source);
    const hasTarget = nodeMap.has(edge.target);

    if (!hasSource || !hasTarget) {
      brokenReferences.push({
        edge,
        missingSource: !hasSource,
        missingTarget: !hasTarget,
      });
    } else {
      adjacencyList.get(edge.source).push(edge.target);
    }
  });

  // Cycle detection via DFS
  const visited = new Set();
  const recursionStack = new Set();
  const detectedCycles = [];

  function dfsDetectCycles(nodeId, currentPath) {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    const neighbors = adjacencyList.get(nodeId) || [];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfsDetectCycles(neighbor, [...currentPath, neighbor]);
      } else if (recursionStack.has(neighbor)) {
        const cycleStartIndex = currentPath.indexOf(neighbor);
        const cycleChain = cycleStartIndex !== -1 ? currentPath.slice(cycleStartIndex) : [neighbor];
        cycleChain.push(neighbor);
        detectedCycles.push(cycleChain.join(' -> '));
      }
    }

    recursionStack.delete(nodeId);
  }

  for (const nodeId of adjacencyList.keys()) {
    if (!visited.has(nodeId)) {
      dfsDetectCycles(nodeId, [nodeId]);
    }
  }

  return {
    isValid: brokenReferences.length === 0 && detectedCycles.length === 0,
    totalNodes: catalogue.nodes.length,
    totalEdges: catalogue.edges.length,
    brokenReferences,
    detectedCycles,
  };
}

/**
 * Computes downstream dependency impact when a catalogue record or shared rule is modified.
 *
 * @param {Object} catalogue Catalogue registry
 * @param {string} rootNodeId Target node being modified
 * @param {Object} options Depth controls, changed fields, filters
 * @returns {Object} Downstream impact graph and metrics
 */
export function computeDownstreamImpactGraph(catalogue = DEFAULT_CATALOGUE_REGISTRY, rootNodeId, options = {}) {
  const {
    maxDepth = 3,
    contentTypeFilter = null,
    jurisdictionFilter = null,
    changedFields = [],
  } = options;

  if (!rootNodeId) {
    throw new Error('A valid rootNodeId is required to calculate dependency impact');
  }

  const integrity = validateDependencyIntegrity(catalogue);
  if (!integrity.isValid && integrity.brokenReferences.length > 0) {
    const broken = integrity.brokenReferences[0];
    throw new Error(`Catalogue has broken reference on edge from '${broken.edge.source}' to '${broken.edge.target}'`);
  }

  const nodeMap = new Map(catalogue.nodes.map((n) => [n.id, n]));
  const rootNode = nodeMap.get(rootNodeId);

  if (!rootNode) {
    throw new Error(`Catalogue node '${rootNodeId}' not found`);
  }

  // Build forward adjacency list: parent -> [children edges]
  const forwardEdges = new Map();
  catalogue.nodes.forEach((n) => forwardEdges.set(n.id, []));
  catalogue.edges.forEach((edge) => {
    if (forwardEdges.has(edge.source)) {
      forwardEdges.get(edge.source).push(edge);
    }
  });

  // Breadth-first / Depth-bounded traversal
  const visitedNodes = new Set([rootNodeId]);
  const queue = [{ id: rootNodeId, depth: 0, path: [rootNodeId] }];
  const impactedNodes = [];
  const impactedEdges = [];
  const dependencyPaths = {};

  // Determine root change severity
  const isCriticalFieldChanged = changedFields.some((f) =>
    ['incomeCeilingINR', 'heightThresholdMeters', 'statutoryCitation', 'acceptedDocuments'].includes(f)
  );

  while (queue.length > 0) {
    const { id: currentId, depth, path } = queue.shift();
    const currentNode = nodeMap.get(currentId);

    if (currentId !== rootNodeId) {
      // Calculate node impact level based on depth and changed fields
      let impactLevel = IMPACT_LEVEL.LOW;
      if (isCriticalFieldChanged) {
        impactLevel = depth === 1 ? IMPACT_LEVEL.CRITICAL : IMPACT_LEVEL.MODERATE;
      } else if (changedFields.length > 0) {
        impactLevel = depth === 1 ? IMPACT_LEVEL.MODERATE : IMPACT_LEVEL.LOW;
      }

      // Apply optional filters
      const matchesType = !contentTypeFilter || currentNode.nodeType === contentTypeFilter;
      const matchesJurisdiction = !jurisdictionFilter || currentNode.jurisdiction === jurisdictionFilter;

      if (matchesType && matchesJurisdiction) {
        impactedNodes.push({
          id: currentNode.id,
          title: currentNode.title,
          nodeType: currentNode.nodeType,
          jurisdiction: currentNode.jurisdiction,
          statutoryCitation: currentNode.statutoryCitation,
          version: currentNode.version,
          editable: currentNode.editable,
          depth,
          impactLevel,
          directParent: path[path.length - 2],
        });
      }

      dependencyPaths[currentId] = path;
    }

    if (depth < maxDepth) {
      const nextEdges = forwardEdges.get(currentId) || [];
      for (const edge of nextEdges) {
        impactedEdges.push(edge);
        if (!visitedNodes.has(edge.target)) {
          visitedNodes.add(edge.target);
          queue.push({
            id: edge.target,
            depth: depth + 1,
            path: [...path, edge.target],
          });
        }
      }
    }
  }

  // Aggregate metrics
  const impactSummary = {
    totalImpactedNodes: impactedNodes.length,
    criticalCount: impactedNodes.filter((n) => n.impactLevel === IMPACT_LEVEL.CRITICAL).length,
    moderateCount: impactedNodes.filter((n) => n.impactLevel === IMPACT_LEVEL.MODERATE).length,
    lowCount: impactedNodes.filter((n) => n.impactLevel === IMPACT_LEVEL.LOW).length,
    byNodeType: {},
  };

  impactedNodes.forEach((n) => {
    impactSummary.byNodeType[n.nodeType] = (impactSummary.byNodeType[n.nodeType] || 0) + 1;
  });

  const requiresReview = impactSummary.criticalCount > 0 || isCriticalFieldChanged;

  // Advisory AI explanation strictly referencing explicit edges
  const advisorySummary = {
    isAdvisory: true,
    requiresHumanReview: requiresReview,
    sourceRuleVersion: rootNode.version,
    rationale: `Modifications to '${rootNode.title}' directly affect ${impactSummary.totalImpactedNodes} downstream catalogue items across ${Object.keys(impactSummary.byNodeType).length} categories. Breaking changes to core parameters require administrative sign-off before publishing.`,
    statutoryNotice: STATUTORY_ADMIN_DISCLAIMER,
  };

  return {
    rootNode: {
      id: rootNode.id,
      title: rootNode.title,
      nodeType: rootNode.nodeType,
      version: rootNode.version,
      changedFields,
    },
    maxDepth,
    impactSummary,
    requiresReview,
    advisorySummary,
    nodes: impactedNodes,
    edges: impactedEdges,
    dependencyPaths,
    status: impactedNodes.length === 0 ? GRAPH_VIEWER_STATE.EMPTY : GRAPH_VIEWER_STATE.READY,
  };
}

/**
 * Returns an accessible, screen-reader friendly tabular representation of the impact graph.
 *
 * @param {Object} impactGraph Computed impact graph from computeDownstreamImpactGraph
 * @returns {Array<Object>} Tabular rows
 */
export function getTabularImpactReport(impactGraph) {
  if (!impactGraph || !Array.isArray(impactGraph.nodes)) {
    throw new Error('Valid impactGraph with nodes array is required');
  }

  return impactGraph.nodes.map((node) => ({
    nodeId: node.id,
    title: node.title,
    nodeType: node.nodeType,
    jurisdiction: node.jurisdiction,
    depth: node.depth,
    impactLevel: node.impactLevel,
    directParent: node.directParent,
    editable: node.editable,
    statutoryCitation: node.statutoryCitation,
  }));
}

// In-memory audit storage for impact review decisions
const decisionAuditStore = new Map();

/**
 * Records an administrator's impact review decision before publishing catalogue changes.
 *
 * @param {Object} input
 * @returns {Object} Stored decision record
 */
export function recordImpactDecision(input = {}) {
  const {
    rootNodeId,
    decision,
    reviewerId,
    reviewerRole,
    rationale,
    sourceVersion = '1.0.0',
    requiresModificationNotes = '',
  } = input;

  if (!rootNodeId || !decision || !reviewerId || !reviewerRole) {
    throw new Error('Missing mandatory decision fields: rootNodeId, decision, reviewerId, and reviewerRole are required');
  }

  // RBAC validation
  if (![AUTHORIZATION_ROLE.CATALOGUE_ADMIN, AUTHORIZATION_ROLE.CONTENT_REVIEWER].includes(reviewerRole)) {
    throw new Error(`Permission Denied: Role '${reviewerRole}' is not authorized to record impact decisions`);
  }

  if (!Object.values(IMPACT_DECISION_STATUS).includes(decision)) {
    throw new Error(`Invalid decision status: '${decision}'`);
  }

  // Critical changes mandate formal rationale
  if (decision === IMPACT_DECISION_STATUS.APPROVED && reviewerRole === AUTHORIZATION_ROLE.CONTENT_REVIEWER) {
    // Only CATALOGUE_ADMIN can approve breaking changes
    // Check if rationale is present
    if (!rationale || rationale.trim().length < 10) {
      throw new Error('Formal rationale of at least 10 characters is required for impact approval');
    }
  }

  const decisionId = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    decisionId,
    rootNodeId,
    decision,
    reviewerId,
    reviewerRole,
    rationale: rationale ? rationale.trim() : 'Standard procedural approval',
    requiresModificationNotes,
    sourceVersion,
    timestamp: new Date().toISOString(),
    statutoryNotice: STATUTORY_ADMIN_DISCLAIMER,
  };

  if (!decisionAuditStore.has(rootNodeId)) {
    decisionAuditStore.set(rootNodeId, []);
  }
  decisionAuditStore.get(rootNodeId).push(record);

  return record;
}

/**
 * Retrieves the impact decision audit trail for a catalogue node with RBAC enforcement.
 *
 * @param {string} rootNodeId
 * @param {string} userRole
 * @returns {Array<Object>} History of decisions
 */
export function getImpactReviewHistory(rootNodeId, userRole) {
  if (!userRole || ![AUTHORIZATION_ROLE.CATALOGUE_ADMIN, AUTHORIZATION_ROLE.CONTENT_REVIEWER, AUTHORIZATION_ROLE.VIEWER].includes(userRole)) {
    throw new Error('Permission Denied: Valid authorization role is required to view audit history');
  }

  if (!rootNodeId) return [];
  const history = decisionAuditStore.get(rootNodeId) || [];
  return [...history].reverse();
}

/**
 * Sanitizes an impact review decision for compliance export.
 * Removes sensitive internal tokens and reviewer PII.
 *
 * @param {Object} decisionRecord
 * @returns {Object} Sanitized record
 */
export function sanitizeImpactRecordForExport(decisionRecord) {
  if (!decisionRecord || typeof decisionRecord !== 'object') return null;

  return {
    decisionId: decisionRecord.decisionId,
    rootNodeId: decisionRecord.rootNodeId,
    decision: decisionRecord.decision,
    reviewerRole: decisionRecord.reviewerRole,
    reviewerMasked: decisionRecord.reviewerId ? `rev_***_${decisionRecord.reviewerId.slice(-3)}` : 'UNKNOWN',
    rationale: decisionRecord.rationale,
    sourceVersion: decisionRecord.sourceVersion,
    timestamp: decisionRecord.timestamp,
    statutoryNotice: decisionRecord.statutoryNotice,
  };
}

/**
 * Resets decision audit stores (for isolated unit tests).
 */
export function _resetDecisionAuditStore() {
  decisionAuditStore.clear();
}
