import crypto from 'node:crypto';

export const DECISION_EFFECT = Object.freeze({
  PERMIT: 'PERMIT',
  DENY: 'DENY'
});

export class CentralizedAuthorizationPdpService {
  constructor(config = {}) {
    this.cacheTtlMs = config.cacheTtlMs || 60000; // 1 min TTL
    this.policies = new Map();
    this.decisionCache = new Map();
  }

  registerPolicy(policy) {
    const { id, role, action, resource, condition, effect = DECISION_EFFECT.PERMIT } = policy;
    const policyId = id || `POL-${crypto.randomBytes(4).toString('hex')}`;
    this.policies.set(policyId, {
      id: policyId,
      role,
      action,
      resource,
      condition: condition || (() => true),
      effect
    });

    // Invalidate stale cached decisions
    this.decisionCache.clear();
    return policyId;
  }

  evaluateAccess(request = {}) {
    const { actorRole, action, resource, actorJurisdiction, resourceJurisdiction } = request;
    const cacheKey = `${actorRole}:${action}:${resource}:${actorJurisdiction || ''}:${resourceJurisdiction || ''}`;

    const cached = this.decisionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTtlMs)) {
      return { ...cached.decision, fromCache: true };
    }

    // Default Deny Precedence
    let hasPermit = false;
    let explicitDenyReason = null;

    for (const pol of this.policies.values()) {
      if (pol.role === actorRole || pol.role === '*') {
        if (pol.action === action || pol.action === '*') {
          if (pol.resource === resource || pol.resource === '*') {
            // Negative Cross-Tenant Check: Jurisdiction Mismatch
            if (actorJurisdiction && resourceJurisdiction && actorJurisdiction !== resourceJurisdiction) {
              explicitDenyReason = 'Cross-jurisdiction access forbidden.';
              break;
            }

            if (pol.effect === DECISION_EFFECT.DENY) {
              explicitDenyReason = 'Explicit deny rule matched.';
              break;
            }

            if (pol.effect === DECISION_EFFECT.PERMIT) {
              hasPermit = true;
            }
          }
        }
      }
    }

    const decision = {
      effect: (!explicitDenyReason && hasPermit) ? DECISION_EFFECT.PERMIT : DECISION_EFFECT.DENY,
      reason: explicitDenyReason || (hasPermit ? 'Authorized by policy.' : 'Default deny: No matching permit policy.')
    };

    this.decisionCache.set(cacheKey, {
      timestamp: Date.now(),
      decision
    });

    return { ...decision, fromCache: false };
  }
}
