import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProgressiveDataResidencyService,
  DataSensitivityTier,
  AllowedRegions,
  DataResidencyError
} from './progressiveDataResidencyService.js';

describe('ProgressiveDataResidencyService', () => {
  let service;

  beforeEach(() => {
    service = new ProgressiveDataResidencyService();
  });

  it('permits registering citizen PII in domestic Indian regions', () => {
    const dataset = service.registerDataset({
      datasetId: 'ds_caste_records_ka',
      classification: DataSensitivityTier.RESTRICTED_CITIZEN_PII,
      targetRegion: AllowedRegions.IN_MUMBAI,
      recordsCount: 50000
    });

    expect(dataset.datasetId).toBe('ds_caste_records_ka');
    expect(dataset.currentRegion).toBe(AllowedRegions.IN_MUMBAI);
  });

  it('strictly forbids registering citizen PII outside domestic Indian boundaries', () => {
    expect(() => {
      service.registerDataset({
        datasetId: 'ds_illegal_export',
        classification: DataSensitivityTier.RESTRICTED_CITIZEN_PII,
        targetRegion: AllowedRegions.GLOBAL_ANY
      });
    }).toThrow(DataResidencyError);
  });

  it('validates write operations and prevents cross-border breaches', () => {
    service.registerDataset({
      datasetId: 'ds_identity_proofs',
      classification: DataSensitivityTier.CRITICAL_IDENTITY_DATA,
      targetRegion: AllowedRegions.IN_HYDERABAD
    });

    expect(() => {
      service.validateBoundaryAccess('ds_identity_proofs', 'us-east-1', 'WRITE');
    }).toThrow('cross-border');
  });

  it('manages migration checkpoints with verified rollback capabilities', () => {
    service.registerDataset({
      datasetId: 'ds_pension_ka',
      classification: DataSensitivityTier.RESTRICTED_CITIZEN_PII,
      targetRegion: AllowedRegions.IN_MUMBAI,
      recordsCount: 1000
    });

    const plan = service.createMigrationPlan('mig_01', 'ds_pension_ka', AllowedRegions.IN_HYDERABAD);
    expect(plan.status).toBe('PREPARED');

    service.executeMigration('mig_01');
    expect(service.registeredDatasets.get('ds_pension_ka').currentRegion).toBe(AllowedRegions.IN_HYDERABAD);

    // Rollback
    const rolledBack = service.rollbackMigration('mig_01');
    expect(rolledBack.status).toBe('ROLLED_BACK');
    expect(service.registeredDatasets.get('ds_pension_ka').currentRegion).toBe(AllowedRegions.IN_MUMBAI);
  });
});
