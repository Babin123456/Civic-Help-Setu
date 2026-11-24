/**
 * civicEvidenceGraphService.js
 *
 * Core Graph Service for the Civic Evidence Graph (#1165).
 * Orchestrates fact extraction with document/page provenance, builds typed graph representations,
 * coordinates contradiction detection, and manages human-in-the-loop conflict resolutions.
 *
 * Privacy & Governance Guardrails:
 * - Ephemeral / client-side in-memory graph construction.
 * - Non-destructive conflict resolution: Original documents in vaultStorage are never mutated.
 * - Redacts sensitive identifiers in diagnostics, exports, and UI summaries.
 * - Disclaimers: Findings are preparation advisories, not official legal determinations.
 */

import {
  CIVIC_EVIDENCE_GRAPH_SCHEMA_VERSION,
  FACT_TYPES,
  CONFIDENCE_TIERS,
  RESOLUTION_STATUSES,
  CONFLICT_SEVERITIES,
  getConfidenceTier,
  validateResolutionPayload,
  validateCivicEvidenceGraph,
} from './civicEvidenceGraphSchemas';
import {
  detectAllContradictions,
  parseAndNormalizeDate,
  normalizeName,
} from './civicContradictionDetectionEngine';
import { extractFieldsFromDocument } from './documentFieldExtractorService';
import { maskSensitiveField } from './documentOcrExtractionAssistantService';
import { logDiagnostic } from '../utils/diagnostics';

const EVIDENCE_GRAPH_CACHE_KEY = 'civicbridge_evidence_graph_cache';

export const EVIDENCE_GRAPH_DISCLAIMER =
  'This evidence graph assists citizens in identifying document discrepancies before official submission. It does not certify documents or decide statutory eligibility.';

/**
 * Extracts typed facts from a vault document record.
 * @param {object} doc
 * @returns {Array<object>} List of FactNode objects
 */
export function extractFactsFromDocument(doc) {
  if (!doc || typeof doc !== 'object') return [];

  const facts = [];
  const docId = String(doc.id || `doc-${Date.now()}`);
  const docType = String(doc.type || 'DOCUMENT').toUpperCase();
  const baseConfidence = typeof doc.ocrConfidence === 'number' ? doc.ocrConfidence : 0.95;

  // 1. Document Identifier / Number
  if (doc.number && typeof doc.number === 'string') {
    facts.push({
      id: `fact-${docId}-number`,
      factType: FACT_TYPES.DOCUMENT_IDENTIFIER,
      rawValue: doc.number,
      normalizedValue: doc.number.replace(/[\s\-_/]/g, '').toUpperCase(),
      provenance: {
        documentId: docId,
        documentType: docType,
        pageNumber: 1,
        rawTextSnippet: doc.number,
        ocrConfidence: baseConfidence,
        confidenceTier: getConfidenceTier(baseConfidence),
        extractorId: 'vaultStorage.documentRecord',
      },
    });
  }

  // 2. Expiry Date
  if (doc.expiryDate && typeof doc.expiryDate === 'string') {
    const parsed = parseAndNormalizeDate(doc.expiryDate);
    if (parsed) {
      facts.push({
        id: `fact-${docId}-expiryDate`,
        factType: FACT_TYPES.EXPIRY_DATE,
        rawValue: doc.expiryDate,
        normalizedValue: parsed.isoDate,
        provenance: {
          documentId: docId,
          documentType: docType,
          pageNumber: 1,
          rawTextSnippet: doc.expiryDate,
          ocrConfidence: baseConfidence,
          confidenceTier: getConfidenceTier(baseConfidence),
          extractorId: 'vaultStorage.documentRecord',
        },
      });
    }
  }

  // 3. Issuance Date
  if (doc.issuanceDate && typeof doc.issuanceDate === 'string') {
    const parsed = parseAndNormalizeDate(doc.issuanceDate);
    if (parsed) {
      facts.push({
        id: `fact-${docId}-issuanceDate`,
        factType: FACT_TYPES.ISSUANCE_DATE,
        rawValue: doc.issuanceDate,
        normalizedValue: parsed.isoDate,
        provenance: {
          documentId: docId,
          documentType: docType,
          pageNumber: 1,
          rawTextSnippet: doc.issuanceDate,
          ocrConfidence: baseConfidence,
          confidenceTier: getConfidenceTier(baseConfidence),
          extractorId: 'vaultStorage.documentRecord',
        },
      });
    }
  }

  // 4. Extracted text / OCR transcript fields
  const textToScan = [doc.ocrText, doc.notes, doc.rawText].filter(Boolean).join('\n');
  if (textToScan) {
    const extractedList = extractFieldsFromDocument(textToScan);
    if (Array.isArray(extractedList)) {
      for (const field of extractedList) {
        if (field.key === 'fullName' && field.extractedValue) {
          facts.push({
            id: `fact-${docId}-fullName`,
            factType: FACT_TYPES.FULL_NAME,
            rawValue: field.extractedValue,
            normalizedValue: normalizeName(field.extractedValue),
            provenance: {
              documentId: docId,
              documentType: docType,
              pageNumber: 1,
              rawTextSnippet: field.sourceSnippet || field.extractedValue,
              ocrConfidence: field.confidence || (field.confidenceLevel === 'HIGH' ? 0.92 : 0.70),
              confidenceTier: field.confidenceLevel || CONFIDENCE_TIERS.MEDIUM,
              extractorId: 'documentFieldExtractorService',
            },
          });
        }

        if (field.key === 'dob' && field.extractedValue) {
          const parsedDob = parseAndNormalizeDate(field.extractedValue);
          facts.push({
            id: `fact-${docId}-dob`,
            factType: FACT_TYPES.DATE_OF_BIRTH,
            rawValue: field.extractedValue,
            normalizedValue: parsedDob ? parsedDob.isoDate : field.extractedValue,
            provenance: {
              documentId: docId,
              documentType: docType,
              pageNumber: 1,
              rawTextSnippet: field.sourceSnippet || field.extractedValue,
              ocrConfidence: field.confidence || (field.confidenceLevel === 'HIGH' ? 0.94 : 0.68),
              confidenceTier: field.confidenceLevel || CONFIDENCE_TIERS.MEDIUM,
              extractorId: 'documentFieldExtractorService',
            },
          });
        }

        if (field.key === 'pincode' && field.extractedValue) {
          facts.push({
            id: `fact-${docId}-pincode`,
            factType: FACT_TYPES.PINCODE,
            rawValue: field.extractedValue,
            normalizedValue: field.extractedValue.trim(),
            provenance: {
              documentId: docId,
              documentType: docType,
              pageNumber: 1,
              rawTextSnippet: field.sourceSnippet || field.extractedValue,
              ocrConfidence: field.confidence || (field.confidenceLevel === 'HIGH' ? 0.95 : 0.72),
              confidenceTier: field.confidenceLevel || CONFIDENCE_TIERS.MEDIUM,
              extractorId: 'documentFieldExtractorService',
            },
          });
        }
      }
    }
  }

  return facts;
}

