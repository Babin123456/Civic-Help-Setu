/**
 * @file Tenant Context Service
 * 
 * Centralized tenant boundary management for state, district, municipality,
 * and department-owned datasets. Provides tenant resolution, validation,
 * and scoping utilities without duplicating the application stack.
 * 
 * Tenant Hierarchy:
 * - STATE (top-level, e.g., "IN-KA" for Karnataka)
 * - DISTRICT (e.g., "IN-KA-BLR" for Bengaluru Urban)
 * - MUNICIPALITY (e.g., "IN-KA-BLR-BBMP" for BBMP)
 * - DEPARTMENT (e.g., "IN-KA-BLR-BBMP-WATER" for Water Department)
 */

import { getCurrentActor, resolveActorJurisdictions } from './accessControl.js';

export const TenantLevel = Object.freeze({
  STATE: 'state',
  DISTRICT: 'district',
  MUNICIPALITY: 'municipality',
  DEPARTMENT: 'department',
});

export const TENANT_LEVEL_HIERARCHY = Object.freeze({
  [TenantLevel.STATE]: 0,
  [TenantLevel.DISTRICT]: 1,
  [TenantLevel.MUNICIPALITY]: 2,
  [TenantLevel.DEPARTMENT]: 3,
});

export const TENANT_LEVEL_LABELS = Object.freeze({
  [TenantLevel.STATE]: 'State',
  [TenantLevel.DISTRICT]: 'District',
  [TenantLevel.MUNICIPALITY]: 'Municipality',
  [TenantLevel.DEPARTMENT]: 'Department',
});

// Valid tenant ID pattern: ISO-like format with level prefix
// Examples: STATE:IN-KA, DISTRICT:IN-KA-BLR, MUNICIPALITY:IN-KA-BLR-BBMP, DEPARTMENT:IN-KA-BLR-BBMP-WATER
export const TENANT_ID_PATTERN = /^(STATE|DISTRICT|MUNICIPALITY|DEPARTMENT):[A-Z0-9-]+$/;

/**
 * Maps lowercase level to uppercase for external format
 */
const LEVEL_TO_UPPER = Object.freeze({
  [TenantLevel.STATE]: 'STATE',
  [TenantLevel.DISTRICT]: 'DISTRICT',
  [TenantLevel.MUNICIPALITY]: 'MUNICIPALITY',
  [TenantLevel.DEPARTMENT]: 'DEPARTMENT',
});

/**
 * Parses a tenant ID into its components
 * @param {string} tenantId - Tenant ID in format LEVEL:CODE
 * @returns {object|null} Parsed tenant info or null if invalid
 */
export function parseTenantId(tenantId) {
  if (!tenantId || typeof tenantId !== 'string') return null;
  
  // Case-insensitive match for level, but preserve original for fullId
  const match = tenantId.match(/^(STATE|DISTRICT|MUNICIPALITY|DEPARTMENT):(.+)$/i);
  if (!match) return null;
  
  const [, level, code] = match;
  return {
    level: level.toLowerCase(),
    code: code.toUpperCase(),
    fullId: tenantId,
  };
}

/**
 * Gets the uppercase level for external format (tenant IDs, scoped IDs)
 * @param {string} level - Lowercase level
 * @returns {string} Uppercase level
 */
function getUpperLevel(level) {
  return LEVEL_TO_UPPER[level] || level.toUpperCase();
}

/**
 * Validates a tenant ID format
 * @param {string} tenantId - Tenant ID to validate
 * @returns {boolean}
 */
export function isValidTenantId(tenantId) {
  return TENANT_ID_PATTERN.test(tenantId);
}

/**
 * Gets the parent tenant ID (one level up in hierarchy)
 * @param {string} tenantId - Child tenant ID
 * @returns {string|null} Parent tenant ID or null if at top level
 */
export function getParentTenantId(tenantId) {
  const parsed = parseTenantId(tenantId);
  if (!parsed) return null;
  
  const parts = parsed.code.split('-');
  if (parts.length <= 1) return null; // Already at top level (STATE)
  
  const parentCode = parts.slice(0, -1).join('-');
  let parentLevel;
  
  switch (parsed.level) {
    case TenantLevel.DISTRICT:
      parentLevel = TenantLevel.STATE;
      break;
    case TenantLevel.MUNICIPALITY:
      parentLevel = TenantLevel.DISTRICT;
      break;
    case TenantLevel.DEPARTMENT:
      parentLevel = TenantLevel.MUNICIPALITY;
      break;
    default:
      return null;
  }
  
  return `${getUpperLevel(parentLevel)}:${parentCode}`;
}

