/**
 * Persistence, schema migration, indexing, transactions, retention and rollback
 * for the Offline Emergency Civic Information Card (#761).
 *
 * Design rules:
 *  - One JSON bundle per storage key. A multi-collection write is atomic: the
 *    new bundle replaces the old one only after the mutator completes.
 *  - localStorage is used when available, with an in-memory fallback for tests,
 *    private browsing and quota failures. A failed write is reported to the
 *    caller so the UI can warn that the card is only available for this visit.
 *  - Versioned schema. Legacy shapes are migrated; contacts that cannot be
 *    linked to an official source become drafts, never public records.
 *  - No resident records, Aadhaar, medical records, credentials, uploaded files
 *    or personal contact details are stored.
 */

import {
  CONTACT_STATUS,
  OFFLINE_CARD_BACKUP_KEY,
  OFFLINE_CARD_ERROR_CODES,
  OFFLINE_CARD_LIMITS,
  OFFLINE_CARD_SCHEMA_VERSION,
  OFFLINE_CARD_STORAGE_KEY,
  SOURCE_STATUS,
} from './offlineEmergencyCardConstants.js';
import { buildOfflineEmergencyCardSeed } from '../data/offlineEmergencyCardSeed.js';
import {
  OfflineEmergencyCardError,
  bytesOf,
  contentDigest,
  isHttpUrl,
  isIsoDateOrTimestamp,
  publicRefForContact,
  sanitizeText,
  stableStringify,
} from './offlineEmergencyCardValidation.js';
import { logDiagnostic } from '../utils/diagnostics.js';

const memoryStorage = new Map();
const failedWriteKeys = new Set();
const MAX_REASONABLE_BUNDLE_BYTES = 5 * 1024 * 1024;

const resolveStorage = (storage) => {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
    return storage;
  }
  return null;
};

const browserStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch {
    return null;
  }
  return null;
};

const safeGetItem = (key, storage) => {
  if (failedWriteKeys.has(key)) return memoryStorage.get(key) || null;
  const custom = resolveStorage(storage);
  if (custom) {
    try {
      return custom.getItem(key);
    } catch {
      return memoryStorage.get(key) || null;
    }
  }
  try {
    const target = browserStorage();
    if (target) return target.getItem(key);
  } catch {
    // Fall through to memory.
  }
  return memoryStorage.get(key) || null;
};

const safeSetItem = (key, value, storage) => {
  memoryStorage.set(key, value);
  const custom = resolveStorage(storage);
  try {
    const target = custom || browserStorage();
    if (!target) {
      return { persisted: false, reason: 'unavailable' };
    }
    target.setItem(key, value);
    failedWriteKeys.delete(key);
    return { persisted: true, reason: null };
  } catch (error) {
    failedWriteKeys.add(key);
    return {
      persisted: false,
      reason:
        error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
          ? 'quota'
          : 'unavailable',
    };
  }
};

const safeRemoveItem = (key, storage) => {
  memoryStorage.delete(key);
  failedWriteKeys.delete(key);
  const custom = resolveStorage(storage);
  try {
    const target = custom || browserStorage();
    if (target && typeof target.removeItem === 'function') target.removeItem(key);
  } catch {
    // Ignore.
  }
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const OFFLINE_CARD_COLLECTIONS = Object.freeze([
  'contactSources',
  'jurisdictionContacts',
  'contactVersions',
  'offlineCardPreferences',
  'syncEvents',
  'recommendations',
  'auditEvents',
]);

export const createEmptyStore = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    seeded: false,
    migrationHistory: [],
  },
  contactSources: [],
  jurisdictionContacts: [],
  contactVersions: [],
  offlineCardPreferences: [],
  syncEvents: [],
  recommendations: [],
  auditEvents: [],
});

export const createSeedStore = ({ now = new Date().toISOString() } = {}) => {
  const seed = buildOfflineEmergencyCardSeed({ now });
  return {
    ...createEmptyStore({ now }),
    ...seed,
    meta: {
      ...createEmptyStore({ now }).meta,
      ...seed.meta,
    },
  };
};

export const isValidStoreShape = (data) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      data.schemaVersion === OFFLINE_CARD_SCHEMA_VERSION &&
      OFFLINE_CARD_COLLECTIONS.every((key) => Array.isArray(data[key]))
  );

