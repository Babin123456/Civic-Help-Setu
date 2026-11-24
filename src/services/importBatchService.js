import {
  generateImportId,
  IMPORT_BATCH_STATUS,
  IMPORT_BATCH_TRANSITIONS,
  VALIDATION_ERROR_CODE,
  ROLLBACK_SNAPSHOT_TYPE,
} from '../data/importContract';
import { requirePermission, actorLabel } from './accessControl';
import { normalizeName } from './serviceImportService';
import { getAdminServices, importAdminServices } from './adminService';
import { validateImportRecord } from './importValidationService';
import { logDiagnostic } from '../utils/diagnostics';

const BATCHES_KEY = 'civicbridge_import_batches';
const ROWS_KEY = 'civicbridge_import_rows';
const FIELD_MAPPINGS_KEY = 'civicbridge_field_mappings';
const VALIDATION_ERRORS_KEY = 'civicbridge_validation_errors';
const APPROVAL_EVENTS_KEY = 'civicbridge_approval_events';
const ROLLBACK_SNAPSHOTS_KEY = 'civicbridge_rollback_snapshots';

/** Wrap an array so it can be used either synchronously or with .then() / await */
const asPromiseArray = (arr) => {
  const result = [...arr];
  result.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  result.catch = (onRejected) => Promise.resolve(result).catch(onRejected);
  return result;
};

/** Core import batch entity */
export const ImportBatch = ({
  id,
  title = 'New Import Batch',
  sourceFile = 'untitled',
  sourceFormat = 'csv',
  status = IMPORT_BATCH_STATUS.DRAFT,
  totalRows = 0,
  validRows = 0,
  invalidRows = 0,
  duplicateRows = 0,
  fieldMappings = [],
  validationErrors = [],
  deadLetterQueue = [],
  retryAttempts = 0,
  approvalEvent = null,
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
  createdBy = actorLabel() || 'System',
  schemaVersion = '1.0.0',
  jurisdiction,
  category,
  description,
} = {}) => ({
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
  deadLetterQueue,
  retryAttempts,
  approvalEvent,
  createdAt,
  updatedAt,
  createdBy,
  schemaVersion,
  jurisdiction,
  category,
  description,
});

/** Import row entity */
export const ImportRow = ({
  id = `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  rowNumber,
  source,
  rawData,
  mappedData = {},
  errors = [],
  warnings = [],
  status = 'pending',
} = {}) => ({ id, rowNumber, source, rawData, mappedData, errors, warnings, status });

/** Field mapping entity */
export const FieldMapping = ({
  id = `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  sourceField,
  targetField,
  mappingType,
  config = {},
} = {}) => ({ id, sourceField, targetField, mappingType, config });

/** Validation error entity */
export const ValidationError = ({
  id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  rowId,
  rowNumber,
  field,
  code,
  message,
  rejectedValue,
  suggestedValue,
} = {}) => ({ id, rowId, rowNumber, field, code, message, rejectedValue, suggestedValue });

