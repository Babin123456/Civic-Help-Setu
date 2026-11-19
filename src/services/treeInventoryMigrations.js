/**
 * Schema bootstrap, migration and rollback for the tree inventory.
 *
 * The app has no SQL database; each normalised collection is a JSON array in
 * localStorage. This module supplies the same operational guarantees a server
 * migration would: a version stamp, a pre-migration snapshot, an all-or-nothing
 * apply, an explicit rollback, and query-index definitions that document which
 * filters must stay fast.
 */

import {
  TREE_DEMO_ASSETS,
  TREE_DEMO_INSPECTIONS,
  TREE_DEMO_REPORTS,
  TREE_DEMO_WORK_ORDERS,
  TREE_PLANTING_SITES,
  TREE_SPECIES_CATALOG,
} from '../data/treeInventoryData';
import {
  TREE_COLLECTION_KEYS,
  TREE_ERROR_CODES,
  TREE_INVENTORY_SCHEMA_VERSION,
  PLANTING_SITE_STATES,
  TREE_STATUS,
  TREE_STORAGE_KEYS,
} from './treeInventoryConstants';
import {
  hashString,
  nowIso,
  safeReadJson,
  safeWriteJson,
  createTreeError,
  getTreeStorage,
} from './treeInventoryValidation';

export const TREE_INVENTORY_INDEX_MANIFEST = Object.freeze([
  { name: 'byJurisdiction', fields: ['jurisdictionId'], purpose: 'Scope every staff query to the signed-in jurisdiction.' },
  { name: 'byWardSpecies', fields: ['jurisdictionId', 'ward', 'speciesId'], purpose: 'Ward and species filters used by the inventory table.' },
  { name: 'byStatusCondition', fields: ['status', 'condition'], purpose: 'Lifecycle and condition filter chips plus summaries.' },
  { name: 'byInspectionDue', fields: ['inspectionDueAt'], purpose: 'Overdue and upcoming inspection reminders, sorted by due date.' },
  { name: 'byCreatedAt', fields: ['createdAt'], purpose: 'Stable newest-first pagination and retention scans.' },
  { name: 'bySearchText', fields: ['publicId', 'ward', 'locality', 'species common name'], purpose: 'Bounded free-text lookup without scanning private notes.' },
  { name: 'byWorkOrderState', fields: ['state', 'assignedTo', 'dueAt'], purpose: 'Maintenance board columns and assignment filters.' },
  { name: 'byCitizenReportState', fields: ['state', 'category', 'jurisdictionId', 'createdAt'], purpose: 'Triage queue, category filters and public tracking lookups.' },
]);

const ALL_BACKUP_KEYS = Object.freeze([
  TREE_STORAGE_KEYS.meta,
  ...TREE_COLLECTION_KEYS,
  TREE_STORAGE_KEYS.idempotency,
  TREE_STORAGE_KEYS.rateLimit,
]);

const readCollection = (storage, key) => {
  const value = safeReadJson(storage, key, []);
  return Array.isArray(value) ? value : [];
};

const snapshotKeys = (storage) => {
  const keys = {};
  for (const key of ALL_BACKUP_KEYS) {
    try {
      keys[key] = storage?.getItem(key) ?? null;
    } catch {
      keys[key] = null;
    }
  }
  return keys;
};

const restoreSnapshot = (storage, snapshot) => {
  for (const key of ALL_BACKUP_KEYS) {
    const raw = snapshot?.[key];
    try {
      if (raw === null || raw === undefined) storage?.removeItem(key);
      else storage?.setItem(key, raw);
    } catch {
      throw createTreeError(TREE_ERROR_CODES.STORAGE_ERROR, `Could not restore ${key}.`);
    }
  }
};

