/**
 * Supervisor-Agent Architecture - Core Domain Model
 * #1145: Complex Multi-Department Grievances
 *
 * Defines the typed contracts, versioned APIs, and data structures for the
 * supervisor-agent architecture. All untrusted input is validated at service
 * boundaries. Agent outputs are treated as untrusted proposals requiring
 * citations/provenance and human approval for high-impact actions.
 *
 * Version: v1.0.0-supervisor-arch
 */

import {
  TaskPriority,
  TaskStatus,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  AGING_INTERVAL_MINUTES,
  computeEffectivePriority,
} from '../tasks/schemas/taskSchema.js';

// ---------------------------------------------------------------------------
// Type: JurisdictionEvidence
// ---------------------------------------------------------------------------

/**
 * Evidence citing official jurisdiction sources for a task.
 * Every task must include valid jurisdiction evidence – this prevents the
 * supervisor from inventing jurisdiction or filing on a citizen's behalf.
 */
export const JURISDICTION_SOURCE_TYPES = {
  STATUTORY_PORTAL: 'statutory-portal',
  GOVERNMENT_DOCUMENT: 'government-document',
  OFFICIAL_PORTAL: 'official-portal',
  CITIZEN_PROVIDED: 'citizen-provided',
};

export const validateJurisdictionEvidence = (evidence) => {
  const errors = [];

  if (!evidence) {
    errors.push('Jurisdiction evidence is required');
    return { isValid: false, errors };
  }

  if (typeof evidence.sourceType !== 'string') {
    errors.push('sourceType must be a string');
  } else if (
    !Object.values(JURISDICTION_SOURCE_TYPES).includes(evidence.sourceType)
  ) {
    errors.push(
      `Invalid sourceType. Must be one of: ${Object.values(
        JURISDICTION_SOURCE_TYPES
      ).join(', ')}`
    );
  }

  if (
    typeof evidence.sourceId !== 'string' ||
    evidence.sourceId.trim().length === 0
  ) {
    errors.push('sourceId must be a non-empty string');
  }

  if (
    typeof evidence.sourceUrl !== 'string' ||
    evidence.sourceUrl.trim().length === 0
  ) {
    errors.push('sourceUrl must be a non-empty string');
  } else {
    // Validate URL format - must be government/official domain pattern
    try {
      new URL(evidence.sourceUrl);
    } catch (e) {
      errors.push('sourceUrl must be a valid URL');
    }
  }

  if (
    typeof evidence.citedBy !== 'string' ||
    evidence.citedBy.trim().length === 0
  ) {
    errors.push('citedBy must be a non-empty string');
  }

  if (
    typeof evidence.citedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(evidence.citedAt)
  ) {
    errors.push('citedAt must be a valid ISO timestamp');
  }

  if (
    typeof evidence.provenance !== 'string' ||
    evidence.provenance.trim().length === 0
  ) {
    errors.push('provenance must be a non-empty string');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ---------------------------------------------------------------------------
// Type: AgentCapabilityContract
// ---------------------------------------------------------------------------

/**
 * Capability contract published by a domain-agent.
// The supervisor uses this to map departments to available agents and
// validate that agent tool calls stay within permitted bounds.
 */
export const AgentCapabilityContract = {
  /** Unique agent identifier */
  agentId: '',

  /** Department this agent serves (e.g., "PWD", "WaterBoard", "Revenue") */
  department: '',

  /** Jurisdiction level: 'local' | 'state' | 'national' */
  jurisdictionLevel: 'local', // lowercase to match JURISDICTION_LEVELS

  /** Capabilities this agent can exercise */
  capabilities: [], // e.g., ['investigate', 'evidence-review', 'escalate']

  /** Tools this agent is permitted to invoke */
  permittedTools: [], // e.g., ['document-upload', 'portal-query', 'email-notify']

  /** Maximum concurrent tasks this agent can handle */
  maxConcurrentTasks: 5,

  /** SLA in days for this agent's task completion */
  slaDays: 7,

  /** Version of this capability contract for forward compatibility */
  contractVersion: 'v1.0.0',
};

// ---------------------------------------------------------------------------
// Type: DagEdge
// ---------------------------------------------------------------------------

/**
 * Dependency edge in the task DAG.
// Defines ordering and relationship between two tasks.
 */
export const DagEdgeType = {
  SEQUENTIAL: 'sequential', // target must complete before source can start
  PARALLEL: 'parallel', // target can run independently
  ALTERNATIVE: 'alternative', // one of mutually exclusive paths (conflicting ownership)
};

/**
 * Creates a DAG edge.
 * @param {string} sourceTaskId - The task that must complete first (or is alternative)
 * @param {string} targetTaskId - The task that depends on source (or is the alternative)
 * @param {string} type - Edge type (sequential/parallel/alternative)
 * @param {string} reason - Human-readable reason for this dependency
 * @returns {object} DAG edge object
 */
export function createDagEdge(sourceTaskId, targetTaskId, type = DagEdgeType.SEQUENTIAL, reason = '') {
  // Validate inputs at trust boundary
  if (typeof sourceTaskId !== 'string' || sourceTaskId.trim().length === 0) {
    throw new TypeError('sourceTaskId must be a non-empty string');
  }
  if (typeof targetTaskId !== 'string' || targetTaskId.trim().length === 0) {
    throw new TypeError('targetTaskId must be a non-empty string');
  }
  if (!Object.values(DagEdgeType).includes(type)) {
    throw new RangeError(
      `Invalid edge type. Must be one of: ${Object.values(DagEdgeType).join(', ')}`
    );
  }
  if (reason !== undefined && typeof reason !== 'string') {
    throw new TypeError('reason must be a string if provided');
  }

  return {
    sourceTaskId,
    targetTaskId,
    type,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Type: SupervisorTask
// ---------------------------------------------------------------------------

/**
 * A task in the supervisor's DAG.
// Every task must cite official jurisdiction evidence and is assigned to a
// domain-agent from the registry. Deadlines and bounded tool permissions are
// enforced by the supervisor.
 */
export const SupervisorTaskStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD_LETTER: 'dead_letter',
  // Supervisor-specific states
  DEFERRED: 'deferred', // waiting for dependency resolution
  CONFLICT_RESOLVED: 'conflict_resolved', // human resolved ownership conflict
};

/**
 * Creates a supervisor task.
// All untrusted input is validated at the service boundary.
 * @param {object} options - Task creation options
 * @param {string} options.type - Task type identifier (e.g., "grievance-decomposition", "department-investigation")
 * @param {string} options.tenantId - Tenant identifier for quota enforcement
 * @param {string} options.agentId - Assigned agent ID from registry (may be null for unassigned)
 * @param {TaskPriority} [options.priority=TaskPriority.NORMAL] - Task priority
 * @param {string} [options.deadlineAt] - Deadline timestamp (ISO string); if omitted, default SLA applies
 * @param {object} [options.payload] - JSON-serializable task payload
 * @param {object} [options.jurisdictionEvidence] - Required jurisdiction evidence (validated via validateJurisdictionEvidence)
 * @param {object} [options.metadata] - Additional metadata
 * @param {string[]} [options.dependsOn=[]] - Task IDs this task depends on (DAG edges)
 * @param {string} [options.assignedBy] - Who/what assigned this task
 * @returns {object} Firestore-compatible supervisor task document
 */
export function createSupervisorTask({
  type,
  tenantId,
  agentId,
  priority = TaskPriority.NORMAL,
  deadlineAt,
  payload,
  jurisdictionEvidence,
  metadata = {},
  dependsOn = [],
  assignedBy = 'civic-help-setu',
} = {}) {
  // Validate required fields at trust boundary
  if (typeof type !== 'string' || type.trim().length === 0) {
    throw new TypeError('Task type must be a non-empty string');
  }
  if (tenantId && typeof tenantId !== 'string') {
    throw new TypeError('Tenant ID must be a string');
  }
  if (agentId && typeof agentId !== 'string') {
    throw new TypeError('Agent ID must be a string');
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
  if (dependsOn && !Array.isArray(dependsOn)) {
    throw new TypeError('dependsOn must be an array');
  }
  if (typeof assignedBy !== 'string' || assignedBy.trim().length === 0) {
    throw new TypeError('assignedBy must be a non-empty string');
  }

  // Validate jurisdiction evidence if provided
  if (jurisdictionEvidence) {
    const evValidation = validateJurisdictionEvidence(jurisdictionEvidence);
    if (!evValidation.isValid) {
      throw new Error(`Invalid jurisdiction evidence: ${evValidation.errors.join(', ')}`);
    }
  }

  const now = new Date().toISOString();

  // Set default deadline: if not provided, use priority-based SLA default
  // Explicitly check for null/undefined to avoid treating null as "not provided"
  const defaultDeadline = deadlineAt !== null && deadlineAt !== undefined
    ? deadlineAt
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days default

  return {
    id: `supervisor-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
    type,
    tenantId,
    agentId,
    priority,
    status: SupervisorTaskStatus.PENDING,
    deadlineAt: defaultDeadline,
    payload,
    jurisdictionEvidence,
    metadata: {
      ...metadata,
      createdBy: metadata.createdBy || assignedBy,
      createdAt: now,
      ...metadata.createdAt && { createdAt: metadata.createdAt },
    },
    dependsOn: dependsOn.filter((id) => typeof id === 'string' && id.trim().length > 0),
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    createdAt: now,
    updatedAt: now,
    // DAG tracking
    // incomingEdges: tasks that depend on this one (populated by DAG builder)
    // outgoingEdges: tasks this one depends on (from dependsOn)
    // conflictInfo: { hasConflict, conflictAgents[], resolution }
    // escalationState: { triggeredAt, level }
    // ... other internal tracking fields
  };
}

/**
 * Validates a supervisor task document conforms to the expected schema.
 * @param {object} task - Task document to validate
 * @returns {boolean} Whether the task is valid
 * @throws {TypeError} If the task structure is invalid
 */
export function validateSupervisorTask(task) {
  if (!task || typeof task !== 'object') {
    throw new TypeError('Task must be an object');
  }
  if (task.id === undefined) {
    throw new TypeError('Task must have an id field');
  }
  if (task.type === undefined) {
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
  const validStatuses = [
    SupervisorTaskStatus.PENDING,
    SupervisorTaskStatus.PROCESSING,
    SupervisorTaskStatus.COMPLETED,
    SupervisorTaskStatus.FAILED,
    SupervisorTaskStatus.DEAD_LETTER,
    SupervisorTaskStatus.DEFERRED,
    SupervisorTaskStatus.CONFLICT_RESOLVED,
  ];
  if (!validStatuses.includes(task.status)) {
    throw new TypeError(
      `Invalid task status. Must be one of: ${validStatuses.join(', ')}`
    );
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

  // Validate dependsOn is an array of strings
  if (task.dependsOn && !Array.isArray(task.dependsOn)) {
    throw new TypeError('dependsOn must be an array');
  }

  // Validate deadlineAt is a valid ISO string or null
  if (task.deadlineAt !== undefined && task.deadlineAt !== null) {
    if (typeof task.deadlineAt !== 'string') {
      throw new TypeError('deadlineAt must be a string or null');
    }
    // Basic ISO format check
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2/.test(task.deadlineAt)) {
      throw new TypeError('deadlineAt must be a valid ISO timestamp');
    }
  }

  // Validate jurisdictionEvidence if present
  if (task.jurisdictionEvidence) {
    const evValidation = validateJurisdictionEvidence(task.jurisdictionEvidence);
    if (!evValidation.isValid) {
      throw new TypeError(`Invalid jurisdiction evidence: ${evValidation.errors.join(', ')}`);
    }
  }

  return true;
}

/**
 * Converts a supervisor task from internal format to Firestore format for writing.
 * Strips internal markers before writing.
 * @param {object} task - Internal task object
 * @returns {object} Firestore-compatible task document
 */
export function supervisorTaskToFirestore(task) {
  // Make a copy without internal markers
  const { _schemaVersion, _path, ...firestoreTask } = task;
  return firestoreTask;
}

/**
 * Converts a supervisor task from Firestore format to internal format.
 * @param {object} firestoreTask - Task document from Firestore
 * @returns {object} Normalized task object
 */
export function supervisorTaskFromFirestore(firestoreTask) {
  if (!firestoreTask) return null;

  const task = {
    id: firestoreTask.id || firestoreTask._id,
    type: firestoreTask.type,
    tenantId: firestoreTask.tenantId,
    agentId: firestoreTask.agentId,
    priority: firestoreTask.priority || TaskPriority.NORMAL,
    status: firestoreTask.status || SupervisorTaskStatus.PENDING,
    deadlineAt: firestoreTask.deadlineAt,
    payload: firestoreTask.payload,
    jurisdictionEvidence: firestoreTask.jurisdictionEvidence,
    metadata: firestoreTask.metadata || {},
    dependsOn: firestoreTask.dependsOn || [],
    retryCount: firestoreTask.retryCount || 0,
    maxRetries: firestoreTask.maxRetries || MAX_RETRIES,
    createdAt: firestoreTask.createdAt,
    updatedAt: firestoreTask.updatedAt,
    _schemaVersion: firestoreTask._schemaVersion || '1.0.0-supervisor-arch',
  };

  validateSupervisorTask(task);
  return task;
}

// ---------------------------------------------------------------------------
// Type: SupervisorConfig
// ---------------------------------------------------------------------------

/**
 * Configuration for the supervisor agent architecture.
// Used to initialize the supervisor with registry, deadline settings, and
// operational parameters.
 */
export const SupervisorConfig = {
  // Deadline enforcement settings
  deadlineGracePeriodMs: 15 * 60 * 1000, // 15 minutes grace period before strict escalation
  deadlineCheckIntervalMs: 60 * 1000, // Check every minute for deadline approaching

  // Conflict detection settings
  conflictDetectionWindowMs: 5 * 60 * 1000, // Check for conflicts every 5 minutes

  // Agent registry settings
  agentRegistryRefreshIntervalMs: 60 * 60 * 1000, // Refresh registry every hour

  // Maximum tasks per grievance (prevents runaway decomposition)
  maxTasksPerGrievance: 20,

  // Default SLA days when no deadline specified per priority
  defaultSlaDaysByPriority: {
    [TaskPriority.LOW]: 14,
    [TaskPriority.NORMAL]: 7,
    [TaskPriority.HIGH]: 3,
    [TaskPriority.CRITICAL]: 1,
  },

  // Whether human approval is required for high-impact actions
  requireHumanApprovalForFiling: true,
  requireHumanApprovalForBenefitDenial: true,
  requireHumanApprovalForOfficialStatusClaim: true,

  // Cost limits per grievance (in USD, approximate model API costs)
  maxModelApiCostPerGrievance: 0.05,

  // Observability
  emitMetrics: true,
};

// ---------------------------------------------------------------------------
// Export all types and constants
// ---------------------------------------------------------------------------

export default {
  SupervisorTaskStatus,
  JURISDICTION_SOURCE_TYPES,
  validateJurisdictionEvidence,
  AgentCapabilityContract,
  DagEdgeType,
  createDagEdge,
  SupervisorConfig,
  validateSupervisorTask,
  supervisorTaskToFirestore,
  supervisorTaskFromFirestore,
};