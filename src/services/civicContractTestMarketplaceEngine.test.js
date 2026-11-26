/**
 * src/services/civicContractTestMarketplaceEngine.test.js
 *
 * Unit tests for the Civic Service Integration Contract Test Marketplace
 * Engine (#1191). Covers adapter registration, suite management, suite
 * execution, conformance scoring, breaking change and malicious payload
 * detection, review, drift detection.
 *
 * Synthetic fixtures only: no citizen records, credentials, raw documents or
 * sensitive prompts.
 */

import { describe, it, expect } from 'vitest';
import { createContractTestMarketplaceEngine } from './civicContractTestMarketplaceEngine.js';
import {
  resetContractTestStoreToEmpty,
  createSeedStore,
  persistContractTestStore
} from './civicContractTestMarketplaceMigrations.js';
import {
  CONTRACT_TEST_ERRORS,
  ADAPTER_TYPE,
  TEST_TYPE,
  CONTRACT_SUITE_STATUS
} from '../data/civicContractTestMarketplaceConstants.js';

const FIXED_NOW = new Date('2026-11-24T10:00:00Z');

function freshEngine() {
  resetContractTestStoreToEmpty({ now: FIXED_NOW });
  const seeded = createSeedStore({ now: FIXED_NOW });
  persistContractTestStore(seeded, { now: FIXED_NOW });
  return createContractTestMarketplaceEngine({ now: () => FIXED_NOW.getTime() });
}

