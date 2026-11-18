/**
 * src/services/piiLeakageGuardService.js
 *
 * Multi-stage PII detection, entropy scanning, and privacy certification guard
 * for synthetic civic datasets (#778).
 *
 * Guarantees:
 * - 0% tolerance for real citizen identifiers (Aadhaar, PAN, authentic phone numbers, voter IDs).
 * - Shannon Entropy scanning to prevent leaking secret keys, tokens, or hashes.
 * - Enforcement of synthetic watermarks on every generated entity.
 * - k-Anonymity evaluation across demographic attributes.
 */

// Official Verhoeff multiplication & permutation tables for Aadhaar checksum validation
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function validateVerhoeff(numStr) {
  const digits = String(numStr).replace(/\D/g, '');
  if (digits.length === 0) return false;
  let c = 0;
  const invertedArray = digits.split('').map(Number).reverse();
  for (let i = 0; i < invertedArray.length; i += 1) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][invertedArray[i]]];
  }
  return c === 0;
}

// Strict PII regular expression matchers
export const PII_PATTERNS = {
  // Real Aadhaar: 12 digits, starting with 2-9
  AADHAAR: /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/,
  // PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
  PAN: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
  // Real Indian Mobile: starts with 6,7,8,9 and is NOT in the dummy prefix 99900
  REAL_MOBILE: /(?<!\d)(?:\+?91[\s-]?)?(?!(?:99900))[6-9]\d{4}[\s-]?\d{5}(?!\d)/,
  // Voter Identity Card (EPIC): 3 letters + 7 digits
  VOTER_ID: /\b[A-Z]{3}[0-9]{7}\b/,
  // Indian Passport: 1 letter followed by 7 digits
  PASSPORT: /\b[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]\b/,
  // Real personal email (rejects common public webmail domains like gmail.com, yahoo.com)
  REAL_EMAIL: /\b[A-Za-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|rediffmail)\.com\b/i,
};

export const SYNTHETIC_WATERMARK = 'SYNTH-CIVIC-SETU-v1';

/**
 * Calculates Shannon entropy of a string: H(X) = - sum(p(x) * log2(p(x)))
 * High entropy (> 4.5 on strings > 20 chars) indicates secret tokens, API keys, or encrypted ciphertext.
 */
export function calculateShannonEntropy(str) {
  if (typeof str !== 'string' || str.length === 0) return 0;
  const freq = {};
  for (let i = 0; i < str.length; i += 1) {
    const char = str[i];
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Inspects a single text value for PII violations and high-entropy secret leakage.
 */
export function inspectStringForPII(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { clean: true, violations: [] };
  }

  const violations = [];

  // Check Aadhaar
  if (PII_PATTERNS.AADHAAR.test(text)) {
    const match = text.match(PII_PATTERNS.AADHAAR)[0];
    const cleanDigits = match.replace(/\s/g, '');
    if (cleanDigits.length === 12) {
      violations.push({
        type: 'AADHAAR_DETECTED',
        snippet: `${cleanDigits.slice(0, 4)}XXXX${cleanDigits.slice(8)}`,
      });
    }
  }

  // Check PAN
  if (PII_PATTERNS.PAN.test(text)) {
    violations.push({
      type: 'PAN_DETECTED',
      snippet: text.match(PII_PATTERNS.PAN)[0].replace(/.(?=.{2})/g, '*'),
    });
  }

  // Check Real Mobile Numbers (excluding harmless dummy 99900 prefix)
  if (PII_PATTERNS.REAL_MOBILE.test(text)) {
    violations.push({
      type: 'REAL_PHONE_DETECTED',
      snippet: 'Active Telephony Number Pattern Detected',
    });
  }

  // Check Voter ID
  if (PII_PATTERNS.VOTER_ID.test(text)) {
    violations.push({
      type: 'VOTER_ID_DETECTED',
      snippet: text.match(PII_PATTERNS.VOTER_ID)[0],
    });
  }

  // Check Passport
  if (PII_PATTERNS.PASSPORT.test(text)) {
    violations.push({
      type: 'PASSPORT_DETECTED',
      snippet: 'Passport Number Pattern Detected',
    });
  }

  // Check Real Personal Email
  if (PII_PATTERNS.REAL_EMAIL.test(text)) {
    violations.push({
      type: 'REAL_EMAIL_DETECTED',
      snippet: text.match(PII_PATTERNS.REAL_EMAIL)[0],
    });
  }

  // Check High Entropy Strings (Tokens / Private Keys)
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.length >= 24) {
      const entropy = calculateShannonEntropy(word);
      if (entropy > 4.5) {
        violations.push({
          type: 'HIGH_ENTROPY_TOKEN_DETECTED',
          entropy: Number(entropy.toFixed(2)),
          snippet: `${word.slice(0, 6)}...[REDACTED]`,
        });
      }
    }
  }

  return {
    clean: violations.length === 0,
    violations,
  };
}

