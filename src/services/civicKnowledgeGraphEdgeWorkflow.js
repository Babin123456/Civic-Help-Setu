/**
 * src/services/civicKnowledgeGraphEdgeWorkflow.js
 *
 * Cross-Department Service Dependency & Human-Reviewed Edge Workflow (#1429).
 *
 * Extends `civicKnowledgeGraphService.js` (#1184) with:
 *   1. Static DFS cycle detection before proposing or publishing dependency edges.
 *   2. Human-reviewed edge publication with contributor/reviewer separation.
 *   3. Jurisdiction scoping & effective date filtering.
 *   4. Accessible, flat dependency list view alongside graph traversal.
 *   5. Immutable, PII-free edge publication audit log.
 */

import { civicKnowledgeGraph } from './civicKnowledgeGraphService.js';
import {
  GRAPH_EDGE_TYPES,
  PUBLICATION_STATUSES,
} from '../data/civicKnowledgeGraphContract.js';

export const EDGE_PROPOSAL_STORAGE_KEY = 'civicbridge_kg_edge_proposals_v1';
export const EDGE_AUDIT_STORAGE_KEY = 'civicbridge_kg_edge_audit_v1';

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

export function hasForbiddenPII(input) {
  const s = typeof input === 'string' ? input : JSON.stringify(input || {});
  return AADHAAR_RE.test(s) || PAN_RE.test(s);
}

