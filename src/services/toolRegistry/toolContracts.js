/**
 * Versioned Tool Contracts, JSON Schemas, Scopes & Deterministic Validator (#1146)
 *
 * Provider-neutral, zero-dependency contract definitions for governed agent tools.
 * Unknown tools fail closed; all arguments are validated against strict JSON Schemas
 * with prototype-pollution protection and sensitive-payload guards.
 */

export const TOOL_REGISTRY_CONTRACT_VERSION = '1.0.0';

export const RISK_TIERS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

export const TOOL_SCOPES = Object.freeze({
  CATALOGUE_READ: 'catalogue:read',
  FAQ_READ: 'faq:read',
  CHECKLIST_READ: 'checklist:read',
  DRAFT_WRITE: 'draft:write',
  GRIEVANCE_REMIND: 'grievance:remind',
  AUDIT_READ: 'audit:read',
  REGISTRY_ADMIN: 'registry:admin',
});

export const APPROVAL_REQUIREMENTS = Object.freeze({
  NONE: 'NONE',
  CITIZEN_CONFIRMATION: 'CITIZEN_CONFIRMATION',
  HUMAN_REVIEWER_APPROVAL: 'HUMAN_REVIEWER_APPROVAL',
});

export const ROLE_SCOPE_CEILING = Object.freeze({
  citizen: Object.freeze([
    TOOL_SCOPES.CATALOGUE_READ,
    TOOL_SCOPES.FAQ_READ,
    TOOL_SCOPES.CHECKLIST_READ,
    TOOL_SCOPES.DRAFT_WRITE,
    TOOL_SCOPES.GRIEVANCE_REMIND,
  ]),
  admin: Object.freeze([
    TOOL_SCOPES.CATALOGUE_READ,
    TOOL_SCOPES.FAQ_READ,
    TOOL_SCOPES.CHECKLIST_READ,
    TOOL_SCOPES.DRAFT_WRITE,
    TOOL_SCOPES.GRIEVANCE_REMIND,
    TOOL_SCOPES.AUDIT_READ,
    TOOL_SCOPES.REGISTRY_ADMIN,
  ]),
});

