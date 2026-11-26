/**
 * tests/fixtures/civicContractTestMarketplaceSyntheticFixtures.js
 *
 * Synthetic fixtures for the Civic Service Integration Contract Test
 * Marketplace (#1191).
 *
 * These are synthetic, non-citizen records: made-up adapter ids, suite ids,
 * test ids, run ids, endpoints, and fabricated test outcomes. No citizen
 * records, credentials, raw documents or sensitive prompts are included. Safe
 * to commit and share.
 */

import {
  CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  CONTRACT_TEST_STATUS,
  CONTRACT_TEST_RESULT,
  ADAPTER_TYPE,
  TEST_TYPE,
  CONTRACT_SUITE_STATUS,
  DEFAULT_ADAPTER,
  DEFAULT_CONTRACT_SUITE,
  DEFAULT_CONTRACT_TEST,
  DEFAULT_CONTRACT_TEST_RUN
} from '../src/data/civicContractTestMarketplaceConstants.js';

const NOW = '2026-11-24T10:00:00Z';

/** A synthetic adapter id. */
export function syntheticAdapterId(label) {
  return `adapter-synth-${label}`;
}

/** A synthetic suite id. */
export function syntheticSuiteId(label) {
  return `suite-synth-${label}`;
}

/** A synthetic test id. */
export function syntheticTestId(label) {
  return `test-synth-${label}`;
}

/** A synthetic run id. */
export function syntheticRunId(label) {
  return `run-synth-${label}`;
}

/** A synthetic result id. */
export function syntheticResultId(label) {
  return `result-synth-${label}`;
}

/** A synthetic adapter. */
export function syntheticAdapter(overrides = {}) {
  return {
    id: overrides.id || syntheticAdapterId('default'),
    name: overrides.name || 'Synthetic Adapter',
    type: overrides.type || ADAPTER_TYPE.REST,
    baseUrl: overrides.baseUrl || 'https://example.gov.in/api',
    authType: overrides.authType || 'none',
    authConfig: overrides.authConfig || {},
    headers: overrides.headers || {},
    timeoutMs: overrides.timeoutMs ?? 5000,
    retryCount: overrides.retryCount ?? 2,
    isActive: overrides.isActive ?? true,
    description: overrides.description || 'A synthetic adapter for testing.',
    createdAt: overrides.createdAt || NOW,
    updatedAt: overrides.updatedAt || NOW,
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: true,
    ...overrides
  };
}

/** A synthetic contract suite. */
export function syntheticSuite(overrides = {}) {
  return {
    id: overrides.id || syntheticSuiteId('default'),
    name: overrides.name || 'Synthetic Suite',
    adapterId: overrides.adapterId || syntheticAdapterId('default'),
    description: overrides.description || 'A synthetic contract suite for testing.',
    status: overrides.status || CONTRACT_SUITE_STATUS.DRAFT,
    tests: overrides.tests || [],
    schedule: overrides.schedule || 'manual',
    lastRunAt: overrides.lastRunAt || null,
    lastRunStatus: overrides.lastRunStatus || null,
    createdAt: overrides.createdAt || NOW,
    updatedAt: overrides.updatedAt || NOW,
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: true,
    ...overrides
  };
}

/** A synthetic contract test. */
export function syntheticTest(overrides = {}) {
  return {
    id: overrides.id || syntheticTestId('default'),
    name: overrides.name || 'Synthetic Test',
    type: overrides.type || TEST_TYPE.CONFORMANCE,
    description: overrides.description || 'A synthetic contract test.',
    endpoint: overrides.endpoint || '/api/test',
    method: overrides.method || 'GET',
    requestSchema: overrides.requestSchema || {},
    responseSchema: overrides.responseSchema || {},
    expectedStatus: overrides.expectedStatus ?? 200,
    expectedHeaders: overrides.expectedHeaders || {},
    expectedBody: overrides.expectedBody || {},
    maxResponseTimeMs: overrides.maxResponseTimeMs ?? 5000,
    followRedirects: overrides.followRedirects ?? false,
    allowMalformedPayloads: overrides.allowMalformedPayloads ?? false,
    breakingChangeRules: overrides.breakingChangeRules || [],
    isCritical: overrides.isCritical ?? false,
    isEnabled: overrides.isEnabled ?? true
  };
}

/** A synthetic contract test run. */
export function syntheticRun(overrides = {}) {
  return {
    id: overrides.id || syntheticRunId('default'),
    suiteId: overrides.suiteId || syntheticSuiteId('default'),
    adapterId: overrides.adapterId || syntheticAdapterId('default'),
    status: overrides.status || CONTRACT_TEST_STATUS.COMPLETED,
    results: overrides.results || [],
    summary: overrides.summary || { total: 0, passed: 0, failed: 0, skipped: 0, errored: 0, warned: 0 },
    conformanceScore: overrides.conformanceScore ?? 0,
    breakingChanges: overrides.breakingChanges || [],
    maliciousPayloadsDetected: overrides.maliciousPayloadsDetected || [],
    startedAt: overrides.startedAt || NOW,
    completedAt: overrides.completedAt || NOW,
    durationMs: overrides.durationMs ?? 0,
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
    disclaimer: 'Review priority scores are deterministic triage hints derived from source change history, link health and last verification. They are not a truth score, do not constitute official verification, and never trigger an autonomous edit of civic guidance.',
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: true,
    ...overrides
  };
}

/** A synthetic test result. */
export function syntheticResult(overrides = {}) {
  return {
    id: overrides.id || syntheticResultId('default'),
    runId: overrides.runId || syntheticRunId('default'),
    testId: overrides.testId || syntheticTestId('default'),
    testName: overrides.testName || 'Synthetic Test',
    testType: overrides.testType || TEST_TYPE.CONFORMANCE,
    result: overrides.result || CONTRACT_TEST_RESULT.PASS,
    issues: overrides.issues || [],
    callResult: overrides.callResult || {
      statusCode: 200,
      latencyMs: 100,
      bodyLength: 500,
      headers: { 'content-type': 'application/json' }
    },
    timestamp: overrides.timestamp || NOW,
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
  };
}

/** A synthetic audit log entry. */
export function syntheticAuditLogEntry(overrides = {}) {
  return {
    id: overrides.id || `audit-synth-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    action: overrides.action || 'adapter.upsert',
    entityType: overrides.entityType || 'adapter',
    entityId: overrides.entityId || syntheticAdapterId('default'),
    actorRole: overrides.actorRole || 'operator',
    actorId: overrides.actorId || 'maintainer',
    reason: overrides.reason || 'Synthetic audit event.',
    details: overrides.details || {},
    timestamp: overrides.timestamp || NOW,
    schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
  };
}

export {
  NOW,
  CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  CONTRACT_TEST_STATUS,
  CONTRACT_TEST_RESULT,
  ADAPTER_TYPE,
  TEST_TYPE,
  CONTRACT_SUITE_STATUS,
  DEFAULT_ADAPTER,
  DEFAULT_CONTRACT_SUITE,
  DEFAULT_CONTRACT_TEST,
  DEFAULT_CONTRACT_TEST_RUN
};
