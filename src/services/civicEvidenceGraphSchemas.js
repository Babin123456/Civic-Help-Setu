/**
 * civicEvidenceGraphSchemas.js
 *
 * Versioned data contracts and schema validators for the Civic Evidence Graph (CIVIC_EVIDENCE_GRAPH_V1).
 * Validates untrusted external inputs and derived OCR extractions at trust boundaries.
 *
 * Security & Governance:
 * - Enforces schema validation before graph ingestion.
 * - Prevents raw PII leakage in validation errors or logging output.
 * - Guarantees source document immutability and non-destructive resolution states.
 */

import { maskSensitiveField } from './documentOcrExtractionAssistantService';

export const CIVIC_EVIDENCE_GRAPH_SCHEMA_VERSION = '1.0.0';

export const FACT_TYPES = {
  FULL_NAME: 'FULL_NAME',
  DATE_OF_BIRTH: 'DATE_OF_BIRTH',
  GENDER: 'GENDER',
  ADDRESS_LINE: 'ADDRESS_LINE',
  PINCODE: 'PINCODE',
  DOCUMENT_IDENTIFIER: 'DOCUMENT_IDENTIFIER',
  APPLICATION_ACK_NUMBER: 'APPLICATION_ACK_NUMBER',
  ISSUANCE_DATE: 'ISSUANCE_DATE',
  EXPIRY_DATE: 'EXPIRY_DATE',
  PARENT_SPOUSE_NAME: 'PARENT_SPOUSE_NAME',
};

export const CONFIDENCE_TIERS = {
  HIGH: 'HIGH',       // >= 0.85
  MEDIUM: 'MEDIUM',   // 0.60 - 0.84
  LOW: 'LOW',         // < 0.60
};

export const CONFLICT_TYPES = {
  EXACT_VALUE_MISMATCH: 'EXACT_VALUE_MISMATCH',
  CHRONOLOGY_VIOLATION: 'CHRONOLOGY_VIOLATION',
  PHONETIC_NEAR_MATCH: 'PHONETIC_NEAR_MATCH',
  INITIALS_EXPANSION_VARIATION: 'INITIALS_EXPANSION_VARIATION',
  SUSPECT_OCR_CONFUSION: 'SUSPECT_OCR_CONFUSION',
};

export const CONFLICT_SEVERITIES = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFORMATIONAL: 'INFORMATIONAL',
};

export const RESOLUTION_STATUSES = {
  UNRESOLVED: 'UNRESOLVED',
  RESOLVED_OVERRIDE: 'RESOLVED_OVERRIDE',
  DISMISSED_FALSE_POSITIVE: 'DISMISSED_FALSE_POSITIVE',
};

export const RESOLUTION_ACTIONS = {
  USE_SOURCE_A: 'USE_SOURCE_A',
  USE_SOURCE_B: 'USE_SOURCE_B',
  ADD_AFFIDAVIT_EXPLANATION: 'ADD_AFFIDAVIT_EXPLANATION',
  IGNORE_TYPO: 'IGNORE_TYPO',
};

/**
 * Determine confidence tier from numeric score (0.00 - 1.00)
 */
export function getConfidenceTier(score = 0) {
  const num = typeof score === 'number' && !Number.isNaN(score) ? score : 0;
  if (num >= 0.85) return CONFIDENCE_TIERS.HIGH;
  if (num >= 0.60) return CONFIDENCE_TIERS.MEDIUM;
  return CONFIDENCE_TIERS.LOW;
}

