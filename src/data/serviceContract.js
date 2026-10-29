// Internal, read-only data contract for service records (schema version 1).
// This is a code-level contract for components and future integrations. It is
// NOT a deployed network API: nothing here is served over HTTP.
// Full field reference: docs/SERVICE_DATA_CONTRACT.md

import { SERVICE_CATEGORIES } from './serviceCategories';
import { validateJurisdiction as validateAppJurisdiction } from '../services/jurisdictionService';

export const SERVICE_SCHEMA_VERSION = 1;
export const SUPPORTED_SCHEMA_VERSIONS = [1];

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const FEE_TYPES = ['free', 'paid'];
export const PUBLICATION_STATES = ['draft', 'published', 'archived'];

// Used when an optional field is missing; see applyServiceDefaults.
export const SERVICE_FALLBACKS = Object.freeze({
  publicationState: 'published',
});

// Personal data must never be part of a service record.
export const FORBIDDEN_FIELDS = [
  'userId', 'email', 'phone', 'password', 'token', 'aadhaarNumber', 'aadhaar',
  'panNumber', 'documentUrl', 'profile', 'address',
];

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isTextList = (v) => Array.isArray(v) && v.every(isText);

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isRealDate(value) {
  const match = typeof value === 'string' && DATE_PATTERN.exec(value);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * `jurisdiction` is the structured applicability metadata (#260): { level, states, districts, localBody }.
 * The rules are the app's own (validateJurisdiction in jurisdictionService), so the contract cannot
 * drift from what the admin form and the catalogue accept. A legacy plain string such as "India" is
 * rejected: the app treats it as "unknown" and never as nationwide, so the contract does not either.
 */
function validateJurisdiction(value, fail) {
  if (!isObject(value)) {
    fail('jurisdiction', 'must be { level, states, districts, localBody } when present (plain text is no longer accepted)');
    return;
  }
  for (const message of validateAppJurisdiction(value)) fail('jurisdiction', message);
}

// Personal-data keys are rejected at any depth. A contact may carry a phone or an email: those two are
// the only keys allowed below, and only directly on a contacts[i] entry.
function scanForbidden(node, path, fail, allowed = []) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => scanForbidden(item, `${path}[${i}]`, fail, path === 'contacts' ? ['phone', 'email'] : []));
    return;
  }
  if (!isObject(node)) return;
  for (const [key, child] of Object.entries(node)) {
    const where = path ? `${path}.${key}` : key;
    if (FORBIDDEN_FIELDS.includes(key) && !allowed.includes(key)) fail(where, 'personal or sensitive data is not allowed in a service record');
    else scanForbidden(child, where, fail);
  }
}

/**
 * Validate one service record. Returns a list of { field, reason } errors;
 * an empty list means the record satisfies the contract.
 */
