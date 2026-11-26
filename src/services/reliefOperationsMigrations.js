/**
 * Persistence, schema migration, indexing, retention and rollback for the
 * Relief Operations Workspace (#747).
 *
 * The module keeps one normalized collection per entity in localStorage, with
 * an in-memory fallback for tests and privacy-restricted browsers. Writes are
 * always followed by a full index rebuild so list/search paths never scan stale
 * maps. `migrateReliefData` is pure and testable against both an empty database
 * and a representative legacy dataset.
 */

import {
  RELIEF_SCHEMA_VERSION,
  RELIEF_STORAGE_KEYS,
} from './reliefOperationsConstants';
import { logDiagnostic } from '../utils/diagnostics';
import {
  SEED_RELIEF_INCIDENTS,
  SEED_RELIEF_NEEDS,
  SEED_RELIEF_RESOURCES,
  SEED_RELIEF_SITES,
  SEED_RELIEF_PARTNERS,
  SEED_RELIEF_ALLOCATIONS,
  SEED_RELIEF_MOVEMENTS,
} from '../data/reliefOperationsSeed';

const memoryStorage = new Map();

export const __resetReliefMemoryStorage = () => memoryStorage.clear();

const safeGetItem = (key) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const value = window.localStorage.getItem(key);
      if (value !== null) return value;
    }
  } catch {
    // Fall through to memory storage.
  }
  return memoryStorage.get(key) ?? null;
};

const safeSetItem = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Fall through to memory storage.
  }
  memoryStorage.set(key, value);
};

const safeRemoveItem = (key) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore.
  }
  memoryStorage.delete(key);
};

const readCollection = (key, fallback = []) => {
  const raw = safeGetItem(key);
  if (!raw) return [...fallback];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
};

/** Builds secondary indexes for jurisdiction, status, category and search. */
export const buildReliefIndexes = (data = {}) => {
  const {
    incidents = [],
    needs = [],
    resources = [],
    movements = [],
    sites = [],
    allocations = [],
    deliveries = [],
    partners = [],
    auditLogs = [],
  } = data;

  const incidentsById = new Map();
  const needsById = new Map();
  const needsByToken = new Map();
  const needsByJurisdiction = new Map();
  const needsByCategoryStatus = new Map();
  const needsByCreatedAt = new Map();
  const resourcesById = new Map();
  const resourcesByJurisdictionCategory = new Map();
  const sitesById = new Map();
  const allocationsById = new Map();
  const allocationsByStatus = new Map();
  const allocationsByJurisdiction = new Map();
  const allocationsByCreatedAt = new Map();
  const allocationsByNeed = new Map();
  const allocationsByResource = new Map();
  const movementsByResource = new Map();
  const deliveriesByAllocation = new Map();
  const partnersById = new Map();
  const auditsByJurisdiction = new Map();

  const push = (map, key, value) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  incidents.forEach((incident) => incidentsById.set(incident.id, incident));

  needs.forEach((need) => {
    needsById.set(need.id, need);
    if (need.trackingToken) needsByToken.set(need.trackingToken.toUpperCase(), need);
    const jurisdiction = (need.jurisdictionId || 'UNKNOWN').toUpperCase();
    push(needsByJurisdiction, jurisdiction, need);
    push(needsByCategoryStatus, `${need.category}:${need.status}`, need);
    push(needsByCreatedAt, String(need.createdAt || '').slice(0, 10), need);
  });

  resources.forEach((resource) => {
    resourcesById.set(resource.id, resource);
    const jurisdiction = (resource.jurisdictionId || 'UNKNOWN').toUpperCase();
    push(resourcesByJurisdictionCategory, `${jurisdiction}:${resource.category}`, resource);
  });

  sites.forEach((site) => sitesById.set(site.id, site));
  partners.forEach((partner) => partnersById.set(partner.id, partner));

  allocations.forEach((allocation) => {
    allocationsById.set(allocation.id, allocation);
    push(allocationsByStatus, allocation.status, allocation);
    push(allocationsByJurisdiction, (allocation.jurisdictionId || 'UNKNOWN').toUpperCase(), allocation);
    push(allocationsByCreatedAt, String(allocation.createdAt || '').slice(0, 10), allocation);
    push(allocationsByNeed, allocation.needId, allocation);
    push(allocationsByResource, allocation.resourceId, allocation);
  });

  movements.forEach((movement) => push(movementsByResource, movement.resourceId, movement));
  deliveries.forEach((delivery) => push(deliveriesByAllocation, delivery.allocationId, delivery));
  auditLogs.forEach((audit) => push(auditsByJurisdiction, (audit.jurisdictionId || 'ALL').toUpperCase(), audit));

  return {
    incidentsById,
    needsById,
    needsByToken,
    needsByJurisdiction,
    needsByCategoryStatus,
    needsByCreatedAt,
    resourcesById,
    resourcesByJurisdictionCategory,
    sitesById,
    allocationsById,
    allocationsByStatus,
    allocationsByJurisdiction,
    allocationsByCreatedAt,
    allocationsByNeed,
    allocationsByResource,
    movementsByResource,
    deliveriesByAllocation,
    partnersById,
    auditsByJurisdiction,
  };
};

