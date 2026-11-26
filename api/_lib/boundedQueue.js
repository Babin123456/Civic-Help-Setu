/**
 * api/_lib/boundedQueue.js
 *
 * Bounded Queue with Priority Lanes, Tenant Isolation, and Backpressure.
 * Provides explicit rejection semantics with Retry-After guidance.
 *
 * Integrates with:
 *  - Concurrency Controller (api/_lib/concurrencyController.js)
 *  - Tenant Rate Limiter (api/_lib/tenantRateLimiter.js)
 *  - Fair Scheduler priority classes (api/_lib/fairScheduler.js)
 */

import { PRIORITY_CLASSES } from './concurrencyController.js';

export const QUEUE_PRIORITIES = Object.freeze([
  PRIORITY_CLASSES.CRITICAL,
  PRIORITY_CLASSES.HIGH,
  PRIORITY_CLASSES.NORMAL,
  PRIORITY_CLASSES.LOW,
]);

export const DEFAULT_QUEUE_CONFIG = Object.freeze({
  capacity: {
    [PRIORITY_CLASSES.CRITICAL]: 100,
    [PRIORITY_CLASSES.HIGH]: 200,
    [PRIORITY_CLASSES.NORMAL]: 500,
    [PRIORITY_CLASSES.LOW]: 1000,
  },
  tenantSlice: {
    enabled: true,
    maxPerTenant: 50,
  },
  aging: {
    enabled: true,
    promoteAfterMs: 5 * 60 * 1000, // 5 minutes
    maxPromotions: 2, // Max 2 priority levels up
  },
  rejection: {
    mode: 'immediate', // 'immediate' | 'timeout'
    defaultRetryAfterMs: 5000,
    timeoutMs: 30000, // Max time to wait for slot in timeout mode
  },
  deadLetter: {
    enabled: true,
    maxSize: 1000,
  },
});

const PRIORITY_RANK = Object.freeze({
  [PRIORITY_CLASSES.CRITICAL]: 0,
  [PRIORITY_CLASSES.HIGH]: 1,
  [PRIORITY_CLASSES.NORMAL]: 2,
  [PRIORITY_CLASSES.LOW]: 3,
});

function createTenantSliceTracker({ maxPerTenant } = {}) {
  const tenantCounts = new Map(); // tenantId -> count
  const tenantPriorityCounts = new Map(); // tenantId -> { CRITICAL: n, HIGH: n, ... }

  return {
    getCount(tenantId) {
      return tenantCounts.get(tenantId) || 0;
    },

    getPriorityCount(tenantId, priority) {
      const counts = tenantPriorityCounts.get(tenantId);
      return counts?.[priority] || 0;
    },

    canAccept(tenantId, priority) {
      const total = this.getCount(tenantId);
      if (total >= maxPerTenant) return false;
      // Also check per-priority fairness (no more than 50% of tenant slice in one priority)
      const priorityCount = this.getPriorityCount(tenantId, priority);
      return priorityCount < Math.max(1, Math.floor(maxPerTenant * 0.5));
    },

    increment(tenantId, priority) {
      tenantCounts.set(tenantId, this.getCount(tenantId) + 1);
      const priorityCounts = tenantPriorityCounts.get(tenantId) || {};
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
      tenantPriorityCounts.set(tenantId, priorityCounts);
    },

    decrement(tenantId, priority) {
      const total = this.getCount(tenantId);
      if (total <= 1) {
        tenantCounts.delete(tenantId);
        tenantPriorityCounts.delete(tenantId);
      } else {
        tenantCounts.set(tenantId, total - 1);
        const priorityCounts = tenantPriorityCounts.get(tenantId) || {};
        priorityCounts[priority] = Math.max(0, (priorityCounts[priority] || 1) - 1);
        if (Object.values(priorityCounts).every(v => v === 0)) {
          tenantPriorityCounts.delete(tenantId);
        } else {
          tenantPriorityCounts.set(tenantId, priorityCounts);
        }
      }
    },

    getAllTenantCounts() {
      const result = {};
      for (const [tenantId, count] of tenantCounts) {
        result[tenantId] = { total: count, byPriority: tenantPriorityCounts.get(tenantId) || {} };
      }
      return result;
    },

    reset() {
      tenantCounts.clear();
      tenantPriorityCounts.clear();
    },
  };
}

