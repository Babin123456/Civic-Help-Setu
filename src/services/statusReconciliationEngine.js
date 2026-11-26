/**
 * statusReconciliationEngine.js
 *
 * Core deterministic engine for cross-portal application status reconciliation (#1158).
 * Provides voluntary evidence ingestion, PII/secret scrubbing, multi-channel anomaly
 * detection (reference divergence, temporal inversions, conflicting terminal states),
 * provenance-weighted consensus calculation, and actionable citizen guidance.
 */

import { minimizeForExternal } from '../utils/dataMinimization.js';
import {
  CANONICAL_STATUS,
  normalizeStatusPhrase,
  getSourceWeight,
} from './statusVocabularyNormalizer.js';

export const CONFLICT_TYPES = {
  REFERENCE_MISMATCH: 'REFERENCE_MISMATCH',
  TEMPORAL_INVERSION: 'TEMPORAL_INVERSION',
  CONTRADICTORY_TERMINAL: 'CONTRADICTORY_TERMINAL',
  SLA_STALL: 'SLA_STALL',
};

export const CONFLICT_SEVERITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

/**
 * Extracts candidate reference identifiers from unstructured text if not provided.
 * Matches common Indian portal schemes: alphanumeric codes with hyphens/slashes.
 */
export function extractReferenceFromText(text) {
  if (typeof text !== 'string') return null;
  // Match standard patterns like MH-10293, DL/2026/9821, SRV-9012, APP-99212-A
  const match = text.match(/\b([A-Z]{2,4}[-/][0-9A-Z]{3,16}(?:[-/][0-9A-Z]{1,6})?)\b/i);
  return match ? match[1].trim() : null;
}

/**
 * Extracts candidate ISO or localized dates from text.
 */
