// Assignment Service
// -----------------
// Provides operations for assignment records.
// A volunteer is assigned to a task after application acceptance.
// Volunteers check in/out via attendance events.

import {
  ASSIGNMENT_SCHEMA_VERSION,
  SUPPORTED_ASSIGNMENT_SCHEMA_VERSIONS,
  ASSIGNMENT_STATUSES,
  validateAssignmentRecord,
  validateAssignmentEnvelope,
  applyAssignmentDefaults,
  formatAssignmentError,
} from '../data/assignmentContract.js';

// In-memory storage
const assignments = new Map();

// Audit trail
const auditLog = [];
const AUDIT_MAX_ENTRIES = 1000;

function generateId(prefix = 'assign') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

function ensureDefaults(record) {
  return applyAssignmentDefaults({
    ...record,
    schemaVersion: record.schemaVersion ?? ASSIGNMENT_SCHEMA_VERSION,
    createdAt: record.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  });
}

/**
 * Create a new assignment.
 * Typically called by a coordinator after accepting a task application.
 * @param {Object} assignment - The assignment data
 * @param {Object} [options] - Optional { createdBy }
 * @returns {Object} The created assignment with generated IDs/timestamps
 * @throws {Error} If validation fails
 */
export function createAssignment(assignment, options = {}) {
  const prepared = ensureDefaults(assignment);

  // Validate the full envelope
  const envelope = { schemaVersion: ASSIGNMENT_SCHEMA_VERSION, assignment: prepared };
  const validation = validateAssignmentEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatAssignmentError).join('; ');
    throw new Error(`Assignment validation failed: ${errors}`);
  }

  // Check that the volunteer and task exist
  // In a full implementation, we'd validate against the profile and task services
  if (!prepared.volunteerId) {
    throw new Error('Assignment must have a volunteerId');
  }
  if (!prepared.taskId) {
    throw new Error('Assignment must have a taskId');
  }

  prepared.id = prepared.id || generateId();
  prepared.assignedAt = new Date().toISOString().split('T')[0];
  prepared.updatedAt = new Date().toISOString().split('T')[0];

  assignments.set(prepared.id, prepared);

  // Append audit event
  appendAudit({
    action: 'create',
    resource: 'assignment',
    resourceId: prepared.id,
    performedBy: options.createdBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Assignment created',
  });

  return prepared;
}

/**
 * Read an assignment by ID.
 * @param {string} assignmentId - The assignment ID
 * @returns {Object|null} The assignment or null if not found
 */
export function readAssignment(assignmentId) {
  return assignments.get(assignmentId) || null;
}

/**
 * Update an assignment (e.g., mark as completed, add notes).
 * @param {string} assignmentId - The assignment ID
 * @param {Object} updates - The fields to update
 * @param {Object} [options] - UpdatedBy
 * @returns {Object|undefined} The updated assignment, or undefined if not found
 * @throws {Error} If validation fails
 */
export function updateAssignment(assignmentId, updates, options = {}) {
  const existing = assignments.get(assignmentId);
  if (!existing) {
    throw new Error(`Assignment ${assignmentId} not found`);
  }

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString().split('T')[0],
  };

  // Validate the full envelope
  const envelope = { schemaVersion: ASSIGNMENT_SCHEMA_VERSION, assignment: updated };
  const validation = validateAssignmentEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatAssignmentError).join('; ');
    throw new Error(`Assignment update validation failed: ${errors}`);
  }

  // If marking as completed, set completedAt timestamp
  if (updated.status === 'completed' && !updated.completedAt) {
    updated.completedAt = new Date().toISOString().split('T')[0];
  }

  assignments.set(assignmentId, updated);

  // Append audit event
  appendAudit({
    action: 'update',
    resource: 'assignment',
    resourceId: assignmentId,
    performedBy: options.updatedBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Assignment updated',
    overrideReason: updated.notes,
  });

  return updated;
}

/**
 * Cancel an assignment.
 * @param {string} assignmentId - The assignment ID
 * @param {Object} [options] - { cancelledBy, reason }
 * @returns {Object|undefined} The updated assignment, or undefined if not found
 * @throws {Error} If the assignment is already in a terminal state
 */
export function cancelAssignment(assignmentId, options = {}) {
  const existing = assignments.get(assignmentId);
  if (!existing) {
    throw new Error(`Assignment ${assignmentId} not found`);
  }

  // Cannot cancel a completed assignment
  if (existing.status === 'completed') {
    throw new Error(`Cannot cancel completed assignment ${assignmentId}`);
  }

  const updated = {
    ...existing,
    status: 'cancelled',
    updatedAt: new Date().toISOString().split('T')[0],
  };

  // Add cancellation reason if provided
  if (options.reason) {
    updated.notes = `${existing.notes || ''} | Cancelled: ${options.reason}`.trim();
  }

  assignments.set(assignmentId, updated);

  // Append audit event
  appendAudit({
    action: 'update',
    resource: 'assignment',
    resourceId: assignmentId,
    performedBy: options.cancelledBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Assignment cancelled',
  });

  return updated;
}

/**
 * List assignments with filters.
 * @param {Object} filters - Optional filters { volunteerId, taskId, status, assignedBy }
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=20] - Page size
 * @returns {Object} { assignments, total, page, pageSize }
 */
export function listAssignments(filters = {}, page = 1, pageSize = 20) {
  const { volunteerId, taskId, status, assignedBy } = filters;
  let results = Array.from(assignments.values());

  // Apply filters
  if (volunteerId) {
    results = results.filter((a) => a.volunteerId === volunteerId);
  }
  if (taskId) {
    results = results.filter((a) => a.taskId === taskId);
  }
  if (status) {
    results = results.filter((a) => a.status === status);
  }
  if (assignedBy) {
    results = results.filter((a) => a.assignedBy === assignedBy);
  }

  // Sort by assignedAt descending
  results.sort((a, b) => (b.assignedAt || '').localeCompare(a.assignedAt || ''));

  // Paginate
  const total = results.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageResults = results.slice(start, end);

  return {
    assignments: pageResults,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Append an audit event to the append-only audit log.
 * @param {Object} event - The audit event
 */
function appendAudit(event) {
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    ...event,
  };
  auditLog.push(entry);
  if (auditLog.length > AUDIT_MAX_ENTRIES) {
    auditLog.shift();
  }
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
export { assignments, auditLog };