import {
  IMPORT_BATCH_STATUS,
  VALIDATION_ERROR_CODE,
  ROLLBACK_SNAPSHOT_TYPE,
  SERVICE_CATEGORIES,
  DELIVERY_TYPES,
  DIFFICULTIES,
  FEE_TYPES,
} from '../data/importContract';
import { importBatchService } from './importBatchService';
import { requirePermission, actorLabel } from './accessControl';
import {
  CSV_COLUMNS,
  slugify,
  normalizeName,
} from './serviceImportService';
import { importAdminServices } from './adminService';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB (Slice 2 limit)
export const MAX_IMPORT_ROWS = 5000;             // 5,000 rows (Slice 2 limit)
export const DEFAULT_CHUNK_SIZE = 100;           // 100 rows per chunk

/** Neutralize CSV formula injection by prepending ' to cells starting with =, +, -, @, \t, or \r */
export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

/** Format a cell for RFC 4180 CSV output with formula injection neutralization */
export function formatCsvCell(value) {
  const str = sanitizeCsvCell(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Generate failed-rows CSV from a dead-letter queue, preserving original columns and failure reasons */
export function generateFailedRowsCsv(deadLetterQueue = []) {
  if (!Array.isArray(deadLetterQueue) || deadLetterQueue.length === 0) return '';

  const rawKeySet = new Set();
  deadLetterQueue.forEach((item) => {
    if (item.rawData && typeof item.rawData === 'object') {
      Object.keys(item.rawData).forEach((k) => rawKeySet.add(k));
    }
  });

  const columns = [...CSV_COLUMNS];
  rawKeySet.forEach((k) => {
    if (!columns.includes(k)) columns.push(k);
  });

  const failureColumns = ['failure_reason', 'failure_codes', 'failure_fields', 'row_number', 'attempt_count'];
  const allHeaders = [...columns, ...failureColumns];

  const headerLine = allHeaders.map(formatCsvCell).join(',');
  const rowLines = deadLetterQueue.map((item) => {
    const raw = item.rawData || {};
    const values = columns.map((col) => {
      const val = raw[col];
      return Array.isArray(val) ? val.join('|') : (val ?? '');
    });
    values.push(
      item.reason || item.errors?.join('; ') || '',
      Array.isArray(item.reasonCodes) ? item.reasonCodes.join('; ') : (item.reasonCodes || ''),
      Array.isArray(item.fields) ? item.fields.join('; ') : (item.fields || ''),
      item.rowIndex ?? item.rowNumber ?? '',
      item.attemptCount ?? 1,
    );
    return values.map(formatCsvCell).join(',');
  });

  return [headerLine, ...rowLines].join('\n') + '\n';
}

/** Validate a single record against the schema, returning errors or the mapped service */
export function validateImportRecord(raw, existingServiceIds = new Map()) {
  const errors = [];
  const errorDetails = [];
  const warnings = [];

  const addError = (field, code, message) => {
    errors.push(message);
    errorDetails.push({ field, code, message });
  };

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    addError('record', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'Each record must be an object');
    return { service: null, errors, errorDetails, warnings };
  }

  const name = raw.name ? String(raw.name).trim() : '';
  if (!name) {
    addError('name', VALIDATION_ERROR_CODE.REQUIRED_FIELD, 'name is required');
  }

  const category = raw.category ? String(raw.category).trim() : '';
  if (!category) {
    addError('category', VALIDATION_ERROR_CODE.REQUIRED_FIELD, 'category is required');
  } else if (!SERVICE_CATEGORIES.includes(category)) {
    addError('category', VALIDATION_ERROR_CODE.INVALID_VALUE, `category must be one of: ${SERVICE_CATEGORIES.join(', ')}`);
  }

  const id = raw.id ? String(raw.id).trim() : slugify(name);
  if (raw.id !== undefined && raw.id !== '' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    addError('id', VALIDATION_ERROR_CODE.INVALID_FORMAT, `id "${raw.id}" must be lowercase letters, numbers and dashes`);
  }
  if (name && !id) {
    addError('id', VALIDATION_ERROR_CODE.INVALID_VALUE, 'name must contain letters or numbers so an id can be generated');
  }

  const type = raw.type ? String(raw.type).trim() : '';
  if (raw.type !== undefined && !DELIVERY_TYPES.includes(type)) {
    addError('type', VALIDATION_ERROR_CODE.INVALID_VALUE, `type must be one of: ${DELIVERY_TYPES.join(', ')}`);
  }

  const difficulty = raw.difficulty ? String(raw.difficulty).trim() : '';
  if (raw.difficulty !== undefined && !DIFFICULTIES.includes(difficulty)) {
    addError('difficulty', VALIDATION_ERROR_CODE.INVALID_VALUE, `difficulty must be one of: ${DIFFICULTIES.join(', ')}`);
  }

  const feeType = raw.feeType ? String(raw.feeType).trim() : '';
  if (raw.feeType !== undefined && !FEE_TYPES.includes(feeType)) {
    addError('feeType', VALIDATION_ERROR_CODE.INVALID_VALUE, 'feeType must be "free" or "paid"');
  }

  if (raw.speedDays !== undefined) {
    const sd = Number(raw.speedDays);
    if (!(Number.isInteger(sd) && sd > 0)) {
      addError('speedDays', VALIDATION_ERROR_CODE.INVALID_VALUE, 'speedDays must be a whole number greater than 0');
    }
  }

  if (raw.fees !== undefined && typeof raw.fees !== 'string') {
    addError('fees', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'fees must be text');
  }

  if (raw.processingTime !== undefined && typeof raw.processingTime !== 'string') {
    addError('processingTime', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'processingTime must be text');
  }

  if (raw.eligibility !== undefined && (!Array.isArray(raw.eligibility) || !raw.eligibility.every((v) => typeof v === 'string' && v.trim()))) {
    addError('eligibility', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'eligibility must be a list of non-empty text values');
  }

  if (raw.documents !== undefined && (!Array.isArray(raw.documents) || !raw.documents.every((v) => typeof v === 'string' && v.trim()))) {
    addError('documents', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'documents must be a list of non-empty text values');
  }

  if (raw.warnings !== undefined && !Array.isArray(raw.warnings)) {
    addError('warnings', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'warnings must be a list');
  }

  if (raw.officialSourceUrl) {
    try {
      const { protocol } = new URL(raw.officialSourceUrl);
      if (protocol !== 'https:' && protocol !== 'http:') {
        addError('officialSourceUrl', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'officialSourceUrl must be a valid http(s) URL');
      }
    } catch {
      addError('officialSourceUrl', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'officialSourceUrl must be a valid http(s) URL');
    }
  }

  const hasOfficialSource = raw.officialSourceUrl || (Array.isArray(raw.officialSources) && raw.officialSources.length > 0);
  if (!hasOfficialSource) {
    addError('officialSourceUrl', VALIDATION_ERROR_CODE.REQUIRED_FIELD, 'at least one official source URL is required');
  }

  if (raw.steps !== undefined && raw.steps && (!Array.isArray(raw.steps) || !raw.steps.every((s) => s && typeof s === 'object' && typeof s.title === 'string' && typeof s.description === 'string'))) {
    addError('steps', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'steps must be a list of { title, description } objects');
  }

  if (raw.officialSources !== undefined) {
    if (!Array.isArray(raw.officialSources)) {
      addError('officialSources', VALIDATION_ERROR_CODE.INVALID_FORMAT, 'officialSources must be a list');
    } else {
      raw.officialSources.forEach((src, idx) => {
        if (!src || typeof src !== 'object') {
          addError(`officialSources[${idx}]`, VALIDATION_ERROR_CODE.INVALID_FORMAT, `officialSources[${idx}] must be an object`);
        } else if (src.url && !/^https?:\/\//i.test(src.url)) {
          addError(`officialSources[${idx}]`, VALIDATION_ERROR_CODE.INVALID_FORMAT, `officialSources[${idx}] URL must be a valid http(s) link`);
        }
      });
    }
  }

  const normalizedId = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (existingServiceIds.has(normalizedId)) {
    addError('id', VALIDATION_ERROR_CODE.DUPLICATE_ID, `id "${normalizedId}" already exists (${existingServiceIds.get(normalizedId)})`);
  }

  if (errors.length > 0) return { service: null, errors, errorDetails, warnings };

  const service = {
    id: normalizedId,
    name,
    shortDescription: raw.shortDescription ? String(raw.shortDescription).trim() : '',
    category,
    department: raw.department ? String(raw.department).trim() : '',
    type: type || 'Online / Offline',
    difficulty: difficulty || 'Medium',
    feeType: feeType || 'free',
    fees: raw.fees ? String(raw.fees).trim() : '',
    processingTime: raw.processingTime ? String(raw.processingTime).trim() : '',
    eligibility: raw.eligibility ? raw.eligibility.map((e) => (typeof e === 'string' ? e.trim() : String(e))) : [],
    documents: raw.documents ? raw.documents.map((d) => (typeof d === 'string' ? d.trim() : String(d))) : [],
    steps: raw.steps ? raw.steps.map((s) => ({ title: String(s.title).trim(), description: String(s.description).trim() })) : [],
    officialSources: raw.officialSources || [{ name: 'Official Government Portal', url: raw.officialSourceUrl || '', verified: false }],
    warnings: raw.warnings ? raw.warnings.map((w) => String(w).trim()) : [],
  };

  if (raw.speedDays !== undefined) service.speedDays = Number(raw.speedDays);
  if (raw.lastVerified !== undefined) service.lastVerified = String(raw.lastVerified).trim();

  return { service, errors, errorDetails, warnings };
}

/** Parse CSV text and produce line-delimited cells */
export function parseCsvImport(text) {
  const rows = [];
  let field = '';
  let row = [];
  let line = 1;
  let rowStartLine = 1;
  let inQuotes = false;
  let afterQuote = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endRow = () => {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) {
      rows.push({ line: rowStartLine, cells: [...row] });
    }
    row = [];
    field = '';
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
        afterQuote = true;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === ',') {
      row.push(field);
      field = '';
      afterQuote = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      line++;
      rowStartLine = line;
      afterQuote = false;
    } else if (afterQuote) {
      throw new Error(`Unexpected text after a closing quote on line ${line}; quote the whole field`);
    } else if (ch === '"') {
      if (field !== '') {
        throw new Error(`Unexpected quote in the middle of a field on line ${line}; wrap the field in quotes and double the inner quote ("")`);
      }
      inQuotes = true;
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    throw new Error(`Unclosed quote in the row starting on line ${rowStartLine}`);
  }
  if (field !== '' || row.length) endRow();
  return rows;
}

