/**
 * Verifiable Evidence Bundle Service (#1160)
 *
 * Implements the lifecycle of verifiable evidence bundles:
 * - Append-only cryptographic ledger additions
 * - Real-time SHA-256 computation and attachment storage
 * - Merkle root & manifest seal updates
 * - Verification against raw file tampering, clock skew, and chain disruption
 * - Portable JSON archive export/import and Markdown dossier generation
 * - Human-in-the-loop ethical guardrails
 */

import {
  BUNDLE_SCHEMA_VERSION,
  PROVENANCE_TIERS,
  PROVENANCE_TIER_LABELS,
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_SOURCE_LABELS,
  GENESIS_PREV_HASH,
  STATUTORY_EVIDENCE_DISCLAIMER,
  computeSha256Hex,
  computeEntryHash,
  computeMerkleRoot,
  computeManifestSeal,
  validateBundleEntry,
  verifyBundleIntegrity,
  createInitialBundleManifest,
} from '../data/verifiableEvidenceBundleContract.js';

import {
  loadAllBundles,
  getBundleById,
  saveBundle,
  deleteBundle,
  storeAttachmentFile,
  getAttachmentFile,
  recordAuditVerification,
  getAuditVerifications,
} from './verifiableEvidenceBundleStorage.js';

/**
 * Creates a new evidence bundle for a citizen complaint.
 *
 * @param {Object} complaint
 * @param {string} [userId='anonymous_local']
 * @param {Object} [options]
 * @returns {Object} Created bundle
 */
export function createNewBundle(complaint = {}, userId = 'anonymous_local', options = {}) {
  const initial = createInitialBundleManifest(complaint, options);
  return saveBundle(initial, userId);
}

/**
 * Retrieves a bundle manifest by ID.
 *
 * @param {string} bundleId
 * @param {string} [userId='anonymous_local']
 * @returns {Object|null}
 */
export function getBundle(bundleId, userId = 'anonymous_local') {
  return getBundleById(bundleId, userId);
}

/**
 * Lists all bundles scoped to user.
 *
 * @param {string} [userId='anonymous_local']
 * @returns {Array<Object>}
 */
export function listBundles(userId = 'anonymous_local') {
  return loadAllBundles(userId);
}

/**
 * Deletes a bundle by ID.
 *
 * @param {string} bundleId
 * @param {string} [userId='anonymous_local']
 * @returns {boolean}
 */
export function deleteExistingBundle(bundleId, userId = 'anonymous_local') {
  return deleteBundle(bundleId, userId);
}

/**
 * Appends a new evidence entry to the bundle in an append-only, cryptographically linked manner.
 *
 * @param {string} bundleId
 * @param {Object} entryData
 * @param {string} [userId='anonymous_local']
 * @param {string} [rawFilePayload=null] Optional Base64 or text content of attachment
 * @returns {Promise<{ bundle: Object, addedEntry: Object, verification: Object }>}
 */
export async function addEvidenceEntry(bundleId, entryData = {}, userId = 'anonymous_local', rawFilePayload = null) {
  const bundle = getBundleById(bundleId, userId);
  if (!bundle) {
    throw new Error(`Bundle "${bundleId}" not found for user.`);
  }

  const entries = Array.isArray(bundle.entries) ? [...bundle.entries] : [];
  const sequence = entries.length + 1;
  const previousEntryHash = bundle.chainState?.latestEntryHash || GENESIS_PREV_HASH;
  const entryId = `ENT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

  let attachment = null;
  if (entryData.attachment || rawFilePayload) {
    let sha256 = entryData.attachment?.sha256;
    let byteSize = entryData.attachment?.byteSize || 0;

    if (rawFilePayload && typeof rawFilePayload === 'string') {
      sha256 = await computeSha256Hex(rawFilePayload);
      byteSize = rawFilePayload.length;
      storeAttachmentFile(entryId, rawFilePayload);
    }

    attachment = {
      fileName: (entryData.attachment?.fileName || 'evidence_attachment').trim(),
      mimeType: (entryData.attachment?.mimeType || 'application/octet-stream').trim(),
      byteSize,
      sha256,
    };
  }

  const candidateEntry = {
    sequence,
    entryId,
    timestamp: entryData.timestamp || new Date().toISOString(),
    source: entryData.source || EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO,
    provenanceTier: entryData.provenanceTier || PROVENANCE_TIERS.CITIZEN_ASSERTION,
    title: (entryData.title || `Evidence Item #${sequence}`).trim(),
    userAnnotation: (entryData.userAnnotation || '').trim(),
    attachment,
    metadata: entryData.metadata && typeof entryData.metadata === 'object' ? entryData.metadata : {},
    previousEntryHash,
  };

  const validation = validateBundleEntry(candidateEntry);
  if (!validation.isValid) {
    throw new Error(`Invalid entry payload: ${validation.errors.join('; ')}`);
  }

  // Calculate cryptographic entry hash
  const entryHash = await computeEntryHash(candidateEntry);
  const finalEntry = { ...candidateEntry, entryHash };

  entries.push(finalEntry);

  // Recompute Merkle root over all entry hashes
  const allHashes = entries.map((e) => e.entryHash);
  const rootHash = await computeMerkleRoot(allHashes);

  const updatedBundle = {
    ...bundle,
    entries,
    chainState: {
      entryCount: entries.length,
      rootHash,
      latestEntryHash: entryHash,
    },
    updatedAt: new Date().toISOString(),
  };

  // Recompute manifest seal
  const manifestSeal = await computeManifestSeal(updatedBundle);
  updatedBundle.chainState.manifestSeal = manifestSeal;

  const saved = saveBundle(updatedBundle, userId);

  // Fast self-verification after mutation
  const verification = await verifyExistingBundle(bundleId, userId);

  return {
    bundle: saved,
    addedEntry: finalEntry,
    verification,
  };
}

