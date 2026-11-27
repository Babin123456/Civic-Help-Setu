/**
 * src/services/formFieldTranslationMemoryExtension.test.js
 *
 * Unit tests for Multilingual Civic Form Field Translation Memory (#1423).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveFormFieldLabel,
  proposeFormFieldTranslation,
  approveFormFieldTranslation,
  isLegalOrStatutoryTerm,
  listTranslationAuditLog,
} from './formFieldTranslationMemoryExtension.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('formFieldTranslationMemoryExtension (#1423)', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('resolves approved translation with script, reviewer, and version, and falls back to original wording when missing', () => {
    const hit = resolveFormFieldLabel({
      sourcePhrase: 'Annual Family Income',
      targetLanguage: 'hi',
      customStorage: storage,
    });
    expect(hit.fallbackUsed).toBe(false);
    expect(hit.label).toBe('वार्षिक पारिवारिक आय');
    expect(hit.script).toBe('Devanagari');
    expect(hit.reviewer).toBe('reviewer_revenue_1');
    expect(hit.version).toBe(1);

    const miss = resolveFormFieldLabel({
      sourcePhrase: 'Encumbrance Certificate Number',
      targetLanguage: 'ta',
      customStorage: storage,
    });
    expect(miss.fallbackUsed).toBe(true);
    expect(miss.label).toBe('Encumbrance Certificate Number');
    expect(miss.isLegalTerm).toBe(true);
  });

  it('flags legal terms for mandatory human review, blocks self-review, and increments version on approval', () => {
    expect(isLegalOrStatutoryTerm('Caste Certificate Affidavit')).toBe(true);

    const prop = proposeFormFieldTranslation({
      sourcePhrase: 'Caste Certificate Affidavit',
      proposedTranslation: 'जाति प्रमाण पत्र शपथ पत्र',
      language: 'hi',
      proposedBy: 'contrib-1',
      customStorage: storage,
    });
    expect(prop.isLegalTerm).toBe(true);
    expect(prop.requiresLegalHumanReview).toBe(true);
    expect(prop.status).toBe('pending');

    // Citizen/contributor cannot approve or self-review
    expect(() =>
      approveFormFieldTranslation({
        entryId: prop.entryId,
        reviewerId: 'contrib-1',
        reviewerRole: 'citizen',
        customStorage: storage,
      })
    ).toThrow(/forbidden/i);

    expect(() =>
      approveFormFieldTranslation({
        entryId: prop.entryId,
        reviewerId: 'contrib-1',
        reviewerRole: 'reviewer',
        customStorage: storage,
      })
    ).toThrow(/role separation/i);

    const approved = approveFormFieldTranslation({
      entryId: prop.entryId,
      reviewerId: 'legal-rev-1',
      reviewerRole: 'legal_reviewer',
      decision: 'APPROVE',
      customStorage: storage,
    });
    expect(approved.status).toBe('approved');
    expect(approved.version).toBe(1);
    expect(approved.reviewer).toBe('legal-rev-1');
    expect(listTranslationAuditLog(storage)[0].action).toBe('TM_APPROVED');
  });

  it('rejects Aadhaar and PAN PII in translation entries', () => {
    expect(() =>
      proposeFormFieldTranslation({
        sourcePhrase: 'Field 1234 5678 9012',
        proposedTranslation: 'क्षेत्र',
        language: 'hi',
        customStorage: storage,
      })
    ).toThrow(/Aadhaar or PAN/i);
  });
});