const normalizeLegacySource = (legacySource, { now }) => ({
  id: legacySource.id || `src-legacy-${contentDigest(legacySource)}`,
  title: sanitizeText(legacySource.title || legacySource.name || 'Legacy source', 200),
  publisher: sanitizeText(legacySource.publisher || 'Legacy import', 180),
  officialUrl: isHttpUrl(legacySource.officialUrl || legacySource.sourceUrl)
    ? String(legacySource.officialUrl || legacySource.sourceUrl).trim()
    : 'https://example.invalid/unverified-legacy-source',
  jurisdictionId: String(legacySource.jurisdictionId || legacySource.jurisdiction || 'NATIONAL')
    .trim()
    .toUpperCase(),
  sourceType: 'official_portal',
  status: isHttpUrl(legacySource.officialUrl || legacySource.sourceUrl)
    ? SOURCE_STATUS.ACTIVE
    : SOURCE_STATUS.ARCHIVED,
  retrievedAt:
    isIsoDateOrTimestamp(legacySource.retrievedAt) ? new Date(legacySource.retrievedAt).toISOString() : now,
  createdAt: legacySource.createdAt || now,
  updatedAt: legacySource.updatedAt || now,
  createdBy: 'migration.legacy',
  version: Number(legacySource.version || 1),
  schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
});

const normalizeLegacyContact = (legacyContact, { now, sourceId, jurisdictionId }) => {
  const status = legacyContact.status === CONTACT_STATUS.PUBLISHED ? CONTACT_STATUS.DRAFT : CONTACT_STATUS.DRAFT;
  return {
    id: legacyContact.id || `contact-legacy-${contentDigest(legacyContact)}`,
    jurisdictionId,
    sourceId,
    category: legacyContact.category || 'other',
    name: sanitizeText(legacyContact.name || legacyContact.title || 'Legacy contact', 120),
    organization: sanitizeText(legacyContact.organization || 'Legacy import', 160),
    description: sanitizeText(legacyContact.description || '', 600),
    phone: sanitizeText(legacyContact.phone || legacyContact.number || '', 24),
    alternatePhone: sanitizeText(legacyContact.alternatePhone || '', 24),
    email: sanitizeText(legacyContact.email || '', 160),
    website: isHttpUrl(legacyContact.website) ? String(legacyContact.website).trim() : '',
    address: sanitizeText(legacyContact.address || '', 240),
    hours: sanitizeText(legacyContact.hours || 'Not recorded', 120),
    languages: Array.isArray(legacyContact.languages) ? legacyContact.languages.slice(0, 6) : ['English'],
    contactScope: 'public_office',
    isNational: jurisdictionId === 'NATIONAL',
    status,
    version: 1,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationMethod: null,
    reviewIntervalDays: 180,
    publishedAt: null,
    archivedAt: null,
    createdBy: 'migration.legacy',
    createdAt: legacyContact.createdAt || now,
    updatedAt: now,
    schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
  };
};

