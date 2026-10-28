import { describe, it, expect, beforeEach } from 'vitest';
import {
  EXPORT_SCHEMA_VERSION,
  EXCLUDED_SENSITIVE_FIELDS_EXPLANATION,
  SUPPORTED_EXPORT_CATEGORIES,
  assertAuthenticated,
  escapeCsvValue,
  convertToCsv,
  sanitizeRecord,
  collectUserRecords,
  generateExportPreview,
  buildCitizenDataExport,
} from './dataPortabilityService';

const makeStorage = (initialData = {}) => {
  const map = new Map(Object.entries(initialData));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
};

describe('dataPortabilityService', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = makeStorage();
  });

  describe('Authentication and Access Guards', () => {
    it('throws error when user object is null or undefined', () => {
      expect(() => assertAuthenticated(null)).toThrow(/Authentication required/);
      expect(() => assertAuthenticated(undefined)).toThrow(/Authentication required/);
    });

    it('throws error when user identifier is empty or whitespace', () => {
      expect(() => assertAuthenticated({ id: '' })).toThrow(/User identifier is missing/);
      expect(() => assertAuthenticated({ id: '   ' })).toThrow(/User identifier is missing/);
    });

    it('returns trimmed user ID when user is valid', () => {
      expect(assertAuthenticated({ id: 'user_12345' })).toBe('user_12345');
      expect(assertAuthenticated({ userId: 'user_67890' })).toBe('user_67890');
    });

    it('prevents unauthenticated preview or export generation', () => {
      expect(() => generateExportPreview(null, mockStorage)).toThrow(/Authentication required/);
      expect(() => buildCitizenDataExport(null, {}, mockStorage)).toThrow(/Authentication required/);
    });
  });

  describe('Ownership Boundaries and Cross-User Data Isolation', () => {
    it('filters out records belonging to other users', () => {
      const savedData = [
        { id: 'driving-licence', name: 'Driving Licence', userId: 'user_alice' },
        { id: 'income-certificate', name: 'Income Certificate', userId: 'user_bob' },
        { id: 'ration-card', name: 'Ration Card' }, // universal/unassigned
      ];

      const checklistData = [
        { id: 'task_1', text: 'Gather documents', userId: 'user_alice' },
        { id: 'task_2', text: 'Visit notary', userId: 'user_bob' },
      ];

      mockStorage.setItem('civicbridge_saved', JSON.stringify(savedData));
      mockStorage.setItem('civicbridge_checklist', JSON.stringify(checklistData));

      // Alice's export
      const aliceExport = buildCitizenDataExport({ id: 'user_alice' }, {}, mockStorage);
      expect(aliceExport.data.savedServices.some((s) => s.id === 'driving-licence')).toBe(true);
      expect(aliceExport.data.savedServices.some((s) => s.id === 'income-certificate')).toBe(false);
      expect(aliceExport.data.checklists.length).toBe(1);
      expect(aliceExport.data.checklists[0].text).toBe('Gather documents');

      // Bob's export
      const bobExport = buildCitizenDataExport({ id: 'user_bob' }, {}, mockStorage);
      expect(bobExport.data.savedServices.some((s) => s.id === 'income-certificate')).toBe(true);
      expect(bobExport.data.savedServices.some((s) => s.id === 'driving-licence')).toBe(false);
      expect(bobExport.data.checklists.length).toBe(1);
      expect(bobExport.data.checklists[0].text).toBe('Visit notary');
    });
  });

  describe('Sensitive Field Exclusion by Default', () => {
    it('strips credentials, session tokens, passwords, and raw file blobs from exported records', () => {
      const contaminated = {
        id: 'service_1',
        name: 'Passport Renewal',
        savedAt: '2026-01-01',
        passwordHash: 'secret_hash_value',
        authToken: 'bearer_token_xyz',
        sessionToken: 'session_token_abc',
        apiKey: 'key_live_123',
        fileBlob: 'base64_data_stream_binary',
      };

      const clean = sanitizeRecord(contaminated);

      expect(clean.id).toBe('service_1');
      expect(clean.name).toBe('Passport Renewal');
      expect(clean.savedAt).toBe('2026-01-01');

      // Verify all sensitive keys are deleted
      expect(clean.passwordHash).toBeUndefined();
      expect(clean.authToken).toBeUndefined();
      expect(clean.sessionToken).toBeUndefined();
      expect(clean.apiKey).toBeUndefined();
      expect(clean.fileBlob).toBeUndefined();
    });

    it('includes explicit security notice in export metadata', () => {
      const preview = generateExportPreview({ id: 'user_test', email: 'test@example.com' }, mockStorage);
      expect(preview.securityNotice).toBe(EXCLUDED_SENSITIVE_FIELDS_EXPLANATION);
      expect(preview.securityNotice).toContain('passwords, MFA secrets, and raw encrypted document binaries');
    });
  });

  describe('Export Preview & Structure', () => {
    it('generates accurate preview with category counts and schema version', () => {
      const saved = [{ id: 'srv_1', name: 'Service 1' }, { id: 'srv_2', name: 'Service 2' }];
      const tasks = [{ id: 't_1', text: 'Task 1' }];

      mockStorage.setItem('civicbridge_saved', JSON.stringify(saved));
      mockStorage.setItem('civicbridge_checklist', JSON.stringify(tasks));

      const preview = generateExportPreview({ id: 'user_test', email: 'citizen@example.com' }, mockStorage);

      expect(preview.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
      expect(preview.userId).toBe('user_test');
      expect(preview.userEmail).toBe('citizen@example.com');
      expect(preview.totalRecords).toBe(3);
      expect(preview.counts.saved_services).toBe(2);
      expect(preview.counts.checklists).toBe(1);
      expect(preview.counts.reminders).toBe(0);
      expect(preview.isEmpty).toBe(false);
    });

    it('correctly marks empty exports as isEmpty: true', () => {
      const preview = generateExportPreview({ id: 'user_empty' }, mockStorage);
      expect(preview.totalRecords).toBe(0);
      expect(preview.isEmpty).toBe(true);
    });
  });

  describe('JSON Export Generation', () => {
    it('produces valid JSON adhering to export schema v1.0.0', () => {
      mockStorage.setItem(
        'civicbridge_saved',
        JSON.stringify([{ id: 'driving-licence', name: 'Driving Licence' }])
      );

      const result = buildCitizenDataExport(
        { id: 'user_999', email: 'user999@test.org', username: 'CitizenUser' },
        {},
        mockStorage
      );

      expect(result.payload.exportVersion).toBe(EXPORT_SCHEMA_VERSION);
      expect(result.payload.user.id).toBe('user_999');
      expect(result.payload.user.email).toBe('user999@test.org');
      expect(result.payload.meta.platform).toBe('Civic Help Setu');
      expect(result.payload.data.savedServices.length).toBe(1);

      // Verify parseable JSON string
      const parsed = JSON.parse(result.jsonString);
      expect(parsed.exportVersion).toBe(EXPORT_SCHEMA_VERSION);
      expect(parsed.data.savedServices[0].id).toBe('driving-licence');
    });
  });

  describe('CSV Conversion & RFC 4180 Escaping', () => {
    it('escapes quotes, commas, and newlines in CSV columns', () => {
      expect(escapeCsvValue('Simple Text')).toBe('Simple Text');
      expect(escapeCsvValue('Text, with comma')).toBe('"Text, with comma"');
      expect(escapeCsvValue('Text with "quotes"')).toBe('"Text with ""quotes"""');
      expect(escapeCsvValue('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
      expect(escapeCsvValue(null)).toBe('');
    });

    it('generates well-formatted CSV strings for saved services and checklists', () => {
      const records = [
        { id: 'dl', name: 'Driving Licence, Parivahan', category: 'Transport', savedAt: '2026-01-01' },
      ];

      const headers = [
        { key: 'id', label: 'Service ID' },
        { key: 'name', label: 'Service Name' },
        { key: 'category', label: 'Category' },
      ];

      const csv = convertToCsv(records, headers);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('Service ID,Service Name,Category');
      expect(lines[1]).toBe('dl,"Driving Licence, Parivahan",Transport');
    });

    it('generates CSV categories package for all supported personal records', () => {
      mockStorage.setItem(
        'civicbridge_saved',
        JSON.stringify([{ id: 'pan-card', name: 'PAN Card', category: 'Tax' }])
      );

      const result = buildCitizenDataExport({ id: 'user_csv' }, {}, mockStorage);

      expect(result.csvExports.savedServices).toContain('Service ID,Service Name,Category,Saved At');
      expect(result.csvExports.savedServices).toContain('pan-card,PAN Card,Tax');
      expect(result.csvExports.checklists).toBeDefined();
      expect(result.csvExports.reminders).toBeDefined();
      expect(result.csvExports.notes).toBeDefined();
    });
  });
});
