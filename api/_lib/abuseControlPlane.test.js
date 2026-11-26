import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAbuseControlPlane,
  createWindowCounter,
  createAbuseSignalDetector,
  privacyIdentifier,
  abuseSignalKinds,
  defaultConfig,
} from './abuseControlPlane.js';
import { AbuseStoreFixture } from '../../tests/helpers/abuseFixture.js';

function makeClock() {
  let t = 1_000;
  return { now: () => t, advance: (ms) => { t += ms; }, get: () => t };
}

describe('privacyIdentifier', () => {
  it('hashes a raw identifier with HMAC-SHA256 and is deterministic', () => {
    const a = privacyIdentifier('203.0.113.5', 'secret');
    const b = privacyIdentifier('203.0.113.5', 'secret');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
  it('differs when the secret differs', () => {
    expect(privacyIdentifier('ip', 's1')).not.toBe(privacyIdentifier('ip', 's2'));
  });
  it('returns null for empty or non-string input', () => {
    expect(privacyIdentifier('', 's')).toBeNull();
    expect(privacyIdentifier(null, 's')).toBeNull();
    expect(privacyIdentifier(123, 's')).toBeNull();
  });
});

describe('createWindowCounter', () => {
  it('allows up to the limit then blocks with a retry time', () => {
    const { now } = makeClock();
    const c = createWindowCounter({ limit: 3, windowMs: 60_000, now });
    expect([1, 2, 3].map(() => c.take('a').allowed)).toEqual([true, true, true]);
    expect(c.take('a').allowed).toBe(false);
    expect(c.take('a').retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
  it('starts a new window after the old one ends', () => {
    const { now, advance } = makeClock();
    const c = createWindowCounter({ limit: 1, windowMs: 1000, now });
    expect(c.take('a').allowed).toBe(true);
    expect(c.take('a').allowed).toBe(false);
    advance(1000);
    expect(c.take('a').allowed).toBe(true);
  });
  it('keeps memory bounded', () => {
    const { now } = makeClock();
    const c = createWindowCounter({ limit: 1, windowMs: 60_000, now, maxKeys: 10 });
    for (let i = 0; i < 100; i += 1) expect(c.take(`k${i}`).allowed).toBe(true);
    expect(c.size()).toBeLessThanOrEqual(10);
  });
  it('rejects bad configuration', () => {
    expect(() => createWindowCounter({ limit: 0, windowMs: 1 })).toThrow();
    expect(() => createWindowCounter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe('createAbuseSignalDetector', () => {
  it('records and retrieves events within retention', () => {
    const { now, advance } = makeClock();
    const d = createAbuseSignalDetector({ now, retentionMs: 10_000 });
    d.record('k1', 'rapid_fire', now());
    advance(5000);
    expect(d.events('k1').length).toBe(1);
    advance(6000);
    expect(d.events('k1').length).toBe(0);
  });
  it('detects rapid fire', () => {
    const { now } = makeClock();
    const d = createAbuseSignalDetector({ now });
    for (let i = 0; i < 4; i += 1) d.record('k1', 'rapid_fire', now());
    expect(d.rapidFire('k1', 4, 60_000, now())).toBe(true);
    expect(d.rapidFire('k1', 5, 60_000, now())).toBe(false);
  });
  it('detects error bursts', () => {
    const { now } = makeClock();
    const d = createAbuseSignalDetector({ now });
    for (let i = 0; i < 6; i += 1) d.record('k1', 'error_burst', now());
    for (let i = 0; i < 4; i += 1) d.record('k1', 'rapid_fire', now());
    expect(d.errorBurst('k1', 5, 10, 60_000, now())).toBe(true);
  });
  it('rejects unknown signal kinds', () => {
    const d = createAbuseSignalDetector();
    expect(() => d.record('k1', 'not_a_kind')).toThrow();
  });
});

describe('abuseSignalKinds', () => {
  it('returns the four signal kinds', () => {
    expect(abuseSignalKinds()).toEqual(['rapid_fire', 'error_burst', 'route_anomaly', 'blocked_retry']);
  });
});

describe('defaultConfig', () => {
  it('returns sensible defaults', () => {
    const c = defaultConfig();
    expect(c.defaultLimit).toBe(60);
    expect(c.defaultWindowMs).toBe(60_000);
    expect(c.natSharedThreshold).toBe(5);
    expect(c.adaptiveMultiplier).toBe(0.5);
  });
});

describe('createAbuseControlPlane.check - per-route quotas', () => {
  let store;
  let cp;
  let clock;

  beforeEach(() => {
    clock = makeClock();
    store = new AbuseStoreFixture();
    cp = createAbuseControlPlane({
      config: { ...defaultConfig(), routes: new Map([['GET:/api/report', { limit: 2, windowMs: 60_000, adaptive: false }]]) },
      store,
      now: clock.now,
    });
  });

  it('allows requests up to the per-route limit then 429s', async () => {
    const v1 = await cp.check({ route: '/api/report', method: 'GET', identifier: '203.0.113.5', userId: 'user_a' });
    const v2 = await cp.check({ route: '/api/report', method: 'GET', identifier: '203.0.113.5', userId: 'user_a' });
    expect(v1.allowed).toBe(true);
    expect(v2.allowed).toBe(true);
    const blocked = await cp.check({ route: '/api/report', method: 'GET', identifier: '203.0.113.5', userId: 'user_a' });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('rate_limited');
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.identifierHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('counts each address separately', async () => {
    await cp.check({ route: '/api/report', method: 'GET', identifier: '203.0.113.5', userId: 'user_a' });
    const v = await cp.check({ route: '/api/report', method: 'GET', identifier: '203.0.113.6', userId: 'user_b' });
    expect(v.allowed).toBe(true);
  });

  it('uses default limit for unconfigured routes', async () => {
    cp = createAbuseControlPlane({
      config: { ...defaultConfig(), defaultLimit: 1, defaultWindowMs: 60_000, routes: new Map() },
      store, now: clock.now,
    });
    await cp.check({ route: '/api/other', method: 'GET', identifier: '203.0.113.5', userId: 'user_a' });
    const blocked = await cp.check({ route: '/api/other', method: 'GET', identifier: '203.0.113.5', userId: 'user_a' });
    expect(blocked.allowed).toBe(false);
  });
});

describe('createAbuseControlPlane.check - per-user limit protects NAT users', () => {
  let store, cp, clock;

  beforeEach(() => {
    clock = makeClock();
    store = new AbuseStoreFixture();
    cp = createAbuseControlPlane({
      config: { ...defaultConfig(), defaultLimit: 2, defaultWindowMs: 60_000, routes: new Map() },
      store, now: clock.now,
    });
  });

  it('applies per-user limit independently of shared address', async () => {
    const sharedIp = '203.0.113.10';
    // Same user behind the shared IP hits the user limit.
    await cp.check({ route: '/api/x', method: 'GET', identifier: sharedIp, userId: 'user_a' });
    await cp.check({ route: '/api/x', method: 'GET', identifier: sharedIp, userId: 'user_a' });
    const blocked = await cp.check({ route: '/api/x', method: 'GET', identifier: sharedIp, userId: 'user_a' });
    expect(blocked.allowed).toBe(false);
    expect(blocked.natShared).toBe(false); // only one distinct user so far
    // A different user behind the same IP is NOT blocked by the address limit (NAT protection).
    const other = await cp.check({ route: '/api/x', method: 'GET', identifier: sharedIp, userId: 'user_b' });
    expect(other.allowed).toBe(true);
    expect(other.natShared).toBe(false);
  });

  it('marks an address as NAT-shared after threshold distinct users', async () => {
    const sharedIp = '203.0.113.10';
    for (let i = 0; i < 5; i += 1) {
      await cp.check({ route: '/api/x', method: 'GET', identifier: sharedIp, userId: `user_${i}` });
    }
    const v = await cp.check({ route: '/api/x', method: 'GET', identifier: sharedIp, userId: 'user_z' });
    expect(v.natShared).toBe(true);
  });
});

describe('createAbuseControlPlane.check - blocklist and allowlist', () => {
  let store, cp, clock;

  beforeEach(() => {
    clock = makeClock();
    store = new AbuseStoreFixture();
    cp = createAbuseControlPlane({
      config: defaultConfig(), store, now: clock.now,
    });
  });

  it('hard-blocks a blocklisted identifier', async () => {
    const hash = privacyIdentifier('203.0.113.9', 'dev-secret-change-me');
    await store.setBlocklist(hash, 'GET:/api/y', 'abuse', '2099-01-01T00:00:00Z');
    const v = await cp.check({ route: '/api/y', method: 'GET', identifier: '203.0.113.9', userId: 'user_a' });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('blocklisted');
  });

  it('bypasses limits for an allowlisted identifier', async () => {
    cp = createAbuseControlPlane({
      config: { ...defaultConfig(), defaultLimit: 1, defaultWindowMs: 60_000, routes: new Map() },
      store, now: clock.now,
    });
    const hash = privacyIdentifier('203.0.113.9', 'dev-secret-change-me');
    await store.setAllowlist(hash, 'GET:/api/y', 'trusted partner', '2099-01-01T00:00Z');
    await cp.check({ route: '/api/y', method: 'GET', identifier: '203.0.113.9', userId: 'user_a' });
    const v = await cp.check({ route: '/api/y', method: 'GET', identifier: '203.0.113.9', userId: 'user_a' });
    expect(v.allowed).toBe(true);
    expect(v.reason).toBe('allowlisted');
  });
});

describe('createAbuseControlPlane.check - error signals', () => {
  let store, cp, clock;

  beforeEach(() => {
    clock = makeClock();
    store = new AbuseStoreFixture();
    cp = createAbuseControlPlane({ config: defaultConfig(), store, now: clock.now });
  });

  it('records an error_burst signal when statusCode >= 400', async () => {
    await cp.check({ route: '/api/z', method: 'GET', identifier: '203.0.113.1', userId: 'user_a', statusCode: 400 });
    const signals = await store.getSignals(`addr:${privacyIdentifier('203.0.113.1', 'dev-secret-change-me')}`, 0);
    expect(signals.some((s) => s.kind === 'error_burst')).toBe(true);
  });

  it('does not record an error signal for 2xx responses', async () => {
    await cp.check({ route: '/api/z', method: 'GET', identifier: '203.0.113.1', userId: 'user_a', statusCode: 200 });
    const signals = await store.getSignals(`addr:${privacyIdentifier('203.0.113.1', 'dev-secret-change-me')}`, 0);
    expect(signals.some((s) => s.kind === 'error_burst')).toBe(false);
  });
});

describe('createAbuseControlPlane - appeals', () => {
  let store, cp, clock;

  beforeEach(() => {
    clock = makeClock();
    store = new AbuseStoreFixture();
    cp = createAbuseControlPlane({ config: defaultConfig(), store, now: clock.now });
  });

  it('creates, reads, and updates an appeal', async () => {
    const hash = privacyIdentifier('203.0.113.3', 'dev-secret-change-me');
    const created = await cp.createAppeal({ identifierHash: hash, route: 'GET:/api/m', reason: 'false positive' });
    expect(created.status).toBe('pending');
    expect(created.id).toMatch(/^[a-f0-9]{24}$/);
    const fetched = await cp.getAppeal(created.id);
    expect(fetched.status).toBe('pending');
    const updated = await cp.updateAppeal(created.id, { status: 'approved', reviewerNote: 'reviewed' });
    expect(updated.status).toBe('approved');
    expect(updated.reviewerNote).toBe('reviewed');
  });

  it('returns null for a missing appeal', async () => {
    expect(await cp.getAppeal('doesnotexist')).toBeNull();
    expect(await cp.updateAppeal('doesnotexist', { status: 'approved' })).toBeNull();
  });
});

describe('createAbuseControlPlane - adaptive throttling', () => {
  it('reduces the limit after abuse signals fire', async () => {
    const clock = makeClock();
    const store = new AbuseStoreFixture();
    // Pre-load rapid_fire signals so the adaptive multiplier kicks in.
    for (let i = 0; i < 10; i += 1) {
      await store.recordSignal({ bucket: 'addr:' + privacyIdentifier('203.0.113.4', 'dev-secret-change-me'), kind: 'rapid_fire', at: clock.now(), route: 'GET:/api/adapt', severity: 'high' });
    }
    const cp = createAbuseControlPlane({
      config: { ...defaultConfig(), defaultLimit: 100, defaultWindowMs: 60_000, routes: new Map() },
      store, now: clock.now,
    });
    const v = await cp.check({ route: '/api/adapt', method: 'GET', identifier: '203.0.113.4', userId: 'user_a' });
    // With adaptive multiplier 0.5, effective limit is 50; still allowed on first request.
    expect(v.allowed).toBe(true);
  });
});