/** Rollback snapshot entity */
export const RollbackSnapshot = ({
  id = `snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  batchId,
  snapshotType = ROLLBACK_SNAPSHOT_TYPE.POST_VALIDATION,
  title = 'Rollback Snapshot',
  description = '',
  rowCount = 0,
  fieldMappings = [],
  dataState = {},
  createdAt = new Date().toISOString(),
} = {}) => ({ id, batchId, snapshotType, title, description, rowCount, fieldMappings, dataState, createdAt });

/** Storage access helpers with corrupted data & quota error fallback */
const readStorageList = (key, label) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (label) logDiagnostic(label, err);
    return [];
  }
};

const writeStorageList = (key, list, label) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch (err) {
    if (label) logDiagnostic(label, err);
    return false;
  }
};

const readBatches = () => readStorageList(BATCHES_KEY, 'Failed to read import batches');
const readRows = () => readStorageList(ROWS_KEY);
const readFieldMappings = () => readStorageList(FIELD_MAPPINGS_KEY);
const readValidationErrors = () => readStorageList(VALIDATION_ERRORS_KEY);
const readApprovalEvents = () => readStorageList(APPROVAL_EVENTS_KEY);
const readRollbackSnapshots = () => readStorageList(ROLLBACK_SNAPSHOTS_KEY);

const writeBatches = (batches) => writeStorageList(BATCHES_KEY, batches, 'Failed to write import batches');
const writeRows = (rows) => writeStorageList(ROWS_KEY, rows, 'Failed to write import rows');
const writeFieldMappings = (mappings) => writeStorageList(FIELD_MAPPINGS_KEY, mappings, 'Failed to write field mappings');
const writeValidationErrors = (errors) => writeStorageList(VALIDATION_ERRORS_KEY, errors, 'Failed to write validation errors');
const writeApprovalEvents = (events) => writeStorageList(APPROVAL_EVENTS_KEY, events, 'Failed to write approval events');
const writeRollbackSnapshots = (snapshots) => writeStorageList(ROLLBACK_SNAPSHOTS_KEY, snapshots, 'Failed to write rollback snapshots');

/** State transition validation */
const canTransition = (fromStatus, toStatus) => {
  const allowed = IMPORT_BATCH_TRANSITIONS[fromStatus];
  return Boolean(allowed && (allowed.includes(toStatus) || allowed.includes(toStatus.toUpperCase())));
};

/** Service – Import Batch operations */
export const importBatchService = {
  /** List all import batches (supports sync usage and Promise/.then/await) */
  listBatches: () => asPromiseArray(readBatches()),

  /** Get a single batch by ID */
  getBatch: (batchId) => readBatches().find((b) => b.id === batchId) || null,

  /** Update an existing batch */
  updateBatch: (batch) => {
    requirePermission('services.import');
    const batches = readBatches();
    const index = batches.findIndex((b) => b.id === batch.id);
    if (index === -1) return { ok: false, error: 'Batch not found' };
    batches[index] = { ...batches[index], ...batch, updatedAt: new Date().toISOString() };
    return writeBatches(batches) ? { ok: true, batch: batches[index] } : { ok: false, error: 'Failed to write batch to storage' };
  },

  /** Create a new draft batch */
  createBatch: (options = {}) => {
    requirePermission('services.import');
    const batches = readBatches();
    const batch = ImportBatch({
      id: generateImportId(),
      title: options.title,
      sourceFile: options.sourceFile,
      sourceFormat: options.sourceFormat,
      status: IMPORT_BATCH_STATUS.DRAFT,
      createdBy: options.createdBy,
      jurisdiction: options.jurisdiction,
      category: options.category,
      description: options.description,
    });
    batches.push(batch);
    return writeBatches(batches) ? { ok: true, batch } : { ok: false, error: 'Failed to save batch to storage' };
  },

  /** Update batch status (state transition) */
  updateBatchStatus: (batchId, newStatus, options = {}) => {
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
    if (newStatus === IMPORT_BATCH_STATUS.APPROVED && options.approvalEvent) {
      batch.approvalEvent = options.approvalEvent;
      importBatchService.recordApprovalEvent(options.approvalEvent);
    }
    return writeBatches(batches) ? { ok: true, batch } : { ok: false, error: 'Failed to update batch status in storage' };
  },

  /** Add a row to a batch */
  addRow: (batchId, row) => {
    const rows = readRows();
    const importRow = ImportRow({ ...row, id: row.id || `row_${batchId}_${row.rowNumber}` });
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
      action: event.action,
      actor: event.actor || actorLabel(),
      timestamp: new Date().toISOString(),
      notes: event.notes || '',
    };
    events.push(approvalEvent);
    writeApprovalEvents(events.slice(-100));
    return { ok: true, approvalEvent };
  },

  /** Create a rollback snapshot */
  createRollbackSnapshot: (options) => {
    const snapshots = readRollbackSnapshots();
    const snapshot = RollbackSnapshot({
      batchId: options.batchId,
      snapshotType: options.snapshotType,
      title: options.title,
      description: options.description,
      rowCount: options.rowCount,
      fieldMappings: options.fieldMappings,
      dataState: options.dataState,
    });
    snapshots.push(snapshot);
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

    importBatchService.recordApprovalEvent({
      action: 'rolled_back',
      batchId: snapshot.batchId,
      notes: `Rolled back to snapshot: ${snapshot.title || ''}`,
      actor: actorLabel(),
    });

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

  /** Get dead-letter queue for a batch */
  getDeadLetterQueue: (batchId) => importBatchService.getBatch(batchId)?.deadLetterQueue || [],

  /** Reprocess ONLY the quarantined/failed rows from a batch with idempotency */
  retryBatch: (batchId, options = {}) => {
    requirePermission('services.import');
    const batches = readBatches();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return { ok: false, error: 'Batch not found' };

    const quarantined = batch.deadLetterQueue || [];
    if (quarantined.length === 0) {
      return { ok: true, message: 'No quarantined rows to retry', batch, retried: 0, succeeded: 0, remaining: 0 };
    }

    const existingServices = options.existingServices || getAdminServices() || [];
    const existingIds = new Map(existingServices.map((s) => [s.id, s.name]));
    const existingNames = new Map(existingServices.map((s) => [normalizeName(s.name), s.name]));

    const succeeded = [];
    const remainingQuarantined = [];
    const attemptIncrement = (batch.retryAttempts || 0) + 1;
    batch.retryAttempts = attemptIncrement;

    for (const item of quarantined) {
      const raw = (options.updatedRowsMap && options.updatedRowsMap[item.rowIndex ?? item.rowNumber]) || item.rawData || {};
      const { service, errors, errorDetails } = validateImportRecord(raw);

      const pushQuarantine = (status, reason, codes, fields, errorList) => {
        remainingQuarantined.push({
          ...item,
          rawData: raw,
          errors: errorList,
          reasonCodes: codes,
          fields,
          reason,
          attemptCount: (item.attemptCount || 1) + 1,
          timestamp: new Date().toISOString(),
          status,
        });
      };

      if (!service) {
        pushQuarantine(
          'invalid',
          errors?.[0] || 'Validation failed',
          errorDetails?.map((d) => d.code) || [VALIDATION_ERROR_CODE.INVALID_VALUE],
          errorDetails?.map((d) => d.field) || ['unknown'],
          errors,
        );
        continue;
      }

      const key = service.id;
      const normalizedName = normalizeName(service.name);

      if (existingIds.has(key)) {
        const reason = `id "${key}" already exists (${existingIds.get(key)})`;
        pushQuarantine('duplicate', reason, [VALIDATION_ERROR_CODE.DUPLICATE_ID], ['id'], [reason]);
      } else if (existingNames.has(normalizedName)) {
        const reason = `a service named "${existingNames.get(normalizedName)}" already exists`;
        pushQuarantine('duplicate', reason, [VALIDATION_ERROR_CODE.DUPLICATE_NAME], ['name'], [reason]);
      } else {
        const saveResult = importAdminServices([service], actorLabel());
        if (!saveResult.ok) {
          pushQuarantine(
            'invalid',
            saveResult.error || 'Storage error',
            [VALIDATION_ERROR_CODE.INVALID_VALUE],
            ['storage'],
            [saveResult.error || 'Failed to save to storage'],
          );
        } else {
          existingIds.set(key, service.name);
          existingNames.set(normalizedName, service.name);
          succeeded.push(service);
        }
      }
    }

    batch.validRows = (batch.validRows || 0) + succeeded.length;
    batch.invalidRows = remainingQuarantined.filter((r) => r.status === 'invalid').length;
    batch.duplicateRows = remainingQuarantined.filter((r) => r.status === 'duplicate').length;
    batch.deadLetterQueue = remainingQuarantined;
    batch.updatedAt = new Date().toISOString();

    if (!writeBatches(batches)) {
      return { ok: false, error: 'Failed to update batch in storage (browser storage may be full)', batch };
    }

    importBatchService.recordApprovalEvent({
      action: 'retried',
      batchId,
      notes: `Retry attempt #${attemptIncrement}: ${succeeded.length} succeeded, ${remainingQuarantined.length} remain quarantined`,
      actor: actorLabel(),
    });

    return {
      ok: true,
      batch,
      retried: quarantined.length,
      succeeded: succeeded.length,
      remaining: remainingQuarantined.length,
    };
  },

  /** Get statistics across all batches */
  getStatistics: () => {
    const batches = readBatches();
    return {
      total: batches.length,
      approved: batches.filter((b) => b.status === IMPORT_BATCH_STATUS.APPROVED).length,
      failed: batches.filter((b) => b.status === IMPORT_BATCH_STATUS.FAILED).length,
      rolledBack: batches.filter((b) => b.status === IMPORT_BATCH_STATUS.ROLLED_BACK).length,
      totalRows: batches.reduce((sum, b) => sum + (b.totalRows || 0), 0),
      validRows: batches.reduce((sum, b) => sum + (b.validRows || 0), 0),
      invalidRows: batches.reduce((sum, b) => sum + (b.invalidRows || 0), 0),
    };
  },
};

export default importBatchService;
