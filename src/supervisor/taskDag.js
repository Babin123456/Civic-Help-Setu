/**
 * Supervisor-Agent Architecture - Dependency DAG for Tasks
 * #1145: Complex Multi-Department Grievances
 *
 * Represents tasks as nodes in a Directed Acyclic Graph (DAG).
 * Ensures deterministic processing order, detects cycles, and supports
 * parallel and alternative (conflicting) path execution.
 *
 * Version: v1.0.0-task-dag
 */

import { DagEdgeType, createDagEdge } from './domainModel.js';

// ---------------------------------------------------------------------------
// Type: DagNode
// ---------------------------------------------------------------------------

/**
 * A node in the supervisor task DAG.
// Each node represents a supervisor task with its dependencies and state.
 */
export const DagNodeStatus = {
  PENDING: 'pending',       // Waiting for dependencies to complete
  READY: 'ready',          // Dependencies satisfied, ready to be claimed
  PROCESSING: 'processing', // Currently being processed by an agent
  COMPLETED: 'completed',   // Successfully completed
  FAILED: 'failed',         // Permanently failed
  DEFERRED: 'deferred',    // Waiting (e.g., for conflict resolution)
};

// –‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑
// DAG – Directed Acyclic Graph
// –‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑

/**
 * Computes the topological order of DAG nodes.
 * Returns nodes in an order that respects all dependency edges.
 * If a cycle is detected, throws a DAGCycleError.
 *
 * @param {Array<object>} nodes - Array of dag node objects
 * @param {Array<object>} edges - Array of dag edge objects (as created by createDagEdge)
 * @returns {Array<object>} Topologically sorted nodes
 * @throws {DAGCycleError} If the DAG contains a cycle
 */
export function topologicalSort(nodes, edges) {
  // Build adjacency info from edges
  const nodeMap = new Map();
  for (const node of nodes) {
    if (node.id && typeof node.id === 'string') {
      nodeMap.set(node.id, { ...node, outgoingEdges: [], incomingEdges: [] });
    }
  }

  // Validate all edge references exist
  for (const edge of edges) {
    if (!nodeMap.has(edge.sourceTaskId)) {
      throw new Error(
        `DAG edge references unknown source task: ${edge.sourceTaskId}`
      );
    }
    if (!nodeMap.has(edge.targetTaskId)) {
      throw new Error(
        `DAG edge references unknown target task: ${edge.targetTaskId}`
      );
    }
    // Add edge to node tracking
    nodeMap.get(edge.sourceTaskId).outgoingEdges.push(edge);
    nodeMap.get(edge.targetTaskId).incomingEdges.push(edge);
  }

  // Kahn's algorithm
  // Start with nodes that have no incoming edges
  const inDegree = new Map();
  for (const [id, node] of nodeMap) {
    inDegree.set(id, node.incomingEdges.length);
  }

  const queue = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }
  // Sort queue for deterministic order (prioritize nodes with higher priority, older creation)
  queue.sort((a, b) => {
    const na = nodeMap.get(a);
    const nb = nodeMap.get(b);
    // Sort by priority (lower number = lower priority, so we want higher priority first)
    // Then by creation time (older first)
    return 0; // Deterministic sort will be done by the caller with priority awareness
  });

  const sorted = [];
  while (queue.length > 0) {
    // For deterministic results, sort the queue each iteration by priority/age
    queue.sort();

    const currentId = queue.shift();
    sorted.push(nodeMap.get(currentId));

    // Reduce in-degree of neighbors
    for (const edge of nodeMap.get(currentId).outgoingEdges) {
      const targetId = edge.targetTaskId;
      const newDegree = inDegree.get(targetId) - 1;
      inDegree.set(targetId, newDegree);
      if (newDegree === 0) {
        queue.push(targetId);
      }
    }
  }

  // If sorted length < total nodes, there's a cycle
  if (sorted.length !== nodeMap.size) {
    const foundIds = new Set(nodeMap.keys());
    const sortedIds = new Set(sorted.map((n) => n.id));
    const cyclicIds = [...foundIds].filter((id) => !sortedIds.has(id));
    throw new DAGCycleError(`DAG contains cycle involving tasks: ${cyclicIds.join(', ')}`);
  }

  return sorted;
}

