import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';

// Import supervisor service
import SupervisorService from '../../src/supervisor/index.js';
import { SupervisorTaskStatus, TaskPriority } from '../../src/supervisor/domainModel.js';
import { createAgentRegistryEntry } from '../../src/supervisor/agentRegistry.js';

describe('supervisor service', () => {
  let service;
  let onEscalationCalls = [];
  let onDeadlineMissedCalls = [];

  beforeEach(() => {
    onEscalationCalls = [];
    onDeadlineMissedCalls = [];

    // Setup: Register some domain agents
    const pwdAgent = createAgentRegistryEntry({
      agentId: 'agent-pwd',
      department: 'Public Works',
      jurisdictionLevel: 'state',
      agentName: 'PWDAgent',
      contactEmail: 'pwd@example.com',
      capabilities: ['investigate', 'evidence-review'],
      permittedTools: ['document-upload', 'portal-query'],
      maxConcurrentTasks: 5,
      slaDays: 7,
      authorizedJurisdictions: ['Delhi', 'NCR'],
    });

    const waterAgent = createAgentRegistryEntry({
      agentId: 'agent-water',
      department: 'Water Board',
      jurisdictionLevel: 'local',
      agentName: 'WaterAgent',
      contactEmail: 'water@example.com',
      capabilities: ['investigate'],
      permittedTools: ['document-upload'],
      maxConcurrentTasks: 3,
      slaDays: 3,
      authorizedJurisdictions: ['Mumbai'],
    });

    service = new SupervisorService();
    service.registerAgent(pwdAgent);
    service.registerAgent(waterAgent);

    // Callback collectors
    const onEscalation = (taskId, level, timeRemaining) => {
      onEscalationCalls.push({ taskId, level, timeRemaining });
    };
    const onDeadlineMissed = (task) => {
      onDeadlineMissedCalls.push(task);
    };

    // We'll inject these via the service methods directly in tests
  });

  describe('SupervisorService - grievance decomposition', () => {
    it('decomposes a pothole grievance into tasks', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Huge deep pothole on MG Road near the metro pillar 42. Two two-wheelers skidded yesterday.',
        tenantId: 'tenant-1',
      });

      expect(result).toBeDefined();
      expect(result.decompositionTask).toBeDefined();
      expect(result.taskNodes).toBeDefined();
      expect(result.taskEdges).toBeDefined();
      expect(result.summary.totalTasks).toBeGreaterThan(0);
      expect(result.summary.departmentCount).toBeGreaterThan(0);
    });

    it('decomposes a water contamination grievance', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Tap water supply coming completely brown and muddy for the past 3 days.',
        tenantId: 'tenant-2',
      });

      expect(result).toBeDefined();
      expect(result.summary.totalTasks).toBeGreaterThan(0);
    });

    it('decomposes an electricity grievance', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Severe voltage fluctuation in our residential block. Transformer near street 4 is making loud humming and sparking sounds.',
        tenantId: 'tenant-3',
      });

      expect(result).toBeDefined();
      expect(result.summary.totalTasks).toBeGreaterThan(0);
    });

    it('handles ambiguous multi-department grievance', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Some random issue without specific keywords that cuts across multiple utilities.',
        tenantId: 'tenant-4',
      });

      expect(result).toBeDefined();
      expect(result.summary.totalTasks).toBeGreaterThan(0);
    });
  });

  describe('SupervisorService - task claim and authorization', () => {
    let task;

    beforeEach(async () => {
      // Create a decomposition result first
      const result = await service.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-1',
      });
      task = result.decompositionTask;
    });

    it('claims a task for an authorized agent', () => {
      // The decomposition task should be assigned to an agent from the registry
      const claimResult = service.claimTask(task.id, 'agent-pwd');
      expect(claimResult.status).toBe(SupervisorTaskStatus.PROCESSING);
      expect(claimResult.agentId).toBe('agent-pwd');
    });

    it('rejects claim for unauthorized agent', () => {
      // This should throw because the agent is not authorized for the task's jurisdiction
      // (the decomposition task's evidence may not match this agent's authorized jurisdictions)
      expect(() =>
        service.claimTask(task.id, 'agent-water')
      ).toThrow('Agent agent-water is not authorized for task');
    });

    it('completes a task', () => {
      // First claim the task
      service.claimTask(task.id, 'agent-pwd');
      // Then complete it
      const completeResult = service.completeTask(task.id);
      expect(completeResult.status).toBe(SupervisorTaskStatus.COMPLETED);
      expect(completeResult.humanApproved).toBe(true);
    });

    it('defers a task', () => {
      service.deferTask(task.id, 'waiting for evidence');
      const state = service.getTaskState(task.id);
      expect(state.status).toBe('deferred');
    });

    it('fails a task and moves to dead-letter', () => {
      const failResult = service.failTask(task.id, 'Evidence insufficient', 3);
      expect(failResult.movedToDeadLetter).toBe(true);
      expect(failResult.status).toBe(SupervisorTaskStatus.DEAD_LETTER);
    });

    it('fails a task and retries', () => {
      const failResult = service.failTask(task.id, 'Transient error', 1);
      expect(failResult.movedToDeadLetter).toBe(false);
      expect(failResult.retryCount).toBe(1);
      expect(failResult.status).toBe(SupervisorTaskStatus.FAILED);
    });
  });

  describe('SupervisorService - reassignment', () => {
    let task;

    beforeEach(async () => {
      const result = await service.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-1',
      });
      task = result.decompositionTask;
      service.claimTask(task.id, 'agent-pwd');
    });

    it('reassigns a task to another authorized agent', () => {
      const reassignmentResult = service.reassignTask(
        task.id,
        'agent-pwd',
        'agent-pwd', // Same agent for testing; in reality would be different
        'Role reassignment for specialized handling',
        'operator-1'
      );
      expect(reassignmentResult).toBeDefined();
      expect(reassignmentResult.toAgentId).toBe('agent-pwd');
    });

    it('validates reassignment source agent matches task assignment', () => {
      expect(() =>
        service.reassignTask(
          task.id,
          'unauthorized-agent', // Not the current agent
          'agent-pwd',
          'reason',
          'operator-1'
        )
      ).toThrow('Task is currently assigned to agent');
    });

    it('validates target agent is in registry', () => {
      expect(() =>
        service.reassignTask(
          task.id,
          'agent-pwd',
          'non-existent-agent',
          'reason',
          'operator-1'
        )
      ).toThrow('Target agent non-existent-agent not found in registry');
    });
  });

  describe('SupervisorService - conflict detection', () => {
    it('detects active conflicts', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-1',
      });
      const task = result.decompositionTask;
      service.claimTask(task.id, 'agent-pwd');

      const conflicts = service.getActiveConflicts();
      expect(conflicts).toBeDefined();
    });

    it('gets escalation level for a task', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-1',
      });
      const task = result.decompositionTask;

      const level = service.getEscalationLevel(task.id);
      expect(level).toBeDefined();
    });

    it('gets monitored tasks', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-1',
      });
      const task = result.decompositionTask;

      const monitored = service.getMonitoredTasks();
      expect(monitored).toBeDefined();
    });
  });

  describe('SupervisorService - task state', () => {
    it('gets task state', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-1',
      });
      const task = result.decompositionTask;

      const state = service.getTaskState(task.id);
      expect(state).toBeDefined();
      expect(state.id).toBe(task.id);
      expect(state.status).toBe(SupervisorTaskStatus.PENDING);
    });

    it('rejects getTaskState for non-existent task', () => {
      const state = service.getTaskState('non-existent-task-id');
      expect(state).toBeNull();
    });
  });

  describe('SupervisorService - edge cases', () => {
    it('rejects decomposition with empty grievance text', () => {
      expect(() =>
        service.decomposeGrievance({
          grievanceText: '',
          tenantId: 'tenant-1',
        })
      ).toThrow('grievanceText must be a non-empty string');
    });

    it('rejects decomposition with non-string grievance text', () => {
      expect(() =>
        service.decomposeGrievance({
          grievanceText: 123,
          tenantId: 'tenant-1',
        })
      ).toThrow('grievanceText must be a non-empty string');
    });

    it('rejects claimTask for non-existent task', () => {
      expect(() =>
        service.claimTask('non-existent', 'agent-pwd')
      ).toThrow('Task non-existent not found in supervisor registry');
    });

    it('rejects completeTask for non-ProCESSING task', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-1',
      });
      // Try to complete without claiming first - task is PENDING
      expect(() => service.completeTask(task.id)).toThrow(
        `Task is not in PROCESSING state`
      );
    });

    it('rejects failTask for non-existent task', () => {
      expect(() =>
        service.failTask('non-existent', 'reason')
      ).toThrow('Task non-existent not found in supervisor registry');
    });

    it('rejects reassignTask with missing fromAgent', () => {
      const result = service.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-1',
      });
      expect(() =>
        service.reassignTask(
          result.decompositionTask.id,
          'wrong-agent',
          'agent-pwd',
          'reason',
          'operator-1'
        )
      ).toThrow('Task is currently assigned to agent');
    });
  });
});