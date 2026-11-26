import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureReliefData,
  persistReliefData,
  rollbackReliefStorage,
  migrateReliefData,
  buildReliefIndexes,
  applyReliefRetentionPolicy,
  getReliefMigrationMeta,
  __resetReliefMemoryStorage,
} from './reliefOperationsMigrations';
import { RELIEF_SCHEMA_VERSION } from './reliefOperationsConstants';

const LEGACY_DATASET = {
  reliefIncidents: [
    {
      id: 'LEGACY-INC-1',
      name: 'Legacy Flood',
      locality: 'Old Town',
      jurisdictionId: 'WARD-150',
      disasterType: 'flood',
      status: 'active',
      startedAt: '2025-07-01T00:00:00.000Z',
    },
  ],
  reports: [
    {
      id: 'LEGACY-NEED-1',
      category: 'water',
      locality: 'Old Town',
      jurisdictionId: 'WARD-150',
      quantity: 100,
      peopleAffected: 50,
      description: 'Legacy imported water request.',
    },
    {
      id: 'LEGACY-NEED-2',
      category: 'food',
      locality: 'Old Town',
      jurisdictionId: 'WARD-150',
      quantity: 40,
      peopleAffected: 40,
      description: 'Legacy imported food request.',
      status: 'verified',
    },
  ],
  inventory: [
    {
      id: 'LEGACY-RES-1',
      name: 'Legacy water stock',
      category: 'water',
      jurisdictionId: 'WARD-150',
      quantityOnHand: 500,
    },
  ],
  distributionSites: [
    {
      id: 'LEGACY-SITE-1',
      name: 'Legacy Site',
      address: 'Old Town ground',
      locality: 'Old Town',
      jurisdictionId: 'WARD-150',
    },
  ],
  proposals: [
    {
      id: 'LEGACY-ALLOC-1',
      needId: 'LEGACY-NEED-1',
      resourceId: 'LEGACY-RES-1',
      category: 'water',
      quantity: 50,
    },
  ],
  partnerVerifications: [
    {
      id: 'LEGACY-PARTNER-1',
      organisationName: 'Legacy Partner',
      jurisdictionId: 'WARD-150',
      status: 'verified',
    },
  ],
  deliveryConfirmations: [],
  stockMovements: [],
};

