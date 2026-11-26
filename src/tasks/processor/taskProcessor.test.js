import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import TaskWorker from './taskProcessor.js';

// Note: TaskWorker.start() runs indefinitely, so we test the constructor
// and individual methods where possible.

describe('TaskWorker - constructor', () => {
  it('creates a worker with default options', () => {
    const worker = new TaskWorker();
    expect(worker.workerId).toBeDefined();
    expect(worker.tenantId).toBeUndefined();
    expect(worker.maxConcurrent).toBe(5);
    expect(worker.capabilities).toEqual(['*']);
    expect(worker.isRunning).toBe(false);
    expect(worker.tasksProcessed).toBe(0);
    expect(worker.tasksFailed).toBe(0);
    expect(worker.tasksDeadLettered).toBe(0);
  });

  it('creates a worker with custom options', () => {
    const worker = new TaskWorker({
      tenantId: 'tenant-1',
      maxConcurrent: 10,
      capabilities: ['ocr-processing', 'grievance-classification'],
    });
    expect(worker.tenantId).toBe('tenant-1');
    expect(worker.maxConcurrent).toBe(10);
    expect(worker.capabilities).toEqual(['ocr-processing', 'grievance-classification']);
  });
});

describe('TaskWorker - createWorker', () => {
  it('creates a worker via factory function', () => {
    const worker = TaskWorker.createWorker({
      tenantId: 'tenant-2',
      maxConcurrent: 3,
    });
    expect(worker.tenantId).toBe('tenant-2');
    expect(worker.maxConcurrent).toBe(3);
  });
});

describe('TaskWorker - processTaskOnce', () => {
  it('returns a result for processTaskOnce (placeholder)', async () => {
    const task = {
      id: 'test-task',
      type: 'grievance-classification',
      payload: {
        grievanceText: 'Pothole on Main Street',
      },
    };

    // This is a stub - processTaskOnce is not fully implemented for one-shot
    // In practice, use TaskWorker.start() for continuous processing
    const result = await TaskWorker.processTaskOnce(task);
    // Should not throw, even if it returns a placeholder
    expect(result).toBeDefined();
  });
});