function createPriorityQueue(priority, capacity) {
  const queue = []; // Array of { item, enqueuedAt, tenantId, deadline, promotions }
  let dropped = 0;
  let promoted = 0;
  const state = { capacity }; // Use object to allow mutation

  return {
    priority,
    get capacity() { return state.capacity; },
    set capacity(val) { state.capacity = val; },
    queue,
    dropped,
    promoted,

    size() {
      return queue.length;
    },

    isFull() {
      return queue.length >= state.capacity;
    },

    enqueue(item, { tenantId, deadline, now = Date.now } = {}) {
      if (this.isFull()) return { accepted: false, reason: 'queue_full' };

      const entry = {
        item,
        enqueuedAt: now(),
        tenantId: tenantId || 'default',
        deadline: deadline || null,
        promotions: 0,
      };
      queue.push(entry);
      return { accepted: true, position: queue.length };
    },

    dequeue() {
      return queue.shift() || null;
    },

    peek() {
      return queue[0] || null;
    },

    // Remove expired items (deadline passed)
    removeExpired(now = Date.now) {
      const initialLength = queue.length;
      let i = 0;
      while (i < queue.length) {
        if (queue[i].deadline && queue[i].deadline <= now()) {
          queue.splice(i, 1);
          this.dropped++;
        } else {
          i++;
        }
      }
      return initialLength - queue.length;
    },

    // Promote aged items to higher priority
    promoteAged(maxPromotions, promoteAfterMs, now = Date.now) {
      const promotedItems = [];
      let i = 0;
      while (i < queue.length) {
        const entry = queue[i];
        const waitTime = now() - entry.enqueuedAt;
        // Each promotion level requires promoteAfterMs wait time
        const requiredWaitTime = (entry.promotions + 1) * promoteAfterMs;

        if (waitTime >= requiredWaitTime && entry.promotions < maxPromotions) {
          promotedItems.push(queue.splice(i, 1)[0]);
          this.promoted++;
        } else {
          i++;
        }
      }
      return promotedItems;
    },

    snapshot() {
      return {
        priority,
        capacity: state.capacity,
        size: queue.length,
        dropped,
        promoted,
        utilization: queue.length / state.capacity,
        oldestWaitMs: queue.length > 0 ? Date.now() - queue[0].enqueuedAt : 0,
      };
    },

    clear() {
      queue.length = 0;
      dropped = 0;
      promoted = 0;
    },
  };
}

