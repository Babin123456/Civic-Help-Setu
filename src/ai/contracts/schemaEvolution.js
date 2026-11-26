/**
 * Schema Evolution & Compatibility Adapters (v1.0 <-> v2.0)
 *
 * Handles deterministic upcasting from legacy v1.0 messages to v2.0,
 * safe downcasting when no v2.0-only critical fields are present,
 * and fail-closed boundary validation.
 */

import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_DEADLINE_MS,
  SUPPORTED_SCHEMA_VERSIONS,
  createErrorEnvelope,
  validateMessageEnvelope,
} from './messageContract.js';

const V2_ONLY_CRITICAL_FIELDS = Object.freeze(['requiresHumanApproval', 'provenance']);

/**
 * Upcasts a v1.0 legacy agent message to canonical v2.0 format.
 * @param {Object} v1Msg
 * @returns {Object}
 */
export function upcastV1ToV2(v1Msg) {
  const issuedAt = v1Msg.issuedAt || new Date().toISOString();
  const issuedMs = Date.parse(issuedAt);
  const ttlMs = typeof v1Msg.ttlMs === 'number' && v1Msg.ttlMs > 0 ? v1Msg.ttlMs : DEFAULT_DEADLINE_MS;
  const deadlineAt = v1Msg.deadlineAt || new Date((Number.isNaN(issuedMs) ? Date.now() : issuedMs) + ttlMs).toISOString();

  return {
    schemaVersion: '2.0',
    messageId: v1Msg.messageId || v1Msg.id || `msg-v1-${Date.now()}`,
    correlationId: v1Msg.correlationId || v1Msg.traceId || `corr-v1-${Date.now()}`,
    causationId: v1Msg.causationId || null,
    messageType: v1Msg.messageType || 'proposal',
    sender: v1Msg.sender || 'synthesizer',
    recipient: v1Msg.recipient || 'orchestrator',
    issuedAt,
    deadlineAt,
    criticalFields: Array.isArray(v1Msg.criticalFields)
      ? [...v1Msg.criticalFields]
      : ['schemaVersion', 'messageType', 'correlationId', 'deadlineAt'],
    permissionScope: v1Msg.permissionScope || 'propose_guidance',
    requiresHumanApproval: Boolean(v1Msg.requiresHumanApproval),
    provenance: v1Msg.provenance || {
      sources: Array.isArray(v1Msg.sources) ? v1Msg.sources : [],
      unverified: !Array.isArray(v1Msg.sources) || v1Msg.sources.length === 0,
    },
    payload: v1Msg.payload && typeof v1Msg.payload === 'object' ? v1Msg.payload : {},
  };
}

/**
 * Downcasts a v2.0 message to v1.0 if no v2.0-only critical fields are marked critical.
 * @param {Object} v2Msg
 * @returns {{ ok: boolean, message: Object|null, errorEnvelope: Object|null }}
 */
export function downcastV2ToV1(v2Msg) {
  const critical = Array.isArray(v2Msg.criticalFields) ? v2Msg.criticalFields : [];
  const blocking = critical.filter((f) => V2_ONLY_CRITICAL_FIELDS.includes(f));
  if (blocking.length > 0) {
    return {
      ok: false,
      message: null,
      errorEnvelope: createErrorEnvelope({
        code: 'INCOMPATIBLE_CRITICAL_FIELD',
        category: 'migration',
        message: `Cannot downcast v2.0 to v1.0: critical field(s) ${blocking.join(', ')} require v2.0.`,
        retryable: false,
        correlationId: v2Msg.correlationId || null,
        causationId: v2Msg.messageId || null,
        failedAtStage: 'schema_downcast',
      }),
    };
  }

  return {
    ok: true,
    message: {
      schemaVersion: '1.0',
      messageId: v2Msg.messageId,
      traceId: v2Msg.correlationId,
      correlationId: v2Msg.correlationId,
      messageType: v2Msg.messageType,
      sender: v2Msg.sender,
      recipient: v2Msg.recipient,
      issuedAt: v2Msg.issuedAt,
      deadlineAt: v2Msg.deadlineAt,
      criticalFields: critical,
      permissionScope: v2Msg.permissionScope,
      sources: v2Msg.provenance?.sources || [],
      payload: v2Msg.payload,
    },
    errorEnvelope: null,
  };
}

