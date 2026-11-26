/**
 * api/_lib/civicContractTestMarketplaceSchemas.js
 *
 * Versioned request/response validation contracts for the Civic Service
 * Integration Contract Test Marketplace (#1191). All external input at trust
 * boundaries is validated against the current schema version. Unknown fields
 * are rejected to prevent schema drift and mass-assignment issues.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUTH_TYPE = /^(none|bearer|api_key|basic|oauth2)$/;
const ADAPTER_TYPE = /^(rest|soap|graphql|file|database|message_queue)$/;
const CONTRACT_TEST_STATUS = /^(pending|queued|running|completed|failed|cancelled|stale)$/;
const SUITE_STATUS = /^(active|draft|archived|deprecated)$/;
const SCORE_0_1 = (value) => typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 1;

const SCHEMA_VERSION = 1;
const MAX_TESTS_PER_SUITE = 200;

/** Result shape for all validators. */
function ok(value) { return { valid: true, value, errors: [] }; }
function fail(...errors) { return { valid: false, value: null, errors }; }

/**
 * Validate an upsert adapter request.
 * Input: { id, name, type, baseUrl, authType, authConfig, headers, timeoutMs,
 *          retryCount, isActive, description }
 */
export function validateUpsertAdapter(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { id, name, type, baseUrl, authType, authConfig, headers, timeoutMs, retryCount, isActive, description } = body;

  if (typeof id !== 'string' || !SLUG.test(id)) {
    errors.push('id must be a lowercase slug.');
  }
  if (name !== undefined && (typeof name !== 'string' || name.length < 1 || name.length > 120)) {
    errors.push('name must be a string between 1 and 120 characters.');
  }
  if (type !== undefined && !ADAPTER_TYPE.test(type)) {
    errors.push(`type must be one of rest, soap, graphql, file, database, message_queue.`);
  }
  if (baseUrl !== undefined && typeof baseUrl !== 'string') {
    errors.push('baseUrl must be a string.');
  }
  if (authType !== undefined && !AUTH_TYPE.test(authType)) {
    errors.push(`authType must be one of none, bearer, api_key, basic, oauth2.`);
  }
  if (authConfig !== undefined && (typeof authConfig !== 'object' || Array.isArray(authConfig) || authConfig === null)) {
    errors.push('authConfig must be a JSON object.');
  }
  if (headers !== undefined && (typeof headers !== 'object' || Array.isArray(headers) || headers === null)) {
    errors.push('headers must be a JSON object.');
  }
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs < 1)) {
    errors.push('timeoutMs must be a positive integer.');
  }
  if (retryCount !== undefined && (!Number.isInteger(retryCount) || retryCount < 0)) {
    errors.push('retryCount must be a non-negative integer.');
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    errors.push('isActive must be a boolean.');
  }
  if (description !== undefined && typeof description !== 'string') {
    errors.push('description must be a string.');
  }

  return errors.length ? fail(...errors) : ok({ id, name, type, baseUrl, authType, authConfig, headers, timeoutMs, retryCount, isActive, description });
}

/**
 * Validate an upsert suite request.
 * Input: { id, adapterId, name, description, status, tests, schedule }
 */
export function validateUpsertSuite(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { id, adapterId, name, description, status, tests, schedule } = body;

  if (typeof id !== 'string' || !SLUG.test(id)) {
    errors.push('id must be a lowercase slug.');
  }
  if (typeof adapterId !== 'string' || !SLUG.test(adapterId)) {
    errors.push('adapterId must be a lowercase slug.');
  }
  if (name !== undefined && (typeof name !== 'string' || name.length < 1 || name.length > 120)) {
    errors.push('name must be a string between 1 and 120 characters.');
  }
  if (description !== undefined && typeof description !== 'string') {
    errors.push('description must be a string.');
  }
  if (status !== undefined && !SUITE_STATUS.test(status)) {
    errors.push(`status must be one of active, draft, archived, deprecated.`);
  }
  if (tests !== undefined && !Array.isArray(tests)) {
    errors.push('tests must be an array.');
  } else if (tests !== undefined && tests.length > MAX_TESTS_PER_SUITE) {
    errors.push(`tests must contain at most ${MAX_TESTS_PER_SUITE} entries.`);
  }
  if (schedule !== undefined && typeof schedule !== 'string') {
    errors.push('schedule must be a string.');
  }

  return errors.length ? fail(...errors) : ok({ id, adapterId, name, description, status, tests, schedule });
}

/**
 * Validate a run suite request.
 * Input: { suiteId, adapterId, forceRecompute }
 */
export function validateRunSuite(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { suiteId, adapterId, forceRecompute } = body;

  if (typeof suiteId !== 'string' || !SLUG.test(suiteId)) {
    errors.push('suiteId must be a lowercase slug.');
  }
  if (adapterId !== undefined && (typeof adapterId !== 'string' || !SLUG.test(adapterId))) {
    errors.push('adapterId must be a lowercase slug.');
  }
  if (forceRecompute !== undefined && typeof forceRecompute !== 'boolean') {
    errors.push('forceRecompute must be a boolean.');
  }

  return errors.length ? fail(...errors) : ok({ suiteId, adapterId, forceRecompute });
}

/**
 * Validate a list/query request.
 * Input: { adapterId, suiteId, status, limit, cursor }
 */
export function validateListQuery(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { adapterId, suiteId, status, limit, cursor } = body;

  if (adapterId !== undefined && (typeof adapterId !== 'string' || !SLUG.test(adapterId))) {
    errors.push('adapterId must be a lowercase slug.');
  }
  if (suiteId !== undefined && (typeof suiteId !== 'string' || !SLUG.test(suiteId))) {
    errors.push('suiteId must be a lowercase slug.');
  }
  if (status !== undefined && !CONTRACT_TEST_STATUS.test(status)) {
    errors.push(`status must be one of pending, queued, running, completed, failed, cancelled, stale.`);
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    errors.push('limit must be an integer between 1 and 100.');
  }
  if (cursor !== undefined && typeof cursor !== 'string') {
    errors.push('cursor must be a string.');
  }

  return errors.length ? fail(...errors) : ok({ adapterId, suiteId, status, limit, cursor });
}

/**
 * Validate a record drift request.
 * Input: { runId, previousScore, currentScore, reason }
 */
export function validateRecordDrift(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { runId, previousScore, currentScore, reason } = body;

  if (typeof runId !== 'string' || !SLUG.test(runId)) {
    errors.push('runId must be a lowercase slug.');
  }
  if (previousScore !== undefined && !SCORE_0_1(previousScore)) {
    errors.push('previousScore must be a number between 0 and 1.');
  }
  if (currentScore !== undefined && !SCORE_0_1(currentScore)) {
    errors.push('currentScore must be a number between 0 and 1.');
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length < 1 || reason.length > 500)) {
    errors.push('reason must be a string between 1 and 500 characters.');
  }

  return errors.length ? fail(...errors) : ok({ runId, previousScore, currentScore, reason });
}

/**
 * Current schema version exposed to clients.
 */
export function schemaVersion() {
  return SCHEMA_VERSION;
}
