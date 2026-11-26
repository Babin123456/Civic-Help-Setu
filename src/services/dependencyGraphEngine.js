/**
 * Deterministic Dependency Graph Analysis & Explainable Recommendation Engine (#780)
 *
 * Implements bounded, explainable graph intelligence for public service continuity:
 * 1. Cycle Detection: DFS 3-color algorithm (White, Gray, Black) identifying recursive or circular dependencies.
 * 2. Topological Sort: Dependency-ordered recovery sequence.
 * 3. Single Point of Failure (SPOF) Analysis: Discovers unhedged nodes whose outage cascades to critical civic functions.
 * 4. Cascading Blast Radius: Predicts downstream service degradation.
 * 5. Explainable Recommendation Generator: Ruleset-versioned, human-in-the-loop recommendations.
 */

export const RULESET_VERSION = '1.0.0';

export const RECOMMENDATION_TYPES = {
  SINGLE_POINT_OF_FAILURE: 'SPOF_WARNING',
  RECOVERY_GAP_EXCEEDED: 'RECOVERY_GAP',
  MISSING_MANUAL_FALLBACK: 'MISSING_FALLBACK',
  CIRCULAR_DEPENDENCY_RISK: 'CIRCULAR_DEPENDENCY_RISK',
};

export const RECOMMENDATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  MODIFIED: 'MODIFIED',
};

/**
 * Builds an adjacency list representation from services and dependency records.
 *
 * Edge interpretation:
 * - dependency.upstreamDependencies is a list of service IDs that this service requires.
 * - In graph terms: `dependency.serviceId -> upstreamId` represents "requires".
 * - Reverse edge: `upstreamId -> dependentIds` represents "impacts downstream".
 *
 * @param {Array} services - Array of { id, name, criticality, ... }
 * @param {Array} dependencies - Array of { serviceId, upstreamDependencies, ... }
 */
export const buildDependencyGraph = (services = [], dependencies = []) => {
  const serviceMap = new Map();
  services.forEach((s) => serviceMap.set(s.id, s));

  // forward: node -> list of services it directly depends on
  const requiresAdj = new Map();
  // reverse: node -> list of services that depend on this node
  const dependentsAdj = new Map();

  services.forEach((s) => {
    requiresAdj.set(s.id, new Set());
    dependentsAdj.set(s.id, new Set());
  });

  dependencies.forEach((dep) => {
    const sId = dep.serviceId;
    if (!requiresAdj.has(sId)) requiresAdj.set(sId, new Set());

    (dep.upstreamDependencies || []).forEach((uId) => {
      // ignore self-loops or missing IDs gracefully
      if (uId && uId !== sId) {
        requiresAdj.get(sId).add(uId);

        if (!dependentsAdj.has(uId)) dependentsAdj.set(uId, new Set());
        dependentsAdj.get(uId).add(sId);
      }
    });
  });

  return { serviceMap, requiresAdj, dependentsAdj };
};

/**
 * Detects circular dependencies using DFS 3-coloring.
 * Colors:
 *  0 = White (unvisited)
 *  1 = Gray (visiting, currently in recursion stack)
 *  2 = Black (visited, completely explored)
 *
 * @returns {Object} { hasCycle: boolean, cyclePath: string[], cycleDescriptions: string[] }
 */
