/**
 * api/_lib/requestSecurity.js
 *
 * Central CSRF, Origin and CORS policy for every state-changing API request.
 *
 * The API has two kinds of authenticated callers:
 *
 *  - Browser callers. They either send a Bearer session token explicitly (never
 *    attached automatically by the browser) or rely on cookies. Only the cookie
 *    case is vulnerable to CSRF, so only that case requires a CSRF token.
 *  - Same-origin browser calls without a token (the public citizen intake
 *    endpoints). They still have to prove that the request came from a trusted
 *    origin so a third-party page cannot submit reports in a visitor's name.
 *
 * Policy summary (docs/security/API_MUTATION_SECURITY.md):
 *
 *  - GET / HEAD / OPTIONS are read-only and are never blocked by Origin checks.
 *  - POST / PUT / PATCH / DELETE must have a trusted Origin (or Referer, as a
 *    fallback). A request with an `Authorization` header is treated as a
 *    non-browser API client and may omit Origin; it is still rejected when it
 *    presents a forged Origin.
 *  - Cookie-authenticated mutations require a double-submit CSRF token: the
 *    token in the `X-CSRF-Token` header must match the token in the CSRF cookie.
 *  - CORS never reflects `*` together with credentials. Credentialed CORS is
 *    only emitted for explicitly configured origins.
 *  - Rejections are stable JSON codes. They never include an exception message,
 *    stack, cookie value or secret.
 *
 * Configuration (server-only environment variables):
 *
 *  - APP_ORIGIN            canonical site origin, e.g. https://civic.example.org
 *  - APP_ALLOWED_ORIGINS   comma-separated extra origins for cross-origin clients
 *  - APP_CORS_ALLOW_CREDENTIALS  set to "true" only with explicit origins
 *  - CSRF_COOKIE_NAME      defaults to __Host-csrf
 *  - CSRF_HEADER_NAME      defaults to x-csrf-token
 *
 * VERCEL_PROJECT_PRODUCTION_URL, VERCEL_BRANCH_URL and VERCEL_URL are trusted
 * automatically when present. Local development origins are trusted when
 * NODE_ENV is not "production".
 */
/* global process */

export const MUTATING_METHODS = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE']);
const MUTATING = new Set(MUTATING_METHODS);

export const DEFAULT_CSRF_COOKIE = '__Host-csrf';
export const DEFAULT_CSRF_HEADER = 'x-csrf-token';

export const SAFE_MESSAGES = Object.freeze({
  origin_missing: 'The request origin could not be verified. Reload the page and try again.',
  origin_not_allowed: 'This origin is not allowed to change data on this site.',
  csrf_token_missing: 'A CSRF token is required for this request. Reload the page and try again.',
  csrf_token_invalid: 'The CSRF token is malformed. Reload the page and try again.',
  csrf_token_mismatch: 'The CSRF token does not match this session. Reload the page and try again.',
  preflight_not_allowed: 'This origin is not allowed to make cross-origin requests.',
});
const CSRF_COOKIE_ALIASES = ['__Host-csrf', 'csrf_token', '__csrf'];
const CSRF_HEADER_ALIASES = ['x-csrf-token', 'x-xsrf-token', 'csrf-token'];

const DEV_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

/** Reads a header without depending on the header-name casing. */
export function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  const wanted = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

export function isMutatingMethod(method) {
  return MUTATING.has(String(method || '').toUpperCase());
}

/** Returns a normalised origin (`https://host[:port]`) or null for invalid/opaque input. */
export function parseOrigin(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || candidate.toLowerCase() === 'null') return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Reads the request origin. `Origin` wins; `Referer` is only a fallback for
 * same-origin form posts from older browsers. `invalid` distinguishes a
 * missing header from a header that cannot be parsed.
 */
export function getRequestOrigin(headers = {}) {
  const originHeader = getHeader(headers, 'origin');
  if (originHeader !== undefined && originHeader !== null && originHeader !== '') {
    const origin = parseOrigin(originHeader);
    return { origin, source: 'origin', invalid: origin === null, raw: originHeader };
  }

  const refererHeader = getHeader(headers, 'referer');
  if (refererHeader !== undefined && refererHeader !== null && refererHeader !== '') {
    const origin = parseOrigin(refererHeader);
    return { origin, source: 'referer', invalid: origin === null, raw: refererHeader };
  }

  return { origin: null, source: 'none', invalid: false, raw: null };
}

