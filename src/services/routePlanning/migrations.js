/**
 * Route Planning Database Migrations and Schema Version Management
 *
 * Handles schema evolution for the municipal waste collection route and segregation
 * audit data model. Each migration is idempotent and includes a rollback strategy.
 *
 * Migration keys correspond to schemaVersion in the data models.
 */

// Safe UUID generator without external dependencies
export function generateUUID() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Storage key used across the route planning module
export const STORAGE_KEY = 'civicbridge_route_planning_v1';

// Schema version constants
export const SCHEMA_VERSIONS = {
  V1_0_0: '1.0.0', // Initial release with core entities
  V1_1_0: '1.1.0', // Added compliance percentage and ratings to SegregationAudit
  V1_2_0: '1.2.0', // Added RouteRecommendation model and route run tracking
  V1_3_0: '1.3.0', // Added missed pickup tracking and enhanced audit photos / vehicle load
};

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSIONS.V1_3_0;

/**
 * Migration definitions:
 */
export const migrationV1_0_0_to_V1_1_0 = {
  title: 'Add segregation compliance tracking',
  version: '1.1.0',
  upRecord(record) {
    if (record.recordType === 'SegregationAudit' || ('observedStreams' in record && !('capacityKg' in record))) {
      const observed = record.observedStreams || { wet: 0, dry: 0, hazardous: 0 };
      const expected = record.expectedStreams || { wet: 1, dry: 1, hazardous: 1 };
      const totalObserved = (observed.wet || 0) + (observed.dry || 0) + (observed.hazardous || 0);
      const totalExpected = (expected.wet || 0) + (expected.dry || 0) + (expected.hazardous || 0);
      const compliance = totalExpected > 0 ? Math.min(100, Math.round((totalObserved / totalExpected) * 100)) : 75;

      return {
        ...record,
        compliancePercentage: record.compliancePercentage !== undefined ? record.compliancePercentage : compliance,
        rating: record.rating || (compliance >= 80 ? 'EXCELLENT' : compliance >= 60 ? 'GOOD' : compliance >= 40 ? 'FAIR' : 'POOR'),
        schemaVersion: SCHEMA_VERSIONS.V1_1_0,
      };
    }
    return { ...record, schemaVersion: SCHEMA_VERSIONS.V1_1_0 };
  },
};

export const migrationV1_1_0_to_V1_2_0 = {
  title: 'Add route runs and recommendations',
  version: '1.2.0',
  upRecord(record) {
    if (record.recordType === 'RouteRun' || ('pickupPointsVisited' in record)) {
      return {
        ...record,
        pickupPointsVisited: record.pickupPointsVisited || 0,
        pickupPointsTotal: record.pickupPointsTotal || 0,
        wasteCollectedKg: record.wasteCollectedKg || 0,
        schemaVersion: SCHEMA_VERSIONS.V1_2_0,
      };
    }
    if (record.recordType === 'RouteRecommendation' || ('suggestedData' in record)) {
      return {
        ...record,
        priority: record.priority || 'MEDIUM',
        status: record.status || 'PROPOSED',
        schemaVersion: SCHEMA_VERSIONS.V1_2_0,
      };
    }
    return { ...record, schemaVersion: SCHEMA_VERSIONS.V1_2_0 };
  },
};

export const migrationV1_2_0_to_V1_3_0 = {
  title: 'Add missed pickup tracking and vehicle capacity enhancements',
  version: '1.3.0',
  upRecord(record) {
    if (record.recordType === 'RouteRun' || ('pickupPointsVisited' in record)) {
      return {
        ...record,
        missedPickupIds: Array.isArray(record.missedPickupIds) ? record.missedPickupIds : [],
        schemaVersion: SCHEMA_VERSIONS.V1_3_0,
      };
    }
    if (record.recordType === 'Vehicle' || ('registrationNumber' in record)) {
      return {
        ...record,
        currentLoadKg: record.currentLoadKg !== undefined ? record.currentLoadKg : 0,
        currentLoadLitres: record.currentLoadLitres !== undefined ? record.currentLoadLitres : 0,
        schemaVersion: SCHEMA_VERSIONS.V1_3_0,
      };
    }
    if (record.recordType === 'SegregationAudit' || ('observedStreams' in record)) {
      return {
        ...record,
        photos: Array.isArray(record.photos) ? record.photos : [],
        schemaVersion: SCHEMA_VERSIONS.V1_3_0,
      };
    }
    return { ...record, schemaVersion: SCHEMA_VERSIONS.V1_3_0 };
  },
};

/**
 * Migrate a single record up to targetVersion.
 */
