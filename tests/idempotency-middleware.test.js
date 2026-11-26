import { describe, it, expect, vi } from 'vitest';
import {
  createIdempotencyLayer,
  canonicalPayloadHash,
  isValidIdempotencyKey,
} from '../api/_lib/idempotencyMiddleware.js';
import { createInMemoryIdempotencyStore } from '../api/_lib/idempotencyStore.js';
import { createApiDispatcher } from '../api/[...path].js';

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    writableEnded: false,
    headersSent: false,
    body: undefined,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
      return res;
    },
    getHeader(name) {
      return headers[String(name).toLowerCase()];
    },
    removeHeader(name) {
      delete headers[String(name).toLowerCase()];
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      res.writableEnded = true;
      res.headersSent = true;
      return res;
    },
    send(payload) {
      res.body = payload;
      res.writableEnded = true;
      res.headersSent = true;
      return res;
    },
  };
  return { res, headers };
}

describe('HTTP Idempotency-Key Middleware (#1335)', () => {
  it('validates Idempotency-Key format and canonicalizes JSON key order', () => {
    expect(isValidIdempotencyKey('req-12345678')).toBe(true);
    expect(isValidIdempotencyKey('short')).toBe(false);
    expect(isValidIdempotencyKey('bad key with spaces!')).toBe(false);

    const h1 = canonicalPayloadHash({ method: 'POST', route: 'public-toilets', body: { a: 1, b: { x: 2, y: 3 } } });
    const h2 = canonicalPayloadHash({ method: 'POST', route: 'public-toilets', body: { b: { y: 3, x: 2 }, a: 1 } });
    expect(h1).toBe(h2);
  });

  it('replays completed response on retry without re-executing handler', async () => {
    const layer = createIdempotencyLayer();
    let calls = 0;
    const handler = async (req, res) => {
      calls += 1;
      return res.status(201).json({ ok: true, id: `rec-${calls}` });
    };

    const req1 = { method: 'POST', headers: { 'idempotency-key': 'idem-retry-0001', 'x-real-ip': '203.0.113.10' }, body: { ward: 4 } };
    const { res: res1, headers: h1 } = createMockRes();
    await layer.execute(req1, res1, 'public-toilets', handler);

    expect(res1.statusCode).toBe(201);
    expect(res1.body).toEqual({ ok: true, id: 'rec-1' });
    expect(h1['x-idempotency-replayed']).toBeUndefined();

    const req2 = { method: 'POST', headers: { 'idempotency-key': 'idem-retry-0001', 'x-real-ip': '203.0.113.10' }, body: { ward: 4 } };
    const { res: res2, headers: h2 } = createMockRes();
    await layer.execute(req2, res2, 'public-toilets', handler);

    expect(calls).toBe(1);
    expect(res2.statusCode).toBe(201);
    expect(res2.body).toEqual({ ok: true, id: 'rec-1' });
    expect(h2['x-idempotency-replayed']).toBe('true');
  });

  it('coalesces concurrent in-flight requests with identical key and payload', async () => {
    const layer = createIdempotencyLayer();
    let calls = 0;
    const handler = async (req, res) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 25));
      return res.status(201).json({ created: calls });
    };

    const makeReq = () => ({
      method: 'POST',
      headers: { 'idempotency-key': 'idem-concurrent-01', 'x-real-ip': '203.0.113.11' },
      body: { title: 'Water outage' },
    });
    const m1 = createMockRes();
    const m2 = createMockRes();
    const m3 = createMockRes();

    await Promise.all([
      layer.execute(makeReq(), m1.res, 'water-tanker-reports', handler),
      layer.execute(makeReq(), m2.res, 'water-tanker-reports', handler),
      layer.execute(makeReq(), m3.res, 'water-tanker-reports', handler),
    ]);

    expect(calls).toBe(1);
    expect(m1.res.body).toEqual({ created: 1 });
    expect(m2.res.body).toEqual({ created: 1 });
    expect(m3.res.body).toEqual({ created: 1 });
  });

  it('returns 409 Conflict when reusing key with different payload and isolates actors', async () => {
    const layer = createIdempotencyLayer();
    const handler = async (req, res) => res.status(200).json({ ok: true, body: req.body });

    const r1 = createMockRes();
    await layer.execute(
      { method: 'POST', headers: { 'idempotency-key': 'idem-conflict-01', 'x-real-ip': '203.0.113.12' }, body: { amount: 100 } },
      r1.res,
      'ward-budget-proposals',
      handler,
    );
    expect(r1.res.statusCode).toBe(200);

    const r2 = createMockRes();
    await layer.execute(
      { method: 'POST', headers: { 'idempotency-key': 'idem-conflict-01', 'x-real-ip': '203.0.113.12' }, body: { amount: 999 } },
      r2.res,
      'ward-budget-proposals',
      handler,
    );
    expect(r2.res.statusCode).toBe(409);
    expect(r2.res.body.code).toBe('IDEMPOTENCY_KEY_CONFLICT');

    // Different actor with same key succeeds independently
    const r3 = createMockRes();
    await layer.execute(
      { method: 'POST', headers: { 'idempotency-key': 'idem-conflict-01', 'x-real-ip': '203.0.113.99' }, body: { amount: 999 } },
      r3.res,
      'ward-budget-proposals',
      handler,
    );
    expect(r3.res.statusCode).toBe(200);
  });

  it('evicts expired keys after TTL and handles degraded store failures', async () => {
    let clock = 1000;
    const store = createInMemoryIdempotencyStore({ ttlMs: 500, now: () => clock });
    const layer = createIdempotencyLayer({ store, ttlMs: 500 });
    let calls = 0;
    const handler = async (req, res) => {
      calls += 1;
      return res.status(200).json({ seq: calls });
    };

    const m1 = createMockRes();
    await layer.execute({ method: 'POST', headers: { 'idempotency-key': 'idem-ttl-00001' }, body: { a: 1 } }, m1.res, 'civic-surveys', handler);
    expect(m1.res.body).toEqual({ seq: 1 });

    clock += 600;
    const m2 = createMockRes();
    await layer.execute({ method: 'POST', headers: { 'idempotency-key': 'idem-ttl-00001' }, body: { a: 1 } }, m2.res, 'civic-surveys', handler);
    expect(calls).toBe(2);
    expect(m2.res.body).toEqual({ seq: 2 });

    // Degraded store: fail-open vs fail-closed
    const brokenStore = {
      get: vi.fn().mockRejectedValue(new Error('firestore down')),
      acquireLock: vi.fn(),
      complete: vi.fn(),
      release: vi.fn(),
    };
    const degradedLayer = createIdempotencyLayer({ store: brokenStore, failClosedRoutes: ['critical-write'] });

    const openMock = createMockRes();
    await degradedLayer.execute({ method: 'POST', headers: { 'idempotency-key': 'idem-degraded-1' }, body: {} }, openMock.res, 'civic-surveys', handler);
    expect(openMock.res.statusCode).toBe(200);

    const closedMock = createMockRes();
    await degradedLayer.execute({ method: 'POST', headers: { 'idempotency-key': 'idem-degraded-1' }, body: {} }, closedMock.res, 'critical-write', handler);
    expect(closedMock.res.statusCode).toBe(503);
  });

  it('integrates cleanly with createApiDispatcher', async () => {
    let executions = 0;
    const dispatcher = createApiDispatcher({
      extraHandlers: {
        'test-write': async (req, res) => {
          executions += 1;
          return res.status(201).json({ count: executions });
        },
      },
    });

    const m1 = createMockRes();
    await dispatcher({ method: 'POST', url: '/api/test-write', headers: { 'idempotency-key': 'dispatch-key-001' }, body: { x: 1 } }, m1.res);
    const m2 = createMockRes();
    await dispatcher({ method: 'POST', url: '/api/test-write', headers: { 'idempotency-key': 'dispatch-key-001' }, body: { x: 1 } }, m2.res);

    expect(executions).toBe(1);
    expect(m2.res.body).toEqual({ count: 1 });
    expect(m2.headers['x-idempotency-replayed']).toBe('true');
  });
});
