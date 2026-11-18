// Consent Record Contract (schema version 1)
// ------------------------------------------
// Defines the schema for consent_record records.
// Records of volunteer consent for data processing, task participation, etc.
// Full field reference: docs/CONSENT_RECORD_DATA_CONTRACT.md
// This is a code-level contract for components and future integrations.
// NOT a deployed network API: nothing here is served over HTTP.

import { ID_PATTERN, isObject, isText, isNonEmptyText, isRealDate } from './serviceContract.js';

export const CONSENT_RECORD_SCHEMA_VERSION = 1;
export const SUPPORTED_CONSENT_RECORD_SCHEMA_VERSIONS = [1];
export const CONSENT_TYPES = ['profile', 'task-participation', 'data-sharing', 'photo-capture', 'communication'];
export const CONSENT_VALIDITY_PERIODS = ['session', 'task', 'year', 'permanent'];

/**
 * Validate a consent record.
 * Returns a list of { field, reason } errors; an empty list means the record satisfies the contract.
 */
export function validateConsentRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  // Required field: id
  if (!isText(record.id) || !ID_PATTERN.test(record.id)) {
    fail('id', 'is required and must be a lowercase slug such as "consent-vol-123"');
  }

  // Required field: volunteerId - the ID of the volunteer who gave consent
  if (!isText(record.volunteerId) || !ID_PATTERN.test(record.volunteerId)) {
    fail('volunteerId', 'is required and must be a lowercase slug');
  }

  // Required field: consentType - type of consent
  if (record.consentType !== undefined) {
    const validTypes = CONSENT_TYPES;
    if (!validTypes.includes(record.consentType)) {
      fail('consentType', `must be one of: ${validTypes.join(', ')} when present`);
    }
  } else {
    fail('consentType', 'is required - must be one of: profile, task-participation, data-sharing, photo-capture, communication');
  }

  // Required field: grantedAt - when consent was given
  if (!record.grantedAt || !isRealDate(String(record.grantedAt))) {
    fail('grantedAt', 'is required and must be a date in YYYY-MM-DD format or ISO string');
  }

  // Optional: expiry - when consent expires
  if (record.expiry !== undefined) {
    if (!isRealDate(String(record.expiry))) {
      fail('expiry', 'must be a date in YYYY-MM-DD format or ISO string when present');
    }
    // Validation: expiry should be after grantedAt (checked at service layer)
  }

  // Optional: scope - what the consent covers
  if (record.scope !== undefined) {
    if (!isText(record.scope)) {
      fail('scope', 'must be a non-empty string when present');
    }
  }

  // Optional: withdrawable - whether the volunteer can withdraw consent
  if (record.withdrawable !== undefined) {
    if (typeof record.withdrawable !== 'boolean') {
      fail('withdrawable', 'must be a boolean when present');
    }
  } else {
    // Default is true for most consent types
    record.withdrawable = true;
  }

  // Optional: purpose - human-readable description of why consent was given
  if (record.purpose !== undefined) {
    if (!isNonEmptyText(record.purpose)) {
      fail('purpose', 'must be a non-empty string when present');
    }
  }

  // Optional: withdrawnAt - when consent was withdrawn
  if (record.withdrawnAt !== undefined) {
    if (!isRealDate(String(record.withdrawnAt))) {
      fail('withdrawnAt', 'must be a date in YYYY-MM-DD format or ISO string when present');
    }
    // Validation: withdrawnAt should be after grantedAt (checked at service layer)
  }

  // Metadata
  if (record.schemaVersion !== undefined) {
    if (record.schemaVersion !== CONSENT_RECORD_SCHEMA_VERSION) {
      fail('schemaVersion', `must be ${CONSENT_RECORD_SCHEMA_VERSION} when present; got ${record.schemaVersion}`);
    }
  }

  if (record.createdBy !== undefined && !isText(record.createdBy)) {
    fail('createdBy', 'must be a non-empty string when present');
  }

  if (record.createdAt !== undefined) {
    if (!isRealDate(record.createdAt)) {
      fail('createdAt', 'must be a real date in YYYY-MM-DD format when present');
    }
  }
  if (record.updatedAt !== undefined) {
    if (!isRealDate(record.updatedAt)) {
      fail('updatedAt', 'must be a real date in YYYY-MM-DD format when present');
    }
  }

  return errors;
}

/**
 * Fill optional fields with their safe fallbacks. Returns a new object.
 */
export function applyConsentRecordDefaults(record) {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? CONSENT_RECORD_SCHEMA_VERSION,
    withdrawable: record.withdrawable ?? true,
  };
}

/**
 * Validate a whole consent record envelope: { schemaVersion, consentRecord }.
 * Returns { valid, errors }.
 */
export function validateConsentRecordEnvelope(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (!SUPPORTED_CONSENT_RECORD_SCHEMA_VERSIONS.includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: ${SUPPORTED_CONSENT_RECORD_SCHEMA_VERSIONS.join(', ')}`,
    });
    return { valid: false, errors };
  }
  if (!envelope.consentRecord) {
    errors.push({ serviceId: null, field: 'consentRecord', reason: 'must be present' });
    return { valid: false, errors };
  }
  const serviceErrors = validateConsentRecord(envelope.consentRecord);
  serviceErrors.forEach((e) => { e.serviceId = envelope.consentRecord.id || 'unknown'; });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatConsentRecordError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;