/**
 * Agent-to-Agent Message Contracts (Schema v2.0)
 *
 * Defines versioned typed envelopes, correlation IDs, deadline budgets,
 * permission boundaries, provenance requirements, and fail-closed validation
 * for unknown critical fields and forbidden PII/credential keys.
 */

export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze(['1.0', '2.0']);
export const CURRENT_SCHEMA_VERSION = '2.0';

export const MESSAGE_TYPES = Object.freeze(['request', 'proposal', 'error', 'ack']);

export const AGENT_ROLES = Object.freeze([
  'orchestrator',
  'guardrail',
  'retriever',
  'synthesizer',
  'simplifier',
  'fallback',
  'ui',
]);

/**
 * High-impact actions that AI agents are strictly forbidden from executing
 * autonomously. Any message requesting these scopes is rejected at the boundary.
 */
export const FORBIDDEN_AUTONOMOUS_SCOPES = Object.freeze([
  'autonomous_filing',
  'benefit_denial',
  'official_status_claim',
]);

export const AGENT_PERMISSIONS = Object.freeze({
  ui: Object.freeze(['submit_query', 'review_proposal']),
  orchestrator: Object.freeze(['route_message', 'sanitize_query', 'retrieve_sources', 'propose_guidance']),
  guardrail: Object.freeze(['sanitize_query']),
  retriever: Object.freeze(['retrieve_sources']),
  synthesizer: Object.freeze(['propose_guidance']),
  simplifier: Object.freeze(['propose_guidance']),
  fallback: Object.freeze(['propose_guidance']),
});

export const KNOWN_CRITICAL_FIELDS = Object.freeze([
  'schemaVersion',
  'messageType',
  'correlationId',
  'deadlineAt',
  'permissionScope',
  'requiresHumanApproval',
  'provenance',
]);

export const FORBIDDEN_PII_KEYS = Object.freeze([
  'aadhaarNumber',
  'panNumber',
  'password',
  'token',
  'secret',
  'apiKey',
  'ssn',
  'citizenRecord',
  'privateDocument',
]);

export const DEFAULT_DEADLINE_MS = 5000;
export const MAX_PROVENANCE_SOURCES = 20;

let idCounter = 0;

function generateId(prefix) {
  idCounter = (idCounter + 1) % 1000000;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

/**
 * Recursively checks an object for forbidden PII or credential keys.
 * @param {unknown} value
 * @param {number} depth
 * @returns {string|null} First offending key path, or null
 */
export function findForbiddenPiiKey(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 5) return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findForbiddenPiiKey(value[i], depth + 1);
      if (found) return found;
    }
    return null;
  }
  const keys = Object.keys(value);
  for (const key of keys) {
    if (FORBIDDEN_PII_KEYS.includes(key)) {
      return key;
    }
    const nested = findForbiddenPiiKey(value[key], depth + 1);
    if (nested) return `${key}.${nested}`;
  }
  return null;
}

/**
 * Builds a safe, redacted error envelope that never leaks stack traces or raw prompts.
 * @param {Object} params
 * @returns {Object}
 */
export function createErrorEnvelope({
  code = 'CONTRACT_VALIDATION_ERROR',
  category = 'validation',
  message = 'Message failed contract validation.',
  retryable = false,
  correlationId = null,
  causationId = null,
  sender = 'orchestrator',
  recipient = 'ui',
  failedAtStage = 'boundary',
  schemaVersion = CURRENT_SCHEMA_VERSION,
} = {}) {
  const safeMessage = String(message).slice(0, 200);
  return {
    schemaVersion,
    messageId: generateId('err'),
    correlationId: correlationId || generateId('corr'),
    causationId,
    messageType: 'error',
    sender,
    recipient,
    issuedAt: new Date().toISOString(),
    deadlineAt: new Date(Date.now() + DEFAULT_DEADLINE_MS).toISOString(),
    criticalFields: ['schemaVersion', 'messageType', 'correlationId'],
    permissionScope: 'route_message',
    requiresHumanApproval: false,
    provenance: { sources: [], unverified: true },
    payload: {
      code,
      category,
      message: safeMessage,
      retryable: Boolean(retryable),
      failedAtStage,
    },
  };
}