export function createBoundedQueue({
  capacity = DEFAULT_QUEUE_CONFIG.capacity,
  tenantSlice = DEFAULT_QUEUE_CONFIG.tenantSlice,
  aging = DEFAULT_QUEUE_CONFIG.aging,
  rejection = DEFAULT_QUEUE_CONFIG.rejection,
  deadLetter = DEFAULT_QUEUE_CONFIG.deadLetter,
  now = Date.now,
  onEvent = () => {},
} = {}) {
  const priorityQueues = {};
  for (const priority of QUEUE_PRIORITIES) {
    priorityQueues[priority] = createPriorityQueue(priority, capacity[priority] || 0);
  }

  const tenantTracker = tenantSlice.enabled ? createTenantSliceTracker({ maxPerTenant: tenantSlice.maxPerTenant }) : null;
  const deadLetterQueue = deadLetter.enabled ? [] : null;

  let totalEnqueued = 0;
  let totalDequeued = 0;
  let totalRejected = 0;
  let totalDeadLettered = 0;

  function getTotalSize() {
    let total = 0;
    for (const q of Object.values(priorityQueues)) total += q.size();
    return total;
  }

  function getTotalCapacity() {
    let total = 0;
    for (const q of Object.values(priorityQueues)) total += q.capacity;
    return total;
  }

  /**
   * Enqueue an item with priority and tenant isolation.
   * @returns {Object} { accepted: boolean, position?: number, estimatedWaitMs?: number, retryAfterMs?: number, reason?: string }
   */
  function enqueue(item, { priority = PRIORITY_CLASSES.NORMAL, tenantId = 'default', deadlineMs } = {}) {
    const effectivePriority = QUEUE_PRIORITIES.includes(priority) ? priority : PRIORITY_CLASSES.NORMAL;
    const queue = priorityQueues[effectivePriority];
    const effectiveDeadline = deadlineMs ? now() + deadlineMs : null;

    // Check tenant slice
    if (tenantTracker && !tenantTracker.canAccept(tenantId, effectivePriority)) {
      totalRejected++;
      onEvent({
        event: 'queue_rejected',
        reason: 'tenant_slice_exceeded',
        priority: effectivePriority,
        tenantId,
        queueSize: queue.size(),
        at: now(),
      });
      return {
        accepted: false,
        retryAfterMs: rejection.defaultRetryAfterMs,
        reason: 'tenant_slice_exceeded',
        priority: effectivePriority,
      };
    }

    // Check queue capacity
    if (queue.isFull()) {
      totalRejected++;
      onEvent({
        event: 'queue_rejected',
        reason: 'queue_full',
        priority: effectivePriority,
        tenantId,
        queueSize: queue.size(),
        at: now(),
      });
      return {
        accepted: false,
        retryAfterMs: rejection.defaultRetryAfterMs,
        reason: 'queue_full',
        priority: effectivePriority,
      };
    }

    // Enqueue
    const result = queue.enqueue(item, { tenantId, deadline: effectiveDeadline, now });
    if (result.accepted) {
      totalEnqueued++;
      if (tenantTracker) tenantTracker.increment(tenantId, effectivePriority);

      // Estimate wait time based on queue position and processing rate
      const estimatedWaitMs = estimateWaitTime(effectivePriority, result.position);

      onEvent({
        event: 'queue_enqueued',
        priority: effectivePriority,
        tenantId,
        position: result.position,
        estimatedWaitMs,
        queueSize: queue.size(),
        at: now(),
      });

      return {
        accepted: true,
        position: result.position,
        estimatedWaitMs,
        priority: effectivePriority,
      };
    }

    return { accepted: false, reason: 'unknown', priority: effectivePriority };
  }

  function estimateWaitTime(priority, position) {
    // Simple estimation: assume ~100ms per item for CRITICAL, ~200ms for HIGH, etc.
    const baseTimes = {
      [PRIORITY_CLASSES.CRITICAL]: 50,
      [PRIORITY_CLASSES.HIGH]: 100,
      [PRIORITY_CLASSES.NORMAL]: 200,
      [PRIORITY_CLASSES.LOW]: 500,
    };
    return position * (baseTimes[priority] || 200);
  }

  /**
   * Dequeue the highest priority available item.
   * @returns {Object|null} { item, priority, tenantId, enqueuedAt, waitTimeMs } or null
   */
  function dequeue() {
    // Process queues in priority order
    for (const priority of QUEUE_PRIORITIES) {
      const queue = priorityQueues[priority];
      // Remove expired items first
      queue.removeExpired(now);

      if (queue.size() > 0) {
        const entry = queue.dequeue();
        totalDequeued++;
        if (tenantTracker) tenantTracker.decrement(entry.tenantId, priority);

        const waitTimeMs = now() - entry.enqueuedAt;

        onEvent({
          event: 'queue_dequeued',
          priority,
          tenantId: entry.tenantId,
          waitTimeMs,
          queueSize: queue.size(),
          at: now(),
        });

        return {
          item: entry.item,
          priority,
          tenantId: entry.tenantId,
          enqueuedAt: entry.enqueuedAt,
          waitTimeMs,
          promotions: entry.promotions,
        };
      }
    }
    return null;
  }

  /**
   * Peek at the next item without removing it.
   */
  function peek() {
    for (const priority of QUEUE_PRIORITIES) {
      const queue = priorityQueues[priority];
      queue.removeExpired(now);
      if (queue.size() > 0) {
        const entry = queue.peek();
        return {
          item: entry.item,
          priority,
          tenantId: entry.tenantId,
          enqueuedAt: entry.enqueuedAt,
          waitTimeMs: now() - entry.enqueuedAt,
          position: 1,
        };
      }
    }
    return null;
  }

  /**
   * Run aging promotion for all queues.
   */
  function runAging() {
    if (!aging.enabled) return { promoted: 0 };

    let totalPromoted = 0;
    for (const priority of QUEUE_PRIORITIES) {
      const queue = priorityQueues[priority];
      const currentRank = PRIORITY_RANK[priority];

      // Can't promote CRITICAL further
      if (currentRank === 0) continue;

      const promotedItems = queue.promoteAged(aging.maxPromotions, aging.promoteAfterMs, now);
      totalPromoted += promotedItems.length;

      for (const entry of promotedItems) {
        const newRank = Math.max(0, currentRank - 1);
        const newPriority = QUEUE_PRIORITIES[newRank];
        const targetQueue = priorityQueues[newPriority];

        // Check if target queue has space
        if (!targetQueue.isFull()) {
          entry.promotions++;
          targetQueue.enqueue(entry.item, { tenantId: entry.tenantId, deadline: entry.deadline, now });
          if (tenantTracker) {
            tenantTracker.decrement(entry.tenantId, priority);
            tenantTracker.increment(entry.tenantId, newPriority);
          }

          onEvent({
            event: 'queue_promoted',
            fromPriority: priority,
            toPriority: newPriority,
            tenantId: entry.tenantId,
            waitTimeMs: now() - entry.enqueuedAt,
            at: now(),
          });
        } else {
          // Put back in original queue if target is full
          queue.enqueue(entry.item, { tenantId: entry.tenantId, deadline: entry.deadline, now });
        }
      }
    }

    return { promoted: totalPromoted };
  }

  /**
   * Move item to dead letter queue.
   */
  function moveToDeadLetter(item, reason, { priority = PRIORITY_CLASSES.NORMAL, tenantId = 'default' } = {}) {
    if (!deadLetterQueue) return false;

    if (deadLetterQueue.length >= deadLetter.maxSize) {
      // Remove oldest
      deadLetterQueue.shift();
    }

    deadLetterQueue.push({
      item,
      reason,
      priority,
      tenantId,
      timestamp: now(),
    });
    totalDeadLettered++;

    onEvent({
      event: 'queue_dead_lettered',
      reason,
      priority,
      tenantId,
      at: now(),
    });

    return true;
  }

  function getDeadLetterQueue() {
    return deadLetterQueue ? [...deadLetterQueue] : [];
  }

  function clearDeadLetterQueue() {
    if (deadLetterQueue) deadLetterQueue.length = 0;
    totalDeadLettered = 0;
  }

  function getSnapshot() {
    return {
      totalSize: getTotalSize(),
      totalCapacity: getTotalCapacity(),
      utilization: getTotalSize() / getTotalCapacity(),
      byPriority: Object.fromEntries(
        Object.entries(priorityQueues).map(([k, v]) => [k, v.snapshot()])
      ),
      tenantSlices: tenantTracker ? tenantTracker.getAllTenantCounts() : {},
      deadLetter: deadLetterQueue ? { size: deadLetterQueue.length, maxSize: deadLetter.maxSize } : null,
      stats: {
        totalEnqueued,
        totalDequeued,
        totalRejected,
        totalDeadLettered,
      },
    };
  }

  function getQueueForPriority(priority) {
    return priorityQueues[priority]?.snapshot() || null;
  }

  function setCapacity(priority, newCapacity) {
    if (priorityQueues[priority]) {
      const oldCapacity = priorityQueues[priority].capacity;
      priorityQueues[priority].capacity = newCapacity;
      onEvent({
        event: 'queue_capacity_changed',
        priority,
        oldCapacity,
        newCapacity,
        at: now(),
      });
    }
  }

  function reset() {
    for (const q of Object.values(priorityQueues)) q.clear();
    if (tenantTracker) tenantTracker.reset();
    if (deadLetterQueue) deadLetterQueue.length = 0;
    totalEnqueued = totalDequeued = totalRejected = totalDeadLettered = 0;
  }

  return {
    enqueue,
    dequeue,
    peek,
    runAging,
    moveToDeadLetter,
    getDeadLetterQueue,
    clearDeadLetterQueue,
    getSnapshot,
    getQueueForPriority,
    setCapacity,
    reset,
    QUEUE_PRIORITIES,
    PRIORITY_RANK,
    DEFAULT_QUEUE_CONFIG,
  };
}

export default createBoundedQueue;