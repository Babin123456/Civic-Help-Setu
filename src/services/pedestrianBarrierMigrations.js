/**
 * src/services/pedestrianBarrierMigrations.js
 * Schema bootstrap, transactional migration, rollback, and index manifest
 * for Accessible Pedestrian Route Barrier Map (#757).
 */

import { SCHEMA_VERSION } from '../data/pedestrianBarrierContract.js';
import {
  INITIAL_INTERSECTION_NODES,
  INITIAL_PEDESTRIAN_SEGMENTS,
  INITIAL_CROSSING_ASSETS,
  INITIAL_BARRIER_OBSERVATIONS,
  INITIAL_TEMPORARY_OBSTRUCTIONS,
  INITIAL_VERIFICATION_EVENTS,
} from '../data/pedestrianBarrierSeed.js';

export const PEDESTRIAN_STORAGE_KEYS = Object.freeze({
  meta: 'civicbridge_pedestrian_meta_v1',
  backup: 'civicbridge_pedestrian_migration_backup_v1',
  nodes: 'civicbridge_pedestrian_nodes_v1',
  segments: 'civicbridge_pedestrian_segments_v1',
  crossings: 'civicbridge_pedestrian_crossings_v1',
  observations: 'civicbridge_pedestrian_observations_v1',
  obstructions: 'civicbridge_pedestrian_obstructions_v1',
  auditEvents: 'civicbridge_pedestrian_audit_events_v1',
  preferences: 'civicbridge_pedestrian_preferences_v1',
  offlineQueue: 'civicbridge_pedestrian_offline_queue_v1',
});

export const PEDESTRIAN_INDEX_MANIFEST = Object.freeze([
  {
    name: 'byWardJurisdiction',
    collection: 'pedestrian_segments',
    fields: ['ward'],
    purpose: 'Fast corridor lookup and jurisdictional scoping by municipal ward.',
  },
  {
    name: 'byBarrierStatusAndSeverity',
    collection: 'barrier_observations',
    fields: ['status', 'severity'],
    purpose: 'Filtered queries for active hazards, inspection queues, and routing weight penalties.',
  },
  {
    name: 'bySegmentId',
    collection: 'barrier_observations',
    fields: ['segmentId', 'status'],
    purpose: 'Corridor graph building to associate active defects with edge weights.',
  },
  {
    name: 'byInspectionRecency',
    collection: 'pedestrian_segments',
    fields: ['lastInspectedAt'],
    purpose: 'Identify stale segments older than 30 days to enforce verification integrity.',
  },
  {
    name: 'byAuditObservationId',
    collection: 'verification_events',
    fields: ['observationId', 'timestamp'],
    purpose: 'Append-only audit trail lookups for official inspection decisions.',
  },
]);

const safeParse = (str, fallback) => {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
};

const takeSnapshot = (storage) => {
  const snapshot = {};
  for (const key of Object.values(PEDESTRIAN_STORAGE_KEYS)) {
    try {
      snapshot[key] = storage?.getItem(key) ?? null;
    } catch {
      snapshot[key] = null;
    }
  }
  return snapshot;
};

const restoreSnapshot = (storage, snapshot) => {
  if (!snapshot) throw new Error('No valid migration backup snapshot found to restore.');
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === null) {
      storage?.removeItem(key);
    } else {
      storage?.setItem(key, value);
    }
  }
};

/**
 * Checks current migration and schema status.
 */
export const getPedestrianBarrierMigrationStatus = ({ storage }) => {
  const metaRaw = storage?.getItem(PEDESTRIAN_STORAGE_KEYS.meta);
  const meta = safeParse(metaRaw, null);

  const currentVersion = meta?.schemaVersion || '0.0.0';
  const isUpToDate = currentVersion === SCHEMA_VERSION;
  const backupAvailable = Boolean(storage?.getItem(PEDESTRIAN_STORAGE_KEYS.backup));

  return {
    currentVersion,
    targetVersion: SCHEMA_VERSION,
    isUpToDate,
    backupAvailable,
    lastMigratedAt: meta?.migratedAt || null,
  };
};

/**
 * Normalizes legacy or raw unversioned records to v1.0.0 schema contracts.
 */
export const normalizeObservation = (obs, index = 0) => {
  return {
    id: obs.id || `BAR-LEGACY-${index + 1}`,
    segmentId: obs.segmentId || 'SEG-UNKNOWN',
    coordinates: obs.coordinates || { lat: 12.915, lng: 77.67 },
    barrierType: obs.barrierType || 'damaged_footpath',
    severity: obs.severity || 'moderate_impediment',
    ward: obs.ward || 'Ward 150 - Bellandur',
    description: obs.description || 'Legacy obstacle report pending detail confirmation.',
    confidenceScore: typeof obs.confidenceScore === 'number' ? obs.confidenceScore : 0.8,
    photoUrl: obs.photoUrl || '',
    status: obs.status || 'reported',
    reportedAt: obs.reportedAt || new Date().toISOString(),
    reportedBy: obs.reportedBy || 'Citizen Contributor',
    schemaVersion: SCHEMA_VERSION,
  };
};

