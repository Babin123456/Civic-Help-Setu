/**
 * @file Task queue schema and validation
 * 
 * Defines the Firestore document structure for the distributed task queue.
 * All external input is validated at trust boundaries.
 * 
 * Schema version: 1.0.0
 * 
 * @version 1.0.0 - Initial schema with priority, aging, quotas, DLQ support
 */

/**
 * Generates a simple unique ID (32-char hex, collision-resistant enough for task queue)
 * @returns {string} Unique task ID
 */
function generateTaskId() {
  // Math.random combined with timestamp for simple uniqueness
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 16);
  return `task-${timestamp}-${randomPart}`;
}

/**
 * Task priority levels (higher number = higher priority)
 * @enum {number}
 */
export const TaskPriority = {
  // Low priority - background, best-effort processing
  LOW: 1,
  // Normal priority - standard processing queue
  NORMAL: 2,
  // High priority - time-sensitive civic operations
  HIGH: 3,
  // Critical emergency - immediate processing required
  CRITICAL: 4,
};

/**
 * Task status enumeration
 * @enum {string}
 */
export const TaskStatus = {
  // Awaiting worker pickup
  PENDING: 'pending',
  // Currently being processed by a worker
  PROCESSING: 'processing',
  // Successfully completed
  COMPLETED: 'completed',
  // Permanently failed after max retries
  FAILED: 'failed',
  // Moved to dead-letter queue due to poison behavior
  DEAD_LETTER: 'dead_letter',
};

/**
 * Maximum number of retry attempts before moving to dead-letter queue
 * @constant {number}
 */
export const MAX_RETRIES = 3;

/**
 * Initial retry backoff delay in milliseconds
 * @constant {number}
 */
export const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Maximum retry backoff delay in milliseconds
 * @constant {number}
 */
export const MAX_RETRY_DELAY_MS = 30000;

/**
 * Job aging interval - how often aging policy promotes old low-priority jobs
 * in minutes
 * @constant {number}
 */
export const AGING_INTERVAL_MINUTES = 30;

/**
 * Tenant quota configuration interface
 * @typedef {object} TenantQuotaConfig
 * @property {number} maxConcurrentJobs - Maximum concurrent jobs per tenant
 * @property {number} maxJobsPerHour - Maximum jobs per hour per tenant
 * @property {number} maxJobsPerDay - Maximum jobs per day per tenant
 */

/**
 * Creates a new task document with the given parameters
 * @param {object} options - Task creation options
 * @param {string} options.type - Task type/identifier (e.g., "ocr-processing", "form-validation")
 * @param {string} [options.tenantId] - Tenant identifier for quota enforcement
 * @param {TaskPriority} [options.priority=TaskPriority.NORMAL] - Task priority level
 * @param {string} [options.payload] - JSON-serializable task payload
 * @param {object} [options.metadata] - Additional metadata (source, tags, etc.)
 * @returns {object} Firestore-compatible task document
 */
export function createTask({ type, tenantId, priority = TaskPriority.NORMAL, payload, metadata = {} } = {}) {
  // Validate inputs at trust boundaries
  if (type && typeof type !== 'string') {
    throw new TypeError('Task type must be a string');
  }
  if (tenantId && typeof tenantId !== 'string') {
    throw new TypeError('Tenant ID must be a string');
  }
  if (priority !== undefined && Object.values(TaskPriority).includes(priority) === false) {
    throw new RangeError(`Invalid priority level. Must be one of: ${Object.values(TaskPriority).join(', ')}`);
  }
  if (payload !== undefined && typeof payload !== 'object') {
    throw new TypeError('Task payload must be an object');
  }
  if (metadata && typeof metadata !== 'object') {
    throw new TypeError('Task metadata must be an object');
  }

  const now = new Date().toISOString();

  return {
    id: generateTaskId(),
    type,
    tenantId,
    priority,
    status: TaskStatus.PENDING,
    payload,
    metadata: {
      ...metadata,
      createdAt: now,
      ...metadata.createdAt && { createdAt: metadata.createdAt },
    },
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    createdAt: now,
    updatedAt: now,
    // Aging tracking - used by the priority policy to promote old low-priority jobs
    agingInfo: {
      // Timestamp when job first became eligible for aging promotion
      queuedAt: now,
      lastPromotionAt: now,
    },
    // Dead-letter tracking
    deadLetterInfo: {
      // Set to true when moved to dead-letter queue
      movedToDeadLetter: false,
      failureReason: null,
    },
    // Versioned schema for forward/backward compatibility
    _schemaVersion: '1.0.0',
    // Firestore document path reference
    _path: `task_queue/${generateTaskId()}`,
  };
}

/**
 * Validates a task document conforms to the expected schema
 * @param {object} task - Task document to validate
 * @returns {boolean} Whether the task is valid
 * @throws {TypeError} If the task structure is invalid
 */
