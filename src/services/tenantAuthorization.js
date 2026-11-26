/**
 * @file Tenant Authorization Middleware
 * 
 * Extends the existing serverAuthorizationPolicyService with tenant-scoped
 * authorization checks that fail closed. Provides middleware for API handlers
 * and service-layer guards.
 */

import { defaultAuthorizationService, CivicAction } from './serverAuthorizationPolicyService.js';
import { getTenantFeatureFlags, tenantMetrics } from './tenantRuntime.js';
import {
  assertTenantAccess,
  parseTenantId,
  isDescendantOf,
  createTenantScopedId,
} from './tenantContext.js';

export const TenantAuthorizationErrorCode = Object.freeze({
  TENANT_CONTEXT_REQUIRED: 'TENANT_CONTEXT_REQUIRED',
  TENANT_ACCESS_DENIED: 'TENANT_ACCESS_DENIED',
  TENANT_ID_INVALID: 'TENANT_ID_INVALID',
  TENANT_ID_IMMUTABLE: 'TENANT_ID_IMMUTABLE',
  CROSS_TENANT_LEAK: 'CROSS_TENANT_LEAK',
  TENANT_SCOPE_VIOLATION: 'TENANT_SCOPE_VIOLATION',
});

export class TenantAuthorizationError extends Error {
  constructor(message, code = TenantAuthorizationErrorCode.TENANT_ACCESS_DENIED, details = {}) {
    super(message);
    this.name = 'TenantAuthorizationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Evaluates tenant authorization for a principal and resource
 * @param {object} params - Authorization parameters
 * @param {object} params.principal - User principal (from auth)
 * @param {string} params.action - Action being performed
 * @param {string} params.resourceType - Resource type
 * @param {object} [params.resource] - Resource being accessed
 * @param {string} [params.tenantId] - Explicit tenant ID (overrides resource)
 * @returns {Promise<object>} Authorization result
 */
export async function evaluateTenantAuthorization({
  principal,
  action,
  resourceType,
  resource = null,
  tenantId,
}) {
  const startMs = performance.now();
  const flags = getTenantFeatureFlags();
  const record = (result) => {
    tenantMetrics.recordAuthOutcome({
      allowed: result.allowed,
      code: result.code,
      durationMs: performance.now() - startMs,
    });
    return result;
  };

  // First, run base authorization
  const baseAuth = defaultAuthorizationService.evaluate({
    principal,
    action,
    resourceType,
    resource,
  });
  
  if (!baseAuth.allowed) {
    return record(baseAuth);
  }

  if (!flags.isolationEnabled) {
    console.warn('[TENANT_AUTH] TENANT_ISOLATION_ENABLED=false; bypassing tenant boundary checks');
    return record({
      allowed: true,
      code: 'TENANT_ISOLATION_BYPASSED',
      tenantId: tenantId || null,
    });
  }
  
  // Determine target tenant ID
  let targetTenantId = tenantId;
  
  if (!targetTenantId && resource) {
    targetTenantId = resource.tenantId || resource.jurisdictionId;
  }
  
  if (!targetTenantId && principal) {
    // Try to extract from principal's jurisdiction
    const jurisdictions = principal.jurisdictionIds || 
                         (principal.raw?.publicMetadata?.jurisdictionIds || []);
    if (jurisdictions.length === 1) {
      targetTenantId = jurisdictions[0];
    }
  }
  
  if (!targetTenantId) {
    // No tenant context - allow for system-level resources or deny for tenant-scoped
    if (['auditLogs', 'systemConfig', 'globalSettings'].includes(resourceType)) {
      return { allowed: true, code: 'AUTHORIZED_SYSTEM_RESOURCE' };
    }
    return {
      allowed: false,
      code: TenantAuthorizationErrorCode.TENANT_CONTEXT_REQUIRED,
      reason: 'Tenant context required for this resource type',
    };
  }
  
  // Validate tenant ID format
  if (!parseTenantId(targetTenantId)) {
    return {
      allowed: false,
      code: TenantAuthorizationErrorCode.TENANT_ID_INVALID,
      reason: `Invalid tenant ID format: ${targetTenantId}`,
    };
  }
  
  // Check tenant access
  try {
    assertTenantAccess(principal, targetTenantId);
  } catch (error) {
    return record({
      allowed: false,
      code: TenantAuthorizationErrorCode.TENANT_ACCESS_DENIED,
      reason: error.message,
      details: { targetTenantId, principalId: principal?.id },
    });
  }
  
  // Additional resource-specific checks
  if (resource && resource.tenantId) {
    if (resource.tenantId !== targetTenantId) {
      return record({
        allowed: false,
        code: TenantAuthorizationErrorCode.CROSS_TENANT_LEAK,
        reason: 'Resource tenantId does not match requested tenant',
        details: { resourceTenantId: resource.tenantId, requestedTenantId: targetTenantId },
      });
    }
  }
  
  // Check for cross-tenant data leaks in response
  if (resource && action === CivicAction.VIEW) {
    // For list operations, ensure we're not leaking cross-tenant data
    if (Array.isArray(resource)) {
      const leaks = resource.filter(r => r.tenantId && r.tenantId !== targetTenantId);
      if (leaks.length > 0) {
        return record({
          allowed: false,
          code: TenantAuthorizationErrorCode.CROSS_TENANT_LEAK,
          reason: `Response contains ${leaks.length} cross-tenant records`,
          details: { leakedCount: leaks.length },
        });
      }
    }
  }
  
  return record({
    allowed: true,
    code: 'AUTHORIZED_TENANT_SCOPED',
    tenantId: targetTenantId,
  });
}

/**
 * Asserts tenant authorization, throwing on denial
 * @param {object} params - Same as evaluateTenantAuthorization
 * @returns {Promise<string>} Tenant ID if authorized
 * @throws {TenantAuthorizationError}
 */
export async function assertTenantAuthorization(params) {
  const result = await evaluateTenantAuthorization(params);
  if (!result.allowed) {
    throw new TenantAuthorizationError(result.reason, result.code, result.details);
  }
  return result.tenantId;
}

/**
 * Creates a middleware function for API handlers
 * @param {object} options - Middleware options
 * @param {string} [options.resourceType] - Resource type for authorization
 * @param {Function} [options.getTenantId] - Function to extract tenantId from request
 * @returns {Function} Middleware function
 */
export function createTenantAuthMiddleware({ resourceType, getTenantId } = {}) {
  return async function tenantAuthMiddleware(req, res, next) {
    try {
      // Extract principal from request (assumes auth middleware ran first)
      const principal = req.auth?.user || req.user || req.principal;
      
      if (!principal) {
        return res.status(401).json({
          error: 'Unauthorized',
          code: 'UNAUTHENTICATED',
        });
      }
      
      // Get tenant ID from request or resource
      const tenantId = getTenantId ? getTenantId(req) : 
                       (req.params?.tenantId || req.query?.tenantId || req.body?.tenantId);
      
      // Evaluate authorization
      const result = await evaluateTenantAuthorization({
        principal,
        action: req.method === 'GET' ? 'VIEW' : 
                req.method === 'POST' ? 'CREATE' :
                req.method === 'PUT' || req.method === 'PATCH' ? 'UPDATE' : 'DELETE',
        resourceType: resourceType || req.resourceType || 'unknown',
        resource: req.resource || null,
        tenantId,
      });
      
      if (!result.allowed) {
        return res.status(403).json({
          error: 'Forbidden',
          code: result.code,
          message: result.reason,
          details: result.details,
        });
      }
      
      // Attach tenant context to request
      req.tenantContext = {
        tenantId: result.tenantId,
        authorized: true,
      };
      
      next();
    } catch (error) {
      if (error instanceof TenantAuthorizationError) {
        return res.status(403).json({
          error: 'Forbidden',
          code: error.code,
          message: error.message,
          details: error.details,
        });
      }
      
      console.error('Tenant auth middleware error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        code: 'TENANT_AUTH_ERROR',
      });
    }
  };
}

/**
 * Service-layer guard for tenant-scoped operations
 * Use this in service functions before database operations
 * @param {object} params - Guard parameters
 * @param {object} params.actor - Actor context
 * @param {string} params.operation - Operation name (for logging)
 * @param {string} params.targetTenantId - Tenant ID being accessed
 * @param {string} [params.resourceType] - Resource type
 * @returns {Promise<string>} Tenant ID if authorized
 */
export async function guardTenantOperation({ actor, operation, targetTenantId, resourceType }) {
  // Log operation attempt
  console.log(`[TENANT_GUARD] ${operation} | actor: ${actor?.id} | tenant: ${targetTenantId} | resource: ${resourceType}`);
  
  const result = await evaluateTenantAuthorization({
    principal: actor,
    action: operation.toUpperCase(),
    resourceType: resourceType || 'data',
    tenantId: targetTenantId,
  });
  
  if (!result.allowed) {
    console.warn(`[TENANT_GUARD] DENIED | ${operation} | ${result.code} | ${result.reason}`);
    throw new TenantAuthorizationError(result.reason, result.code, result.details);
  }
  
  console.log(`[TENANT_GUARD] ALLOWED | ${operation} | tenant: ${result.tenantId}`);
  return result.tenantId;
}

/**
 * Filters response data to prevent cross-tenant leaks
 * @param {Array|object} data - Response data
 * @param {string} authorizedTenantId - Tenant ID actor is authorized for
 * @param {boolean} [allowSystemView=false] - Allow system actors to see all
 * @returns {Array|object} Filtered data
 */
export function filterTenantResponse(data, authorizedTenantId, allowSystemView = false) {
  if (!data) return data;
  
  // System view bypasses filtering
  if (allowSystemView && !authorizedTenantId) {
    return data;
  }
  
  const filterItem = (item) => {
    if (!item || typeof item !== 'object') return true;
    if (!item.tenantId) return true; // Non-tenant-scoped data
    return item.tenantId === authorizedTenantId;
  };
  
  if (Array.isArray(data)) {
    return data.filter(filterItem);
  }
  
  return filterItem(data) ? data : null;
}

/**
 * Creates a tenant-scoped audit log entry
 * @param {object} params - Audit parameters
 * @returns {object} Audit log entry
 */
export function createTenantAuditEntry({
  actor,
  action,
  resourceType,
  resourceId,
  tenantId,
  outcome,
  details = {},
}) {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    actorId: actor?.id,
    actorRole: actor?.role,
    action,
    resourceType,
    resourceId,
    tenantId,
    outcome, // 'allowed' | 'denied'
    details,
    _schemaVersion: '1.0.0',
  };
}

export default {
  TenantAuthorizationErrorCode,
  TenantAuthorizationError,
  evaluateTenantAuthorization,
  assertTenantAuthorization,
  createTenantAuthMiddleware,
  guardTenantOperation,
  filterTenantResponse,
  createTenantAuditEntry,
  parseTenantId: parseTenantId,
  isDescendantOf,
  createTenantScopedId,
};