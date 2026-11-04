import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createHelperInvitation,
  acceptHelperInvitation,
  revokeHelperDelegation,
  getCitizenHelperOverview,
  HELPER_PERMISSIONS,
} from './helperAccessWorkflowService';

describe('helperAccessWorkflowService (#477)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    });
  });

  const ownerId = 'user-owner-101';
  const ownerName = 'Kavita Devi';
  const helperDetails = {
    name: 'Rohit Kumar (Son)',
    email: 'rohit@example.com',
    relationship: 'Family Member',
  };

  it('creates an invitation with scoped permissions and records audit log', () => {
    const invite = createHelperInvitation(
      ownerId,
      ownerName,
      helperDetails,
      ['APP-1', 'APP-2'],
      [HELPER_PERMISSIONS.VIEW_MILESTONES, HELPER_PERMISSIONS.VIEW_DEADLINES]
    );

    expect(invite.token).toBeDefined();
    expect(invite.helperEmail).toBe('rohit@example.com');
    expect(invite.permissions).toContain(HELPER_PERMISSIONS.VIEW_MILESTONES);
    expect(invite.permissions).not.toContain(HELPER_PERMISSIONS.VIEW_DOCUMENTS);

    const overview = getCitizenHelperOverview(ownerId);
    expect(overview.pendingInvitations).toHaveLength(1);
    expect(overview.auditLogs).toHaveLength(1);
    expect(overview.auditLogs[0].action).toBe('INVITATION_CREATED');
  });

  it('accepts an invitation and converts it to active delegation', () => {
    const invite = createHelperInvitation(ownerId, ownerName, helperDetails, ['APP-1']);
    const res = acceptHelperInvitation(invite.token, 'rohit@example.com');

    expect(res.success).toBe(true);
    expect(res.delegation).toBeDefined();
    expect(res.delegation.active).toBe(true);

    const overview = getCitizenHelperOverview(ownerId);
    expect(overview.pendingInvitations).toHaveLength(0);
    expect(overview.activeHelpers).toHaveLength(1);
  });

  it('rejects invitation acceptance when email mismatches', () => {
    const invite = createHelperInvitation(ownerId, ownerName, helperDetails, ['APP-1']);
    const res = acceptHelperInvitation(invite.token, 'wrong@example.com');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Email mismatch');
  });

  it('revokes an active helper delegation and logs audit', () => {
    const invite = createHelperInvitation(ownerId, ownerName, helperDetails, ['APP-1']);
    const accepted = acceptHelperInvitation(invite.token, 'rohit@example.com');
    const delegationId = accepted.delegation.id;

    const revoked = revokeHelperDelegation(delegationId, ownerId);
    expect(revoked).toBe(true);

    const overview = getCitizenHelperOverview(ownerId);
    expect(overview.activeHelpers).toHaveLength(0);
    expect(overview.auditLogs.some((l) => l.action === 'DELEGATION_REVOKED')).toBe(true);
  });
});
