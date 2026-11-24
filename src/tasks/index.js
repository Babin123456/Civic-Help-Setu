/**
 * @file Distributed Civic Task Queue - Main Entry Point
 * 
 * Production-oriented vertical slice for the Civic Help Setu task queue system.
 * Provides durable job scheduling with priority, fairness, and recovery features.
 * 
 * Architecture:
 * - Firestore-backed durable persistence with atomic idempotency
 * - Priority queue with aging policy to prevent starvation
 * - Bounded retries with exponential backoff
 * - Dead-letter queue for poisoned jobs
 * - Per-tenant quotas for fair resource distribution
 * - Idempotent task execution
 * 
 * @module tasks
 * @version 1.0.0
 */

// Core schema and types
export {
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
} from './schemas/taskSchema.js';

// Firestore queries and mutations
export {
  enqueueTask,
  getPendingTasks,
  getTaskById,
  updateTask,
  moveToDeadLetter,
  batchEnqueueTasks,
  countPendingTasks,
  checkTenantQuota,
  getQueueStats,
} from './queries/taskQueries.js';

// Worker and processing
export {
  TaskWorker,
  createWorker,
  processTaskOnce,
  PROCESSING_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  CLAIM_DURATION_MS,
} from './processor/taskProcessor.js';

// Scheduler and aging policy
export {
  QueueScheduler,
  createScheduler,
  AGING_PROMOTION_RULES,
} from './scheduler/scheduler.js';

// Task handlers
export * from './handlers/taskRouter.js';
export {
  handleGrievanceClassificationTask,
  createGrievanceClassificationTask,
  validateGrievancePayload,
  handleOcrProcessingTask,
  createOcrProcessingTask,
  validateOcrPayload,
} from './handlers/grievanceTaskHandler.js';
export {
  handleOcrProcessingTask,
  createOcrProcessingTask,
  validateOcrPayload,
} from './handlers/ocrTaskHandler.js';

// Constants
export {
  TASK_COLLECTION,
};

// Version
export const VERSION = '1.0.0';

export default {
  TaskPriority,
  TaskStatus,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  AGING_INTERVAL_MINUTES,
  VERSION,
  enqueueTask,
  getPendingTasks,
  createWorker,
  createScheduler,
};