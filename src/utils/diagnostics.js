import { minimizeForExternal } from './dataMinimization';

/**
 * The one place that decides what a diagnostic event may contain.
 *
 * Today nothing leaves the browser (docs/INTEGRATIONS.md): there is no error tracker, and the
 * events built here only go to a "sink" if someone registers one with setDiagnosticsSink. Whatever
 * sink is added later receives only what this file lets through, so it cannot capture form
 * contents, contact or identity details, reference IDs, tokens, query strings or request bodies.
 *
 *   buildErrorEvent   an error as { name, code, status, message, route }
 *   describeRequest   a request as { method, target, hasBody }: never the body or the headers
 *   routeOf           the route *pattern* for a URL ("/services/:id"), never the real path
 *   redactValue       any object, keeping only allow-listed keys
 *   logDiagnostic     replacement for console.error(label, error) in app code
 *
 * Rules: deny by default (unknown object keys are removed, not scanned for bad values), URLs are cut
 * to route names, and text goes through the same patterns as everything else we hand to a third
 * party (dataMinimization.js).
 */

/** Route patterns of the app. Anything else is reported as "/[other]" so odd paths are not echoed. */
export const ROUTE_PATTERNS = [
  '/',
  '/login',
  '/signup',
  '/signup/sso-callback',
  '/sso-callback',
  '/assistant',
  '/services',
  '/services/:id',
  '/eligibility',
  '/nearby',
  '/nearby-offices',
  '/track',
  '/shared-checklist/:token',
  '/saved',
  '/vault',
  '/profile',
  '/open-source',
  '/privacy',
  '/admin',
];

export const UNKNOWN_ROUTE = '/[other]';

/** Object keys whose values may appear in an event. Everything else is replaced. */
export const SAFE_KEYS = ['code', 'status', 'statusCode', 'route', 'type', 'kind', 'method', 'level', 'event', 'reason', 'count', 'size', 'length', 'attempt'];

export const REDACTED = '[REDACTED]';
export const OMITTED = '[OMITTED]';

const SAFE_ERROR_NAMES = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError', 'AbortError', 'NetworkError', 'QuotaExceededError', 'SecurityError', 'NotAllowedError', 'NotFoundError', 'DOMException'];
const SAFE_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

const MAX_MESSAGE = 200;
const MAX_DEPTH = 4;
const MAX_ITEMS = 20;

const matchesPattern = (pattern, segments) => {
  const parts = pattern.split('/').filter(Boolean);
  if (parts.length !== segments.length) return false;
  return parts.every((part, i) => part.startsWith(':') || part === segments[i]);
};

/** The route pattern for a path or URL: "/services/:id" for "/services/ration-card?x=1". */
export const routeOf = (input) => {
  if (typeof input !== 'string') return UNKNOWN_ROUTE;
  let pathname;
  try {
    pathname = new URL(input, 'http://localhost').pathname;
  } catch {
    return UNKNOWN_ROUTE;
  }
  const segments = pathname.split('/').filter(Boolean);
  const hit = ROUTE_PATTERNS.find((pattern) => matchesPattern(pattern, segments));
  return hit ?? UNKNOWN_ROUTE;
};

/**
 * A URL cut down to what is safe to log: the origin for other sites, and only the route pattern
 * for this app. No query string, fragment, credentials or path parameters.
 */
export const redactUrl = (input, base = globalThis.location?.origin ?? 'http://localhost') => {
  try {
    const url = new URL(String(input), base);
    if (url.origin === new URL(base).origin) return routeOf(url.pathname);
    return url.origin;
  } catch {
    return OMITTED;
  }
};

