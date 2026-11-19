// Volunteer Task Service
// ---------------------
// Provides CRUD and state-transition operations for volunteer task posts.
// Published by coordinators; citizens can apply to these tasks.
// Enforces schema validation, jurisdiction scoping, and applicant limits.

import {
  VOLUNTEER_TASK_SCHEMA_VERSION,
  SUPPORTED_VOLUNTEER_TASK_SCHEMA_VERSIONS,
  TASK_PUBLICATION_STATES,
  TASK_PRIORITY_LEVELS,
  validateVolunteerTaskRecord,
  validateVolunteerTaskEnvelope,
  applyVolunteerTaskDefaults,
  formatVolunteerTaskError,
} from '../data/volunteerTaskContract.js';

// In-memory storage for demonstration
const taskPosts = new Map();

// Audit trail
const auditLog = [];
const AUDIT_MAX_ENTRIES = 1000;

function generateId(prefix = 'task') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

function ensureDefaults(record) {
  return applyVolunteerTaskDefaults({
    ...record,
    schemaVersion: record.schemaVersion ?? VOLUNTEER_TASK_SCHEMA_VERSION,
    createdAt: record.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  });
}

/**
 * Create a new volunteer task post.
 * @param {Object} task - The task data
 * @param {Object} [options] - Optional { createdBy }
 * @returns {Object} The created task with generated IDs/timestamps
 * @throws {Error} If validation fails
 */
export function createVolunteerTask(task, options = {}) {
  const prepared = ensureDefaults(task);

  // Validate the full envelope
  const envelope = { schemaVersion: VOLUNTEER_TASK_SCHEMA_VERSION, volunteerTask: prepared };
  const validation = validateVolunteerTaskEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatVolunteerTaskError).join('; ');
    throw new Error(`Volunteer task validation failed: ${errors}`);
  }

  // Check for duplicate ID
  if (taskPosts.has(prepared.id)) {
    throw new Error(`Volunteer task with id ${prepared.id} already exists`);
  }

  // Set coordinatorId if not provided (derive from options or default)
  prepared.coordinatorId = prepared.coordinatorId || options.createdBy || 'system';

  prepared.id = prepared.id || generateId();
  prepared.createdAt = new Date().toISOString().split('T')[0];
  prepared.updatedAt = new Date().toISOString().split('T')[0];

  taskPosts.set(prepared.id, prepared);

  // Append audit event
  appendAudit({
    action: 'create',
    resource: 'volunteer_task',
    resourceId: prepared.id,
    performedBy: options.createdBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Volunteer task created',
  });

  return prepared;
}

/**
 * Read a volunteer task by ID.
 * @param {string} taskId - The task ID
 * @returns {Object|null} The task or null if not found
 */
export function readVolunteerTask(taskId) {
  return taskPosts.get(taskId) || null;
}

/**
 * Update an existing volunteer task.
 * @param {string} taskId - The task ID
 * @param {Object} updates - The fields to update
 * @param {Object} [options] - Optional { updatedBy }
 * @returns {Object|undefined} The updated task, or undefined if not found
 * @throws {Error} If validation fails
 */
export function updateVolunteerTask(taskId, updates, options = {}) {
  const existing = taskPosts.get(taskId);
  if (!existing) {
    throw new Error(`Volunteer task ${taskId} not found`);
  }

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString().split('T')[0],
  };

  // Validate the full envelope
  const envelope = { schemaVersion: VOLUNTEER_TASK_SCHEMA_VERSION, volunteerTask: updated };
  const validation = validateVolunteerTaskEnvelope(envelope);
  if (!validation.valid) {
    const errors = validation.errors.map(formatVolunteerTaskError).join('; ');
    throw new Error(`Volunteer task update validation failed: ${errors}`);
  }

  updated.updatedAt = new Date().toISOString().split('T')[0];
  taskPosts.set(taskId, updated);

  // Append audit event
  appendAudit({
    action: 'update',
    resource: 'volunteer_task',
    resourceId: taskId,
    performedBy: options.updatedBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Volunteer task updated',
  });

  return updated;
}

/**
 * Delete (archive) a volunteer task.
 * @param {string} taskId - The task ID
 * @param {Object} [options] - Options
 * @returns {boolean} true if archived, false if not found
 * @throws {Error} If the task has active applications and cannot be archived
 */
export function deleteVolunteerTask(taskId, options = {}) {
  const existing = taskPosts.get(taskId);
  if (!existing) {
    return false;
  }

  // Check for active applications - tasks with pending applications cannot be archived
  // In a full implementation, we'd check the application service
  // For now, allow archival if not in 'published' state with active applicants

  const status = existing.publicationState;
  if (status === 'published') {
    throw new Error(`Cannot archive task ${taskId} with publicationState='published'; must first withdraw or complete the task`);
  }

  taskPosts.delete(taskId);

  // Append audit event
  appendAudit({
    action: 'archive',
    resource: 'volunteer_task',
    resourceId: taskId,
    performedBy: options.updatedBy || 'system',
    timestamp: new Date().toISOString(),
    reason: 'Volunteer task archived',
  });

  return true;
}

/**
 * List volunteer tasks with filters.
 * @param {Object} filters - Optional filters { state, priority, coordinatorId, serviceAreaId, publicationStatus, isPublished }
 * @param {number} [page=1] - Page number
 * @param {number} [pageSize=20] - Page size
 * @returns {Object} { tasks, total, page, pageSize }
 */
export function listVolunteerTasks(filters = {}, page = 1, pageSize = 20) {
  const { state, priority, coordinatorId, serviceAreaId, publicationStatus, isPublished } = filters;
  let results = Array.from(taskPosts.values());

  // Apply filters
  if (state) {
    results = results.filter((t) => t.stateJurisdiction && t.stateJurisdiction.includes(state));
  }
  if (priority) {
    results = results.filter((t) => t.priority === priority);
  }
  if (coordinatorId) {
    results = results.filter((t) => t.coordinatorId === coordinatorId);
  }
  if (serviceAreaId) {
    results = results.filter((t) => t.serviceAreaId === serviceAreaId);
  }
  if (publicationStatus) {
    results = results.filter((t) => t.publicationState === publicationStatus);
  }
  if (isPublished !== undefined) {
    results = results.filter((t) => t.publicationState === (isPublished ? 'published' : 'draft'));
  }

  // Sort by createdAt descending
  results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Paginate
  const total = results.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageResults = results.slice(start, end);

  return {
    tasks: pageResults,
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

// Export the storage for testing purposes
export { taskPosts, auditLog };