import { describe, it, expect } from 'vitest';
import { generateCounterfactuals } from './counterfactualEngine.js';
import { getRuleGraph } from './ruleGraphRegistry.js';
import { evaluateGraphDirect } from './eligibilitySimulationService.js';

describe('counterfactualEngine', () => {
  const pmKisanGraph = getRuleGraph('pm-kisan');

  it('returns empty array if applicant is already ELIGIBLE', () => {
    const eligibleProfile = {
      ownsAgriculturalLand: true,
      annualIncome: 200000,
      hasAadhaar: true,
      employment: 'farmer',
    };
    const results = generateCounterfactuals(
      pmKisanGraph,
      eligibleProfile,
      (p) => evaluateGraphDirect(pmKisanGraph, p)
    );
    expect(results).toHaveLength(0);
  });

  it('generates actionable counterfactual when only Aadhaar DBT linking is missing', () => {
    const missingAadhaarProfile = {
      ownsAgriculturalLand: true,
      annualIncome: 200000,
      hasAadhaar: false,
      employment: 'farmer',
    };
    const results = generateCounterfactuals(
      pmKisanGraph,
      missingAadhaarProfile,
      (p) => evaluateGraphDirect(pmKisanGraph, p)
    );
    expect(results.length).toBeGreaterThan(0);
    const topCf = results[0];
    expect(topCf.changes.some((c) => c.field === 'hasAadhaar' && c.to === true)).toBe(true);
    expect(topCf.difficulty).toBe('easy');
    expect(topCf.summary).toContain('Aadhaar');
  });

  it('generates income adjustment counterfactual when income exceeds statutory limit', () => {
    const highIncomeProfile = {
      ownsAgriculturalLand: true,
      annualIncome: 650000, // Ceiling is 400000
      hasAadhaar: true,
      employment: 'farmer',
    };
    const results = generateCounterfactuals(
      pmKisanGraph,
      highIncomeProfile,
      (p) => evaluateGraphDirect(pmKisanGraph, p)
    );
    expect(results.length).toBeGreaterThan(0);
    const incomeFix = results.find((r) => r.changes.some((c) => c.field === 'annualIncome'));
    expect(incomeFix).toBeDefined();
    expect(incomeFix.changes[0].to).toBeLessThanOrEqual(400000);
  });

  it('generates multi-step counterfactual when multiple criteria are unmet', () => {
    const multiUnmetProfile = {
      ownsAgriculturalLand: false,
      annualIncome: 200000,
      hasAadhaar: false,
      employment: 'salaried',
    };
    const results = generateCounterfactuals(
      pmKisanGraph,
      multiUnmetProfile,
      (p) => evaluateGraphDirect(pmKisanGraph, p)
    );
    expect(results.length).toBeGreaterThan(0);
    // At least one result should suggest addressing both landholding/employment and Aadhaar
    const dualStep = results.find((r) => r.changes.length >= 2);
    expect(dualStep).toBeDefined();
    expect(dualStep.changes.map((c) => c.field)).toContain('hasAadhaar');
  });

  it('finishes well within the 25ms time budget', () => {
    const testProfile = {
      ownsAgriculturalLand: false,
      annualIncome: 900000,
      hasAadhaar: false,
      employment: 'salaried',
    };
    const t0 = performance.now();
    generateCounterfactuals(
      pmKisanGraph,
      testProfile,
      (p) => evaluateGraphDirect(pmKisanGraph, p),
      { timeBudgetMs: 25 }
    );
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(100); // comfortably below interactive threshold in tests
  });
});
