import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { bearerToken, createFirebaseTokenHandler } from './firebaseToken.js';

const SESSION = 'sess_token_abcdefghijklmnop';

const make = (overrides = {}) => {
  const deps = {
    verifySession: vi.fn(async () => ({ userId: 'user_abc' })),
    getPublicMetadata: vi.fn(async () => ({ role: 'citizen' })),
    mintToken: vi.fn(async (userId, claims) => `firebase-token-for-${userId}-${claims.role}`),
    ...overrides,
  };
  return { deps, handle: createFirebaseTokenHandler(deps) };
};

const post = (handle, headers = { authorization: `Bearer ${SESSION}` }) => handle({ method: 'POST', headers });

describe('bearerToken', () => {
  it('reads a Bearer token from any header-name casing', () => {
    expect(bearerToken({ authorization: `Bearer ${SESSION}` })).toBe(SESSION);
    expect(bearerToken({ Authorization: `Bearer ${SESSION}` })).toBe(SESSION);
    expect(bearerToken({ AUTHORIZATION: `Bearer  ${SESSION}`.replace('  ', ' ') })).toBe(SESSION);
  });

  it.each([
    [{}],
    [undefined],
    [{ authorization: '' }],
    [{ authorization: SESSION }],
    [{ authorization: `Basic ${SESSION}` }],
    [{ authorization: 'Bearer short' }],
    [{ authorization: `Bearer ${'a'.repeat(5000)}` }],
    [{ authorization: `Bearer bad token with spaces` }],
    [{ authorization: ['Bearer x'] }],
    [{ authorization: 5 }],
  ])('rejects %j', (headers) => {
    expect(bearerToken(headers)).toBeNull();
  });
});

describe('createFirebaseTokenHandler', () => {
  it('needs all three collaborators', () => {
    expect(() => createFirebaseTokenHandler({})).toThrow(/verifySession/);
    expect(() => createFirebaseTokenHandler({ verifySession() {}, getPublicMetadata() {} })).toThrow(/mintToken/);
  });

  it('only answers POST', async () => {
    const { handle, deps } = make();
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS', undefined]) {
      const result = await handle({ method, headers: { authorization: `Bearer ${SESSION}` } });
      expect(result.status).toBe(405);
      expect(result.headers.Allow).toBe('POST');
    }
    expect(deps.verifySession).not.toHaveBeenCalled();
  });

  it('refuses a request without a session token and does no work', async () => {
    const { handle, deps } = make();
    const result = await post(handle, {});
    expect(result).toMatchObject({ status: 401, body: { error: 'missing_token' } });
    expect(deps.verifySession).not.toHaveBeenCalled();
    expect(deps.mintToken).not.toHaveBeenCalled();
  });

  it('refuses a session token Clerk does not accept, without repeating the reason', async () => {
    const { handle, deps } = make({
      verifySession: vi.fn(async () => {
        throw new Error('JWT expired at 2026-01-01 for sk_live_secretdetail');
      }),
    });
    const result = await post(handle);
    expect(result).toMatchObject({ status: 401, body: { error: 'invalid_token' } });
    expect(JSON.stringify(result)).not.toContain('sk_live');
    expect(deps.mintToken).not.toHaveBeenCalled();
  });

  it.each([[undefined], [''], [123], ['x'.repeat(129)]])('refuses a verified token with a bad user id (%j)', async (userId) => {
    const { handle, deps } = make({ verifySession: vi.fn(async () => ({ userId })) });
    expect((await post(handle)).status).toBe(401);
    expect(deps.mintToken).not.toHaveBeenCalled();
  });

  it('issues a citizen token for an ordinary user and passes only the role claim', async () => {
    const { handle, deps } = make();
    const result = await post(handle);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ token: 'firebase-token-for-user_abc-citizen' });
    expect(deps.mintToken).toHaveBeenCalledWith('user_abc', { role: 'citizen' });
    expect(Object.keys(deps.mintToken.mock.calls[0][1])).toEqual(['role']);
  });

  it('issues an admin token only when Clerk publicMetadata says admin', async () => {
    const { handle, deps } = make({ getPublicMetadata: vi.fn(async () => ({ role: 'admin' })) });
    const result = await post(handle);
    expect(result.body.token).toContain('-admin');
    expect(deps.mintToken).toHaveBeenCalledWith('user_abc', { role: 'admin' });
    expect(deps.getPublicMetadata).toHaveBeenCalledWith('user_abc');
  });

  it.each([
    [{ role: 'Admin ' }, 'admin'],
    [{ role: 'superadmin' }, 'citizen'],
    [{ role: 'moderator' }, 'citizen'],
    [{ role: ['admin'] }, 'citizen'],
    [{ role: true }, 'citizen'],
    [{}, 'citizen'],
    [null, 'citizen'],
    [undefined, 'citizen'],
  ])('maps publicMetadata %j to the role %s (same rule as the app)', async (metadata, expected) => {
    const { handle, deps } = make({ getPublicMetadata: vi.fn(async () => metadata) });
    await post(handle);
    expect(deps.mintToken).toHaveBeenCalledWith('user_abc', { role: expected });
  });

  it('ignores anything the caller sends besides the session token', async () => {
    const { handle, deps } = make();
    const result = await handle({
      method: 'POST',
      headers: { authorization: `Bearer ${SESSION}`, 'x-role': 'admin', 'x-user-id': 'someone_else' },
      body: { role: 'admin', userId: 'someone_else' },
      query: { role: 'admin' },
    });
    expect(result.status).toBe(200);
    expect(deps.mintToken).toHaveBeenCalledWith('user_abc', { role: 'citizen' });
  });

  it('does not issue a token when the role lookup fails (it would demote an admin)', async () => {
    const { handle, deps } = make({
      getPublicMetadata: vi.fn(async () => {
        throw new Error('Clerk is down');
      }),
    });
    const result = await post(handle);
    expect(result).toMatchObject({ status: 502, body: { error: 'role_lookup_failed' } });
    expect(deps.mintToken).not.toHaveBeenCalled();
  });

  it('reports a failure to mint without leaking the library message', async () => {
    const { handle } = make({
      mintToken: vi.fn(async () => {
        throw new Error('private_key invalid: -----BEGIN PRIVATE KEY-----');
      }),
    });
    const result = await post(handle);
    expect(result).toMatchObject({ status: 502, body: { error: 'token_failed' } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE KEY');
  });

  it('is never cached', async () => {
    const { handle } = make();
    for (const result of [await post(handle), await post(handle, {}), await handle({ method: 'GET', headers: {} })]) {
      expect(result.headers['Cache-Control']).toBe('no-store');
    }
  });
});

describe('the route file', () => {
  const route = readFileSync(new URL('../firebase-token.js', import.meta.url), 'utf8');

  it('reads its secrets from server-only variables', () => {
    expect(route).toContain('CLERK_SECRET_KEY');
    expect(route).toContain('FIREBASE_SERVICE_ACCOUNT');
    expect(route).not.toMatch(/VITE_/);
  });

  it('answers 503 when it is not configured instead of throwing', () => {
    expect(route).toMatch(/status\(503\)/);
  });

  it('sets only the role claim', () => {
    expect(route).toContain('createCustomToken(userId, claims)');
  });
});
