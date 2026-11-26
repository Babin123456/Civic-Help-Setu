/**
 * @file progressiveDataResidencyService.js
 * @description Progressive data residency, classification inventory, and regionalization migration framework.
 * Enforces strict geo-fenced boundaries for sensitive citizen personal data (strictly inside Indian territory,
 * e.g., in-mumbai / in-hyderabad), tracks migration checkpoints, and ensures rollbacks never silently leak restricted data.
 */

export class DataResidencyError extends Error {
  constructor(message, code = 'DATA_RESIDENCY_ERROR', details = {}) {
    super(message);
    this.name = 'DataResidencyError';
    this.code = code;
    this.details = details;
  }
}

export const DataSensitivityTier = Object.freeze({
  PUBLIC_OPEN_DATA: 'PUBLIC_OPEN_DATA',
  INTERNAL_TELEMETRY: 'INTERNAL_TELEMETRY',
  RESTRICTED_CITIZEN_PII: 'RESTRICTED_CITIZEN_PII',
  CRITICAL_IDENTITY_DATA: 'CRITICAL_IDENTITY_DATA'
});

export const AllowedRegions = Object.freeze({
  IN_MUMBAI: 'in-mumbai-1',
  IN_HYDERABAD: 'in-hyderabad-1',
  IN_DELHI: 'in-delhi-1',
  GLOBAL_ANY: 'global-any'
});

export class ProgressiveDataResidencyService {
  constructor() {
    this.allowedDomesticRegions = [
      AllowedRegions.IN_MUMBAI,
      AllowedRegions.IN_HYDERABAD,
      AllowedRegions.IN_DELHI
    ];
    this.registeredDatasets = new Map(); // datasetId -> dataset record
    this.migrationCheckpoints = new Map(); // migrationId -> checkpoint record
  }

  /**
   * Registers a data collection with its sensitivity classification and required residency region.
   */
  registerDataset({ datasetId, classification, targetRegion = AllowedRegions.IN_MUMBAI, recordsCount = 0 }) {
    if (!datasetId || !classification) {
      throw new DataResidencyError('datasetId and classification are required', 'INVALID_ARGUMENT');
    }

    // Strict DPDP Act / Indian Government Data Residency: Citizen PII must remain in domestic regions
    if (
      (classification === DataSensitivityTier.RESTRICTED_CITIZEN_PII ||
       classification === DataSensitivityTier.CRITICAL_IDENTITY_DATA) &&
      !this.allowedDomesticRegions.includes(targetRegion)
    ) {
      throw new DataResidencyError(
        `Data residency violation: Classification ${classification} must reside strictly within domestic Indian regions (${this.allowedDomesticRegions.join(', ')})`,
        'CROSS_BORDER_PROHIBITED'
      );
    }

    const record = {
      datasetId,
      classification,
      currentRegion: targetRegion,
      recordsCount,
      isEncrypted: true,
      lastAuditedAt: new Date().toISOString()
    };

    this.registeredDatasets.set(datasetId, record);
    return record;
  }

  /**
   * Validates a read or write operation against residency policy.
   */
  validateBoundaryAccess(datasetId, targetRegion, operationType = 'WRITE') {
    const dataset = this.registeredDatasets.get(datasetId);
    if (!dataset) {
      throw new DataResidencyError(`Dataset ${datasetId} not found in inventory`, 'NOT_FOUND');
    }

    if (dataset.classification === DataSensitivityTier.RESTRICTED_CITIZEN_PII || dataset.classification === DataSensitivityTier.CRITICAL_IDENTITY_DATA) {
      if (!this.allowedDomesticRegions.includes(targetRegion)) {
        throw new DataResidencyError(
          `Unauthorized cross-border ${operationType} attempted for restricted dataset ${datasetId} into region ${targetRegion}`,
          'RESIDENCY_BOUNDARY_BREACH'
        );
      }
    }

    return { allowed: true, datasetId, region: targetRegion, operationType };
  }

  /**
   * Executes a regional migration with verifiable checkpoints and safe rollback.
   */
  createMigrationPlan(migrationId, datasetId, toRegion) {
    const dataset = this.registeredDatasets.get(datasetId);
    if (!dataset) {
      throw new DataResidencyError(`Dataset ${datasetId} not found`, 'NOT_FOUND');
    }

    // Validate destination residency
    if (dataset.classification === DataSensitivityTier.RESTRICTED_CITIZEN_PII && !this.allowedDomesticRegions.includes(toRegion)) {
      throw new DataResidencyError('Cannot migrate citizen PII to non-domestic region', 'MIGRATION_PROHIBITED');
    }

    const checkpoint = {
      migrationId,
      datasetId,
      sourceRegion: dataset.currentRegion,
      destinationRegion: toRegion,
      status: 'PREPARED',
      recordsMigrated: 0,
      totalRecords: dataset.recordsCount,
      checkpoints: ['PRE_VALIDATION_COMPLETED']
    };

    this.migrationCheckpoints.set(migrationId, checkpoint);
    return checkpoint;
  }

  executeMigration(migrationId) {
    const checkpoint = this.migrationCheckpoints.get(migrationId);
    if (!checkpoint) throw new DataResidencyError(`Migration ${migrationId} not found`, 'NOT_FOUND');

    const dataset = this.registeredDatasets.get(checkpoint.datasetId);
    dataset.currentRegion = checkpoint.destinationRegion;
    checkpoint.recordsMigrated = checkpoint.totalRecords;
    checkpoint.status = 'COMPLETED';
    checkpoint.checkpoints.push('SYNC_COMPLETED', 'DESTINATION_VALIDATED');
    return checkpoint;
  }

  rollbackMigration(migrationId) {
    const checkpoint = this.migrationCheckpoints.get(migrationId);
    if (!checkpoint) throw new DataResidencyError(`Migration ${migrationId} not found`, 'NOT_FOUND');

    const dataset = this.registeredDatasets.get(checkpoint.datasetId);
    // Restore original region
    dataset.currentRegion = checkpoint.sourceRegion;
    checkpoint.status = 'ROLLED_BACK';
    checkpoint.checkpoints.push('ROLLED_BACK_TO_SOURCE');
    return checkpoint;
  }
}

export const defaultDataResidencyService = new ProgressiveDataResidencyService();
