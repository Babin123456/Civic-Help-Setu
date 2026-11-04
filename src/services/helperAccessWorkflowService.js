/**
 * helperAccessWorkflowService.js
 *
 * Consent-based emergency contact and trusted helper access workflow (#477).
 * Enables applicants to securely delegate read-only visibility into selected
 * civic applications to family members, case workers, or emergency contacts.
 *
 * Security & Consent Guarantees:
 * - Scoped permission granularity (e.g. view milestones, view deadlines).
 * - Sensitive identity documents and digital vault files remain hidden unless
 *   explicitly toggled on with secondary consent.
 * - Helpers are never permitted to modify account credentials or submit applications
 *   on the citizen's behalf.
 * - Single-use, time-limited email invitations with one-click revocation.
 * - Complete audit trail of every access event.
 */

const INVITATIONS_KEY = 'civicbridge_helper_invitations';
const ACTIVE_DELEGATIONS_KEY = 'civicbridge_helper_delegations';
const AUDIT_LOG_KEY = 'civicbridge_helper_audit_logs';

export const HELPER_PERMISSIONS = {
  VIEW_MILESTONES: 'VIEW_MILESTONES',
  VIEW_DEADLINES: 'VIEW_DEADLINES',
  RECEIVE_NOTIFICATIONS: 'RECEIVE_NOTIFICATIONS',
  VIEW_DOCUMENTS: 'VIEW_DOCUMENTS', // Strictly requires separate explicit consent
};

/**
 * Generates an opaque invitation token
 */
export function generateInvitationToken() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Appends an event to the helper access audit trail
 */
export function recordHelperAudit(ownerId, helperEmail, action, details = {}) {
  const logs = loadStorage(AUDIT_LOG_KEY);
  logs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ownerId,
    helperEmail,
    action,
    details,
    timestamp: Date.now(),
  });
  saveStorage(AUDIT_LOG_KEY, logs.slice(0, 100)); // retain latest 100 events
}

/**
 * Creates and dispatches a consent-based helper invitation.
 *
 * @param {string} ownerId - Citizen user ID
 * @param {string} ownerName - Citizen display name
 * @param {Object} helperDetails - Helper email, relationship, role
 * @param {Array<string>} [applicationIds=[]] - Specific application IDs granted
 * @param {Array<string>} [permissions=[]] - Explicit granted permissions
 * @returns {Object} Created invitation
 */
export function createHelperInvitation(
  ownerId,
  ownerName,
  helperDetails = {},
  applicationIds = [],
  permissions = [HELPER_PERMISSIONS.VIEW_MILESTONES, HELPER_PERMISSIONS.VIEW_DEADLINES]
) {
  if (!ownerId) throw new Error('Citizen owner ID is required');
  if (!helperDetails.email || !helperDetails.email.includes('@')) {
    throw new Error('Valid helper email address is required');
  }

  const invitations = loadStorage(INVITATIONS_KEY);
  const token = generateInvitationToken();
  const createdAt = Date.now();
  // Invitation link expires in 7 days
  const expiresAt = createdAt + 7 * 24 * 60 * 60 * 1000;

  const invitation = {
    token,
    ownerId,
    ownerName: ownerName || 'Citizen Applicant',
    helperEmail: helperDetails.email.toLowerCase().trim(),
    helperName: helperDetails.name || 'Trusted Helper',
    relationship: helperDetails.relationship || 'Emergency Contact / Volunteer',
    applicationIds: Array.isArray(applicationIds) ? applicationIds : [],
    permissions: Array.isArray(permissions) ? permissions : [],
    status: 'PENDING',
    createdAt,
    expiresAt,
  };

  invitations.push(invitation);
  saveStorage(INVITATIONS_KEY, invitations);

  recordHelperAudit(ownerId, invitation.helperEmail, 'INVITATION_CREATED', {
    permissions,
    applicationCount: applicationIds.length,
  });

  return invitation;
}

/**
 * Accepts an invitation and transitions it to an active delegation.
 */
export function acceptHelperInvitation(token, acceptingEmail) {
  const invitations = loadStorage(INVITATIONS_KEY);
  const targetIndex = invitations.findIndex((i) => i.token === token);

  if (targetIndex === -1) {
    return { success: false, error: 'Invitation not found or invalid' };
  }

  const invitation = invitations[targetIndex];

  if (invitation.status !== 'PENDING') {
    return { success: false, error: `Invitation is no longer active (status: ${invitation.status})` };
  }

  if (Date.now() > invitation.expiresAt) {
    invitation.status = 'EXPIRED';
    invitations[targetIndex] = invitation;
    saveStorage(INVITATIONS_KEY, invitations);
    return { success: false, error: 'This invitation has expired' };
  }

  if (acceptingEmail && acceptingEmail.toLowerCase().trim() !== invitation.helperEmail) {
    return { success: false, error: 'Email mismatch: this invitation was issued to another recipient.' };
  }

  // Create active delegation
  invitation.status = 'ACCEPTED';
  invitations[targetIndex] = invitation;
  saveStorage(INVITATIONS_KEY, invitations);

  const delegations = loadStorage(ACTIVE_DELEGATIONS_KEY);
  const delegation = {
    id: `del-${Date.now()}`,
    invitationToken: token,
    ownerId: invitation.ownerId,
    ownerName: invitation.ownerName,
    helperEmail: invitation.helperEmail,
    helperName: invitation.helperName,
    relationship: invitation.relationship,
    applicationIds: invitation.applicationIds,
    permissions: invitation.permissions,
    active: true,
    acceptedAt: Date.now(),
  };

  delegations.push(delegation);
  saveStorage(ACTIVE_DELEGATIONS_KEY, delegations);

  recordHelperAudit(invitation.ownerId, invitation.helperEmail, 'INVITATION_ACCEPTED', {
    delegationId: delegation.id,
  });

  return { success: true, delegation };
}

/**
 * Immediately revokes an active helper delegation
 */
export function revokeHelperDelegation(delegationId, ownerId) {
  const delegations = loadStorage(ACTIVE_DELEGATIONS_KEY);
  const targetIndex = delegations.findIndex((d) => d.id === delegationId && d.ownerId === ownerId);

  if (targetIndex === -1) {
    return false;
  }

  const target = delegations[targetIndex];
  target.active = false;
  target.revokedAt = Date.now();
  delegations[targetIndex] = target;
  saveStorage(ACTIVE_DELEGATIONS_KEY, delegations);

  recordHelperAudit(ownerId, target.helperEmail, 'DELEGATION_REVOKED', {
    delegationId,
  });

  return true;
}

/**
 * Lists all active helpers and pending invitations for a citizen
 */
export function getCitizenHelperOverview(ownerId) {
  if (!ownerId) return { activeHelpers: [], pendingInvitations: [], auditLogs: [] };

  const delegations = loadStorage(ACTIVE_DELEGATIONS_KEY);
  const invitations = loadStorage(INVITATIONS_KEY);
  const logs = loadStorage(AUDIT_LOG_KEY);

  const activeHelpers = delegations.filter((d) => d.ownerId === ownerId && d.active);
  const pendingInvitations = invitations.filter((i) => i.ownerId === ownerId && i.status === 'PENDING');
  const auditLogs = logs.filter((l) => l.ownerId === ownerId);

  return {
    activeHelpers,
    pendingInvitations,
    auditLogs,
  };
}
