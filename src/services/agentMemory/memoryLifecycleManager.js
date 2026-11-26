/**
 * Memory Lifecycle & TTL Sweeper
 *
 * Scans case-partitioned memories, detects expired records,
 * performs automated pruning, and dispatches deletion events.
 */

import { defaultMemoryStorageAdapter } from './caseMemoryStorage';
import { stageOutboxEvent, CIVIC_EVENT_TYPE } from '../civicDomainEventBusService';

export class MemoryLifecycleManager {
  constructor(storageAdapter = defaultMemoryStorageAdapter) {
    this.storage = storageAdapter;
    this.timer = null;
  }

  /**
   * Sweeps all stored memories across cases and purges expired records
   */
  sweepExpiredMemories(now = Date.now()) {
    const allEntries = this.storage.scanAllMemoryEntries();
    let expiredCount = 0;
    const purgedScopes = new Set();

    for (const entry of allEntries) {
      const { scope, record } = entry;
      if (record && record.expiresAt && record.expiresAt <= now) {
        this.storage.deleteRecord(scope.tenantId, scope.caseId, scope.entryId);
        expiredCount += 1;
        purgedScopes.add(`${scope.tenantId}:${scope.caseId}`);

        if (CIVIC_EVENT_TYPE.CASE_MEMORY_EXPIRED) {
          stageOutboxEvent({
            eventType: CIVIC_EVENT_TYPE.CASE_MEMORY_EXPIRED,
            aggregateId: `${scope.tenantId}:${scope.caseId}`,
            payload: {
              tenantId: scope.tenantId,
              caseId: scope.caseId,
              memoryId: scope.entryId,
              entryType: record.entryType,
              expiredAt: record.expiresAt,
            },
          });
        }
      }
    }

    return {
      totalScanned: allEntries.length,
      expiredCount,
      affectedCasesCount: purgedScopes.size,
    };
  }

  /**
   * Starts a background recurring sweep interval (e.g. hourly)
   */
  startBackgroundSweeper(intervalMs = 60 * 60 * 1000) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      try {
        this.sweepExpiredMemories();
      } catch {
        // Log diagnostic if needed
      }
    }, intervalMs);
  }

  /**
   * Stops background interval
   */
  stopBackgroundSweeper() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const memoryLifecycleManager = new MemoryLifecycleManager();
