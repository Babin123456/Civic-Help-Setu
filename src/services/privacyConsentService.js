/**
 * Privacy and Consent Management Service (#80)
 * Implements granular consent category management, authorization guards,
 * auditable security event logging (strictly without PII), complete data export,
 * and cascading account deletion according to the India DPDP Act 2023 & GDPR standards.
 */
import { logDiagnostic } from '../utils/diagnostics';

const CONSENT_STORAGE_KEY = 'civicbridge_consent_preferences';
const AUDIT_STORAGE_KEY = 'civicbridge_privacy_audit_log';

// Vault export keeps the document metadata but never the document number.
const redactVaultDocuments = (docs) =>
  docs.map((doc) => ({
    id: doc.id,
    name: doc.type ?? doc.name ?? null,
    category: doc.category ?? null,
    issuer: doc.issuer ?? null,
    documentNumber: doc.number || doc.documentNumber ? '***REDACTED***' : null,
    issueDate: doc.issueDate ?? null,
    expiryDate: doc.expiryDate ?? null,
    verified: Boolean(doc.verified),
    lastModified: doc.lastModified ?? doc.createdAt ?? null,
  }));

/**
 * Every localStorage key where the app keeps the user's own data, with the file that writes it.
 * purgeAllUserData deletes all of them and exportUserData builds its sections from the same list,
 * so a service that starts writing a new key only has to be added here.
 * exportAs is the section name in the export (null: deleted on purge but not exported, e.g.
 * caches that only copy data exported elsewhere). `empty` is used when the key is missing or corrupt.
 * Keys that purge leaves alone on purpose are in RETAINED_STORAGE_KEYS.
 */
export const USER_DATA_STORES = [
  { key: 'civicbridge_vault_docs', category: 'vault', exportAs: 'documentVaultMetadata', empty: [], transform: redactVaultDocuments }, // vaultStorage.js
  { key: 'civicbridge_vault_pin', category: 'vault', exportAs: null }, // vaultStorage.js
  { key: 'civicbridge_saved_rich', category: 'saved', exportAs: 'savedServices', empty: [] }, // savedStorage.js
  { key: 'civicbridge_saved', category: 'saved', exportAs: 'savedServiceBookmarks', empty: [] }, // ServiceDetails.jsx, savedStorage.js
  { key: 'civicbridge_applications', category: 'tracking', exportAs: 'trackedApplications', empty: [] }, // trackingService.js
  { key: 'civicbridge_office_tokens', category: 'tracking', exportAs: 'officeAppointments', empty: [] }, // locationService.js
  { key: 'civic_service_reviews', category: 'activity', exportAs: 'serviceReviews', empty: [] }, // reviewStorage.js
  { key: 'civicbridge_reminders', category: 'tracking', exportAs: 'activeReminders', empty: [] }, // reminderNotificationService.js
  { key: 'civicbridge_notification_settings', category: 'tracking', exportAs: 'notificationSettings', empty: {} }, // reminderNotificationService.js
  { key: 'civicbridge_chat_history', category: 'assistant', exportAs: 'chatHistorySummary', empty: [], transform: (msgs) => ({ totalMessages: msgs.length }) }, // chatStorage.js
  { key: 'civicbridge_eligibility_assessments', category: 'drafts', exportAs: 'eligibilityAssessments', empty: [] }, // assessmentStorage.js
  { key: 'civic_grievance_tickets', category: 'tracking', exportAs: 'grievanceTickets', empty: [] }, // grievanceService.js
  { key: 'civic_compared_services', category: 'saved', exportAs: 'comparedServices', empty: [] }, // comparisonService.js
  { key: 'civicbridge_faq_votes', category: 'activity', exportAs: 'faqVotes', empty: {} }, // faqService.js
  { key: 'civicbridge_ai_context_consent', category: 'assistant', exportAs: 'assistantContextConsent', empty: null }, // ai/contextRecommender.js
  { key: 'civicbridge_offline_cache', category: 'cache', exportAs: null }, // offlineCacheService.js
  { key: 'civicbridge_offline_last_sync', category: 'cache', exportAs: null }, // offlineCacheService.js
  { key: 'civicbridge_cached_shelters', category: 'cache', exportAs: null }, // disasterReliefService.js
  { key: 'civicbridge_checklists', category: 'drafts', exportAs: 'checklistProgress', empty: {} }, // checklistStorage.js
  { key: 'civic_accessibility_visit_plans', category: 'drafts', exportAs: 'accessibilityVisitPlans', empty: {} }, // accessibilityPlannerService.js
  { key: 'civic_grievance_evidence_drafts', category: 'drafts', exportAs: 'grievanceEvidenceDrafts', empty: [] }, // grievanceEvidenceService.js
  { key: 'civic_glossary_suggestions', category: 'activity', exportAs: 'glossarySuggestions', empty: [] }, // civicGlossaryService.js
  { key: 'civic_life_event_journeys', category: 'drafts', exportAs: 'lifeEventJourneys', empty: {} }, // lifeEventNavigatorService.js
  { key: 'civicbridge_community_audits', category: 'activity', exportAs: null }, // communityAuditService.js
  { key: 'civic_service_fee_preferences', category: 'saved', exportAs: 'serviceFeePreferences', empty: {} }, // feeTransparencyService.js
  { key: 'civicbridge_applicant_profiles_v1', category: 'drafts', exportAs: 'applicantProfiles', empty: [] }, // applicantProfileService.js
  { key: 'civicbridge_barrier_reports', category: 'activity', exportAs: 'barrierReports', empty: [] }, // barrierReportService.js
  { key: 'civicbridge_bottleneck_feedback_v1', category: 'activity', exportAs: 'bottleneckFeedback', empty: [] }, // bottleneckFeedbackService.js
  { key: 'civicbridge_checklist', category: 'drafts', exportAs: 'checklistItems', empty: [] }, // dataPortabilityService.js
  { key: 'civicbridge_track_applications', category: 'tracking', exportAs: 'importedTrackApplications', empty: [] }, // dataPortabilityService.js
  { key: 'civicbridge_form_drafts', category: 'drafts', exportAs: 'formDrafts', empty: [] }, // dataPortabilityService.js
  { key: 'civicbridge_journey_handoffs_v1', category: 'drafts', exportAs: 'journeyHandoffs', empty: [] }, // journeyHandoffService.js
  { key: 'civicbridge_readiness_scorecards', category: 'drafts', exportAs: 'readinessScorecards', empty: [] }, // readinessScorecardService.js
];

