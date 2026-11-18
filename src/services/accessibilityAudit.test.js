import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { CHECKS, evaluateAudit, estimatePenalty, draftAccessibilityPetition } from './accessibilityAuditService.js';
import { minimizeAudit, saveAudit, verifyAudit, deleteAudit, listAudits } from './accessibilityAuditStorage.js';

describe('accessibility audit', () => {
  beforeEach(() => {
    const data = new Map();
    vi.stubGlobal('localStorage', { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) });
    vi.stubGlobal('crypto', webcrypto);
  });
  it('excludes unknown and inapplicable checks and identifies priority hazards', () => {
    expect(evaluateAudit({}).score).toBeNull();
    const result = evaluateAudit({ ramp: 'no', door: 'yes', lift: 'na' });
    expect(result.score).toBe(50);
    expect(result.assessed).toBe(2);
    expect(result.hazards).toEqual([CHECKS[0].label]);
  });
  it('provides conditional penalty guidance and a petition', () => {
    expect(estimatePenalty('subsequent')).toContain('₹5,00,000');
    expect(estimatePenalty('unknown')).toContain('not automatic');
    expect(draftAccessibilityPetition({ authority: 'state', facility: '', district: '', facts: '', audit: evaluateAudit({}) })).toContain('State Commissioner');
  });
  it('persists only checklist data and detects modifications', async () => {
    const data = { ramp: 'no', name: 'private person', location: 'private address' };
    expect(JSON.stringify(minimizeAudit(data))).not.toContain('private');
    const saved = await saveAudit(data);
    expect(await verifyAudit(saved)).toBe(true);
    expect(await verifyAudit({ ...saved, answers: { ...saved.answers, ramp: 'yes' } })).toBe(false);
    deleteAudit(saved.id); expect(listAudits()).toEqual([]);
  });
});