describe('reliefOperationsMigrations (#747)', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
      clear: () => store.clear(),
    });
    __resetReliefMemoryStorage();
    rollbackReliefStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes an empty database with the current schema and indexes', () => {
    const data = ensureReliefData();
    expect(data.incidents.length).toBeGreaterThan(0);
    expect(data.needs.length).toBeGreaterThan(0);
    expect(data.resources.length).toBeGreaterThan(0);
    expect(data.sites.length).toBeGreaterThan(0);
    expect(data.partners.length).toBeGreaterThan(0);
    expect(data.indexes.needsById.size).toBe(data.needs.length);
    expect(data.indexes.needsByToken.size).toBeGreaterThan(0);
    expect(data.indexes.allocationsByStatus.get('pending_approval').length).toBeGreaterThan(0);
    expect(getReliefMigrationMeta().schemaVersion).toBe(RELIEF_SCHEMA_VERSION);
  });

  it('migrates a representative legacy dataset without losing records', () => {
    const { data, appliedMigrations, schemaVersion } = migrateReliefData(LEGACY_DATASET, 0);

    expect(schemaVersion).toBe(RELIEF_SCHEMA_VERSION);
    expect(appliedMigrations).toContain('v1_normalize_relief_collections');
    expect(data.needs).toHaveLength(2);
    expect(data.needs.every((need) => need.schemaVersion === RELIEF_SCHEMA_VERSION)).toBe(true);
    expect(data.needs.every((need) => need.createdAt && need.updatedAt && need.createdBy)).toBe(true);
    expect(data.needs[0].status).toBe('submitted');
    expect(data.needs[1].status).toBe('verified');
    expect(data.needs[0].trackingToken).toMatch(/^TRK-RLF-/);
    expect(data.resources).toHaveLength(1);
    expect(data.resources[0].quantityReserved).toBe(0);
    expect(data.sites[0].isPublic).toBe(true);
    expect(data.allocations[0].status).toBe('pending_approval');
    expect(data.partners[0].status).toBe('verified');
    expect(data.incidents[0].status).toBe('active');
  });

  it('is idempotent when re-run at the current version', () => {
    const first = migrateReliefData(LEGACY_DATASET, 0);
    const second = migrateReliefData(first.data, RELIEF_SCHEMA_VERSION);
    expect(second.appliedMigrations).toEqual([]);
    expect(second.data.needs).toHaveLength(2);
  });

  it('builds jurisdiction, status, category and token indexes', () => {
    const data = ensureReliefData();
    const indexes = buildReliefIndexes(data);
    expect(indexes.needsByJurisdiction.get('WARD-150').length).toBeGreaterThan(0);
    expect(indexes.needsByCategoryStatus.get('water:verified').length).toBeGreaterThan(0);
    expect(indexes.needsByCreatedAt.size).toBeGreaterThan(0);
    expect(indexes.resourcesByJurisdictionCategory.get('WARD-150:water').length).toBeGreaterThan(0);
    expect(indexes.allocationsByJurisdiction.get('WARD-150').length).toBeGreaterThan(0);
    expect(indexes.allocationsByCreatedAt.size).toBeGreaterThan(0);
    expect(indexes.allocationsByStatus.get('pending_approval').length).toBeGreaterThan(0);
    expect(indexes.movementsByResource.size).toBeGreaterThan(0);
    expect(indexes.partnersById.size).toBeGreaterThan(0);
    expect(indexes.auditsByJurisdiction).toBeInstanceOf(Map);
  });

  it('rolls back to the clean seed snapshot', () => {
    const data = ensureReliefData();
    data.needs[0].privateNote = 'temporary';
    persistReliefData(data);
    expect(ensureReliefData().needs[0].privateNote).toBe('temporary');

    const restored = rollbackReliefStorage();
    expect(restored.needs[0].privateNote).not.toBe('temporary');
    expect(restored.meta.schemaVersion).toBe(RELIEF_SCHEMA_VERSION);
  });

  it('applies retention by anonymizing old terminal needs and archiving closed incidents', () => {
    const data = ensureReliefData();
    const oldIso = '2023-01-01T00:00:00.000Z';
    data.needs[0] = {
      ...data.needs[0],
      status: 'rejected',
      updatedAt: oldIso,
      reporterRef: 'anon-private',
      description: 'Sensitive free text about a named person.',
      privateNote: 'Private operator note.',
      coordinates: { lat: 12.9, lng: 77.6 },
    };
    data.incidents[0] = { ...data.incidents[0], status: 'closed', updatedAt: oldIso };
    data.auditLogs = [
      { id: 'AUDIT-OLD', action: 'OLD', timestamp: oldIso, jurisdictionId: 'WARD-150' },
      { id: 'AUDIT-NEW', action: 'NEW', timestamp: new Date().toISOString(), jurisdictionId: 'WARD-150' },
    ];
    persistReliefData(data);

    const result = applyReliefRetentionPolicy({ now: Date.parse('2026-11-19T00:00:00.000Z') });
    expect(result.modified).toBe(true);
    expect(result.anonymizedNeeds).toBe(1);
    expect(result.archivedIncidents).toBe(1);
    expect(result.archivedAuditEntries).toBe(1);

    const after = ensureReliefData();
    const anonymized = after.needs.find((need) => need.id === data.needs[0].id);
    expect(anonymized.reporterRef).toBeNull();
    expect(anonymized.description).toMatch(/archived/i);
    expect(anonymized.privateNote).toBe('');
    expect(anonymized.archived).toBe(true);
    expect(after.incidents.find((incident) => incident.id === data.incidents[0].id).status).toBe('archived');
    expect(after.auditLogs.some((entry) => entry.id === 'AUDIT-OLD')).toBe(false);
    expect(after.archive.auditLogs.some((entry) => entry.id === 'AUDIT-OLD')).toBe(true);
  });

  it('falls back to memory storage when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });
    __resetReliefMemoryStorage();
    const data = ensureReliefData();
    expect(data.needs.length).toBeGreaterThan(0);
    expect(ensureReliefData().needs.length).toBeGreaterThan(0);
  });
});
