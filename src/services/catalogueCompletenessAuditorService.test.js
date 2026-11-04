import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  auditServiceRecord,
  runCatalogueCompletenessAudit,
  detectVaguePhrasing,
  dismissAuditorFinding,
  resetAuditorDismissals,
  exportAuditFindings,
} from './catalogueCompletenessAuditorService';

describe('catalogueCompletenessAuditorService (#474)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    });
  });

  const completeService = {
    id: 'srv-comp-1',
    title: 'Senior Citizen Health Subsidy',
    description: 'A comprehensive medical welfare scheme offering financial subsidies for geriatric care and chronic ailments.',
    targetAudience: 'Senior citizens aged 60 and above',
    department: 'Department of Social Welfare',
    applicationMode: 'Online & CSC Counters',
    documents: ['Aadhaar card', 'Age certificate', 'Income certificate'],
    officialUrl: 'https://welfare.gov.in/senior-subsidy',
    contactInfo: '1800-111-222',
    lastVerifiedDate: '2026-09-01',
  };

  const incompleteService = {
    id: 'srv-incomp-2',
    title: 'Rural Pond Renovation',
    description: 'Renovation program etc. for village ponds.', // short + vague term
    department: '', // missing
    documents: [], // empty
  };

  it('reports zero missing field defects for a fully specified catalogue record', () => {
    const findings = auditServiceRecord(completeService);
    expect(findings).toHaveLength(0);
  });

  it('detects missing fields and vague terminology in incomplete records', () => {
    const findings = auditServiceRecord(incompleteService);
    expect(findings.length).toBeGreaterThan(0);

    const missingDept = findings.find((f) => f.field === 'department');
    expect(missingDept).toBeDefined();
    expect(missingDept.severity).toBe('CRITICAL');

    const missingDocs = findings.find((f) => f.field === 'documents');
    expect(missingDocs).toBeDefined();

    const vagueNotice = findings.find((f) => f.type === 'VAGUE_LANGUAGE');
    expect(vagueNotice).toBeDefined();
    expect(vagueNotice.impactExplanation).toContain('etc.');
  });

  it('identifies non-committal vague phrases correctly', () => {
    const phrases = detectVaguePhrasing('Submit standard documents as applicable and others etc.');
    expect(phrases).toContain('as applicable');
    expect(phrases).toContain('standard documents');
    expect(phrases).toContain('and others');
  });

  it('runs complete audit across catalogue with dismissal handling', () => {
    const catalog = [completeService, incompleteService];
    const initialReport = runCatalogueCompletenessAudit(catalog);

    expect(initialReport.totalScanned).toBe(2);
    expect(initialReport.activeCount).toBeGreaterThan(0);

    // Dismiss first finding
    const firstFinding = initialReport.activeFindings[0];
    dismissAuditorFinding(firstFinding.id);

    const updatedReport = runCatalogueCompletenessAudit(catalog);
    expect(updatedReport.activeCount).toBe(initialReport.activeCount - 1);
    expect(updatedReport.dismissedCount).toBe(1);

    // Reset dismissals
    resetAuditorDismissals();
    const resetReport = runCatalogueCompletenessAudit(catalog);
    expect(resetReport.activeCount).toBe(initialReport.activeCount);
  });

  it('exports audit findings as valid JSON or CSV', () => {
    const findings = auditServiceRecord(incompleteService);
    const jsonExport = exportAuditFindings(findings, 'json');
    expect(JSON.parse(jsonExport)).toHaveLength(findings.length);

    const csvExport = exportAuditFindings(findings, 'csv');
    expect(csvExport).toContain('Finding ID,Service ID');
    expect(csvExport).toContain('Rural Pond Renovation');
  });
});
