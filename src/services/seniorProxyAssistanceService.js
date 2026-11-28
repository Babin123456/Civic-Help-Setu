/**
 * src/services/seniorProxyAssistanceService.js
 *
 * Senior-Citizen Public Service Proxy and Assistance Workflow (#1420).
 *
 * Extends `checklistStorage.js` and `trackingService.js` to provide:
 *   - Owner-approved proxy delegations with separate proxy credentials
 *   - Granular, revocable permissions (checklist_edit, reminders_manage, tracking_view, tracking_update)
 *   - Mandatory permission expiry and immediate revocation propagation
 *   - Non-PII activity history for every delegated action and authorization denial
 *   - Distinct provenance tags: citizen_entered | official_record | ai_suggestion
 */

import { readChecklist, writeChecklist } from './checklistStorage.js';
import { normalizeStatus, STATUS_META } from './trackingService.js';

export const SENIOR_PROXY_STORAGE_KEY = 'civicbridge_senior_proxy_v1';

export const VALID_PROXY_PERMISSIONS = Object.freeze([
  'checklist_edit',
  'reminders_manage',
  'tracking_view',
  'tracking_update',
]);

export const VALID_PROVENANCE = Object.freeze([
  'citizen_entered',
  'official_record',
  'ai_suggestion',
]);

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const SENSITIVE_KEY_RE = /\b(aadhaar|password|otp|biometric|fingerprint|iris)\b/i;

export function hasForbiddenPII(input) {
  if (!input) return false;
  if (typeof input === 'string') {
    return AADHAAR_RE.test(input) || PAN_RE.test(input);
  }
  if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (SENSITIVE_KEY_RE.test(k) && v !== undefined && v !== null && String(v).trim() !== '') {
        return true;
      }
      if (hasForbiddenPII(v)) return true;
    }
  }
  return false;
}

const getDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function readStore(storage = getDefaultStorage()) {
  if (!storage) return { delegations: {}, reminders: {}, tracking: {}, activityHistory: [] };
  try {
    const raw = storage.getItem(SENIOR_PROXY_STORAGE_KEY);
    if (!raw) return { delegations: {}, reminders: {}, tracking: {}, activityHistory: [] };
    const parsed = JSON.parse(raw);
    return {
      delegations: parsed?.delegations && typeof parsed.delegations === 'object' ? parsed.delegations : {},
      reminders: parsed?.reminders && typeof parsed.reminders === 'object' ? parsed.reminders : {},
      tracking: parsed?.tracking && typeof parsed.tracking === 'object' ? parsed.tracking : {},
      activityHistory: Array.isArray(parsed?.activityHistory) ? parsed.activityHistory : [],
    };
  } catch {
    return { delegations: {}, reminders: {}, tracking: {}, activityHistory: [] };
  }
}

