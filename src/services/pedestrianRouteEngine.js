/**
 * src/services/pedestrianRouteEngine.js
 * Graph-based route calculation, constraint scoring, and explainability provenance
 * for Accessible Pedestrian Route Barrier Map (#757).
 */

import {
  DEFAULT_ROUTE_PREFERENCES,
  SURFACE_TYPES,
  CURB_RAMP_STATUSES,
  TACTILE_PAVING_STATUSES,
  BARRIER_SEVERITIES,
} from '../data/pedestrianBarrierContract.js';

export const RULESET_VERSION = 'v1.2.0-accessible-dijkstra-multi-constraint';
export const STALE_DATA_THRESHOLD_DAYS = 30;

/**
 * Checks if inspection date is older than STALE_DATA_THRESHOLD_DAYS.
 */
export const isInspectionStale = (isoDateString, relativeNow = new Date()) => {
  if (!isoDateString) return true;
  const inspected = new Date(isoDateString).getTime();
  const now = relativeNow.getTime();
  const diffDays = (now - inspected) / (1000 * 60 * 60 * 24);
  return diffDays > STALE_DATA_THRESHOLD_DAYS;
};

/**
 * Calculates edge weight taking into account surface, slope, curb cuts, barriers, and user constraints.
 */
export const calculateSegmentWeight = (segment, barriersOnSegment, obstructionsOnSegment, preferences) => {
  const prefs = { ...DEFAULT_ROUTE_PREFERENCES, ...(preferences || {}) };
  let multiplier = 1.0;
  const factors = [];

  // 1. Steps / Stairs constraint
  if (segment.hasStairsOrSteps) {
    if (prefs.avoidStairsAndSteps) {
      return {
        cost: Infinity,
        factors: ['Excluded: Contains stairs/steps while "Avoid Stairs & Steps" is enabled.'],
        isBlocked: true,
      };
    }
    multiplier *= 2.5;
    factors.push('Segment contains stairs or vertical steps.');
  }

  // 2. Curb Ramp requirement
  if (segment.curbRampStatus === 'missing') {
    if (prefs.requireCurbRamps) {
      return {
        cost: Infinity,
        factors: ['Excluded: Missing curb ramps while "Require Curb Ramps" is enabled.'],
        isBlocked: true,
      };
    }
    multiplier *= CURB_RAMP_STATUSES.missing.penalty;
    factors.push('Missing curb ramps at intersection thresholds.');
  } else if (segment.curbRampStatus === 'present_steep_or_damaged') {
    multiplier *= CURB_RAMP_STATUSES.present_steep_or_damaged.penalty;
    factors.push('Curb ramp is damaged or steeper than 1:12 standard.');
  }

  // 3. Gradient (Slope %)
  const maxGrad = Number(prefs.maxGradientPct) || 8;
  if (segment.gradientPct > maxGrad) {
    const excess = segment.gradientPct - maxGrad;
    const gradPenalty = 1.0 + excess * 0.4;
    multiplier *= gradPenalty;
    factors.push(`Gradient of ${segment.gradientPct}% exceeds preferred limit (${maxGrad}%).`);
  }

  // 4. Surface type
  const surfaceMeta = SURFACE_TYPES[segment.surfaceType] || { penalty: 1.0 };
  if (prefs.avoidUnpavedSurfaces && (segment.surfaceType === 'unpaved_dirt' || segment.surfaceType === 'broken_slab')) {
    multiplier *= surfaceMeta.penalty * 1.5;
    factors.push(`Unpaved/broken surface (${surfaceMeta.label || segment.surfaceType}) penalized.`);
  } else {
    multiplier *= surfaceMeta.penalty;
  }

  // 5. Tactile paving
  if (prefs.requireTactilePaving) {
    if (segment.tactilePaving === 'absent') {
      multiplier *= TACTILE_PAVING_STATUSES.absent.penalty;
      factors.push('Lacks continuous tactile paving for vision-impaired navigation.');
    } else if (segment.tactilePaving === 'interrupted') {
      multiplier *= TACTILE_PAVING_STATUSES.interrupted.penalty;
      factors.push('Interrupted tactile paving tiles.');
    }
  }

  // 6. Active verified barrier observations
  const verifiedBarriers = (barriersOnSegment || []).filter(
    (b) => b.status === 'verified' || b.status === 'under_review'
  );

  for (const barrier of verifiedBarriers) {
    const sev = BARRIER_SEVERITIES[barrier.severity] || BARRIER_SEVERITIES.moderate_impediment;
    if (barrier.severity === 'impassable') {
      if (prefs.avoidStairsAndSteps || prefs.requireCurbRamps) {
        return {
          cost: Infinity,
          factors: [`Excluded: Impassable barrier reported (${barrier.description}).`],
          isBlocked: true,
        };
      }
      multiplier *= 50.0;
    } else {
      multiplier *= sev.penaltyMultiplier;
    }
    factors.push(`Barrier (${sev.label}): ${barrier.description}`);
  }

  // 7. Active temporary obstructions
  const activeObstructions = (obstructionsOnSegment || []).filter((o) => o.status === 'active');
  for (const obst of activeObstructions) {
    multiplier *= 2.2;
    factors.push(`Temporary roadwork/obstruction: ${obst.description}`);
  }

  const baseCost = segment.lengthMeters || 100;
  return {
    cost: baseCost * multiplier,
    factors,
    isBlocked: false,
  };
};