const normalizeLegacyTree = (tree, index, now) => {
  const precise =
    tree.privateCoordinates ||
    (Number.isFinite(Number(tree.latitude)) && Number.isFinite(Number(tree.longitude))
      ? { lat: Number(tree.latitude), lng: Number(tree.longitude) }
      : null);
  const approx = tree.approxCoordinates ||
    (precise
      ? {
          lat: Math.round(Number(precise.lat) * 100) / 100,
          lng: Math.round(Number(precise.lng) * 100) / 100,
          precision: 'approx_1km',
        }
      : null);
  return {
    ...tree,
    id: tree.id || `tree_legacy_${index + 1}`,
    publicId: tree.publicId || `TREE-LEGACY-${String(index + 1).padStart(4, '0')}`,
    jurisdictionId: tree.jurisdictionId || 'blr',
    speciesId: tree.speciesId || tree.species || 'sp_unknown',
    plantingSiteId: tree.plantingSiteId || null,
    condition: tree.condition || 'unknown',
    status: tree.status || TREE_STATUS.ACTIVE,
    plantedOn: tree.plantedOn || tree.plantedDate || null,
    lastInspectionAt: tree.lastInspectionAt || null,
    inspectionDueAt: tree.inspectionDueAt || null,
    approxCoordinates: approx,
    privateCoordinates: precise,
    privateNotes: tree.privateNotes || tree.notes || '',
    risk: tree.risk || { level: 'none', state: 'none', reason: '' },
    isPubliclyListed: tree.isPubliclyListed !== false,
    createdBy: tree.createdBy || 'migration',
    createdAt: tree.createdAt || now,
    updatedAt: tree.updatedAt || now,
    schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
  };
};

const normalizeLegacyReport = (report, index, now) => ({
  ...report,
  id: report.id || `rep_legacy_${index + 1}`,
  trackingCode: report.trackingCode || `TREE-REP-${String(index + 1).padStart(4, '0')}`,
  state: report.state || 'submitted',
  attachments: Array.isArray(report.attachments) ? report.attachments : [],
  triageNotes: report.triageNotes || '',
  createdAt: report.createdAt || now,
  updatedAt: report.updatedAt || now,
  schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
});

export const getTreeInventoryMigrationStatus = (storage = getTreeStorage()) => {
  const meta = safeReadJson(storage, TREE_STORAGE_KEYS.meta, null);
  const currentVersion = Number(meta?.schemaVersion || 0);
  return {
    currentVersion,
    targetVersion: TREE_INVENTORY_SCHEMA_VERSION,
    needsMigration: currentVersion < TREE_INVENTORY_SCHEMA_VERSION,
    isCurrent: currentVersion === TREE_INVENTORY_SCHEMA_VERSION,
    migratedAt: meta?.migratedAt || null,
    previousVersion: meta?.previousVersion ?? null,
    backupAvailable: Boolean(safeReadJson(storage, TREE_STORAGE_KEYS.migrationBackup, null)),
    demoSeeded: Boolean(meta?.demoSeeded),
    counts: {
      trees: readCollection(storage, TREE_STORAGE_KEYS.trees).length,
      species: readCollection(storage, TREE_STORAGE_KEYS.species).length,
      inspections: readCollection(storage, TREE_STORAGE_KEYS.inspections).length,
      workOrders: readCollection(storage, TREE_STORAGE_KEYS.workOrders).length,
      plantingSites: readCollection(storage, TREE_STORAGE_KEYS.plantingSites).length,
      citizenReports: readCollection(storage, TREE_STORAGE_KEYS.citizenReports).length,
      auditEvents: readCollection(storage, TREE_STORAGE_KEYS.audit).length,
    },
  };
};

/**
 * Applies the current schema. Idempotent. On an empty store it installs the
 * species and planting-site reference data, not fake trees.
 *
 * @returns {{changed:boolean, fromVersion:number, toVersion:number, backupAvailable:boolean, dryRun:boolean}}
 */