/**
 * What the "Clear my data" screen offers. A store belongs to exactly one category (its `category` field).
 * `copiesOf` lists the categories whose data this category only duplicates: the offline cache holds
 * copies of saved guides and tracked applications, so clearing either of those clears it too.
 */
export const DATA_CATEGORIES = [
  {
    id: 'drafts',
    label: 'Drafts and in-progress work',
    description: 'Checklist ticks, journey planner progress and eligibility check answers.',
    copiesOf: [],
  },
  {
    id: 'tracking',
    label: 'Tracking records',
    description: 'Applications you track, office appointment tokens, grievance tickets and reminders.',
    copiesOf: [],
  },
  {
    id: 'saved',
    label: 'Saved items',
    description: 'Saved and compared service guides.',
    copiesOf: [],
  },
  {
    id: 'vault',
    label: 'Document vault',
    description: 'Document names, numbers and details you added to the vault, and the vault PIN.',
    copiesOf: [],
  },
  {
    id: 'assistant',
    label: 'Assistant history',
    description: 'Past assistant conversations and your choice about using saved items as context.',
    copiesOf: [],
  },
  {
    id: 'activity',
    label: 'Reviews, votes and reports',
    description: 'Service reviews, FAQ votes and community audit reports kept on this device.',
    copiesOf: [],
  },
  {
    id: 'cache',
    label: 'Offline copies and location',
    description: 'Offline copies of your saved guides and applications, cached shelters and your last location. Cleared together with tracking records or saved items.',
    copiesOf: ['tracking', 'saved'],
  },
];

export const USER_DATA_STORAGE_KEYS = USER_DATA_STORES.map((store) => store.key);