export const migrateOfflineCardStore = (legacy, { now = new Date().toISOString() } = {}) => {
  if (!legacy || typeof legacy !== 'object') {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.MIGRATION_FAILED,
      'Legacy card storage must be an object.'
    );
  }
  if (isValidStoreShape(legacy)) {
    return { data: legacy, migrated: false, historyEntry: null };
  }

  const fromVersion = Number(legacy.schemaVersion || legacy.version || 0);
  const legacySources = Array.isArray(legacy.contactSources)
    ? legacy.contactSources
    : Array.isArray(legacy.sources)
      ? legacy.sources
      : [];
  const legacyContacts = Array.isArray(legacy.jurisdictionContacts)
    ? legacy.jurisdictionContacts
    : Array.isArray(legacy.emergencyContacts)
      ? legacy.emergencyContacts
      : Array.isArray(legacy.contacts)
        ? legacy.contacts
        : [];

  const contactSources = legacySources.map((item) => normalizeLegacySource(item, { now }));
  const sourceByUrl = new Map(contactSources.map((item) => [item.officialUrl, item]));

  const migratedContacts = legacyContacts.map((legacyContact) => {
    const jurisdictionId = String(
      legacyContact.jurisdictionId || legacyContact.jurisdiction || legacy.jurisdiction || 'NATIONAL'
    )
      .trim()
      .toUpperCase();
    const sourceUrl = legacyContact.sourceUrl || legacyContact.officialUrl;
    let source = sourceUrl && sourceByUrl.get(String(sourceUrl).trim());
    if (!source) {
      const sourceId = `src-legacy-${contentDigest({ sourceUrl: sourceUrl || 'missing', jurisdictionId })}`;
      source = {
        id: sourceId,
        title: sourceUrl ? 'Legacy official source' : 'Legacy import — source missing',
        publisher: 'Legacy import',
        officialUrl: isHttpUrl(sourceUrl)
          ? String(sourceUrl).trim()
          : 'https://example.invalid/unverified-legacy-source',
        jurisdictionId,
        sourceType: 'official_portal',
        status: isHttpUrl(sourceUrl) ? SOURCE_STATUS.ACTIVE : SOURCE_STATUS.ARCHIVED,
        retrievedAt: now,
        createdAt: now,
        updatedAt: now,
        createdBy: 'migration.legacy',
        version: 1,
        schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
      };
      contactSources.push(source);
      sourceByUrl.set(source.officialUrl, source);
    }
    return normalizeLegacyContact(legacyContact, {
      now,
      sourceId: source.id,
      jurisdictionId,
    });
  });

  const contactVersions = migratedContacts.map((contact) => ({
    id: `version-${contact.id}-1`,
    contactId: contact.id,
    version: 1,
    jurisdictionId: contact.jurisdictionId,
    status: CONTACT_STATUS.DRAFT,
    snapshot: {
      name: contact.name,
      organization: contact.organization,
      category: contact.category,
      description: contact.description,
      phone: contact.phone,
      alternatePhone: contact.alternatePhone,
      email: contact.email,
      website: contact.website,
      address: contact.address,
      hours: contact.hours,
      languages: [...contact.languages],
      contactScope: contact.contactScope,
      sourceId: contact.sourceId,
      jurisdictionId: contact.jurisdictionId,
      isNational: contact.isNational,
      reviewIntervalDays: contact.reviewIntervalDays,
    },
    changeReason: 'Migrated from a legacy card. A reviewer must verify it before publication.',
    lastVerifiedAt: null,
    verifiedBy: null,
    publishedAt: null,
    archivedAt: null,
    createdBy: 'migration.legacy',
    createdAt: now,
    schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
  }));

  const legacyPreferences = Array.isArray(legacy.offlineCardPreferences)
    ? legacy.offlineCardPreferences
    : legacy.preferences && typeof legacy.preferences === 'object'
      ? [legacy.preferences]
      : legacy.note || legacy.installedAt
        ? [legacy]
        : [];

  const offlineCardPreferences = legacyPreferences.map((preference, index) => {
    const ownerId = preference.ownerId || preference.userId || `legacy-device-${index + 1}`;
    return {
      id: preference.id || `pref-legacy-${contentDigest({ ownerId, index })}`,
      ownerId,
      jurisdictionId: String(preference.jurisdictionId || 'LKO').toUpperCase(),
      selectedContactIds: Array.isArray(preference.selectedContactIds)
        ? preference.selectedContactIds
        : migratedContacts.map((contact) => contact.id),
      note: sanitizeText(preference.note || '', OFFLINE_CARD_LIMITS.MAX_NOTE_LENGTH),
      includeNational: preference.includeNational !== false,
      largeText: Boolean(preference.largeText),
      showTable: Boolean(preference.showTable),
      version: 1,
      snapshot: preference.snapshot || null,
      installedAt: preference.installedAt || null,
      lastRefreshedAt: preference.lastRefreshedAt || null,
      cardVersion: preference.cardVersion || null,
      createdAt: preference.createdAt || now,
      updatedAt: preference.updatedAt || now,
      createdBy: ownerId,
      schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
    };
  });

  const data = {
    ...createEmptyStore({ now }),
    contactSources,
    jurisdictionContacts: migratedContacts,
    contactVersions,
    offlineCardPreferences,
    syncEvents: Array.isArray(legacy.syncEvents) ? legacy.syncEvents : [],
    recommendations: Array.isArray(legacy.recommendations) ? legacy.recommendations : [],
    auditEvents: Array.isArray(legacy.auditEvents) ? legacy.auditEvents : [],
    meta: {
      ...createEmptyStore({ now }).meta,
      seeded: false,
      recoveredFromLegacy: true,
      migrationHistory: [
        {
          from: fromVersion,
          to: OFFLINE_CARD_SCHEMA_VERSION,
          appliedAt: now,
          kind: 'upgrade',
          sourceCollections: {
            sources: contactSources.length,
            contacts: migratedContacts.length,
            preferences: offlineCardPreferences.length,
          },
        },
      ],
    },
  };

  return { data, migrated: true, historyEntry: data.meta.migrationHistory[0] };
};

