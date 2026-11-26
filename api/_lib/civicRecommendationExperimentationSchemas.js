/**
 * api/_lib/civicRecommendationExperimentationSchemas.js
 *
 * Versioned request/response validation contracts for the Civic Service
 * Recommendation Experimentation Platform (#1193). All external input at trust
 * boundaries is validated against schema version 1. Unknown fields are
 * rejected to prevent schema drift and mass-assignment vulnerabilities.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUS = /^(draft|active|paused|concluded|rolled_back)$/;
const SCHEMA_VERSION = 1;
const MAX_PAYLOAD_BYTES = 64 * 1024;

const PROHIBITED_ATTRIBUTES = [
  'caste',
  'subcaste',
  'religion',
  'faith',
  'gender',
  'sex',
  'sexual_orientation',
  'aadhaar',
  'pan',
  'voter_id',
  'passport_number',
  'biometric',
  'health_condition',
  'disability_type',
  'political_affiliation',
  'exact_income',
  'bank_account'
];

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function ok(value) {
  return { valid: true, value, errors: [] };
}

function fail(...errors) {
  return { valid: false, value: null, errors };
}

function checkProhibited(data, path = '') {
  const breaches = [];
  if (!data) return breaches;
  if (Array.isArray(data)) {
    data.forEach((item, idx) => {
      breaches.push(...checkProhibited(item, `${path}[${idx}]`));
    });
    return breaches;
  }
  if (isObject(data)) {
    for (const key of Object.keys(data)) {
      const lower = key.toLowerCase();
      if (PROHIBITED_ATTRIBUTES.some((attr) => lower.includes(attr))) {
        breaches.push(`${path ? `${path}.` : ''}${key}`);
      }
      breaches.push(...checkProhibited(data[key], path ? `${path}.${key}` : key));
    }
  }
  return breaches;
}

export function validateUpsertExperiment(body) {
  if (!isObject(body)) return fail('Body must be a JSON object.');
  if (JSON.stringify(body).length > MAX_PAYLOAD_BYTES) return fail('Payload exceeds size limit.');

  const allowed = [
    'id', 'name', 'description', 'status', 'variants', 'guardrails',
    'audienceCriteria', 'optInRequired', 'salt'
  ];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) return fail(`Unknown field: ${k}`);
  }

  if (!body.id || typeof body.id !== 'string' || !SLUG.test(body.id)) {
    return fail('id must be a lowercase slug.');
  }
  if (!body.name || typeof body.name !== 'string' || body.name.length > 120) {
    return fail('name must be a non-empty string under 120 characters.');
  }
  if (body.status && (!STATUS.test(body.status))) {
    return fail('status must be one of: draft, active, paused, concluded, rolled_back.');
  }

  // Check prohibited attributes
  const prohibited = checkProhibited(body.audienceCriteria);
  if (prohibited.length > 0) {
    return fail(`Prohibited sensitive attribute(s) in audience criteria: ${prohibited.join(', ')}`);
  }

  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants) || body.variants.length === 0) {
      return fail('variants must be a non-empty array.');
    }
    for (const [idx, v] of body.variants.entries()) {
      if (!isObject(v) || !v.id || !SLUG.test(v.id)) {
        return fail(`variants[${idx}].id must be a lowercase slug.`);
      }
    }
  }

  return ok({
    id: body.id,
    name: body.name.trim(),
    description: body.description ? String(body.description).slice(0, 500) : '',
    status: body.status || 'draft',
    variants: body.variants || [],
    guardrails: body.guardrails || {},
    audienceCriteria: body.audienceCriteria || {},
    optInRequired: body.optInRequired !== false,
    salt: body.salt || 'salt-civic-recs'
  });
}

export function validateAssignVariant(body) {
  if (!isObject(body)) return fail('Body must be a JSON object.');

  const allowed = ['experimentId', 'citizenId', 'context', 'optIn'];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) return fail(`Unknown field: ${k}`);
  }

  if (!body.experimentId || typeof body.experimentId !== 'string' || !SLUG.test(body.experimentId)) {
    return fail('experimentId must be a lowercase slug.');
  }

  const prohibited = checkProhibited(body.context);
  if (prohibited.length > 0) {
    return fail(`Prohibited sensitive attribute(s) in context: ${prohibited.join(', ')}`);
  }

  return ok({
    experimentId: body.experimentId,
    citizenId: body.citizenId ? String(body.citizenId).slice(0, 100) : 'anonymous',
    context: body.context || {},
    optIn: Boolean(body.optIn)
  });
}

export function validateRecordMetric(body) {
  if (!isObject(body)) return fail('Body must be a JSON object.');

  const allowed = ['experimentId', 'variantId', 'relevanceScore', 'hasLanguageCoverage', 'isError'];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) return fail(`Unknown field: ${k}`);
  }

  if (!body.experimentId || !SLUG.test(body.experimentId)) {
    return fail('experimentId must be a lowercase slug.');
  }
  if (!body.variantId || !SLUG.test(body.variantId)) {
    return fail('variantId must be a lowercase slug.');
  }

  const score = body.relevanceScore !== undefined ? Number(body.relevanceScore) : 1.0;
  if (Number.isNaN(score) || score < 0 || score > 1) {
    return fail('relevanceScore must be a number between 0 and 1.');
  }

  return ok({
    experimentId: body.experimentId,
    variantId: body.variantId,
    relevanceScore: score,
    hasLanguageCoverage: body.hasLanguageCoverage !== false,
    isError: Boolean(body.isError)
  });
}

export function validateRollback(body) {
  if (!isObject(body)) return fail('Body must be a JSON object.');

  const allowed = ['experimentId', 'reason'];
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) return fail(`Unknown field: ${k}`);
  }

  if (!body.experimentId || !SLUG.test(body.experimentId)) {
    return fail('experimentId must be a lowercase slug.');
  }

  return ok({
    experimentId: body.experimentId,
    reason: body.reason ? String(body.reason).slice(0, 300) : 'Operator triggered rollback'
  });
}

export function schemaVersion() {
  return SCHEMA_VERSION;
}
