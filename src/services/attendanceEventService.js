// Attendance Event Service
// -----------------------
// Provides operations for attendance event records.
// Volunteers check in/out of tasks via attendance events.

import {
  ATTENDANCE_EVENT_SCHEMA_VERSION,
  SUPPORTED_ATTENDANCE_EVENT_SCHEMA_VERSIONS,
  ATTENDANCE_MODES,
  ATTENDANCE_STATUSES,
  validateAttendanceEventRecord,
  validateAttendanceEventEnvelope,
  applyAttendanceEventDefaults,
  formatAttendanceEventError,
} from '../data/attendanceEventContract.js';

// In-memory storage
const attendanceEvents = new Map();

// Audit trail
const auditLog = [];
const AUDIT_MAX_ENTRIES = 1000;

function generateId(prefix = 'attend') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

function ensureDefaults(record) {
  return applyAttendanceEventDefaults({
    ...record,
    schemaVersion: record.schemaVersion ?? ATTENDANCE_EVENT_SCHEMA_VERSION,
    createdAt: record.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  });
}

/**
 * Create a new attendance event.
 * Typically called when a volunteer checks in or out of an assignment.
 * @param {Object} event - The attendance event data
 * @param {Object} [options] - Optional { createdBy }
 * @returns {Object} The created attendance event
 * @throws {Error} If validation fails
 */
export function createAttendanceEvent(event, options = {}) {
  const prepared = ensureDefaults(event);

  // Validate the full envelope
  const envelope = { schemaVersion: ATTENDANCE_EVENT_SCHEMA_VERSION, attendanceEvent: prepared };
  const validation = validateAttendanceEventEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatAttendanceEventError).join('; ');
    throw new Error(`Attendance event validation failed: ${errors}`);
  }

  // Check that required fields are present
  if (!prepared.assignmentId) {
    throw new Error('Attendance event must have an assignmentId');
 }
  if (!prepared.volunteerId) {
    throw new Error('Attendance event must have a volunteerId');
  }
  if (!prepared.taskId) {
    throw new Error('Attendance event must have a taskId');
  }
  if (!prepared.mode || !ATTENDANCE_MODES.includes(prepared.mode)) {
    throw new Error(`Mode must be one of: ${ATTENDANCE_MODES.join(', ')}`);
  }

  prepared.id = prepared.id || generateId();
  prepared.createdAt = new Date().toISOString().split('T')[0];
  prepared.updatedAt = new Date().toISOString().split('T')[0];

  attendanceEvents.set(prepared.id, prepared);

  // Append audit event
  appendAudit({
    action: 'create',
    resource: 'attendance_event',
    resourceId: prepared.id,
    performedBy: options.createdBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Attendance event created',
  });

  return prepared;
}

/**
 * Read an attendance event by ID.
 * @param {string} eventId - The event ID
 * @returns {Object|null} The event or null if not found
 */
export function readAttendanceEvent(eventId) {
  return attendanceEvents.get(eventId) || null;
}

/**
 * List attendance events with filters.
 * @param {Object} filters - Optional filters { assignmentId, volunteerId, taskId, mode }
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=20] - Page size
 * @returns {Object} { events, total, page, pageSize }
 */
export function listAttendanceEvents(filters = {}, page = 1, pageSize = 20) {
  const { assignmentId, volunteerId, taskId, mode } = filters;
  let results = Array.from(attendanceEvents.values());

  // Apply filters
  if (assignmentId) {
    results = results.filter((a) => a.assignmentId === assignmentId);
  }
  if (volunteerId) {
    results = results.filter((a) => a.volunteerId === volunteerId);
  }
  if (taskId) {
    results = results.filter((a) => a.taskId === taskId);
  }
  if (mode) {
    results = results.filter((a) => a.mode === mode);
  }

  // Sort by createdAt descending
  results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Paginate
  const total = results.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageResults = results.slice(start, end);

  return {
    events: pageResults,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get the audit log (read-only, append-only view).
 * @param {Object} [options] - Filter options { resource, resourceId, action, start, end }
 * @returns {Array} Audit events matching the filters
 */
export function getAuditLog(options = {}) {
  const { resource, resourceId, action, start, end } = options;
  let results = auditLog;

  if (resource) {
    results = results.filter((e) => e.resource === resource);
  }
  if (resourceId) {
    results = results.filter((e) => e.resourceId === resourceId);
  }
  if (action) {
    results = results.filter((e) => e.action === action);
  }
  if (start || end) {
    const startTime = start ? new Date(start).getTime() : 0;
    const endTime = end ? new Date(end).getTime() : Infinity;
    results = results.filter(
      (e) => new Date(e.timestamp).getTime() >= startTime && new Date(e.timestamp).getTime() <= endTime
    );
  }

  return results;
}

// Export the storage for testing
export { attendanceEvents, auditLog };