export const buildOfflineCardIndexes = (data = {}) => {
  const byId = (collection) =>
    new Map((data[collection] || []).map((item) => [String(item.id), item]));
  const groupBy = (collection, key) => {
    const map = new Map();
    for (const item of data[collection] || []) {
      const value = String(item[key] || 'UNKNOWN').toLowerCase();
      if (!map.has(value)) map.set(value, []);
      map.get(value).push(item);
    }
    return map;
  };

  const versionsByContact = new Map();
  const publishedVersionByContact = new Map();
  for (const version of data.contactVersions || []) {
    const contactId = String(version.contactId || '');
    if (!versionsByContact.has(contactId)) versionsByContact.set(contactId, []);
    versionsByContact.get(contactId).push(version);
    if (version.status === CONTACT_STATUS.PUBLISHED && version.publishedAt) {
      const current = publishedVersionByContact.get(contactId);
      if (!current || Number(version.version) > Number(current.version)) {
        publishedVersionByContact.set(contactId, version);
      }
    }
  }
  for (const versions of versionsByContact.values()) {
    versions.sort((a, b) => Number(a.version) - Number(b.version));
  }

  return {
    sourcesById: byId('contactSources'),
    contactsById: byId('jurisdictionContacts'),
    versionsByContact,
    publishedVersionByContact,
    contactsByJurisdiction: groupBy('jurisdictionContacts', 'jurisdictionId'),
    contactsByStatus: groupBy('jurisdictionContacts', 'status'),
    contactsByCategory: groupBy('jurisdictionContacts', 'category'),
    sourcesByJurisdiction: groupBy('contactSources', 'jurisdictionId'),
    preferencesByOwner: groupBy('offlineCardPreferences', 'ownerId'),
    syncEventsByOwner: groupBy('syncEvents', 'ownerId'),
    recommendationsByContact: groupBy('recommendations', 'contactId'),
    recommendationsByStatus: groupBy('recommendations', 'status'),
    auditByEntity: groupBy('auditEvents', 'entityId'),
    auditByJurisdiction: groupBy('auditEvents', 'jurisdictionId'),
  };
};

export const loadOfflineCardStore = ({ storage = null, seed = true, now } = {}) => {
  const resolvedNow = now || new Date().toISOString();
  const raw = safeGetItem(OFFLINE_CARD_STORAGE_KEY, storage);
  if (!raw) {
    const initial = seed ? createSeedStore({ now: resolvedNow }) : createEmptyStore({ now: resolvedNow });
    persistOfflineCardStore(initial, { storage, now: resolvedNow });
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidStoreShape(parsed)) return parsed;
    const { data } = migrateOfflineCardStore(parsed, { now: resolvedNow });
    persistOfflineCardStore(data, { storage, now: resolvedNow });
    return data;
  } catch (error) {
    logDiagnostic('Corrupt offline emergency card storage; re-seeding the local bundle.', error);
    const initial = seed ? createSeedStore({ now: resolvedNow }) : createEmptyStore({ now: resolvedNow });
    initial.meta.recoveredFromCorrupt = true;
    persistOfflineCardStore(initial, { storage, now: resolvedNow });
    return initial;
  }
};

export const ensureOfflineCardStore = (options = {}) => {
  const data = loadOfflineCardStore(options);
  return { ...data, indexes: buildOfflineCardIndexes(data) };
};

