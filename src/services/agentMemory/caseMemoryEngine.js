/**
 * Case Memory Engine
 *
 * Core service providing high-level case-scoped memory management:
 * - Field-level encryption using Web Crypto AES-GCM
 * - Strict tenant- and case-level isolation guards
 * - Clear classification: FactualCaseNote vs ModelProposal
 * - Verification / promotion workflows for AI suggestions
 * - Scoped queries, deletion cascades, and auditable export formats
 */

import {
  assertCaseScope,
} from './caseIsolationGuard';
import {
  encryptPayload,
  decryptPayload,
} from './caseCryptoService';
import {
  defaultMemoryStorageAdapter,
} from './caseMemoryStorage';
import {
  MEMORY_ENTRY_TYPES,
  MEMORY_CATEGORIES,
  createFactualNoteEntry,
  createModelProposalEntry,
} from './memoryClassifier';
import {
  stageOutboxEvent,
  CIVIC_EVENT_TYPE,
} from '../civicDomainEventBusService';

export class CaseMemoryEngine {
  constructor(storageAdapter = defaultMemoryStorageAdapter) {
    this.storage = storageAdapter;
  }

  /**
   * Records a citizen-provided factual case note
   */
  async recordFactualNote({
    tenantId = 'default',
    caseId,
    title,
    text,
    category = MEMORY_CATEGORIES.INTERACTION_SUMMARY,
    metadata = {},
    ttlSeconds,
    citizenSecret = '',
    requestingContext = { tenantId, caseId },
  }) {
    assertCaseScope(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);

    const entry = createFactualNoteEntry({
      tenantId,
      caseId,
      title,
      text,
      category,
      metadata,
      ttlSeconds,
    });

    const encryptedEnvelope = await encryptPayload(entry.payload, tenantId, caseId, citizenSecret);

    const recordToStore = {
      id: entry.id,
      tenantId: entry.tenantId,
      caseId: entry.caseId,
      entryType: entry.entryType,
      category: entry.category,
      provenance: entry.provenance,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      ttlSeconds: entry.ttlSeconds,
      envelope: encryptedEnvelope,
    };

    this.storage.saveRecord(tenantId, caseId, entry.id, recordToStore);

    // Publish event if domain event type is supported
    if (CIVIC_EVENT_TYPE.CASE_MEMORY_CREATED) {
      stageOutboxEvent({
        eventType: CIVIC_EVENT_TYPE.CASE_MEMORY_CREATED,
        aggregateId: `${tenantId}:${caseId}`,
        payload: {
          memoryId: entry.id,
          entryType: entry.entryType,
          category: entry.category,
          expiresAt: entry.expiresAt,
        },
      });
    }

    return {
      ...recordToStore,
      payload: entry.payload,
    };
  }

  /**
   * Records an untrusted model-generated proposal with citation provenance
   */
  async recordModelProposal({
    tenantId = 'default',
    caseId,
    title,
    text,
    category = MEMORY_CATEGORIES.ACTION_STEP,
    citationIds = [],
    confidenceScore = 0.5,
    metadata = {},
    ttlSeconds,
    citizenSecret = '',
    requestingContext = { tenantId, caseId },
  }) {
    assertCaseScope(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);

    const entry = createModelProposalEntry({
      tenantId,
      caseId,
      title,
      text,
      category,
      citationIds,
      confidenceScore,
      metadata,
      ttlSeconds,
    });

    const encryptedEnvelope = await encryptPayload(entry.payload, tenantId, caseId, citizenSecret);

    const recordToStore = {
      id: entry.id,
      tenantId: entry.tenantId,
      caseId: entry.caseId,
      entryType: entry.entryType,
      category: entry.category,
      provenance: entry.provenance,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      ttlSeconds: entry.ttlSeconds,
      envelope: encryptedEnvelope,
    };

    this.storage.saveRecord(tenantId, caseId, entry.id, recordToStore);

    if (CIVIC_EVENT_TYPE.CASE_MEMORY_CREATED) {
      stageOutboxEvent({
        eventType: CIVIC_EVENT_TYPE.CASE_MEMORY_CREATED,
        aggregateId: `${tenantId}:${caseId}`,
        payload: {
          memoryId: entry.id,
          entryType: entry.entryType,
          category: entry.category,
          expiresAt: entry.expiresAt,
        },
      });
    }

    return {
      ...recordToStore,
      payload: entry.payload,
    };
  }

