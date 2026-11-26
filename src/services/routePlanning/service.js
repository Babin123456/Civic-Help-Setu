/**
 * Municipal Waste Collection Route and Segregation Audit Service Layer
 *
 * End-to-end service layer for the AI-Assisted Municipal Waste Collection Route
 * and Segregation Audit Planner feature (#755).
 *
 * Provides typed service methods for all domain entities, offline-first persistence
 * via localStorage, validated writes, deterministic AI route optimization,
 * explainable recommendations, role-based access control, and privacy protections.
 */

import {
  CollectionRoute,
  CollectionRouteStatus,
  PickupPoint,
  PickupPointStatus,
  Vehicle,
  VehicleStatus,
  RouteRun,
  RouteRunStatus,
  SegregationAudit,
  SegregationAuditRating,
  RouteRecommendation,
  RouteRecommendationStatus,
  RouteRecommendationPriority,
  MissedPickup,
  isCollectionRoute,
  isPickupPoint,
  isVehicle,
  isRouteRun,
  isSegregationAudit,
  isRouteRecommendation,
  isMissedPickup,
} from '../../data/routePlanning/models.js';

import {
  STORAGE_KEY,
  SCHEMA_VERSIONS,
  CURRENT_SCHEMA_VERSION,
  generateUUID,
  migrateRecords,
  runMigrations,
} from './migrations.js';

import { sha256Hex, canonicalStringify } from '../privacyIntegrityService.js';

export { STORAGE_KEY, SCHEMA_VERSIONS, CURRENT_SCHEMA_VERSION, runMigrations };

// Current signed-in actor (defaults to null)
let currentActor = null;

export function setCurrentActor(actor) {
  currentActor = actor && typeof actor === 'object' ? actor : null;
}

export function getCurrentActor() {
  return currentActor;
}

/**
 * Infer role: supports admin, supervisor, auditor, or citizen (default).
 */
export function roleOf(actor) {
  if (!actor || typeof actor !== 'object') return 'citizen';
  const role = String(actor.role || '').toLowerCase();
  if (['admin', 'supervisor', 'auditor'].includes(role)) {
    return role;
  }
  return 'citizen';
}

export const PERMISSIONS = {
  'routePlanning.routes.read': { roles: ['admin', 'supervisor', 'auditor', 'citizen'] },
  'routePlanning.routes.create': { roles: ['admin', 'supervisor'] },
  'routePlanning.routes.update': { roles: ['admin', 'supervisor'] },
  'routePlanning.routes.delete': { roles: ['admin'] },
  'routePlanning.pickup-points.read': { roles: ['admin', 'supervisor', 'auditor', 'citizen'] },
  'routePlanning.pickup-points.create': { roles: ['admin', 'supervisor'] },
  'routePlanning.pickup-points.update': { roles: ['admin', 'supervisor'] },
  'routePlanning.vehicles.read': { roles: ['admin', 'supervisor', 'auditor', 'citizen'] },
  'routePlanning.vehicles.create': { roles: ['admin', 'supervisor'] },
  'routePlanning.vehicles.update': { roles: ['admin', 'supervisor'] },
  'routePlanning.audits.read': { roles: ['admin', 'supervisor', 'auditor', 'citizen'] },
  'routePlanning.audits.create': { roles: ['admin', 'supervisor', 'auditor'] },
  'routePlanning.recommendations.read': { roles: ['admin', 'supervisor', 'auditor', 'citizen'] },
  'routePlanning.recommendations.create': { roles: ['admin', 'supervisor'] },
  'routePlanning.recommendations.accept': { roles: ['admin', 'supervisor'] },
  'routePlanning.runs.read': { roles: ['admin', 'supervisor', 'auditor', 'citizen'] },
  'routePlanning.runs.create': { roles: ['admin', 'supervisor'] },
  'routePlanning.missed-pickups.read': { roles: ['admin', 'supervisor', 'auditor', 'citizen'] },
  'routePlanning.missed-pickups.create': { roles: ['admin', 'supervisor'] },
};

