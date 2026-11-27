/**
 * src/services/recommendationFairnessAuditContract.js
 *
 * Versioned contracts, provenance rules, privacy/anti-inference guards,
 * and safe migration helpers for the Civic Recommendation Fairness and
 * Coverage Audit Suite (#1449).
 */

import { PROTECTED_ATTRIBUTES, SAFETY_THRESHOLDS } from './fairnessErrorMonitoringService.js';
import { inspectStringForPII } from './piiLeakageGuardService.js';

export const AUDIT_SCHEMA_VERSION = '1.0.0';

export const COHORT_AXES = ['language', 'district', 'deviceType', 'connectivityTier'];

export const RECORD_ORIGIN = {
  OFFICIAL: 'official_record',
  CITIZEN_CONSENTED: 'citizen_consented_cohort',
  AI_COMMUNITY_SUGGESTION: 'ai_community_suggestion',
};

export const CONSENT_MODES = ['user_consented_offline_eval', 'synthetic_benchmark'];

export const DEFAULT_AUDIT_POLICY = {
  minCohortSize: 10,
  confidenceLevel: 0.95,
  minRecallAt5: SAFETY_THRESHOLDS.MIN_RECALL_AT_5,
  minNdcgAt5: SAFETY_THRESHOLDS.MIN_NDCG_AT_5,
  minParityRatio: SAFETY_THRESHOLDS.MIN_PARITY_RATIO,
  minCompletionRate: 0.55,
  maxAbstentionRate: SAFETY_THRESHOLDS.MAX_ABSTENTION_RATE,
  minCatalogCoverage: 0.4,
  maxRegressionDelta: 0.05,
  provenance: {
    source: 'Civic Help Setu Fairness Governance Policy',
    jurisdiction: 'IN-UP',
    effectiveDate: '2026-01-15',
    lastVerifiedAt: '2026-11-20T00:00:00.000Z',
    verified: true,
  },
};

/**
 * Sensitive-trait and proxy-inference keys that must NEVER appear in
 * offline evaluation datasets, cohort tags, or ranking features.
 */
export const PROHIBITED_SENSITIVE_AND_PROXY_KEYS = [
  ...PROTECTED_ATTRIBUTES,
  'aadhaar',
  'aadhaar_number',
  'aadhaarnumber',
  'pan',
  'pan_number',
  'otp',
  'password',
  'biometric',
  'biometrics',
  'fingerprint',
  'iris',
  'phone',
  'mobile',
  'email',
  'voter_id',
  'voterid',
  'surname',
  'family_name',
  'inferred_caste',
  'inferred_religion',
  'inferred_disability',
  'inferred_health',
  'sensitive_trait_inference',
];

const SENSITIVE_KEY_SET = new Set(PROHIBITED_SENSITIVE_AND_PROXY_KEYS.map((k) => k.toLowerCase()));

/**
 * Recursively inspects an object or array for prohibited sensitive traits,
 * proxy-inference keys, or raw PII values (Aadhaar, PAN, mobile, email).
 *
 * @param {unknown} payload
 * @param {string} [path='root']
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateNoSensitiveTraitOrPii(payload, path = 'root') {
  const violations = [];

  function walk(node, currentPath) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      const piiCheck = inspectStringForPII(node);
      if (!piiCheck.clean) {
        for (const v of piiCheck.violations) {
          violations.push(`${currentPath}: prohibited PII detected (${v.type})`);
        }
      }
      if (/\b\d{6}\b/.test(node) && /otp/i.test(currentPath)) {
        violations.push(`${currentPath}: OTP-like value is prohibited`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => walk(item, `${currentPath}[${idx}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        const normalizedKey = key.trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (SENSITIVE_KEY_SET.has(normalizedKey)) {
          violations.push(`${currentPath}.${key}: prohibited sensitive/PII/inference field`);
        }
        walk(val, `${currentPath}.${key}`);
      }
    }
  }

  walk(payload, path);
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Evaluates official provenance completeness for a dataset or policy rule.
 * Unknown or incomplete official metadata is explicitly marked unverified.
 *
 * @param {object} provenance
 * @returns {{ verified: boolean, status: 'verified'|'unverified', missingFields: string[], recordOrigin: string }}
 */
