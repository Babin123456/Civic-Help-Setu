/**
 * Least-privilege authorisation for the Greenhouse-Gas Inventory (#753).
 *
 * Roles: public, citizen, operator, reviewer, administrator.
 * Operators submit and run calculations; reviewers approve and decide estimates;
 * administrators publish factors, manage periods and run migrations. Every service read or
 * write calls these functions, so hiding a button is not the security boundary.
 */

import { getCurrentActor } from './accessControl.js';
import {
  GHG_CAPABILITIES,
  GHG_ERROR_CODES,
  GHG_ROLES,
  STAFF_GHG_ROLES,
} from './ghgInventoryConstants.js';
import { GhgInventoryError } from './ghgInventoryValidation.js';

const ALL_ROLES = Object.values(GHG_ROLES);

export const resolveGhgRole = (actor = getCurrentActor()) => {
  if (!actor || typeof actor !== 'object') return GHG_ROLES.PUBLIC;

  const metadata = actor.raw?.publicMetadata || {};
  const claimed = actor.ghgRole || metadata.ghgRole || actor.inventoryRole;

  if (actor.role === 'admin' || claimed === GHG_ROLES.ADMIN) {
    return ALL_ROLES.includes(claimed) ? claimed : GHG_ROLES.ADMIN;
  }
  if (ALL_ROLES.includes(claimed)) return claimed;
  if (actor.role === GHG_ROLES.OPERATOR) return GHG_ROLES.OPERATOR;
  if (actor.role === GHG_ROLES.REVIEWER) return GHG_ROLES.REVIEWER;
  return GHG_ROLES.CITIZEN;
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

export const isGhgStaff = (actor = getCurrentActor()) =>
  STAFF_GHG_ROLES.includes(resolveGhgRole(actor));

export const actorHasAllJurisdictions = (actor = getCurrentActor()) =>
  resolveGhgRole(actor) === GHG_ROLES.ADMIN && resolveActorJurisdictions(actor).length === 0;

export const canGhg = (capability, actor = getCurrentActor(), { allowAnonymous = false } = {}) => {
  const rule = GHG_CAPABILITIES[capability];
  if (!rule) return false;
  const role = resolveGhgRole(actor);
  if (!actor && !allowAnonymous && role === GHG_ROLES.PUBLIC) return false;
  return rule.roles.includes(role);
};

export const assertGhgCapability = (
  capability,
  actor = getCurrentActor(),
  { allowAnonymous = false } = {}
) => {
  const rule = GHG_CAPABILITIES[capability];
  if (!rule) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.PERMISSION_DENIED,
      `Unknown inventory capability "${capability}".`
    );
  }
  const role = resolveGhgRole(actor);
  if (!actor && !allowAnonymous && role === GHG_ROLES.PUBLIC) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.UNAUTHENTICATED,
      'Sign in with a municipal operator, reviewer or administrator account to use this operation.'
    );
  }
  if (!rule.roles.includes(role)) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.PERMISSION_DENIED,
      `Role "${role}" is not permitted to ${rule.description.toLowerCase()}. Ask a municipal administrator for the correct role.`
    );
  }
  return role;
};

/**
 * Staff writes and reads are scoped to assigned jurisdictions. Public/citizen projections do
 * not pass through this check because they only receive aggregate approved data.
 */
export const assertGhgJurisdiction = (actor, jurisdictionId, { allowPublic = false } = {}) => {
  if (!jurisdictionId) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.VALIDATION_ERROR,
      'A jurisdiction is required for this operation.'
    );
  }
  const role = resolveGhgRole(actor);
  if (allowPublic && (role === GHG_ROLES.PUBLIC || role === GHG_ROLES.CITIZEN)) return;
  if (actorHasAllJurisdictions(actor)) return;

  const assigned = resolveActorJurisdictions(actor);
  if (assigned.length === 0) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.JURISDICTION_DENIED,
      'No jurisdiction is assigned to this account. A municipal administrator must assign one before staff data can be used.'
    );
  }
  if (!assigned.includes(jurisdictionId.toUpperCase())) {
    throw new GhgInventoryError(
      GHG_ERROR_CODES.JURISDICTION_DENIED,
      `This record belongs to ${jurisdictionId}, outside your assigned jurisdiction. Assigned: ${assigned.join(', ')}.`,
      { jurisdictionId, assigned }
    );
  }
};

export const filterByJurisdiction = (items, actor = getCurrentActor()) => {
  if (actorHasAllJurisdictions(actor)) return items || [];
  const assigned = new Set(resolveActorJurisdictions(actor));
  if (assigned.size === 0) return [];
  return (items || []).filter((item) =>
    assigned.has(String(item.jurisdictionId || '').toUpperCase())
  );
};

export const describeActorScope = (actor = getCurrentActor()) => {
  const role = resolveGhgRole(actor);
  const assigned = resolveActorJurisdictions(actor);
  return {
    role,
    jurisdictionIds: assigned,
    allJurisdictions: actorHasAllJurisdictions(actor),
    label:
      role === GHG_ROLES.ADMIN && assigned.length === 0
        ? 'Administrator — all jurisdictions'
        : `${role} — ${assigned.join(', ') || 'no jurisdiction assigned'}`,
  };
};
