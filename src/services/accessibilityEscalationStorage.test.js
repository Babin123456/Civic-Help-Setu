import { describe, it, expect, beforeEach } from 'vitest';
import {
  listAccessibilityCases,
  getAccessibilityCaseById,
  saveAccessibilityCase,
  deleteAccessibilityCase,
  computeCaseDigest,
  verifyCaseIntegrity,
  exportCaseTimelineJson,
  exportCaseTimelineMarkdown,
  exportAllCasesDossier,
  resetToSampleCases,
  clearAllAccessibilityCases,
  INITIAL_SAMPLE_CASES,
  OFFICIAL_STATUS_DISCLAIMER,
} from './accessibilityEscalationStorage.js';

describe('accessibilityEscalationStorage (#950)', () => {
  let mockStorage;
  let store;

  beforeEach(() => {
    store = new Map();
    mockStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, val) => store.set(key, String(val)),
      removeItem: (key) => store.delete(key),
    };
  });

  it('initializes with seed sample case when storage is empty', () => {
    const cases = listAccessibilityCases(mockStorage);
    expect(cases.length).toBeGreaterThanOrEqual(1);
    expect(cases[0].id).toBe(INITIAL_SAMPLE_CASES[0].id);
    expect(cases[0].events.length).toBe(3);
    expect(cases[0].officialStatusDisclaimer).toBe(OFFICIAL_STATUS_DISCLAIMER);
  });

  it('computes deterministic SHA-256 seal and detects tampering', async () => {
    const testCase = {
      id: 'case-test-01',
      title: 'Missing Ramp at Bus Terminal',
      facilityName: 'Central Bus Terminal',
      facilityType: 'transit',
      location: 'Platform 3, Central Bus Stand',
      authorityType: 'TRANSPORT_AUTHORITY',
      officialComplaintNumber: 'TC/2026/091',
      status: 'REPORT_FILED',
      events: [
        { id: 'e1', eventDate: '2026-02-01', summary: 'Lodged complaint' },
      ],
      createdAt: '2026-02-01T10:00:00.000Z',
    };

    const digest1 = await computeCaseDigest(testCase);
    const digest2 = await computeCaseDigest(testCase);
    expect(digest1).toBe(digest2);
    expect(digest1.length).toBeGreaterThan(0);

    testCase.digest = digest1;
    const verification = await verifyCaseIntegrity(testCase);
    expect(verification.valid).toBe(true);

    // Tamper with event count / title
    const tampered = { ...testCase, title: 'Tampered Unauthorized Title' };
    const tamperedVerification = await verifyCaseIntegrity(tampered);
    expect(tamperedVerification.valid).toBe(false);
  });

  it('saves, retrieves, and deletes an accessibility case', async () => {
    const newCase = await saveAccessibilityCase(
      {
        title: 'Metro Station Tactile Paving Damaged',
        facilityName: 'City Center Metro',
        facilityType: 'transit',
        location: 'Gate 2 Entrance',
        authorityType: 'TRANSPORT_AUTHORITY',
        events: [],
      },
      mockStorage
    );

    expect(newCase.id).toBeDefined();
    expect(newCase.digest).toBeDefined();

    const retrieved = getAccessibilityCaseById(newCase.id, mockStorage);
    expect(retrieved).not.toBeNull();
    expect(retrieved.facilityName).toBe('City Center Metro');

    deleteAccessibilityCase(newCase.id, mockStorage);
    const afterDelete = getAccessibilityCaseById(newCase.id, mockStorage);
    expect(afterDelete).toBeNull();
  });

  it('clears all cases from storage for privacy compliance', async () => {
    await saveAccessibilityCase({ title: 'Case A' }, mockStorage);
    clearAllAccessibilityCases(mockStorage);
    const cases = listAccessibilityCases(mockStorage);
    expect(cases.length).toBe(0);
  });

  it('exports case timeline as JSON and Markdown', async () => {
    const caseData = INITIAL_SAMPLE_CASES[0];

    const jsonStr = exportCaseTimelineJson(caseData);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.generator).toContain('Accessibility Complaint');
    expect(parsed.case.facilityName).toBe(caseData.facilityName);

    const mdStr = exportCaseTimelineMarkdown(caseData);
    expect(mdStr).toContain('# ACCESSIBILITY COMPLAINT TIMELINE');
    expect(mdStr).toContain(caseData.facilityName);
    expect(mdStr).toContain('CHRONOLOGICAL EVENT LOG');
    expect(mdStr).toContain(OFFICIAL_STATUS_DISCLAIMER);
  });

  it('resets to sample cases and exports master dossier for all cases', () => {
    clearAllAccessibilityCases(mockStorage);
    expect(listAccessibilityCases(mockStorage).length).toBe(0);

    const resetCases = resetToSampleCases(mockStorage);
    expect(resetCases.length).toBeGreaterThanOrEqual(1);

    const dossier = exportAllCasesDossier(resetCases);
    expect(dossier).toContain('# MASTER ACCESSIBILITY COMPLAINT DOSSIER');
    expect(dossier).toContain('Total Cases Tracked:');
    expect(dossier).toContain(OFFICIAL_STATUS_DISCLAIMER);
  });
});
