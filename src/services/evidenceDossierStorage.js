/**
 * Offline Evidence Dossier Storage & Cryptographic Tamper Seal (#947)
 *
 * Implements client-side, zero-upload local persistence for citizen evidence manifests.
 * Storage Key: civicbridge_evidence_dossiers_v1
 *
 * Strict Privacy & Security Guarantees:
 * - NO file bytes or binary data ever stored in localStorage.
 * - Stores only metadata, user descriptions, and SHA-256 digests.
 * - Automatically computes a tamper seal digest on save.
 * - Allows full verification of saved dossiers against subsequent tampering.
 */

import { computeManifestDigest, parseManifest } from './evidenceManifestService.js';

export const EVIDENCE_DOSSIERS_STORAGE_KEY = 'civicbridge_evidence_dossiers_v1';

/**
 * Retrieves the raw storage instance safely.
 * @param {Storage} [storage=localStorage]
 * @returns {Storage|null}
 */
function getStorage(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  return storage;
}

/**
 * Lists all saved evidence dossiers from local storage.
 * @param {Storage} [storage]
 * @returns {Array<Object>} List of saved dossier objects
 */
export function listSavedDossiers(storage) {
  const store = getStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(EVIDENCE_DOSSIERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves a single saved dossier by ID.
 * @param {string} id
 * @param {Storage} [storage]
 * @returns {Object|null}
 */
export function getSavedDossierById(id, storage) {
  if (!id) return null;
  const list = listSavedDossiers(storage);
  return list.find(d => d.id === id) || null;
}

/**
 * Sanitizes and minimizes a manifest before saving to storage.
 * Ensures NO file content, binary blobs, or unnecessary raw properties are persisted.
 * @param {Object} dossier
 * @returns {Object}
 */
export function sanitizeDossierForStorage(dossier) {
  if (!dossier || typeof dossier !== 'object') {
    throw new Error('Invalid dossier payload');
  }

  const entries = Array.isArray(dossier.entries)
    ? dossier.entries.map(e => ({
        name: String(e.name || '').slice(0, 255),
        size: Number.isSafeInteger(e.size) ? e.size : 0,
        type: String(e.type || '').slice(0, 255),
        lastModified: Number.isSafeInteger(e.lastModified) ? e.lastModified : Date.now(),
        description: String(e.description || '').slice(0, 500),
        category: String(e.category || 'Other Supporting Evidence').slice(0, 100),
        sha256: String(e.sha256 || '').toLowerCase(),
      }))
    : [];

  return {
    id: dossier.id || `dossier_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: String(dossier.title || 'Evidence Dossier').slice(0, 200),
    caseReference: String(dossier.caseReference || '').slice(0, 100),
    notes: String(dossier.notes || '').slice(0, 2000),
    algorithm: 'SHA-256',
    version: 1,
    createdAt: dossier.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries,
  };
}

/**
 * Saves or updates an evidence dossier in localStorage with an automated SHA-256 storage seal.
 * @param {Object} dossier
 * @param {Storage} [storage]
 * @returns {Promise<Object>} The saved dossier with its storage seal
 */
export async function saveDossier(dossier, storage) {
  const store = getStorage(storage);
  if (!store) throw new Error('Local storage is not available in this environment.');

  const sanitized = sanitizeDossierForStorage(dossier);
  if (!sanitized.entries.length) {
    throw new Error('Cannot save an empty evidence dossier. Add at least one file entry.');
  }

  // Validate the entries format through parseManifest validation logic
  parseManifest(JSON.stringify(sanitized));

  // Compute tamper seal for the dossier
  const seal = await computeManifestDigest(sanitized);
  const securedDossier = {
    ...sanitized,
    storageSeal: seal,
  };

  const list = listSavedDossiers(storage);
  const existingIdx = list.findIndex(d => d.id === securedDossier.id);

  let updatedList;
  if (existingIdx >= 0) {
    updatedList = [...list];
    updatedList[existingIdx] = securedDossier;
  } else {
    updatedList = [securedDossier, ...list];
  }

  store.setItem(EVIDENCE_DOSSIERS_STORAGE_KEY, JSON.stringify(updatedList));
  return securedDossier;
}

/**
 * Deletes a saved dossier by ID.
 * @param {string} id
 * @param {Storage} [storage]
 * @returns {boolean} True if deleted
 */
export function deleteSavedDossier(id, storage) {
  const store = getStorage(storage);
  if (!store || !id) return false;

  const list = listSavedDossiers(storage);
  const nextList = list.filter(d => d.id !== id);
  if (nextList.length === list.length) return false;

  store.setItem(EVIDENCE_DOSSIERS_STORAGE_KEY, JSON.stringify(nextList));
  return true;
}

/**
 * Verifies whether a saved dossier's contents have been tampered with since being sealed.
 * @param {Object} dossier
 * @returns {Promise<{ isIntact: boolean, expectedSeal: string|null, computedSeal: string }>}
 */
export async function verifySavedDossierIntegrity(dossier) {
  if (!dossier || typeof dossier !== 'object') {
    return { isIntact: false, expectedSeal: null, computedSeal: null, reason: 'Invalid dossier' };
  }

  const expectedSeal = dossier.storageSeal || null;
  const computedSeal = await computeManifestDigest(dossier);
  const isIntact = Boolean(expectedSeal && expectedSeal === computedSeal);

  return {
    isIntact,
    expectedSeal,
    computedSeal,
  };
}

/**
 * Exports a dossier manifest as pretty-printed JSON string.
 * @param {Object} dossier
 * @returns {string} JSON string
 */
export function exportDossierJson(dossier) {
  const sanitized = sanitizeDossierForStorage(dossier);
  return JSON.stringify(sanitized, null, 2);
}

/**
 * Imports and validates an exported manifest JSON string.
 * @param {string} jsonText
 * @returns {Object} Validated dossier
 */
export function importDossierJson(jsonText) {
  const parsed = parseManifest(jsonText);
  return sanitizeDossierForStorage(parsed);
}