/**
 * Gets all ancestor tenant IDs up to the state level
 * @param {string} tenantId - Starting tenant ID
 * @returns {string[]} Array of ancestor tenant IDs from immediate parent to state
 */
export function getAncestorTenantIds(tenantId) {
  const ancestors = [];
  let current = getParentTenantId(tenantId);
  while (current) {
    ancestors.push(current);
    current = getParentTenantId(current);
  }
  return ancestors;
}

/**
 * Alias for getAncestorTenantIds
 * @param {string} tenantId - Starting tenant ID
 * @returns {string[]} Array of ancestor tenant IDs
 */
export function getTenantAncestors(tenantId) {
  return getAncestorTenantIds(tenantId);
}

/**
 * Normalizes a tenant ID to canonical UPPERCASE_LEVEL:UPPERCASE_CODE form for comparison
 * @param {string} tenantId
 * @returns {string|null}
 */
function normalizeTenantId(tenantId) {
  const parsed = parseTenantId(tenantId);
  if (!parsed) return null;
  return `${getUpperLevel(parsed.level)}:${parsed.code}`;
}

/**
 * Checks if tenant A is a descendant of tenant B
 * @param {string} descendantId - Potential descendant tenant ID
 * @param {string} ancestorId - Potential ancestor tenant ID
 * @returns {boolean}
 */
export function isDescendantOf(descendantId, ancestorId) {
  const normalizedAncestor = normalizeTenantId(ancestorId);
  if (!normalizedAncestor) return false;
  const ancestors = getAncestorTenantIds(descendantId);
  return ancestors.includes(normalizedAncestor);
}

/**
 * Creates a normalized tenant context object from explicit parameters.
 * Fails closed if an invalid tenantId is supplied.
 * @param {object} [params]
 * @param {string|null} [params.tenantId]
 * @param {string[]} [params.assignedJurisdictions]
 * @param {string|null} [params.role]
 * @param {string|null} [params.actorId]
 * @param {boolean} [params.isSystem]
 * @returns {object}
 */
export function createTenantContext({
  tenantId = null,
  assignedJurisdictions = [],
  role = null,
  actorId = null,
  isSystem = false,
} = {}) {
  const jurisdictions = Array.isArray(assignedJurisdictions) ? [...assignedJurisdictions] : [];

  if (!tenantId) {
    return {
      tenantId: null,
      level: null,
      code: null,
      assignedJurisdictions: jurisdictions,
      role,
      actorId,
      isSystem: Boolean(isSystem || role === 'super_admin'),
    };
  }

  const parsed = parseTenantId(tenantId);
  if (!parsed) {
    throw new Error(`TENANT_ID_INVALID: Invalid tenant ID "${tenantId}"`);
  }

  return {
    tenantId,
    level: parsed.level,
    code: parsed.code,
    assignedJurisdictions: jurisdictions,
    role,
    actorId,
    isSystem: Boolean(isSystem || role === 'super_admin'),
  };
}

/**
 * Returns all tenant IDs readable by the given tenant context.
 * @param {object} context - Tenant context
 * @returns {string[]}
 */
export function getReadableTenantIds(context) {
  if (!context || typeof context !== 'object') return [];
  const seen = new Set();
  const ids = [];

  if (context.tenantId) {
    seen.add(context.tenantId);
    ids.push(context.tenantId);
  }

  if (Array.isArray(context.assignedJurisdictions)) {
    for (const j of context.assignedJurisdictions) {
      if (j && !seen.has(j)) {
        seen.add(j);
        ids.push(j);
      }
    }
  }

  return ids;
}

/**
 * Non-throwing tenant access check returning { allowed, reason }.
 * Fails closed on missing or invalid context/target.
 * @param {object} context - Tenant context or actor
 * @param {string} targetTenantId - Target tenant ID
 * @returns {{ allowed: boolean, reason: string }}
 */
