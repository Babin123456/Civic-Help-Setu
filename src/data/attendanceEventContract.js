// Attendance Event Contract (schema version 1)
// ---------------------------------------------
// Defines the schema for attendance_event records.
// When a volunteer checks in/out of a task.
// Full field reference: docs/ATTENDANCE_EVENT_DATA_CONTRACT.md
// This is a code-level contract for components and future integrations.
// NOT a deployed network API: nothing here is served over HTTP.

import { ID_PATTERN, isObject, isText, isNonEmptyText, isRealDate } from './serviceContract.js';

export const ATTENDANCE_EVENT_SCHEMA_VERSION = 1;
export const SUPPORTED_ATTENDANCE_EVENT_SCHEMA_VERSIONS = [1];
export const ATTENDANCE_MODES = ['check-in', 'check-out'];
export const ATTENDANCE_STATUSES = ['present', 'late', 'excused', 'absent'];

/**
 * Validate an attendance event record.
 * Returns a list of { field, reason } errors; an empty list means the record satisfies the contract.
 */
export function validateAttendanceEventRecord(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  // Required field: id
  if (!isText(record.id) || !ID_PATTERN.test(record.id)) {
    fail('id', 'is required and must be a lowercase slug such as "attend-vol-123"');
  }

  // Required field: assignmentId - the ID of the assignment this attendance is for
  if (!isText(record.assignmentId) || !ID_PATTERN.test(record.assignmentId)) {
    fail('assignmentId', 'is required and must be a lowercase slug');
  }

  // Required field: volunteerId - the ID of the volunteer
  if (!isText(record.volunteerId) || !ID_PATTERN.test(record.volunteerId)) {
    fail('volunteerId', 'is required and must be a lowercase slug');
  }

  // Required field: taskId - the ID of the task
  if (!isText(record.taskId) || !ID_PATTERN.test(record.taskId)) {
    fail('taskId', 'is required and must be a lowercase slug');
  }

  // Required field: mode - check-in or check-out
  if (record.mode !== undefined) {
    const validModes = ATTENDANCE_MODES;
    if (!validModes.includes(record.mode)) {
      fail('mode', `must be one of: ${validModes.join(', ')} when present`);
    }
  } else {
    // Default mode is check-in
    record.mode = 'check-in';
  }

  // Required field: timestamp - when the check-in/check-out occurred
  if (!record.timestamp || !isRealDate(record.timestamp.toString ? record.timestamp.toString() : String(record.timestamp))) {
    fail('timestamp', 'must be a real date in YYYY-MM-DD format or ISO string');
  }

  // Optional: status - present, late, excused, absent
  if (record.status !== undefined) {
    const validStatuses = ATTENDANCE_STATUSES;
    if (!validStatuses.includes(record.status)) {
      fail('status', `must be one of: ${validStatuses.join(', ')} when present`);
    }
  }

  // Optional: notes - coordinator or volunteer notes
  if (record.notes !== undefined) {
    if (!isText(record.notes)) {
      fail('notes', 'must be a string when present');
    }
  }

  // Optional: location - check-in location (optional, for GPS-verified check-ins)
  if (record.location !== undefined) {
    if (!isObject(record.location)) {
      fail('location', 'must be a { latitude, longitude } object when present');
    } else {
      if (record.location.latitude !== undefined && (typeof record.location.latitude !== 'number' || Math.abs(record.location.latitude) > 90)) {
        fail('location.latitude', 'must be a number between -90 and 90 when present');
      }
      if (record.location.longitude !== undefined && (typeof record.location.longitude !== 'number' || Math.abs(record.location.longitude) > 180)) {
        fail('location.longitude', 'must be a number between -180 and 180 when present');
      }
    }
  }

  // Optional: deviceId - the ID of the device used for check-in
  if (record.deviceId !== undefined) {
    if (!isText(record.deviceId)) {
      fail('deviceId', 'must be a non-empty string when present');
    }
  }

  // Metadata
  if (record.schemaVersion !== undefined) {
    if (record.schemaVersion !== ATTENDANCE_EVENT_SCHEMA_VERSION) {
      fail('schemaVersion', `must be ${ATTENDANCE_EVENT_SCHEMA_VERSION} when present; got ${record.schemaVersion}`);
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
export function applyAttendanceEventDefaults(record) {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? ATTENDANCE_EVENT_SCHEMA_VERSION,
    mode: record.mode ?? 'check-in',
    status: record.status ?? 'present',
  };
}

/**
 * Validate a whole attendance event envelope: { schemaVersion, attendanceEvent }.
 * Returns { valid, errors }.
 */
export function validateAttendanceEventEnvelope(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (!SUPPORTED_ATTENDANCE_EVENT_SCHEMA_VERSIONS.includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: ${SUPPORTED_ATTENDANCE_EVENT_SCHEMA_VERSIONS.join(', ')}`,
    });
    return { valid: false, errors };
  }
  if (!envelope.attendanceEvent) {
    errors.push({ serviceId: null, field: 'attendanceEvent', reason: 'must be present' });
    return { valid: false, errors };
  }
  const serviceErrors = validateAttendanceEventRecord(envelope.attendanceEvent);
  serviceErrors.forEach((e) => { e.serviceId = envelope.attendanceEvent.id || 'unknown'; });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatAttendanceEventError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;