const URL_IN_TEXT = /\bhttps?:\/\/[^\s"'<>)\]]+/gi;
const SCHEMELESS_QUERY = /(\/[\w./-]*)\?[^\s"'<>)\]]*/g;

/** Text with URLs cut to their origin and personal data and secrets masked. */
export const redactText = (value, max = MAX_MESSAGE) => {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .replace(URL_IN_TEXT, (match) => redactUrl(match))
    .replace(SCHEMELESS_QUERY, '$1');
  return minimizeForExternal(text).replace(/\s+/g, ' ').trim().slice(0, max);
};

/**
 * Deep copy that keeps only SAFE_KEYS. Strings are masked, numbers and booleans pass, Errors are
 * reduced to their safe fields, deep or large structures are cut off, and cycles are safe.
 */
export const redactValue = (value, depth = 0, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value !== 'object') return OMITTED; // functions, symbols, bigint
  if (seen.has(value)) return '[CIRCULAR]';
  if (depth >= MAX_DEPTH) return OMITTED;
  seen.add(value);

  if (value instanceof Error) return buildErrorEvent(value);
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => redactValue(item, depth + 1, seen));

  const out = {};
  for (const key of Object.keys(value).slice(0, MAX_ITEMS * 2)) {
    out[key] = SAFE_KEYS.includes(key) ? redactValue(value[key], depth + 1, seen) : REDACTED;
  }
  return out;
};

const safeCode = (error) => {
  const raw = error?.errors?.[0]?.code ?? error?.code;
  return typeof raw === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(raw) ? raw : undefined;
};

const safeStatus = (error) => {
  const status = error?.status ?? error?.statusCode;
  return Number.isInteger(status) && status >= 100 && status < 600 ? status : undefined;
};

/**
 * An error as a plain, safe object. The stack, `cause`, `errors` array and any extra properties
 * (a response, a request, form state) are never copied.
 * @param {unknown} error
 * @param {{ route?: string }} [context] route is a URL or path; only its pattern is kept
 */
export function buildErrorEvent(error, { route } = {}) {
  const name = typeof error?.name === 'string' && SAFE_ERROR_NAMES.includes(error.name) ? error.name : 'Error';
  const event = { type: 'error', name };
  const code = safeCode(error);
  const status = safeStatus(error);
  if (code) event.code = code;
  if (status) event.status = status;
  event.message = redactText(typeof error === 'string' ? error : error?.message);
  event.route = routeOf(route ?? globalThis.location?.pathname ?? '/');
  return event;
}

/**
 * A request as { method, target, hasBody }. The body and the headers (which carry Authorization
 * and cookies) are never included, and neither is the query string.
 */
export const describeRequest = ({ method = 'GET', url, body } = {}) => {
  const upper = typeof method === 'string' ? method.toUpperCase() : 'GET';
  return {
    type: 'request',
    method: SAFE_METHODS.includes(upper) ? upper : 'OTHER',
    target: url === undefined ? OMITTED : redactUrl(url),
    hasBody: body !== undefined && body !== null,
  };
};

let sink = null;

/** Plug in an error tracker later: it receives only redacted events. Pass null to remove it. */
export const setDiagnosticsSink = (fn) => {
  sink = typeof fn === 'function' ? fn : null;
};

/** Builds a safe event for `error` and hands it to the sink, if there is one. Never throws. */
export const reportError = (error, context = {}) => {
  const event = buildErrorEvent(error, context);
  if (sink) {
    try {
      sink(event);
    } catch {
      // a broken tracker must not break the app
    }
  }
  return event;
};

const isDev = () => Boolean(import.meta.env?.DEV);

/**
 * Use instead of console.error(label, error). Production logs the fixed label and nothing else;
 * the error can carry a slice of the stored data (JSON.parse errors quote it). Development adds the
 * safe fields so problems can still be found.
 * @param {string} label short fixed text, never built from user data
 * @param {unknown} [error]
 * @param {{ dev?: boolean, log?: Function }} [options] overridable for tests
 */
export const logDiagnostic = (label, error, { dev = isDev(), log = console.error } = {}) => {
  if (!dev || error === undefined) {
    log(label);
    return;
  }
  log(label, buildErrorEvent(error));
};
