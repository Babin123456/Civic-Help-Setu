/**
 * src/services/provenanceService.js
 * Core service layer for Civic Knowledge Records Data Lineage & Provenance Explorer (#777).
 * Provides typed domain operations, DAG cycle prevention, graph traversal, supersession,
 * export utilities, and role-scoped read/write boundaries.
 */

import { logDiagnostic } from '../utils/diagnostics';

import {
  validateKnowledgeSource,
  validateSourceSnapshot,
  validateTransformationRun,
  validateProvenanceEdge,
  validateEditorialReview,
  validateSupersessionLink,
  canTransitionSourceStatus,
  canTransitionReviewStatus,
  PROVENANCE_STATUS,
  EDGE_TYPES,
  PROVENANCE_SCHEMA_VERSION,
} from '../data/provenanceContract';

import {
  getStoredSources,
  saveStoredSources,
  getStoredSnapshots,
  saveStoredSnapshots,
  getStoredTransformations,
  saveStoredTransformations,
  getStoredEdges,
  saveStoredEdges,
  getStoredReviews,
  saveStoredReviews,
  getStoredSupersessions,
  saveStoredSupersessions,
  appendAuditLog,
} from './provenanceStorage';

/**
 * Cycle detection in directed graphs using Depth First Search (DFS)
 * Returns { hasCycle: boolean, cyclePath: string[] }
 */
export const detectCycles = (edges, newEdge = null) => {
  const allEdges = newEdge ? [...edges, newEdge] : edges;
  const adj = new Map();

  for (const edge of allEdges) {
    if (!edge || !edge.sourceEntityId || !edge.targetEntityId) continue;
    if (!adj.has(edge.sourceEntityId)) {
      adj.set(edge.sourceEntityId, []);
    }
    adj.get(edge.sourceEntityId).push(edge.targetEntityId);
  }

  const visited = new Set();
  const recStack = new Set();
  let cyclePath = [];

  const dfs = (node, path) => {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, path)) return true;
      } else if (recStack.has(neighbor)) {
        cyclePath = [...path, neighbor];
        return true;
      }
    }

    recStack.delete(node);
    path.pop();
    return false;
  };

  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      if (dfs(node, [])) {
        return { hasCycle: true, cyclePath };
      }
    }
  }

  return { hasCycle: false, cyclePath: [] };
};

/**
 * Lists Knowledge Sources with optional filters and pagination
 */
export const listKnowledgeSources = ({
  jurisdiction = null,
  status = null,
  search = '',
  limit = 50,
  offset = 0,
} = {}) => {
  let sources = getStoredSources();

  if (status && status !== 'all') {
    sources = sources.filter((s) => s.status === status);
  }

  if (jurisdiction && jurisdiction !== 'all') {
    sources = sources.filter((s) => s.jurisdiction?.state === jurisdiction || s.jurisdiction?.level === jurisdiction);
  }

  if (search && search.trim()) {
    const q = search.toLowerCase();
    sources = sources.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.publisher.toLowerCase().includes(q) ||
        s.sourceUrl.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  }

  const total = sources.length;
  const paginated = sources.slice(offset, offset + limit);

  return {
    items: paginated,
    total,
    offset,
    limit,
  };
};

/**
 * Gets a single Knowledge Source by ID
 */
export const getKnowledgeSourceById = (id) => {
  const sources = getStoredSources();
  return sources.find((s) => s.id === id) || null;
};

/**
 * Creates a new Knowledge Source
 */
export const createKnowledgeSource = (payload, actor = 'admin') => {
  const id = payload.id || `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const entity = {
    ...payload,
    id,
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    status: payload.status || PROVENANCE_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
  };

  const validation = validateKnowledgeSource(entity);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const sources = getStoredSources();
  if (sources.some((s) => s.id === id)) {
    throw new Error(`Knowledge Source with id '${id}' already exists.`);
  }

  const updated = [entity, ...sources];
  saveStoredSources(updated);

  appendAuditLog({
    action: 'CREATE_KNOWLEDGE_SOURCE',
    actor,
    entityId: id,
    details: { name: entity.name, publisher: entity.publisher },
  });

  return entity;
};

/**
 * Updates Knowledge Source status with state transition validation
 */
export const updateKnowledgeSourceStatus = (id, newStatus, reason = '', actor = 'admin') => {
  const sources = getStoredSources();
  const source = sources.find((s) => s.id === id);

  if (!source) {
    throw new Error(`Knowledge Source '${id}' not found.`);
  }

  if (!canTransitionSourceStatus(source.status, newStatus)) {
    throw new Error(
      `Invalid state transition: Cannot transition Knowledge Source status from '${source.status}' to '${newStatus}'.`
    );
  }

  const updatedSource = {
    ...source,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  const updatedList = sources.map((s) => (s.id === id ? updatedSource : s));
  saveStoredSources(updatedList);

  appendAuditLog({
    action: 'UPDATE_SOURCE_STATUS',
    actor,
    entityId: id,
    fromStatus: source.status,
    toStatus: newStatus,
    reason,
  });

  return updatedSource;
};

/**
 * Records a new Source Snapshot
 */
export const recordSnapshot = (sourceId, snapshotData, actor = 'system') => {
  const id = snapshotData.id || `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const entity = {
    ...snapshotData,
    id,
    sourceId,
    retrievalTimestamp: snapshotData.retrievalTimestamp || new Date().toISOString(),
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
  };

  const validation = validateSourceSnapshot(entity);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const snapshots = getStoredSnapshots();
  const updated = [entity, ...snapshots];
  saveStoredSnapshots(updated);

  appendAuditLog({
    action: 'RECORD_SNAPSHOT',
    actor,
    entityId: id,
    sourceId,
  });

  return entity;
};

