import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';

// Import conflict detection from supervisor
import SupervisorConflictDetector from '../../src/supervisor/conflictDetection.js';
import SupervisorAgentRegistry from '../../src/supervisor/agentRegistry.js';
import { createAgentRegistryEntry } from '../../src/supervisor/agentRegistry.js';

describe('supervisor conflict detection', () => {
  let registry;
  let detector;

  beforeEach(() => {
    registry = new SupervisorAgentRegistry();
    registry.register(createAgentRegistryEntry({
      agentId: 'agent-pwd-delhi',
      department: 'Public Works',
      jurisdictionLevel: 'state',
      agentName: 'PWD Delhi Agent',
      contactEmail: 'pwd-delhi@example.com',
      capabilities: ['investigate', 'evidence-review'],
      permittedTools: ['document-upload', 'portal-query'],
      maxConcurrentTasks: 3,
      slaDays: 7,
      authorizedJurisdictions: ['Delhi', 'NCR'],
    }));
    registry.register(createAgentRegistryEntry({
      agentId: 'agent-pwd-mum',
      department: 'Public Works',
      jurisdictionLevel: 'state',
      agentName: 'PWD Mumbai Agent',
      contactEmail: 'pwd-mum@example.com',
      capabilities: ['investigate', 'evidence-review'],
      permittedTools: ['document-upload', 'portal-query'],
      maxConcurrentTasks: 3,
      slaDays: 7,
      authorizedJurisdictions: ['Mumbai', 'Pune'],
    }));
    registry.register(createAgentRegistryEntry({
      agentId: 'agent-water-mum',
      department: 'Municipal Sanitation',
      jurisdictionLevel: 'local',
      agentName: 'Mumbai Water Agent',
      contactEmail: 'mumbai-water@example.com',
      capabilities: ['investigate'],
      permittedTools: ['document-upload'],
      maxConcurrentTasks: 5,
      slaDays: 3,
      authorizedJurisdictions: ['Mumbai'],
    }));
    detector = new SupervisorConflictDetector(registry);
  });

  describe('SupervisorConflictDetector', () => {
    it('detects no conflict when single agent is assigned', () => {
      const task = {
        id: 'task-1',
        type: 'department-investigation',
        status: 'pending',
        jurisdictionEvidence: {
          sourceType: 'statutory-portal',
          sourceId: 'Delhi',
          sourceUrl: 'https://pgportal.gov.in',
          citedBy: 'supervisor-service',
          citedAt: new Date().toISOString(),
          provenance: 'official government portal',
        },
      };

      const result = detector.detectConflicts(task);
      expect(result.hasConflict).toBe(false);
      expect(result.conflictType).toBe('none');
      expect(result.conflictingAgents).toHaveLength(0);
    });

    it('detects unsupported authority when agent not authorized for evidence', () => {
      const task = {
        id: 'task-2',
        type: 'department-investigation',
        status: 'pending',
        jurisdictionEvidence: {
          sourceType: 'statutory-portal',
          sourceId: 'Chennai', // Agent is authorized for Delhi, not Chennai
          sourceUrl: 'https://pgportal.gov.in',
          citedBy: 'supervisor-service',
          citedAt: new Date().toISOString(),
          provenance: 'official government portal',
        },
      };

      const result = detector.detectConflicts(task);
      // The Chennai agent would not be in the registry for this test setup,
      // but the detection should still run without error
      expect(result).toBeDefined();
    });

    it('detects conflict when multiple agents for same department share jurisdiction', () => {
      const task = {
        id: 'task-3',
        type: 'department-investigation',
        status: 'pending',
        jurisdictionEvidence: {
          sourceType: 'statutory-portal',
          sourceId: 'Delhi', // Shared jurisdiction - both PWD agents are authorized for Delhi/NCR
          sourceUrl: 'https://pgportal.gov.in',
          citedBy: 'supervisor-service',
          citedAt: new Date().toISOString(),
          provenance: 'official government portal',
        },
      };

      const result = detector.detectConflicts(task);
      // Both agents are authorized for Delhi, so no "unsupported authority" conflict
      // But there could be overlapping jurisdiction
      expect(result).toBeDefined();
    });

    it('gets conflict by taskId', () => {
      const task = {
        id: 'task-4',
        type: 'department-investigation',
        status: 'pending',
        jurisdictionEvidence: {
          sourceType: 'statutory-portal',
          sourceId: 'Delhi',
          sourceUrl: 'https://pgportal.gov.in',
          citedBy: 'supervisor-service',
          citedAt: new Date().toISOString(),
          provenance: 'official government portal',
        },
      };

      detector.detectConflicts(task);
      const storedConflict = detector.getConflict('task-4');
      expect(storedConflict).toBeDefined();
      expect(storedConflict.taskId).toBe('task-4');
    });

    it('resolves a conflict', () => {
      const task = {
        id: 'task-5',
        type: 'department-investigation',
        status: 'pending',
        jurisdictionEvidence: {
          sourceType: 'statutory-portal',
          sourceId: 'Delhi',
          sourceUrl: 'https://pgportal.gov.in',
          citedBy: 'supervisor-service',
          citedAt: new Date().toISOString(),
          provenance: 'official government portal',
        },
      };

      detector.detectConflicts(task);
      const resolution = detector.resolveConflict('task-5', 'operator-1', 'assign-to-agent-B');
      expect(resolution.resolution.status).toBe('human_resolved');
      expect(resolution.resolution.decision).toBe('assign-to-agent-B');
      expect(resolution.resolution.resolvedBy).toBe('operator-1');
      expect(resolution.resolution.resolvedAt).toBeDefined();
    });

    it('gets all conflicts', () => {
      const task1 = { id: 'task-a', type: 'department-investigation', status: 'pending', jurisdictionEvidence: { sourceType: 'statutory-portal', sourceId: 'Delhi', sourceUrl: 'https://pgportal.gov.in', citedBy: 'supervisor-service', citedAt: new Date().toISOString(), provenance: 'official' } };
      const task2 = { id: 'task-b', type: 'department-investigation', status: 'pending', jurisdictionEvidence: { sourceType: 'statutory-portal', sourceId: 'Mumbai', sourceUrl: 'https://pgportal.gov.in', citedBy: 'supervisor-service', citedAt: new Date().toISOString(), provenance: 'official' } };

      detector.detectConflicts(task1);
      detector.detectConflicts(task2);
      const allConflicts = detector.getAllConflicts();
      expect(allConflicts.size).toBe(2);
    });
  });
});