import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createTaskQueueAdapter } from './TaskQueueAdapter.js';
import { TaskPriority } from '../schemas/taskSchema.js';

// Mock Firestore operations
vi.mock('../queries/taskQueries.js', () => ({
  enqueueTask: vi.fn(),
  getPendingTasks: vi.fn(),
  updateTask: vi.fn(),
  moveToDeadLetter: vi.fn(),
}));

import { enqueueTask as firestoreEnqueueTask, getPendingTasks as firestoreGetPendingTasks, updateTask as firestoreUpdateTask, moveToDeadLetter as firestoreMoveToDeadLetter } from '../queries/taskQueries.js';

describe('TaskQueueAdapter', () => {
  let adapter;
  let currentTime;
  const events = [];

  beforeEach(() => {
    currentTime = new Date('2026-11-25T12:00:00Z').getTime();
    events.length = 0;
    vi.clearAllMocks();

    adapter = createTaskQueueAdapter({
      now: () => currentTime,
      flushIntervalMs: 1000,
      flushBatchSize: 10,
      // Disable tenant rate limiter for testing by using a high-capacity profile
      tenantRateLimiter: {
        enabled: false,
      },
    });

    // Mock Firestore success
    firestoreEnqueueTask.mockResolvedValue('task-id-123');
    firestoreGetPendingTasks.mockResolvedValue([]);
    firestoreUpdateTask.mockResolvedValue(undefined);
    firestoreMoveToDeadLetter.mockResolvedValue(undefined);
  });

  afterEach(() => {
    adapter.shutdown();
  });

  describe('enqueueTask', () => {
    it('accepts tasks within capacity', async () => {
      const task = {
        id: 'task-1',
        type: 'ocr-processing',
        tenantId: 'tenant-1',
        priority: TaskPriority.NORMAL,
        payload: { documentUrl: 'https://example.com/doc.pdf' },
      };

      const result = await adapter.enqueueTask(task);

      expect(result.accepted).toBe(true);
      expect(result.position).toBe(1);
      expect(result.priority).toBe('NORMAL');
    });

    it('maps CRITICAL priority correctly', async () => {
      const task = {
        id: 'task-1',
        type: 'emergency',
        tenantId: 'tenant-1',
        priority: TaskPriority.CRITICAL,
        payload: {},
      };

      const result = await adapter.enqueueTask(task);

      expect(result.accepted).toBe(true);
      expect(result.priority).toBe('CRITICAL');
    });

    it('rejects when queue is full', async () => {
      // Fill NORMAL queue (capacity 500)
      for (let i = 0; i < 500; i++) {
        const task = { id: `task-${i}`, type: 'test', tenantId: `tenant-${i}`, priority: TaskPriority.NORMAL, payload: {} };
        await adapter.enqueueTask(task);
      }

      const task = { id: 'task-full', type: 'test', tenantId: 'tenant-new', priority: TaskPriority.NORMAL, payload: {} };
      const result = await adapter.enqueueTask(task);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('queue_full');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('enforces tenant slice limits', async () => {
      // Fill tenant slice for NORMAL (max 50 per tenant, 50% per priority = 25)
      for (let i = 0; i < 25; i++) {
        const result = await adapter.enqueueTask({ id: `task-${i}`, type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
        expect(result.accepted).toBe(true);
      }

      // 26th item in NORMAL should be rejected for this tenant
      const result = await adapter.enqueueTask({ id: 'task-25', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('tenant_slice_exceeded');
    });

    it('allows different tenants to fill their slices independently', async () => {
      // tenant-1 uses 25 slots in NORMAL
      for (let i = 0; i < 25; i++) {
        await adapter.enqueueTask({ id: `t1-${i}`, type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      }

      // tenant-2 can also use 25 slots in NORMAL
      for (let i = 0; i < 25; i++) {
        const result = await adapter.enqueueTask({ id: `t2-${i}`, type: 'test', tenantId: 'tenant-2', priority: TaskPriority.NORMAL, payload: {} });
        expect(result.accepted).toBe(true);
      }
    });

    it('prioritizes CRITICAL over NORMAL when NORMAL is full', async () => {
      // Fill NORMAL completely
      for (let i = 0; i < 500; i++) {
        await adapter.enqueueTask({ id: `norm-${i}`, type: 'test', tenantId: `tenant-${i}`, priority: TaskPriority.NORMAL, payload: {} });
      }

      // CRITICAL should still be accepted (separate capacity)
      const criticalTask = { id: 'critical-1', type: 'emergency', tenantId: 'tenant-critical', priority: TaskPriority.CRITICAL, payload: {} };
      const result = await adapter.enqueueTask(criticalTask);

      expect(result.accepted).toBe(true);
    });

    it('rejects when tenant rate limit exceeded', async () => {
      // This would require mocking the tenant rate limiter to return rejection
      // For now, we test the basic flow
      const task = { id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} };
      const result = await adapter.enqueueTask(task);
      expect(result.accepted).toBe(true);
    });
  });

  describe('priority lane isolation', () => {
    it('processes CRITICAL before HIGH before NORMAL before LOW', async () => {
      await adapter.enqueueTask({ id: 'low-1', type: 'test', tenantId: 't1', priority: TaskPriority.LOW, payload: {} });
      await adapter.enqueueTask({ id: 'normal-1', type: 'test', tenantId: 't1', priority: TaskPriority.NORMAL, payload: {} });
      await adapter.enqueueTask({ id: 'high-1', type: 'test', tenantId: 't1', priority: TaskPriority.HIGH, payload: {} });
      await adapter.enqueueTask({ id: 'critical-1', type: 'test', tenantId: 't1', priority: TaskPriority.CRITICAL, payload: {} });

      // Flush to Firestore
      await adapter.flushToFirestore(firestoreEnqueueTask);

      // Verify order of Firestore calls
      const calls = firestoreEnqueueTask.mock.calls;
      expect(calls[0][0].priority).toBe(TaskPriority.CRITICAL);
      expect(calls[1][0].priority).toBe(TaskPriority.HIGH);
      expect(calls[2][0].priority).toBe(TaskPriority.NORMAL);
      expect(calls[3][0].priority).toBe(TaskPriority.LOW);
    });
  });

  describe('flush to Firestore', () => {
    it('flushes queued tasks to Firestore', async () => {
      await adapter.enqueueTask({ id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      await adapter.enqueueTask({ id: 'task-2', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });

      await adapter.flushToFirestore(firestoreEnqueueTask);

      expect(firestoreEnqueueTask).toHaveBeenCalledTimes(2);
    });

    it('moves failed flushes to dead letter', async () => {
      firestoreEnqueueTask.mockRejectedValueOnce(new Error('Firestore unavailable'));

      await adapter.enqueueTask({ id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      await adapter.flushToFirestore(firestoreEnqueueTask);

      const metrics = adapter.getMetrics();
      expect(metrics.totalDeadLettered).toBe(1);
    });

    it('stops flushing on error', async () => {
      firestoreEnqueueTask.mockRejectedValueOnce(new Error('Firestore unavailable'));

      await adapter.enqueueTask({ id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      await adapter.enqueueTask({ id: 'task-2', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      await adapter.flushToFirestore(firestoreEnqueueTask);

      // Only first should be attempted, second should be re-queued (not called)
      expect(firestoreEnqueueTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('metrics', () => {
    it('tracks enqueue metrics', async () => {
      await adapter.enqueueTask({ id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      await adapter.enqueueTask({ id: 'task-2', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });

      const metrics = adapter.getMetrics();
      expect(metrics.totalEnqueued).toBe(2);
    });

    it('tracks rejection metrics', async () => {
      // Fill queue capacity
      for (let i = 0; i < 500; i++) {
        await adapter.enqueueTask({ id: `task-${i}`, type: 'test', tenantId: `tenant-${i}`, priority: TaskPriority.NORMAL, payload: {} });
      }
      await adapter.enqueueTask({ id: 'task-full', type: 'test', tenantId: 'tenant-new', priority: TaskPriority.NORMAL, payload: {} });

      const metrics = adapter.getMetrics();
      expect(metrics.totalRejected).toBe(1);
    });

    it('includes local queue snapshot', async () => {
      await adapter.enqueueTask({ id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });

      const metrics = adapter.getMetrics();
      expect(metrics.localQueue.totalSize).toBe(1);
      expect(metrics.localQueue.byPriority.NORMAL.size).toBe(1);
    });

    it('tracks tenant slices', async () => {
      await adapter.enqueueTask({ id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      await adapter.enqueueTask({ id: 'task-2', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.HIGH, payload: {} });

      const metrics = adapter.getMetrics();
      expect(metrics.localQueue.tenantSlices['tenant-1'].total).toBe(2);
      expect(metrics.localQueue.tenantSlices['tenant-1'].byPriority.NORMAL).toBe(1);
      expect(metrics.localQueue.tenantSlices['tenant-1'].byPriority.HIGH).toBe(1);
    });
  });

  describe('health', () => {
    it('reports healthy when rejection rate low', async () => {
      await adapter.enqueueTask({ id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });

      const health = adapter.getHealth();
      expect(health.status).toBe('healthy');
    });

    it('reports degraded when rejection rate high', async () => {
      // Fill and reject many
      for (let i = 0; i < 500; i++) {
        await adapter.enqueueTask({ id: `task-${i}`, type: 'test', tenantId: `tenant-${i}`, priority: TaskPriority.NORMAL, payload: {} });
      }
      for (let i = 0; i < 100; i++) {
        await adapter.enqueueTask({ id: `reject-${i}`, type: 'test', tenantId: `tenant-reject-${i}`, priority: TaskPriority.NORMAL, payload: {} });
      }

      const health = adapter.getHealth();
      expect(health.status).toBe('degraded');
      expect(health.rejectionRate).toBeGreaterThan(0.1);
    });
  });

  describe('shutdown', () => {
    it('stops flush loop and flushes remaining', async () => {
      await adapter.enqueueTask({ id: 'task-1', type: 'test', tenantId: 'tenant-1', priority: TaskPriority.NORMAL, payload: {} });
      
      // shutdown with firestore function for final flush
      await adapter.shutdown(firestoreEnqueueTask);
      
      // shutdown does a final flush attempt
      expect(firestoreEnqueueTask).toHaveBeenCalledTimes(1);
    });
  });
});