/**
 * Builds the complete Civic Evidence Graph from vault documents and optional manual facts.
 * @param {object} params
 * @param {Array<object>} params.documents
 * @param {Array<object>} [params.manualFacts]
 * @param {object} [params.existingGraph] Previous graph with stored citizen resolutions
 * @returns {object} Complete Civic Evidence Graph
 */
export function buildCivicEvidenceGraph({ documents = [], manualFacts = [], existingGraph = null } = {}) {
  const docsMap = {};
  const factsMap = {};
  const allFactsList = [];

  // Register document nodes
  for (const doc of documents) {
    if (!doc || !doc.id) continue;
    docsMap[doc.id] = {
      id: doc.id,
      type: doc.type || 'Document',
      name: doc.name || doc.type || 'Document',
      issuer: doc.issuer || '',
      verified: Boolean(doc.verified),
    };

    // Extract facts
    const docFacts = extractFactsFromDocument(doc);
    for (const fact of docFacts) {
      factsMap[fact.id] = fact;
      allFactsList.push(fact);
    }
  }

  // Register manual facts
  for (const manual of manualFacts) {
    if (manual && manual.id) {
      factsMap[manual.id] = manual;
      allFactsList.push(manual);
    }
  }

  // Run deterministic contradiction detection engine
  const rawConflicts = detectAllContradictions(allFactsList);

  // Preserve existing user resolutions if present
  const resolvedConflictsMap = new Map();
  if (existingGraph?.edges?.conflicts) {
    for (const c of existingGraph.edges.conflicts) {
      if (c.resolutionStatus !== RESOLUTION_STATUSES.UNRESOLVED && c.resolution) {
        const key = `${c.sourceFactId}:${c.targetFactId}:${c.ruleId}`;
        const reverseKey = `${c.targetFactId}:${c.sourceFactId}:${c.ruleId}`;
        resolvedConflictsMap.set(key, c);
        resolvedConflictsMap.set(reverseKey, c);
      }
    }
  }

  const mergedConflicts = rawConflicts.map((edge) => {
    const key = `${edge.sourceFactId}:${edge.targetFactId}:${edge.ruleId}`;
    const previous = resolvedConflictsMap.get(key);
    if (previous) {
      return {
        ...edge,
        resolutionStatus: previous.resolutionStatus,
        resolution: previous.resolution,
      };
    }
    return edge;
  });

  // Calculate summary statistics
  let unresolvedCriticalCount = 0;
  let unresolvedWarningCount = 0;
  let nearMatchCount = 0;

  for (const c of mergedConflicts) {
    if (c.isFalseContradiction) {
      nearMatchCount++;
    }
    if (c.resolutionStatus === RESOLUTION_STATUSES.UNRESOLVED) {
      if (c.severity === CONFLICT_SEVERITIES.CRITICAL) {
        unresolvedCriticalCount++;
      } else if (c.severity === CONFLICT_SEVERITIES.WARNING) {
        unresolvedWarningCount++;
      }
    }
  }

  const graph = {
    schemaVersion: CIVIC_EVIDENCE_GRAPH_SCHEMA_VERSION,
    createdAt: existingGraph?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documentCount: Object.keys(docsMap).length,
    nodes: {
      documents: docsMap,
      facts: factsMap,
    },
    edges: {
      conflicts: mergedConflicts,
    },
    summary: {
      totalFacts: allFactsList.length,
      totalConflicts: mergedConflicts.length,
      unresolvedCriticalCount,
      unresolvedWarningCount,
      nearMatchCount,
    },
  };

  const validation = validateCivicEvidenceGraph(graph);
  if (!validation.valid) {
    logDiagnostic('evidence_graph_validation_warning', {
      errorsCount: validation.errors.length,
    });
  }

  return graph;
}