/**
 * Error class for DAG cycle detection.
 */
export class DAGCycleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DAGCycleError';
  }
}

// ---------------------------------------------------------------------------
// Type: DAGBuilder
// ---------------------------------------------------------------------------

/**
 * Builder for creating a supervisor task DAG from a grievance decomposition.
// Takes a high-level grievance description and produces a DAG of bounded
// supervisor tasks, each with jurisdiction evidence requirements and agent
 // assignments from the registry.
 */
export class DAGBuilder {
  constructor(registry) {
    if (!registry || typeof registry.getAgentsByDepartment !== 'function') {
      throw new TypeError('DAGBuilder requires a valid agent registry instance');
    }
    this.registry = registry;
    // Task type -> department mapping for decomposition rules
    this.departmentMapping = new Map();
  }

  /**
   * Set the department mapping for a task type.
   * This defines which department/agent handles which kind of grievance subtask.
   * @param {string} taskType - The task type identifier
   * @param {string} department - The department responsible
   */
  setDepartmentMapping(taskType, department) {
    this.departmentMapping.set(taskType, department);
  }

  /**
   * Decompose a grievance into an initial DAG of supervisor tasks.
   * This is the core decomposition logic – it breaks a multi-department
   * grievance into bounded, jurisdictional subtasks.
   *
   * @param {object} options - Decomposition options
   * @param {string} options.grievanceText - Citizen's grievance description
   * @param {object} [options.initialCategory] - Preliminary category from classification
   * @param {string} [options.tenantId] - Tenant identifier
   * @param {object} [options.jurisdictionEvidence] - Initial jurisdiction evidence from grievance intake
   * @returns {object} Decomposition result containing DAG and metadata
   */
  decomposeGrievance({
    grievanceText,
    initialCategory,
    tenantId,
    jurisdictionEvidence,
  } = {}) {
    if (typeof grievanceText !== 'string' || grievanceText.trim().length === 0) {
      throw new Error('grievanceText must be a non-empty string');
    }

    const safeText = grievanceText.trim().toLowerCase();
    const now = new Date().toISOString();

    // Step 1: Use existing classification if provided, otherwise basic keyword routing
    let category = initialCategory;
    if (!category) {
      // Simple keyword-based categorization for decomposition
      category = this._categorizeGrievance(safeText);
    }

    // Step 2: Determine departments involved
    const departments = this._determineDepartments(category, safeText);

    // Step 3: Create initial task nodes for each department
    const taskNodes = [];
    const taskEdges = [];
    const agentAssignments = [];

    // Create a root decomposition task
    const decompositionTask = this._createDecompositionTask({
      category,
      tenantId,
      jurisdictionEvidence,
    });

    taskNodes.push(decompositionTask);
    agentAssignments.push(decompositionTask.agentId);

    // Step 4: Create department-specific investigation tasks
    // One task per identified department
    for (const dept of departments) {
      const invTask = this._createInvestigationTask({
        category,
        department: dept,
        tenantId,
        jurisdictionEvidence,
      });

      taskNodes.push(invTask);
      agentAssignments.push(invTask.agentId);

      // Add dependency: decomposition -> investigation (sequential)
      const depEdge = createDagEdge(
        decompositionTask.id,
        invTask.id,
        DagEdgeType.SEQUENTIAL,
        `Decomposition task ${decompositionTask.id} must complete before ${invTask.id} investigation begins`
      );
      taskEdges.push(depEdge);
    }

    // Step 5: If multiple departments, add cross-reference edges
    // (evidence from one department may inform another's investigation)
    if (departments.length > 1) {
      for (let i = 0; i < departments.length; i++) {
        for (let j = i + 1; j < departments.length; j++) {
          const crossEdge = createDagEdge(
            `task-${departments[i]}-evidence`,
            `task-${departments[j]}-evidence`,
            DagEdgeType.PARALLEL,
            `Evidence from ${departments[i]} department may inform ${departments[j]} investigation`
          );
          taskEdges.push(crossEdge);
        }
      }
    }

    // Step 6: Compute total task count and enforce limit
    const totalTasks = taskNodes.length;
    if (totalTasks > this.constructor.MAX_TASKS_PER_GRIEVANCE) {
      // This shouldn't happen with normal grievances; if it does, truncate
      // and add a human-reassignment task
      throw new Error(
        `DAG decomposition produced ${totalTasks} tasks, exceeding limit of ${
          this.constructor.MAX_TASKS_PER_GRIEVANCE
        }`
      );
    }

    return {
      // Root decomposition task
      decompositionTask,

      // All task nodes in the DAG
      taskNodes,

      // Dependency edges
      taskEdges,

      // Summary
      summary: {
        totalTasks: totalTasks,
        departmentCount: departments.length,
        estimatedSlaDays: Math.max(...departments.map((d) => {
          const agents = this.registry.getAgentsByJurisdiction(d, 'state');
          return agents.length > 0 ? agents[0].slaDays : 7;
        })),
        category,
      },

      // Synthetic fixtures note: grievanceText used is anonymized; no citizen PII
    };
  }

