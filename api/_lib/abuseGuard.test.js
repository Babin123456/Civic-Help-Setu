import { describe, it, expect, vi } from 'vitest';
import { clientKey, createRateLimiter, createSingleFlight } from './abuseGuard.js';
import { createFirebaseTokenHandler } from './firebaseToken.js';

describe('createRateLimiter', () => {
  it('allows up to the limit, then blocks with a retry time', () => {
    let t = 1_000;
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect([1, 2, 3].map(() => limiter.take('a').allowed)).toEqual([true, true, true]);
    t += 10_000;
    expect(limiter.take('a')).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 50 });
  });

  it('counts each key separately and starts a new window after the old one ends', () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    expect(limiter.take('a').allowed).toBe(true);
    expect(limiter.take('a').allowed).toBe(false);
    expect(limiter.take('b').allowed).toBe(true);
    t = 1000;
    expect(limiter.take('a').allowed).toBe(true);
  });

  it('never tells the caller to retry in less than one second', () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => t });
    limiter.take('a');
    t = 999.9;
    expect(limiter.take('a').retryAfterSeconds).toBe(1);
  });

  it('keeps memory bounded when there are many distinct callers', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 10 });
    for (let i = 0; i < 100; i += 1) expect(limiter.take(`k${i}`).allowed).toBe(true);
    expect(limiter.size()).toBeLessThanOrEqual(10);
    // The oldest key was evicted, so it starts a fresh window; the newest is still counted.
    expect(limiter.take('k0').allowed).toBe(true);
    expect(limiter.take('k99').allowed).toBe(false);
  });

  it('rejects a bad configuration', () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: 1 })).toThrow();
    expect(() => createRateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe('createSingleFlight', () => {
  it('runs the work once for concurrent calls with the same key', async () => {
    const flight = createSingleFlight();
    const work = vi.fn(async () => 'done');
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => flight.run('u1', work)));
    expect(results).toEqual(Array(5).fill('done'));
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('does not merge different keys, and runs again once the first has finished', async () => {
    const flight = createSingleFlight();
    const work = vi.fn(async () => 'x');
    await Promise.all([flight.run('a', work), flight.run('b', work)]);
    expect(work).toHaveBeenCalledTimes(2);
    await flight.run('a', work);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it('shares a failure and then allows a fresh attempt', async () => {
    const flight = createSingleFlight();
    const work = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');
    const [a, b] = await Promise.allSettled([flight.run('a', work), flight.run('a', work)]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('rejected');
    expect(await flight.run('a', work)).toBe('ok');
  });
});

describe('clientKey', () => {
  it('reads headers set by the Vercel edge and prefers x-vercel-forwarded-for', () => {
    expect(clientKey({ 'x-vercel-forwarded-for': '203.0.113.5', 'x-forwarded-for': '1.1.1.1' })).toBe('203.0.113.5');
    expect(clientKey({ 'X-Real-IP': '198.51.100.7' })).toBe('198.51.100.7');
  });
  it('takes the first address of a list and accepts IPv6', () => {
    expect(clientKey({ 'x-vercel-forwarded-for': '203.0.113.9, 10.0.0.1' })).toBe('203.0.113.9');
    expect(clientKey({ 'x-real-ip': '2001:db8::1' })).toBe('2001:db8::1');
  });
  it('returns null when there is no usable address', () => {
    expect(clientKey({})).toBeNull();
    expect(clientKey(undefined)).toBeNull();
    expect(clientKey({ 'x-real-ip': '<script>' })).toBeNull();
  });
  it('ignores a client-set x-forwarded-for', () => {
    expect(clientKey({ 'x-forwarded-for': '203.0.113.9' })).toBeNull();
  });
});

describe('firebase token handler with abuse controls', () => {
  const SESSION = 'sess_token_abcdefghijklmnop';
  const post = (handle, extra = {}) =>
    handle({ method: 'POST', headers: { authorization: `Bearer ${SESSION}`, 'x-real-ip': '203.0.113.1', ...extra } });
  const make = (opts = {}) => {
    const deps = {
      verifySession: vi.fn(async () => ({ userId: 'user_abc' })),
      getPublicMetadata: vi.fn(async () => ({ role: 'citizen' })),
      mintToken: vi.fn(async () => 'firebase-token'),
      ...opts,
    };
    return { deps, handle: createFirebaseTokenHandler(deps) };
  };

  it('answers 429 with Retry-After once an address is over its limit, before any Clerk call', async () => {
    const { handle, deps } = make({ ipLimiter: createRateLimiter({ limit: 2, windowMs: 60_000 }) });
    expect((await post(handle)).status).toBe(200);
    expect((await post(handle)).status).toBe(200);
    const blocked = await post(handle);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('rate_limited');
    expect(Number(blocked.headers['Retry-After'])).toBeGreaterThanOrEqual(1);
    expect(blocked.body.retryAfterSeconds).toBe(Number(blocked.headers['Retry-After']));
    expect(deps.verifySession).toHaveBeenCalledTimes(2);
    expect((await post(handle, { 'x-real-ip': '203.0.113.2' })).status).toBe(200);
  });

  it('does not share one bucket between requests with no address; the account limit still applies', async () => {
    const { handle } = make({
      ipLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
      userLimiter: createRateLimiter({ limit: 2, windowMs: 60_000 }),
    });
    const noAddr = () => handle({ method: 'POST', headers: { authorization: `Bearer ${SESSION}` } });
    expect((await noAddr()).status).toBe(200);
    expect((await noAddr()).status).toBe(200);
    expect((await noAddr()).status).toBe(429);
  });

  it('limits one account independently of its address', async () => {
    const { handle, deps } = make({ userLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }) });
    expect((await post(handle)).status).toBe(200);
    const blocked = await post(handle, { 'x-real-ip': '203.0.113.99' });
    expect(blocked.status).toBe(429);
    expect(deps.mintToken).toHaveBeenCalledTimes(1);
  });

  it('a missing token is a 401 and is not counted against an account', async () => {
    const { handle } = make({ userLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }) });
    expect((await handle({ method: 'POST', headers: {} })).status).toBe(401);
  });

  it('mints once for concurrent requests from the same account', async () => {
    const { handle, deps } = make({
      mintToken: vi.fn(() => new Promise((resolve) => setTimeout(() => resolve('firebase-token'), 10))),
    });
    const results = await Promise.all(Array.from({ length: 8 }, () => post(handle)));
    expect(results.every((r) => r.status === 200 && r.body.token === 'firebase-token')).toBe(true);
    expect(deps.getPublicMetadata).toHaveBeenCalledTimes(1);
    expect(deps.mintToken).toHaveBeenCalledTimes(1);
  });

  it('concurrent requests over the limit are partly refused', async () => {
    const { handle } = make({ ipLimiter: createRateLimiter({ limit: 3, windowMs: 60_000 }) });
    const results = await Promise.all(Array.from({ length: 10 }, () => post(handle)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.status === 429)).toHaveLength(7);
  });
});
