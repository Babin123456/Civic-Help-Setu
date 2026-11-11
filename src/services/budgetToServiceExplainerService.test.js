import { describe, it, expect } from 'vitest';
import {
  CIVIC_SERVICE_CATEGORY,
  MONETARY_UNIT,
  compareBudgetYears,
  formatMonetaryWithUnit,
  generateServiceBudgetSummary,
  ingestBudgetLineItem,
  toBaseInr,
} from './budgetToServiceExplainerService.js';

describe('budgetToServiceExplainerService', () => {
  const sampleRoadsRecord = {
    financialYear: '2025-2026',
    department: 'Greater Chennai Corporation - Bus Route Roads',
    schemeName: 'Special Roads Programme',
    budgetHead: 'Major Head 4216',
    serviceCategory: CIVIC_SERVICE_CATEGORY.ROADS_AND_BRIDGES,
    budgetAllocation: 120.5,
    revisedEstimate: 115.0,
    actualExpenditure: 98.2,
    physicalCompletionPercent: 78,
    unit: MONETARY_UNIT.CRORES,
    provenance: {
      docTitle: 'GCC Annual Budget Estimates 2025-26',
      pageNumber: 42,
      tableId: 'Statement IV-C',
      sourceUrl: 'https://chennaicorporation.gov.in/budget2025',
    },
  };

  it('ingests a valid budget record and preserves provenance linkage', () => {
    const item = ingestBudgetLineItem(sampleRoadsRecord);

    expect(item.id).toBeDefined();
    expect(item.financialYear).toBe('2025-2026');
    expect(item.budgetAllocation).toBe(120.5);
    expect(item.actualExpenditure).toBe(98.2);
    expect(item.physicalCompletionPercent).toBe(78);
    expect(item.provenance.docTitle).toBe('GCC Annual Budget Estimates 2025-26');
    expect(item.provenance.pageNumber).toBe(42);
  });

  it('strictly requires official document provenance for every ingested figure', () => {
    expect(() =>
      ingestBudgetLineItem({
        financialYear: '2025-2026',
        department: 'Public Works',
        budgetAllocation: 50,
        provenance: null, // Missing provenance
      })
    ).toThrow(/Provenance Violation/);

    expect(() =>
      ingestBudgetLineItem({
        financialYear: '2025-2026',
        department: 'Public Works',
        budgetAllocation: 50,
        provenance: { docTitle: 'Draft Memo' }, // Missing pageNumber
      })
    ).toThrow(/Provenance Violation/);
  });

  it('preserves distinct separation between expenditure and physical completion', () => {
    const fullySpentIncompleteRoad = ingestBudgetLineItem({
      ...sampleRoadsRecord,
      budgetAllocation: 100,
      actualExpenditure: 100, // 100% funds disbursed
      physicalCompletionPercent: 45, // Only 45% of road physically laid
    });

    expect(fullySpentIncompleteRoad.actualExpenditure).toBe(100);
    expect(fullySpentIncompleteRoad.physicalCompletionPercent).toBe(45);
    expect(fullySpentIncompleteRoad.actualExpenditure).not.toBe(
      fullySpentIncompleteRoad.physicalCompletionPercent
    );
  });

  it('safely compares across financial years without silently mixing monetary units', () => {
    const year1 = ingestBudgetLineItem({
      ...sampleRoadsRecord,
      financialYear: '2024-2025',
      budgetAllocation: 5000, // 5,000 Lakhs = 50 Crores
      actualExpenditure: 4500,
      unit: MONETARY_UNIT.LAKHS,
    });

    const year2 = ingestBudgetLineItem({
      ...sampleRoadsRecord,
      financialYear: '2025-2026',
      budgetAllocation: 60, // 60 Crores
      actualExpenditure: 55,
      unit: MONETARY_UNIT.CRORES,
    });

    const comparison = compareBudgetYears(year1, year2);
    expect(comparison.isComparable).toBe(true);

    // 50 Crores -> 60 Crores is exactly +20.0% increase
    expect(comparison.allocationDeltaPercent).toBe(20.0);
    expect(comparison.provenanceCitations.length).toBe(2);
  });

  it('marks comparisons as non-comparable when data is missing or categories mismatch', () => {
    const roadItem = ingestBudgetLineItem(sampleRoadsRecord);
    const drainageItem = ingestBudgetLineItem({
      ...sampleRoadsRecord,
      serviceCategory: CIVIC_SERVICE_CATEGORY.WATER_SUPPLY_AND_DRAINAGE,
    });

    const mismatch = compareBudgetYears(roadItem, drainageItem);
    expect(mismatch.isComparable).toBe(false);
    expect(mismatch.comparabilityWarning).toContain('Cannot compare different service categories');

    const missingYear = compareBudgetYears(roadItem, null);
    expect(missingYear.isComparable).toBe(false);
  });

  it('generates a plain-language civic summary citing official source pages', () => {
    const item = ingestBudgetLineItem(sampleRoadsRecord);
    const summary = generateServiceBudgetSummary(item);

    expect(summary).toContain('Greater Chennai Corporation');
    expect(summary).toContain('₹120.5 CRORES');
    expect(summary).toContain('₹98.2 CRORES');
    expect(summary).toContain('78% of work completed');
    expect(summary).toContain('GCC Annual Budget Estimates 2025-26');
    expect(summary).toContain('Page 42');
    expect(summary).toContain('Statement IV-C');
    expect(summary).toContain('Financial expenditure does not automatically equate to finished ground infrastructure');
  });
});
