import { describe, it, expect } from 'vitest';
import {
  MEMORY_ORIGINS,
  MEMORY_SCOPE_MODES,
  createScopedMemoryEntry,
  detectSecretsOrSensitiveData,
  migrateMemoryScopeStoreState,
  retrieveScopedContext,
} from './memoryScopeIsolationLayer.js';

describe('Civic Agent Memory Scope & Context Isolation Layer (#1447)', () => {
  it('prevents cross-case and cross-tenant leakage during creation and retrieval', () => {
    expect(() =>
      createScopedMemoryEntry({
        tenantId: 'tenant-a',
        caseId: 'case-1',
        requestingTenantId: 'tenant-a',
        requestingCaseId: 'case-2',
        content: 'Cross-case write attempt',
      })
    ).toThrow(/Cross-case boundary violation/);

    const entryA = createScopedMemoryEntry({
      tenantId: 'tenant-a',
      caseId: 'case-1',
      origin: MEMORY_ORIGINS.CITIZEN_FACT,
      category: 'interaction_summary',
      content: 'Citizen prefers Hindi checklist.',
      nowMs: 1000000,
    });
    const entryB = createScopedMemoryEntry({
      tenantId: 'tenant-a',
      caseId: 'case-2',
      origin: MEMORY_ORIGINS.CITIZEN_FACT,
      category: 'interaction_summary',
      content: 'Separate case B detail.',
      nowMs: 1000000,
    });

    const retrieved = retrieveScopedContext({
      entries: [entryA, entryB],
      tenantId: 'tenant-a',
      caseId: 'case-1',
      nowMs: 1001000,
    });

    expect(retrieved.entries).toHaveLength(1);
    expect(retrieved.entries[0].caseId).toBe('case-1');
    expect(retrieved.excludedCount).toBe(1);
  });

  it('enforces deterministic no-memory behavior', () => {
    const entry = createScopedMemoryEntry({
      tenantId: 'tenant-a',
      caseId: 'case-1',
      category: 'interaction_summary',
      content: 'Should not be returned in no-memory mode.',
      nowMs: 1000000,
    });

    const res = retrieveScopedContext({
      entries: [entry],
      tenantId: 'tenant-a',
      caseId: 'case-1',
      mode: MEMORY_SCOPE_MODES.NO_MEMORY,
      nowMs: 1001000,
    });

    expect(res.deterministicNoMemory).toBe(true);
    expect(res.entries).toEqual([]);
    expect(res.excludedCount).toBe(1);
  });

  it('excludes secrets, high-entropy tokens, Aadhaar, PAN, and OTPs by default', () => {
    expect(() =>
      createScopedMemoryEntry({
        tenantId: 'tenant-a',
        caseId: 'case-1',
        content: 'My Aadhaar is 2345 6789 0123 and token is sk-1234567890abcdef12345',
      })
    ).toThrow(/Secret\/sensitive data excluded/);

    const scan = detectSecretsOrSensitiveData({ apiKey: 'secret-value', note: 'PAN ABCDE1234F' });
    expect(scan.clean).toBe(false);
  });

  it('enforces allowlisted category filtering, TTL expiry, and source provenance', () => {
    const expired = createScopedMemoryEntry({
      tenantId: 'tenant-a',
      caseId: 'case-1',
      category: 'interaction_summary',
      content: 'Expired summary',
      ttlSeconds: 60,
      nowMs: 1000000,
    });
    const nonAllowlisted = createScopedMemoryEntry({
      tenantId: 'tenant-a',
      caseId: 'case-1',
      category: 'unlisted_category',
      content: 'Not in allowlist',
      nowMs: 1000000,
    });
    const valid = createScopedMemoryEntry({
      tenantId: 'tenant-a',
      caseId: 'case-1',
      origin: MEMORY_ORIGINS.OFFICIAL_RECORD,
      category: 'document_checklist',
      content: 'Official checklist item',
      sourceReference: {
        source: 'UP e-District Portal',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-01-01',
        lastVerifiedAt: '2026-11-20T00:00:00.000Z',
      },
      ttlSeconds: 3600,
      nowMs: 1000000,
    });

    const retrieved = retrieveScopedContext({
      entries: [expired, nonAllowlisted, valid],
      tenantId: 'tenant-a',
      caseId: 'case-1',
      allowlistedCategories: ['document_checklist', 'interaction_summary'],
      nowMs: 1000000 + 120 * 1000, // 120s later: expired is dropped
    });

    expect(retrieved.entries).toHaveLength(1);
    expect(retrieved.entries[0].entryId).toBe(valid.entryId);
    expect(retrieved.entries[0].sourceReference.verified).toBe(true);

    const migrated = migrateMemoryScopeStoreState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
