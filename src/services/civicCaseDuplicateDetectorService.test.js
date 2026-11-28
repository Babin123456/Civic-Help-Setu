/**
 * src/services/civicCaseDuplicateDetectorService.test.js
 *
 * Unit, human-confirmation, separate-case-ID, PII-guard, and
 * precision/recall evaluation tests for #1427.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LINK_DECISIONS,
  detectDuplicateAndRelatedCases,
  confirmCaseRelationship,
  listCaseLinks,
  evaluateDuplicateDetector,
} from './civicCaseDuplicateDetectorService.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('civicCaseDuplicateDetectorService (#1427)', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('detects likely duplicates with explainable confidence reasons and requires human confirmation', () => {
    const res = detectDuplicateAndRelatedCases(
      {
        caseId: 'CASE-NEW',
        category: 'Ration Card',
        jurisdiction: 'Delhi Ward 5',
        confirmedReferenceId: 'RC/2026/101',
        submittedAt: '2026-11-22T10:00:00Z',
      },
      [
        {
          caseId: 'CASE-OLD',
          title: 'Ration Card Issue',
          category: 'Ration Card',
          jurisdiction: 'Delhi Ward 5',
          confirmedReferenceId: 'RC/2026/101',
          submittedAt: '2026-11-20T10:00:00Z',
        },
      ]
    );

    expect(res.separateCaseIdsPreserved).toBe(true);
    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].classification).toBe('LIKELY_DUPLICATE');
    expect(res.suggestions[0].requiresHumanConfirmation).toBe(true);
    expect(res.suggestions[0].confidenceReasons.length).toBeGreaterThanOrEqual(3);
  });

  it('records human confirmation while preserving separate case IDs', () => {
    const link = confirmCaseRelationship({
      primaryCaseId: 'CASE-1',
      candidateCaseId: 'CASE-2',
      decision: LINK_DECISIONS.LINK_DUPLICATE,
      confirmedBy: 'officer-1',
      reason: 'Confirmed same household application ref',
      customStorage: storage,
    });

    expect(link.separateCaseIdsPreserved).toBe(true);
    expect(link.primaryCaseId).toBe('CASE-1');
    expect(link.candidateCaseId).toBe('CASE-2');
    expect(listCaseLinks(storage)).toHaveLength(1);
  });

  it('rejects Aadhaar/PAN/phone PII in case payloads and confirmation reasons', () => {
    expect(() =>
      detectDuplicateAndRelatedCases({ caseId: 'C1', summary: 'Aadhaar 1234 5678 9012' }, [])
    ).toThrow(/Aadhaar, PAN, or personal phone/i);

    expect(() =>
      confirmCaseRelationship({
        primaryCaseId: 'C1',
        candidateCaseId: 'C2',
        decision: LINK_DECISIONS.MARK_DISTINCT,
        reason: 'Call 9876543210',
        customStorage: storage,
      })
    ).toThrow(/Aadhaar, PAN, or personal phone/i);
  });

  it('achieves high precision and recall on synthetic evaluation fixtures', () => {
    const metrics = evaluateDuplicateDetector();
    expect(metrics.totalFixtures).toBeGreaterThanOrEqual(4);
    expect(metrics.precision).toBeGreaterThanOrEqual(0.8);
    expect(metrics.recall).toBeGreaterThanOrEqual(0.8);
    expect(metrics.fp).toBe(0);
  });
});
