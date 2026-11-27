/**
 * src/services/civicWorkflowDigitalTwinService.js
 * End-to-End Service Journey Digital Twin & Resiliency Simulation Engine (#1157).
 *
 * Provides:
 * 1. Graph integrity, cycle, and dead-end detection for civic service workflows.
 * 2. Deterministic synthetic persona traversal and SLA tracking.
 * 3. Batch cohort simulation with bottleneck and accessibility diagnostics.
 * 4. Version comparison (vOld vs vNew) with regression and excluded-cohort detection.
 * 5. WCAG-accessible tabular projections for screen-reader and non-visual audit.
 */

import {
  NODE_TYPES,
  EDGE_TYPES,
  TERMINAL_STATUSES,
  SIMULATION_OUTCOMES,
  WORKFLOW_CHANGE_SEVERITY,
  validateWorkflowGraph,
  validateSyntheticPersona,
  checkForbiddenFields,
} from '../data/digitalTwinContract.js';

/**
 * Validates graph integrity, detecting cycles, unreachable steps, and terminal dead ends.
 *
 * @param {object} workflow - Workflow graph definition
 * @returns {object} Integrity diagnostic report
 */
export function validateWorkflowGraphIntegrity(workflow) {
  const schemaCheck = validateWorkflowGraph(workflow);
  if (!schemaCheck.isValid) {
    return {
      isValid: false,
      hasCycles: false,
      cycleNodes: [],
      unreachableNodeIds: [],
      deadEndNodeIds: [],
      errors: schemaCheck.errors,
      warnings: [],
    };
  }

  const nodes = workflow.nodes;
  const edges = workflow.edges;
  const errors = [];
  const warnings = [];

  // Build adjacency list for forward flow
  const forwardAdj = new Map();
  for (const node of nodes) {
    forwardAdj.set(node.id, []);
  }

  for (const edge of edges) {
    // Only sequential transitions, branches, and fallbacks dictate step progression
    if (
      edge.type === EDGE_TYPES.SEQUENTIAL_STEP ||
      edge.type === EDGE_TYPES.CONDITIONAL_BRANCH ||
      edge.type === EDGE_TYPES.REMEDY_FALLBACK
    ) {
      forwardAdj.get(edge.source)?.push({ target: edge.target, edgeId: edge.id, type: edge.type });
    }
  }

  // 1. Detect cycles among actionable steps
  const state = new Map(); // 0: unvisited, 1: visiting, 2: visited
  let cycleNodes = [];

  function dfsCycle(nodeId, path = []) {
    state.set(nodeId, 1);
    path.push(nodeId);

    const neighbors = forwardAdj.get(nodeId) || [];
    for (const { target } of neighbors) {
      if (state.get(target) === 1) {
        // Found back-edge cycle
        const cycleStart = path.indexOf(target);
        cycleNodes = path.slice(cycleStart);
        cycleNodes.push(target);
        return true;
      }
      if (!state.get(target)) {
        if (dfsCycle(target, path)) return true;
      }
    }

    path.pop();
    state.set(nodeId, 2);
    return false;
  }

  for (const node of nodes) {
    if (!state.get(node.id) && node.type === NODE_TYPES.SERVICE_STEP) {
      if (dfsCycle(node.id)) break;
    }
  }

  const hasCycles = cycleNodes.length > 0;
  if (hasCycles) {
    errors.push(`Circular workflow loop detected: ${cycleNodes.join(' -> ')}`);
  }

  // 2. Reachability analysis from initialStepId
  const reachableNodeIds = new Set();
  const queue = [workflow.initialStepId];
  reachableNodeIds.add(workflow.initialStepId);

  while (queue.length > 0) {
    const current = queue.shift();
    // Also include document and office nodes directly attached to reachable steps
    for (const edge of edges) {
      if (edge.source === current) {
        if (!reachableNodeIds.has(edge.target)) {
          reachableNodeIds.add(edge.target);
          if (
            edge.type === EDGE_TYPES.SEQUENTIAL_STEP ||
            edge.type === EDGE_TYPES.CONDITIONAL_BRANCH ||
            edge.type === EDGE_TYPES.REMEDY_FALLBACK
          ) {
            queue.push(edge.target);
          }
        }
      }
    }
  }

  const unreachableNodeIds = nodes
    .filter((n) => !reachableNodeIds.has(n.id))
    .map((n) => n.id);

  if (unreachableNodeIds.length > 0) {
    warnings.push(`Unreachable nodes detected (never triggered from initial step): ${unreachableNodeIds.join(', ')}`);
  }

  // 3. Dead-end detection: Any reachable step that cannot eventually reach an approved or remedy TERMINAL_STATE
  const validTerminalNodeIds = new Set(
    nodes
      .filter(
        (n) =>
          n.type === NODE_TYPES.TERMINAL_STATE &&
          n.terminalStatus !== TERMINAL_STATUSES.DEAD_END_TERMINATION.id
      )
      .map((n) => n.id)
  );

  const canReachTerminal = new Set(validTerminalNodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [nodeId, neighbors] of forwardAdj.entries()) {
      if (!canReachTerminal.has(nodeId)) {
        for (const { target } of neighbors) {
          if (canReachTerminal.has(target)) {
            canReachTerminal.add(nodeId);
            changed = true;
            break;
          }
        }
      }
    }
  }

  const deadEndNodeIds = nodes
    .filter(
      (n) =>
        reachableNodeIds.has(n.id) &&
        (n.type === NODE_TYPES.SERVICE_STEP || n.type === NODE_TYPES.TERMINAL_STATE) &&
        (n.terminalStatus === TERMINAL_STATUSES.DEAD_END_TERMINATION.id || !canReachTerminal.has(n.id))
    )
    .map((n) => n.id);

  if (deadEndNodeIds.length > 0) {
    errors.push(`Dead-end steps detected with no path to an approved or remedy termination: ${deadEndNodeIds.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    hasCycles,
    cycleNodes,
    unreachableNodeIds,
    deadEndNodeIds,
    errors,
    warnings,
  };
}

/**
 * Deterministically simulates a single synthetic persona's journey through a workflow graph.
 *
 * @param {object} workflow - Workflow graph definition
 * @param {object} persona - Synthetic citizen persona
 * @param {object} options - Simulation tuning parameters
 * @returns {object} Detailed journey simulation execution trace
 */
export function simulatePersonaJourney(workflow, persona, options = {}) {
  const maxIterations = options.maxIterations || 50;

  // Ensure zero forbidden fields - strict boundary enforcement throws immediately
  const piiErrors = checkForbiddenFields(persona, 'simulation persona');
  if (piiErrors.length > 0) {
    throw new Error(`Security Violation: ${piiErrors[0]}`);
  }

  // Validate inputs
  const personaCheck = validateSyntheticPersona(persona);
  if (!personaCheck.isValid) {
    return {
      success: false,
      outcome: SIMULATION_OUTCOMES.FAILED_REQUISITE,
      error: `Invalid persona: ${personaCheck.errors.join('; ')}`,
      trace: [],
      totalDays: 0,
      slaBreached: false,
    };
  }

  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));
  const outgoingEdges = new Map();
  for (const node of workflow.nodes) {
    outgoingEdges.set(node.id, []);
  }
  for (const edge of workflow.edges) {
    outgoingEdges.get(edge.source)?.push(edge);
  }

  const trace = [];
  let currentStepId = workflow.initialStepId;
  let totalDays = 0;
  let iterations = 0;
  let outcome = SIMULATION_OUTCOMES.SUCCESS;
  let terminalNode = null;
  let accessibilityBlocked = false;
  let failureReason = null;

  const visitedStepCounts = new Map();

  while (currentStepId && iterations < maxIterations) {
    iterations += 1;
    visitedStepCounts.set(currentStepId, (visitedStepCounts.get(currentStepId) || 0) + 1);

    // Prevent infinite cycles during simulation
    if (visitedStepCounts.get(currentStepId) > 3) {
      outcome = SIMULATION_OUTCOMES.DEAD_END;
      failureReason = `Infinite loop trap detected at step "${currentStepId}"`;
      break;
    }

    const currentNode = nodeMap.get(currentStepId);
    if (!currentNode) {
      outcome = SIMULATION_OUTCOMES.UNREACHABLE_STEP;
      failureReason = `Referenced step "${currentStepId}" does not exist in workflow`;
      break;
    }

    // If we reached a terminal node, record and finish
    if (currentNode.type === NODE_TYPES.TERMINAL_STATE) {
      terminalNode = currentNode;
      if (currentNode.terminalStatus === TERMINAL_STATUSES.APPROVED.id) {
        outcome = SIMULATION_OUTCOMES.SUCCESS;
      } else if (currentNode.terminalStatus === TERMINAL_STATUSES.DEAD_END_TERMINATION.id) {
        outcome = SIMULATION_OUTCOMES.DEAD_END;
        failureReason = 'Application routed to a dead-end termination state without recourse';
      } else {
        outcome = SIMULATION_OUTCOMES.FAILED_REQUISITE;
        failureReason = currentNode.label || 'Application halted at non-approval terminal';
      }

      trace.push({
        stepNumber: trace.length + 1,
        stepId: currentNode.id,
        stepLabel: currentNode.label,
        type: currentNode.type,
        terminalStatus: currentNode.terminalStatus,
        daysElapsed: totalDays,
        status: outcome === SIMULATION_OUTCOMES.SUCCESS ? 'DELIVERED' : 'HALTED',
        note: failureReason || 'Journey completed successfully',
      });
      break;
    }

    // Step duration increment
    const stepDuration = typeof currentNode.estimatedDays === 'number' ? currentNode.estimatedDays : 1;
    totalDays += stepDuration;

    const edges = outgoingEdges.get(currentStepId) || [];

    // 1. Check Document Requirements
    const docEdges = edges.filter((e) => e.type === EDGE_TYPES.REQUIRES_DOCUMENT);
    const missingDocs = [];
    for (const docEdge of docEdges) {
      const docNode = nodeMap.get(docEdge.target);
      if (docNode && docNode.type === NODE_TYPES.DOCUMENT_REQUIREMENT) {
        const acceptableKeys = Array.isArray(docNode.acceptableKeys) ? docNode.acceptableKeys : [];
        const hasMatchingDoc = acceptableKeys.some((key) => persona.availableDocuments.includes(key));
        if (!hasMatchingDoc && docNode.isMandatory !== false) {
          missingDocs.push(docNode.label);
        }
      }
    }

    // 2. Check Physical Office Accessibility
    const officeEdges = edges.filter((e) => e.type === EDGE_TYPES.PROCEEDS_TO_OFFICE);
    let officeNote = null;
    for (const offEdge of officeEdges) {
      const officeNode = nodeMap.get(offEdge.target);
      if (officeNode) {
        officeNote = `${officeNode.label} (${officeNode.department || 'Civic Center'})`;
        if (
          (persona.attributes?.requiresWheelchairAccess || persona.attributes?.requiresGroundFloorDesk) &&
          officeNode.isAccessibleDesk === false
        ) {
          accessibilityBlocked = true;
          totalDays += 7; // Adds accessibility delay looking for alternative counter
        }
      }
    }

    // 3. Biometric failure simulation
    let biometricFailure = false;
    if (
      currentNode.requiresBiometricScan &&
      typeof persona.attributes?.biometricReliabilityScore === 'number' &&
      persona.attributes.biometricReliabilityScore < 0.4
    ) {
      biometricFailure = true;
      totalDays += 3; // Friction retry days
    }

    // Record step in trace
    const stepPassed = missingDocs.length === 0 && !biometricFailure;
    trace.push({
      stepNumber: trace.length + 1,
      stepId: currentNode.id,
      stepLabel: currentNode.label,
      type: currentNode.type,
      office: officeNote,
      estimatedDays: stepDuration,
      cumulativeDays: totalDays,
      status: stepPassed ? 'PASSED' : 'DEFICIENT',
      missingDocuments: missingDocs,
      biometricFailure,
      accessibilityWarning: accessibilityBlocked,
      note: missingDocs.length > 0
        ? `Missing prerequisite documentary evidence: ${missingDocs.join(', ')}`
        : biometricFailure
          ? 'Biometric sensor mismatch; fallback verification triggered'
          : 'Step requirements verified successfully',
    });

    if (!stepPassed) {
      // Look for remedy fallback or deficiency branch
      const remedyEdge = edges.find(
        (e) => e.type === EDGE_TYPES.REMEDY_FALLBACK || (e.type === EDGE_TYPES.CONDITIONAL_BRANCH && e.condition === 'unresolvedDiscrepancy')
      );

      if (remedyEdge) {
        currentStepId = remedyEdge.target;
        continue;
      } else {
        outcome = SIMULATION_OUTCOMES.FAILED_REQUISITE;
        failureReason = `Missing mandatory documentation [${missingDocs.join(', ')}] with no deficiency cure path defined`;
        break;
      }
    }

    // 4. Resolve next step via sequential transition or conditional branch
    const nextTransitions = edges.filter(
      (e) => e.type === EDGE_TYPES.SEQUENTIAL_STEP || e.type === EDGE_TYPES.CONDITIONAL_BRANCH
    );

    if (nextTransitions.length === 0) {
      outcome = SIMULATION_OUTCOMES.DEAD_END;
      failureReason = `Workflow step "${currentNode.id}" has no outbound transition or terminal state (Dead End)`;
      break;
    }

    // Pick first matching branch or default sequential step
    let nextStepId = null;
    for (const transition of nextTransitions) {
      if (transition.type === EDGE_TYPES.CONDITIONAL_BRANCH && transition.condition) {
        // Evaluate condition on persona attributes safely
        if (transition.condition === 'isBPL' && persona.attributes?.isBPL) {
          nextStepId = transition.target;
          break;
        } else if (transition.condition === 'isSenior' && persona.attributes?.isSeniorCitizen) {
          nextStepId = transition.target;
          break;
        }
      } else if (transition.type === EDGE_TYPES.SEQUENTIAL_STEP) {
        nextStepId = transition.target;
        break;
      }
    }

    if (!nextStepId) {
      nextStepId = nextTransitions[0].target;
    }

    currentStepId = nextStepId;
  }

  if (iterations >= maxIterations) {
    outcome = SIMULATION_OUTCOMES.DEAD_END;
    failureReason = 'Simulation reached maximum depth iteration limit (cyclic or infinite journey)';
  }

  const statutorySla = workflow.statutorySlaDays || 30;
  const slaBreached = totalDays > statutorySla;
  if (slaBreached && outcome === SIMULATION_OUTCOMES.SUCCESS) {
    outcome = SIMULATION_OUTCOMES.SLA_BREACH;
    failureReason = `Completed in ${totalDays} days, exceeding statutory SLA limit of ${statutorySla} days`;
  }

  return {
    personaId: persona.id,
    personaName: persona.name,
    archetype: persona.archetype,
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    outcome,
    isSuccess: outcome === SIMULATION_OUTCOMES.SUCCESS,
    failureReason,
    terminalNodeId: terminalNode?.id || null,
    terminalStatus: terminalNode?.terminalStatus || null,
    totalDays,
    statutorySlaDays: statutorySla,
    slaBreached,
    accessibilityBlocked,
    trace,
  };
}

/**
 * Runs simulation across an entire cohort of synthetic personas and computes resilience metrics.
 *
 * @param {object} workflow
 * @param {object[]} personas
 * @param {object} options
 * @returns {object} Cohort resiliency benchmark report
 */
export function simulateCohort(workflow, personas = [], options = {}) {
  const results = personas.map((p) => simulatePersonaJourney(workflow, p, options));

  const total = results.length;
  const successes = results.filter((r) => r.isSuccess);
  const deadEnds = results.filter((r) => r.outcome === SIMULATION_OUTCOMES.DEAD_END);
  const slaBreaches = results.filter((r) => r.slaBreached);
  const accessBarriers = results.filter((r) => r.accessibilityBlocked);

  const totalDuration = results.reduce((acc, r) => acc + r.totalDays, 0);
  const avgDuration = total > 0 ? Number((totalDuration / total).toFixed(1)) : 0;
  const maxDuration = results.reduce((max, r) => Math.max(max, r.totalDays), 0);

  // Identify bottleneck steps where friction occurred
  const stepFrictionCounts = new Map();
  for (const r of results) {
    for (const step of r.trace) {
      if (step.status === 'DEFICIENT' || step.accessibilityWarning || step.biometricFailure) {
        stepFrictionCounts.set(step.stepId, (stepFrictionCounts.get(step.stepId) || 0) + 1);
      }
    }
  }

  const bottlenecks = Array.from(stepFrictionCounts.entries())
    .map(([stepId, frictionCount]) => {
      const node = workflow.nodes.find((n) => n.id === stepId);
      return {
        stepId,
        label: node?.label || stepId,
        frictionCount,
        percentageOfCohort: total > 0 ? Math.round((frictionCount / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.frictionCount - a.frictionCount);

  return {
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    totalPersonas: total,
    successCount: successes.length,
    successRate: total > 0 ? Number(((successes.length / total) * 100).toFixed(1)) : 0,
    deadEndCount: deadEnds.length,
    slaBreachCount: slaBreaches.length,
    accessibilityBarrierCount: accessBarriers.length,
    averageDurationDays: avgDuration,
    maxDurationDays: maxDuration,
    statutorySlaDays: workflow.statutorySlaDays || 30,
    bottlenecks,
    individualResults: results,
  };
}

/**
 * Compares two workflow versions (vOld vs vNew) and detects breaking dead ends or excluded cohorts.
 *
 * @param {object} baseWorkflow - Current published baseline workflow
 * @param {object} proposedWorkflow - Draft revision proposed by maintainer
 * @param {object[]} personas - Synthetic persona cohort
 * @returns {object} Version comparison & breaking change assessment report
 */
export function compareWorkflowVersions(baseWorkflow, proposedWorkflow, personas = []) {
  const baseCohort = simulateCohort(baseWorkflow, personas);
  const proposedCohort = simulateCohort(proposedWorkflow, personas);

  // Integrity checks
  const baseIntegrity = validateWorkflowGraphIntegrity(baseWorkflow);
  const proposedIntegrity = validateWorkflowGraphIntegrity(proposedWorkflow);

  // Detect excluded cohorts (passed in base, failed in proposed)
  const excludedPersonas = [];
  for (const proposedResult of proposedCohort.individualResults) {
    const baseResult = baseCohort.individualResults.find((b) => b.personaId === proposedResult.personaId);
    if (baseResult && baseResult.isSuccess && !proposedResult.isSuccess) {
      excludedPersonas.push({
        personaId: proposedResult.personaId,
        personaName: proposedResult.personaName,
        archetype: proposedResult.archetype,
        baseOutcome: baseResult.outcome,
        proposedOutcome: proposedResult.outcome,
        reason: proposedResult.failureReason,
      });
    }
  }

  // Detect newly introduced dead ends
  const newDeadEnds = proposedIntegrity.deadEndNodeIds.filter(
    (id) => !baseIntegrity.deadEndNodeIds.includes(id)
  );

  // Compute SLA delta
  const slaDurationDelta = Number(
    (proposedCohort.averageDurationDays - baseCohort.averageDurationDays).toFixed(1)
  );

  // Determine overall severity
  let severity = WORKFLOW_CHANGE_SEVERITY.BENIGN_RESTRUCTURING;
  if (newDeadEnds.length > 0 || proposedCohort.deadEndCount > baseCohort.deadEndCount) {
    severity = WORKFLOW_CHANGE_SEVERITY.BREAKING_DEAD_END;
  } else if (excludedPersonas.length > 0) {
    severity = WORKFLOW_CHANGE_SEVERITY.REGRESSION_EXCLUSION;
  } else if (slaDurationDelta > 3 || proposedCohort.slaBreachCount > baseCohort.slaBreachCount) {
    severity = WORKFLOW_CHANGE_SEVERITY.SLA_INFLATION;
  }

  return {
    baseVersion: baseWorkflow.version,
    proposedVersion: proposedWorkflow.version,
    serviceId: baseWorkflow.serviceId,
    severity,
    isBreaking: severity.level === 'CRITICAL' || severity.level === 'HIGH',
    successRateDelta: Number((proposedCohort.successRate - baseCohort.successRate).toFixed(1)),
    slaDurationDelta,
    newDeadEnds,
    excludedPersonas,
    baseCohortSummary: {
      successRate: baseCohort.successRate,
      avgDays: baseCohort.averageDurationDays,
      deadEnds: baseCohort.deadEndCount,
    },
    proposedCohortSummary: {
      successRate: proposedCohort.successRate,
      avgDays: proposedCohort.averageDurationDays,
      deadEnds: proposedCohort.deadEndCount,
    },
    proposedIntegrity,
  };
}

/**
 * Projects a simulation trace into an accessible, non-visual WCAG-compliant tabular dataset.
 *
 * @param {object} simulationResult
 * @returns {object[]} Tabular row objects for screen readers and accessible display
 */
export function generateAccessibleTabularReport(simulationResult) {
  if (!simulationResult || !Array.isArray(simulationResult.trace)) {
    return [];
  }

  return simulationResult.trace.map((step) => ({
    stepNumber: step.stepNumber,
    stepId: step.stepId,
    label: step.stepLabel,
    status: step.status,
    office: step.office || 'Digital / Remote Desk',
    durationDays: step.estimatedDays || 0,
    cumulativeDays: step.cumulativeDays || step.daysElapsed || 0,
    accessibilityIssue: step.accessibilityWarning ? 'Yes (Mobility / Counter Barrier)' : 'None',
    notes: step.note || 'Normal operation',
  }));
}

/**
 * Sanitizes simulation run records for external download, compliance reports, or audit logs.
 *
 * @param {object} report
 * @returns {object} Clean copy guaranteed free of session IDs or private metadata
 */
export function sanitizeDigitalTwinExport(report) {
  if (!report || typeof report !== 'object') return {};
  const clean = JSON.parse(JSON.stringify(report));

  delete clean.authToken;
  delete clean.userSessionId;
  delete clean.internalHeaders;

  return clean;
}
