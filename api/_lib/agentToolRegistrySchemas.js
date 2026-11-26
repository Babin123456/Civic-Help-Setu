/**
 * Versioned Request/Response Validation Schemas for /api/agent-tool-registry (#1146)
 *
 * Strict service-boundary validation for untrusted external HTTP payloads.
 * Rejects unknown fields, prototype-pollution keys, and invalid types.
 */

import { TOOL_REGISTRY_CONTRACT_VERSION } from '../../src/services/toolRegistry/toolContracts.js';

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{2,64}$/;
const ID_PATTERN = /^[a-zA-Z0-9_.:-]{1,128}$/;
const SCOPE_PATTERN = /^[a-z]+:[a-z_]+$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function schemaVersion() {
  return TOOL_REGISTRY_CONTRACT_VERSION;
}

function rejectUnknownKeys(obj, allowedKeys, label) {
  const errors = [];
  for (const key of Object.getOwnPropertyNames(obj)) {
    if (FORBIDDEN_KEYS.has(key)) {
      errors.push(`${label} contains forbidden key "${key}".`);
    } else if (!allowedKeys.has(key)) {
      errors.push(`${label} contains unexpected field "${key}".`);
    }
  }
  return errors;
}

export function validateIssueCapabilityBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be a JSON object.'], value: null };
  }
  const allowed = new Set([
    'toolName',
    'sessionId',
    'requestedScopes',
    'ttlSeconds',
    'singleUse',
    'citizenConfirmed',
    'humanApproved',
    'provenanceRef',
    'boundArgs',
    'correlationId',
  ]);
  const errors = rejectUnknownKeys(body, allowed, 'body');

  if (typeof body.toolName !== 'string' || !TOOL_NAME_PATTERN.test(body.toolName)) {
    errors.push('toolName must be an alphanumeric identifier (2-64 chars).');
  }
  if (body.sessionId !== undefined && (typeof body.sessionId !== 'string' || !ID_PATTERN.test(body.sessionId))) {
    errors.push('sessionId must be a valid identifier (1-128 chars).');
  }
  if (body.requestedScopes !== undefined) {
    if (!Array.isArray(body.requestedScopes) || body.requestedScopes.length > 10) {
      errors.push('requestedScopes must be an array of at most 10 scopes.');
    } else {
      for (const s of body.requestedScopes) {
        if (typeof s !== 'string' || !SCOPE_PATTERN.test(s)) {
          errors.push('Each requested scope must match <resource>:<action>.');
        }
      }
    }
  }
  if (body.ttlSeconds !== undefined && (!Number.isInteger(body.ttlSeconds) || body.ttlSeconds < 5 || body.ttlSeconds > 300)) {
    errors.push('ttlSeconds must be an integer between 5 and 300.');
  }
  if (body.singleUse !== undefined && typeof body.singleUse !== 'boolean') {
    errors.push('singleUse must be a boolean.');
  }
  if (body.citizenConfirmed !== undefined && typeof body.citizenConfirmed !== 'boolean') {
    errors.push('citizenConfirmed must be a boolean.');
  }
  if (body.humanApproved !== undefined && typeof body.humanApproved !== 'boolean') {
    errors.push('humanApproved must be a boolean.');
  }
  if (body.provenanceRef !== undefined && body.provenanceRef !== null && (typeof body.provenanceRef !== 'string' || body.provenanceRef.length > 128)) {
    errors.push('provenanceRef must be a string up to 128 chars.');
  }
  if (body.boundArgs !== undefined && body.boundArgs !== null && (typeof body.boundArgs !== 'object' || Array.isArray(body.boundArgs))) {
    errors.push('boundArgs must be a JSON object when provided.');
  }
  if (body.correlationId !== undefined && (typeof body.correlationId !== 'string' || !ID_PATTERN.test(body.correlationId))) {
    errors.push('correlationId must be a valid identifier.');
  }

  return { valid: errors.length === 0, errors, value: errors.length ? null : body };
}

export function validateInvokeToolBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be a JSON object.'], value: null };
  }
  const allowed = new Set([
    'capabilityToken',
    'toolName',
    'args',
    'sessionId',
    'correlationId',
    'citizenConfirmed',
    'humanApproved',
    'provenance',
  ]);
  const errors = rejectUnknownKeys(body, allowed, 'body');

  if (typeof body.capabilityToken !== 'string' || body.capabilityToken.length < 20 || body.capabilityToken.length > 4096) {
    errors.push('capabilityToken must be a valid signed capability string.');
  }
  if (typeof body.toolName !== 'string' || !TOOL_NAME_PATTERN.test(body.toolName)) {
    errors.push('toolName must be an alphanumeric identifier (2-64 chars).');
  }
  if (!body.args || typeof body.args !== 'object' || Array.isArray(body.args)) {
    errors.push('args must be a non-null JSON object.');
  }
  if (body.sessionId !== undefined && (typeof body.sessionId !== 'string' || !ID_PATTERN.test(body.sessionId))) {
    errors.push('sessionId must be a valid identifier.');
  }
  if (body.correlationId !== undefined && (typeof body.correlationId !== 'string' || !ID_PATTERN.test(body.correlationId))) {
    errors.push('correlationId must be a valid identifier.');
  }
  if (body.citizenConfirmed !== undefined && typeof body.citizenConfirmed !== 'boolean') {
    errors.push('citizenConfirmed must be a boolean.');
  }
  if (body.humanApproved !== undefined && typeof body.humanApproved !== 'boolean') {
    errors.push('humanApproved must be a boolean.');
  }
  if (body.provenance !== undefined && body.provenance !== null && (typeof body.provenance !== 'object' || Array.isArray(body.provenance))) {
    errors.push('provenance must be a JSON object when provided.');
  }

  return { valid: errors.length === 0, errors, value: errors.length ? null : body };
}

export function validateRevokeBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, errors: ['Request body must be a JSON object.'], value: null };
  }
  const allowed = new Set(['targetType', 'targetId', 'action', 'reason']);
  const errors = rejectUnknownKeys(body, allowed, 'body');

  if (!['tool', 'capability', 'user'].includes(body.targetType)) {
    errors.push('targetType must be one of tool, capability, user.');
  }
  if (typeof body.targetId !== 'string' || !ID_PATTERN.test(body.targetId)) {
    errors.push('targetId must be a valid identifier (1-128 chars).');
  }
  if (body.action !== undefined && !['revoke', 'restore'].includes(body.action)) {
    errors.push('action must be revoke or restore.');
  }
  if (body.reason !== undefined && (typeof body.reason !== 'string' || body.reason.trim().length < 3 || body.reason.length > 240)) {
    errors.push('reason must be a string between 3 and 240 characters.');
  }

  return { valid: errors.length === 0, errors, value: errors.length ? null : body };
}
