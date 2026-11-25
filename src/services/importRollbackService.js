import { RollbackSnapshot } from './importBatchService';
import { importBatchService } from './importBatchService';
import { ROLLBACK_SNAPSHOT_TYPE } from '../data/importContract';
import { requirePermission } from './accessControl';
import { actorLabel } from './accessControl';

const ROLLBACK_SNAPSHOTS_KEY = 'civicbridge_rollback_snapshots';

const readRollbackSnapshots = () => {
  try {
    const raw = localStorage.getItem(ROLLBACK_SNAPSHOTS_KEY);
    if (!raw) {
      localStorage.setItem(ROLLBACK_SNAPSHOTS_KEY, JSON.stringify([]));
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const writeRollbackSnapshots = (snapshots) => {
  try {
    localStorage.setItem(ROLLBACK_SNAPSHOTS_KEY, JSON.stringify(snapshots));
    return true;
  } catch (err) {
    console.error('Failed to write rollback snapshots', err);
    return false;
  }
};

/** Create a rollback snapshot for a batch */
export const createRollbackSnapshot = (options) => {
  requirePermission('services.import');

  const snapshots = readRollbackSnapshots();
  const snapshot = RollbackSnapshot({
    id: `snapshot_${Date.now()}`,
    batchId: options.batchId,
    snapshotType: options.snapshotType || ROLLBACK_SNAPSHOT_TYPE.POST_VALIDATION,
    title: options.title || 'Rollback Snapshot',
    description: options.description || '',
    rowCount: options.rowCount,
    fieldMappings: options.fieldMappings || [],
    dataState: options.dataState || {},
    createdAt: new Date().toISOString(),
  });
  snapshots.push(snapshot);
  // Keep only last 50 snapshots per batch, global cap
  writeRollbackSnapshots(snapshots.slice(-50));
  return { ok: true, snapshot };
};

/** List all rollback snapshots for a batch */
export const listRollbackSnapshots = (batchId) => {
  const snapshots = readRollbackSnapshots();
  return snapshots.filter((s) => s.batchId === batchId);
};

/** Rollback to a specific snapshot */
export const rollbackToSnapshot = (snapshotId) => {
  requirePermission('services.import');

  const snapshots = readRollbackSnapshots();
  const snapshot = snapshots.find((s) => s.id === snapshotId);
  if (!snapshot) return { ok: false, error: 'Snapshot not found' };

  const batches = importBatchService.listBatches();
  const batch = batches.find((b) => b.id === snapshot.batchId);
  if (!batch) return { ok: false, error: 'Batch not found' };

  // Record the rollback event
  importBatchService.recordApprovalEvent({
    action: 'rolled_back',
    batchId: snapshot.batchId,
    notes: `Rolled back to snapshot "${snapshot.title}" by ${actorLabel()}`,
    actor: actorLabel(),
  });

  // Restore batch status to before the import
  batch.status = options.preserveStatus !== false ? IMPORT_BATCH_STATUS.ROLLED_BACK : batch.status;
  batch.updatedAt = new Date().toISOString();
  batch.description = `${batch.description || ''} Rolled back to snapshot ${snapshot.id} on ${new Date().toLocaleDateString()}`;

  writeRollbackSnapshots(snapshots); // persist the snapshot list

  return {
    ok: true,
    batch,
    snapshot,
    message: `Successfully rolled back batch ${batch.id} to snapshot "${snapshot.title}"`,
  };
};

/** Delete a rollback snapshot */
export const deleteRollbackSnapshot = (snapshotId) => {
  requirePermission('services.import');

  const snapshots = readRollbackSnapshots();
  const index = snapshots.findIndex((s) => s.id === snapshotId);
  if (index === -1) return { ok: false, error: 'Snapshot not found' };

  const deleted = snapshots[index];
  const remaining = snapshots.filter((s) => s.id !== snapshotId);
  writeRollbackSnapshots(remaining);
  return { ok: true, snapshot: deleted };
};

/** Get rollback statistics */
export const getRollbackStatistics = () => {
  const snapshots = readRollbackSnapshots();
  const total = snapshots.length;
  const byType = {
    [ROLLBACK_SNAPSHOT_TYPE.PRE_IMPORT]: 0,
    [ROLLBACK_SNAPSHOT_TYPE.POST_VALIDATION]: 0,
    [ROLLBACK_SNAPSHOT_TYPE.POST_APPROVAL]: 0,
  };
  const byBatch = {};

  snapshots.forEach((s) => {
    if (byType[s.snapshotType] !== undefined) byType[s.snapshotType]++;
    byBatch[s.batchId] = (byBatch[s.batchId] || 0) + 1;
  });

  return { total, byType, byBatch };
};

/** End of service layer */
export default {
  createRollbackSnapshot,
  listRollbackSnapshots,
  rollbackToSnapshot,
  deleteRollbackSnapshot,
  getRollbackStatistics,
};;