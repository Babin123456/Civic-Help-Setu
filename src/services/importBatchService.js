import { generateImportId, IMPORT_BATCH_STATUS, IMPORT_BATCH_TRANSITIONS, VALIDATION_ERROR_CODE } from '../data/importContract';
import { requirePermission } from './accessControl';
import { actorLabel } from './accessControl';

const BATCHES_KEY = 'civicbridge_import_batches';
const ROWS_KEY = 'civicbridge_import_rows';
const FIELD_MAPPINGS_KEY = 'civicbridge_field_mappings';
const VALIDATION_ERRORS_KEY = 'civicbridge_validation_errors';
const APPROVAL_EVENTS_KEY = 'civicbridge_approval_events';
const ROLLBACK_SNAPSHOTS_KEY = 'civicbridge_rollback_snapshots';

const DEFAULT_BATCHES = [];
const DEFAULT_ROWS = [];
const DEFAULT_FIELD_MAPPINGS = [];
const DEFAULT_VALIDATION_ERRORS = [];
const DEFAULT_APPROVAL_EVENTS = [];
const DEFAULT_ROLLBACK_SNAPSHOTS = [];

/** Core import batch entity */
export const ImportBatch = ({
  id,
  title,
  sourceFile,
  sourceFormat,
  status,
  totalRows,
  validRows,
  invalidRows,
  duplicateRows,
  fieldMappings,
  validationErrors,
  approvalEvent,
  createdAt,
  updatedAt,
  createdBy,
  schemaVersion,
  jurisdiction,
  category,
  description,
}) => ({
  id,
  title,
  sourceFile,
  sourceFormat,
  status,
  totalRows,
  validRows: validRows || 0,
  invalidRows: invalidRows || 0,
  duplicateRows: duplicateRows || 0,
  fieldMappings: fieldMappings || [],
  validationErrors: validationErrors || [],
  approvalEvent: approvalEvent || null,
  createdAt: createdAt || new Date().toISOString(),
  updatedAt: updatedAt || new Date().toISOString(),
  createdBy: createdBy || actorLabel() || 'System',
  schemaVersion: schemaVersion || '1.0.0',
  jurisdiction,
  category,
  description,
});

/** Import row entity */
export const ImportRow = ({
  id,
  rowNumber,
  source,
  rawData,
  mappedData,
  errors,
  warnings,
  status,
}) => ({
  id: id || `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  rowNumber,
  source,
  rawData,
  mappedData: mappedData || {},
  errors: errors || [],
  warnings: warnings || [],
  status: status || 'pending', // pending, valid, invalid, duplicate
});

/** Field mapping entity */
export const FieldMapping = ({
  id,
  sourceField,
  targetField,
  mappingType,
  config,
}) => ({
  id: id || `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  sourceField,
  targetField,
  mappingType,
  config: config || {},
});

/** Validation error entity */
export const ValidationError = ({
  id,
  rowId,
  rowNumber,
  field,
  code,
  message,
  rejectedValue,
  suggestedValue,
}) => ({
  id: id || `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  rowId,
  rowNumber,
  field,
  code,
  message,
  rejectedValue,
  suggestedValue,
});

/** Rollback snapshot entity */
export const RollbackSnapshot = ({
  id,
  batchId,
  snapshotType,
  title,
  description,
  rowCount,
  fieldMappings,
  dataState,
  createdAt,
}) => ({
  id: id || `snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  batchId,
  snapshotType,
  title,
  description,
  rowCount: rowCount || 0,
  fieldMappings: fieldMappings || [],
  dataState: dataState || {},
  createdAt: createdAt || new Date().toISOString(),
});

