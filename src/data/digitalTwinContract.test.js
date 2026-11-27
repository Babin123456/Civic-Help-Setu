import { describe, it, expect } from 'vitest';
import {
  DIGITAL_TWIN_SCHEMA_VERSION,
  EDGE_TYPES,
  FORBIDDEN_SIMULATION_FIELDS,
  checkForbiddenFields,
  validateWorkflowGraph,
  validateSyntheticPersona,
  sanitizeSimulationPayload,
} from './digitalTwinContract';
import { SYNTHETIC_PERSONAS } from './digitalTwinPersonas';
import {
  WORKFLOW_INCOME_CERT_V1,
  WORKFLOW_INCOME_CERT_V2_PROPOSED,
  WORKFLOW_STREET_VENDOR_V1,
} from './digitalTwinSeed';

describe('digitalTwinContract domain model & privacy boundaries (#1157)', () => {
  it('exposes semver schema version 1.0.0', () => {
    expect(DIGITAL_TWIN_SCHEMA_VERSION).toBe('1.0.0');
  });

  describe('PII & credential boundary enforcement', () => {
    it('detects forbidden citizen credential and PII fields', () => {
      const dirtyPersona = {
        name: 'Test Citizen',
        aadhaarNumber: '1234-5678-9012',
        secret: 'my-pass',
      };
      const errors = checkForbiddenFields(dirtyPersona, 'test record');
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors[0]).toContain('aadhaarNumber');
      expect(errors[1]).toContain('secret');
    });

    it('passes clean synthetic objects with zero forbidden fields', () => {
      const cleanPersona = {
        name: 'Synthetic Test',
        id: 'synth-101',
        attributes: { age: 25 },
      };
      const errors = checkForbiddenFields(cleanPersona, 'test record');
      expect(errors).toEqual([]);
    });

    it('sanitizes input payload by stripping all forbidden fields recursively', () => {
      const rawPayload = {
        id: 'req-001',
        title: 'Simulation Run',
        aadhaar: '9999-9999-9999',
        nested: {
          token: 'auth-jwt-token',
          safeParam: 'allowed-value',
        },
      };
      const sanitized = sanitizeSimulationPayload(rawPayload);
      expect(sanitized.id).toBe('req-001');
      expect(sanitized.aadhaar).toBeUndefined();
      expect(sanitized.nested.token).toBeUndefined();
      expect(sanitized.nested.safeParam).toBe('allowed-value');
    });
  });

  describe('validateWorkflowGraph', () => {
    it('passes on canonical baseline Income Certificate workflow', () => {
      const result = validateWorkflowGraph(WORKFLOW_INCOME_CERT_V1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('passes on proposed accelerated workflow', () => {
      const result = validateWorkflowGraph(WORKFLOW_INCOME_CERT_V2_PROPOSED);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('passes on Street Vendor workflow', () => {
      const result = validateWorkflowGraph(WORKFLOW_STREET_VENDOR_V1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects workflow missing initialStepId or with bad initialStepId', () => {
      const invalid = { ...WORKFLOW_INCOME_CERT_V1, initialStepId: 'non-existent-node' };
      const result = validateWorkflowGraph(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('initialStepId'))).toBe(true);
    });

    it('rejects workflow with duplicate node IDs', () => {
      const invalid = {
        ...WORKFLOW_INCOME_CERT_V1,
        nodes: [...WORKFLOW_INCOME_CERT_V1.nodes, { ...WORKFLOW_INCOME_CERT_V1.nodes[0] }],
      };
      const result = validateWorkflowGraph(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate node ID'))).toBe(true);
    });

    it('rejects workflow edges referencing non-existent nodes', () => {
      const invalid = {
        ...WORKFLOW_INCOME_CERT_V1,
        edges: [
          ...WORKFLOW_INCOME_CERT_V1.edges,
          { id: 'edge-broken', source: 'step-online-intake', target: 'ghost-node', type: EDGE_TYPES.SEQUENTIAL_STEP },
        ],
      };
      const result = validateWorkflowGraph(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('ghost-node'))).toBe(true);
    });

    it('rejects self-loop edges', () => {
      const invalid = {
        ...WORKFLOW_INCOME_CERT_V1,
        edges: [
          ...WORKFLOW_INCOME_CERT_V1.edges,
          { id: 'edge-self', source: 'step-online-intake', target: 'step-online-intake', type: EDGE_TYPES.SEQUENTIAL_STEP },
        ],
      };
      const result = validateWorkflowGraph(invalid);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('cannot connect a node to itself'))).toBe(true);
    });
  });

  describe('Synthetic Persona verification', () => {
    it('verifies that all seed personas pass synthetic validation and zero PII rules', () => {
      expect(SYNTHETIC_PERSONAS.length).toBeGreaterThanOrEqual(4);
      for (const persona of SYNTHETIC_PERSONAS) {
        const result = validateSyntheticPersona(persona);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(persona.isSynthetic).toBe(true);

        // Explicit check against forbidden field list
        for (const field of FORBIDDEN_SIMULATION_FIELDS) {
          expect(persona[field]).toBeUndefined();
        }
      }
    });

    it('fails validation when isSynthetic flag is false or omitted', () => {
      const badPersona = { ...SYNTHETIC_PERSONAS[0], isSynthetic: false };
      const result = validateSyntheticPersona(badPersona);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('isSynthetic: true'))).toBe(true);
    });
  });
});