  /**
   * Simple categorization based on keywords (fallback when no initial category given).
   * @param {string} safeText - Lowercased, trimmed grievance text
   * @returns {string} Category identifier
   * @private
   */
  _categorizeGrievance(safeText) {
    // Reuse logic from grievance classification but simplified for supervisor
    const GRIEVANCE_CATEGORIES = {
      ROADS_AND_INFRASTRUCTURE: 'ROADS_AND_INFRASTRUCTURE',
      MUNICIPAL_SANITATION: 'MUNICIPAL_SANITATION',
      WATER_AND_SEWERAGE: 'WATER_AND_SEWERAGE',
      ELECTRICITY_AND_POWER: 'ELECTRICITY_AND_POWER',
      PUBLIC_TRANSPORT: 'PUBLIC_TRANSPORT',
      HEALTH_AND_FOOD_SAFETY: 'HEALTH_AND_FOOD_SAFETY',
      REVENUE_AND_LAND: 'REVENUE_AND_LAND',
      AMBIGUOUS_MULTI_DEPARTMENT: 'AMBIGUOUS_MULTI_DEPARTMENT',
    };

    const keywordCategories = [
      { category: GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE, keywords: ['pothole', 'road', 'street', 'asphalt', 'divider'] },
      { category: GRIEVANCE_CATEGORIES.MUNICIPAL_SANITATION, keywords: ['garbage', 'waste', 'trash', 'dumping'] },
      { category: GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE, keywords: ['water', 'sewer', 'drainage', 'pipeline'] },
      { category: GRIEVANCE_CATEGORIES.ELECTRICITY_AND_POWER, keywords: ['power', 'electricity', 'transformer', 'voltage'] },
      { category: GRIEVANCE_CATEGORIES.PUBLIC_TRANSPORT, keywords: ['bus', 'auto', 'metro', 'traffic'] },
      { category: GRIEVANCE_CATEGORIES.HEALTH_AND_FOOD_SAFETY, keywords: ['hospital', 'doctor', 'medicine', 'food'] },
      { category: GRIEVANCE_CATEGORIES.REVENUE_AND_LAND, keywords: ['land', 'property', 'title', 'mutation'] },
    ];

    for (const { category, keywords } of keywordCategories) {
      if (keywords.some((kw) => safeText.includes(kw))) {
        return category;
      }
    }

    return GRIEVANCE_CATEGORIES.AMBIGUOUS_MULTI_DEPARTMENT;
  }