// The journey planner writes one key per journey: civic_journey_progress_<journeyId> (journeyDependencyEngine.js).
const JOURNEY_PROGRESS_PREFIX = 'civic_journey_progress_';
export const USER_DATA_PREFIX_STORES = [{ prefix: JOURNEY_PROGRESS_PREFIX, category: 'drafts' }];
export const USER_DATA_KEY_PREFIXES = USER_DATA_PREFIX_STORES.map((store) => store.prefix);

// sessionStorage keys with user data, removed on purge (cached location from locationService.js).
export const USER_DATA_SESSION_STORES = [{ key: 'civicbridge_user_coords', category: 'cache' }];
export const USER_DATA_SESSION_KEYS = USER_DATA_SESSION_STORES.map((store) => store.key);

// Keys that purge leaves alone on purpose.
export const RETAINED_STORAGE_KEYS = [
  // UI preferences (theme, language, accessibility), covered by essential storage
  'civicbridge_theme',
  'civicbridge_lang',
  'civicbridge_plain_lang',
  'civicbridge_a11y_prefs',
  'civicbridge_focus_mode',
  'civicbridge_active_applicant_profile_id_v1',
  // Demo sign-in session, signing out is its own action
  'civicbridge_demo_user',
  // Admin portal data and the shared review queue for outdated-info reports
  'civicbridge_custom_services',
  'civicbridge_error_reports',
  'civicbridge_audit_logs',
  'civicbridge_rbac_users',
  'civicbridge_service_submissions',
  'civicbridge_barrier_audit_logs',
  'civicbridge_freshness_trust_reviews_v1',
  'civicbridge_link_health_v1',
  'civicbridge_eligibility_test_cases_v1',
  'civicbridge_service_ownership_v1',
  'civicbridge_public_notices_digest_v1',
  'civicbridge_service_availability_notices_v1',
  'civicbridge_source_conflicts',
  'civicbridge_conflict_audit_logs',
  // Handled by purge itself: consents are reset, the audit log keeps the deletion receipt
  CONSENT_STORAGE_KEY,
  AUDIT_STORAGE_KEY,
];

// Standardized consent categories and their legal requirements
export const CONSENT_CATEGORIES = {
  essential_storage: {
    id: 'essential_storage',
    title: 'Strictly Necessary Local Storage',
    description: 'Enables essential UI preferences (dark mode, language, session security). Cannot be disabled.',
    mandatory: true,
    defaultGranted: true,
    retentionDays: 365,
  },
  personalization: {
    id: 'personalization',
    title: 'Personalized Service Recommendations',
    description: 'Analyzes user-provided goals and document readiness to compute explainable service recommendations.',
    mandatory: false,
    defaultGranted: true,
    retentionDays: 90,
  },
  offline_cache: {
    id: 'offline_cache',
    title: 'Offline Service & Dossier Caching',
    description: 'Stores service guidelines and application stages locally in IndexedDB / LocalStorage for offline network resilience.',
    mandatory: false,
    defaultGranted: true,
    retentionDays: 30,
  },
  chat_session_memory: {
    id: 'chat_session_memory',
    title: 'Civic Assistant Conversation Memory',
    description: 'Maintains recent chat questions and cited source answers on this browser to provide conversational context.',
    mandatory: false,
    defaultGranted: false,
    retentionDays: 14,
  },
  analytics_telemetry: {
    id: 'analytics_telemetry',
    title: 'Anonymous Search & Feature Telemetry',
    description: 'Collects aggregated query statistics to optimize service search rankings without linking to your identity.',
    mandatory: false,
    defaultGranted: false,
    retentionDays: 60,
  },
};

/**
 * Helper to obtain storage safely in all environments
 */
function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (!globalThis.__mockPrivacyStorage) {
    globalThis.__mockPrivacyStorage = new Map();
  }
  return {
    getItem: (k) => globalThis.__mockPrivacyStorage.get(k) || null,
    setItem: (k, v) => globalThis.__mockPrivacyStorage.set(k, String(v)),
    removeItem: (k) => globalThis.__mockPrivacyStorage.delete(k),
    key: (i) => [...globalThis.__mockPrivacyStorage.keys()][i] ?? null,
    get length() {
      return globalThis.__mockPrivacyStorage.size;
    },
  };
}

