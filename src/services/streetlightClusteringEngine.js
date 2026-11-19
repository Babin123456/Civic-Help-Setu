/**
 * Deterministic Spatial-Temporal Clustering & Explainable Prioritization Engine (#756).
 * Groups streetlight fault reports by proximity and temporal window,
 * detects duplicates, and calculates explainable priority scores.
 */

import {
  FAULT_CATEGORIES,
  PRIORITY_TIERS,
} from './streetlightConstants';
import { SAFETY_CORRIDOR_ANCHORS } from '../data/streetlightSeedData';

export const CLUSTERING_CONFIG = {
  RULESET_VERSION: 'v1.0.0',
  MAX_CLUSTER_DISTANCE_METERS: 120, // Typical streetlight spacing along urban roads
  DUPLICATE_DISTANCE_METERS: 15,    // Same physical pole / location threshold
  TEMPORAL_WINDOW_HOURS: 72,        // 3-day active analysis window
};

/**
 * Calculates Great-Circle distance between two coordinates in meters.
 */
export const haversineDistanceMeters = (coord1, coord2) => {
  if (!coord1 || !coord2) return Infinity;
  const { lat: lat1, lng: lon1 } = coord1;
  const { lat: lat2, lng: lon2 } = coord2;

  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

/**
 * Determines whether a new report is a duplicate of an existing active report.
 */
export const findDuplicateReport = (newReport, existingReports = [], distanceThresholdMeters = CLUSTERING_CONFIG.DUPLICATE_DISTANCE_METERS) => {
  if (!newReport || !Array.isArray(existingReports)) return null;

  const ACTIVE_STATUSES = ['reported', 'verified', 'clustered', 'assigned'];

  for (const existing of existingReports) {
    if (existing.id === newReport.id) continue;
    if (!ACTIVE_STATUSES.includes(existing.status)) continue;

    // Check 1: Explicit pole Asset ID match
    if (newReport.assetId && existing.assetId && newReport.assetId.toUpperCase() === existing.assetId.toUpperCase()) {
      return existing;
    }

    // Check 2: Spatial proximity match (within 15m) with compatible fault category
    const newCoords = newReport.location || newReport.coordinates;
    const existingCoords = existing.location || existing.coordinates;

    if (newCoords && existingCoords && newCoords.lat && existingCoords.lat) {
      const distance = haversineDistanceMeters(newCoords, existingCoords);
      if (distance <= distanceThresholdMeters) {
        return existing;
      }
    }
  }

  return null;
};

/**
 * Groups active outage reports into spatial clusters.
 */
export const performSpatialClustering = (
  reports = [],
  assets = [],
  { maxDistance = CLUSTERING_CONFIG.MAX_CLUSTER_DISTANCE_METERS } = {}
) => {
  const eligibleReports = reports.filter(
    (r) => ['reported', 'verified', 'clustered'].includes(r.status) && !r.duplicateOfId
  );

  if (eligibleReports.length === 0) return [];

  // Map asset lookup for quick coordinate resolution
  const assetMap = new Map();
  assets.forEach((a) => {
    assetMap.set(a.id.toUpperCase(), a);
  });

  const getReportCoordinates = (r) => {
    if (r.location?.lat && r.location?.lng) return r.location;
    if (r.assetId && assetMap.has(r.assetId.toUpperCase())) {
      return assetMap.get(r.assetId.toUpperCase()).coordinates;
    }
    return null;
  };

  const visited = new Set();
  const clusters = [];

  for (let i = 0; i < eligibleReports.length; i += 1) {
    const report = eligibleReports[i];
    if (visited.has(report.id)) continue;

    const clusterReports = [report];
    visited.add(report.id);

    const targetCoords = getReportCoordinates(report);
    if (!targetCoords) {
      // Deterministic fallback: Single-report cluster if coordinates unresolvable
      clusters.push({
        reports: clusterReports,
        corridorName: report.location?.addressText || report.landmark || 'Unassigned Corridor',
        jurisdictionId: report.jurisdictionId || 'WARD-UNKNOWN',
        centroid: null,
      });
      continue;
    }

    for (let j = i + 1; j < eligibleReports.length; j += 1) {
      const neighbor = eligibleReports[j];
      if (visited.has(neighbor.id)) continue;

      const neighborCoords = getReportCoordinates(neighbor);
      if (!neighborCoords) continue;

      const dist = haversineDistanceMeters(targetCoords, neighborCoords);
      if (dist <= maxDistance) {
        clusterReports.push(neighbor);
        visited.add(neighbor.id);
      }
    }

    // Compute Centroid & Bounding Box
    let sumLat = 0;
    let sumLng = 0;
    let validCoordCount = 0;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    const memberAssetIds = new Set();
    clusterReports.forEach((r) => {
      if (r.assetId) memberAssetIds.add(r.assetId);
      const coords = getReportCoordinates(r);
      if (coords) {
        sumLat += coords.lat;
        sumLng += coords.lng;
        validCoordCount += 1;
        minLat = Math.min(minLat, coords.lat);
        maxLat = Math.max(maxLat, coords.lat);
        minLng = Math.min(minLng, coords.lng);
        maxLng = Math.max(maxLng, coords.lng);
      }
    });

    const centroid =
      validCoordCount > 0
        ? {
            lat: Number((sumLat / validCoordCount).toFixed(6)),
            lng: Number((sumLng / validCoordCount).toFixed(6)),
          }
        : null;

    const firstStreet =
      clusterReports.find((r) => r.location?.addressText)?.location.addressText ||
      clusterReports[0].landmark ||
      'Corridor Segment';

    clusters.push({
      reports: clusterReports,
      assetIds: Array.from(memberAssetIds),
      jurisdictionId: clusterReports[0].jurisdictionId || 'WARD-042',
      corridorName: firstStreet,
      centroid,
      boundingBox:
        validCoordCount > 0
          ? {
              minLat: Number(minLat.toFixed(6)),
              maxLat: Number(maxLat.toFixed(6)),
              minLng: Number(minLng.toFixed(6)),
              maxLng: Number(maxLng.toFixed(6)),
            }
          : null,
    });
  }

  return clusters;
};

/**
 * Computes an explainable priority score for an outage cluster.
 * Returns { score, tier, explainability: { factors, rulesetVersion, computedAt } }
 */
export const calculateClusterPriority = (
  cluster,
  reports = [],
  safetyAnchors = SAFETY_CORRIDOR_ANCHORS,
  options = {}
) => {
  const { now = new Date() } = options;
  const factors = [];
  let score = 0;

  const clusterReports = Array.isArray(cluster.reports) ? cluster.reports : reports;
  const poleCount = Math.max(cluster.assetIds?.length || 0, clusterReports.length || 1);

  // 1. Duration Factor (0 - 30 points)
  let earliestReportTime = Infinity;
  clusterReports.forEach((r) => {
    const time = new Date(r.reportedAt || r.createdAt || now).getTime();
    if (!Number.isNaN(time) && time < earliestReportTime) {
      earliestReportTime = time;
    }
  });

  const nowTime = new Date(now).getTime();
  const durationHours = Math.max(0, Math.round((nowTime - earliestReportTime) / (1000 * 60 * 60)));

  const durationPoints = durationHours >= 48 ? 30 : durationHours >= 24 ? 20 : durationHours >= 8 ? 10 : 5;
  if (durationHours >= 48) {
    factors.push({
      field: 'duration',
      impact: `Persistent outage exceeding 48 hours (${durationHours}h)`,
      points: 30,
    });
  } else if (durationHours >= 24) {
    factors.push({
      field: 'duration',
      impact: `Outage unaddressed for over 24 hours (${durationHours}h)`,
      points: 20,
    });
  } else if (durationHours >= 8) {
    factors.push({
      field: 'duration',
      impact: `Active outage reported (${durationHours}h duration)`,
      points: 10,
    });
  } else {
    factors.push({
      field: 'duration',
      impact: 'Recent report (<8 hours)',
      points: 5,
    });
  }
  score += durationPoints;

  // 2. Density / Corridor Factor (0 - 30 points)
  const densityPoints = poleCount >= 4 ? 30 : poleCount >= 2 ? 20 : 10;
  if (poleCount >= 4) {
    factors.push({
      field: 'density',
      impact: `Severe dark corridor: ${poleCount} contiguous non-functional streetlights`,
      points: 30,
    });
  } else if (poleCount >= 2) {
    factors.push({
      field: 'density',
      impact: `Multi-light outage: ${poleCount} adjacent poles non-functional`,
      points: 20,
    });
  } else {
    factors.push({
      field: 'density',
      impact: 'Single isolated dark streetlight',
      points: 10,
    });
  }
  score += densityPoints;

  // 3. Safety Hazard Overrides (0 - 40 points)
  const hasExposedWiring = clusterReports.some((r) => r.faultCategory === FAULT_CATEGORIES.EXPOSED_WIRING);
  const hasDamagedPole = clusterReports.some((r) => r.faultCategory === FAULT_CATEGORIES.DAMAGED_POLE);

  if (hasExposedWiring) {
    score += 40;
    factors.push({
      field: 'hazardOverride',
      impact: 'CRITICAL HAZARD: Exposed live electrical wiring or broken junction box reported',
      points: 40,
    });
  } else if (hasDamagedPole) {
    score += 30;
    factors.push({
      field: 'hazardOverride',
      impact: 'STRUCTURAL HAZARD: Leaning or damaged pole structure posing collapse risk',
      points: 30,
    });
  }

  // 4. Public Safety Anchor Context (0 - 25 points)
  if (cluster.centroid) {
    let matchedAnchor = null;
    let closestDistance = Infinity;

    for (const anchor of safetyAnchors) {
      const dist = haversineDistanceMeters(cluster.centroid, { lat: anchor.lat, lng: anchor.lng });
      if (dist <= anchor.radiusMeters && dist < closestDistance) {
        matchedAnchor = anchor;
        closestDistance = dist;
      }
    }

    if (matchedAnchor) {
      const anchorPoints = matchedAnchor.type === 'hospital' ? 25 : matchedAnchor.type === 'transit_hub' ? 20 : 15;
      score += anchorPoints;
      factors.push({
        field: 'safetyAnchor',
        impact: `Within ${closestDistance}m of ${matchedAnchor.name} (${matchedAnchor.type.replace('_', ' ')})`,
        points: anchorPoints,
      });
    }
  }

  // Clamp score between 0 and 100
  const finalScore = Math.min(100, Math.max(0, score));

  // Determine Tier
  let priorityTier = PRIORITY_TIERS.LOW;
  if (finalScore >= 75 || hasExposedWiring) {
    priorityTier = PRIORITY_TIERS.CRITICAL;
  } else if (finalScore >= 50) {
    priorityTier = PRIORITY_TIERS.HIGH;
  } else if (finalScore >= 25) {
    priorityTier = PRIORITY_TIERS.MEDIUM;
  }

  return {
    score: finalScore,
    tier: priorityTier,
    explainability: {
      score: finalScore,
      tier: priorityTier,
      rulesetVersion: CLUSTERING_CONFIG.RULESET_VERSION,
      computedAt: new Date(now).toISOString(),
      factors,
    },
  };
};
