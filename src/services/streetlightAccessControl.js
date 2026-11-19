/**
 * Least-privilege Streetlight Authorisation & Access Control Layer (#756).
 * Scopes user permissions by role (public, citizen, operator, technician, reviewer, admin)
 * and jurisdiction / ward.
 */

import { getCurrentActor } from './accessControl';
import {
  STREETLIGHT_ROLES,
  STAFF_STREETLIGHT_ROLES,
  STREETLIGHT_CAPABILITIES,
  STREETLIGHT_ERROR_CODES,
} from './streetlightConstants';
import { StreetlightServiceError } from './streetlightValidation';

/**
 * Resolves the streetlight domain role for an actor.
 */
export const resolveStreetlightRole = (actor = getCurrentActor()) => {
  if (!actor || typeof actor !== 'object') {
    return STREETLIGHT_ROLES.PUBLIC;
  }

  const metadata = actor.raw?.publicMetadata || {};
  const claimed = actor.streetlightRole || metadata.streetlightRole || actor.role;

  if (actor.role === 'admin' || claimed === STREETLIGHT_ROLES.ADMIN) {
    if (claimed && STAFF_STREETLIGHT_ROLES.includes(claimed)) {
      return claimed;
    }
    return STREETLIGHT_ROLES.ADMIN;
  }

  if (STAFF_STREETLIGHT_ROLES.includes(claimed)) {
    return claimed;
  }

  return STREETLIGHT_ROLES.CITIZEN;
};

/**
 * Resolves jurisdiction IDs assigned to the actor.
 */
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

export const isStreetlightStaff = (actor = getCurrentActor()) => {
  const role = resolveStreetlightRole(actor);
  return STAFF_STREETLIGHT_ROLES.includes(role);
};

export const actorHasAllJurisdictions = (actor = getCurrentActor()) => {
  const role = resolveStreetlightRole(actor);
  return role === STREETLIGHT_ROLES.ADMIN && resolveActorJurisdictions(actor).length === 0;
};

/**
 * Checks whether an actor has capability.
 */
export const canStreetlight = (capability, actor = getCurrentActor(), { allowAnonymous = false } = {}) => {
  const rule = STREETLIGHT_CAPABILITIES[capability];
  if (!rule) return false;
  const role = resolveStreetlightRole(actor);
  if (!actor && !allowAnonymous && role === STREETLIGHT_ROLES.PUBLIC) {
    return false;
  }
  return rule.roles.includes(role);
};

/**
 * Asserts capability, throwing StreetlightServiceError if unauthorized.
 */
export const assertStreetlightCapability = (
  capability,
  actor = getCurrentActor(),
  { allowAnonymous = false } = {}
) => {
  const rule = STREETLIGHT_CAPABILITIES[capability];
  if (!rule) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.PERMISSION_DENIED,
      `Unknown capability requested: ${capability}`
    );
  }

  const role = resolveStreetlightRole(actor);
  if (!actor && !allowAnonymous && role === STREETLIGHT_ROLES.PUBLIC) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.UNAUTHENTICATED,
      'Authentication required for this operation.'
    );
  }

  if (!rule.roles.includes(role)) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.PERMISSION_DENIED,
      `Role "${role}" is not permitted to perform "${capability}".`
    );
  }

  return role;
};

/**
 * Asserts jurisdiction scoping. Admins with no specific jurisdiction restriction can access all.
 */
export const assertStreetlightJurisdiction = (actor, jurisdictionId, { forRead = false } = {}) => {
  if (!jurisdictionId || forRead) return;

  const role = resolveStreetlightRole(actor);
  if (role === STREETLIGHT_ROLES.PUBLIC || role === STREETLIGHT_ROLES.CITIZEN) {
    // Citizens and public can view and report in any municipal jurisdiction
    return;
  }

  if (actorHasAllJurisdictions(actor)) {
    return;
  }

  const assigned = resolveActorJurisdictions(actor);
  if (assigned.length > 0 && !assigned.includes(jurisdictionId.toUpperCase())) {
    throw new StreetlightServiceError(
      STREETLIGHT_ERROR_CODES.PERMISSION_DENIED,
      `Access denied: Actor is not assigned to jurisdiction "${jurisdictionId}". Assigned: ${assigned.join(', ')}`
    );
  }
};
