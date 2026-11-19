import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { PATTERNS, classifyPatterns, auditPricing, draftNotice } from './darkPatternsService.js';
import { minimizeRecord, saveRecord, listRecords, deleteRecord, verifyRecord, exportJson } from './darkPatternsStorage.js';

describe('dark patterns workspace', () => {
  beforeEach(() => {
    const map = new Map();
    vi.stubGlobal('localStorage', { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) });
    vi.stubGlobal('crypto', webcrypto);
  });
  it('offers all thirteen categories and finds multiple matches', () => {
    expect(PATTERNS).toHaveLength(13);
    expect(classifyPatterns('countdown and hidden fee')).toEqual(['False urgency', 'Drip pricing']);
  });
  it('calculates unexplained charges, handles zero and rejects invalid input', () => {
    expect(auditPricing(100, 135, 10)).toMatchObject({ difference: 35, unexplained: 25, percentage: 25 });
    expect(auditPricing(0, 5, 0).percentage).toBeNull();
    expect(() => auditPricing('', 10, 0)).toThrow();
    expect(() => auditPricing(-1, 10, 0)).toThrow();
  });
  it('generates the three distinct documents', () => {
    expect(draftNotice({}, 'notice')).toContain('15 days');
    expect(draftNotice({}, 'ccpa')).toContain('Section 20');
    expect(draftNotice({}, 'dcdrc')).toContain('Section 35');
  });
  it('minimizes, seals, detects tampering, exports and deletes', async () => {
    const input = { trader: 'Shop', facts: 'email: person@example.com; order: ABC', headline: 100, final: 120, disclosed: 0 };
    expect(JSON.stringify(minimizeRecord(input))).not.toContain('person@example.com');
    expect(JSON.stringify(minimizeRecord(input))).not.toContain('ABC');
    const saved = await saveRecord(input);
    expect(await verifyRecord(saved)).toBe(true);
    expect(await verifyRecord({ ...saved, final: 1 })).toBe(false);
    expect(JSON.parse(exportJson(saved)).seal).toBe(saved.seal);
    deleteRecord(saved.id); expect(listRecords()).toHaveLength(0);
  });
});
