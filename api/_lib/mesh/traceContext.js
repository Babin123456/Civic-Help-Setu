/**
 * api/_lib/mesh/traceContext.js
 *
 * W3C Trace Context propagation, correlation IDs, and zero-PII span telemetry
 * for the Internal Service Mesh Readiness Layer (#1276).
 *
 * Reuses HMAC privacy-minimized identifier hashing from api/_lib/abuseControlPlane.js
 * and mirrors the zero-PII redaction discipline of securityEventCorrelationService.js.
 */

import { randomBytes } from 'node:crypto';
import { privacyIdentifier } from '../abuseControlPlane.js';

const TRACEPARENT_REGEX = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;
const ALL_ZERO_TRACE = '00000000000000000000000000000000';
const ALL_ZERO_SPAN = '0000000000000000';
const CORRELATION_ID_REGEX = /^[A-Za-z0-9._-]{4,128}$/;

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const SENSITIVE_KEY_SUBSTRINGS = [
  'token',
  'password',
  'passwd',
  'secret',
  'jwt',
  'auth',
  'bearer',
  'privatekey',
  'private_key',
  'pem',
  'aadhaar',
  'pan',
  'mobile',
  'phone',
  'email',
  'otp',
  'assertion',
  'cookie',
];

function defaultRandomHex(byteLength) {
  return randomBytes(byteLength).toString('hex');
}

function readHeader(headers = {}, targetName) {
  const lowerTarget = targetName.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === lowerTarget) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

/**
 * Parses a W3C `traceparent` header. Returns null if malformed or all-zero.
 */
export function parseTraceparent(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const trimmed = headerValue.trim();
  const match = TRACEPARENT_REGEX.exec(trimmed);
  if (!match) return null;

  const version = match[1].toLowerCase();
  const traceId = match[2].toLowerCase();
  const spanId = match[3].toLowerCase();
  const traceFlags = match[4].toLowerCase();

  if (version === 'ff' || traceId === ALL_ZERO_TRACE || spanId === ALL_ZERO_SPAN) {
    return null;
  }

  return { version, traceId, spanId, traceFlags };
}

/**
 * Formats a W3C `traceparent` header string.
 */
export function formatTraceparent({ version = '00', traceId, spanId, traceFlags = '01' }) {
  return `${version}-${traceId}-${spanId}-${traceFlags}`;
}

/**
 * Extracts valid trace context from incoming headers or creates a new root trace.
 * Always mints a fresh local `spanId` while preserving `traceId` and `parentSpanId`.
 */
export function extractOrCreateTraceContext(
  headers = {},
  { randomHex = defaultRandomHex, now = Date.now } = {}
) {
  const rawTraceparent = readHeader(headers, 'traceparent');
  const parsed = parseTraceparent(rawTraceparent);
  const rawTracestate = readHeader(headers, 'tracestate');
  const rawCorrelation = readHeader(headers, 'x-correlation-id') || readHeader(headers, 'x-request-id');

  const traceId = parsed ? parsed.traceId : randomHex(16);
  const parentSpanId = parsed ? parsed.spanId : null;
  const spanId = randomHex(8);
  const traceFlags = parsed ? parsed.traceFlags : '01';

  const correlationId =
    typeof rawCorrelation === 'string' && CORRELATION_ID_REGEX.test(rawCorrelation.trim())
      ? rawCorrelation.trim()
      : `corr_${traceId.slice(0, 16)}`;

  const rawDeadline = readHeader(headers, 'x-request-deadline-ms');
  const parsedDeadline = rawDeadline !== undefined ? Number(rawDeadline) : NaN;
  const deadlineMs =
    Number.isFinite(parsedDeadline) && parsedDeadline > 0 ? Math.floor(parsedDeadline) : null;

  const tracestate =
    typeof rawTracestate === 'string' && rawTracestate.trim().length > 0
      ? rawTracestate.trim().slice(0, 512)
      : null;

  return {
    traceId,
    spanId,
    parentSpanId,
    traceFlags,
    tracestate,
    correlationId,
    deadlineMs,
    startedAtMs: now(),
    traceparent: formatTraceparent({ traceId, spanId, traceFlags }),
    inherited: Boolean(parsed),
  };
}

/**
 * Creates a child span context for an outbound hop from an existing trace context.
 */
export function createChildSpanContext(
  parentContext,
  { randomHex = defaultRandomHex, now = Date.now } = {}
) {
  if (!parentContext || typeof parentContext.traceId !== 'string') {
    return extractOrCreateTraceContext({}, { randomHex, now });
  }
  const spanId = randomHex(8);
  const traceFlags = parentContext.traceFlags || '01';
  return {
    traceId: parentContext.traceId,
    spanId,
    parentSpanId: parentContext.spanId || null,
    traceFlags,
    tracestate: parentContext.tracestate || null,
    correlationId: parentContext.correlationId || `corr_${parentContext.traceId.slice(0, 16)}`,
    deadlineMs: parentContext.deadlineMs || null,
    startedAtMs: now(),
    traceparent: formatTraceparent({
      traceId: parentContext.traceId,
      spanId,
      traceFlags,
    }),
    inherited: true,
  };
}