/**
 * Resolves a detected conflict edge via human-in-the-loop action.
 * Non-destructive: Does NOT alter underlying source documents.
 * @param {object} params
 * @param {object} params.graph
 * @param {string} params.conflictId
 * @param {object} params.resolution
 * @returns {object} Updated Civic Evidence Graph
 */
export function resolveGraphConflict({ graph, conflictId, resolution }) {
  if (!graph || !graph.edges || !Array.isArray(graph.edges.conflicts)) {
    throw new Error('Invalid graph structure provided for conflict resolution.');
  }

  const resValidation = validateResolutionPayload(resolution);
  if (!resValidation.valid) {
    throw new Error(`Resolution rejected: ${resValidation.errors.join(' ')}`);
  }

  const edgeIndex = graph.edges.conflicts.findIndex((c) => c.id === conflictId);
  if (edgeIndex === -1) {
    throw new Error(`Conflict edge with ID '${conflictId}' not found in graph.`);
  }

  const edge = graph.edges.conflicts[edgeIndex];

  const resolutionRecord = {
    ...resolution,
    resolvedAt: new Date().toISOString(),
  };

  const newResolutionStatus =
    resolution.actionTaken === 'IGNORE_TYPO'
      ? RESOLUTION_STATUSES.DISMISSED_FALSE_POSITIVE
      : RESOLUTION_STATUSES.RESOLVED_OVERRIDE;

  const updatedEdge = {
    ...edge,
    resolutionStatus: newResolutionStatus,
    resolution: resolutionRecord,
  };

  const updatedConflicts = [...graph.edges.conflicts];
  updatedConflicts[edgeIndex] = updatedEdge;

  // Recompute summary counts
  let unresolvedCriticalCount = 0;
  let unresolvedWarningCount = 0;
  let nearMatchCount = 0;

  for (const c of updatedConflicts) {
    if (c.isFalseContradiction) nearMatchCount++;
    if (c.resolutionStatus === RESOLUTION_STATUSES.UNRESOLVED) {
      if (c.severity === CONFLICT_SEVERITIES.CRITICAL) unresolvedCriticalCount++;
      else if (c.severity === CONFLICT_SEVERITIES.WARNING) unresolvedWarningCount++;
    }
  }

  return {
    ...graph,
    updatedAt: new Date().toISOString(),
    edges: {
      ...graph.edges,
      conflicts: updatedConflicts,
    },
    summary: {
      ...graph.summary,
      unresolvedCriticalCount,
      unresolvedWarningCount,
      nearMatchCount,
    },
  };
}

/**
 * Generates an accessible, printable text/markdown summary report of the evidence graph.
 * Redacts raw sensitive ID identifiers.
 * @param {object} graph
 * @returns {string}
 */
