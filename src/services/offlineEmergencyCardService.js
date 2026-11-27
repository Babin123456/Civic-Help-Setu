/**
 * Trusted service boundary for the Offline Emergency Civic Information Card
 * with Verified Local Contacts (#761).
 *
 * Presentation components never decide permissions, verify a contact, compute a
 * card version or generate a recommendation. This module:
 *  - validates every write on the trusted boundary;
 *  - enforces role and jurisdiction scope;
 *  - runs explicit contact state transitions with optimistic concurrency;
 *  - stores an owner-scoped offline snapshot that survives a page reload;
 *  - records sync events and append-only audit events;
 *  - generates deterministic, explainable review recommendations that a human
 *    must accept, edit or reject;
 *  - returns stable error codes that the UI translates into plain language.
 *
 * The card is local-first. There is no server in this repository; the service
 * is the trusted boundary for the browser build. A server deployment can map
 * these methods to the same request/response contracts without changing the UI.
 */

import { getCurrentActor } from './accessControl.js';
import {
  CARD_EXPIRY_AFTER_DAYS,
  CARD_REFRESH_AFTER_DAYS,
  CONTACT_ACTION,
  CONTACT_ACTION_LABELS,
  CONTACT_FRESHNESS,
  CONTACT_FRESHNESS_LABELS,
  CONTACT_REVIEW_INTERVAL_DAYS,
  CONTACT_STALE_AFTER_DAYS,
  CONTACT_STATUS,
  CONTACT_STATUS_LABELS,
  CONTACT_TRANSITIONS,
  CRITICAL_CARD_CATEGORIES,
  OFFLINE_CARD_CAPABILITIES,
  OFFLINE_CARD_CATEGORIES,
  OFFLINE_CARD_CATEGORY_LABELS,
  OFFLINE_CARD_ERROR_CODES,
  OFFLINE_CARD_ERROR_HELP,
  OFFLINE_CARD_EXPORT_SCHEMA_VERSION,
  OFFLINE_CARD_JURISDICTIONS,
  OFFLINE_CARD_LIMITS,
  OFFLINE_CARD_METHODOLOGY_NOTE,
  OFFLINE_CARD_RETENTION,
  OFFLINE_CARD_ROLES,
  OFFLINE_CARD_RULESET_VERSION,
  OFFLINE_CARD_SCHEMA_VERSION,
  OFFLINE_CARD_STORAGE_KEY,
  OFFLINE_CARD_SYNC_ACTIONS,
  RECOMMENDATION_RULES,
  RECOMMENDATION_RULE_LABELS,
  RECOMMENDATION_STATUS,
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_TRANSITIONS,
  REASON_REQUIRED_ACTIONS,
  SOURCE_STATUS,
  SYNC_EVENT_STATUS,
  SYNC_EVENT_TYPE,
} from './offlineEmergencyCardConstants.js';
import {
  actorHasAllJurisdictions,
  assertOfflineCardCapability,
  assertOfflineCardJurisdiction,
  canOfflineCard,
  describeOfflineCardScope,
  filterByJurisdiction,
  resolveActorJurisdictions,
  resolveOfflineCardRole,
} from './offlineEmergencyCardAccessControl.js';
import {
  applyOfflineCardRetentionPolicy,
  getOfflineCardStorageHealth,
  loadOfflineCardStore,
  resetOfflineCardStoreToEmpty,
  restoreOfflineCardBackup,
  rollbackOfflineCardStore,
  runOfflineCardTransaction,
} from './offlineEmergencyCardMigrations.js';
import {
  OfflineEmergencyCardError,
  bytesOf,
  contentDigest,
  jurisdictionById,
  publicRefForContact,
  sanitizeText,
  validateContactInput,
  validateContactUpdateInput,
  validateIdempotencyKey,
  validatePagination,
  validatePreferenceInput,
  validateReason,
  validateRecommendationDecision,
  validateSourceInput,
  validateVerificationInput,
} from './offlineEmergencyCardValidation.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_ORDER = [
  OFFLINE_CARD_CATEGORIES.EMERGENCY,
  OFFLINE_CARD_CATEGORIES.POLICE,
  OFFLINE_CARD_CATEGORIES.FIRE,
  OFFLINE_CARD_CATEGORIES.MEDICAL,
  OFFLINE_CARD_CATEGORIES.DISASTER,
  OFFLINE_CARD_CATEGORIES.WOMEN,
  OFFLINE_CARD_CATEGORIES.CHILD,
  OFFLINE_CARD_CATEGORIES.SENIOR,
  OFFLINE_CARD_CATEGORIES.CYBER,
  OFFLINE_CARD_CATEGORIES.MENTAL_HEALTH,
  OFFLINE_CARD_CATEGORIES.ANTI_CORRUPTION,
  OFFLINE_CARD_CATEGORIES.MUNICIPAL,
  OFFLINE_CARD_CATEGORIES.UTILITY,
  OFFLINE_CARD_CATEGORIES.OTHER,
];

const nowIso = () => new Date().toISOString();

