/**
 * src/services/routePlanning/migrations.test.js
 * Unit tests for Route Planning schema migrations, validation, and rollback (#755).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateRecord,
  migrateRecords,
  rollbackRecords,
  validateRecordSchema,
  runMigrations,
  STORAGE_KEY,
  SCHEMA_VERSIONS,
  CURRENT_SCHEMA_VERSION,
} from './migrations.js';

describe('Route Planning Schema Migrations (#755)', () => {
  let mockStore;

  beforeEach(() => {
    const memory = {};
    mockStore = {
      getItem: (k) => memory[k] || null,
      setItem: (k, v) => {
        memory[k] = String(v);
      },
      clear: () => {
        for (const k of Object.keys(memory)) delete memory[k];
      },
    };
  });

  describe('Forward Migrations', () => {
    it('migrates a legacy 1.0.0 SegregationAudit to 1.3.0 with compliance percentage', () => {
      const legacyAudit = {
        recordType: 'SegregationAudit',
        id: 'aud-legacy-1',
        pickupPointId: 'point-1',
        observedStreams: { wet: 1, dry: 1, hazardous: 0 },
        expectedStreams: { wet: 1, dry: 1, hazardous: 1 },
        schemaVersion: '1.0.0',
      };

      const migrated = migrateRecord(legacyAudit, CURRENT_SCHEMA_VERSION);
      expect(migrated.schemaVersion).toBe(SCHEMA_VERSIONS.V1_3_0);
      expect(migrated.compliancePercentage).toBe(67);
      expect(migrated.rating).toBe('GOOD');
      expect(Array.isArray(migrated.photos)).toBe(true);
    });

    it('migrates a legacy 1.0.0 Vehicle to 1.3.0 with currentLoad tracking', () => {
      const legacyVehicle = {
        recordType: 'Vehicle',
        id: 'veh-legacy-1',
        registrationNumber: 'KA-01-AB-1234',
        capacityKg: 800,
        schemaVersion: '1.0.0',
      };

      const migrated = migrateRecord(legacyVehicle, CURRENT_SCHEMA_VERSION);
      expect(migrated.schemaVersion).toBe(SCHEMA_VERSIONS.V1_3_0);
      expect(migrated.currentLoadKg).toBe(0);
      expect(migrated.currentLoadLitres).toBe(0);
    });

    it('is idempotent when migrating already up-to-date records', () => {
      const currentRecord = {
        recordType: 'Vehicle',
        id: 'veh-current-1',
        registrationNumber: 'KA-01-AB-5678',
        capacityKg: 1000,
        currentLoadKg: 200,
        schemaVersion: CURRENT_SCHEMA_VERSION,
      };

      const run1 = migrateRecord(currentRecord);
      const run2 = migrateRecord(run1);
      expect(run1).toEqual(run2);
    });

    it('migrates an array of records using migrateRecords', () => {
      const records = [
        { recordType: 'Vehicle', registrationNumber: 'KA-01', schemaVersion: '1.0.0' },
      ];
      const migrated = migrateRecords(records, CURRENT_SCHEMA_VERSION);
      expect(migrated[0].schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('Rollback Strategy', () => {
    it('rolls back 1.3.0 records to 1.0.0 by stripping advanced fields safely', () => {
      const modernRecords = [
        {
          recordType: 'SegregationAudit',
          id: 'aud-1',
          compliancePercentage: 85,
          rating: 'EXCELLENT',
          photos: ['photo-1.jpg'],
          schemaVersion: '1.3.0',
        },
      ];

      const rolledBack = rollbackRecords(modernRecords, SCHEMA_VERSIONS.V1_0_0);
      expect(rolledBack[0].schemaVersion).toBe(SCHEMA_VERSIONS.V1_0_0);
      expect(rolledBack[0].compliancePercentage).toBeUndefined();
      expect(rolledBack[0].photos).toBeUndefined();
    });
  });

  describe('Schema Validation', () => {
    it('flags missing schemaVersion as an error', () => {
      const invalid = { id: 'test' };
      const errors = validateRecordSchema(invalid);
      expect(errors).toContain('Missing schemaVersion');
    });

    it('validates a correct 1.3.0 Vehicle record', () => {
      const validVehicle = {
        recordType: 'Vehicle',
        registrationNumber: 'KA-01-TEST',
        currentLoadKg: 50,
        schemaVersion: '1.3.0',
      };
      const errors = validateRecordSchema(validVehicle);
      expect(errors).toEqual([]);
    });
  });

  describe('Storage Engine Migration Runner', () => {
    it('initializes empty array for fresh store', () => {
      const result = runMigrations(mockStore);
      expect(result.errors).toEqual([]);
      expect(mockStore.getItem(STORAGE_KEY)).toBe('[]');
    });

    it('migrates raw stored records in localStorage', () => {
      const legacyRaw = [
        {
          recordType: 'Vehicle',
          registrationNumber: 'KA-05-9999',
          schemaVersion: '1.0.0',
        },
      ];
      mockStore.setItem(STORAGE_KEY, JSON.stringify(legacyRaw));

      const result = runMigrations(mockStore);
      expect(result.migrated).toBe(1);
      const updated = JSON.parse(mockStore.getItem(STORAGE_KEY));
      expect(updated[0].schemaVersion).toBe(SCHEMA_VERSIONS.V1_3_0);
      expect(updated[0].currentLoadKg).toBe(0);
    });
  });
});
