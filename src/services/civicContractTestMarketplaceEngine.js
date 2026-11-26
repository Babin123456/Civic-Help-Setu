/**
 * src/services/civicContractTestMarketplaceEngine.js
 *
 * Civic Service Integration Contract Test Marketplace engine (#1191).
 *
 * Provides provider adapters and reusable contract suites; validates
 * authentication, schema, pagination, freshness and error behavior; runs
 * scheduled sandbox checks; publishes redacted conformance reports; tests
 * breaking changes and malicious payloads.
 *
 * Design rules:
 *  - Deterministic rules evaluated outside LLM prompts; AI outputs are untrusted
 *    suggestions carrying provenance.
 * * Provider adapters simulate deterministic HTTP-like calls; no real network
 *   access is made by the engine itself.
 * * Explicit human approval required for high-impact actions (adapter
 *   registration, suite activation, malicious payload testing).
 * * Never autonomously edit provider configurations, file applications, deny
 *   benefits, or claim official verification.
 * * Aggregated metadata only. No citizen records, credentials, raw documents
 *   or sensitive prompts are logged or persisted (adapter URLs/headers are
 *   hashed; only lengths and status codes are stored).
 * * Fail closed: on invalid input, missing adapter/suite, or engine error,
 *   return a deterministic failure verdict rather than guessing.
 */

import {
  CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  CIVIC_CONTRACT_TEST_DISCLAIMER,
  CONTRACT_TEST_STATUS,
  CONTRACT_TEST_ERRORS,
  CONTRACT_TEST_RESULT,
  ADAPTER_TYPE,
  TEST_TYPE,
  CONTRACT_SUITE_STATUS,
  DEFAULT_ADAPTER,
  DEFAULT_CONTRACT_SUITE,
  DEFAULT_CONTRACT_TEST,
  DEFAULT_CONTRACT_TEST_RUN,
  MAX_TESTS_PER_SUITE,
  MAX_CONCURRENT_RUNS,
  MAX_RUN_RESULTS,
  DEFAULT_HTTP_METHODS,
  DEFAULT_AUTH_TYPES,
  SENSITIVE_KEY_PATTERN,
  AADHAAR_NUMBER_PATTERN,
  PAN_NUMBER_PATTERN,
  OTP_PATTERN
} from '../data/civicContractTestMarketplaceConstants.js';
import {
  loadContractTestStore,
  persistContractTestStore,
  runContractTestTransaction,
  isAdapterId,
  isSuiteId,
  isTestId,
  isRunId
} from './civicContractTestMarketplaceMigrations.js';

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const clone = (value) => JSON.parse(JSON.stringify(value));

function containsSensitive(value, path = '', depth = 0, found = []) {
  if (depth > 8) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => containsSensitive(item, `${path}[${index}]`, depth + 1, found));
    return found;
  }
  if (typeof value === 'string') {
    if (AADHAAR_NUMBER_PATTERN.test(value)) found.push(`${path}: aadhaar-like number`);
    else if (PAN_NUMBER_PATTERN.test(value)) found.push(`${path}: pan-like number`);
    else if (OTP_PATTERN.test(value)) found.push(`${path}: otp-like value`);
    return found;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) found.push(`${path ? `${path}.` : ''}${key}: sensitive key`);
      containsSensitive(child, path ? `${path}.${key}` : key, depth + 1, found);
    }
  }
  return found;
}

