import { describe, it, expect, vi } from 'vitest';
import {
  createTenantRateLimiter,
  createInMemoryBucketStore,
  resolveRateLimitContext,
} from '../api/_lib/tenantRateLimiter.js';

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: undefined,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return { res, headers };
}

describe('Multi-Tenant & Jurisdiction-Scoped Rate Limiter (#1336)', () => {
  it('isolates tenants and jurisdictions without noisy-neighbor starvation', async () => {
    let clock = 10_000;
    const limiter = createTenantRateLimiter({
      now: () => clock,
      routePolicies: { 'ward-budget-proposals': { profile: 'public-write', capacity: 2, refillPerSec: 0.1 } },
    });

    const tenantAReq = { headers: { 'x-tenant-id': 'pune-mc', 'x-jurisdiction-code': 'MH-PNQ', 'x-real-ip': '198.51.100.1' } };
    const tenantBReq = { headers: { 'x-tenant-id': 'lucknow-mc', 'x-jurisdiction-code': 'UP-LKO', 'x-real-ip': '198.51.100.2' } };

    expect((await limiter.evaluate(tenantAReq, 'ward-budget-proposals')).allowed).toBe(true);
    expect((await limiter.evaluate(tenantAReq, 'ward-budget-proposals')).allowed).toBe(true);
    const blocked = await limiter.evaluate(tenantAReq, 'ward-budget-proposals');
    expect(blocked.allowed).toBe(false);
    expect(blocked.scope).toBe('actor');
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    // Tenant B remains unaffected
    expect((await limiter.evaluate(tenantBReq, 'ward-budget-proposals')).allowed).toBe(true);

    // Token refills after advancing clock
    clock += 15_000;
    expect((await limiter.evaluate(tenantAReq, 'ward-budget-proposals')).allowed).toBe(true);
  });

  it('enforces jurisdiction-level quota across distinct actors', async () => {
    const limiter = createTenantRateLimiter({
      now: () => 50_000,
      routePolicies: { 'pds-observations': { capacity: 2, refillPerSec: 0.01 } },
      jurisdictionOverrides: { 'DL-ND': { jurisdictionMultiplier: 1 } },
    });

    const actor1 = { headers: { 'x-tenant-id': 'delhi', 'x-jurisdiction-code': 'DL-ND', 'x-real-ip': '198.51.100.10' } };
    const actor2 = { headers: { 'x-tenant-id': 'delhi', 'x-jurisdiction-code': 'DL-ND', 'x-real-ip': '198.51.100.11' } };
    const actor3 = { headers: { 'x-tenant-id': 'delhi', 'x-jurisdiction-code': 'DL-ND', 'x-real-ip': '198.51.100.12' } };

    expect((await limiter.evaluate(actor1, 'pds-observations')).allowed).toBe(true);
    expect((await limiter.evaluate(actor2, 'pds-observations')).allowed).toBe(true);
    const jurBlocked = await limiter.evaluate(actor3, 'pds-observations');
    expect(jurBlocked.allowed).toBe(false);
    expect(jurBlocked.scope).toBe('jurisdiction');
  });

  it('emits RateLimit-* and Retry-After headers in middleware and supports shadow mode', async () => {
    const events = [];
    const shadowLimiter = createTenantRateLimiter({
      mode: 'shadow',
      routePolicies: { 'civic-surveys': { capacity: 1, refillPerSec: 0.01 } },
      onEvent: (e) => events.push(e),
    });

    const wrapped = shadowLimiter.middleware(() => 'civic-surveys')(async (req, res) => res.status(200).json({ ok: true }));
    const req = { headers: { 'x-tenant-id': 't1', 'x-real-ip': '198.51.100.20' } };

    const m1 = createMockRes();
    await wrapped(req, m1.res);
    expect(m1.res.statusCode).toBe(200);
    expect(m1.headers['ratelimit-limit']).toBe('1');

    const m2 = createMockRes();
    await wrapped(req, m2.res);
    expect(m2.res.statusCode).toBe(200); // shadow mode allows
    expect(events.some((e) => e.event === 'rate_limit_exceeded' && e.mode === 'shadow')).toBe(true);

    // Enforce mode blocks with 429
    const enforceLimiter = createTenantRateLimiter({
      mode: 'enforce',
      routePolicies: { 'civic-surveys': { capacity: 1, refillPerSec: 0.01 } },
    });
    const enforced = enforceLimiter.middleware(() => 'civic-surveys')(async (r, s) => s.status(200).json({ ok: true }));
    await enforced(req, createMockRes().res);
    const blockedMock = createMockRes();
    await enforced(req, blockedMock.res);
    expect(blockedMock.res.statusCode).toBe(429);
    expect(blockedMock.headers['retry-after']).toBeDefined();
  });

  it('handles degraded store failures according to fail-open / fail-closed policy', async () => {
    const brokenStore = {
      get: vi.fn().mockRejectedValue(new Error('redis timeout')),
      set: vi.fn(),
    };
    const limiter = createTenantRateLimiter({
      store: brokenStore,
      routePolicies: {
        'public-read-route': { profile: 'public-read' },
        'admin-route': { profile: 'admin-mutation' },
      },
    });

    const req = { headers: { 'x-tenant-id': 't1', 'x-real-ip': '198.51.100.30' } };
    const openDecision = await limiter.evaluate(req, 'public-read-route');
    expect(openDecision.allowed).toBe(true);
    expect(openDecision.degraded).toBe(true);

    const closedDecision = await limiter.evaluate(req, 'admin-route');
    expect(closedDecision.allowed).toBe(false);
    expect(closedDecision.degraded).toBe(true);
  });

  it('sanitizes untrusted tenant/jurisdiction headers and bounds memory store', async () => {
    const ctx = resolveRateLimitContext({
      headers: { 'x-tenant-id': 'bad/tenant/../id', 'x-jurisdiction-code': 'MH-01', 'x-real-ip': '198.51.100.40' },
    });
    expect(ctx.tenantId).toBe('default-tenant');
    expect(ctx.jurisdictionCode).toBe('MH-01');
    expect(ctx.actorHash).not.toBe('198.51.100.40');

    const store = createInMemoryBucketStore({ maxBuckets: 2 });
    await store.set('k1', { tokens: 1, updatedAt: 1 });
    await store.set('k2', { tokens: 1, updatedAt: 1 });
    await store.set('k3', { tokens: 1, updatedAt: 1 });
    expect(store.size()).toBe(2);
  });
});
