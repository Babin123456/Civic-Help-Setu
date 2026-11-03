import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  scanServiceForContradictions,
  scanCatalogueForContradictions,
  dismissConflict,
  restoreConflict,
  getDismissedConflictIds,
  CONFLICT_TYPES,
} from './catalogueConflictDetectorService.js';

describe('catalogueConflictDetectorService', () => {
  let store = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    });
  });

  const cleanService = {
    id: 'clean-aadhaar',
    name: 'Aadhaar Demographic Update',
    category: 'Identity',
    description: 'Update your official resident demographic details on Aadhaar database.',
    fees: 'Rs. 50 statutory UIDAI fee',
    feeAmount: 50,
    eligibility: ['Resident of India with active Aadhaar card'],
    documents: ['Proof of Identity', 'Proof of Address'],
  };

  it('reports zero contradictions for clean service record', () => {
    const conflicts = scanServiceForContradictions(cleanService);
    expect(conflicts.length).toBe(0);
  });

  it('detects fee contradiction when narrative claims free but fee field lists charges', () => {
    const feeContradictionService = {
      id: 'conflicted-pension',
      name: 'Old Age Pension Application',
      category: 'Social Welfare',
      description: 'Free of cost civic entitlement for senior citizens. No charges required.',
      fees: 'Rs. 150 processing fee',
      feeAmount: 150,
    };

    const conflicts = scanServiceForContradictions(feeContradictionService);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe(CONFLICT_TYPES.FEE_CONTRADICTION);
    expect(conflicts[0].confidence).toBeGreaterThanOrEqual(90);
    expect(conflicts[0].fieldA).toContain('description');
    expect(conflicts[0].fieldB).toContain('fees');
    expect(conflicts[0].explanation).toContain('free of cost');
  });

  it('detects document contradiction when narrative claims no paperwork but documents are listed', () => {
    const docContradictionService = {
      id: 'conflicted-water',
      name: 'Emergency Water Tanker Supply',
      category: 'Municipal',
      description: 'Zero documentation required for drinking water tanker dispatch.',
      fees: 'Free',
      documents: ['Property Tax Receipt', 'Water Connection Bill', 'Resident ID Proof'],
    };

    const conflicts = scanServiceForContradictions(docContradictionService);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe(CONFLICT_TYPES.DOCUMENT_CONTRADICTION);
    expect(conflicts[0].valueA).toContain('zero paperwork');
    expect(conflicts[0].valueB).toContain('3 document(s)');
  });

  it('detects eligibility contradiction between universal claim and restrictive income caps', () => {
    const eligibilityContradictionService = {
      id: 'conflicted-ration',
      name: 'State Food Security Benefit',
      category: 'Food Security',
      description: 'Universal entitlement open to all citizens across the state.',
      fees: 'Nil',
      eligibility: ['Household annual income below poverty line (BPL) only'],
    };

    const conflicts = scanServiceForContradictions(eligibilityContradictionService);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe(CONFLICT_TYPES.ELIGIBILITY_CONTRADICTION);
    expect(conflicts[0].explanation).toContain('universal citizen coverage');
  });

  it('detects cross-jurisdiction fee disparity across peer schemes', () => {
    const catalog = [
      {
        id: 'ration-state-a',
        name: 'Ration Card Scheme',
        category: 'Food Security',
        state: 'State A',
        fees: 'Rs. 10',
        feeAmount: 10,
      },
      {
        id: 'ration-state-b',
        name: 'Ration Card Registration',
        category: 'Food Security',
        state: 'State B',
        fees: 'Rs. 100',
        feeAmount: 100, // 10x disparity
      },
    ];

    const conflicts = scanServiceForContradictions(catalog[0], catalog);
    const crossDisparity = conflicts.find((c) => c.type === CONFLICT_TYPES.CROSS_JURISDICTION_DISPARITY);
    expect(crossDisparity).toBeDefined();
    expect(crossDisparity.explanation).toContain('5x');
  });

  it('allows administrator to dismiss and restore findings without mutating catalogue', () => {
    const testId = 'test_finding_123';
    expect(getDismissedConflictIds()).toEqual([]);

    dismissConflict(testId);
    expect(getDismissedConflictIds()).toContain(testId);

    restoreConflict(testId);
    expect(getDismissedConflictIds()).not.toContain(testId);
  });

  it('scans full catalogue and aggregates counts by category', () => {
    const catalog = [
      cleanService,
      {
        id: 'bad-1',
        name: 'Bad Service 1',
        description: 'Free of cost service',
        fees: 'Rs. 500',
        feeAmount: 500,
      },
      {
        id: 'bad-2',
        name: 'Bad Service 2',
        description: 'No documents required',
        documents: ['Passport copy'],
      },
    ];

    const report = scanCatalogueForContradictions(catalog);
    expect(report.totalScanned).toBe(3);
    expect(report.totalFindingsCount).toBe(2);
    expect(report.countsByType[CONFLICT_TYPES.FEE_CONTRADICTION]).toBe(1);
    expect(report.countsByType[CONFLICT_TYPES.DOCUMENT_CONTRADICTION]).toBe(1);
  });
});