/**
 * Builds bidirectional adjacency graph from network segments.
 */
export const buildNetworkGraph = (segments, observations = [], temporaryObstructions = []) => {
  const graph = new Map(); // nodeId -> Array<{ toNodeId, segment, weightResult }>

  // Map barriers and obstructions to segmentId
  const barrierMap = new Map();
  for (const b of observations) {
    if (!barrierMap.has(b.segmentId)) barrierMap.set(b.segmentId, []);
    barrierMap.get(b.segmentId).push(b);
  }

  const obstructionMap = new Map();
  for (const o of temporaryObstructions) {
    if (!obstructionMap.has(o.segmentId)) obstructionMap.set(o.segmentId, []);
    obstructionMap.get(o.segmentId).push(o);
  }

  const addEdge = (from, to, segment) => {
    if (!graph.has(from)) graph.set(from, []);
    const bList = barrierMap.get(segment.id) || [];
    const oList = obstructionMap.get(segment.id) || [];
    graph.get(from).push({
      toNodeId: to,
      segment,
      barriers: bList,
      obstructions: oList,
    });
  };

  for (const seg of segments) {
    addEdge(seg.startNodeId, seg.endNodeId, seg);
    addEdge(seg.endNodeId, seg.startNodeId, seg);
  }

  return graph;
};

/**
 * Dijkstra shortest weighted path algorithm with multi-constraint scoring.
 */
