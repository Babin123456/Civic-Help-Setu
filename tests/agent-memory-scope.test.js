import { describe, it, expect, beforeEach } from 'vitest';
import { createAgentMemoryScopeHandler } from '../api/_lib/handlers/agent-memory-scope.js';
import {
  InMemoryAgentMemoryScopeStore,
  resetDefaultAgentMemoryScopeStoreForTests,
} from '../api/_lib/agentMemoryScopeStore.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';
import { MEMORY_ORIGINS, MEMORY_SCOPE_MODES } from '../src/services/agentMemory/memoryScopeIsolationLayer.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
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
}

describe('Agent Memory Scope API Handler (#1447)', () => {
  let store;

  beforeEach(() => {
    resetDefaultAgentMemoryScopeStoreForTests();
    store = new InMemoryAgentMemoryScopeStore();
  });

  it('enforces authentication, tenant/case isolation, no-memory mode, and deletion', async () => {
    const handler = createAgentMemoryScopeHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyActor: async (req) => {
        const auth = req.headers?.authorization;
        if (!auth) return { ok: false, status: 401, error: 'Authentication required.' };
        if (auth === 'Bearer tenant-b-user') return { ok: true, actorId: 'u-b', role: 'citizen', tenantId: 'tenant-b' };
        return { ok: true, actorId: 'admin-1', role: 'admin', tenantId: '*' };
      },
    });

    // 401 unauthenticated
    const res401 = createMockRes();
    await handler(
      { method: 'GET', url: '/api/agent-memory-scope/partitions/tenant-a/case-1/context', headers: {} },
      res401
    );
    expect(res401.statusCode).toBe(401);

    // 403 cross-tenant access
    const res403Tenant = createMockRes();
    await handler(
      {
        method: 'GET',
        url: '/api/agent-memory-scope/partitions/tenant-a/case-1/context',
        headers: { authorization: 'Bearer tenant-b-user' },
      },
      res403Tenant
    );
    expect(res403Tenant.statusCode).toBe(403);

    // 403 cross-case header mismatch
    const res403Case = createMockRes();
    await handler(
      {
        method: 'GET',
        url: '/api/agent-memory-scope/partitions/tenant-a/case-1/context',
        headers: { authorization: 'Bearer admin-1', 'x-case-id': 'case-2' },
      },
      res403Case
    );
    expect(res403Case.statusCode).toBe(403);

    // 201 create scoped entry
    const resCreate = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/agent-memory-scope/partitions/tenant-a/case-1/entries',
        headers: { authorization: 'Bearer admin-1' },
        body: {
          origin: MEMORY_ORIGINS.CITIZEN_FACT,
          category: 'interaction_summary',
          content: 'Citizen requested Hindi birth certificate checklist.',
        },
      },
      resCreate
    );
    expect(resCreate.statusCode).toBe(201);

    // Deterministic no-memory mode returns []
    const resMode = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/agent-memory-scope/partitions/tenant-a/case-1/mode',
        headers: { authorization: 'Bearer admin-1' },
        body: { mode: MEMORY_SCOPE_MODES.NO_MEMORY },
      },
      resMode
    );
    expect(resMode.statusCode).toBe(200);

    const resNoMem = createMockRes();
    await handler(
      {
        method: 'GET',
        url: '/api/agent-memory-scope/partitions/tenant-a/case-1/context',
        headers: { authorization: 'Bearer admin-1' },
      },
      resNoMem
    );
    expect(resNoMem.statusCode).toBe(200);
    expect(resNoMem.body.deterministicNoMemory).toBe(true);
    expect(resNoMem.body.entries).toEqual([]);

    // Delete partition
    const resDel = createMockRes();
    await handler(
      {
        method: 'DELETE',
        url: '/api/agent-memory-scope/partitions/tenant-a/case-1',
        headers: { authorization: 'Bearer admin-1' },
      },
      resDel
    );
    expect(resDel.statusCode).toBe(200);
    expect(resDel.body.deleted).toBe(true);
  });

  it('rejects secrets and Aadhaar numbers on write', async () => {
    const handler = createAgentMemoryScopeHandler({
      getStore: async () => store,
      rateLimiter: createRateLimiter({ limit: 50, windowMs: 60000 }),
      verifyActor: async () => ({ ok: true, actorId: 'admin-1', role: 'admin', tenantId: '*' }),
    });

    const resSecret = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/agent-memory-scope/partitions/tenant-a/case-1/entries',
        headers: { authorization: 'Bearer admin-1' },
        body: {
          origin: MEMORY_ORIGINS.CITIZEN_FACT,
          category: 'interaction_summary',
          content: 'Aadhaar 2345 6789 0123 and sk-secretkey1234567890abcd',
        },
      },
      resSecret
    );
    expect(resSecret.statusCode).toBe(400);
    expect(resSecret.body.code).toBe('ERR_SECRET_OR_PII_EXCLUDED');
  });
});
