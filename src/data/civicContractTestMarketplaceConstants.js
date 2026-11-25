/**
 * src/data/civicContractTestMarketplaceConstants.js
 *
 * Versioned schema, enums, error codes, storage keys, adapter types, contract
 * test types, and default configuration for the Civic Service Integration
 * Contract Test Marketplace (#1191).
 *
 * Purpose: External civic data providers and internal modules need repeatable
 * tests for API compatibility and data quality. This module defines the
 * machine-readable schema for provider adapters, reusable contract suites, and
 * contract test execution records.
 *
 * All outputs are conformance reports for maintainer review. They never
 * autonomously edit provider configurations, file applications, deny benefits,
 * or claim official verification. No citizen records, credentials, raw
 * documents, or sensitive prompts are persisted (inputs are hashed; only
 * lengths and resource identifiers are stored).
 */

export const CIVIC_CONTRACT_TEST_SCHEMA_VERSION = 1;
export const CIVIC_CONTRACT_TEST_STORAGE_KEY = 'civicbridge_contract_test_marketplace_v1';
export const CIVIC_CONTRACT_TEST_REVIEW_DATE = '2026-11-24';
export const CIVIC_CONTRACT_TEST_STALE_AFTER_DAYS = 90;
export const CIVIC_CONTRACT_TEST_DISCLAIMER =
  'Contract test results are deterministic conformance checks derived from ' +
  'provider adapter responses against declared contracts. They are diagnostic ' +
  'hints for maintainer review, not a certification, not an authorization, and ' +
  'never trigger an autonomous change to any provider or service.';

export const CONTRACT_TEST_STATUS = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  STALE: 'stale'
});

export const CONTRACT_TEST_ERRORS = Object.freeze({
  INVALID_REQUEST: 'CT_INVALID_REQUEST',
  INVALID_TYPE: 'CT_INVALID_TYPE',
  ADAPTER_NOT_FOUND: 'CT_ADAPTER_NOT_FOUND',
  SUITE_NOT_FOUND: 'CT_SUITE_NOT_FOUND',
  TEST_NOT_FOUND: 'CT_TEST_NOT_FOUND',
  RUN_NOT_FOUND: 'CT_RUN_NOT_FOUND',
  VALIDATION_FAILED: 'CT_VALIDATION_FAILED',
  STORAGE_UNAVAILABLE: 'CT_STORAGE_UNAVAILABLE',
  CONCURRENT_WRITE: 'CT_CONCURRENT_WRITE',
  STALE_DATA: 'CT_STALE_DATA',
  ADAPTER_ERROR: 'CT_ADAPTER_ERROR',
  SCHEMA_MISMATCH: 'CT_SCHEMA_MISMATCH',
  MALICIOUS_PAYLOAD: 'CT_MALICIOUS_PAYLOAD',
  BREAKING_CHANGE: 'CT_BREAKING_CHANGE',
  PERMISSION_DENIED: 'CT_PERMISSION_DENIED'
});

export const CONTRACT_TEST_RESULT = Object.freeze({
  PASS: 'pass',
  FAIL: 'fail',
  SKIP: 'skip',
  ERROR: 'error',
  WARN: 'warn'
});

export const ADAPTER_TYPE = Object.freeze({
  REST: 'rest',
  SOAP: 'soap',
  GRAPHQL: 'graphql',
  FILE: 'file',
  DATABASE: 'database',
  MESSAGE_QUEUE: 'message_queue'
});

export const TEST_TYPE = Object.freeze({
  AUTH: 'auth',
  SCHEMA: 'schema',
  PAGINATION: 'pagination',
  FRESHNESS: 'freshness',
  ERROR_BEHAVIOR: 'error_behavior',
  BREAKING_CHANGE: 'breaking_change',
  MALICIOUS_PAYLOAD: 'malicious_payload',
  CONFORMANCE: 'conformance'
});

export const CONTRACT_SUITE_STATUS = Object.freeze({
  ACTIVE: 'active',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
  DEPRECATED: 'deprecated'
});

/**
 * A provider adapter descriptor. Machine-readable and deterministic.
 */
