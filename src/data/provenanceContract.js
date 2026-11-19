/**
 * src/data/provenanceContract.js
 * Normalized domain contracts, enums, schemas and state transitions
 * for Civic Knowledge Records Data Lineage and Provenance Explorer (#777).
 */

export const PROVENANCE_SCHEMA_VERSION = '1.0.0';

export const PROVENANCE_STATUS = Object.freeze({
  ACTIVE: 'active',
  UNDER_REVIEW: 'under_review',
  FLAGGED: 'flagged',
  SUPERSEDED: 'superseded',
  UNREACHABLE: 'unreachable',
  DEPRECATED: 'deprecated',
});

export const EDGE_TYPES = Object.freeze({
  EXTRACTED_FROM: 'extracted_from',
  TRANSFORMED_BY: 'transformed_by',
  VERIFIED_BY: 'verified_by',
  SUPERSEDES: 'supersedes',
  DERIVED_FROM: 'derived_from',
});

export const REVIEW_DECISIONS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  AMENDED: 'amended',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
});

export const TRANSFORMATION_TYPES = Object.freeze({
  REGEX_EXTRACTION: 'regex_extraction',
  TABLE_PARSER: 'table_parser',
  LLM_STRUCTURER: 'llm_structurer',
  SCHEMA_NORMALIZER: 'schema_normalizer',
});

export const SOURCE_TYPES = Object.freeze({
  GAZETTE_NOTIFICATION: 'gazette_notification',
  STATUTORY_ACT: 'statutory_act',
  MUNICIPAL_ORDER: 'municipal_order',
  OFFICIAL_PORTAL: 'official_portal',
});

export const FACT_FIELDS = Object.freeze({
  FEES: 'fees',
  DOCUMENTS: 'documents',
  ELIGIBILITY: 'eligibility',
  PROCESSING_TIME: 'processingTime',
  CONTACTS: 'contacts',
  WARNINGS: 'warnings',
  SLA: 'sla',
});

export const JURISDICTION_LEVELS = Object.freeze({
  NATIONAL: 'national',
  STATE: 'state',
  DISTRICT: 'district',
  MUNICIPAL: 'municipal',
  WARD: 'ward',
});

/**
 * Valid state transitions for KnowledgeSource
 */
export const SOURCE_STATE_TRANSITIONS = Object.freeze({
  [PROVENANCE_STATUS.ACTIVE]: [
    PROVENANCE_STATUS.UNDER_REVIEW,
    PROVENANCE_STATUS.FLAGGED,
    PROVENANCE_STATUS.SUPERSEDED,
    PROVENANCE_STATUS.UNREACHABLE,
    PROVENANCE_STATUS.DEPRECATED,
  ],
  [PROVENANCE_STATUS.UNDER_REVIEW]: [
    PROVENANCE_STATUS.ACTIVE,
    PROVENANCE_STATUS.FLAGGED,
    PROVENANCE_STATUS.DEPRECATED,
  ],
  [PROVENANCE_STATUS.FLAGGED]: [
    PROVENANCE_STATUS.UNDER_REVIEW,
    PROVENANCE_STATUS.SUPERSEDED,
    PROVENANCE_STATUS.DEPRECATED,
    PROVENANCE_STATUS.ACTIVE,
  ],
  [PROVENANCE_STATUS.UNREACHABLE]: [
    PROVENANCE_STATUS.UNDER_REVIEW,
    PROVENANCE_STATUS.ACTIVE,
    PROVENANCE_STATUS.DEPRECATED,
  ],
  [PROVENANCE_STATUS.SUPERSEDED]: [
    PROVENANCE_STATUS.DEPRECATED,
  ],
  [PROVENANCE_STATUS.DEPRECATED]: [
    PROVENANCE_STATUS.UNDER_REVIEW,
  ],
});

/**
 * Valid state transitions for EditorialReview
 */
export const REVIEW_STATE_TRANSITIONS = Object.freeze({
  [REVIEW_DECISIONS.PENDING]: [
    REVIEW_DECISIONS.APPROVED,
    REVIEW_DECISIONS.AMENDED,
    REVIEW_DECISIONS.REJECTED,
    REVIEW_DECISIONS.FLAGGED,
  ],
  [REVIEW_DECISIONS.FLAGGED]: [
    REVIEW_DECISIONS.PENDING,
    REVIEW_DECISIONS.AMENDED,
    REVIEW_DECISIONS.REJECTED,
  ],
  [REVIEW_DECISIONS.AMENDED]: [
    REVIEW_DECISIONS.APPROVED,
    REVIEW_DECISIONS.FLAGGED,
  ],
  [REVIEW_DECISIONS.REJECTED]: [
    REVIEW_DECISIONS.PENDING,
  ],
  [REVIEW_DECISIONS.APPROVED]: [
    REVIEW_DECISIONS.FLAGGED,
    REVIEW_DECISIONS.AMENDED,
  ],
});

export const canTransitionSourceStatus = (from, to) => {
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = SOURCE_STATE_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
};

export const canTransitionReviewStatus = (from, to) => {
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = REVIEW_STATE_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
};

const isValidHttpsUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates a KnowledgeSource entity
 */