function writeStore(store, storage = getDefaultStorage()) {
  if (!storage) return false;
  storage.setItem(SENIOR_PROXY_STORAGE_KEY, JSON.stringify(store));
  return true;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function recordActivity(store, { delegationId, seniorOwnerId, actorId, action, outcome, detail = '' }) {
  store.activityHistory.push({
    activityId: makeId('act'),
    timestamp: new Date().toISOString(),
    delegationId,
    seniorOwnerId,
    actorId: actorId || 'anonymous',
    action,
    outcome,
    detail: String(detail || '').slice(0, 140),
  });
}

export function isDelegationActive(delegation, nowMs = Date.now()) {
  if (!delegation) return { active: false, reason: 'Delegation not found.' };
  if (delegation.status === 'revoked') {
    return { active: false, reason: 'Delegation was revoked by the senior citizen owner.' };
  }
  if (!delegation.ownerApproved || delegation.status !== 'active') {
    return { active: false, reason: 'Delegation is awaiting senior citizen owner approval.' };
  }
  const expMs = Date.parse(delegation.expiresAt);
  if (Number.isNaN(expMs) || expMs <= nowMs) {
    return { active: false, reason: 'Delegation permission has expired.' };
  }
  return { active: true };
}

export function createProxyDelegation({
  seniorOwnerId,
  proxyActorId,
  proxyLabel,
  relationship = 'family_helper',
  permissions = ['checklist_edit', 'tracking_view'],
  expiresAt,
  ownerApproved = false,
  storage = getDefaultStorage(),
}) {
  if (!seniorOwnerId) return { ok: false, code: 401, error: 'Authentication required.' };
  if (!proxyActorId || String(proxyActorId).trim() === seniorOwnerId) {
    return { ok: false, code: 400, error: 'Proxy must use a separate credential distinct from the senior owner.' };
  }
  if (hasForbiddenPII({ proxyLabel, relationship })) {
    return { ok: false, code: 400, error: 'Delegation must not contain Aadhaar, PAN, OTPs, or passwords.' };
  }
  if (!proxyLabel || !String(proxyLabel).trim()) {
    return { ok: false, code: 400, error: 'proxyLabel is required.' };
  }
  const expMs = Date.parse(expiresAt);
  if (!expiresAt || Number.isNaN(expMs) || expMs <= Date.now()) {
    return { ok: false, code: 400, error: 'A valid future expiresAt timestamp is required.' };
  }

  const sanitizedPerms = Array.isArray(permissions)
    ? [...new Set(permissions.filter((p) => VALID_PROXY_PERMISSIONS.includes(p)))]
    : [];
  if (sanitizedPerms.length === 0) {
    return { ok: false, code: 400, error: 'At least one valid proxy permission is required.' };
  }

  const store = readStore(storage);
  const delegationId = makeId('del');
  const delegation = {
    delegationId,
    seniorOwnerId,
    proxyActorId: String(proxyActorId).trim(),
    proxyLabel: String(proxyLabel).trim(),
    relationship: String(relationship || 'helper').trim(),
    permissions: sanitizedPerms,
    ownerApproved: Boolean(ownerApproved),
    status: ownerApproved ? 'active' : 'pending_owner_approval',
    expiresAt: new Date(expMs).toISOString(),
    revocationVersion: 0,
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };

  store.delegations[delegationId] = delegation;
  recordActivity(store, {
    delegationId,
    seniorOwnerId,
    actorId: seniorOwnerId,
    action: 'create_delegation',
    outcome: 'allowed',
    detail: `approved=${delegation.ownerApproved},perms=${sanitizedPerms.join('|')}`,
  });
  writeStore(store, storage);
  return { ok: true, delegation };
}

export function approveProxyDelegation({
  delegationId,
  actorId,
  expiresAt = null,
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const del = store.delegations[delegationId];
  if (!del) return { ok: false, code: 404, error: 'Delegation not found.' };
  if (del.seniorOwnerId !== actorId) {
    recordActivity(store, {
      delegationId,
      seniorOwnerId: del.seniorOwnerId,
      actorId,
      action: 'approve_delegation',
      outcome: 'denied',
    });
    writeStore(store, storage);
    return { ok: false, code: 403, error: 'Only the senior citizen owner can approve this proxy.' };
  }
  if (del.status === 'revoked') {
    return { ok: false, code: 409, error: 'Revoked delegations cannot be re-approved; create a new delegation.' };
  }
  if (expiresAt) {
    const expMs = Date.parse(expiresAt);
    if (Number.isNaN(expMs) || expMs <= Date.now()) {
      return { ok: false, code: 400, error: 'Invalid future expiresAt.' };
    }
    del.expiresAt = new Date(expMs).toISOString();
  }
  del.ownerApproved = true;
  del.status = 'active';
  del.approvedAt = new Date().toISOString();

  recordActivity(store, {
    delegationId,
    seniorOwnerId: del.seniorOwnerId,
    actorId,
    action: 'approve_delegation',
    outcome: 'allowed',
  });
  writeStore(store, storage);
  return { ok: true, delegation: del };
}

export function revokeProxyDelegation({
  delegationId,
  actorId,
  reason = 'Owner revoked access',
  storage = getDefaultStorage(),
}) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const del = store.delegations[delegationId];
  if (!del) return { ok: false, code: 404, error: 'Delegation not found.' };
  if (del.seniorOwnerId !== actorId) {
    recordActivity(store, {
      delegationId,
      seniorOwnerId: del.seniorOwnerId,
      actorId,
      action: 'revoke_delegation',
      outcome: 'denied',
    });
    writeStore(store, storage);
    return { ok: false, code: 403, error: 'Only the senior citizen owner can revoke this proxy.' };
  }

  del.status = 'revoked';
  del.ownerApproved = false;
  del.revokedAt = new Date().toISOString();
  del.revocationVersion = (del.revocationVersion || 0) + 1;

  recordActivity(store, {
    delegationId,
    seniorOwnerId: del.seniorOwnerId,
    actorId,
    action: 'revoke_delegation',
    outcome: 'allowed',
    detail: String(reason || '').slice(0, 80),
  });
  writeStore(store, storage);
  return { ok: true, delegation: del };
}

function authorizeProxyAction({ store, delegationId, actorId, requiredPermission, nowMs = Date.now() }) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const del = store.delegations[delegationId];
  if (!del) return { ok: false, code: 404, error: 'Delegation not found.' };

  // Owner always retains control on their own records, or proxy with active grant
  if (actorId === del.seniorOwnerId) {
    return { ok: true, delegation: del, isOwner: true };
  }

  if (actorId !== del.proxyActorId) {
    return { ok: false, code: 403, error: 'Unauthorized actor for this senior citizen delegation.' };
  }

  const activeCheck = isDelegationActive(del, nowMs);
  if (!activeCheck.active) {
    return { ok: false, code: 403, error: activeCheck.reason };
  }

  if (!del.permissions.includes(requiredPermission)) {
    return { ok: false, code: 403, error: `Proxy lacks '${requiredPermission}' permission.` };
  }

  return { ok: true, delegation: del, isOwner: false };
}