export function checkTenantAccess(context, targetTenantId) {
  if (!context || typeof context !== 'object' || !targetTenantId) {
    return { allowed: false, reason: 'MISSING_CONTEXT' };
  }

  if (context.isSystem || context.role === 'super_admin') {
    return { allowed: true, reason: 'SYSTEM_ACCESS' };
  }

  const targetNorm = normalizeTenantId(targetTenantId);
  if (!targetNorm) {
    return { allowed: false, reason: 'INVALID_TARGET_TENANT' };
  }

  const actorNorm = context.tenantId ? normalizeTenantId(context.tenantId) : null;
  const isAdminRole = typeof context.role === 'string' && context.role.toLowerCase().includes('admin');

  if (actorNorm && actorNorm === targetNorm) {
    return { allowed: true, reason: 'EXACT_TENANT_MATCH' };
  }

  if (actorNorm && isDescendantOf(targetNorm, actorNorm)) {
    return {
      allowed: true,
      reason: isAdminRole ? 'ADMIN_DESCENDANT_ACCESS' : 'DESCENDANT_ACCESS',
    };
  }

  const jurisdictions = Array.isArray(context.assignedJurisdictions)
    ? context.assignedJurisdictions
    : typeof resolveActorJurisdictions === 'function'
      ? resolveActorJurisdictions(context)
      : Array.isArray(context.jurisdictionIds)
        ? context.jurisdictionIds
        : [];

  for (const j of jurisdictions) {
    const jNorm = normalizeTenantId(j);
    if (!jNorm) continue;
    if (jNorm === targetNorm || isDescendantOf(targetNorm, jNorm)) {
      return { allowed: true, reason: 'ASSIGNED_JURISDICTION_ACCESS' };
    }
  }

  return { allowed: false, reason: 'CROSS_TENANT_DENIED' };
}

/**
 * Attaches tenant partition metadata to a document before persistence.
 * @param {object} doc - Document payload
 * @param {object} context - Tenant context
 * @returns {object}
 */
export function partitionDocument(doc, context) {
  if (!context || !context.tenantId) {
    throw new Error('TENANT_CONTEXT_REQUIRED: Cannot partition document without tenantId');
  }
  return {
    ...doc,
    tenantId: context.tenantId,
    _tenantLevel: context.level || parseTenantId(context.tenantId)?.level || null,
  };
}

/**
 * Strips internal tenant partition metadata from a document for API responses.
 * @param {object} doc - Stored document
 * @returns {object}
 */
export function departitionDocument(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const copy = { ...doc };
  delete copy._tenantLevel;
  delete copy._tenantCreatedAt;
  delete copy._tenantUpdatedAt;
  return copy;
}

const FIRESTORE_IN_LIMIT = 10;

/**
 * Builds bounded Firestore where constraints for a tenant context.
 * Caps 'in' queries at Firestore's 10-value limit.
 * @param {object} context - Tenant context
 * @returns {Array<{field: string, op: string, value: any}>}
 */
export function buildTenantQueryConstraints(context) {
  if (!context || (!context.tenantId && !context.isSystem)) {
    throw new Error('TENANT_CONTEXT_REQUIRED: Cannot build query constraints without tenant context');
  }
  if (context.isSystem) return [];

  const readable = getReadableTenantIds(context);
  if (Array.isArray(context.assignedJurisdictions) && context.assignedJurisdictions.length > 0) {
    return [{ field: 'tenantId', op: 'in', value: readable.slice(0, FIRESTORE_IN_LIMIT) }];
  }

  return [{ field: 'tenantId', op: '==', value: context.tenantId }];
}

/**
 * Resolves the tenant context for the current actor
 * Uses the authenticated user's jurisdiction assignments
 * @param {object} [actor] - Actor context (defaults to current actor)
 * @returns {object} Tenant context with resolved tenantId and level
 */
export function resolveTenantContext(actor = getCurrentActor()) {
  if (!actor || typeof actor !== 'object') {
    return { tenantId: null, level: null, isSystem: true };
  }
  
  // Check for explicit tenant assignment in actor context
  if (actor.tenantId && isValidTenantId(actor.tenantId)) {
    const parsed = parseTenantId(actor.tenantId);
    return {
      tenantId: actor.tenantId,
      level: parsed.level,
      code: parsed.code,
      isSystem: false,
    };
  }
  
  // Fall back to jurisdiction-based resolution
  const jurisdictions =
    typeof resolveActorJurisdictions === 'function'
      ? resolveActorJurisdictions(actor)
      : Array.isArray(actor.jurisdictionIds)
        ? actor.jurisdictionIds
        : [];
  if (jurisdictions.length > 0) {
    // Use the most specific (deepest) jurisdiction as tenant
    const sorted = jurisdictions.sort((a, b) => {
      const levelA = parseTenantId(a)?.level || '';
      const levelB = parseTenantId(b)?.level || '';
      return (TENANT_LEVEL_HIERARCHY[levelB] || 0) - (TENANT_LEVEL_HIERARCHY[levelA] || 0);
    });
    
    const parsed = parseTenantId(sorted[0]);
    return {
      tenantId: sorted[0],
      level: parsed.level,
      code: parsed.code,
      isSystem: false,
    };
  }
  
  // System-level access (admin with no specific jurisdiction)
  return { tenantId: null, level: null, isSystem: true };
}

