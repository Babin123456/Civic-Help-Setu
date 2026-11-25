import { describe, it, expect } from 'vitest';
import {
  handleGrievanceClassificationTask,
  createGrievanceClassificationTask,
  validateGrievancePayload,
} from './grievanceTaskHandler.js';

describe('grievanceTaskHandler - createGrievanceClassificationTask', () => {
  it('creates a valid grievance classification task', () => {
    const task = createGrievanceClassificationTask({
      grievanceText: 'Pothole on Main Street causing accidents',
    });
    expect(task.type).toBe('grievance-classification');
    expect(task.payload.grievanceText).toBe('Pothole on Main Street causing accidents');
    expect(task.priority).toBe(2); // TaskPriority.NORMAL
    expect(task.status).toBe('pending');
  });

  it('creates a task with custom priority', () => {
    const task = createGrievanceClassificationTask({
      grievanceText: 'Urgent: flooding in basement',
      priority: 4, // CRITICAL
    });
    expect(task.priority).toBe(4);
  });

  it('creates a task with tenantId', () => {
    const task = createGrievanceClassificationTask({
      grievanceText: 'Road damage',
      tenantId: 'municipality-5',
    });
    expect(task.tenantId).toBe('municipality-5');
  });

  it('creates a task with metadata', () => {
    const task = createGrievanceClassificationTask({
      grievanceText: 'Parking issue',
      metadata: { source: 'web-app', createdBy: 'admin-user' },
    });
    expect(task.metadata.source).toBe('web-app');
    expect(task.metadata.createdBy).toBe('admin-user');
  });

  it('throws when grievanceText is missing', () => {
    expect(() =>
      createGrievanceClassificationTask({
        // grievanceText missing
      })
    ).toThrow('Grievance text is required');
  });

  it('throws when grievanceText is not a string', () => {
    expect(() =>
      createGrievanceClassificationTask({
        grievanceText: 123,
      })
    ).toThrow('Grievance text is required');
  });
});

describe('grievanceTaskHandler - validateGrievancePayload', () => {
  it('returns true for valid payload', () => {
    expect(validateGrievancePayload({ grievanceText: 'Test complaint' })).toBe(true);
  });

  it('returns false for missing grievanceText', () => {
    expect(validateGrievancePayload({})).toBe(false);
  });

  it('returns false for non-string grievanceText', () => {
    expect(validateGrievancePayload({ grievanceText: 123 })).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateGrievancePayload({ grievanceText: '' })).toBe(false);
  });
});

describe('grievanceTaskHandler - handleGrievanceClassificationTask', () => {
  it('classifies a valid grievance text', async () => {
    const task = {
      id: 'test-task-1',
      type: 'grievance-classification',
      payload: {
        grievanceText: 'Pothole on Main Street causing accidents',
      },
    };

    const result = await handleGrievanceClassificationTask(task);
    expect(result).toBeDefined();
    expect(result.isValid).toBe(true);
    expect(result.category).toBeDefined();
  });

  it('handles grievance with options', async () => {
    const task = {
      id: 'test-task-2',
      type: 'grievance-classification',
      payload: {
        grievanceText: 'Water contamination in supply',
        options: { jurisdiction: 'city' },
      },
    };

    const result = await handleGrievanceClassificationTask(task);
    expect(result.isValid).toBe(true);
    expect(result.category).toBeDefined();
  });

  it('falls back to ambiguous when no keywords match', async () => {
    const task = {
      id: 'test-task-3',
      type: 'grievance-classification',
      payload: {
        grievanceText: 'Some random issue without specific keywords',
      },
    };

    const result = await handleGrievanceClassificationTask(task);
    expect(result.isValid).toBe(true);
    expect(result.category).toBe('AMBIGUOUS_MULTI_DEPARTMENT');
    expect(result.isAmbiguous).toBe(true);
  });

  it('includes task processing metadata in result', async () => {
    const task = {
      id: 'test-task-4',
      type: 'grievance-classification',
      payload: {
        grievanceText: 'Pothole on Main Street',
      },
    };

    const result = await handleGrievanceClassificationTask(task);
    expect(result.taskProcessedAt).toBeDefined();
    expect(result.taskId).toBe('test-task-4');
    expect(result.workerProcessed).toBe(true);
    expect(result.classificationSource).toBe('civic-help-setu-task-queue');
  });

  it('throws on missing grievanceText in payload', async () => {
    const task = {
      id: 'test-task-5',
      type: 'grievance-classification',
      payload: {},
    };

    await expect(handleGrievanceClassificationTask(task)).rejects.toThrow();
  });
});