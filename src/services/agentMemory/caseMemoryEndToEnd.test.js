import { describe, it, expect, beforeEach } from 'vitest';
import { CaseMemoryEngine } from './caseMemoryEngine';
import { CaseMemoryStorageAdapter } from './caseMemoryStorage';
import { MEMORY_ENTRY_TYPES, MEMORY_CATEGORIES } from './memoryClassifier';
import { formatCaseMemoryContext } from '../../ai/conversationContext';

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

describe('End-to-End Vertical Slice: Isolated Agent Memory Lifecycle', () => {
  let mockStorage;
  let engine;

  beforeEach(() => {
    mockStorage = createMockStorage();
    engine = new CaseMemoryEngine(new CaseMemoryStorageAdapter(mockStorage));
  });

  it('completes the entire citizen consultation and memory isolation journey', async () => {
    const tenantId = 'default';
    const caseId = 'case-driving-licence-2026';

    // Step 1: Citizen provides factual case constraint
    const citizenFact = await engine.recordFactualNote({
      tenantId,
      caseId,
      title: 'Existing Learner Licence',
      text: 'Learner Licence LL-TN-2026-98124 issued 3 months ago.',
      category: MEMORY_CATEGORIES.DOCUMENT_METADATA,
    });
    expect(citizenFact.entryType).toBe(MEMORY_ENTRY_TYPES.FACTUAL_NOTE);
    expect(citizenFact.provenance.verifiedByCitizen).toBe(true);

    // Step 2: Assistant generates an AI suggestion proposal
    const aiProposal = await engine.recordModelProposal({
      tenantId,
      caseId,
      title: 'Driving Skill Test Booking',
      text: 'Book slot at Regional Transport Office for practical driving assessment.',
      category: MEMORY_CATEGORIES.ACTION_STEP,
      citationIds: ['chunk-parivahan-dl-04'],
      confidenceScore: 0.91,
    });
    expect(aiProposal.entryType).toBe(MEMORY_ENTRY_TYPES.MODEL_PROPOSAL);
    expect(aiProposal.provenance.verifiedByCitizen).toBe(false);

    // Step 3: Query active memories for the case and format into contextual prompt
    const activeMemories = await engine.queryCaseMemory(tenantId, caseId);
    expect(activeMemories.length).toBe(2);

    const promptContext = formatCaseMemoryContext(activeMemories);
    expect(promptContext).toContain('[VERIFIED CASE FACTS - GROUND TRUTH]');
    expect(promptContext).toContain('Existing Learner Licence');
    expect(promptContext).toContain('[UNVERIFIED AI PROPOSALS - REQUIRES CITIZEN CONFIRMATION]');
    expect(promptContext).toContain('Driving Skill Test Booking [conf: 91%]');

    // Step 4: Citizen reviews and promotes the AI proposal into ground truth
    const promoted = await engine.verifyAndPromoteProposal(tenantId, caseId, aiProposal.id);
    expect(promoted.entryType).toBe(MEMORY_ENTRY_TYPES.FACTUAL_NOTE);
    expect(promoted.provenance.verifiedByCitizen).toBe(true);

    // Step 5: Export memory transcript adhering to privacy standards
    const jsonExport = await engine.exportCaseMemory(tenantId, caseId, 'json');
    expect(jsonExport.counts.factualNotes).toBe(2); // Both are now verified facts
    expect(jsonExport.counts.modelProposals).toBe(0);

    const mdExport = await engine.exportCaseMemory(tenantId, caseId, 'markdown');
    expect(mdExport).toContain('## 1. Verified Factual Case Notes (2)');

    // Step 6: Instant citizen hard purge of all case memory
    const purgeResult = engine.purgeCaseMemory(tenantId, caseId);
    expect(purgeResult.success).toBe(true);
    expect(purgeResult.clearedCount).toBe(2);

    // Verify 100% clean state
    const remaining = await engine.queryCaseMemory(tenantId, caseId);
    expect(remaining).toEqual([]);
  });
});