export const detectDependencyCycles = (services = [], dependencies = []) => {
  const { serviceMap, requiresAdj } = buildDependencyGraph(services, dependencies);
  const color = new Map();
  const parent = new Map();
  const nodes = Array.from(requiresAdj.keys());

  nodes.forEach((n) => color.set(n, 0));

  let cycleFound = false;
  let cyclePath = [];

  const dfs = (u) => {
    color.set(u, 1);

    const neighbors = requiresAdj.get(u) || new Set();
    for (const v of neighbors) {
      if (color.get(v) === 1) {
        // Back-edge found -> cycle!
        cycleFound = true;
        cyclePath = [v, u];
        let curr = u;
        while (curr && curr !== v && parent.has(curr)) {
          curr = parent.get(curr);
          cyclePath.push(curr);
        }
        cyclePath.reverse();
        return true;
      }
      if (color.get(v) === 0) {
        parent.set(v, u);
        if (dfs(v)) return true;
      }
    }

    color.set(u, 2);
    return false;
  };

  for (const node of nodes) {
    if (color.get(node) === 0) {
      if (dfs(node)) break;
    }
  }

  const cycleDescriptions = cyclePath.map((id) => serviceMap.get(id)?.name || id);

  return {
    hasCycle: cycleFound,
    cyclePath,
    cycleDescription: cycleFound ? cycleDescriptions.join(' ➔ ') : null,
  };
};

/**
 * Calculates topological sort for service recovery order (services with 0 remaining
 * unresolved dependencies must be restored first).
 *
 * @returns {Array<{ serviceId: string, serviceName: string, phase: number }>}
 */
export const calculateRecoverySequence = (services = [], dependencies = []) => {
  const { hasCycle } = detectDependencyCycles(services, dependencies);
  if (hasCycle) {
    // Deterministic fallback: sort by criticality tier then RTO
    return [...services]
      .sort((a, b) => {
        const tierWeight = { TIER_1_CRITICAL: 1, TIER_2_ESSENTIAL: 2, TIER_3_DEFERRED: 3 };
        return (tierWeight[a.criticality] || 99) - (tierWeight[b.criticality] || 99);
      })
      .map((s, idx) => ({
        serviceId: s.id,
        serviceName: s.name,
        criticality: s.criticality,
        phase: idx + 1,
      }));
  }

  const { serviceMap, requiresAdj } = buildDependencyGraph(services, dependencies);
  const inDegree = new Map();
  const allNodes = Array.from(serviceMap.keys());

  allNodes.forEach((n) => inDegree.set(n, 0));
  allNodes.forEach((u) => {
    const deps = requiresAdj.get(u) || new Set();
    inDegree.set(u, deps.size);
  });

  const queue = allNodes.filter((n) => inDegree.get(n) === 0);
  const sequence = [];
  let currentPhase = 1;

  const currentLevelNodes = [...queue];
  const processed = new Set();

  while (currentLevelNodes.length > 0) {
    const batch = currentLevelNodes.splice(0, currentLevelNodes.length);
    batch.forEach((nodeId) => {
      processed.add(nodeId);
      sequence.push({
        serviceId: nodeId,
        serviceName: serviceMap.get(nodeId)?.name || nodeId,
        criticality: serviceMap.get(nodeId)?.criticality || 'TIER_2_ESSENTIAL',
        phase: currentPhase,
      });
    });

    currentPhase += 1;

    // Discover next eligible nodes whose dependencies are all processed
    allNodes.forEach((candidate) => {
      if (!processed.has(candidate)) {
        const reqs = requiresAdj.get(candidate) || new Set();
        const allSatisfied = Array.from(reqs).every((r) => processed.has(r));
        if (allSatisfied) {
          currentLevelNodes.push(candidate);
        }
      }
    });
  }

  // Any remaining nodes appended at end
  allNodes.forEach((n) => {
    if (!processed.has(n)) {
      sequence.push({
        serviceId: n,
        serviceName: serviceMap.get(n)?.name || n,
        criticality: serviceMap.get(n)?.criticality || 'TIER_3_DEFERRED',
        phase: currentPhase,
      });
    }
  });

  return sequence;
};

/**
 * Computes cascading blast radius: if targetServiceId fails, what downstream services collapse?
 *
 * @param {string} targetServiceId
 * @param {Array} services
 * @param {Array} dependencies
 * @returns {Object} { impactedServiceIds: string[], impactedCount: number, affectedCriticalCount: number }
 */