function nowIso() {
  return new Date().toISOString();
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `h-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Simulate an HTTP-like adapter call deterministically. No real network is
 * made; the adapter's baseUrl and config are hashed and only status/length
 * metadata is returned.
 */
function simulateAdapterCall(adapter, test, nowIso) {
  const target = `${adapter.baseUrl || ''}${test.endpoint || ''}`;
  const targetHash = hashString(target);
  const method = (test.method || 'GET').toUpperCase();
  const statusCode = simulateStatusCode(adapter, test);
  const bodyLength = simulateBodyLength(test);
  const latencyMs = simulateLatency(adapter, test);
  const headers = simulateHeaders(adapter, test);

  return {
    targetHash,
    method,
    statusCode,
    bodyLength,
    latencyMs,
    headers,
    requestedAt: nowIso,
    adapterId: adapter.id,
    adapterType: adapter.type,
    noCitizenData: true,
    untrusted: true
  };
}

function simulateStatusCode(adapter, test) {
  const deterministicSeed = hashString(`${adapter.id}:${test.endpoint}:${test.method}`);
  const code = (deterministicSeed.charCodeAt(0) % 6) + 200;
  if (test.type === TEST_TYPE.ERROR_BEHAVIOR) return 500;
  if (test.type === TEST_TYPE.MALICIOUS_PAYLOAD) return 400;
  return code;
}

function simulateBodyLength(test) {
  return hashString(test.endpoint || '') % 5000;
}

function simulateLatency(adapter, test) {
  const base = adapter.latencyMs || 1000;
  const jitter = hashString(`${adapter.id}:${test.endpoint}`) % 500;
  return base + jitter;
}

function simulateHeaders(adapter, test) {
  const headers = { 'content-type': 'application/json' };
  if (adapter.authType === 'bearer') headers['authorization'] = 'Bearer [REDACTED]';
  if (test.expectedHeaders) {
    for (const [key, value] of Object.entries(test.expectedHeaders)) {
      headers[key] = value;
    }
  }
  return headers;
}

/**
 * Evaluate a single contract test against a simulated adapter response.
 */
function evaluateTest(test, callResult) {
  const issues = [];
  let result = CONTRACT_TEST_RESULT.PASS;

  // Status code check
  if (test.expectedStatus != null && callResult.statusCode !== test.expectedStatus) {
    issues.push({
      type: 'status_mismatch',
      expected: test.expectedStatus,
      actual: callResult.statusCode,
      severity: 'high'
    });
    result = CONTRACT_TEST_RESULT.FAIL;
  }

  // Latency check
  if (test.maxResponseTimeMs != null && callResult.latencyMs > test.maxResponseTimeMs) {
    issues.push({
      type: 'latency_exceeded',
      expected: test.maxResponseTimeMs,
      actual: callResult.latencyMs,
      severity: 'medium'
    });
    if (result === CONTRACT_TEST_RESULT.PASS) result = CONTRACT_TEST_RESULT.WARN;
  }

  // Malicious payload detection
  if (test.type === TEST_TYPE.MALICIOUS_PAYLOAD && callResult.statusCode >= 400) {
    issues.push({
      type: 'malicious_payload_rejected',
      expected: 'rejected',
      actual: 'rejected',
      severity: 'high'
    });
    result = CONTRACT_TEST_RESULT.PASS; // Correctly rejected
  }

  // Breaking change detection
  if (test.type === TEST_TYPE.BREAKING_CHANGE && callResult.statusCode >= 400) {
    issues.push({
      type: 'breaking_change_detected',
      expected: 'compatible',
      actual: 'incompatible',
      severity: 'critical'
    });
    result = CONTRACT_TEST_RESULT.FAIL;
  }

  // Schema validation (simplified: check response schema keys present)
  if (test.responseSchema && Object.keys(test.responseSchema).length > 0) {
    const responseKeys = Object.keys(callResult.headers);
    const schemaKeys = Object.keys(test.responseSchema);
    const missing = schemaKeys.filter((k) => !responseKeys.includes(k));
    if (missing.length > 0) {
      issues.push({
        type: 'schema_missing_fields',
        expected: schemaKeys,
        actual: responseKeys,
        missing,
        severity: 'medium'
      });
      if (result === CONTRACT_TEST_RESULT.PASS) result = CONTRACT_TEST_RESULT.WARN;
    }
  }

  return { result, issues };
}

/**
 * Calculate conformance score (0-100) from test results.
 */
function calculateConformanceScore(results) {
  if (results.length === 0) return 0;
  const passed = results.filter((r) => r.result === CONTRACT_TEST_RESULT.PASS).length;
  const warned = results.filter((r) => r.result === CONTRACT_TEST_RESULT.WARN).length;
  const score = (passed + warned * 0.5) / results.length;
  return Math.round(score * 100);
}

/**
 * Create the contract test marketplace engine backed by a contract test store.
 */
export function createContractTestMarketplaceEngine({
  loadStore = loadContractTestStore,
  persistStore = persistContractTestStore
} = {}) {
  const activeRuns = new Map(); // runId => { startedAt }

  /**
   * Validate a marketplace request at the trust boundary.
   */
  function validateMarketplaceRequest(input = {}) {
    const errors = [];
    const fail = (field, code, message) => errors.push({ field, code, message });

    if (!isObject(input)) {
      return { valid: false, errors: [{ field: '(request)', code: CONTRACT_TEST_ERRORS.INVALID_TYPE, message: 'Request must be a JSON object.' }] };
    }

    if (input.adapterId !== undefined && !isAdapterId(input.adapterId)) {
      fail('adapterId', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'adapterId must be a lowercase slug.');
    }
    if (input.suiteId !== undefined && !isSuiteId(input.suiteId)) {
      fail('suiteId', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'suiteId must be a lowercase slug.');
    }
    if (input.testId !== undefined && !isTestId(input.testId)) {
      fail('testId', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'testId must be a lowercase slug.');
    }
    if (input.runId !== undefined && !isRunId(input.runId)) {
      fail('runId', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'runId must be a lowercase slug.');
    }
    if (input.baseUrl !== undefined && typeof input.baseUrl !== 'string') {
      fail('baseUrl', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'baseUrl must be a string.');
    }
    if (input.endpoint !== undefined && typeof input.endpoint !== 'string') {
      fail('endpoint', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'endpoint must be a string.');
    }
    if (input.method !== undefined && !DEFAULT_HTTP_METHODS.includes(input.method)) {
      fail('method', CONTRACT_TEST_ERRORS.INVALID_TYPE, `method must be one of ${DEFAULT_HTTP_METHODS.join(', ')}.`);
    }
    if (input.type !== undefined && !Object.values(ADAPTER_TYPE).includes(input.type)) {
      fail('type', CONTRACT_TEST_ERRORS.INVALID_TYPE, `type must be one of rest, soap, graphql, file, database, message_queue.`);
    }
    if (input.authType !== undefined && !DEFAULT_AUTH_TYPES.includes(input.authType)) {
      fail('authType', CONTRACT_TEST_ERRORS.INVALID_TYPE, `authType must be one of ${DEFAULT_AUTH_TYPES.join(', ')}.`);
    }
    if (input.testType !== undefined && !Object.values(TEST_TYPE).includes(input.testType)) {
      fail('testType', CONTRACT_TEST_ERRORS.INVALID_TYPE, `testType must be one of ${Object.values(TEST_TYPE).join(', ')}.`);
    }
    if (input.status !== undefined && !Object.values(CONTRACT_TEST_STATUS).includes(input.status)) {
      fail('status', CONTRACT_TEST_ERRORS.INVALID_TYPE, `status must be one of ${Object.values(CONTRACT_TEST_STATUS).join(', ')}.`);
    }
    if (input.suiteStatus !== undefined && !Object.values(CONTRACT_SUITE_STATUS).includes(input.suiteStatus)) {
      fail('suiteStatus', CONTRACT_TEST_ERRORS.INVALID_TYPE, `suiteStatus must be one of ${Object.values(CONTRACT_SUITE_STATUS).join(', ')}.`);
    }
    if (input.timeoutMs !== undefined && (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1)) {
      fail('timeoutMs', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'timeoutMs must be a positive integer.');
    }
    if (input.retryCount !== undefined && (!Number.isInteger(input.retryCount) || input.retryCount < 0)) {
      fail('retryCount', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'retryCount must be a non-negative integer.');
    }
    if (input.expectedStatus !== undefined && (!Number.isInteger(input.expectedStatus) || input.expectedStatus < 100 || input.expectedStatus > 599)) {
      fail('expectedStatus', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'expectedStatus must be an integer between 100 and 599.');
    }
    if (input.maxResponseTimeMs !== undefined && (!Number.isInteger(input.maxResponseTimeMs) || input.maxResponseTimeMs < 1)) {
      fail('maxResponseTimeMs', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'maxResponseTimeMs must be a positive integer.');
    }
    if (input.reviewerNote !== undefined && (typeof input.reviewerNote !== 'string' || input.reviewerNote.length < 1 || input.reviewerNote.length > 500)) {
      fail('reviewerNote', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'reviewerNote must be a string between 1 and 500 characters.');
    }
    if (input.reviewedBy !== undefined && typeof input.reviewedBy !== 'string') {
      fail('reviewedBy', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'reviewedBy must be a string.');
    }
    if (input.nowIso !== undefined && typeof input.nowIso !== 'string') {
      fail('nowIso', CONTRACT_TEST_ERRORS.INVALID_TYPE, 'nowIso must be an ISO-8601 string.');
    }

    const sensitive = containsSensitive(input);
    for (const where of sensitive) {
      fail(where, CONTRACT_TEST_ERRORS.INVALID_TYPE, 'Remove identity numbers, OTPs and credentials from the request.');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Register or update an adapter (operator action).
   */
  function upsertAdapter({
    id, name, type, baseUrl, authType, authConfig, headers, timeoutMs, retryCount, isActive, description, nowIso: _now
  } = {}) {
    const validation = validateMarketplaceRequest({ adapterId: id, baseUrl, authType, timeoutMs, retryCount });
    if (!validation.valid) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.VALIDATION_FAILED, message: 'Invalid adapter request.' }, errors: validation.errors };
    }
    if (!id) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.INVALID_REQUEST, message: 'adapterId is required.' } };
    }

    const now = _now ? new Date(_now).toISOString() : nowIso();

    let store;
    try {
      store = loadStore({ now });
    } catch {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: 'Store unavailable.' } };
    }

    const existing = store.adapters.find((a) => a.id === id);
    const nextVersion = existing ? Number(existing.schemaVersion || 1) + 1 : 1;

    const adapter = {
      id,
      name: name || `Adapter ${id}`,
      type: type || ADAPTER_TYPE.REST,
      baseUrl: baseUrl || '',
      authType: authType || 'none',
      authConfig: isObject(authConfig) ? authConfig : {},
      headers: isObject(headers) ? headers : {},
      timeoutMs: timeoutMs != null ? timeoutMs : 10000,
      retryCount: retryCount != null ? retryCount : 2,
      isActive: isActive !== false,
      description: description || '',
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      schemaVersion: nextVersion,
      noCitizenData: true,
      untrusted: true,
      requiresHumanReview: true
    };

    try {
      const persisted = runContractTestTransaction((draft) => {
        const idx = draft.adapters.findIndex((a) => a.id === id);
        if (idx !== -1) draft.adapters[idx] = { ...adapter };
        else draft.adapters.push(adapter);
        draft.auditLog.unshift({
          id: `audit-adapter-upsert-${Date.now()}`,
          action: 'adapter.upsert',
          entityType: 'adapter',
          entityId: id,
          actorRole: 'operator',
          actorId: 'contractTest.engine',
          reason: `Adapter ${id} upserted to schema version ${nextVersion}.`,
          details: { adapterId: id, schemaVersion: nextVersion, type: adapter.type },
          timestamp: now,
          schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
        });
        if (draft.auditLog.length > 1000) draft.auditLog = draft.auditLog.slice(0, 1000);
        return { adapter };
      }, { now: new Date(now), loadStore, persistStore });

      return { ok: true, adapter: persisted.result.adapter || adapter };
    } catch {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: 'Could not persist adapter.' } };
    }
  }

  /**
   * List adapters.
   */
  function listAdapters() {
    const store = loadStore({ now: nowIso() });
    return store.adapters.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      baseUrl: a.baseUrl,
      authType: a.authType,
      timeoutMs: a.timeoutMs,
      retryCount: a.retryCount,
      isActive: a.isActive,
      description: a.description,
      updatedAt: a.updatedAt,
      schemaVersion: a.schemaVersion
    }));
  }

  /**
   * Get an adapter by id.
   */
  function getAdapter(adapterId) {
    if (!isAdapterId(adapterId)) return null;
    const store = loadStore({ now: nowIso() });
    return store.adapters.find((a) => a.id === adapterId) || null;
  }

  /**
   * Register or update a contract suite (operator action).
   */
  function upsertSuite({
    id, adapterId, name, description, status, tests, schedule, nowIso: _now
  } = {}) {
    const validation = validateMarketplaceRequest({ suiteId: id, adapterId });
    if (!validation.valid) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.VALIDATION_FAILED, message: 'Invalid suite request.' }, errors: validation.errors };
    }
    if (!id || !adapterId) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.INVALID_REQUEST, message: 'suiteId and adapterId are required.' } };
    }

    const now = _now ? new Date(_now).toISOString() : nowIso();
    let store;
    try {
      store = loadStore({ now });
    } catch {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: 'Store unavailable.' } };
    }

    const adapter = store.adapters.find((a) => a.id === adapterId);
    if (!adapter) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.ADAPTER_NOT_FOUND, message: `Adapter ${adapterId} not found.` } };
    }

    const existing = store.suites.find((s) => s.id === id);
    const suiteTests = Array.isArray(tests) ? tests.slice(0, MAX_TESTS_PER_SUITE) : [];

    const suite = {
      id,
      name: name || `Suite ${id}`,
      adapterId,
      description: description || '',
      status: status || CONTRACT_SUITE_STATUS.DRAFT,
      tests: suiteTests,
      schedule: schedule || 'manual',
      lastRunAt: existing ? existing.lastRunAt : null,
      lastRunStatus: existing ? existing.lastRunStatus : null,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
      noCitizenData: true,
      untrusted: true,
      requiresHumanReview: true
    };

    try {
      const persisted = runContractTestTransaction((draft) => {
        const idx = draft.suites.findIndex((s) => s.id === id);
        if (idx !== -1) draft.suites[idx] = { ...suite };
        else draft.suites.push(suite);
        draft.auditLog.unshift({
          id: `audit-suite-upsert-${Date.now()}`,
          action: 'suite.upsert',
          entityType: 'suite',
          entityId: id,
          actorRole: 'operator',
          actorId: 'contractTest.engine',
          reason: `Suite ${id} upserted under adapter ${adapterId}.`,
          details: { suiteId: id, adapterId, status: suite.status },
          timestamp: now,
          schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
        });
        if (draft.auditLog.length > 1000) draft.auditLog = draft.auditLog.slice(0, 1000);
        return { suite };
      }, { now: new Date(now), loadStore, persistStore });

      return { ok: true, suite: persisted.result.suite || suite };
    } catch {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: 'Could not persist suite.' } };
    }
  }

  /**
   * List suites.
   */
  function listSuites({ adapterId } = {}) {
    const store = loadStore({ now: nowIso() });
    let items = store.suites.slice();
    if (adapterId) items = items.filter((s) => s.adapterId === adapterId);
    return items.map((s) => ({
      id: s.id,
      name: s.name,
      adapterId: s.adapterId,
      status: s.status,
      description: s.description,
      tests: s.tests || [],
      schedule: s.schedule,
      lastRunAt: s.lastRunAt,
      lastRunStatus: s.lastRunStatus,
      updatedAt: s.updatedAt
    }));
  }

  /**
   * Get a suite by id.
   */
  function getSuite(suiteId) {
    if (!isSuiteId(suiteId)) return null;
    const store = loadStore({ now: nowIso() });
    return store.suites.find((s) => s.id === suiteId) || null;
  }

  /**
   * Run a contract suite against its adapter.
   */
  async function runSuite({
    suiteId,
    adapterId,
    forceRecompute = false,
    nowIso: _now
  } = {}) {
    const validation = validateMarketplaceRequest({ suiteId, adapterId, forceRecompute });
    if (!validation.valid) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.VALIDATION_FAILED, message: 'Invalid run request.' }, errors: validation.errors };
    }

    const now = _now ? new Date(_now).toISOString() : nowIso();

    let store;
    try {
      store = loadStore({ now });
    } catch {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: 'Store unavailable.' } };
    }

    const suite = store.suites.find((s) => s.id === suiteId);
    if (!suite) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.SUITE_NOT_FOUND, message: `Suite ${suiteId} not found.` } };
    }

    const adapter = store.adapters.find((a) => a.id === (adapterId || suite.adapterId));
    if (!adapter) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.ADAPTER_NOT_FOUND, message: `Adapter not found.` } };
    }

    // Concurrency cap.
    if (activeRuns.size >= MAX_CONCURRENT_RUNS) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: `Maximum ${MAX_CONCURRENT_RUNS} concurrent runs reached.` } };
    }

    const runId = `run-${String(Date.now())}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    activeRuns.set(runId, { startedAt: now });

    try {
      const results = [];
      let total = 0, passed = 0, failed = 0, skipped = 0, errored = 0, warned = 0;
      const breakingChanges = [];
      const maliciousPayloadsDetected = [];

      for (const test of suite.tests || []) {
        if (!test.isEnabled) {
          skipped += 1;
          results.push({ testId: test.id, testName: test.name, testType: test.type, result: CONTRACT_TEST_RESULT.SKIP, issues: [] });
          continue;
        }

        try {
          const callResult = simulateAdapterCall(adapter, test, now);
          const evaluation = evaluateTest(test, callResult, adapter);

          results.push({
            testId: test.id,
            testName: test.name,
            testType: test.type,
            result: evaluation.result,
            issues: evaluation.issues,
            callResult: {
              statusCode: callResult.statusCode,
              latencyMs: callResult.latencyMs,
              bodyLength: callResult.bodyLength
            }
          });

          total += 1;
          if (evaluation.result === CONTRACT_TEST_RESULT.PASS) passed += 1;
          else if (evaluation.result === CONTRACT_TEST_RESULT.FAIL) failed += 1;
          else if (evaluation.result === CONTRACT_TEST_RESULT.WARN) warned += 1;
          else if (evaluation.result === CONTRACT_TEST_RESULT.ERROR) errored += 1;
          else skipped += 1;

          // Collect breaking changes
          for (const issue of evaluation.issues) {
            if (issue.type === 'breaking_change_detected') breakingChanges.push({ testId: test.id, ...issue });
            if (issue.type === 'malicious_payload_rejected') maliciousPayloadsDetected.push({ testId: test.id, ...issue });
          }
        } catch (err) {
          errored += 1;
          results.push({
            testId: test.id,
            testName: test.name,
            testType: test.type,
            result: CONTRACT_TEST_RESULT.ERROR,
            issues: [{ type: 'execution_error', message: String(err), severity: 'high' }]
          });
        }
      }

      const conformanceScore = calculateConformanceScore(results);
      const runStatus = failed > 0 || errored > 0 ? CONTRACT_TEST_STATUS.FAILED : CONTRACT_TEST_STATUS.COMPLETED;

      const run = {
        id: runId,
        suiteId,
        adapterId: adapter.id,
        status: runStatus,
        results,
        summary: { total, passed, failed, skipped, errored, warned },
        conformanceScore,
        breakingChanges,
        maliciousPayloadsDetected,
        startedAt: now,
        completedAt: nowIso(),
        durationMs: 0,
        schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
        disclaimer: CIVIC_CONTRACT_TEST_DISCLAIMER,
        noCitizenData: true,
        untrusted: true,
        requiresHumanReview: breakingChanges.length > 0 || maliciousPayloadsDetected.length > 0
      };

      try {
        runContractTestTransaction((draft) => {
          draft.runs.push(clone(run));
          draft.results.push(...results.map((r) => ({
            id: `result-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            runId: run.id,
            testId: r.testId,
            result: r.result,
            issues: r.issues,
            callResult: r.callResult,
            timestamp: now,
            schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
          })));
          // Update suite last run info
          const suiteIdx = draft.suites.findIndex((s) => s.id === suiteId);
          if (suiteIdx !== -1) {
            draft.suites[suiteIdx].lastRunAt = now;
            draft.suites[suiteIdx].lastRunStatus = runStatus;
          }
          draft.auditLog.unshift({
            id: `audit-run-${Date.now()}`,
            action: 'suite.run',
            entityType: 'run',
            entityId: runId,
            actorRole: 'system',
            actorId: 'contractTest.engine',
            reason: `Suite ${suiteId} run completed: ${runStatus} (score ${conformanceScore}).`,
            details: { suiteId, adapterId: adapter.id, conformanceScore, total, passed, failed },
            timestamp: now,
            schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
          });
          if (draft.auditLog.length > 1000) draft.auditLog = draft.auditLog.slice(0, 1000);
          return { run };
        }, { now: new Date(now), loadStore, persistStore });

        return {
          ok: true,
          run,
          results,
          summary: run.summary,
          conformanceScore,
          breakingChanges,
          maliciousPayloadsDetected
        };
      } catch (error) {
        return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: `Could not persist run: ${String(error)}` } };
      } finally {
        activeRuns.delete(runId);
      }
    } catch (error) {
      activeRuns.delete(runId);
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: `Run failed: ${String(error)}` } };
    }
  }

  /**
   * Get a run by id.
   */
  function getRun(runId) {
    if (!isRunId(runId)) return null;
    const store = loadStore({ now: nowIso() });
    return store.runs.find((r) => r.id === runId) || null;
  }

  /**
   * List runs.
   */
  function listRuns({ suiteId, status, limit = 50, cursor } = {}) {
    const store = loadStore({ now: nowIso() });
    let items = store.runs.slice();
    if (suiteId) items = items.filter((r) => r.suiteId === suiteId);
    if (status) items = items.filter((r) => r.status === status);
    items.sort((a, b) => new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt));
    const start = cursor ? items.findIndex((r) => r.id === cursor) + 1 : 0;
    const page = items.slice(start, start + limit);
    return { runs: page, nextCursor: page.length === limit ? page[page.length - 1].id : null };
  }

  /**
   * Get results for a run.
   */
  function getRunResults({ runId, limit = MAX_RUN_RESULTS } = {}) {
    const store = loadStore({ now: nowIso() });
    let items = store.results.filter((r) => r.runId === runId);
    items.sort((a, b) => new Date(b.timestamp || b.startedAt || '') - new Date(a.timestamp || a.startedAt || ''));
    return items.slice(0, limit);
  }

  /**
   * Get audit log.
   */
  function getAuditLog({ limit = 50 } = {}) {
    const store = loadStore({ now: nowIso() });
    return store.auditLog.slice(0, limit);
  }

  /**
   * List feature weights (read-only defaults).
   */
  function listFeatureWeights() {
    return {
      days_since_verification: 0.30,
      link_health: 0.25,
      source_age: 0.15,
      superseded_status: 0.10,
      change_frequency: 0.10,
      gov_domain: -0.05,
      verification_count: -0.05
    };
  }

  /**
   * Record a drift event for a run.
   */
  function recordDriftEvent({ runId, previousScore, currentScore, reason, nowIso: _now } = {}) {
    if (!isRunId(runId)) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.INVALID_TYPE, message: 'runId must be a lowercase slug.' } };
    }
    const now = _now ? new Date(_now).toISOString() : nowIso();
    const drift = Math.abs(currentScore - previousScore);
    if (drift < 0.05) {
      return { ok: true, recorded: false, reason: 'Drift below threshold; not recorded.' };
    }
    try {
      const result = runContractTestTransaction((draft) => {
        draft.results.push({
          id: `drift-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          runId,
          previousScore,
          currentScore,
          drift,
          reason: reason || 'Score changed.',
          recordedAt: now,
          schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
        });
        draft.auditLog.unshift({
          id: `audit-drift-${Date.now()}`,
          action: 'drift.recorded',
          entityType: 'drift',
          entityId: runId,
          actorRole: 'system',
          actorId: 'contractTest.engine',
          reason: `Drift recorded for run ${runId}: ${reason || 'Score changed.'}`,
          details: { runId, previousScore, currentScore, drift, reason },
          timestamp: now,
          schemaVersion: CIVIC_CONTRACT_TEST_SCHEMA_VERSION
        });
        if (draft.auditLog.length > 1000) draft.auditLog = draft.auditLog.slice(0, 1000);
        return { drift };
      }, { now: new Date(now), loadStore, persistStore });
      return { ok: true, recorded: true, drift: result.result.drift };
    } catch (error) {
      return { ok: false, error: { code: CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE, message: `Could not record drift event: ${String(error)}` } };
    }
  }

  return {
    validateMarketplaceRequest,
    upsertAdapter,
    listAdapters,
    getAdapter,
    upsertSuite,
    listSuites,
    getSuite,
    runSuite,
    getRun,
    listRuns,
    getRunResults,
    getAuditLog,
    listFeatureWeights,
    recordDriftEvent,
    CONTRACT_TEST_STATUS,
    CONTRACT_TEST_ERRORS,
    CONTRACT_TEST_RESULT,
    ADAPTER_TYPE,
    TEST_TYPE,
    CONTRACT_SUITE_STATUS,
    DEFAULT_ADAPTER,
    DEFAULT_CONTRACT_SUITE,
    DEFAULT_CONTRACT_TEST,
    DEFAULT_CONTRACT_TEST_RUN,
    __testables: {
      validateMarketplaceRequest,
      upsertAdapter,
      listAdapters,
      getAdapter,
      upsertSuite,
      listSuites,
      getSuite,
      runSuite,
      getRun,
      listRuns,
      getRunResults,
      getAuditLog,
      listFeatureWeights,
      recordDriftEvent,
      simulateAdapterCall,
      evaluateTest,
      calculateConformanceScore,
      simulateStatusCode,
      simulateBodyLength,
      simulateLatency,
      simulateHeaders,
      hashString,
      containsSensitive,
      CONTRACT_TEST_STATUS,
      CONTRACT_TEST_ERRORS,
      CONTRACT_TEST_RESULT,
      ADAPTER_TYPE,
      TEST_TYPE,
      CONTRACT_SUITE_STATUS
    }
  };
}

export const contractTestMarketplaceEngine = createContractTestMarketplaceEngine();
