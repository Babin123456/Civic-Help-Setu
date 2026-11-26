/**
 * src/services/civicReleaseLedgerService.js
 * Tamper-evident cryptographic release ledger with chained block digests.
 * Maintains an append-only verifiable log of released guidance, reviewer approvals,
 * and key lifecycle events (rotation, revocation).
 *
 * Avoids heavy blockchain dependency through a verifiable Merkle/hash-chained ledger
 * with RFC-compliant canonical serialization and fast client-side audit verification.
 */

import {
  RELEASE_PROVENANCE_SCHEMA_VERSION,
  LEDGER_ENTRY_TYPES,
  KEY_STATUS,
  validateReleaseManifest,
  validateLedgerEntry,
} from '../data/civicReleaseProvenanceContract.js';

import {
  computeSha256Hex,
  generateSigningKeyPair,
  signData,
  verifySignature,
} from './civicCryptoService.js';

const LEDGER_STORAGE_KEY = 'civic_help_setu_release_ledger_v1';
const KEYRING_STORAGE_KEY = 'civic_help_setu_provenance_keyring_v1';

// In-memory fallback map for non-browser / test environments
const memoryStore = new Map();

const getStorage = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Access denied or not available
  }
  return null;
};

// Default Genesis block
export const GENESIS_BLOCK = Object.freeze({
  index: 0,
  timestamp: '2026-01-01T00:00:00.000Z',
  entryType: LEDGER_ENTRY_TYPES.GENESIS,
  manifestId: 'genesis-root',
  guidanceId: 'root',
  version: '0.0.0',
  previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
  payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // empty sha256
  blockHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  keyId: 'root-system-key',
});

// Storage accessors with safe fallback
export function getStoredLedger() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(LEDGER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback to memoryStore
    }
  }
  if (memoryStore.has(LEDGER_STORAGE_KEY)) {
    const list = memoryStore.get(LEDGER_STORAGE_KEY);
    if (Array.isArray(list) && list.length > 0) return list;
  }
  return [GENESIS_BLOCK];
}

export function saveStoredLedger(ledger) {
  memoryStore.set(LEDGER_STORAGE_KEY, ledger);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(ledger));
    } catch {
      // ignore
    }
  }
}

export function getStoredKeyring() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(KEYRING_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }
  }
  if (memoryStore.has(KEYRING_STORAGE_KEY)) {
    return memoryStore.get(KEYRING_STORAGE_KEY);
  }
  return [];
}

export function saveStoredKeyring(keyring) {
  memoryStore.set(KEYRING_STORAGE_KEY, keyring);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(KEYRING_STORAGE_KEY, JSON.stringify(keyring));
    } catch {
      // ignore
    }
  }
}

/**
 * Creates a signed content release manifest.
 */
export async function createReleaseManifest({
  guidanceId,
  version,
  contentPayload,
  sources,
  approvals,
  signingKey,
}) {
  if (!signingKey || !signingKey.privateKeyJwk) {
    throw new Error('Valid signingKey with privateKeyJwk is required to create a signed release manifest.');
  }

  if (signingKey.status === KEY_STATUS.REVOKED || signingKey.status === KEY_STATUS.COMPROMISED) {
    throw new Error(`Cannot sign release with ${signingKey.status} key (${signingKey.keyId}).`);
  }

  const contentDigest = await computeSha256Hex(contentPayload);

  // Compute source snapshot digests
  const normalizedSources = await Promise.all(
    (sources || []).map(async (s) => {
      const snapshotDigest = s.snapshotDigest || (await computeSha256Hex(s.snapshotContent || s.sourceUrl));
      return {
        sourceId: s.sourceId,
        sourceUrl: s.sourceUrl,
        publisher: s.publisher || 'Official Department Authority',
        fetchedAt: s.fetchedAt || new Date().toISOString(),
        snapshotDigest,
      };
    })
  );

  // Compute reviewer approval digests
  const normalizedApprovals = await Promise.all(
    (approvals || []).map(async (a) => {
      const approvalDigest =
        a.approvalDigest ||
        (await computeSha256Hex({
          reviewerId: a.reviewerId,
          role: a.role,
          approvedAt: a.approvedAt || new Date().toISOString(),
          decision: 'APPROVED',
          guidanceId,
          version,
        }));
      return {
        reviewerId: a.reviewerId,
        role: a.role,
        approvedAt: a.approvedAt || new Date().toISOString(),
        decision: 'APPROVED',
        notes: a.notes || 'Verified against authoritative statutory rules.',
        approvalDigest,
      };
    })
  );

  const manifestId = `rel-${guidanceId}-v${version}-${Date.now()}`;
  const publishedAt = new Date().toISOString();

  const manifestUnsigned = {
    schemaVersion: RELEASE_PROVENANCE_SCHEMA_VERSION,
    manifestId,
    guidanceId,
    version,
    publishedAt,
    contentDigest,
    sources: normalizedSources,
    approvals: normalizedApprovals,
  };

  const validationErrors = validateReleaseManifest({
    ...manifestUnsigned,
    signatureBlock: { keyId: signingKey.keyId, algorithm: signingKey.algorithm, signatureHex: 'temp' },
  });
  if (validationErrors.length > 0) {
    throw new Error(`Manifest validation failed: ${validationErrors.join(', ')}`);
  }

  // Sign manifest payload
  const manifestDigest = await computeSha256Hex(manifestUnsigned);
  const signatureHex = await signData(signingKey.privateKeyJwk, manifestDigest);

  const signedManifest = {
    ...manifestUnsigned,
    manifestDigest,
    signatureBlock: {
      keyId: signingKey.keyId,
      keyFingerprint: signingKey.fingerprint,
      algorithm: signingKey.algorithm,
      signedAt: publishedAt,
      signatureHex,
    },
  };

  return signedManifest;
}