export const persistOfflineCardStore = (
  data,
  { storage = null, now = new Date().toISOString() } = {}
) => {
  if (!data || !OFFLINE_CARD_COLLECTIONS.every((key) => Array.isArray(data[key]))) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.MIGRATION_FAILED,
      'Refusing to persist a card store with a missing collection.'
    );
  }
  const next = {
    ...data,
    schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
    updatedAt: now,
    meta: {
      ...(data.meta || {}),
      schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
      lastSavedAt: now,
    },
  };
  const serialized = JSON.stringify(next);
  const write = safeSetItem(OFFLINE_CARD_STORAGE_KEY, serialized, storage);
  return {
    data: next,
    persisted: write.persisted,
    reason: write.reason,
    bytes: bytesOf(serialized),
  };
};

/**
 * Transactional write: the mutator receives a detached draft. Nothing is
 * persisted unless it completes. If the mutator throws, storage still holds the
 * previous bundle.
 */
export const runOfflineCardTransaction = (mutator, { storage = null, now } = {}) => {
  const resolvedNow = now || new Date().toISOString();
  const current = loadOfflineCardStore({ storage, now: resolvedNow });
  const draft = clone(current);
  let result;
  try {
    result = mutator(draft);
  } catch (error) {
    throw error instanceof OfflineEmergencyCardError
      ? error
      : new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.MIGRATION_FAILED,
          'The card change could not be saved. No records were written.',
          { cause: error instanceof Error ? error.message : String(error) }
        );
  }
  const persisted = persistOfflineCardStore(draft, { storage, now: resolvedNow });
  return {
    data: persisted.data,
    result,
    persisted: persisted.persisted,
    reason: persisted.reason,
    bytes: persisted.bytes,
  };
};

export const rollbackOfflineCardStore = ({ storage = null, now = new Date().toISOString() } = {}) => {
  const current = safeGetItem(OFFLINE_CARD_STORAGE_KEY, storage);
  let backupPersisted = false;
  if (current) {
    backupPersisted = safeSetItem(OFFLINE_CARD_BACKUP_KEY, current, storage).persisted;
  }
  safeRemoveItem(OFFLINE_CARD_STORAGE_KEY, storage);
  const seeded = createSeedStore({ now });
  const write = persistOfflineCardStore(seeded, { storage, now });
  return { ...write.data, backupPersisted, persisted: write.persisted, indexes: buildOfflineCardIndexes(write.data) };
};

export const restoreOfflineCardBackup = ({ storage = null, now = new Date().toISOString() } = {}) => {
  const raw = safeGetItem(OFFLINE_CARD_BACKUP_KEY, storage);
  if (!raw) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
      'No card backup is available to restore.'
    );
  }
  const parsed = JSON.parse(raw);
  const { data } = isValidStoreShape(parsed)
    ? { data: parsed }
    : migrateOfflineCardStore(parsed, { now });
  const write = persistOfflineCardStore(data, { storage, now });
  return { ...write.data, restored: true, persisted: write.persisted };
};

export const resetOfflineCardStoreToEmpty = ({ storage = null, now = new Date().toISOString() } = {}) => {
  safeRemoveItem(OFFLINE_CARD_STORAGE_KEY, storage);
  const empty = createEmptyStore({ now });
  const write = persistOfflineCardStore(empty, { storage, now });
  return { ...write.data, persisted: write.persisted, indexes: buildOfflineCardIndexes(write.data) };
};

/**
 * Retention:
 *  - sync events older than 180 days are removed (operational telemetry).
 *  - inactive device preferences older than 365 days are removed with their
 *    local notes and card snapshots.
 *  - audit events older than 730 days are removed after the documented period.
 *  - archived contacts older than 1095 days are removed with their versions.
 *  - published contacts are never removed by retention; outdated contacts stay
 *    visible with a warning so an emergency number does not disappear silently.
 */