/**
 * Records a new Transformation Run
 */
export const recordTransformation = (snapshotId, runData, actor = 'system') => {
  const id = runData.id || `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const entity = {
    ...runData,
    id,
    snapshotId,
    executionTimestamp: runData.executionTimestamp || new Date().toISOString(),
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
  };

  const validation = validateTransformationRun(entity);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const transformations = getStoredTransformations();
  const updated = [entity, ...transformations];
  saveStoredTransformations(updated);

  appendAuditLog({
    action: 'RECORD_TRANSFORMATION',
    actor,
    entityId: id,
    snapshotId,
  });

  return entity;
};

/**
 * Adds a new provenance edge with cycle prevention
 */
export const addProvenanceEdge = (edgeData, actor = 'system') => {
  const id = edgeData.id || `edge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const entity = {
    ...edgeData,
    id,
    createdAt: new Date().toISOString(),
  };

  const validation = validateProvenanceEdge(entity);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const existingEdges = getStoredEdges();

  // Enforce DAG invariant: Detect cycles before writing
  const cycleCheck = detectCycles(existingEdges, entity);
  if (cycleCheck.hasCycle) {
    const err = new Error(
      `Cyclic lineage detected: adding edge from '${entity.sourceEntityId}' to '${entity.targetEntityId}' creates a loop: ${cycleCheck.cyclePath.join(' -> ')}`
    );
    err.code = 'ERR_PROVENANCE_CYCLE_DETECTED';
    err.cyclePath = cycleCheck.cyclePath;
    throw err;
  }

  const updatedEdges = [...existingEdges, entity];
  saveStoredEdges(updatedEdges);

  appendAuditLog({
    action: 'ADD_PROVENANCE_EDGE',
    actor,
    entityId: id,
    details: {
      source: entity.sourceEntityId,
      target: entity.targetEntityId,
      edgeType: entity.edgeType,
    },
  });

  return entity;
};

/**
 * Records an editorial review for a fact
 */
