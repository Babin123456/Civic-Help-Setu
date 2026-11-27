/**
 * src/services/agentMemory/memoryScopeIsolationLayer.js
 *
 * Civic Agent Memory Scope and Per-Case Context Isolation Layer (#1447).
 *
 * Extends src/services/agentMemory/caseIsolationGuard.js and
 * src/services/piiLeakageGuardService.js to enforce:
 * - Tenant- and case-scoped memory partitions (anti-cross-case leakage)
 * - Allowlisted category retrieval
 * - Deterministic no-memory mode (stateless zero-retention/zero-retrieval)
 * - Default exclusion of secrets, tokens, Aadhaar, PAN, OTP, passwords, and biometrics
 * - Deletion, TTL expiry, and source reference provenance
 */

import {
  assertCaseScope,
  buildMemoryStorageKeyPrefix,
  validateScopeIdentifier,
} from './caseIsolationGuard.js';
import { calculateShannonEntropy, inspectStringForPII } from '../piiLeakageGuardService.js';

export const MEMORY_SCOPE_SCHEMA_VERSION = '1.0.0';

export const MEMORY_SCOPE_MODES = {
  NO_MEMORY: 'no_memory',
  CASE_SCOPED_ALLOWLIST: 'case_scoped_allowlist',
};

export const MEMORY_ORIGINS = {
  CITIZEN_FACT: 'citizen_entered_fact',
  OFFICIAL_RECORD: 'official_record',
  AI_SUGGESTION: 'ai_community_suggestion',
};

export const DEFAULT_ALLOWLISTED_CATEGORIES = [
  'interaction_summary',
  'document_checklist',
  'verified_preference',
];

const SECRET_OR_SENSITIVE_KEY_REGEX =
  /^(aadhaar|pan|otp|password|passcode|pin|secret|token|api_?key|bearer|authorization|biometric|fingerprint|iris|phone|mobile|email|voter_?id)$/i;

const SECRET_VALUE_PATTERNS = [
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
];

/**
 * Inspects a payload for secrets, high-entropy tokens, and sensitive PII.
 */