export const migrateTreeInventory = ({ storage = getTreeStorage(), nowMs = Date.now(), dryRun = false } = {}) => {
  if (!storage) throw createTreeError(TREE_ERROR_CODES.STORAGE_ERROR, 'No storage is available for migration.');
  const status = getTreeInventoryMigrationStatus(storage);
  if (!status.needsMigration) {
    return {
      changed: false,
      fromVersion: status.currentVersion,
      toVersion: TREE_INVENTORY_SCHEMA_VERSION,
      backupAvailable: status.backupAvailable,
      dryRun,
    };
  }

  const now = nowIso(nowMs);
  const meta = safeReadJson(storage, TREE_STORAGE_KEYS.meta, {}) || {};
  const legacyTrees = readCollection(storage, TREE_STORAGE_KEYS.trees)
    .concat(readCollection(storage, TREE_STORAGE_KEYS.legacyTrees));
  const legacyReports = readCollection(storage, TREE_STORAGE_KEYS.citizenReports)
    .concat(readCollection(storage, TREE_STORAGE_KEYS.legacyReports));
  const species = readCollection(storage, TREE_STORAGE_KEYS.species);
  const sites = readCollection(storage, TREE_STORAGE_KEYS.plantingSites);

  const migratedTrees = legacyTrees.map((tree, index) => normalizeLegacyTree(tree, index, now));
  const migratedReports = legacyReports.map((report, index) => normalizeLegacyReport(report, index, now));
  const nextSpecies = species.length > 0 ? species : TREE_SPECIES_CATALOG.map((item) => ({ ...item, schemaVersion: TREE_INVENTORY_SCHEMA_VERSION }));
  const nextSites = sites.length > 0
    ? sites
    : TREE_PLANTING_SITES.map((site) => ({
        ...site,
        state: site.state || PLANTING_SITE_STATES.AVAILABLE,
        createdBy: 'migration',
        createdAt: now,
        updatedAt: now,
        schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
      }));

  const nextMeta = {
    ...meta,
    schemaVersion: TREE_INVENTORY_SCHEMA_VERSION,
    previousVersion: status.currentVersion,
    migratedAt: now,
    migrationId: `migration_${hashString(`${now}|${status.currentVersion}|${legacyTrees.length}`)}`,
    backupAvailable: true,
    checksum: hashString(JSON.stringify({ trees: migratedTrees, species: nextSpecies, sites: nextSites })),
  };

  if (dryRun) {
    return {
      changed: true,
      fromVersion: status.currentVersion,
      toVersion: TREE_INVENTORY_SCHEMA_VERSION,
      backupAvailable: false,
      dryRun: true,
      preview: {
        trees: migratedTrees.length,
        species: nextSpecies.length,
        plantingSites: nextSites.length,
        citizenReports: migratedReports.length,
      },
    };
  }

  const backup = {
    createdAt: now,
    fromVersion: status.currentVersion,
    toVersion: TREE_INVENTORY_SCHEMA_VERSION,
    keys: snapshotKeys(storage),
  };
  if (!safeWriteJson(storage, TREE_STORAGE_KEYS.migrationBackup, backup)) {
    throw createTreeError(TREE_ERROR_CODES.STORAGE_ERROR, 'Could not write the migration backup.');
  }

  const writes = [
    [TREE_STORAGE_KEYS.trees, migratedTrees],
    [TREE_STORAGE_KEYS.citizenReports, migratedReports],
    [TREE_STORAGE_KEYS.species, nextSpecies],
    [TREE_STORAGE_KEYS.plantingSites, nextSites],
    [TREE_STORAGE_KEYS.inspections, readCollection(storage, TREE_STORAGE_KEYS.inspections)],
    [TREE_STORAGE_KEYS.workOrders, readCollection(storage, TREE_STORAGE_KEYS.workOrders)],
    [TREE_STORAGE_KEYS.pruningEvents, readCollection(storage, TREE_STORAGE_KEYS.pruningEvents)],
    [TREE_STORAGE_KEYS.reportAttachments, readCollection(storage, TREE_STORAGE_KEYS.reportAttachments)],
    [TREE_STORAGE_KEYS.triage, readCollection(storage, TREE_STORAGE_KEYS.triage)],
    [TREE_STORAGE_KEYS.audit, readCollection(storage, TREE_STORAGE_KEYS.audit)],
    [TREE_STORAGE_KEYS.meta, nextMeta],
  ];

  for (const [key, value] of writes) {
    if (!safeWriteJson(storage, key, value)) {
      restoreSnapshot(storage, backup.keys);
      throw createTreeError(TREE_ERROR_CODES.STORAGE_ERROR, `Migration failed while writing ${key}; previous data was restored.`);
    }
  }

  return {
    changed: true,
    fromVersion: status.currentVersion,
    toVersion: TREE_INVENTORY_SCHEMA_VERSION,
    backupAvailable: true,
    dryRun: false,
    preview: {
      trees: migratedTrees.length,
      species: nextSpecies.length,
      plantingSites: nextSites.length,
      citizenReports: migratedReports.length,
    },
  };
};

export const rollbackTreeInventoryMigration = ({ storage = getTreeStorage(), nowMs = Date.now() } = {}) => {
  if (!storage) throw createTreeError(TREE_ERROR_CODES.STORAGE_ERROR, 'No storage is available.');
  const backup = safeReadJson(storage, TREE_STORAGE_KEYS.migrationBackup, null);
  if (!backup?.keys) {
    throw createTreeError(TREE_ERROR_CODES.MIGRATION_UNAVAILABLE, 'No migration backup is available.');
  }
  restoreSnapshot(storage, backup.keys);
  try {
    storage.removeItem(TREE_STORAGE_KEYS.migrationBackup);
  } catch {
    // The restore itself succeeded; the marker is best-effort.
  }
  return {
    rolledBack: true,
    restoredVersion: backup.fromVersion,
    restoredAt: nowIso(nowMs),
  };
};

