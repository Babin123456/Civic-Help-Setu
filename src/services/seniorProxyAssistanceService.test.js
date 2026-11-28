import { describe, it, expect } from 'vitest';
import {
  createProxyDelegation,
  approveProxyDelegation,
  revokeProxyDelegation,
  performDelegatedChecklistEdit,
  performDelegatedReminder,
  performDelegatedTrackingUpdate,
  getProxyActivityHistory,
  hasForbiddenPII,
} from './seniorProxyAssistanceService.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('seniorProxyAssistanceService', () => {
  it('requires owner approval, separate credentials, and enforces granular permissions', () => {
    const storage = makeMemoryStorage();
    const future = new Date(Date.now() + 3600_000).toISOString();

    // Separate credential check
    const sameCred = createProxyDelegation({
      seniorOwnerId: 'senior-1',
      proxyActorId: 'senior-1',
      proxyLabel: 'Self',
      expiresAt: future,
      storage,
    });
    expect(sameCred.ok).toBe(false);
    expect(sameCred.code).toBe(400);

    // Create pending delegation
    const created = createProxyDelegation({
      seniorOwnerId: 'senior-1',
      proxyActorId: 'helper-1',
      proxyLabel: 'Trusted Daughter',
      permissions: ['checklist_edit', 'reminders_manage'],
      expiresAt: future,
      ownerApproved: false,
      storage,
    });
    expect(created.ok).toBe(true);
    const delId = created.delegation.delegationId;

    // Blocked before owner approval
    const beforeApproval = performDelegatedChecklistEdit({
      delegationId: delId,
      actorId: 'helper-1',
      applicationId: 'app-1',
      itemLabel: 'Age Proof',
      checked: true,
      storage,
    });
    expect(beforeApproval.ok).toBe(false);
    expect(beforeApproval.code).toBe(403);

    // Proxy cannot approve their own delegation
    const selfApprove = approveProxyDelegation({ delegationId: delId, actorId: 'helper-1', storage });
    expect(selfApprove.ok).toBe(false);
    expect(selfApprove.code).toBe(403);

    // Owner approves
    const approved = approveProxyDelegation({ delegationId: delId, actorId: 'senior-1', storage });
    expect(approved.ok).toBe(true);

    // Permitted checklist edit & reminder succeed
    const editOk = performDelegatedChecklistEdit({
      delegationId: delId,
      actorId: 'helper-1',
      applicationId: 'app-1',
      itemLabel: 'Age Proof',
      checked: true,
      storage,
    });
    expect(editOk.ok).toBe(true);

    const remOk = performDelegatedReminder({
      delegationId: delId,
      actorId: 'helper-1',
      title: 'Submit Pension Form',
      dueDate: future,
      storage,
    });
    expect(remOk.ok).toBe(true);

    // Unpermitted tracking_update is blocked (403)
    const trackDenied = performDelegatedTrackingUpdate({
      delegationId: delId,
      actorId: 'helper-1',
      applicationId: 'app-1',
      status: 'completed',
      storage,
    });
    expect(trackDenied.ok).toBe(false);
    expect(trackDenied.code).toBe(403);
  });

  it('propagates revocation immediately and enforces permission expiry', () => {
    const storage = makeMemoryStorage();
    const future = new Date(Date.now() + 3600_000).toISOString();

    const created = createProxyDelegation({
      seniorOwnerId: 'senior-2',
      proxyActorId: 'helper-2',
      proxyLabel: 'Community Volunteer',
      permissions: ['checklist_edit', 'tracking_update'],
      expiresAt: future,
      ownerApproved: true,
      storage,
    });
    const delId = created.delegation.delegationId;

    // Expired check (simulate nowMs > expiresAt)
    const expiredAttempt = performDelegatedTrackingUpdate({
      delegationId: delId,
      actorId: 'helper-2',
      applicationId: 'app-2',
      status: 'in-progress',
      nowMs: Date.now() + 7200_000,
      storage,
    });
    expect(expiredAttempt.ok).toBe(false);
    expect(expiredAttempt.code).toBe(403);

    // Revoke immediately
    const rev = revokeProxyDelegation({ delegationId: delId, actorId: 'senior-2', storage });
    expect(rev.ok).toBe(true);
    expect(rev.delegation.status).toBe('revoked');

    // Proxy immediately blocked after revocation
    const postRevoke = performDelegatedChecklistEdit({
      delegationId: delId,
      actorId: 'helper-2',
      applicationId: 'app-2',
      itemLabel: 'Bank Passbook',
      checked: true,
      storage,
    });
    expect(postRevoke.ok).toBe(false);
    expect(postRevoke.code).toBe(403);

    // Activity history is readable by owner only
    expect(getProxyActivityHistory({ delegationId: delId, actorId: 'helper-2', storage }).code).toBe(403);
    const hist = getProxyActivityHistory({ delegationId: delId, actorId: 'senior-2', storage });
    expect(hist.ok).toBe(true);
    expect(hist.entries.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects sensitive PII (Aadhaar, PAN, OTP, password)', () => {
    expect(hasForbiddenPII('1234 5678 9012')).toBe(true);
    expect(hasForbiddenPII({ password: 'secret' })).toBe(true);
  });
});