export function generateEvidenceGraphReport(graph) {
  if (!graph || !graph.nodes) return '';

  const docCount = graph.documentCount || 0;
  const factCount = graph.summary?.totalFacts || 0;
  const totalConflicts = graph.summary?.totalConflicts || 0;
  const critical = graph.summary?.unresolvedCriticalCount || 0;

  let report = `# Civic Evidence Graph Discrepancy Audit Report\n\n`;
  report += `> ${EVIDENCE_GRAPH_DISCLAIMER}\n\n`;
  report += `**Audit Timestamp:** ${graph.updatedAt || new Date().toISOString()}\n`;
  report += `**Documents Inspected:** ${docCount} | **Facts Tracked:** ${factCount}\n`;
  report += `**Status:** ${critical > 0 ? '⚠️ ACTION RECOMMENDED (Discrepancies Detected)' : '✅ READY (No Critical Discrepancies)'}\n\n`;

  report += `### Tracked Documents & Identifiers (${docCount})\n\n`;
  for (const doc of Object.values(graph.nodes.documents || {})) {
    const idFact = Object.values(graph.nodes.facts || {}).find(
      (f) => f.provenance?.documentId === doc.id && f.factType === FACT_TYPES.DOCUMENT_IDENTIFIER
    );
    const maskedId = idFact
      ? maskSensitiveField(idFact.rawValue, doc.type)
      : 'No identifier recorded';
    report += `- **${doc.type || 'Document'}:** ${maskedId} (${doc.issuer || 'Local Record'})\n`;
  }
  report += `\n`;

  report += `### Document Findings & Contradictions (${totalConflicts})\n\n`;

  if (totalConflicts === 0) {
    report += `*No cross-document discrepancies detected across current vault records.*\n\n`;
  } else {
    for (const [idx, edge] of graph.edges.conflicts.entries()) {
      const factA = graph.nodes.facts[edge.sourceFactId];
      const factB = graph.nodes.facts[edge.targetFactId];
      const valA = maskSensitiveField(factA?.rawValue, factA?.factType);
      const valB = maskSensitiveField(factB?.rawValue, factB?.factType);

      report += `${idx + 1}. **[${edge.severity}]** ${edge.diagnosticMessage}\n`;
      report += `   - **Record A:** ${valA} (${factA?.provenance?.documentType || 'Doc A'})\n`;
      report += `   - **Record B:** ${valB} (${factB?.provenance?.documentType || 'Doc B'})\n`;
      report += `   - **Status:** ${edge.resolutionStatus}\n`;
      if (edge.resolution) {
        report += `   - **Citizen Resolution:** ${edge.resolution.actionTaken} (${edge.resolution.citizenNote || 'No note added'})\n`;
      }
      report += `\n`;
    }
  }

  return report;
}

let inMemoryFallback = null;

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (globalThis.localStorage && typeof globalThis.localStorage.getItem === 'function') {
      return globalThis.localStorage;
    }
  } catch {
    // fallback
  }
  return null;
};

/**
 * Saves graph cache to localStorage or in-memory fallback safely.
 */
export function saveEvidenceGraphToCache(graph) {
  try {
    if (!graph) return;
    const storage = getStorage();
    if (storage) {
      storage.setItem(EVIDENCE_GRAPH_CACHE_KEY, JSON.stringify(graph));
    } else {
      inMemoryFallback = JSON.parse(JSON.stringify(graph));
    }
  } catch (err) {
    inMemoryFallback = JSON.parse(JSON.stringify(graph));
    logDiagnostic('evidence_graph_cache_write_failed', { error: String(err?.message) });
  }
}

/**
 * Retrieves graph cache from localStorage or in-memory fallback safely.
 */
export function getEvidenceGraphFromCache() {
  try {
    const storage = getStorage();
    let parsed = null;
    if (storage) {
      const raw = storage.getItem(EVIDENCE_GRAPH_CACHE_KEY);
      if (raw) parsed = JSON.parse(raw);
    }
    if (!parsed && inMemoryFallback) {
      parsed = inMemoryFallback;
    }
    if (!parsed) return null;
    const valid = validateCivicEvidenceGraph(parsed);
    return valid.valid ? parsed : null;
  } catch {
    return inMemoryFallback || null;
  }
}

/**
 * Clears graph cache from storage.
 */
export function clearEvidenceGraphCache() {
  inMemoryFallback = null;
  try {
    const storage = getStorage();
    if (storage) {
      storage.removeItem(EVIDENCE_GRAPH_CACHE_KEY);
    }
  } catch {
    // ignore
  }
}