export const ERROR_CODES = Object.freeze({
  UNKNOWN_TOOL: 'UNKNOWN_TOOL',
  INVALID_SCHEMA: 'INVALID_SCHEMA',
  CAPABILITY_REQUIRED: 'CAPABILITY_REQUIRED',
  CAPABILITY_INVALID: 'CAPABILITY_INVALID',
  CAPABILITY_EXPIRED: 'CAPABILITY_EXPIRED',
  CAPABILITY_REPLAYED: 'CAPABILITY_REPLAYED',
  SCOPE_DENIED: 'SCOPE_DENIED',
  CROSS_USER_DENIED: 'CROSS_USER_DENIED',
  TOOL_REVOKED: 'TOOL_REVOKED',
  CAPABILITY_REVOKED: 'CAPABILITY_REVOKED',
  USER_REVOKED: 'USER_REVOKED',
  KILL_SWITCH_ACTIVE: 'KILL_SWITCH_ACTIVE',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  PROVENANCE_REQUIRED: 'PROVENANCE_REQUIRED',
  SENSITIVE_DATA_DENIED: 'SENSITIVE_DATA_DENIED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  ARGUMENT_DIGEST_MISMATCH: 'ARGUMENT_DIGEST_MISMATCH',
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

export const KNOWN_VALID_SERVICE_IDS = Object.freeze([
  'ration-card',
  'voter-id',
  'pension-scheme',
  'income-certificate',
  'caste-certificate',
  'transgender-certificate',
  'birth-certificate',
  'passport',
  'driving-license',
]);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const SENSITIVE_KEY_PATTERN = /^(vault|aadhaar|aadhar|pan|password|passcode|pin|secret|token|apikey|api_key|authorization|cookie|privatekey)$/i;

// Linear-time bounded patterns matching api/_lib/piiScrubber.js
const SENSITIVE_VALUE_PATTERNS = Object.freeze([
  /\bBearer\s+[A-Za-z0-9._-]{10,512}\b/i,
  /\beyJ[A-Za-z0-9_-]{8,256}\.[A-Za-z0-9_-]{8,256}\.[A-Za-z0-9_-]{8,256}\b/,
  /\bAIza[0-9A-Za-z_-]{30,45}\b/,
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
  /\b[2-9][0-9]{3}(?:[ -]?[0-9]{4}){2}\b/,
  /(?:\+91[- ]?)?[6-9][0-9]{9}\b/,
  /\b(aadhaar|aadhar|vault|password|secret_key|private_key)\b/i,
]);

export const REGISTERED_TOOLS = Object.freeze({
  lookupServiceDetails: Object.freeze({
    name: 'lookupServiceDetails',
    version: '1.0.0',
    description: 'Fetches grounded requirements, fees, and official portal links for a civic service',
    riskTier: RISK_TIERS.LOW,
    scopes: Object.freeze([TOOL_SCOPES.CATALOGUE_READ]),
    approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
    requiresProvenance: true,
    timeoutMs: 3000,
    maxCallsPerMinute: 30,
    owner: 'civic-catalogue-team',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['serviceId'],
      maxProperties: 2,
      properties: Object.freeze({
        serviceId: Object.freeze({
          type: 'string',
          enum: KNOWN_VALID_SERVICE_IDS,
        }),
        jurisdictionCode: Object.freeze({
          type: 'string',
          minLength: 2,
          maxLength: 32,
          pattern: /^[a-zA-Z0-9_-]+$/,
        }),
      }),
    }),
  }),
  searchCivicFaq: Object.freeze({
    name: 'searchCivicFaq',
    version: '1.0.0',
    description: 'Searches public civic FAQs and document guidance without accessing user data',
    riskTier: RISK_TIERS.LOW,
    scopes: Object.freeze([TOOL_SCOPES.FAQ_READ]),
    approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
    requiresProvenance: true,
    timeoutMs: 3000,
    maxCallsPerMinute: 30,
    owner: 'civic-knowledge-team',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      maxProperties: 2,
      properties: Object.freeze({
        query: Object.freeze({
          type: 'string',
          minLength: 2,
          maxLength: 240,
        }),
        limit: Object.freeze({
          type: 'integer',
          minimum: 1,
          maximum: 10,
        }),
      }),
    }),
  }),
  generateCivicChecklist: Object.freeze({
    name: 'generateCivicChecklist',
    version: '1.0.0',
    description: 'Builds a non-binding document readiness checklist proposal for a civic service',
    riskTier: RISK_TIERS.LOW,
    scopes: Object.freeze([TOOL_SCOPES.CHECKLIST_READ]),
    approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
    requiresProvenance: true,
    timeoutMs: 3000,
    maxCallsPerMinute: 20,
    owner: 'civic-catalogue-team',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['serviceId'],
      maxProperties: 2,
      properties: Object.freeze({
        serviceId: Object.freeze({
          type: 'string',
          enum: KNOWN_VALID_SERVICE_IDS,
        }),
        applicantCategory: Object.freeze({
          type: 'string',
          enum: ['general', 'senior-citizen', 'student', 'disability-support'],
        }),
      }),
    }),
  }),
  saveApplicationDraft: Object.freeze({
    name: 'saveApplicationDraft',
    version: '1.0.0',
    description: 'Stages a citizen-confirmed preparation draft note (never submits an official filing)',
    riskTier: RISK_TIERS.MEDIUM,
    scopes: Object.freeze([TOOL_SCOPES.DRAFT_WRITE]),
    approvalRequirement: APPROVAL_REQUIREMENTS.CITIZEN_CONFIRMATION,
    requiresProvenance: true,
    timeoutMs: 4000,
    maxCallsPerMinute: 10,
    owner: 'citizen-workspace-team',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['serviceId', 'formData'],
      maxProperties: 3,
      properties: Object.freeze({
        serviceId: Object.freeze({
          type: 'string',
          enum: KNOWN_VALID_SERVICE_IDS,
        }),
        formData: Object.freeze({
          type: 'object',
          additionalProperties: false,
          maxProperties: 8,
          properties: Object.freeze({
            applicantLabel: Object.freeze({ type: 'string', minLength: 1, maxLength: 80 }),
            wardCode: Object.freeze({ type: 'string', minLength: 1, maxLength: 32, pattern: /^[a-zA-Z0-9_-]+$/ }),
            checklistCompleted: Object.freeze({ type: 'boolean' }),
            notes: Object.freeze({ type: 'string', minLength: 0, maxLength: 500 }),
          }),
        }),
        caseId: Object.freeze({
          type: 'string',
          minLength: 2,
          maxLength: 80,
          pattern: /^[a-zA-Z0-9_-]+$/,
        }),
      }),
    }),
  }),
  scheduleGrievanceFollowUp: Object.freeze({
    name: 'scheduleGrievanceFollowUp',
    version: '1.0.0',
    description: 'Creates a high-impact follow-up reminder proposal requiring human approval and provenance',
    riskTier: RISK_TIERS.HIGH,
    scopes: Object.freeze([TOOL_SCOPES.GRIEVANCE_REMIND]),
    approvalRequirement: APPROVAL_REQUIREMENTS.HUMAN_REVIEWER_APPROVAL,
    requiresProvenance: true,
    timeoutMs: 5000,
    maxCallsPerMinute: 5,
    owner: 'grievance-ops-team',
    inputSchema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['grievanceId', 'reminderDate'],
      maxProperties: 3,
      properties: Object.freeze({
        grievanceId: Object.freeze({
          type: 'string',
          minLength: 3,
          maxLength: 64,
          pattern: /^[a-zA-Z0-9_-]+$/,
        }),
        reminderDate: Object.freeze({
          type: 'string',
          pattern: /^\d{4}-\d{2}-\d{2}$/,
        }),
        reason: Object.freeze({
          type: 'string',
          minLength: 3,
          maxLength: 240,
        }),
      }),
    }),
  }),
});

