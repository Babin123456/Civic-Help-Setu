import { describe, it, expect, beforeEach } from 'vitest';
import {
  TEMPORAL_SCHEMA_VERSION,
  normalizeLegacyRule,
  createPreMigrationBackup,
  applyTemporalPolicyMigration,
  rollbackTemporalPolicyMigration,
} from './temporalPolicyMigrations';
import { resetRulesToDefault } from './temporalPolicyStorage';
import { SYNTHETIC_CYCLIC_RULES } from '../test/fixtures/temporalPolicyFixtures';

describe('Temporal Policy Migrations & Rollback (#1155)', () => {
  beforeEach(() => {
    resetRulesToDefault();
  });

  it('normalizes legacy un-versioned rules into EffectiveDatedRule structure', () => {
    const legacy = {
      serviceId: 'scheme_pension_legacy',
      name: 'Legacy Pension Scheme',
      publishedDate: '2020-05-15T00:00:00.000Z',
      authority: 'Department of Social Justice',
      circularNo: 'CIRCULAR-2020-99',
    };

    const normalized = normalizeLegacyRule(legacy);
    expect(normalized.ruleFamilyId).toBe('scheme_pension_legacy');
    expect(normalized.version).toBe('1.0.0');
    expect(normalized.effectiveFrom).toBe('2020-05-15T00:00:00.000Z');
    expect(normalized.sourceMetadata.notificationNumber).toBe('CIRCULAR-2020-99');
    expect(normalized.sourceMetadata.isVerified).toBe(true);
  });

  it('creates pre-migration backup snapshots successfully', () => {
    const backup = createPreMigrationBackup();
    expect(backup.timestamp).toBeDefined();
    expect(Array.isArray(backup.rules)).toBe(true);
    expect(backup.rules.length).toBeGreaterThan(0);
  });

  it('applies schema migration and stamps metadata version 1.0.0', () => {
    const res = applyTemporalPolicyMigration();
    expect(res.success).toBe(true);
    expect(res.schemaVersion).toBe(TEMPORAL_SCHEMA_VERSION);
    expect(res.migratedCount).toBeGreaterThan(0);
  });

  it('aborts migration and rolls back automatically if rules contain cyclic supersession graphs', () => {
    const res = applyTemporalPolicyMigration(SYNTHETIC_CYCLIC_RULES);
    expect(res.success).toBe(false);
    expect(res.rolledBack).toBe(true);
    expect(res.error).toContain('circular dependency');
  });

  it('supports explicit manual rollback to the previous backup snapshot', () => {
    createPreMigrationBackup();
    const rollback = rollbackTemporalPolicyMigration();
    expect(rollback.success).toBe(true);
    expect(rollback.restoredTimestamp).toBeDefined();
  });
});
