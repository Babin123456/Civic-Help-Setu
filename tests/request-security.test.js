/**
 * tests/request-security.test.js
 *
 * CSRF, Origin and CORS policy tests for api/_lib/requestSecurity.js.
 *
 * These tests are pure unit tests: no HTTP server is started. They verify
 * the logic of evaluateRequestSecurity, enforceRequestSecurity and the
 * individual helpers.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseOrigin,
  getHeader,
  isMutatingMethod,
  getRequestOrigin,
  deriveRequestOrigin,
  normalizeOriginList,
  isTrustedOrigin,
  buildCorsHeaders,
  parseCookies,
  readCsrfCookie,
  validateCsrfToken,
  detectAuthMode,
  evaluateRequestSecurity,
  enforceRequestSecurity,
  withRequestSecurity,
  internalErrorResponse,
  SAFE_MESSAGES,
  MUTATING_METHODS,
  DEFAULT_CSRF_COOKIE,
  DEFAULT_CSRF_HEADER,
} from '../api/_lib/requestSecurity.js';

function mockReq(overrides = {}) {
  return {
    method: 'POST',
    body: {},
    query: {},
    url: '/api/test',
    ...overrides,
    headers: { ...(overrides.headers || {}) },
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.writableEnded = true;
      return this;
    },
    end() {
      this.writableEnded = true;
      return this;
    },
  };
  return res;
}

describe('requestSecurity helpers', () => {
  describe('parseOrigin', () => {
    it('normalizes https origins to lower case', () => {
      expect(parseOrigin('https://Example.ORG:443')).toBe('https://example.org');
      expect(parseOrigin('https://api.site.com/path?query=1')).toBe('https://api.site.com');
    });
    it('accepts http origins', () => {
      expect(parseOrigin('http://localhost:5173')).toBe('http://localhost:5173');
    });
    it('rejects non-http(s) schemes', () => {
      expect(parseOrigin('ftp://example.org')).toBeNull();
      expect(parseOrigin('ws://example.org')).toBeNull();
      expect(parseOrigin('javascript:alert(1)')).toBeNull();
    });
    it('rejects opaque/empty values', () => {
      expect(parseOrigin('')).toBeNull();
      expect(parseOrigin('null')).toBeNull();
      expect(parseOrigin(null)).toBeNull();
      expect(parseOrigin(undefined)).toBeNull();
      expect(parseOrigin('not a url')).toBeNull();
    });
  });

  describe('getHeader', () => {
    it('is case-insensitive', () => {
      const h = { 'Content-Type': 'application/json' };
      expect(getHeader(h, 'content-type')).toBe('application/json');
      expect(getHeader(h, 'CONTENT-TYPE')).toBe('application/json');
    });
    it('returns first value for array headers', () => {
      expect(getHeader({ 'x-forwarded-for': ['1.2.3.4', '5.6.7.8'] }, 'x-forwarded-for')).toBe('1.2.3.4');
    });
    it('returns undefined for missing', () => {
      expect(getHeader({}, 'authorization')).toBeUndefined();
    });
  });

  describe('isMutatingMethod', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      it(`returns true for ${m}`, () => {
        expect(isMutatingMethod(m)).toBe(true);
        expect(isMutatingMethod(m.toLowerCase())).toBe(true);
      });
    }
    for (const m of ['GET', 'HEAD', 'OPTIONS']) {
      it(`returns false for ${m}`, () => {
        expect(isMutatingMethod(m)).toBe(false);
      });
    }
    it('handles null/undefined', () => {
      expect(isMutatingMethod(null)).toBe(false);
      expect(isMutatingMethod(undefined)).toBe(false);
    });
  });

  describe('getRequestOrigin', () => {
    it('reads Origin header when present', () => {
      const r = getRequestOrigin({ origin: 'https://site.com' });
      expect(r.origin).toBe('https://site.com');
      expect(r.source).toBe('origin');
      expect(r.invalid).toBe(false);
    });
    it('falls back to Referer when Origin is missing', () => {
      const r = getRequestOrigin({ referer: 'https://site.com/page' });
      expect(r.origin).toBe('https://site.com');
      expect(r.source).toBe('referer');
    });
    it('marks invalid when header cannot be parsed', () => {
      const r = getRequestOrigin({ origin: 'not-a-url' });
      expect(r.origin).toBeNull();
      expect(r.invalid).toBe(true);
    });
    it('returns none when both are missing', () => {
      const r = getRequestOrigin({});
      expect(r.origin).toBeNull();
      expect(r.source).toBe('none');
    });
  });

  describe('deriveRequestOrigin', () => {
    it('reads x-forwarded-host and x-forwarded-proto', () => {
      const o = deriveRequestOrigin({
        'x-forwarded-host': 'api.example.org',
        'x-forwarded-proto': 'https',
      });
      expect(o).toBe('https://api.example.org');
    });
    it('falls back to host header', () => {
      const o = deriveRequestOrigin({ host: 'localhost:3000' });
      expect(o).toBe('http://localhost:3000');
    });
    it('defaults to https for non-local hosts', () => {
      const o = deriveRequestOrigin({ host: 'deploy.vercel.app' });
      expect(o).toBe('https://deploy.vercel.app');
    });
    it('returns null for unusable hosts', () => {
      expect(deriveRequestOrigin({})).toBeNull();
      expect(deriveRequestOrigin({ host: '<script>' })).toBeNull();
    });
  });

  describe('normalizeOriginList', () => {
    it('parses comma-separated strings and arrays', () => {
      const r = normalizeOriginList(['https://a.com', 'https://b.com']);
      expect(r.origins).toEqual(['https://a.com', 'https://b.com']);
    });
    it('detects wildcard', () => {
      const r = normalizeOriginList('https://a.com, *, https://b.com');
      expect(r.wildcard).toBe(true);
    });
    it('ignores unparsable entries', () => {
      const r = normalizeOriginList('https://a.com, not-a-url, https://b.com');
      expect(r.origins).toEqual(['https://a.com', 'https://b.com']);
    });
  });

  describe('isTrustedOrigin', () => {
    it('matches exact origin case-insensitively', () => {
      expect(isTrustedOrigin('https://site.com', ['https://site.com'])).toBe(true);
      expect(isTrustedOrigin('HTTPS://SITE.COM', ['https://site.com'])).toBe(true);
    });
    it('rejects different origin', () => {
      expect(isTrustedOrigin('https://evil.com', ['https://site.com'])).toBe(false);
    });
    it('rejects invalid origin string', () => {
      expect(isTrustedOrigin('not-a-url', ['https://site.com'])).toBe(false);
    });
  });

  describe('buildCorsHeaders', () => {
    it('returns wildcard headers for non-credentialed requests', () => {
      const h = buildCorsHeaders({ origin: 'https://client.com', allowedOrigins: ['*'], allowCredentials: false });
      expect(h['Access-Control-Allow-Origin']).toBe('*');
      expect(h.Vary).toBe('Origin');
    });
    it('rejects wildcard when credentials are required', () => {
      const h = buildCorsHeaders({ origin: 'https://client.com', allowedOrigins: ['*'], allowCredentials: true });
      expect(h).toEqual({ Vary: 'Origin' });
    });
    it('echoes explicit origin when allowed and credentials enabled', () => {
      const h = buildCorsHeaders({ origin: 'https://client.com', allowedOrigins: ['https://client.com'], allowCredentials: true });
      expect(h['Access-Control-Allow-Origin']).toBe('https://client.com');
      expect(h['Access-Control-Allow-Credentials']).toBe('true');
    });
    it('returns empty object for untrusted origin', () => {
      const h = buildCorsHeaders({ origin: 'https://evil.com', allowedOrigins: ['https://client.com'] });
      expect(h).toEqual({});
    });
    it('returns empty for invalid origin', () => {
      const h = buildCorsHeaders({ origin: 'not-a-url', allowedOrigins: ['https://client.com'] });
      expect(h).toEqual({});
    });
  });

  describe('parseCookies', () => {
    it('parses simple cookies', () => {
      expect(parseCookies('csrf=abc123; session=xyz')).toEqual({ csrf: 'abc123', session: 'xyz' });
    });
    it('handles quoted values', () => {
      expect(parseCookies('csrf="abc 123"; other=val')).toEqual({ csrf: 'abc 123', other: 'val' });
    });
    it('decodes URL-encoded values', () => {
      expect(parseCookies('csrf=abc%2Bdef')).toEqual({ csrf: 'abc+def' });
    });
    it('keeps first value when duplicates exist', () => {
      expect(parseCookies('csrf=first; csrf=second')).toEqual({ csrf: 'first' });
    });
    it('handles empty/malformed input', () => {
      expect(parseCookies('')).toEqual({});
      expect(parseCookies('malformed')).toEqual({});
      expect(parseCookies(null)).toEqual({});
      expect(parseCookies(undefined)).toEqual({});
    });
  });

  describe('readCsrfCookie', () => {
    it('reads the default cookie name', () => {
      const headers = { cookie: '__Host-csrf=token123' };
      expect(readCsrfCookie(headers, {})).toBe('token123');
    });
    it('falls back to alias names', () => {
      const headers = { cookie: 'csrf_token=alias456' };
      expect(readCsrfCookie(headers, {})).toBe('alias456');
    });
    it('respects custom name from config', () => {
      const headers = { cookie: 'custom_csrf=custom789' };
      expect(readCsrfCookie(headers, { csrfCookieName: 'custom_csrf' })).toBe('custom789');
    });
  });

  describe('validateCsrfToken', () => {
    const validCookie = 'csrf-abcdefghijklmnop';
    const baseHeaders = { cookie: `__Host-csrf=${validCookie}`, 'x-csrf-token': validCookie };

    it('accepts matching tokens', () => {
      expect(validateCsrfToken(baseHeaders, {})).toEqual({ ok: true, code: null });
    });
    it('rejects missing cookie', () => {
      const r = validateCsrfToken({ 'x-csrf-token': validCookie }, {});
      expect(r).toEqual({ ok: false, code: 'csrf_token_missing' });
    });
    it('rejects missing header', () => {
      const r = validateCsrfToken({ cookie: `__Host-csrf=${validCookie}` }, {});
      expect(r).toEqual({ ok: false, code: 'csrf_token_missing' });
    });
    it('rejects mismatched tokens (constant-time)', () => {
      const r = validateCsrfToken({ ...baseHeaders, 'x-csrf-token': 'different-token' }, {});
      expect(r).toEqual({ ok: false, code: 'csrf_token_mismatch' });
    });
    it('rejects too-short token', () => {
      const r = validateCsrfToken({ cookie: '__Host-csrf=short', 'x-csrf-token': 'short' }, {});
      expect(r).toEqual({ ok: false, code: 'csrf_token_invalid' });
    });
    it('rejects too-long token', () => {
      const long = 'a'.repeat(513);
      const r = validateCsrfToken({ cookie: `__Host-csrf=${long}`, 'x-csrf-token': long }, {});
      expect(r).toEqual({ ok: false, code: 'csrf_token_invalid' });
    });
    it('accepts alternative header names', () => {
      const validToken = 'tokentokentokentoken';
      const headers = { cookie: `__Host-csrf=${validToken}`, 'x-xsrf-token': validToken };
      expect(validateCsrfToken(headers, {})).toEqual({ ok: true, code: null });
    });
  });

  describe('detectAuthMode', () => {
    it('returns bearer when Authorization header is present', () => {
      expect(detectAuthMode({ authorization: 'Bearer abc' })).toBe('bearer');
      expect(detectAuthMode({ Authorization: 'Bearer abc' })).toBe('bearer');
    });
    it('returns cookie when Cookie header is present', () => {
      expect(detectAuthMode({ cookie: 'session=xyz' })).toBe('cookie');
    });
    it('returns anonymous when neither present', () => {
      expect(detectAuthMode({})).toBe('anonymous');
      expect(detectAuthMode({ 'x-other': 'value' })).toBe('anonymous');
    });
    it('prioritizes bearer over cookie', () => {
      expect(detectAuthMode({ authorization: 'Bearer abc', cookie: 'session=xyz' })).toBe('bearer');
    });
  });

  describe('evaluateRequestSecurity', () => {
    const devEnv = { NODE_ENV: 'development' };

    it('allows all GET requests unconditionally', () => {
      const verdict = evaluateRequestSecurity({ method: 'GET', headers: {}, env: devEnv });
      expect(verdict.ok).toBe(true);
      expect(verdict.allowed).toBe(true);
      expect(verdict.authMode).toBe('anonymous');
    });
    it('allows OPTIONS (preflight) unconditionally', () => {
      const verdict = evaluateRequestSecurity({ method: 'OPTIONS', headers: {}, env: devEnv });
      expect(verdict.ok).toBe(true);
    });

    describe('cookie-authenticated mutations', () => {
      const cookieHeaders = { cookie: '__Host-csrf=tokentokentokentoken', 'x-csrf-token': 'tokentokentokentoken' };

      it('allows same-origin with valid CSRF in development', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { ...cookieHeaders, origin: 'http://localhost:5173' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(true);
        expect(verdict.authMode).toBe('cookie');
        expect(verdict.csrfRequired).toBe(true);
      });

      it('rejects cross-origin without CSRF', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { cookie: '__Host-csrf=tokentokentokentoken' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('origin_missing');
      });

      it('rejects cross-origin even with CSRF when origin is not trusted', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { ...cookieHeaders, origin: 'https://evil.com' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('origin_not_allowed');
      });

      it('rejects invalid CSRF token', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { cookie: '__Host-csrf=tokentokentokentoken', 'x-csrf-token': 'wrong', origin: 'http://localhost:5173' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('csrf_token_mismatch');
      });

      it('rejects missing CSRF token', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { cookie: '__Host-csrf=tokentokentokentoken', origin: 'http://localhost:5173' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('csrf_token_missing');
      });

      it('rejects invalid Origin header value', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { ...cookieHeaders, origin: 'not-a-url' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('origin_not_allowed');
      });
    });

    describe('bearer-token mutations', () => {
      const bearerHeaders = { authorization: 'Bearer session-token-abc' };

      it('allows without Origin when allowMissingOrigin is true', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: bearerHeaders,
          env: devEnv,
          allowMissingOrigin: true,
        });
        expect(verdict.ok).toBe(true);
        expect(verdict.authMode).toBe('bearer');
      });

      it('rejects forged Origin even with Bearer token', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { ...bearerHeaders, origin: 'https://evil.com' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('origin_not_allowed');
      });

      it('allows trusted Origin', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { ...bearerHeaders, origin: 'https://civic.example.org' },
          env: { ...devEnv, APP_ORIGIN: 'https://civic.example.org' },
        });
        expect(verdict.ok).toBe(true);
      });
    });

    describe('anonymous intake endpoints (no auth, same-origin)', () => {
      it('allows same-origin with explicit Origin in development', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { origin: 'http://localhost:5173' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(true);
        expect(verdict.authMode).toBe('anonymous');
      });

      it('allows same-origin when Origin matches derived host', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { origin: 'https://deploy.vercel.app', host: 'deploy.vercel.app' },
          env: { NODE_ENV: 'production' },
        });
        expect(verdict.ok).toBe(true);
      });

      it('rejects cross-site form post without Origin', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { 'sec-fetch-site': 'cross-site' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('origin_missing');
      });

      it('rejects unknown Origin', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { origin: 'https://unknown-site.com' },
          env: devEnv,
        });
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe('origin_not_allowed');
      });
    });

    describe('explicit allowed origins configuration', () => {
      it('accepts origins from APP_ALLOWED_ORIGINS', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { origin: 'https://partner.example.com' },
          env: { NODE_ENV: 'production', APP_ALLOWED_ORIGINS: 'https://partner.example.com' },
        });
        expect(verdict.ok).toBe(true);
      });

      it('accepts origins from allowedOrigins parameter', () => {
        const verdict = evaluateRequestSecurity({
          method: 'POST',
          headers: { origin: 'https://special.example.com' },
          env: { NODE_ENV: 'production' },
          allowedOrigins: 'https://special.example.com',
        });
        expect(verdict.ok).toBe(true);
      });
    });
  });

  describe('enforceRequestSecurity', () => {
    const devEnv = { NODE_ENV: 'development' };

    it('handles OPTIONS preflight with 204', () => {
      const req = mockReq({ method: 'OPTIONS' });
      const res = mockRes();
      const result = enforceRequestSecurity(req, res, { env: devEnv });
      expect(result.handled).toBe(true);
      expect(result.allowed).toBe(true);
      expect(res.statusCode).toBe(204);
      expect(res.writableEnded).toBe(true);
    });

    it('rejects forbidden mutation with 403 JSON', () => {
      const req = mockReq({ method: 'POST', headers: { origin: 'https://evil.com' } });
      const res = mockRes();
      const result = enforceRequestSecurity(req, res, { env: devEnv });
      expect(result.handled).toBe(true);
      expect(result.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('origin_not_allowed');
    });

    it('passes through allowed requests', () => {
      const req = mockReq({ method: 'POST', headers: { origin: 'http://localhost:5173' } });
      const res = mockRes();
      const result = enforceRequestSecurity(req, res, { env: devEnv });
      expect(result.handled).toBe(false);
      expect(result.allowed).toBe(true);
    });

    it('applies CORS headers to response', () => {
      const req = mockReq({ method: 'POST', headers: { origin: 'http://localhost:5173' } });
      const res = mockRes();
      enforceRequestSecurity(req, res, { env: devEnv });
      expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('never exposes stack or internal details in rejection body', () => {
      const req = mockReq({ method: 'POST', headers: { origin: 'https://evil.com' } });
      const res = mockRes();
      const result = enforceRequestSecurity(req, res, { env: devEnv });
      expect(result.handled).toBe(true);
      expect(result.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.body).toBeDefined();
      expect(res.body).not.toHaveProperty('stack');
      expect(res.body.message).toBe(SAFE_MESSAGES.origin_not_allowed);
      expect(JSON.stringify(res.body)).not.toContain('Error');
    });
  });

  describe('withRequestSecurity wrapper', () => {
    const devEnv = { NODE_ENV: 'development' };

    it('wraps a handler and enforces security before calling it', async () => {
      const inner = vi.fn(async (req, res) => {
        res.status(201).json({ ok: true });
      });
      const wrapped = withRequestSecurity(inner, { env: devEnv });

      const req = mockReq({ method: 'POST', headers: { origin: 'http://localhost:5173' } });
      const res = mockRes();

      await wrapped(req, res);
      expect(inner).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(201);
    });

    it('blocks forbidden requests before inner handler runs', async () => {
      const inner = vi.fn(async (req, res) => {
        res.status(201).json({ ok: true });
      });
      const wrapped = withRequestSecurity(inner, { env: devEnv });

      const req = mockReq({ method: 'POST', headers: { origin: 'https://evil.com' } });
      const res = mockRes();

      await wrapped(req, res);
      expect(inner).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });
  });

  describe('internalErrorResponse', () => {
    it('returns fixed non-sensitive payload', () => {
      const body = internalErrorResponse();
      expect(body).toEqual({
        error: 'internal_server_error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The request could not be completed.',
      });
    });
  });

  describe('constants', () => {
    it('exports MUTATING_METHODS', () => {
      expect(MUTATING_METHODS).toEqual(['POST', 'PUT', 'PATCH', 'DELETE']);
    });
    it('exports default cookie/header names', () => {
      expect(DEFAULT_CSRF_COOKIE).toBe('__Host-csrf');
      expect(DEFAULT_CSRF_HEADER).toBe('x-csrf-token');
    });
    it('exports safe messages for all codes', () => {
      for (const code of ['origin_missing', 'origin_not_allowed', 'csrf_token_missing', 'csrf_token_invalid', 'csrf_token_mismatch', 'preflight_not_allowed']) {
        expect(SAFE_MESSAGES[code]).toBeDefined();
        expect(typeof SAFE_MESSAGES[code]).toBe('string');
        expect(SAFE_MESSAGES[code].length).toBeGreaterThan(10);
      }
    });
  });
});