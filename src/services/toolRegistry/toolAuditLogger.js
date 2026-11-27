/**
 * PII-Scrubbed Audit Logger & Observability Counters for Tool Registry (#1146)
 *
 * Records tool invocation metadata and security decisions without exposing raw
 * citizen payloads, credentials, capability tokens, or private document content.
 */

const PII_STRING_PATTERNS = Object.freeze([
  { regex: /\bBearer\s+[A-Za-z0-9._-]{10,512}\b/gi, replacement: '[REDACTED:TOKEN]' },
  { regex: /\beyJ[A-Za-z0-9_-]{8,256}\.[A-Za-z0-9_-]{8,256}\.[A-Za-z0-9_-]{8,256}\b/g, replacement: '[REDACTED:JWT]' },
  { regex: /\bctok_v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, replacement: '[REDACTED:CAPABILITY]' },
  { regex: /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,128}\.[A-Za-z]{2,24}\b/g, replacement: '[REDACTED:EMAIL]' },
  { regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, replacement: '[REDACTED:PAN]' },
  { regex: /\b[2-9][0-9]{3}(?:[ -]?[0-9]{4}){2}\b/g, replacement: '[REDACTED:AADHAAR]' },
  { regex: /(?:\+91[- ]?)?[6-9][0-9]{9}\b/g, replacement: '[REDACTED:PHONE]' },
]);

export function scrubSafeAuditString(input, maxLength = 240) {
  if (typeof input !== 'string') return '';
  let out = input.slice(0, maxLength);
  for (const { regex, replacement } of PII_STRING_PATTERNS) {
    out = out.replace(regex, replacement);
  }
  return out;
}

export function extractSafeArgKeys(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return [];
  return Object.getOwnPropertyNames(args)
    .filter((k) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype')
    .slice(0, 16);
}

export function createToolAuditLogger({ maxEntries = 500, now = Date.now } = {}) {
  const entries = [];
  const metrics = {
    issuedCapabilities: 0,
    allowedInvocations: 0,
    deniedInvocations: 0,
    replayBlocked: 0,
    crossUserBlocked: 0,
    privilegeEscalationBlocked: 0,
    schemaRejected: 0,
    revocationBlocked: 0,
    totalLatencyMs: 0,
    latencyCount: 0,
  };

  function record(event) {
    const safeEntry = {
      eventId: event.eventId || `tevt-${now()}-${entries.length + 1}`,
      timestamp: new Date(now()).toISOString(),
      correlationId: scrubSafeAuditString(String(event.correlationId || 'none'), 64),
      actorId: scrubSafeAuditString(String(event.actorId || 'anonymous'), 64),
      actorRole: event.actorRole === 'admin' ? 'admin' : 'citizen',
      toolName: scrubSafeAuditString(String(event.toolName || 'unknown'), 64),
      riskTier: event.riskTier || 'UNKNOWN',
      scopes: Array.isArray(event.scopes) ? event.scopes.slice(0, 8) : [],
      jti: event.jti ? scrubSafeAuditString(String(event.jti), 64) : null,
      decision: event.decision || 'DENIED',
      errorCode: event.errorCode || null,
      argKeys: extractSafeArgKeys(event.args),
      provenanceVerified: Boolean(event.provenanceVerified),
      latencyMs: typeof event.latencyMs === 'number' && Number.isFinite(event.latencyMs)
        ? Math.max(0, Math.round(event.latencyMs))
        : 0,
      reason: event.reason ? scrubSafeAuditString(String(event.reason), 240) : null,
    };

    entries.unshift(safeEntry);
    if (entries.length > maxEntries) {
      entries.length = maxEntries;
    }

    if (safeEntry.decision === 'CAPABILITY_ISSUED') {
      metrics.issuedCapabilities += 1;
    } else if (safeEntry.decision === 'ALLOWED') {
      metrics.allowedInvocations += 1;
      metrics.totalLatencyMs += safeEntry.latencyMs;
      metrics.latencyCount += 1;
    } else if (safeEntry.decision === 'DENIED') {
      metrics.deniedInvocations += 1;
      if (safeEntry.errorCode === 'CAPABILITY_REPLAYED') metrics.replayBlocked += 1;
      if (safeEntry.errorCode === 'CROSS_USER_DENIED') metrics.crossUserBlocked += 1;
      if (safeEntry.errorCode === 'SCOPE_DENIED') metrics.privilegeEscalationBlocked += 1;
      if (safeEntry.errorCode === 'INVALID_SCHEMA') metrics.schemaRejected += 1;
      if (
        safeEntry.errorCode === 'TOOL_REVOKED' ||
        safeEntry.errorCode === 'CAPABILITY_REVOKED' ||
        safeEntry.errorCode === 'USER_REVOKED'
      ) {
        metrics.revocationBlocked += 1;
      }
    }

    return safeEntry;
  }

  function list({ limit = 50, toolName = null, decision = null } = {}) {
    const bounded = Math.max(1, Math.min(Number(limit) || 50, maxEntries));
    return entries
      .filter((entry) => (!toolName || entry.toolName === toolName) && (!decision || entry.decision === decision))
      .slice(0, bounded);
  }

  function getMetrics() {
    return {
      ...metrics,
      averageLatencyMs: metrics.latencyCount > 0
        ? Math.round((metrics.totalLatencyMs / metrics.latencyCount) * 100) / 100
        : 0,
      storedEvents: entries.length,
    };
  }

  return { record, list, getMetrics };
}