const generateId = (prefix) => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  const random =
    cryptoApi && typeof cryptoApi.randomUUID === 'function'
      ? cryptoApi.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${random.toUpperCase()}`;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const paginate = (items, { page, pageSize }) => {
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};

const ownerIdFor = (actor) =>
  actor && typeof actor === 'object' && (actor.id || actor.userId)
    ? String(actor.id || actor.userId)
    : 'anonymous-device';

const actorIdentity = (actor) => ({
  id: ownerIdFor(actor),
  label:
    (actor &&
      (actor.username ||
        actor.name ||
        actor.fullName ||
        actor.displayName)) ||
    'Municipal staff',
  role: resolveOfflineCardRole(actor),
});

const daysSince = (value, now) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((new Date(now).getTime() - time) / DAY_MS);
};

const freshnessFromDate = (
  lastVerifiedAt,
  { reviewIntervalDays = CONTACT_REVIEW_INTERVAL_DAYS, now = nowIso() } = {}
) => {
  const ageDays = daysSince(lastVerifiedAt, now);
  if (ageDays == null) {
    return {
      state: CONTACT_FRESHNESS.UNVERIFIED,
      label: CONTACT_FRESHNESS_LABELS[CONTACT_FRESHNESS.UNVERIFIED],
      ageDays: null,
      lastVerifiedAt: lastVerifiedAt || null,
      nextReviewAt: null,
      isStale: true,
    };
  }
  const nextReviewAt = new Date(
    new Date(lastVerifiedAt).getTime() + reviewIntervalDays * DAY_MS
  ).toISOString();
  if (ageDays < 0) {
    return {
      state: CONTACT_FRESHNESS.STALE,
      label: 'Verification date is in the future and cannot be trusted',
      ageDays,
      lastVerifiedAt,
      nextReviewAt,
      isStale: true,
    };
  }
  if (ageDays > CONTACT_STALE_AFTER_DAYS) {
    return {
      state: CONTACT_FRESHNESS.STALE,
      label: CONTACT_FRESHNESS_LABELS[CONTACT_FRESHNESS.STALE],
      ageDays,
      lastVerifiedAt,
      nextReviewAt,
      isStale: true,
    };
  }
  if (ageDays > reviewIntervalDays) {
    return {
      state: CONTACT_FRESHNESS.REVIEW_DUE,
      label: CONTACT_FRESHNESS_LABELS[CONTACT_FRESHNESS.REVIEW_DUE],
      ageDays,
      lastVerifiedAt,
      nextReviewAt,
      isStale: false,
    };
  }
  return {
    state: CONTACT_FRESHNESS.FRESH,
    label: CONTACT_FRESHNESS_LABELS[CONTACT_FRESHNESS.FRESH],
    ageDays,
    lastVerifiedAt,
    nextReviewAt,
    isStale: false,
  };
};

const cardFreshnessFrom = (snapshot, now = nowIso()) => {
  const installedAt = snapshot?.installedAt || snapshot?.lastRefreshedAt;
  const ageDays = daysSince(installedAt, now);
  const expiresAt = installedAt
    ? new Date(new Date(installedAt).getTime() + CARD_EXPIRY_AFTER_DAYS * DAY_MS).toISOString()
    : null;
  let state = 'current';
  let label = 'Card is current';
  if (ageDays == null) {
    state = 'unknown';
    label = 'Card age is unknown';
  } else if (ageDays > CARD_EXPIRY_AFTER_DAYS) {
    state = 'expired';
    label = 'Card has expired — refresh online before relying on it';
  } else if (ageDays > CARD_REFRESH_AFTER_DAYS) {
    state = 'refresh_due';
    label = 'Refresh is due — the card is more than 30 days old';
  }
  return { state, label, ageDays, installedAt: installedAt || null, expiresAt };
};

const categoryLabel = (category) =>
  OFFLINE_CARD_CATEGORY_LABELS[category] || 'Public service';

const jurisdictionName = (jurisdictionId) => {
  const found = jurisdictionById(jurisdictionId);
  return found ? found.name : jurisdictionId;
};

const publicContactProjection = ({ contact, version, source, now }) => {
  const snapshot = version?.snapshot || contact;
  const freshness = freshnessFromDate(version?.lastVerifiedAt || contact.lastVerifiedAt, {
    reviewIntervalDays: snapshot.reviewIntervalDays || contact.reviewIntervalDays,
    now,
  });
  return {
    publicRef: publicRefForContact(contact),
    name: snapshot.name,
    organization: snapshot.organization,
    category: snapshot.category,
    categoryLabel: categoryLabel(snapshot.category),
    description: snapshot.description,
    phone: snapshot.phone,
    alternatePhone: snapshot.alternatePhone || '',
    email: snapshot.email || '',
    website: snapshot.website || '',
    address: snapshot.address || '',
    hours: snapshot.hours,
    languages: Array.isArray(snapshot.languages) ? [...snapshot.languages] : [],
    reviewIntervalDays: snapshot.reviewIntervalDays || CONTACT_REVIEW_INTERVAL_DAYS,
    lastVerifiedAt: version?.lastVerifiedAt || contact.lastVerifiedAt || null,
    verificationMethod:
      version?.verificationMethod ||
      contact.verificationMethod ||
      'Manual review of the official source',
    versionLabel: version ? `v${version.version}` : 'v1',
    jurisdictionName: jurisdictionName(snapshot.jurisdictionId),
    source: source
      ? {
          title: source.title,
          publisher: source.publisher,
          url: source.officialUrl,
          retrievedAt: source.retrievedAt,
        }
      : null,
    freshness,
    isStale: freshness.state === CONTACT_FRESHNESS.STALE,
  };
};

const publishedVersionFor = (store, contact) => {
  const versions = (store.contactVersions || []).filter(
    (version) =>
      version.contactId === contact.id &&
      version.status === CONTACT_STATUS.PUBLISHED &&
      Boolean(version.publishedAt)
  );
  return versions.sort((a, b) => Number(b.version) - Number(a.version))[0] || null;
};

const sourceFor = (store, contact) =>
  (store.contactSources || []).find((source) => source.id === contact.sourceId) || null;

const collectPublicContacts = (store, { jurisdictionId, includeNational, now }) => {
  const jurisdiction = jurisdictionById(jurisdictionId);
  if (!jurisdiction) return [];
  const contacts = (store.jurisdictionContacts || []).filter((contact) => {
    if (contact.status === CONTACT_STATUS.ARCHIVED) return false;
    if (!contact.publishedAt) return false;
    if (contact.jurisdictionId === jurisdictionId) return true;
    return includeNational && contact.jurisdictionId === 'NATIONAL';
  });

  return contacts
    .map((contact) => {
      const version = publishedVersionFor(store, contact);
      const source = sourceFor(store, contact);
      if (!version || !source || source.status !== SOURCE_STATUS.ACTIVE) return null;
      return publicContactProjection({ contact, version, source, now });
    })
    .filter(Boolean)
    .sort((a, b) => {
      const orderA = CATEGORY_ORDER.indexOf(a.category);
      const orderB = CATEGORY_ORDER.indexOf(b.category);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
};

const summarizePublicContacts = (contacts) => {
  const fresh = contacts.filter((contact) => contact.freshness.state === CONTACT_FRESHNESS.FRESH);
  const reviewDue = contacts.filter(
    (contact) => contact.freshness.state === CONTACT_FRESHNESS.REVIEW_DUE
  );
  const stale = contacts.filter((contact) => contact.freshness.state === CONTACT_FRESHNESS.STALE);
  const categories = [...new Set(contacts.map((contact) => contact.category))];
  const lastVerifiedAt = contacts
    .map((contact) => contact.lastVerifiedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  return {
    totalContacts: contacts.length,
    freshContacts: fresh.length,
    reviewDueContacts: reviewDue.length,
    staleContacts: stale.length,
    categoriesCovered: categories.length,
    categories,
    lastVerifiedAt,
    hasStaleContacts: stale.length > 0,
  };
};

const safePreference = (preference) => {
  if (!preference) return null;
  const { snapshot, ...rest } = preference;
  return {
    ...rest,
    hasSnapshot: Boolean(snapshot),
    contactCount: snapshot?.contactCount || 0,
    cardVersion: snapshot?.cardVersion || preference.cardVersion || null,
  };
};

const storageInfo = (transaction) => ({
  persisted: Boolean(transaction.persisted),
  reason: transaction.reason || null,
  bytes: transaction.bytes || 0,
  warning: transaction.persisted
    ? null
    : OFFLINE_CARD_ERROR_HELP[OFFLINE_CARD_ERROR_CODES.STORAGE_UNAVAILABLE],
});

const appendAuditEvent = (
  draft,
  {
    action,
    entityType,
    entityId,
    actor,
    jurisdictionId,
    reason = '',
    details = null,
    now = nowIso(),
  }
) => {
  const identity = actorIdentity(actor);
  const event = {
    id: generateId('audit'),
    action,
    entityType,
    entityId,
    actorId: identity.id,
    actorRole: identity.role,
    actorLabel: identity.label,
    jurisdictionId: jurisdictionId || 'NATIONAL',
    reason: sanitizeText(reason, OFFLINE_CARD_LIMITS.MAX_REASON_LENGTH),
    details,
    timestamp: now,
    schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
  };
  draft.auditEvents.unshift(event);
  if (draft.auditEvents.length > 1000) draft.auditEvents = draft.auditEvents.slice(0, 1000);
  return event;
};

const recordSyncEvent = (
  draft,
  {
    ownerId,
    type,
    status = SYNC_EVENT_STATUS.SUCCESS,
    jurisdictionId = null,
    contactCount = 0,
    cardVersion = null,
    idempotencyKey = null,
    requestHash = null,
    details = null,
    now = nowIso(),
  }
) => {
  const event = {
    id: generateId('sync'),
    ownerId,
    type,
    status,
    jurisdictionId,
    contactCount,
    cardVersion,
    idempotencyKey,
    requestHash,
    details,
    timestamp: now,
    createdAt: now,
    schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
  };
  draft.syncEvents.unshift(event);
  if (draft.syncEvents.length > 500) draft.syncEvents = draft.syncEvents.slice(0, 500);
  return event;
};

const findSyncReplay = (draft, ownerId, idempotencyKey) =>
  (draft.syncEvents || []).find(
    (event) =>
      event.ownerId === ownerId &&
      event.idempotencyKey &&
      event.idempotencyKey === idempotencyKey
  ) || null;

const assertReplayMatches = (event, requestHash) => {
  if (event.requestHash && event.requestHash !== requestHash) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'This retry key was already used for a different request.'
    );
  }
};

const rateBuckets = new Map();

const assertRateLimit = (ownerId, action, now = nowIso()) => {
  if (!OFFLINE_CARD_SYNC_ACTIONS.includes(action)) return;
  const key = `${ownerId}:${action}`;
  const current = new Date(now).getTime();
  const cutoff = current - OFFLINE_CARD_LIMITS.SYNC_WINDOW_MS;
  const recent = (rateBuckets.get(key) || []).filter((time) => time > cutoff);
  if (recent.length >= OFFLINE_CARD_LIMITS.MAX_SYNC_ACTIONS_PER_WINDOW) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.RATE_LIMITED,
      'Too many card actions were attempted in a short time. Wait a few minutes and try again.'
    );
  }
  recent.push(current);
  rateBuckets.set(key, recent);
};

const makePreferenceRequestHash = (preference) =>
  contentDigest({
    jurisdictionId: preference.jurisdictionId,
    selectedContactRefs: preference.selectedContactRefs || [],
    note: preference.note || '',
    includeNational: preference.includeNational !== false,
    largeText: Boolean(preference.largeText),
    showTable: Boolean(preference.showTable),
  });

const makeSnapshot = ({ contacts, preference, now, cardVersion }) => ({
  cardSchemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
  exportSchemaVersion: OFFLINE_CARD_EXPORT_SCHEMA_VERSION,
  cardVersion,
  installedAt: preference.installedAt || now,
  lastRefreshedAt: now,
  generatedAt: now,
  jurisdictionId: preference.jurisdictionId,
  jurisdictionName: jurisdictionName(preference.jurisdictionId),
  includeNational: preference.includeNational !== false,
  largeText: Boolean(preference.largeText),
  showTable: Boolean(preference.showTable),
  selectedContactRefs: [...(preference.selectedContactRefs || [])],
  note: preference.note || '',
  contactCount: contacts.length,
  sourceCount: new Set(contacts.map((contact) => contact.source?.url).filter(Boolean)).size,
  contacts,
  rulesetVersion: OFFLINE_CARD_RULESET_VERSION,
  methodologyNote: OFFLINE_CARD_METHODOLOGY_NOTE,
  disclaimer:
    'For an emergency, call the number first. This card is an offline reference; always check the official source when a connection is available.',
});

const selectedPublicContacts = (contacts, preference) => {
  const refs = preference.selectedContactRefs || [];
  if (refs.length === 0) return contacts;
  const selected = new Set(refs);
  return contacts.filter((contact) => selected.has(contact.publicRef));
};

const installedCardFromPreference = (preference, now = nowIso()) => {
  if (!preference?.snapshot) return null;
  const snapshot = clone(preference.snapshot);
  const contacts = (snapshot.contacts || []).map((contact) => ({
    ...contact,
    freshness: freshnessFromDate(contact.lastVerifiedAt, {
      reviewIntervalDays: contact.reviewIntervalDays,
      now,
    }),
  }));
  const summary = summarizePublicContacts(contacts);
  return {
    ...snapshot,
    contacts,
    contactCount: contacts.length,
    staleCount: summary.staleContacts,
    summary,
    freshness: cardFreshnessFrom(snapshot, now),
    note: preference.note || snapshot.note || '',
    installedAt: preference.installedAt || snapshot.installedAt,
    lastRefreshedAt: preference.lastRefreshedAt || snapshot.lastRefreshedAt,
    cardVersion: snapshot.cardVersion,
  };
};

const findPreference = (draft, ownerId) =>
  (draft.offlineCardPreferences || []).find((preference) => preference.ownerId === ownerId) || null;

const findContact = (draft, contactId) =>
  (draft.jurisdictionContacts || []).find((contact) => contact.id === contactId) || null;

const findSource = (draft, sourceId) =>
  (draft.contactSources || []).find((source) => source.id === sourceId) || null;

const contactSnapshot = (contact) => ({
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
});

const appendContactVersion = (
  draft,
  contact,
  {
    status,
    changeReason,
    now,
    publishedAt = null,
    archivedAt = null,
    lastVerifiedAt = null,
    verifiedBy = null,
    verificationMethod = null,
  }
) => {
  const version = {
    id: generateId('version'),
    contactId: contact.id,
    version: contact.version,
    jurisdictionId: contact.jurisdictionId,
    status,
    snapshot: contactSnapshot(contact),
    changeReason: sanitizeText(changeReason, OFFLINE_CARD_LIMITS.MAX_REASON_LENGTH),
    lastVerifiedAt,
    verifiedBy,
    verificationMethod,
    publishedAt,
    archivedAt,
    createdBy: contact.updatedBy || contact.createdBy,
    createdAt: now,
    schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
  };
  draft.contactVersions.push(version);
  return version;
};

const hydrateStaffContact = (store, contact, actor, now) => {
  const source = sourceFor(store, contact);
  const publishedVersion = publishedVersionFor(store, contact);
  const versions = (store.contactVersions || [])
    .filter((version) => version.contactId === contact.id)
    .sort((a, b) => Number(b.version) - Number(a.version));
  const lastVerifiedAt = publishedVersion?.lastVerifiedAt || contact.lastVerifiedAt;
  return {
    ...contact,
    publicRef: publicRefForContact(contact),
    source: source
      ? {
          id: source.id,
          title: source.title,
          publisher: source.publisher,
          officialUrl: source.officialUrl,
          status: source.status,
          retrievedAt: source.retrievedAt,
          jurisdictionId: source.jurisdictionId,
        }
      : null,
    publishedVersion: publishedVersion ? clone(publishedVersion) : null,
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      status: version.status,
      changeReason: version.changeReason,
      lastVerifiedAt: version.lastVerifiedAt,
      publishedAt: version.publishedAt,
      archivedAt: version.archivedAt,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
    })),
    freshness: freshnessFromDate(lastVerifiedAt, {
      reviewIntervalDays: contact.reviewIntervalDays,
      now,
    }),
    availableActions: availableContactActions(contact, actor),
    statusLabel: CONTACT_STATUS_LABELS[contact.status] || contact.status,
    categoryLabel: categoryLabel(contact.category),
    jurisdictionName: jurisdictionName(contact.jurisdictionId),
  };
};

const assertContactInScope = (contact, actor) => {
  assertOfflineCardJurisdiction(actor, contact.jurisdictionId);
};

const assertSourceUsableForContact = (draft, payload) => {
  const source = findSource(draft, payload.sourceId);
  if (!source) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
      'The selected official source no longer exists. Choose an active source.'
    );
  }
  if (source.status !== SOURCE_STATUS.ACTIVE) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'The selected official source is archived. Add a current source before saving this contact.'
    );
  }
  if (source.jurisdictionId !== payload.jurisdictionId) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `The source belongs to ${source.jurisdictionId}, but the contact is for ${payload.jurisdictionId}. Use a source from the same jurisdiction.`
    );
  }
  return source;
};

const assertTransition = (from, to, actionLabel = 'change') => {
  const allowed = CONTACT_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.INVALID_STATE_TRANSITION,
      `Cannot ${actionLabel} a contact in the "${CONTACT_STATUS_LABELS[from] || from}" state. Reload the contact to see the available actions.`,
      { from, to, allowed }
    );
  }
};

const ensureVersion = (contact, expectedVersion, actionLabel) => {
  if (expectedVersion == null) return;
  if (Number(expectedVersion) !== Number(contact.version)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VERSION_CONFLICT,
      `This contact changed after you opened it. Reload the latest version before you ${actionLabel}.`,
      { expectedVersion: Number(expectedVersion), currentVersion: contact.version }
    );
  }
};

/* ------------------------------------------------------------------ */
/* Public and citizen operations                                      */
/* ------------------------------------------------------------------ */

export const listJurisdictions = () => clone(OFFLINE_CARD_JURISDICTIONS);

export const getPublicCard = (
  { jurisdictionId = 'LKO', includeNational = true, now = nowIso() } = {},
  { storage = null } = {}
) => {
  assertOfflineCardCapability('card.view_public', getCurrentActor(), { allowAnonymous: true });
  const jurisdiction = jurisdictionById(jurisdictionId);
  if (!jurisdiction) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `Unknown jurisdiction "${jurisdictionId}".`
    );
  }
  const store = loadOfflineCardStore({ storage, now });
  const contacts = collectPublicContacts(store, {
    jurisdictionId: jurisdiction.id,
    includeNational,
    now,
  });
  return {
    jurisdiction: clone(jurisdiction),
    contacts,
    summary: summarizePublicContacts(contacts),
    generatedAt: now,
    rulesetVersion: OFFLINE_CARD_RULESET_VERSION,
    methodologyNote: OFFLINE_CARD_METHODOLOGY_NOTE,
    disclaimer:
      'Emergency numbers are shown only when an official source and a manual verification date exist. Verify with the official source when possible.',
  };
};

export const searchPublicContacts = (
  {
    jurisdictionId = 'LKO',
    includeNational = true,
    query = '',
    category = 'all',
    freshness = 'all',
    page = 1,
    pageSize = OFFLINE_CARD_LIMITS.DEFAULT_PAGE_SIZE,
    now = nowIso(),
  } = {},
  { storage = null } = {}
) => {
  const pagination = validatePagination({ page, pageSize });
  const card = getPublicCard({ jurisdictionId, includeNational, now }, { storage });
  const rawQuery = typeof query === 'string' ? query.trim() : '';
  const cleanQuery = sanitizeText(query, 120).toLowerCase();
  const filtered = card.contacts.filter((contact) => {
    if (category !== 'all' && contact.category !== category) return false;
    if (freshness !== 'all' && contact.freshness.state !== freshness) return false;
    if (!cleanQuery) return true;
    const haystack = [
      contact.name,
      contact.organization,
      contact.phone,
      contact.alternatePhone,
      contact.categoryLabel,
      contact.address,
      contact.hours,
      contact.jurisdictionName,
      ...(contact.languages || []),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(cleanQuery);
  });
  // A query made only of markup is rejected instead of collapsing to an empty
  // search that would return every contact.
  const safeItems = rawQuery && !cleanQuery ? [] : filtered;
  return {
    ...paginate(safeItems, pagination),
    filters: { jurisdictionId, includeNational, query: cleanQuery, category, freshness },
    summary: card.summary,
    generatedAt: card.generatedAt,
  };
};

export const getPublicContact = (
  publicRef,
  { jurisdictionId = 'LKO', includeNational = true, now = nowIso() } = {},
  { storage = null } = {}
) => {
  const card = getPublicCard({ jurisdictionId, includeNational, now }, { storage });
  const contact = card.contacts.find((item) => item.publicRef === publicRef);
  if (!contact) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
      'This contact is not published for the selected jurisdiction. Refresh the card or choose another jurisdiction.'
    );
  }
  return { ...contact, jurisdiction: card.jurisdiction, generatedAt: card.generatedAt };
};

export const getInstalledCard = (actor = getCurrentActor(), { storage = null, now = nowIso() } = {}) => {
  assertOfflineCardCapability('card.view_public', actor, { allowAnonymous: true });
  const store = loadOfflineCardStore({ storage, now });
  const preference = findPreference(store, ownerIdFor(actor));
  if (!preference) {
    return {
      installed: false,
      preference: null,
      card: null,
      storage: getOfflineCardStorageHealth({ storage }),
    };
  }
  return {
    installed: true,
    preference: safePreference(preference),
    card: installedCardFromPreference(preference, now),
    storage: getOfflineCardStorageHealth({ storage }),
  };
};

export const installCard = (
  payload = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso(), online = true, idempotencyKey = null } = {}
) => {
  assertOfflineCardCapability('card.install', actor, { allowAnonymous: true });
  const ownerId = ownerIdFor(actor);
  const key = validateIdempotencyKey(idempotencyKey || payload.idempotencyKey, {
    required: true,
  });
  assertRateLimit(ownerId, 'install', now);
  const preferenceInput = validatePreferenceInput(payload);
  const publicCard = getPublicCard(
    {
      jurisdictionId: preferenceInput.jurisdictionId,
      includeNational: preferenceInput.includeNational,
      now,
    },
    { storage }
  );
  const contacts = selectedPublicContacts(publicCard.contacts, preferenceInput).slice(
    0,
    OFFLINE_CARD_LIMITS.MAX_CONTACTS_PER_CARD
  );
  if (contacts.length === 0) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      'There are no published contacts to install for this jurisdiction yet.'
    );
  }
  const cardVersion = contentDigest(
    contacts.map((contact) => ({
      publicRef: contact.publicRef,
      versionLabel: contact.versionLabel,
      lastVerifiedAt: contact.lastVerifiedAt,
    }))
  );
  const requestHash = makePreferenceRequestHash({
    ...preferenceInput,
    selectedContactRefs: preferenceInput.selectedContactRefs,
  });

  const transaction = runOfflineCardTransaction(
    (draft) => {
      const replay = findSyncReplay(draft, ownerId, key);
      if (replay) {
        assertReplayMatches(replay, requestHash);
        const existing = findPreference(draft, ownerId);
        return { preference: existing, syncEvent: replay, idempotentReplay: true };
      }

      const preference = findPreference(draft, ownerId);
      const snapshot = makeSnapshot({
        contacts,
        preference: { ...preferenceInput, installedAt: preference?.installedAt || now },
        now,
        cardVersion,
      });
      const snapshotBytes = bytesOf(snapshot);
      if (snapshotBytes > OFFLINE_CARD_LIMITS.MAX_SNAPSHOT_BYTES) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.CARD_TOO_LARGE,
          'The selected contacts exceed the safe offline card size. Select fewer contacts and try again.',
          { bytes: snapshotBytes, limit: OFFLINE_CARD_LIMITS.MAX_SNAPSHOT_BYTES }
        );
      }
      const nextPreference = preference
        ? {
            ...preference,
            ...preferenceInput,
            selectedContactRefs: preferenceInput.selectedContactRefs,
            version: Number(preference.version || 1) + 1,
            snapshot,
            installedAt: now,
            lastRefreshedAt: now,
            cardVersion,
            updatedAt: now,
            updatedBy: ownerId,
          }
        : {
            id: generateId('pref'),
            ownerId,
            ...preferenceInput,
            selectedContactRefs: preferenceInput.selectedContactRefs,
            version: 1,
            snapshot,
            installedAt: now,
            lastRefreshedAt: now,
            cardVersion,
            createdAt: now,
            updatedAt: now,
            createdBy: ownerId,
            schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
          };
      if (preference) {
        draft.offlineCardPreferences = draft.offlineCardPreferences.map((item) =>
          item.id === preference.id ? nextPreference : item
        );
      } else {
        draft.offlineCardPreferences.unshift(nextPreference);
      }
      const syncEvent = recordSyncEvent(draft, {
        ownerId,
        type: SYNC_EVENT_TYPE.INSTALL,
        jurisdictionId: preferenceInput.jurisdictionId,
        contactCount: contacts.length,
        cardVersion,
        idempotencyKey: key,
        requestHash,
        details: { offlineInstall: !online, staleContacts: publicCard.summary.staleContacts },
        now,
      });
      return { preference: nextPreference, syncEvent, idempotentReplay: false };
    },
    { storage, now }
  );

  const result = transaction.result;
  const preference = result.preference;
  return {
    installed: true,
    preference: safePreference(preference),
    card: installedCardFromPreference(preference, now),
    syncEvent: result.syncEvent,
    idempotentReplay: result.idempotentReplay,
    offlineInstall: !online,
    storage: storageInfo(transaction),
  };
};

export const refreshCard = (
  actor = getCurrentActor(),
  { storage = null, now = nowIso(), online = true, idempotencyKey = null } = {}
) => {
  assertOfflineCardCapability('card.refresh', actor, { allowAnonymous: true });
  const ownerId = ownerIdFor(actor);
  const key = validateIdempotencyKey(idempotencyKey, { required: true });
  assertRateLimit(ownerId, 'refresh', now);
  const transaction = runOfflineCardTransaction(
    (draft) => {
      const preference = findPreference(draft, ownerId);
      if (!preference) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
          'No card is installed on this device yet. Install a card first.'
        );
      }
      const requestHash = contentDigest({ action: 'refresh', preferenceId: preference.id });
      const replay = findSyncReplay(draft, ownerId, key);
      if (replay) {
        assertReplayMatches(replay, requestHash);
        return { preference, syncEvent: replay, changed: false, idempotentReplay: true };
      }
      const publicCard = getPublicCard(
        {
          jurisdictionId: preference.jurisdictionId,
          includeNational: preference.includeNational,
          now,
        },
        { storage }
      );
      const contacts = selectedPublicContacts(publicCard.contacts, preference).slice(
        0,
        OFFLINE_CARD_LIMITS.MAX_CONTACTS_PER_CARD
      );
      const cardVersion = contentDigest(
        contacts.map((contact) => ({
          publicRef: contact.publicRef,
          versionLabel: contact.versionLabel,
          lastVerifiedAt: contact.lastVerifiedAt,
        }))
      );
      const snapshot = makeSnapshot({ contacts, preference, now, cardVersion });
      const snapshotBytes = bytesOf(snapshot);
      if (snapshotBytes > OFFLINE_CARD_LIMITS.MAX_SNAPSHOT_BYTES) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.CARD_TOO_LARGE,
          'The refreshed card exceeds the safe offline card size. Remove some contacts and try again.',
          { bytes: snapshotBytes, limit: OFFLINE_CARD_LIMITS.MAX_SNAPSHOT_BYTES }
        );
      }
      const changed = preference.cardVersion !== cardVersion;
      const nextPreference = {
        ...preference,
        snapshot,
        lastRefreshedAt: now,
        cardVersion,
        version: Number(preference.version || 1) + (changed ? 1 : 0),
        updatedAt: now,
        updatedBy: ownerId,
      };
      draft.offlineCardPreferences = draft.offlineCardPreferences.map((item) =>
        item.id === preference.id ? nextPreference : item
      );
      const syncEvent = recordSyncEvent(draft, {
        ownerId,
        type: changed ? SYNC_EVENT_TYPE.REFRESH : SYNC_EVENT_TYPE.NO_CHANGE,
        jurisdictionId: preference.jurisdictionId,
        contactCount: contacts.length,
        cardVersion,
        idempotencyKey: key,
        requestHash,
        details: {
          previousCardVersion: preference.cardVersion || null,
          staleContacts: publicCard.summary.staleContacts,
          offlineRefresh: !online,
        },
        now,
      });
      return { preference: nextPreference, syncEvent, changed, idempotentReplay: false };
    },
    { storage, now }
  );

  return {
    changed: transaction.result.changed,
    idempotentReplay: transaction.result.idempotentReplay,
    offlineRefresh: !online,
    preference: safePreference(transaction.result.preference),
    card: installedCardFromPreference(transaction.result.preference, now),
    syncEvent: transaction.result.syncEvent,
    storage: storageInfo(transaction),
  };
};

export const saveCardPreferences = (
  payload = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso(), idempotencyKey = null } = {}
) => {
  assertOfflineCardCapability('preferences.write', actor, { allowAnonymous: true });
  const ownerId = ownerIdFor(actor);
  const key = validateIdempotencyKey(idempotencyKey, { required: false });
  assertRateLimit(ownerId, 'preferences', now);
  const preferenceInput = validatePreferenceInput(payload);
  const requestHash = contentDigest({
    action: 'preferences',
    ...preferenceInput,
    selectedContactRefs: preferenceInput.selectedContactRefs,
  });

  const transaction = runOfflineCardTransaction(
    (draft) => {
      if (key) {
        const replay = findSyncReplay(draft, ownerId, key);
        if (replay) {
          assertReplayMatches(replay, requestHash);
          return { preference: findPreference(draft, ownerId), idempotentReplay: true };
        }
      }
      const preference = findPreference(draft, ownerId);
      if (preference && preferenceInput.expectedVersion != null) {
        ensureVersion(preference, preferenceInput.expectedVersion, 'save these preferences');
      }
      const jurisdictionChanged =
        preference && preference.jurisdictionId !== preferenceInput.jurisdictionId;
      const nextPreference = preference
        ? {
            ...preference,
            ...preferenceInput,
            selectedContactRefs: preferenceInput.selectedContactRefs,
            version: Number(preference.version || 1) + 1,
            snapshot: jurisdictionChanged ? null : preference.snapshot,
            cardVersion: jurisdictionChanged ? null : preference.cardVersion,
            updatedAt: now,
            updatedBy: ownerId,
          }
        : {
            id: generateId('pref'),
            ownerId,
            ...preferenceInput,
            selectedContactRefs: preferenceInput.selectedContactRefs,
            version: 1,
            snapshot: null,
            installedAt: null,
            lastRefreshedAt: null,
            cardVersion: null,
            createdAt: now,
            updatedAt: now,
            createdBy: ownerId,
            schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
          };
      if (preference) {
        draft.offlineCardPreferences = draft.offlineCardPreferences.map((item) =>
          item.id === preference.id ? nextPreference : item
        );
      } else {
        draft.offlineCardPreferences.unshift(nextPreference);
      }
      const syncEvent = recordSyncEvent(draft, {
        ownerId,
        type: SYNC_EVENT_TYPE.PREFERENCES,
        jurisdictionId: nextPreference.jurisdictionId,
        contactCount: nextPreference.snapshot?.contactCount || 0,
        cardVersion: nextPreference.cardVersion,
        idempotencyKey: key,
        requestHash: key ? requestHash : null,
        details: { jurisdictionChanged: Boolean(jurisdictionChanged) },
        now,
      });
      return { preference: nextPreference, syncEvent, idempotentReplay: false };
    },
    { storage, now }
  );

  const preference = transaction.result.preference;
  return {
    preference: safePreference(preference),
    requiresInstall: Boolean(preference && !preference.snapshot),
    card: installedCardFromPreference(preference, now),
    syncEvent: transaction.result.syncEvent,
    idempotentReplay: transaction.result.idempotentReplay,
    storage: storageInfo(transaction),
  };
};

export const deleteLocalCard = (actor = getCurrentActor(), { storage = null, now = nowIso() } = {}) => {
  assertOfflineCardCapability('card.delete', actor, { allowAnonymous: true });
  const ownerId = ownerIdFor(actor);
  const transaction = runOfflineCardTransaction(
    (draft) => {
      const removed = draft.offlineCardPreferences.filter(
        (preference) => preference.ownerId === ownerId
      ).length;
      draft.offlineCardPreferences = draft.offlineCardPreferences.filter(
        (preference) => preference.ownerId !== ownerId
      );
      const syncEvent = recordSyncEvent(draft, {
        ownerId,
        type: SYNC_EVENT_TYPE.DELETE,
        contactCount: 0,
        details: { removedPreferences: removed },
        now,
      });
      return { removed, syncEvent };
    },
    { storage, now }
  );
  return {
    deleted: true,
    removedPreferences: transaction.result.removed,
    syncEvent: transaction.result.syncEvent,
    storage: storageInfo(transaction),
  };
};

export const recordOfflineOpen = (actor = getCurrentActor(), { storage = null, now = nowIso() } = {}) => {
  assertOfflineCardCapability('card.view_public', actor, { allowAnonymous: true });
  const ownerId = ownerIdFor(actor);
  const transaction = runOfflineCardTransaction(
    (draft) => {
      const preference = findPreference(draft, ownerId);
      if (!preference) return null;
      return recordSyncEvent(draft, {
        ownerId,
        type: SYNC_EVENT_TYPE.OFFLINE_OPEN,
        jurisdictionId: preference.jurisdictionId,
        contactCount: preference.snapshot?.contactCount || 0,
        cardVersion: preference.cardVersion,
        details: { cardAgeDays: cardFreshnessFrom(preference.snapshot, now).ageDays },
        now,
      });
    },
    { storage, now }
  );
  return { syncEvent: transaction.result, storage: storageInfo(transaction) };
};

export const exportCard = (actor = getCurrentActor(), { storage = null, now = nowIso() } = {}) => {
  assertOfflineCardCapability('card.view_public', actor, { allowAnonymous: true });
  const ownerId = ownerIdFor(actor);
  const store = loadOfflineCardStore({ storage, now });
  const preference = findPreference(store, ownerId);
  if (!preference?.snapshot) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
      'Install the card before exporting it.'
    );
  }
  const card = installedCardFromPreference(preference, now);
  const exportPayload = {
    exportSchemaVersion: OFFLINE_CARD_EXPORT_SCHEMA_VERSION,
    exportedAt: now,
    card,
    note: preference.note || '',
    contactCount: card.contactCount,
    sourceCount: card.sourceCount,
    disclaimer:
      'This export contains public emergency contact information only. It does not contain internal identifiers, account details, access tokens or personal contact records.',
  };
  runOfflineCardTransaction(
    (draft) => {
      recordSyncEvent(draft, {
        ownerId,
        type: SYNC_EVENT_TYPE.EXPORT,
        jurisdictionId: preference.jurisdictionId,
        contactCount: card.contactCount,
        cardVersion: card.cardVersion,
        details: { exportSchemaVersion: OFFLINE_CARD_EXPORT_SCHEMA_VERSION },
        now,
      });
    },
    { storage, now }
  );
  return exportPayload;
};

/* ------------------------------------------------------------------ */
/* Staff operations                                                   */
/* ------------------------------------------------------------------ */

export const listContactSources = (
  {
    jurisdictionId = null,
    status = 'all',
    query = '',
    page = 1,
    pageSize = OFFLINE_CARD_LIMITS.DEFAULT_PAGE_SIZE,
  } = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('source.read_staff', actor);
  if (jurisdictionId) assertOfflineCardJurisdiction(actor, jurisdictionId);
  const pagination = validatePagination({ page, pageSize });
  const store = loadOfflineCardStore({ storage, now });
  const scoped = filterByJurisdiction(store.contactSources, actor);
  const cleanQuery = sanitizeText(query, 120).toLowerCase();
  const filtered = scoped
    .filter((source) => {
      if (jurisdictionId && source.jurisdictionId !== jurisdictionId) return false;
      if (status !== 'all' && source.status !== status) return false;
      if (!cleanQuery) return true;
      return [source.title, source.publisher, source.officialUrl, source.jurisdictionId]
        .join(' ')
        .toLowerCase()
        .includes(cleanQuery);
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((source) => ({
      ...source,
      contactCount: store.jurisdictionContacts.filter(
        (contact) => contact.sourceId === source.id
      ).length,
      jurisdictionName: jurisdictionName(source.jurisdictionId),
    }));
  return {
    ...paginate(filtered, pagination),
    scope: describeOfflineCardScope(actor),
  };
};

export const createContactSource = (
  payload = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso(), idempotencyKey = null } = {}
) => {
  assertOfflineCardCapability('source.manage', actor);
  const validated = validateSourceInput(payload);
  assertOfflineCardJurisdiction(actor, validated.jurisdictionId);
  const key = validateIdempotencyKey(idempotencyKey || payload.idempotencyKey, {
    required: false,
  });
  const requestHash = contentDigest(validated);

  const transaction = runOfflineCardTransaction(
    (draft) => {
      if (key) {
        const replay = draft.contactSources.find((source) => source.idempotencyKey === key);
        if (replay) {
          if (replay.requestHash && replay.requestHash !== requestHash) {
            throw new OfflineEmergencyCardError(
              OFFLINE_CARD_ERROR_CODES.IDEMPOTENCY_CONFLICT,
              'This retry key was already used for a different source.'
            );
          }
          return { source: replay, idempotentReplay: true, alreadyExists: true };
        }
      }
      const duplicate = draft.contactSources.find(
        (source) =>
          source.officialUrl === validated.officialUrl &&
          source.jurisdictionId === validated.jurisdictionId &&
          source.status === SOURCE_STATUS.ACTIVE
      );
      if (duplicate) {
        return { source: duplicate, idempotentReplay: false, alreadyExists: true };
      }
      const identity = actorIdentity(actor);
      const source = {
        id: generateId('src'),
        ...validated,
        status: SOURCE_STATUS.ACTIVE,
        createdAt: now,
        updatedAt: now,
        createdBy: identity.id,
        updatedBy: identity.id,
        version: 1,
        idempotencyKey: key,
        requestHash: key ? requestHash : null,
        schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
      };
      draft.contactSources.unshift(source);
      appendAuditEvent(draft, {
        action: 'source.created',
        entityType: 'contact_source',
        entityId: source.id,
        actor,
        jurisdictionId: source.jurisdictionId,
        reason: validateReason(payload.reason, { label: 'source note' }),
        details: {
          title: source.title,
          publisher: source.publisher,
          officialUrl: source.officialUrl,
          retrievedAt: source.retrievedAt,
        },
        now,
      });
      return { source, idempotentReplay: false, alreadyExists: false };
    },
    { storage, now }
  );

  return {
    source: transaction.result.source,
    alreadyExists: transaction.result.alreadyExists,
    idempotentReplay: transaction.result.idempotentReplay,
    storage: storageInfo(transaction),
  };
};

export const updateContactSource = (
  sourceId,
  payload = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('source.manage', actor);
  const transaction = runOfflineCardTransaction(
    (draft) => {
      const source = findSource(draft, sourceId);
      if (!source) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
          'The official source could not be found.'
        );
      }
      assertOfflineCardJurisdiction(actor, source.jurisdictionId);
      if (payload.expectedVersion != null) {
        ensureVersion(source, payload.expectedVersion, 'update this source');
      }
      const validated = validateSourceInput({ ...source, ...payload });
      if (validated.jurisdictionId !== source.jurisdictionId) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
          'A source cannot move between jurisdictions. Create a new source for the other jurisdiction.'
        );
      }
      const identity = actorIdentity(actor);
      const updated = {
        ...source,
        ...validated,
        version: Number(source.version || 1) + 1,
        updatedAt: now,
        updatedBy: identity.id,
      };
      draft.contactSources = draft.contactSources.map((item) =>
        item.id === source.id ? updated : item
      );
      appendAuditEvent(draft, {
        action: 'source.updated',
        entityType: 'contact_source',
        entityId: source.id,
        actor,
        jurisdictionId: source.jurisdictionId,
        reason: validateReason(payload.reason, { label: 'update reason' }),
        details: {
          previousUrl: source.officialUrl,
          nextUrl: updated.officialUrl,
          retrievedAt: updated.retrievedAt,
        },
        now,
      });
      return updated;
    },
    { storage, now }
  );
  return { source: transaction.result, storage: storageInfo(transaction) };
};

export const archiveContactSource = (
  sourceId,
  { reason } = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('source.manage', actor);
  const cleanReason = validateReason(reason, { required: true, label: 'archive reason' });
  const transaction = runOfflineCardTransaction(
    (draft) => {
      const source = findSource(draft, sourceId);
      if (!source) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
          'The official source could not be found.'
        );
      }
      assertOfflineCardJurisdiction(actor, source.jurisdictionId);
      const publishedContacts = draft.jurisdictionContacts.filter(
        (contact) =>
          contact.sourceId === source.id &&
          contact.status === CONTACT_STATUS.PUBLISHED
      );
      if (publishedContacts.length > 0) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
          'This source still backs published contacts. Archive or move those contacts first so the public card never loses its citation.',
          { publishedContactCount: publishedContacts.length }
        );
      }
      const updated = {
        ...source,
        status: SOURCE_STATUS.ARCHIVED,
        version: Number(source.version || 1) + 1,
        updatedAt: now,
        updatedBy: actorIdentity(actor).id,
        archivedAt: now,
      };
      draft.contactSources = draft.contactSources.map((item) =>
        item.id === source.id ? updated : item
      );
      appendAuditEvent(draft, {
        action: 'source.archived',
        entityType: 'contact_source',
        entityId: source.id,
        actor,
        jurisdictionId: source.jurisdictionId,
        reason: cleanReason,
        details: { title: source.title, officialUrl: source.officialUrl },
        now,
      });
      return updated;
    },
    { storage, now }
  );
  return { source: transaction.result, storage: storageInfo(transaction) };
};

export const listContacts = (
  {
    jurisdictionId = null,
    status = 'all',
    category = 'all',
    sourceId = null,
    query = '',
    page = 1,
    pageSize = OFFLINE_CARD_LIMITS.DEFAULT_PAGE_SIZE,
  } = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('contact.read_staff', actor);
  if (jurisdictionId) assertOfflineCardJurisdiction(actor, jurisdictionId);
  if (status !== 'all' && !Object.values(CONTACT_STATUS).includes(status)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `Unknown contact status "${status}".`
    );
  }
  if (category !== 'all' && !Object.values(OFFLINE_CARD_CATEGORIES).includes(category)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `Unknown contact category "${category}".`
    );
  }
  const pagination = validatePagination({ page, pageSize });
  const store = loadOfflineCardStore({ storage, now });
  const scoped = filterByJurisdiction(store.jurisdictionContacts, actor);
  const cleanQuery = sanitizeText(query, 120).toLowerCase();
  const filtered = scoped
    .filter((contact) => {
      if (jurisdictionId && contact.jurisdictionId !== jurisdictionId) return false;
      if (status !== 'all' && contact.status !== status) return false;
      if (category !== 'all' && contact.category !== category) return false;
      if (sourceId && contact.sourceId !== sourceId) return false;
      if (!cleanQuery) return true;
      const source = sourceFor(store, contact);
      return [
        contact.name,
        contact.organization,
        contact.phone,
        contact.category,
        contact.jurisdictionId,
        source?.title,
      ]
        .join(' ')
        .toLowerCase()
        .includes(cleanQuery);
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((contact) => hydrateStaffContact(store, contact, actor, now));
  return {
    ...paginate(filtered, pagination),
    scope: describeOfflineCardScope(actor),
  };
};

export const getContactDetail = (
  contactId,
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('contact.read_staff', actor);
  const store = loadOfflineCardStore({ storage, now });
  const contact = findContact(store, contactId);
  if (!contact) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
      'The contact could not be found. It may have been archived or removed.'
    );
  }
  assertContactInScope(contact, actor);
  return hydrateStaffContact(store, contact, actor, now);
};

export const createContact = (
  payload = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso(), idempotencyKey = null } = {}
) => {
  assertOfflineCardCapability('contact.create', actor);
  const validated = validateContactInput(payload);
  assertOfflineCardJurisdiction(actor, validated.jurisdictionId);
  const key = validateIdempotencyKey(idempotencyKey || payload.idempotencyKey, {
    required: false,
  });
  const requestHash = contentDigest(validated);

  const transaction = runOfflineCardTransaction(
    (draft) => {
      if (key) {
        const replay = draft.jurisdictionContacts.find(
          (contact) => contact.idempotencyKey === key
        );
        if (replay) {
          if (replay.requestHash && replay.requestHash !== requestHash) {
            throw new OfflineEmergencyCardError(
              OFFLINE_CARD_ERROR_CODES.IDEMPOTENCY_CONFLICT,
              'This retry key was already used for a different contact.'
            );
          }
          return { contact: replay, idempotentReplay: true };
        }
      }
      assertSourceUsableForContact(draft, validated);
      const duplicate = draft.jurisdictionContacts.find(
        (contact) =>
          contact.status !== CONTACT_STATUS.ARCHIVED &&
          contact.jurisdictionId === validated.jurisdictionId &&
          contact.phone.replace(/\D/g, '') === validated.phone.replace(/\D/g, '') &&
          contact.name.toLowerCase() === validated.name.toLowerCase()
      );
      if (duplicate) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
          'A contact with this name and phone already exists in this jurisdiction. Edit the existing record instead of creating a duplicate.',
          { existingContactId: duplicate.id }
        );
      }
      const identity = actorIdentity(actor);
      const contact = {
        id: generateId('contact'),
        ...validated,
        status: CONTACT_STATUS.DRAFT,
        version: 1,
        lastVerifiedAt: null,
        verifiedBy: null,
        verificationMethod: null,
        publishedAt: null,
        archivedAt: null,
        createdBy: identity.id,
        updatedBy: identity.id,
        createdAt: now,
        updatedAt: now,
        idempotencyKey: key,
        requestHash: key ? requestHash : null,
        schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
      };
      draft.jurisdictionContacts.unshift(contact);
      appendContactVersion(draft, contact, {
        status: CONTACT_STATUS.DRAFT,
        changeReason: 'Draft created from an official public source.',
        now,
      });
      appendAuditEvent(draft, {
        action: 'contact.created',
        entityType: 'contact',
        entityId: contact.id,
        actor,
        jurisdictionId: contact.jurisdictionId,
        reason: validateReason(payload.reason, { label: 'creation note' }),
        details: {
          name: contact.name,
          organization: contact.organization,
          category: contact.category,
          sourceId: contact.sourceId,
          phoneLastFour: contact.phone.replace(/\D/g, '').slice(-4),
        },
        now,
      });
      return { contact, idempotentReplay: false };
    },
    { storage, now }
  );

  return {
    contact: transaction.result.contact,
    idempotentReplay: transaction.result.idempotentReplay,
    storage: storageInfo(transaction),
  };
};

export const updateContact = (
  contactId,
  payload = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('contact.update', actor);
  const validated = validateContactUpdateInput(payload);
  const transaction = runOfflineCardTransaction(
    (draft) => {
      const contact = findContact(draft, contactId);
      if (!contact) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
          'The contact could not be found.'
        );
      }
      assertContactInScope(contact, actor);
      ensureVersion(contact, validated.expectedVersion, 'save your changes');
      if (contact.status === CONTACT_STATUS.ARCHIVED) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.INVALID_STATE_TRANSITION,
          'An archived contact must be restored as a draft before it can be edited.'
        );
      }
      if (contact.status === CONTACT_STATUS.PENDING_REVIEW) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.INVALID_STATE_TRANSITION,
          'This contact is waiting for verification. A reviewer must request changes before it can be edited.'
        );
      }
      assertSourceUsableForContact(draft, validated);
      if (contact.status === CONTACT_STATUS.PUBLISHED && !validated.changeReason) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
          'Explain why the published contact is being revised so the audit trail records the change.'
        );
      }
      const nextStatus =
        contact.status === CONTACT_STATUS.PUBLISHED
          ? CONTACT_STATUS.PENDING_REVIEW
          : contact.status;
      const identity = actorIdentity(actor);
      const updated = {
        ...contact,
        ...validated,
        status: nextStatus,
        version: Number(contact.version || 1) + 1,
        updatedAt: now,
        updatedBy: identity.id,
      };
      delete updated.expectedVersion;
      draft.jurisdictionContacts = draft.jurisdictionContacts.map((item) =>
        item.id === contact.id ? updated : item
      );
      appendContactVersion(draft, updated, {
        status: nextStatus,
        changeReason:
          validated.changeReason ||
          (nextStatus === CONTACT_STATUS.PENDING_REVIEW
            ? 'Revision submitted for verification.'
            : 'Draft details updated.'),
        now,
        publishedAt: null,
        lastVerifiedAt: updated.lastVerifiedAt,
        verifiedBy: updated.verifiedBy,
        verificationMethod: updated.verificationMethod,
      });
      appendAuditEvent(draft, {
        action: 'contact.updated',
        entityType: 'contact',
        entityId: contact.id,
        actor,
        jurisdictionId: contact.jurisdictionId,
        reason: validated.changeReason,
        details: {
          previousVersion: contact.version,
          nextVersion: updated.version,
          nextStatus,
          name: updated.name,
          category: updated.category,
        },
        now,
      });
      return updated;
    },
    { storage, now }
  );
  return { contact: transaction.result, storage: storageInfo(transaction) };
};

export const submitContact = (
  contactId,
  actor = getCurrentActor(),
  { storage = null, now = nowIso(), expectedVersion = null } = {}
) => {
  assertOfflineCardCapability('contact.submit', actor);
  const transaction = runOfflineCardTransaction(
    (draft) => {
      const contact = findContact(draft, contactId);
      if (!contact) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
          'The contact could not be found.'
        );
      }
      assertContactInScope(contact, actor);
      ensureVersion(contact, expectedVersion, 'submit this contact');
      if (contact.status === CONTACT_STATUS.PENDING_REVIEW) {
        return { contact, alreadySubmitted: true };
      }
      assertTransition(contact.status, CONTACT_STATUS.PENDING_REVIEW, 'submit');
      const identity = actorIdentity(actor);
      const updated = {
        ...contact,
        status: CONTACT_STATUS.PENDING_REVIEW,
        version: Number(contact.version || 1) + 1,
        updatedAt: now,
        updatedBy: identity.id,
        submittedAt: now,
        submittedBy: identity.id,
      };
      draft.jurisdictionContacts = draft.jurisdictionContacts.map((item) =>
        item.id === contact.id ? updated : item
      );
      appendContactVersion(draft, updated, {
        status: CONTACT_STATUS.PENDING_REVIEW,
        changeReason: 'Submitted for manual verification against the official source.',
        now,
        lastVerifiedAt: updated.lastVerifiedAt,
        verifiedBy: updated.verifiedBy,
        verificationMethod: updated.verificationMethod,
      });
      appendAuditEvent(draft, {
        action: 'contact.submitted',
        entityType: 'contact',
        entityId: contact.id,
        actor,
        jurisdictionId: contact.jurisdictionId,
        reason: 'Submitted for manual verification.',
        details: { version: updated.version, sourceId: updated.sourceId },
        now,
      });
      return { contact: updated, alreadySubmitted: false };
    },
    { storage, now }
  );
  return {
    contact: transaction.result.contact,
    alreadySubmitted: transaction.result.alreadySubmitted,
    storage: storageInfo(transaction),
  };
};

export const reviewContact = (
  contactId,
  action,
  payload = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  if (!Object.values(CONTACT_ACTION).includes(action)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `Unknown contact action "${action}".`
    );
  }
  const capability =
    action === CONTACT_ACTION.RESTORE ? 'contact.restore' : 'contact.review';
  assertOfflineCardCapability(capability, actor);
  const expectedVersion = payload.expectedVersion;
  const reason = validateReason(payload.reason, {
    required: REASON_REQUIRED_ACTIONS.includes(action),
    label:
      action === CONTACT_ACTION.APPROVE
        ? 'verification note'
        : action === CONTACT_ACTION.REQUEST_CHANGES
          ? 'change request'
          : action === CONTACT_ACTION.ARCHIVE
            ? 'archive reason'
            : 'restore reason',
  });

  const transaction = runOfflineCardTransaction(
    (draft) => {
      const contact = findContact(draft, contactId);
      if (!contact) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
          'The contact could not be found.'
        );
      }
      assertContactInScope(contact, actor);
      ensureVersion(contact, expectedVersion, CONTACT_ACTION_LABELS[action].toLowerCase());
      const identity = actorIdentity(actor);

      if (action === CONTACT_ACTION.APPROVE) {
        assertTransition(contact.status, CONTACT_STATUS.PUBLISHED, 'verify and publish');
        const source = assertSourceUsableForContact(draft, contact);
        const verification = validateVerificationInput(payload);
        const updated = {
          ...contact,
          status: CONTACT_STATUS.PUBLISHED,
          version: Number(contact.version || 1) + 1,
          lastVerifiedAt: verification.lastVerifiedAt,
          verifiedBy: identity.label,
          verificationMethod: verification.verificationMethod,
          publishedAt: now,
          updatedAt: now,
          updatedBy: identity.id,
        };
        draft.jurisdictionContacts = draft.jurisdictionContacts.map((item) =>
          item.id === contact.id ? updated : item
        );
        appendContactVersion(draft, updated, {
          status: CONTACT_STATUS.PUBLISHED,
          changeReason:
            verification.reason ||
            'Verified against the official source and published.',
          now,
          publishedAt: now,
          lastVerifiedAt: verification.lastVerifiedAt,
          verifiedBy: identity.label,
          verificationMethod: verification.verificationMethod,
        });
        appendAuditEvent(draft, {
          action: 'contact.published',
          entityType: 'contact',
          entityId: contact.id,
          actor,
          jurisdictionId: contact.jurisdictionId,
          reason:
            verification.reason ||
            'Manual verification completed against the official source.',
          details: {
            sourceId: source.id,
            sourceUrl: source.officialUrl,
            lastVerifiedAt: verification.lastVerifiedAt,
            verificationMethod: verification.verificationMethod,
            publicRef: publicRefForContact(contact),
          },
          now,
        });
        return updated;
      }

      if (action === CONTACT_ACTION.REQUEST_CHANGES) {
        assertTransition(contact.status, CONTACT_STATUS.CHANGES_REQUESTED, 'request changes');
        const updated = {
          ...contact,
          status: CONTACT_STATUS.CHANGES_REQUESTED,
          version: Number(contact.version || 1) + 1,
          changesRequestedAt: now,
          changesRequestedBy: identity.id,
          updatedAt: now,
          updatedBy: identity.id,
        };
        draft.jurisdictionContacts = draft.jurisdictionContacts.map((item) =>
          item.id === contact.id ? updated : item
        );
        appendContactVersion(draft, updated, {
          status: CONTACT_STATUS.CHANGES_REQUESTED,
          changeReason: reason,
          now,
          lastVerifiedAt: updated.lastVerifiedAt,
          verifiedBy: updated.verifiedBy,
          verificationMethod: updated.verificationMethod,
        });
        appendAuditEvent(draft, {
          action: 'contact.changes_requested',
          entityType: 'contact',
          entityId: contact.id,
          actor,
          jurisdictionId: contact.jurisdictionId,
          reason,
          details: { version: updated.version },
          now,
        });
        return updated;
      }

      if (action === CONTACT_ACTION.ARCHIVE) {
        assertTransition(contact.status, CONTACT_STATUS.ARCHIVED, 'archive');
        const updated = {
          ...contact,
          status: CONTACT_STATUS.ARCHIVED,
          version: Number(contact.version || 1) + 1,
          archivedAt: now,
          updatedAt: now,
          updatedBy: identity.id,
        };
        draft.jurisdictionContacts = draft.jurisdictionContacts.map((item) =>
          item.id === contact.id ? updated : item
        );
        appendContactVersion(draft, updated, {
          status: CONTACT_STATUS.ARCHIVED,
          changeReason: reason,
          now,
          archivedAt: now,
          lastVerifiedAt: updated.lastVerifiedAt,
          verifiedBy: updated.verifiedBy,
          verificationMethod: updated.verificationMethod,
        });
        appendAuditEvent(draft, {
          action: 'contact.archived',
          entityType: 'contact',
          entityId: contact.id,
          actor,
          jurisdictionId: contact.jurisdictionId,
          reason,
          details: { version: updated.version },
          now,
        });
        return updated;
      }

      // restore
      assertTransition(contact.status, CONTACT_STATUS.DRAFT, 'restore');
      const updated = {
        ...contact,
        status: CONTACT_STATUS.DRAFT,
        version: Number(contact.version || 1) + 1,
        archivedAt: null,
        publishedAt: null,
        lastVerifiedAt: null,
        verifiedBy: null,
        verificationMethod: null,
        updatedAt: now,
        updatedBy: identity.id,
      };
      draft.jurisdictionContacts = draft.jurisdictionContacts.map((item) =>
        item.id === contact.id ? updated : item
      );
      appendContactVersion(draft, updated, {
        status: CONTACT_STATUS.DRAFT,
        changeReason: reason,
        now,
      });
      appendAuditEvent(draft, {
        action: 'contact.restored',
        entityType: 'contact',
        entityId: contact.id,
        actor,
        jurisdictionId: contact.jurisdictionId,
        reason,
        details: { version: updated.version },
        now,
      });
      return updated;
    },
    { storage, now }
  );

  return { contact: transaction.result, storage: storageInfo(transaction) };
};

export function availableContactActions(contact, actor = getCurrentActor()) {
  if (!contact) return [];
  const role = resolveOfflineCardRole(actor);
  const actions = [];
  const canOperate = [OFFLINE_CARD_ROLES.OPERATOR, OFFLINE_CARD_ROLES.ADMIN].includes(role);
  const canReview = [OFFLINE_CARD_ROLES.REVIEWER, OFFLINE_CARD_ROLES.ADMIN].includes(role);

  if (canOperate) {
    if ([CONTACT_STATUS.DRAFT, CONTACT_STATUS.CHANGES_REQUESTED].includes(contact.status)) {
      actions.push(CONTACT_ACTION.SUBMIT);
    }
    if (
      [CONTACT_STATUS.DRAFT, CONTACT_STATUS.CHANGES_REQUESTED, CONTACT_STATUS.PUBLISHED].includes(
        contact.status
      )
    ) {
      actions.push('edit');
    }
  }
  if (canReview) {
    if (contact.status === CONTACT_STATUS.PENDING_REVIEW) {
      actions.push(CONTACT_ACTION.APPROVE, CONTACT_ACTION.REQUEST_CHANGES);
    }
    if (contact.status !== CONTACT_STATUS.ARCHIVED) {
      actions.push(CONTACT_ACTION.ARCHIVE);
    }
  }
  if (role === OFFLINE_CARD_ROLES.ADMIN && contact.status === CONTACT_STATUS.ARCHIVED) {
    actions.push(CONTACT_ACTION.RESTORE);
  }
  return actions;
}

/* ------------------------------------------------------------------ */
/* Deterministic review recommendations                               */
/* ------------------------------------------------------------------ */

const recommendationDedupeKey = (recommendation) =>
  recommendation.dedupeKey ||
  `${recommendation.ruleId}:${recommendation.contactId || recommendation.category || 'all'}:${recommendation.jurisdictionId}`;

const recommendationPriority = (ruleId) => {
  if (ruleId === RECOMMENDATION_RULES.STALE) {
    return {
      priority: 'critical',
      priorityReason:
        'The contact is more than 365 days past verification and is marked outdated on the public card.',
    };
  }
  if (ruleId === RECOMMENDATION_RULES.CATEGORY_GAP) {
    return {
      priority: 'high',
      priorityReason:
        'A critical emergency category has no verified local contact, so the card has a coverage gap.',
    };
  }
  if (ruleId === RECOMMENDATION_RULES.REVIEW_DUE) {
    return {
      priority: 'high',
      priorityReason:
        'The contact is past its 180-day review interval but is still within the stale threshold.',
    };
  }
  return {
    priority: 'routine',
    priorityReason:
      'The official source has not been re-checked recently. The contact itself may still be current.',
  };
};

export const generateRecommendations = (
  { jurisdictionId = null, now = nowIso() } = {},
  actor = getCurrentActor(),
  { storage = null } = {}
) => {
  assertOfflineCardCapability('recommendation.generate', actor);
  if (jurisdictionId) assertOfflineCardJurisdiction(actor, jurisdictionId);
  const scope = jurisdictionId
    ? [String(jurisdictionId).toUpperCase()]
    : actorHasAllJurisdictions(actor)
      ? OFFLINE_CARD_JURISDICTIONS.map((jurisdiction) => jurisdiction.id)
      : resolveActorJurisdictions(actor);
  const featureWindow = {
    from: new Date(new Date(now).getTime() - 365 * DAY_MS).toISOString(),
    to: now,
    days: 365,
  };

  const transaction = runOfflineCardTransaction(
    (draft) => {
      const existing = draft.recommendations || [];
      const recentlyDecided = new Map();
      for (const recommendation of existing) {
        const key = recommendationDedupeKey(recommendation);
        const decidedAt = new Date(
          recommendation.decidedAt || recommendation.updatedAt || recommendation.createdAt || 0
        ).getTime();
        const isFresh =
          [RECOMMENDATION_STATUS.PENDING, RECOMMENDATION_STATUS.EDITED].includes(
            recommendation.status
          ) || new Date(now).getTime() - decidedAt < 30 * DAY_MS;
        if (isFresh && recommendation.rulesetVersion === OFFLINE_CARD_RULESET_VERSION) {
          recentlyDecided.set(key, recommendation);
        }
      }

      const candidates = [];
      for (const jurisdiction of scope) {
        const contacts = draft.jurisdictionContacts.filter(
          (contact) =>
            contact.jurisdictionId === jurisdiction &&
            contact.status === CONTACT_STATUS.PUBLISHED
        );
        for (const contact of contacts) {
          const version = publishedVersionFor(draft, contact);
          const source = sourceFor(draft, contact);
          const lastVerifiedAt = version?.lastVerifiedAt || contact.lastVerifiedAt;
          const ageDays = daysSince(lastVerifiedAt, now);
          if (ageDays == null) {
            candidates.push({
              ruleId: RECOMMENDATION_RULES.STALE,
              contact,
              jurisdictionId: jurisdiction,
              reason: `"${contact.name}" has no trustworthy verification date. Re-check the official source and verify it again.`,
              inputs: {
                lastVerifiedAt: null,
                ageDays: null,
                reviewIntervalDays: contact.reviewIntervalDays,
                staleAfterDays: CONTACT_STALE_AFTER_DAYS,
                sourceRetrievedAt: source?.retrievedAt || null,
              },
            });
          } else if (ageDays > CONTACT_STALE_AFTER_DAYS) {
            candidates.push({
              ruleId: RECOMMENDATION_RULES.STALE,
              contact,
              jurisdictionId: jurisdiction,
              reason: `"${contact.name}" was last verified on ${lastVerifiedAt.slice(0, 10)} (${ageDays} days ago). It is still visible with an outdated warning. Re-check the official source and verify it again.`,
              inputs: {
                lastVerifiedAt,
                ageDays,
                reviewIntervalDays: contact.reviewIntervalDays,
                staleAfterDays: CONTACT_STALE_AFTER_DAYS,
                sourceRetrievedAt: source?.retrievedAt || null,
              },
            });
          } else if (ageDays > (contact.reviewIntervalDays || CONTACT_REVIEW_INTERVAL_DAYS)) {
            candidates.push({
              ruleId: RECOMMENDATION_RULES.REVIEW_DUE,
              contact,
              jurisdictionId: jurisdiction,
              reason: `"${contact.name}" is ${ageDays} days past its last verification, beyond the ${contact.reviewIntervalDays || CONTACT_REVIEW_INTERVAL_DAYS}-day review interval. Check the official source before the record becomes outdated.`,
              inputs: {
                lastVerifiedAt,
                ageDays,
                reviewIntervalDays: contact.reviewIntervalDays,
                staleAfterDays: CONTACT_STALE_AFTER_DAYS,
                sourceRetrievedAt: source?.retrievedAt || null,
              },
            });
          }
          const sourceAgeDays = daysSince(source?.retrievedAt, now);
          if (
            !source ||
            source.status !== SOURCE_STATUS.ACTIVE ||
            (sourceAgeDays != null && sourceAgeDays > 365)
          ) {
            candidates.push({
              ruleId: RECOMMENDATION_RULES.SOURCE_OLD,
              contact,
              jurisdictionId: jurisdiction,
              reason: source
                ? `The official source "${source.title}" was last retrieved on ${String(source.retrievedAt).slice(0, 10)} (${sourceAgeDays} days ago). Re-open the source and record a fresh retrieval date.`
                : `"${contact.name}" has no active official source. Publish only after linking a current government source.`,
              inputs: {
                lastVerifiedAt,
                ageDays,
                sourceRetrievedAt: source?.retrievedAt || null,
                sourceAgeDays,
                sourceStatus: source?.status || 'missing',
              },
            });
          }
        }

        if (jurisdiction !== 'NATIONAL') {
          for (const category of CRITICAL_CARD_CATEGORIES) {
            const covered = contacts.some((contact) => contact.category === category);
            if (!covered) {
              candidates.push({
                ruleId: RECOMMENDATION_RULES.CATEGORY_GAP,
                contact: null,
                category,
                jurisdictionId: jurisdiction,
                reason: `No published contact covers ${categoryLabel(category)} in ${jurisdictionName(jurisdiction)}. Add a contact from an official source; do not invent a number.`,
                inputs: {
                  category,
                  jurisdictionId: jurisdiction,
                  publishedContactCount: contacts.length,
                  criticalCategories: [...CRITICAL_CARD_CATEGORIES],
                },
              });
            }
          }
        }
      }

      const created = [];
      let skipped = 0;
      for (const candidate of candidates) {
        const dedupeKey = `${candidate.ruleId}:${candidate.contact?.id || candidate.category}:${candidate.jurisdictionId}`;
        if (recentlyDecided.has(dedupeKey)) {
          skipped += 1;
          continue;
        }
        const priority = recommendationPriority(candidate.ruleId);
        const recommendation = {
          id: generateId('rec'),
          dedupeKey,
          contactId: candidate.contact?.id || null,
          publicRef: candidate.contact ? publicRefForContact(candidate.contact) : null,
          jurisdictionId: candidate.jurisdictionId,
          category: candidate.contact?.category || candidate.category || null,
          ruleId: candidate.ruleId,
          ruleLabel: RECOMMENDATION_RULE_LABELS[candidate.ruleId] || candidate.ruleId,
          status: RECOMMENDATION_STATUS.PENDING,
          priority: priority.priority,
          priorityReason: priority.priorityReason,
          reason: candidate.reason,
          inputs: candidate.inputs,
          featureWindow,
          rulesetVersion: OFFLINE_CARD_RULESET_VERSION,
          executedAt: now,
          generatedBy: 'deterministic-rules',
          requiresHumanDecision: true,
          humanNote: '',
          decisionReason: '',
          decidedBy: null,
          decidedAt: null,
          version: 1,
          createdAt: now,
          updatedAt: now,
          createdBy: 'system.rules',
          schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
        };
        draft.recommendations.unshift(recommendation);
        created.push(recommendation);
        recentlyDecided.set(dedupeKey, recommendation);
      }

      if (draft.recommendations.length > 500) {
        draft.recommendations = draft.recommendations.slice(0, 500);
      }

      appendAuditEvent(draft, {
        action: 'recommendation.generated',
        entityType: 'card_store',
        entityId: 'recommendations',
        actor,
        jurisdictionId: jurisdictionId || 'NATIONAL',
        reason: 'Deterministic review recommendations generated for human decision.',
        details: {
          created: created.length,
          skipped,
          rulesetVersion: OFFLINE_CARD_RULESET_VERSION,
          featureWindow,
          rules: [...new Set(created.map((recommendation) => recommendation.ruleId))],
        },
        now,
      });

      return { created, skipped };
    },
    { storage, now }
  );

  return {
    created: transaction.result.created,
    skipped: transaction.result.skipped,
    rulesetVersion: OFFLINE_CARD_RULESET_VERSION,
    executedAt: now,
    featureWindow,
    storage: storageInfo(transaction),
  };
};

export const listRecommendations = (
  {
    status = 'all',
    jurisdictionId = null,
    page = 1,
    pageSize = OFFLINE_CARD_LIMITS.DEFAULT_PAGE_SIZE,
  } = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('recommendation.decide', actor);
  if (jurisdictionId) assertOfflineCardJurisdiction(actor, jurisdictionId);
  if (status !== 'all' && !Object.values(RECOMMENDATION_STATUS).includes(status)) {
    throw new OfflineEmergencyCardError(
      OFFLINE_CARD_ERROR_CODES.VALIDATION_ERROR,
      `Unknown recommendation status "${status}".`
    );
  }
  const pagination = validatePagination({ page, pageSize });
  const store = loadOfflineCardStore({ storage, now });
  const scoped = filterByJurisdiction(store.recommendations, actor);
  const priorityRank = { critical: 0, high: 1, routine: 2 };
  const filtered = scoped
    .filter((recommendation) => {
      if (jurisdictionId && recommendation.jurisdictionId !== jurisdictionId) return false;
      if (status !== 'all' && recommendation.status !== status) return false;
      return true;
    })
    .sort((a, b) => {
      const priority = (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3);
      if (priority !== 0) return priority;
      return new Date(b.executedAt) - new Date(a.executedAt);
    })
    .map((recommendation) => ({
      ...recommendation,
      statusLabel:
        RECOMMENDATION_STATUS_LABELS[recommendation.status] || recommendation.status,
      jurisdictionName: jurisdictionName(recommendation.jurisdictionId),
      categoryLabel: recommendation.category ? categoryLabel(recommendation.category) : null,
    }));
  return {
    ...paginate(filtered, pagination),
    rulesetVersion: OFFLINE_CARD_RULESET_VERSION,
    scope: describeOfflineCardScope(actor),
  };
};

export const decideRecommendation = (
  recommendationId,
  payload = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('recommendation.decide', actor);
  const decision = validateRecommendationDecision(payload);
  const targetStatus =
    decision.action === 'accept'
      ? RECOMMENDATION_STATUS.ACCEPTED
      : decision.action === 'edit'
        ? RECOMMENDATION_STATUS.EDITED
        : RECOMMENDATION_STATUS.REJECTED;

  const transaction = runOfflineCardTransaction(
    (draft) => {
      const recommendation = draft.recommendations.find(
        (item) => item.id === recommendationId
      );
      if (!recommendation) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.NOT_FOUND,
          'The recommendation could not be found. Refresh the review queue.'
        );
      }
      assertOfflineCardJurisdiction(actor, recommendation.jurisdictionId);
      if (decision.expectedVersion != null) {
        ensureVersion(recommendation, decision.expectedVersion, 'decide this recommendation');
      }
      const allowed = RECOMMENDATION_TRANSITIONS[recommendation.status] || [];
      if (!allowed.includes(targetStatus)) {
        throw new OfflineEmergencyCardError(
          OFFLINE_CARD_ERROR_CODES.INVALID_STATE_TRANSITION,
          `This recommendation is already "${RECOMMENDATION_STATUS_LABELS[recommendation.status] || recommendation.status}". Reload the review queue.`,
          { from: recommendation.status, to: targetStatus }
        );
      }
      const identity = actorIdentity(actor);
      const updated = {
        ...recommendation,
        status: targetStatus,
        version: Number(recommendation.version || 1) + 1,
        updatedAt: now,
        humanNote:
          decision.action === 'reject'
            ? decision.reason
            : decision.note || recommendation.humanNote || '',
        decisionReason: decision.reason || recommendation.decisionReason || '',
        decidedBy: decision.action === 'edit' ? null : identity.label,
        decidedAt: decision.action === 'edit' ? null : now,
        lastEditedBy: decision.action === 'edit' ? identity.label : recommendation.lastEditedBy || null,
        lastEditedAt: decision.action === 'edit' ? now : recommendation.lastEditedAt || null,
      };
      draft.recommendations = draft.recommendations.map((item) =>
        item.id === recommendation.id ? updated : item
      );

      if (decision.action === 'accept' && recommendation.contactId) {
        const contact = findContact(draft, recommendation.contactId);
        if (contact) {
          const nextContact = {
            ...contact,
            reviewRequestedAt: now,
            reviewRequestedBy: identity.id,
            updatedAt: now,
          };
          draft.jurisdictionContacts = draft.jurisdictionContacts.map((item) =>
            item.id === contact.id ? nextContact : item
          );
        }
      }

      appendAuditEvent(draft, {
        action: `recommendation.${targetStatus}`,
        entityType: 'recommendation',
        entityId: recommendation.id,
        actor,
        jurisdictionId: recommendation.jurisdictionId,
        reason:
          decision.reason ||
          decision.note ||
          'Human decision recorded on a deterministic review recommendation.',
        details: {
          rulesetVersion: recommendation.rulesetVersion,
          ruleId: recommendation.ruleId,
          priority: recommendation.priority,
          inputs: recommendation.inputs,
          contactId: recommendation.contactId,
          featureWindow: recommendation.featureWindow,
        },
        now,
      });

      return updated;
    },
    { storage, now }
  );

  return {
    recommendation: transaction.result,
    statusLabel:
      RECOMMENDATION_STATUS_LABELS[transaction.result.status] || transaction.result.status,
    storage: storageInfo(transaction),
  };
};

/* ------------------------------------------------------------------ */
/* Audit, retention and administration                                */
/* ------------------------------------------------------------------ */

export const listAuditEvents = (
  {
    jurisdictionId = null,
    page = 1,
    pageSize = OFFLINE_CARD_LIMITS.DEFAULT_PAGE_SIZE,
  } = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('audit.read', actor);
  if (jurisdictionId) assertOfflineCardJurisdiction(actor, jurisdictionId);
  const pagination = validatePagination({ page, pageSize });
  const store = loadOfflineCardStore({ storage, now });
  const scoped = filterByJurisdiction(store.auditEvents, actor);
  const filtered = scoped
    .filter((event) => !jurisdictionId || event.jurisdictionId === jurisdictionId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      actorRole: event.actorRole,
      actorLabel: event.actorLabel,
      jurisdictionId: event.jurisdictionId,
      reason: event.reason,
      details: event.details,
      timestamp: event.timestamp,
    }));
  return {
    ...paginate(filtered, pagination),
    scope: describeOfflineCardScope(actor),
  };
};

export const runRetention = (
  options = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('retention.run', actor);
  const transaction = applyOfflineCardRetentionPolicy({ ...options, now }, { storage });
  return {
    counts: transaction.result,
    storage: storageInfo(transaction),
    retention: clone(OFFLINE_CARD_RETENTION),
  };
};

export const runMigrationRollback = (
  { reason = 'Administrator requested a rollback to the verified seed.' } = {},
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('migration.run', actor);
  const cleanReason = validateReason(reason, { required: true, label: 'rollback reason' });
  const rollback = rollbackOfflineCardStore({ storage, now });
  const transaction = runOfflineCardTransaction(
    (draft) => {
      appendAuditEvent(draft, {
        action: 'migration.rollback',
        entityType: 'card_store',
        entityId: 'bundle',
        actor,
        jurisdictionId: 'NATIONAL',
        reason: cleanReason,
        details: {
          backupPersisted: rollback.backupPersisted,
          restoredSeedVersion: rollback.meta?.seedVersion || null,
        },
        now,
      });
      return true;
    },
    { storage, now }
  );
  return {
    rolledBack: true,
    backupPersisted: rollback.backupPersisted,
    seedVersion: rollback.meta?.seedVersion || null,
    storage: storageInfo(transaction),
  };
};

export const restoreMigrationBackup = (
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('migration.run', actor);
  restoreOfflineCardBackup({ storage, now });
  const transaction = runOfflineCardTransaction(
    (draft) => {
      appendAuditEvent(draft, {
        action: 'migration.backup_restored',
        entityType: 'card_store',
        entityId: 'bundle',
        actor,
        jurisdictionId: 'NATIONAL',
        reason: 'Administrator restored the previous local card backup.',
        details: { restoredAt: now },
        now,
      });
      return true;
    },
    { storage, now }
  );
  return {
    restored: true,
    storage: storageInfo(transaction),
  };
};

export const resetToEmpty = (
  actor = getCurrentActor(),
  { storage = null, now = nowIso() } = {}
) => {
  assertOfflineCardCapability('migration.run', actor);
  resetOfflineCardStoreToEmpty({ storage, now });
  const transaction = runOfflineCardTransaction(
    (draft) => {
      appendAuditEvent(draft, {
        action: 'card_store.reset',
        entityType: 'card_store',
        entityId: 'bundle',
        actor,
        jurisdictionId: 'NATIONAL',
        reason: 'Administrator reset the local card store to an empty state.',
        details: { resetAt: now },
        now,
      });
      return true;
    },
    { storage, now }
  );
  return { empty: true, storage: storageInfo(transaction) };
};

export const getMetadata = () => ({
  schemaVersion: OFFLINE_CARD_SCHEMA_VERSION,
  storageKey: OFFLINE_CARD_STORAGE_KEY,
  rulesetVersion: OFFLINE_CARD_RULESET_VERSION,
  exportSchemaVersion: OFFLINE_CARD_EXPORT_SCHEMA_VERSION,
  jurisdictions: clone(OFFLINE_CARD_JURISDICTIONS),
  categories: Object.values(OFFLINE_CARD_CATEGORIES).map((category) => ({
    id: category,
    label: categoryLabel(category),
  })),
  capabilities: Object.keys(OFFLINE_CARD_CAPABILITIES),
  limits: clone(OFFLINE_CARD_LIMITS),
  retention: clone(OFFLINE_CARD_RETENTION),
  methodologyNote: OFFLINE_CARD_METHODOLOGY_NOTE,
});

export const getStorageHealth = ({ storage = null } = {}) =>
  getOfflineCardStorageHealth({ storage });

export const getActorScope = (actor = getCurrentActor()) =>
  describeOfflineCardScope(actor);

export const toUserMessage = (error) => {
  if (!error) return 'Something went wrong. Try again.';
  if (error.code && OFFLINE_CARD_ERROR_HELP[error.code]) {
    return OFFLINE_CARD_ERROR_HELP[error.code];
  }
  return error.message || 'Something went wrong. Try again.';
};

export const getContactStatusOptions = () =>
  Object.values(CONTACT_STATUS).map((status) => ({
    id: status,
    label: CONTACT_STATUS_LABELS[status],
  }));

export const getCategoryOptions = () =>
  Object.values(OFFLINE_CARD_CATEGORIES).map((category) => ({
    id: category,
    label: categoryLabel(category),
  }));

export const resetOfflineCardRateLimitsForTests = () => {
  rateBuckets.clear();
};

export const canUseOfflineCard = (capability, actor = getCurrentActor()) =>
  canOfflineCard(capability, actor, { allowAnonymous: true });

export { OfflineEmergencyCardError };

export default {
  listJurisdictions,
  getPublicCard,
  searchPublicContacts,
  getPublicContact,
  getInstalledCard,
  installCard,
  refreshCard,
  saveCardPreferences,
  deleteLocalCard,
  recordOfflineOpen,
  exportCard,
  listContactSources,
  createContactSource,
  updateContactSource,
  archiveContactSource,
  listContacts,
  getContactDetail,
  createContact,
  updateContact,
  submitContact,
  reviewContact,
  availableContactActions,
  generateRecommendations,
  listRecommendations,
  decideRecommendation,
  listAuditEvents,
  runRetention,
  runMigrationRollback,
  restoreMigrationBackup,
  resetToEmpty,
  getMetadata,
  getStorageHealth,
  getActorScope,
  toUserMessage,
};
