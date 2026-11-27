/**
 * src/services/evidenceCustodyLedgerExtension.js
 *
 * Civic Evidence Bundle Integrity and Chain-of-Custody Ledger (#1425).
 *
 * Extends `verifiableEvidenceBundleContract.js` and `verifiableEvidenceBundleService.js`
 * without replacing them. Provides:
 *   1. Append-only, hash-chained Chain-of-Custody Ledger per bundle.
 *   2. Original preservation guarantees (original entryHash & attachment sha256
 *      are never overwritten when transformations or redactions occur).
 *   3. Transformation recording (CAPTURED, IMPORTED, ANNOTATED, REDACTED,
 *      TRANSFORMED, EXPORTED, VERIFIED).
 *   4. Selective redaction with PII screening & redacted artifact hashing.
 *   5. Custody chain verification (detects broken links, tampered events, or
 *      mismatched original hashes).
 *   6. Import/export hash + custody verification with statutory disclaimer
 *      explicitly avoiding authenticity claims.
 */

import {
  GENESIS_PREV_HASH,
  STATUTORY_EVIDENCE_DISCLAIMER,
  canonicalizeJson,
  computeSha256Hex,
  verifyBundleIntegrity,
} from '../data/verifiableEvidenceBundleContract.js';
import {
  getBundleById,
  saveBundle,
  safeGetItem,
  safeSetItem,
} from './verifiableEvidenceBundleStorage.js';
import {
  importBundleArchive,
  exportBundleAsJson,
} from './verifiableEvidenceBundleService.js';
import { inspectStringForPII } from './piiLeakageGuardService.js';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

export const CUSTODY_LEDGER_STORAGE_KEY = 'civic_evidence_custody_ledgers_v1';
export const CUSTODY_SCHEMA_VERSION = '1.0.0';

export const CUSTODY_EVENT_TYPES = Object.freeze({
  CAPTURED: 'CAPTURED',
  IMPORTED: 'IMPORTED',
  ANNOTATED: 'ANNOTATED',
  REDACTED: 'REDACTED',
  TRANSFORMED: 'TRANSFORMED',
  EXPORTED: 'EXPORTED',
  VERIFIED: 'VERIFIED',
});

export const CUSTODY_STATUS = Object.freeze({
  VERIFIED: 'CUSTODY_VERIFIED',
  TAMPERED: 'CUSTODY_TAMPERED',
  BROKEN_CHAIN: 'CUSTODY_BROKEN_CHAIN',
  UNINITIALIZED: 'CUSTODY_UNINITIALIZED',
});

// ---------------------------------------------------------------------------
// PII GUARD FOR CUSTODY LOGS & ANNOTATIONS
// ---------------------------------------------------------------------------

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;

/**
 * Checks a string or object for forbidden PII (Aadhaar, PAN, phone, etc.).
 * Returns array of detected field categories or null if clean.
 */
export function detectForbiddenPII(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input || {});
  try {
    const res = inspectStringForPII(str);
    if (res && res.hasPII) {
      return res.detectedFields || ['pii'];
    }
  } catch {
    // Fallback to regex checks
  }
  const found = [];
  if (AADHAAR_REGEX.test(str)) found.push('aadhaar');
  if (PAN_REGEX.test(str)) found.push('pan');
  if (PHONE_REGEX.test(str)) found.push('phone');
  return found.length > 0 ? found : null;
}

/**
 * Redacts common PII patterns from a string, returning { redactedText, patternsRedacted }.
 */
export function redactPIIPatterns(text = '') {
  if (typeof text !== 'string') return { redactedText: '', patternsRedacted: [] };
  const patternsRedacted = [];
  let out = text;
  if (AADHAAR_REGEX.test(out)) {
    out = out.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[REDACTED:AADHAAR]');
    patternsRedacted.push('aadhaar');
  }
  if (PAN_REGEX.test(out)) {
    out = out.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, '[REDACTED:PAN]');
    patternsRedacted.push('pan');
  }
  if (PHONE_REGEX.test(out)) {
    out = out.replace(/(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, '[REDACTED:PHONE]');
    patternsRedacted.push('phone');
  }
  return { redactedText: out, patternsRedacted };
}

// ---------------------------------------------------------------------------
// STORAGE HELPERS (PER-BUNDLE CUSTODY LEDGER)
// ---------------------------------------------------------------------------