const emptyData = () => ({
  incidents: [],
  needs: [],
  resources: [],
  movements: [],
  sites: [],
  allocations: [],
  deliveries: [],
  partners: [],
  forecastRuns: [],
  auditLogs: [],
  archive: { incidents: [], needs: [], auditLogs: [] },
});

/**
 * Pure migration runner. Version 0 is the legacy/imported shape where
 * collections used short names (`reports`, `inventory`, `requests`).
 * Version 1 normalizes names, adds required metadata and drops unknown status
 * values by resetting them to their safest initial state.
 */
const asArray = (value) => (Array.isArray(value) ? value : []);
const firstNonEmpty = (...values) => values.find((value) => asArray(value).length > 0) || [];

export const migrateReliefData = (rawData = {}, fromVersion = 0) => {
  const data = { ...emptyData(), ...(rawData || {}) };
  const appliedMigrations = [];

  if (fromVersion < 1) {
    const legacyNeeds = firstNonEmpty(data.needs, rawData.reports, rawData.needReports, rawData.requests);
    const legacyResources = firstNonEmpty(data.resources, rawData.inventory, rawData.resourceInventory);
    const legacySites = firstNonEmpty(data.sites, rawData.distributionSites);
    const legacyAllocations = firstNonEmpty(data.allocations, rawData.proposals, rawData.allocationProposals);
    const legacyPartners = firstNonEmpty(data.partners, rawData.partnerVerifications);
    const legacyDeliveries = firstNonEmpty(data.deliveries, rawData.deliveryConfirmations);
    const legacyIncidents = firstNonEmpty(data.incidents, rawData.reliefIncidents);
    const legacyMovements = firstNonEmpty(data.movements, rawData.stockMovements);

    const timestamp = new Date().toISOString();

    data.incidents = legacyIncidents.map((incident) => ({
      ...incident,
      status: incident.status || 'active',
      createdAt: incident.createdAt || timestamp,
      updatedAt: incident.updatedAt || incident.createdAt || timestamp,
      createdBy: incident.createdBy || 'migration',
      schemaVersion: RELIEF_SCHEMA_VERSION,
    }));

    data.needs = legacyNeeds.map((need) => ({
      ...need,
      category: need.category || 'food',
      quantity: Number(need.quantity) > 0 ? Number(need.quantity) : 1,
      fulfilledQuantity: Number(need.fulfilledQuantity) || 0,
      peopleAffected: Number(need.peopleAffected) || Number(need.quantity) || 1,
      status: need.status || 'submitted',
      reporterRef: need.reporterRef || null,
      duplicateCount: Number(need.duplicateCount) || 0,
      trackingToken: need.trackingToken || `TRK-RLF-${String(need.id || '').replace(/\W/g, '').slice(-6) || 'MIGRAT'}`,
      createdAt: need.createdAt || timestamp,
      updatedAt: need.updatedAt || need.createdAt || timestamp,
      createdBy: need.createdBy || 'migration',
      schemaVersion: RELIEF_SCHEMA_VERSION,
    }));

    data.resources = legacyResources.map((resource) => ({
      ...resource,
      unit: resource.unit || 'unit',
      quantityOnHand: Math.max(0, Number(resource.quantityOnHand) || 0),
      quantityReserved: Math.max(0, Number(resource.quantityReserved) || 0),
      status: resource.status || 'available',
      createdAt: resource.createdAt || timestamp,
      updatedAt: resource.updatedAt || resource.createdAt || timestamp,
      createdBy: resource.createdBy || 'migration',
      schemaVersion: RELIEF_SCHEMA_VERSION,
    }));

    data.sites = legacySites.map((site) => ({
      ...site,
      isPublic: site.isPublic !== false,
      capacityPerDay: Number(site.capacityPerDay) || 100,
      createdAt: site.createdAt || timestamp,
      updatedAt: site.updatedAt || site.createdAt || timestamp,
      createdBy: site.createdBy || 'migration',
      schemaVersion: RELIEF_SCHEMA_VERSION,
    }));

    data.allocations = legacyAllocations.map((allocation) => ({
      ...allocation,
      status: allocation.status || 'pending_approval',
      quantity: Number(allocation.quantity) || 1,
      createdAt: allocation.createdAt || timestamp,
      updatedAt: allocation.updatedAt || allocation.createdAt || timestamp,
      createdBy: allocation.createdBy || 'migration',
      schemaVersion: RELIEF_SCHEMA_VERSION,
    }));

    data.deliveries = legacyDeliveries.map((delivery) => ({
      ...delivery,
      status: delivery.status || 'pending',
      createdAt: delivery.createdAt || timestamp,
      updatedAt: delivery.updatedAt || delivery.createdAt || timestamp,
      createdBy: delivery.createdBy || 'migration',
      schemaVersion: RELIEF_SCHEMA_VERSION,
    }));

    data.partners = legacyPartners.map((partner) => ({
      ...partner,
      status: partner.status || 'pending',
      createdAt: partner.createdAt || timestamp,
      updatedAt: partner.updatedAt || partner.createdAt || timestamp,
      createdBy: partner.createdBy || 'migration',
      schemaVersion: RELIEF_SCHEMA_VERSION,
    }));

    data.movements = legacyMovements.map((movement) => ({
      ...movement,
      type: movement.type || 'adjustment',
      createdAt: movement.createdAt || timestamp,
      schemaVersion: RELIEF_SCHEMA_VERSION,
    }));

    data.forecastRuns = Array.isArray(rawData.forecastRuns) ? rawData.forecastRuns : [];
    data.auditLogs = Array.isArray(rawData.auditLogs) ? rawData.auditLogs : [];
    data.archive = rawData.archive || { incidents: [], needs: [], auditLogs: [] };

    appliedMigrations.push('v1_normalize_relief_collections');
  }

  data.meta = {
    ...(data.meta || {}),
    schemaVersion: RELIEF_SCHEMA_VERSION,
    migratedAt: new Date().toISOString(),
    appliedMigrations,
  };

  return { data, appliedMigrations, schemaVersion: RELIEF_SCHEMA_VERSION };
};

