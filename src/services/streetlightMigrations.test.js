import { describe, it, expect, beforeEach } from 'vitest';
import {
  ensureStreetlightData,
  buildStreetlightIndexes,
  rollbackStreetlightStorage,
  applyStreetlightRetentionPolicy,
  persistStreetlightData,
} from './streetlightMigrations';
import { STREETLIGHT_SCHEMA_VERSION } from './streetlightConstants';

describe('Streetlight Migrations & Retention Suite (#756)', () => {
  beforeEach(() => {
    rollbackStreetlightStorage();
  });

  it('initializes and migrates storage to current schema version with seed data', () => {
    const data = ensureStreetlightData();
    expect(data.meta.schemaVersion).toBe(STREETLIGHT_SCHEMA_VERSION);
    expect(data.assets.length).toBeGreaterThan(0);
    expect(data.clusters.length).toBeGreaterThan(0);
    expect(data.indexes.assetsById).toBeDefined();
    expect(data.indexes.reportsByTrackingToken).toBeDefined();
  });

  it('builds secondary indexes correctly', () => {
    const testData = {
      assets: [{ id: 'POLE-TEST-1', jurisdictionId: 'WARD-042' }],
      reports: [{ id: 'REP-1', trackingToken: 'TRK-100', clusterId: 'CLUS-1', assetId: 'POLE-TEST-1' }],
      clusters: [{ id: 'CLUS-1', jurisdictionId: 'WARD-042' }],
      workOrders: [{ id: 'WO-1', clusterId: 'CLUS-1' }],
    };

    const indexes = buildStreetlightIndexes(testData);
    expect(indexes.assetsById.has('POLE-TEST-1')).toBe(true);
    expect(indexes.assetsByJurisdiction.get('WARD-042').length).toBe(1);
    expect(indexes.reportsByTrackingToken.get('TRK-100').id).toBe('REP-1');
    expect(indexes.clustersById.get('CLUS-1')).toBeDefined();
    expect(indexes.workOrdersByClusterId.get('CLUS-1').id).toBe('WO-1');
  });

  it('rolls back storage cleanly to fresh seed state', () => {
    const data = ensureStreetlightData();
    data.assets.push({ id: 'POLE-TEMPORARY', jurisdictionId: 'WARD-042' });
    persistStreetlightData(data);

    const rolledBack = rollbackStreetlightStorage();
    expect(rolledBack.assets.find((a) => a.id === 'POLE-TEMPORARY')).toBeUndefined();
    expect(rolledBack.meta.schemaVersion).toBe(STREETLIGHT_SCHEMA_VERSION);
  });

  it('applies retention policy to archive old resolved reports without data leakage', () => {
    const data = ensureStreetlightData();
    const ninetyOneDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();

    data.reports.push({
      id: 'REP-OLD-RESOLVED',
      trackingToken: 'TRK-OLD',
      status: 'resolved',
      reporterHash: 'sensitive_hash_value',
      contactNumber: '9988776655',
      updatedAt: ninetyOneDaysAgo,
    });
    persistStreetlightData(data);

    const retentionResult = applyStreetlightRetentionPolicy(90);
    expect(retentionResult.modified).toBe(true);

    const refreshed = ensureStreetlightData();
    const archivedReport = refreshed.reports.find((r) => r.id === 'REP-OLD-RESOLVED');
    expect(archivedReport.reporterHash).toBe('ARCHIVED');
    expect(archivedReport.contactNumber).toBeNull();
    expect(archivedReport.archived).toBe(true);
  });
});
