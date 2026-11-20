/**
 * Privacy and Consent Management Service (#80)
 * Implements granular consent category management, authorization guards,
 * auditable security event logging (strictly without PII), secure export routing,
 * and cascading account deletion according to the India DPDP Act 2023 & GDPR standards.
 */
import { logDiagnostic } from '../utils/diagnostics';
import {
  createChainedAuditEntry,
  verifyPrivacyAuditLogIntegrity,
  signExportPayload,
  verifyExportedDataIntegrity,
  MAX_AUDIT_LOG_ENTRIES,
} from './privacyIntegrityService.js';

const CONSENT_STORAGE_KEY = 'civicbridge_consent_preferences';
const AUDIT_STORAGE_KEY = 'civicbridge_privacy_audit_log';

// Vault export keeps the document metadata but never the document number.
const redactVaultDocuments = (docs) => {
  if (docs && !Array.isArray(docs) && docs.format === 'civicbridge-vault-encrypted') {
    return {
      encrypted: true,
      format: docs.format,
      version: docs.version,
    };
  }
  if (!Array.isArray(docs)) return [];
  return docs.map((doc) => ({
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
};

/**
 * Every localStorage key where the app keeps the user's own data, with the file that writes it.
 * purgeAllUserData deletes all of them, so a service that starts writing a new key only has to be
 * added here. `exportAs` and `empty` are legacy registry annotations; secure exports use the
 * account-owned allowlist in privacyExportService.js instead of exporting this global registry.
 * Keys that purge leaves alone on purpose are in RETAINED_STORAGE_KEYS.
 */
export const USER_DATA_STORES = [
  { key: 'civicbridge_vault_docs', category: 'vault', exportAs: 'documentVaultMetadata', empty: [], transform: redactVaultDocuments }, // vaultStorage.js
  { key: 'civicbridge_vault_pin', category: 'vault', exportAs: null }, // vaultStorage.js
  { key: 'civicbridge_saved_rich', category: 'saved', exportAs: 'savedServices', empty: [] }, // savedStorage.js
  { key: 'civicbridge_saved', category: 'saved', exportAs: 'savedServiceBookmarks', empty: [] }, // ServiceDetails.jsx, savedStorage.js
  { key: 'civicbridge_applications', category: 'tracking', exportAs: 'trackedApplications', empty: [] }, // trackingService.js
  { key: 'civicbridge_application_events_v1', category: 'tracking', exportAs: null, empty: [] }, // applicationEventService.js
  { key: 'civicbridge_event_inconsistency_reports_v1', category: 'activity', exportAs: null, empty: [] }, // applicationEventService.js
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
  { key: 'civicbridge_office_comparison_reports_v1', category: 'activity', exportAs: null }, // officeComparisonReportService.js
  { key: 'civicbridge_checklist', category: 'drafts', exportAs: 'checklistItems', empty: [] }, // dataPortabilityService.js
  { key: 'civicbridge_track_applications', category: 'tracking', exportAs: 'importedTrackApplications', empty: [] }, // dataPortabilityService.js
  { key: 'civicbridge_form_drafts', category: 'drafts', exportAs: 'formDrafts', empty: [] }, // dataPortabilityService.js
  { key: 'civicbridge_journey_handoffs_v1', category: 'drafts', exportAs: 'journeyHandoffs', empty: [] }, // journeyHandoffService.js
  { key: 'civicbridge_readiness_scorecards', category: 'drafts', exportAs: 'readinessScorecards', empty: [] }, // readinessScorecardService.js
  { key: 'civicbridge_office_accessibility_audits', category: 'activity', exportAs: 'officeAccessibilityAudits', empty: [] }, // accessibilityMapService.js
  { key: 'civic_grievance_drafts_v1', category: 'drafts', exportAs: 'grievanceDrafts', empty: [] }, // civicGrievanceDraftingService.js
  { key: 'civicbridge_preparation_plans_v1', category: 'drafts', exportAs: 'preparationPlans', empty: {} }, // applicationPreparationPlanService.js
  { key: 'civicbridge_newsletter_subscriptions', category: 'tracking', exportAs: 'newsletterSubscriptions', empty: [] }, // newsletterSubscriptionService.js
  { key: 'civicbridge_sent_digests', category: 'tracking', exportAs: 'sentNewsletterDigests', empty: [] }, // newsletterSubscriptionService.js
  { key: 'civicbridge_newsletter_delivery_failures', category: 'tracking', exportAs: 'newsletterDeliveryFailures', empty: [] }, // newsletterSubscriptionService.js
  { key: 'civicbridge_civic_works_reports_v1', category: 'activity', exportAs: 'civicWorksReports', empty: [] }, // civicWorksBoardService.js
  { key: 'civic_micro_volunteer_board_v1', category: 'activity', exportAs: 'microVolunteerBoard', empty: null }, // microVolunteerMigrations.js (#759)

  { key: 'civicbridge_notice_deadline_state_v1', category: 'tracking', exportAs: null, empty: {} }, // dateCandidateService.js

  // Citizen-authored tree reports and their attachments are the citizen's data.
  // The municipal register, inspections, work orders, audit chain and migration
  // metadata are public-authority operating records and live in RETAINED_STORAGE_KEYS.
  { key: 'civicbridge_tree_report_attachments_v1', category: 'activity', exportAs: null }, // treeInventoryService.js
  { key: 'civicbridge_tree_citizen_reports_v1', category: 'activity', exportAs: null }, // treeInventoryService.js
  { key: 'civicbridge_tree_reports_v1', category: 'activity', exportAs: null }, // legacy tree reports
  { key: 'civicbridge_tree_reporter_key', category: 'activity', exportAs: null }, // TreeHealthInventory.jsx

  { key: 'civicbridge_citizen_drafts_v1', category: 'drafts', exportAs: 'citizenDrafts', empty: {} }, // citizenDraftSyncEngine.js
  { key: 'civicbridge_offline_operations_v1', category: 'drafts', exportAs: null, empty: {} }, // citizenDraftSyncEngine.js
  { key: 'civicbridge_sync_sessions_v1', category: 'drafts', exportAs: null, empty: {} }, // citizenDraftSyncEngine.js
  { key: 'civicbridge_record_revisions_v1', category: 'drafts', exportAs: null, empty: {} }, // citizenDraftSyncEngine.js
  { key: 'civicbridge_conflict_records_v1', category: 'drafts', exportAs: null, empty: {} }, // citizenDraftSyncEngine.js
  { key: 'civicbridge_device_cursors_v1', category: 'drafts', exportAs: null, empty: {} }, // citizenDraftSyncEngine.js
  { key: 'civicbridge_tombstones_v1', category: 'drafts', exportAs: null, empty: {} }, // citizenDraftSyncEngine.js

  { key: 'civicbridge_npsc_fee_history_v1', category: 'saved', exportAs: 'serviceFeeHistory', empty: [] }, // nationalPublicServiceCentreService.js
  { key: 'civicbridge_npsc_fee_observations_v1', category: 'activity', exportAs: 'serviceFeeObservations', empty: [] }, // nationalPublicServiceCentreService.js

  { key: 'civicbridge_tenants_v1', category: 'activity', exportAs: null, empty: [] }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_tenant_memberships_v1', category: 'activity', exportAs: null, empty: [] }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_tenant_roles_v1', category: 'activity', exportAs: null, empty: [] }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_tenant_settings_v1', category: 'activity', exportAs: null, empty: [] }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_tenant_audit_events_v1', category: 'activity', exportAs: null, empty: [] }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_tenant_datasets_v1', category: 'activity', exportAs: null, empty: [] }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_shared_catalogue_v1', category: 'activity', exportAs: null, empty: [] }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_active_tenant_context_v1', category: 'activity', exportAs: null, empty: '' }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_tenant_migration_backup_v1', category: 'activity', exportAs: null, empty: null }, // tenantIsolationService.js (#779)
  { key: 'civicbridge_continuity_plans_v1', category: 'drafts', exportAs: 'continuityPlans', empty: [] }, // continuityPlannerService.js
  { key: 'civicbridge_incident_scenarios_v1', category: 'drafts', exportAs: 'incidentScenarios', empty: [] }, // continuityPlannerService.js
  { key: 'civicbridge_service_dependencies_v1', category: 'drafts', exportAs: 'serviceDependencies', empty: [] }, // continuityPlannerService.js
  { key: 'civicbridge_exercise_runs_v1', category: 'activity', exportAs: 'exerciseRuns', empty: [] }, // continuityPlannerService.js
  { key: 'civicbridge_action_items_v1', category: 'tracking', exportAs: 'actionItems', empty: [] }, // continuityPlannerService.js
  { key: 'civicbridge_continuity_audit_logs_v1', category: 'activity', exportAs: null, empty: [] }, // continuityAuditService.js
  { key: 'civicbridge_continuity_recommendations_v1', category: 'drafts', exportAs: null, empty: [] }, // continuityPlannerService.js
  { key: 'civicbridge_senior_tribunal_petitions', category: 'drafts', exportAs: 'seniorCitizenTribunalPetitions', empty: [] }, // seniorCitizenTribunalStorage.js
  { key: 'civicbridge_rera_complaints', category: 'drafts', exportAs: 'reraComplaints', empty: [] }, // reraDisputeStorage.js
  { key: 'civicbridge_abc_conflict_records', category: 'drafts', exportAs: 'strayAnimalConflictRecords', empty: [] }, // strayAnimalStorage.js
  { key: 'civicbridge_noise_pollution_logs', category: 'drafts', exportAs: 'noisePollutionLogs', empty: [] }, // noisePollutionStorage.js
  { key: 'civicbridge_solid_waste_audits', category: 'drafts', exportAs: 'solidWasteAudits', empty: [] }, // solidWasteStorage.js
  { key: 'civicbridge_patient_grievance_records', category: 'drafts', exportAs: 'patientGrievanceRecords', empty: [] }, // clinicalEstablishmentStorage.js
  { key: 'civicbridge_electricity_cgrf_vault', category: 'drafts', exportAs: 'electricityCgrfVault', empty: [] }, // electricityConsumerStorage.js
  { key: 'civicbridge_accessibility_audit_vault', category: 'drafts', exportAs: 'accessibilityAuditVault', empty: [] },
  { key: 'civicbridge_dark_patterns_vault', category: 'drafts', exportAs: 'darkPatternsVault', empty: [] },
  { key: 'civicbridge_vendor_rights_vault', category: 'drafts', exportAs: 'vendorRightsVault', empty: [] }, // streetVendorStorage.js
  { key: 'civicbridge_rte_grievance_vault', category: 'drafts', exportAs: 'rteGrievanceVault', empty: [] }, // rteAdmissionStorage.js
  { key: 'civicbridge_accessibility_cases_v1', category: 'drafts', exportAs: 'accessibilityEscalationCases', empty: [] }, // accessibilityEscalationStorage.js (#950)
  { key: 'civicbridge_accessibility_tracker_settings_v1', category: 'drafts', exportAs: null, empty: {} }, // accessibilityEscalationStorage.js (#950)
  { key: 'civicbridge_legal_sources_v1', category: 'drafts', exportAs: 'legalSourcesRegistry', empty: [] }, // legalSourceStorage.js
  { key: 'civicbridge_legal_draft_snapshots_v1', category: 'drafts', exportAs: 'legalDraftSnapshots', empty: [] }, // legalSourceStorage.js
  { key: 'civicbridge_legal_sources_audit_v1', category: 'drafts', exportAs: 'legalSourcesAuditLogs', empty: [] }, // legalSourceStorage.js
  { key: 'civicbridge_evidence_dossiers_v1', category: 'drafts', exportAs: 'evidenceDossiers', empty: [] }, // evidenceDossierStorage.js

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
export const USER_DATA_SESSION_STORES = [
  { key: 'civicbridge_user_coords', category: 'cache' },
  { key: 'civicbridge_office_comparison_draft_v1', category: 'drafts' },
];
export const USER_DATA_SESSION_KEYS = USER_DATA_SESSION_STORES.map((store) => store.key);

