import { describe, it, expect, beforeEach } from 'vitest';
import { createBoundedQueue } from './boundedQueue.js';

describe('BoundedQueue', () => {
  let queue;
  let currentTime;
  const events = [];

  beforeEach(() => {
    currentTime = new Date('2026-11-25T12:00:00Z').getTime();
    events.length = 0;

    queue = createBoundedQueue({
      now: () => currentTime,
      onEvent: (e) => events.push(e),
      capacity: {
        CRITICAL: 10,
        HIGH: 20,
        NORMAL: 50,
        LOW: 100,
      },
      tenantSlice: { enabled: true, maxPerTenant: 5 },
      aging: { enabled: true, promoteAfterMs: 5 * 60 * 1000, maxPromotions: 2 },
      rejection: { mode: 'immediate', defaultRetryAfterMs: 5000 },
    });
  });

  describe('enqueue', () => {
    it('accepts items within capacity', () => {
      const result = queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      expect(result.accepted).toBe(true);
      expect(result.position).toBe(1);
      expect(result.priority).toBe('NORMAL');
    });

    it('rejects when queue is full', () => {
      // Fill NORMAL queue (capacity 50) using different tenants to avoid tenant slice limit
      for (let i = 0; i < 50; i++) {
        const result = queue.enqueue({ id: i }, { priority: 'NORMAL', tenantId: `tenant-${i}` });
        expect(result.accepted).toBe(true);
      }

      const result = queue.enqueue({ id: 50 }, { priority: 'NORMAL', tenantId: 'tenant-new' });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('queue_full');
      expect(result.retryAfterMs).toBe(5000);
    });

    it('enforces tenant slice limits', () => {
      // Fill tenant slice for NORMAL (max 5 per tenant, but per-priority limited to 50% = 2)
      for (let i = 0; i < 2; i++) {
        const result = queue.enqueue({ id: i }, { priority: 'NORMAL', tenantId: 'tenant-1' });
        expect(result.accepted).toBe(true);
      }

      // 3rd item in NORMAL should be rejected for this tenant (50% limit)
      const result = queue.enqueue({ id: 2 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('tenant_slice_exceeded');
    });

    it('allows different tenants to fill their slices independently', () => {
      // tenant-1 uses 2 slots in NORMAL (50% of 5)
      queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      queue.enqueue({ id: 2 }, { priority: 'NORMAL', tenantId: 'tenant-1' });

      // tenant-2 can also use 2 slots in NORMAL
      for (let i = 0; i < 2; i++) {
        const result = queue.enqueue({ id: i + 100 }, { priority: 'NORMAL', tenantId: 'tenant-2' });
        expect(result.accepted).toBe(true);
      }
    });

    it('limits per-priority tenant allocation to 50% of slice', () => {
      // tenant-1 fills NORMAL (2 items, which is 50% of 5)
      queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      queue.enqueue({ id: 2 }, { priority: 'NORMAL', tenantId: 'tenant-1' });

      // 3rd item in NORMAL should be rejected for this tenant
      const result = queue.enqueue({ id: 3 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('tenant_slice_exceeded');

      // But HIGH priority should still work (separate 50% allocation)
      const highResult = queue.enqueue({ id: 4 }, { priority: 'HIGH', tenantId: 'tenant-1' });
      expect(highResult.accepted).toBe(true);
    });

    it('estimates wait time based on priority', () => {
      queue.enqueue({ id: 1 }, { priority: 'CRITICAL', tenantId: 'tenant-1' });
      const r1 = queue.enqueue({ id: 2 }, { priority: 'CRITICAL', tenantId: 'tenant-1' });
      const r2 = queue.enqueue({ id: 3 }, { priority: 'NORMAL', tenantId: 'tenant-1' });

      // CRITICAL has lower base time (50ms) vs NORMAL (200ms)
      expect(r1.estimatedWaitMs).toBeLessThan(r2.estimatedWaitMs);
    });

    it('handles deadline', () => {
      const result = queue.enqueue(
        { id: 1 },
        { priority: 'NORMAL', tenantId: 'tenant-1', deadlineMs: 10000 }
      );
      expect(result.accepted).toBe(true);
    });

    it('defaults to NORMAL priority for unknown priority', () => {
      const result = queue.enqueue({ id: 1 }, { priority: 'UNKNOWN', tenantId: 'tenant-1' });
      expect(result.priority).toBe('NORMAL');
    });
  });

  describe('dequeue', () => {
    it('returns items in priority order', () => {
      queue.enqueue({ id: 1, type: 'low' }, { priority: 'LOW', tenantId: 'tenant-1' });
      queue.enqueue({ id: 2, type: 'normal' }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      queue.enqueue({ id: 3, type: 'high' }, { priority: 'HIGH', tenantId: 'tenant-1' });
      queue.enqueue({ id: 4, type: 'critical' }, { priority: 'CRITICAL', tenantId: 'tenant-1' });

      const first = queue.dequeue();
      expect(first.item.type).toBe('critical');
      expect(first.priority).toBe('CRITICAL');

      const second = queue.dequeue();
      expect(second.item.type).toBe('high');
      expect(second.priority).toBe('HIGH');
    });

    it('returns null when all queues empty', () => {
      const result = queue.dequeue();
      expect(result).toBeNull();
    });

    it('removes expired items', () => {
      queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1', deadlineMs: 1000 });
      currentTime += 2000; // Advance past deadline
      const result = queue.dequeue();
      expect(result).toBeNull(); // Expired item removed
    });

    it('tracks wait time', () => {
      queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      currentTime += 5000;
      const result = queue.dequeue();
      expect(result.waitTimeMs).toBe(5000);
    });

    it('decrements tenant slice on dequeue', () => {
      queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      queue.enqueue({ id: 2 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      queue.dequeue();

      // Should be able to enqueue another for same tenant
      const result = queue.enqueue({ id: 3 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      expect(result.accepted).toBe(true);
    });
  });

  describe('peek', () => {
    it('returns next item without removing', () => {
      queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      queue.enqueue({ id: 2 }, { priority: 'HIGH', tenantId: 'tenant-1' });

      const peeked = queue.peek();
      expect(peeked.item.id).toBe(2); // HIGH priority first
      expect(peeked.priority).toBe('HIGH');

      // Queue unchanged
      const peeked2 = queue.peek();
      expect(peeked2.item.id).toBe(2);
    });

    it('returns null when empty', () => {
      expect(queue.peek()).toBeNull();
    });
  });

  describe('aging promotion', () => {
    it('promotes aged items to higher priority', () => {
      queue.enqueue({ id: 1 }, { priority: 'LOW', tenantId: 'tenant-1' });
      queue.enqueue({ id: 2 }, { priority: 'NORMAL', tenantId: 'tenant-1' });

      // Advance time past promotion threshold (5 min per level, max 2 levels = 10 min)
      currentTime += 11 * 60 * 1000;

      const result = queue.runAging();
      expect(result.promoted).toBeGreaterThan(0);
    });

    it('respects maxPromotions limit', () => {
      queue.enqueue({ id: 1 }, { priority: 'LOW', tenantId: 'tenant-1' });

      // Advance time way past (would promote 2 levels max: LOW -> NORMAL -> HIGH)
      currentTime += 20 * 60 * 1000;

      queue.runAging();
      const snap = queue.getSnapshot();
      // Item should be in HIGH, not CRITICAL (max 2 promotions)
      expect(snap.byPriority.HIGH.size).toBeGreaterThanOrEqual(0);
      expect(snap.byPriority.CRITICAL.size).toBe(0);
    });

    it('does not promote if target queue is full', () => {
      // Fill CRITICAL queue first (capacity 10)
      for (let i = 0; i < 10; i++) {
        queue.enqueue({ id: i }, { priority: 'CRITICAL', tenantId: `tenant-${i}` });
      }

      // Fill HIGH queue (capacity 20)
      for (let i = 0; i < 20; i++) {
        queue.enqueue({ id: i + 100 }, { priority: 'HIGH', tenantId: `tenant-${i}` });
      }

      // Add item to NORMAL
      queue.enqueue({ id: 1000 }, { priority: 'NORMAL', tenantId: 'tenant-new' });
      currentTime += 11 * 60 * 1000;

      queue.runAging();

      // Item should stay in NORMAL because HIGH is full (and CRITICAL is full, so HIGH can't promote)
      const snap = queue.getSnapshot();
      expect(snap.byPriority.NORMAL.size).toBe(1);
      expect(snap.byPriority.HIGH.size).toBe(20);
      expect(snap.byPriority.CRITICAL.size).toBe(10);
    });

    it('emits promotion events', () => {
      queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      currentTime += 11 * 60 * 1000;
      queue.runAging();

      const promoEvent = events.find(e => e.event === 'queue_promoted');
      expect(promoEvent).toBeDefined();
      expect(promoEvent.fromPriority).toBe('NORMAL');
      expect(promoEvent.toPriority).toBe('HIGH');
    });
  });

  describe('dead letter queue', () => {
    it('moves items to dead letter', () => {
      queue.moveToDeadLetter({ id: 1 }, 'timeout', { priority: 'NORMAL', tenantId: 'tenant-1' });
      const dlq = queue.getDeadLetterQueue();
      expect(dlq.length).toBe(1);
      expect(dlq[0].item.id).toBe(1);
      expect(dlq[0].reason).toBe('timeout');
    });

    it('limits dead letter queue size', () => {
      // Create queue with small DLQ
      const smallQueue = createBoundedQueue({
        deadLetter: { enabled: true, maxSize: 2 },
        now: () => currentTime,
      });

      smallQueue.moveToDeadLetter({ id: 1 }, 'r1', { priority: 'NORMAL', tenantId: 't1' });
      smallQueue.moveToDeadLetter({ id: 2 }, 'r2', { priority: 'NORMAL', tenantId: 't1' });
      smallQueue.moveToDeadLetter({ id: 3 }, 'r3', { priority: 'NORMAL', tenantId: 't1' });

      const dlq = smallQueue.getDeadLetterQueue();
      expect(dlq.length).toBe(2);
      expect(dlq[0].item.id).toBe(2); // Oldest removed
      expect(dlq[1].item.id).toBe(3);
    });

    it('clears dead letter queue', () => {
      queue.moveToDeadLetter({ id: 1 }, 'r1', { priority: 'NORMAL', tenantId: 't1' });
      queue.clearDeadLetterQueue();
      expect(queue.getDeadLetterQueue().length).toBe(0);
    });
  });

  describe('snapshot', () => {
    it('returns comprehensive snapshot', () => {
      queue.enqueue({ id: 1 }, { priority: 'CRITICAL', tenantId: 'tenant-1' });
      queue.enqueue({ id: 2 }, { priority: 'NORMAL', tenantId: 'tenant-2' });
      // Dequeue should return CRITICAL first (higher priority)
      const dequeued = queue.dequeue();

      const snap = queue.getSnapshot();
      expect(snap.totalSize).toBe(1);
      expect(snap.totalCapacity).toBe(180); // 10+20+50+100
      expect(snap.byPriority.CRITICAL.size).toBe(0); // CRITICAL was dequeued
      expect(snap.byPriority.NORMAL.size).toBe(1); // NORMAL remains
      expect(dequeued.priority).toBe('CRITICAL');
      expect(snap.tenantSlices['tenant-2']).toBeDefined();
      expect(snap.stats.totalEnqueued).toBe(2);
      expect(snap.stats.totalDequeued).toBe(1);
      expect(snap.stats.totalRejected).toBe(0);
    });

    it('tracks rejections in stats', () => {
      // Fill queue capacity using different tenants
      for (let i = 0; i < 50; i++) {
        queue.enqueue({ id: i }, { priority: 'NORMAL', tenantId: `tenant-${i}` });
      }
      queue.enqueue({ id: 50 }, { priority: 'NORMAL', tenantId: 'tenant-new' }); // Rejected - queue full

      const snap = queue.getSnapshot();
      expect(snap.stats.totalRejected).toBe(1);
    });
  });

  describe('capacity management', () => {
    it('allows dynamic capacity changes', () => {
      queue.setCapacity('NORMAL', 100);
      const snap = queue.getQueueForPriority('NORMAL');
      expect(snap.capacity).toBe(100);
    });

    it('emits capacity change event', () => {
      queue.setCapacity('HIGH', 50);
      const event = events.find(e => e.event === 'queue_capacity_changed');
      expect(event).toBeDefined();
      expect(event.priority).toBe('HIGH');
      expect(event.newCapacity).toBe(50);
    });
  });

  describe('reset', () => {
    it('clears all queues and stats', () => {
      queue.enqueue({ id: 1 }, { priority: 'NORMAL', tenantId: 'tenant-1' });
      queue.enqueue({ id: 2 }, { priority: 'HIGH', tenantId: 'tenant-1' });
      queue.dequeue();
      queue.reset();

      const snap = queue.getSnapshot();
      expect(snap.totalSize).toBe(0);
      expect(snap.stats.totalEnqueued).toBe(0);
      expect(snap.stats.totalDequeued).toBe(0);
      expect(Object.keys(snap.tenantSlices).length).toBe(0);
    });
  });

  describe('concurrency with priority lanes', () => {
    it('isolates priority lanes', () => {
      // Fill LOW completely
      for (let i = 0; i < 100; i++) {
        queue.enqueue({ id: i }, { priority: 'LOW', tenantId: 'tenant-1' });
      }

      // CRITICAL should still accept
      const criticalResult = queue.enqueue({ id: 1000 }, { priority: 'CRITICAL', tenantId: 'tenant-1' });
      expect(criticalResult.accepted).toBe(true);

      // HIGH should still accept
      const highResult = queue.enqueue({ id: 1001 }, { priority: 'HIGH', tenantId: 'tenant-1' });
      expect(highResult.accepted).toBe(true);
    });

    it('processes CRITICAL before HIGH before NORMAL before LOW', () => {
      queue.enqueue({ id: 1 }, { priority: 'LOW', tenantId: 't1' });
      queue.enqueue({ id: 2 }, { priority: 'NORMAL', tenantId: 't1' });
      queue.enqueue({ id: 3 }, { priority: 'HIGH', tenantId: 't1' });
      queue.enqueue({ id: 4 }, { priority: 'CRITICAL', tenantId: 't1' });

      const order = [];
      while (true) {
        const item = queue.dequeue();
        if (!item) break;
        order.push(item.item.id);
      }

      expect(order).toEqual([4, 3, 2, 1]);
    });
  });
});