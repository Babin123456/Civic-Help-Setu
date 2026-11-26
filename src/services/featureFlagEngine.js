/**
 * src/services/featureFlagEngine.js
 *
 * Isomorphic Deterministic Feature Flag, Gradual Rollout, and Emergency
 * Kill-Switch Engine for Civic Help Setu (#1337).
 *
 * Evaluation order:
 *  1. Emergency kill-switch override (`killSwitch: true` -> immediately disabled)
 *  2. Explicit blocklist (userIds / tenantIds / jurisdictions)
 *  3. Explicit allowlist (userIds / tenantIds / jurisdictions)
 *  4. Deterministic sticky percentage rollout (FNV-1a 0..9999 basis points)
 *  5. Static default (`defaultEnabled`)
 */

export const FLAG_SCHEMA_VERSION = '1.0.0';
const FLAG_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

/**
 * Deterministic 32-bit FNV-1a hash mapped to [0, 9999] basis points (0.01% resolution).
 * Ensures monotonic, sticky rollouts across browser and Node runtimes.
 */
export function computeBucketBps(flagKey, bucketingId) {
  const input = `${String(flagKey)}:${String(bucketingId)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 10000;
}

export function validateFlagDefinition(flagKey, def) {
  const errors = [];
  if (!FLAG_KEY_PATTERN.test(String(flagKey || ''))) {
    errors.push(`Invalid flag key "${flagKey}"`);
  }
  if (!def || typeof def !== 'object' || Array.isArray(def)) {
    errors.push('Flag definition must be an object');
    return { valid: false, errors };
  }
  if (typeof def.defaultEnabled !== 'boolean') {
    errors.push('defaultEnabled must be a boolean');
  }
  if (def.killSwitch !== undefined && typeof def.killSwitch !== 'boolean') {
    errors.push('killSwitch must be a boolean');
  }
  if (def.rolloutPercentage !== undefined) {
    if (
      typeof def.rolloutPercentage !== 'number' ||
      !Number.isFinite(def.rolloutPercentage) ||
      def.rolloutPercentage < 0 ||
      def.rolloutPercentage > 100
    ) {
      errors.push('rolloutPercentage must be a number between 0 and 100');
    }
  }
  if (def.exposure !== undefined && !['client', 'server'].includes(def.exposure)) {
    errors.push('exposure must be "client" or "server"');
  }
  return { valid: errors.length === 0, errors };
}

export function validateFlagRegistry(registry = {}) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return { valid: false, errors: ['Registry must be an object map'] };
  }
  for (const [key, def] of Object.entries(registry)) {
    const res = validateFlagDefinition(key, def);
    if (!res.valid) {
      errors.push(...res.errors.map((e) => `${key}: ${e}`));
    }
  }
  return { valid: errors.length === 0, errors };
}

function matchesScope(ruleSet = {}, context = {}) {
  const userIds = Array.isArray(ruleSet.userIds) ? ruleSet.userIds : [];
  const tenantIds = Array.isArray(ruleSet.tenantIds) ? ruleSet.tenantIds : [];
  const jurisdictions = Array.isArray(ruleSet.jurisdictions) ? ruleSet.jurisdictions : [];

  if (context.userId && userIds.includes(context.userId)) return 'user';
  if (context.tenantId && tenantIds.includes(context.tenantId)) return 'tenant';
  if (context.jurisdictionCode && jurisdictions.includes(context.jurisdictionCode)) return 'jurisdiction';
  return null;
}

/**
 * Evaluates a single flag definition deterministically for a given context.
 */
export function evaluateFlagDefinition(flagKey, def, context = {}) {
  if (!def) {
    return { key: flagKey, enabled: false, reason: 'flag_not_found', schemaVersion: FLAG_SCHEMA_VERSION };
  }

  if (def.killSwitch === true) {
    return { key: flagKey, enabled: false, reason: 'kill_switch', schemaVersion: FLAG_SCHEMA_VERSION };
  }

  const blockedBy = matchesScope(def.blocklist, context);
  if (blockedBy) {
    return { key: flagKey, enabled: false, reason: `blocklist:${blockedBy}`, schemaVersion: FLAG_SCHEMA_VERSION };
  }

  const allowedBy = matchesScope(def.allowlist, context);
  if (allowedBy) {
    return { key: flagKey, enabled: true, reason: `allowlist:${allowedBy}`, schemaVersion: FLAG_SCHEMA_VERSION };
  }

  if (typeof def.rolloutPercentage === 'number') {
    const bucketingId = context.userId || context.tenantId || context.jurisdictionCode || context.sessionId;
    if (!bucketingId) {
      return {
        key: flagKey,
        enabled: Boolean(def.defaultEnabled),
        reason: 'missing_bucketing_id_default',
        schemaVersion: FLAG_SCHEMA_VERSION,
      };
    }
    const bucketBps = computeBucketBps(flagKey, bucketingId);
    const thresholdBps = Math.round(def.rolloutPercentage * 100);
    return {
      key: flagKey,
      enabled: bucketBps < thresholdBps,
      reason: bucketBps < thresholdBps ? 'rollout_included' : 'rollout_excluded',
      bucketBps,
      thresholdBps,
      schemaVersion: FLAG_SCHEMA_VERSION,
    };
  }

  return {
    key: flagKey,
    enabled: Boolean(def.defaultEnabled),
    reason: 'default',
    schemaVersion: FLAG_SCHEMA_VERSION,
  };
}

/**
 * Stateful feature-flag engine with static defaults, remote-snapshot merging,
 * emergency kill-switch overrides, and audit event emission.
 */
export function createFeatureFlagEngine({
  staticDefaults = {},
  initialFlags = {},
  onAudit = () => {},
  now = Date.now,
} = {}) {
  const merged = { ...staticDefaults, ...initialFlags };
  const validation = validateFlagRegistry(merged);
  if (!validation.valid) {
    throw new TypeError(`Invalid initial flag registry: ${validation.errors.join('; ')}`);
  }

  let registry = structuredClone(merged);
  const auditLog = [];

  function recordAudit(entry) {
    const event = { ...entry, timestamp: now(), schemaVersion: FLAG_SCHEMA_VERSION };
    auditLog.push(event);
    onAudit(event);
    return event;
  }

  return {
    schemaVersion: FLAG_SCHEMA_VERSION,

    isEnabled(flagKey, context = {}) {
      return evaluateFlagDefinition(flagKey, registry[flagKey], context).enabled;
    },

    evaluate(flagKey, context = {}) {
      return evaluateFlagDefinition(flagKey, registry[flagKey], context);
    },

    evaluateAll(context = {}, { exposure } = {}) {
      const results = {};
      for (const [key, def] of Object.entries(registry)) {
        if (exposure && (def.exposure || 'client') !== exposure) continue;
        results[key] = evaluateFlagDefinition(key, def, context);
      }
      return results;
    },

    setKillSwitch(flagKey, active, { actorId = 'system', reason = '' } = {}) {
      const existing = registry[flagKey];
      if (!existing) {
        throw new Error(`Unknown feature flag: ${flagKey}`);
      }
      const next = { ...existing, killSwitch: Boolean(active) };
      registry[flagKey] = next;
      return recordAudit({
        action: active ? 'kill_switch_activated' : 'kill_switch_cleared',
        flagKey,
        actorId,
        reason,
      });
    },

    upsertFlag(flagKey, definition, { actorId = 'system' } = {}) {
      const check = validateFlagDefinition(flagKey, definition);
      if (!check.valid) {
        throw new TypeError(`Invalid flag definition for ${flagKey}: ${check.errors.join('; ')}`);
      }
      registry[flagKey] = structuredClone(definition);
      return recordAudit({
        action: 'flag_upserted',
        flagKey,
        actorId,
      });
    },

    mergeRemoteRegistry(remoteRegistry = {}) {
      const check = validateFlagRegistry(remoteRegistry);
      if (!check.valid) {
        return { applied: false, errors: check.errors };
      }
      registry = { ...structuredClone(staticDefaults), ...structuredClone(remoteRegistry) };
      return { applied: true, errors: [] };
    },

    getAuditLog() {
      return [...auditLog];
    },

    snapshot() {
      return structuredClone(registry);
    },
  };
}