/**
 * Migrates an incoming message from a supported version to targetVersion.
 * @param {Object} rawMsg
 * @param {string} [targetVersion=CURRENT_SCHEMA_VERSION]
 * @returns {{ ok: boolean, message: Object|null, migratedFrom: string|null, errorEnvelope: Object|null }}
 */
export function migrateEnvelope(rawMsg, targetVersion = CURRENT_SCHEMA_VERSION) {
  if (!rawMsg || typeof rawMsg !== 'object' || Array.isArray(rawMsg)) {
    return {
      ok: false,
      message: null,
      migratedFrom: null,
      errorEnvelope: createErrorEnvelope({
        code: 'INVALID_ENVELOPE',
        message: 'Cannot migrate non-object message.',
        failedAtStage: 'schema_migration',
      }),
    };
  }

  const sourceVersion = rawMsg.schemaVersion || rawMsg.version;
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(sourceVersion)) {
    return {
      ok: false,
      message: null,
      migratedFrom: null,
      errorEnvelope: createErrorEnvelope({
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        message: `Unsupported schema version "${sourceVersion}".`,
        correlationId: rawMsg.correlationId || rawMsg.traceId || null,
        failedAtStage: 'schema_migration',
      }),
    };
  }

  if (sourceVersion === targetVersion) {
    return { ok: true, message: rawMsg, migratedFrom: null, errorEnvelope: null };
  }

  if (sourceVersion === '1.0' && targetVersion === '2.0') {
    return {
      ok: true,
      message: upcastV1ToV2({ ...rawMsg, schemaVersion: '1.0' }),
      migratedFrom: '1.0',
      errorEnvelope: null,
    };
  }

  if (sourceVersion === '2.0' && targetVersion === '1.0') {
    const down = downcastV2ToV1(rawMsg);
    return {
      ok: down.ok,
      message: down.message,
      migratedFrom: down.ok ? '2.0' : null,
      errorEnvelope: down.errorEnvelope,
    };
  }

  return {
    ok: false,
    message: null,
    migratedFrom: null,
    errorEnvelope: createErrorEnvelope({
      code: 'UNSUPPORTED_MIGRATION_PATH',
      message: `No migration path from ${sourceVersion} to ${targetVersion}.`,
      failedAtStage: 'schema_migration',
    }),
  };
}

/**
 * Boundary helper: migrates to current schema version and validates strictly.
 * @param {Object} rawMsg
 * @param {Object} [options]
 * @returns {{ ok: boolean, message: Object|null, migratedFrom: string|null, errors: Array, errorEnvelope: Object|null }}
 */
export function validateAndAdaptMessage(rawMsg, options = {}) {
  const migrated = migrateEnvelope(rawMsg, CURRENT_SCHEMA_VERSION);
  if (!migrated.ok) {
    return {
      ok: false,
      message: null,
      migratedFrom: null,
      errors: [{ field: 'schemaVersion', code: migrated.errorEnvelope.payload.code, reason: migrated.errorEnvelope.payload.message }],
      errorEnvelope: migrated.errorEnvelope,
    };
  }

  const validation = validateMessageEnvelope(migrated.message, options);
  if (!validation.valid) {
    return {
      ok: false,
      message: null,
      migratedFrom: migrated.migratedFrom,
      errors: validation.errors,
      errorEnvelope: validation.errorEnvelope,
    };
  }

  return {
    ok: true,
    message: migrated.message,
    migratedFrom: migrated.migratedFrom,
    errors: [],
    errorEnvelope: null,
  };
}
