// Service Area Contract (schema version 1)
// -----------------------------------------
// Defines the schema for service_area records - geographic areas where a volunteer
// is available to serve.
// Full field reference: docs/SERVICE_AREA_DATA_CONTRACT.md
// This is a code-level contract for components and future integrations.
// NOT a deployed network API: nothing here is served over HTTP.

import { ID_PATTERN, isObject, isText, isNonEmptyTextList } from './serviceContract.js';

export const SERVICE_AREA_SCHEMA_VERSION = 1;
export const SUPPORTED_SERVICE_AREA_SCHEMA_VERSIONS = [1];

/**
 * Validate a service area record.
 * Returns a list of { field, reason } errors; an empty list means the record satisfies the contract.
 */
export function validateServiceAreaRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  // Required field: id
  if (!isText(record.id) || !ID_PATTERN.test(record.id)) {
    fail('id', 'is required and must be a lowercase slug such as "ward-4-delhi"');
  }

  // Required field: name
  if (!isNonEmptyText(record.name)) {
    fail('name', 'is required and must be a non-empty string');
  }

  // Required field: description
  if (!isText(record.description) || !isNonEmptyText(record.description)) {
    fail('description', 'is required and must be a non-empty string');
  }

  // Optional: jurisdiction - structured applicability metadata
  if (record.jurisdiction !== undefined) {
    if (!isObject(record.jurisdiction)) {
      fail('jurisdiction', 'must be { level, states, districts, localBody } when present');
    } else {
      const { level, states, districts, localBody } = record.jurisdiction;
      if (level !== undefined && typeof level !== 'string') {
        fail('jurisdiction.level', 'must be a string when present');
      }
      if (states !== undefined) {
        if (!isTextList(states)) {
          fail('jurisdiction.states', 'must be an array of non-empty strings when present');
        }
      }
      if (districts !== undefined) {
        if (!isTextList(districts)) {
          fail('jurisdiction.districts', 'must be an array of non-empty strings when present');
        }
      }
      if (localBody !== undefined && !isText(localBody)) {
        fail('jurisdiction.localBody', 'must be a non-empty string when present');
      }
    }
  }

  // Optional: category - e.g. "Health", "Education", "Disaster Response"
  if (record.category !== undefined) {
    if (!isText(record.category)) {
      fail('category', 'must be a non-empty string when present');
    }
  }

  // Optional: boundaries - GeoJSON or coordinate pairs
  if (record.bounds !== undefined) {
    if (!isObject(record.bounds)) {
      fail('bounds', 'must be a GeoJSON polygon or bounding box object when present');
    }
  }

  // Optional: isActive
  if (record.isActive !== undefined) {
    if (typeof record.isActive !== 'boolean') {
      fail('isActive', 'must be a boolean when present');
    }
  }

  // Metadata
  if (record.schemaVersion !== undefined) {
    if (record.schemaVersion !== SERVICE_AREA_SCHEMA_VERSION) {
      fail('schemaVersion', `must be ${SERVICE_AREA_SCHEMA_VERSION} when present; got ${record.schemaVersion}`);
    }
  }

  return errors;
}

/**
 * Fill optional fields with their safe fallbacks. Returns a new object.
 */
export function applyServiceAreaDefaults(record) {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? SERVICE_AREA_SCHEMA_VERSION,
    isActive: record.isActive ?? true,
  };
}

/**
 * Validate a whole service area envelope: { schemaVersion, serviceAreas }.
 * Returns { valid, errors }.
 */
export function validateServiceAreaEnvelope(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (!SUPPORTED_SERVICE_AREA_SCHEMA_VERSIONS.includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: ${SUPPORTED_SERVICE_AREA_SCHEMA_VERSIONS.join(', ')}`,
    });
    return { valid: false, errors };
  }
  if (!Array.isArray(envelope.serviceAreas)) {
    errors.push({ serviceId: null, field: 'serviceAreas', reason: 'must be an array of service area records' });
    return { valid: false, errors };
  }
  envelope.serviceAreas.forEach((record, index) => {
    const serviceId = isObject(record) && isText(record.id) ? record.id : `#${index}`;
    for (const e of validateServiceAreaRecord(record)) errors.push({ serviceId, ...e });
    if (isObject(record) && isText(record.id)) {
      if (new Set(envelope.serviceAreas.map(r => r.id)).size !== envelope.serviceAreas.length) {
        errors.push({ serviceId, field: 'id', reason: 'duplicate service area id within the envelope' });
      }
    }
  });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatServiceAreaError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;