/**
 * Validates a Fact Node at the ingestion trust boundary.
 * @param {object} fact
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFactNode(fact) {
  const errors = [];
  if (!fact || typeof fact !== 'object') {
    return { valid: false, errors: ['Fact must be a valid object.'] };
  }

  if (!fact.id || typeof fact.id !== 'string') {
    errors.push('Fact missing required string id.');
  }

  if (!fact.factType || !Object.values(FACT_TYPES).includes(fact.factType)) {
    errors.push(`Invalid factType: '${fact.factType}'.`);
  }

  if (typeof fact.rawValue !== 'string') {
    errors.push('Fact missing required string rawValue.');
  }

  if (typeof fact.normalizedValue !== 'string') {
    errors.push('Fact missing required string normalizedValue.');
  }

  if (!fact.provenance || typeof fact.provenance !== 'object') {
    errors.push('Fact missing required provenance object.');
  } else {
    if (!fact.provenance.documentId || typeof fact.provenance.documentId !== 'string') {
      errors.push('Fact provenance missing documentId.');
    }
    if (typeof fact.provenance.pageNumber !== 'number' || fact.provenance.pageNumber < 1) {
      errors.push('Fact provenance pageNumber must be a positive integer.');
    }
    const ocrConf = fact.provenance.ocrConfidence;
    if (typeof ocrConf !== 'number' || ocrConf < 0 || ocrConf > 1) {
      errors.push('Fact provenance ocrConfidence must be a number between 0.0 and 1.0.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Conflict Edge.
 * @param {object} edge
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConflictEdge(edge) {
  const errors = [];
  if (!edge || typeof edge !== 'object') {
    return { valid: false, errors: ['Conflict edge must be a valid object.'] };
  }

  if (!edge.id || typeof edge.id !== 'string') {
    errors.push('Conflict edge missing string id.');
  }
  if (!edge.sourceFactId || typeof edge.sourceFactId !== 'string') {
    errors.push('Conflict edge missing sourceFactId.');
  }
  if (!edge.targetFactId || typeof edge.targetFactId !== 'string') {
    errors.push('Conflict edge missing targetFactId.');
  }
  if (edge.sourceFactId === edge.targetFactId) {
    errors.push('Conflict edge cannot link a fact to itself.');
  }
  if (!edge.factType || !Object.values(FACT_TYPES).includes(edge.factType)) {
    errors.push(`Invalid conflict edge factType: '${edge.factType}'.`);
  }
  if (!edge.conflictType || !Object.values(CONFLICT_TYPES).includes(edge.conflictType)) {
    errors.push(`Invalid conflictType: '${edge.conflictType}'.`);
  }
  if (!edge.severity || !Object.values(CONFLICT_SEVERITIES).includes(edge.severity)) {
    errors.push(`Invalid severity: '${edge.severity}'.`);
  }
  if (!edge.resolutionStatus || !Object.values(RESOLUTION_STATUSES).includes(edge.resolutionStatus)) {
    errors.push(`Invalid resolutionStatus: '${edge.resolutionStatus}'.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Conflict Resolution Payload.
 * @param {object} resolution
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateResolutionPayload(resolution) {
  const errors = [];
  if (!resolution || typeof resolution !== 'object') {
    return { valid: false, errors: ['Resolution payload must be an object.'] };
  }

  if (!resolution.actionTaken || !Object.values(RESOLUTION_ACTIONS).includes(resolution.actionTaken)) {
    errors.push(`Invalid resolution actionTaken: '${resolution.actionTaken}'.`);
  }

  if (
    (resolution.actionTaken === RESOLUTION_ACTIONS.USE_SOURCE_A ||
      resolution.actionTaken === RESOLUTION_ACTIONS.USE_SOURCE_B) &&
    (!resolution.preferredFactId || typeof resolution.preferredFactId !== 'string')
  ) {
    errors.push('Selected source action requires a valid preferredFactId.');
  }

  if (resolution.citizenNote && typeof resolution.citizenNote === 'string' && resolution.citizenNote.length > 500) {
    errors.push('Citizen explanation note must not exceed 500 characters.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates an entire Civic Evidence Graph structure.
 * @param {object} graph
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCivicEvidenceGraph(graph) {
  const errors = [];
  if (!graph || typeof graph !== 'object') {
    return { valid: false, errors: ['Graph must be an object.'] };
  }

  if (graph.schemaVersion !== CIVIC_EVIDENCE_GRAPH_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: '${graph.schemaVersion}'. Expected '${CIVIC_EVIDENCE_GRAPH_SCHEMA_VERSION}'.`);
  }

  if (!graph.nodes || typeof graph.nodes !== 'object') {
    errors.push('Graph missing nodes container.');
  } else {
    if (!graph.nodes.documents || typeof graph.nodes.documents !== 'object') {
      errors.push('Graph nodes missing documents map.');
    }
    if (!graph.nodes.facts || typeof graph.nodes.facts !== 'object') {
      errors.push('Graph nodes missing facts map.');
    } else {
      for (const [id, fact] of Object.entries(graph.nodes.facts)) {
        const factRes = validateFactNode(fact);
        if (!factRes.valid) {
          errors.push(`Fact [${id}] invalid: ${factRes.errors.join('; ')}`);
        }
      }
    }
  }

  if (!graph.edges || typeof graph.edges !== 'object' || !Array.isArray(graph.edges.conflicts)) {
    errors.push('Graph edges missing conflicts array.');
  } else {
    for (const [idx, edge] of graph.edges.conflicts.entries()) {
      const edgeRes = validateConflictEdge(edge);
      if (!edgeRes.valid) {
        errors.push(`Conflict edge index ${idx} invalid: ${edgeRes.errors.join('; ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitizes a fact node for secure logging without exposing PII.
 * @param {object} fact
 * @returns {object}
 */
export function sanitizeFactForLogging(fact) {
  if (!fact || typeof fact !== 'object') return {};
  return {
    id: fact.id,
    factType: fact.factType,
    maskedValue: maskSensitiveField(fact.normalizedValue || fact.rawValue, fact.factType),
    documentId: fact.provenance?.documentId,
    confidenceTier: fact.provenance?.confidenceTier,
    ocrConfidence: fact.provenance?.ocrConfidence,
  };
}
