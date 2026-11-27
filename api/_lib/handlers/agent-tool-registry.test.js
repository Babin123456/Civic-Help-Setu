import { describe, it, expect, beforeEach } from 'vitest';
import { createAgentToolRegistryHandler } from './agent-tool-registry.js';
import { createGovernedToolRegistry } from '../../../src/services/toolRegistry/governedToolRegistry.js';
import { ERROR_CODES } from '../../../src/services/toolRegistry/toolContracts.js';
import {
  SYNTHETIC_ACTORS,
  SYNTHETIC_ARGS,
  SYNTHETIC_PROVENANCE,
  SYNTHETIC_SIGNING_SECRET,
} from '../../../src/services/toolRegistry/__fixtures__/syntheticToolFixtures.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, val) {
      this.headers[name.toLowerCase()] = val;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('api/_lib/handlers/agent-tool-registry (#1146)', () => {
  let registry;
  let currentActor;
  let handler;

  beforeEach(() => {
    registry = createGovernedToolRegistry({ secret: SYNTHETIC_SIGNING_SECRET });
    currentActor = { ok: true, actorId: SYNTHETIC_ACTORS.CITIZEN_A.actorUserId, role: 'citizen' };
    handler = createAgentToolRegistryHandler({
      verifyActor: async () => currentActor,
      getRegistry: () => registry,
      rateLimiter: null,
    });
  });

  it('exposes public schema/health and tool catalog metadata', async () => {
    const res1 = createMockRes();
    await handler({ method: 'GET', url: '/api/agent-tool-registry?schema=1', headers: {} }, res1);
    expect(res1.statusCode).toBe(200);
    expect(res1.body.service).toBe('agent-tool-registry');
    expect(res1.body.status).toBe('healthy');

    const res2 = createMockRes();
    await handler({ method: 'GET', url: '/api/agent-tool-registry/tools', headers: {} }, res2);
    expect(res2.statusCode).toBe(200);
    expect(res2.body.tools.length).toBeGreaterThanOrEqual(5);
    expect(res2.body.tools.find((t) => t.name === 'lookupServiceDetails').inputSchema).toBeTruthy();
  });

  it('blocks unauthenticated capability issuance and unknown payload fields', async () => {
    currentActor = { ok: false, status: 401, error: 'Authentication required.' };
    const unauth = createMockRes();
    await handler({
      method: 'POST',
      url: '/api/agent-tool-registry/capabilities',
      body: { toolName: 'lookupServiceDetails' },
    }, unauth);
    expect(unauth.statusCode).toBe(401);

    currentActor = { ok: true, actorId: SYNTHETIC_ACTORS.CITIZEN_A.actorUserId, role: 'citizen' };
    const badBody = createMockRes();
    await handler({
      method: 'POST',
      url: '/api/agent-tool-registry/capabilities',
      body: { toolName: 'lookupServiceDetails', forgedRole: 'admin' },
    }, badBody);
    expect(badBody.statusCode).toBe(400);
    expect(badBody.body.code).toBe('INVALID_REQUEST');
  });

  it('ignores client-supplied privilege escalation and enforces cross-user isolation', async () => {
    // Citizen tries to mint humanApproved capability
    const capRes = createMockRes();
    await handler({
      method: 'POST',
      url: '/api/agent-tool-registry/capabilities',
      body: {
        toolName: 'scheduleGrievanceFollowUp',
        sessionId: SYNTHETIC_ACTORS.CITIZEN_A.sessionId,
        humanApproved: true,
      },
    }, capRes);
    expect(capRes.statusCode).toBe(201);

    // Server strips humanApproved for citizen role, so invocation is rejected
    const invBlocked = createMockRes();
    await handler({
      method: 'POST',
      url: '/api/agent-tool-registry/invoke',
      body: {
        capabilityToken: capRes.body.capabilityToken,
        toolName: 'scheduleGrievanceFollowUp',
        args: SYNTHETIC_ARGS.VALID_REMINDER,
        sessionId: SYNTHETIC_ACTORS.CITIZEN_A.sessionId,
        humanApproved: true,
        provenance: SYNTHETIC_PROVENANCE.VALID,
      },
    }, invBlocked);
    expect(invBlocked.statusCode).toBe(403);
    expect(invBlocked.body.code).toBe(ERROR_CODES.APPROVAL_REQUIRED);

    // Mint low-risk capability for Citizen A, then try invoking as Citizen B
    const capA = createMockRes();
    await handler({
      method: 'POST',
      url: '/api/agent-tool-registry/capabilities',
      body: {
        toolName: 'lookupServiceDetails',
        sessionId: SYNTHETIC_ACTORS.CITIZEN_A.sessionId,
      },
    }, capA);

    currentActor = { ok: true, actorId: SYNTHETIC_ACTORS.CITIZEN_B.actorUserId, role: 'citizen' };
    const crossRes = createMockRes();
    await handler({
      method: 'POST',
      url: '/api/agent-tool-registry/invoke',
      body: {
        capabilityToken: capA.body.capabilityToken,
        toolName: 'lookupServiceDetails',
        args: SYNTHETIC_ARGS.VALID_LOOKUP,
        sessionId: SYNTHETIC_ACTORS.CITIZEN_A.sessionId,
      },
    }, crossRes);
    expect(crossRes.statusCode).toBe(403);
    expect(crossRes.body.code).toBe(ERROR_CODES.CROSS_USER_DENIED);
  });

  it('gates audit and revocation endpoints to admin role and scrubs telemetry', async () => {
    const citizenAudit = createMockRes();
    await handler({ method: 'GET', url: '/api/agent-tool-registry/audit', headers: {} }, citizenAudit);
    expect(citizenAudit.statusCode).toBe(403);

    const citizenRevoke = createMockRes();
    await handler({
      method: 'POST',
      url: '/api/agent-tool-registry/revoke',
      body: { targetType: 'tool', targetId: 'lookupServiceDetails', reason: 'Unauthorized' },
    }, citizenRevoke);
    expect(citizenRevoke.statusCode).toBe(403);

    // Switch to verified admin
    currentActor = { ok: true, actorId: SYNTHETIC_ACTORS.ADMIN_MOD.actorUserId, role: 'admin' };
    const adminRevoke = createMockRes();
    await handler({
      method: 'POST',
      url: '/api/agent-tool-registry/revoke',
      body: { targetType: 'tool', targetId: 'lookupServiceDetails', reason: 'Emergency maintenance' },
    }, adminRevoke);
    expect(adminRevoke.statusCode).toBe(200);

    const adminAudit = createMockRes();
    await handler({ method: 'GET', url: '/api/agent-tool-registry/audit?limit=10', headers: {} }, adminAudit);
    expect(adminAudit.statusCode).toBe(200);
    expect(adminAudit.body.revocations.revokedTools).toHaveLength(1);
  });
});