  /**
   * Queries active memories for a specific case.
   * Guarantees zero cross-case leakage.
   */
  async queryCaseMemory(tenantId, caseId, options = {}, requestingContext = { tenantId, caseId }, citizenSecret = '') {
    assertCaseScope(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);

    const records = this.storage.listRecordsForCase(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);
    const now = Date.now();
    const results = [];

    for (const record of records) {
      // Exclude expired records
      if (record.expiresAt && record.expiresAt <= now) {
        continue;
      }

      // Filter by entryType if requested
      if (options.entryType && record.entryType !== options.entryType) {
        continue;
      }

      // Filter by category if requested
      if (options.category && record.category !== options.category) {
        continue;
      }

      let decryptedPayload = null;
      if (record.envelope) {
        try {
          decryptedPayload = await decryptPayload(record.envelope, tenantId, caseId, citizenSecret);
        } catch {
          decryptedPayload = { title: '[Decryption Error]', text: '[Unable to decrypt with provided credentials]' };
        }
      }

      results.push({
        ...record,
        payload: decryptedPayload,
      });
    }

    // Sort by createdAt descending (newest first)
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results;
  }

  /**
   * Promotes an untrusted model proposal into a verified factual note upon human approval
   */
  async verifyAndPromoteProposal(tenantId, caseId, memoryId, requestingContext = { tenantId, caseId }, citizenSecret = '') {
    assertCaseScope(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);

    const record = this.storage.readRecord(tenantId, caseId, memoryId, requestingContext.tenantId, requestingContext.caseId);
    if (!record) {
      throw new Error(`Memory entry not found: ${memoryId}`);
    }

    if (record.entryType !== MEMORY_ENTRY_TYPES.MODEL_PROPOSAL) {
      throw new Error(`Entry is already a ${record.entryType}, cannot promote`);
    }

    // Decrypt existing payload
    const decryptedPayload = await decryptPayload(record.envelope, tenantId, caseId, citizenSecret);

    const updatedRecord = {
      ...record,
      entryType: MEMORY_ENTRY_TYPES.FACTUAL_NOTE,
      provenance: {
        ...record.provenance,
        verifiedByCitizen: true,
        promotedAt: Date.now(),
      },
    };

    // Re-encrypt to update envelope
    const newEnvelope = await encryptPayload(decryptedPayload, tenantId, caseId, citizenSecret);
    updatedRecord.envelope = newEnvelope;

    this.storage.saveRecord(tenantId, caseId, memoryId, updatedRecord);

    if (CIVIC_EVENT_TYPE.CASE_MEMORY_UPDATED) {
      stageOutboxEvent({
        eventType: CIVIC_EVENT_TYPE.CASE_MEMORY_UPDATED,
        aggregateId: `${tenantId}:${caseId}`,
        payload: {
          memoryId,
          promoted: true,
        },
      });
    }

    return {
      ...updatedRecord,
      payload: decryptedPayload,
    };
  }

  /**
   * Deletes a specific memory entry
   */
  deleteMemoryEntry(tenantId, caseId, memoryId, requestingContext = { tenantId, caseId }) {
    assertCaseScope(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);
    return this.storage.deleteRecord(tenantId, caseId, memoryId, requestingContext.tenantId, requestingContext.caseId);
  }