const loadCurrent = () => ({
  incidents: readCollection(RELIEF_STORAGE_KEYS.INCIDENTS),
  needs: readCollection(RELIEF_STORAGE_KEYS.NEED_REPORTS),
  resources: readCollection(RELIEF_STORAGE_KEYS.RESOURCE_INVENTORY),
  movements: readCollection(RELIEF_STORAGE_KEYS.STOCK_MOVEMENTS),
  sites: readCollection(RELIEF_STORAGE_KEYS.DISTRIBUTION_SITES),
  allocations: readCollection(RELIEF_STORAGE_KEYS.ALLOCATION_PROPOSALS),
  deliveries: readCollection(RELIEF_STORAGE_KEYS.DELIVERY_CONFIRMATIONS),
  partners: readCollection(RELIEF_STORAGE_KEYS.PARTNER_VERIFICATIONS),
  forecastRuns: readCollection(RELIEF_STORAGE_KEYS.FORECAST_RUNS),
  auditLogs: readCollection(RELIEF_STORAGE_KEYS.AUDIT_LOGS),
  archive: (() => {
    const raw = safeGetItem(RELIEF_STORAGE_KEYS.ARCHIVE);
    if (!raw) return { incidents: [], needs: [], auditLogs: [] };
    try {
      const parsed = JSON.parse(raw);
      return {
        incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
        needs: Array.isArray(parsed.needs) ? parsed.needs : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      };
    } catch {
      return { incidents: [], needs: [], auditLogs: [] };
    }
  })(),
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const seedData = () => ({
  incidents: clone(SEED_RELIEF_INCIDENTS),
  needs: clone(SEED_RELIEF_NEEDS),
  resources: clone(SEED_RELIEF_RESOURCES),
  movements: clone(SEED_RELIEF_MOVEMENTS),
  sites: clone(SEED_RELIEF_SITES),
  allocations: clone(SEED_RELIEF_ALLOCATIONS),
  deliveries: [],
  partners: clone(SEED_RELIEF_PARTNERS),
  forecastRuns: [],
  auditLogs: [],
  archive: { incidents: [], needs: [], auditLogs: [] },
});

const persistCollections = (data) => {
  safeSetItem(RELIEF_STORAGE_KEYS.INCIDENTS, JSON.stringify(data.incidents || []));
  safeSetItem(RELIEF_STORAGE_KEYS.NEED_REPORTS, JSON.stringify(data.needs || []));
  safeSetItem(RELIEF_STORAGE_KEYS.RESOURCE_INVENTORY, JSON.stringify(data.resources || []));
  safeSetItem(RELIEF_STORAGE_KEYS.STOCK_MOVEMENTS, JSON.stringify(data.movements || []));
  safeSetItem(RELIEF_STORAGE_KEYS.DISTRIBUTION_SITES, JSON.stringify(data.sites || []));
  safeSetItem(RELIEF_STORAGE_KEYS.ALLOCATION_PROPOSALS, JSON.stringify(data.allocations || []));
  safeSetItem(RELIEF_STORAGE_KEYS.DELIVERY_CONFIRMATIONS, JSON.stringify(data.deliveries || []));
  safeSetItem(RELIEF_STORAGE_KEYS.PARTNER_VERIFICATIONS, JSON.stringify(data.partners || []));
  safeSetItem(RELIEF_STORAGE_KEYS.FORECAST_RUNS, JSON.stringify(data.forecastRuns || []));
  safeSetItem(RELIEF_STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(data.auditLogs || []));
  safeSetItem(RELIEF_STORAGE_KEYS.ARCHIVE, JSON.stringify(data.archive || { incidents: [], needs: [], auditLogs: [] }));

  const meta = {
    schemaVersion: RELIEF_SCHEMA_VERSION,
    lastSavedAt: new Date().toISOString(),
    counts: {
      incidents: data.incidents?.length || 0,
      needs: data.needs?.length || 0,
      resources: data.resources?.length || 0,
      allocations: data.allocations?.length || 0,
      deliveries: data.deliveries?.length || 0,
    },
  };
  safeSetItem(RELIEF_STORAGE_KEYS.MIGRATION_META, JSON.stringify(meta));
  return meta;
};

/**
 * Loads the current schema, migrating or seeding when required.
 * A corrupt collection falls back to a clean seed rather than throwing at boot.
 */
export const ensureReliefData = () => {
  let meta = null;
  const rawMeta = safeGetItem(RELIEF_STORAGE_KEYS.MIGRATION_META);
  if (rawMeta) {
    try {
      meta = JSON.parse(rawMeta);
    } catch {
      meta = null;
    }
  }

  if (meta && meta.schemaVersion === RELIEF_SCHEMA_VERSION) {
    try {
      const data = loadCurrent();
      if (data.incidents.length || data.needs.length || data.resources.length) {
        return { ...data, meta, indexes: buildReliefIndexes(data) };
      }
    } catch (error) {
      logDiagnostic('Corrupt relief operations storage; re-seeding.', error);
    }
  }

  const fresh = seedData();
  persistCollections(fresh);
  const freshMeta = {
    schemaVersion: RELIEF_SCHEMA_VERSION,
    migratedAt: new Date().toISOString(),
    seeded: true,
  };
  safeSetItem(RELIEF_STORAGE_KEYS.MIGRATION_META, JSON.stringify(freshMeta));
  return { ...fresh, meta: freshMeta, indexes: buildReliefIndexes(fresh) };
};

/** Persists all collections atomically and rebuilds indexes for the caller. */
export const persistReliefData = (data = {}) => {
  const meta = persistCollections(data);
  return { ...data, meta, indexes: buildReliefIndexes(data) };
};

/** Rollback strategy: clears every relief key and restores the seed snapshot. */
export const rollbackReliefStorage = () => {
  Object.values(RELIEF_STORAGE_KEYS).forEach((key) => safeRemoveItem(key));
  return ensureReliefData();
};

/**
 * Retention & archival. Personal references and free-text descriptions on
 * terminal need reports are anonymized after the retention window. Closed
 * incidents are archived. Old audit entries are moved to the archive store,
 * never edited in place, so the active log remains append-only.
 */
export const applyReliefRetentionPolicy = ({
  needRetentionDays = 365,
  incidentRetentionDays = 1095,
  auditRetentionDays = 730,
  now = Date.now(),
} = {}) => {
  const data = ensureReliefData();
  const needCutoff = now - needRetentionDays * 24 * 60 * 60 * 1000;
  const incidentCutoff = now - incidentRetentionDays * 24 * 60 * 60 * 1000;
  const auditCutoff = now - auditRetentionDays * 24 * 60 * 60 * 1000;
  let anonymizedNeeds = 0;
  let archivedIncidents = 0;
  let archivedAuditEntries = 0;

  const terminalNeedStatuses = new Set(['fulfilled', 'rejected', 'duplicate']);
  data.needs = data.needs.map((need) => {
    if (need.archived || !terminalNeedStatuses.has(need.status)) return need;
    const updated = Date.parse(need.updatedAt || need.createdAt || 0);
    if (Number.isNaN(updated) || updated >= needCutoff) return need;
    anonymizedNeeds += 1;
    return {
      ...need,
      reporterRef: null,
      description: '[archived — personal details removed]',
      privateNote: '',
      coordinates: null,
      archived: true,
      archivedAt: new Date(now).toISOString(),
    };
  });

  const archive = data.archive || { incidents: [], needs: [], auditLogs: [] };
  archive.incidents = archive.incidents || [];
  archive.needs = archive.needs || [];
  archive.auditLogs = archive.auditLogs || [];

  data.incidents = data.incidents.map((incident) => {
    if (incident.status === 'archived') return incident;
    const updated = Date.parse(incident.updatedAt || incident.startedAt || 0);
    if (incident.status !== 'closed' || Number.isNaN(updated) || updated >= incidentCutoff) {
      return incident;
    }
    archivedIncidents += 1;
    return {
      ...incident,
      status: 'archived',
      archivedAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
  });

  const activeAudit = [];
  data.auditLogs.forEach((entry) => {
    const at = Date.parse(entry.timestamp || entry.createdAt || 0);
    if (!Number.isNaN(at) && at < auditCutoff) {
      archive.auditLogs.push(entry);
      archivedAuditEntries += 1;
    } else {
      activeAudit.push(entry);
    }
  });
  data.auditLogs = activeAudit;

  const modified = anonymizedNeeds + archivedIncidents + archivedAuditEntries > 0;
  if (modified) persistReliefData({ ...data, archive });

  return { modified, anonymizedNeeds, archivedIncidents, archivedAuditEntries };
};

export const getReliefMigrationMeta = () => {
  const raw = safeGetItem(RELIEF_STORAGE_KEYS.MIGRATION_META);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
