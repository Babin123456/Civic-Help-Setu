import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadStoredWorkflows,
  saveStoredWorkflow,
  loadStoredSimulations,
  saveStoredSimulation,
  loadStoredAuditLogs,
  saveStoredAuditLog,
  resetDigitalTwinStorage,
} from './digitalTwinStorage';
import { WORKFLOW_INCOME_CERT_V1 } from '../data/digitalTwinSeed';

describe('digitalTwinStorage persistence & audit trails (#1157)', () => {
  beforeEach(() => {
    resetDigitalTwinStorage();
  });

  it('loads default seed workflows when storage is clean', () => {
    const workflows = loadStoredWorkflows();
    expect(workflows.length).toBeGreaterThanOrEqual(3);
    expect(workflows.some((w) => w.id === 'wf-income-cert-v1')).toBe(true);
  });

  it('saves and updates a workflow successfully', () => {
    const modified = {
      ...WORKFLOW_INCOME_CERT_V1,
      id: 'wf-custom-test-101',
      title: 'Custom Workflow For Unit Test',
    };

    const saveResult = saveStoredWorkflow(modified);
    expect(saveResult.success).toBe(true);

    const workflows = loadStoredWorkflows();
    expect(workflows.some((w) => w.id === 'wf-custom-test-101')).toBe(true);
  });

  it('rejects invalid workflow during save and does not corrupt store', () => {
    const invalid = { id: 'bad-wf', nodes: [] };
    const saveResult = saveStoredWorkflow(invalid);
    expect(saveResult.success).toBe(false);
    expect(saveResult.errors.length).toBeGreaterThan(0);
  });

  it('saves and cleanses simulation records', () => {
    const rawSim = {
      workflowId: 'wf-income-cert-v1',
      totalPersonas: 5,
      successRate: 100,
      authToken: 'leak-token', // Should be stripped
    };

    const saved = saveStoredSimulation(rawSim);
    expect(saved.id).toBeDefined();
    expect(saved.savedAt).toBeDefined();
    expect(saved.authToken).toBeUndefined();

    const stored = loadStoredSimulations();
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(saved.id);
  });

  it('records human review audit log decisions', () => {
    const decision = {
      workflowId: 'wf-income-cert-v1',
      version: '1.1.0',
      decision: 'APPROVED_FOR_PUBLICATION',
      reviewerRole: 'CATALOGUE_MAINTAINER',
      rationale: 'Simulation twin verified 100% success rate across all synthetic cohorts.',
    };

    const recorded = saveStoredAuditLog(decision);
    expect(recorded.id).toBeDefined();
    expect(recorded.decision).toBe('APPROVED_FOR_PUBLICATION');

    const logs = loadStoredAuditLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].rationale).toContain('Simulation twin verified');
  });
});