/**
 * Injects W3C traceparent, correlation ID, and optional deadline into outbound headers.
 */
export function injectTraceHeaders(headers = {}, traceContext, { deadlineMs } = {}) {
  const next = { ...headers };
  if (!traceContext) return next;

  next.traceparent = formatTraceparent(traceContext);
  next['x-correlation-id'] = traceContext.correlationId;
  if (traceContext.tracestate) {
    next.tracestate = traceContext.tracestate;
  }
  const effectiveDeadline = deadlineMs ?? traceContext.deadlineMs;
  if (Number.isFinite(effectiveDeadline) && effectiveDeadline > 0) {
    next['x-request-deadline-ms'] = String(Math.floor(effectiveDeadline));
  }
  return next;
}

/**
 * Scrubs citizen PII, bearer tokens, private keys, and raw secrets from telemetry values.
 */
export function scrubTelemetryPayload(value, depth = 0) {
  if (depth > 6) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    return value
      .replace(AADHAAR_REGEX, '[REDACTED_AADHAAR]')
      .replace(PAN_REGEX, '[REDACTED_PAN]')
      .replace(PHONE_REGEX, '[REDACTED_PHONE]')
      .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
      .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[REDACTED_PEM]')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => scrubTelemetryPayload(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const normalized = k.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const isSensitive = SENSITIVE_KEY_SUBSTRINGS.some((sub) => normalized.includes(sub));
      out[k] = isSensitive ? '[REDACTED]' : scrubTelemetryPayload(v, depth + 1);
    }
    return out;
  }

  return value;
}

/**
 * Bounded zero-PII span/metric collector for mesh readiness telemetry.
 */
export function createTelemetryCollector({
  maxEvents = 1000,
  secret = 'mesh-telemetry-hmac-dev',
  now = Date.now,
  onSpan = null,
} = {}) {
  if (!Number.isInteger(maxEvents) || maxEvents < 1) {
    throw new TypeError('createTelemetryCollector requires positive integer maxEvents');
  }

  const spans = [];
  const counters = {
    totalSpans: 0,
    authAllowed: 0,
    authPermissiveBypass: 0,
    authDenied: 0,
    retries: 0,
    breakerTrips: 0,
    timeouts: 0,
    bulkheadRejects: 0,
  };

  function hashActor(rawActor) {
    if (!rawActor || typeof rawActor !== 'string') return null;
    return privacyIdentifier(rawActor, secret);
  }

  function recordSpan(span = {}) {
    const sanitized = {
      traceId: span.traceId || null,
      spanId: span.spanId || null,
      parentSpanId: span.parentSpanId || null,
      correlationId: span.correlationId || null,
      callerService: span.callerService || 'anonymous',
      targetService: span.targetService || 'local',
      route: typeof span.route === 'string' ? span.route.split('?')[0].slice(0, 128) : 'unknown',
      method: typeof span.method === 'string' ? span.method.toUpperCase() : 'GET',
      authMode: span.authMode || 'disabled',
      authOutcome: span.authOutcome || 'skipped',
      endUserHash: span.endUserId ? hashActor(span.endUserId) : null,
      breakerState: span.breakerState || null,
      attempts: Number.isFinite(span.attempts) ? span.attempts : 1,
      durationMs: Number.isFinite(span.durationMs) ? Math.max(0, Math.round(span.durationMs)) : 0,
      status: Number.isFinite(span.status) ? span.status : 0,
      errorCode: span.errorCode || null,
      metadata: span.metadata ? scrubTelemetryPayload(span.metadata) : undefined,
      recordedAt: new Date(now()).toISOString(),
    };

    counters.totalSpans += 1;
    if (sanitized.authOutcome === 'allowed') counters.authAllowed += 1;
    if (sanitized.authOutcome === 'permissive_bypass') counters.authPermissiveBypass += 1;
    if (sanitized.authOutcome === 'denied') counters.authDenied += 1;
    if (sanitized.attempts > 1) counters.retries += sanitized.attempts - 1;
    if (sanitized.errorCode === 'MESH_TIMEOUT') counters.timeouts += 1;
    if (sanitized.errorCode === 'MESH_BULKHEAD_REJECTED') counters.bulkheadRejects += 1;
    if (sanitized.errorCode === 'MESH_BREAKER_OPEN') counters.breakerTrips += 1;

    if (spans.length >= maxEvents) {
      spans.shift();
    }
    spans.push(sanitized);

    if (typeof onSpan === 'function') {
      try {
        onSpan(sanitized);
      } catch {
        // Telemetry sink failures must never break request handling.
      }
    }

    return sanitized;
  }

  return {
    recordSpan,
    getSpans(limit = 50) {
      const safeLimit = Math.max(1, Math.min(maxEvents, Number(limit) || 50));
      return spans.slice(-safeLimit);
    },
    getCounters() {
      return { ...counters, bufferedSpans: spans.length, maxEvents };
    },
    clear() {
      spans.length = 0;
      for (const key of Object.keys(counters)) {
        counters[key] = 0;
      }
    },
  };
}