export const calculateCascadingBlastRadius = (targetServiceId, services = [], dependencies = []) => {
  const { serviceMap, dependentsAdj } = buildDependencyGraph(services, dependencies);
  const visited = new Set();
  const queue = [targetServiceId];

  while (queue.length > 0) {
    const current = queue.shift();
    const downstream = dependentsAdj.get(current) || new Set();

    downstream.forEach((depId) => {
      if (!visited.has(depId)) {
        visited.add(depId);
        queue.push(depId);
      }
    });
  }

  const impactedList = Array.from(visited).map((id) => serviceMap.get(id)).filter(Boolean);
  const criticalCount = impactedList.filter((s) => s.criticality === 'TIER_1_CRITICAL').length;

  return {
    impactedServiceIds: Array.from(visited),
    impactedServices: impactedList,
    impactedCount: visited.size,
    affectedCriticalCount: criticalCount,
  };
};

/**
 * Identifies Single Points of Failure (SPOF) and generates explainable, ruleset-versioned recommendations.
 *
 * Bounded Rules:
 * - Rule 1 (SPOF): Any service that has >= 2 downstream dependents or >= 1 Tier-1 critical dependent, and lacks a designated redundant alternative.
 * - Rule 2 (Recovery Gap): Any service where estimated restoration time exceeds target RTO.
 * - Rule 3 (Missing Manual Fallback): Tier-1 or Tier-2 service without a documented offline operating procedure.
 *
 * @param {Object} options
 * @param {Array} options.services
 * @param {Array} options.dependencies
 * @param {Object} [options.recoveryObjectives]
 * @param {string} [options.jurisdictionId]
 * @returns {Array<Object>} List of explainable recommendation objects
 */
