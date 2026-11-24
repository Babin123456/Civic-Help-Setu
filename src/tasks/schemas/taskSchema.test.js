import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskPriority,
  TaskStatus,
  createTask,
  validateTask,
  fromFirestore,
  toFirestore,
  computeEffectivePriority,
} from './taskSchema.js';

describe('taskSchema - Priority Levels', () => {
  it('defines all priority level constants', () => {
    expect(TaskPriority.LOW).toBe(1);
    expect(TaskPriority.NORMAL).toBe(2);
    expect(TaskPriority.HIGH).toBe(3);
    expect(TaskPriority.CRITICAL).toBe(4);
  });

  it('priorities are in correct ascending order', () => {
    expect(TaskPriority.LOW < TaskPriority.NORMAL).toBe(true);
    expect(TaskPriority.NORMAL < TaskPriority.HIGH).toBe(true);
    expect(TaskPriority.HIGH < TaskPriority.CRITICAL).toBe(true);
  });
});

describe('taskSchema - Status Levels', () => {
  it('defines all status constants', () => {
    expect(TaskStatus.PENDING).toBe('pending');
    expect(TaskStatus.PROCESSING).toBe('processing');
    expect(TaskStatus.COMPLETED).toBe('completed');
    expect(TaskStatus.FAILED).toBe('failed');
    expect(TaskStatus.DEAD_LETTER).toBe('dead_letter');
  });
});

describe('taskSchema - createTask', () => {
  it('creates a valid task with default priority', () => {
    const task = createTask({ type: 'test-type' });
    expect(task.type).toBe('test-type');
    expect(task.priority).toBe(TaskPriority.NORMAL);
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.retryCount).toBe(0);
    expect(task.maxRetries).toBe(3);
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
    expect(task._schemaVersion).toBe('1.0.0');
  });

  it('creates a task with custom priority', () => {
    const task = createTask({ type: 'urgent', priority: TaskPriority.CRITICAL });
    expect(task.priority).toBe(TaskPriority.CRITICAL);
  });

  it('creates a task with tenantId', () => {
    const task = createTask({ type: 'test', tenantId: 'tenant-123' });
    expect(task.tenantId).toBe('tenant-123');
  });

  it('creates a task with payload', () => {
    const task = createTask({ type: 'test', payload: { key: 'value' } });
    expect(task.payload).toEqual({ key: 'value' });
  });

  it('creates a task with metadata', () => {
    const task = createTask({ type: 'test', metadata: { source: 'test' } });
    expect(task.metadata).toHaveProperty('source', 'test');
  });
});

describe('taskSchema - validateTask', () => {
  it('validates a properly structured task', () => {
    const task = createTask({ type: 'valid-task' });
    const result = validateTask(task);
    expect(result).toBe(true);
  });

  it('throws on missing id', () => {
    expect(() => validateTask({ type: 'test' })).toThrow('Task must have an id field');
  });

  it('throws on missing type', () => {
    expect(() => validateTask({ id: '1' })).toThrow('Task must have a type field');
  });

  it('throws on invalid status', () => {
    const task = createTask({ type: 'test' });
    expect(() => { validateTask({ ...task, status: 'invalid-status' }); }).toThrow();
  });

  it('throws on invalid priority', () => {
    const task = createTask({ type: 'test' });
    expect(() => { validateTask({ ...task, priority: 99 }); }).toThrow();
  });

  it('throws on negative retryCount', () => {
    const task = createTask({ type: 'test' });
    expect(() => { validateTask({ ...task, retryCount: -1 }); }).toThrow();
  });

  it('throws on zero maxRetries', () => {
    const task = createTask({ type: 'test' });
    expect(() => { validateTask({ ...task, maxRetries: 0 }); }).toThrow();
  });
});

describe('taskSchema - fromFirestore', () => {
  it('converts Firestore document to task object', () => {
    const firestoreTask = {
      id: 'task-123',
      type: 'test-type',
      priority: 3,
      status: 'pending',
      payload: { doc: 'data' },
      metadata: { source: 'test' },
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _schemaVersion: '1.0.0',
    };

    const task = fromFirestore(firestoreTask);
    expect(task.id).toBe('task-123');
    expect(task.type).toBe('test-type');
    expect(task.priority).toBe(3);
  });

  it('handles null input', () => {
    expect(fromFirestore(null)).toBeNull();
  });
});

describe('taskSchema - toFirestore', () => {
  it('converts task to Firestore-compatible object', () => {
    const task = createTask({ type: 'test' });
    const firestore = toFirestore(task);
    expect(firestore.id).toBeDefined();
    expect(firestore.type).toBe('test');
    // Internal markers (_schemaVersion, _path) should be stripped
    expect(firestore._schemaVersion).toBeUndefined();
    expect(firestore._path).toBeUndefined();
  });
});

describe('taskSchema - computeEffectivePriority', () => {
  it('returns the original priority for recently queued tasks', () => {
    const task = createTask({ type: 'test', priority: TaskPriority.LOW });
    // Recently queued - should keep original priority
    const effPriority = computeEffectivePriority(task, Date.now());
    expect(effPriority).toBe(TaskPriority.LOW);
  });

  it('promotes LOW priority after 2 hours', () => {
    // Create a task queued 3 hours ago at LOW priority
    const oldTime = Date.now() - 3 * 60 * 60 * 1000;
    const task = createTask({ type: 'test', priority: TaskPriority.LOW });
    // Mock the queuedAt time
    task.agingInfo = {
      queuedAt: new Date(oldTime).toISOString(),
      lastPromotionAt: new Date(oldTime).toISOString(),
    };
    const effPriority = computeEffectivePriority(task);
    // After 3 hours at LOW, should promote to NORMAL
    expect(effPriority).toBe(TaskPriority.NORMAL);
  });

  it('promotes NORMAL to HIGH after 6 hours', () => {
    const oldTime = Date.now() - 7 * 60 * 60 * 1000;
    const task = createTask({ type: 'test', priority: TaskPriority.NORMAL });
    task.agingInfo = {
      queuedAt: new Date(oldTime).toISOString(),
      lastPromotionAt: new Date(oldTime).toISOString(),
    };
    const effPriority = computeEffectivePriority(task);
    // After 7 hours at NORMAL, should promote to HIGH
    expect(effPriority).toBe(TaskPriority.HIGH);
  });

  it('promotes HIGH to CRITICAL after 14 hours', () => {
    const oldTime = Date.now() - 15 * 60 * 60 * 1000;
    const task = createTask({ type: 'test', priority: TaskPriority.HIGH });
    task.agingInfo = {
      queuedAt: new Date(oldTime).toISOString(),
      lastPromotionAt: new Date(oldTime).toISOString(),
    };
    const effPriority = computeEffectivePriority(task);
    // After 15 hours at HIGH, should promote to CRITICAL
    expect(effPriority).toBe(TaskPriority.CRITICAL);
  });
});