const splitPipes = (value) =>
  String(value || '')
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);

/** Parse CSV text into raw records with line numbers */
export function csvToImportRecords(text, warnings = []) {
  const rows = parseCsvImport(text);
  if (rows.length === 0) throw new Error('The file is empty');

  const [header, ...dataRows] = rows;
  const knownFields = new Set([
    'id', 'name', 'shortDescription', 'category', 'department', 'type',
    'difficulty', 'feeType', 'fees', 'processingTime', 'speedDays',
    'eligibility', 'documents', 'warnings', 'officialSourceName',
    'officialSourceUrl', 'lastVerified', 'steps', 'officialSources',
  ]);
  const pipeColumns = new Set(['eligibility', 'documents', 'warnings']);
  const headerLookup = new Map([...knownFields].map((f) => [f.toLowerCase().replace(/[^a-z0-9]/g, ''), f]));

  const columns = header.cells.map((h) => {
    const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    const field = headerLookup.get(key);
    if (!field && h.trim()) warnings.push(`Unknown column "${h.trim()}" was ignored`);
    return field || null;
  });

  return dataRows.map(({ line, cells }) => {
    const raw = {};
    columns.forEach((field, idx) => {
      if (!field) return;
      const cellVal = cells[idx] ?? '';
      const value = cellVal.trim();
      if (value === '') return;
      raw[field] = pipeColumns.has(field) ? splitPipes(cellVal) : value;
    });

    if (raw.speedDays !== undefined) {
      raw.speedDays = Number(raw.speedDays);
    }
    return { row: line, raw };
  });
}