function readAllLedgers(customStorage = null) {
  const raw = safeGetItem(CUSTODY_LEDGER_STORAGE_KEY, customStorage);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllLedgers(ledgers, customStorage = null) {
  return safeSetItem(CUSTODY_LEDGER_STORAGE_KEY, JSON.stringify(ledgers), customStorage);
}

export function getCustodyLedger(bundleId, customStorage = null) {
  if (!bundleId) return [];
  const all = readAllLedgers(customStorage);
  return Array.isArray(all[bundleId]) ? all[bundleId] : [];
}

export function clearCustodyLedgers(customStorage = null) {
  return writeAllLedgers({}, customStorage);
}

// ---------------------------------------------------------------------------
// CRYPTOGRAPHIC CUSTODY EVENT HASHING
// ---------------------------------------------------------------------------

export async function computeCustodyEventHash(eventWithoutHash) {
  const rest = { ...(eventWithoutHash || {}) };
  delete rest.custodyEventHash;
  return computeSha256Hex(canonicalizeJson(rest));
}

/**
 * Appends a tamper-evident custody event to a bundle's Chain-of-Custody Ledger.
 * Rejects forbidden PII in rationale/notes so custody logs remain privacy-safe.
 */
export async function recordCustodyEvent({
  bundleId,
  entryId = null,
  eventType,
  actorId = 'anonymous_local',
  rationale = '',
  originalHash = null,
  resultingHash = null,
  redactedFields = [],
  metadata = {},
  customStorage = null,
}) {
  if (!bundleId) throw new Error('bundleId is required to record a custody event.');
  if (!Object.values(CUSTODY_EVENT_TYPES).includes(eventType)) {
    throw new Error(`Invalid custody eventType: ${eventType}`);
  }

  const piiFound = detectForbiddenPII({ rationale, metadata });
  if (piiFound) {
    throw new Error(
      `Custody log rejected: forbidden personal data detected (${piiFound.join(', ')}). Logs must exclude PII.`
    );
  }

  const all = readAllLedgers(customStorage);
  const existing = Array.isArray(all[bundleId]) ? [...all[bundleId]] : [];
  const sequence = existing.length + 1;
  const prevCustodyHash = existing.length > 0 ? existing[existing.length - 1].custodyEventHash : GENESIS_PREV_HASH;

  const candidate = {
    schemaVersion: CUSTODY_SCHEMA_VERSION,
    sequence,
    custodyEventId: `CUS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    bundleId,
    entryId,
    eventType,
    actorId: actorId || 'anonymous_local',
    timestamp: new Date().toISOString(),
    rationale: String(rationale || '').trim().slice(0, 500),
    originalHash,
    resultingHash,
    redactedFields: Array.isArray(redactedFields) ? [...redactedFields] : [],
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    prevCustodyHash,
  };

  const custodyEventHash = await computeCustodyEventHash(candidate);
  const finalEvent = { ...candidate, custodyEventHash };

  existing.push(finalEvent);
  all[bundleId] = existing;
  writeAllLedgers(all, customStorage);

  return finalEvent;
}

// ---------------------------------------------------------------------------
// SELECTIVE REDACTION (PRESERVES ORIGINAL HASH)
// ---------------------------------------------------------------------------

/**
 * Applies selective redaction to a bundle entry's derived presentation view
 * while preserving the original entryHash and attachment sha256 in the
 * manifest and recording a REDACTED transformation in the custody ledger.
 *
 * @param {Object} opts
 * @returns {Promise<{ bundle: Object, custodyEvent: Object, redactedEntryView: Object }>}
 */
export async function applySelectiveRedaction({
  bundleId,
  entryId,
  redactFields = [],
  redactionReason = 'Privacy redaction prior to external sharing',
  actorId = 'anonymous_local',
  customStorage = null,
}) {
  if (!bundleId || !entryId) {
    throw new Error('bundleId and entryId are required for selective redaction.');
  }
  if (!Array.isArray(redactFields) || redactFields.length === 0) {
    throw new Error('At least one field must be selected for redaction.');
  }

  const bundle = getBundleById(bundleId, actorId, customStorage);
  if (!bundle) {
    throw new Error(`Bundle "${bundleId}" not found for user.`);
  }

  const entries = Array.isArray(bundle.entries) ? bundle.entries : [];
  const entry = entries.find((e) => e.entryId === entryId);
  if (!entry) {
    throw new Error(`Evidence entry "${entryId}" not found in bundle "${bundleId}".`);
  }

  const allowedFields = new Set(['userAnnotation', 'title', 'pii_auto', 'metadata']);
  const normalizedFields = redactFields.filter((f) => allowedFields.has(f));
  if (normalizedFields.length === 0) {
    throw new Error(`Unsupported redaction fields. Allowed: ${[...allowedFields].join(', ')}`);
  }

  // Build derived redacted view WITHOUT mutating entry.entryHash or entry.attachment.sha256
  const redactedView = {
    entryId: entry.entryId,
    originalEntryHash: entry.entryHash,
    originalAttachmentSha256: entry.attachment?.sha256 || null,
    title: normalizedFields.includes('title') ? '[REDACTED:TITLE]' : entry.title,
    userAnnotation: normalizedFields.includes('userAnnotation')
      ? '[REDACTED:ANNOTATION]'
      : normalizedFields.includes('pii_auto')
        ? redactPIIPatterns(entry.userAnnotation || '').redactedText
        : entry.userAnnotation,
    metadata: normalizedFields.includes('metadata') ? { redacted: true } : entry.metadata,
    redactedFields: normalizedFields,
    redactedAt: new Date().toISOString(),
  };

  const redactedDigest = await computeSha256Hex(canonicalizeJson(redactedView));
  redactedView.redactedContentHash = redactedDigest;

  const custodyEvent = await recordCustodyEvent({
    bundleId,
    entryId,
    eventType: CUSTODY_EVENT_TYPES.REDACTED,
    actorId,
    rationale: redactionReason,
    originalHash: entry.entryHash,
    resultingHash: redactedDigest,
    redactedFields: normalizedFields,
    metadata: {
      originalAttachmentSha256: entry.attachment?.sha256 || null,
      originalPreserved: true,
    },
    customStorage,
  });

  // Store derived redaction map on bundle without altering original entries[]
  const updatedBundle = {
    ...bundle,
    redactedViews: {
      ...(bundle.redactedViews || {}),
      [entryId]: redactedView,
    },
    updatedAt: new Date().toISOString(),
  };
  const saved = saveBundle(updatedBundle, actorId, customStorage);

  return { bundle: saved, custodyEvent, redactedEntryView: redactedView };
}

// ---------------------------------------------------------------------------
// CUSTODY LEDGER VERIFICATION
// ---------------------------------------------------------------------------

/**
 * Verifies the cryptographic integrity of a bundle's Chain-of-Custody Ledger
 * and cross-checks that preserved original hashes match the bundle's entries.
 */
export async function verifyCustodyLedger(bundle, ledger = []) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(ledger) || ledger.length === 0) {
    return {
      isValid: true,
      status: CUSTODY_STATUS.UNINITIALIZED,
      eventCount: 0,
      errors,
      warnings: ['No custody events recorded yet for this bundle.'],
      verifiedAt: new Date().toISOString(),
      disclaimer: STATUTORY_EVIDENCE_DISCLAIMER,
    };
  }

  const entryHashMap = new Map();
  if (bundle && Array.isArray(bundle.entries)) {
    for (const e of bundle.entries) {
      entryHashMap.set(e.entryId, e.entryHash);
    }
  }

  let expectedPrev = GENESIS_PREV_HASH;
  let status = CUSTODY_STATUS.VERIFIED;

  for (let i = 0; i < ledger.length; i += 1) {
    const ev = ledger[i];

    if (ev.sequence !== i + 1) {
      errors.push(`Custody event #${i + 1} has out-of-order sequence ${ev.sequence}.`);
      status = CUSTODY_STATUS.BROKEN_CHAIN;
    }

    if (ev.prevCustodyHash !== expectedPrev) {
      errors.push(`Custody chain broken at event #${ev.sequence} (${ev.custodyEventId}).`);
      status = CUSTODY_STATUS.BROKEN_CHAIN;
    }

    const recomputed = await computeCustodyEventHash(ev);
    if (recomputed !== ev.custodyEventHash) {
      errors.push(`Custody event #${ev.sequence} (${ev.custodyEventId}) hash mismatch — possible tampering.`);
      status = CUSTODY_STATUS.TAMPERED;
    }

    if (ev.entryId && ev.originalHash && entryHashMap.has(ev.entryId)) {
      const manifestHash = entryHashMap.get(ev.entryId);
      if (ev.originalHash !== manifestHash) {
        errors.push(
          `Original hash mismatch for entry ${ev.entryId} at custody event #${ev.sequence}.`
        );
        status = CUSTODY_STATUS.TAMPERED;
      }
    }

    expectedPrev = ev.custodyEventHash;
  }

  return {
    isValid: errors.length === 0,
    status: errors.length === 0 ? CUSTODY_STATUS.VERIFIED : status,
    eventCount: ledger.length,
    latestCustodyHash: expectedPrev,
    errors,
    warnings,
    verifiedAt: new Date().toISOString(),
    disclaimer: STATUTORY_EVIDENCE_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// EXPORT & IMPORT WITH CUSTODY VERIFICATION
// ---------------------------------------------------------------------------

/**
 * Exports a bundle with its full Chain-of-Custody Ledger and records an EXPORTED
 * custody event. Includes statutory disclaimer avoiding authenticity claims.
 */
export async function exportBundleWithCustody(
  bundleId,
  actorId = 'anonymous_local',
  includeFiles = true,
  customStorage = null
) {
  const baseExport = exportBundleAsJson(bundleId, actorId, includeFiles);
  const bundle = baseExport.manifest;

  await recordCustodyEvent({
    bundleId,
    eventType: CUSTODY_EVENT_TYPES.EXPORTED,
    actorId,
    rationale: includeFiles ? 'Exported portable JSON archive with attachments' : 'Exported manifest-only JSON archive',
    originalHash: bundle.chainState?.manifestSeal || null,
    resultingHash: bundle.chainState?.rootHash || null,
    metadata: { includeFiles },
    customStorage,
  });

  const ledger = getCustodyLedger(bundleId, customStorage);
  const custodyVerification = await verifyCustodyLedger(bundle, ledger);

  const parsedBase = JSON.parse(baseExport.jsonString);
  const enrichedPayload = {
    ...parsedBase,
    custodySchemaVersion: CUSTODY_SCHEMA_VERSION,
    custodyLedger: ledger,
    custodyVerification,
    authenticityNotice:
      'Mathematical integrity and chain-of-custody logs verify data continuity only; they do NOT certify factual truth or sovereign legal authenticity.',
  };

  return {
    manifest: bundle,
    custodyLedger: ledger,
    custodyVerification,
    jsonString: JSON.stringify(enrichedPayload, null, 2),
    fileName: baseExport.fileName.replace('.json', '-custody.json'),
  };
}

/**
 * Imports a JSON bundle archive, verifies both manifest/attachment hashes AND
 * the enclosed custodyLedger (if present), and records an IMPORTED event.
 */
export async function importBundleWithCustodyVerification(
  jsonString,
  actorId = 'anonymous_local',
  customStorage = null
) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      success: false,
      bundle: null,
      verification: { isValid: false, status: 'INVALID_JSON', errors: [err.message] },
      custodyVerification: null,
    };
  }

  const manifest = parsed.manifest || parsed;
  const enclosedCustody = Array.isArray(parsed.custodyLedger) ? parsed.custodyLedger : [];

  // Verify custody chain BEFORE saving if enclosed
  if (enclosedCustody.length > 0) {
    const custodyCheck = await verifyCustodyLedger(manifest, enclosedCustody);
    if (!custodyCheck.isValid) {
      return {
        success: false,
        bundle: null,
        verification: await verifyBundleIntegrity(manifest, {}),
        custodyVerification: custodyCheck,
      };
    }
  }

  const baseImport = await importBundleArchive(jsonString, actorId);
  if (!baseImport.success) {
    return { ...baseImport, custodyVerification: null };
  }

  // Persist enclosed custody ledger if present, then append IMPORTED event
  if (enclosedCustody.length > 0) {
    const all = readAllLedgers(customStorage);
    all[baseImport.bundle.bundleId] = enclosedCustody;
    writeAllLedgers(all, customStorage);
  }

  await recordCustodyEvent({
    bundleId: baseImport.bundle.bundleId,
    eventType: CUSTODY_EVENT_TYPES.IMPORTED,
    actorId,
    rationale: 'Imported and hash-verified external evidence bundle archive',
    originalHash: baseImport.bundle.chainState?.manifestSeal || null,
    resultingHash: baseImport.bundle.chainState?.rootHash || null,
    customStorage,
  });

  const updatedLedger = getCustodyLedger(baseImport.bundle.bundleId, customStorage);
  const custodyVerification = await verifyCustodyLedger(baseImport.bundle, updatedLedger);

  return {
    success: true,
    bundle: baseImport.bundle,
    verification: baseImport.verification,
    custodyVerification,
    custodyLedger: updatedLedger,
  };
}