export function migrateRecord(record, targetVersion = CURRENT_SCHEMA_VERSION) {
  if (!record || typeof record !== 'object') return record;

  let current = { ...record };
  let version = current.schemaVersion || '1.0.0';

  if (version < SCHEMA_VERSIONS.V1_1_0 && targetVersion >= SCHEMA_VERSIONS.V1_1_0) {
    current = migrationV1_0_0_to_V1_1_0.upRecord(current);
    version = SCHEMA_VERSIONS.V1_1_0;
  }
  if (version < SCHEMA_VERSIONS.V1_2_0 && targetVersion >= SCHEMA_VERSIONS.V1_2_0) {
    current = migrationV1_1_0_to_V1_2_0.upRecord(current);
    version = SCHEMA_VERSIONS.V1_2_0;
  }
  if (version < SCHEMA_VERSIONS.V1_3_0 && targetVersion >= SCHEMA_VERSIONS.V1_3_0) {
    current = migrationV1_2_0_to_V1_3_0.upRecord(current);
    version = SCHEMA_VERSIONS.V1_3_0;
  }

  current.schemaVersion = version;
  return current;
}

/**
 * Execute pending migrations across an array of records.
 * Idempotent: safe to run multiple times.
 */
export function migrateRecords(records, targetVersion = CURRENT_SCHEMA_VERSION) {
  if (!Array.isArray(records)) return [];
  return records.map((record) => migrateRecord(record, targetVersion));
}

/**
 * Rollback all records to a target schema version.
 */
export function rollbackRecords(records, targetVersion = SCHEMA_VERSIONS.V1_0_0) {
  if (!Array.isArray(records)) return [];

  return records.map((r) => {
    let rolled = { ...r };

    if (rolled.schemaVersion >= SCHEMA_VERSIONS.V1_3_0 && targetVersion < SCHEMA_VERSIONS.V1_3_0) {
      delete rolled.missedPickupIds;
      delete rolled.photos;
      rolled.schemaVersion = SCHEMA_VERSIONS.V1_2_0;
    }
    if (rolled.schemaVersion >= SCHEMA_VERSIONS.V1_2_0 && targetVersion < SCHEMA_VERSIONS.V1_2_0) {
      delete rolled.suggestedData;
      rolled.schemaVersion = SCHEMA_VERSIONS.V1_1_0;
    }
    if (rolled.schemaVersion >= SCHEMA_VERSIONS.V1_1_0 && targetVersion < SCHEMA_VERSIONS.V1_1_0) {
      delete rolled.compliancePercentage;
      delete rolled.rating;
      rolled.schemaVersion = SCHEMA_VERSIONS.V1_0_0;
    }

    return rolled;
  });
}

/**
 * Validate that a record conforms to its declared schema version.
 */
export function validateRecordSchema(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    errors.push('Record is not an object');
    return errors;
  }

  if (!record.schemaVersion) {
    errors.push('Missing schemaVersion');
    return errors;
  }

  const isAudit = record.recordType === 'SegregationAudit' || 'observedStreams' in record;
  const isRun = record.recordType === 'RouteRun' || 'pickupPointsVisited' in record;
  const isVehicle = record.recordType === 'Vehicle' || 'registrationNumber' in record;

  if (record.schemaVersion >= '1.1.0' && isAudit) {
    if (record.compliancePercentage === undefined) {
      errors.push('SegregationAudit V1.1+ requires compliancePercentage');
    }
    if (record.rating === undefined) {
      errors.push('SegregationAudit V1.1+ requires rating');
    }
  }

  if (record.schemaVersion >= '1.2.0' && isRun) {
    if (!record.routeId) {
      errors.push('RouteRun V1.2+ requires routeId');
    }
  }

  if (record.schemaVersion >= '1.3.0') {
    if (isRun && !Array.isArray(record.missedPickupIds)) {
      errors.push('RouteRun V1.3+ requires missedPickupIds array');
    }
    if (isVehicle && record.currentLoadKg === undefined) {
      errors.push('Vehicle V1.3+ requires currentLoadKg');
    }
  }

  return errors;
}

/**
 * Run migrations against the storage engine.
 */
export function runMigrations(storageEngine) {
  const result = { migrated: 0, rolledBack: 0, errors: [] };
  if (!storageEngine || typeof storageEngine.getItem !== 'function') {
    result.errors.push('Invalid storage engine provided');
    return result;
  }

  const raw = storageEngine.getItem(STORAGE_KEY);
  if (!raw) {
    storageEngine.setItem(STORAGE_KEY, JSON.stringify([]));
    return result;
  }

  let records;
  try {
    records = JSON.parse(raw);
  } catch (e) {
    result.errors.push(`Failed to parse stored records: ${e.message}`);
    return result;
  }

  if (!Array.isArray(records)) {
    result.errors.push('Stored records are not an array');
    return result;
  }

  const migrated = migrateRecords(records, CURRENT_SCHEMA_VERSION);
  const updatedJson = JSON.stringify(migrated);
  if (updatedJson !== raw) {
    try {
      storageEngine.setItem(STORAGE_KEY, updatedJson);
      result.migrated = records.length;
    } catch (e) {
      result.errors.push(`Failed to save migrated records: ${e.message}`);
    }
  }

  return result;
}
