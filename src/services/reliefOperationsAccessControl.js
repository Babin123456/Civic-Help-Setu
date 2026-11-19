/**
 * Least-privilege authorisation for the Relief Operations Workspace (#747).
 *
 * Roles are resolved from the authenticated actor only. Callers never pass
 * their own role into a data mutation, so a stale tab or console call is still
 * refused. Jurisdiction scoping keeps operators inside their assigned area;
 * admins without an explicit jurisdiction restriction may work across all.
 */

import { getCurrentActor } from './accessControl';
import {
  RELIEF_ROLES,
  RELIEF_STAFF_ROLES,
  RELIEF_CAPABILITIES,
  RELIEF_ERROR_CODES,
} from './reliefOperationsConstants';
import { ReliefServiceError } from './reliefOperationsValidation';

export const resolveReliefRole = (actor = getCurrentActor()) => {
  if (!actor || typeof actor !== 'object') return RELIEF_ROLES.PUBLIC;

  const metadata = actor.raw?.publicMetadata || {};
  const claimed = actor.reliefRole || metadata.reliefRole || actor.role;

  if (actor.role === 'admin' || claimed === RELIEF_ROLES.ADMIN) {
    if (claimed && Object.values(RELIEF_ROLES).includes(claimed)) return claimed;
    return RELIEF_ROLES.ADMIN;
  }

  if (Object.values(RELIEF_ROLES).includes(claimed)) {
    return claimed;
  }

  return RELIEF_ROLES.CITIZEN;
};

export const resolveActorJurisdictions = (actor = getCurrentActor()) => {
  if (!actor || typeof actor !== 'object') return [];
  const metadata = actor.raw?.publicMetadata || {};
  const candidates = [
    actor.jurisdictionId,
    actor.jurisdiction,
    metadata.jurisdictionId,
    metadata.jurisdiction,
    ...(Array.isArray(actor.jurisdictionIds) ? actor.jurisdictionIds : []),
    ...(Array.isArray(metadata.jurisdictionIds) ? metadata.jurisdictionIds : []),
  ];
  return [
    ...new Set(
      candidates
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim().toUpperCase())
    ),
  ];
};

export const isReliefStaff = (actor = getCurrentActor()) =>
  RELIEF_STAFF_ROLES.includes(resolveReliefRole(actor));

export const actorHasAllReliefJurisdictions = (actor = getCurrentActor()) =>
  resolveReliefRole(actor) === RELIEF_ROLES.ADMIN && resolveActorJurisdictions(actor).length === 0;

export const canRelief = (capability, actor = getCurrentActor(), { allowAnonymous = false } = {}) => {
  const rule = RELIEF_CAPABILITIES[capability];
  if (!rule) return false;
  const role = resolveReliefRole(actor);
  if (!actor && !allowAnonymous && role === RELIEF_ROLES.PUBLIC) return false;
  return rule.roles.includes(role);
};

export const assertReliefCapability = (
  capability,
  actor = getCurrentActor(),
  { allowAnonymous = false } = {}
) => {
  const rule = RELIEF_CAPABILITIES[capability];
  if (!rule) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.PERMISSION_DENIED,
      `Unknown relief capability requested: ${capability}`
    );
  }

  const role = resolveReliefRole(actor);
  if (!actor && !allowAnonymous && role === RELIEF_ROLES.PUBLIC) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.UNAUTHENTICATED,
      'Authentication is required for this relief operation.'
    );
  }
  if (!rule.roles.includes(role)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.PERMISSION_DENIED,
      `Role "${role}" is not permitted to perform "${capability}".`
    );
  }
  return role;
};

/**
 * Asserts that a staff actor may operate on a jurisdiction.
 * Citizens/partners may submit to any published jurisdiction; staff are scoped.
 */
export const assertReliefJurisdiction = (actor, jurisdictionId, { forRead = false } = {}) => {
  if (!jurisdictionId) return;
  const role = resolveReliefRole(actor);
  if (role === RELIEF_ROLES.PUBLIC || role === RELIEF_ROLES.CITIZEN || role === RELIEF_ROLES.PARTNER) {
    return;
  }
  if (forRead) {
    // Reads are still scoped: a staff member cannot list another jurisdiction
    // unless they are an unrestricted admin. The caller filters by jurisdiction.
    if (actorHasAllReliefJurisdictions(actor)) return;
  }
  if (actorHasAllReliefJurisdictions(actor)) return;

  const assigned = resolveActorJurisdictions(actor);
  if (assigned.length > 0 && !assigned.includes(String(jurisdictionId).toUpperCase())) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.PERMISSION_DENIED,
      `Access denied: actor is not assigned to jurisdiction "${jurisdictionId}". Assigned: ${assigned.join(', ')}.`
    );
  }
};

/**
 * Returns the jurisdictions an actor's data access should be limited to.
 * Empty array means "all jurisdictions" (only for unrestricted admins).
 * Public/citizen views are never scoped by this helper; they receive aggregates.
 */
export const resolveReliefScope = (actor = getCurrentActor()) => {
  if (actorHasAllReliefJurisdictions(actor)) return [];
  return resolveActorJurisdictions(actor);
};

/**
 * A partner must have a verified partner record for the target jurisdiction.
 * Called by the service before accepting partner-submitted needs.
 */
export const assertVerifiedPartner = (partnerRecord, jurisdictionId) => {
  if (!partnerRecord || partnerRecord.status !== 'verified') {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.PARTNER_NOT_VERIFIED,
      'Partner submissions require a verified partner record.'
    );
  }
  if (
    partnerRecord.jurisdictionId &&
    partnerRecord.jurisdictionId.toUpperCase() !== String(jurisdictionId).toUpperCase()
  ) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.PARTNER_NOT_VERIFIED,
      'The partner is not verified for this jurisdiction.'
    );
  }
  return true;
};
