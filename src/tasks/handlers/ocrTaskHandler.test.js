import { describe, it, expect } from 'vitest';
import {
  handleOcrProcessingTask,
  createOcrProcessingTask,
  validateOcrPayload,
} from './ocrTaskHandler.js';

describe('ocrTaskHandler - createOcrProcessingTask', () => {
  it('creates a valid OCR processing task', () => {
    const task = createOcrProcessingTask({
      documentUrl: 'https://example.com/document.pdf',
    });
    expect(task.type).toBe('ocr-processing');
    expect(task.payload.documentUrl).toBe('https://example.com/document.pdf');
    expect(task.priority).toBe(3); // TaskPriority.HIGH
    expect(task.status).toBe('pending');
  });

  it('creates a task with custom language', () => {
    const task = createOcrProcessingTask({
      documentUrl: 'https://example.com/doc.png',
      language: 'ta', // Tamil
    });
    expect(task.payload.language).toBe('ta');
  });

  it('creates a task with tenantId', () => {
    const task = createOcrProcessingTask({
      documentUrl: 'https://example.com/doc.pdf',
      tenantId: 'municipality-5',
    });
    expect(task.tenantId).toBe('municipality-5');
  });

  it('creates a task with custom priority', () => {
    const task = createOcrProcessingTask({
      documentUrl: 'https://example.com/doc.pdf',
      priority: 1, // LOW
    });
    expect(task.priority).toBe(1);
  });

  it('creates a task with metadata', () => {
    const task = createOcrProcessingTask({
      documentUrl: 'https://example.com/doc.pdf',
      metadata: { source: 'upload-api', batchId: 'batch-123' },
    });
    expect(task.metadata.source).toBe('upload-api');
  });

  it('throws when documentUrl is missing', () => {
    expect(() =>
      createOcrProcessingTask({
        // documentUrl missing
      })
    ).toThrow('Document URL is required for OCR task');
  });

  it('throws when documentUrl is not a string', () => {
    expect(() =>
      createOcrProcessingTask({
        documentUrl: 123,
      })
    ).toThrow('Document URL is required for OCR task');
  });
});

describe('ocrTaskHandler - validateOcrPayload', () => {
  it('returns true for valid payload', () => {
    expect(validateOcrPayload({ documentUrl: 'https://example.com/doc.pdf' })).toBe(true);
  });

  it('returns false for missing documentUrl', () => {
    expect(validateOcrPayload({})).toBe(false);
  });

  it('returns false for non-string documentUrl', () => {
    expect(validateOcrPayload({ documentUrl: 123 })).toBe(false);
  });
});

describe('ocrTaskHandler - handleOcrProcessingTask', () => {
  it('processes an OCR task successfully', async () => {
    const task = {
      id: 'ocr-test-1',
      type: 'ocr-processing',
      payload: {
        documentUrl: 'https://example.com/sample.pdf',
        language: 'en',
      },
    };

    const result = await handleOcrProcessingTask(task);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.extractedText).toBeDefined();
    expect(result.language).toBe('en');
  });

  it('handles OCR task with custom language', async () => {
    const task = {
      id: 'ocr-test-2',
      type: 'ocr-processing',
      payload: {
        documentUrl: 'https://example.com/doc.pdf',
        language: 'bn', // Bengali
      },
    };

    const result = await handleOcrProcessingTask(task);
    expect(result.success).toBe(true);
    expect(result.language).toBe('bn');
  });

  it('throws on missing documentUrl', async () => {
    const task = {
      id: 'ocr-test-3',
      type: 'ocr-processing',
      payload: {},
    };

    await expect(handleOcrProcessingTask(task)).rejects.toThrow();
  });

  it('throws on missing documentUrl string', async () => {
    const task = {
      id: 'ocr-test-4',
      type: 'ocr-processing',
      payload: { documentUrl: 123 },
    };

    await expect(handleOcrProcessingTask(task)).rejects.toThrow();
  });

  it('includes task processing metadata in result', async () => {
    const task = {
      id: 'ocr-test-5',
      type: 'ocr-processing',
      payload: {
        documentUrl: 'https://example.com/doc.pdf',
      },
    };

    const result = await handleOcrProcessingTask(task);
    expect(result.taskProcessedAt).toBeDefined();
    expect(result.taskId).toBe('ocr-test-5');
    expect(result.workerProcessed).toBe(true);
    expect(result.processingSource).toBe('civic-help-setu-task-queue');
  });
});