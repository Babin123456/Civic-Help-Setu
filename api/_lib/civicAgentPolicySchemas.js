/**
 * api/_lib/civicAgentPolicySchemas.js
 *
 * Versioned request/response validation contracts for the Civic Agent Workflow
 * Policy-as-Code Engine (#1187). All external input at trust boundaries is
 * validated against the current schema version. Unknown fields are rejected to
 * prevent schema drift and mass-assignment issues.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESOURCE_TYPE = /^(tool|agent|source|state_transition|workflow)$/;
const EFFECT = /^(allow|deny|require_approval)$/;
const STATUS = /^(active|draft|archived|revoked|emergency_locked|retired)$/;
const ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const POSITIVE_INT = (value) => Number.isInteger(value) && value > 0;
const NON_NEG_INT = (value) => Number.isInteger(value) && value >= 0;

const SCHEMA_VERSION = 1;

/** Result shape for all validators. */
function ok(value) { return { valid: true, value, errors: [] }; }
function fail(...errors) { return { valid: false, value: null, errors }; }

/**
 * Validate a policy evaluate request.
 * Input: { policyId, workflowId, resourceType, resourceId, action, role,
 *          citizenConfirmed, humanApproved, sourceVerified, callSource,
 *          dailyCallCount, context }
 */
export function validateEvaluate(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { policyId, workflowId, resourceType, resourceId, action, role,
    citizenConfirmed, humanApproved, sourceVerified, callSource,
    dailyCallCount, context } = body;

  if (policyId !== undefined && (typeof policyId !== 'string' || !SLUG.test(policyId))) {
    errors.push('policyId must be a lowercase slug.');
  }
  if (workflowId !== undefined && (typeof workflowId !== 'string' || !SLUG.test(workflowId))) {
    errors.push('workflowId must be a lowercase slug.');
  }
  if (resourceType !== undefined && !RESOURCE_TYPE.test(resourceType)) {
    errors.push('resourceType must be one of tool, agent, source, state_transition, workflow.');
  }
  if (resourceId !== undefined && typeof resourceId !== 'string') {
    errors.push('resourceId must be a string.');
  }
  if (action !== undefined && typeof action !== 'string') {
    errors.push('action must be a string.');
  }
  if (role !== undefined && typeof role !== 'string') {
    errors.push('role must be a string.');
  }
  if (citizenConfirmed !== undefined && typeof citizenConfirmed !== 'boolean') {
    errors.push('citizenConfirmed must be a boolean.');
  }
  if (humanApproved !== undefined && typeof humanApproved !== 'boolean') {
    errors.push('humanApproved must be a boolean.');
  }
  if (sourceVerified !== undefined && typeof sourceVerified !== 'boolean') {
    errors.push('sourceVerified must be a boolean.');
  }
  if (callSource !== undefined && typeof callSource !== 'string') {
    errors.push('callSource must be a string.');
  }
  if (dailyCallCount !== undefined && !NON_NEG_INT(dailyCallCount)) {
    errors.push('dailyCallCount must be a non-negative integer.');
  }
  if (context !== undefined && (typeof context !== 'object' || Array.isArray(context) || context === null)) {
    errors.push('context must be a JSON object.');
  }

  return errors.length ? fail(...errors) : ok({ policyId, workflowId, resourceType, resourceId, action, role, citizenConfirmed, humanApproved, sourceVerified, callSource, dailyCallCount, context });
}

/**
 * Validate a policy upsert request.
 * Input: { id, name, description, status, denyByDefault, rules, emergencyLocked,
 *          requireHumanApprovalForHighImpact, createdBy }
 */
