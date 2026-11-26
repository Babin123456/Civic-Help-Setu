/**
 * Role, capability and jurisdiction enforcement for the Civic Micro-Volunteer
 * Task Board (#759).
 *
 * The board is a separate capability from official government applications and
 * from the existing volunteer coordination screen. It uses its own least-privilege
 * roles so a ward operator can publish tasks without gaining moderation rights,
 * and a reviewer can decide completions without gaining administrative rights.
 *
 * Rules:
 *  - Deny by default. An unknown role is treated as a citizen, and a signed-out
 *    caller is `public`.
 *  - The caller never supplies its own role; it is resolved from the signed-in
 *    actor registered by AuthProvider or from verified server claims.
 *  - Jurisdiction scope is checked for every write and for staff reads.
 */

import {
  MICRO_VOLUNTEER_CAPABILITIES,
  MICRO_VOLUNTEER_ERROR_CODES,
  MICRO_VOLUNTEER_ROLES,
  maskActorRef,
} from '../data/microVolunteerContract.js';
import { MicroVolunteerError } from './microVolunteerValidation.js';

const ROLE_PRECEDENCE = [
  MICRO_VOLUNTEER_ROLES.ADMIN,
  MICRO_VOLUNTEER_ROLES.REVIEWER,
  MICRO_VOLUNTEER_ROLES.OPERATOR,
  MICRO_VOLUNTEER_ROLES.CITIZEN,
  MICRO_VOLUNTEER_ROLES.PUBLIC,
];

const ROLE_ALIASES = Object.freeze({
  admin: MICRO_VOLUNTEER_ROLES.ADMIN,
  administrator: MICRO_VOLUNTEER_ROLES.ADMIN,
  reviewer: MICRO_VOLUNTEER_ROLES.REVIEWER,
  moderator: MICRO_VOLUNTEER_ROLES.REVIEWER,
  operator: MICRO_VOLUNTEER_ROLES.OPERATOR,
  staff: MICRO_VOLUNTEER_ROLES.OPERATOR,
  volunteer_coordinator: MICRO_VOLUNTEER_ROLES.OPERATOR,
  citizen: MICRO_VOLUNTEER_ROLES.CITIZEN,
  resident: MICRO_VOLUNTEER_ROLES.CITIZEN,
  public: MICRO_VOLUNTEER_ROLES.PUBLIC,
});

const normaliseRole = (value) => {
  if (typeof value !== 'string') return null;
  return ROLE_ALIASES[value.trim().toLowerCase()] || null;
};

const normaliseJurisdictions = (actor) => {
  const source =
    actor?.microVolunteerJurisdictionIds ||
    actor?.jurisdictionIds ||
    actor?.jurisdictions ||
    actor?.wards ||
    [];
  const list = Array.isArray(source) ? source : [source];
  return [
    ...new Set(
      list
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim().toUpperCase())
        .filter((value) => /^[A-Z0-9-]{2,40}$/.test(value))
    ),
  ];
};

/**
 * Turns any signed-in actor into the board's own role shape. Server callers pass
 * verified claims; browser callers pass the AuthProvider user. Neither can pass
 * a role in a request body and have it accepted by the service.
 */
export const resolveMicroVolunteerActor = (actor = null) => {
  if (!actor || typeof actor !== 'object' || (!actor.id && !actor.userId)) {
    return Object.freeze({
      id: null,
      role: MICRO_VOLUNTEER_ROLES.PUBLIC,
      authenticated: false,
      jurisdictionIds: [],
      displayRef: 'guest',
    });
  }

  const id = String(actor.id || actor.userId);
  const declaredRoles = [
    actor.microVolunteerRole,
    actor.volunteerRole,
    actor.role,
  ]
    .map(normaliseRole)
    .filter(Boolean);

  const role =
    ROLE_PRECEDENCE.find((candidate) => declaredRoles.includes(candidate)) ||
    MICRO_VOLUNTEER_ROLES.CITIZEN;

  return Object.freeze({
    id,
    role,
    authenticated: true,
    jurisdictionIds: normaliseJurisdictions(actor),
    displayRef: maskActorRef(id),
  });
};

export const isStaffRole = (role) =>
  [MICRO_VOLUNTEER_ROLES.OPERATOR, MICRO_VOLUNTEER_ROLES.REVIEWER, MICRO_VOLUNTEER_ROLES.ADMIN].includes(
    role
  );

