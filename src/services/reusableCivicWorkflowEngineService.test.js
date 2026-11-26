import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReusableCivicWorkflowEngineService,
  WorkflowEngineError
} from './reusableCivicWorkflowEngineService.js';

describe('ReusableCivicWorkflowEngineService', () => {
  let service;

  beforeEach(() => {
    service = new ReusableCivicWorkflowEngineService();
  });

  it('starts a workflow instance pinning the definition version', () => {
    const instance = service.startWorkflowInstance('wf_inst_01', 'wf_road_cutting_permit', '1.0.0', {
      contractorName: 'Metro Rail Corp'
    });

    expect(instance.instanceId).toBe('wf_inst_01');
    expect(instance.pinnedVersion).toBe('1.0.0');
    expect(instance.currentState).toBe('SUBMITTED');
    expect(instance.assignedRole).toBe('ward_officer');
  });

  it('allows valid sequential role-based transitions', () => {
    service.startWorkflowInstance('wf_inst_02', 'wf_road_cutting_permit', '1.0.0');

    // Ward officer moves to Traffic Police NOC
    const step1 = service.transition(
      'wf_inst_02',
      'TRAFFIC_POLICE_NOC_PENDING',
      { id: 'officer_1', role: 'ward_officer' }
    );
    expect(step1.currentState).toBe('TRAFFIC_POLICE_NOC_PENDING');
    expect(step1.assignedRole).toBe('traffic_police_inspector');

    // Traffic inspector moves to Utility clearance
    const step2 = service.transition(
      'wf_inst_02',
      'UTILITY_CLEARANCE_PENDING',
      { id: 'police_ins_9', role: 'traffic_police_inspector' }
    );
    expect(step2.currentState).toBe('UTILITY_CLEARANCE_PENDING');
  });

  it('rejects illegal transitions with clear constraint error', () => {
    service.startWorkflowInstance('wf_inst_03', 'wf_road_cutting_permit', '1.0.0');

    expect(() => {
      // Skipping straight from SUBMITTED to PERMIT_SANCTIONED is illegal
      service.transition('wf_inst_03', 'PERMIT_SANCTIONED', { role: 'ward_officer' });
    }).toThrow(WorkflowEngineError);
  });

  it('detects and flags SLA breaches during periodic escalation scans', () => {
    const instance = service.startWorkflowInstance('wf_inst_04', 'wf_road_cutting_permit', '1.0.0');
    // Set simulated expired SLA deadline
    instance.slaDeadline = new Date(Date.now() - 3600 * 1000).toISOString();

    const escalated = service.evaluateSlaEscalations();
    expect(escalated.length).toBe(1);
    expect(escalated[0].isEscalated).toBe(true);
    expect(escalated[0].history.some(h => h.reason === 'SLA_BREACH_ESCALATED')).toBe(true);
  });
});