/**
 * Appends a verified release manifest to the tamper-evident ledger.
 */
export async function appendReleaseToLedger(manifest, keyring = null) {
  const currentKeyring = keyring || getStoredKeyring();
  const ledger = getStoredLedger();
  const lastBlock = ledger[ledger.length - 1];

  // Verify manifest signature before recording to ledger
  const signingKey = currentKeyring.find((k) => k.keyId === manifest.signatureBlock.keyId);
  if (!signingKey) {
    throw new Error(`Signing key "${manifest.signatureBlock.keyId}" not found in keyring.`);
  }

  if (signingKey.status === KEY_STATUS.REVOKED || signingKey.status === KEY_STATUS.COMPROMISED) {
    throw new Error(`Signing key "${signingKey.keyId}" has been revoked/compromised.`);
  }

  // Calculate unsigned manifest digest
  const signatureBlock = manifest.signatureBlock;
  const unsignedFields = { ...manifest };
  delete unsignedFields.signatureBlock;
  delete unsignedFields.manifestDigest;
  const computedManifestDigest = await computeSha256Hex(unsignedFields);

  const isValidSignature = await verifySignature(
    signingKey.publicKeyJwk,
    signatureBlock.signatureHex,
    computedManifestDigest
  );

  if (!isValidSignature) {
    throw new Error('Manifest cryptographic signature verification failed! Possible content tampering.');
  }

  const payloadHash = await computeSha256Hex(manifest);
  const blockIndex = lastBlock.index + 1;
  const timestamp = new Date().toISOString();
  const previousHash = lastBlock.blockHash;

  const blockPayload = {
    index: blockIndex,
    timestamp,
    entryType: LEDGER_ENTRY_TYPES.RELEASE,
    manifestId: manifest.manifestId,
    guidanceId: manifest.guidanceId,
    version: manifest.version,
    previousHash,
    payloadHash,
    keyId: signingKey.keyId,
  };

  const blockHash = await computeSha256Hex(blockPayload);

  const newBlock = {
    ...blockPayload,
    blockHash,
    manifest,
  };

  const entryErrors = validateLedgerEntry(newBlock);
  if (entryErrors.length > 0) {
    throw new Error(`Ledger entry validation failed: ${entryErrors.join(', ')}`);
  }

  ledger.push(newBlock);
  saveStoredLedger(ledger);

  return newBlock;
}

/**
 * Appends a key lifecycle event (rotation, revocation, compromised marker).
 */