export const recordEditorialReview = (reviewData, actor = 'reviewer') => {
  const id = reviewData.id || `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const entity = {
    ...reviewData,
    id,
    reviewerId: actor,
    reviewedAt: new Date().toISOString(),
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
  };

  const validation = validateEditorialReview(entity);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  const reviews = getStoredReviews();
  const existing = reviews.find((r) => r.id === id || r.targetEntityId === entity.targetEntityId);

  if (existing && !canTransitionReviewStatus(existing.reviewDecision, entity.reviewDecision)) {
    throw new Error(
      `Invalid review transition from '${existing.reviewDecision}' to '${entity.reviewDecision}'.`
    );
  }

  const updatedReviews = existing
    ? reviews.map((r) => (r.id === existing.id ? entity : r))
    : [entity, ...reviews];

  saveStoredReviews(updatedReviews);

  appendAuditLog({
    action: 'RECORD_EDITORIAL_REVIEW',
    actor,
    entityId: id,
    target: entity.targetEntityId,
    decision: entity.reviewDecision,
    isOverride: Boolean(entity.isOverride),
    overrideReason: entity.overrideReason || null,
  });

  return entity;
};

/**
 * Records a supersession relationship
 */
export const recordSupersession = ({
  predecessorId,
  successorId,
  supersessionType = 'amendment',
  reason = '',
  actor = 'admin',
}) => {
  const linkId = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const link = {
    id: linkId,
    predecessorId,
    successorId,
    supersededAt: new Date().toISOString(),
    supersessionType,
    reason,
    supersededBy: actor,
    activeStatus: true,
  };

  const validation = validateSupersessionLink(link);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  // Update predecessor source status to superseded
try {
    updateKnowledgeSourceStatus(predecessorId, PROVENANCE_STATUS.SUPERSEDED, reason, actor);
  } catch (err) {
    // If not in standard transition state, log and continue
    logDiagnostic('[provenanceService] Notice on predecessor status update', err);
  }

  // Add edge linking successor supersedes predecessor
  addProvenanceEdge(
    {
      sourceEntityId: successorId,
      targetEntityId: predecessorId,
      edgeType: EDGE_TYPES.SUPERSEDES,
      confidenceScore: 1.0,
      metadata: { reason, supersessionType },
    },
    actor
  );

  const currentLinks = getStoredSupersessions();
  saveStoredSupersessions([link, ...currentLinks]);

  appendAuditLog({
    action: 'RECORD_SUPERSESSION',
    actor,
    entityId: linkId,
    predecessorId,
    successorId,
    reason,
  });

  return link;
};

/**
 * Builds the complete Directed Acyclic Graph (DAG) for a given target fact or service
 */
export const getLineageDAG = (targetEntityId, { userRole = 'public' } = {}) => {
  const edges = getStoredEdges();
  const sources = getStoredSources();
  const snapshots = getStoredSnapshots();
  const transformations = getStoredTransformations();
  const reviews = getStoredReviews();
  const supersessions = getStoredSupersessions();

  // Find all edges leading to or from targetEntityId (either exact match or serviceId prefix)
  const relevantEdges = [];
  const visitedNodes = new Set();
  const queue = [];

  // Match target or any edge containing target prefix
  for (const e of edges) {
    if (e.targetEntityId === targetEntityId || e.targetEntityId.startsWith(`${targetEntityId}:`)) {
      relevantEdges.push(e);
      queue.push(e.sourceEntityId);
      visitedNodes.add(e.targetEntityId);
    }
  }

  // Backward traverse to roots (Snapshots -> Sources)
  while (queue.length > 0) {
    const current = queue.shift();
    if (visitedNodes.has(current)) continue;
    visitedNodes.add(current);

    for (const e of edges) {
      if (e.targetEntityId === current) {
        if (!relevantEdges.includes(e)) relevantEdges.push(e);
        queue.push(e.sourceEntityId);
      }
    }
  }

  // Map entities involved
  const nodes = [];
  for (const nodeId of visitedNodes) {
    // Check if source
    const src = sources.find((s) => s.id === nodeId);
    if (src) {
      nodes.push({ type: 'source', id: src.id, label: src.name, data: src });
      continue;
    }
    // Check if snapshot
    const snap = snapshots.find((s) => s.id === nodeId);
    if (snap) {
      nodes.push({ type: 'snapshot', id: snap.id, label: `Snapshot (${snap.effectiveDate})`, data: snap });
      continue;
    }
    // Check if transformation
    const tr = transformations.find((t) => t.id === nodeId);
    if (tr) {
      nodes.push({ type: 'transformation', id: tr.id, label: tr.parserVersion, data: tr });
      continue;
    }
    // Fact node
    nodes.push({ type: 'fact', id: nodeId, label: nodeId, data: { id: nodeId } });
  }

  // Fetch reviews for nodes
  const nodeReviews = reviews
    .filter((r) => visitedNodes.has(r.targetEntityId))
    .map((r) => {
      if (userRole === 'public') {
        // Strict privacy sanitization: Strip internal notes for public viewers
        // eslint-disable-next-line no-unused-vars
        const { privateNotes, reviewerId, ...publicView } = r;
        return publicView;
      }
      return r;
    });

  // Check supersessions
  const activeSupersessions = supersessions.filter(
    (s) => visitedNodes.has(s.predecessorId) || visitedNodes.has(s.successorId)
  );

  return {
    targetEntityId,
    nodes,
    edges: relevantEdges,
    reviews: nodeReviews,
    supersessions: activeSupersessions,
    isComplete: nodes.some((n) => n.type === 'source'),
  };
};

/**
 * Exports lineage graph in JSON, DOT (Graphviz), or CSV format
 */
export const exportLineage = (targetEntityId, format = 'json', options = {}) => {
  const dag = getLineageDAG(targetEntityId, options);

  if (format === 'dot') {
    let dot = `digraph Lineage_${targetEntityId.replace(/[^a-zA-Z0-9_]/g, '_')} {\n`;
    dot += '  rankdir=LR;\n  node [shape=box, style=rounded, fontname="Helvetica"];\n';
    for (const node of dag.nodes) {
      const sanitizedLabel = node.label.replace(/"/g, '\\"');
      dot += `  "${node.id}" [label="${sanitizedLabel}", class="${node.type}"];\n`;
    }
    for (const edge of dag.edges) {
      dot += `  "${edge.sourceEntityId}" -> "${edge.targetEntityId}" [label="${edge.edgeType} (${edge.confidenceScore})"];\n`;
    }
    dot += '}\n';
    return dot;
  }

  if (format === 'csv') {
    const headers = 'Source_Node_ID,Target_Node_ID,Edge_Type,Confidence_Score,Created_At\n';
    const rows = dag.edges.map(
      (e) => `"${e.sourceEntityId}","${e.targetEntityId}","${e.edgeType}",${e.confidenceScore},"${e.createdAt}"`
    );
    return headers + rows.join('\n');
  }

  return JSON.stringify(dag, null, 2);
};