/**
 * Creates a canonical v2.0 agent-to-agent message envelope.
 * @param {Object} params
 * @returns {Object}
 */
export function createMessageEnvelope({
  messageId = generateId('msg'),
  correlationId = generateId('corr'),
  causationId = null,
  messageType = 'request',
  sender = 'orchestrator',
  recipient = 'synthesizer',
  ttlMs = DEFAULT_DEADLINE_MS,
  deadlineAt = null,
  criticalFields = ['schemaVersion', 'messageType', 'correlationId', 'deadlineAt'],
  permissionScope = 'propose_guidance',
  requiresHumanApproval = false,
  provenance = { sources: [], unverified: false },
  payload = {},
  schemaVersion = CURRENT_SCHEMA_VERSION,
} = {}) {
  const nowMs = Date.now();
  const computedDeadline = deadlineAt || new Date(nowMs + ttlMs).toISOString();

  return {
    schemaVersion,
    messageId,
    correlationId,
    causationId,
    messageType,
    sender,
    recipient,
    issuedAt: new Date(nowMs).toISOString(),
    deadlineAt: computedDeadline,
    criticalFields: Array.isArray(criticalFields) ? [...criticalFields] : [],
    permissionScope,
    requiresHumanApproval: Boolean(requiresHumanApproval),
    provenance: provenance || { sources: [], unverified: false },
    payload: payload && typeof payload === 'object' ? payload : {},
  };
}

/**
 * Validates an untrusted message envelope at an agent/service boundary.
 * Rejects unknown critical fields, unsupported schema versions, expired deadlines,
 * forbidden PII keys, and unauthorized permission scopes.
 *
 * @param {Object} msg
 * @param {Object} [options]
 * @param {boolean} [options.allowExpired=false] - Allow expired deadlines (e.g. deterministic fixture replay)
 * @param {number} [options.nowMs=Date.now()]
 * @returns {{ valid: boolean, errors: Array<{ field: string, code: string, reason: string }>, errorEnvelope: Object|null }}
 */
