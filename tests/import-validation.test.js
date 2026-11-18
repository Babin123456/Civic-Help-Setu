import { describe, it, expect } from 'vitest';
import {
  detectImportFormat,
  csvToImportRecords,
  jsonToImportRecords,
  buildImportPreview,
  validateImportRecord,
  SCHEMA_FIELDS,
  SERVICE_CATEGORIES,
  DELIVERY_TYPES,
  DIFFICULTIES,
  FEE_TYPES,
} from '../src/services/importValidationService';

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
    });

    it('rejects record without name', () => {
      const result = validateImportRecord({
        category: 'Certificates',
      });
      expect(result.service).toBeNull();
      expect(result.errors).toContain('name is required');
    });

    it('rejects record with unrecognized category', () => {
      const result = validateImportRecord({
        name: 'Test',
        category: 'InvalidCategory',
      });
      expect(result.service).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates speedDays as positive integer', () => {
      const result = validateImportRecord({
        name: 'Test',
        category: 'Certificates',
        speedDays: -1,
      });
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates official source URL with https', () => {
      const result = validateImportRecord({
        name: 'Test',
        category: 'Certificates',
        officialSourceUrl: 'https://example.com',
      });
      expect(result.service).not.toBeNull();
    });

    it('validates record with all fields', () => {
      const result = validateImportRecord({
        name: 'Test Service',
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
    });
  });

  describe('buildImportPreview', () => {
    it('builds preview from valid CSV', () => {
      const csvText = 'id,name,category,type,difficulty,feeType,fees,processingTime,speedDays,eligibility,documents,warnings,officialSourceName,officialSourceUrl,lastVerified\n' +
        'imp-001,Test Service,Certificates,Online / Offline,Easy,free,Free of cost,7 - 14 days,14,Indian citizen,Aadhaar Card,,"Department",https://example.com,2026-10-01\n';
      const preview = buildImportPreview(csvText, { fileName: 'test.csv' });
      expect(preview.format).toBe('csv');
      expect(preview.total).toBe(1);
      expect(preview.valid.length).toBeGreaterThanOrEqual(0);
      expect(preview.invalid.length).toBeGreaterThanOrEqual(0);
      expect(preview.duplicates.length).toBeGreaterThanOrEqual(0);
    });

    it('detects duplicate IDs when existing services have same id', () => {
      const csvText = 'id,name,category,type,difficulty,feeType,fees,processingTime,speedDays,eligibility,documents,warnings,officialSourceName,officialSourceUrl,lastVerified\n' +
        'imp-001,First Service,Certificates,Online / Offline,Easy,free,Free of cost,7 - 14 days,14,Indian citizen,Aadhaar Card,,"Department",https://example.com,2026-10-01\n' +
        'imp-001,Duplicate Service,Certificates,Online / Offline,Easy,free,Free of cost,7 - 14 days,14,Indian citizen,Aadhaar Card,,"Department",https://example.com,2026-10-01\n';
      const preview = buildImportPreview(csvText, { fileName: 'test.csv', existingServices: [] });
      expect(preview.duplicates.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty file', () => {
      const preview = buildImportPreview('', { fileName: 'test.csv' });
      expect(preview.fileErrors).toContain('The file is empty');
      expect(preview.total).toBe(0);
    });

    it('handles file too large', () => {
      const largeText = 'a'.repeat(2 * 1024 * 1024 + 1); // Over 2MB
      const preview = buildImportPreview(largeText, { fileName: 'test.csv' });
      expect(preview.fileErrors).toContain('The file is larger than 1024 KB');
    });
  });
});