export function validatePolicyUpsert(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { id, name, description, status, denyByDefault, rules, emergencyLocked, requireHumanApprovalForHighImpact, createdBy } = body;

  if (typeof id !== 'string' || !SLUG.test(id)) {
    errors.push('id must be a lowercase slug.');
  }
  if (name !== undefined && (typeof name !== 'string' || name.length < 1 || name.length > 120)) {
    errors.push('name must be a string between 1 and 120 characters.');
  }
  if (description !== undefined && typeof description !== 'string') {
    errors.push('description must be a string.');
  }
  if (status !== undefined && !STATUS.test(status)) {
    errors.push(`status must be one of active, draft, archived, revoked, emergency_locked, retired.`);
  }
  if (denyByDefault !== undefined && typeof denyByDefault !== 'boolean') {
    errors.push('denyByDefault must be a boolean.');
  }
  if (rules !== undefined) {
    if (!Array.isArray(rules)) {
      errors.push('rules must be an array.');
    } else if (rules.length > 500) {
      errors.push('rules must contain at most 500 entries.');
    } else {
      for (const [i, rule] of rules.entries()) {
        if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
          errors.push(`rules[${i}] must be a JSON object.`);
          continue;
        }
        if (typeof rule.id !== 'string' || !SLUG.test(rule.id)) {
          errors.push(`rules[${i}].id must be a lowercase slug.`);
        }
        if (typeof rule.description !== 'string') {
          errors.push(`rules[${i}].description must be a string.`);
        }
        if (!RESOURCE_TYPE.test(rule.resourceType)) {
          errors.push(`rules[${i}].resourceType must be one of tool, agent, source, state_transition, workflow.`);
        }
        if (typeof rule.resourceId !== 'string') {
          errors.push(`rules[${i}].resourceId must be a string.`);
        }
        if (!EFFECT.test(rule.effect)) {
          errors.push(`rules[${i}].effect must be one of allow, deny, require_approval.`);
        }
        if (!Array.isArray(rule.conditions)) {
          errors.push(`rules[${i}].conditions must be an array.`);
        }
        if (typeof rule.conditionParams !== 'object' || Array.isArray(rule.conditionParams) || rule.conditionParams === null) {
          errors.push(`rules[${i}].conditionParams must be a JSON object.`);
        }
        if (typeof rule.requiresApproval !== 'boolean') {
          errors.push(`rules[${i}].requiresApproval must be a boolean.`);
        }
        if (!Array.isArray(rule.appliesToRoles)) {
          errors.push(`rules[${i}].appliesToRoles must be an array.`);
        }
        if (rule.priority !== undefined && !POSITIVE_INT(rule.priority)) {
          errors.push(`rules[${i}].priority must be a positive integer.`);
        }
        if (rule.expiresAt !== undefined && (typeof rule.expiresAt !== 'string' || !ISO8601.test(rule.expiresAt))) {
          errors.push(`rules[${i}].expiresAt must be an ISO-8601 timestamp.`);
        }
      }
    }
  }
  if (emergencyLocked !== undefined && typeof emergencyLocked !== 'boolean') {
    errors.push('emergencyLocked must be a boolean.');
  }
  if (requireHumanApprovalForHighImpact !== undefined && typeof requireHumanApprovalForHighImpact !== 'boolean') {
    errors.push('requireHumanApprovalForHighImpact must be a boolean.');
  }
  if (createdBy !== undefined && typeof createdBy !== 'string') {
    errors.push('createdBy must be a string.');
  }

  return errors.length ? fail(...errors) : ok({ id, name, description, status, denyByDefault, rules, emergencyLocked, requireHumanApprovalForHighImpact, createdBy });
}

/**
 * Validate an emergency revoke request.
 * Input: { policyId, reason, revokedBy }
 */
export function validateEmergencyRevoke(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { policyId, reason, revokedBy } = body;

  if (typeof policyId !== 'string' || !SLUG.test(policyId)) {
    errors.push('policyId must be a lowercase slug.');
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length < 1 || reason.length > 500)) {
    errors.push('reason must be a string between 1 and 500 characters.');
  }
  if (revokedBy !== undefined && typeof revokedBy !== 'string') {
    errors.push('revokedBy must be a string.');
  }

  return errors.length ? fail(...errors) : ok({ policyId, reason, revokedBy });
}

/**
 * Validate a list/query request.
 * Input: { policyId, limit, cursor }
 */
export function validateListQuery(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { policyId, limit, cursor } = body;

  if (policyId !== undefined && (typeof policyId !== 'string' || !SLUG.test(policyId))) {
    errors.push('policyId must be a lowercase slug.');
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    errors.push('limit must be an integer between 1 and 100.');
  }
  if (cursor !== undefined && typeof cursor !== 'string') {
    errors.push('cursor must be a string.');
  }

  return errors.length ? fail(...errors) : ok({ policyId, limit, cursor });
}

/**
 * Validate a simulate request.
 * Input: { requests, policy, emergencyRevokeMidway }
 */
export function validateSimulate(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { requests, policy, emergencyRevokeMidway } = body;

  if (requests !== undefined && !Array.isArray(requests)) {
    errors.push('requests must be an array.');
  }
  if (requests !== undefined && requests.length > 1000) {
    errors.push('requests must contain at most 1000 entries.');
  }
  if (emergencyRevokeMidway !== undefined && typeof emergencyRevokeMidway !== 'boolean') {
    errors.push('emergencyRevokeMidway must be a boolean.');
  }

  return errors.length ? fail(...errors) : ok({ requests, policy, emergencyRevokeMidway });
}

/**
 * Current schema version exposed to clients.
 */
export function schemaVersion() {
  return SCHEMA_VERSION;
}
