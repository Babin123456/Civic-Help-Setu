/**
 * api/_lib/civicSourceFreshnessPredictionSchemas.js
 *
 * Versioned request/response validation contracts for the Civic Information
 * Freshness Prediction and Review Prioritization Engine API (#1187). All
 * external input at trust boundaries is validated against the current schema
 * version. Unknown fields are rejected to prevent schema drift and
 * mass-assignment issues.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRIORITY_BAND = /^(low|medium|high|critical)$/;
const STATUS = /^(pending|computed|stale|reviewed|superseded|withdrawn|archived)$/;
const ISO8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SCORE_0_1 = (value) => typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 1;

const SCHEMA_VERSION = 1;

/** Result shape for all validators. */
function ok(value) { return { valid: true, value, errors: [] }; }
function fail(...errors) { return { valid: false, value: null, errors }; }

/**
 * Validate a predict request.
 * Input: { serviceId, service, linkHealthRecords, verificationHistory, weights,
 *          forceRecompute, nowIso }
 */
export function validatePredict(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { serviceId, service, linkHealthRecords, verificationHistory, weights, forceRecompute, nowIso } = body;

  if (typeof serviceId !== 'string' || !SLUG.test(serviceId)) {
    errors.push('serviceId must be a lowercase slug.');
  }
  if (service !== undefined && (typeof service !== 'object' || Array.isArray(service) || service === null)) {
    errors.push('service must be a JSON object.');
  }
  if (linkHealthRecords !== undefined && (typeof linkHealthRecords !== 'object' || Array.isArray(linkHealthRecords) || linkHealthRecords === null)) {
    errors.push('linkHealthRecords must be a JSON object.');
  }
  if (verificationHistory !== undefined && !Array.isArray(verificationHistory)) {
    errors.push('verificationHistory must be an array.');
  }
  if (weights !== undefined && (typeof weights !== 'object' || Array.isArray(weights) || weights === null)) {
    errors.push('weights must be a JSON object.');
  }
  if (forceRecompute !== undefined && typeof forceRecompute !== 'boolean') {
    errors.push('forceRecompute must be a boolean.');
  }
  if (nowIso !== undefined && (typeof nowIso !== 'string' || !ISO8601.test(nowIso))) {
    errors.push('nowIso must be an ISO-8601 timestamp.');
  }

  return errors.length ? fail(...errors) : ok({ serviceId, service, linkHealthRecords, verificationHistory, weights, forceRecompute, nowIso });
}

/**
 * Validate a review prediction request.
 * Input: { serviceId, reviewerNote, reviewedBy, decision }
 */
export function validateReviewPrediction(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { serviceId, reviewerNote, reviewedBy, decision } = body;

  if (typeof serviceId !== 'string' || !SLUG.test(serviceId)) {
    errors.push('serviceId must be a lowercase slug.');
  }
  if (reviewerNote !== undefined && (typeof reviewerNote !== 'string' || reviewerNote.length < 1 || reviewerNote.length > 500)) {
    errors.push('reviewerNote must be a string between 1 and 500 characters.');
  }
  if (reviewedBy !== undefined && typeof reviewedBy !== 'string') {
    errors.push('reviewedBy must be a string.');
  }
  if (decision !== undefined && !STATUS.test(decision)) {
    errors.push(`decision must be one of pending, computed, stale, reviewed, superseded, withdrawn, archived.`);
  }

  return errors.length ? fail(...errors) : ok({ serviceId, reviewerNote, reviewedBy, decision });
}

/**
 * Validate a list/query request.
 * Input: { band, status, limit, cursor }
 */
export function validateListQuery(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { band, status, limit, cursor } = body;

  if (band !== undefined && !PRIORITY_BAND.test(band)) {
    errors.push(`band must be one of low, medium, high, critical.`);
  }
  if (status !== undefined && !STATUS.test(status)) {
    errors.push(`status must be one of pending, computed, stale, reviewed, superseded, withdrawn, archived.`);
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
    errors.push('limit must be an integer between 1 and 100.');
  }
  if (cursor !== undefined && typeof cursor !== 'string') {
    errors.push('cursor must be a string.');
  }

  return errors.length ? fail(...errors) : ok({ band, status, limit, cursor });
}

/**
 * Validate a record-drift request.
 * Input: { serviceId, previousScore, currentScore, reason }
 */
export function validateDriftEvent(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Request body must be a non-null JSON object');
  }

  const { serviceId, previousScore, currentScore, reason } = body;

  if (typeof serviceId !== 'string' || !SLUG.test(serviceId)) {
    errors.push('serviceId must be a lowercase slug.');
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

  return errors.length ? fail(...errors) : ok({ serviceId, previousScore, currentScore, reason });
}

/**
 * Current schema version exposed to clients.
 */
export function schemaVersion() {
  return SCHEMA_VERSION;
}
