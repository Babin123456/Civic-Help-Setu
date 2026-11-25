/**
 * api/_lib/civicContractTestMarketplaceSchemas.test.js
 *
 * Unit tests for versioned request/response validation contracts of the Civic
 * Service Integration Contract Test Marketplace API (#1191).
 */

import { describe, it, expect } from 'vitest';
import {
  validateUpsertAdapter,
  validateUpsertSuite,
  validateRunSuite,
  validateListQuery,
  validateRecordDrift,
  schemaVersion
} from './civicContractTestMarketplaceSchemas.js';

describe('civicContractTestMarketplaceSchemas', () => {
  it('reports the schema version', () => {
    expect(schemaVersion()).toBe(1);
  });

  describe('validateUpsertAdapter', () => {
    it('accepts a valid upsert adapter request', () => {
      const v = validateUpsertAdapter({
        id: 'adapter-1',
        name: 'Test Adapter',
        type: 'rest',
        baseUrl: 'https://example.gov.in/api',
        authType: 'bearer',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        description: 'Test adapter'
      });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid adapter id', () => {
      const v = validateUpsertAdapter({ id: 'Bad Id' });
      expect(v.valid).toBe(false);
    });

    it('rejects invalid adapter type', () => {
      const v = validateUpsertAdapter({ id: 'adapter-1', type: 'not-a-type' });
      expect(v.valid).toBe(false);
    });

    it('rejects invalid auth type', () => {
      const v = validateUpsertAdapter({ id: 'adapter-1', type: 'rest', authType: 'not-a-type' });
      expect(v.valid).toBe(false);
    });

    it('rejects timeoutMs out of range', () => {
      const v = validateUpsertAdapter({ id: 'adapter-1', type: 'rest', timeoutMs: 0 });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateUpsertSuite', () => {
    it('accepts a valid upsert suite request', () => {
      const v = validateUpsertSuite({
        id: 'suite-1',
        adapterId: 'adapter-1',
        name: 'Test Suite',
        description: 'Test suite',
        status: 'active',
        tests: [],
        schedule: 'manual'
      });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid suite id', () => {
      const v = validateUpsertSuite({ id: 'Bad Id' });
      expect(v.valid).toBe(false);
    });

    it('rejects invalid status', () => {
      const v = validateUpsertSuite({ id: 'suite-1', adapterId: 'adapter-1', status: 'not-a-status' });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateRunSuite', () => {
    it('accepts a valid run suite request', () => {
      const v = validateRunSuite({ suiteId: 'suite-1', adapterId: 'adapter-1', forceRecompute: false });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid suiteId', () => {
      const v = validateRunSuite({ suiteId: 'Bad Id' });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateListQuery', () => {
    it('accepts a valid list query', () => {
      const v = validateListQuery({ adapterId: 'adapter-1', status: 'completed', limit: 10 });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid status', () => {
      const v = validateListQuery({ status: 'not-a-status' });
      expect(v.valid).toBe(false);
    });

    it('rejects limit out of range', () => {
      const v = validateListQuery({ limit: 0 });
      expect(v.valid).toBe(false);
    });
  });

  describe('validateRecordDrift', () => {
    it('accepts a valid drift event', () => {
      const v = validateRecordDrift({
        runId: 'run-1',
        previousScore: 0.4,
        currentScore: 0.75,
        reason: 'Link health deteriorated.'
      });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid runId', () => {
      const v = validateRecordDrift({ runId: 'Bad Id' });
      expect(v.valid).toBe(false);
    });

    it('rejects score out of range', () => {
      const v = validateRecordDrift({ runId: 'run-1', previousScore: 1.5 });
      expect(v.valid).toBe(false);
    });
  });
});
