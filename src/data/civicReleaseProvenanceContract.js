/**
 * src/data/civicReleaseProvenanceContract.js
 * Versioned schema and data contracts for Civic Content Provenance Signatures
 * and Tamper-Evident Release Ledger (#1178).
 */

export const RELEASE_PROVENANCE_SCHEMA_VERSION = '1.0.0';

export const CANONICAL_HASH_ALGORITHM = 'SHA-256';
export const SIGNATURE_ALGORITHM = 'ECDSA-P256-SHA256';

export const MANIFEST_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  RELEASED: 'released',
  REVOKED: 'revoked',
  TAMPERED: 'tampered',
});

export const KEY_STATUS = Object.freeze({
  ACTIVE: 'active',
  ROTATED: 'rotated',
  REVOKED: 'revoked',
  COMPROMISED: 'compromised',
});

export const APPROVER_ROLES = Object.freeze({
  LEGAL_REVIEWER: 'legal_reviewer',
  DEPARTMENT_ADMIN: 'department_admin',
  CIVIC_AUDITOR: 'civic_auditor',
  RELEASE_OFFICER: 'release_officer',
});

export const LEDGER_ENTRY_TYPES = Object.freeze({
  GENESIS: 'genesis',
  RELEASE: 'release',
  KEY_ROTATION: 'key_rotation',
  KEY_REVOCATION: 'key_revocation',
  REVOCATION: 'revocation',
  AUDIT_CHECKPOINT: 'audit_checkpoint',
});

/**
 * Deterministic JSON stringify (RFC 8785 JSON Canonicalization Scheme subset)
 * Sorts object keys recursively to guarantee deterministic SHA-256 hashing.
 */
export function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalizeJson(obj[key]);
  });
  return '{' + entries.join(',') + '}';
}

/**
 * Validates a Content Release Manifest structure at the boundary.
 * Returns array of error messages (empty if valid).
 */
export function validateReleaseManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return ['Manifest must be a non-null object'];
  }

  if (manifest.schemaVersion !== RELEASE_PROVENANCE_SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion. Expected "${RELEASE_PROVENANCE_SCHEMA_VERSION}".`);
  }
  if (!manifest.manifestId || typeof manifest.manifestId !== 'string') {
    errors.push('manifestId is required and must be a string.');
  }
  if (!manifest.guidanceId || typeof manifest.guidanceId !== 'string') {
    errors.push('guidanceId is required and must be a string.');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('version is required and must be a string.');
  }
  if (!manifest.publishedAt || isNaN(Date.parse(manifest.publishedAt))) {
    errors.push('publishedAt must be a valid ISO timestamp.');
  }

  // Content digests
  if (!manifest.contentDigest || typeof manifest.contentDigest !== 'string') {
    errors.push('contentDigest is required (SHA-256 hex string).');
  } else if (!/^[0-9a-f]{64}$/i.test(manifest.contentDigest)) {
    errors.push('contentDigest must be a 64-character hex string.');
  }

  // Source Snapshots
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    errors.push('sources must be a non-empty array of authoritative source snapshots.');
  } else {
    manifest.sources.forEach((source, idx) => {
      if (!source.sourceId || typeof source.sourceId !== 'string') {
        errors.push(`sources[${idx}].sourceId is required.`);
      }
      if (!source.sourceUrl || !source.sourceUrl.startsWith('https://')) {
        errors.push(`sources[${idx}].sourceUrl must be a secure HTTPS URL.`);
      }
      if (!source.snapshotDigest || !/^[0-9a-f]{64}$/i.test(source.snapshotDigest)) {
        errors.push(`sources[${idx}].snapshotDigest must be a 64-character hex string.`);
      }
    });
  }

  // Human Approvals (mandatory human approval for high-impact civic guidance)
  if (!Array.isArray(manifest.approvals) || manifest.approvals.length === 0) {
    errors.push('approvals must contain at least one explicit human reviewer approval.');
  } else {
    manifest.approvals.forEach((appr, idx) => {
      if (!appr.reviewerId || typeof appr.reviewerId !== 'string') {
        errors.push(`approvals[${idx}].reviewerId is required.`);
      }
      if (!appr.role || !Object.values(APPROVER_ROLES).includes(appr.role)) {
        errors.push(`approvals[${idx}].role must be one of: ${Object.values(APPROVER_ROLES).join(', ')}`);
      }
      if (!appr.approvedAt || isNaN(Date.parse(appr.approvedAt))) {
        errors.push(`approvals[${idx}].approvedAt must be a valid ISO timestamp.`);
      }
      if (!appr.approvalDigest || !/^[0-9a-f]{64}$/i.test(appr.approvalDigest)) {
        errors.push(`approvals[${idx}].approvalDigest must be a 64-character hex string.`);
      }
    });
  }

  // Signing block (if present)
  if (manifest.signatureBlock) {
    if (!manifest.signatureBlock.keyId || typeof manifest.signatureBlock.keyId !== 'string') {
      errors.push('signatureBlock.keyId is required.');
    }
    if (!manifest.signatureBlock.algorithm) {
      errors.push('signatureBlock.algorithm is required.');
    }
    if (!manifest.signatureBlock.signatureHex || typeof manifest.signatureBlock.signatureHex !== 'string') {
      errors.push('signatureBlock.signatureHex is required.');
    }
  }

  return errors;
}

/**
 * Validates a tamper-evident release ledger block.
 */
export function validateLedgerEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    return ['Ledger entry must be a non-null object'];
  }

  if (typeof entry.index !== 'number' || entry.index < 0) {
    errors.push('index must be a non-negative integer.');
  }
  if (!entry.timestamp || isNaN(Date.parse(entry.timestamp))) {
    errors.push('timestamp must be a valid ISO string.');
  }
  if (!entry.entryType || !Object.values(LEDGER_ENTRY_TYPES).includes(entry.entryType)) {
    errors.push(`entryType must be one of: ${Object.values(LEDGER_ENTRY_TYPES).join(', ')}`);
  }
  if (!entry.manifestId && entry.entryType !== LEDGER_ENTRY_TYPES.GENESIS) {
    errors.push('manifestId is required for non-genesis entries.');
  }
  if (!entry.previousHash) {
    errors.push('previousHash is required.');
  }
  if (!entry.payloadHash || !/^[0-9a-f]{64}$/i.test(entry.payloadHash)) {
    errors.push('payloadHash must be a 64-character hex string.');
  }
  if (!entry.blockHash || !/^[0-9a-f]{64}$/i.test(entry.blockHash)) {
    errors.push('blockHash must be a 64-character hex string.');
  }

  return errors;
}
