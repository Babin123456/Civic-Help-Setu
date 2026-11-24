/**
 * src/data/civicKnowledgeGraphContract.js
 *
 * Versioned schemas, constants, validators, and contract definitions for
 * Civic Service Knowledge Graph Query API with Explainable Traversals (#1184).
 *
 * Enforces:
 * - Deterministic schema versions (GRAPH_QUERY_SCHEMA_VERSION = 'civic-graph-v1')
 * - Bounded traversal depth (max depth <= 3, default = 2)
 * - Safe limits (limit: [1, 50], default = 20)
 * - Strict entity types and edge relationship types
 * - Provenance tracking & effective dates validation
 * - Prevention of unrestricted scans (requires either startNodeId or targetType filter)
 * - Negative / sensitive field detection at trust boundary (zero PII / secrets)
 */

export const GRAPH_QUERY_SCHEMA_VERSION = 'civic-graph-v1';

export const GRAPH_NODE_TYPES = {
  SERVICE: 'SERVICE',
  DEPARTMENT: 'DEPARTMENT',
  OFFICE: 'OFFICE',
  DOCUMENT: 'DOCUMENT',
  JURISDICTION: 'JURISDICTION',
  PORTAL: 'PORTAL',
};

export const GRAPH_EDGE_TYPES = {
  ADMINISTERED_BY: 'ADMINISTERED_BY',
  REQUIRES_DOCUMENT: 'REQUIRES_DOCUMENT',
  HANDLED_AT: 'HANDLED_AT',
  ACCESSIBLE_VIA: 'ACCESSIBLE_VIA',
  OPERATES_IN: 'OPERATES_IN',
  JURISDICTION_OVER: 'JURISDICTION_OVER',
  DEPENDS_ON_SERVICE: 'DEPENDS_ON_SERVICE',
  ISSUES_DOCUMENT: 'ISSUES_DOCUMENT',
};

export const JURISDICTION_SCOPES = {
  NATIONAL: 'national',
  STATE: 'state',
  DISTRICT: 'district',
  LOCAL: 'local',
};

export const PUBLICATION_STATUSES = {
  PUBLISHED: 'published',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
  UNDER_REVIEW: 'under_review',
};

export const MAX_TRAVERSAL_DEPTH = 3;
export const DEFAULT_TRAVERSAL_DEPTH = 2;
export const MAX_QUERY_LIMIT = 50;
export const DEFAULT_QUERY_LIMIT = 20;

/** Sensitive or PII keys that must never be accepted in query payloads */
export const SENSITIVE_PARAM_KEYS = [
  'aadhaar',
  'pan',
  'voterid',
  'passport',
  'phone',
  'mobile',
  'email',
  'otp',
  'password',
  'secret',
  'token',
  'credential',
  'bank',
  'account',
  'salary',
  'income',
  'biometric',
];

/**
 * Validates a Knowledge Graph Query payload at the trust boundary.
 *
 * @param {Object} query - The query object
 * @returns {{ valid: boolean, errors: string[], sanitizedQuery: Object|null }}
 */
