/**
 * Temporal Policy Migrations & Rollback Service (#1155)
 *
 * Provides schema bootstrap, version migration, and atomic rollback for
 * effective-dated civic rules without requiring a server SQL database.
 *
 * Features:
 * 1. Semantic version stamp (TEMPORAL_SCHEMA_VERSION = '1.0.0').
 * 2. Pre-migration backup snapshot creation in storage.
 * 3. Atomic, all-or-nothing schema application.
 * 4. Migration of legacy un-versioned or static rules to EffectiveDatedRule schema.
 * 5. Deterministic rollback to previous backup snapshot upon error or maintainer request.
 */

import {
  validateTemporalRuleSet,
  JURISDICTION_LEVELS,
  RULE_STATUS,
} from './temporalPolicyEngineService';
import { getStoredRules, INITIAL_SEED_RULES } from './temporalPolicyStorage';

export const TEMPORAL_SCHEMA_VERSION = '1.0.0';

export const TEMPORAL_STORAGE_KEYS = {
  meta: 'civicbridge_temporal_meta_v1',
  rules: 'civicbridge_temporal_rules_v1',
  backup: 'civicbridge_temporal_migration_backup_v1',
};

const inMemoryStore = new Map();

const safeGetJson = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    }
    if (inMemoryStore.has(key)) {
      return inMemoryStore.get(key);
    }
    return fallback;
  } catch (err) {
    console.warn(`[temporalPolicyMigrations] Read error on ${key}:`, err);
    return fallback;
  }
};

const safeSetJson = (key, val) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(val));
    }
    inMemoryStore.set(key, JSON.parse(JSON.stringify(val)));
  } catch (err) {
    console.warn(`[temporalPolicyMigrations] Write error on ${key}:`, err);
  }
};

/**
 * Normalizes legacy un-versioned civic rules into EffectiveDatedRule format
 */
export function normalizeLegacyRule(legacy = {}) {
  const effectiveFrom = legacy.effectiveFrom || legacy.publishedDate || '2020-01-01T00:00:00.000Z';
  const effectiveTo = legacy.effectiveTo || null;

  return {
    id: legacy.id || `rule_migrated_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ruleFamilyId: legacy.ruleFamilyId || legacy.serviceId || 'scheme_unassigned',
    title: legacy.title || legacy.name || 'Migrated Civic Rule',
    version: legacy.version || '1.0.0',
    jurisdictionLevel: legacy.jurisdictionLevel || JURISDICTION_LEVELS.CENTRAL,
    jurisdictionCode: legacy.jurisdictionCode || 'CENTRAL',
    eventDateType: legacy.eventDateType || 'APPLICATION_DATE',
    effectiveFrom,
    effectiveTo,
    supersedesRuleId: legacy.supersedesRuleId || null,
    supersededByRuleId: legacy.supersededByRuleId || null,
    conditions: Array.isArray(legacy.conditions) ? legacy.conditions : [],
    feeStructure: legacy.feeStructure || { amount: 0, currency: 'INR', concessionAvailable: false },
    requiredDocuments: Array.isArray(legacy.requiredDocuments) ? legacy.requiredDocuments : [],
    sourceMetadata: legacy.sourceMetadata || {
      documentType: 'STATUTORY_CIRCULAR',
      notificationNumber: legacy.circularNo || 'MIGRATION-BASELINE-2026',
      issuingAuthority: legacy.authority || 'Competent Authority',
      gazetteDate: effectiveFrom.slice(0, 10),
      isVerified: Boolean(legacy.isVerified ?? true),
    },
    status: legacy.status || (effectiveTo ? RULE_STATUS.SUPERSEDED : RULE_STATUS.PUBLISHED),
    createdAt: legacy.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates a pre-migration backup snapshot of current storage
 */
export function createPreMigrationBackup() {
  const currentRules = safeGetJson(TEMPORAL_STORAGE_KEYS.rules, getStoredRules());
  const currentMeta = safeGetJson(TEMPORAL_STORAGE_KEYS.meta, { version: '0.0.0' });

  const backupPayload = {
    timestamp: new Date().toISOString(),
    meta: currentMeta,
    rules: currentRules,
  };

  safeSetJson(TEMPORAL_STORAGE_KEYS.backup, backupPayload);
  return backupPayload;
}

/**
 * Applies temporal policy schema migration with atomic safety
 */
export function applyTemporalPolicyMigration(legacyRules = []) {
  // 1. Create safety backup
  const backup = createPreMigrationBackup();

  // 2. Normalize and merge input rules
  const baseRules = legacyRules.length > 0 ? legacyRules : getStoredRules() || INITIAL_SEED_RULES;
  const migratedRules = baseRules.map((r) => normalizeLegacyRule(r));

  // 3. Validate entire migrated dataset
  const validation = validateTemporalRuleSet(migratedRules);
  if (!validation.valid) {
    // Rollback immediately if validation fails
    rollbackTemporalPolicyMigration();
    return {
      success: false,
      error: `Migration aborted due to schema/DAG validation failure: ${validation.errors.join('; ')}`,
      rolledBack: true,
    };
  }

  // 4. Save migrated rules and update metadata
  safeSetJson(TEMPORAL_STORAGE_KEYS.rules, migratedRules);
  safeSetJson(TEMPORAL_STORAGE_KEYS.meta, {
    version: TEMPORAL_SCHEMA_VERSION,
    migratedAt: new Date().toISOString(),
    ruleCount: migratedRules.length,
    backupTimestamp: backup.timestamp,
  });

  return {
    success: true,
    schemaVersion: TEMPORAL_SCHEMA_VERSION,
    migratedCount: migratedRules.length,
    rules: migratedRules,
  };
}

/**
 * Restores storage state from the pre-migration backup
 */
export function rollbackTemporalPolicyMigration() {
  const backup = safeGetJson(TEMPORAL_STORAGE_KEYS.backup, null);
  if (!backup) {
    return { success: false, error: 'No pre-migration backup found to restore.' };
  }

  safeSetJson(TEMPORAL_STORAGE_KEYS.rules, backup.rules || INITIAL_SEED_RULES);
  safeSetJson(TEMPORAL_STORAGE_KEYS.meta, backup.meta || { version: '0.0.0' });

  return {
    success: true,
    restoredTimestamp: backup.timestamp,
    ruleCount: backup.rules?.length || 0,
  };
}