/**
 * Runs an integrity audit on an existing saved bundle.
 *
 * @param {string} bundleId
 * @param {string} [userId='anonymous_local']
 * @param {Object} [options]
 * @returns {Promise<Object>} Verification report
 */
export async function verifyExistingBundle(bundleId, userId = 'anonymous_local', options = {}) {
  const bundle = getBundleById(bundleId, userId);
  if (!bundle) {
    throw new Error(`Bundle "${bundleId}" not found for verification.`);
  }

  // Fetch local raw files map for attachment verification
  const rawFiles = {};
  if (Array.isArray(bundle.entries)) {
    for (const entry of bundle.entries) {
      if (entry.attachment?.sha256) {
        const file = getAttachmentFile(entry.entryId);
        if (file) {
          rawFiles[entry.entryId] = file;
        }
      }
    }
  }

  const result = await verifyBundleIntegrity(bundle, rawFiles, options);
  recordAuditVerification(bundleId, result);
  return result;
}

/**
 * Exports bundle as a portable self-contained JSON archive.
 *
 * @param {string} bundleId
 * @param {string} [userId='anonymous_local']
 * @param {boolean} [includeFiles=true]
 * @returns {Object} { manifest, jsonString, fileName }
 */
export function exportBundleAsJson(bundleId, userId = 'anonymous_local', includeFiles = true) {
  const bundle = getBundleById(bundleId, userId);
  if (!bundle) {
    throw new Error(`Bundle "${bundleId}" not found for export.`);
  }

  const exportPayload = {
    archiveType: 'CIVIC_VERIFIABLE_EVIDENCE_BUNDLE',
    exportedAt: new Date().toISOString(),
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    disclaimer: STATUTORY_EVIDENCE_DISCLAIMER,
    manifest: bundle,
    enclosedFiles: {},
  };

  if (includeFiles && Array.isArray(bundle.entries)) {
    bundle.entries.forEach((e) => {
      if (e.attachment?.sha256) {
        const fileContent = getAttachmentFile(e.entryId);
        if (fileContent) {
          exportPayload.enclosedFiles[e.entryId] = {
            fileName: e.attachment.fileName,
            sha256: e.attachment.sha256,
            payload: fileContent,
          };
        }
      }
    });
  }

  const safeComplaint = (bundle.complaintTitle || 'complaint').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const fileName = `evidence-bundle-${safeComplaint}-${bundle.bundleId}.json`;

  return {
    manifest: bundle,
    jsonString: JSON.stringify(exportPayload, null, 2),
    fileName,
  };
}

/**
 * Exports bundle as a human-readable Markdown complaint dossier.
 *
 * @param {string} bundleId
 * @param {string} [userId='anonymous_local']
 * @returns {string} Formatted markdown dossier
 */
