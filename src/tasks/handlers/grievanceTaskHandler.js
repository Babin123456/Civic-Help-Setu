/**
 * @file Grievance classification task handler
 * 
 * Integrates the existing grievance classification service with the task queue.
 * Tasks of type "grievance-classification" are processed using the established
 * classifyGrievance function with proper idempotency and error handling.
 * 
 * @version 1.0.0
 */

import { classifyGrievance, GRIEVANCE_CATEGORIES, SAMPLE_GRIEVANCES } from '../../services/grievanceClassificationService.js';
import { TaskPriority, TaskStatus } from '../schemas/taskSchema.js';

/**
 * Processes a grievance classification task
 * @param {object} task - The task document containing payload with grievance text
 * @returns {Promise<object>} Processing result with classification
 * @throws {Error} If the task payload is invalid or classification fails
 */
export async function handleGrievanceClassificationTask(task) {
  const { payload = {} } = task;

  // Validate required payload
  if (!payload || typeof payload !== 'object') {
    throw new Error('Grievance classification task missing required payload');
  }

  const { grievanceText, options = {} } = payload;

  if (!grievanceText || typeof grievanceText !== 'string') {
    throw new Error('Grievance classification task missing required: grievanceText');
  }

  try {
    // Classify the grievance using the existing service
    const result = classifyGrievance(grievanceText, options);

    // Add task-specific metadata
    const enrichedResult = {
      ...result,
      taskProcessedAt: new Date().toISOString(),
      taskId: task.id,
      workerProcessed: true,
      classificationSource: 'civic-help-setu-task-queue',
    };

    return enrichedResult;
  } catch (error) {
    console.error(`Grievance classification task ${task.id} failed:`, error);
    throw new Error(`Grievance classification failed: ${error.message}`);
  }
}

/**
 * Validates that a task payload has the minimum required fields for grievance classification
 * @param {object} payload - The task payload to validate
 * @returns {boolean} Whether the payload is valid
 */
function validateGrievancePayload(payload) {
  if (!payload) return false;
  if (typeof payload.grievanceText !== 'string') return false;
  if (payload.grievanceText.trim() === '') return false;
  return true;
}

/**
 * Creates a grievance classification task in the queue
 * @param {object} options - Task creation options
 * @param {string} options.grievanceText - The citizen's grievance description
 * @param {string} [options.tenantId] - Tenant ID for quota enforcement
 * @param {number} [options.priority] - Task priority (default: NORMAL)
 * @param {object} [options.metadata] - Additional metadata
 * @returns {object} Firestore-compatible task document
 */
export function createGrievanceClassificationTask({ grievanceText, tenantId, priority = TaskPriority.NORMAL, metadata = {}, options } = {}) {
  if (!grievanceText || typeof grievanceText !== 'string') {
    throw new Error('Grievance text is required');
  }

  return {
    type: 'grievance-classification',
    tenantId,
    priority,
    status: TaskStatus.PENDING,
    payload: {
      grievanceText,
      options,
    },
    metadata: {
      ...metadata,
      taskSubtype: 'classification',
      createdBy: metadata.createdBy || 'civic-help-setu',
    },
    ...TaskStatus.PENDING, // Will be set by createTask
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default {
  handleGrievanceClassificationTask,
  validateGrievancePayload,
  createGrievanceClassificationTask,
};

export { validateGrievancePayload };