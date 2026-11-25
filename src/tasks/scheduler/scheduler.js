/**
 * @file Task queue scheduler
 * 
 * Manages the priority aging policy, worker pool, and overall queue orchestration.
 * The scheduler runs periodic aging promotions to prevent low-priority starvation
 * and manages worker lifecycle.
 * 
 * @version 1.0.0
 */

import {
  TaskPriority,
  TaskStatus,
  AGING_INTERVAL_MINUTES,
  computeEffectivePriority,
} from '../schemas/taskSchema.js';
import {
  getPendingTasks,
  updateTask,
  getQueueStats,
} from '../queries/taskQueries.js';
import { createWorker, TaskWorker } from '../processor/taskProcessor.js';
import { v4 as uuidv4 } from 'uuid';

// Aging policy configuration
const AGING_PROMOTION_RULES = [
  // After 2 hours at LOW, promote to NORMAL
  { minTimeMs: 2 * 60 * 60 * 1000, from: TaskPriority.LOW, to: TaskPriority.NORMAL },
  // After 6 hours at NORMAL, promote to HIGH
  { minTimeMs: 6 * 60 * 60 * 1000, from: TaskPriority.NORMAL, to: TaskPriority.HIGH },
  // After 14 hours at HIGH, promote to CRITICAL
  { minTimeMs: 14 * 60 * 60 * 1000, from: TaskPriority.HIGH, to: TaskPriority.CRITICAL },
];

/**
 * Scheduler class that manages queue aging and worker orchestration
 */
export class QueueScheduler {
  constructor(options = {}) {
    this.schedulerId = `scheduler-${uuidv4()}`;
    this.agingIntervalMs = options.agingIntervalMs || AGING_INTERVAL_MINUTES * 60 * 1000;
    this.maxWorkers = options.maxWorkers || 3;
    this.workerPool = [];
    this.isRunning = false;
  }

  /**
   * Starts the scheduler - begins aging policy enforcement and worker management
   */
  async start() {
    if (this.isRunning) {
      console.warn(`Scheduler ${this.schedulerId} is already running`);
      return;
    }

    this.isRunning = true;
    console.info(`Scheduler ${this.schedulerId} starting...`);

    // Start worker pool
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = createWorker({
        tenantId: options.tenantId,
        maxConcurrent: options.maxConcurrentPerWorker || 5,
        capabilities: options.workerCapabilities,
      });
      this.workerPool.push(worker);
    }

    // Start the aging policy loop
    try {
      await this.runagingLoop();
    } catch (error) {
      console.error(`Scheduler ${this.schedulerId} aging loop error:`, error);
    }
  }

  /**
   * Stops the scheduler
   */
  stop() {
    this.isRunning = false;
    this.workerPool.forEach(w => w.stop());
    console.info(`Scheduler ${this.schedulerId} stopped`);
  }

  /**
   * Runs the aging policy loop at the configured interval
   * Promotes old low-priority tasks to higher priority to prevent starvation
   */
  async runagingLoop() {
    if (!this.isRunning) return;

    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.runAgingPolicy();
      } catch (error) {
        console.error(`Scheduler ${this.schedulerId} aging policy error:`, error);
      }
    }, this.agingIntervalMs);

    // Run immediately on start
    await this.runAgingPolicy();
  }

  /**
   * Executes one aging policy cycle
   * - Finds low-priority tasks that have been waiting too long
   * - Promotes them to higher priority levels
   * - Logs the promotion for observability
   */
  async runAgingPolicy() {
    console.info(`Scheduler ${this.schedulerId} running aging policy...`);

    // Get pending tasks, ordered by effective priority
    const tasks = await getPendingTasks({
      limit: 100,
      minPriority: TaskPriority.LOW,
    });

    if (tasks.length === 0) {
      console.debug('No pending tasks for aging policy');
      return;
    }

    let promotions = 0;

    for (const task of tasks) {
      const effectivePriority = computeEffectivePriority(task);
      const now = Date.now();
      const queuedAt = new Date(task.agingInfo?.queuedAt || task.createdAt).getTime();
      const timeQueued = now - queuedAt;

      // Check if the task needs promotion
      let promoted = false;

      for (const rule of AGING_PROMOTION_RULES) {
        if (
          task.priority === rule.from &&
          timeQueued >= rule.minTimeMs &&
          effectivePriority < rule.to
        ) {
          // Promote the task priority
          await updateTask(task.id, {
            priority: rule.to,
            agingInfo: {
              ...task.agingInfo,
              lastPromotionAt: new Date().toISOString(),
            },
          });

          promotions++;
          promoted = true;

          console.info(
            `Scheduler ${this.schedulerId} promoted task ${task.id} from priority ${task.priority} to ${rule.to} ` +
            `(queued for ${Math.round(timeQueued / 60000)} minutes)`
          );
          break; // Only one promotion per cycle per task
        }
      }
    }

    if (promotions > 0) {
      console.info(`Scheduler ${this.schedulerId} aging policy: ${promotions} tasks promoted`);
    } else {
      console.debug(`Scheduler ${this.schedulerId} aging policy: no promotions needed`);
    }
  }

  /**
   * Claims a task for processing from the queue
   * @param {string} taskId - The task ID to claim
   * @param {object} options - Claim options
   * @returns {Promise<object>} Claim result with worker assignment
   */
  async claimTask(taskId, options = {}) {
    const workerIndex = options.workerIndex || 0;
    const worker = this.workerPool[workerIndex];

    if (!worker) {
      throw new Error(`No available worker at index ${workerIndex}`);
    }

    // Update task status to PROCESSING and assign worker
    await updateTask(taskId, {
      status: TaskStatus.PROCESSING,
      metadata: {
        ...(task.metadata || {}),
        claimedBy: worker.workerId,
        claimedAt: new Date().toISOString(),
        claimedByScheduler: this.schedulerId,
      },
    });

    return {
      success: true,
      workerId: worker.workerId,
      schedulerId: this.schedulerId,
    };
  }

  /**
   * Gets current scheduler statistics
   * @param {object} [options] - Stats options
   * @returns {Promise<object>} Scheduler statistics
   */
  async getStats() {
    const queueStats = await getQueueStats();

    // Count active workers
    const activeWorkers = this.workerPool.filter(w => w.isRunning).length;

    return {
      schedulerId: this.schedulerId,
      isRunning: this.isRunning,
      maxWorkers: this.maxWorkers,
      activeWorkers,
      queueStats,
    };
  }
}

/**
 * Creates a new scheduler instance
 * @param {object} options - Scheduler options
 * @param {number} [options.maxWorkers] - Maximum number of workers
 * @param {number} [options.agingIntervalMs] - Aging policy interval in ms
 * @param {Array<string>} [options.workerCapabilities] - Task types workers can handle
 * @param {string} [options.tenantId] - Optional tenant restriction
 * @returns {QueueScheduler} A new scheduler instance
 */
export function createScheduler(options = {}) {
  return new QueueScheduler(options);
}