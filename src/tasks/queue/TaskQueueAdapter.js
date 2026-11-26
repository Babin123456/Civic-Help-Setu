/**
 * @file Task Queue Adapter with Bounded Queue Integration
 * 
 * Provides a bounded queue layer for task acceptance with priority lanes,
 * tenant isolation, and backpressure. Integrates with the existing
 * Firestore-based task queue and the API gateway's bounded queue.
 * 
 * @version 1.0.0
 */

import { createBoundedQueue } from '../../../api/_lib/boundedQueue.js';
import { TaskPriority } from '../schemas/taskSchema.js';
import { createTenantRateLimiter } from '../../../api/_lib/tenantRateLimiter.js';

// Map TaskPriority to QUEUE_PRIORITIES
const TASK_TO_QUEUE_PRIORITY = {
  [TaskPriority.CRITICAL]: 'CRITICAL',
  [TaskPriority.HIGH]: 'HIGH',
  [TaskPriority.NORMAL]: 'NORMAL',
  [TaskPriority.LOW]: 'LOW',
};

const QUEUE_TO_TASK_PRIORITY = {
  'CRITICAL': TaskPriority.CRITICAL,
  'HIGH': TaskPriority.HIGH,
  'NORMAL': TaskPriority.NORMAL,
  'LOW': TaskPriority.LOW,
};

export const DEFAULT_TASK_QUEUE_CONFIG = {
  capacity: {
    CRITICAL: 100,
    HIGH: 200,
    NORMAL: 500,
    LOW: 1000,
  },
  tenantSlice: { enabled: true, maxPerTenant: 50 },
  aging: { enabled: true, promoteAfterMs: 5 * 60 * 1000, maxPromotions: 2 },
  rejection: { mode: 'immediate', defaultRetryAfterMs: 5000 },
  deadLetter: { enabled: true, maxSize: 1000 },
  // Flush interval - how often to drain queue to Firestore
  flushIntervalMs: 1000,
  // Max items to flush per interval
  flushBatchSize: 50,
  // Tenant rate limiter config
  tenantRateLimiter: { enabled: true },
};

/**
 * Creates a task queue adapter with bounded queue for local buffering
 * @param {Object} config - Configuration options
 * @returns {Object} Task queue adapter with enqueue, dequeue, and metrics
 */
