/**
 * Sensitive Browser-Storage Inventory and Automated Leak Guard Service
 * 
 * Defines:
 * - Documented allowlist of authorized browser storage keys, data classifications, retention rules, and owners.
 * - Runtime leak guard interceptor scanning proposed storage writes for prohibited sensitive data
 *   (e.g. raw JWT tokens, passwords, 12-digit Aadhaar numbers, unencrypted document base64/bytes, private AI prompts).
 * - Explicit prohibitions: No authentication tokens or sensitive identity numbers in unencrypted localStorage.
 * - Export, clear-data, and consent withdrawal purge operations.
 */

export const STORAGE_DATA_CLASSIFICATIONS = {
  PREFERENCE: 'PREFERENCE',
  TRANSIENT_STATE: 'TRANSIENT_STATE',
  CONSENT_RECORD: 'CONSENT_RECORD',
  OFFLINE_DRAFT: 'OFFLINE_DRAFT',
  CACHE_AGGREGATE: 'CACHE_AGGREGATE'
};

export const STORAGE_INVENTORY_ALLOWLIST = {
  'civicbridge_theme': {
    owner: 'UI/ThemeContext',
    storageType: 'localStorage',
    classification: STORAGE_DATA_CLASSIFICATIONS.PREFERENCE,
    retention: 'Persistent until user changes',
    consentRequired: false,
    description: 'User UI theme preference (light/dark/system)'
  },
  'civicbridge_lang': {
    owner: 'i18n/LanguageContext',
    storageType: 'localStorage',
    classification: STORAGE_DATA_CLASSIFICATIONS.PREFERENCE,
    retention: 'Persistent',
    consentRequired: false,
    description: 'User preferred interface language code'
  },
  'civicbridge_privacy_consent': {
    owner: 'Privacy/ConsentManager',
    storageType: 'localStorage',
    classification: STORAGE_DATA_CLASSIFICATIONS.CONSENT_RECORD,
    retention: '1 year or until revoked',
    consentRequired: true,
    description: 'Cryptographically hashed or boolean consent timestamps'
  },
  'chs_post_auth_dest': {
    owner: 'Auth/OAuthRedirectService',
    storageType: 'sessionStorage',
    classification: STORAGE_DATA_CLASSIFICATIONS.TRANSIENT_STATE,
    retention: 'Transient, cleared immediately upon post-login navigation',
    consentRequired: false,
    description: 'Sanitized relative URL for post-authentication return'
  },
  'civicbridge_location_denied': {
    owner: 'Location/PermissionHelper',
    storageType: 'sessionStorage',
    classification: STORAGE_DATA_CLASSIFICATIONS.TRANSIENT_STATE,
    retention: 'Session duration',
    consentRequired: false,
    description: 'Flag indicating citizen denied GPS prompt to avoid re-prompting'
  },
  'chs_offline_report_drafts': {
    owner: 'Emergency/OfflineReportQueue',
    storageType: 'localStorage',
    classification: STORAGE_DATA_CLASSIFICATIONS.OFFLINE_DRAFT,
    retention: 'Until network connectivity resumes or user explicitly clears',
    consentRequired: true,
    description: 'Sanitized disaster reports drafted while offline'
  }
};

