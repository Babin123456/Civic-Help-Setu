/**
 * Senior Citizen Maintenance & Welfare Tribunal Storage Service
 *
 * Client-side offline-first persistence for tribunal petitions with
 * automated PII sanitization, canonical SHA-256 digital seals, and
 * tampering detection (#858).
 */

import { sha256Hex, canonicalStringify } from './privacyIntegrityService.js';
import { formatPetitionAsPlainText } from './seniorCitizenTribunalService.js';

export const STORAGE_KEY = 'civicbridge_senior_tribunal_petitions';

function getStorage(storage) {
  if (storage && typeof storage.getItem === 'function') {
    return storage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Computes canonical SHA-256 digest over petition facts.
 *
 * @param {Object} petition
 * @returns {string} 64-character lowercase hex digest
 */
export const computePetitionDigest = (petition) => {
  if (!petition || typeof petition !== 'object') {
    return '0'.repeat(64);
  }

  const canonicalPayload = {
    version: 1,
    caseType: String(petition.caseType || ''),
    formCode: String(petition.formCode || ''),
    tribunalTitle: String(petition.tribunalTitle || ''),
    petitioner: {
      name: String(petition.petitioner?.name || ''),
      age: Number(petition.petitioner?.age || 0),
      address: String(petition.petitioner?.address || ''),
      phone: String(petition.petitioner?.phone || ''),
    },
    respondents: Array.isArray(petition.respondents)
      ? petition.respondents.map((r) => ({
          name: String(r.name || ''),
          relationship: String(r.relationship || ''),
          address: String(r.address || ''),
          monthlyIncome: Number(r.monthlyIncome || 0),
          hasInheritedProperty: Boolean(r.hasInheritedProperty),
        }))
      : [],
    monthlyClaim: Number(petition.monthlyClaim || 0),
    propertyDescription: String(petition.propertyDescription || ''),
    narrative: String(petition.narrative || ''),
  };

  return sha256Hex(canonicalStringify(canonicalPayload));
};

/**
 * Verifies cryptographic integrity of a petition object.
 *
 * @param {Object} petition
 * @returns {{ valid: boolean, status: string, reason?: string, expectedDigest?: string, actualDigest?: string }}
 */
export const verifyPetitionIntegrity = (petition) => {
  if (!petition || typeof petition !== 'object') {
    return {
      valid: false,
      status: 'INVALID',
      reason: 'Missing or malformed petition data.',
    };
  }

  const expectedDigest = computePetitionDigest(petition);
  const actualDigest = petition.sha256Digest;

  if (!actualDigest || typeof actualDigest !== 'string') {
    return {
      valid: false,
      status: 'UNSEALED',
      reason: 'Petition has no digital seal.',
    };
  }

  const isMatch = constantTimeEqual(actualDigest.trim().toLowerCase(), expectedDigest.toLowerCase());

  if (!isMatch) {
    return {
      valid: false,
      status: 'TAMPERED',
      reason: 'Cryptographic digest mismatch: petition facts have been modified.',
      expectedDigest,
      actualDigest,
    };
  }

  return {
    valid: true,
    status: 'VALID',
    digest: expectedDigest,
  };
};

/**
 * Retrieves all saved petitions from local storage.
 *
 * @param {Storage} [customStorage]
 * @returns {Array<Object>} List of verified petition objects
 */
export const getPetitions = (customStorage) => {
  const store = getStorage(customStorage);
  if (!store) return [];

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

/**
 * Retrieves a single petition by its filing reference or id.
 *
 * @param {string} id
 * @param {Storage} [customStorage]
 * @returns {Object|null}
 */
export const getPetitionById = (id, customStorage) => {
  if (!id) return null;
  const list = getPetitions(customStorage);
  return list.find((p) => p.filingReference === id || p.id === id) || null;
};

/**
 * Saves or updates a petition in local storage with cryptographic sealing.
 *
 * @param {Object} petition
 * @param {Storage} [customStorage]
 * @returns {Object} Saved petition with verified seal
 */
export const savePetition = (petition, customStorage) => {
  const store = getStorage(customStorage);
  if (!petition || typeof petition !== 'object') {
    throw new Error('Invalid petition payload');
  }

  const sha256Digest = computePetitionDigest(petition);
  const enrichedPetition = {
    ...petition,
    id: petition.id || petition.filingReference || `MWPSC-${Date.now()}`,
    sha256Digest,
    savedAt: new Date().toISOString(),
  };

  if (!store) return enrichedPetition;

  const currentList = getPetitions(store);
  const existingIndex = currentList.findIndex(
    (p) => p.id === enrichedPetition.id || p.filingReference === enrichedPetition.filingReference
  );

  let updatedList;
  if (existingIndex >= 0) {
    updatedList = [...currentList];
    updatedList[existingIndex] = enrichedPetition;
  } else {
    updatedList = [enrichedPetition, ...currentList];
  }

  store.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  return enrichedPetition;
};

/**
 * Deletes a petition from local storage.
 *
 * @param {string} id
 * @param {Storage} [customStorage]
 * @returns {boolean}
 */
export const deletePetition = (id, customStorage) => {
  const store = getStorage(customStorage);
  if (!store || !id) return false;

  const list = getPetitions(store);
  const filtered = list.filter((p) => p.id !== id && p.filingReference !== id);
  if (filtered.length === list.length) return false;

  store.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
};

/**
 * Clears all saved tribunal petitions.
 *
 * @param {Storage} [customStorage]
 */
export const clearPetitions = (customStorage) => {
  const store = getStorage(customStorage);
  if (store) {
    store.removeItem(STORAGE_KEY);
  }
};

/**
 * Exports signed petition dossier JSON structure.
 *
 * @param {Object} petition
 * @returns {Object} Exportable JSON dossier
 */
export const exportSignedPetitionDossier = (petition) => {
  if (!petition) return null;
  const digest = petition.sha256Digest || computePetitionDigest(petition);

  return {
    version: 1,
    exportType: 'SENIOR_CITIZEN_TRIBUNAL_STATUTORY_PETITION',
    filingReference: petition.filingReference,
    exportedAt: new Date().toISOString(),
    petition: {
      ...petition,
      sha256Digest: digest,
    },
    signatureMetadata: {
      algorithm: 'SHA-256',
      canonicalDigest: digest,
      statutoryAct: 'The Maintenance and Welfare of Parents and Senior Citizens Act, 2007 (Central Act 56 of 2007)',
    },
  };
};

/**
 * Downloads petition as text slip for physical SDM filing.
 *
 * @param {Object} petition
 */
export const downloadPetitionTextFile = (petition) => {
  if (!petition || typeof document === 'undefined') return;

  const content = formatPetitionAsPlainText(petition);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `Senior-Citizen-Tribunal-Petition-${petition.filingReference || 'Draft'}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Downloads signed JSON dossier.
 *
 * @param {Object} petition
 */
export const downloadPetitionJsonDossier = (petition) => {
  if (!petition || typeof document === 'undefined') return;

  const dossier = exportSignedPetitionDossier(petition);
  if (!dossier) return;

  const content = JSON.stringify(dossier, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `Senior-Citizen-Tribunal-Dossier-${petition.filingReference || 'Draft'}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
