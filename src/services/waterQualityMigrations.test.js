/**
 * src/services/waterQualityMigrations.test.js
 * Unit tests for schema version migrations and rollback strategy (#754).
 */

import { describe, it, expect } from 'vitest';
import { runMigrations, rollbackMigration } from './waterQualityMigrations.js';

describe('Water Quality Schema Migrations & Rollback (#754)', () => {
  it('hydrates fresh verified store when passed empty or null dataset', () => {
    const result = runMigrations(null);
    expect(result.success).toBe(true);
    expect(result.data.schemaVersion).toBe('1.0.0');
    expect(result.data.waterPoints.length).toBeGreaterThan(0);
    expect(result.appliedMigrations).toContain('initialized-fresh');
  });

  it('migrates legacy 0.9.0 dataset to 1.0.0 and normalizes structure', () => {
    const legacyData = {
      schemaVersion: '0.9.0',
      waterPoints: [
        { id: 'WP-TEST-01', name: 'Legacy Tap' },
      ],
      labResults: [
        { id: 'RES-01', testedValue: 7.1 },
      ],
    };

    const result = runMigrations(legacyData);
    expect(result.success).toBe(true);
    expect(result.data.schemaVersion).toBe('1.0.0');
    expect(result.data.waterPoints[0].operationalStatus).toBe('active');
    expect(result.data.labResults[0].supersededByResultId).toBeNull();
    expect(result.appliedMigrations).toContain('0.9.0->1.0.0');
  });

  it('rolls back successfully from 1.0.0 to 0.9.0', () => {
    const currentData = {
      schemaVersion: '1.0.0',
      waterPoints: [{ id: 'WP-01' }],
    };

    const rollbackResult = rollbackMigration(currentData);
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.data.schemaVersion).toBe('0.9.0');
    expect(rollbackResult.rolledBackFrom).toBe('1.0.0');
    expect(rollbackResult.rolledBackTo).toBe('0.9.0');
  });
});
