import manifest from '../data/contracts/registry.json';
import { validateServiceRecord, isRealDate } from '../data/serviceContract.js';
import { validateCommunityFacilityRecord } from '../data/communityFacilityContract.js';
import { validateJurisdiction } from './jurisdictionService.js';

export const MAX_DATASET_ROWS = 500;
export const MAX_DATASET_BYTES = 1024 * 1024;
const MAX_DEPTH = 20;
const MAX_ISSUES = 50;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const privateKeys = new Set(['password', 'token', 'accesstoken', 'refreshtoken', 'aadhaar', 'aadhaarnumber', 'pannumber', 'userid', 'documentcontent', 'documenturl']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const https = value => {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:'; }
  catch { return false; }
};
function freeze(value) {
  Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); });
  return Object.freeze(value);
}
export const CIVIC_CONTRACT_REGISTRY = freeze(manifest);
const contracts = new Map(manifest.contracts.map(contract => [contract.id, contract]));
const problem = (field, code, message) => ({ field, code, message });

// JSON-only, bounded preflight before recursive domain validators. Never echo a rejected value.
function safeJson(value) {
  const stack = [[value, 0, false]];
  const seen = new Set();
  let nodes = 0;
  while (stack.length) {
    const [node, depth, leaving] = stack.pop();
    if (leaving) { seen.delete(node); continue; }
    if (++nodes > 100000 || depth > MAX_DEPTH) return false;
    if (node === null || typeof node === 'string' || typeof node === 'boolean') continue;
    if (typeof node === 'number' && Number.isFinite(node)) continue;
    if (!node || typeof node !== 'object' || seen.has(node)) return false;
    if (!Array.isArray(node) && Object.getPrototypeOf(node) !== Object.prototype) return false;
    seen.add(node);
    stack.push([node, depth, true]);
    for (const [key, child] of Object.entries(node)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key) || privateKeys.has(key.replace(/[^a-z]/gi, '').toLowerCase())) return false;
      stack.push([child, depth + 1, false]);
    }
  }
  return true;
}

function validateRecord(contract, record) {
  const errors = [];
  const add = (field, message, code = 'INVALID_FIELD') => { if (errors.length < MAX_ISSUES) errors.push(problem(field, code, message)); };
  if (!object(record)) return [problem('record', 'INVALID_RECORD', 'A public metadata object is required.')];
  for (const [field, rule] of Object.entries(contract.fields)) {
    if (!own(record, field)) {
      if (rule.required) add(field, 'Required field is missing.');
      continue;
    }
    const value = record[field];
    let valid;
    switch (rule.type) {
      case 'text': valid = text(value); break;
      case 'object': valid = object(value); break;
      case 'slug': valid = typeof value === 'string' && value.length <= 120 && SLUG.test(value); break;
      case 'ids': valid = Array.isArray(value) && value.length <= MAX_DATASET_ROWS && value.every(id => typeof id === 'string' && id.length <= 120 && SLUG.test(id)) && new Set(value).size === value.length; break;
      case 'date': valid = isRealDate(value); break;
      case 'integer': valid = Number.isSafeInteger(value) && value >= rule.min && value <= rule.max; break;
      case 'jurisdiction': valid = object(value) && validateJurisdiction(value).length === 0; break;
      case 'sources': valid = Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(source => object(source) && text(source.name) && https(source.url)); break;
      default: valid = false;
    }
    if (!valid) add(field, `Expected ${rule.type}; null and out-of-range values are not accepted.`);
  }
  // New metadata adapters are allowlisted. Existing domain validators remain authoritative.
  if (contract.validator === 'metadata') {
    for (const field of Object.keys(record)) if (!own(contract.fields, field)) add(field, 'Field is outside this public metadata contract.', 'UNKNOWN_FIELD');
  }
  let domainErrors = [];
  if (contract.validator === 'serviceRecord') domainErrors = validateServiceRecord(record);
  if (contract.validator === 'communityFacilityRecord') domainErrors = validateCommunityFacilityRecord(record);
  for (const error of domainErrors) add(error.field, 'Existing domain contract rejected this field.', 'DOMAIN_CONTRACT');
  return errors;
}

/**
 * Pure preview/quarantine for public metadata, not an authorization or persistence layer.
 * Entries: { type, version, record }. No accepted record may reference a quarantined row.
 */
export function validateCivicDataset(dataset) {
  const failure = (code, message) => ({ valid: false, accepted: [], quarantined: [], errors: [problem('dataset', code, message)], metrics: { accepted: 0, quarantined: 0 } });
  try {
    if (!safeJson(dataset)) return failure('UNSAFE_INPUT', 'Expected bounded JSON public metadata without private identifiers.');
    if (new TextEncoder().encode(JSON.stringify(dataset)).byteLength > MAX_DATASET_BYTES) return failure('BYTE_LIMIT', 'Dataset exceeds the 1 MiB limit.');
  } catch { return failure('UNSAFE_INPUT', 'Dataset could not be inspected safely.'); }
  if (!object(dataset) || dataset.registryVersion !== manifest.registryVersion || !Array.isArray(dataset.entities)) return failure('INVALID_ENVELOPE', 'Expected registryVersion 1 and an entities array.');
  if (dataset.entities.length > MAX_DATASET_ROWS) return failure('ROW_LIMIT', 'Dataset exceeds the 500-row limit.');
  const rows = dataset.entities.map((entry, index) => {
    const contract = contracts.get(entry?.type);
    let errors;
    if (!contract || entry.version !== contract.version) errors = [problem('version', 'UNSUPPORTED_CONTRACT', 'Unknown entity type or unsupported contract version.')];
    else errors = validateRecord(contract, entry.record);
    return { index, entry, contract, errors };
  });
  const byKey = new Map();
  for (const row of rows) {
    if (!row.contract || !object(row.entry.record) || typeof row.entry.record.id !== 'string') continue;
    const key = `${row.contract.id}:${row.entry.record.id}`;
    if (byKey.has(key)) {
      row.errors.push(problem('id', 'DUPLICATE_ID', 'Duplicate entity ID within this type.'));
      byKey.get(key).errors.push(problem('id', 'DUPLICATE_ID', 'Duplicate entity ID within this type.'));
    } else byKey.set(key, row);
  }
  // At most 500 bounded passes; propagates rejection through dependency chains and cycles.
  let changed;
  do {
    changed = false;
    for (const row of rows) {
      if (row.errors.length) continue;
      for (const [field, rule] of Object.entries(row.contract.fields)) {
        if (!rule.reference || !own(row.entry.record, field)) continue;
        const ids = rule.type === 'ids' ? row.entry.record[field] : [row.entry.record[field]];
        for (const id of ids) {
          const target = byKey.get(`${rule.reference}:${id}`);
          if (!target || target.errors.length) {
            row.errors.push(problem(field, 'INVALID_REFERENCE', 'Reference is missing or targets a quarantined record.'));
            changed = true;
            break;
          }
        }
        if (row.errors.length) break;
      }
    }
  } while (changed);
  const accepted = rows.filter(row => !row.errors.length).map(row => JSON.parse(JSON.stringify(row.entry)));
  const quarantined = rows.filter(row => row.errors.length).map(row => ({ index: row.index, errors: row.errors.slice(0, MAX_ISSUES) }));
  return { valid: quarantined.length === 0, accepted, quarantined, errors: [], metrics: { accepted: accepted.length, quarantined: quarantined.length } };
}
