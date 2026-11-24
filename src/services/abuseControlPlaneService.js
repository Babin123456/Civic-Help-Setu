import { apiFailureError } from '../utils/civicErrorContract.js';
/**
 * src/services/abuseControlPlaneService.js
 *
 * Client-side service for the Abuse Control Plane (#1174).
 *
 * Provides the non-AI fallback paths for essential workflows:
 *  - Checking whether a request would be rate-limited before submitting.
 *  - Creating and tracking abuse appeals (false-positive recovery).
 *  - Reading the current schema version for client compatibility.
 *
 * All calls go through /api/abuse-control-plane with JSON bodies. Errors use
 * stable codes (rate_limited, validation_failed, appeal_not_found, ...) and
 * never leak raw server internals or PII.
 */

const BASE = '/api/abuse-control-plane';

class AbuseControlPlaneError extends Error {
  constructor(message, code, status, meta = {}) {
    super(message);
    this.name = 'AbuseControlPlaneError';
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  let res;
  try { res = await fetch(`${BASE}${path}`, opts); } catch { throw apiFailureError(); }
  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const safe = apiFailureError(res, data);
    throw Object.assign(new AbuseControlPlaneError(safe.message, safe.code, safe.status), { retryable: safe.retryable, recoveryAction: safe.recoveryAction, correlationId: safe.correlationId, meta: { retryAfterSeconds: safe.retryAfterSeconds } });
  }
  return data;
}

export { AbuseControlPlaneError };

/** Returns the schema version the client should use to format requests. */
export async function getSchemaVersion() {
  const data = await request('?schema=1');
  return data.schemaVersion || 1;
}

/**
 * Pre-flight check: asks the control plane whether a request would be allowed.
 * Returns { allowed, reason, retryAfterSeconds, remaining }.
 * Used by clients to avoid wasted submissions and show a friendly retry hint.
 */
export async function checkAllowance({ route, method = 'GET' } = {}) {
  const data = await request(`?route=${encodeURIComponent(route)}&method=${method}`);
  return {
    allowed: data.allowed,
    reason: data.reason,
    retryAfterSeconds: data.retryAfterSeconds,
    remaining: data.remaining,
    natShared: Boolean(data.natShared),
  };
}

/** Create an abuse appeal (false-positive recovery path). Returns the appeal record. */
export async function createAppeal({ identifierHash, route, reason } = {}) {
  return await request('/appeals', { method: 'POST', body: { identifierHash, route, reason } });
}

/** Get the status of an appeal by id. */
export async function getAppeal(appealId) {
  return await request(`/appeals/${encodeURIComponent(appealId)}`);
}

/** List appeals (operator). Optional filters: status, limit, cursor. */
export async function listAppeals({ status, limit, cursor } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (limit) qs.set('limit', limit);
  if (cursor) qs.set('cursor', cursor);
  const path = qs.toString() ? `/appeals?${qs.toString()}` : '/appeals';
  return await request(path);
}

/** Operator: update an appeal (approve/reject) with a reviewer note. High impact. */
export async function updateAppeal(appealId, { status, reviewerNote } = {}) {
  return await request(`/appeals/${encodeURIComponent(appealId)}`, {
    method: 'PATCH',
    body: { status, reviewerNote },
  });
}

/** Operator: blocklist a hashed identifier for a route. */
export async function blocklist({ identifierHash, route, reason, expiresAt } = {}) {
  return await request('/blocklist', { method: 'POST', body: { identifierHash, route, reason, expiresAt } });
}

/** Operator: allowlist a hashed identifier for a route. */
export async function allowlist({ identifierHash, route, reason, expiresAt } = {}) {
  return await request('/allowlist', { method: 'POST', body: { identifierHash, route, reason, expiresAt } });
}

/** Operator: list abuse signals for a bucket. */
export async function listSignals({ bucket, since } = {}) {
  const qs = new URLSearchParams();
  if (bucket) qs.set('bucket', bucket);
  if (since) qs.set('since', since);
  const path = qs.toString() ? `/signals?${qs.toString()}` : '/signals';
  return await request(path);
}