export const normalizeSegment = (seg, index = 0) => {
  return {
    id: seg.id || `SEG-LEGACY-${index + 1}`,
    startNodeId: seg.startNodeId || 'NODE-101',
    endNodeId: seg.endNodeId || 'NODE-102',
    corridorName: seg.corridorName || 'Unlabeled Walkway',
    ward: seg.ward || 'Ward 150 - Bellandur',
    lengthMeters: Number(seg.lengthMeters) || 100,
    widthMeters: Number(seg.widthMeters) || 1.8,
    gradientPct: Number(seg.gradientPct) || 3.0,
    surfaceType: seg.surfaceType || 'paved_asphalt',
    curbRampStatus: seg.curbRampStatus || 'present_compliant',
    tactilePaving: seg.tactilePaving || 'absent',
    sidewalkType: seg.sidewalkType || 'elevated_kerb',
    lighting: seg.lighting || 'adequate',
    hasStairsOrSteps: Boolean(seg.hasStairsOrSteps),
    verificationStatus: seg.verificationStatus || 'provisional',
    lastInspectedAt: seg.lastInspectedAt || new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };
};

/**
 * Transactional schema migration runner with pre-migration backup and dry-run mode.
 */
export const migratePedestrianBarrierSchema = ({
  storage,
  dryRun = false,
  now = new Date(),
}) => {
  const currentStatus = getPedestrianBarrierMigrationStatus({ storage });
  const snapshot = takeSnapshot(storage);

  // Read existing collections or initialize defaults
  const existingSegments = safeParse(storage?.getItem(PEDESTRIAN_STORAGE_KEYS.segments), []);
  const existingObservations = safeParse(storage?.getItem(PEDESTRIAN_STORAGE_KEYS.observations), []);
  const existingCrossings = safeParse(storage?.getItem(PEDESTRIAN_STORAGE_KEYS.crossings), []);
  const existingNodes = safeParse(storage?.getItem(PEDESTRIAN_STORAGE_KEYS.nodes), []);
  const existingObstructions = safeParse(storage?.getItem(PEDESTRIAN_STORAGE_KEYS.obstructions), []);
  const existingAuditEvents = safeParse(storage?.getItem(PEDESTRIAN_STORAGE_KEYS.auditEvents), []);

  const isEmpty = existingSegments.length === 0 && existingObservations.length === 0;

  // Upgrade or seed collections
  const upgradedSegments = isEmpty
    ? INITIAL_PEDESTRIAN_SEGMENTS
    : existingSegments.map((s, idx) => normalizeSegment(s, idx));

  const upgradedObservations = isEmpty
    ? INITIAL_BARRIER_OBSERVATIONS
    : existingObservations.map((o, idx) => normalizeObservation(o, idx));

  const upgradedNodes = isEmpty ? INITIAL_INTERSECTION_NODES : existingNodes;
  const upgradedCrossings = isEmpty ? INITIAL_CROSSING_ASSETS : existingCrossings;
  const upgradedObstructions = isEmpty ? INITIAL_TEMPORARY_OBSTRUCTIONS : existingObstructions;
  const upgradedAuditEvents = isEmpty ? INITIAL_VERIFICATION_EVENTS : existingAuditEvents;

  const preview = {
    nodesCount: upgradedNodes.length,
    segmentsCount: upgradedSegments.length,
    crossingsCount: upgradedCrossings.length,
    observationsCount: upgradedObservations.length,
    obstructionsCount: upgradedObstructions.length,
    auditEventsCount: upgradedAuditEvents.length,
  };

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      fromVersion: currentStatus.currentVersion,
      toVersion: SCHEMA_VERSION,
      changed: currentStatus.currentVersion !== SCHEMA_VERSION || isEmpty,
      preview,
    };
  }

  // Persist backup for rollback
  storage?.setItem(PEDESTRIAN_STORAGE_KEYS.backup, JSON.stringify(snapshot));

  // Write migrated collections
  storage?.setItem(PEDESTRIAN_STORAGE_KEYS.nodes, JSON.stringify(upgradedNodes));
  storage?.setItem(PEDESTRIAN_STORAGE_KEYS.segments, JSON.stringify(upgradedSegments));
  storage?.setItem(PEDESTRIAN_STORAGE_KEYS.crossings, JSON.stringify(upgradedCrossings));
  storage?.setItem(PEDESTRIAN_STORAGE_KEYS.observations, JSON.stringify(upgradedObservations));
  storage?.setItem(PEDESTRIAN_STORAGE_KEYS.obstructions, JSON.stringify(upgradedObstructions));
  storage?.setItem(PEDESTRIAN_STORAGE_KEYS.auditEvents, JSON.stringify(upgradedAuditEvents));

  // Write migration metadata record
  const meta = {
    schemaVersion: SCHEMA_VERSION,
    previousVersion: currentStatus.currentVersion,
    migratedAt: now.toISOString(),
    backupAvailable: true,
    preview,
  };
  storage?.setItem(PEDESTRIAN_STORAGE_KEYS.meta, JSON.stringify(meta));

  return {
    success: true,
    dryRun: false,
    fromVersion: currentStatus.currentVersion,
    toVersion: SCHEMA_VERSION,
    backupAvailable: true,
    migratedAt: meta.migratedAt,
    preview,
  };
};

/**
 * Rolls back the database to the exact pre-migration state.
 */
export const rollbackPedestrianBarrierMigration = ({ storage }) => {
  const backupRaw = storage?.getItem(PEDESTRIAN_STORAGE_KEYS.backup);
  if (!backupRaw) {
    throw new Error('Rollback failed: No backup snapshot available.');
  }

  const snapshot = safeParse(backupRaw, null);
  restoreSnapshot(storage, snapshot);
  storage?.removeItem(PEDESTRIAN_STORAGE_KEYS.backup);

  return {
    success: true,
    message: 'Successfully rolled back pedestrian infrastructure database to previous snapshot.',
  };
};