export function performDelegatedChecklistEdit({
  delegationId,
  actorId,
  applicationId,
  itemLabel,
  checked,
  provenance = 'citizen_entered',
  nowMs = Date.now(),
  storage = getDefaultStorage(),
}) {
  if (hasForbiddenPII({ applicationId, itemLabel })) {
    return { ok: false, code: 400, error: 'Checklist items must not contain Aadhaar, PAN, OTPs, or passwords.' };
  }
  const store = readStore(storage);
  const auth = authorizeProxyAction({
    store,
    delegationId,
    actorId,
    requiredPermission: 'checklist_edit',
    nowMs,
  });
  if (!auth.ok) {
    if (store.delegations[delegationId]) {
      recordActivity(store, {
        delegationId,
        seniorOwnerId: store.delegations[delegationId].seniorOwnerId,
        actorId,
        action: 'checklist_edit',
        outcome: 'denied',
        detail: auth.error,
      });
      writeStore(store, storage);
    }
    return auth;
  }

  const checklistId = `proxy:${auth.delegation.seniorOwnerId}:${applicationId}`;
  const current = readChecklist(checklistId, storage);
  const nextSet = new Set(current.checked);
  if (checked) nextSet.add(itemLabel);
  else nextSet.delete(itemLabel);

  const writeRes = writeChecklist(checklistId, [...nextSet], current.rev, storage);
  if (!writeRes.ok) {
    return { ok: false, code: 409, error: `Checklist save ${writeRes.reason}` };
  }

  const safeProv = VALID_PROVENANCE.includes(provenance) ? provenance : 'citizen_entered';
  recordActivity(store, {
    delegationId,
    seniorOwnerId: auth.delegation.seniorOwnerId,
    actorId,
    action: 'checklist_edit',
    outcome: 'allowed',
    detail: `app=${applicationId},checked=${Boolean(checked)},prov=${safeProv}`,
  });
  writeStore(store, storage);
  return { ok: true, state: writeRes.state, provenance: safeProv };
}