export async function recordKeyLifecycleEvent({
  event, // 'ROTATION' | 'REVOCATION'
  keyId,
  reason,
  newKeyId = null,
  actorId,
}) {
  const ledger = getStoredLedger();
  const lastBlock = ledger[ledger.length - 1];
  const keyring = getStoredKeyring();

  const keyIndex = keyring.findIndex((k) => k.keyId === keyId);
  if (keyIndex === -1) {
    throw new Error(`Key ${keyId} not found in keyring.`);
  }

  const targetKey = keyring[keyIndex];
  if (event === 'REVOCATION') {
    targetKey.status = KEY_STATUS.REVOKED;
    targetKey.revokedAt = new Date().toISOString();
    targetKey.revocationReason = reason || 'Admin revocation';
  } else if (event === 'ROTATION') {
    targetKey.status = KEY_STATUS.ROTATED;
    targetKey.rotatedAt = new Date().toISOString();
    targetKey.successorKeyId = newKeyId;
  }

  keyring[keyIndex] = targetKey;
  saveStoredKeyring(keyring);

  const entryType =
    event === 'ROTATION' ? LEDGER_ENTRY_TYPES.KEY_ROTATION : LEDGER_ENTRY_TYPES.KEY_REVOCATION;

  const payload = {
    keyId,
    event,
    reason,
    newKeyId,
    actorId,
    effectiveAt: new Date().toISOString(),
  };

  const payloadHash = await computeSha256Hex(payload);
  const blockIndex = lastBlock.index + 1;
  const timestamp = new Date().toISOString();
  const previousHash = lastBlock.blockHash;

  const blockPayload = {
    index: blockIndex,
    timestamp,
    entryType,
    manifestId: `key-event-${keyId}-${Date.now()}`,
    guidanceId: `key-${keyId}`,
    version: '1.0.0',
    previousHash,
    payloadHash,
    keyId,
    lifecyclePayload: payload,
  };

  const blockHash = await computeSha256Hex(blockPayload);
  const newBlock = { ...blockPayload, blockHash };

  ledger.push(newBlock);
  saveStoredLedger(ledger);

  return { newBlock, updatedKey: targetKey };
}

/**
 * Validates the full integrity of the release ledger.
 * Detects any block hash alteration, previousHash breakage, or broken signature.
 */
