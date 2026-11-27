/**
 * api/_lib/civicAgentEvalSchemas.js
 *
 * Versioned boundary validation contracts for /api/civic-agent-eval.
 * Rejects unknown fields, prototype pollution keys, oversized batches,
 * and forbidden PII/credential fields.
 */

import {
  EVAL_SCHEMA_VERSION,
  EVAL_CATEGORIES,
  EVAL_LANGUAGES,
  validateEvalRunRequest,
  validateReleaseThresholds,
} from '../../src/ai/evals/evalContracts.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function hasUnsafeKey(obj) {
  return Boolean(obj && typeof obj === 'object' && Object.keys(obj).some((k) => UNSAFE_KEYS.has(k)));
}

export function schemaVersion() {
  return EVAL_SCHEMA_VERSION;
}

export function validateCreateEvalRun(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, value: null, errors: ['Request body must be a JSON object.'] };
  }
  if (hasUnsafeKey(body)) {
    return { valid: false, value: null, errors: ['Request contains unsafe object keys.'] };
  }

  const allowed = new Set([
    'targetId',
    'modelId',
    'modelVersion',
    'promptVersion',
    'concurrency',
    'maxRetries',
    'timeoutMs',
    'category',
    'language',
    'scenarios',
    'thresholds',
  ]);

  const unknown = Object.keys(body).filter((k) => !allowed.has(k));
  if (unknown.length > 0) {
    return { valid: false, value: null, errors: [`Unknown request fields: ${unknown.join(', ')}`] };
  }

  return validateEvalRunRequest(body);
}

export function validateCompareRuns(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, value: null, errors: ['Request body must be a JSON object.'] };
  }
  if (hasUnsafeKey(body)) {
    return { valid: false, value: null, errors: ['Request contains unsafe object keys.'] };
  }

  const allowed = new Set(['baselineRunId', 'candidateRunId', 'thresholds']);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) errors.push(`Unknown field: ${key}`);
  }

  if (typeof body.baselineRunId !== 'string' || !ID_SEGMENT.test(body.baselineRunId)) {
    errors.push('baselineRunId must be a valid run identifier.');
  }
  if (typeof body.candidateRunId !== 'string' || !ID_SEGMENT.test(body.candidateRunId)) {
    errors.push('candidateRunId must be a valid run identifier.');
  }
  if (body.baselineRunId && body.candidateRunId && body.baselineRunId === body.candidateRunId) {
    errors.push('baselineRunId and candidateRunId must be distinct runs.');
  }

  let thresholds;
  if (body.thresholds !== undefined) {
    const tRes = validateReleaseThresholds(body.thresholds);
    if (!tRes.valid) errors.push(...tRes.errors);
    else thresholds = tRes.value;
  }

  return errors.length > 0
    ? { valid: false, value: null, errors }
    : {
        valid: true,
        value: {
          baselineRunId: body.baselineRunId,
          candidateRunId: body.candidateRunId,
          thresholds,
        },
        errors: [],
      };
}

export function validateThresholdConfig(body) {
  return validateReleaseThresholds(body);
}

export function validateListQuery(query = {}) {
  const errors = [];
  let limit = 25;
  if (query.limit !== undefined) {
    const parsed = Number(query.limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      errors.push('limit must be an integer between 1 and 100.');
    } else {
      limit = parsed;
    }
  }
  if (query.category !== undefined && query.category !== 'all' && !EVAL_CATEGORIES.includes(query.category)) {
    errors.push(`category must be "all" or one of: ${EVAL_CATEGORIES.join(', ')}.`);
  }
  if (query.language !== undefined && query.language !== 'all' && !EVAL_LANGUAGES.includes(query.language)) {
    errors.push(`language must be "all" or one of: ${EVAL_LANGUAGES.join(', ')}.`);
  }
  if (query.targetId !== undefined && (typeof query.targetId !== 'string' || !ID_SEGMENT.test(query.targetId))) {
    errors.push('targetId must be a valid slug.');
  }
  if (query.jurisdiction !== undefined && query.jurisdiction !== 'all' && typeof query.jurisdiction !== 'string') {
    errors.push('jurisdiction must be a string.');
  }

  return errors.length > 0
    ? { valid: false, value: null, errors }
    : {
        valid: true,
        value: {
          limit,
          category: query.category || 'all',
          language: query.language || 'all',
          targetId: query.targetId || null,
          jurisdiction: query.jurisdiction || 'all',
        },
        errors: [],
      };
}