export const findShortestAccessiblePath = (
  graph,
  originNodeId,
  destinationNodeId,
  preferences,
  allowRelaxed = false
) => {
  const distances = new Map();
  const previous = new Map(); // nodeId -> { fromNodeId, segment, factors }
  const visited = new Set();
  const pq = [{ nodeId: originNodeId, cost: 0 }];

  distances.set(originNodeId, 0);

  while (pq.length > 0) {
    // Sort to extract minimum cost node
    pq.sort((a, b) => a.cost - b.cost);
    const { nodeId: current, cost: currentCost } = pq.shift();

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === destinationNodeId) break;

    const neighbors = graph.get(current) || [];
    for (const edge of neighbors) {
      if (visited.has(edge.toNodeId)) continue;

      let weightData = calculateSegmentWeight(edge.segment, edge.barriers, edge.obstructions, preferences);

      if (weightData.isBlocked && allowRelaxed) {
        // In relaxed fallback mode, penalize heavily rather than pruning completely
        weightData = {
          cost: (edge.segment.lengthMeters || 100) * 15.0,
          factors: [...weightData.factors, '(Relaxed Fallback: Traversed despite constraints)'],
          isBlocked: false,
        };
      }

      if (weightData.isBlocked || !Number.isFinite(weightData.cost)) continue;

      const newCost = currentCost + weightData.cost;
      const prevCost = distances.get(edge.toNodeId) ?? Infinity;

      if (newCost < prevCost) {
        distances.set(edge.toNodeId, newCost);
        previous.set(edge.toNodeId, {
          fromNodeId: current,
          segment: edge.segment,
          barriers: edge.barriers,
          obstructions: edge.obstructions,
          factors: weightData.factors,
        });
        pq.push({ nodeId: edge.toNodeId, cost: newCost });
      }
    }
  }

  if (!previous.has(destinationNodeId) && originNodeId !== destinationNodeId) {
    return null; // No path found under constraints
  }

  // Reconstruct path
  const segments = [];
  const factorsCollected = [];
  let curr = destinationNodeId;

  while (curr !== originNodeId) {
    const step = previous.get(curr);
    if (!step) break;
    segments.unshift(step.segment);
    if (step.factors && step.factors.length > 0) {
      factorsCollected.push(...step.factors);
    }
    curr = step.fromNodeId;
  }

  return {
    segments,
    factors: Array.from(new Set(factorsCollected)),
  };
};

/**
 * High-level accessible route solver with explainability provenance & verification integrity guard.
 */
