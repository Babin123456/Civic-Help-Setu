import { describe, it, expect } from 'vitest';
import {
  validateScopeIdentifier,
  assertCaseScope,
  buildMemoryStorageKeyPrefix,
  buildMemoryStorageKey,
  parseMemoryStorageKey,
  CaseBoundaryViolationError,
  InvalidScopeIdentifierError,
} from './caseIsolationGuard';

describe('caseIsolationGuard', () => {
  it('validates legal scope identifiers', () => {
    expect(validateScopeIdentifier('tenant_1')).toBe('tenant_1');
    expect(validateScopeIdentifier('case-srv-123')).toBe('case-srv-123');
    expect(validateScopeIdentifier('mem_abc_99')).toBe('mem_abc_99');
  });

  it('rejects invalid or dangerous identifiers (path traversal, delimiters)', () => {
    expect(() => validateScopeIdentifier('')).toThrow(InvalidScopeIdentifierError);
    expect(() => validateScopeIdentifier('../traversal')).toThrow(InvalidScopeIdentifierError);
    expect(() => validateScopeIdentifier('case:injection')).toThrow(InvalidScopeIdentifierError);
    expect(() => validateScopeIdentifier('case/subpath')).toThrow(InvalidScopeIdentifierError);
    expect(() => validateScopeIdentifier('a'.repeat(65))).toThrow(InvalidScopeIdentifierError);
  });

  it('assertCaseScope passes when target matches requested scope', () => {
    expect(assertCaseScope('tenantA', 'case1', 'tenantA', 'case1')).toBe(true);
  });

  it('assertCaseScope throws CaseBoundaryViolationError on cross-case attempt', () => {
    expect(() => assertCaseScope('tenantA', 'case1', 'tenantA', 'case2')).toThrow(
      CaseBoundaryViolationError
    );
    expect(() => assertCaseScope('tenantA', 'case1', 'tenantB', 'case1')).toThrow(
      CaseBoundaryViolationError
    );
  });

  it('builds formatted storage key prefix and item key', () => {
    expect(buildMemoryStorageKeyPrefix('tenant1', 'case1')).toBe('chsetu:mem:tenant1:case1:');
    expect(buildMemoryStorageKey('tenant1', 'case1', 'entry1')).toBe(
      'chsetu:mem:tenant1:case1:entry1'
    );
  });

  it('parses valid storage keys and rejects malformed keys', () => {
    const parsed = parseMemoryStorageKey('chsetu:mem:tenant1:case1:entry1');
    expect(parsed).toEqual({
      tenantId: 'tenant1',
      caseId: 'case1',
      entryId: 'entry1',
    });

    expect(parseMemoryStorageKey('other:key:format')).toBeNull();
    expect(parseMemoryStorageKey('chsetu:mem:bad:key')).toBeNull();
    expect(parseMemoryStorageKey('chsetu:mem:tenant:case:entry:extra')).toBeNull();
  });
});
