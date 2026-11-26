/**
 * src/services/waterQualityMigrations.js
 * Schema migration manager and rollback strategy for Water Quality Register (#754).
 */

import { INITIAL_WATER_QUALITY_STORE } from '../data/waterQualitySeed.js';

export const MIGRATIONS = [
  {
    fromVersion: '0.9.0',
    toVersion: '1.0.0',
    description: 'Upgrade initial unversioned schema to normalized IS 10500:2012 schema contract.',
    migrate: (oldData) => {
      const data = { ...oldData };
      data.schemaVersion = '1.0.0';
      if (!Array.isArray(data.waterPoints)) data.waterPoints = [];
      if (!Array.isArray(data.samplingEvents)) data.samplingEvents = [];
      if (!Array.isArray(data.labResults)) data.labResults = [];
      if (!Array.isArray(data.correctiveActions)) data.correctiveActions = [];
      if (!Array.isArray(data.labs)) data.labs = [];
      if (!Array.isArray(data.auditTrail)) data.auditTrail = [];

      // Ensure every water point has mandatory fields
      data.waterPoints = data.waterPoints.map((wp) => ({
        ...wp,
        operationalStatus: wp.operationalStatus || 'active',
        testedCount: wp.testedCount || 0,
        overallComplianceStatus: wp.overallComplianceStatus || 'compliant',
      }));

      // Ensure every lab result has supersession pointer
      data.labResults = data.labResults.map((lr) => ({
        ...lr,
        supersededByResultId: lr.supersededByResultId || null,
      }));

      return data;
    },
    rollback: (newData) => {
      const data = { ...newData };
      data.schemaVersion = '0.9.0';
      return data;
    },
  },
];

/**
 * Runs pending schema migrations on a dataset.
 *
 * @param {object} store - Raw stored dataset
 * @returns {{ success: boolean, data: object, appliedMigrations: string[], error?: string }}
 */
export function runMigrations(store) {
  if (!store || typeof store !== 'object') {
    return {
      success: true,
      data: JSON.parse(JSON.stringify(INITIAL_WATER_QUALITY_STORE)),
      appliedMigrations: ['initialized-fresh'],
    };
  }

  let current = JSON.parse(JSON.stringify(store));
  let currentVersion = current.schemaVersion || '0.9.0';
  const appliedMigrations = [];

  try {
    for (const migration of MIGRATIONS) {
      if (currentVersion === migration.fromVersion) {
        current = migration.migrate(current);
        currentVersion = migration.toVersion;
        appliedMigrations.push(`${migration.fromVersion}->${migration.toVersion}`);
      }
    }

    current.schemaVersion = currentVersion;
    return {
      success: true,
      data: current,
      appliedMigrations,
    };
  } catch (err) {
    return {
      success: false,
      data: store,
      appliedMigrations,
      error: `Migration failed at ${currentVersion}: ${err.message}`,
    };
  }
}

/**
 * Reverts the most recent migration step
 */
export function rollbackMigration(store) {
  if (!store || !store.schemaVersion) {
    return { success: false, error: 'No schema version present to rollback.' };
  }

  const migration = [...MIGRATIONS].reverse().find((m) => m.toVersion === store.schemaVersion);
  if (!migration) {
    return { success: false, error: `No rollback step defined for version ${store.schemaVersion}.` };
  }

  try {
    const rolledBack = migration.rollback(store);
    return {
      success: true,
      data: rolledBack,
      rolledBackFrom: migration.toVersion,
      rolledBackTo: migration.fromVersion,
    };
  } catch (err) {
    return { success: false, error: `Rollback failed: ${err.message}` };
  }
}