export function validateServiceRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  scanForbidden(record, '', fail);

  if (!isText(record.id) || !ID_PATTERN.test(record.id)) fail('id', 'is required and must be a lowercase slug such as "birth-certificate"');
  if (!isText(record.name)) fail('name', 'is required and must be a non-empty string');
  if (!isText(record.shortDescription)) fail('shortDescription', 'is required and must be a non-empty string');
  if (!SERVICE_CATEGORIES.includes(record.category)) fail('category', `must be one of: ${SERVICE_CATEGORIES.join(', ')}`);
  if (!isText(record.department)) fail('department', 'is required and must be a non-empty string');
  if (!isText(record.type)) fail('type', 'is required and must be a non-empty string such as "Online" or "Online / Offline"');
  if (!DIFFICULTIES.includes(record.difficulty)) fail('difficulty', `must be one of: ${DIFFICULTIES.join(', ')}`);
  if (!FEE_TYPES.includes(record.feeType)) fail('feeType', `must be one of: ${FEE_TYPES.join(', ')}`);
  if (!Number.isInteger(record.speedDays) || record.speedDays < 0) fail('speedDays', 'must be a whole number of days, 0 or more');
  if (!isTextList(record.eligibility)) fail('eligibility', 'must be an array of non-empty strings');
  if (!isTextList(record.documents)) fail('documents', 'must be an array of non-empty strings');
  if (!isText(record.fees)) fail('fees', 'is required and must be a non-empty string');
  if (!isText(record.processingTime)) fail('processingTime', 'is required and must be a non-empty string');
  if (!isRealDate(record.lastVerified)) fail('lastVerified', 'must be a real date in YYYY-MM-DD format');

  if (!Array.isArray(record.steps) || record.steps.length === 0) {
    fail('steps', 'must be a non-empty array of { title, description }');
  } else {
    record.steps.forEach((step, i) => {
      if (!isObject(step) || !isText(step.title) || !isText(step.description)) {
        fail(`steps[${i}]`, 'must have a non-empty title and description');
      }
    });
  }

  if (!Array.isArray(record.officialSources) || record.officialSources.length === 0) {
    fail('officialSources', 'must be a non-empty array of { name, url }');
  } else {
    record.officialSources.forEach((source, i) => {
      if (!isObject(source) || !isText(source.name)) fail(`officialSources[${i}].name`, 'is required');
      if (!isObject(source) || !isHttpsUrl(source.url)) fail(`officialSources[${i}].url`, 'must be an https URL');
    });
  }

  // Optional fields: absent is fine, present must be valid.
  if (record.warnings !== undefined && !isTextList(record.warnings)) fail('warnings', 'must be an array of non-empty strings when present');
  if (record.popularityScore !== undefined && !(Number.isFinite(record.popularityScore) && record.popularityScore >= 0 && record.popularityScore <= 100)) {
    fail('popularityScore', 'must be a number from 0 to 100 when present');
  }
  if (record.eligibilityRuleKey !== undefined && !isText(record.eligibilityRuleKey)) fail('eligibilityRuleKey', 'must be a non-empty string when present');
  if (record.jurisdiction !== undefined) validateJurisdiction(record.jurisdiction, fail);
  if (record.publicationState !== undefined && !PUBLICATION_STATES.includes(record.publicationState)) {
    fail('publicationState', `must be one of: ${PUBLICATION_STATES.join(', ')} when present`);
  }
  if (record.contacts !== undefined) {
    if (!Array.isArray(record.contacts)) {
      fail('contacts', 'must be an array of { label, phone?, email?, url? } when present');
    } else {
      record.contacts.forEach((c, i) => {
        if (!isObject(c) || !isText(c.label)) {
          fail(`contacts[${i}].label`, 'is required');
          return;
        }
        if (c.phone === undefined && c.email === undefined && c.url === undefined) fail(`contacts[${i}]`, 'needs at least one of phone, email or url');
        if (c.email !== undefined && !(typeof c.email === 'string' && EMAIL_PATTERN.test(c.email))) fail(`contacts[${i}].email`, 'is not a valid email address');
        if (c.url !== undefined && !isHttpsUrl(c.url)) fail(`contacts[${i}].url`, 'must be an https URL');
        if (c.phone !== undefined && !isText(c.phone)) fail(`contacts[${i}].phone`, 'must be a non-empty string');
      });
    }
  }

  return errors;
}

/** Fill optional fields with their safe fallbacks. Returns a new object. */
export function applyServiceDefaults(record) {
  return {
    ...record,
    publicationState: record.publicationState ?? SERVICE_FALLBACKS.publicationState,
    warnings: record.warnings ?? [],
    contacts: record.contacts ?? [],
  };
}

/**
 * Validate a whole catalogue envelope: { schemaVersion, services }.
 * An unsupported or missing version fails before any record is looked at.
 * Returns { valid, errors } where each error is { serviceId, field, reason }.
 */
export function validateCatalogue(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`,
    });
    return { valid: false, errors };
  }
  if (!Array.isArray(envelope.services)) {
    errors.push({ serviceId: null, field: 'services', reason: 'must be an array of service records' });
    return { valid: false, errors };
  }
  const seen = new Set();
  envelope.services.forEach((record, index) => {
    const serviceId = isObject(record) && isText(record.id) ? record.id : `#${index}`;
    for (const e of validateServiceRecord(record)) errors.push({ serviceId, ...e });
    if (isObject(record) && isText(record.id)) {
      if (seen.has(record.id)) errors.push({ serviceId, field: 'id', reason: 'duplicates another record id' });
      seen.add(record.id);
    }
  });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatContractError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;
