// Task Application Contract (schema version 1)
// ---------------------------------------------
// Defines the schema for task_application records.
// When a volunteer applies to a volunteer task.
// Full field reference: docs/TASK_APPLICATION_DATA_CONTRACT.md
// This is a code-level contract for components and future integrations.
// NOT a deployed network API: nothing here is served over HTTP.

import { ID_PATTERN, isObject, isText, isNonEmptyText, isRealDate } from './serviceContract.js';

export const TASK_APPLICATION_SCHEMA_VERSION = 1;
export const SUPPORTED_TASK_APPLICATION_SCHEMA_VERSIONS = [1];
export const APPLICATION_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'];

/**
 * Validate a task application record.
 * Returns a list of { field, reason } errors; an empty list means the record satisfies the contract.
 */
export function validateTaskApplicationRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  // Required field: id
  if (!isText(record.id) || !ID_PATTERN.test(record.id)) {
    fail('id', 'is required and must be a lowercase slug such as "app-vol-123"');
  }

  // Required field: volunteerId - the ID of the volunteer applying
  if (!isText(record.volunteerId) || !ID_PATTERN.test(record.volunteerId)) {
    fail('volunteerId', 'is required and must be a lowercase slug');
  }

  // Required field: taskId - the ID of the task being applied to
  if (!isText(record.taskId) || !ID_PATTERN.test(record.taskId)) {
    fail('taskId', 'is required and must be a lowercase slug');
  }

  // Optional: status - pending, accepted, rejected, withdrawn
  if (record.status !== undefined) {
    const validStatuses = APPLICATION_STATUSES;
    if (!validStatuses.includes(record.status)) {
      fail('status', `must be one of: ${validStatuses.join(', ')} when present`);
    }
  } else {
    // Default status is pending
    record.status = 'pending';
  }

  // Optional: motivationLetter - why the volunteer wants to participate
  if (record.motivationLetter !== undefined) {
    if (!isText(record.motivationLetter)) {
      fail('motivationLetter', 'must be a non-empty string when present');
    }
  }

  // Optional: skillsOffered - skills the volunteer brings to this task
  if (record.skillsOffered !== undefined) {
    if (!Array.isArray(record.skillsOffered)) {
      fail('skillsOffered', 'must be an array');
    } else {
      record.skillsOffered.forEach((skill, i) => {
        if (typeof skill === 'object' && skill !== null) {
          if (!isText(skill.id) || !ID_PATTERN.test(skill.id)) {
            fail(`skillsOffered[${i}].id`, 'must be a lowercase slug if present as an object');
          }
          if (!isText(skill.name) || !isNonEmptyText(skill.name)) {
            fail(`skillsOffered[${i}].name`, 'must be a non-empty string if present as an object');
          }
        } else if (typeof skill === 'string') {
          if (!ID_PATTERN.test(skill)) {
            fail(`skillsOffered[${i}](string)`, 'must be a lowercase slug if present as a string');
          }
        } else {
          fail(`skillsOffered[${i}]`, 'must be a string or an object with id and name');
        }
      });
    }
  }

  // Optional: availability - when the volunteer is available
  if (record.availability !== undefined) {
    if (!isText(record.availability)) {
      fail('availability', 'must be a non-empty string when present');
    }
  }

  // Optional: consentGiven - whether volunteer consented to data processing
  if (record.consentGiven !== undefined) {
    if (typeof record.consentGiven !== 'boolean') {
      fail('consentGiven', 'must be a boolean when present');
    }
  }

  // Optional: accessibilityRequirements
  if (record.accessibilityRequirements !== undefined) {
    if (!isTextList(record.accessibilityRequirements)) {
      fail('accessibilityRequirements', 'must be an array of non-empty strings when present');
    }
  }

  // Optional: dateSubmitted
  if (record.dateSubmitted !== undefined) {
    if (!isRealDate(record.dateSubmitted)) {
      fail('dateSubmitted', 'must be a real date in YYYY-MM-DD format when present');
    }
  }

  // Metadata
  if (record.schemaVersion !== undefined) {
    if (record.schemaVersion !== TASK_APPLICATION_SCHEMA_VERSION) {
      fail('schemaVersion', `must be ${TASK_APPLICATION_SCHEMA_VERSION} when present; got ${record.schemaVersion}`);
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
export function applyTaskApplicationDefaults(record) {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? TASK_APPLICATION_SCHEMA_VERSION,
    status: record.status ?? 'pending',
    consentGiven: record.consentGiven ?? false,
  };
}

/**
 * Validate a whole task application envelope: { schemaVersion, taskApplication }.
 * Returns { valid, errors }.
 */
export function validateTaskApplicationEnvelope(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (!SUPPORTED_TASK_APPLICATION_SCHEMA_VERSIONS.includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: ${SUPPORTED_TASK_APPLICATION_SCHEMA_VERSIONS.join(', ')}`,
    });
    return { valid: false, errors };
  }
  if (!envelope.taskApplication) {
    errors.push({ serviceId: null, field: 'taskApplication', reason: 'must be present' });
    return { valid: false, errors };
  }
  const serviceErrors = validateTaskApplicationRecord(envelope.taskApplication);
  serviceErrors.forEach((e) => { e.serviceId = envelope.taskApplication.id || 'unknown'; });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatTaskApplicationError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;