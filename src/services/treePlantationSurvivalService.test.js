import { describe, it, expect } from 'vitest';
import {
  SURVIVAL_STATUS,
  aggregateGreenAssetSummary,
  appendGreenAssetEvidence,
  getBuiltInGreenAssets,
  migrateGreenAssetStoreState,
  registerGreenAsset,
  verifyGreenAssetSurvival,
} from './treePlantationSurvivalService.js';

describe('Tree-Plantation Survival & Public Green Asset Registry (#1441)', () => {
  it('distinguishes planted unverified from verified surviving trees', () => {
    const assets = getBuiltInGreenAssets();
    const summary = aggregateGreenAssetSummary(assets);

    expect(summary.totalPlantedCount).toBe(2);
    expect(summary.verifiedSurvivingCount).toBe(1);
    expect(summary.unverifiedPlantedCount).toBe(1);
    expect(summary.survivalRate).toBe(0.5);
  });

  it('prevents duplicate geotagged green asset registrations and rejects PII', () => {
    const assets = getBuiltInGreenAssets();
    const dup = registerGreenAsset(assets, {
      batchId: 'MONSOON-2026-W14',
      species: 'Azadirachta indica (Neem)',
      steward: 'Municipal Horticulture Wing',
      wardId: 'ward-14',
      lat: 26.8471,
      lng: 80.9462, // rounds to 26.847, 80.946 -> duplicate
    });
    expect(dup.valid).toBe(false);
    expect(dup.statusCode).toBe(409);

    const pii = registerGreenAsset(assets, {
      batchId: 'B-2',
      species: 'Neem',
      steward: 'Aadhaar 2345 6789 0123',
      wardId: 'ward-14',
      lat: 26.85,
      lng: 80.95,
    });
    expect(pii.valid).toBe(false);
    expect(pii.statusCode).toBe(400);
  });

  it('appends citizen evidence and verifies survival with official provenance', () => {
    const assets = getBuiltInGreenAssets();
    const unverified = assets.find((a) => a.survivalStatus === SURVIVAL_STATUS.PLANTED_UNVERIFIED);

    const withEv = appendGreenAssetEvidence(
      unverified,
      { note: 'Sapling watered and tree guard secured.' },
      'citizen-1'
    );
    expect(withEv.evidenceHistory).toHaveLength(2);

    const verified = verifyGreenAssetSurvival(withEv, {
      actorId: 'admin-1',
      role: 'admin',
      survivalStatus: SURVIVAL_STATUS.VERIFIED_SURVIVING,
      inspectionDate: '2026-11-22',
      officialSource: {
        source: 'LMC Field Horticulture Inspection #90',
        jurisdiction: 'IN-UP',
        effectiveDate: '2026-11-22',
        lastVerifiedAt: '2026-11-22T00:00:00.000Z',
      },
    });
    expect(verified.survivalStatus).toBe(SURVIVAL_STATUS.VERIFIED_SURVIVING);
    expect(verified.officialSource.verified).toBe(true);

    const migrated = migrateGreenAssetStoreState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