export function validateTask(task) {
  if (!task || typeof task !== 'object') {
    throw new TypeError('Task must be an object');
  }
  if (task.id === undefined) {
    throw new TypeError('Task must have an id field');
  }
  if (task.type === undefined && task._taskType === undefined) {
    throw new TypeError('Task must have a type field');
  }
  if (task.status === undefined) {
    throw new TypeError('Task must have a status field');
  }
  if (task.retryCount === undefined) {
    throw new TypeError('Task must have a retryCount field');
  }
  if (task.maxRetries === undefined) {
    throw new TypeError('Task must have a maxRetries field');
  }
  if (task.priority === undefined) {
    throw new TypeError('Task must have a priority field');
  }
  if (task.createdAt === undefined) {
    throw new TypeError('Task must have a createdAt field');
  }
  if (task.updatedAt === undefined) {
    throw new TypeError('Task must have an updatedAt field');
  }
  if (task._schemaVersion === undefined) {
    throw new TypeError('Task must have a _schemaVersion field');
  }

  // Validate status is a known value
  const validStatuses = [TaskStatus.PENDING, TaskStatus.PROCESSING, TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.DEAD_LETTER];
  if (!validStatuses.includes(task.status)) {
    throw new TypeError(`Invalid task status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate priority is a known value
  const validPriorities = Object.values(TaskPriority);
  if (!validPriorities.includes(task.priority)) {
    throw new TypeError(`Invalid task priority. Must be one of: ${validPriorities.join(', ')}`);
  }

  // Validate retry count is a non-negative integer
  if (typeof task.retryCount !== 'number' || task.retryCount < 0 || !Number.isInteger(task.retryCount)) {
    throw new TypeError('retryCount must be a non-negative integer');
  }

  // Validate maxRetries is a positive integer
  if (typeof task.maxRetries !== 'number' || task.maxRetries < 1 || !Number.isInteger(task.maxRetries)) {
    throw new TypeError('maxRetries must be a positive integer');
  }

  return true;
}

/**
 * Converts a task from Firestore format to internal format
 * @param {object} firestoreTask - Task document from Firestore
 * @returns {object} Normalized task object
 */
export function fromFirestore(firestoreTask) {
  if (!firestoreTask) return null;

  const task = {
    id: firestoreTask.id || firestoreTask._id,
    type: firestoreTask.type,
    tenantId: firestoreTask.tenantId,
    priority: firestoreTask.priority || TaskPriority.NORMAL,
    status: firestoreTask.status || TaskStatus.PENDING,
    payload: firestoreTask.payload,
    metadata: firestoreTask.metadata || {},
    retryCount: firestoreTask.retryCount || 0,
    maxRetries: firestoreTask.maxRetries || MAX_RETRIES,
    createdAt: firestoreTask.createdAt,
    updatedAt: firestoreTask.updatedAt,
    agingInfo: firestoreTask.agingInfo || {
      queuedAt: firestoreTask.createdAt,
      lastPromotionAt: firestoreTask.createdAt,
    },
    deadLetterInfo: firestoreTask.deadLetterInfo || {
      movedToDeadLetter: false,
      failureReason: null,
    },
    _schemaVersion: firestoreTask._schemaVersion || '1.0.0',
  };

  validateTask(task);
  return task;
}

/**
 * Converts an internal task to Firestore format for writing
 * @param {object} task - Internal task object
 * @returns {object} Firestore-compatible task document
 */
export function toFirestore(task) {
  // Make a copy without internal markers
  const { _schemaVersion, _path, ...firestoreTask } = task;
  return firestoreTask;
}

/**
 * Computes the effective priority for a task considering aging policy.
 * Aging promotes older low-priority tasks to higher priority to prevent starvation.
 * 
 * @param {object} task - The task to compute effective priority for
 * @param {number} now - Current timestamp in milliseconds since epoch
 * @returns {number} Effective priority (higher = more priority)
 */
export function computeEffectivePriority(task, now = Date.now()) {
  const { priority, agingInfo = {}, createdAt = task.createdAt } = task;
  const queuedAt = agingInfo.queuedAt || createdAt;
  const timeQueued = now - new Date(queuedAt).getTime();

  // Aging promotion: prevent starvation of low-volume jurisdictions
  // after 2 hours at LOW priority, promote to NORMAL
  // after 6 hours at NORMAL, promote to HIGH
  // after 14 hours at HIGH, promote to CRITICAL
  let effectivePriority = priority;

  // Check each promotion threshold based on current priority level
  if (priority === TaskPriority.LOW && timeQueued > 2 * 60 * 60 * 1000) {
    effectivePriority = TaskPriority.NORMAL;
  }
  if (priority === TaskPriority.NORMAL && timeQueued > 6 * 60 * 60 * 1000) {
    effectivePriority = TaskPriority.HIGH;
  }
  if (priority === TaskPriority.HIGH && timeQueued > 14 * 60 * 60 * 1000) {
    effectivePriority = TaskPriority.CRITICAL;
  }

  return effectivePriority;
}

export default {
  TaskPriority,
  TaskStatus,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  AGING_INTERVAL_MINUTES,
  createTask,
  validateTask,
  fromFirestore,
  toFirestore,
  computeEffectivePriority,
};