export function performDelegatedReminder({
  delegationId,
  actorId,
  title,
  dueDate,
  provenance = 'citizen_entered',
  nowMs = Date.now(),
  storage = getDefaultStorage(),
}) {
  if (hasForbiddenPII({ title, dueDate })) {
    return { ok: false, code: 400, error: 'Reminder must not contain Aadhaar, PAN, OTPs, or passwords.' };
  }
  if (!title || !String(title).trim()) {
    return { ok: false, code: 400, error: 'Reminder title is required.' };
  }

  const store = readStore(storage);
  const auth = authorizeProxyAction({
    store,
    delegationId,
    actorId,
    requiredPermission: 'reminders_manage',
    nowMs,
  });
  if (!auth.ok) {
    if (store.delegations[delegationId]) {
      recordActivity(store, {
        delegationId,
        seniorOwnerId: store.delegations[delegationId].seniorOwnerId,
        actorId,
        action: 'reminders_manage',
        outcome: 'denied',
      });
      writeStore(store, storage);
    }
    return auth;
  }

  const reminderId = makeId('rem');
  const reminder = {
    reminderId,
    seniorOwnerId: auth.delegation.seniorOwnerId,
    createdBy: actorId,
    title: String(title).trim(),
    dueDate: dueDate || null,
    provenance: VALID_PROVENANCE.includes(provenance) ? provenance : 'citizen_entered',
    createdAt: new Date().toISOString(),
  };

  store.reminders[reminderId] = reminder;
  recordActivity(store, {
    delegationId,
    seniorOwnerId: auth.delegation.seniorOwnerId,
    actorId,
    action: 'reminders_manage',
    outcome: 'allowed',
    detail: `rem=${reminderId}`,
  });
  writeStore(store, storage);
  return { ok: true, reminder };
}

export function performDelegatedTrackingUpdate({
  delegationId,
  actorId,
  applicationId,
  status = 'submitted',
  note = '',
  officialSource = '',
  jurisdiction = 'UNVERIFIED',
  effectiveDate = '',
  lastVerifiedAt = '',
  nowMs = Date.now(),
  storage = getDefaultStorage(),
}) {
  if (hasForbiddenPII({ applicationId, note, officialSource })) {
    return { ok: false, code: 400, error: 'Tracking update must not contain Aadhaar, PAN, OTPs, or passwords.' };
  }
  const store = readStore(storage);
  const auth = authorizeProxyAction({
    store,
    delegationId,
    actorId,
    requiredPermission: 'tracking_update',
    nowMs,
  });
  if (!auth.ok) {
    if (store.delegations[delegationId]) {
      recordActivity(store, {
        delegationId,
        seniorOwnerId: store.delegations[delegationId].seniorOwnerId,
        actorId,
        action: 'tracking_update',
        outcome: 'denied',
      });
      writeStore(store, storage);
    }
    return auth;
  }

  const normalized = normalizeStatus(status);
  const isVerified = Boolean(officialSource && effectiveDate && lastVerifiedAt);
  const record = {
    applicationId,
    seniorOwnerId: auth.delegation.seniorOwnerId,
    status: normalized,
    statusLabel: STATUS_META[normalized].label,
    note: String(note || '').trim(),
    provenance: officialSource ? 'official_record' : 'citizen_entered',
    officialMetadata: {
      source: officialSource || null,
      jurisdiction: jurisdiction || 'UNVERIFIED',
      effectiveDate: effectiveDate || null,
      lastVerifiedAt: lastVerifiedAt || null,
      verificationStatus: isVerified ? 'VERIFIED' : 'UNVERIFIED',
    },
    updatedBy: actorId,
    updatedAt: new Date().toISOString(),
  };

  store.tracking[applicationId] = record;
  recordActivity(store, {
    delegationId,
    seniorOwnerId: auth.delegation.seniorOwnerId,
    actorId,
    action: 'tracking_update',
    outcome: 'allowed',
    detail: `app=${applicationId},status=${normalized}`,
  });
  writeStore(store, storage);
  return { ok: true, tracking: record };
}

export function getProxyActivityHistory({ delegationId, actorId, storage = getDefaultStorage() }) {
  if (!actorId) return { ok: false, code: 401, error: 'Authentication required.' };
  const store = readStore(storage);
  const del = store.delegations[delegationId];
  if (!del) return { ok: false, code: 404, error: 'Delegation not found.' };
  if (del.seniorOwnerId !== actorId) {
    return { ok: false, code: 403, error: 'Only the senior citizen owner can inspect full proxy activity history.' };
  }
  const entries = store.activityHistory.filter((e) => e.delegationId === delegationId);
  return { ok: true, entries, delegation: del };
}