export const hasCapability = (capability, actor) => {
  const resolved = resolveMicroVolunteerActor(actor);
  const definition = MICRO_VOLUNTEER_CAPABILITIES[capability];
  return Boolean(definition && definition.roles.includes(resolved.role));
};

export const requireCapability = (capability, actor) => {
  const resolved = resolveMicroVolunteerActor(actor);
  if (!MICRO_VOLUNTEER_CAPABILITIES[capability]) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED,
      `Unknown board capability: ${capability}`,
      { capability }
    );
  }
  if (!resolved.authenticated) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.UNAUTHENTICATED,
      'Sign in to perform this action on the micro-volunteer board.',
      { capability }
    );
  }
  if (!hasCapability(capability, resolved)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED,
      `Your role (${resolved.role}) cannot perform ${capability}.`,
      { capability, role: resolved.role }
    );
  }
  return resolved;
};

/**
 * A staff member with no jurisdiction assignment is treated as unscoped only when
 * they are an administrator. Operators and reviewers must be assigned, otherwise a
 * role grant would silently become city-wide.
 */
export const canAccessJurisdiction = (actor, jurisdictionId, { write = false } = {}) => {
  const resolved = resolveMicroVolunteerActor(actor);
  const code = String(jurisdictionId || '').toUpperCase().trim();
  if (!code) return false;

  if (resolved.role === MICRO_VOLUNTEER_ROLES.PUBLIC) return !write;

  if (resolved.role === MICRO_VOLUNTEER_ROLES.ADMIN && resolved.jurisdictionIds.length === 0) {
    return true;
  }

  if (isStaffRole(resolved.role)) {
    if (resolved.jurisdictionIds.length === 0) return !write;
    return resolved.jurisdictionIds.includes(code);
  }

  // Citizens may browse every public board. When a deployment assigns them a
  // home ward, claims and submissions stay inside it.
  if (resolved.jurisdictionIds.length === 0) return true;
  return resolved.jurisdictionIds.includes(code);
};

export const requireJurisdictionAccess = (actor, jurisdictionId, options = {}) => {
  const resolved = resolveMicroVolunteerActor(actor);
  if (!canAccessJurisdiction(resolved, jurisdictionId, options)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.JURISDICTION_DENIED,
      'This task belongs to a jurisdiction outside your assignment.',
      { jurisdictionId: String(jurisdictionId || '').toUpperCase() }
    );
  }
  return resolved;
};

export const assertNotSelfModeration = (actor, record = {}) => {
  const resolved = resolveMicroVolunteerActor(actor);
  if (!resolved.id) return resolved;
  const ownerIds = [record.citizenId, record.createdBy].filter(Boolean).map(String);
  if (ownerIds.includes(resolved.id)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.SELF_MODERATION,
      'You cannot moderate a claim or task that you created or claimed.',
      { actorRef: resolved.displayRef }
    );
  }
  return resolved;
};

/** Stable, non-reversible reference used in audit events. */
export const actorAuditRef = (actor) => {
  const resolved = resolveMicroVolunteerActor(actor);
  return resolved.displayRef;
};

const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * Stable rate-limit / ownership key. Unlike the short display reference this
 * keeps collisions negligible, and it cannot be reversed into the account id.
 */
export const actorScopeKey = (actor) => {
  const resolved = resolveMicroVolunteerActor(actor);
  if (!resolved.id) return 'actor-public';
  return `actor-${fnv1a(resolved.id)}`;
};

export const describeActorCapabilities = (actor) => {
  const resolved = resolveMicroVolunteerActor(actor);
  return {
    role: resolved.role,
    authenticated: resolved.authenticated,
    jurisdictionIds: resolved.jurisdictionIds,
    capabilities: Object.entries(MICRO_VOLUNTEER_CAPABILITIES)
      .filter(([, definition]) => definition.roles.includes(resolved.role))
      .map(([name]) => name),
  };
};

export const MICRO_VOLUNTEER_ROLE_LABELS = Object.freeze({
  [MICRO_VOLUNTEER_ROLES.PUBLIC]: 'Public visitor',
  [MICRO_VOLUNTEER_ROLES.CITIZEN]: 'Citizen contributor',
  [MICRO_VOLUNTEER_ROLES.OPERATOR]: 'Ward operator',
  [MICRO_VOLUNTEER_ROLES.REVIEWER]: 'Moderator / reviewer',
  [MICRO_VOLUNTEER_ROLES.ADMIN]: 'Board administrator',
});