/**
 * Seeds the demonstration register once. Real data is never overwritten: this
 * only runs when the tree collection is empty and the demo flag is absent.
 */
export const ensureTreeInventoryData = ({ storage = getTreeStorage(), nowMs = Date.now() } = {}) => {
  const migration = migrateTreeInventory({ storage, nowMs });
  const meta = safeReadJson(storage, TREE_STORAGE_KEYS.meta, {}) || {};
  const trees = readCollection(storage, TREE_STORAGE_KEYS.trees);
  if (trees.length > 0 || meta.demoSeeded) {
    return { ...migration, seeded: false };
  }

  const now = nowIso(nowMs);
  const seedWrites = [
    [TREE_STORAGE_KEYS.trees, TREE_DEMO_ASSETS.map((tree) => ({ ...tree, schemaVersion: TREE_INVENTORY_SCHEMA_VERSION }))],
    [TREE_STORAGE_KEYS.inspections, TREE_DEMO_INSPECTIONS.map((item) => ({ ...item, schemaVersion: TREE_INVENTORY_SCHEMA_VERSION }))],
    [TREE_STORAGE_KEYS.workOrders, TREE_DEMO_WORK_ORDERS.map((item) => ({ ...item, schemaVersion: TREE_INVENTORY_SCHEMA_VERSION }))],
    [TREE_STORAGE_KEYS.citizenReports, TREE_DEMO_REPORTS.map((item) => ({ ...item, schemaVersion: TREE_INVENTORY_SCHEMA_VERSION }))],
    [TREE_STORAGE_KEYS.meta, { ...meta, demoSeeded: true, demoSeededAt: now }],
  ];
  for (const [key, value] of seedWrites) {
    if (!safeWriteJson(storage, key, value)) {
      throw createTreeError(TREE_ERROR_CODES.STORAGE_ERROR, `Could not seed ${key}.`);
    }
  }
  return { ...migration, seeded: true };
};

const pushTo = (object, key, value) => {
  if (!object[key]) object[key] = [];
  object[key].push(value);
};

/**
 * Builds the documented query indexes from the normalised collections. These
 * are deliberately derived at query time (there is no database planner); the
 * manifest above records what a server deployment must index.
 */
export const buildTreeInventoryIndexes = (storage = getTreeStorage()) => {
  const trees = readCollection(storage, TREE_STORAGE_KEYS.trees);
  const orders = readCollection(storage, TREE_STORAGE_KEYS.workOrders);
  const reports = readCollection(storage, TREE_STORAGE_KEYS.citizenReports);
  const speciesById = Object.fromEntries(readCollection(storage, TREE_STORAGE_KEYS.species).map((s) => [s.id, s]));

  const indexes = {
    byJurisdiction: {},
    byWardSpecies: {},
    byStatusCondition: {},
    byInspectionDue: [],
    byCreatedAt: [],
    bySearchText: [],
    byWorkOrderState: {},
    byCitizenReportState: {},
  };

  for (const tree of trees) {
    const species = speciesById[tree.speciesId];
    pushTo(indexes.byJurisdiction, tree.jurisdictionId, tree.id);
    pushTo(indexes.byWardSpecies, `${tree.jurisdictionId}|${tree.ward}|${tree.speciesId}`, tree.id);
    pushTo(indexes.byStatusCondition, `${tree.status}|${tree.condition}`, tree.id);
    if (tree.inspectionDueAt) {
      indexes.byInspectionDue.push({ treeId: tree.id, dueAt: tree.inspectionDueAt });
    }
    indexes.byCreatedAt.push({ treeId: tree.id, createdAt: tree.createdAt });
    indexes.bySearchText.push({
      treeId: tree.id,
      text: [tree.publicId, tree.ward, tree.locality, species?.commonName, species?.scientificName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    });
  }

  for (const order of orders) {
    pushTo(indexes.byWorkOrderState, `${order.state}|${order.assignedTo || ''}`, order.id);
  }
  for (const report of reports) {
    pushTo(indexes.byCitizenReportState, `${report.state}|${report.jurisdictionId || ''}`, report.id);
  }

  indexes.byInspectionDue.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  indexes.byCreatedAt.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  indexes.manifest = TREE_INVENTORY_INDEX_MANIFEST;
  return indexes;
};