function getSessionStorage() {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

// Stored keys that start with one of USER_DATA_KEY_PREFIXES.
function getPrefixedUserDataKeys(storage) {
  const keys = [];
  for (let i = 0; i < (storage.length || 0); i += 1) {
    const key = storage.key(i);
    if (key && USER_DATA_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }
  return keys;
}

// Parses a stored JSON value. Missing, corrupt or wrong-shaped values give `empty` instead of throwing.
function readStoredJson(storage, key, empty) {
  const raw = storage.getItem(key);
  if (raw === null || raw === undefined || raw === '') return empty;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(empty) && !Array.isArray(parsed)) return empty;
    return parsed;
  } catch {
    return empty;
  }
}

/**
 * Loads current consent settings from persistent storage.
 * @returns {Record<string, boolean>}
 */
export function getConsentPreferences() {
  const storage = getStorage();
  const raw = storage.getItem(CONSENT_STORAGE_KEY);
  const defaults = Object.fromEntries(
    Object.values(CONSENT_CATEGORIES).map((c) => [c.id, c.defaultGranted])
  );

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      essential_storage: true, // Always enforced
    };
  } catch {
    return defaults;
  }
}

/**
 * Checks if consent has been granted for a specific category.
 * @param {string} categoryId
 * @returns {boolean}
 */
export function isConsentGranted(categoryId) {
  if (categoryId === 'essential_storage') return true;
  const preferences = getConsentPreferences();
  return !!preferences[categoryId];
}

/**
 * Updates a consent preference and records a non-sensitive audit entry.
 *
 * @param {string} categoryId
 * @param {boolean} granted
 * @param {string} actorId - User ID or 'anonymous'
 * @returns {boolean} True if successfully updated
 */
export function updateConsentPreference(categoryId, granted, actorId = 'citizen_user') {
  const category = CONSENT_CATEGORIES[categoryId];
  if (!category) {
    throw new Error(`Unknown consent category: "${categoryId}"`);
  }

  // Mandatory categories cannot be withdrawn
  if (category.mandatory && !granted) {
    throw new Error(`Cannot revoke consent for mandatory category: "${category.title}"`);
  }

  const current = getConsentPreferences();
  const updated = {
    ...current,
    [categoryId]: granted,
    essential_storage: true,
  };

  const storage = getStorage();
  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(updated));

  // Record audit log without sensitive data
  recordPrivacyAuditLog(
    'CONSENT_PREFERENCE_UPDATED',
    { categoryId, granted, categoryTitle: category.title },
    actorId
  );

  return true;
}

/**
 * Enforces authorization checks between acting user and target resource owner.
 *
 * @param {string} actorUserId - ID of the user attempting the action
 * @param {string} resourceOwnerId - ID of the user who owns the resource
 * @returns {boolean} True if authorized
 * @throws {Error} If unauthorized access is detected
 */
export function enforceAuthorization(actorUserId, resourceOwnerId) {
  if (!actorUserId || !resourceOwnerId) {
    recordPrivacyAuditLog('AUTHORIZATION_FAILED', { reason: 'MISSING_USER_CONTEXT' }, actorUserId || 'anonymous');
    throw new Error('Authorization Error: Missing user authentication context.');
  }

  if (actorUserId !== resourceOwnerId && actorUserId !== 'admin_root') {
    recordPrivacyAuditLog(
      'UNAUTHORIZED_ACCESS_BLOCKED',
      { attemptedAccessOn: resourceOwnerId },
      actorUserId
    );
    throw new Error(`Access Denied: User "${actorUserId}" is not authorized to access resources owned by "${resourceOwnerId}".`);
  }

  return true;
}

/**
 * Records an immutable audit log entry strictly stripped of PII, credentials, or document contents.
 *
 * @param {string} action - Action code
 * @param {Object} metadata - Non-sensitive metadata
 * @param {string} actorId - Acting user identifier
 */
