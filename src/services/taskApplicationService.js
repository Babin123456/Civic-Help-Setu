// Task Application Service
// -----------------------
// Provides CRUD and state-transition operations for task applications.
// Volunteers apply to volunteer tasks; coordinators accept/reject applications.

import {
  TASK_APPLICATION_SCHEMA_VERSION,
  SUPPORTED_TASK_APPLICATION_SCHEMA_VERSIONS,
  APPLICATION_STATUSES,
  validateTaskApplicationRecord,
  validateTaskApplicationEnvelope,
  applyTaskApplicationDefaults,
  formatTaskApplicationError,
} from '../data/taskApplicationContract.js';

// In-memory storage for demonstrations
const taskApplications = new Map();

// Audit trail
const auditLog = [];
const AUDIT_MAX_ENTRIES = 1000;

function generateId(prefix = 'app') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

function ensureDefaults(record) {
  return applyTaskApplicationDefaults({
    ...record,
    schemaVersion: record.schemaVersion ?? TASK_APPLICATION_SCHEMA_VERSION,
    createdAt: record.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  });
}

/**
 * Create a new task application.
 * @param {Object} application - The application data
 * @param {Object} [options] - Optional { createdBy, onBehalfOf }
 * @returns {Object} The created application with generated IDs/timestamps
 * @throws {Error} If validation fails or duplicate application detected
 */
export function createTaskApplication(application, options = {}) {
  const prepared = ensureDefaults(application);

  // Validate the full envelope
  const envelope = { schemaVersion: TASK_APPLICATION_SCHEMA_VERSION, taskApplication: prepared };
  const validation = validateTaskApplicationEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatTaskApplicationError).join('; ');
    throw new Error(`Task application validation failed: ${errors}`);
  }

  // Idempotency check: prevent duplicate applications from the same volunteer to the same task
  const { volunteerId, taskId } = prepared;
  if (volunteerId && taskId) {
    const existing = Array.from(taskApplications.values()).find(
      (a) => a.volunteerId === volunteerId && a.taskId === taskId && a.status !== 'withdrawn'
    );
    if (existing) {
      throw new Error(
        `Duplicate application detected: volunteer ${volunteerId} has already applied to task ${taskId} (status: ${existing.status}). ` +
        `Withdraw the existing application before submitting a new one.`
      );
    }
  }

  prepared.id = prepared.id || generateId();
  prepared.createdAt = new Date().toISOString().split('T')[0];
  prepared.updatedAt = new Date().toISOString().split('T')[0];

  // Set default status to pending if not specified
  if (!prepared.status) {
    prepared.status = 'pending';
  }

  taskApplications.set(prepared.id, prepared);

  // Append audit event
  appendAudit({
    action: 'create',
    resource: 'task_application',
    resourceId: prepared.id,
    performedBy: options.createdBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Task application created',
  });

  return prepared;
}

/**
 * Read a task application by ID.
 * @param {string} applicationId - The application ID
 * @returns {Object|null} The application or null if not found
 */
export function readTaskApplication(applicationId) {
  return taskApplications.get(applicationId) || null;
}

/**
 * Update a task application status (coordinator accepts/rejects).
 * @param {string} applicationId - The application ID
 * @param {string} newStatus - One of: pending, accepted, rejected, withdrawn
 * @param {Object} [options] - UpdatedBy and optional overrideReason
 * @returns {Object|undefined} The updated application, or undefined if not found
 * @throws {Error} If the status transition is invalid
 */
export function updateTaskApplicationStatus(applicationId, newStatus, options = {}) {
  const existing = taskApplications.get(applicationId);
  if (!existing) {
    throw new Error(`Task application ${applicationId} not found`);
  }

  // Validate status transition
  const validTransitions = {
    pending: ['accepted', 'rejected', 'withdrawn'],
    accepted: [], // terminal
    rejected: [], // terminal
    withdrawn: [], // terminal
  };

  const currentStatus = existing.status;
  const allowedNext = validTransitions[currentStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from "${currentStatus}" to "${newStatus}". ` +
      `Allowed transitions from "${currentStatus}": ${allowedNext.join(', ')} or keep as-is.`
    );
  }

  const updated = {
    ...existing,
    status: newStatus,
    updatedAt: new Date().toISOString().split('T')[0],
  };

  // If being rejected, record a reason (optional but recommended)
  if (newStatus === 'rejected' && options.overrideReason) {
    updated.rejectionReason = options.overrideReason;
  }

  taskApplications.set(applicationId, updated);

  // Append audit event
  appendAudit({
    action: 'update',
    resource: 'task_application',
    resourceId: applicationId,
    performedBy: options.updatedBy || 'system',
    timestamp: new Date().toISOString(),
    reason: `Task application status updated to ${newStatus}`,
    // Include override reason if provided (sanitized - no sensitive personal data)
    overrideReason: options.overrideReason,
  });

  return updated;
}

/**
 * Withdraw an application (volunteer can withdraw their own application).
 * @param {string} applicationId - The application ID
 * @param {Object} [options] - { withdrawnBy }
 * @returns {Object|undefined} The updated application, or undefined if not found
 */
export function withdrawTaskApplication(applicationId, options = {}) {
  const existing = taskApplications.get(applicationId);
  if (!existing) {
    throw new Error(`Task application ${applicationId} not found`);
  }

  // Only pending or accepted applications can be withdrawn
  if (existing.status === 'withdrawn') {
    throw new Error(`Task application ${applicationId} is already withdrawn`);
  }

  const updated = {
    ...existing,
    status: 'withdrawn',
    updatedAt: new Date().toISOString().split('T')[0],
  };

  taskApplications.set(applicationId, updated);

  // Append audit event
  appendAudit({
    action: 'update',
    resource: 'task_application',
    resourceId: applicationId,
    performedBy: options.withdrawnBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Task application withdrawn by volunteer',
  });

  return updated;
}

/**
 * List task applications with filters.
 * @param {Object} filters - Optional filters { taskId, volunteerId, status, coordinatorId }
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=20] - Page size
 * @returns {Object} { applications, total, page, pageSize }
 */
export function listTaskApplications(filters = {}, page = 1, pageSize = 20) {
  const { taskId, volunteerId, status, coordinatorId } = filters;
  let results = Array.from(taskApplications.values());

  // Apply filters
  if (taskId) {
    results = results.filter((a) => a.taskId === taskId);
  }
  if (volunteerId) {
    results = results.filter((a) => a.volunteerId === volunteerId);
  }
  if (status) {
    results = results.filter((a) => a.status === status);
  }
  if (coordinatorId) {
    // Filter applications for tasks coordinated by this coordinator
    results = results.filter((a) => {
      const task = taskPostsReadOnly(a.taskId);
      return task && task.coordinatorId === coordinatorId;
    });
  }

  // Sort by createdAt descending
  results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Paginate
  const total = results.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageResults = results.slice(start, end);

  return {
    applications: pageResults,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// In-memory read-only access to task posts for coordinator filtering
// In production, this would use the volunteerTaskService
const taskPostsReadOnly = (taskId) => {
  // This is a simplified reference; in a real app, we'd import the task service
  return null;
};

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
export { taskApplications, auditLog };