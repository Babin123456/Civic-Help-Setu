import { describe, it, expect } from 'vitest';
import {
  validateServiceWorkflow,
  createPrivateProgressSnapshot,
  getLinearStepSequence,
  exportProcessMapDossier,
  detectCircularDependencies,
  SWIMLANE_TYPES,
  STAGE_NODE_TYPES,
  SAMPLE_WATER_CONNECTION_WORKFLOW
} from './civicJourneyMapService';

describe('civicJourneyMapService', () => {
  it('should define swimlane types and stage nodes', () => {
    expect(SWIMLANE_TYPES.CITIZEN_ACTION.color).toBe('blue');
    expect(SWIMLANE_TYPES.LOCAL_AUTHORITY.code).toBe('LOCAL_AUTHORITY');
    expect(STAGE_NODE_TYPES.TERMINAL_OUTCOME).toBe('TERMINAL_OUTCOME');
  });

  it('should validate canonical sample workflow without errors', () => {
    const res = validateServiceWorkflow(SAMPLE_WATER_CONNECTION_WORKFLOW);
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.stageCount).toBe(5);
    expect(res.hasTerminalOutcome).toBe(true);
  });

  it('should detect invalid transitions and broken targets', () => {
    const brokenWorkflow = {
      workflowId: 'wf_broken',
      serviceId: 'srv_broken',
      stages: [
        {
          id: 'step_1',
          swimlane: 'CITIZEN_ACTION',
          nodeType: 'ACTION',
          transitions: ['nonexistent_step'] // broken target
        }
      ]
    };

    const res = validateServiceWorkflow(brokenWorkflow);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes('nonexistent transition target'))).toBe(true);
  });

  it('should create private progress snapshot without touching official application', () => {
    const snapshot = createPrivateProgressSnapshot('wf_water_conn_v1', ['step_1', 'step_2']);
    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.completedStages).toEqual(['step_1', 'step_2']);
    expect(snapshot.isOfficialApplicationRecord).toBe(false);
    expect(snapshot.disclaimer).toContain('does not constitute a formal government application');
  });

  it('should generate accessible linear step sequence', () => {
    const linear = getLinearStepSequence(SAMPLE_WATER_CONNECTION_WORKFLOW);
    expect(linear).toHaveLength(5);
    expect(linear[0].swimlaneLabel).toBe('Citizen Actions & Inputs');
    expect(linear[2].nodeType).toBe('DECISION_DIAMOND');
    expect(linear[0].officialSource).toContain('Urban Water Supply Regulations');
  });

  it('should detect circular dependencies in workflows', () => {
    const cyclicWorkflow = {
      stages: [
        { id: 's1', transitions: ['s2'] },
        { id: 's2', transitions: ['s3'] },
        { id: 's3', transitions: ['s1'] } // cycle
      ]
    };

    expect(detectCircularDependencies(cyclicWorkflow)).toBe(true);
    expect(detectCircularDependencies(SAMPLE_WATER_CONNECTION_WORKFLOW)).toBe(false);
  });

  it('should export formatted markdown process map dossier', () => {
    const doc = exportProcessMapDossier(SAMPLE_WATER_CONNECTION_WORKFLOW);
    expect(doc).toContain('# Civic Service Process Map: Municipal Domestic Water Connection Workflow');
    expect(doc).toContain('Urban Water Supply Regulations 2021');
    expect(doc).toContain('Authority Swimlanes');
    expect(doc).toContain('Step 1: Submit Online Application Form');
  });
});