  /**
   * Purges all memories associated with a case and raises domain event
   */
  purgeCaseMemory(tenantId, caseId, requestingContext = { tenantId, caseId }) {
    assertCaseScope(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);

    const clearedCount = this.storage.clearCaseMemories(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);

    if (CIVIC_EVENT_TYPE.CASE_MEMORY_PURGED) {
      stageOutboxEvent({
        eventType: CIVIC_EVENT_TYPE.CASE_MEMORY_PURGED,
        aggregateId: `${tenantId}:${caseId}`,
        payload: {
          tenantId,
          caseId,
          clearedCount,
          purgedAt: Date.now(),
        },
      });
    }

    return { success: true, clearedCount };
  }

  /**
   * Exports case memory in JSON or Markdown format adhering to privacy standards
   */
  async exportCaseMemory(tenantId, caseId, format = 'json', requestingContext = { tenantId, caseId }, citizenSecret = '') {
    assertCaseScope(tenantId, caseId, requestingContext.tenantId, requestingContext.caseId);

    const memories = await this.queryCaseMemory(tenantId, caseId, {}, requestingContext, citizenSecret);

    const factualNotes = memories.filter((m) => m.entryType === MEMORY_ENTRY_TYPES.FACTUAL_NOTE);
    const modelProposals = memories.filter((m) => m.entryType === MEMORY_ENTRY_TYPES.MODEL_PROPOSAL);

    if (format === 'markdown') {
      let md = `# Civic Help Setu — Isolated Case Memory Report\n\n`;
      md += `**Case ID:** ${caseId}\n`;
      md += `**Tenant:** ${tenantId}\n`;
      md += `**Exported At:** ${new Date().toISOString()}\n\n`;
      md += `> [!NOTE]\n> AI proposals are unverified suggestions until confirmed by a citizen. No official government authority is claimed.\n\n`;

      md += `## 1. Verified Factual Case Notes (${factualNotes.length})\n\n`;
      if (factualNotes.length === 0) {
        md += `*No factual notes recorded.*\n\n`;
      } else {
        factualNotes.forEach((n, idx) => {
          md += `### ${idx + 1}. ${n.payload?.title || 'Note'}\n`;
          md += `- **Category:** ${n.category}\n`;
          md += `- **Recorded:** ${new Date(n.createdAt).toLocaleString()}\n`;
          md += `- **Expires:** ${new Date(n.expiresAt).toLocaleString()}\n\n`;
          md += `${n.payload?.text || ''}\n\n`;
        });
      }

      md += `## 2. Model Suggestions & Proposals (${modelProposals.length})\n\n`;
      if (modelProposals.length === 0) {
        md += `*No active model suggestions.*\n\n`;
      } else {
        modelProposals.forEach((p, idx) => {
          md += `### ${idx + 1}. ${p.payload?.title || 'Suggestion'}\n`;
          md += `- **Category:** ${p.category}\n`;
          md += `- **Confidence:** ${Math.round((p.provenance?.confidenceScore || 0) * 100)}%\n`;
          md += `- **Citations:** ${(p.provenance?.citationIds || []).join(', ') || 'None'}\n\n`;
          md += `${p.payload?.text || ''}\n\n`;
        });
      }

      return md;
    }

    // Default JSON structure
    return {
      version: '1.0.0',
      exportType: 'CASE_AGENT_MEMORY',
      tenantId,
      caseId,
      exportedAt: new Date().toISOString(),
      counts: {
        total: memories.length,
        factualNotes: factualNotes.length,
        modelProposals: modelProposals.length,
      },
      factualNotes: factualNotes.map((n) => ({
        id: n.id,
        category: n.category,
        title: n.payload?.title,
        text: n.payload?.text,
        createdAt: n.createdAt,
        expiresAt: n.expiresAt,
      })),
      modelProposals: modelProposals.map((p) => ({
        id: p.id,
        category: p.category,
        title: p.payload?.title,
        text: p.payload?.text,
        confidenceScore: p.provenance?.confidenceScore,
        citationIds: p.provenance?.citationIds,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
      })),
    };
  }
}

// Singleton instance
export const caseMemoryEngine = new CaseMemoryEngine();