export const calculateAccessibleRoute = ({
  nodes = [],
  segments = [],
  crossings = [],
  observations = [],
  temporaryObstructions = [],
  originNodeId,
  destinationNodeId,
  preferences = {},
  now = new Date(),
}) => {
  const executionTimestamp = now.toISOString();

  if (!originNodeId || !destinationNodeId) {
    throw new Error('Both originNodeId and destinationNodeId are required.');
  }

  if (nodes.length > 0) {
    const originExists = nodes.some((n) => n.id === originNodeId);
    const destExists = nodes.some((n) => n.id === destinationNodeId);
    if (!originExists || !destExists) {
      throw new Error(`Specified origin or destination node not found in network.`);
    }
  }

  if (originNodeId === destinationNodeId) {
    return {
      routeId: `ROUTE-${Date.now()}`,
      originNodeId,
      destinationNodeId,
      segments: [],
      totalDistanceMeters: 0,
      accessibleDistanceRatio: 1.0,
      overallAccessibilityRating: 'fully_accessible',
      identifiedBarriers: [],
      scoringProvenance: {
        rulesetVersion: RULESET_VERSION,
        executionTimestamp,
        influencingFactors: ['Origin and destination are the same location.'],
      },
      isDeterministicFallback: false,
    };
  }

  const graph = buildNetworkGraph(segments, observations, temporaryObstructions);

  // 1. Try strict constrained path
  let pathResult = findShortestAccessiblePath(graph, originNodeId, destinationNodeId, preferences, false);
  let isDeterministicFallback = false;

  // 2. If blocked, provide deterministic relaxed fallback with clear warnings
  if (!pathResult) {
    pathResult = findShortestAccessiblePath(graph, originNodeId, destinationNodeId, preferences, true);
    isDeterministicFallback = true;
  }

  if (!pathResult || pathResult.segments.length === 0) {
    return {
      routeId: `ROUTE-NONE-${Date.now()}`,
      originNodeId,
      destinationNodeId,
      segments: [],
      totalDistanceMeters: 0,
      accessibleDistanceRatio: 0,
      overallAccessibilityRating: 'high_impediment',
      identifiedBarriers: [],
      scoringProvenance: {
        rulesetVersion: RULESET_VERSION,
        executionTimestamp,
        influencingFactors: [
          'No navigable path found between specified nodes given the current roadwork and barrier network.',
        ],
      },
      isDeterministicFallback,
    };
  }

  const chosenSegments = pathResult.segments;
  let totalDistanceMeters = 0;
  let accessibleDistanceMeters = 0;
  const identifiedBarriers = [];
  let containsUnverifiedSegment = false;
  let containsStaleSegment = false;
  let containsImpassableObstacle = false;

  for (const seg of chosenSegments) {
    totalDistanceMeters += seg.lengthMeters || 0;

    // Check verification status
    if (seg.verificationStatus !== 'verified') {
      containsUnverifiedSegment = true;
    }

    // Check inspection staleness (> 30 days)
    if (isInspectionStale(seg.lastInspectedAt, now)) {
      containsStaleSegment = true;
    }

    // Barriers on this segment
    const segmentBarriers = observations.filter(
      (b) => b.segmentId === seg.id && (b.status === 'verified' || b.status === 'under_review')
    );
    for (const b of segmentBarriers) {
      identifiedBarriers.push(b);
      if (b.severity === 'impassable') containsImpassableObstacle = true;
    }

    // Check crossing features
    if (crossings && crossings.length > 0) {
      const matchCrossing = crossings.find(
        (c) =>
          (c.fromNodeId === seg.startNodeId && c.toNodeId === seg.endNodeId) ||
          (c.fromNodeId === seg.endNodeId && c.toNodeId === seg.startNodeId)
      );
      if (matchCrossing && preferences.requireAudibleSignals && !matchCrossing.audiblePedestrianSignal) {
        pathResult.factors.push(`Crossing at ${matchCrossing.intersectionName} lacks audible signals.`);
      }
    }

    // Measure accessible portion
    const isSegmentAccessible =
      seg.curbRampStatus === 'present_compliant' &&
      !seg.hasStairsOrSteps &&
      seg.gradientPct <= (preferences.maxGradientPct || 8) &&
      segmentBarriers.every((b) => b.severity !== 'impassable' && b.severity !== 'high_barrier');

    if (isSegmentAccessible) {
      accessibleDistanceMeters += seg.lengthMeters || 0;
    }
  }

  const accessibleRatio =
    totalDistanceMeters > 0 ? Number((accessibleDistanceMeters / totalDistanceMeters).toFixed(2)) : 0;

  // RULE OF VERIFICATION INTEGRITY:
  // "no route may be described as fully accessible unless all required segment data is current and verified."
  let overallAccessibilityRating = 'fully_accessible';
  const provenanceFactors = [...pathResult.factors];

  if (containsImpassableObstacle || isDeterministicFallback) {
    overallAccessibilityRating = 'high_impediment';
    provenanceFactors.push('Route requires traversing high-impediment barriers due to network disconnectivity.');
  } else if (containsUnverifiedSegment || containsStaleSegment || accessibleRatio < 1.0) {
    overallAccessibilityRating = 'partially_accessible';
    if (containsUnverifiedSegment) {
      provenanceFactors.push(
        'Integrity Note: Route contains unverified citizen-reported segments. Official verification pending.'
      );
    }
    if (containsStaleSegment) {
      provenanceFactors.push(
        `Integrity Note: Route traverses corridors with inspection data older than ${STALE_DATA_THRESHOLD_DAYS} days.`
      );
    }
  } else {
    provenanceFactors.push('All segments verified by municipal audit within the last 30 days and meet accessibility criteria.');
  }

  return {
    routeId: `ROUTE-${Date.now()}`,
    originNodeId,
    destinationNodeId,
    segments: chosenSegments,
    totalDistanceMeters,
    accessibleDistanceRatio: accessibleRatio,
    overallAccessibilityRating,
    identifiedBarriers,
    scoringProvenance: {
      rulesetVersion: RULESET_VERSION,
      executionTimestamp,
      influencingFactors: Array.from(new Set(provenanceFactors)),
    },
    isDeterministicFallback,
  };
};