export function extractDateFromText(text) {
  if (typeof text !== 'string') return null;
  // YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01]))\b/);
  if (isoMatch) return isoMatch[1].replace(/\//g, '-');

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = text.match(/\b([0-3]?\d)[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Generates an opaque random UUIDv4 or fallback CSPRNG hex id.
 */
export function generateEvidenceId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Ingests and sanitizes a raw piece of status evidence.
 * Enforces zero-credential tolerance and recursive PII minimization.
 *
 * @param {Object} input
 * @param {string} input.rawText - Raw SMS, portal text, or receipt note
 * @param {string} input.sourceType - 'PORTAL_EXPORT' | 'SMS' | 'PAPER_RECEIPT' | 'EMAIL' | 'USER_NOTE'
 * @param {string} [input.referenceId] - Explicit reference ID if known
 * @param {string} [input.date] - Explicit date if known (YYYY-MM-DD)
 * @param {string} [input.rawStatus] - Explicit raw status phrase if separated
 * @param {string} [input.channelLabel] - Optional label (e.g. "VZ-GOVMH", "Counter #3")
 * @returns {Object} Cleaned StatusEvidence item
 */
export function ingestStatusEvidence({
  rawText = '',
  sourceType = 'PORTAL_EXPORT',
  referenceId = '',
  date = '',
  rawStatus = '',
  channelLabel = '',
}) {
  const safeText = typeof rawText === 'string' ? rawText.trim() : '';
  const sanitizedText = minimizeForExternal(safeText);

  const finalReference = (referenceId || extractReferenceFromText(safeText) || '').trim();
  const finalDate = date || extractDateFromText(safeText) || null;

  // Determine status phrase: prefer explicit rawStatus, otherwise extract from rawText
  const statusToNormalize = rawStatus || safeText;
  const normalized = normalizeStatusPhrase(statusToNormalize);

  const baseWeight = getSourceWeight(sourceType);

  return {
    id: generateEvidenceId(),
    sourceType,
    rawTextScrubbed: sanitizedText,
    extractedReferenceId: finalReference,
    extractedDate: finalDate,
    rawStatusPhrase: rawStatus ? rawStatus.trim() : statusToNormalize.slice(0, 100),
    normalizedStatus: normalized.canonicalStatus,
    normalizationConfidence: normalized.confidence,
    normalizationRule: normalized.matchedRule,
    provenance: {
      channelLabel: channelLabel ? channelLabel.trim() : sourceType,
      confidenceWeight: baseWeight,
      capturedAt: new Date().toISOString(),
    },
  };
}

/**
 * Detects reference divergence between target application and evidence items.
 */
export function detectReferenceMismatches(evidenceList = [], baseReferenceId = '') {
  const conflicts = [];
  const cleanBase = (baseReferenceId || '').trim().toUpperCase();

  evidenceList.forEach((item) => {
    const itemRef = (item.extractedReferenceId || '').trim().toUpperCase();
    if (!itemRef || !cleanBase) return;

    if (itemRef !== cleanBase) {
      // Check if it is a sub-reference variation (e.g. MH-100 vs MH-100/A or MH-100-1)
      const isSubReference =
        itemRef.startsWith(cleanBase) || cleanBase.startsWith(itemRef);

      conflicts.push({
        type: CONFLICT_TYPES.REFERENCE_MISMATCH,
        severity: isSubReference ? CONFLICT_SEVERITY.MEDIUM : CONFLICT_SEVERITY.HIGH,
        evidenceId: item.id,
        sourceType: item.sourceType,
        baseReferenceId: cleanBase,
        divergentReferenceId: itemRef,
        description: isSubReference
          ? `Sub-reference detected: "${itemRef}" differs from base "${cleanBase}" by departmental suffix/partition.`
          : `Reference mismatch: "${itemRef}" does not match target application reference "${cleanBase}".`,
      });
    }
  });

  return conflicts;
}

/**
 * Detects chronological anomalies (e.g., 'IN REVIEW' timestamped after 'APPROVED').
 */
export function detectTemporalInversions(evidenceList = []) {
  const conflicts = [];
  const datedItems = evidenceList
    .filter((e) => e.extractedDate)
    .sort((a, b) => new Date(a.extractedDate) - new Date(b.extractedDate));

  for (let i = 0; i < datedItems.length - 1; i += 1) {
    const current = datedItems[i];
    const next = datedItems[i + 1];
    const currentDate = current.extractedDate;
    const nextDate = next.extractedDate;

    // Inversion: An earlier event is APPROVED / COMPLETED / DISPATCHED,
    // but a subsequent date regresses to UNDER_REVIEW or SUBMITTED
    if (
      (current.normalizedStatus === CANONICAL_STATUS.APPROVED ||
        current.normalizedStatus === CANONICAL_STATUS.COMPLETED ||
        current.normalizedStatus === CANONICAL_STATUS.DISPATCHED) &&
      (next.normalizedStatus === CANONICAL_STATUS.UNDER_REVIEW ||
        next.normalizedStatus === CANONICAL_STATUS.SUBMITTED)
    ) {
      conflicts.push({
        type: CONFLICT_TYPES.TEMPORAL_INVERSION,
        severity: CONFLICT_SEVERITY.HIGH,
        evidenceA: current,
        evidenceB: next,
        description: `Temporal sequence inversion: "${current.normalizedStatus}" on ${currentDate} is followed by backwards status "${next.normalizedStatus}" on ${nextDate}.`,
      });
    }

    // Inversion: REJECTED event followed by UNDER_REVIEW or APPROVED without appeal notation
    if (
      current.normalizedStatus === CANONICAL_STATUS.REJECTED &&
      next.normalizedStatus === CANONICAL_STATUS.UNDER_REVIEW
    ) {
      conflicts.push({
        type: CONFLICT_TYPES.TEMPORAL_INVERSION,
        severity: CONFLICT_SEVERITY.MEDIUM,
        evidenceA: current,
        evidenceB: next,
        description: `Status re-opened after rejection: Marked "${current.normalizedStatus}" on ${currentDate}, then returned to "${next.normalizedStatus}" on ${nextDate}.`,
      });
    }
  }

  return conflicts;
}

/**
 * Detects irreconcilable terminal contradictions (e.g., APPROVED vs REJECTED across active channels).
 */
export function detectTerminalConflicts(evidenceList = []) {
  const conflicts = [];
  const approvedList = evidenceList.filter(
    (e) =>
      e.normalizedStatus === CANONICAL_STATUS.APPROVED ||
      e.normalizedStatus === CANONICAL_STATUS.DISPATCHED ||
      e.normalizedStatus === CANONICAL_STATUS.COMPLETED
  );
  const rejectedList = evidenceList.filter(
    (e) => e.normalizedStatus === CANONICAL_STATUS.REJECTED
  );

  if (approvedList.length > 0 && rejectedList.length > 0) {
    approvedList.forEach((appItem) => {
      rejectedList.forEach((rejItem) => {
        conflicts.push({
          type: CONFLICT_TYPES.CONTRADICTORY_TERMINAL,
          severity: CONFLICT_SEVERITY.HIGH,
          evidenceA: appItem,
          evidenceB: rejItem,
          description: `Direct contradictory terminal state: ${appItem.provenance.channelLabel} reports "${appItem.normalizedStatus}" while ${rejItem.provenance.channelLabel} reports "${rejItem.normalizedStatus}".`,
        });
      });
    });
  }

  return conflicts;
}

/**
 * Detects SLA stall if application has been under review beyond threshold days.
 */
export function detectSlaStall(evidenceList = [], baseSubmittedDate = null, slaDays = 30) {
  const conflicts = [];
  const latestDateStr = evidenceList
    .map((e) => e.extractedDate)
    .filter(Boolean)
    .sort()
    .pop() || baseSubmittedDate;

  if (!latestDateStr) return conflicts;

  const latestTime = new Date(latestDateStr).getTime();
  const now = Date.now();
  const elapsedDays = Math.floor((now - latestTime) / (1000 * 60 * 60 * 24));

  const hasTerminal = evidenceList.some((e) =>
    [CANONICAL_STATUS.APPROVED, CANONICAL_STATUS.REJECTED, CANONICAL_STATUS.COMPLETED].includes(
      e.normalizedStatus
    )
  );

  if (!hasTerminal && elapsedDays > slaDays) {
    conflicts.push({
      type: CONFLICT_TYPES.SLA_STALL,
      severity: CONFLICT_SEVERITY.MEDIUM,
      elapsedDays,
      slaThresholdDays: slaDays,
      description: `Application remains pending for ${elapsedDays} days, exceeding the standard ${slaDays}-day service SLA threshold without a terminal update.`,
    });
  }

  return conflicts;
}

/**
 * Synthesizes actionable citizen guidance based on status consensus and conflicts.
 */
export function generateActionableGuidance(consensusStatus, conflicts = []) {
  const hasTerminalConflict = conflicts.some(
    (c) => c.type === CONFLICT_TYPES.CONTRADICTORY_TERMINAL
  );
  const hasRefConflict = conflicts.some(
    (c) => c.type === CONFLICT_TYPES.REFERENCE_MISMATCH && c.severity === CONFLICT_SEVERITY.HIGH
  );
  const hasInversion = conflicts.some(
    (c) => c.type === CONFLICT_TYPES.TEMPORAL_INVERSION
  );

  if (hasTerminalConflict) {
    return {
      actionType: 'VISIT_OFFICE',
      summary: 'Conflicting official outcomes detected. Attend the issuing ward office in person.',
      recommendation:
        'One official channel reports approval/dispatch while another reports rejection. Bring your physical counter receipt, SMS record, and printed portal view to the grievance desk or Tahsildar to request a certified status clarification.',
    };
  }

  if (hasRefConflict) {
    return {
      actionType: 'VERIFY_REFERENCE',
      summary: 'Reference ID mismatch across evidence. Check application sub-codes.',
      recommendation:
        'The reference number in your imported record does not match the base application ID. Check whether an acknowledgment sub-code or parent file number was assigned by the receiving department.',
    };
  }

  if (hasInversion) {
    return {
      actionType: 'SEEK_CLARIFICATION',
      summary: 'Out-of-sequence status progression. Verify portal record.',
      recommendation:
        'A newer record shows your application in progress after an earlier approval or rejection. This typically occurs during internal re-scrutiny, audit sampling, or technical synchronization lag on state servers.',
    };
  }

  switch (consensusStatus) {
    case CANONICAL_STATUS.ACTION_REQUIRED:
      return {
        actionType: 'SUBMIT_DEFICIENCY',
        summary: 'Department query or deficiency raised. Response required.',
        recommendation:
          'Review the objection notes in your portal record and upload the requested supplementary documents before the statutory cure period expires.',
      };
    case CANONICAL_STATUS.REJECTED:
      return {
        actionType: 'ESCALATE_GRIEVANCE',
        summary: 'Application rejected. Consider statutory appeal or grievance.',
        recommendation:
          'Download the formal speaking order/rejection memo. If the rejection was improper or missed submitted proofs, file a First Appeal under your state Right to Public Services Act within 30 days.',
      };
    case CANONICAL_STATUS.DISPATCHED:
      return {
        actionType: 'TRACK_POST',
        summary: 'Physical document dispatched. Track postal consignment.',
        recommendation:
          'Your certificate or card has been dispatched. Use the Speed Post consignment number to track delivery with the postal department.',
      };
    case CANONICAL_STATUS.APPROVED:
    case CANONICAL_STATUS.COMPLETED:
      return {
        actionType: 'DOWNLOAD_CERTIFICATE',
        summary: 'Service sanctioned. Access your official document.',
        recommendation:
          'Your application is approved. You can download the digitally signed certificate or card directly from your state portal or DigiLocker account.',
      };
    default:
      return {
        actionType: 'MONITOR',
        summary: 'Application active under review. Routine monitoring.',
        recommendation:
          'Application is undergoing standard administrative scrutiny. No immediate citizen action is required unless a query is issued.',
      };
  }
}

/**
 * Reconciles multi-portal status evidence for an application.
 *
 * @param {Object} params
 * @param {string} params.applicationId - Base application ID
 * @param {string} [params.baseSubmittedDate] - Filing date if known
 * @param {Array<Object>} params.evidenceList - Array of ingested StatusEvidence items
 * @param {number} [params.slaDays=30] - SLA limit in days
 * @returns {Object} Comprehensive Reconciliation Report
 */
export function reconcileApplicationStatus({
  applicationId = '',
  baseSubmittedDate = null,
  evidenceList = [],
  slaDays = 30,
}) {
  if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
    return {
      applicationId,
      consensusStatus: CANONICAL_STATUS.SUBMITTED,
      confidenceScore: 30,
      hasConflicts: false,
      conflicts: [],
      evidenceCount: 0,
      guidance: generateActionableGuidance(CANONICAL_STATUS.SUBMITTED, []),
      reconciledAt: new Date().toISOString(),
    };
  }

  // 1. Detect Conflicts across all evidence
  const refConflicts = detectReferenceMismatches(evidenceList, applicationId);
  const tempConflicts = detectTemporalInversions(evidenceList);
  const termConflicts = detectTerminalConflicts(evidenceList);
  const slaConflicts = detectSlaStall(evidenceList, baseSubmittedDate, slaDays);

  const allConflicts = [
    ...refConflicts,
    ...tempConflicts,
    ...termConflicts,
    ...slaConflicts,
  ];

  // 2. Compute Weighted Consensus on Status
  const statusScores = {};
  Object.values(CANONICAL_STATUS).forEach((st) => {
    statusScores[st] = 0;
  });

  const now = Date.now();

  evidenceList.forEach((e) => {
    let weight = e.provenance?.confidenceWeight || 0.6;

    // Recency boost if item has a valid date
    if (e.extractedDate) {
      const itemTime = new Date(e.extractedDate).getTime();
      const ageDays = Math.max(0, (now - itemTime) / (1000 * 60 * 60 * 24));
      // Gradual decay for records older than 180 days
      const recencyMultiplier = Math.max(0.7, 1 - ageDays / 365);
      weight *= recencyMultiplier;
    }

    statusScores[e.normalizedStatus] = (statusScores[e.normalizedStatus] || 0) + weight;
  });

  // Pick status with highest accumulated weight
  let bestStatus = CANONICAL_STATUS.UNDER_REVIEW;
  let maxScore = -1;

  Object.entries(statusScores).forEach(([status, score]) => {
    if (score > maxScore) {
      maxScore = score;
      bestStatus = status;
    }
  });

  // 3. Compute Overall Confidence Score (0-100)
  const totalScore = Object.values(statusScores).reduce((a, b) => a + b, 0);
  let baseConfidence;

  if (allConflicts.length === 0) {
    // When no conflicts exist, confidence is high and scales with corroborating sources
    baseConfidence = Math.min(94, 72 + maxScore * 8 + (evidenceList.length >= 2 ? 6 : 0));
  } else {
    baseConfidence = totalScore > 0 ? (maxScore / totalScore) * 75 + 15 : 40;
    // Penalty deductions for detected conflicts
    if (termConflicts.length > 0) baseConfidence -= 35;
    if (tempConflicts.length > 0) baseConfidence -= 20;
    if (refConflicts.some((c) => c.severity === CONFLICT_SEVERITY.HIGH)) baseConfidence -= 15;
    if (refConflicts.some((c) => c.severity === CONFLICT_SEVERITY.MEDIUM)) baseConfidence -= 8;
    if (slaConflicts.length > 0) baseConfidence -= 10;
  }

  // Clamp confidence between 15% and 96% (never claim 100% certainty for third-party systems)
  const confidenceScore = Math.round(Math.min(96, Math.max(15, baseConfidence)));

  // 4. Generate Actionable Guidance
  const guidance = generateActionableGuidance(bestStatus, allConflicts);

  return {
    applicationId,
    consensusStatus: bestStatus,
    confidenceScore,
    hasConflicts: allConflicts.length > 0,
    conflicts: allConflicts,
    evidenceCount: evidenceList.length,
    statusScores,
    guidance,
    reconciledAt: new Date().toISOString(),
  };
}