export function detectSecretsOrSensitiveData(payload, path = 'memory') {
  const violations = [];

  function walk(node, currentPath) {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      const pii = inspectStringForPII(node);
      if (!pii.clean) {
        for (const v of pii.violations) {
          violations.push(`${currentPath}: sensitive PII detected (${v.type})`);
        }
      }
      for (const pat of SECRET_VALUE_PATTERNS) {
        if (pat.test(node)) {
          violations.push(`${currentPath}: secret/credential pattern excluded`);
        }
      }
      if (node.length >= 24 && !/\s/.test(node) && calculateShannonEntropy(node) > 4.6) {
        violations.push(`${currentPath}: high-entropy secret string excluded`);
      }
      if (/\b\d{6}\b/.test(node) && /otp/i.test(currentPath)) {
        violations.push(`${currentPath}: OTP value excluded`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${currentPath}[${i}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        if (SECRET_OR_SENSITIVE_KEY_REGEX.test(key.trim())) {
          violations.push(`${currentPath}.${key}: sensitive/secret field excluded`);
        }
        walk(val, `${currentPath}.${key}`);
      }
    }
  }

  walk(payload, path);
  return { clean: violations.length === 0, violations };
}

/**
 * Evaluates source reference provenance. Unknown/incomplete official sources are marked unverified.
 */
export function normalizeSourceReference(sourceRef = {}) {
  const required = ['source', 'jurisdiction', 'effectiveDate', 'lastVerifiedAt'];
  const missingFields = required.filter(
    (f) => typeof sourceRef?.[f] !== 'string' || sourceRef[f].trim().length === 0
  );
  const verified = missingFields.length === 0 && sourceRef?.verified !== false;
  return {
    source: typeof sourceRef?.source === 'string' && sourceRef.source.trim()
      ? sourceRef.source.trim().slice(0, 200)
      : 'Unverified / No source reference',
    jurisdiction: typeof sourceRef?.jurisdiction === 'string' && sourceRef.jurisdiction.trim()
      ? sourceRef.jurisdiction.trim().slice(0, 64)
      : 'UNSPECIFIED',
    effectiveDate: typeof sourceRef?.effectiveDate === 'string' ? sourceRef.effectiveDate.trim().slice(0, 40) : '',
    lastVerifiedAt: typeof sourceRef?.lastVerifiedAt === 'string' ? sourceRef.lastVerifiedAt.trim().slice(0, 64) : '',
    verified,
    status: verified ? 'verified' : 'unverified',
    missingFields,
  };
}

/**
 * Creates a strictly scoped memory entry after enforcing tenant/case scope and zero-secret/PII rules.
 */
export function createScopedMemoryEntry({
  tenantId,
  caseId,
  requestingTenantId = tenantId,
  requestingCaseId = caseId,
  origin = MEMORY_ORIGINS.CITIZEN_FACT,
  category = 'interaction_summary',
  content,
  sourceReference = {},
  ttlSeconds = 86400,
  nowMs = Date.now(),
}) {
  assertCaseScope(tenantId, caseId, requestingTenantId, requestingCaseId);

  if (!Object.values(MEMORY_ORIGINS).includes(origin)) {
    throw new Error(`Invalid memory origin '${origin}'.`);
  }
  if (typeof content !== 'string' || content.trim().length < 2) {
    throw new Error('Memory content must be a non-empty string.');
  }

  const secretCheck = detectSecretsOrSensitiveData({ category, content, sourceReference }, 'entry');
  if (!secretCheck.clean) {
    throw new Error(`Secret/sensitive data excluded: ${secretCheck.violations[0]}`);
  }

  const safeTtl = Math.max(60, Math.min(2592000, Number(ttlSeconds) || 86400));
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + safeTtl * 1000).toISOString();

  return {
    schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION,
    entryId: `mem-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    partitionKey: buildMemoryStorageKeyPrefix(tenantId, caseId),
    tenantId: validateScopeIdentifier(tenantId, 'tenantId'),
    caseId: validateScopeIdentifier(caseId, 'caseId'),
    origin,
    category: validateScopeIdentifier(category, 'category'),
    content: content.replace(/<[^>]*>/g, '').trim().slice(0, 1000),
    sourceReference: normalizeSourceReference(sourceReference),
    ttlSeconds: safeTtl,
    createdAt,
    expiresAt,
  };
}

/**
 * Retrieves context entries for a specific tenant + case partition.
 * - Deterministic no-memory mode: always returns [] with mode 'no_memory'.
 * - Strict cross-case isolation: filters out any entry whose tenantId/caseId does not match.
 * - Allowlisted retrieval: only returns categories present in allowlistedCategories.
 * - Expiry & secret exclusion: drops expired entries and any entry failing secret/PII scan.
 */
export function retrieveScopedContext({
  entries = [],
  tenantId,
  caseId,
  requestingTenantId = tenantId,
  requestingCaseId = caseId,
  mode = MEMORY_SCOPE_MODES.CASE_SCOPED_ALLOWLIST,
  allowlistedCategories = DEFAULT_ALLOWLISTED_CATEGORIES,
  nowMs = Date.now(),
}) {
  assertCaseScope(tenantId, caseId, requestingTenantId, requestingCaseId);

  if (mode === MEMORY_SCOPE_MODES.NO_MEMORY) {
    return {
      mode: MEMORY_SCOPE_MODES.NO_MEMORY,
      partitionKey: buildMemoryStorageKeyPrefix(tenantId, caseId),
      entries: [],
      excludedCount: entries.length,
      deterministicNoMemory: true,
    };
  }

  const allowSet = new Set(
    (Array.isArray(allowlistedCategories) ? allowlistedCategories : []).map((c) => String(c).trim())
  );

  const normTenant = validateScopeIdentifier(tenantId, 'tenantId');
  const normCase = validateScopeIdentifier(caseId, 'caseId');

  const safeEntries = [];
  let excludedCount = 0;

  for (const entry of entries) {
    if (!entry || entry.tenantId !== normTenant || entry.caseId !== normCase) {
      excludedCount += 1;
      continue;
    }
    if (!allowSet.has(entry.category)) {
      excludedCount += 1;
      continue;
    }
    if (entry.expiresAt && Date.parse(entry.expiresAt) <= nowMs) {
      excludedCount += 1;
      continue;
    }
    const scan = detectSecretsOrSensitiveData({ content: entry.content }, 'storedEntry');
    if (!scan.clean) {
      excludedCount += 1;
      continue;
    }
    safeEntries.push(entry);
  }

  return {
    mode: MEMORY_SCOPE_MODES.CASE_SCOPED_ALLOWLIST,
    partitionKey: buildMemoryStorageKeyPrefix(normTenant, normCase),
    entries: safeEntries,
    excludedCount,
    deterministicNoMemory: false,
  };
}

export function migrateMemoryScopeStoreState(rawState = {}) {
  const safe = rawState && typeof rawState === 'object' ? rawState : {};
  return {
    schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION,
    partitions: safe.partitions && typeof safe.partitions === 'object' ? safe.partitions : {},
    auditLog: Array.isArray(safe.auditLog) ? safe.auditLog : [],
  };
}
