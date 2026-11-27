/**
 * api/_lib/schemaUpcaster.js
 *
 * Versioned Payload Schema Upcaster & Backward-Compatibility Adapter Layer (#1462).
 *
 * Features:
 *  - Pure, deterministic multi-hop schema upcasting (`v1 -> v2 -> ... -> vN`).
 *  - Optional response downcasting (`vN -> v1`) for legacy offline clients.
 *  - Prototype-pollution-safe deep cloning (`__proto__`, `constructor`, `prototype` stripped).
 *  - Idempotent upcasting and structured diagnostics for unknown/unsupported versions.
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class SchemaUpcastError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SchemaUpcastError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Prototype-pollution-safe deep clone for JSON-like payloads.
 */
export function safeClonePayload(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(safeClonePayload);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = safeClonePayload(v);
  }
  return out;
}

/**
 * Creates a versioned upcaster/downcaster registry for civic domain payloads.
 */
export function createSchemaUpcasterRegistry({ versionField = 'schemaVersion', onMetric = () => {} } = {}) {
  const domains = new Map();

  function registerDomain(domain, { latestVersion, defaultVersion = 1, upcasters = {}, downcasters = {} }) {
    if (!domain || !Number.isInteger(latestVersion) || latestVersion < 1) {
      throw new TypeError('registerDomain requires a domain name and positive integer latestVersion');
    }
    domains.set(domain, {
      latestVersion,
      defaultVersion,
      upcasters,
      downcasters,
    });
  }

  function upcast(domain, rawPayload, { targetVersion } = {}) {
    const spec = domains.get(domain);
    if (!spec) {
      throw new SchemaUpcastError('UNKNOWN_DOMAIN', `No schema upcaster registered for "${domain}"`, { domain });
    }
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      throw new SchemaUpcastError('INVALID_PAYLOAD', 'Payload must be a non-null JSON object', { domain });
    }

    const goal = targetVersion ?? spec.latestVersion;
    const rawVer = rawPayload[versionField];
    const startVer = rawVer === undefined || rawVer === null ? spec.defaultVersion : Number(rawVer);

    if (!Number.isInteger(startVer) || startVer < 1) {
      throw new SchemaUpcastError('INVALID_SCHEMA_VERSION', `Invalid schemaVersion "${rawVer}"`, {
        domain,
        schemaVersion: rawVer,
      });
    }
    if (startVer > spec.latestVersion) {
      onMetric({ event: 'schema_future_version_rejected', domain, version: startVer, latest: spec.latestVersion });
      throw new SchemaUpcastError(
        'UNSUPPORTED_FUTURE_VERSION',
        `Payload schemaVersion ${startVer} exceeds supported latestVersion ${spec.latestVersion}`,
        { domain, schemaVersion: startVer, latestVersion: spec.latestVersion },
      );
    }

    let current = safeClonePayload(rawPayload);
    current[versionField] = startVer;

    for (let v = startVer; v < goal; v += 1) {
      const fn = spec.upcasters[v];
      if (typeof fn !== 'function') {
        throw new SchemaUpcastError('MISSING_UPCASTER', `Missing upcaster from v${v} to v${v + 1}`, {
          domain,
          fromVersion: v,
          toVersion: v + 1,
        });
      }
      current = safeClonePayload(fn(current));
      current[versionField] = v + 1;
    }

    onMetric({ event: 'schema_upcasted', domain, fromVersion: startVer, toVersion: current[versionField] });
    return {
      payload: current,
      fromVersion: startVer,
      toVersion: current[versionField],
      upcasted: startVer !== current[versionField],
    };
  }

  function downcast(domain, payload, { targetVersion }) {
    const spec = domains.get(domain);
    if (!spec) {
      throw new SchemaUpcastError('UNKNOWN_DOMAIN', `No schema upcaster registered for "${domain}"`, { domain });
    }
    const startVer = Number(payload?.[versionField] ?? spec.latestVersion);
    if (!Number.isInteger(targetVersion) || targetVersion < 1 || targetVersion > startVer) {
      throw new SchemaUpcastError('INVALID_DOWNCAST_TARGET', `Cannot downcast from v${startVer} to v${targetVersion}`, {
        domain,
        startVer,
        targetVersion,
      });
    }

    let current = safeClonePayload(payload);
    for (let v = startVer; v > targetVersion; v -= 1) {
      const fn = spec.downcasters[v];
      if (typeof fn !== 'function') {
        throw new SchemaUpcastError('MISSING_DOWNCASTER', `Missing downcaster from v${v} to v${v - 1}`, {
          domain,
          fromVersion: v,
          toVersion: v - 1,
        });
      }
      current = safeClonePayload(fn(current));
      current[versionField] = v - 1;
    }
    return { payload: current, fromVersion: startVer, toVersion: targetVersion };
  }

  return { registerDomain, upcast, downcast };
}