export function exportBundleAsMarkdownDossier(bundleId, userId = 'anonymous_local') {
  const bundle = getBundleById(bundleId, userId);
  if (!bundle) return '';

  const refNumbers = Array.isArray(bundle.officialReferenceNumbers) && bundle.officialReferenceNumbers.length > 0
    ? bundle.officialReferenceNumbers.join(', ')
    : 'None recorded';

  const lines = [
    `# CIVIC COMPLAINT VERIFIABLE EVIDENCE DOSSIER`,
    `**Complaint Title:** ${bundle.complaintTitle || 'Untitled Civic Complaint'}`,
    `**Target Department / Authority:** ${bundle.department || 'Not specified'}`,
    `**Bundle ID:** \`${bundle.bundleId}\` | **Complaint Reference:** \`${bundle.complaintId}\``,
    `**Official Reference Numbers:** ${refNumbers}`,
    `**Created:** ${bundle.createdAt} | **Last Updated:** ${bundle.updatedAt}`,
    `**Merkle Root Cryptographic Seal:** \`${bundle.chainState?.rootHash || 'N/A'}\``,
    '',
    `## 1. LEGAL NOTICE & STATUTORY DISCLAIMER`,
    `> **IMPORTANT:** ${STATUTORY_EVIDENCE_DISCLAIMER}`,
    '',
    `## 2. CRYPTOGRAPHIC PROVENANCE & CHAIN-OF-CUSTODY SUMMARY`,
    `This evidence dossier is protected by an append-only SHA-256 cryptographic chain. Every entry links to the preceding entry hash, ensuring zero silent tampering or reordering.`,
    `- **Total Evidence Entries:** ${bundle.entries?.length || 0}`,
    `- **Latest Entry Hash:** \`${bundle.chainState?.latestEntryHash || 'N/A'}\``,
    `- **Manifest Seal:** \`${bundle.chainState?.manifestSeal || 'N/A'}\``,
    '',
    `## 3. EVIDENCE TIMELINE & PROVENANCE BREAKDOWN`,
  ];

  if (!Array.isArray(bundle.entries) || bundle.entries.length === 0) {
    lines.push('_No evidence items have been recorded in this bundle._');
  } else {
    bundle.entries.forEach((entry) => {
      const tierLabel = PROVENANCE_TIER_LABELS[entry.provenanceTier] || entry.provenanceTier;
      const sourceLabel = EVIDENCE_SOURCE_LABELS[entry.source] || entry.source;

      lines.push(`### [Entry #${entry.sequence}] ${entry.title}`);
      lines.push(`- **Timestamp (UTC):** \`${entry.timestamp}\``);
      lines.push(`- **Provenance Classification:** **${tierLabel}**`);
      lines.push(`- **Evidence Source:** ${sourceLabel}`);
      if (entry.userAnnotation) {
        lines.push(`- **Citizen Annotation / Facts Asserted:** ${entry.userAnnotation}`);
      }
      if (entry.attachment) {
        lines.push(`- **Attachment:** \`${entry.attachment.fileName}\` (${Math.round(entry.attachment.byteSize / 1024)} KB)`);
        lines.push(`  - **SHA-256 Digest:** \`${entry.attachment.sha256}\``);
      }
      lines.push(`- **Previous Entry Hash:** \`${entry.previousEntryHash}\``);
      lines.push(`- **Calculated Entry Hash:** \`${entry.entryHash}\``);
      lines.push('');
    });
  }

  lines.push('---');
  lines.push('### Instructions for Formal Redressal:');
  lines.push('To lodge this complaint with statutory authorities (e.g. CPGRAMS at https://pgportal.gov.in, your State Jan Sunwai portal, or District Magistrate):');
  lines.push('1. Attach the verifiable JSON archive or reference the Merkle Root hash.');
  lines.push('2. Distinguish the verified receipts (`INDEPENDENT_VERIFICATION`) from personal photos/notes (`CITIZEN_ASSERTION`).');
  lines.push('3. Provide this immutable timestamped log as supporting documentation.');

  return lines.join('\n');
}

/**
 * Imports an external JSON evidence bundle archive and performs verification.
 *
 * @param {string} jsonString
 * @param {string} [userId='anonymous_local']
 * @returns {Promise<{ success: boolean, bundle: Object|null, verification: Object }>}
 */
export async function importBundleArchive(jsonString, userId = 'anonymous_local') {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      success: false,
      bundle: null,
      verification: {
        isValid: false,
        status: 'INVALID_JSON',
        errors: [`JSON parse error: ${err.message}`],
        warnings: [],
      },
    };
  }

  const manifest = parsed.manifest || parsed;
  const enclosedFiles = parsed.enclosedFiles || {};

  // Build rawFiles map from enclosedFiles
  const rawFiles = {};
  Object.keys(enclosedFiles).forEach((k) => {
    rawFiles[k] = enclosedFiles[k].payload || enclosedFiles[k];
  });

  const verification = await verifyBundleIntegrity(manifest, rawFiles);

  if (!verification.isValid) {
    return {
      success: false,
      bundle: null,
      verification,
    };
  }

  // If valid, save enclosed files locally
  Object.keys(enclosedFiles).forEach((entryId) => {
    const file = enclosedFiles[entryId];
    if (file?.payload) {
      storeAttachmentFile(entryId, file.payload);
    }
  });

  // Save bundle scoped to importing user
  const saved = saveBundle(manifest, userId);

  return {
    success: true,
    bundle: saved,
    verification,
  };
}

export {
  getAuditVerifications,
};