/** Derives this deployment's own origin from the host headers set by Vercel/proxies. */
export function deriveRequestOrigin(headers = {}) {
  const rawHost = getHeader(headers, 'x-forwarded-host') ?? getHeader(headers, 'host');
  if (typeof rawHost !== 'string') return null;
  const host = rawHost.split(',')[0].trim().toLowerCase();
  if (!/^[a-z0-9.[\]:-]{1,255}$/i.test(host)) return null;

  const rawProto = getHeader(headers, 'x-forwarded-proto');
  const protoCandidate = typeof rawProto === 'string' ? rawProto.split(',')[0].trim().toLowerCase() : '';
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
  const proto = protoCandidate === 'http' || protoCandidate === 'https'
    ? protoCandidate
    : local
      ? 'http'
      : 'https';
  return parseOrigin(`${proto}://${host}`);
}

/** Normalises a comma-separated list into explicit origins. `*` is reported separately. */
export function normalizeOriginList(input) {
  const values = Array.isArray(input) ? input.flat(Infinity) : [input];
  const origins = new Set();
  let wildcard = false;
  for (const value of values) {
    if (typeof value !== 'string') continue;
    for (const raw of value.split(',')) {
      const item = raw.trim();
      if (!item) continue;
      if (item === '*') {
        wildcard = true;
        continue;
      }
      const origin = parseOrigin(item);
      if (origin) origins.add(origin);
    }
  }
  return { origins: [...origins], wildcard };
}