export const generateExplainableRecommendations = ({
  services = [],
  dependencies = [],
  recoveryObjectives = { rtoHours: 4, rpoHours: 2 },
  jurisdictionId = 'all',
} = {}) => {
  const executionTimestamp = new Date().toISOString();
  const inputFeatureWindow = {
    timestamp: executionTimestamp,
    serviceCount: services.length,
    dependencyCount: dependencies.length,
    jurisdictionId: String(jurisdictionId),
    targetRTO: recoveryObjectives.rtoHours || 4,
  };

  const recommendations = [];
  const { serviceMap, dependentsAdj } = buildDependencyGraph(services, dependencies);

  // Check Cycle first
  const cycleInfo = detectDependencyCycles(services, dependencies);
  if (cycleInfo.hasCycle) {
    recommendations.push({
      id: `rec_cycle_${Date.now()}`,
      rulesetVersion: RULESET_VERSION,
      executionTimestamp,
      inputFeatureWindow,
      type: RECOMMENDATION_TYPES.CIRCULAR_DEPENDENCY_RISK,
      severity: 'CRITICAL',
      targetServiceId: cycleInfo.cyclePath[0] || 'unknown',
      targetServiceName: cycleInfo.cycleDescription,
      rationale: `A circular dependency was detected along path [${cycleInfo.cycleDescription}]. In a major outage, mutual dependencies cause deadlock and prevent automated or manual recovery.`,
      contributingFields: ['upstreamDependencies', 'serviceId'],
      suggestedRemediation: 'Decouple one or more dependencies by establishing an asynchronous buffer or manual fallback buffer.',
      status: RECOMMENDATION_STATUS.PENDING,
      requiresHumanSignoff: true,
    });
  }

  // Evaluate each service against bounded rules
  services.forEach((service) => {
    const sId = service.id;
    const depRecord = dependencies.find((d) => d.serviceId === sId) || {};
    const downstreamIds = Array.from(dependentsAdj.get(sId) || []);
    const downstreamServices = downstreamIds.map((id) => serviceMap.get(id)).filter(Boolean);
    const downstreamCriticalCount = downstreamServices.filter((s) => s.criticality === 'TIER_1_CRITICAL').length;

    // Rule 1: Single Point of Failure (SPOF)
    const hasMultipleDependents = downstreamIds.length >= 2;
    const impactsCritical = downstreamCriticalCount >= 1;
    const lacksRedundancy = !depRecord.redundantAlternative;

    if ((hasMultipleDependents || impactsCritical) && lacksRedundancy) {
      recommendations.push({
        id: `rec_spof_${sId}_${Date.now()}`,
        rulesetVersion: RULESET_VERSION,
        executionTimestamp,
        inputFeatureWindow,
        type: RECOMMENDATION_TYPES.SINGLE_POINT_OF_FAILURE,
        severity: service.criticality === 'TIER_1_CRITICAL' || impactsCritical ? 'HIGH' : 'MEDIUM',
        targetServiceId: sId,
        targetServiceName: service.name,
        rationale: `Service "${service.name}" directly supports ${downstreamIds.length} dependent civic service(s) (including ${downstreamCriticalCount} Tier-1 critical service(s)) with no hot/warm redundant alternative registered.`,
        contributingFields: ['dependentsCount', 'criticality', 'redundantAlternative'],
        suggestedRemediation: `Provision a secondary standby channel or mirror registry for ${service.name} to avoid single-point catastrophic failure.`,
        status: RECOMMENDATION_STATUS.PENDING,
        requiresHumanSignoff: true,
      });
    }

    // Rule 2: Recovery Gap (Restoration Time > Target RTO)
    const targetRTO = recoveryObjectives.rtoHours || 4;
    const estRestoration = depRecord.estimatedRestorationHours || service.estimatedRestorationHours || 0;
    if (estRestoration > targetRTO) {
      recommendations.push({
        id: `rec_gap_${sId}_${Date.now()}`,
        rulesetVersion: RULESET_VERSION,
        executionTimestamp,
        inputFeatureWindow,
        type: RECOMMENDATION_TYPES.RECOVERY_GAP_EXCEEDED,
        severity: service.criticality === 'TIER_1_CRITICAL' ? 'HIGH' : 'MEDIUM',
        targetServiceId: sId,
        targetServiceName: service.name,
        rationale: `Estimated restoration time (${estRestoration} hrs) exceeds the designated plan Recovery Time Objective (RTO: ${targetRTO} hrs) by ${estRestoration - targetRTO} hours.`,
        contributingFields: ['estimatedRestorationHours', 'recoveryObjectives.rtoHours', 'criticality'],
        suggestedRemediation: `Pre-stage emergency equipment or contract rapid vendor SLA to reduce restoration turnaround below ${targetRTO} hours.`,
        status: RECOMMENDATION_STATUS.PENDING,
        requiresHumanSignoff: true,
      });
    }

    // Rule 3: Missing Manual Fallback Procedure
    const hasManualProcedure = Boolean(
      (depRecord.manualFallbackProcedure && depRecord.manualFallbackProcedure.trim().length > 10) ||
      (service.manualFallbackProcedure && service.manualFallbackProcedure.trim().length > 10)
    );
    if ((service.criticality === 'TIER_1_CRITICAL' || service.criticality === 'TIER_2_ESSENTIAL') && !hasManualProcedure) {
      recommendations.push({
        id: `rec_fallback_${sId}_${Date.now()}`,
        rulesetVersion: RULESET_VERSION,
        executionTimestamp,
        inputFeatureWindow,
        type: RECOMMENDATION_TYPES.MISSING_MANUAL_FALLBACK,
        severity: 'MEDIUM',
        targetServiceId: sId,
        targetServiceName: service.name,
        rationale: `Service "${service.name}" is designated as ${service.criticality} but does not have a documented manual paper-based or offline fallback procedure in case of cloud/power disconnection.`,
        contributingFields: ['criticality', 'manualFallbackProcedure'],
        suggestedRemediation: 'Document a step-by-step paper/offline SOP in the plan so ground officers can continue operations during a digital blackout.',
        status: RECOMMENDATION_STATUS.PENDING,
        requiresHumanSignoff: true,
      });
    }
  });

  return recommendations;
};