export function evaluateProvenanceVerification(provenance = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter((field) => {
    const value = provenance?.[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  const verified = missingFields.length === 0 && provenance?.verified !== false;
  return {
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
    recordOrigin: RECORD_ORIGIN.OFFICIAL,
  };
}

/**
 * Validates and normalizes an offline evaluation dataset registration payload.
 *
 * @param {object} dataset
 * @returns {{ valid: boolean, errors: string[], normalized: object|null }}
 */
export function validateOfflineEvalDataset(dataset) {
  const errors = [];
  if (!dataset || typeof dataset !== 'object') {
    return { valid: false, errors: ['Dataset payload must be a JSON object.'], normalized: null };
  }

  const sensitivity = validateNoSensitiveTraitOrPii(dataset, 'dataset');
  if (!sensitivity.valid) {
    return { valid: false, errors: sensitivity.violations, normalized: null };
  }

  if (typeof dataset.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(dataset.id.trim())) {
    errors.push('dataset.id must be 2-64 alphanumeric, dash, or underscore characters.');
  }
  if (typeof dataset.name !== 'string' || dataset.name.trim().length < 3) {
    errors.push('dataset.name must be at least 3 characters.');
  }
  if (!CONSENT_MODES.includes(dataset.consentMode)) {
    errors.push(`dataset.consentMode must be one of: ${CONSENT_MODES.join(', ')}.`);
  }
  if (!Array.isArray(dataset.records) || dataset.records.length === 0) {
    errors.push('dataset.records must be a non-empty array of evaluation cases.');
  } else {
    dataset.records.forEach((rec, idx) => {
      if (!rec || typeof rec !== 'object') {
        errors.push(`records[${idx}] must be an object.`);
        return;
      }
      if (!Array.isArray(rec.relevantServiceIds)) {
        errors.push(`records[${idx}].relevantServiceIds must be an array.`);
      }
      if (!rec.cohorts || typeof rec.cohorts !== 'object') {
        errors.push(`records[${idx}].cohorts must be an object with non-sensitive cohort tags.`);
      }
      if (rec.consented !== true && dataset.consentMode === 'user_consented_offline_eval') {
        errors.push(`records[${idx}].consented must be true for user_consented_offline_eval datasets.`);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors, normalized: null };
  }

  const provenanceCheck = evaluateProvenanceVerification(dataset.provenance || {});
  const normalized = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    id: dataset.id.trim(),
    name: dataset.name.trim(),
    version: typeof dataset.version === 'string' && dataset.version.trim() ? dataset.version.trim() : '1.0.0',
    consentMode: dataset.consentMode,
    recordOrigin:
      dataset.consentMode === 'user_consented_offline_eval'
        ? RECORD_ORIGIN.CITIZEN_CONSENTED
        : RECORD_ORIGIN.OFFICIAL,
    provenance: {
      source: dataset.provenance?.source || 'Unverified community/offline submission',
      jurisdiction: dataset.provenance?.jurisdiction || 'UNSPECIFIED',
      effectiveDate: dataset.provenance?.effectiveDate || '',
      lastVerifiedAt: dataset.provenance?.lastVerifiedAt || '',
      verified: provenanceCheck.verified,
      status: provenanceCheck.status,
      missingFields: provenanceCheck.missingFields,
    },
    records: dataset.records.map((r, i) => ({
      caseId: r.caseId || `${dataset.id.trim()}-case-${i + 1}`,
      query: r.query || {},
      cohorts: {
        language: String(r.cohorts.language || 'unknown'),
        district: String(r.cohorts.district || 'unknown'),
        deviceType: String(r.cohorts.deviceType || 'unknown'),
        connectivityTier: String(r.cohorts.connectivityTier || 'unknown'),
      },
      relevantServiceIds: r.relevantServiceIds,
      completedServiceIds: Array.isArray(r.completedServiceIds) ? r.completedServiceIds : [],
      consented: Boolean(r.consented),
    })),
    createdAt: dataset.createdAt || new Date().toISOString(),
  };

  return { valid: true, errors: [], normalized };
}

/**
 * Safe backward-compatible migration for persisted audit store payloads.
 * Preserves existing fields and fills defaults for older schema versions.
 *
 * @param {object} rawState
 * @returns {object}
 */
export function migrateAuditStoreState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    datasets: Array.isArray(safe.datasets) ? safe.datasets : [],
    runs: Array.isArray(safe.runs) ? safe.runs : [],
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
    policy: {
      ...DEFAULT_AUDIT_POLICY,
      ...(safe.policy && typeof safe.policy === 'object' ? safe.policy : {}),
      provenance: {
        ...DEFAULT_AUDIT_POLICY.provenance,
        ...(safe.policy?.provenance || {}),
      },
    },
  };
}