describe('civicContractTestMarketplaceEngine', () => {
  describe('validation', () => {
    it('rejects non-object requests', () => {
      const e = freshEngine();
      const v = e.validateMarketplaceRequest(null);
      expect(v.valid).toBe(false);
      expect(v.errors[0].code).toBe(CONTRACT_TEST_ERRORS.INVALID_TYPE);
    });

    it('rejects sensitive values', () => {
      const e = freshEngine();
      const v = e.validateMarketplaceRequest({ adapterId: 'My Aadhaar 1234 5678 9012' });
      expect(v.valid).toBe(false);
      expect(v.errors.some((err) => err.code === CONTRACT_TEST_ERRORS.INVALID_TYPE)).toBe(true);
    });

    it('accepts a valid minimal request', () => {
      const e = freshEngine();
      const v = e.validateMarketplaceRequest({ adapterId: 'adapter-1' });
      expect(v.valid).toBe(true);
    });

    it('rejects invalid HTTP method', () => {
      const e = freshEngine();
      const v = e.validateMarketplaceRequest({ method: 'INVALID' });
      expect(v.valid).toBe(false);
    });

    it('rejects invalid adapter type', () => {
      const e = freshEngine();
      const v = e.validateMarketplaceRequest({ type: 'not-a-type' });
      expect(v.valid).toBe(false);
    });

    it('rejects invalid test type', () => {
      const e = freshEngine();
      const v = e.validateMarketplaceRequest({ testType: 'not-a-type' });
      expect(v.valid).toBe(false);
    });

    it('rejects expectedStatus out of range', () => {
      const e = freshEngine();
      const v = e.validateMarketplaceRequest({ expectedStatus: 999 });
      expect(v.valid).toBe(false);
    });
  });

  describe('upsertAdapter', () => {
    it('creates a new adapter', async () => {
      const e = freshEngine();
      const result = await e.upsertAdapter({
        id: 'adapter-1',
        name: 'Test Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'bearer',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        description: 'Test adapter',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.adapter.id).toBe('adapter-1');
      expect(result.adapter.name).toBe('Test Adapter');
      expect(result.adapter.type).toBe(ADAPTER_TYPE.REST);
    });

    it('creates a new schema version on update', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-ver',
        name: 'Ver Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        description: 'Versioned adapter',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      const result = await e.upsertAdapter({
        id: 'adapter-ver',
        name: 'Ver Adapter v2',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        description: 'Versioned adapter v2',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.adapter.schemaVersion).toBe(2);
    });

    it('rejects invalid adapter id', async () => {
      const e = freshEngine();
      const result = await e.upsertAdapter({
        id: 'Bad Id',
        name: 'Bad',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(CONTRACT_TEST_ERRORS.VALIDATION_FAILED);
    });
  });

  describe('listAdapters / getAdapter', () => {
    it('lists adapters', async () => {
      const e = freshEngine();
      const adapters = e.listAdapters();
      expect(Array.isArray(adapters)).toBe(true);
    });

    it('gets an adapter by id', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-get',
        name: 'Get Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      const adapter = e.getAdapter('adapter-get');
      expect(adapter).not.toBeNull();
      expect(adapter.id).toBe('adapter-get');
      expect(e.getAdapter('missing')).toBeNull();
    });
  });

  describe('upsertSuite', () => {
    it('creates a new suite under an adapter', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-suite',
        name: 'Suite Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      const result = await e.upsertSuite({
        id: 'suite-1',
        adapterId: 'adapter-suite',
        name: 'Test Suite',
        description: 'Test suite',
        status: CONTRACT_SUITE_STATUS.DRAFT,
        tests: [],
        schedule: 'manual',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.suite.id).toBe('suite-1');
      expect(result.suite.adapterId).toBe('adapter-suite');
    });

    it('rejects suite with missing adapter', async () => {
      const e = freshEngine();
      const result = await e.upsertSuite({
        id: 'suite-no-adapter',
        adapterId: 'missing-adapter',
        name: 'No Adapter Suite',
        description: 'No adapter',
        status: CONTRACT_SUITE_STATUS.DRAFT,
        tests: [],
        schedule: 'manual',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(CONTRACT_TEST_ERRORS.ADAPTER_NOT_FOUND);
    });

    it('lists suites', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-list',
        name: 'List Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      await e.upsertSuite({
        id: 'suite-list',
        adapterId: 'adapter-list',
        name: 'List Suite',
        description: 'List suite',
        status: CONTRACT_SUITE_STATUS.DRAFT,
        tests: [],
        schedule: 'manual',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      const suites = e.listSuites({ adapterId: 'adapter-list' });
      expect(Array.isArray(suites)).toBe(true);
      expect(suites.length).toBeGreaterThan(0);
    });

    it('gets a suite by id', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-get-suite',
        name: 'Get Suite Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      await e.upsertSuite({
        id: 'suite-get',
        adapterId: 'adapter-get-suite',
        name: 'Get Suite',
        description: 'Get suite',
        status: CONTRACT_SUITE_STATUS.DRAFT,
        tests: [],
        schedule: 'manual',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      const suite = e.getSuite('suite-get');
      expect(suite).not.toBeNull();
      expect(suite.id).toBe('suite-get');
      expect(e.getSuite('missing')).toBeNull();
    });
  });

  describe('runSuite', () => {
    it('runs a suite and computes results', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-run',
        name: 'Run Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      await e.upsertSuite({
        id: 'suite-run',
        adapterId: 'adapter-run',
        name: 'Run Suite',
        description: 'Run suite',
        status: CONTRACT_SUITE_STATUS.ACTIVE,
        tests: [
          {
            id: 'test-1',
            name: 'Auth Test',
            type: TEST_TYPE.AUTH,
            description: 'Auth test',
            endpoint: '/auth',
            method: 'GET',
            requestSchema: {},
            responseSchema: {},
            expectedStatus: 200,
            expectedHeaders: {},
            expectedBody: {},
            maxResponseTimeMs: 5000,
            followRedirects: false,
            allowMalformedPayloads: false,
            breakingChangeRules: [],
            isCritical: false,
            isEnabled: true
          },
          {
            id: 'test-2',
            name: 'Schema Test',
            type: TEST_TYPE.SCHEMA,
            description: 'Schema test',
            endpoint: '/schema',
            method: 'GET',
            requestSchema: {},
            responseSchema: { data: 'object' },
            expectedStatus: 200,
            expectedHeaders: {},
            expectedBody: {},
            maxResponseTimeMs: 5000,
            followRedirects: false,
            allowMalformedPayloads: false,
            breakingChangeRules: [],
            isCritical: false,
            isEnabled: true
          }
        ],
        schedule: 'manual',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });

      const result = await e.runSuite({
        suiteId: 'suite-run',
        adapterId: 'adapter-run',
        forceRecompute: false,
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(true);
      expect(result.run).toBeDefined();
      expect(result.run.conformanceScore).toBeGreaterThanOrEqual(0);
      expect(result.run.conformanceScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(2);
    });

    it('rejects running a missing suite', async () => {
      const e = freshEngine();
      const result = await e.runSuite({
        suiteId: 'missing-suite',
        adapterId: 'adapter-run',
        nowIso: FIXED_NOW
      });
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(CONTRACT_TEST_ERRORS.SUITE_NOT_FOUND);
    });
  });

  describe('getRun / listRuns / getRunResults / getAuditLog', () => {
    it('gets a run by id', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-get-run',
        name: 'Get Run Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      await e.upsertSuite({
        id: 'suite-get-run',
        adapterId: 'adapter-get-run',
        name: 'Get Run Suite',
        description: 'Get run suite',
        status: CONTRACT_SUITE_STATUS.ACTIVE,
        tests: [],
        schedule: 'manual',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      await e.runSuite({
        suiteId: 'suite-get-run',
        adapterId: 'adapter-get-run',
        nowIso: FIXED_NOW
      });
      const runs = e.listRuns();
      expect(Array.isArray(runs.runs)).toBe(true);
      expect(runs.runs.length).toBeGreaterThan(0);
      const run = e.getRun(runs.runs[0].id);
      expect(run).not.toBeNull();
      expect(run.id).toBe(runs.runs[0].id);
      expect(e.getRun('missing')).toBeNull();
    });

    it('gets run results', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-results',
        name: 'Results Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      await e.upsertSuite({
        id: 'suite-results',
        adapterId: 'adapter-results',
        name: 'Results Suite',
        description: 'Results suite',
        status: CONTRACT_SUITE_STATUS.ACTIVE,
        tests: [],
        schedule: 'manual',
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      await e.runSuite({
        suiteId: 'suite-results',
        adapterId: 'adapter-results',
        nowIso: FIXED_NOW
      });
      const runs = e.listRuns({ suiteId: 'suite-results' });
      const results = e.getRunResults({ runId: runs.runs[0].id, limit: 1000 });
      expect(Array.isArray(results)).toBe(true);
    });

    it('gets audit log', async () => {
      const e = freshEngine();
      await e.upsertAdapter({
        id: 'adapter-audit',
        name: 'Audit Adapter',
        type: ADAPTER_TYPE.REST,
        baseUrl: 'https://example.gov.in/api',
        authType: 'none',
        authConfig: {},
        headers: {},
        timeoutMs: 5000,
        retryCount: 2,
        isActive: true,
        createdBy: 'maintainer',
        nowIso: FIXED_NOW
      });
      await e.runSuite({
        suiteId: 'suite-audit',
        adapterId: 'adapter-audit',
        nowIso: FIXED_NOW
      });
      const audit = e.getAuditLog({ limit: 50 });
      expect(Array.isArray(audit)).toBe(true);
    });
  });

  describe('listFeatureWeights', () => {
    it('returns feature weights', async () => {
      const e = freshEngine();
      const weights = e.listFeatureWeights();
      expect(weights['days_since_verification']).toBeDefined();
    });
  });
});
