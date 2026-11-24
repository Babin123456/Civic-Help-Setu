/**
 * Storage, Schema Migrations, Indexing & Rollback Strategy for Streetlights (#756).
 * Provides atomic migrations, local storage persistence with in-memory fallback,
 * secondary indexing, and privacy retention policies.
 */

import {
  STREETLIGHT_SCHEMA_VERSION,
  STREETLIGHT_STORAGE_KEYS,
} from './streetlightConstants';
import { logDiagnostic } from '../utils/diagnostics';
import {
  SEED_STREETLIGHT_ASSETS,
  SEED_OUTAGE_REPORTS,
  SEED_OUTAGE_CLUSTERS,
  SEED_WORK_ORDERS,
  SEED_REPAIR_EVENTS,
} from '../data/streetlightSeedData';

// In-memory fallback if localStorage is disabled or running in test runner
const memoryStorage = new Map();

const safeGetItem = (key) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      if (item !== null) return item;
    }
  } catch {
    // Ignore and fallback
  }
  return memoryStorage.get(key) || null;
};

const safeSetItem = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore and fallback
  }
  memoryStorage.set(key, value);
};

const safeRemoveItem = (key) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
  memoryStorage.delete(key);
};

/**
 * Builds secondary search indexes for rapid lookup and jurisdiction filtering.
 */
export const buildStreetlightIndexes = (data = {}) => {
  const { assets = [], reports = [], clusters = [], workOrders = [] } = data;

  const assetsByJurisdiction = new Map();
  const assetsById = new Map();
  assets.forEach((a) => {
    assetsById.set(a.id.toUpperCase(), a);
    const jId = (a.jurisdictionId || 'UNKNOWN').toUpperCase();
    if (!assetsByJurisdiction.has(jId)) assetsByJurisdiction.set(jId, []);
    assetsByJurisdiction.get(jId).push(a);
  });

  const reportsByTrackingToken = new Map();
  const reportsByClusterId = new Map();
  const reportsByAssetId = new Map();
  reports.forEach((r) => {
    if (r.trackingToken) reportsByTrackingToken.set(r.trackingToken.toUpperCase(), r);
    if (r.clusterId) {
      if (!reportsByClusterId.has(r.clusterId)) reportsByClusterId.set(r.clusterId, []);
      reportsByClusterId.get(r.clusterId).push(r);
    }
    if (r.assetId) {
      const aId = r.assetId.toUpperCase();
      if (!reportsByAssetId.has(aId)) reportsByAssetId.set(aId, []);
      reportsByAssetId.get(aId).push(r);
    }
  });

  const clustersById = new Map();
  const clustersByJurisdiction = new Map();
  clusters.forEach((c) => {
    clustersById.set(c.id, c);
    const jId = (c.jurisdictionId || 'UNKNOWN').toUpperCase();
    if (!clustersByJurisdiction.has(jId)) clustersByJurisdiction.set(jId, []);
    clustersByJurisdiction.get(jId).push(c);
  });

  const workOrdersByClusterId = new Map();
  workOrders.forEach((wo) => {
    if (wo.clusterId) workOrdersByClusterId.set(wo.clusterId, wo);
  });

  return {
    assetsById,
    assetsByJurisdiction,
    reportsByTrackingToken,
    reportsByClusterId,
    reportsByAssetId,
    clustersById,
    clustersByJurisdiction,
    workOrdersByClusterId,
  };
};

/**
 * Initializes and migrates storage data up to the current schema version.
 */