/**
 * Checks whether an arbitrary argument tree contains prototype-pollution keys
 * or disallowed sensitive credentials/PII markers.
 */
export function inspectSensitiveArguments(value, path = '$', depth = 0, seen = new WeakSet()) {
  if (depth > 8) {
    return { safe: false, reason: `Maximum inspection depth exceeded at ${path}` };
  }
  if (value === null || value === undefined) return { safe: true };
  if (typeof value === 'string') {
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        return { safe: false, reason: `Sensitive credential or raw PII pattern rejected at ${path}` };
      }
    }
    return { safe: true };
  }
  if (typeof value !== 'object') return { safe: true };
  if (seen.has(value)) {
    return { safe: false, reason: `Circular reference rejected at ${path}` };
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const check = inspectSensitiveArguments(value[i], `${path}[${i}]`, depth + 1, seen);
      if (!check.safe) return check;
    }
    return { safe: true };
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return { safe: false, reason: `Forbidden prototype key "${key}" rejected at ${path}` };
    }
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return { safe: false, reason: `Prohibited sensitive field "${key}" rejected at ${path}` };
    }
    const check = inspectSensitiveArguments(value[key], `${path}.${key}`, depth + 1, seen);
    if (!check.safe) return check;
  }
  return { safe: true };
}

/**
 * Deterministic, zero-dependency JSON Schema validator for tool boundaries.
 */
export function validateAgainstJsonSchema(schema, value, path = '$', depth = 0) {
  const errors = [];
  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: [`Missing schema at ${path}`] };
  }
  if (depth > 6) {
    return { valid: false, errors: [`Schema nesting depth exceeded at ${path}`] };
  }

  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, errors: [`${path} must be an object`] };
    }
    const keys = Object.getOwnPropertyNames(value);
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) {
        errors.push(`${path} contains forbidden key "${key}"`);
      }
    }
    if (typeof schema.maxProperties === 'number' && keys.length > schema.maxProperties) {
      errors.push(`${path} exceeds maxProperties (${schema.maxProperties})`);
    }
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, reqKey) || value[reqKey] === undefined) {
          errors.push(`${path}.${reqKey} is required`);
        }
      }
    }
    const props = schema.properties || {};
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        const sub = validateAgainstJsonSchema(props[key], value[key], `${path}.${key}`, depth + 1);
        if (!sub.valid) errors.push(...sub.errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key} is not an allowed property`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      return { valid: false, errors: [`${path} must be an array`] };
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push(`${path} exceeds maxItems (${schema.maxItems})`);
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i += 1) {
        const sub = validateAgainstJsonSchema(schema.items, value[i], `${path}[${i}]`, depth + 1);
        if (!sub.valid) errors.push(...sub.errors);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      return { valid: false, errors: [`${path} must be a string`] };
    }
    if (typeof schema.minLength === 'number' && value.trim().length < schema.minLength) {
      errors.push(`${path} must be at least ${schema.minLength} characters`);
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push(`${path} must be at most ${schema.maxLength} characters`);
    }
    if (schema.pattern instanceof RegExp && !schema.pattern.test(value)) {
      errors.push(`${path} does not match required format`);
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      errors.push(`${path} must be one of [${schema.enum.join(', ')}]`);
    }
    return { valid: errors.length === 0, errors };
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { valid: false, errors: [`${path} must be a finite number`] };
    }
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      errors.push(`${path} must be an integer`);
    }
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${path} must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${path} must be <= ${schema.maximum}`);
    }
    return { valid: errors.length === 0, errors };
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      return { valid: false, errors: [`${path} must be a boolean`] };
    }
    return { valid: true, errors: [] };
  }

  return { valid: false, errors: [`Unsupported schema type at ${path}`] };
}
