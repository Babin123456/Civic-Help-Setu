/**
 * Reproducible Evaluation & Benchmark Suite for Explainable Eligibility Simulation Engine
 * Issue #1156: Measurable evaluation criteria, synthetic fixtures, performance limits,
 * and negative/concurrency edge testing.
 *
 * Reproducible Command:
 *   npm test -- tests/eligibilitySimulationEvaluation.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  simulateEligibility,
  simulateAllRegisteredSchemes,
} from '../src/services/eligibilitySimulationService.js';
import { listRegisteredGraphs } from '../src/services/ruleGraphRegistry.js';

// Fictional Synthetic Test Personas (Strictly Zero Real Citizen Records or PII)
const SYNTHETIC_EVAL_FIXTURES = [
  {
    personaId: 'synthetic-marginal-farmer-01',
    description: 'Marginal farmer within income limits, needing Aadhaar e-KYC',
    input: {
      employment: 'farmer',
      ownsAgriculturalLand: true,
      annualIncome: 180000,
      hasAadhaar: false,
    },
    targetScheme: 'pm-kisan',
    expectedStatus: 'INELIGIBLE',
    expectedCounterfactualField: 'hasAadhaar',
  },
  {
    personaId: 'synthetic-urban-tenant-02',
    description: 'Low-income urban tenant with no pucca house seeking housing subsidy',
    input: {
      ownsPuccaHouse: false,
      annualIncome: 240000,
      hasBplCard: false,
      hasAadhaar: true,
    },
    targetScheme: 'pmay-u',
    expectedStatus: 'ELIGIBLE',
  },
  {
    personaId: 'synthetic-birth-boundary-03',
    description: 'Newborn reported on Day 19 (statutory boundary margin)',
    input: {
      birthRegistrationDays: 19,
      hasAadhaar: true,
      hasHospitalBirthSlip: true,
    },
    targetScheme: 'birth-certificate-delayed',
    expectedStatus: 'ELIGIBLE',
    expectBoundaryWarning: true,
  },
  {
    personaId: 'synthetic-evidentiary-conflict-04',
    description: 'Conflicting documents: High income declared while claiming BPL card',
    input: {
      ownsPuccaHouse: false,
      annualIncome: 500000,
      hasBplCard: true,
    },
    targetScheme: 'pmay-u',
    expectedStatus: 'INCONCLUSIVE',
    expectConflict: true,
  },
];

describe('Eligibility Simulation Engine Evaluation Suite', () => {
  it('passes synthetic persona accuracy evaluations', () => {
    for (const fixture of SYNTHETIC_EVAL_FIXTURES) {
      const res = simulateEligibility(fixture.targetScheme, fixture.input);
      expect(res.success).toBe(true);
      expect(res.status).toBe(fixture.expectedStatus);

      if (fixture.expectedCounterfactualField) {
        expect(res.counterfactuals.length).toBeGreaterThan(0);
        const hasExpectedField = res.counterfactuals.some((cf) =>
          cf.changes.some((c) => c.field === fixture.expectedCounterfactualField)
        );
        expect(hasExpectedField).toBe(true);
      }

      if (fixture.expectBoundaryWarning) {
        expect(res.boundaryWarnings.length).toBeGreaterThan(0);
      }

      if (fixture.expectConflict) {
        expect(res.conflicts.length).toBeGreaterThan(0);
      }
    }
  });

  it('measures benchmark performance: sub-25ms execution budget per simulation', () => {
    const testInput = {
      employment: 'farmer',
      ownsAgriculturalLand: false,
      annualIncome: 500000,
      hasAadhaar: false,
    };

    const iterations = 50;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      simulateEligibility('pm-kisan', testInput, { includeCounterfactuals: true });
    }

    const totalTime = performance.now() - startTime;
    const avgLatency = totalTime / iterations;

    // Report metric
    console.log(`[Benchmark] Average simulation + counterfactual latency: ${avgLatency.toFixed(3)} ms`);
    expect(avgLatency).toBeLessThan(25);
  });

  it('handles concurrent/rapid simulated parameter adjustments reliably', async () => {
    const baseInput = {
      employment: 'farmer',
      ownsAgriculturalLand: true,
      annualIncome: 200000,
      hasAadhaar: true,
    };

    // Simulate 20 rapid what-if adjustments across varied incomes and land values
    const promises = Array.from({ length: 20 }).map((_, idx) => {
      const simulatedInput = {
        ...baseInput,
        annualIncome: 100000 + idx * 25000,
        ownsAgriculturalLand: idx % 2 === 0,
      };
      return Promise.resolve(simulateEligibility('pm-kisan', simulatedInput));
    });

    const results = await Promise.all(promises);
    expect(results).toHaveLength(20);
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(['ELIGIBLE', 'CONDITIONAL', 'INELIGIBLE', 'INCONCLUSIVE']).toContain(r.status);
    }
  });

  it('enforces untrusted input validation and permission boundaries', () => {
    // Malicious or forbidden field injection
    const forbiddenPayload = {
      annualIncome: 250000,
      aadhaarNumber: '1111-2222-3333',
      rawDocumentUrl: 'https://malicious.org/dump',
    };

    const res = simulateEligibility('pm-kisan', forbiddenPayload);
    expect(res.success).toBe(false);
    expect(res.error).toContain('forbidden identity fields');
  });

  it('handles negative error cases safely and recovers upon subsequent retry', () => {
    // 1. Initial attempt fails due to untrusted/forbidden input
    const initialTainted = {
      annualIncome: 300000,
      aadhaarNumber: '1234-5678-9012',
    };
    const failedResult = simulateEligibility('pm-kisan', initialTainted);
    expect(failedResult.success).toBe(false);
    expect(failedResult.status).toBe('INCONCLUSIVE');
    expect(failedResult.error).toContain('forbidden identity fields');

    // 2. Retry attempt with sanitized, valid input succeeds cleanly without state corruption
    const retriedClean = {
      annualIncome: 300000,
      employment: 'farmer',
      ownsAgriculturalLand: true,
      hasAadhaar: true,
    };
    const retriedResult = simulateEligibility('pm-kisan', retriedClean);
    expect(retriedResult.success).toBe(true);
    expect(retriedResult.status).toBe('CONDITIONAL');
    expect(retriedResult.error).toBeUndefined();
    expect(retriedResult.criteria.length).toBeGreaterThan(0);
  });

  it('verifies that all registered rule graphs are evaluated without exceptions', () => {
    const graphs = listRegisteredGraphs();
    expect(graphs.length).toBeGreaterThanOrEqual(4);

    const allRes = simulateAllRegisteredSchemes({
      age: 30,
      annualIncome: 250000,
      employment: 'farmer',
      ownsAgriculturalLand: true,
      hasAadhaar: true,
    });

    expect(allRes).toHaveLength(graphs.length);
    for (const r of allRes) {
      expect(r.success).toBe(true);
      expect(r.criteria.length).toBeGreaterThan(0);
    }
  });
});