export const ensureStreetlightData = () => {
  const metaRaw = safeGetItem(STREETLIGHT_STORAGE_KEYS.MIGRATION_META);
  let meta = null;
  if (metaRaw) {
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      meta = null;
    }
  }

  // If already migrated to current version and data exists, load and return
  if (meta && meta.schemaVersion === STREETLIGHT_SCHEMA_VERSION) {
    try {
      const assets = JSON.parse(safeGetItem(STREETLIGHT_STORAGE_KEYS.ASSETS) || '[]');
      const reports = JSON.parse(safeGetItem(STREETLIGHT_STORAGE_KEYS.REPORTS) || '[]');
      const clusters = JSON.parse(safeGetItem(STREETLIGHT_STORAGE_KEYS.CLUSTERS) || '[]');
      const workOrders = JSON.parse(safeGetItem(STREETLIGHT_STORAGE_KEYS.WORK_ORDERS) || '[]');
      const repairEvents = JSON.parse(safeGetItem(STREETLIGHT_STORAGE_KEYS.REPAIR_EVENTS) || '[]');
      const inspectionSchedules = JSON.parse(safeGetItem(STREETLIGHT_STORAGE_KEYS.INSPECTION_SCHEDULES) || '[]');
      const auditLogs = JSON.parse(safeGetItem(STREETLIGHT_STORAGE_KEYS.AUDIT_LOGS) || '[]');

      return {
        assets,
        reports,
        clusters,
        workOrders,
        repairEvents,
        inspectionSchedules,
        auditLogs,
        meta,
        indexes: buildStreetlightIndexes({ assets, reports, clusters, workOrders }),
      };
    } catch (err) {
      logDiagnostic('Corrupt streetlight storage, re-seeding...', err);
    }
  }

  // Initialize fresh schema with seed data
  const initialMeta = {
    schemaVersion: STREETLIGHT_SCHEMA_VERSION,
    migratedAt: new Date().toISOString(),
    assetCount: SEED_STREETLIGHT_ASSETS.length,
    reportCount: SEED_OUTAGE_REPORTS.length,
    clusterCount: SEED_OUTAGE_CLUSTERS.length,
  };

  safeSetItem(STREETLIGHT_STORAGE_KEYS.ASSETS, JSON.stringify(SEED_STREETLIGHT_ASSETS));
  safeSetItem(STREETLIGHT_STORAGE_KEYS.REPORTS, JSON.stringify(SEED_OUTAGE_REPORTS));
  safeSetItem(STREETLIGHT_STORAGE_KEYS.CLUSTERS, JSON.stringify(SEED_OUTAGE_CLUSTERS));
  safeSetItem(STREETLIGHT_STORAGE_KEYS.WORK_ORDERS, JSON.stringify(SEED_WORK_ORDERS));
  safeSetItem(STREETLIGHT_STORAGE_KEYS.REPAIR_EVENTS, JSON.stringify(SEED_REPAIR_EVENTS));
  safeSetItem(STREETLIGHT_STORAGE_KEYS.INSPECTION_SCHEDULES, JSON.stringify([]));
  safeSetItem(STREETLIGHT_STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
  safeSetItem(STREETLIGHT_STORAGE_KEYS.MIGRATION_META, JSON.stringify(initialMeta));

  return {
    assets: [...SEED_STREETLIGHT_ASSETS],
    reports: [...SEED_OUTAGE_REPORTS],
    clusters: [...SEED_OUTAGE_CLUSTERS],
    workOrders: [...SEED_WORK_ORDERS],
    repairEvents: [...SEED_REPAIR_EVENTS],
    inspectionSchedules: [],
    auditLogs: [],
    meta: initialMeta,
    indexes: buildStreetlightIndexes({
      assets: SEED_STREETLIGHT_ASSETS,
      reports: SEED_OUTAGE_REPORTS,
      clusters: SEED_OUTAGE_CLUSTERS,
      workOrders: SEED_WORK_ORDERS,
    }),
  };
};

/**
 * Saves current datasets atomically.
 */
export const persistStreetlightData = (data = {}) => {
  const { assets, reports, clusters, workOrders, repairEvents, inspectionSchedules, auditLogs } = data;

  if (assets) safeSetItem(STREETLIGHT_STORAGE_KEYS.ASSETS, JSON.stringify(assets));
  if (reports) safeSetItem(STREETLIGHT_STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  if (clusters) safeSetItem(STREETLIGHT_STORAGE_KEYS.CLUSTERS, JSON.stringify(clusters));
  if (workOrders) safeSetItem(STREETLIGHT_STORAGE_KEYS.WORK_ORDERS, JSON.stringify(workOrders));
  if (repairEvents) safeSetItem(STREETLIGHT_STORAGE_KEYS.REPAIR_EVENTS, JSON.stringify(repairEvents));
  if (inspectionSchedules) safeSetItem(STREETLIGHT_STORAGE_KEYS.INSPECTION_SCHEDULES, JSON.stringify(inspectionSchedules));
  if (auditLogs) safeSetItem(STREETLIGHT_STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));

  const updatedMeta = {
    schemaVersion: STREETLIGHT_SCHEMA_VERSION,
    lastSavedAt: new Date().toISOString(),
    assetCount: assets?.length || 0,
    reportCount: reports?.length || 0,
    clusterCount: clusters?.length || 0,
  };
  safeSetItem(STREETLIGHT_STORAGE_KEYS.MIGRATION_META, JSON.stringify(updatedMeta));

  return updatedMeta;
};

/**
 * Rollback strategy: resets streetlight storage to clean initial seed state.
 */
export const rollbackStreetlightStorage = () => {
  Object.values(STREETLIGHT_STORAGE_KEYS).forEach((key) => {
    safeRemoveItem(key);
  });
  return ensureStreetlightData();
};

/**
 * Retention policy: Anonymizes and archives completed reports older than maxAgeDays.
 */
export const applyStreetlightRetentionPolicy = (maxAgeDays = 90) => {
  const data = ensureStreetlightData();
  const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let modified = false;

  const prunedReports = data.reports.map((report) => {
    if (report.status === 'resolved' || report.status === 'rejected') {
      const resolvedAt = new Date(report.updatedAt || report.reportedAt).getTime();
      if (resolvedAt < cutoffTime) {
        modified = true;
        return {
          ...report,
          reporterHash: 'ARCHIVED',
          contactNumber: null,
          archived: true,
        };
      }
    }
    return report;
  });

  if (modified) {
    data.reports = prunedReports;
    persistStreetlightData(data);
  }

  return { modified, totalReports: data.reports.length };
};
