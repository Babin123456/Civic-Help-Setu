import { describe, it, expect, beforeEach } from 'vitest';
import { MunicipalBudgetEducationService } from './municipalBudgetEducationService.js';

describe('MunicipalBudgetEducationService', () => {
  let service;

  beforeEach(() => {
    service = new MunicipalBudgetEducationService();
  });

  it('provides plain-language glossary definitions', () => {
    const glossary = service.getGlossary();
    expect(glossary.length).toBeGreaterThan(3);

    const capex = glossary.find(g => g.term.includes('Capital Expenditure'));
    expect(capex).toBeDefined();
    expect(capex.plainExplanation).toContain('long-lasting public assets');
  });

  it('searches glossary terms accurately', () => {
    const results = service.searchGlossary('tender');
    expect(results.length).toBe(1);
    expect(results[0].term).toBe('Tender / Work Order');
  });

  it('returns the 5 sequential stages of the municipal budget lifecycle', () => {
    const stages = service.getBudgetLifecycle();
    expect(stages).toHaveLength(5);
    expect(stages[0].stage).toBe('PREPARATION_AND_CITIZEN_INPUT');
    expect(stages[4].stage).toBe('AUDIT_AND_SCRUTINY');
  });

  it('calculates ward budget spending summary and utilization rate', () => {
    const budget = service.getWardBudget(143, '2025-2026');
    expect(budget).toBeDefined();

    const summary = service.calculateSpendingSummary(budget);
    expect(summary.totalAllocatedLakhs).toBe(180);
    expect(summary.totalSpentLakhs).toBe(153);
    expect(summary.overallUtilizationRate).toBe(85);
    expect(summary.categories[0].category).toBe('Footpaths & Pedestrian Safety');
    expect(summary.categories[0].utilizationRate).toBe(80);
  });

  it('generates citizen engagement guidance for ward committees', () => {
    const guide = service.generateCitizenBudgetGuide('ward committee');
    expect(guide.title).toContain('Ward Budget');
    expect(guide.steps.length).toBeGreaterThan(2);
  });
});