function deploymentOrigins(env) {
  const found = [];
  for (const name of ['VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_BRANCH_URL', 'VERCEL_URL']) {
    const raw = env?.[name];
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const withoutScheme = raw.trim().replace(/^https?:\/\//i, '');
    const origin = parseOrigin(`https://${withoutScheme}`);
    if (origin) found.push(origin);
  }
  return found;
}

/**
 * Resolves the trust configuration for one request.
 *
 * `allowedOrigins` can be passed in tests or by a wrapper. The request's own
 * origin is added from Host/X-Forwarded-Host so same-origin deployments keep
 * working without a build-time variable. A forged request from another site
 * still fails because its Origin cannot equal the host it was sent to.
 */
function getEnv() {
  return typeof process !== 'undefined' ? process.env : {};
}

export function resolveSecurityConfig({
  env = getEnv(),
  headers = {},
  allowedOrigins,
  requestOrigin,
  requireOrigin,
  allowMissingOrigin,
} = {}) {
  const configured = normalizeOriginList(
    [
      env?.APP_ORIGIN,
      env?.APP_ALLOWED_ORIGINS,
      allowedOrigins,
    ].filter((value) => value !== undefined && value !== null && value !== ''),
  );

  const trusted = new Set(configured.origins);
  for (const origin of deploymentOrigins(env)) trusted.add(origin);
  if (env?.NODE_ENV !== 'production') {
    for (const origin of DEV_ORIGINS) trusted.add(origin);
  }

  const ownOrigin = requestOrigin === undefined ? deriveRequestOrigin(headers) : parseOrigin(requestOrigin);
  if (ownOrigin) trusted.add(ownOrigin);

  return {
    allowedOrigins: [...trusted],
    wildcard: configured.wildcard,
    allowCredentials: String(env?.APP_CORS_ALLOW_CREDENTIALS || '').toLowerCase() === 'true',
    csrfCookieName: env?.CSRF_COOKIE_NAME || DEFAULT_CSRF_COOKIE,
    csrfHeaderNames: [env?.CSRF_HEADER_NAME, ...CSRF_HEADER_ALIASES]
      .filter(Boolean)
      .map((name) => String(name).toLowerCase()),
    requireOrigin: requireOrigin === undefined ? env?.APP_REQUIRE_ORIGIN !== 'false' : Boolean(requireOrigin),
    allowMissingOrigin: allowMissingOrigin === undefined
      ? env?.APP_ALLOW_MISSING_ORIGIN === 'true'
      : Boolean(allowMissingOrigin),
  };
}

export function isTrustedOrigin(origin, allowedOrigins = []) {
  const parsed = parseOrigin(origin);
  if (!parsed) return false;
  return allowedOrigins.some((allowed) => parseOrigin(allowed) === parsed);
}

/**
 * CORS headers for a trusted origin.
 *
 * A wildcard is only emitted for non-credentialed requests. When credentials
 * are enabled and the configured list is `*`, no CORS headers are emitted: the
 * caller must configure explicit origins instead of combining the two.
 */
export function buildCorsHeaders({
  origin,
  allowedOrigins = [],
  allowCredentials = false,
  methods = 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  allowHeaders = 'Authorization, Content-Type, X-CSRF-Token, Idempotency-Key',
  maxAge = '600',
} = {}) {
  const parsed = parseOrigin(origin);
  if (!parsed) return {};

  const wildcard = allowedOrigins.includes('*');
  if (wildcard) {
    if (allowCredentials) return { Vary: 'Origin' };
    return {
      'Access-Control-Allow-Origin': '*',
      Vary: 'Origin',
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': allowHeaders,
      'Access-Control-Max-Age': maxAge,
    };
  }

  if (!isTrustedOrigin(parsed, allowedOrigins)) return {};

  return {
    'Access-Control-Allow-Origin': parsed,
    Vary: 'Origin',
    ...(allowCredentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Max-Age': maxAge,
  };
}

/** Parses a Cookie header into first-wins name/value pairs. */
export function parseCookies(header) {
  const cookies = {};
  if (typeof header !== 'string' || !header.trim()) return cookies;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (!name || Object.prototype.hasOwnProperty.call(cookies, name)) continue;
    let value = part.slice(separator + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      value = decodeURIComponent(value);
    } catch {
      // Keep the raw value; constant-time comparison will reject malformed input.
    }
    cookies[name] = value;
  }
  return cookies;
}

export function readCsrfCookie(headers = {}, config = {}) {
  const cookies = parseCookies(getHeader(headers, 'cookie'));
  const names = [config.csrfCookieName, ...CSRF_COOKIE_ALIASES].filter(Boolean);
  for (const name of names) {
    if (typeof cookies[name] === 'string' && cookies[name].length > 0) return cookies[name];
  }
  return null;
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/**
 * Double-submit CSRF validation. Both halves must be present, have a sane
 * length and match. The comparison is constant-time to avoid leaking a prefix.
 */
export function validateCsrfToken(headers = {}, config = {}) {
  const cookieToken = readCsrfCookie(headers, config);
  const headerNames = config.csrfHeaderNames || CSRF_HEADER_ALIASES;
  let headerToken;
  for (const name of headerNames) {
    const value = getHeader(headers, name);
    if (typeof value === 'string' && value.length > 0) {
      headerToken = value;
      break;
    }
  }

  if (!cookieToken || !headerToken) {
    return { ok: false, code: 'csrf_token_missing' };
  }
  if (cookieToken.length < 16 || cookieToken.length > 512 || headerToken.length > 512) {
    return { ok: false, code: 'csrf_token_invalid' };
  }
  if (!constantTimeEqual(cookieToken, headerToken)) {
    return { ok: false, code: 'csrf_token_mismatch' };
  }
  return { ok: true, code: null };
}

/**
 * How the request authenticates. An Authorization header is treated as a
 * bearer API client even when the token is malformed: the handler rejects the
 * token, and a cross-site attacker cannot set that header in a browser.
 */
export function detectAuthMode(headers = {}) {
  if (getHeader(headers, 'authorization') !== undefined) return 'bearer';
  if (typeof getHeader(headers, 'cookie') === 'string' && getHeader(headers, 'cookie').trim()) return 'cookie';
  return 'anonymous';
}

function rejection(status, code, extra = {}) {
  return {
    ok: false,
    allowed: false,
    status,
    code,
    body: {
      error: code,
      code: code.toUpperCase(),
      message: SAFE_MESSAGES[code],
    },
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  };
}

/**
 * Evaluates one request against the policy. Pure: no response is written.
 *
 * @returns {{ok: boolean, status?: number, code?: string, body?: object, headers: object,
 *   authMode: string, origin: string|null, originSource: string, csrfRequired: boolean}}
 */
export function evaluateRequestSecurity({
  method,
  headers = {},
  env = getEnv(),
  allowedOrigins,
  requestOrigin,
  requireOrigin,
  allowMissingOrigin,
} = {}) {
  const upperMethod = String(method || 'GET').toUpperCase();
  const config = resolveSecurityConfig({
    env, headers, allowedOrigins, requestOrigin, requireOrigin, allowMissingOrigin,
  });
  const originInfo = getRequestOrigin(headers);
  const authMode = detectAuthMode(headers);
  const corsHeaders = buildCorsHeaders({
    origin: originInfo.origin || getHeader(headers, 'origin'),
    allowedOrigins: config.allowedOrigins,
    allowCredentials: config.allowCredentials,
  });

  // Read-only requests stay public. CORS is still restricted by the browser.
  if (!isMutatingMethod(upperMethod)) {
    return {
      ok: true,
      allowed: true,
      headers: corsHeaders,
      authMode,
      origin: originInfo.origin,
      originSource: originInfo.source,
      csrfRequired: false,
    };
  }

  if (originInfo.invalid) {
    return { ...rejection(403, 'origin_not_allowed', corsHeaders), authMode, origin: null, originSource: originInfo.source, csrfRequired: authMode === 'cookie' };
  }

  if (originInfo.origin) {
    if (!isTrustedOrigin(originInfo.origin, config.allowedOrigins)) {
      return { ...rejection(403, 'origin_not_allowed', corsHeaders), authMode, origin: originInfo.origin, originSource: originInfo.source, csrfRequired: authMode === 'cookie' };
    }
  } else {
    const fetchSite = getHeader(headers, 'sec-fetch-site');
    if (typeof fetchSite === 'string' && fetchSite.toLowerCase() === 'cross-site') {
      return { ...rejection(403, 'origin_missing', corsHeaders), authMode, origin: null, originSource: originInfo.source, csrfRequired: authMode === 'cookie' };
    }

    // A cookie-authenticated mutation with no Origin cannot be distinguished
    // from a cross-site form post, so it is always rejected.
    if (authMode === 'cookie') {
      return { ...rejection(403, 'origin_missing', corsHeaders), authMode, origin: null, originSource: originInfo.source, csrfRequired: true };
    }

    // Non-browser bearer clients and direct unit/integration calls may omit
    // Origin. Browser intake endpoints are required to provide it.
    if (!config.allowMissingOrigin && config.requireOrigin && authMode !== 'bearer') {
      return { ...rejection(403, 'origin_missing', corsHeaders), authMode, origin: null, originSource: originInfo.source, csrfRequired: false };
    }
  }

  if (authMode === 'cookie') {
    const csrf = validateCsrfToken(headers, config);
    if (!csrf.ok) {
      return { ...rejection(403, csrf.code, corsHeaders), authMode, origin: originInfo.origin, originSource: originInfo.source, csrfRequired: true };
    }
  }

  return {
    ok: true,
    allowed: true,
    headers: corsHeaders,
    authMode,
    origin: originInfo.origin,
    originSource: originInfo.source,
    csrfRequired: authMode === 'cookie',
  };
}

/** Writes security decision headers to a Vercel-style response when supported. */
export function applySecurityHeaders(res, headers = {}) {
  if (!res || typeof res.setHeader !== 'function') return;
  for (const [name, value] of Object.entries(headers || {})) {
    if (value !== undefined) res.setHeader(name, value);
  }
}

/**
 * Applies the policy to a request. Returns `{ handled: true }` when the guard
 * has written a response itself (preflight or rejection).
 */
export function enforceRequestSecurity(req, res, options = {}) {
  const method = String(req?.method || 'GET').toUpperCase();
  const verdict = evaluateRequestSecurity({
    method,
    headers: req?.headers || {},
    ...options,
  });

  applySecurityHeaders(res, verdict.headers);
  applySecurityHeaders(res, { 'X-Content-Type-Options': 'nosniff' });

  if (method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.status(204);
      if (typeof res.end === 'function') res.end();
    }
    return { handled: true, allowed: true, verdict };
  }

  if (!verdict.ok) {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      res.status(verdict.status).json(verdict.body);
    }
    return { handled: true, allowed: false, verdict };
  }

  return { handled: false, allowed: true, verdict };
}

/**
 * Wraps a Vercel handler. `allowMissingOrigin` keeps direct server-to-server
 * calls working on legacy top-level functions; forged Origins and cookie CSRF
 * are always enforced there.
 */
export function withRequestSecurity(handler, options = {}) {
  if (typeof handler !== 'function') throw new TypeError('withRequestSecurity needs a handler function');
  return async function securedHandler(req, res) {
    const result = enforceRequestSecurity(req, res, options);
    if (result.handled) return undefined;
    return handler(req, res);
  };
}

/** Fixed, non-sensitive error payload used by the API dispatcher's last-resort catch. */
export function internalErrorResponse() {
  return {
    error: 'internal_server_error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'The request could not be completed.',
  };
}