/** Parse JSON text into import records */
export function jsonToImportRecords(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`, { cause: err });
  }
  const list = Array.isArray(data) ? data : data?.services;
  if (!Array.isArray(list)) {
    throw new Error('JSON must be an array of service records or an object with a "services" array');
  }
  return list.map((raw, idx) => {
    if (raw && typeof raw === 'object' && !raw.officialSources && raw.officialSourceUrl) {
      const { officialSourceName, officialSourceUrl, ...rest } = raw;
      raw = { ...rest, officialSources: [{ name: officialSourceName, url: officialSourceUrl }] };
    }
    return { row: idx + 1, raw };
  });
}

/** Detect file format from filename and content */
export const detectImportFormat = (fileName, text) => {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.csv')) return 'csv';
  return /^\s*[[{]/.test(text) ? 'json' : 'csv';
};

/** Build import preview: every record lands in valid / invalid / duplicates */
export function buildImportPreview(text, { fileName = '', existingServices = [] } = {}) {
  const report = {
    fileName,
    format: null,
    fileErrors: [],
    warnings: [],
    valid: [],
    invalid: [],
    duplicates: [],
    total: 0,
  };

  if (typeof text !== 'string' || text.trim() === '') {
    report.fileErrors.push('The file is empty');
    return report;
  }
  if (new Blob([text]).size > MAX_IMPORT_BYTES) {
    report.fileErrors.push(`The file is larger than ${MAX_IMPORT_BYTES / 1024} KB`);
    return report;
  }

  report.format = detectImportFormat(fileName, text);
  let records;
  try {
    records = report.format === 'json' ? jsonToImportRecords(text) : csvToImportRecords(text, report.warnings);
  } catch (err) {
    report.fileErrors.push(err.message);
    return report;
  }

  report.total = records.length;
  if (records.length === 0) {
    report.fileErrors.push('No service records were found in the file');
    return report;
  }
  if (records.length > MAX_IMPORT_ROWS) {
    report.fileErrors.push(`The file has ${records.length} records; the limit is ${MAX_IMPORT_ROWS} per import`);
    return report;
  }

  const existingIds = new Map(existingServices.map((s) => [s.id, s.name]));
  const existingNames = new Map(existingServices.map((s) => [normalizeName(s.name), s.name]));
  const seenIds = new Map();
  const seenNames = new Map();

  for (const { row, raw } of records) {
    const { service, errors, errorDetails, warnings: recWarnings } = validateImportRecord(raw);
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';

    if (!service) {
      report.invalid.push({ row, name, raw, errors, errorDetails, warnings: recWarnings });
      continue;
    }

    const key = service.id;
    const normalizedName = normalizeName(service.name || name);
    let reason = null;
    let code = null;
    let field = null;

    if (existingIds.has(key)) {
      reason = `id "${key}" already exists (${existingIds.get(key)})`;
      code = VALIDATION_ERROR_CODE.DUPLICATE_ID;
      field = 'id';
    } else if (existingNames.has(normalizedName)) {
      reason = `a service named "${existingNames.get(normalizedName)}" already exists`;
      code = VALIDATION_ERROR_CODE.DUPLICATE_NAME;
      field = 'name';
    } else if (seenIds.has(key)) {
      reason = `same id as row ${seenIds.get(key)} in this file`;
      code = VALIDATION_ERROR_CODE.DUPLICATE_ID;
      field = 'id';
    } else if (seenNames.has(normalizedName)) {
      reason = `same name as row ${seenNames.get(normalizedName)} in this file`;
      code = VALIDATION_ERROR_CODE.DUPLICATE_NAME;
      field = 'name';
    }

    if (reason) {
      report.duplicates.push({
        row,
        name: service.name,
        id: service.id,
        raw,
        reason,
        code,
        field,
        warnings: recWarnings,
      });
    } else {
      seenIds.set(key, row);
      seenNames.set(normalizedName || key, row);
      report.valid.push({ row, service, raw, warnings: recWarnings });
    }
  }
  return report;
}

/** Execute import in chunked slices with per-chunk checkpoint persistence */
export function executeImport(previewReport, batchId, fieldMappings = [], options = {}) {
  requirePermission('services.import');

  const batch = importBatchService.getBatch(batchId);
  if (!batch) return { ok: false, error: 'Batch not found' };

  const validRecords = previewReport.valid || [];
  const invalidRecords = previewReport.invalid || [];
  const duplicateRecords = previewReport.duplicates || [];

  const allRecords = [
    ...validRecords.map((r) => ({ ...r, recordType: 'valid' })),
    ...invalidRecords.map((r) => ({ ...r, recordType: 'invalid' })),
    ...duplicateRecords.map((r) => ({ ...r, recordType: 'duplicate' })),
  ].sort((a, b) => a.row - b.row);

  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const existingCheckpoint = options.resume !== false ? importBatchService.getCheckpoint(batchId) : null;
  const startIdx = existingCheckpoint?.processedRecordIndex || 0;

  if (startIdx === 0) {
    importBatchService.createRollbackSnapshot({
      batchId,
      snapshotType: ROLLBACK_SNAPSHOT_TYPE.POST_VALIDATION,
      title: 'Pre-import snapshot',
      description: `Snapshot taken before importing ${validRecords.length} records`,
      rowCount: validRecords.length,
      fieldMappings,
    });
  }

  const now = new Date().toISOString();
  const attemptCount = options.attemptCount || 1;
  const sourceFileName = batch.sourceFile || previewReport.fileName || 'untitled';

  let currentIdx = startIdx;
  let chunkCount = Math.floor(startIdx / chunkSize);

  while (currentIdx < allRecords.length) {
    const chunk = allRecords.slice(currentIdx, currentIdx + chunkSize);
    const validInChunk = chunk.filter((r) => r.recordType === 'valid').map((r) => r.service);

    if (validInChunk.length > 0) {
      const saveResult = importAdminServices(validInChunk, actorLabel());
      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error || 'Failed to save services to storage', batch };
      }
    }

    const invalidInChunk = chunk.filter((r) => r.recordType === 'invalid');
    invalidInChunk.forEach((item) => {
      const details = item.errorDetails?.length
        ? item.errorDetails
        : (item.errors || []).map((msg) => ({ code: VALIDATION_ERROR_CODE.INVALID_VALUE, field: 'unknown', message: msg }));

      details.forEach((err) => {
        importBatchService.addValidationError({
          rowId: `row_${batchId}_${item.row}`,
          rowNumber: item.row,
          field: err.field,
          code: err.code,
          message: err.message,
        });
      });
    });

    const duplicateInChunk = chunk.filter((r) => r.recordType === 'duplicate');
    duplicateInChunk.forEach((item) => {
      importBatchService.addValidationError({
        rowId: `row_${batchId}_${item.row}`,
        rowNumber: item.row,
        field: item.field || (item.reason?.includes('name') ? 'name' : 'id'),
        code: item.code || (item.reason?.includes('name') ? VALIDATION_ERROR_CODE.DUPLICATE_NAME : VALIDATION_ERROR_CODE.DUPLICATE_ID),
        message: item.reason,
      });
    });

    const newDlqItems = [
      ...invalidInChunk.map((item) => ({
        id: `dlq_${batchId}_${item.row}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        batchId,
        sourceFile: sourceFileName,
        rowIndex: item.row,
        rowNumber: item.row,
        rawData: item.raw || {},
        reasonCodes: item.errorDetails?.map((d) => d.code) || [VALIDATION_ERROR_CODE.INVALID_VALUE],
        errors: item.errors || [],
        fields: item.errorDetails?.map((d) => d.field) || ['unknown'],
        reason: item.errors?.[0] || 'Validation failed',
        attemptCount,
        timestamp: now,
        status: 'invalid',
      })),
      ...duplicateInChunk.map((item) => ({
        id: `dlq_${batchId}_${item.row}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        batchId,
        sourceFile: sourceFileName,
        rowIndex: item.row,
        rowNumber: item.row,
        rawData: item.raw || {},
        reasonCodes: [item.code || VALIDATION_ERROR_CODE.DUPLICATE_ID],
        errors: [item.reason],
        fields: [item.field || 'id'],
        reason: item.reason,
        attemptCount,
        timestamp: now,
        status: 'duplicate',
      })),
    ];

    batch.validRows = (batch.validRows || 0) + validInChunk.length;
    batch.invalidRows = (batch.invalidRows || 0) + invalidInChunk.length;
    batch.duplicateRows = (batch.duplicateRows || 0) + duplicateInChunk.length;
    batch.totalRows = previewReport.total || allRecords.length;
    batch.deadLetterQueue = [...(batch.deadLetterQueue || []), ...newDlqItems];
    batch.fieldMappings = fieldMappings;

    currentIdx += chunk.length;
    chunkCount++;
    const isFinished = currentIdx >= allRecords.length;

    const checkpoint = {
      batchId,
      processedRowIndex: chunk[chunk.length - 1]?.row ?? currentIdx,
      processedRecordIndex: currentIdx,
      totalRecords: allRecords.length,
      nextChunkIndex: isFinished ? -1 : chunkCount,
      status: isFinished ? IMPORT_BATCH_STATUS.VALIDATED : IMPORT_BATCH_STATUS.VALIDATING,
      validRows: batch.validRows,
      invalidRows: batch.invalidRows,
      duplicateRows: batch.duplicateRows,
      updatedAt: new Date().toISOString(),
    };
    importBatchService.saveCheckpoint(batchId, checkpoint);

    if (options.interruptAfterChunk !== undefined && chunkCount >= options.interruptAfterChunk && !isFinished) {
      batch.status = IMPORT_BATCH_STATUS.VALIDATING;
      importBatchService.updateBatch(batch);
      return { ok: true, paused: true, checkpoint, batch };
    }
  }

  batch.status = IMPORT_BATCH_STATUS.VALIDATED;
  batch.updatedAt = new Date().toISOString();
  importBatchService.updateBatch(batch);
  importBatchService.clearCheckpoint(batchId);

  importBatchService.recordApprovalEvent({
    action: 'validated',
    batchId,
    notes: `${batch.validRows} valid records imported, ${batch.invalidRows} invalid, ${batch.duplicateRows} duplicates quarantined`,
    actor: actorLabel(),
  });

  return {
    ok: true,
    imported: batch.validRows,
    invalid: batch.invalidRows,
    duplicates: batch.duplicateRows,
    batch,
  };
}

/** Resume an interrupted or paused batch from its last saved checkpoint */
export function resumeImport(batchId, previewReport, options = {}) {
  return executeImport(previewReport, batchId, options.fieldMappings || [], { ...options, resume: true });
}

/** Approve an import batch for publication */
export function approveImportBatch(batchId, options = {}) {
  requirePermission('services.import');
  const result = importBatchService.updateBatchStatus(batchId, IMPORT_BATCH_STATUS.APPROVED, {
    approvalEvent: {
      action: 'approved',
      batchId,
      notes: options.notes || 'Import batch approved for publication',
      actor: actorLabel(),
    },
  });
  if (!result.ok) return result;
  return { ok: true, batch: result.batch, message: 'Import batch approved successfully' };
}

export const csvTemplate = () => null;

export default {
  detectImportFormat,
  csvToImportRecords,
  jsonToImportRecords,
  buildImportPreview,
  validateImportRecord,
  executeImport,
  resumeImport,
  approveImportBatch,
  sanitizeCsvCell,
  formatCsvCell,
  generateFailedRowsCsv,
  csvTemplate,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  DEFAULT_CHUNK_SIZE,
};