/**
 * Creates a tenant-scoped query filter for Firestore
 * @param {string} tenantId - Tenant ID to scope to
 * @param {object} [options] - Options
 * @param {boolean} [options.includeDescendants=true] - Whether to include descendant tenants
 * @returns {object} Firestore where clause compatible filter
 */
export function createTenantFilter(tenantId, { includeDescendants = true } = {}) {
  if (!tenantId) return null;
  
  if (includeDescendants) {
    // For descendant inclusion, we use prefix matching on the code portion
    const parsed = parseTenantId(tenantId);
    if (!parsed) return { tenantId };
    
    const prefix = `${parsed.level}:${parsed.code}`;
    return {
      tenantId: { $prefix: prefix } // This would need Firestore adapter
    };
  }
  
  return { tenantId };
}

/**
 * Validates that an actor can access a given tenant's data
 * @param {object} actor - Actor context
 * @param {string} targetTenantId - Tenant ID being accessed
 * @param {object} [options] - Options
 * @param {boolean} [options.allowSystemAccess=true] - Allow system-level actors
 * @throws {Error} If access is denied
 */
export function assertTenantAccess(actor, targetTenantId, { allowSystemAccess = true } = {}) {
  if (!targetTenantId) {
    throw new Error('Target tenant ID is required for access check');
  }
  
  const context = resolveTenantContext(actor);
  
  // System-level actors (admins with no specific jurisdiction) can access all
  if (context.isSystem && allowSystemAccess) {
    return true;
  }
  
  // Exact match
  if (context.tenantId === targetTenantId) {
    return true;
  }
  
  // Check if actor's tenant is an ancestor of target (allow access to descendants)
  if (context.tenantId && isDescendantOf(targetTenantId, context.tenantId)) {
    return true;
  }
  
  // Check assigned jurisdictions
  const jurisdictions =
    typeof resolveActorJurisdictions === 'function'
      ? resolveActorJurisdictions(actor)
      : Array.isArray(actor.jurisdictionIds)
        ? actor.jurisdictionIds
        : [];
  if (jurisdictions.includes(targetTenantId)) {
    return true;
  }
  
  // Check if any assigned jurisdiction is an ancestor of target
  for (const jurisdiction of jurisdictions) {
    if (isDescendantOf(targetTenantId, jurisdiction)) {
      return true;
    }
  }
  
  throw new Error(`TENANT_ACCESS_DENIED: Actor cannot access tenant ${targetTenantId}`);
}

/**
 * Creates a tenant-scoped document ID by prefixing with tenant code
 * @param {string} tenantId - Tenant ID
 * @param {string} localId - Local document ID
 * @returns {string} Globally unique tenant-scoped document ID
 */
export function createTenantScopedId(tenantId, localId) {
  const parsed = parseTenantId(tenantId);
  if (!parsed) throw new Error('Invalid tenant ID');
  return `${getUpperLevel(parsed.level)}_${parsed.code}_${localId}`;
}

/**
 * Extracts tenant ID from a tenant-scoped document ID
 * @param {string} scopedId - Tenant-scoped document ID
 * @returns {string|null} Tenant ID or null if not a scoped ID
 */
export function extractTenantIdFromScopedId(scopedId) {
  const match = scopedId.match(/^(STATE|DISTRICT|MUNICIPALITY|DEPARTMENT)_([A-Z0-9-]+)_(.+)$/);
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

export default {
  TenantLevel,
  TENANT_LEVEL_HIERARCHY,
  TENANT_LEVEL_LABELS,
  parseTenantId,
  isValidTenantId,
  getParentTenantId,
  getAncestorTenantIds,
  getTenantAncestors,
  isDescendantOf,
  createTenantContext,
  getReadableTenantIds,
  checkTenantAccess,
  partitionDocument,
  departitionDocument,
  buildTenantQueryConstraints,
  resolveTenantContext,
  createTenantFilter,
  assertTenantAccess,
  createTenantScopedId,
  extractTenantIdFromScopedId,
};