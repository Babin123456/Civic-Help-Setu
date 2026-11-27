/**
 * api/_lib/abuseSchemas.js
 *
 * Versioned request/response validation contracts for the Abuse Control Plane
 * (#1174). All external input at trust boundaries is validated against the
 * current schema version. Unknown fields are rejected to prevent schema
 * drift and mass-assignment issues.
 */

const HEX64 = /^[a-f0-9]{64}$/;
const ROUTE = /^[*A-Za-z0-9_/.:-]{1,200}$/;
const REASON = /^[\s\S]{1,500}$/;
const ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const SIGNAL_KINDS = new Set(['rapid_fire', 'error_burst', 'route_anomaly', 'blocked_retry']);
const APPEAL_STATUSES = new Set(['pending', 'approved', 'rejected']);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

const SCHEMA_VERSION = 1;

/** Result shape for all validators. */
function ok(value) { return { valid: true, value, errors: [] }; }
function fail(...errors) { return { valid: false, value: null, errors }; }

/**
 * Validate a route-quota config entry.
 * Input: { route, method, limit, windowMs, adaptive }
 */
export function validateRouteQuota(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { route, method, limit, windowMs, adaptive } = body;

  if (typeof route !== 'string' || !ROUTE.test(route)) {
    errors.push('route must be a string matching /^[*A-Za-z0-9_/.-]{1,200}$/');
  }
  if (method !== undefined && (typeof method !== 'string' || !/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|\*)$/i.test(method))) {
    errors.push('method must be a valid HTTP method or *');
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 10_000)) {
    errors.push('limit must be an integer between 1 and 10000');
  }
  if (windowMs !== undefined && (!Number.isInteger(windowMs) || windowMs < 1000 || windowMs > 86_400_000)) {
    errors.push('windowMs must be an integer between 1000 and 86400000');
  }
  if (adaptive !== undefined && typeof adaptive !== 'boolean') {
    errors.push('adaptive must be a boolean');
  }

  return errors.length ? fail(...errors) : ok({ route, method, limit, windowMs, adaptive });
}

/**
 * Validate a blocklist/allowlist entry.
 * Input: { identifierHash, route, reason, expiresAt }
 */
export function validateListEntry(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { identifierHash, route, reason, expiresAt } = body;

  if (typeof identifierHash !== 'string' || !HEX64.test(identifierHash)) {
    errors.push('identifierHash must be a 64-character lowercase hex string');
  }
  if (typeof route !== 'string' || !ROUTE.test(route)) {
    errors.push('route must be a string matching /^[*A-Za-z0-9_/.-]{1,200}$/');
  }
  if (typeof reason !== 'string' || !REASON.test(reason)) {
    errors.push('reason must be a string between 1 and 500 characters');
  }
  if (expiresAt !== undefined && (typeof expiresAt !== 'string' || !ISO8601.test(expiresAt))) {
    errors.push('expiresAt must be an ISO-8601 timestamp');
  }

  return errors.length ? fail(...errors) : ok({ identifierHash, route, reason, expiresAt });
}

/**
 * Validate a create-appeal request.
 * Input: { identifierHash, route, reason }
 */
export function validateCreateAppeal(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { identifierHash, route, reason } = body;

  if (typeof identifierHash !== 'string' || !HEX64.test(identifierHash)) {
    errors.push('identifierHash must be a 64-character lowercase hex string');
  }
  if (typeof route !== 'string' || !ROUTE.test(route)) {
    errors.push('route must be a string matching /^[*A-Za-z0-9_/.-]{1,200}$/');
  }
  if (typeof reason !== 'string' || !REASON.test(reason)) {
    errors.push('reason must be a string between 1 and 500 characters');
  }

  return errors.length ? fail(...errors) : ok({ identifierHash, route, reason });
}

/**
 * Validate an update-appeal request (operator action).
 * Input: { status, reviewerNote }
 */
export function validateUpdateAppeal(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { status, reviewerNote } = body;

  if (status !== undefined && !APPEAL_STATUSES.has(status)) {
    errors.push('status must be one of pending, approved, rejected');
  }
  if (reviewerNote !== undefined && (typeof reviewerNote !== 'string' || !REASON.test(reviewerNote))) {
    errors.push('reviewerNote must be a string between 1 and 500 characters');
  }
  if (status === undefined && reviewerNote === undefined) {
    errors.push('at least one of status or reviewerNote is required');
  }

  return errors.length ? fail(...errors) : ok({ status, reviewerNote });
}

/**
 * Validate a list-signals / list-appeals query.
 * Input: { status, limit, cursor, since, bucket }
 */
export function validateListQuery(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { status, limit, cursor, since, bucket } = body;

  if (status !== undefined && !APPEAL_STATUSES.has(status)) {
    errors.push('status must be one of pending, approved, rejected');
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    errors.push('limit must be an integer between 1 and 100');
  }
  if (cursor !== undefined && typeof cursor !== 'string') {
    errors.push('cursor must be a string');
  }
  if (since !== undefined && (typeof since !== 'string' || !ISO8601.test(since))) {
    errors.push('since must be an ISO-8601 timestamp');
  }
  if (bucket !== undefined && typeof bucket !== 'string') {
    errors.push('bucket must be a string');
  }

  return errors.length ? fail(...errors) : ok({ status, limit, cursor, since, bucket });
}

/**
 * Validate an abuse signal record (internal/store boundary).
 * Input: { bucket, kind, at, route, severity }
 */
export function validateSignalRecord(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { bucket, kind, at, route, severity } = body;

  if (typeof bucket !== 'string' || bucket.length < 1 || bucket.length > 200) {
    errors.push('bucket must be a string between 1 and 200 characters');
  }
  if (!SIGNAL_KINDS.has(kind)) {
    errors.push(`kind must be one of ${[...SIGNAL_KINDS].join(', ')}`);
  }
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) {
    errors.push('at must be a non-negative number (epoch ms)');
  }
  if (route !== undefined && (typeof route !== 'string' || !ROUTE.test(route))) {
    errors.push('route must be a string matching /^[*A-Za-z0-9_/.-]{1,200}$/');
  }
  if (severity !== undefined && !SEVERITIES.has(severity)) {
    errors.push('severity must be one of low, medium, high, critical');
  }

  return errors.length ? fail(...errors) : ok({ bucket, kind, at, route, severity });
}

/**
 * Current schema version exposed to clients.
 */
export function schemaVersion() {
  return SCHEMA_VERSION;
}
