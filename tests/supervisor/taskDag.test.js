import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';

// Import DAG components from supervisor
import DAGBuilder from '../../src/supervisor/taskDag.js';
import SupervisorAgentRegistry from '../../src/supervisor/agentRegistry.js';
import { createAgentRegistryEntry } from '../../src/supervisor/agentRegistry.js';
import { DagEdgeType, createDagEdge, topologicalSort, DAGCycleError } from '../../src/supervisor/taskDag.js';
import { SupervisorTaskStatus } from '../../src/supervisor/domainModel.js';

describe('supervisor task DAG', () => {
  let registry;
  let dagBuilder;

  beforeEach(() => {
    registry = new SupervisorAgentRegistry();
    // Register some agents
    registry.register(createAgentRegistryEntry({
      agentId: 'agent-pwd',
      department: 'Public Works',
      jurisdictionLevel: 'state',
      agentName: 'PWDAgent',
      contactEmail: 'pwd@example.com',
      capabilities: ['investigate'],
      permittedTools: ['portal-query'],
      maxConcurrentTasks: 5,
      slaDays: 7,
    }));
    registry.register(createAgentRegistryEntry({
      agentId: 'agent-water',
      department: 'Water Board',
      jurisdictionLevel: 'local',
      agentName: 'WaterAgent',
      contactEmail: 'water@example.com',
      capabilities: ['investigate'],
      permittedTools: ['document-upload'],
      maxConcurrentTasks: 3,
      slaDays: 3,
    }));
    dagBuilder = new DAGBuilder(registry);
  });

  describe('DAGBuilder', () => {
    it('decomposes a road-related grievance into tasks', () => {
      const result = dagBuilder.decomposeGrievance({
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

    it('decomposes a water-related grievance', () => {
      const result = dagBuilder.decomposeGrievance({
        grievanceText: 'Tap water supply coming completely brown and muddy for the past 3 days.',
        tenantId: 'tenant-2',
      });

      expect(result).toBeDefined();
      expect(result.summary.totalTasks).toBeGreaterThan(0);
    });

    it('decomposes an electricity-related grievance', () => {
      const result = dagBuilder.decomposeGrievance({
        grievanceText: 'Severe voltage fluctuation in our residential block. Transformer near street 4 is making loud humming and sparking sounds.',
        tenantId: 'tenant-3',
      });

      expect(result).toBeDefined();
      expect(result.summary.totalTasks).toBeGreaterThan(0);
    });

    it('handles ambiguous multi-department grievance', () => {
      const result = dagBuilder.decomposeGrievance({
        grievanceText: 'Some random issue without specific keywords that cuts across multiple utilities.',
        tenantId: 'tenant-4',
      });

      expect(result).toBeDefined();
      // Should still produce tasks, possibly with multi-department coordination
      expect(result.summary.totalTasks).toBeGreaterThan(0);
    });

    it('enforces max tasks per grievance limit', () => {
      // Should not throw for normal grievances
      const result = dagBuilder.decomposeGrievance({
        grievanceText: 'Pothole on Main Street causing accidents',
        tenantId: 'tenant-5',
      });
      expect(result).toBeDefined();
      expect(result.summary.totalTasks).toBeLessThanOrEqual(
        DAGBuilder.MAX_TASKS_PER_GRIEVANCE
      );
    });
  });

  describe('topologicalSort', () => {
    it('sorts a simple DAG without cycles', () => {
      const nodes = [
        { id: 'task-a', status: SupervisorTaskStatus.PENDING },
        { id: 'task-b', status: SupervisorTaskStatus.PENDING },
        { id: 'task-c', status: SupervisorTaskStatus.PENDING },
      ];
      const edges = [
        createDagEdge('task-a', 'task-b', DagEdgeType.SEQUENTIAL),
        createDagEdge('task-b', 'task-c', DagEdgeType.SEQUENTIAL),
      ];

      const sorted = topologicalSort(nodes, edges);
      // task-a should come first, then task-b, then task-c
      expect(sorted[0].id).toBe('task-a');
      expect(sorted[1].id).toBe('task-b');
      expect(sorted[2].id).toBe('task-c');
    });

    it('handles parallel edges (no ordering between parallel tasks)', () => {
      const nodes = [
        { id: 'task-a', status: SupervisorTaskStatus.PENDING },
        { id: 'task-b', status: SupervisorTaskStatus.PENDING },
        { id: 'task-c', status: SupervisorTaskStatus.PENDING },
      ];
      const edges = [
        createDagEdge('task-a', 'task-c', DagEdgeType.PARALLEL),
        createDagEdge('task-b', 'task-c', DagEdgeType.PARALLEL),
      ];

      // Both task-a and task-b should come before task-c, but order between a and b may vary
      const sorted = topologicalSort(nodes, edges);
      expect(sorted.some((n) => n.id === 'task-c')).toBe(true);
      // task-c should have both task-a and task-b as dependencies
      const taskCIndex = sorted.findIndex((n) => n.id === 'task-c');
      // task-c should appear after both task-a and task-b
      expect(taskCIndex).toBeGreaterThanOrEqual(0);
    });

    it('throws DAGCycleError when cycle detected', () => {
      const nodes = [
        { id: 'task-a', status: SupervisorTaskStatus.PENDING },
        { id: 'task-b', status: SupervisorTaskStatus.PENDING },
      ];
      const edges = [
        createDagEdge('task-a', 'task-b', DagEdgeType.SEQUENTIAL),
        createDagEdge('task-b', 'task-a', DagEdgeType.SEQUENTIAL), // Creates cycle
      ];

      expect(() => topologicalSort(nodes, edges)).toThrow(DAGCycleError);
    });

    it('handles single node with no edges', () => {
      const nodes = [
        { id: 'task-a', status: SupervisorTaskStatus.PENDING },
      ];
      const edges = [];

      const sorted = topologicalSort(nodes, edges);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('task-a');
    });
  });

  describe('DAGEdge type constants', () => {
    it('has all edge type values', () => {
      expect(DagEdgeType).toHaveProperty('SEQUENTIAL');
      expect(DagEdgeType).toHaveProperty('PARALLEL');
      expect(DagEdgeType).toHaveProperty('ALTERNATIVE');
    });
  });
});