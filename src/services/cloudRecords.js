/**
 * How the browser's personal stores map onto Firestore records, in the shape firebase/firestore.rules
 * accepts (docs/FIREBASE_RULES.md). Pure functions, no Firebase SDK and no network: nothing in the app
 * calls Firestore yet, this is the contract a sync layer will use.
 *
 * Every key in USER_DATA_STORES (privacyConsentService.js) is in exactly one of two tables below, and
 * a test fails when a new store is added to the registry without being classified here.
 *
 * A record is { collection, id, data, schemaVersion }. The caller adds `updatedAt: serverTimestamp()`
 * when writing, which is the only other field the rules allow:
 *   - `list` stores keep one record per item:  data = { value: item, position: index }
 *   - `document` stores keep one record:       data = { value: <the whole stored value> }
 * Keeping the user's content under `value` means its own field names (`role`, `status`, ...) can never
 * collide with the rules' checks on top-level fields, and nothing is dropped.
 */

export const SCHEMA_VERSION = 1;

/** Firestore documents are limited to 1 MiB; stay well under it. */
export const MAX_RECORD_BYTES = 900 * 1024;

/**
 * Stores that are kept per person in the cloud.
 * collection: must be one of the personal collections in firestore.rules (ownedCollections()).
 */
export const CLOUD_STORES = [
  { key: 'civicbridge_vault_docs', slug: 'vault-docs', collection: 'vaultDocs', kind: 'list' },
  { key: 'civicbridge_saved_rich', slug: 'saved-guides', collection: 'saved', kind: 'list' },
  { key: 'civicbridge_saved', slug: 'saved-bookmarks', collection: 'saved', kind: 'list' },
  { key: 'civic_compared_services', slug: 'compared', collection: 'saved', kind: 'document' },
  { key: 'civicbridge_applications', slug: 'applications', collection: 'applications', kind: 'list' },
  { key: 'civicbridge_track_applications', slug: 'imported-applications', collection: 'applications', kind: 'list' },
  { key: 'civicbridge_office_tokens', slug: 'office-tokens', collection: 'officeTokens', kind: 'list' },
  { key: 'civicbridge_reminders', slug: 'reminders', collection: 'reminders', kind: 'list' },
  { key: 'civicbridge_notification_settings', slug: 'notification-settings', collection: 'settings', kind: 'document' },
  { key: 'civic_service_fee_preferences', slug: 'fee-preferences', collection: 'settings', kind: 'document' },
  { key: 'civicbridge_ai_context_consent', slug: 'assistant-consent', collection: 'settings', kind: 'document' },
  { key: 'civicbridge_eligibility_assessments', slug: 'assessments', collection: 'assessments', kind: 'list' },
  { key: 'civic_grievance_tickets', slug: 'grievance-tickets', collection: 'grievanceTickets', kind: 'list' },
  { key: 'civicbridge_checklists', slug: 'checklists', collection: 'checklists', kind: 'document' },
  { key: 'civicbridge_checklist', slug: 'checklist-items', collection: 'checklists', kind: 'list' },
  { key: 'civicbridge_form_drafts', slug: 'form-drafts', collection: 'drafts', kind: 'list' },
  { key: 'civic_grievance_evidence_drafts', slug: 'evidence-drafts', collection: 'drafts', kind: 'list' },
  { key: 'civic_life_event_journeys', slug: 'life-event-journeys', collection: 'drafts', kind: 'document' },
  { key: 'civicbridge_journey_handoffs_v1', slug: 'journey-handoffs', collection: 'drafts', kind: 'list' },
  { key: 'civic_grievance_drafts_v1', slug: 'grievance-drafts-v1', collection: 'drafts', kind: 'list' },
  { key: 'civicbridge_preparation_plans_v1', slug: 'preparation-plans-v1', collection: 'drafts', kind: 'list' },
  { key: 'civicbridge_applicant_profiles_v1', slug: 'applicant-profiles', collection: 'applicantProfiles', kind: 'list' },
  { key: 'civicbridge_readiness_scorecards', slug: 'scorecards', collection: 'scorecards', kind: 'list' },
  { key: 'civicbridge_chat_history', slug: 'chat-history', collection: 'assistantChats', kind: 'document' },
  { key: 'civicbridge_citizen_drafts_v1', slug: 'citizen-drafts', collection: 'drafts', kind: 'document' },
];

