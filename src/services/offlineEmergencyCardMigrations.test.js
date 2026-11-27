import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONTACT_STATUS,
  OFFLINE_CARD_BACKUP_KEY,
  OFFLINE_CARD_ERROR_CODES,
  OFFLINE_CARD_SCHEMA_VERSION,
  OFFLINE_CARD_STORAGE_KEY,
  SOURCE_STATUS,
} from './offlineEmergencyCardConstants.js';
import {
  OFFLINE_CARD_COLLECTIONS,
  applyOfflineCardRetentionPolicy,
  buildOfflineCardIndexes,
  createEmptyStore,
  createSeedStore,
  isValidStoreShape,
  loadOfflineCardStore,
  migrateOfflineCardStore,
  persistOfflineCardStore,
  resetOfflineCardStorageForTests,
  resetOfflineCardStoreToEmpty,
  restoreOfflineCardBackup,
  rollbackOfflineCardStore,
  runOfflineCardTransaction,
} from './offlineEmergencyCardMigrations.js';

const NOW = '2026-11-26T10:00:00.000Z';

const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    dump: () => map,
  };
};

describe('offline emergency card migrations and persistence (#761)', () => {
  let storage;

  beforeEach(() => {
    storage = makeStorage();
    resetOfflineCardStorageForTests();
  });

  it('creates an empty store with every collection and no seeded records', () => {
    const empty = createEmptyStore({ now: NOW });

    expect(empty.schemaVersion).toBe(OFFLINE_CARD_SCHEMA_VERSION);
    expect(empty.meta.seeded).toBe(false);
    for (const collection of OFFLINE_CARD_COLLECTIONS) {
      expect(Array.isArray(empty[collection])).toBe(true);
      expect(empty[collection]).toHaveLength(0);
    }
    expect(isValidStoreShape(empty)).toBe(true);
    expect(isValidStoreShape({ ...empty, auditEvents: null })).toBe(false);
  });

  it('loads an empty store when seeding is disabled', () => {
    const loaded = loadOfflineCardStore({ storage, seed: false, now: NOW });
    expect(loaded.jurisdictionContacts).toHaveLength(0);
    expect(loaded.contactSources).toHaveLength(0);
    expect(storage.getItem(OFFLINE_CARD_STORAGE_KEY)).toBeTruthy();
  });

  it('creates a seed store with sources, contacts, published versions and migration history', () => {
    const seed = createSeedStore({ now: NOW });

    expect(seed.meta.seeded).toBe(true);
    expect(seed.contactSources.length).toBeGreaterThan(0);
    expect(seed.jurisdictionContacts.length).toBeGreaterThan(0);
    expect(seed.contactVersions).toHaveLength(seed.jurisdictionContacts.length);
    expect(seed.meta.migrationHistory[0].kind).toBe('seed');
    expect(seed.jurisdictionContacts.every((contact) => contact.status === CONTACT_STATUS.PUBLISHED)).toBe(true);
    expect(seed.jurisdictionContacts.every((contact) => contact.lastVerifiedAt)).toBe(true);
    expect(seed.contactSources.every((source) => source.officialUrl.startsWith('https://'))).toBe(true);
  });

  it('migrates a legacy bundle and forces legacy contacts back to draft', () => {
    const legacy = {
      version: 0,
      sources: [
        {
          id: 'legacy-source-1',
          title: 'District emergency page',
          publisher: 'District Administration',
          officialUrl: 'https://lucknow.nic.in/emergency',
          jurisdiction: 'LKO',
        },
      ],
      contacts: [
        {
          id: 'legacy-contact-1',
          name: 'Legacy Police Line',
          number: '100',
          sourceUrl: 'https://lucknow.nic.in/emergency',
          jurisdiction: 'LKO',
          status: 'published',
        },
        {
          id: 'legacy-contact-2',
          name: 'Legacy Fire Line',
          number: '101',
          jurisdiction: 'LKO',
        },
      ],
      preferences: {
        ownerId: 'device-1',
        jurisdictionId: 'LKO',
        note: 'Call the police control room first.',
      },
    };

    const { data, migrated, historyEntry } = migrateOfflineCardStore(legacy, { now: NOW });

    expect(migrated).toBe(true);
    expect(historyEntry.from).toBe(0);
    expect(historyEntry.to).toBe(OFFLINE_CARD_SCHEMA_VERSION);
    expect(data.meta.recoveredFromLegacy).toBe(true);
    expect(data.jurisdictionContacts).toHaveLength(2);
    expect(data.jurisdictionContacts.every((contact) => contact.status === CONTACT_STATUS.DRAFT)).toBe(true);
    expect(data.jurisdictionContacts.every((contact) => contact.lastVerifiedAt === null)).toBe(true);
    expect(data.jurisdictionContacts.every((contact) => Boolean(contact.sourceId))).toBe(true);
    expect(data.contactVersions).toHaveLength(2);
    expect(data.contactVersions.every((version) => version.status === CONTACT_STATUS.DRAFT)).toBe(true);
    expect(data.offlineCardPreferences).toHaveLength(1);
    expect(data.offlineCardPreferences[0].note).toContain('police control room');

    const placeholderSources = data.contactSources.filter(
      (source) => source.status === SOURCE_STATUS.ARCHIVED
    );
    expect(placeholderSources).toHaveLength(1);
    expect(placeholderSources[0].officialUrl).toContain('example.invalid');
  });

  it('persists a migrated legacy bundle and reloads it without another migration', () => {
    const legacy = {
      version: 1,
      contacts: [
        {
          id: 'legacy-contact-3',
          name: 'Legacy Ambulance',
          number: '108',
          jurisdiction: 'LKO',
        },
      ],
    };
    const { data } = migrateOfflineCardStore(legacy, { now: NOW });
    persistOfflineCardStore(data, { storage, now: NOW });

    const reloaded = loadOfflineCardStore({ storage, now: NOW });
    expect(reloaded.jurisdictionContacts).toHaveLength(1);
    expect(reloaded.jurisdictionContacts[0].name).toBe('Legacy Ambulance');
    expect(reloaded.meta.migrationHistory).toHaveLength(1);
  });

  it('recovers from corrupt JSON without throwing away the app', () => {
    storage.setItem(OFFLINE_CARD_STORAGE_KEY, '{not valid json');
    const loaded = loadOfflineCardStore({ storage, now: NOW });

    expect(loaded.meta.recoveredFromCorrupt).toBe(true);
    expect(loaded.jurisdictionContacts.length).toBeGreaterThan(0);
    expect(isValidStoreShape(loaded)).toBe(true);
  });

  it('keeps the previous bundle when a transaction mutator throws', () => {
    const seed = createSeedStore({ now: NOW });
    persistOfflineCardStore(seed, { storage, now: NOW });
    const before = storage.getItem(OFFLINE_CARD_STORAGE_KEY);

    let caught = null;
    try {
      runOfflineCardTransaction(
        (draft) => {
          draft.contactSources = [];
          throw new Error('simulated failure');
        },
        { storage, now: NOW }
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeTruthy();
    expect(caught.code).toBe(OFFLINE_CARD_ERROR_CODES.MIGRATION_FAILED);
    expect(storage.getItem(OFFLINE_CARD_STORAGE_KEY)).toBe(before);
  });

  it('builds indexes for contacts, published versions and collections', () => {
    const seed = createSeedStore({ now: NOW });
    const indexes = buildOfflineCardIndexes(seed);

    expect(indexes.contactsById.size).toBe(seed.jurisdictionContacts.length);
    expect(indexes.publishedVersionByContact.size).toBe(seed.jurisdictionContacts.length);
    expect(indexes.contactsByJurisdiction.get('lko').length).toBeGreaterThan(0);
    expect(indexes.contactsByStatus.get('published').length).toBe(seed.jurisdictionContacts.length);
    expect(indexes.sourcesById.get('src-national-erss')).toBeTruthy();
    expect(indexes.versionsByContact.get('contact-lko-fire-101')).toHaveLength(1);
  });

  it('applies retention while keeping published contacts and their stale warnings', () => {
    const seed = createSeedStore({ now: NOW });
    persistOfflineCardStore(seed, { storage, now: NOW });
    const oldIso = '2020-01-01T00:00:00.000Z';

    runOfflineCardTransaction(
      (draft) => {
        draft.syncEvents.push({
          id: 'old-sync',
          ownerId: 'device-old',
          type: 'install',
          timestamp: oldIso,
          createdAt: oldIso,
        });
        draft.offlineCardPreferences.push({
          id: 'old-pref',
          ownerId: 'device-old',
          note: 'old note',
          createdAt: oldIso,
          updatedAt: oldIso,
        });
        draft.auditEvents.push({
          id: 'old-audit',
          action: 'old.action',
          timestamp: oldIso,
        });
        draft.jurisdictionContacts.push({
          id: 'old-archived',
          jurisdictionId: 'LKO',
          status: CONTACT_STATUS.ARCHIVED,
          archivedAt: oldIso,
          updatedAt: oldIso,
        });
        draft.contactVersions.push({
          id: 'old-version',
          contactId: 'old-archived',
          version: 1,
        });
        draft.recommendations.push({
          id: 'old-recommendation',
          contactId: 'old-archived',
        });
      },
      { storage, now: NOW }
    );

    const result = applyOfflineCardRetentionPolicy({ now: NOW }, { storage });
    expect(result.result.syncEventsRemoved).toBeGreaterThanOrEqual(1);
    expect(result.result.preferencesRemoved).toBeGreaterThanOrEqual(1);
    expect(result.result.archivedContactsRemoved).toBeGreaterThanOrEqual(1);
    expect(result.result.publishedContactsRetained).toBeGreaterThan(0);

    const after = loadOfflineCardStore({ storage, now: NOW });
    expect(after.syncEvents.some((event) => event.id === 'old-sync')).toBe(false);
    expect(after.offlineCardPreferences.some((preference) => preference.id === 'old-pref')).toBe(false);
    expect(after.auditEvents.some((event) => event.id === 'old-audit')).toBe(false);
    expect(after.jurisdictionContacts.some((contact) => contact.id === 'old-archived')).toBe(false);
    expect(after.contactVersions.some((version) => version.contactId === 'old-archived')).toBe(false);
    expect(after.recommendations.some((recommendation) => recommendation.id === 'old-recommendation')).toBe(false);
    expect(after.auditEvents.some((event) => event.action === 'retention.applied')).toBe(true);
    expect(after.jurisdictionContacts.every((contact) => contact.status === CONTACT_STATUS.PUBLISHED)).toBe(true);
  });

  it('rolls back to the seed, keeps a backup, and restores that backup', () => {
    const seed = createSeedStore({ now: NOW });
    persistOfflineCardStore(seed, { storage, now: NOW });

    runOfflineCardTransaction(
      (draft) => {
        draft.contactSources = [];
        draft.jurisdictionContacts = [];
        draft.contactVersions = [];
      },
      { storage, now: NOW }
    );

    const rollback = rollbackOfflineCardStore({ storage, now: NOW });
    expect(rollback.backupPersisted).toBe(true);
    expect(storage.getItem(OFFLINE_CARD_BACKUP_KEY)).toBeTruthy();
    expect(rollback.contactSources.length).toBeGreaterThan(0);
    expect(rollback.jurisdictionContacts.length).toBeGreaterThan(0);

    const restored = restoreOfflineCardBackup({ storage, now: NOW });
    expect(restored.restored).toBe(true);
    expect(restored.contactSources).toHaveLength(0);
    expect(restored.jurisdictionContacts).toHaveLength(0);
  });

  it('resets to an empty store', () => {
    const empty = resetOfflineCardStoreToEmpty({ storage, now: NOW });
    expect(empty.jurisdictionContacts).toHaveLength(0);
    expect(empty.contactSources).toHaveLength(0);
    expect(empty.offlineCardPreferences).toHaveLength(0);
    expect(empty.meta.seeded).toBe(false);
  });

  it('returns a valid store unchanged', () => {
    const seed = createSeedStore({ now: NOW });
    const result = migrateOfflineCardStore(seed, { now: NOW });
    expect(result.migrated).toBe(false);
    expect(result.historyEntry).toBeNull();
    expect(result.data).toBe(seed);
  });
});