export function isHttpsUrl(url) {
  try {
    return new URL(String(url || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Static DFS cycle detector: checks whether adding (sourceNodeId -> targetNodeId)
 * creates a cycle in the directed dependency graph.
 */
export function detectCycleWithCandidateEdge(edges = [], sourceNodeId, targetNodeId) {
  if (!sourceNodeId || !targetNodeId) return { hasCycle: false, cyclePath: [] };
  if (sourceNodeId === targetNodeId) {
    return { hasCycle: true, cyclePath: [sourceNodeId, targetNodeId] };
  }

  // Build adjacency list from existing edges + candidate edge
  const adj = new Map();
  const addEdge = (from, to) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
  };

  for (const e of edges) {
    const from = e.from || e.source || e.sourceNodeId;
    const to = e.to || e.target || e.targetNodeId;
    if (from && to) addEdge(from, to);
  }
  addEdge(sourceNodeId, targetNodeId);

  // Check if targetNodeId can reach sourceNodeId (which closes a cycle)
  const visited = new Set();
  const stack = [[targetNodeId, [sourceNodeId, targetNodeId]]];

  while (stack.length > 0) {
    const [curr, path] = stack.pop();
    if (curr === sourceNodeId) {
      return { hasCycle: true, cyclePath: path };
    }
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const next of adj.get(curr) || []) {
      stack.push([next, [...path, next]]);
    }
  }

  return { hasCycle: false, cyclePath: [] };
}

function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(key, fallback, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value, customStorage = null) {
  const store = getStorage(customStorage);
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listEdgeProposals(customStorage = null) {
  return readJson(EDGE_PROPOSAL_STORAGE_KEY, [], customStorage);
}

export function listEdgeAuditLog(customStorage = null) {
  return readJson(EDGE_AUDIT_STORAGE_KEY, [], customStorage);
}

function appendEdgeAudit(entry, customStorage = null) {
  const logs = listEdgeAuditLog(customStorage);
  logs.unshift({
    auditId: `kgaud_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  writeJson(EDGE_AUDIT_STORAGE_KEY, logs.slice(0, 500), customStorage);
}

export function proposeDependencyEdge({
  sourceNodeId,
  targetNodeId,
  edgeType = GRAPH_EDGE_TYPES.REQUIRES_DOCUMENT,
  jurisdiction = 'All India',
  effectiveFrom = new Date().toISOString().slice(0, 10),
  effectiveTo = null,
  officialUrl,
  statutoryAct = '',
  provenanceKind = 'community_suggestion',
  proposedBy = 'contributor_local',
  graphInstance = civicKnowledgeGraph,
  customStorage = null,
}) {
  if (!sourceNodeId || !targetNodeId) {
    throw new Error('sourceNodeId and targetNodeId are required.');
  }
  if (!isHttpsUrl(officialUrl)) {
    throw new Error('Valid https:// officialUrl is required for edge provenance.');
  }
  if (hasForbiddenPII({ statutoryAct, jurisdiction, sourceNodeId, targetNodeId })) {
    throw new Error('Edge proposal must not contain Aadhaar or PAN numbers.');
  }

  const cycleCheck = detectCycleWithCandidateEdge(graphInstance.edges, sourceNodeId, targetNodeId);

  const proposal = {
    proposalId: `edgeprop_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    sourceNodeId,
    targetNodeId,
    edgeType,
    jurisdiction,
    effectiveFrom,
    effectiveTo,
    provenance: {
      officialUrl: officialUrl.trim(),
      statutoryAct: statutoryAct.trim() || 'Official Departmental Order',
      provenanceKind,
    },
    proposedBy,
    hasCycle: cycleCheck.hasCycle,
    cyclePath: cycleCheck.cyclePath,
    status: 'DRAFT_PENDING_REVIEW',
    rejectionReason: null,
    createdAt: new Date().toISOString(),
  };

  const list = listEdgeProposals(customStorage);
  list.unshift(proposal);
  writeJson(EDGE_PROPOSAL_STORAGE_KEY, list.slice(0, 200), customStorage);

  appendEdgeAudit(
    {
      action: 'EDGE_PROPOSED',
      proposalId: proposal.proposalId,
      actorId: proposedBy,
      sourceNodeId,
      targetNodeId,
      hasCycle: cycleCheck.hasCycle,
    },
    customStorage
  );

  return proposal;
}

export function reviewAndPublishEdge({
  proposalId,
  reviewerId = 'reviewer_local',
  reviewerRole = 'reviewer',
  decision,
  rejectionReason = '',
  graphInstance = civicKnowledgeGraph,
  customStorage = null,
}) {
  if (!['admin', 'reviewer', 'municipal_officer'].includes(reviewerRole)) {
    throw new Error('Forbidden: reviewer or admin role required to publish graph edges.');
  }

  const list = listEdgeProposals(customStorage);
  const prop = list.find((p) => p.proposalId === proposalId);
  if (!prop) throw new Error('Edge proposal not found.');
  if (prop.proposedBy === reviewerId) {
    throw new Error('Role separation: contributor cannot approve or publish their own edge proposal.');
  }

  if (decision === 'REJECT') {
    if (!rejectionReason.trim()) throw new Error('rejectionReason is required when rejecting an edge.');
    prop.status = 'REJECTED';
    prop.rejectionReason = rejectionReason.trim();
    prop.reviewedBy = reviewerId;
    prop.reviewedAt = new Date().toISOString();
    writeJson(EDGE_PROPOSAL_STORAGE_KEY, list, customStorage);
    appendEdgeAudit(
      { action: 'EDGE_REJECTED', proposalId, actorId: reviewerId, rejectionReason: prop.rejectionReason },
      customStorage
    );
    return { ok: true, status: 200, proposal: prop };
  }

  // Re-verify cycle check at publish time
  const cycleCheck = detectCycleWithCandidateEdge(graphInstance.edges, prop.sourceNodeId, prop.targetNodeId);
  if (cycleCheck.hasCycle) {
    appendEdgeAudit(
      { action: 'EDGE_PUBLISH_BLOCKED_CYCLE', proposalId, actorId: reviewerId, cyclePath: cycleCheck.cyclePath },
      customStorage
    );
    return {
      ok: false,
      status: 409,
      code: 'ERR_CYCLE_DETECTED',
      error: `Cannot publish edge: circular dependency detected (${cycleCheck.cyclePath.join(' -> ')}).`,
      cyclePath: cycleCheck.cyclePath,
    };
  }

  const publishedEdge = {
    id: `edge:${prop.proposalId}`,
    from: prop.sourceNodeId,
    to: prop.targetNodeId,
    type: prop.edgeType,
    jurisdiction: prop.jurisdiction,
    effectiveFrom: prop.effectiveFrom,
    effectiveTo: prop.effectiveTo,
    publicationStatus: PUBLICATION_STATUSES.PUBLISHED,
    provenance: {
      ...prop.provenance,
      reviewedBy: reviewerId,
      lastVerifiedAt: new Date().toISOString(),
    },
  };

  graphInstance.edges.push(publishedEdge);
  graphInstance.invalidateCache('edge_published');

  prop.status = 'PUBLISHED';
  prop.reviewedBy = reviewerId;
  prop.reviewedAt = new Date().toISOString();
  writeJson(EDGE_PROPOSAL_STORAGE_KEY, list, customStorage);

  appendEdgeAudit(
    {
      action: 'EDGE_PUBLISHED',
      proposalId,
      actorId: reviewerId,
      edgeId: publishedEdge.id,
      jurisdiction: prop.jurisdiction,
    },
    customStorage
  );

  return { ok: true, status: 200, proposal: prop, publishedEdge };
}

/**
 * Builds an accessible, flat dependency list (prerequisites, successors, authorities, documents)
 * scoped by jurisdiction and effective date.
 */
export function buildAccessibleDependencyList({
  startNodeId,
  jurisdiction = '',
  effectiveAsOf = '',
  graphInstance = civicKnowledgeGraph,
} = {}) {
  const res = graphInstance.queryGraph(
    {
      startNodeId,
      jurisdiction: jurisdiction || undefined,
      effectiveAsOf: effectiveAsOf || undefined,
      publicationStatus: PUBLICATION_STATUSES.PUBLISHED,
      maxDepth: 2,
      explain: true,
    },
    { role: 'admin' }
  );

  if (!res.ok) {
    return { ok: false, items: [], errors: res.errors || [res.message] };
  }

  const items = (res.edges || []).map((edge) => {
    const targetId = edge.to || edge.target;
    const sourceId = edge.from || edge.source;
    const targetNode = (res.nodes || []).find((n) => n.id === targetId);
    return {
      edgeId: edge.id,
      relation: edge.type,
      sourceId,
      targetId,
      targetTitle: targetNode?.title || targetNode?.name || targetId,
      targetType: targetNode?.type || 'unknown',
      jurisdiction: edge.jurisdiction || 'All India',
      effectiveFrom: edge.effectiveFrom || null,
      officialUrl: edge.provenance?.officialUrl || null,
      provenanceKind: edge.provenance?.provenanceKind || 'official_record',
    };
  });

  return { ok: true, items, cyclesDetected: res.cyclesDetected || [] };
}
