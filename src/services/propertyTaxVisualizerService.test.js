import { describe, it, expect } from 'vitest';
import {
  calculatePropertyTaxAssessment,
  compareAssessmentPeriods,
  buildTaxCorrectionChecklist,
  exportTaxCorrectionDossier,
  getAssessmentDiscrepancyFlags,
  PROPERTY_USAGE_TYPES,
  MUNICIPAL_CESS_RATES,
  MUNICIPAL_OBJECTION_STATUTES
} from './propertyTaxVisualizerService';

describe('propertyTaxVisualizerService', () => {
  it('should define property usage types and cess rates', () => {
    expect(PROPERTY_USAGE_TYPES.RESIDENTIAL_SELF_OCCUPIED.factor).toBe(1.0);
    expect(PROPERTY_USAGE_TYPES.RESIDENTIAL_TENANTED.factor).toBe(2.0);
    expect(MUNICIPAL_CESS_RATES.SWM_CESS.rate).toBe(0.15);
  });

  it('should compute deterministic property tax assessment correctly', () => {
    const property = {
      assessmentYear: '2023-2024',
      builtUpAreaSqFt: 1200,
      baseUnitAreaRate: 3.0,
      usageType: 'RESIDENTIAL_SELF_OCCUPIED',
      buildingAgeYears: 10, // 10% depreciation
      eligibleForEarlyRebate: true
    };

    const res = calculatePropertyTaxAssessment(property);
    expect(res.annualValue).toBeGreaterThan(0);
    expect(res.basePropertyTax).toBeGreaterThan(0);
    expect(res.totalCess).toBeGreaterThan(0);
    expect(res.earlyPaymentRebate).toBeGreaterThan(0);
    expect(res.totalDemand).toBeCloseTo(res.basePropertyTax + res.totalCess - res.earlyPaymentRebate, 1);
  });

  it('should compare two assessment periods and detect area and usage changes', () => {
    const period2022 = {
      assessmentYear: '2022-2023',
      builtUpAreaSqFt: 1000,
      usageType: 'RESIDENTIAL_SELF_OCCUPIED'
    };

    const period2023 = {
      assessmentYear: '2023-2024',
      builtUpAreaSqFt: 1500, // area increased
      usageType: 'RESIDENTIAL_TENANTED' // usage changed to tenanted
    };

    const comp = compareAssessmentPeriods(period2022, period2023);
    expect(comp.isIncreased).toBe(true);
    expect(comp.deltaAmount).toBeGreaterThan(0);
    expect(comp.attributeChanges).toHaveLength(2);
    expect(comp.attributeChanges[0].field).toContain('Built-up Area');
    expect(comp.attributeChanges[1].field).toContain('Occupancy');
  });

  it('should build actionable tax correction checklist for disputed increases', () => {
    const comparison = {
      deltaAmount: 4500,
      attributeChanges: [
        { field: 'Built-up Area (Sq Ft)', from: 1000, to: 1500 },
        { field: 'Occupancy / Usage Category', from: 'RESIDENTIAL_SELF_OCCUPIED', to: 'RESIDENTIAL_TENANTED' }
      ]
    };

    const checklist = buildTaxCorrectionChecklist(comparison);
    expect(checklist.checklistId).toBeDefined();
    expect(checklist.checklistItems).toHaveLength(2);
    expect(checklist.checklistItems[0].action).toContain('Building Plan');
    expect(checklist.checklistItems[1].action).toContain('Self-Occupancy Affidavit');
  });

  it('should provide discrepancy flags and statutory acts', () => {
    const flags = getAssessmentDiscrepancyFlags();
    expect(flags.length).toBeGreaterThanOrEqual(3);
    expect(MUNICIPAL_OBJECTION_STATUTES.BANGALORE_BBMP).toContain('2020');
  });

  it('should export formatted markdown correction dossier', () => {
    const comp = {
      periodA: { year: '2022-2023', totalDemand: 4200 },
      periodB: { year: '2023-2024', totalDemand: 7800 },
      deltaAmount: 3600,
      percentChange: 85.7,
      attributeChanges: [{ field: 'Built-up Area (Sq Ft)', from: 1000, to: 1500, reason: 'Resurvey' }]
    };

    const chk = buildTaxCorrectionChecklist(comp);
    const doc = exportTaxCorrectionDossier(comp, chk);

    expect(doc).toContain('# Property-Tax Assessment Breakdown & Correction Dossier');
    expect(doc).toContain('2022-2023 vs 2023-2024');
    expect(doc).toContain('+₹3,600 (85.7%)');
    expect(doc).toContain('Building Plan');
  });
});
