/**
 * Least-privilege authorisation for the Offline Emergency Civic Information Card
 * (#761).
 *
 * Roles: public, citizen, operator, reviewer, administrator.
 *  - public/citizen: read the approved card, install it locally, keep a
 *    non-sensitive note, refresh and delete device data.
 *  - operator: create official sources and draft contacts for assigned
 *    jurisdictions, then submit them for verification.
 *  - reviewer: verify and publish contacts, request changes, generate and
 *    decide review recommendations, and read the audit trail.
 *  - administrator: everything, plus archive restore, retention and rollback.
 *
 * Every service read or write calls these functions. Hiding a button is not the
 * security boundary. The local-only limit is documented in
 * docs/offline-emergency-civic-card.md.
 */

import { getCurrentActor } from './accessControl.js';
import {
  OFFLINE_CARD_CAPABILITIES,
  OFFLINE_CARD_ERROR_CODES,
  OFFLINE_CARD_ROLES,
  STAFF_OFFLINE_CARD_ROLES,
} from './offlineEmergencyCardConstants.js';
import { OfflineEmergencyCardError } from './offlineEmergencyCardValidation.js';

const ALL_ROLES = Object.values(OFFLINE_CARD_ROLES);

export const resolveOfflineCardRole = (actor = getCurrentActor()) => {
  if (!actor || typeof actor !== 'object') return OFFLINE_CARD_ROLES.PUBLIC;

  const metadata = actor.raw?.publicMetadata || {};
  const claimed =
    actor.offlineCardRole ||
    metadata.offlineCardRole ||
    actor.emergencyCardRole ||
    metadata.emergencyCardRole ||
    actor.role;

  if (actor.role === 'admin' || claimed === OFFLINE_CARD_ROLES.ADMIN) {
    return ALL_ROLES.includes(claimed) ? claimed : OFFLINE_CARD_ROLES.ADMIN;
  }
  if (ALL_ROLES.includes(claimed)) return claimed;
  if (actor.role === OFFLINE_CARD_ROLES.OPERATOR) return OFFLINE_CARD_ROLES.OPERATOR;
  if (actor.role === OFFLINE_CARD_ROLES.REVIEWER) return OFFLINE_CARD_ROLES.REVIEWER;
  return OFFLINE_CARD_ROLES.CITIZEN;
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

export const isOfflineCardStaff = (actor = getCurrentActor()) =>
  STAFF_OFFLINE_CARD_ROLES.includes(resolveOfflineCardRole(actor));

export const actorHasAllJurisdictions = (actor = getCurrentActor()) =>
  resolveOfflineCardRole(actor) === OFFLINE_CARD_ROLES.ADMIN &&
  resolveActorJurisdictions(actor).length === 0;

export const canOfflineCard = (
  capability,
  actor = getCurrentActor(),
  { allowAnonymous = false } = {}
) => {
  const rule = OFFLINE_CARD_CAPABILITIES[capability];
  if (!rule) return false;
  const role = resolveOfflineCardRole(actor);
  if (!actor && !allowAnonymous && role === OFFLINE_CARD_ROLES.PUBLIC) return false;
  return rule.roles.includes(role);
};

export const assertOfflineCardCapability = (
  capability,
  actor = getCurrentActor(),
  { allowAnonymous = false } = {}
) => {
  const rule = OFFLINE_CARD_CAPABILITIES[capability];
  if (!rule) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.PERMISSION_DENIED,
      `Unknown emergency card capability "${capability}".`
    );
  }
  const role = resolveOfflineCardRole(actor);
  if (!actor && !allowAnonymous && role === OFFLINE_CARD_ROLES.PUBLIC) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.UNAUTHENTICATED,
      'Sign in with an operator, reviewer or administrator account to use this operation.'
    );
  }
  if (!rule.roles.includes(role)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.PERMISSION_DENIED,
      `Role "${role}" is not permitted to ${rule.description.toLowerCase()}. Ask a municipal administrator for the correct role.`
    );
  }
  return role;
};

/**
 * Staff writes and reads are scoped to assigned jurisdictions. Public/citizen
 * card reads do not pass through this check because they receive only approved
 * public fields for the jurisdiction they selected.
 */
export const assertOfflineCardJurisdiction = (
  actor,
  jurisdictionId,
  { allowPublic = false } = {}
) => {
  if (!jurisdictionId) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'A jurisdiction is required for this operation.'
    );
  }
  const role = resolveOfflineCardRole(actor);
  if (allowPublic && (role === OFFLINE_CARD_ROLES.PUBLIC || role === OFFLINE_CARD_ROLES.CITIZEN)) {
    return;
  }
  if (actorHasAllJurisdictions(actor)) return;

  const normalized = String(jurisdictionId).toUpperCase();
  if (normalized === 'NATIONAL' && role !== OFFLINE_CARD_ROLES.ADMIN) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.JURISDICTION_DENIED,
      'National contacts can only be changed by an administrator. You can read them on the public card.'
    );
  }

  const assigned = resolveActorJurisdictions(actor);
  if (assigned.length === 0) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.JURISDICTION_DENIED,
      'No jurisdiction is assigned to this account. A municipal administrator must assign one before staff records can be used.'
    );
  }
  if (!assigned.includes(normalized)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.JURISDICTION_DENIED,
      `This record belongs to ${normalized}, outside your assigned jurisdiction. Assigned: ${assigned.join(', ')}.`,
      { jurisdictionId: normalized, assigned }
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

export const describeOfflineCardScope = (actor = getCurrentActor()) => {
  const role = resolveOfflineCardRole(actor);
  const assigned = resolveActorJurisdictions(actor);
  return {
    role,
    jurisdictionIds: assigned,
    allJurisdictions: actorHasAllJurisdictions(actor),
    label:
      role === OFFLINE_CARD_ROLES.ADMIN && assigned.length === 0
        ? 'Administrator — all jurisdictions'
        : `${role} — ${assigned.join(', ') || 'no jurisdiction assigned'}`,
  };
};
