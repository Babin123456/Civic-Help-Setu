// Skill Contract (schema version 1)
// ---------------------------------
// Defines the schema for skill records.
// Full field reference: docs/SKILL_DATA_CONTRACT.md
// This is a code-level contract for components and future integrations.
// NOT a deployed network API: nothing here is served over HTTP.

import { ID_PATTERN, isText, isNonEmptyText } from './serviceContract.js';

export const SKILL_SCHEMA_VERSION = 1;
export const SUPPORTED_SKILL_SCHEMA_VERSIONS = [1];

// Skills are short, categorical identifiers for volunteer capabilities.
// A skill can be used both as a tag and as a search filter.

/**
 * Validate a skill record.
 * Returns a list of { field, reason } errors; an empty list means the record satisfies the contract.
 */
export function validateSkillRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  // Required field: id
  if (!isText(record.id) || !ID_PATTERN.test(record.id)) {
    fail('id', 'is required and must be a lowercase slug such as "first-aid"');
  }

  // Required field: name
  if (!isNonEmptyText(record.name)) {
    fail('name', 'is required and must be a non-empty string');
  }

  // Optional: category - e.g. "Health", "Disaster Response", "Education"
  if (record.category !== undefined) {
    if (!isText(record.category)) {
      fail('category', 'must be a non-empty string when present');
    }
  }

  // Optional: description
  if (record.description !== undefined) {
    if (!isText(record.description)) {
      fail('description', 'must be a non-empty string when present');
    }
  }

  // Optional: proficiencyLevel - beginner, intermediate, expert
  if (record.proficiencyLevel !== undefined) {
    const validLevels = ['beginner', 'intermediate', 'expert'];
    if (!validLevels.includes(record.proficiencyLevel)) {
      fail('proficiencyLevel', `must be one of: ${validLevels.join(', ')} when present`);
    }
  }

  // Optional: yearsOfExperience
  if (record.yearsOfExperience !== undefined) {
    if (!Number.isInteger(record.yearsOfExperience) || record.yearsOfExperience < 0) {
      fail('yearsOfExperience', 'must be a non-negative integer when present');
    }
  }

  // Metadata
  if (record.schemaVersion !== undefined) {
    if (record.schemaVersion !== SKILL_SCHEMA_VERSION) {
      fail('schemaVersion', `must be ${SKILL_SCHEMA_VERSION} when present; got ${record.schemaVersion}`);
    }
  }

  return errors;
}

/**
 * Fill optional fields with their safe fallbacks. Returns a new object.
 */
export function applySkillDefaults(record) {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? SKILL_SCHEMA_VERSION,
    proficiencyLevel: record.proficiencyLevel ?? 'beginner',
  };
}

/**
 * Validate a whole skill envelope: { schemaVersion, skills }.
 * Returns { valid, errors }.
 */
export function validateSkillEnvelope(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (!SUPPORTED_SKILL_SCHEMA_VERSIONS.includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: ${SUPPORTED_SKILL_SCHEMA_VERSIONS.join(', ')}`,
    });
    return { valid: false, errors };
  }
  if (!Array.isArray(envelope.skills)) {
    errors.push({ serviceId: null, field: 'skills', reason: 'must be an array of skill records' });
    return { valid: false, errors };
  }
  envelope.skills.forEach((record, index) => {
    const serviceId = isObject(record) && isText(record.id) ? record.id : `#${index}`;
    for (const e of validateSkillRecord(record)) errors.push({ serviceId, ...e });
    if (isObject(record) && isText(record.id)) {
      if (new Set(envelope.skills.map(r => r.id)).size !== envelope.skills.length) {
        errors.push({ serviceId, field: 'id', reason: 'duplicate skill id within the envelope' });
      }
    }
  });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatSkillError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;