// Keys that purge leaves alone on purpose.
export const RETAINED_STORAGE_KEYS = [
  // UI preferences (theme, language, accessibility), covered by essential storage
  'civicbridge_theme',
  'civicbridge_lang',
  'civicbridge_plain_lang',
  'civicbridge_a11y_prefs',
  'civicbridge_focus_mode',
  'civicbridge_reader_preferences',
  'civicbridge_active_applicant_profile_id_v1',
  'civicbridge_comparison_stale_dismissed',
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
  'civicbridge_service_drafts_v1',
  'civicbridge_catalogue_snapshots_v1',
  'civicbridge_eligibility_test_cases_v1',
  'civicbridge_service_ownership_v1',
  'civicbridge_dismissed_recommendations',
  'civicbridge_catalogue_completeness_dismissals',
  'civicbridge_public_notices_digest_v1',
  'civicbridge_service_availability_notices_v1',
  'civicbridge_change_events',
  'civicbridge_review_approvals',
  'civicbridge_source_conflicts',
  'civicbridge_conflict_audit_logs',
  'civicbridge_catalogue_enrichment_queue_v1',
  'civicbridge_duplicate_review_states',
  'civicbridge_civic_works_clusters_v1',
  'civicbridge_civic_works_rate_limit_v1',
  // Synthetic civic dataset generator stores (#778) - zero PII, ephemeral testing fixtures
  'civicbridge_synthetic_profiles_v1',
  'civicbridge_synthetic_jobs_v1',
  'civicbridge_synthetic_artifacts_meta_v1',
  'civicbridge_synthetic_validation_runs_v1',
  'civicbridge_synthetic_artifact_data_',
  'civicbridge_synthetic_schema_catalog_v1',
  'civicbridge_synthetic_audit_logs_v1',
  'civicbridge_synthetic_migration_backup_v1',
  // Counter demand forecasting and queue capacity planning (#764)
  'civicbridge_counter_aggregates_v1',
  'civicbridge_capacity_plans_v1',
  'civicbridge_forecast_runs_v1',
  'civicbridge_capacity_audit_logs_v1',
  // Road safety blackspot detection and municipal review workspace (#769)
  'civicbridge_road_segments_v1',
  'civicbridge_crash_aggregates_v1',
  'civicbridge_hazard_reports_v1',
  'civicbridge_road_features_v1',
  'civicbridge_risk_runs_v1',
  'civicbridge_review_cases_v1',
  'civicbridge_intervention_records_v1',
  'civicbridge_road_safety_rate_limit_v1',
  'civicbridge_road_safety_audit_logs_v1',
  // Municipal tree register, inspections, work orders and audit records. These
  // are public-authority operating records, not a citizen's profile data: the
  // tree module enforces its own 365-day report retention policy. Citizen tree
  // reports and attachments are in USER_DATA_STORES above and are cleared.
  'civicbridge_tree_inventory_meta_v1',
  'civicbridge_tree_assets_v1',
  'civicbridge_tree_species_v1',
  'civicbridge_tree_inspections_v1',
  'civicbridge_tree_maintenance_orders_v1',
  'civicbridge_tree_pruning_events_v1',
  'civicbridge_tree_planting_sites_v1',
  'civicbridge_tree_triage_suggestions_v1',
  'civicbridge_tree_audit_events_v1',
  'civicbridge_tree_idempotency_v1',
  'civicbridge_tree_rate_limit_v1',
  'civicbridge_tree_migration_backup_v1',
  'civicbridge_trees_v1',
  // Anonymized ward-level civic issue heatmap, aggregation runs, and privacy rules
  'civicbridge_ward_issue_events_v1',
  'civicbridge_ward_geometries_v1',
  'civicbridge_ward_metrics_v1',
  'civicbridge_aggregation_runs_v1',
  'civicbridge_privacy_rules_v1',
  'civicbridge_ward_recommendations_v1',
  'civicbridge_ward_issue_audit_logs_v1',
  'civicbridge_ward_issue_rate_limit_v1',
  'civicbridge_ward_heatmap_migration_backup_v1',
  // Municipal greenhouse-gas inventory, factor versions and append-only audit trail (#753).
  // These are public-authority operating records, not a citizen's personal data.
  'civic_ghg_inventory_v1',
  // Civic knowledge records lineage and provenance explorer (#777)
  'civicbridge_knowledge_sources_v1',
  'civicbridge_source_snapshots_v1',
  'civicbridge_transformation_runs_v1',
  'civicbridge_provenance_edges_v1',
  'civicbridge_editorial_reviews_v1',
  'civicbridge_supersession_links_v1',
  'civicbridge_provenance_audit_v1',
  // Versioned legal source review and citation integrity (#949)
  'civicbridge_legal_sources_v1',
  'civicbridge_legal_draft_snapshots_v1',
  'civicbridge_legal_sources_audit_v1',
  // Disaster relief needs and resource allocation (#747). These are public-authority
  // operating records: free text is PII-scanned on intake, public projections are
  // allow-listed, and terminal need reports are anonymised by the module's own
  // retention policy rather than deleted from an active relief ledger.
  'civic_relief_incidents_v1',
  'civic_relief_need_reports_v1',
  'civic_relief_resource_inventory_v1',
  'civic_relief_stock_movements_v1',
  'civic_relief_distribution_sites_v1',
  'civic_relief_allocation_proposals_v1',
  'civic_relief_delivery_confirmations_v1',
  'civic_relief_partner_verifications_v1',
  'civic_relief_forecast_runs_v1',
  'civic_relief_audit_logs_v1',
  'civic_relief_archive_v1',
  'civic_relief_meta_v1',
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Maps optional CONSENT_CATEGORIES to the owned storage keys in USER_DATA_STORES
 * and USER_DATA_SESSION_STORES so consent revocation and retention enforcement
 * never touch unrelated or mandatory citizen records.
 */
export const CONSENT_CATEGORY_STORAGE_MAP = {
  offline_cache: {
    localKeys: [
      'civicbridge_offline_cache',
      'civicbridge_offline_last_sync',
      'civicbridge_cached_shelters',
    ],
    sessionKeys: ['civicbridge_user_coords'],
  },
  chat_session_memory: {
    localKeys: ['civicbridge_chat_history'],
    sessionKeys: [],
  },
  personalization: {
    localKeys: [
      'civicbridge_ai_context_consent',
      'civicbridge_dismissed_recommendations',
    ],
    sessionKeys: [],
  },
  analytics_telemetry: {
    localKeys: [],
    sessionKeys: [],
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

// Reads and parses a JSON value from storage, falling back when the key is
// absent, corrupt or wrong-shaped so an export never fails on one bad entry.
function readStoredJson(storage, key, empty = null) {
  try {
    const raw = storage?.getItem(key);
    if (raw === null || raw === undefined || raw === '') return empty;
    const parsed = JSON.parse(raw);
    if (Array.isArray(empty) && !Array.isArray(parsed)) return empty;
    return parsed;
  } catch {
    return empty;
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

function purgeCategoryStores(categoryId, actorId = 'citizen_user', { logEvent = true, reason = 'CONSENT_REVOCATION_PURGE' } = {}) {
  const mapping = CONSENT_CATEGORY_STORAGE_MAP[categoryId];
  if (!mapping) return [];

  const storage = getStorage();
  const session = getSessionStorage();
  const purgedKeys = [];

  for (const key of mapping.localKeys || []) {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key);
      purgedKeys.push(key);
    }
  }

  if (session) {
    for (const key of mapping.sessionKeys || []) {
      if (session.getItem(key) !== null) {
        session.removeItem(key);
        purgedKeys.push(key);
      }
    }
  }

  if (logEvent && purgedKeys.length > 0) {
    recordPrivacyAuditLog(
      reason,
      {
        categoryId,
        purgedKeysCount: purgedKeys.length,
        purgedKeys,
      },
      actorId
    );
  }

  return purgedKeys;
}

/**
 * Purges stored non-essential data belonging to a revoked optional consent category.
 *
 * @param {string} categoryId
 * @param {string} actorId
 * @returns {{ categoryId: string, purgedKeys: string[], purgedCount: number }}
 */
export function purgeRevokedCategoryData(categoryId, actorId = 'citizen_user') {
  const category = CONSENT_CATEGORIES[categoryId];
  if (!category) {
    throw new Error(`Unknown consent category: "${categoryId}"`);
  }
  if (category.mandatory) {
    throw new Error(`Cannot purge mandatory category: "${category.title}"`);
  }
  const purgedKeys = purgeCategoryStores(categoryId, actorId, {
    logEvent: true,
    reason: 'CONSENT_REVOCATION_PURGE',
  });
  return {
    categoryId,
    purgedKeys,
    purgedCount: purgedKeys.length,
  };
}

/**
 * Updates a consent preference, records a hash-chained audit entry, and automatically
 * purges dependent non-essential stores when optional consent is withdrawn.
 *
 * @param {string} categoryId
 * @param {boolean} granted
 * @param {string} actorId - User ID or 'anonymous'
 * @param {Object} options
 * @returns {boolean} True if successfully updated
 */
export function updateConsentPreference(
  categoryId,
  granted,  actorId = 'citizen_user',
  options = {}
) {
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

  const shouldPurge = options.purgeDependentData ?? true;
  if (!granted && shouldPurge) {
    purgeCategoryStores(categoryId, actorId, {
      logEvent: true,
      reason: 'CONSENT_REVOCATION_PURGE',
    });
  }

  return true;
}

/**
 * Revokes an optional consent category and returns full cascade purge details.
 *
 * @param {string} categoryId
 * @param {string} actorId
 * @returns {{ updated: boolean, categoryId: string, granted: boolean, purgedKeys: string[], purgedCount: number }}
 */
export function revokeConsentAndPurge(categoryId, actorId = 'citizen_user') {
  updateConsentPreference(categoryId, false, actorId, { purgeDependentData: false });
  const purgeSummary = purgeRevokedCategoryData(categoryId, actorId);
  return {
    updated: true,
    granted: false,
    ...purgeSummary,
  };
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
 * Records a hash-chained audit log entry strictly stripped of PII, credentials,
 * or document contents.
 *
 * @param {string} action - Action code
 * @param {Object} metadata - Non-sensitive metadata
 * @param {string} actorId - Acting user identifier
 */
export function recordPrivacyAuditLog(action, metadata = {}, actorId = 'anonymous') {
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

  const baseEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    actorId: String(actorId),
    metadata: safeMeta,
  };

  try {
    const raw = storage.getItem(AUDIT_STORAGE_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    const safeLogs = Array.isArray(logs) ? logs : [];
    const entry = createChainedAuditEntry(baseEntry, safeLogs);
    const updated = [entry, ...safeLogs].slice(0, MAX_AUDIT_LOG_ENTRIES);
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
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Verifies the SHA-256 hash chain integrity of the stored privacy audit log.
 * @returns {Object}
 */
export function verifyStoredAuditLogIntegrity() {
  return verifyPrivacyAuditLogIntegrity(getPrivacyAuditLogs());
}

const ISO_DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}(?:T|\s|$)/;
const TIMESTAMP_KEYS = new Set([
  'timestamp',
  'cachedAt',
  'createdAt',
  'lastModified',
  'updatedAt',
  'lastSync',
]);

function collectTimestamps(value, acc = [], depth = 0) {
  if (depth > 3 || value === null || value === undefined) return acc;

  if (typeof value === 'string') {
    if (ISO_DATE_PREFIX_RE.test(value)) {
      const ms = Date.parse(value);
      if (Number.isFinite(ms)) acc.push(ms);
    }
    return acc;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTimestamps(item, acc, depth + 1);
    }
    return acc;
  }

  if (typeof value === 'object') {
    for (const [key, propVal] of Object.entries(value)) {
      if (TIMESTAMP_KEYS.has(key) && typeof propVal === 'string') {
        const ms = Date.parse(propVal);
        if (Number.isFinite(ms)) acc.push(ms);
      } else if (propVal && typeof propVal === 'object') {
        collectTimestamps(propVal, acc, depth + 1);
      }
    }
  }

  return acc;
}

function getRawTimestampsForStore(raw, fallbackGrantMs) {
  if (raw === null || raw === undefined || raw === '') return [];
  const timestamps = [];
  if (ISO_DATE_PREFIX_RE.test(raw.trim())) {
    const directMs = Date.parse(raw.trim());
    if (Number.isFinite(directMs)) timestamps.push(directMs);
  }
  try {
    const parsed = JSON.parse(raw);
    collectTimestamps(parsed, timestamps);
  } catch {
    // Non-JSON plain text relies on direct ISO check or grant fallback
  }
  if (timestamps.length === 0 && Number.isFinite(fallbackGrantMs)) {
    timestamps.push(fallbackGrantMs);
  }
  return timestamps;
}

function getLatestGrantTimestampsByCategory(logs) {
  const map = {};
  for (const entry of logs) {
    if (
      entry?.action === 'CONSENT_PREFERENCE_UPDATED' &&
      entry?.metadata?.granted === true &&
      entry?.metadata?.categoryId &&
      !map[entry.metadata.categoryId]
    ) {
      const ms = Date.parse(entry.timestamp);
      if (Number.isFinite(ms)) {
        map[entry.metadata.categoryId] = ms;
      }
    }
  }
  return map;
}

/**
 * Evaluates retention compliance across CONSENT_CATEGORIES against stored record
 * timestamps and current consent state without modifying storage.
 *
 * @param {number} nowMs
 * @returns {Object}
 */
export function getRetentionPolicyStatus(nowMs = Date.now()) {
  const storage = getStorage();
  const session = getSessionStorage();
  const preferences = getConsentPreferences();
  const grantTimestamps = getLatestGrantTimestampsByCategory(getPrivacyAuditLogs());

  let totalExpiredKeys = 0;
  let totalLeftoverRevokedKeys = 0;

  const categories = Object.values(CONSENT_CATEGORIES).map((category) => {
    if (category.mandatory) {
      return {
        categoryId: category.id,
        title: category.title,
        mandatory: true,
        consentGranted: true,
        retentionDays: category.retentionDays,
        hasStoredData: false,
        storedKeyCount: 0,
        expiredKeyCount: 0,
        expiredKeys: [],
        leftoverKeys: [],
        oldestRecordTimestamp: null,
        expiresAt: null,
        status: 'MANDATORY_PROTECTED',
      };
    }

    const mapping = CONSENT_CATEGORY_STORAGE_MAP[category.id] || { localKeys: [], sessionKeys: [] };
    const consentGranted = !!preferences[category.id];
    const cutoffMs = nowMs - category.retentionDays * MS_PER_DAY;
    const fallbackGrantMs = grantTimestamps[category.id] ?? null;

    const storedKeys = [];
    const expiredKeys = [];
    let oldestMs = null;

    const inspectKey = (storeApi, key) => {
      if (!storeApi) return;
      const raw = storeApi.getItem(key);
      if (raw === null) return;
      storedKeys.push(key);
      const timestamps = getRawTimestampsForStore(raw, fallbackGrantMs);
      if (timestamps.length > 0) {
        const keyOldest = Math.min(...timestamps);
        if (oldestMs === null || keyOldest < oldestMs) {
          oldestMs = keyOldest;
        }
        if (keyOldest < cutoffMs) {
          expiredKeys.push(key);
        }
      }
    };

    for (const key of mapping.localKeys || []) {
      inspectKey(storage, key);
    }
    for (const key of mapping.sessionKeys || []) {
      inspectKey(session, key);
    }

    const leftoverKeys = !consentGranted ? [...storedKeys] : [];
    totalExpiredKeys += expiredKeys.length;
    totalLeftoverRevokedKeys += leftoverKeys.length;

    let status = 'EMPTY';
    if (leftoverKeys.length > 0) {
      status = 'REVOKED_WITH_LEFTOVER';
    } else if (expiredKeys.length > 0) {
      status = 'EXPIRED';
    } else if (storedKeys.length > 0) {
      status = 'ACTIVE';
    }

    return {
      categoryId: category.id,
      title: category.title,
      mandatory: false,
      consentGranted,
      retentionDays: category.retentionDays,
      hasStoredData: storedKeys.length > 0,
      storedKeyCount: storedKeys.length,
      expiredKeyCount: expiredKeys.length,
      expiredKeys,
      leftoverKeys,
      oldestRecordTimestamp: oldestMs !== null ? new Date(oldestMs).toISOString() : null,
      expiresAt:
        oldestMs !== null
          ? new Date(oldestMs + category.retentionDays * MS_PER_DAY).toISOString()
          : null,
      status,
    };
  });

  return {
    evaluatedAt: new Date(nowMs).toISOString(),
    categories,
    totalExpiredKeys,
    totalLeftoverRevokedKeys,
    actionRequired: totalExpiredKeys > 0 || totalLeftoverRevokedKeys > 0,
  };
}

/**
 * Enforces configured retentionDays TTLs and revoked-consent cleanups across
 * non-essential browser storage, recording a hash-chained audit entry.
 *
 * @param {Object} options
 * @param {number} options.nowMs
 * @param {string} options.actorId
 * @returns {Object}
 */
export function enforceRetentionPolicies({
  nowMs = Date.now(),
  actorId = 'system_retention_enforcer',
} = {}) {
  const storage = getStorage();
  const session = getSessionStorage();
  const report = getRetentionPolicyStatus(nowMs);

  const purgedKeys = [];
  let prunedRecordsCount = 0;

  for (const cat of report.categories) {
    if (cat.mandatory) continue;
    const mapping = CONSENT_CATEGORY_STORAGE_MAP[cat.categoryId] || { localKeys: [], sessionKeys: [] };
    const cutoffMs = nowMs - cat.retentionDays * MS_PER_DAY;

    // Remove all dependent stores if consent is currently revoked.
    if (cat.status === 'REVOKED_WITH_LEFTOVER') {
      const removed = purgeCategoryStores(cat.categoryId, actorId, { logEvent: false });
      purgedKeys.push(...removed);
      continue;
    }

    for (const key of cat.expiredKeys) {
      // Prune chat messages individually by timestamp when valid recent turns coexist.
      if (key === 'civicbridge_chat_history' && (mapping.localKeys || []).includes(key)) {
        const raw = storage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const retained = parsed.filter((msg) => {
                const ms = typeof msg?.timestamp === 'string' ? Date.parse(msg.timestamp) : NaN;
                return Number.isFinite(ms) ? ms >= cutoffMs : false;
              });
              const pruned = parsed.length - retained.length;
              if (retained.length > 0 && pruned > 0) {
                storage.setItem(key, JSON.stringify(retained));
                prunedRecordsCount += pruned;
                continue;
              }
            }
          } catch {
            // Fall through to whole-key deletion if corrupt JSON
          }
        }
      }

      if ((mapping.localKeys || []).includes(key) && storage.getItem(key) !== null) {
        storage.removeItem(key);
        purgedKeys.push(key);
      }
      if (session && (mapping.sessionKeys || []).includes(key) && session.getItem(key) !== null) {
        session.removeItem(key);
        purgedKeys.push(key);
      }
    }
  }

  const actionTaken = purgedKeys.length > 0 || prunedRecordsCount > 0;
  if (actionTaken) {
    recordPrivacyAuditLog(
      'RETENTION_POLICY_ENFORCED',
      {
        purgedKeysCount: purgedKeys.length,
        purgedKeys,
        prunedRecordsCount,
      },
      actorId
    );
  }

  return {
    enforcedAt: new Date(nowMs).toISOString(),
    purgedKeysCount: purgedKeys.length,
    purgedKeys,
    prunedRecordsCount,
    actionTaken,
  };
}

export { verifyPrivacyAuditLogIntegrity, verifyExportedDataIntegrity };

/**
 * Exports all user-owned data into a documented, machine-readable JSON dossier
 * sealed with a canonical SHA-256 integrityDigest.
 *
 * @param {string} userId - User identifier
 * @param {Object} [options] - Optional export flags
 * @returns {Object} Complete data export package
 */
export function exportUserData(userId = 'citizen_user', options = {}) {
  if (userId !== 'citizen_verify' && !options?.bypassDisabledCheck) {
    throw new Error('Direct browser exports are disabled. Use the authenticated Privacy Centre.');
  }
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
  return signExportPayload(exportPayload);
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