/** Stores that deliberately never leave the device, or are handled elsewhere, each with the reason. */
export const DEVICE_ONLY_STORES = [
  { key: 'civicbridge_vault_pin', reason: 'The vault PIN is a secret and stays on the device.' },
  { key: 'civicbridge_offline_cache', reason: 'A copy of saved guides and applications for offline use.' },
  { key: 'civicbridge_offline_last_sync', reason: 'Cache bookkeeping.' },
  { key: 'civicbridge_cached_shelters', reason: 'A cache of public relief data.' },
  { key: 'civic_service_reviews', reason: 'No cloud collection yet; reviews would be public content with their own rules.' },
  { key: 'civicbridge_faq_votes', reason: 'No cloud collection yet.' },
  { key: 'civic_glossary_suggestions', reason: 'No cloud collection yet.' },
  { key: 'civicbridge_community_audits', reason: 'Sent as a submission to communityAudits, not kept as a personal record.' },
  { key: 'civicbridge_barrier_reports', reason: 'Sent as a submission to barrierReports, not kept as a personal record.' },
  { key: 'civicbridge_bottleneck_feedback_v1', reason: 'Sent as a submission to bottleneckFeedback, not kept as a personal record.' },
  { key: 'civicbridge_office_accessibility_audits', reason: 'Crowdsourced office accessibility ratings are community data kept on device.' },
  { key: 'civic_accessibility_visit_plans', reason: 'Private visit preferences stay on this device and are never cloud-synced.' },
  { key: 'civicbridge_newsletter_subscriptions', reason: 'Newsletter emails, consent, and delivery preferences are handled separately and stay on this device.' },
  { key: 'civicbridge_sent_digests', reason: 'Newsletter delivery history is local bookkeeping and is never cloud-synced.' },
  { key: 'civicbridge_newsletter_delivery_failures', reason: 'Newsletter delivery failure details are local bookkeeping and are never cloud-synced.' },
  { key: 'civicbridge_civic_works_reports_v1', reason: 'Ward civic works reports include consent, media, and moderation metadata kept on device.' },
  { key: 'civicbridge_offline_operations_v1', reason: 'Local offline operations queue stays on the device.' },
  { key: 'civicbridge_sync_sessions_v1', reason: 'Sync session history is local device bookkeeping.' },
  { key: 'civicbridge_record_revisions_v1', reason: 'Local cache of record revision snapshots stays on the device.' },
  { key: 'civicbridge_conflict_records_v1', reason: 'Local conflict records stay on device until resolved.' },
  { key: 'civicbridge_device_cursors_v1', reason: 'Device sync cursors stay on the device.' },
  { key: 'civicbridge_tombstones_v1', reason: 'Deletion tombstones stay on the device.' },

  { key: 'civicbridge_notice_deadline_state_v1', reason: 'Citizen deadline confirmations, edits and notes stay on this device until a cloud collection exists.' },

  { key: 'civicbridge_hazard_reports_v1', reason: 'Citizen road hazard reports are local submissions kept on device before moderation.' },
  { key: 'civicbridge_road_safety_rate_limit_v1', reason: 'Road safety rate-limiting timestamps are local bookkeeping and are never cloud-synced.' },
  { key: 'civicbridge_review_cases_v1', reason: 'Road safety review cases and inspection logs stay on device.' },
  { key: 'civicbridge_intervention_records_v1', reason: 'Road safety countermeasure records stay on device.' },
  { key: 'civicbridge_office_comparison_reports_v1', reason: 'Outdated office-record reports are non-sensitive community submissions kept on device until the review endpoint accepts them.' },
  { key: 'civicbridge_tenants_v1', reason: 'Tenant authority profiles are administrative workspace configurations.' },
  { key: 'civicbridge_tenant_memberships_v1', reason: 'Tenant staff memberships are authority-scoped RBAC records.' },
  { key: 'civicbridge_tenant_roles_v1', reason: 'Tenant role permissions are authority-scoped RBAC records.' },
  { key: 'civicbridge_tenant_settings_v1', reason: 'Tenant authority configurations and SLA rules are workspace settings.' },
  { key: 'civicbridge_tenant_audit_events_v1', reason: 'Tenant audit logs are append-only administrative records.' },
  { key: 'civicbridge_tenant_datasets_v1', reason: 'Tenant operational records are partitioned authority datasets.' },
  { key: 'civicbridge_shared_catalogue_v1', reason: 'Cross-tenant public catalogue records are managed via publication workflows.' },
  { key: 'civicbridge_active_tenant_context_v1', reason: 'Active tenant context selection is local device state.' },
  { key: 'civicbridge_tenant_migration_backup_v1', reason: 'Tenant migration rollback backup is local device state.' },
  { key: 'civicbridge_tree_report_attachments_v1', reason: 'Tree report photo attachments are kept locally on device.' },
  { key: 'civicbridge_tree_citizen_reports_v1', reason: 'Citizen tree reports remain on device.' },
  { key: 'civicbridge_tree_reports_v1', reason: 'Legacy tree reports remain on device.' },
  { key: 'civicbridge_tree_reporter_key', reason: 'Tree reporter key is device-specific.' },
  { key: 'civicbridge_continuity_plans_v1', reason: 'Continuity preparedness plans remain on device.' },
  { key: 'civicbridge_incident_scenarios_v1', reason: 'Continuity incident drill scenarios remain on device.' },
  { key: 'civicbridge_service_dependencies_v1', reason: 'Continuity service dependencies remain on device.' },
  { key: 'civicbridge_exercise_runs_v1', reason: 'Continuity drill exercise run logs remain on device.' },
  { key: 'civicbridge_action_items_v1', reason: 'Continuity corrective action items remain on device.' },
  { key: 'civicbridge_continuity_audit_logs_v1', reason: 'Continuity drill audit logs remain on device.' },
  { key: 'civicbridge_continuity_recommendations_v1', reason: 'Continuity drill recommendations remain on device.' },
  { key: 'civicbridge_senior_tribunal_petitions', reason: 'Senior citizen maintenance tribunal petitions remain on device.' },

];