export function recordPrivacyAuditLog(action, metadata = {}, actorId = 'citizen_user') {
  const storage = getStorage();

  // Strip potential PII keys
  const safeMeta = { ...metadata };
  delete safeMeta.password;
  delete safeMeta.token;
  delete safeMeta.secret;
  delete safeMeta.email;
  delete safeMeta.phone;
  delete safeMeta.aadhaarNumber;
  delete safeMeta.panNumber;
  delete safeMeta.documentContent;
  delete safeMeta.fileData;

  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    actorId: String(actorId),
    metadata: safeMeta,
  };

  try {
    const raw = storage.getItem(AUDIT_STORAGE_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    // Keep latest 100 entries
    const updated = [entry, ...logs].slice(0, 100);
    storage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    logDiagnostic('Failed to write privacy audit log:', err);
  }
}

/**
 * Returns audit log entries.
 * @returns {Object[]}
 */
export function getPrivacyAuditLogs() {
  const storage = getStorage();
  try {
    const raw = storage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Exports all user-owned data into a documented, machine-readable JSON dossier.
 *
 * @param {string} userId - User identifier
 * @returns {Object} Complete data export package
 */
export function exportUserData(userId = 'citizen_user') {
  const storage = getStorage();

  // Collect data across all modules from the shared USER_DATA_STORES list
  const sections = {};
  const includedKeys = [];
  for (const store of USER_DATA_STORES) {
    if (!store.exportAs) continue;
    if (storage.getItem(store.key) !== null) includedKeys.push(store.key);
    const value = readStoredJson(storage, store.key, store.empty);
    sections[store.exportAs] = store.transform ? store.transform(value) : value;
  }

  const journeyProgress = {};
  for (const key of getPrefixedUserDataKeys(storage)) {
    includedKeys.push(key);
    if (key.startsWith(JOURNEY_PROGRESS_PREFIX)) {
      journeyProgress[key.slice(JOURNEY_PROGRESS_PREFIX.length)] = readStoredJson(storage, key, null);
    }
  }

  const exportPayload = {
    exportMetadata: {
      platform: 'Civic-Help-Setu',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      userId,
      format: 'application/json',
      retentionPolicy: 'https://civicbridge.org/privacy',
      includedStorageKeys: includedKeys,
    },
    consentPreferences: getConsentPreferences(),
    ...sections,
    journeyProgress,
  };

  recordPrivacyAuditLog('USER_DATA_EXPORTED', { totalCategories: Object.keys(sections).length + 1 }, userId);
  return exportPayload;
}

/**
 * Performs a cascading account data deletion across all local and application stores.
 *
 * @param {string} userId - User identifier
 * @param {Object} options
 * @param {boolean} options.preserveAuditTrail - Whether to retain an anonymous deletion receipt (default: true)
 * @returns {Object} Deletion summary report
 */
export function purgeAllUserData(userId = 'citizen_user', options = { preserveAuditTrail: true }) {
  const storage = getStorage();

  const deletedKeys = [];
  for (const key of [...USER_DATA_STORAGE_KEYS, ...getPrefixedUserDataKeys(storage)]) {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key);
      deletedKeys.push(key);
    }
  }

  const session = getSessionStorage();
  if (session) {
    for (const key of USER_DATA_SESSION_KEYS) {
      if (session.getItem(key) !== null) {
        session.removeItem(key);
        deletedKeys.push(key);
      }
    }
  }

  // Reset consents to defaults
  storage.removeItem(CONSENT_STORAGE_KEY);

  // Record irreversible deletion confirmation
  if (options.preserveAuditTrail) {
    recordPrivacyAuditLog(
      'ACCOUNT_DATA_PERMANENTLY_PURGED',
      {
        deletedStoresCount: deletedKeys.length,
        deletedStores: deletedKeys,
      },
      userId
    );
  } else {
    storage.removeItem(AUDIT_STORAGE_KEY);
  }

  return {
    success: true,
    purgedAt: new Date().toISOString(),
    userId,
    deletedKeysCount: deletedKeys.length,
    deletedKeys,
    retainedAuditReceipt: options.preserveAuditTrail,
  };
}