/** Read current state from localStorage */
const readBatches = () => {
  try {
    const raw = localStorage.getItem(BATCHES_KEY);
    if (!raw) {
      localStorage.setItem(BATCHES_KEY, JSON.stringify(DEFAULT_BATCHES));
      return DEFAULT_BATCHES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_BATCHES;
  }
};

const readRows = () => {
  try {
    const raw = localStorage.getItem(ROWS_KEY);
    if (!raw) {
      localStorage.setItem(ROWS_KEY, JSON.stringify(DEFAULT_ROWS));
      return DEFAULT_ROWS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ROWS;
  }
};

const readFieldMappings = () => {
  try {
    const raw = localStorage.getItem(FIELD_MAPPINGS_KEY);
    if (!raw) {
      localStorage.setItem(FIELD_MAPPINGS_KEY, JSON.stringify(DEFAULT_FIELD_MAPPINGS));
      return DEFAULT_FIELD_MAPPINGS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_FIELD_MAPPINGS;
  }
};

const readValidationErrors = () => {
  try {
    const raw = localStorage.getItem(VALIDATION_ERRORS_KEY);
    if (!raw) {
      localStorage.setItem(VALIDATION_ERRORS_KEY, JSON.stringify(DEFAULT_VALIDATION_ERRORS));
      return DEFAULT_VALIDATION_ERRORS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_VALIDATION_ERRORS;
  }
};

const readApprovalEvents = () => {
  try {
    const raw = localStorage.getItem(APPROVAL_EVENTS_KEY);
    if (!raw) {
      localStorage.setItem(APPROVAL_EVENTS_KEY, JSON.stringify(DEFAULT_APPROVAL_EVENTS));
      return DEFAULT_APPROVAL_EVENTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_APPROVAL_EVENTS;
  }
};

const readRollbackSnapshots = () => {
  try {
    const raw = localStorage.getItem(ROLLBACK_SNAPSHOTS_KEY);
    if (!raw) {
      localStorage.setItem(ROLLBACK_SNAPSHOTS_KEY, JSON.stringify(DEFAULT_ROLLBACK_SNAPSHOTS));
      return DEFAULT_ROLLBACK_SNAPSHOTS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ROLLBACK_SNAPSHOTS;
  }
};

/** Write state to localStorage atomically */
const writeBatches = (batches) => {
  try {
    localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
    return true;
  } catch (err) {
    console.error('Failed to write import batches', err);
    return false;
  }
};

const writeRows = (rows) => {
  try {
    localStorage.setItem(ROWS_KEY, JSON.stringify(rows));
    return true;
  } catch (err) {
    console.error('Failed to write import rows', err);
    return false;
  }
};

const writeFieldMappings = (mappings) => {
  try {
    localStorage.setItem(FIELD_MAPPINGS_KEY, JSON.stringify(mappings));
    return true;
  } catch (err) {
    console.error('Failed to write field mappings', err);
    return false;
  }
};

const writeValidationErrors = (errors) => {
  try {
    localStorage.setItem(VALIDATION_ERRORS_KEY, JSON.stringify(errors));
    return true;
  } catch (err) {
    console.error('Failed to write validation errors', err);
    return false;
  }
};

const writeApprovalEvents = (events) => {
  try {
    localStorage.setItem(APPROVAL_EVENTS_KEY, JSON.stringify(events));
    return true;
  } catch (err) {
    console.error('Failed to write approval events', err);
    return false;
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

/** State transition validation */
const canTransition = (fromStatus, toStatus) => {
  const allowed = IMPORT_BATCH_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
};

/** Service – Import Batch operations */
export const importBatchService = {
  /** List all import batches */
  listBatches: () => readBatches(),

  /** Get a single batch by ID */
  getBatch: (batchId) => {
    const batches = readBatches();
    return batches.find((b) => b.id === batchId) || null;
  },

  /** Create a new draft batch */
  createBatch: (options = {}) => {
    requirePermission('services.import');
    const batches = readBatches();
    const id = generateImportId();
    const now = new Date().toISOString();
    const batch = ImportBatch({
      id,
      title: options.title || 'New Import Batch',
      sourceFile: options.sourceFile || 'untitled',
      sourceFormat: options.sourceFormat || 'csv',
      status: IMPORT_BATCH_STATUS.DRAFT,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      fieldMappings: [],
      validationErrors: [],
      approvalEvent: null,
      createdAt: now,
      updatedAt: now,
      createdBy: options.createdBy || actorLabel(),
      schemaVersion: '1.0.0',
      jurisdiction: options.jurisdiction,
      category: options.category,
      description: options.description,
    });
    batches.push(batch);
    writeBatches(batches);
    return { ok: true, batch };
  },

  /** Update batch status (state transition) */
  updateBatchStatus: (batchId, newStatus) => {
    requirePermission('services.import');
    const batches = readBatches();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return { ok: false, error: 'Batch not found' };

    if (!canTransition(batch.status, newStatus)) {
      return {
        ok: false,
        error: `Invalid transition from "${batch.status}" to "${newStatus}". ` +
          `Allowed transitions from "${batch.status}": ${IMPORT_BATCH_TRANSITIONS[batch.status] || 'none'}`,
      };
    }

    batch.status = newStatus;
    batch.updatedAt = new Date().toISOString();
    // If approving, record approval event
    if (newStatus === IMPORT_BATCH_STATUS.APPROVED && options.approvalEvent) {
      batch.approvalEvent = options.approvalEvent;
      importBatchService.recordApprovalEvent(options.approvalEvent);
    }
    writeBatches(batches);
    return { ok: true, batch };
  },

  /** Add a row to a batch */
  addRow: (batchId, row) => {
    const rows = readRows();
    const importRow = ImportRow({
      ...row,
      id: row.id || `row_${batchId}_${row.rowNumber}`,
    });
    rows.push(importRow);
    writeRows(rows);
    return { ok: true, row: importRow };
  },

  /** Add field mapping */
  addFieldMapping: (mapping) => {
    const mappings = readFieldMappings();
    const fieldMapping = FieldMapping(mapping);
    mappings.push(fieldMapping);
    writeFieldMappings(mappings);
    return { ok: true, mapping: fieldMapping };
  },

  /** Add validation error */
  addValidationError: (error) => {
    const errors = readValidationErrors();
    const validationError = ValidationError(error);
    errors.push(validationError);
    writeValidationErrors(errors);
    return { ok: true, error: validationError };
  },

  /** Record approval event */
  recordApprovalEvent: (event) => {
    const events = readApprovalEvents();
    const approvalEvent = {
      id: event.id || `approval_${Date.now()}`,
      batchId: event.batchId,
      action: event.action, // 'approved', 'rejected', 'rolled_back'
      actor: event.actor || actorLabel(),
      timestamp: new Date().toISOString(),
      notes: event.notes || '',
    };
    events.push(approvalEvent);
    // Keep only last 100 approval events
    writeApprovalEvents(events.slice(-100));
    return { ok: true, approvalEvent };
  },

  /** Create a rollback snapshot */
  createRollbackSnapshot: (options) => {
    const snapshots = readRollbackSnapshots();
    const snapshot = RollbackSnapshot({
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
    // Keep only last 50 snapshots
    writeRollbackSnapshots(snapshots.slice(-50));
    return { ok: true, snapshot };
  },

  /** Rollback to a snapshot */
  rollbackToSnapshot: (snapshotId) => {
    requirePermission('services.import');

    const snapshots = readRollbackSnapshots();
    const snapshot = snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return { ok: false, error: 'Snapshot not found' };

    const batches = readBatches();
    const batch = batches.find((b) => b.id === snapshot.batchId);
    if (!batch) return { ok: false, error: 'Batch not found' };

    // Record the rollback as an approval event
    importBatchService.recordApprovalEvent({
      action: 'rolled_back',
      batchId: snapshot.batchId,
      notes: `Rolled back to snapshot: ${snapshot.title || ''}`,
      actor: actorLabel(),
    });

    // Restore batch to previous state (reset to before the import)
    batch.status = IMPORT_BATCH_STATUS.ROLLED_BACK;
    batch.updatedAt = new Date().toISOString();
    batch.description = `${batch.description || ''} Rolled back to snapshot ${snapshot.id} on ${new Date().toLocaleDateString()}`;

    writeBatches(batches);
    return { ok: true, batch, snapshot };
  },

  /** Delete a batch (move to archived) */
  deleteBatch: (batchId) => {
    requirePermission('services.import');
    const batches = readBatches();
    const index = batches.findIndex((b) => b.id === batchId);
    if (index === -1) return { ok: false, error: 'Batch not found' };

    const batch = batches[index];
    batch.status = IMPORT_BATCH_STATUS.ARCHIVED;
    batch.updatedAt = new Date().toISOString();
    writeBatches(batches);
    return { ok: true, batch };
  },

  /** Get statistics across all batches */
  getStatistics: () => {
    const batches = readBatches();
    const total = batches.length;
    const approved = batches.filter((b) => b.status === IMPORT_BATCH_STATUS.APPROVED).length;
    const failed = batches.filter((b) => b.status === IMPORT_BATCH_STATUS.FAILED).length;
    const rolledBack = batches.filter((b) => b.status === IMPORT_BATCH_STATUS.ROLLED_BACK).length;
    const totalRows = batches.reduce((sum, b) => sum + (b.totalRows || 0), 0);
    const validRows = batches.reduce((sum, b) => sum + (b.validRows || 0), 0);
    const invalidRows = batches.reduce((sum, b) => sum + (b.invalidRows || 0), 0);

    return { total, approved, failed, rolledBack, totalRows, validRows, invalidRows };
  },

  /** List all import batches */
  listBatches: () => readBatches(),

  /** Create a new draft batch */
  createBatch: (options = {}) => {
    requirePermission('services.import');
    const batches = readBatches();
    const id = generateImportId();
    const now = new Date().toISOString();
    const batch = ImportBatch({
      id,
      title: options.title || 'New Import Batch',
      sourceFile: options.sourceFile || 'untitled',
      sourceFormat: options.sourceFormat || 'csv',
      status: IMPORT_BATCH_STATUS.DRAFT,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      fieldMappings: [],
      validationErrors: [],
      approvalEvent: null,
      createdAt: now,
      updatedAt: now,
      createdBy: options.createdBy || actorLabel(),
      schemaVersion: '1.0.0',
      jurisdiction: options.jurisdiction,
      category: options.category,
      description: options.description,
    });
    batches.push(batch);
    writeBatches(batches);
    return { ok: true, batch };
  },

  /** Update batch status (state transition) */
  updateBatchStatus: (batchId, newStatus) => {
    requirePermission('services.import');
    const batches = readBatches();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return { ok: false, error: 'Batch not found' };

    if (!canTransition(batch.status, newStatus)) {
      return {
        ok: false,
        error: `Invalid transition from "${batch.status}" to "${newStatus}". ` +
          `Allowed transitions from "${batch.status}": ${IMPORT_BATCH_TRANSITIONS[batch.status] || 'none'}`,
      };
    }

    batch.status = newStatus;
    batch.updatedAt = new Date().toISOString();
    // If approving, record approval event
    if (newStatus === IMPORT_BATCH_STATUS.APPROVED && options.approvalEvent) {
      batch.approvalEvent = options.approvalEvent;
      importBatchService.recordApprovalEvent(options.approvalEvent);
    }
    writeBatches(batches);
    return { ok: true, batch };
  },

  /** Add a validation error */
  addValidationError: (error) => {
    const errors = readValidationErrors();
    const validationError = ValidationError(error);
    errors.push(validationError);
    writeValidationErrors(errors);
    return { ok: true, error: validationError };
  },

  /** Record an approval event */
  recordApprovalEvent: (event) => {
    const events = readApprovalEvents();
    const approvalEvent = {
      id: event.id || `approval_${Date.now()}`,
      batchId: event.batchId,
      action: event.action, // 'approved', 'rejected', 'rolled_back'
      actor: event.actor || actorLabel(),
      timestamp: new Date().toISOString(),
      notes: event.notes || '',
    };
    events.push(approvalEvent);
    // Keep only last 100 approval events
    writeApprovalEvents(events.slice(-100));
    return { ok: true, approvalEvent };
  },

  /** Create a rollback snapshot */
  createRollbackSnapshot: (options) => {
    const snapshots = readRollbackSnapshots();
    const snapshot = RollbackSnapshot({
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
    // Keep only last 50 snapshots
    writeRollbackSnapshots(snapshots.slice(-50));
    return { ok: true, snapshot };
  },

  /** Rollback to a snapshot */
  rollbackToSnapshot: (snapshotId) => {
    requirePermission('services.import');

    const snapshots = readRollbackSnapshots();
    const snapshot = snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return { ok: false, error: 'Snapshot not found' };

    const batches = readBatches();
    const batch = batches.find((b) => b.id === snapshot.batchId);
    if (!batch) return { ok: false, error: 'Batch not found' };

    // Record the rollback as an approval event
    importBatchService.recordApprovalEvent({
      action: 'rolled_back',
      batchId: snapshot.batchId,
      notes: `Rolled back to snapshot: ${snapshot.title || ''}`,
      actor: actorLabel(),
    });

    // Restore batch to previous state (reset to before the import)
    batch.status = IMPORT_BATCH_STATUS.ROLLED_BACK;
    batch.updatedAt = new Date().toISOString();
    batch.description = `${batch.description || ''} Rolled back to snapshot ${snapshot.id} on ${new Date().toLocaleDateString()}`;

    writeBatches(batches);
    return { ok: true, batch, snapshot };
  },

  /** Delete a batch (move to archived) */
  deleteBatch: (batchId) => {
    requirePermission('services.import');
    const batches = readBatches();
    const index = batches.findIndex((b) => b.id === batchId);
    if (index === -1) return { ok: false, error: 'Batch not found' };

    const batch = batches[index];
    batch.status = IMPORT_BATCH_STATUS.ARCHIVED;
    batch.updatedAt = new Date().toISOString();
    writeBatches(batches);
    return { ok: true, batch };
  },
};
export default importBatchService;


  