export const PROHIBITED_STORAGE_PATTERNS = [
  { name: 'JWT_BEARER_TOKEN', regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/i },
  { name: 'AADHAAR_NUMBER', regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { name: 'PASSWORD_FIELD', regex: /"?(?:password|passcode|secretKey|auth_token)"?\s*[:=]\s*["']?[^"',\s}]+/i },
  { name: 'PRIVATE_KEY_PEM', regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i },
  { name: 'RAW_DOCUMENT_BASE64', regex: /data:application\/(?:pdf|octet-stream);base64,[A-Za-z0-9+/=]{100,}/i }
];

/**
 * Validates a storage write attempt against allowlist and sensitive leak patterns.
 * @param {string} key 
 * @param {any} value 
 * @param {'localStorage'|'sessionStorage'} [targetStorage='localStorage']
 * @returns {Object} validation result
 */
export function inspectStorageWrite(key, value, targetStorage = 'localStorage') {
  const itemDef = STORAGE_INVENTORY_ALLOWLIST[key];

  if (!itemDef) {
    return {
      allowed: false,
      reason: `Unapproved storage key '${key}'. All browser storage keys must be registered in the storage inventory allowlist.`,
      violationType: 'UNAPPROVED_KEY'
    };
  }

  if (itemDef.storageType !== targetStorage) {
    return {
      allowed: false,
      reason: `Storage type mismatch for key '${key}'. Expected ${itemDef.storageType}, but attempted ${targetStorage}.`,
      violationType: 'STORAGE_TYPE_MISMATCH'
    };
  }

  const stringified = typeof value === 'string' ? value : JSON.stringify(value);

  for (const pattern of PROHIBITED_STORAGE_PATTERNS) {
    if (pattern.regex.test(stringified)) {
      return {
        allowed: false,
        reason: `Sensitive data leak detected in payload for key '${key}': Matched prohibited pattern ${pattern.name}.`,
        violationType: 'PROHIBITED_SENSITIVE_DATA',
        patternMatched: pattern.name
      };
    }
  }

  return {
    allowed: true,
    classification: itemDef.classification,
    owner: itemDef.owner
  };
}

/**
 * Executes safe storage write guarded against sensitive leaks and unapproved keys.
 * @param {string} key 
 * @param {any} value 
 * @param {Storage} [storage=localStorage]
 * @returns {boolean} success
 */
export function safeStorageWrite(key, value, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return false;
  const storageType = storage === (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
    ? 'sessionStorage'
    : 'localStorage';

  const check = inspectStorageWrite(key, value, storageType);
  if (!check.allowed) {
    console.warn(`[LeakGuard Blocked Write]: ${check.reason}`);
    return false;
  }

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    storage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Purges all citizen draft and state keys when consent is withdrawn.
 * @param {Storage} [storage=localStorage]
 * @returns {Array<string>} list of purged keys
 */
export function purgeCitizenStorageOnConsentWithdrawal(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  const purged = [];

  for (const [key, itemDef] of Object.entries(STORAGE_INVENTORY_ALLOWLIST)) {
    if (itemDef.consentRequired) {
      try {
        storage.removeItem(key);
        purged.push(key);
      } catch {
        // Continue
      }
    }
  }

  return purged;
}


export const STORAGE_EXPORT_POLICY = {
  ALLOW_EXPORT: true,
  EXCLUDED_KEY_PATTERNS: ['token', 'secret', 'password', 'key'],
  MAX_EXPORT_PAYLOAD_BYTES: 1048576 // 1MB
};

/**
 * Exports citizen stored preferences and local drafts into a sanitized JSON package.
 * @param {Storage} [storage=localStorage]
 * @returns {string} JSON export payload
 */
export function exportSanitizedCitizenStorage(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return JSON.stringify({ exportedAt: new Date().toISOString(), entries: {} });

  const exportPackage = {
    exportedAt: new Date().toISOString(),
    schemaVersion: '1.0.0',
    entries: {}
  };

  for (const [key, itemDef] of Object.entries(STORAGE_INVENTORY_ALLOWLIST)) {
    try {
      const val = storage.getItem(key);
      if (val !== null) {
        // Double check against prohibited patterns before export
        const check = inspectStorageWrite(key, val, itemDef.storageType);
        if (check.allowed) {
          exportPackage.entries[key] = {
            classification: itemDef.classification,
            owner: itemDef.owner,
            data: val
          };
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return JSON.stringify(exportPackage, null, 2);
}

/**
 * Verifies that a storage module audit scan passes all CI assertions.
 * @param {Object} auditReport 
 * @returns {boolean}
 */
export function assertStorageCompliance(auditReport = {}) {
  const unapprovedCount = Number(auditReport.unapprovedKeyCount) || 0;
  const sensitiveLeaks = Number(auditReport.sensitiveLeakCount) || 0;
  return unapprovedCount === 0 && sensitiveLeaks === 0;
}