export async function verifyLedgerIntegrity(ledgerOverride = null, keyringOverride = null) {
  const ledger = ledgerOverride || getStoredLedger();
  const keyring = keyringOverride || getStoredKeyring();
  const results = {
    isValid: true,
    blockCount: ledger.length,
    verifiedAt: new Date().toISOString(),
    brokenBlocks: [],
    invalidSignatures: [],
    compromisedKeyBlocks: [],
  };

  if (!ledger || ledger.length === 0) {
    results.isValid = false;
    results.brokenBlocks.push({ index: -1, reason: 'Empty ledger' });
    return results;
  }

  // Genesis block check
  const genesis = ledger[0];
  if (genesis.index !== 0 || genesis.entryType !== LEDGER_ENTRY_TYPES.GENESIS) {
    results.isValid = false;
    results.brokenBlocks.push({ index: 0, reason: 'Invalid or missing genesis block' });
  }

  for (let i = 1; i < ledger.length; i += 1) {
    const prev = ledger[i - 1];
    const curr = ledger[i];

    // Check chaining hash
    if (curr.previousHash !== prev.blockHash) {
      results.isValid = false;
      results.brokenBlocks.push({
        index: curr.index,
        reason: `Previous hash mismatch at block ${curr.index}. Expected ${prev.blockHash}, found ${curr.previousHash}`,
      });
    }

    // Recompute block hash
    const blockPayload = {
      index: curr.index,
      timestamp: curr.timestamp,
      entryType: curr.entryType,
      manifestId: curr.manifestId,
      guidanceId: curr.guidanceId,
      version: curr.version,
      previousHash: curr.previousHash,
      payloadHash: curr.payloadHash,
      keyId: curr.keyId,
      ...(curr.lifecyclePayload ? { lifecyclePayload: curr.lifecyclePayload } : {}),
    };

    const recomputedHash = await computeSha256Hex(blockPayload);
    if (recomputedHash !== curr.blockHash) {
      results.isValid = false;
      results.brokenBlocks.push({
        index: curr.index,
        reason: `Block digest tampered at block ${curr.index}. Expected ${recomputedHash}, recorded ${curr.blockHash}`,
      });
    }

    // If entry has a manifest, verify payload hash and signature
    if (curr.manifest) {
      const recomputedPayloadHash = await computeSha256Hex(curr.manifest);
      if (recomputedPayloadHash !== curr.payloadHash) {
        results.isValid = false;
        results.brokenBlocks.push({
          index: curr.index,
          reason: `Manifest payload hash tampered at block ${curr.index}`,
        });
      }

      // Check key and signature
      const key = keyring.find((k) => k.keyId === curr.manifest.signatureBlock?.keyId);
      if (!key) {
        results.isValid = false;
        results.invalidSignatures.push({
          index: curr.index,
          keyId: curr.manifest.signatureBlock?.keyId,
          reason: 'Signing key missing from keyring',
        });
      } else {
        const unsignedFields = { ...curr.manifest };
        const signatureBlock = curr.manifest.signatureBlock;
        delete unsignedFields.signatureBlock;
        delete unsignedFields.manifestDigest;
        const unsignedDigest = await computeSha256Hex(unsignedFields);
        const sigOk = await verifySignature(
          key.publicKeyJwk,
          signatureBlock.signatureHex,
          unsignedDigest
        );

        if (!sigOk) {
          results.isValid = false;
          results.invalidSignatures.push({
            index: curr.index,
            keyId: key.keyId,
            reason: 'Signature verification failed',
          });
        }

        // Check if key was compromised
        if (key.status === KEY_STATUS.COMPROMISED || key.status === KEY_STATUS.REVOKED) {
          results.compromisedKeyBlocks.push({
            index: curr.index,
            keyId: key.keyId,
            status: key.status,
            guidanceId: curr.guidanceId,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Resets or initializes sample ledger and keys with synthetic records for tests/demo.
 */
export async function initializeSyntheticReleaseLedger() {
  const adminKey = await generateSigningKeyPair('authority-key-dept-rev-2026', {
    department: 'Revenue & Municipal Administration',
    owner: 'Chief Civic Verification Officer',
  });

  const notaryKey = await generateSigningKeyPair('authority-key-legal-audit-2026', {
    department: 'State Legal Provenance Directorate',
    owner: 'Principal Statutory Auditor',
  });

  const keyring = [adminKey, notaryKey];
  saveStoredKeyring(keyring);

  // Initialize fresh ledger
  const freshLedger = [GENESIS_BLOCK];
  saveStoredLedger(freshLedger);

  // Release 1: Tree Pruning Guidance v1.0.0
  const treeManifest = await createReleaseManifest({
    guidanceId: 'tree-pruning-permission',
    version: '1.0.0',
    contentPayload: {
      serviceId: 'tree-pruning-permission',
      statutoryAct: 'Tree Preservation & Urban Ecology Act (Act 43 of 1976)',
      processingTimeDays: 14,
      statutoryFeeInr: 50,
      slaRemedyHours: 72,
    },
    sources: [
      {
        sourceId: 'src-gazette-tp-1976',
        sourceUrl: 'https://gazette.gov.in/notifications/1976/tree-preservation-act.pdf',
        publisher: 'Urban Development Department',
        snapshotDigest: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
      },
    ],
    approvals: [
      {
        reviewerId: 'rev-legal-044',
        role: 'legal_reviewer',
        approvedAt: '2026-03-10T10:00:00.000Z',
      },
      {
        reviewerId: 'admin-urban-012',
        role: 'department_admin',
        approvedAt: '2026-03-10T11:30:00.000Z',
      },
    ],
    signingKey: adminKey,
  });

  await appendReleaseToLedger(treeManifest, keyring);

  // Release 2: Trade Licence Guidance v2.1.0
  const tradeManifest = await createReleaseManifest({
    guidanceId: 'trade-licence-renewal',
    version: '2.1.0',
    contentPayload: {
      serviceId: 'trade-licence-renewal',
      statutoryAct: 'Municipal Corporation Commercial Licencing By-laws (2018)',
      processingTimeDays: 7,
      statutoryFeeInr: 500,
      slaRemedyHours: 48,
    },
    sources: [
      {
        sourceId: 'src-muni-trade-2018',
        sourceUrl: 'https://muni.gov.in/rules/commercial-licencing-2018.pdf',
        publisher: 'Municipal Revenue Council',
        snapshotDigest: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      },
    ],
    approvals: [
      {
        reviewerId: 'auditor-civic-08',
        role: 'civic_auditor',
        approvedAt: '2026-03-15T09:00:00.000Z',
      },
    ],
    signingKey: notaryKey,
  });

  await appendReleaseToLedger(tradeManifest, keyring);

  return { keyring, ledger: getStoredLedger() };
}
