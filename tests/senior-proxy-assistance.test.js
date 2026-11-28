import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/senior-proxy-assistance.js';

function mockRes() {
  const out = { statusCode: 200, body: null };
  return {
    status(code) {
      out.statusCode = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return out;
    },
  };
}

describe('senior-proxy-assistance API handler', () => {
  it('returns 401 when unauthenticated and 400 when PII is supplied', async () => {
    const unauth = await handler(
      { method: 'GET', url: '/activity', headers: {}, query: {} },
      mockRes()
    );
    expect(unauth.statusCode).toBe(401);

    const pii = await handler(
      {
        method: 'POST',
        url: '/delegations',
        headers: { 'x-user-id': 'senior-api-1' },
        body: {
          proxyActorId: 'helper-api-1',
          proxyLabel: 'Helper 1234 5678 9012',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        },
      },
      mockRes()
    );
    expect(pii.statusCode).toBe(400);
    expect(pii.body.error).toBe('pii_rejected');
  });

  it('enforces owner approval, separate credentials, revocation propagation, and unauthorized-access blocks', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();

    const created = await handler(
      {
        method: 'POST',
        url: '/delegations',
        headers: { 'x-user-id': 'senior-api-1' },
        body: {
          proxyActorId: 'helper-api-1',
          proxyLabel: 'Trusted Neighbor',
          permissions: ['checklist_edit', 'tracking_update'],
          expiresAt: future,
          ownerApproved: false,
        },
      },
      mockRes()
    );
    expect(created.statusCode).toBe(201);
    const delegationId = created.body.delegation.delegationId;

    // Unauthorized random user -> 403
    const intruderEdit = await handler(
      {
        method: 'POST',
        url: '/checklist-edit',
        headers: { 'x-user-id': 'intruder-99' },
        body: { delegationId, applicationId: 'pen-1', itemLabel: 'ID', checked: true },
      },
      mockRes()
    );
    expect(intruderEdit.statusCode).toBe(403);

    // Owner approves -> 200
    const approved = await handler(
      {
        method: 'POST',
        url: '/approve',
        headers: { 'x-user-id': 'senior-api-1' },
        body: { delegationId },
      },
      mockRes()
    );
    expect(approved.statusCode).toBe(200);

    // Proxy performs tracking update -> 200
    const track = await handler(
      {
        method: 'POST',
        url: '/tracking-update',
        headers: { 'x-user-id': 'helper-api-1' },
        body: { delegationId, applicationId: 'pen-1', status: 'in-progress' },
      },
      mockRes()
    );
    expect(track.statusCode).toBe(200);
    expect(track.body.tracking.officialMetadata.verificationStatus).toBe('UNVERIFIED');

    // Owner revokes -> 200
    const revoked = await handler(
      {
        method: 'POST',
        url: '/revoke',
        headers: { 'x-user-id': 'senior-api-1' },
        body: { delegationId },
      },
      mockRes()
    );
    expect(revoked.statusCode).toBe(200);

    // Proxy immediately blocked -> 403
    const postRevoke = await handler(
      {
        method: 'POST',
        url: '/tracking-update',
        headers: { 'x-user-id': 'helper-api-1' },
        body: { delegationId, applicationId: 'pen-1', status: 'completed' },
      },
      mockRes()
    );
    expect(postRevoke.statusCode).toBe(403);
  });
});
