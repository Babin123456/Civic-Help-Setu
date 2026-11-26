import { describe, it, expect } from 'vitest';
import {
  sanitizeSimulationInput,
  validateRuleGraph,
  CONDITION_TYPES,
  CONDITION_STATES,
} from './simulationContracts.js';

describe('simulationContracts', () => {
  it('exports valid condition types and states', () => {
    expect(CONDITION_TYPES).toContain('THRESHOLD');
    expect(CONDITION_TYPES).toContain('DOCUMENT_PREREQUISITE');
    expect(CONDITION_STATES).toContain('satisfied');
    expect(CONDITION_STATES).toContain('conflicting');
  });

  describe('sanitizeSimulationInput', () => {
    it('sanitizes valid input and converts types properly', () => {
      const raw = {
        age: '35',
        annualIncome: '250000',
        employment: 'farmer',
        ownsAgriculturalLand: true,
        hasAadhaar: 1,
      };
      const clean = sanitizeSimulationInput(raw);
      expect(clean.age).toBe(35);
      expect(clean.annualIncome).toBe(250000);
      expect(clean.employment).toBe('farmer');
      expect(clean.ownsAgriculturalLand).toBe(true);
      expect(clean.hasAadhaar).toBe(true);
    });

    it('clamps numeric bounds per field specs', () => {
      const raw = {
        age: 150, // max is 120
        annualIncome: -500, // min is 0
      };
      const clean = sanitizeSimulationInput(raw);
      expect(clean.age).toBe(120);
      expect(clean.annualIncome).toBe(0);
    });

    it('rejects input containing forbidden PII fields', () => {
      expect(() => {
        sanitizeSimulationInput({
          annualIncome: 100000,
          aadhaarNumber: '1234-5678-9012',
        });
      }).toThrow(/forbidden identity fields/i);

      expect(() => {
        sanitizeSimulationInput({
          phone: '9876543210',
          employment: 'salaried',
        });
      }).toThrow(/forbidden identity fields/i);
    });

    it('handles empty strings and null values as null/unknown', () => {
      const clean = sanitizeSimulationInput({
        annualIncome: '',
        age: null,
      });
      expect(clean.annualIncome).toBeNull();
      expect(clean.age).toBeNull();
    });
  });

  describe('validateRuleGraph', () => {
    it('validates a compliant rule graph', () => {
      const validGraph = {
        id: 'test-graph',
        version: '1.0.0',
        nodes: [
          {
            id: 'n1',
            label: 'Test Node 1',
            type: 'THRESHOLD',
            evaluate: () => ({ state: 'satisfied' }),
            citation: { authority: 'Govt Dept', orderNo: '123/2020' },
          },
        ],
      };
      const result = validateRuleGraph(validGraph);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('catches missing citations or invalid node types', () => {
      const invalidGraph = {
        id: 'bad-graph',
        version: '1.0.0',
        nodes: [
          {
            id: 'n1',
            label: 'Bad Node',
            type: 'INVALID_TYPE',
            evaluate: () => ({ state: 'satisfied' }),
          },
        ],
      };
      const result = validateRuleGraph(invalidGraph);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid type'))).toBe(true);
      expect(result.errors.some((e) => e.includes('statutory citation'))).toBe(true);
    });

    it('detects cyclic dependencies in rule graphs', () => {
      const cyclicGraph = {
        id: 'cyclic-graph',
        version: '1.0.0',
        nodes: [
          {
            id: 'nodeA',
            label: 'Node A',
            type: 'BOOLEAN',
            dependsOn: ['nodeB'],
            evaluate: () => ({ state: 'satisfied' }),
            citation: { authority: 'Dept A', orderNo: 'A1' },
          },
          {
            id: 'nodeB',
            label: 'Node B',
            type: 'BOOLEAN',
            dependsOn: ['nodeA'],
            evaluate: () => ({ state: 'satisfied' }),
            citation: { authority: 'Dept B', orderNo: 'B1' },
          },
        ],
      };
      const result = validateRuleGraph(cyclicGraph);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Cyclic dependency'))).toBe(true);
    });
  });
});