export const validateKnowledgeSource = (entity) => {
  const errors = [];
  if (!entity || typeof entity !== 'object') {
    return { valid: false, errors: ['KnowledgeSource must be an object'] };
  }

  if (!entity.id || typeof entity.id !== 'string' || !entity.id.trim()) {
    errors.push('id is required and must be a non-empty string');
  }
  if (!entity.name || typeof entity.name !== 'string' || entity.name.trim().length < 3) {
    errors.push('name must be at least 3 characters');
  }
  if (!entity.publisher || typeof entity.publisher !== 'string' || !entity.publisher.trim()) {
    errors.push('publisher is required');
  }
  if (!entity.sourceUrl || !isValidHttpsUrl(entity.sourceUrl)) {
    errors.push('sourceUrl must be a valid HTTPS URL');
  }
  if (!Object.values(SOURCE_TYPES).includes(entity.sourceType)) {
    errors.push(`sourceType must be one of: ${Object.values(SOURCE_TYPES).join(', ')}`);
  }
  if (!Object.values(PROVENANCE_STATUS).includes(entity.status)) {
    errors.push(`status must be one of: ${Object.values(PROVENANCE_STATUS).join(', ')}`);
  }
  if (!entity.jurisdiction || typeof entity.jurisdiction !== 'object') {
    errors.push('jurisdiction object is required');
  } else if (!Object.values(JURISDICTION_LEVELS).includes(entity.jurisdiction.level)) {
    errors.push(`jurisdiction.level must be one of: ${Object.values(JURISDICTION_LEVELS).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a SourceSnapshot entity
 */
export const validateSourceSnapshot = (entity) => {
  const errors = [];
  if (!entity || typeof entity !== 'object') {
    return { valid: false, errors: ['SourceSnapshot must be an object'] };
  }

  if (!entity.id || typeof entity.id !== 'string' || !entity.id.trim()) {
    errors.push('id is required');
  }
  if (!entity.sourceId || typeof entity.sourceId !== 'string' || !entity.sourceId.trim()) {
    errors.push('sourceId is required');
  }
  if (!entity.retrievalTimestamp || Number.isNaN(Date.parse(entity.retrievalTimestamp))) {
    errors.push('retrievalTimestamp must be a valid ISO date string');
  }
  if (!entity.contentHash || typeof entity.contentHash !== 'string' || entity.contentHash.length < 8) {
    errors.push('contentHash must be a valid hash digest');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a TransformationRun entity
 */
export const validateTransformationRun = (entity) => {
  const errors = [];
  if (!entity || typeof entity !== 'object') {
    return { valid: false, errors: ['TransformationRun must be an object'] };
  }

  if (!entity.id || typeof entity.id !== 'string') {
    errors.push('id is required');
  }
  if (!entity.snapshotId || typeof entity.snapshotId !== 'string') {
    errors.push('snapshotId is required');
  }
  if (!entity.parserVersion || typeof entity.parserVersion !== 'string') {
    errors.push('parserVersion is required');
  }
  if (!Object.values(TRANSFORMATION_TYPES).includes(entity.transformationType)) {
    errors.push(`transformationType must be one of: ${Object.values(TRANSFORMATION_TYPES).join(', ')}`);
  }
  if (!['success', 'partial', 'failed'].includes(entity.status)) {
    errors.push('status must be success, partial, or failed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a ProvenanceEdge entity
 */
export const validateProvenanceEdge = (entity) => {
  const errors = [];
  if (!entity || typeof entity !== 'object') {
    return { valid: false, errors: ['ProvenanceEdge must be an object'] };
  }

  if (!entity.id || typeof entity.id !== 'string') {
    errors.push('id is required');
  }
  if (!entity.sourceEntityId || typeof entity.sourceEntityId !== 'string') {
    errors.push('sourceEntityId is required');
  }
  if (!entity.targetEntityId || typeof entity.targetEntityId !== 'string') {
    errors.push('targetEntityId is required');
  }
  if (!Object.values(EDGE_TYPES).includes(entity.edgeType)) {
    errors.push(`edgeType must be one of: ${Object.values(EDGE_TYPES).join(', ')}`);
  }
  if (typeof entity.confidenceScore !== 'number' || entity.confidenceScore < 0 || entity.confidenceScore > 1) {
    errors.push('confidenceScore must be a number between 0.0 and 1.0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates an EditorialReview entity
 */
export const validateEditorialReview = (entity) => {
  const errors = [];
  if (!entity || typeof entity !== 'object') {
    return { valid: false, errors: ['EditorialReview must be an object'] };
  }

  if (!entity.id || typeof entity.id !== 'string') {
    errors.push('id is required');
  }
  if (!entity.targetEntityId || typeof entity.targetEntityId !== 'string') {
    errors.push('targetEntityId is required');
  }
  if (!Object.values(REVIEW_DECISIONS).includes(entity.reviewDecision)) {
    errors.push(`reviewDecision must be one of: ${Object.values(REVIEW_DECISIONS).join(', ')}`);
  }
  if (!entity.reviewerRole || !['admin', 'reviewer', 'operator'].includes(entity.reviewerRole)) {
    errors.push('reviewerRole must be admin, reviewer, or operator');
  }
  if (entity.isOverride && (!entity.overrideReason || entity.overrideReason.trim().length < 5)) {
    errors.push('overrideReason is mandatory when isOverride is true (at least 5 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a SupersessionLink entity
 */
export const validateSupersessionLink = (entity) => {
  const errors = [];
  if (!entity || typeof entity !== 'object') {
    return { valid: false, errors: ['SupersessionLink must be an object'] };
  }

  if (!entity.id || typeof entity.id !== 'string') {
    errors.push('id is required');
  }
  if (!entity.predecessorId || typeof entity.predecessorId !== 'string') {
    errors.push('predecessorId is required');
  }
  if (!entity.successorId || typeof entity.successorId !== 'string') {
    errors.push('successorId is required');
  }
  if (entity.predecessorId === entity.successorId) {
    errors.push('predecessorId and successorId cannot be identical');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