export class PermissionDeniedError extends Error {
  constructor(action, reason) {
    super(`Not allowed: ${action} (${reason})`);
    this.name = 'PermissionDeniedError';
    this.code = 'FORBIDDEN';
    this.action = action;
    this.reason = reason;
  }
}

export function checkPermission(action, actor = currentActor) {
  if (!Object.prototype.hasOwnProperty.call(PERMISSIONS, action)) {
    return 'unknown-action';
  }
  if (!actor || typeof actor !== 'object') {
    // If the action is permitted for citizens (e.g. read), unauthenticated public may view
    if (PERMISSIONS[action].roles.includes('citizen')) {
      return 'ok';
    }
    return 'unauthenticated';
  }
  const role = roleOf(actor);
  return PERMISSIONS[action].roles.includes(role) ? 'ok' : 'forbidden';
}

export function requirePermission(action, actor = currentActor) {
  const result = checkPermission(action, actor);
  if (result !== 'ok') {
    throw new PermissionDeniedError(action, result);
  }
}

/**
 * Storage helpers
 */
function getStorageInstance(storageEngine) {
  if (storageEngine && typeof storageEngine.getItem === 'function') {
    return storageEngine;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function loadRecords(storageEngine) {
  const store = getStorageInstance(storageEngine);
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(storageEngine, records) {
  const store = getStorageInstance(storageEngine);
  if (!store) {
    throw new Error('Local storage is unavailable in this environment.');
  }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (e) {
    throw new Error(`Failed to save records: ${e.message}`, { cause: e });
  }
}

/**
 * PII Sanitizer: strips potential door numbers, 10-digit mobile phones, and Aadhaar numbers.
 */
export function sanitizeUserInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/\b[6-9]\d{9}\b/g, '[REDACTED_PHONE]') // 10-digit Indian phone
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[REDACTED_AADHAAR]') // Aadhaar
    .replace(/\b(?:flat|door|house|apt|room)\s*#?\s*\d+[a-z]?\b/gi, '[REDACTED_DOOR]') // Specific household door
    .trim();
}

/**
 * Generate cryptographic seal for an audit record.
 */
export async function generateRouteAuditSeal(auditRecord) {
  const payload = {
    pickupPointId: auditRecord.pickupPointId,
    ward: auditRecord.ward,
    compliancePercentage: auditRecord.compliancePercentage,
    rating: auditRecord.rating,
    auditDate: auditRecord.auditDate,
  };
  const hash = await sha256Hex(canonicalStringify(payload));
  return `SEAL-WRA-${hash.slice(0, 4).toUpperCase()}-${hash.slice(4, 8).toUpperCase()}`;
}

/**
 * Ensure record has valid metadata.
 */
function ensureMetadata(record, createdBy = currentActor) {
  const now = new Date().toISOString();
  return {
    ...record,
    id: record.id || `rp-${generateUUID().slice(0, 8)}`,
    createdAt: record.createdAt || now,
    updatedAt: now,
    createdBy: record.createdBy || (createdBy && (createdBy.username || createdBy.email)) || 'system',
    schemaVersion: record.schemaVersion || CURRENT_SCHEMA_VERSION,
  };
}

/**
 * Transaction runner: atomic batch operations with automatic rollback.
 */
export async function transaction(operations, storageEngine) {
  const store = getStorageInstance(storageEngine);
  if (!store) {
    throw new Error('Local storage is unavailable.');
  }
  const previous = loadRecords(store);
  try {
    const updated = await operations(previous, store);
    saveRecords(store, updated);
    return updated;
  } catch (err) {
    saveRecords(store, previous); // rollback
    throw err;
  }
}

/**
 * Data retention purger: cleans up completed route runs older than retentionDays.
 */
export function purgeExpiredRecords(retentionDays = 180, storageEngine) {
  const records = loadRecords(storageEngine);
  const cutoff = Date.now() - retentionDays * 86400000;

  const retained = records.filter((r) => {
    if (isRouteRun(r) && r.status === RouteRunStatus.COMPLETED) {
      const runTime = new Date(r.endTime || r.createdAt).getTime();
      return runTime >= cutoff;
    }
    return true;
  });

  saveRecords(storageEngine, retained);
  return records.length - retained.length;
}

// ==========================================
// CollectionRoute Operations
// ==========================================

export function listCollectionRoutes(filters = {}, storageEngine) {
  requirePermission('routePlanning.routes.read');
  const records = loadRecords(storageEngine);
  let routes = records.filter(isCollectionRoute);

  if (filters.jurisdiction) {
    routes = routes.filter((r) => r.jurisdiction === filters.jurisdiction);
  }
  if (filters.ward) {
    routes = routes.filter((r) => r.ward === filters.ward);
  }
  if (filters.status) {
    routes = routes.filter((r) => r.status === filters.status);
  }

  return routes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getCollectionRoute(id, storageEngine) {
  requirePermission('routePlanning.routes.read');
  const records = loadRecords(storageEngine);
  return records.find((r) => isCollectionRoute(r) && r.id === id) || null;
}

export function createCollectionRoute(routeData, storageEngine) {
  requirePermission('routePlanning.routes.create');

  if (!routeData.name || !routeData.ward) {
    throw new Error('Route name and ward are required.');
  }

  const route = new CollectionRoute({
    ...routeData,
    name: sanitizeUserInput(routeData.name),
    description: sanitizeUserInput(routeData.description || ''),
  });

  const enriched = ensureMetadata(route, currentActor);
  const records = loadRecords(storageEngine);
  saveRecords(storageEngine, [enriched, ...records]);
  return enriched;
}

export function updateCollectionRoute(id, updateData, storageEngine) {
  requirePermission('routePlanning.routes.update');

  const records = loadRecords(storageEngine);
  const index = records.findIndex((r) => isCollectionRoute(r) && r.id === id);
  if (index === -1) {
    throw new Error(`Route not found: ${id}`);
  }

  const existing = records[index];
  const updated = {
    ...existing,
    ...updateData,
    name: updateData.name ? sanitizeUserInput(updateData.name) : existing.name,
    description: updateData.description !== undefined ? sanitizeUserInput(updateData.description) : existing.description,
    updatedAt: new Date().toISOString(),
  };

  records[index] = updated;
  saveRecords(storageEngine, records);
  return updated;
}

export function deleteCollectionRoute(id, storageEngine) {
  requirePermission('routePlanning.routes.delete');

  const records = loadRecords(storageEngine);
  const filtered = records.filter((r) => !(isCollectionRoute(r) && r.id === id));
  if (filtered.length === records.length) {
    throw new Error(`Route not found: ${id}`);
  }
  saveRecords(storageEngine, filtered);
  return true;
}

// ==========================================
// PickupPoint Operations
// ==========================================

export function listPickupPoints(filters = {}, storageEngine) {
  requirePermission('routePlanning.pickup-points.read');
  const records = loadRecords(storageEngine);
  let points = records.filter(isPickupPoint);

  if (filters.ward) {
    points = points.filter((p) => p.ward === filters.ward);
  }
  if (filters.status) {
    points = points.filter((p) => p.status === filters.status);
  }
  if (filters.collectionType) {
    points = points.filter((p) => p.collectionType === filters.collectionType);
  }

  return points;
}

export function getPickupPoint(id, storageEngine) {
  requirePermission('routePlanning.pickup-points.read');
  const records = loadRecords(storageEngine);
  return records.find((r) => isPickupPoint(r) && r.id === id) || null;
}

export function createPickupPoint(pointData, storageEngine) {
  requirePermission('routePlanning.pickup-points.create');

  if (!pointData.address || !pointData.ward) {
    throw new Error('Address and ward are required for pickup points.');
  }

  const point = new PickupPoint({
    ...pointData,
    address: sanitizeUserInput(pointData.address),
    notes: sanitizeUserInput(pointData.notes || ''),
  });

  const enriched = ensureMetadata(point, currentActor);
  const records = loadRecords(storageEngine);
  saveRecords(storageEngine, [enriched, ...records]);
  return enriched;
}

export function updatePickupPoint(id, updateData, storageEngine) {
  requirePermission('routePlanning.pickup-points.update');

  const records = loadRecords(storageEngine);
  const index = records.findIndex((r) => isPickupPoint(r) && r.id === id);
  if (index === -1) {
    throw new Error(`Pickup point not found: ${id}`);
  }

  const existing = records[index];
  const updated = {
    ...existing,
    ...updateData,
    address: updateData.address ? sanitizeUserInput(updateData.address) : existing.address,
    notes: updateData.notes !== undefined ? sanitizeUserInput(updateData.notes) : existing.notes,
    updatedAt: new Date().toISOString(),
  };

  records[index] = updated;
  saveRecords(storageEngine, records);
  return updated;
}

// ==========================================
// Vehicle Operations
// ==========================================

export function listVehicles(filters = {}, storageEngine) {
  requirePermission('routePlanning.vehicles.read');
  const records = loadRecords(storageEngine);
  let vehicles = records.filter(isVehicle);

  if (filters.status) {
    vehicles = vehicles.filter((v) => v.status === filters.status);
  }
  if (filters.type) {
    vehicles = vehicles.filter((v) => v.type === filters.type);
  }

  return vehicles;
}

export function getVehicle(id, storageEngine) {
  requirePermission('routePlanning.vehicles.read');
  const records = loadRecords(storageEngine);
  return records.find((r) => isVehicle(r) && r.id === id) || null;
}

export function createVehicle(vehicleData, storageEngine) {
  requirePermission('routePlanning.vehicles.create');

  if (!vehicleData.registrationNumber) {
    throw new Error('Registration number is required.');
  }

  const vehicle = new Vehicle(vehicleData);
  const enriched = ensureMetadata(vehicle, currentActor);
  const records = loadRecords(storageEngine);
  saveRecords(storageEngine, [enriched, ...records]);
  return enriched;
}

export function updateVehicle(id, updateData, storageEngine) {
  requirePermission('routePlanning.vehicles.update');

  const records = loadRecords(storageEngine);
  const index = records.findIndex((r) => isVehicle(r) && r.id === id);
  if (index === -1) {
    throw new Error(`Vehicle not found: ${id}`);
  }

  const existing = records[index];
  const updated = {
    ...existing,
    ...updateData,
    updatedAt: new Date().toISOString(),
  };

  records[index] = updated;
  saveRecords(storageEngine, records);
  return updated;
}

// ==========================================
// RouteRun Operations
// ==========================================

export function listRouteRuns(filters = {}, storageEngine) {
  requirePermission('routePlanning.runs.read');
  const records = loadRecords(storageEngine);
  let runs = records.filter(isRouteRun);

  if (filters.routeId) {
    runs = runs.filter((r) => r.routeId === filters.routeId);
  }
  if (filters.status) {
    runs = runs.filter((r) => r.status === filters.status);
  }

  return runs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function createRouteRun(runData, storageEngine) {
  requirePermission('routePlanning.runs.create');

  if (!runData.routeId) {
    throw new Error('routeId is required for RouteRun.');
  }

  const run = new RouteRun(runData);
  const enriched = ensureMetadata(run, currentActor);
  const records = loadRecords(storageEngine);
  saveRecords(storageEngine, [enriched, ...records]);
  return enriched;
}

// ==========================================
// SegregationAudit Operations
// ==========================================

export function listSegregationAudits(filters = {}, storageEngine) {
  requirePermission('routePlanning.audits.read');
  const records = loadRecords(storageEngine);
  let audits = records.filter(isSegregationAudit);

  if (filters.ward) {
    audits = audits.filter((a) => a.ward === filters.ward);
  }
  if (filters.pickupPointId) {
    audits = audits.filter((a) => a.pickupPointId === filters.pickupPointId);
  }

  return audits.sort((a, b) => new Date(b.auditDate) - new Date(a.auditDate));
}

export async function createSegregationAudit(auditData, storageEngine) {
  requirePermission('routePlanning.audits.create');

  if (!auditData.pickupPointId || !auditData.ward) {
    throw new Error('pickupPointId and ward are required.');
  }

  const audit = new SegregationAudit({
    ...auditData,
    issuesNoted: sanitizeUserInput(auditData.issuesNoted || ''),
    notes: sanitizeUserInput(auditData.notes || ''),
  });

  audit.integritySeal = await generateRouteAuditSeal(audit);
  const enriched = ensureMetadata(audit, currentActor);
  const records = loadRecords(storageEngine);
  saveRecords(storageEngine, [enriched, ...records]);
  return enriched;
}

// ==========================================
// MissedPickup Operations
// ==========================================

export function listMissedPickups(filters = {}, storageEngine) {
  requirePermission('routePlanning.missed-pickups.read');
  const records = loadRecords(storageEngine);
  let missed = records.filter(isMissedPickup);

  if (filters.routeRunId) {
    missed = missed.filter((m) => m.routeRunId === filters.routeRunId);
  }
  if (filters.pickupPointId) {
    missed = missed.filter((m) => m.pickupPointId === filters.pickupPointId);
  }

  return missed;
}

export function recordMissedPickup(missedData, storageEngine) {
  requirePermission('routePlanning.missed-pickups.create');

  const missed = new MissedPickup({
    ...missedData,
    resolutionNotes: sanitizeUserInput(missedData.resolutionNotes || ''),
  });

  const enriched = ensureMetadata(missed, currentActor);
  const records = loadRecords(storageEngine);
  saveRecords(storageEngine, [enriched, ...records]);
  return enriched;
}

// ==========================================
// AI / Deterministic Optimization Engine
// ==========================================

/**
 * Generate explainable, deterministic route & segregation recommendations (#755).
 * Evaluates vehicle capacity, observed segregation quality, and missed pickups.
 */
export function generateDeterministicRecommendations(routeId, storageEngine) {
  const records = loadRecords(storageEngine);
  const route = records.find((r) => isCollectionRoute(r) && r.id === routeId);
  if (!route) {
    throw new Error(`Route not found for recommendation generation: ${routeId}`);
  }

  const allPoints = records.filter(isPickupPoint);
  const assignedPoints = allPoints.filter((p) => (route.pickupPointIds || []).includes(p.id));
  const vehicles = records.filter(isVehicle);
  const assignedVehicles = vehicles.filter((v) => (route.vehicleIds || []).includes(v.id));
  const audits = records.filter(isSegregationAudit).filter((a) => (route.pickupPointIds || []).includes(a.pickupPointId));
  const missed = records.filter(isMissedPickup).filter((m) => (route.pickupPointIds || []).includes(m.pickupPointId) && !m.resolvedAt);

  const recommendations = [];
  const modelVersion = 'ruleset-v1.0.0-deterministic';
  const now = new Date().toISOString();

  // 1. Capacity Overload Evaluation
  const totalAssignedCapacityKg = assignedVehicles.reduce((sum, v) => sum + (v.capacityKg || 0), 0);
  const totalEstimatedWasteKg = assignedPoints.reduce((sum, p) => sum + (p.estimatedWasteKg || 45), 0);

  if (totalAssignedCapacityKg > 0 && totalEstimatedWasteKg > totalAssignedCapacityKg * 0.85) {
    const overflowRisk = totalEstimatedWasteKg > totalAssignedCapacityKg;
    recommendations.push(
      new RouteRecommendation({
        id: `rec-cap-${generateUUID().slice(0, 8)}`,
        routeId: route.id,
        type: 'CAPACITY',
        priority: overflowRisk ? RouteRecommendationPriority.CRITICAL : RouteRecommendationPriority.HIGH,
        title: overflowRisk ? 'Vehicle Capacity Exceeded' : 'Vehicle Load Approaching Critical Threshold',
        explanation: `Total estimated collection demand (${totalEstimatedWasteKg} kg) represents ${Math.round(
          (totalEstimatedWasteKg / totalAssignedCapacityKg) * 100
        )}% of assigned vehicle capacity (${totalAssignedCapacityKg} kg). Dispatch an additional vehicle or split pickup schedule.`,
        sourceFields: {
          totalEstimatedWasteKg,
          totalAssignedCapacityKg,
          pointCount: assignedPoints.length,
          assignedVehicleCount: assignedVehicles.length,
        },
        suggestedData: {
          recommendedVehicleCount: Math.ceil(totalEstimatedWasteKg / 450),
          action: 'SPLIT_ROUTE',
        },
        modelVersion,
        executedAt: now,
      })
    );
  }

  // 2. Segregation Compliance Deficit Evaluation
  if (audits.length > 0) {
    const avgCompliance = Math.round(audits.reduce((acc, a) => acc + (a.compliancePercentage || 0), 0) / audits.length);
    if (avgCompliance < 65) {
      recommendations.push(
        new RouteRecommendation({
          id: `rec-seg-${generateUUID().slice(0, 8)}`,
          routeId: route.id,
          type: 'SEGREGATION',
          priority: avgCompliance < 45 ? RouteRecommendationPriority.HIGH : RouteRecommendationPriority.MEDIUM,
          title: `Low Segregation Compliance Observed in ${route.ward}`,
          explanation: `Sampled audits in this ward show an average segregation compliance score of ${avgCompliance}%. Mixed wet/hazardous waste detected. Suggest deploying dual-bin tippers and scheduling community awareness before morning round.`,
          sourceFields: {
            averageCompliancePercentage: avgCompliance,
            sampledAuditCount: audits.length,
            ward: route.ward,
          },
          suggestedData: {
            requireDualCompartment: true,
            recommendedInspectionFrequency: 'daily',
          },
          modelVersion,
          executedAt: now,
        })
      );
    }
  }

  // 3. Unresolved Missed Pickups Triage
  if (missed.length > 0) {
    recommendations.push(
      new RouteRecommendation({
        id: `rec-miss-${generateUUID().slice(0, 8)}`,
        routeId: route.id,
        type: 'MISSED_PICKUP',
        priority: RouteRecommendationPriority.HIGH,
        title: `Recover ${missed.length} Missed Pickups on Next Run`,
        explanation: `${missed.length} unserviced points were recorded from recent runs. Prioritize these points at the start of the morning schedule (06:30 - 07:15) to maintain municipal service level agreements.`,
        sourceFields: {
          unresolvedMissedCount: missed.length,
          pointIds: missed.map((m) => m.pickupPointId),
        },
        suggestedData: {
          priorityPointIds: missed.map((m) => m.pickupPointId),
          adjustStartTime: '06:15',
        },
        modelVersion,
        executedAt: now,
      })
    );
  }

  // Persist newly generated recommendations
  if (recommendations.length > 0) {
    saveRecords(storageEngine, [...recommendations, ...records]);
  }

  return recommendations;
}

export function listRouteRecommendations(filters = {}, storageEngine) {
  requirePermission('routePlanning.recommendations.read');
  const records = loadRecords(storageEngine);
  let recs = records.filter(isRouteRecommendation);

  if (filters.routeId) {
    recs = recs.filter((r) => r.routeId === filters.routeId);
  }
  if (filters.type) {
    recs = recs.filter((r) => r.type === filters.type);
  }
  if (filters.status) {
    recs = recs.filter((r) => r.status === filters.status);
  }

  return recs.sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));
}

export function acceptRouteRecommendation(recId, options = {}, storageEngine) {
  requirePermission('routePlanning.recommendations.accept');

  const records = loadRecords(storageEngine);
  const index = records.findIndex((r) => isRouteRecommendation(r) && r.id === recId);
  if (index === -1) {
    throw new Error(`Recommendation not found: ${recId}`);
  }

  const existing = records[index];
  const action = options.action || 'accept';
  let updated;

  if (action === 'accept') {
    updated = {
      ...existing,
      status: RouteRecommendationStatus.ACCEPTED,
      acceptedBy: currentActor ? currentActor.username || currentActor.email || 'supervisor' : 'supervisor',
      acceptedAt: new Date().toISOString(),
      rejectionReason: null,
    };
  } else if (action === 'edit') {
    if (!options.editedData) {
      throw new Error('editedData is required for edit action.');
    }
    updated = {
      ...existing,
      status: RouteRecommendationStatus.EDITED,
      suggestedData: {
        ...existing.suggestedData,
        ...options.editedData,
      },
      acceptedBy: currentActor ? currentActor.username || currentActor.email || 'supervisor' : 'supervisor',
      acceptedAt: new Date().toISOString(),
    };
  } else if (action === 'reject') {
    if (!options.rejectionReason) {
      throw new Error('rejectionReason is mandatory when rejecting a recommendation.');
    }
    updated = {
      ...existing,
      status: RouteRecommendationStatus.REJECTED,
      rejectionReason: sanitizeUserInput(options.rejectionReason),
      acceptedBy: currentActor ? currentActor.username || currentActor.email || 'supervisor' : 'supervisor',
      acceptedAt: new Date().toISOString(),
    };
  } else {
    throw new Error(`Invalid recommendation action: ${action}`);
  }

  records[index] = updated;
  saveRecords(storageEngine, records);
  return updated;
}

// ==========================================
// Public Aggregate View (Privacy Safeguard)
// ==========================================

export function getPublicRouteSummary(routeId, storageEngine) {
  const records = loadRecords(storageEngine);
  const route = records.find((r) => isCollectionRoute(r) && r.id === routeId);
  if (!route) return null;

  const points = records.filter(isPickupPoint).filter((p) => (route.pickupPointIds || []).includes(p.id));
  const servicedCount = points.filter((p) => p.status === PickupPointStatus.SERVICED).length;
  const audits = records.filter(isSegregationAudit).filter((a) => (route.pickupPointIds || []).includes(a.pickupPointId));
  const avgCompliance = audits.length > 0 ? Math.round(audits.reduce((acc, a) => acc + (a.compliancePercentage || 0), 0) / audits.length) : null;

  // Return strictly approved aggregate fields; no driver names, personal IDs, or household details
  return {
    routeId: route.id,
    name: route.name,
    ward: route.ward,
    status: route.status,
    totalPickupPoints: points.length,
    servicedPercentage: points.length > 0 ? Math.round((servicedCount / points.length) * 100) : 0,
    scheduledStartTime: route.scheduledStartTime,
    scheduledEndTime: route.scheduledEndTime,
    averageWardSegregationScore: avgCompliance,
    lastUpdated: route.updatedAt || route.createdAt,
  };
}

// ==========================================
// Seed Demo Data for Fresh Workspaces
// ==========================================

export function initializeStorage(storageEngine) {
  const store = getStorageInstance(storageEngine);
  if (!store) return;

  const raw = store.getItem(STORAGE_KEY);
  if (raw && raw !== '[]') return; // already initialized

  const sampleRoutes = [
    new CollectionRoute({
      id: 'route-blr-w150-alpha',
      name: 'Bellandur North Morning Loop',
      ward: 'Ward 150 - Bellandur',
      jurisdiction: 'BBMP Mahadevapura',
      status: CollectionRouteStatus.ACTIVE,
      description: 'Primary residential door-to-door morning collection circuit',
      vehicleIds: ['veh-tipper-01'],
      pickupPointIds: ['point-150-01', 'point-150-02', 'point-150-03'],
      scheduledStartTime: '06:30',
      scheduledEndTime: '09:45',
    }),
    new CollectionRoute({
      id: 'route-blr-w174-beta',
      name: 'HSR Sector 2 Commercial Sweep',
      ward: 'Ward 174 - HSR Layout',
      jurisdiction: 'BBMP Bommanahalli',
      status: CollectionRouteStatus.ACTIVE,
      description: 'Market street and commercial food outlet bulk waste route',
      vehicleIds: ['veh-compactor-02'],
      pickupPointIds: ['point-174-01', 'point-174-02'],
      scheduledStartTime: '07:00',
      scheduledEndTime: '10:30',
    }),
  ];

  const samplePoints = [
    new PickupPoint({
      id: 'point-150-01',
      ward: 'Ward 150 - Bellandur',
      jurisdiction: 'BBMP Mahadevapura',
      address: 'Green Glen Layout Gate 1 Community Stand',
      collectionType: 'door-to-door',
      estimatedWasteKg: 120,
      scheduledTime: '06:45',
      status: PickupPointStatus.SERVICED,
    }),
    new PickupPoint({
      id: 'point-150-02',
      ward: 'Ward 150 - Bellandur',
      jurisdiction: 'BBMP Mahadevapura',
      address: 'Outer Ring Road Service Lane Point B',
      collectionType: 'bulk',
      estimatedWasteKg: 280,
      scheduledTime: '07:30',
      status: PickupPointStatus.SCHEDULED,
    }),
    new PickupPoint({
      id: 'point-150-03',
      ward: 'Ward 150 - Bellandur',
      jurisdiction: 'BBMP Mahadevapura',
      address: 'Devarabisanahalli Central Bins',
      collectionType: 'street',
      estimatedWasteKg: 160,
      scheduledTime: '08:15',
      status: PickupPointStatus.SCHEDULED,
    }),
    new PickupPoint({
      id: 'point-174-01',
      ward: 'Ward 174 - HSR Layout',
      jurisdiction: 'BBMP Bommanahalli',
      address: '27th Main Commercial Market Bins',
      collectionType: 'bulk',
      estimatedWasteKg: 350,
      scheduledTime: '07:15',
      status: PickupPointStatus.SERVICED,
    }),
    new PickupPoint({
      id: 'point-174-02',
      ward: 'Ward 174 - HSR Layout',
      jurisdiction: 'BBMP Bommanahalli',
      address: 'Sector 2 Neighborhood Park Collection Point',
      collectionType: 'door-to-door',
      estimatedWasteKg: 90,
      scheduledTime: '08:30',
      status: PickupPointStatus.SCHEDULED,
    }),
  ];

  const sampleVehicles = [
    new Vehicle({
      id: 'veh-tipper-01',
      registrationNumber: 'KA-01-EA-4412',
      type: 'tipper',
      capacityKg: 600,
      capacityLitres: 1200,
      currentLoadKg: 120,
      status: VehicleStatus.DEPLOYED,
      assignedRouteId: 'route-blr-w150-alpha',
    }),
    new Vehicle({
      id: 'veh-compactor-02',
      registrationNumber: 'KA-51-MD-9810',
      type: 'compact',
      capacityKg: 1500,
      capacityLitres: 3000,
      currentLoadKg: 350,
      status: VehicleStatus.DEPLOYED,
      assignedRouteId: 'route-blr-w174-beta',
    }),
    new Vehicle({
      id: 'veh-standby-03',
      registrationNumber: 'KA-03-FA-1102',
      type: 'standard',
      capacityKg: 500,
      capacityLitres: 1000,
      currentLoadKg: 0,
      status: VehicleStatus.AVAILABLE,
    }),
  ];

  const sampleAudits = [
    new SegregationAudit({
      id: 'audit-150-01',
      pickupPointId: 'point-150-01',
      ward: 'Ward 150 - Bellandur',
      compliancePercentage: 54,
      rating: SegregationAuditRating.FAIR,
      observedStreams: { wet: 1, dry: 1, hazardous: 0 },
      expectedStreams: { wet: 1, dry: 1, hazardous: 1 },
      issuesNoted: 'Dry waste mixed with sanitary and battery waste.',
      integritySeal: 'SEAL-WRA-7E2A-91F4',
    }),
  ];

  const initialRecords = [...sampleRoutes, ...samplePoints, ...sampleVehicles, ...sampleAudits].map((r) =>
    ensureMetadata(r, { username: 'system-seed' })
  );

  saveRecords(store, initialRecords);
}

export function exportAllData(storageEngine) {
  return JSON.stringify(loadRecords(storageEngine), null, 2);
}

export function importAllData(json, storageEngine) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error('Import data must be a JSON array.');
  }
  const migrated = migrateRecords(parsed);
  saveRecords(storageEngine, migrated);
  return migrated.length;
}
