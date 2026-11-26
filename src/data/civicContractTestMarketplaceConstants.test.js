/**
 * src/data/civicContractTestMarketplaceConstants.test.js
 *
 * Unit tests for versioned schema, enums, error codes and default configuration
 * for the Civic Service Integration Contract Test Marketplace (#1191).
 */

import { describe, it, expect } from 'vitest';
import {
  CIVIC_CONTRACT_TEST_SCHEMA_VERSION,
  DEFAULT_ADAPTER,
  DEFAULT_CONTRACT_SUITE,
  DEFAULT_CONTRACT_TEST,
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
  RUN_ID_PATTERN
} from './civicContractTestMarketplaceConstants.js';

describe('civicContractTestMarketplaceConstants', () => {
  it('exposes a schema version', () => {
    expect(CIVIC_CONTRACT_TEST_SCHEMA_VERSION).toBe(1);
  });

  it('default adapter has required fields', () => {
    expect(DEFAULT_ADAPTER.id).toBe('');
    expect(DEFAULT_ADAPTER.name).toBe('');
    expect(DEFAULT_ADAPTER.type).toBe(ADAPTER_TYPE.REST);
    expect(DEFAULT_ADAPTER.noCitizenData).toBe(true);
    expect(DEFAULT_ADAPTER.untrusted).toBe(true);
    expect(DEFAULT_ADAPTER.requiresHumanReview).toBe(true);
  });

  it('default suite has required fields', () => {
    expect(DEFAULT_CONTRACT_SUITE.id).toBe('');
    expect(DEFAULT_CONTRACT_SUITE.status).toBe(CONTRACT_SUITE_STATUS.DRAFT);
    expect(DEFAULT_CONTRACT_SUITE.tests).toEqual([]);
    expect(DEFAULT_CONTRACT_SUITE.noCitizenData).toBe(true);
    expect(DEFAULT_CONTRACT_SUITE.requiresHumanReview).toBe(true);
  });

  it('default test has required fields', () => {
    expect(DEFAULT_CONTRACT_TEST.id).toBe('');
    expect(DEFAULT_CONTRACT_TEST.type).toBe(TEST_TYPE.CONFORMANCE);
    expect(DEFAULT_CONTRACT_TEST.method).toBe('GET');
    expect(DEFAULT_CONTRACT_TEST.isEnabled).toBe(true);
  });

  it('default run has required fields', () => {
    expect(DEFAULT_CONTRACT_TEST_RUN.id).toBe('');
    expect(DEFAULT_CONTRACT_TEST_RUN.status).toBe(CONTRACT_TEST_STATUS.PENDING);
    expect(DEFAULT_CONTRACT_TEST_RUN.results).toEqual([]);
    expect(DEFAULT_CONTRACT_TEST_RUN.noCitizenData).toBe(true);
    expect(DEFAULT_CONTRACT_TEST_RUN.requiresHumanReview).toBe(true);
  });

  it('exposes status enums', () => {
    expect(CONTRACT_TEST_STATUS.PENDING).toBe('pending');
    expect(CONTRACT_TEST_STATUS.RUNNING).toBe('running');
    expect(CONTRACT_TEST_STATUS.COMPLETED).toBe('completed');
    expect(CONTRACT_TEST_STATUS.FAILED).toBe('failed');
  });

  it('exposes result enums', () => {
    expect(CONTRACT_TEST_RESULT.PASS).toBe('pass');
    expect(CONTRACT_TEST_RESULT.FAIL).toBe('fail');
    expect(CONTRACT_TEST_RESULT.SKIP).toBe('skip');
    expect(CONTRACT_TEST_RESULT.ERROR).toBe('error');
    expect(CONTRACT_TEST_RESULT.WARN).toBe('warn');
  });

  it('exposes adapter types', () => {
    expect(ADAPTER_TYPE.REST).toBe('rest');
    expect(ADAPTER_TYPE.SOAP).toBe('soap');
    expect(ADAPTER_TYPE.GRAPHQL).toBe('graphql');
    expect(ADAPTER_TYPE.FILE).toBe('file');
    expect(ADAPTER_TYPE.DATABASE).toBe('database');
    expect(ADAPTER_TYPE.MESSAGE_QUEUE).toBe('message_queue');
  });

  it('exposes test types', () => {
    expect(TEST_TYPE.AUTH).toBe('auth');
    expect(TEST_TYPE.SCHEMA).toBe('schema');
    expect(TEST_TYPE.PAGINATION).toBe('pagination');
    expect(TEST_TYPE.FRESHNESS).toBe('freshness');
    expect(TEST_TYPE.ERROR_BEHAVIOR).toBe('error_behavior');
    expect(TEST_TYPE.BREAKING_CHANGE).toBe('breaking_change');
    expect(TEST_TYPE.MALICIOUS_PAYLOAD).toBe('malicious_payload');
    expect(TEST_TYPE.CONFORMANCE).toBe('conformance');
  });

  it('exposes suite statuses', () => {
    expect(CONTRACT_SUITE_STATUS.ACTIVE).toBe('active');
    expect(CONTRACT_SUITE_STATUS.DRAFT).toBe('draft');
    expect(CONTRACT_SUITE_STATUS.ARCHIVED).toBe('archived');
    expect(CONTRACT_SUITE_STATUS.DEPRECATED).toBe('deprecated');
  });

  it('exposes error codes', () => {
    expect(CONTRACT_TEST_ERRORS.INVALID_REQUEST).toBe('CT_INVALID_REQUEST');
    expect(CONTRACT_TEST_ERRORS.INVALID_TYPE).toBe('CT_INVALID_TYPE');
    expect(CONTRACT_TEST_ERRORS.ADAPTER_NOT_FOUND).toBe('CT_ADAPTER_NOT_FOUND');
    expect(CONTRACT_TEST_ERRORS.SUITE_NOT_FOUND).toBe('CT_SUITE_NOT_FOUND');
    expect(CONTRACT_TEST_ERRORS.VALIDATION_FAILED).toBe('CT_VALIDATION_FAILED');
    expect(CONTRACT_TEST_ERRORS.STORAGE_UNAVAILABLE).toBe('CT_STORAGE_UNAVAILABLE');
    expect(CONTRACT_TEST_ERRORS.BREAKING_CHANGE).toBe('CT_BREAKING_CHANGE');
    expect(CONTRACT_TEST_ERRORS.MALICIOUS_PAYLOAD).toBe('CT_MALICIOUS_PAYLOAD');
  });

  it('exposes HTTP methods and auth types', () => {
    expect(DEFAULT_HTTP_METHODS).toContain('GET');
    expect(DEFAULT_HTTP_METHODS).toContain('POST');
    expect(DEFAULT_HTTP_METHODS).toContain('PUT');
    expect(DEFAULT_HTTP_METHODS).toContain('PATCH');
    expect(DEFAULT_HTTP_METHODS).toContain('DELETE');
    expect(DEFAULT_AUTH_TYPES).toContain('none');
    expect(DEFAULT_AUTH_TYPES).toContain('bearer');
    expect(DEFAULT_AUTH_TYPES).toContain('api_key');
    expect(DEFAULT_AUTH_TYPES).toContain('basic');
    expect(DEFAULT_AUTH_TYPES).toContain('oauth2');
  });

  it('id patterns are sane', () => {
    expect(ADAPTER_ID_PATTERN.test('adapter-1')).toBe(true);
    expect(ADAPTER_ID_PATTERN.test('Bad Id')).toBe(false);
    expect(SUITE_ID_PATTERN.test('suite-1')).toBe(true);
    expect(SUITE_ID_PATTERN.test('Bad Id')).toBe(false);
    expect(TEST_ID_PATTERN.test('test-1')).toBe(true);
    expect(RUN_ID_PATTERN.test('run-1')).toBe(true);
  });
});
