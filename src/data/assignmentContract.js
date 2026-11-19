// Assignment Contract (schema version 1)
// ---------------------------------------
// Defines the schema for assignment records.
// When a volunteer is assigned to a task.
// Full field reference: docs/ASSIGNMENT_DATA_CONTRACT.md
// This is a code-level contract for components and future integrations.
// NOT a deployed network API: nothing here is served over HTTP.

import { ID_PATTERN, isObject, isText, isNonEmptyText, isRealDate } from './serviceContract.js';

export const ASSIGNMENT_SCHEMA_VERSION = 1;
export const SUPPORTED_ASSIGNMENT_SCHEMA_VERSIONS = [1];
export const ASSIGNMENT_STATUSES = ['active', 'completed', 'cancelled', 'expired'];

/**
 * Validate an assignment record.
 * Returns a list of { field, reason } errors; an empty list means the record satisfies the contract.
 */
export function validateAssignmentRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  // Required field: id
  if (!isText(record.id) || !ID_PATTERN.test(record.id)) {
    fail('id', 'is required and must be a lowercase slug such as "assign-vol-123"');
  }

  // Required field: volunteerId - the ID of the assigned volunteer
  if (!isText(record.volunteerId) || !ID_PATTERN.test(record.volunteerId)) {
    fail('volunteerId', 'is required and must be a lowercase slug');
  }

  // Required field: taskId - the ID of the assigned task
  if (!isText(record.taskId) || !ID_PATTERN.test(record.taskId)) {
    fail('taskId', 'is required and must be a lowercase slug');
  }

  // Required field: assignedBy - the ID of the coordinator who assigned this
  if (!isText(record.assignedBy) || !ID_PATTERN.test(record.assignedBy)) {
    fail('assignedBy', 'is required and must be a lowercase slug');
  }

  // Optional: status - active, completed, cancelled, expired
  if (record.status !== undefined) {
    const validStatuses = ASSIGNMENT_STATUSES;
    if (!validStatuses.includes(record.status)) {
      fail('status', `must be one of: ${validStatuses.join(', ')} when present`);
    }
  } else {
    // Default status is active
    record.status = 'active';
  }

  // Optional: assignedAt - when the assignment was created
  if (record.assignedAt !== undefined) {
    if (!isRealDate(record.assignedAt)) {
      fail('assignedAt', 'must be a real date in YYYY-MM-DD format when present');
    }
  }

  // Optional: completedAt - when the volunteer marked the task as completed
  if (record.completedAt !== undefined) {
    if (!isRealDate(record.completedAt)) {
      fail('completedAt', 'must be a real date in YYYY-MM-DD format when present');
    }
    // Validation: completedAt should be after assignedAt (checked at service layer)
  }

  // Optional: evidenceUrl - URL to completion evidence (photos, reports, etc.)
  if (record.evidenceUrl !== undefined) {
    if (!isText(record.evidenceUrl)) {
      fail('evidenceUrl', 'must be a string when present');
    }
  }

  // Optional: notes - coordinator notes about the assignment
  if (record.notes !== undefined) {
    if (!isText(record.notes)) {
      fail('notes', 'must be a string when present');
    }
  }

  // Optional: rating - volunteer rating for this task (0-5)
  if (record.rating !== undefined) {
    if (!(Number.isFinite(record.rating) && record.rating >= 0 && record.rating <= 5)) {
      fail('rating', 'must be a number from 0 to 5 when present');
    }
  }

  // Optional: accessibilityAccommodations
  if (record.accessibilityAccommodations !== undefined) {
    if (!isTextList(record.accessibilityAccommodations)) {
      fail('accessibilityAccommodations', 'must be an array of non-empty strings when present');
    }
  }

  // Metadata
  if (record.schemaVersion !== undefined) {
    if (record.schemaVersion !== ASSIGNMENT_SCHEMA_VERSION) {
      fail('schemaVersion', `must be ${ASSIGNMENT_SCHEMA_VERSION} when present; got ${record.schemaVersion}`);
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
export function applyAssignmentDefaults(record) {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? ASSIGNMENT_SCHEMA_VERSION,
    status: record.status ?? 'active',
  };
}

/**
 * Validate a whole assignment envelope: { schemaVersion, assignment }.
 * Returns { valid, errors }.
 */
export function validateAssignmentEnvelope(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (!SUPPORTED_ASSIGNMENT_SCHEMA_VERSIONS.includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: ${SUPPORTED_ASSIGNMENT_SCHEMA_VERSIONS.join(', ')}`,
    });
    return { valid: false, errors };
  }
  if (!envelope.assignment) {
    errors.push({ serviceId: null, field: 'assignment', reason: 'must be present' });
    return { valid: false, errors };
  }
  const serviceErrors = validateAssignmentRecord(envelope.assignment);
  serviceErrors.forEach((e) => { e.serviceId = envelope.assignment.id || 'unknown'; });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatAssignmentError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;