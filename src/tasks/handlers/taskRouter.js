/**
 * @file Task type router
 * 
 * Routes tasks to the appropriate handler based on the task type.
 * All handlers must conform to the expected interface and perform input
 * validation at trust boundaries.
 * 
 * @version 1.0.0
 */

import { 
  TaskPriority, 
  TaskStatus 
} from '../schemas/taskSchema.js';

import * as grievanceHandler from './grievanceTaskHandler.js';
import * as ocrHandler from './ocrTaskHandler.js';

// Import other handlers as they are created
// import * as documentHandler from './documentTaskHandler.js';
// import * as formHandler from './formValidationTaskHandler.js';

/**
 * Map of task types to their respective handlers
 * @type {Map<string, object>}
 */
export const TASK_HANDLER_MAP = new Map([
  ['grievance-classification', grievanceHandler],
  ['ocr-processing', ocrHandler],
  // Add more handlers as they are registered
  // ['document-ingestion', documentHandler],
  // ['form-validation', formHandler],
]);

/**
 * Gets the handler for a given task type
 * @param {string} taskType - The task type identifier
 * @returns {object} The handler object, or null if not found
 */
export function getHandler(taskType) {
  const handler = TASK_HANDLER_MAP.get(taskType);
  if (!handler) {
    console.warn(`No handler registered for task type: ${taskType}`);
    return null;
  }
  return handler;
}

/**
 * Routes a task to the appropriate handler for processing
 * @param {object} task - The task document to process
 * @returns {Promise<object>} The handler's processing result
 * @throws {Error} If no handler is found or processing fails
 */
export async function routeTask(task) {
  const { type } = task;

  if (!type) {
    throw new Error('Task missing required: type');
  }

  const handler = getHandler(type);
  if (!handler) {
    throw new Error(`No handler registered for task type: ${type}`);
  }

  // Check if the handler can process this task type
  // Some handlers export a canHandle function
  if (handler.canHandle) {
    const canProcess = await handler.canHandle(task);
    if (!canProcess) {
      throw new Error(`Handler for ${type} cannot process this task`);
    }
  }

  // Execute the handler
  // Most handlers export a handle*Task function as default
  const handleFunc = Object.values(handler).find(
    v => typeof v === 'function' && v.name && v.name.includes('Task')
  ) || handler.handleGrievanceClassificationTask || handler.handleOcrProcessingTask;

  if (typeof handleFunc !== 'function') {
    throw new Error(`No suitable handler function found for task type: ${type}`);
  }

  try {
    return await handleFunc(task);
  } catch (error) {
    console.error(`Task routing failed for type ${type}:`, error);
    throw error;
  }
}

/**
 * Lists all registered task types
 * @returns {Array<string>} Array of registered task type strings
 */
export function listTaskTypes() {
  return Array.from(TASK_HANDLER_MAP.keys());
}

/**
 * Registers a new task handler
 * @param {object} handler - Handler module with required functions
 * @param {string} handlerType - The task type this handler services
 * @throws {Error} If the type is already registered
 */
export function registerHandler(handler, handlerType) {
  if (TASK_HANDLER_MAP.has(handlerType)) {
    throw new Error(`Task type ${handlerType} is already registered`);
  }

  // Validate handler has required functions
  const requiredFuncs = ['handleTask', 'createTask'];
  // Note: Different handlers may have different APIs, so we just check for existence
  // of at least one handle function
  const hasHandleFunc = Object.values(handler).some(v => typeof v === 'function');
  if (!hasHandleFunc) {
    throw new Error(`Handler for ${handlerType} must export at least one handler function`);
  }

  TASK_HANDLER_MAP.set(handlerType, handler);
  console.info(`Registered handler for task type: ${handlerType}`);
}

export default {
  routeTask,
  getHandler,
  listTaskTypes,
  registerHandler,
  TASK_HANDLER_MAP,
};