const byKey = new Map(CLOUD_STORES.map((store) => [store.key, store]));

export class CloudRecordError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CloudRecordError';
    this.code = code;
  }
}

export const isCloudStore = (key) => byKey.has(key);

const storeFor = (key) => {
  const store = byKey.get(key);
  if (!store) throw new CloudRecordError(`"${String(key)}" is not a cloud store.`, 'not_a_cloud_store');
  return store;
};

/**
 * A Firestore-safe document id: no "/", not "." or "..", not of the reserved form __x__, at most 128
 * characters. The store slug is always the prefix, so two stores in one collection never collide.
 */
export function recordId(slug, suffix) {
  const clean = String(suffix)
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 96);
  return `${slug}--${clean || 'item'}`;
}

const sizeOf = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

function assertFits(data, id) {
  if (sizeOf(data) > MAX_RECORD_BYTES) {
    throw new CloudRecordError(`Record "${id}" is too large for one Firestore document.`, 'record_too_large');
  }
}

/**
 * Converts the value of one localStorage key (already JSON-parsed) into Firestore records.
 * @param {string} key the localStorage key
 * @param {unknown} value
 * @returns {{collection: string, id: string, data: object, schemaVersion: number}[]}
 */
export function toCloudRecords(key, value) {
  const store = storeFor(key);

  if (store.kind === 'document') {
    const data = { value: value === undefined ? null : value };
    const id = recordId(store.slug, 'current');
    assertFits(data, id);
    return [{ collection: store.collection, id, data, schemaVersion: SCHEMA_VERSION }];
  }

  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new CloudRecordError(`"${key}" should hold a list.`, 'expected_list');
  }
  const seen = new Set();
  return value.map((item, position) => {
    const named = item && typeof item === 'object' && typeof item.id === 'string' && item.id ? item.id : null;
    const natural = named ?? (typeof item === 'string' && item ? item : null);
    let id = recordId(store.slug, natural ?? `n${position}`);
    // two items that clean to the same id, or no id at all: fall back to the position
    if (seen.has(id)) id = recordId(store.slug, `${natural ?? 'item'}-n${position}`);
    seen.add(id);
    const data = { value: item, position };
    assertFits(data, id);
    return { collection: store.collection, id, data, schemaVersion: SCHEMA_VERSION };
  });
}

/**
 * The inverse of toCloudRecords: the value to put back into the localStorage key.
 * @param {string} key
 * @param {{id?: string, data: {value: unknown, position?: number}}[]} records records of that store
 */
export function fromCloudRecords(key, records) {
  const store = storeFor(key);
  const list = Array.isArray(records) ? records : [];

  if (store.kind === 'document') {
    const record = list.find((entry) => entry?.data && 'value' in entry.data);
    return record ? record.data.value : null;
  }
  return list
    .filter((entry) => entry?.data && 'value' in entry.data)
    .slice()
    .sort((a, b) => (a.data.position ?? 0) - (b.data.position ?? 0))
    .map((entry) => entry.data.value);
}

/** Which of the registry's keys belong to a collection (what to query when loading it). */
export const storesInCollection = (collection) => CLOUD_STORES.filter((store) => store.collection === collection);
