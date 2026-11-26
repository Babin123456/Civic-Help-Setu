/**
 * Zero-Knowledge Credential Revocation Registry Service (#1161)
 *
 * Implements a versioned cryptographic Revocation Status List (RSL)
 * based on bit-vector status indexing:
 * - 0 = ACTIVE (valid, unrevoked)
 * - 1 = REVOKED (invalidated, cancelled)
 *
 * Verifiers inspect the issuer's published status list to ensure credentials
 * have not been revoked without requiring real-time tracking of individual citizens.
 */

import { sha256Hex, canonicalStringify } from './privacyIntegrityService';

const STORAGE_KEY = 'civicbridge_zk_revocation_registry_v1';

/**
 * In-memory status list state with local storage fallback.
 * @type {Map<string, { issuerId: string, version: number, updatedAt: string, bitVector: number[], listHash: string }>}
 */
const registryState = new Map();

/**
 * Initializes the default revocation list for an issuer.
 *
 * @param {string} issuerId
 * @param {number} [capacity=2048]
 * @returns {Object}
 */
export function initializeRevocationList(issuerId, capacity = 2048) {
  const bitVector = new Array(capacity).fill(0);
  const updatedAt = new Date().toISOString();
  const listHash = sha256Hex(canonicalStringify({ issuerId, bitVector, updatedAt, version: 1 }));

  const record = {
    issuerId,
    version: 1,
    updatedAt,
    capacity,
    bitVector,
    listHash,
  };

  registryState.set(issuerId, record);
  persistRegistry();
  return record;
}

/**
 * Loads the revocation registry from local storage if available.
 */
export function loadRegistry() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [issuerId, record] of Object.entries(parsed)) {
        if (record && Array.isArray(record.bitVector)) {
          registryState.set(issuerId, record);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load ZK revocation registry from storage:', err);
  }
}

/**
 * Persists the registry to local storage.
 */
function persistRegistry() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const obj = {};
    for (const [k, v] of registryState.entries()) {
      obj[k] = v;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    console.warn('Failed to persist ZK revocation registry:', err);
  }
}

/**
 * Retrieves the revocation list for an issuer, creating one if not existing.
 *
 * @param {string} issuerId
 * @returns {Object}
 */
export function getRevocationList(issuerId) {
  if (!registryState.has(issuerId)) {
    loadRegistry();
  }
  if (!registryState.has(issuerId)) {
    return initializeRevocationList(issuerId);
  }
  return registryState.get(issuerId);
}

/**
 * Checks whether a credential index is revoked for a given issuer.
 *
 * @param {string} issuerId
 * @param {number} statusListIndex
 * @returns {{ revoked: boolean, status: string, version: number, updatedAt: string, reason?: string }}
 */
export function checkRevocationStatus(issuerId, statusListIndex) {
  if (typeof issuerId !== 'string' || !issuerId) {
    return { revoked: true, status: 'INVALID_ISSUER', version: 0, updatedAt: new Date().toISOString(), reason: 'Missing issuer ID' };
  }

  if (!Number.isInteger(statusListIndex) || statusListIndex < 0) {
    return { revoked: true, status: 'INVALID_INDEX', version: 0, updatedAt: new Date().toISOString(), reason: 'Index out of bounds' };
  }

  const list = getRevocationList(issuerId);
  if (statusListIndex >= list.bitVector.length) {
    return {
      revoked: true,
      status: 'INDEX_EXCEEDS_CAPACITY',
      version: list.version,
      updatedAt: list.updatedAt,
      reason: `Index ${statusListIndex} exceeds registry capacity ${list.bitVector.length}`,
    };
  }

  const isRevoked = list.bitVector[statusListIndex] === 1;

  return {
    revoked: isRevoked,
    status: isRevoked ? 'REVOKED' : 'ACTIVE',
    version: list.version,
    updatedAt: list.updatedAt,
    listHash: list.listHash,
  };
}

/**
 * Marks a credential index as revoked (Used for revocation testing and administrative management).
 *
 * @param {string} issuerId
 * @param {number} statusListIndex
 * @param {string} [reason='Administrative revocation']
 * @returns {Object}
 */
export function revokeCredential(issuerId, statusListIndex, reason = 'Administrative revocation') {
  const list = getRevocationList(issuerId);
  if (statusListIndex >= list.bitVector.length) {
    throw new Error(`Cannot revoke index ${statusListIndex}: exceeds capacity ${list.bitVector.length}`);
  }

  list.bitVector[statusListIndex] = 1;
  list.version += 1;
  list.updatedAt = new Date().toISOString();
  list.lastRevocationReason = reason;
  list.listHash = sha256Hex(
    canonicalStringify({
      issuerId,
      bitVector: list.bitVector,
      updatedAt: list.updatedAt,
      version: list.version,
    })
  );

  persistRegistry();
  return {
    revoked: true,
    issuerId,
    statusListIndex,
    version: list.version,
    listHash: list.listHash,
  };
}

/**
 * Resets the in-memory and local registry state (useful in test teardown).
 */
export function resetRevocationRegistry() {
  registryState.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