  /**
   * Determine which departments are involved in a grievance based on its category and text.
   * @param {string} category - The grievance category
   * @param {string} safeText - Lowercased, trimmed grievance text
   * @returns {Array<string>} Unique department names identified
   * @private
   */
  _determineDepartments(category, safeText) {
    const departments = new Set();

    // Add department based on category
    const categoryToDept = {
      [GRIEVANCE_CATEGORIES.ROADS_AND_INFRASTRUCTURE]: 'Public Works',
      [GRIEVANCE_CATEGORIES.MUNICIPAL_SANITATION]: 'Municipal Sanitation',
      [GRIEVANCE_CATEGORIES.WATER_AND_SEWERAGE]: 'Water Board',
      [GRIEVANCE_CATEGORIES.ELECTRICITY_AND_POWER]: 'Electricity DISCOM',
      [GRIEVANCE_CATEGORIES.PUBLIC_TRANSPORT]: 'Transport Authority',
      [GRIEVANCE_CATEGORIES.HEALTH_AND_FOOD_SAFETY]: 'Health Department',
      [GRIEVANCE_CATEGORIES.REVENUE_AND_LAND]: 'Revenue Department',
      [GRIEVANCE_CATEGORIES.AMBIGUOUS_MULTI_DEPARTMENT]: null, // Will be resolved per keyword
    };

    if (category && categoryToDept[category]) {
      if (categoryToDept[category] !== null) {
        departments.add(categoryToDept[category]);
      } else {
        // Ambiguous multi-department: determine per keywords
        const multiDeptKeywords = {
          'pothole': 'Public Works',
          'garbage': 'Municipal Sanitation',
          'water': 'Water Board',
          'electricity': 'Electricity DISCOM',
          'bus': 'Transport Authority',
          'doctor': 'Health Department',
          'land': 'Revenue Department',
        };
        for (const [kw, dept] of Object.entries(multiDeptKeywords)) {
          if (safeText.includes(kw)) {
            departments.add(dept);
          }
        }
        // If no specific keywords matched, add all as potentially involved
        if (departments.size === 0) {
          // Return a placeholder; the DAG will have a single ambiguous task
          departments.add('Multi-Department Coordination');
        }
      }
    } else {
      // Default: multi-department coordination
      departments.add('Multi-Department Coordination');
    }

    return [...departments];
  }

  /**
   * Create the root decomposition task for a grievance.
   * @param {object} options - Creation options
   * @param {string} options.category - Grievance category
   * @param {string} [options.tenantId] - Tenant identifier
   * @param {object} [options.jurisdictionEvidence] - Initial jurisdiction evidence
   * @returns {object} Decomposition task node
   * @private
   */
  _createDecompositionTask({ category, tenantId, jurisdictionEvidence }) {
    // Determine the primary department for this grievance
    const primaryDept = this._determineDepartments(category, '').pop() || 'Multi-Department Coordination';

    // Find available agents for this department
    const agents = this.registry.getAgentsByDepartment(primaryDept);
    const agentId = agents.length > 0 ? agents[0].agentId : null;

    return createSupervisorTask({
      type: 'grievance-decomposition',
      tenantId,
      agentId,
      priority: TaskPriority.HIGH, // Decomposition is time-sensitive
      jurisdictionEvidence,
      payload: {
        grievanceCategory: category,
        primaryDepartment: primaryDept,
        decompositionStep: 'root',
      },
      metadata: {
        createdBy: 'DAGBuilder.decomposeGrievance',
      },
      dependsOn: [], // Root task has no dependencies
    });
  }

  /**
   * Create an investigation task for a specific department.
   * @param {object} options - Creation options
   * @param {string} options.category - Grievance category
   * @param {string} options.department - Department name
   * @param {string} [options.tenantId] - Tenant identifier
   * @param {object} [options.jurisdictionEvidence] - Initial jurisdiction evidence
   * @returns {object} Investigation task node
   * @private
   */
  _createInvestigationTask({ category, department, tenantId, jurisdictionEvidence }) {
    // Find available agents for this department
    const agents = this.registry.getAgentsByDepartment(department);
    const agentId = agents.length > 0 ? agents[0].agentId : null;

    return createSupervisorTask({
      type: 'department-investigation',
      tenantId,
      agentId,
      priority: TaskPriority.NORMAL,
      jurisdictionEvidence,
      payload: {
        grievanceCategory: category,
        department,
        investigationStep: 'initial',
      },
      metadata: {
        createdBy: 'DAGBuilder._createInvestigationTask',
      },
      dependsOn: [], // Dependencies set by DAGBuilder caller (decomposition -> investigation)
    });
  }
}

// Set max tasks per grievance constant
DAGBuilder.MAX_TASKS_PER_GRIEVANCE = 20;

export { DagEdgeType };
export default DAGBuilder;