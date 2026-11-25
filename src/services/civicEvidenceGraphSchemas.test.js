import { describe, it, expect } from 'vitest';
import {
  CIVIC_EVIDENCE_GRAPH_SCHEMA_VERSION,
  FACT_TYPES,
  CONFIDENCE_TIERS,
  CONFLICT_TYPES,
  CONFLICT_SEVERITIES,
  RESOLUTION_STATUSES,
  RESOLUTION_ACTIONS,
  getConfidenceTier,
  validateFactNode,
  validateConflictEdge,
  validateResolutionPayload,
  validateCivicEvidenceGraph,
  sanitizeFactForLogging,
} from './civicEvidenceGraphSchemas';

describe('civicEvidenceGraphSchemas', () => {
  it('correctly categorizes confidence tiers', () => {
    expect(getConfidenceTier(0.95)).toBe(CONFIDENCE_TIERS.HIGH);
    expect(getConfidenceTier(0.85)).toBe(CONFIDENCE_TIERS.HIGH);
    expect(getConfidenceTier(0.84)).toBe(CONFIDENCE_TIERS.MEDIUM);
    expect(getConfidenceTier(0.60)).toBe(CONFIDENCE_TIERS.MEDIUM);
    expect(getConfidenceTier(0.59)).toBe(CONFIDENCE_TIERS.LOW);
    expect(getConfidenceTier(-1)).toBe(CONFIDENCE_TIERS.LOW);
    expect(getConfidenceTier('invalid')).toBe(CONFIDENCE_TIERS.LOW);
  });

  it('validates a correct FactNode', () => {
    const validFact = {
      id: 'fact-1',
      factType: FACT_TYPES.DATE_OF_BIRTH,
      rawValue: '15/08/1990',
      normalizedValue: '1990-08-15',
      provenance: {
        documentId: 'doc-1',
        documentType: 'AADHAAR',
        pageNumber: 1,
        ocrConfidence: 0.95,
        confidenceTier: CONFIDENCE_TIERS.HIGH,
        extractorId: 'documentFieldExtractorService',
      },
    };
    const res = validateFactNode(validFact);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects an invalid FactNode', () => {
    const invalidFact = {
      id: '',
      factType: 'UNKNOWN_TYPE',
      rawValue: 12345, // Not string
      provenance: {
        pageNumber: 0,
        ocrConfidence: 1.5, // > 1.0
      },
    };
    const res = validateFactNode(invalidFact);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('validates a correct ConflictEdge', () => {
    const validEdge = {
      id: 'edge-1',
      sourceFactId: 'fact-1',
      targetFactId: 'fact-2',
      factType: FACT_TYPES.DATE_OF_BIRTH,
      conflictType: CONFLICT_TYPES.EXACT_VALUE_MISMATCH,
      severity: CONFLICT_SEVERITIES.CRITICAL,
      resolutionStatus: RESOLUTION_STATUSES.UNRESOLVED,
    };
    const res = validateConflictEdge(validEdge);
    expect(res.valid).toBe(true);
  });

  it('rejects self-referencing ConflictEdge', () => {
    const selfEdge = {
      id: 'edge-self',
      sourceFactId: 'fact-1',
      targetFactId: 'fact-1',
      factType: FACT_TYPES.FULL_NAME,
      conflictType: CONFLICT_TYPES.EXACT_VALUE_MISMATCH,
      severity: CONFLICT_SEVERITIES.WARNING,
      resolutionStatus: RESOLUTION_STATUSES.UNRESOLVED,
    };
    const res = validateConflictEdge(selfEdge);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain('Conflict edge cannot link a fact to itself.');
  });

  it('validates resolution payload properly', () => {
    const validRes = {
      actionTaken: RESOLUTION_ACTIONS.USE_SOURCE_A,
      preferredFactId: 'fact-1',
      citizenNote: 'Aadhaar has updated official name as per Gazette.',
    };
    expect(validateResolutionPayload(validRes).valid).toBe(true);

    const invalidRes = {
      actionTaken: RESOLUTION_ACTIONS.USE_SOURCE_A,
      // Missing preferredFactId
    };
    expect(validateResolutionPayload(invalidRes).valid).toBe(false);
  });

  it('validates entire CivicEvidenceGraph schema', () => {
    const graph = {
      schemaVersion: CIVIC_EVIDENCE_GRAPH_SCHEMA_VERSION,
      nodes: {
        documents: {
          'doc-1': { id: 'doc-1', type: 'AADHAAR', name: 'Aadhaar' },
        },
        facts: {
          'fact-1': {
            id: 'fact-1',
            factType: FACT_TYPES.FULL_NAME,
            rawValue: 'Ramesh Kumar',
            normalizedValue: 'RAMESH KUMAR',
            provenance: {
              documentId: 'doc-1',
              pageNumber: 1,
              ocrConfidence: 0.9,
            },
          },
        },
      },
      edges: {
        conflicts: [],
      },
    };
    const res = validateCivicEvidenceGraph(graph);
    expect(res.valid).toBe(true);
  });

  it('sanitizes fact for logging without raw values', () => {
    const fact = {
      id: 'fact-uid',
      factType: FACT_TYPES.DOCUMENT_IDENTIFIER,
      rawValue: '1234 5678 9012',
      normalizedValue: '123456789012',
      provenance: {
        documentId: 'doc-1',
        confidenceTier: CONFIDENCE_TIERS.HIGH,
        ocrConfidence: 0.98,
      },
    };
    const sanitized = sanitizeFactForLogging(fact);
    expect(sanitized.id).toBe('fact-uid');
    expect(sanitized.factType).toBe(FACT_TYPES.DOCUMENT_IDENTIFIER);
    expect(sanitized.maskedValue).toContain('XXXX-XXXX-9012');
    expect(sanitized.rawValue).toBeUndefined();
  });
});