export const applyOfflineCardRetentionPolicy = (
  {
    syncEventDays = OFFLINE_CARD_LIMITS.SYNC_EVENT_RETENTION_DAYS,
    inactivePreferenceDays = OFFLINE_CARD_LIMITS.PREFERENCE_RETENTION_DAYS,
    auditDays = OFFLINE_CARD_LIMITS.AUDIT_RETENTION_DAYS,
    archivedContactDays = OFFLINE_CARD_LIMITS.ARCHIVED_CONTACT_RETENTION_DAYS,
    now = new Date().toISOString(),
  } = {},
  { storage = null } = {}
) => {
  const cutoff = (days) => new Date(new Date(now).getTime() - days * 24 * 60 * 60 * 1000).getTime();
  const syncCutoff = cutoff(syncEventDays);
  const preferenceCutoff = cutoff(inactivePreferenceDays);
  const auditCutoff = cutoff(auditDays);
  const archivedCutoff = cutoff(archivedContactDays);

  return runOfflineCardTransaction(
    (draft) => {
      const before = {
        syncEvents: draft.syncEvents.length,
        preferences: draft.offlineCardPreferences.length,
        auditEvents: draft.auditEvents.length,
        contacts: draft.jurisdictionContacts.length,
      };

      draft.syncEvents = draft.syncEvents.filter(
        (event) => new Date(event.timestamp || event.createdAt || 0).getTime() >= syncCutoff
      );
      draft.offlineCardPreferences = draft.offlineCardPreferences.filter(
        (preference) =>
          new Date(preference.updatedAt || preference.createdAt || 0).getTime() >= preferenceCutoff
      );
      draft.auditEvents = draft.auditEvents.filter(
        (event) => new Date(event.timestamp || event.createdAt || 0).getTime() >= auditCutoff
      );

      const archivedContactIds = new Set(
        draft.jurisdictionContacts
          .filter(
            (contact) =>
              contact.status === CONTACT_STATUS.ARCHIVED &&
              new Date(contact.archivedAt || contact.updatedAt || 0).getTime() < archivedCutoff
          )
          .map((contact) => contact.id)
      );
      if (archivedContactIds.size > 0) {
        draft.jurisdictionContacts = draft.jurisdictionContacts.filter(
          (contact) => !archivedContactIds.has(contact.id)
        );
        draft.contactVersions = draft.contactVersions.filter(
          (version) => !archivedContactIds.has(version.contactId)
        );
        draft.recommendations = draft.recommendations.filter(
          (recommendation) => !archivedContactIds.has(recommendation.contactId)
        );
      }

      const counts = {
        syncEventsRemoved: before.syncEvents - draft.syncEvents.length,
        preferencesRemoved: before.preferences - draft.offlineCardPreferences.length,
        auditEventsRemoved: before.auditEvents - draft.auditEvents.length,
        archivedContactsRemoved: archivedContactIds.size,
        publishedContactsRetained: draft.jurisdictionContacts.filter(
          (contact) => contact.status === CONTACT_STATUS.PUBLISHED
        ).length,
      };

      draft.auditEvents.unshift({
        id: `audit-retention-${contentDigest({ now, counts })}`,
        action: 'retention.applied',
        entityType: 'card_store',
        entityId: 'bundle',
        actorId: 'system.retention',
        actorRole: 'admin',
        actorLabel: 'Retention policy',
        jurisdictionId: 'NATIONAL',
        reason: 'Scheduled retention policy run.',
        details: {
          ...counts,
          syncEventDays,
          inactivePreferenceDays,
          auditDays,
          archivedContactDays,
        },
        timestamp: now,
        schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
      });

      return counts;
    },
    { storage, now }
  );
};

export const getOfflineCardStorageHealth = ({ storage = null } = {}) => {
  const raw = safeGetItem(OFFLINE_CARD_STORAGE_KEY, storage);
  const bytes = raw ? bytesOf(raw) : 0;
  const memoryOnly = failedWriteKeys.has(OFFLINE_CARD_STORAGE_KEY);
  const ratio = bytes / MAX_REASONABLE_BUNDLE_BYTES;
  return {
    bytes,
    kilobytes: Math.round((bytes / 1024) * 10) / 10,
    memoryOnly,
    available: !memoryOnly,
    level: memoryOnly ? 'memory_only' : ratio > 0.85 ? 'near_limit' : 'ok',
    approximateLimitBytes: MAX_REASONABLE_BUNDLE_BYTES,
    note: memoryOnly
      ? 'The card is kept for this visit only because this browser refused local storage.'
      : 'The card is saved in this browser on this device.',
  };
};

export const offlineCardStoreDigest = (data) => contentDigest(stableStringify(data));

/** Test helper: clears the in-memory fallback and failure markers. */
export const resetOfflineCardStorageForTests = () => {
  memoryStorage.clear();
  failedWriteKeys.clear();
};

export { publicRefForContact };
