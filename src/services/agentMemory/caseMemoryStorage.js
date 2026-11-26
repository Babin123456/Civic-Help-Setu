/**
 * Scoped Case Memory Storage Adapter
 *
 * Implements low-level storage operations for case-partitioned memories
 * backed by localStorage with fallback and testability support.
 */

import {
  buildMemoryStorageKey,
  buildMemoryStorageKeyPrefix,
  parseMemoryStorageKey,
  assertCaseScope,
  validateScopeIdentifier,
} from './caseIsolationGuard';

export class CaseMemoryStorageAdapter {
  constructor(storageBackend = null) {
    this.storage = storageBackend || (typeof window !== 'undefined' ? window.localStorage : null);
  }

  _getStorage() {
    if (!this.storage) {
      throw new Error('No storage backend available for CaseMemoryStorageAdapter');
    }
    return this.storage;
  }

  /**
   * Saves a raw serialized memory record for a case
   */
  saveRecord(tenantId, caseId, entryId, record) {
    validateScopeIdentifier(tenantId, 'tenantId');
    validateScopeIdentifier(caseId, 'caseId');
    validateScopeIdentifier(entryId, 'entryId');

    const key = buildMemoryStorageKey(tenantId, caseId, entryId);
    const storage = this._getStorage();
    const serialized = JSON.stringify(record);
    storage.setItem(key, serialized);
    return key;
  }

  /**
   * Reads a raw serialized memory record for a case.
   * Enforces scope isolation.
   */
  readRecord(targetTenantId, targetCaseId, entryId, requestingTenantId = targetTenantId, requestingCaseId = targetCaseId) {
    assertCaseScope(targetTenantId, targetCaseId, requestingTenantId, requestingCaseId);

    const key = buildMemoryStorageKey(targetTenantId, targetCaseId, entryId);
    const storage = this._getStorage();
    const raw = storage.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Lists all memory records belonging strictly to a case
   */
  listRecordsForCase(tenantId, caseId, requestingTenantId = tenantId, requestingCaseId = caseId) {
    assertCaseScope(tenantId, caseId, requestingTenantId, requestingCaseId);

    const prefix = buildMemoryStorageKeyPrefix(tenantId, caseId);
    const storage = this._getStorage();
    const records = [];

    const totalKeys = storage.length || 0;
    for (let i = 0; i < totalKeys; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        const raw = storage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            records.push(parsed);
          } catch {
            // Ignore unparseable entries
          }
        }
      }
    }

    return records;
  }

  /**
   * Deletes a specific memory record for a case
   */
  deleteRecord(targetTenantId, targetCaseId, entryId, requestingTenantId = targetTenantId, requestingCaseId = targetCaseId) {
    assertCaseScope(targetTenantId, targetCaseId, requestingTenantId, requestingCaseId);

    const key = buildMemoryStorageKey(targetTenantId, targetCaseId, entryId);
    const storage = this._getStorage();
    const exists = Boolean(storage.getItem(key));
    storage.removeItem(key);
    return exists;
  }

  /**
   * Clears all memory records belonging to a given case
   */
  clearCaseMemories(targetTenantId, targetCaseId, requestingTenantId = targetTenantId, requestingCaseId = targetCaseId) {
    assertCaseScope(targetTenantId, targetCaseId, requestingTenantId, requestingCaseId);

    const prefix = buildMemoryStorageKeyPrefix(targetTenantId, targetCaseId);
    const storage = this._getStorage();
    const keysToRemove = [];

    const totalKeys = storage.length || 0;
    for (let i = 0; i < totalKeys; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((k) => storage.removeItem(k));
    return keysToRemove.length;
  }

  /**
   * Global utility for maintenance / sweep across all cases
   */
  scanAllMemoryEntries() {
    const storage = this._getStorage();
    const entries = [];
    const totalKeys = storage.length || 0;

    for (let i = 0; i < totalKeys; i += 1) {
      const key = storage.key(i);
      const parsedKey = parseMemoryStorageKey(key);
      if (parsedKey) {
        const raw = storage.getItem(key);
        if (raw) {
          try {
            entries.push({
              key,
              scope: parsedKey,
              record: JSON.parse(raw),
            });
          } catch {
            // Ignore
          }
        }
      }
    }

    return entries;
  }
}

// Default singleton instance
export const defaultMemoryStorageAdapter = new CaseMemoryStorageAdapter();
