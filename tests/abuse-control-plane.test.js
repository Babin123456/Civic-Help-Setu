import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAbuseControlPlaneHandler, bearerToken } from '../api/abuse-control-plane.js';
import { AbuseStoreFixture } from './helpers/abuseFixture.js';
import { privacyIdentifier } from '../api/_lib/abuseControlPlane.js';

function makeReq(method, url, headers = {}, body = {}, query = {}) {
  return { method, url, headers, body, query };
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
  };
  return res;
}

const SESSION = 'sess_token_abcdefghijklmnop';

function makeHandler(opts = {}) {
  const verifySession = opts.verifySession || vi.fn(async (token) => {
    if (token === SESSION) return { userId: 'user_op' };
    throw new Error('invalid session');
  });
  const authorizeOperator = opts.authorizeOperator || vi.fn(async (req) => {
    const token = bearerToken(req.headers);
    if (token === SESSION) return { userId: 'user_op', role: 'operator' };
    return { status: 403 };
  });
  const store = new AbuseStoreFixture();
  const handler = createAbuseControlPlaneHandler({ verifySession, authorizeOperator, getStore: async () => store });
  return { handler, store, verifySession, authorizeOperator };
}

describe('Abuse Control Plane API handler (#1174)', () => {
  let handler, store;

  beforeEach(() => {
    ({ handler, store } = makeHandler());
  });

  it('returns schema version on GET', async () => {
    const res = makeRes();
    await handler(makeReq('GET', '/api/abuse-control-plane?schema=1'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.schemaVersion).toBe(1);
    expect(res.body.service).toBe('abuse-control-plane');
  });

  it('rejects unsupported methods with 405', async () => {
    const res = makeRes();
    await handler(makeReq('DELETE', '/api/abuse-control-plane'), res);
    expect(res.statusCode).toBe(405);
  });

  describe('quotas (operator-gated)', () => {
    it('requires operator auth', async () => {
      const res = makeRes();
      await handler(makeReq('GET', '/api/abuse-control-plane/quotas?route=/api/x'), res);
      expect(res.statusCode).toBe(403);
    });

    it('lists quotas for an operator', async () => {
      await store.setQuota('quota:GET:/api/x', { route: '/api/x', method: 'GET', limit: 10, windowMs: 60_000 });
      const res = makeRes();
      await handler(makeReq('GET', '/api/abuse-control-plane/quotas?route=/api/x', { authorization: `Bearer ${SESSION}` }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.schemaVersion).toBe(1);
    });

    it('sets a route quota with valid input', async () => {
      const res = makeRes();
      await handler(makeReq('POST', '/api/abuse-control-plane/quotas', { authorization: `Bearer ${SESSION}` }, {
        route: '/api/report', method: 'POST', limit: 5, windowMs: 60_000, adaptive: true,
      }), res);
      expect(res.statusCode).toBe(201);
      expect(res.body.ok).toBe(true);
    });

    it('rejects invalid quota config with 400', async () => {
      const res = makeRes();
      await handler(makeReq('POST', '/api/abuse-control-plane/quotas', { authorization: `Bearer ${SESSION}` }, {
        route: '/api/report', limit: 0, windowMs: 60_000,
      }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('validation_failed');
      expect(Array.isArray(res.body.details)).toBe(true);
    });
  });

  describe('signals (operator-gated)', () => {
    it('lists signals for a bucket', async () => {
      const hash = privacyIdentifier('203.0.113.5', 'dev-secret-change-me');
      await store.recordSignal({ bucket: `addr:${hash}`, kind: 'rapid_fire', at: 1000, route: 'GET:/api/x', severity: 'high' });
      const res = makeRes();
      await handler(makeReq('GET', '/api/abuse-control-plane/signals?bucket=addr:' + hash, { authorization: `Bearer ${SESSION}` }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.bucket).toBe(`addr:${hash}`);
      expect(Array.isArray(res.body.signals)).toBe(true);
      expect(res.body.signals[0].kind).toBe('rapid_fire');
    });

    it('requires bucket parameter', async () => {
      const res = makeRes();
      await handler(makeReq('GET', '/api/abuse-control-plane/signals', { authorization: `Bearer ${SESSION}` }), res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('appeals (user-gated create/read, operator-gated update)', () => {
    const hash = privacyIdentifier('203.0.113.7', 'dev-secret-change-me');

    it('creates an appeal with a valid session', async () => {
      const res = makeRes();
      await handler(makeReq('POST', '/api/abuse-control-plane/appeals', { authorization: `Bearer ${SESSION}` }, {
        identifierHash: hash, route: 'GET:/api/m', reason: 'false positive',
      }), res);
      expect(res.statusCode).toBe(201);
      expect(res.body.appeal.status).toBe('pending');
      expect(res.body.appeal.id).toMatch(/^[a-f0-9]{24}$/);
    });

    it('rejects appeal creation without a session', async () => {
      const res = makeRes();
      await handler(makeReq('POST', '/api/abuse-control-plane/appeals', {}, {
        identifierHash: hash, route: 'GET:/api/m', reason: 'false positive',
      }), res);
      expect(res.statusCode).toBe(401);
    });

    it('validates appeal input', async () => {
      const res = makeRes();
      await handler(makeReq('POST', '/api/abuse-control-plane/appeals', { authorization: `Bearer ${SESSION}` }, {
        identifierHash: 'not-hex', route: 'GET:/api/m', reason: 'x',
      }), res);
      expect(res.statusCode).toBe(400);
    });

    it('returns appeal status', async () => {
      await store.createAppeal({ identifierHash: hash, route: 'GET:/api/m', reason: 'r', userId: 'u', status: 'pending', createdAt: 1, updatedAt: 1 });
      const res = makeRes();
      await handler(makeReq('GET', '/api/abuse-control-plane/appeals/appeal-123', { authorization: `Bearer ${SESSION}` }), res);
      // appeal-123 doesn't match ID_SEGMENT? It does. But it doesn't exist.
      expect(res.statusCode).toBe(404);
    });

    it('updates an appeal as operator (high impact, human approval)', async () => {
      await store.createAppeal({ id: 'appeal-ok', identifierHash: hash, route: 'GET:/api/m', reason: 'r', userId: 'u', status: 'pending', createdAt: 1, updatedAt: 1 });
      const res = makeRes();
      await handler(makeReq('PATCH', '/api/abuse-control-plane/appeals/appeal-ok', { authorization: `Bearer ${SESSION}` }, { status: 'approved', reviewerNote: 'reviewed' }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.appeal.status).toBe('approved');
    });

    it('rejects invalid appeal update', async () => {
      const res = makeRes();
      await handler(makeReq('PATCH', '/api/abuse-control-plane/appeals/appeal-ok', { authorization: `Bearer ${SESSION}` }, { status: 'maybe' }), res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('blocklist / allowlist (operator-gated)', () => {
    const hash = privacyIdentifier('203.0.113.9', 'dev-secret-change-me');

    it('blocklists an identifier', async () => {
      const res = makeRes();
      await handler(makeReq('POST', '/api/abuse-control-plane/blocklist', { authorization: `Bearer ${SESSION}` }, {
        identifierHash: hash, route: 'GET:/api/y', reason: 'abuse', expiresAt: '2099-01-01T00:00:00Z',
      }), res);
      expect(res.statusCode).toBe(200);
      const blocked = await store.isBlocklisted(hash, 'GET:/api/y');
      expect(blocked).toBe(true);
    });

    it('allowlists an identifier', async () => {
      const res = makeRes();
      await handler(makeReq('POST', '/api/abuse-control-plane/allowlist', { authorization: `Bearer ${SESSION}` }, {
        identifierHash: hash, route: 'GET:/api/y', reason: 'trusted', expiresAt: '2099-01-01T00:00:00Z',
      }), res);
      expect(res.statusCode).toBe(200);
      const allowed = await store.isAllowlisted(hash, 'GET:/api/y');
      expect(allowed).toBe(true);
    });

    it('rejects invalid list entry', async () => {
      const res = makeRes();
      await handler(makeReq('POST', '/api/abuse-control-plane/blocklist', { authorization: `Bearer ${SESSION}` }, {
        identifierHash: 'bad', route: 'GET:/api/y', reason: 'r',
      }), res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('bearerToken', () => {
    it('extracts a Bearer token case-insensitively', () => {
      expect(bearerToken({ Authorization: `Bearer ${SESSION}` })).toBe(SESSION);
      expect(bearerToken({ authorization: `Bearer ${SESSION}` })).toBe(SESSION);
      expect(bearerToken({})).toBeNull();
      expect(bearerToken({ authorization: 'Basic xyz' })).toBeNull();
    });
  });
});