export function validateMessageEnvelope(msg, options = {}) {
  const { allowExpired = false, nowMs = Date.now() } = options;
  const errors = [];

  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    const err = { field: 'envelope', code: 'INVALID_ENVELOPE', reason: 'Message must be a non-null object.' };
    return {
      valid: false,
      errors: [err],
      errorEnvelope: createErrorEnvelope({ code: err.code, message: err.reason }),
    };
  }

  if (!SUPPORTED_SCHEMA_VERSIONS.includes(msg.schemaVersion)) {
    errors.push({
      field: 'schemaVersion',
      code: 'UNSUPPORTED_SCHEMA_VERSION',
      reason: `Unsupported schemaVersion "${msg.schemaVersion}". Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}.`,
    });
  }

  if (!msg.messageId || typeof msg.messageId !== 'string') {
    errors.push({ field: 'messageId', code: 'MISSING_MESSAGE_ID', reason: 'messageId must be a non-empty string.' });
  }

  if (!msg.correlationId || typeof msg.correlationId !== 'string') {
    errors.push({ field: 'correlationId', code: 'MISSING_CORRELATION_ID', reason: 'correlationId must be a non-empty string.' });
  }

  if (!MESSAGE_TYPES.includes(msg.messageType)) {
    errors.push({ field: 'messageType', code: 'INVALID_MESSAGE_TYPE', reason: `Invalid messageType "${msg.messageType}".` });
  }

  if (!AGENT_ROLES.includes(msg.sender)) {
    errors.push({ field: 'sender', code: 'UNKNOWN_AGENT_ROLE', reason: `Unknown sender role "${msg.sender}".` });
  }

  if (!AGENT_ROLES.includes(msg.recipient)) {
    errors.push({ field: 'recipient', code: 'UNKNOWN_AGENT_ROLE', reason: `Unknown recipient role "${msg.recipient}".` });
  }

  // Reject unknown critical fields (fail-closed)
  if (!Array.isArray(msg.criticalFields)) {
    errors.push({ field: 'criticalFields', code: 'INVALID_CRITICAL_FIELDS', reason: 'criticalFields must be an array.' });
  } else {
    const unknownCritical = msg.criticalFields.filter((f) => !KNOWN_CRITICAL_FIELDS.includes(f));
    if (unknownCritical.length > 0) {
      errors.push({
        field: 'criticalFields',
        code: 'UNKNOWN_CRITICAL_FIELD',
        reason: `Unknown critical field(s): ${unknownCritical.join(', ')}.`,
      });
    }
  }

  // Deadline enforcement
  const deadlineMs = Date.parse(msg.deadlineAt);
  if (!msg.deadlineAt || Number.isNaN(deadlineMs)) {
    errors.push({ field: 'deadlineAt', code: 'INVALID_DEADLINE', reason: 'deadlineAt must be a valid ISO-8601 timestamp.' });
  } else if (!allowExpired && nowMs > deadlineMs) {
    errors.push({ field: 'deadlineAt', code: 'DEADLINE_EXCEEDED', reason: 'Message deadline has expired.' });
  }

  // Permission boundary & forbidden autonomous actions
  if (FORBIDDEN_AUTONOMOUS_SCOPES.includes(msg.permissionScope)) {
    errors.push({
      field: 'permissionScope',
      code: 'FORBIDDEN_AUTONOMOUS_ACTION',
      reason: `Autonomous action "${msg.permissionScope}" is prohibited without verified human authorization.`,
    });
  } else if (AGENT_ROLES.includes(msg.sender)) {
    const allowedScopes = AGENT_PERMISSIONS[msg.sender] || [];
    const isErrorReport = msg.messageType === 'error' && msg.permissionScope === 'route_message';
    if (!isErrorReport && !allowedScopes.includes(msg.permissionScope)) {
      errors.push({
        field: 'permissionScope',
        code: 'PERMISSION_DENIED',
        reason: `Sender "${msg.sender}" is not permitted to use scope "${msg.permissionScope}".`,
      });
    }
  }

  // Reject forbidden PII/credential keys anywhere in the envelope
  const piiKey = findForbiddenPiiKey(msg);
  if (piiKey) {
    errors.push({
      field: piiKey,
      code: 'FORBIDDEN_PII_FIELD',
      reason: `Sensitive or PII field "${piiKey}" is not allowed in agent envelopes.`,
    });
  }

  // Provenance check for proposals
  if (msg.messageType === 'proposal') {
    const sources = msg.provenance?.sources;
    const isExplicitlyUnverified = msg.provenance?.unverified === true;
    if (!Array.isArray(sources) || (sources.length === 0 && !isExplicitlyUnverified)) {
      errors.push({
        field: 'provenance',
        code: 'MISSING_PROVENANCE',
        reason: 'Proposal messages must include provenance sources or explicitly mark unverified: true.',
      });
    } else if (sources.length > MAX_PROVENANCE_SOURCES) {
      errors.push({
        field: 'provenance',
        code: 'PROVENANCE_LIMIT_EXCEEDED',
        reason: `Provenance sources exceed max limit of ${MAX_PROVENANCE_SOURCES}.`,
      });
    }
  }

  if (errors.length === 0) {
    return { valid: true, errors: [], errorEnvelope: null };
  }

  const primary = errors[0];
  return {
    valid: false,
    errors,
    errorEnvelope: createErrorEnvelope({
      code: primary.code,
      category: primary.code === 'DEADLINE_EXCEEDED' ? 'timeout' : primary.code.includes('PERMISSION') || primary.code.includes('FORBIDDEN') ? 'security' : 'validation',
      message: primary.reason,
      retryable: primary.code === 'DEADLINE_EXCEEDED',
      correlationId: typeof msg.correlationId === 'string' ? msg.correlationId : null,
      causationId: typeof msg.messageId === 'string' ? msg.messageId : null,
      sender: typeof msg.recipient === 'string' && AGENT_ROLES.includes(msg.recipient) ? msg.recipient : 'orchestrator',
      recipient: typeof msg.sender === 'string' && AGENT_ROLES.includes(msg.sender) ? msg.sender : 'ui',
    }),
  };
}
