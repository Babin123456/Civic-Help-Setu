/**
 * Who may do what, enforced where the data is read and written.
 *
 * Hiding an admin button or wrapping a route in <ProtectedRoute> only decides what a page
 * *shows*. Every function that reads or changes admin-only records calls `requirePermission` first,
 * so a direct call (a stale tab, a bug in another component, a test) is refused too.
 *
 * Rules:
 *  - Deny by default: an action that is not in PERMISSIONS, a missing user and an unknown role are
 *    all refused.
 *  - The caller never passes its own role. The signed-in user is registered once by AuthProvider
 *    (`setCurrentActor`) and read from here.
 *  - The role is exactly "admin" or "citizen" (see roleService.js); anything else is a citizen.
 *
 * Limit, stated plainly: this app has no server and keeps its records in the browser's
 * localStorage, so someone using the browser's developer tools can still edit those records or
 * call these functions from the console. These checks stop mistakes and UI-only gating; real
 * enforcement for shared data needs a backend or Firebase rules (see docs/ACCESS_CONTROL.md).
 */

/** Every privileged action: who may do it, and what it touches. Add new admin features here. */
export const PERMISSIONS = {
  'services.write': { roles: ['admin'], resource: 'civicbridge_custom_services', description: 'Add or edit a service guide' },
  'services.import': { roles: ['admin'], resource: 'civicbridge_custom_services', description: 'Bulk import service guides' },
  'services.delete': { roles: ['admin'], resource: 'civicbridge_custom_services', description: 'Remove a service guide' },
  'services.archive': { roles: ['admin'], resource: 'civicbridge_custom_services', description: 'Archive or restore service guides' },
  'reports.read': { roles: ['admin'], resource: 'civicbridge_error_reports', description: 'Read the error report queue (holds reporter emails)' },
  'reports.resolve': { roles: ['admin'], resource: 'civicbridge_error_reports', description: 'Resolve an error report' },
  'reports.dismiss': { roles: ['admin'], resource: 'civicbridge_error_reports', description: 'Dismiss an error report' },
  'audit.write': { roles: ['admin'], resource: 'civicbridge_audit_logs', description: 'Add an entry to the admin audit trail' },
  'audit.read': { roles: ['admin'], resource: 'civicbridge_audit_logs', description: 'Read the admin audit trail' },
  'users.read': { roles: ['admin'], resource: 'civicbridge_rbac_users', description: 'Read the role list' },
  'users.updateRole': { roles: ['admin'], resource: 'civicbridge_rbac_users', description: 'Change a user role or permissions' },
  'submissions.read': { roles: ['admin'], resource: 'civicbridge_service_submissions', description: 'Read community service submissions (hold contributor emails)' },
  'submissions.review': { roles: ['admin'], resource: 'civicbridge_service_submissions', description: 'Approve or reject a submission' },
  'communityAudits.resolve': { roles: ['admin'], resource: 'civicbridge_community_audits', description: 'Resolve a community audit report' },
  'sourceConflicts.review': { roles: ['admin'], resource: 'civicbridge_source_conflicts', description: 'Resolve or reopen a source conflict' },
  'barriers.moderate': { roles: ['admin'], resource: 'civicbridge_barrier_reports', description: 'Moderate a barrier report' },
  'feedback.moderate': { roles: ['admin'], resource: 'bottleneck feedback', description: 'Review, list for moderation or reset bottleneck feedback' },
  'notices.manage': { roles: ['admin'], resource: 'notice digest', description: 'Add, edit, change the status of or reset notices' },
  'links.check': { roles: ['admin'], resource: 'link health records', description: 'Check an official application link and record the result' },
  'availabilityNotices.manage': { roles: ['admin'], resource: 'service availability notices', description: 'Add, edit, publish or withdraw a service availability notice' },
  'freshness.review': { roles: ['admin'], resource: 'service review overrides', description: 'Record that a service guide was reviewed' },
  'ownership.read': { roles: ['admin'], resource: 'civicbridge_service_ownership_v1', description: 'Read who is assigned to review each service guide, with private notes' },
  'ownership.manage': { roles: ['admin'], resource: 'civicbridge_service_ownership_v1', description: 'Assign, reassign or clear the reviewer of a service guide' },
};

export class PermissionDeniedError extends Error {
  constructor(action, reason) {
    super(`Not allowed: ${action}`);
    this.name = 'PermissionDeniedError';
    this.code = 'FORBIDDEN';
    this.action = action;
    this.reason = reason;
  }
}

let currentActor = null;

/** Called by AuthProvider whenever the signed-in user changes. Pass null when signed out. */
export const setCurrentActor = (user) => {
  currentActor = user && typeof user === 'object' ? user : null;
};

export const getCurrentActor = () => currentActor;

/** The role to enforce: exactly "admin" counts as admin, everything else is a citizen. */
export const roleOf = (actor) => (actor && typeof actor.role === 'string' && actor.role === 'admin' ? 'admin' : 'citizen');

/**
 * @param {string} action a key of PERMISSIONS
 * @param {object|null} [actor] defaults to the signed-in user
 * @returns {'ok'|'unauthenticated'|'forbidden'|'unknown-action'}
 */
export const checkPermission = (action, actor = currentActor) => {
  if (!Object.prototype.hasOwnProperty.call(PERMISSIONS, action)) return 'unknown-action';
  if (!actor || typeof actor !== 'object') return 'unauthenticated';
  return PERMISSIONS[action].roles.includes(roleOf(actor)) ? 'ok' : 'forbidden';
};

/** For the UI: should this control be shown? (The data layer still enforces it.) */
export const can = (action, actor = currentActor) => checkPermission(action, actor) === 'ok';

/** Throws PermissionDeniedError unless the signed-in user may do `action`. */
export const requirePermission = (action) => {
  const result = checkPermission(action);
  if (result !== 'ok') throw new PermissionDeniedError(action, result);
};

/** Name to record in the audit trail: the verified user, not whatever the caller passed in. */
export const actorLabel = (fallback = 'Admin') => {
  const actor = currentActor;
  return (actor && (actor.username || actor.fullName || actor.email)) || fallback;
};
