/**
 * @file serverAuthorizationPolicyService.js
 * @description Centralized server-side authorization and role-based access control (RBAC/ABAC) policy service.
 * Enforces deny-by-default, strict tenant/jurisdiction isolation, object-level ownership checks (IDOR mitigation),
 * and security audit logging.
 */

export class AuthorizationError extends Error {
  constructor(message, code = 'ACCESS_DENIED', details = {}) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.details = details;
  }
}

export const CivicRole = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  STATE_ADMIN: 'state_admin',
  WARD_OFFICER: 'ward_officer',
  VERIFIER: 'verifier',
  CITIZEN: 'citizen',
  ANONYMOUS: 'anonymous'
});

export const CivicAction = Object.freeze({
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT_AUDIT: 'export_audit'
});

export class ServerAuthorizationPolicyService {
  constructor(options = {}) {
    this.auditLogs = [];
    this.maxAuditLogs = options.maxAuditLogs || 1000;
  }

  /**
   * Evaluates if a given user principal is authorized to perform action on resource.
   * Deny-by-default architecture.
   */
  evaluate({ principal, action, resourceType, resource = null, context = {} }) {
    if (!principal || !principal.id || !principal.role) {
      this.recordAudit({
        allowed: false,
        reason: 'UNAUTHENTICATED_PRINCIPAL',
        principalId: principal?.id || 'unknown',
        action,
        resourceType
      });
      return {
        allowed: false,
        code: 'UNAUTHENTICATED',
        reason: 'Valid authenticated principal context required'
      };
    }

    // 1. Super Admin bypasses jurisdiction/ownership checks with explicit logging
    if (principal.role === CivicRole.SUPER_ADMIN) {
      this.recordAudit({
        allowed: true,
        reason: 'SUPER_ADMIN_OVERRIDE',
        principalId: principal.id,
        action,
        resourceType,
        resourceId: resource?.id
      });
      return { allowed: true, code: 'AUTHORIZED_SUPER_ADMIN' };
    }

    // 2. Deny anonymous access to privileged actions
    if (principal.role === CivicRole.ANONYMOUS && action !== CivicAction.VIEW) {
      this.recordAudit({
        allowed: false,
        reason: 'ANONYMOUS_PRIVILEGED_ACTION_BLOCKED',
        principalId: principal.id,
        action,
        resourceType
      });
      return {
        allowed: false,
        code: 'ANONYMOUS_FORBIDDEN',
        reason: 'Anonymous users cannot perform mutating or privileged actions'
      };
    }

    // 3. Citizen Object Ownership Verification (IDOR Protection)
    if (principal.role === CivicRole.CITIZEN) {
      // Citizen cannot access administrative audit or approval endpoints
      if ([CivicAction.APPROVE, CivicAction.EXPORT_AUDIT].includes(action)) {
        this.recordAudit({
          allowed: false,
          reason: 'ROLE_ACTION_UNAUTHORIZED',
          principalId: principal.id,
          action,
          resourceType
        });
        return {
          allowed: false,
          code: 'ROLE_FORBIDDEN',
          reason: 'Citizens lack permission for administrative operations'
        };
      }

      // If a specific resource is referenced, citizen MUST be the verified owner
      if (resource && resource.ownerId && resource.ownerId !== principal.id) {
        this.recordAudit({
          allowed: false,
          reason: 'IDOR_OWNERSHIP_MISMATCH',
          principalId: principal.id,
          action,
          resourceType,
          resourceId: resource.id,
          expectedOwner: resource.ownerId
        });
        return {
          allowed: false,
          code: 'IDOR_PREVENTED',
          reason: 'Object-level ownership check failed. Access denied to foreign record.'
        };
      }

      this.recordAudit({
        allowed: true,
        reason: 'CITIZEN_OWNER_AUTHORIZED',
        principalId: principal.id,
        action,
        resourceType,
        resourceId: resource?.id
      });
      return { allowed: true, code: 'AUTHORIZED_CITIZEN_OWNER' };
    }

    // 4. Ward Officer & Verifier Jurisdiction / Tenant Scoping
    if ([CivicRole.WARD_OFFICER, CivicRole.VERIFIER, CivicRole.STATE_ADMIN].includes(principal.role)) {
      if (resource && resource.jurisdictionId) {
        const allowedJurisdictions = principal.jurisdictions || [];
        if (!allowedJurisdictions.includes('*') && !allowedJurisdictions.includes(resource.jurisdictionId)) {
          this.recordAudit({
            allowed: false,
            reason: 'JURISDICTION_TENANT_VIOLATION',
            principalId: principal.id,
            action,
            resourceType,
            resourceJurisdiction: resource.jurisdictionId,
            userJurisdictions: allowedJurisdictions
          });
          return {
            allowed: false,
            code: 'TENANT_MISMATCH',
            reason: `Access restricted: Principal not authorized for jurisdiction ${resource.jurisdictionId}`
          };
        }
      }

      this.recordAudit({
        allowed: true,
        reason: 'STAFF_JURISDICTION_AUTHORIZED',
        principalId: principal.id,
        action,
        resourceType,
        resourceId: resource?.id
      });
      return { allowed: true, code: 'AUTHORIZED_STAFF' };
    }

    // Default Fallthrough: DENY
    this.recordAudit({
      allowed: false,
      reason: 'DEFAULT_DENY_FALLTHROUGH',
      principalId: principal.id,
      action,
      resourceType
    });
    return {
      allowed: false,
      code: 'DEFAULT_DENY',
      reason: 'No explicit permit rule matched request'
    };
  }

  /**
   * Middleware / Guard function that throws AuthorizationError on denial
   */
  assertAuthorized(params) {
    const outcome = this.evaluate(params);
    if (!outcome.allowed) {
      throw new AuthorizationError(outcome.reason, outcome.code, {
        principalId: params.principal?.id,
        action: params.action,
        resourceType: params.resourceType
      });
    }
    return true;
  }

  recordAudit(entry) {
    this.auditLogs.unshift({
      id: `sec_aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry
    });

    if (this.auditLogs.length > this.maxAuditLogs) {
      this.auditLogs.pop();
    }
  }

  getAuditLogs(filter = {}) {
    return this.auditLogs.filter(log => {
      if (filter.principalId && log.principalId !== filter.principalId) return false;
      if (filter.allowed !== undefined && log.allowed !== filter.allowed) return false;
      if (filter.reason && log.reason !== filter.reason) return false;
      return true;
    });
  }

  clearAuditLogs() {
    this.auditLogs = [];
  }
}

export const defaultAuthorizationService = new ServerAuthorizationPolicyService();
