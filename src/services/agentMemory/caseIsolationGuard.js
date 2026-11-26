/**
 * Case Isolation Guard & Scope Validator
 *
 * Enforces strict tenant- and case-level isolation boundaries.
 * Prevents path traversal, delimiter injection, and cross-case access.
 */

export class CaseBoundaryViolationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CaseBoundaryViolationError';
    this.code = 'BOUNDARY_VIOLATION';
    this.details = details;
  }
}

export class InvalidScopeIdentifierError extends Error {
  constructor(message, identifier) {
    super(message);
    this.name = 'InvalidScopeIdentifierError';
    this.code = 'INVALID_SCOPE_ID';
    this.identifier = identifier;
  }
}

const STORAGE_PREFIX = 'chsetu:mem';
const VALID_IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validates and normalizes an identifier (tenantId, caseId, or entryId)
 */
export const validateScopeIdentifier = (id, fieldName = 'identifier') => {
  if (typeof id !== 'string' || !id.trim()) {
    throw new InvalidScopeIdentifierError(`Missing or non-string ${fieldName}`, id);
  }
  const trimmed = id.trim();
  if (!VALID_IDENTIFIER_REGEX.test(trimmed)) {
    throw new InvalidScopeIdentifierError(
      `Invalid ${fieldName}: must be 1-64 alphanumeric, dash, or underscore characters without path traversal characters`,
      trimmed
    );
  }
  return trimmed;
};

/**
 * Asserts that requested tenant and case scope strictly match the target scope.
 * Throws CaseBoundaryViolationError on any mismatch.
 */
export const assertCaseScope = (targetTenantId, targetCaseId, requestedTenantId, requestedCaseId) => {
  const normTargetTenant = validateScopeIdentifier(targetTenantId, 'targetTenantId');
  const normTargetCase = validateScopeIdentifier(targetCaseId, 'targetCaseId');
  const normReqTenant = validateScopeIdentifier(requestedTenantId, 'requestedTenantId');
  const normReqCase = validateScopeIdentifier(requestedCaseId, 'requestedCaseId');

  if (normTargetTenant !== normReqTenant || normTargetCase !== normReqCase) {
    throw new CaseBoundaryViolationError(
      `Cross-case boundary violation: cannot access case '${normTargetTenant}:${normTargetCase}' from context '${normReqTenant}:${normReqCase}'`,
      {
        target: { tenantId: normTargetTenant, caseId: normTargetCase },
        requested: { tenantId: normReqTenant, caseId: normReqCase },
      }
    );
  }

  return true;
};

/**
 * Builds the storage key prefix for an isolated case:
 * chsetu:mem:<tenantId>:<caseId>:
 */
export const buildMemoryStorageKeyPrefix = (tenantId, caseId) => {
  const normTenant = validateScopeIdentifier(tenantId, 'tenantId');
  const normCase = validateScopeIdentifier(caseId, 'caseId');
  return `${STORAGE_PREFIX}:${normTenant}:${normCase}:`;
};

/**
 * Builds the full storage key for a memory entry:
 * chsetu:mem:<tenantId>:<caseId>:<entryId>
 */
export const buildMemoryStorageKey = (tenantId, caseId, entryId) => {
  const prefix = buildMemoryStorageKeyPrefix(tenantId, caseId);
  const normEntry = validateScopeIdentifier(entryId, 'entryId');
  return `${prefix}${normEntry}`;
};

/**
 * Parses a raw storage key into its constituent scope parts.
 * Returns null if the key is not a valid agent memory key.
 */
export const parseMemoryStorageKey = (key) => {
  if (typeof key !== 'string' || !key.startsWith(`${STORAGE_PREFIX}:`)) {
    return null;
  }
  const parts = key.split(':');
  // Expected parts: ['chsetu', 'mem', tenantId, caseId, entryId]
  if (parts.length !== 5 || parts[0] !== 'chsetu' || parts[1] !== 'mem') {
    return null;
  }
  try {
    const tenantId = validateScopeIdentifier(parts[2], 'tenantId');
    const caseId = validateScopeIdentifier(parts[3], 'caseId');
    const entryId = validateScopeIdentifier(parts[4], 'entryId');
    return { tenantId, caseId, entryId };
  } catch {
    return null;
  }
};
