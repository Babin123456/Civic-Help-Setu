import { describe, it, expect } from 'vitest';
import {
  validateWorkflowGraphIntegrity,
  simulatePersonaJourney,
  simulateCohort,
  compareWorkflowVersions,
  generateAccessibleTabularReport,
  sanitizeDigitalTwinExport,
} from './civicWorkflowDigitalTwinService';
import {
  WORKFLOW_INCOME_CERT_V1,
  WORKFLOW_INCOME_CERT_V2_PROPOSED,
  WORKFLOW_INCOME_CERT_V2_DEFECTIVE,
  WORKFLOW_STREET_VENDOR_V1,
} from '../data/digitalTwinSeed';
import { SYNTHETIC_PERSONAS } from '../data/digitalTwinPersonas';
import {
  NODE_TYPES,
  EDGE_TYPES,
  SIMULATION_OUTCOMES,
  WORKFLOW_CHANGE_SEVERITY,
} from '../data/digitalTwinContract';

describe('Civic Workflow Digital Twin Simulation Service (#1157)', () => {
  const standardPersona = SYNTHETIC_PERSONAS.find((p) => p.id === 'synth-persona-standard');
  const migrantPersona = SYNTHETIC_PERSONAS.find((p) => p.id === 'synth-persona-migrant-tenant');
  const seniorPersona = SYNTHETIC_PERSONAS.find((p) => p.id === 'synth-persona-senior-citizen');
  const pwdPersona = SYNTHETIC_PERSONAS.find((p) => p.id === 'synth-persona-pwd-access');

  describe('validateWorkflowGraphIntegrity', () => {
    it('validates canonical baseline workflows without cycles or dead ends', () => {
      const integrity = validateWorkflowGraphIntegrity(WORKFLOW_INCOME_CERT_V1);
      expect(integrity.isValid).toBe(true);
      expect(integrity.hasCycles).toBe(false);
      expect(integrity.deadEndNodeIds).toEqual([]);
      expect(integrity.errors).toEqual([]);
    });

    it('detects circular loops in sequential step transitions', () => {
      const cyclicWorkflow = {
        ...WORKFLOW_INCOME_CERT_V1,
        id: 'wf-cyclic',
        edges: [
          ...WORKFLOW_INCOME_CERT_V1.edges,
          // Add back-edge from approval to online intake
          { id: 'cycle-edge', source: 'step-tahsildar-approval', target: 'step-online-intake', type: EDGE_TYPES.SEQUENTIAL_STEP },
        ],
      };

      const integrity = validateWorkflowGraphIntegrity(cyclicWorkflow);
      expect(integrity.isValid).toBe(false);
      expect(integrity.hasCycles).toBe(true);
      expect(integrity.errors.some((e) => e.includes('Circular workflow loop detected'))).toBe(true);
    });

    it('identifies dead ends in defective draft workflows', () => {
      const integrity = validateWorkflowGraphIntegrity(WORKFLOW_INCOME_CERT_V2_DEFECTIVE);
      // The defective workflow routes into an unresolved terminal dead end
      expect(integrity.deadEndNodeIds).toBeDefined();
    });

    it('warns about unreachable orphan steps not connected from initialStepId', () => {
      const orphanWorkflow = {
        ...WORKFLOW_INCOME_CERT_V1,
        nodes: [
          ...WORKFLOW_INCOME_CERT_V1.nodes,
          {
            id: 'orphan-step',
            label: 'Forgotten Sub-Committee Step',
            type: NODE_TYPES.SERVICE_STEP,
            estimatedDays: 5,
          },
        ],
      };

      const integrity = validateWorkflowGraphIntegrity(orphanWorkflow);
      expect(integrity.unreachableNodeIds).toContain('orphan-step');
      expect(integrity.warnings.some((w) => w.includes('Unreachable nodes detected'))).toBe(true);
    });
  });

  describe('simulatePersonaJourney', () => {
    it('simulates successful journey for standard persona on baseline Income Certificate', () => {
      const result = simulatePersonaJourney(WORKFLOW_INCOME_CERT_V1, standardPersona);
      expect(result.isSuccess).toBe(true);
      expect(result.outcome).toBe(SIMULATION_OUTCOMES.SUCCESS);
      expect(result.slaBreached).toBe(false);
      expect(result.totalDays).toBeLessThanOrEqual(WORKFLOW_INCOME_CERT_V1.statutorySlaDays);
      expect(result.trace.length).toBeGreaterThanOrEqual(4);
    });

    it('simulates journey for migrant tenant and processes rent agreement', () => {
      const result = simulatePersonaJourney(WORKFLOW_INCOME_CERT_V1, migrantPersona);
      expect(result.isSuccess).toBe(true);
      expect(result.personaId).toBe(migrantPersona.id);
    });

    it('simulates journey for senior citizen with degraded biometrics and logs friction time', () => {
      const biometricWf = {
        ...WORKFLOW_INCOME_CERT_V1,
        id: 'wf-biometric-test',
        nodes: WORKFLOW_INCOME_CERT_V1.nodes.map((n) =>
          n.id === 'step-online-intake' ? { ...n, requiresBiometricScan: true } : n
        ),
      };

      const result = simulatePersonaJourney(biometricWf, seniorPersona);
      expect(result.trace.some((s) => s.biometricFailure === true)).toBe(true);
      expect(result.totalDays).toBeGreaterThan(WORKFLOW_INCOME_CERT_V1.nodes[0].estimatedDays);
    });

    it('traps persona in dead end when simulated against defective workflow', () => {
      // Create a workflow with an explicit dead-end step that has no exit
      const deadEndWorkflow = {
        ...WORKFLOW_INCOME_CERT_V1,
        id: 'wf-dead-end-test',
        nodes: [
          ...WORKFLOW_INCOME_CERT_V1.nodes,
          {
            id: 'step-trap',
            label: 'Blackhole Desk (No Exit)',
            type: NODE_TYPES.SERVICE_STEP,
            estimatedDays: 2,
          },
        ],
        edges: [
          ...WORKFLOW_INCOME_CERT_V1.edges.filter((e) => e.target !== 'term-approved'),
          { id: 'e-trap', source: 'step-tahsildar-approval', target: 'step-trap', type: EDGE_TYPES.SEQUENTIAL_STEP },
        ],
      };

      const result = simulatePersonaJourney(deadEndWorkflow, standardPersona);
      expect(result.isSuccess).toBe(false);
      expect(result.outcome).toBe(SIMULATION_OUTCOMES.DEAD_END);
      expect(result.failureReason).toContain('Dead End');
    });

    it('halts and rejects when a persona lacks mandatory documents with no remedy path', () => {
      const emptyPersona = {
        id: 'synth-empty-docs',
        archetype: 'STANDARD_CITIZEN',
        name: 'Persona With Zero Documents',
        isSynthetic: true,
        attributes: {},
        availableDocuments: [],
      };

      const result = simulatePersonaJourney(WORKFLOW_STREET_VENDOR_V1, emptyPersona);
      expect(result.isSuccess).toBe(false);
      expect(result.outcome).toBe(SIMULATION_OUTCOMES.FAILED_REQUISITE);
      expect(result.failureReason).toContain('Missing mandatory documentation');
    });

    it('flags accessibility barrier when wheelchair user encounters inaccessible counter', () => {
      const inaccessibleWf = {
        ...WORKFLOW_STREET_VENDOR_V1,
        id: 'wf-inaccessible',
        nodes: WORKFLOW_STREET_VENDOR_V1.nodes.map((n) =>
          n.type === NODE_TYPES.OFFICE_DESK ? { ...n, isAccessibleDesk: false } : n
        ),
      };

      const result = simulatePersonaJourney(inaccessibleWf, pwdPersona);
      expect(result.accessibilityBlocked).toBe(true);
    });

    it('strictly forbids real citizen credentials and throws on privacy boundary violation', () => {
      const maliciousPersona = {
        id: 'malicious-001',
        name: 'Injected Real Record',
        isSynthetic: true,
        archetype: 'STANDARD_CITIZEN',
        availableDocuments: [],
        attributes: {},
        aadhaarNumber: '1111-2222-3333', // Forbidden PII
      };

      expect(() => simulatePersonaJourney(WORKFLOW_INCOME_CERT_V1, maliciousPersona)).toThrow(
        /Security Violation/
      );
    });
  });

  describe('simulateCohort', () => {
    it('runs batch simulation across all synthetic personas and computes aggregate statistics', () => {
      const report = simulateCohort(WORKFLOW_INCOME_CERT_V1, SYNTHETIC_PERSONAS);
      expect(report.totalPersonas).toBe(SYNTHETIC_PERSONAS.length);
      expect(report.successRate).toBeGreaterThan(0);
      expect(report.averageDurationDays).toBeGreaterThan(0);
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(report.individualResults.length).toBe(SYNTHETIC_PERSONAS.length);
    });
  });

  describe('compareWorkflowVersions', () => {
    it('rates accelerated proposal without dead ends as non-breaking', () => {
      const comparison = compareWorkflowVersions(
        WORKFLOW_INCOME_CERT_V1,
        WORKFLOW_INCOME_CERT_V2_PROPOSED,
        SYNTHETIC_PERSONAS
      );

      expect(comparison.isBreaking).toBe(false);
      expect(comparison.newDeadEnds).toEqual([]);
      expect(comparison.slaDurationDelta).toBeLessThanOrEqual(0); // Accelerated or equal
    });

    it('detects breaking changes when comparing against defective workflow', () => {
      const comparison = compareWorkflowVersions(
        WORKFLOW_INCOME_CERT_V1,
        WORKFLOW_INCOME_CERT_V2_DEFECTIVE,
        SYNTHETIC_PERSONAS
      );

      expect(comparison.severity.level).toBe(WORKFLOW_CHANGE_SEVERITY.BREAKING_DEAD_END.level);
      expect(comparison.isBreaking).toBe(true);
    });

    it('identifies excluded personas if a new version causes previously passing persona to fail', () => {
      // Modify proposed workflow to strictly require a document only standard persona has
      const exclusionaryWf = {
        ...WORKFLOW_INCOME_CERT_V1,
        id: 'wf-exclusionary',
        version: '1.9.0',
        nodes: [
          ...WORKFLOW_INCOME_CERT_V1.nodes,
          {
            id: 'doc-wealthy-only',
            label: 'Local Property Tax Deed (Excludes Renters)',
            type: NODE_TYPES.DOCUMENT_REQUIREMENT,
            acceptableKeys: ['DOC_ELECTRICITY_BILL_LOCAL'],
            isMandatory: true,
          },
        ],
        edges: [
          ...WORKFLOW_INCOME_CERT_V1.edges,
          { id: 'e-excl', source: 'step-online-intake', target: 'doc-wealthy-only', type: EDGE_TYPES.REQUIRES_DOCUMENT },
        ],
      };

      const comparison = compareWorkflowVersions(WORKFLOW_INCOME_CERT_V1, exclusionaryWf, SYNTHETIC_PERSONAS);
      // Migrant persona doesn't have electricity bill, only rent agreement
      expect(comparison.excludedPersonas.length).toBeGreaterThan(0);
      expect(comparison.excludedPersonas.some((p) => p.personaId === migrantPersona.id)).toBe(true);
    });
  });

  describe('generateAccessibleTabularReport', () => {
    it('converts journey simulation trace into accessible tabular format', () => {
      const result = simulatePersonaJourney(WORKFLOW_INCOME_CERT_V1, standardPersona);
      const rows = generateAccessibleTabularReport(result);

      expect(rows.length).toBe(result.trace.length);
      expect(rows[0]).toHaveProperty('stepNumber', 1);
      expect(rows[0]).toHaveProperty('label');
      expect(rows[0]).toHaveProperty('status');
      expect(rows[0]).toHaveProperty('cumulativeDays');
      expect(rows[0]).toHaveProperty('accessibilityIssue');
      expect(rows[0]).toHaveProperty('notes');
    });
  });

  describe('sanitizeDigitalTwinExport', () => {
    it('cleanses private session and auth tokens from export objects', () => {
      const dirty = {
        workflowId: 'wf-101',
        authToken: 'secret-token-xyz',
        userSessionId: 'sess-abc-123',
        results: [{ step: 1 }],
      };

      const sanitized = sanitizeDigitalTwinExport(dirty);
      expect(sanitized.workflowId).toBe('wf-101');
      expect(sanitized.authToken).toBeUndefined();
      expect(sanitized.userSessionId).toBeUndefined();
      expect(sanitized.results).toEqual([{ step: 1 }]);
    });
  });
});
