import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  detectImportFormat,
  csvToImportRecords,
  jsonToImportRecords,
  buildImportPreview,
  validateImportRecord,
  executeImport,
  sanitizeCsvCell,
  formatCsvCell,
  generateFailedRowsCsv,
} from '../src/services/importValidationService';
import { importBatchService } from '../src/services/importBatchService';
import { setCurrentActor } from '../src/services/accessControl';
import { VALIDATION_ERROR_CODE } from '../src/data/importContract';
import { CUSTOM_SERVICES_KEY } from '../src/services/serviceCatalog';

const makeStorage = () => {
  const store = new Map();
  return {
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn((k, v) => store.set(k, String(v))),
    removeItem: vi.fn((k) => store.delete(k)),
    clear: vi.fn(() => store.clear()),
  };
};

let storage;
beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  setCurrentActor({ role: 'admin', username: 'ImportTester' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Import Validation Service', () => {
  describe('detectImportFormat', () => {
    it('detects CSV from .csv extension', () => {
      expect(detectImportFormat('services.csv', '')).toBe('csv');
    });

    it('detects JSON from .json extension', () => {
      expect(detectImportFormat('services.json', '')).toBe('json');
    });

    it('detects JSON from content starting with [{', () => {
      expect(detectImportFormat('', '[{ "name": "test" }]')).toBe('json');
    });

    it('detects CSV from content starting with [a-z]', () => {
      expect(detectImportFormat('', 'id,name,category\n')).toBe('csv');
    });
  });

  describe('csvToImportRecords', () => {
    it('parses CSV with header row', () => {
      const text = 'id,name,category\nimp-001,Birth Certificate,Certificates\n';
      const records = csvToImportRecords(text);
      expect(records.length).toBe(1);
      expect(records[0].row).toBe(2);
      expect(records[0].raw.name).toBe('Birth Certificate');
      expect(records[0].raw.category).toBe('Certificates');
    });

    it('throws on empty file', () => {
      expect(() => csvToImportRecords('')).toThrow('The file is empty');
    });
  });

  describe('jsonToImportRecords', () => {
    it('parses JSON array', () => {
      const text = '[{"name": "Test Service", "category": "Health"}]';
      const records = jsonToImportRecords(text);
      expect(records.length).toBe(1);
      expect(records[0].row).toBe(1);
      expect(records[0].raw.name).toBe('Test Service');
    });

    it('parses JSON with services key', () => {
      const text = '{"services": [{"name": "Test Service", "category": "Health"}]}';
      const records = jsonToImportRecords(text);
      expect(records.length).toBe(1);
      expect(records[0].row).toBe(1);
      expect(records[0].raw.name).toBe('Test Service');
    });

    it('throws on invalid JSON', () => {
      expect(() => jsonToImportRecords('not json')).toThrow('Invalid JSON');
    });

    it('throws when no services array found', () => {
      expect(() => jsonToImportRecords('{}')).toThrow('JSON must be an array');
    });
  });

  describe('validateImportRecord', () => {
    it('validates a record with all required fields', () => {
      const result = validateImportRecord({
        name: 'Birth Certificate',
        category: 'Certificates',
        type: 'Online / Offline',
        difficulty: 'Easy',
        feeType: 'free',
        speedDays: 14,
        fees: 'Free of cost',
        processingTime: '7 - 14 days',
        eligibility: ['Indian citizen'],
        documents: ['Aadhaar Card'],
        officialSourceUrl: 'https://example.com',
      });
      expect(result.service).not.toBeNull();
      expect(result.errors).toHaveLength(0);
      expect(result.errorDetails).toHaveLength(0);
    });

    it('rejects record without name and returns accurate code and field', () => {
      const result = validateImportRecord({
        category: 'Certificates',
      });
      expect(result.service).toBeNull();
      expect(result.errors).toContain('name is required');
      expect(result.errorDetails).toContainEqual({
        field: 'name',
        code: VALIDATION_ERROR_CODE.REQUIRED_FIELD,
        message: 'name is required',
      });
    });

    it('rejects record with unrecognized category and returns accurate code and field', () => {
      const result = validateImportRecord({
        name: 'Test',
        category: 'InvalidCategory',
      });
      expect(result.service).toBeNull();
      expect(result.errorDetails).toContainEqual(
        expect.objectContaining({
          field: 'category',
          code: VALIDATION_ERROR_CODE.INVALID_VALUE,
        }),
      );
    });

    it('validates speedDays as positive integer', () => {
      const result = validateImportRecord({
        name: 'Test',
        category: 'Certificates',
        speedDays: -1,
      });
      expect(result.errorDetails).toContainEqual({
        field: 'speedDays',
        code: VALIDATION_ERROR_CODE.INVALID_VALUE,
        message: 'speedDays must be a whole number greater than 0',
      });
    });

    it('validates official source URL with https', () => {
      const result = validateImportRecord({
        name: 'Test',
        category: 'Certificates',
        officialSourceUrl: 'https://example.com',
      });
      expect(result.service).not.toBeNull();
    });
  });

  describe('buildImportPreview duplicate detection bug fixes', () => {
    it('accurately matches duplicate services against existing catalog by normalized name', () => {
      const existing = [{ id: 'senior-card', name: 'Senior Citizen Identity Card' }];
      const csvText = 'name,category,officialSourceUrl\nSenior citizen identity CARD,Certificates,https://example.com\n';
      const preview = buildImportPreview(csvText, { fileName: 'test.csv', existingServices: existing });

      expect(preview.valid).toHaveLength(0);
      expect(preview.duplicates).toHaveLength(1);
      expect(preview.duplicates[0].code).toBe(VALIDATION_ERROR_CODE.DUPLICATE_NAME);
      expect(preview.duplicates[0].field).toBe('name');
      expect(preview.duplicates[0].reason).toContain('Senior Citizen Identity Card');
    });

    it('accurately matches duplicate services against existing catalog by ID', () => {
      const existing = [{ id: 'birth-cert', name: 'Municipal Birth Certificate' }];
      const csvText = 'id,name,category,officialSourceUrl\nbirth-cert,Different Name,Certificates,https://example.com\n';
      const preview = buildImportPreview(csvText, { fileName: 'test.csv', existingServices: existing });

      expect(preview.valid).toHaveLength(0);
      expect(preview.duplicates).toHaveLength(1);
      expect(preview.duplicates[0].code).toBe(VALIDATION_ERROR_CODE.DUPLICATE_ID);
      expect(preview.duplicates[0].field).toBe('id');
      expect(preview.duplicates[0].reason).toContain('id "birth-cert" already exists');
    });

    it('preserves normalizedName scope and detects duplicates within the same file', () => {
      const csvText =
        'id,name,category,officialSourceUrl\n' +
        'wc-1,Water Connection,Certificates,https://example.com\n' +
        'wc-2,water connection,Certificates,https://example.com\n';
      const preview = buildImportPreview(csvText, { fileName: 'test.csv', existingServices: [] });

      expect(preview.valid).toHaveLength(1);
      expect(preview.duplicates).toHaveLength(1);
      expect(preview.duplicates[0].reason).toContain('same name as row 2 in this file');
      expect(preview.duplicates[0].code).toBe(VALIDATION_ERROR_CODE.DUPLICATE_NAME);
    });

    it('handles empty and oversized files', () => {
      const empty = buildImportPreview('', { fileName: 'test.csv' });
      expect(empty.fileErrors).toContain('The file is empty');

      const large = buildImportPreview('a'.repeat(2 * 1024 * 1024 + 1), { fileName: 'test.csv' });
      expect(large.fileErrors).toContain('The file is larger than 1024 KB');
    });
  });

  describe('dead-letter quarantine & non-overwrite guarantee', () => {
    it('quarantines invalid and duplicate rows with original raw data and accurate reason codes', () => {
      const existing = [{ id: 'existing-id', name: 'Existing Service' }];
      const csvText =
        'id,name,category,officialSourceUrl\n' +
        'valid-1,Valid Service One,Certificates,https://example.gov.in\n' +
        ',,Certificates,https://example.gov.in\n' +
        'existing-id,Existing Service Clone,Certificates,https://example.gov.in\n';

      const preview = buildImportPreview(csvText, { fileName: 'test.csv', existingServices: existing });
      const batchResult = importBatchService.createBatch({ sourceFile: 'test.csv' });
      const batchId = batchResult.batch.id;

      const result = executeImport(preview, batchId);
      expect(result.ok).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.invalid).toBe(1);
      expect(result.duplicates).toBe(1);

      const batch = importBatchService.getBatch(batchId);
      expect(batch.deadLetterQueue).toHaveLength(2);

      // Verify invalid row in dead-letter queue
      const invalidDlq = batch.deadLetterQueue.find((q) => q.status === 'invalid');
      expect(invalidDlq).toBeDefined();
      expect(invalidDlq.rowIndex).toBe(3);
      expect(invalidDlq.rawData.category).toBe('Certificates');
      expect(invalidDlq.reasonCodes).toContain(VALIDATION_ERROR_CODE.REQUIRED_FIELD);
      expect(invalidDlq.fields).toContain('name');
      expect(invalidDlq.attemptCount).toBe(1);
      expect(invalidDlq.batchId).toBe(batchId);
      expect(invalidDlq.sourceFile).toBe('test.csv');

      // Verify duplicate row in dead-letter queue
      const duplicateDlq = batch.deadLetterQueue.find((q) => q.status === 'duplicate');
      expect(duplicateDlq).toBeDefined();
      expect(duplicateDlq.rowIndex).toBe(4);
      expect(duplicateDlq.rawData.id).toBe('existing-id');
      expect(duplicateDlq.reasonCodes).toContain(VALIDATION_ERROR_CODE.DUPLICATE_ID);
      expect(duplicateDlq.fields).toContain('id');
      expect(duplicateDlq.attemptCount).toBe(1);
    });

    it('never silently overwrites existing records on duplicate ID or name', () => {
      const originalService = {
        id: 'trade-license',
        name: 'Trade License',
        category: 'Business',
        shortDescription: 'Original description',
        officialSources: [{ name: 'Portal', url: 'https://original.gov.in' }],
      };
      storage.setItem(CUSTOM_SERVICES_KEY, JSON.stringify([originalService]));

      const csvText =
        'id,name,category,shortDescription,officialSourceUrl\n' +
        'trade-license,Trade License,Business,Malicious Overwrite,https://malicious.evil.com\n';

      const preview = buildImportPreview(csvText, { fileName: 'test.csv', existingServices: [originalService] });
      expect(preview.valid).toHaveLength(0);
      expect(preview.duplicates).toHaveLength(1);

      const batch = importBatchService.createBatch({ sourceFile: 'test.csv' }).batch;
      executeImport(preview, batch.id);

      // Verify original record is untouched in custom services storage
      const saved = JSON.parse(storage.getItem(CUSTOM_SERVICES_KEY));
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Trade License');
      expect(saved[0].shortDescription).toBe('Original description');
      expect(saved[0].officialSources[0].url).toBe('https://original.gov.in');
    });
  });

  describe('CSV export and formula-injection neutralization', () => {
    it('neutralizes cells starting with =, +, -, @, \\t, or \\r', () => {
      expect(sanitizeCsvCell('=cmd|"/C calc"!A0')).toBe('\'=cmd|"/C calc"!A0');
      expect(sanitizeCsvCell('+12345')).toBe('\'+12345');
      expect(sanitizeCsvCell('-5 + 3')).toBe('\'-5 + 3');
      expect(sanitizeCsvCell('@SUM(A1:A5)')).toBe('\'@SUM(A1:A5)');
      expect(sanitizeCsvCell('\ttab_value')).toBe('\'\ttab_value');
      expect(sanitizeCsvCell('Normal text')).toBe('Normal text');
      expect(sanitizeCsvCell(null)).toBe('');
    });

    it('escapes quotes and newlines according to RFC 4180', () => {
      expect(formatCsvCell('Value, with comma')).toBe('"Value, with comma"');
      expect(formatCsvCell('Value "with quotes"')).toBe('"Value ""with quotes"""');
      expect(formatCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(formatCsvCell('=1+1, test')).toBe('"\'=1+1, test"');
    });

    it('generates failed-rows CSV preserving original columns and failure reason headers', () => {
      const deadLetterQueue = [
        {
          rowIndex: 2,
          rawData: {
            id: 'svc-1',
            name: '=SUM(A1:B2)',
            category: 'Certificates',
            officialSourceUrl: 'https://example.gov.in',
          },
          reason: 'name formula detected',
          reasonCodes: [VALIDATION_ERROR_CODE.INVALID_VALUE],
          fields: ['name'],
          attemptCount: 1,
        },
      ];

      const csv = generateFailedRowsCsv(deadLetterQueue);
      expect(csv).toContain('id,name,shortDescription');
      expect(csv).toContain('failure_reason,failure_codes,failure_fields,row_number,attempt_count');
      // Neutralized formula in name
      expect(csv).toContain('\'=SUM(A1:B2)');
      expect(csv).toContain('name formula detected');
      expect(csv).toContain(VALIDATION_ERROR_CODE.INVALID_VALUE);
    });
  });

  describe('retry-only-failed-rows flow and idempotency', () => {
    it('reprocesses ONLY quarantined rows, incrementing attempt count on remaining failures', () => {
      const batchResult = importBatchService.createBatch({ sourceFile: 'services.csv' });
      const batchId = batchResult.batch.id;

      // Seed batch with 1 valid row and 2 quarantined rows
      const validRow = {
        row: 2,
        service: {
          id: 'initial-valid',
          name: 'Initial Valid',
          category: 'Certificates',
          shortDescription: 'Desc',
          officialSources: [{ name: 'Portal', url: 'https://example.gov.in' }],
        },
      };

      const invalidRow = {
        row: 3,
        raw: { name: '', category: 'Certificates', officialSourceUrl: 'https://example.gov.in' },
        errors: ['name is required'],
        errorDetails: [{ field: 'name', code: VALIDATION_ERROR_CODE.REQUIRED_FIELD, message: 'name is required' }],
      };

      const duplicateRow = {
        row: 4,
        raw: { id: 'initial-valid', name: 'Initial Valid Repeat', category: 'Certificates', officialSourceUrl: 'https://example.gov.in' },
        reason: 'id "initial-valid" already exists',
        code: VALIDATION_ERROR_CODE.DUPLICATE_ID,
        field: 'id',
      };

      const preview = {
        fileName: 'services.csv',
        valid: [validRow],
        invalid: [invalidRow],
        duplicates: [duplicateRow],
        total: 3,
      };

      executeImport(preview, batchId);

      const batchAfterImport = importBatchService.getBatch(batchId);
      expect(batchAfterImport.validRows).toBe(1);
      expect(batchAfterImport.deadLetterQueue).toHaveLength(2);

      // Now retry: update row 3 to be fixed, but row 4 is still duplicate
      const retryResult = importBatchService.retryBatch(batchId, {
        updatedRowsMap: {
          3: {
            id: 'fixed-service-3',
            name: 'Fixed Service Three',
            category: 'Certificates',
            shortDescription: 'Now valid description',
            officialSourceUrl: 'https://example.gov.in',
          },
        },
      });

      expect(retryResult.ok).toBe(true);
      expect(retryResult.succeeded).toBe(1);
      expect(retryResult.remaining).toBe(1);

      const batchAfterRetry = importBatchService.getBatch(batchId);
      expect(batchAfterRetry.validRows).toBe(2);
      expect(batchAfterRetry.deadLetterQueue).toHaveLength(1);

      // Remaining quarantined item has attemptCount incremented
      const remaining = batchAfterRetry.deadLetterQueue[0];
      expect(remaining.rowIndex).toBe(4);
      expect(remaining.attemptCount).toBe(2);

      // Verify idempotency: initial-valid was NOT imported again
      const allCustomServices = JSON.parse(storage.getItem(CUSTOM_SERVICES_KEY));
      const initialMatches = allCustomServices.filter((s) => s.id === 'initial-valid');
      expect(initialMatches).toHaveLength(1);
    });

    it('enforces idempotency so already-succeeded rows are never re-imported if present in retry payload', () => {
      const batchResult = importBatchService.createBatch({ sourceFile: 'test.csv' });
      const batchId = batchResult.batch.id;

      // Simulate a quarantined row that already exists in the catalog
      const existing = [{ id: 'already-there', name: 'Already There Service' }];
      storage.setItem(CUSTOM_SERVICES_KEY, JSON.stringify(existing));

      const batch = importBatchService.getBatch(batchId);
      batch.deadLetterQueue = [
        {
          rowIndex: 2,
          rawData: {
            id: 'already-there',
            name: 'Already There Service',
            category: 'Certificates',
            shortDescription: 'Desc',
            officialSourceUrl: 'https://example.gov.in',
          },
          reason: 'Duplicate',
          attemptCount: 1,
        },
      ];
      importBatchService.updateBatch(batch);

      const retryResult = importBatchService.retryBatch(batchId, { existingServices: existing });
      expect(retryResult.ok).toBe(true);
      expect(retryResult.succeeded).toBe(0);
      expect(retryResult.remaining).toBe(1);

      const updatedBatch = importBatchService.getBatch(batchId);
      expect(updatedBatch.deadLetterQueue[0].status).toBe('duplicate');
      expect(updatedBatch.deadLetterQueue[0].attemptCount).toBe(2);
    });
  });

  describe('corrupted and quota-exceeded storage fallback', () => {
    it('safely falls back without throwing when localStorage quota is exceeded', () => {
      const batchResult = importBatchService.createBatch({ sourceFile: 'test.csv' });
      const batchId = batchResult.batch.id;

      // Make storage throw QuotaExceededError during executeImport
      storage.setItem.mockImplementation((key) => {
        if (key === CUSTOM_SERVICES_KEY) {
          throw new DOMException('quota exceeded', 'QuotaExceededError');
        }
      });

      const preview = {
        fileName: 'test.csv',
        valid: [
          {
            row: 2,
            service: {
              id: 'quota-test',
              name: 'Quota Test Service',
              category: 'Certificates',
              shortDescription: 'Desc',
              officialSources: [{ name: 'Portal', url: 'https://example.gov.in' }],
            },
          },
        ],
        invalid: [],
        duplicates: [],
        total: 1,
      };

      const result = executeImport(preview, batchId);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Saving failed (browser storage may be full)');
    });

    it('safely handles corrupted batch JSON in storage', () => {
      storage.setItem('civicbridge_import_batches', '{not valid json');
      const batches = importBatchService.listBatches();
      expect(Array.isArray(batches)).toBe(true);
      expect(batches).toHaveLength(0);
    });
  });
});