/**
 * Recursively scans an entity object for PII, watermarking, and structural validity.
 */
export function inspectEntityRecord(record, entityName = 'Record') {
  const violations = [];
  const recordId = record?.id || 'UNKNOWN';

  // Invariant 1: Synthetic watermarking
  if (!record?.isSynthetic) {
    violations.push({
      recordId,
      entityName,
      field: 'isSynthetic',
      type: 'MISSING_SYNTHETIC_FLAG',
      message: 'Entity must contain isSynthetic: true',
    });
  }

  if (record?.syntheticWatermark !== SYNTHETIC_WATERMARK) {
    violations.push({
      recordId,
      entityName,
      field: 'syntheticWatermark',
      type: 'INVALID_SYNTHETIC_WATERMARK',
      message: `Entity must contain syntheticWatermark: "${SYNTHETIC_WATERMARK}"`,
    });
  }

  // Invariant 2: Deep traversal of string fields
  function traverse(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;

    for (const key of Object.keys(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj[key];

      if (typeof value === 'string') {
        const result = inspectStringForPII(value);
        if (!result.clean) {
          for (const v of result.violations) {
            violations.push({
              recordId,
              entityName,
              field: currentPath,
              ...v,
            });
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'string') {
            const result = inspectStringForPII(item);
            if (!result.clean) {
              for (const v of result.violations) {
                violations.push({
                  recordId,
                  entityName,
                  field: `${currentPath}[${index}]`,
                  ...v,
                });
              }
            }
          } else if (typeof item === 'object') {
            traverse(item, `${currentPath}[${index}]`);
          }
        });
      } else if (typeof value === 'object') {
        traverse(value, currentPath);
      }
    }
  }

  traverse(record);

  return {
    clean: violations.length === 0,
    violations,
  };
}

/**
 * Calculates k-Anonymity of an array of citizen application or grievance records
 * against quasi-identifiers (e.g. ['district', 'serviceCategory', 'status']).
 */
export function evaluateKAnonymity(records, quasiIdentifiers = ['district', 'status']) {
  if (!Array.isArray(records) || records.length === 0) {
    return { k: 0, distinctEquivalenceClasses: 0 };
  }

  const groups = new Map();

  for (const record of records) {
    const key = quasiIdentifiers
      .map((field) => String(record[field] || record?.jurisdiction?.[field] || ''))
      .join('||');

    groups.set(key, (groups.get(key) || 0) + 1);
  }

  let minCount = Infinity;
  for (const count of groups.values()) {
    if (count < minCount) {
      minCount = count;
    }
  }

  return {
    k: minCount === Infinity ? 0 : minCount,
    distinctEquivalenceClasses: groups.size,
  };
}

/**
 * Master scanner that audits an entire generated artifact bundle.
 */
export function scanArtifactBundle(bundle) {
  const allViolations = [];
  let totalRecords = 0;

  const entityCollections = [
    { key: 'offices', name: 'SyntheticOffice' },
    { key: 'services', name: 'SyntheticService' },
    { key: 'applications', name: 'SyntheticApplication' },
    { key: 'grievances', name: 'SyntheticGrievance' },
  ];

  for (const col of entityCollections) {
    const list = bundle[col.key] || [];
    totalRecords += list.length;
    for (const record of list) {
      const res = inspectEntityRecord(record, col.name);
      if (!res.clean) {
        allViolations.push(...res.violations);
      }
    }
  }

  const kAnonymity = evaluateKAnonymity(bundle.applications || []);

  return {
    passed: allViolations.length === 0,
    recordsScanned: totalRecords,
    piiViolationsCount: allViolations.length,
    violations: allViolations,
    kAnonymityScore: kAnonymity.k,
    auditTimestamp: new Date().toISOString(),
  };
}