export function createTaskQueueAdapter(config = {}) {
  const finalConfig = { ...DEFAULT_TASK_QUEUE_CONFIG, ...config };
  const now = config.now || Date.now;
  const events = [];

  // Create bounded queue for local buffering
  const boundedQueue = createBoundedQueue({
    capacity: finalConfig.capacity,
    tenantSlice: finalConfig.tenantSlice,
    aging: finalConfig.aging,
    rejection: finalConfig.rejection,
    deadLetter: finalConfig.deadLetter,
    now,
    onEvent: (e) => events.push({ ...e, component: 'taskQueueAdapter' }),
  });

  // Create tenant rate limiter for quota enforcement (optional)
  const tenantRateLimiter = finalConfig.tenantRateLimiter.enabled
    ? createTenantRateLimiter({
        mode: 'enforce',
        onEvent: (e) => events.push({ ...e, component: 'tenantRateLimiter' }),
      })
    : null;

  // Metrics
  const metrics = {
    totalEnqueued: 0,
    totalFlushed: 0,
    totalRejected: 0,
    totalDeadLettered: 0,
    startTime: now(),
  };

  let flushTimer = null;
  let isFlushing = false;

  /**
   * Flush items from bounded queue to Firestore
   * @param {Function} firestoreEnqueueFn - Function to enqueue to Firestore
   */
  async function flushToFirestore(firestoreEnqueueFn) {
    if (isFlushing) return;
    isFlushing = true;

    try {
      let flushed = 0;
      while (flushed < finalConfig.flushBatchSize) {
        const item = boundedQueue.dequeue();
        if (!item) break;

        // Convert queue item back to task format
        const task = {
          ...item.item,
          priority: QUEUE_TO_TASK_PRIORITY[item.priority] || item.item.priority,
        };

        try {
          await firestoreEnqueueFn(task);
          flushed++;
          metrics.totalFlushed++;
        } catch (error) {
          // On flush error, put back in dead letter queue
          boundedQueue.moveToDeadLetter(task, `flush_failed: ${error.message}`, {
            priority: item.priority,
            tenantId: item.tenantId,
          });
          metrics.totalDeadLettered++;
          break; // Stop flushing on error
        }
      }
    } catch {
      metrics.totalDeadLettered++;
    } finally {
      isFlushing = false;
    }
  }

  /**
   * Start periodic flush to Firestore
   * @param {Function} firestoreEnqueueFn - Function to enqueue to Firestore
   */
  function startFlushLoop(firestoreEnqueueFn) {
    if (flushTimer) return;
    flushTimer = setInterval(() => {
      flushToFirestore(firestoreEnqueueFn);
    }, finalConfig.flushIntervalMs);
    // Run initial flush
    flushToFirestore(firestoreEnqueueFn);
  }

  function stopFlushLoop() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  /**
   * Enqueue a task with backpressure
   * @param {Object} task - Task object
   * @returns {Object} { accepted, taskId?, retryAfterMs?, reason?, priority }
   */
  async function enqueueTask(task) {
    const queuePriority = TASK_TO_QUEUE_PRIORITY[task.priority] || 'NORMAL';
    const tenantId = task.tenantId || 'default';

    // Check tenant rate limit first (if enabled)
    if (tenantRateLimiter) {
      const rateLimitDecision = await tenantRateLimiter.evaluate({ tenantId }, 'task_enqueue');
      if (!rateLimitDecision.allowed) {
        metrics.totalRejected++;
        return {
          accepted: false,
          retryAfterMs: rateLimitDecision.retryAfterSeconds * 1000,
          reason: 'rate_limit_exceeded',
          priority: queuePriority,
        };
      }
    }

    // Enqueue in bounded queue
    const result = boundedQueue.enqueue(task, {
      priority: queuePriority,
      tenantId,
      deadlineMs: task.metadata?.deadlineMs,
    });

    if (result.accepted) {
      metrics.totalEnqueued++;
      return {
        accepted: true,
        // Task will get ID when flushed to Firestore
        position: result.position,
        estimatedWaitMs: result.estimatedWaitMs,
        priority: queuePriority,
      };
    }

    metrics.totalRejected++;
    return {
      accepted: false,
      retryAfterMs: result.retryAfterMs,
      reason: result.reason,
      priority: queuePriority,
    };
  }

  /**
   * Get pending tasks - combines local queue with Firestore
   * @param {Function} firestoreGetPendingFn - Function to get pending from Firestore
   * @returns {Promise<Array>} Combined pending tasks
   */
  async function getPendingTasks(firestoreGetPendingFn) {
    // Get tasks from local bounded queue
    // We can't easily iterate the bounded queue without dequeuing,
    // so we'll rely on Firestore for now and note local queue in metrics
    
    // Get tasks from Firestore
    const firestoreTasks = await firestoreGetPendingFn();
    
    return firestoreTasks;
  }

  /**
   * Get adapter metrics
   */
  function getMetrics() {
    const queueSnap = boundedQueue.getSnapshot();
    return {
      ...metrics,
      uptimeMs: now() - metrics.startTime,
      localQueue: {
        totalSize: queueSnap.totalSize,
        totalCapacity: queueSnap.totalCapacity,
        utilization: queueSnap.utilization,
        byPriority: queueSnap.byPriority,
        tenantSlices: queueSnap.tenantSlices,
        deadLetter: queueSnap.deadLetter,
      },
      events: events.slice(-100), // Last 100 events
    };
  }

  /**
   * Get health status
   */
  function getHealth() {
    const queueSnap = boundedQueue.getSnapshot();
    const rejectionRate = metrics.totalEnqueued > 0 
      ? metrics.totalRejected / metrics.totalEnqueued 
      : 0;
    
    return {
      status: rejectionRate < 0.1 ? 'healthy' : 'degraded',
      rejectionRate,
      localQueueUtilization: queueSnap.utilization,
      flushRunning: !!flushTimer,
      timestamp: new Date(now()).toISOString(),
    };
  }

  /**
   * Shutdown adapter
   * @param {Function} firestoreEnqueueFn - Optional function to enqueue to Firestore for final flush
   */
  async function shutdown(firestoreEnqueueFn) {
    stopFlushLoop();
    // Final flush attempt
    if (firestoreEnqueueFn) {
      await flushToFirestore(firestoreEnqueueFn);
    }
    boundedQueue.reset();
  }

  return {
    enqueueTask,
    getPendingTasks,
    flushToFirestore,
    startFlushLoop,
    stopFlushLoop,
    getMetrics,
    getHealth,
    shutdown,
    boundedQueue, // Expose for testing
    tenantRateLimiter, // Expose for testing
  };
}

export default createTaskQueueAdapter;