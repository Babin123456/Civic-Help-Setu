/**
 * Least-privilege tree-domain authorisation.
 *
 * The site-wide roles are "admin" and "citizen". A municipality can provision
 * an admin with an additional tree role (`operator`, `arborist` or `reviewer`)
 * and a jurisdiction. This module narrows that admin permission instead of
 * widening it. A citizen can never gain staff access by passing a role in a
 * request; the signed-in actor registered by AuthProvider is the only source.
 */

import { getCurrentActor } from './accessControl';
import { TREE_CAPABILITIES, TREE_ROLES, STAFF_TREE_ROLES } from './treeInventoryConstants';
import { createTreeError } from './treeInventoryValidation';

const isKnownStaffRole = (role) => STAFF_TREE_ROLES.includes(role);

/**
 * @param {object|null} [actor] defaults to the signed-in user
 * @returns {'citizen'|'operator'|'arborist'|'reviewer'|'admin'}
 */
export const resolveTreeRole = (actor = getCurrentActor()) => {
  if (!actor || typeof actor !== 'object') return TREE_ROLES.CITIZEN;

  const metadata = actor.raw?.publicMetadata || {};
  const claimed = actor.treeRole || metadata.treeRole;

  if (actor.role === TREE_ROLES.ADMIN) {
    // An administrator without a narrower tree role keeps full inventory access.
    return isKnownStaffRole(claimed) ? claimed : TREE_ROLES.ADMIN;
  }

  // Future staff accounts may carry the domain role directly. The role must be
  // both known and present on the trusted user object, not merely in a request.
  if (isKnownStaffRole(actor.role) && (!claimed || claimed === actor.role)) {
    return actor.role;
  }

  return TREE_ROLES.CITIZEN;
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
  return [...new Set(candidates.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
};

export const actorHasAllJurisdictions = (actor = getCurrentActor()) =>
  resolveTreeRole(actor) === TREE_ROLES.ADMIN && resolveActorJurisdictions(actor).length === 0;

/** null means "all jurisdictions" (full inventory administrator). */
export const getScopedJurisdictions = (actor = getCurrentActor()) =>
  actorHasAllJurisdictions(actor) ? null : resolveActorJurisdictions(actor);

export const isTreeStaff = (actor = getCurrentActor()) =>
  STAFF_TREE_ROLES.includes(resolveTreeRole(actor));

export const canTree = (capability, actor = getCurrentActor(), { allowAnonymous = false } = {}) => {
  const rule = TREE_CAPABILITIES[capability];
  if (!rule) return false;
  const role = resolveTreeRole(actor);
  if (!actor && !allowAnonymous) return false;
  return rule.roles.includes(role);
};

export const assertTreeCapability = (capability, actor = getCurrentActor(), { allowAnonymous = false } = {}) => {
  const rule = TREE_CAPABILITIES[capability];
  if (!rule) {
    throw createTreeError('TREE_UNKNOWN_CAPABILITY', `Unknown tree capability: ${capability}`);
  }
  if (!actor && !allowAnonymous) {
    throw createTreeError('TREE_UNAUTHENTICATED');
  }
  const role = resolveTreeRole(actor);
  if (!rule.roles.includes(role)) {
    throw createTreeError('TREE_PERMISSION_DENIED', `Role ${role} cannot perform ${capability}.`);
  }
  return role;
};

export const assertTreeJurisdiction = (actor, jurisdictionId, { forRead = false } = {}) => {
  if (!jurisdictionId) {
    throw createTreeError('TREE_VALIDATION_ERROR', 'A jurisdiction is required.');
  }
  if (actorHasAllJurisdictions(actor)) return true;
  const scoped = resolveActorJurisdictions(actor);
  if (scoped.includes(jurisdictionId)) return true;
  throw createTreeError(
    forRead ? 'TREE_JURISDICTION_FORBIDDEN' : 'TREE_JURISDICTION_FORBIDDEN',
    `Actor is not assigned to jurisdiction ${jurisdictionId}.`,
    { details: { requiredJurisdiction: jurisdictionId } }
  );
};

export const actorIdentity = (actor = getCurrentActor()) => {
  if (!actor || typeof actor !== 'object') return null;
  const id = String(actor.id || actor.username || actor.email || '').trim();
  if (!id) return null;
  return {
    id,
    label: String(actor.fullName || actor.username || actor.email || 'Staff member').trim().slice(0, 120),
    role: resolveTreeRole(actor),
    jurisdictions: resolveActorJurisdictions(actor),
  };
};

export const requireActorIdentity = (actor = getCurrentActor()) => {
  const identity = actorIdentity(actor);
  if (!identity) throw createTreeError('TREE_UNAUTHENTICATED');
  return identity;
};

export const listTreeCapabilities = (actor = getCurrentActor()) =>
  Object.entries(TREE_CAPABILITIES)
    .filter(([, rule]) => rule.roles.includes(resolveTreeRole(actor)))
    .map(([capability]) => capability);

export const canSwitchToStaffWorkspace = (actor = getCurrentActor()) => isTreeStaff(actor);