export function validateGraphQuery(query) {
  const errors = [];

  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return { valid: false, errors: ['Query payload must be a non-null object'], sanitizedQuery: null };
  }

  // Check for forbidden / sensitive keys
  const keys = Object.keys(query).map((k) => k.toLowerCase());
  for (const sensitive of SENSITIVE_PARAM_KEYS) {
    if (keys.some((k) => k.includes(sensitive))) {
      errors.push(`Disallowed sensitive or personal data field: "${sensitive}"`);
    }
  }

  // Traversal Depth validation
  let depth = query.maxDepth !== undefined ? Number(query.maxDepth) : DEFAULT_TRAVERSAL_DEPTH;
  if (isNaN(depth) || !Number.isInteger(depth) || depth < 1 || depth > MAX_TRAVERSAL_DEPTH) {
    errors.push(`maxDepth must be an integer between 1 and ${MAX_TRAVERSAL_DEPTH}`);
  }

  // Pagination limit and offset validation
  let limit = query.limit !== undefined ? Number(query.limit) : DEFAULT_QUERY_LIMIT;
  if (isNaN(limit) || !Number.isInteger(limit) || limit < 1 || limit > MAX_QUERY_LIMIT) {
    errors.push(`limit must be an integer between 1 and ${MAX_QUERY_LIMIT}`);
  }

  let offset = query.offset !== undefined ? Number(query.offset) : 0;
  if (isNaN(offset) || !Number.isInteger(offset) || offset < 0) {
    errors.push('offset must be a non-negative integer');
  }

  // Start Node validation
  const startNodeId = query.startNodeId ? String(query.startNodeId).trim() : null;
  if (startNodeId && (startNodeId.length > 100 || !/^[a-zA-Z0-9_\-:]+$/.test(startNodeId))) {
    errors.push('startNodeId contains invalid characters or exceeds 100 characters');
  }

  // Target Node Type filter validation
  const targetTypes = query.targetTypes
    ? (Array.isArray(query.targetTypes) ? query.targetTypes : [query.targetTypes]).map((t) => String(t).toUpperCase())
    : null;

  if (targetTypes) {
    for (const t of targetTypes) {
      if (!Object.values(GRAPH_NODE_TYPES).includes(t)) {
        errors.push(`Invalid targetType: "${t}". Allowed: ${Object.values(GRAPH_NODE_TYPES).join(', ')}`);
      }
    }
  }

  // Relationship Type filter validation
  const edgeTypes = query.edgeTypes
    ? (Array.isArray(query.edgeTypes) ? query.edgeTypes : [query.edgeTypes]).map((e) => String(e).toUpperCase())
    : null;

  if (edgeTypes) {
    for (const e of edgeTypes) {
      if (!Object.values(GRAPH_EDGE_TYPES).includes(e)) {
        errors.push(`Invalid edgeType: "${e}". Allowed: ${Object.values(GRAPH_EDGE_TYPES).join(', ')}`);
      }
    }
  }

  // Jurisdiction filter validation
  const jurisdiction = query.jurisdiction ? String(query.jurisdiction).trim() : null;
  if (jurisdiction && jurisdiction.length > 80) {
    errors.push('jurisdiction filter exceeds 80 characters');
  }

  // Publication status filter validation (default: published only)
  const publicationStatus = query.publicationStatus
    ? String(query.publicationStatus).toLowerCase()
    : PUBLICATION_STATUSES.PUBLISHED;

  if (!Object.values(PUBLICATION_STATUSES).includes(publicationStatus)) {
    errors.push(`Invalid publicationStatus: "${publicationStatus}"`);
  }

  // Effective date filter validation (ISO-8601 string or YYYY-MM-DD)
  let effectiveAsOf = query.effectiveAsOf ? String(query.effectiveAsOf).trim() : null;
  if (effectiveAsOf) {
    const timestamp = Date.parse(effectiveAsOf);
    if (isNaN(timestamp)) {
      errors.push('effectiveAsOf must be a valid ISO-8601 date string (e.g. 2026-11-24)');
    }
  }

  // Keyword query search string validation
  const searchTerm = query.searchTerm ? String(query.searchTerm).trim() : null;
  if (searchTerm && searchTerm.length > 100) {
    errors.push('searchTerm must not exceed 100 characters');
  }

  // Enforce unbounded scan protection: Must provide at least one bounded constraint
  if (!startNodeId && !targetTypes && !jurisdiction && !searchTerm) {
    errors.push('Unbounded graph scan prevented. Please specify at least one of: startNodeId, targetTypes, jurisdiction, or searchTerm');
  }

  if (errors.length > 0) {
    return { valid: false, errors, sanitizedQuery: null };
  }

  return {
    valid: true,
    errors: [],
    sanitizedQuery: {
      schemaVersion: GRAPH_QUERY_SCHEMA_VERSION,
      startNodeId,
      targetTypes,
      edgeTypes,
      jurisdiction,
      publicationStatus,
      effectiveAsOf,
      searchTerm,
      maxDepth: depth,
      limit,
      offset,
      explain: query.explain !== false, // default true
    },
  };
}
