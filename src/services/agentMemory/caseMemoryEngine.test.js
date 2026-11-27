import { describe, it, expect, beforeEach } from 'vitest';
import { CaseMemoryEngine } from './caseMemoryEngine';
import { CaseMemoryStorageAdapter } from './caseMemoryStorage';
import { MEMORY_ENTRY_TYPES, MEMORY_CATEGORIES } from './memoryClassifier';

const createMockStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] || null,
    get length() {
      return map.size;
    },
  };
};

describe('caseMemoryEngine', () => {
  let mockStorage;
  let engine;

  beforeEach(() => {
    mockStorage = createMockStorage();
    engine = new CaseMemoryEngine(new CaseMemoryStorageAdapter(mockStorage));
  });

  it('records factual notes with automatic PII sanitization and encryption at rest', async () => {
    const rawNote = {
      tenantId: 'tenant1',
      caseId: 'case100',
      title: 'Aadhaar Reference Verification',
      text: 'Citizen mobile is 9876543210 and Aadhaar is 1234 5678 9012.',
      category: MEMORY_CATEGORIES.DOCUMENT_METADATA,
    };

    const recorded = await engine.recordFactualNote(rawNote);

    expect(recorded.id).toBeDefined();
    expect(recorded.entryType).toBe(MEMORY_ENTRY_TYPES.FACTUAL_NOTE);
    // Verified ground truth
    expect(recorded.provenance.verifiedByCitizen).toBe(true);
    // PII should be sanitized by dataMinimization
    expect(recorded.payload.text).toContain('[REDACTED_PHONE]');
    expect(recorded.payload.text).toContain('[REDACTED_AADHAAR]');

    // Check at-rest encryption in underlying storage
    const rawStored = JSON.parse(mockStorage.getItem(`chsetu:mem:tenant1:case100:${recorded.id}`));
    expect(rawStored.envelope).toBeDefined();
    expect(rawStored.envelope.algorithm).toBe('AES-GCM-256');
    expect(rawStored.payload).toBeUndefined(); // plaintext payload NOT stored bare
  });

  it('records untrusted model proposals and allows citizen promotion to factual note', async () => {
    const proposal = await engine.recordModelProposal({
      tenantId: 'tenant1',
      caseId: 'case100',
      title: 'Suggested Next Action',
      text: 'Apply for non-creamy layer certificate at Tehsildar office.',
      citationIds: ['chunk-gov-tn-12'],
      confidenceScore: 0.88,
    });

    expect(proposal.entryType).toBe(MEMORY_ENTRY_TYPES.MODEL_PROPOSAL);
    expect(proposal.provenance.verifiedByCitizen).toBe(false);

    // Promote proposal after citizen review
    const promoted = await engine.verifyAndPromoteProposal('tenant1', 'case100', proposal.id);
    expect(promoted.entryType).toBe(MEMORY_ENTRY_TYPES.FACTUAL_NOTE);
    expect(promoted.provenance.verifiedByCitizen).toBe(true);
    expect(promoted.provenance.promotedAt).toBeTypeOf('number');
  });

  it('queries active memories, excluding expired entries and respecting filters', async () => {
    await engine.recordFactualNote({
      tenantId: 'tenant1',
      caseId: 'case100',
      title: 'Active Fact',
      text: 'Valid fact.',
      category: MEMORY_CATEGORIES.ELIGIBILITY_CRITERIA,
      ttlSeconds: 3600,
    });

    await engine.recordModelProposal({
      tenantId: 'tenant1',
      caseId: 'case100',
      title: 'Active Suggestion',
      text: 'Suggestion text.',
      category: MEMORY_CATEGORIES.ACTION_STEP,
      ttlSeconds: 3600,
    });

    const all = await engine.queryCaseMemory('tenant1', 'case100');
    expect(all.length).toBe(2);

    const factsOnly = await engine.queryCaseMemory('tenant1', 'case100', {
      entryType: MEMORY_ENTRY_TYPES.FACTUAL_NOTE,
    });
    expect(factsOnly.length).toBe(1);
    expect(factsOnly[0].payload.title).toBe('Active Fact');
  });

  it('purges all memories for a case cleanly', async () => {
    await engine.recordFactualNote({
      tenantId: 'tenant1',
      caseId: 'case100',
      title: 'Note',
      text: 'Data',
    });

    const purgeResult = engine.purgeCaseMemory('tenant1', 'case100');
    expect(purgeResult.clearedCount).toBe(1);

    const afterPurge = await engine.queryCaseMemory('tenant1', 'case100');
    expect(afterPurge).toEqual([]);
  });

  it('exports case memory in standard JSON and Markdown formats', async () => {
    await engine.recordFactualNote({
      tenantId: 'tenant1',
      caseId: 'case100',
      title: 'Fact One',
      text: 'Important requirement.',
    });
    await engine.recordModelProposal({
      tenantId: 'tenant1',
      caseId: 'case100',
      title: 'Proposal One',
      text: 'Possible next step.',
    });

    const jsonExport = await engine.exportCaseMemory('tenant1', 'case100', 'json');
    expect(jsonExport.exportType).toBe('CASE_AGENT_MEMORY');
    expect(jsonExport.counts.factualNotes).toBe(1);
    expect(jsonExport.counts.modelProposals).toBe(1);

    const mdExport = await engine.exportCaseMemory('tenant1', 'case100', 'markdown');
    expect(mdExport).toContain('# Civic Help Setu — Isolated Case Memory Report');
    expect(mdExport).toContain('## 1. Verified Factual Case Notes');
    expect(mdExport).toContain('## 2. Model Suggestions & Proposals');
  });
});