export const DEFAULT_ADAPTER = Object.freeze({
  id: '',
  name: '',
  type: ADAPTER_TYPE.REST,
  baseUrl: '',
  authType: 'none',
  authConfig: {},
  headers: {},
  timeoutMs: 10000,
  retryCount: 2,
  retryDelayMs: 1000,
  isActive: true,
  description: '',
  createdAt: '',
  updatedAt: '',
  schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  noCitizenData: true,
  untrusted: true,
  requiresHumanReview: true
});

/**
 * A contract test definition (one check within a suite).
 */
export const DEFAULT_CONTRACT_TEST = Object.freeze({
  id: '',
  name: '',
  type: TEST_TYPE.CONFORMANCE,
  description: '',
  endpoint: '',
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
});

/**
 * A contract suite (collection of related contract tests for one adapter).
 */
export const DEFAULT_CONTRACT_SUITE = Object.freeze({
  id: '',
  name: '',
  adapterId: '',
  description: '',
  status: CONTRACT_SUITE_STATUS.DRAFT,
  tests: [],
  schedule: 'manual',
  lastRunAt: null,
  lastRunStatus: null,
  createdAt: '',
  updatedAt: '',
  schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  noCitizenData: true,
  untrusted: true,
  requiresHumanReview: true
});

/**
 * A contract test run record (aggregated metadata only).
 */
export const DEFAULT_CONTRACT_TEST_RUN = Object.freeze({
  id: '',
  suiteId: '',
  adapterId: '',
  status: CONTRACT_TEST_STATUS.PENDING,
  results: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errored: 0,
    warned: 0
  },
  conformanceScore: 0,
  breakingChanges: [],
  maliciousPayloadsDetected: [],
  startedAt: '',
  completedAt: null,
  durationMs: 0,
  schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  disclaimer: CIVIC_CONTRACT_TEST_DISCLAIMER,
  noCitizenData: true,
  untrusted: true,
  requiresHumanReview: true
});

export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_ADAPTERS = 200;
export const MAX_SUITES_PER_ADAPTER = 50;
export const MAX_TESTS_PER_SUITE = 200;
export const MAX_CONCURRENT_RUNS = 20;
export const MAX_RUN_RESULTS = 1000;
export const ADAPTER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SUITE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TEST_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RUN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SENSITIVE_KEY_PATTERN =
  /(password|passwd|otp|one.?time|token|secret|credential|api.?key|private.?key|aadhaar.?number|aadhaar.?no|pan.?number|document.?content|file.?content|file.?data|base64|biometric|passphrase|authorization|salary|income.?amount|mobile.?number|phone.?number)/i;

export const AADHAAR_NUMBER_PATTERN = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const PAN_NUMBER_PATTERN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
export const OTP_PATTERN = /\b(?:otp|one[- ]time password)\b\s*[:#-]?\s*\d{4,8}\b/i;

export const DEFAULT_HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export const DEFAULT_AUTH_TYPES = Object.freeze(['none', 'bearer', 'api_key', 'basic', 'oauth2']);

export const __testables = {
  CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  DEFAULT_ADAPTER,
  DEFAULT_CONTRACT_TEST,
  DEFAULT_CONTRACT_SUITE,
  DEFAULT_CONTRACT_TEST_RUN,
  CONTRACT_TEST_STATUS,
  CONTRACT_TEST_ERRORS,
  CONTRACT_TEST_RESULT,
  ADAPTER_TYPE,
  TEST_TYPE,
  CONTRACT_SUITE_STATUS,
  DEFAULT_HTTP_METHODS,
  DEFAULT_AUTH_TYPES,
  ADAPTER_ID_PATTERN,
  SUITE_ID_PATTERN,
  TEST_ID_PATTERN,
  RUN_ID_PATTERN,
  MAX_INPUT_BYTES,
  MAX_ADAPTERS,
  MAX_SUITES_PER_ADAPTER,
  MAX_TESTS_PER_SUITE,
  MAX_CONCURRENT_RUNS,
  MAX_RUN_RESULTS
};
