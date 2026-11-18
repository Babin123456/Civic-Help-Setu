# Data sources and retention

What Civic-Help-Setu keeps about a citizen, where it keeps it, for how long, and how to delete it.
Issue #223.

## The short version

- There is no backend and no database. Citizen records live in this browser only (`localStorage`, plus one `sessionStorage` key).
- Nothing in the code expires on its own. A record stays until the person deletes it in the app, uses **Clear my data**, or the browser's own site data is cleared.
- Records are stored as plain JSON. They are not encrypted. Anyone who can open the browser profile on the device can read them.
- The only third party that holds account data is the sign-in provider, Clerk. The app has no remote deletion for it. See [Remote data](#remote-data).

## Where to delete

- Privacy page (`/privacy`) and Profile page (`/profile`) both have a **Clear my data** section. Pick categories (or everything), confirm, and the result is listed per category, including anything that failed.
- Individual deletes also exist next to the data (remove a document in the Vault, remove a saved guide, reset the assistant chat). Tracked applications had no delete button before this change.
- The Privacy Center dialog (Privacy page, Manage Consent Preferences) still has the older all-at-once "Full Account Purge". It uses the same list of keys.

## One list of keys

The list of keys the app owns is in one module: `src/services/privacyConsentService.js`
(`USER_DATA_STORES`, `USER_DATA_PREFIX_STORES`, `USER_DATA_SESSION_STORES`, `RETAINED_STORAGE_KEYS`).
This document, the **Clear my data** screen (`src/services/clearMyDataService.js`), the data export and the tests all read that list.
`src/services/clearMyDataService.test.js` scans `src/` and fails if a service starts writing a key that is in neither the owned list nor the retained list, and fails if a key is missing from this file.
Only these keys are ever removed. The code never calls `localStorage.clear()` and refuses any key that is not on the list.

## Fields cut down before they are stored (#212)

Anything in `localStorage` can be read by the next person on the device and by a script running on the page, so identity and contact numbers are shortened before they are written. The code is in `src/services/dataMinimization.js`.

| Field | Key | What is stored | Why the full value is not needed |
|---|---|---|---|
| Vault document number | `civicbridge_vault_docs` | The last 4 letters or digits, as `XXXX 1234`. Numbers of 4 characters or fewer are kept as typed | The vault only shows and searches the number so a person can tell documents apart. The document file is never stored |
| Appointment mobile number | `civicbridge_office_tokens` | The last 4 digits, as `XXXXXX3210` | Nothing reads it back. The calendar link and visit pack only use the office, date, slot and token |

Records saved before this change are shortened the first time they are read. Imported vault backups are shortened on import, and the backup export is built from the stored (already shortened) data.

Decisions kept on purpose:

- Applicant name, tracked reference IDs and free-text notes stay, because the tracking and vault screens are not usable without them. They are listed in the threat model as high sensitivity. The notice below tells people this.
- The vault document `notes` (300 characters, free text) is not scanned. People can still type an identity number there.
- Document file contents were never stored (only name, size and type).

Shared-device notice: the Vault and Track pages show a short notice that records are saved in this browser, that other people using the device may see them, and a link to **Clear my data**. The Clear my data section only removes the keys in the owned list, never other site data.

## Data the "Clear my data" screen deletes

Retention for all of these: until deleted by the person (no automatic expiry).

| Key | Written by | What it holds | Category |
|---|---|---|---|
| `civicbridge_senior_tribunal_petitions` | `seniorCitizenTribunalStorage.js` | Saved senior citizen maintenance and Section 23 property revocation tribunal petitions | Drafts and in-progress work |
| `civicbridge_rera_complaints` | `reraDisputeStorage.js` | Saved RERA delayed possession, defect liability and Form M/N dispute complaints | Drafts and in-progress work |
| `civicbridge_abc_conflict_records` | `strayAnimalStorage.js` | Saved municipal stray animal conflict, ABC audits and Rabies PEP emergency records | Drafts and in-progress work |
| `civicbridge_noise_pollution_logs` | `noisePollutionStorage.js` | Saved ambient noise pollution decibel logs, curfew records, and SDM complaint notices | Drafts and in-progress work |
| `civicbridge_solid_waste_audits` | `solidWasteStorage.js` | Saved municipal solid waste dumping, bulk waste generator audits and NGT notices | Drafts and in-progress work |
| `civicbridge_patient_grievance_records` | `clinicalEstablishmentStorage.js` | Saved clinical establishment emergency refusal, standard rate overbilling audits, and DRA complaints with SHA-256 seals | Drafts and in-progress work |
| `civicbridge_electricity_cgrf_vault` | `electricityConsumerStorage.js` | Saved electricity consumer outage compensation claims, Section 56(1) disconnection audits, meter test reports and CGRF petitions with SHA-256 seals | Drafts and in-progress work |
| `civicbridge_accessibility_audit_vault` | `accessibilityAuditStorage.js` | Structured accessibility screening results | Drafts and in-progress work |
| `civicbridge_dark_patterns_vault` | `darkPatternsStorage.js` | Scrubbed dark pattern evidence and pricing records | Drafts and in-progress work |
| `civicbridge_vendor_rights_vault` | `streetVendorStorage.js` | Saved street vendor Section 3(3) eviction immunity audits, Section 19 goods seizure inventories, and TVC grievance records | Drafts and in-progress work |
| `civicbridge_evidence_dossiers_v1` | `evidenceDossierStorage.js` | Saved citizen evidence manifests, file SHA-256 digests, and verification dossiers with storage seals | Drafts and in-progress work |
| `civicbridge_electricity_cgrf_vault` | `electricityConsumerStorage.js` | Saved electricity consumer outage compensation claims, Section 56(1) disconnection audits, meter test reports and CGRF petitions with SHA-256 seals | Drafts and in-progress work |
| `civicbridge_rte_grievance_vault` | `rteAdmissionStorage.js` | Saved RTE Section 12(1)(c) quota eligibility, screening violation audits, capitation penalties, and Section 32 petitions with SHA-256 seals | Drafts and in-progress work |
| `civicbridge_legal_sources_v1` | `legalSourceStorage.js` | Versioned statutory source citations, provisions, and SemVer lifecycle states | Drafts and in-progress work |
| `civicbridge_legal_draft_snapshots_v1` | `legalSourceStorage.js` | Immutable historical citation snapshots sealed in citizen drafting templates | Drafts and in-progress work |
| `civicbridge_legal_sources_audit_v1` | `legalSourceStorage.js` | Append-only audit trail for statutory reviews, publications, and rollbacks | Drafts and in-progress work |
| `civicbridge_checklists` | `checklistStorage.js` | Which checklist items are ticked, per checklist or application id | Drafts and in-progress work |
| `civicbridge_preparation_plans_v1` | `applicationPreparationPlanService.js` | Saved application preparation plan and customized checklist progress | Drafts and in-progress work |
| `civic_journey_progress_<journeyId>` (one per journey) | `journeyDependencyEngine.js` | Completed tasks of a journey plan | Drafts and in-progress work |
| `civic_accessibility_visit_plans` | `accessibilityPlannerService.js` | Optional visit preferences saved only after explicit consent; kept on this device, not cloud-synced or used in analytics | Drafts and in-progress work |
| `civic_grievance_evidence_drafts` | `grievanceEvidenceService.js` | Private user-controlled grievance preparation drafts and timelines | Drafts and in-progress work |
| `civic_grievance_drafts_v1` | `civicGrievanceDraftingService.js` | User-controlled formal civic grievance drafts and facts | Drafts and in-progress work |
| `civic_life_event_journeys` | `lifeEventNavigatorService.js` | Saved life-event roadmap progress, hidden tasks and regional selections | Drafts and in-progress work |
| `civicbridge_eligibility_assessments` | `assessmentStorage.js` | Answers and results of eligibility checks | Drafts and in-progress work |
| `civicbridge_applicant_profiles_v1` | `applicantProfileService.js` | Household and family member applicant profiles for scoped assessments | Drafts and in-progress work |
| `civicbridge_applications` | `trackingService.js` | Applications the person tracks: reference id, service, status, stages | Tracking records |
| `civicbridge_office_tokens` | `locationService.js` | Office visit tokens and appointments | Tracking records |
| `civic_grievance_tickets` | `grievanceService.js` | Grievance tickets raised from the app | Tracking records |
| `civicbridge_reminders` | `reminderNotificationService.js` | Renewal, submission and document expiry reminders | Tracking records |
| `civicbridge_notification_settings` | `reminderNotificationService.js` | Reminder lead time settings | Tracking records |
| `civicbridge_email_verification_pending` | `emailVerificationService.js` | Pending email verification tokens (single-use, 24h expiry) | Account security |
| `civicbridge_verified_emails` | `emailVerificationService.js` | List of verified email addresses | Account security |
| `civicbridge_email_resend_attempts` | `emailVerificationService.js` | Rate limiting state for resend attempts | Account security |
| `civicbridge_notification_preferences` | `notificationPreferenceService.js` | User email notification preferences (optional categories) | Account security |
| `civicbridge_newsletter_subscriptions` | `newsletterSubscriptionService.js` | Monthly civic digest subscription preferences, topics, geography, and consent | Tracking records |
| `civicbridge_sent_digests` | `newsletterSubscriptionService.js` | Log of which newsletter digests have been sent to avoid duplicates | Tracking records |
| `civicbridge_newsletter_delivery_failures` | `newsletterSubscriptionService.js` | Email delivery failure logs for newsletter digests (no recipient lists exposed) | Tracking records |
| `civicbridge_saved_rich` | `savedStorage.js` | Saved guides with folder and note | Saved items |
| `civicbridge_saved` | `savedStorage.js`, `ServiceDetails.jsx` | Older list of saved guide ids, kept in step with the one above | Saved items |
| `civic_compared_services` | `comparisonService.js` | Services picked for comparison | Saved items |
| `civic_service_fee_preferences` | `feeTransparencyService.js` | Saved citizen fee calculator tier and optional add-on selections | Saved items |
| `civicbridge_vault_docs` | `vaultStorage.js` | Document vault entries: type, number, issuer, dates, notes, file name and size. File bytes are not stored | Document vault |
| `civicbridge_vault_pin` | `vaultStorage.js` | Reserved for a vault PIN, nothing writes it today | Document vault |
| `civicbridge_chat_history` | `chatStorage.js` | Assistant conversation (trimmed to the latest messages by `trimHistory`) | Assistant history |
| `civicbridge_ai_context_consent` | `ai/contextRecommender.js` | Whether saved items may be used as assistant context | Assistant history |
| `civic_service_reviews` | `reviewStorage.js` | Reviews written on this device (seeded with sample reviews on first read) | Reviews, votes and reports |
| `civicbridge_faq_votes` | `faqService.js` | Which FAQ answers were voted helpful | Reviews, votes and reports |
| `civic_glossary_suggestions` | `civicGlossaryService.js` | User-submitted term clarification suggestions for editorial review | Reviews, votes and reports |
| `civicbridge_community_audits` | `communityAuditService.js` | Audit reports and votes (seeded with sample reports on first read) | Reviews, votes and reports |
| `civicbridge_office_accessibility_audits` | `accessibilityMapService.js` | Citizen-submitted accessibility audits and venue feedback | Reviews, votes and reports |
| `civicbridge_barrier_reports` | `barrierReportService.js` | Citizen-reported accessibility and physical service delivery barriers | Reviews, votes and reports |
| `civicbridge_bottleneck_feedback_v1` | `bottleneckFeedbackService.js` | Citizen bottleneck and delay feedback submissions | Reviews, votes and reports |
| `civicbridge_checklist` | `dataPortabilityService.js` | Saved checklist items exported/imported across devices | Drafts and in-progress work |
| `civicbridge_track_applications` | `dataPortabilityService.js` | Application tracking records staged for import or export | Tracking records |
| `civicbridge_form_drafts` | `dataPortabilityService.js` | Form drafts prepared by citizen | Drafts and in-progress work |
| `civicbridge_citizen_drafts_v1` | `citizenDraftSyncEngine.js` | Citizen draft workflows (checklists, applications, saved notes) | Drafts and in-progress work |
| `civicbridge_offline_operations_v1` | `citizenDraftSyncEngine.js` | Local queue of sync mutations staged offline | Drafts and in-progress work |
| `civicbridge_sync_sessions_v1` | `citizenDraftSyncEngine.js` | Offline synchronization session telemetry and logs | Drafts and in-progress work |
| `civicbridge_record_revisions_v1` | `citizenDraftSyncEngine.js` | Local revision snapshot cache for 3-way conflict diffing | Drafts and in-progress work |
| `civicbridge_conflict_records_v1` | `citizenDraftSyncEngine.js` | Local conflict records waiting for user merge resolution | Drafts and in-progress work |
| `civicbridge_device_cursors_v1` | `citizenDraftSyncEngine.js` | Device sync cursors and high-water revision marks | Drafts and in-progress work |
| `civicbridge_tombstones_v1` | `citizenDraftSyncEngine.js` | Deletion tombstones to prevent resurrection of deleted drafts | Drafts and in-progress work |
| `civicbridge_continuity_plans_v1` | `continuityPlannerService.js` | Public service continuity plans, recovery objectives and contact trees | Drafts and in-progress work |
| `civicbridge_incident_scenarios_v1` | `continuityPlannerService.js` | Tabletop incident drill scenarios and timeline inject templates | Drafts and in-progress work |
| `civicbridge_service_dependencies_v1` | `continuityPlannerService.js` | Municipal service dependency mappings and manual fallback procedures | Drafts and in-progress work |
| `civicbridge_exercise_runs_v1` | `continuityPlannerService.js` | Tabletop drill exercise logs, decisions, response gaps and after-action reports | Reviews, votes and reports |
| `civicbridge_action_items_v1` | `continuityPlannerService.js` | Corrective action items stemming from continuity drill gaps | Tracking records |
| `civicbridge_continuity_audit_logs_v1` | `continuityAuditService.js` | Append-only audit logs of plan approvals, drill closures and override decisions | Reviews, votes and reports |
| `civicbridge_continuity_recommendations_v1` | `continuityPlannerService.js` | Human-in-the-loop decision records on automated continuity recommendations | Drafts and in-progress work |
| `civicbridge_tree_report_attachments_v1` | `treeInventoryService.js` | Validated citizen-report images and metadata (no raw personal identifiers) | Reviews, votes and reports |
| `civicbridge_tree_citizen_reports_v1` | `treeInventoryService.js` | Citizen tree observations, tracking codes, triage and review state | Reviews, votes and reports |
| `civicbridge_tree_reports_v1` | `treeInventoryMigrations.js` | Legacy citizen tree reports read once during migration | Reviews, votes and reports |
| `civicbridge_tree_reporter_key` | `TreeHealthInventory.jsx` | Random local key used only to rate-limit and deduplicate citizen tree reports | Reviews, votes and reports |
| `civicbridge_civic_works_reports_v1` | `civicWorksBoardService.js` | Ward civic works reports and moderation state | Reviews, votes and reports |
| `civicbridge_office_comparison_reports_v1` | `officeComparisonReportService.js` | Outdated office-record reports queued on this device when the review endpoint is unavailable: office id, reason, short note and optional official source. No identity or contact fields | Reviews, votes and reports |
| `civicbridge_civic_works_clusters_v1` | `civicWorksBoardService.js` | Clustered duplicate ward reports | Reviews, votes and reports |
| `civicbridge_civic_works_rate_limit_v1` | `civicWorksBoardService.js` | Ward report submission rate limit tracking | Reviews, votes and reports |
| `civicbridge_hazard_reports_v1` | `roadSafetyBlackspotService.js` | Citizen-reported road hazards and defects (sanitized, PII stripped) | Reviews, votes and reports |
| `civicbridge_road_segments_v1` | `roadSafetyBlackspotService.js` | Monitored road segment geometries, classifications, and speed limits | Cached public reference data |
| `civicbridge_crash_aggregates_v1` | `roadSafetyBlackspotService.js` | Aggregated government crash figures and exposure denominators | Cached public reference data |
| `civicbridge_road_features_v1` | `roadSafetyBlackspotService.js` | Road physical features (lighting, pedestrian crossings, calming devices) | Cached public reference data |
| `civicbridge_risk_runs_v1` | `roadSafetyBlackspotService.js` | Automated risk run calculation parameters, timestamps, and model version | Audit and execution records |
| `civicbridge_review_cases_v1` | `roadSafetyBlackspotService.js` | Blackspot review cases, officer inspection findings, and transition history | Operational review cases |
| `civicbridge_intervention_records_v1` | `roadSafetyBlackspotService.js` | Planned and executed engineering countermeasures, budgets, and outcomes | Operational countermeasure records |
| `civicbridge_road_safety_rate_limit_v1` | `roadSafetyBlackspotService.js` | Rolling submission rate limit timestamps for hazard reports (15m window) | Technical anti-abuse rate limits |
| `civicbridge_road_safety_audit_logs_v1` | `roadSafetyBlackspotService.js` | Append-only audit events for municipal blackspot case transitions and interventions | Audit and execution records |
| `civicbridge_journey_handoffs_v1` | `journeyHandoffService.js` | Journey handoff bundles and shared checklist links | Drafts and in-progress work |
| `civicbridge_readiness_scorecards` | `readinessScorecardService.js` | Citizen application readiness scores and missing document audits | Drafts and in-progress work |
| `civicbridge_offline_cache` | `offlineCacheService.js` | Copies of saved guides and application stages for offline use | Offline copies and location |
| `civicbridge_offline_last_sync` | `offlineCacheService.js` | Time of the last offline sync | Offline copies and location |
| `civicbridge_cached_shelters` | `disasterReliefService.js` | Copy of the public relief shelter list (no personal data) | Offline copies and location |
| `civicbridge_user_coords` (sessionStorage) | `locationService.js` | Last location the browser gave the app, for the nearby offices page. Gone when the tab closes | Offline copies and location |
| `civicbridge_office_comparison_draft_v1` (sessionStorage) | `officeComparisonDraft.js` | Service, state, district, locality, contact channel, wheelchair filter, distance radius, view mode and up to three selected office IDs for the office comparison workspace. No names, identity numbers or contact details. Gone when the tab closes | Drafts and in-progress work |
| `civic_fire_noc_checklist_dossier` | `fireNocService.js` | Fire safety and NOC application compliance dossiers | Drafts and in-progress work |
| `civicbridge_civic_works_reporter_id` | `civicWorksBoardService.js` | Anonymous device-scoped reporter identifier | Tracking records |
| `civic_admin_operations_digest_config` | `adminDigestService.js` | Administrative operations digest frequency configuration | Tracking records |
| `civic_admin_operations_digest_logs` | `adminDigestService.js` | Operations notification and delivery log receipts | Tracking records |
| `civic_application_lifecycle_email_logs` | `applicationLifecycleEmailService.js` | Status change transactional email history | Tracking records |
| `civic_application_notification_preferences` | `notificationPreferenceService.js` | Citizen notification preference options | Account security |
| `civic_service_checklist_email_logs` | `checklistEmailService.js` | Checklist export email logs | Tracking records |
| `civic_application_deadline_reminder_configs` | `deadlineReminderService.js` | Citizen application deadline reminder schedules | Tracking records |
| `civic_application_deadline_reminder_logs` | `deadlineReminderService.js` | Delivery receipts for statutory deadline warnings | Tracking records |
| `civic_privacy_safe_feedback_store` | `feedbackService.js` | De-identified citizen experience feedback | Reviews, votes and reports |
| `civic_help_setu_contributors_cache` | `contributorService.js` | Cached open source contributor metadata | Offline copies and location |
| `civic_rental_transition_checklists_v1` | `rentalTransitionService.js` | Rental move-in and handover verification checklists | Drafts and in-progress work |
| `civic_tender_readiness_checklists_v1` | `tenderReadinessService.js` | Public procurement eligibility checklists and bids | Drafts and in-progress work |
| `civicbridge_transactional_delivery_logs` | `transactionalEmailService.js` | Outgoing delivery transaction IDs | Tracking records |
| `civicbridge_watertanker_requests` | `waterTankerService.js` | Municipal emergency water tanker delivery requests | Tracking records |
| `civic_address_change_planner_v1` | `addressChangeStorage.js` | Moving-home address change checklists and task statuses | Drafts and in-progress work |
| `civic_library_checklists_v1` | `libraryChecklistStorage.js` | Library membership application checklists | Drafts and in-progress work |
| `civicbridge_library_checklist_change` | `libraryChecklistStorage.js` | Local storage update event channel for library checklists | Technical anti-abuse rate limits |
| `civic_recovery_checklists` | `lostDocumentRecoveryNavigatorService.js` | Lost government document recovery checklists | Drafts and in-progress work |
| `civicbridge_small_business_establishments_v1` | `smallBusinessLicenceService.js` | Small business establishments registry and licence profiles | Drafts and in-progress work |
| `civicbridge_business_checklist_progress_v1` | `smallBusinessLicenceService.js` | Small business renewal and closure checklist progress | Drafts and in-progress work |
| `civic_surveys_v1` | `surveyStorage.js` | Public survey definitions and diagnostic schema | Drafts and in-progress work |
| `civic_survey_responses_v1` | `surveyStorage.js` | Anonymized citizen survey responses and sample weights | Reviews, votes and reports |
| `civic_survey_consent_events_v1` | `surveyStorage.js` | Audit records for survey participation consent | Audit and execution records |
| `civic_survey_audit_events_v1` | `surveyStorage.js` | Append-only audit events for civic surveys | Audit and execution records |

The offline copies only duplicate tracking records and saved items, so clearing either of those clears them too. The result list says so.

After clearing, the sample reviews, sample audit reports and the sample vault documents are put back the next time those pages are opened. They are demo content, not the person's data.

## Data the "Clear my data" screen keeps on purpose

| Key | What it holds | Why it stays |
|---|---|---|
| `civicbridge_theme`, `civicbridge_lang`, `civicbridge_plain_lang`, `civicbridge_a11y_prefs`, `civicbridge_focus_mode`, `civicbridge_reader_preferences`, `civicbridge_active_applicant_profile_id_v1` | Theme, language, plain language, accessibility, and active applicant profile selection settings | Display preferences, not records. Removing them would reset the page the person is looking at |
| `civicbridge_demo_user` | Demo sign-in session (only when Clerk is not configured) | Signing out is its own action |
| `civicbridge_consent_preferences` | Privacy choices | Reset by the Full Account Purge only |
| `civicbridge_privacy_audit_log` | Last 100 privacy events (consent change, export, clear). It holds ids, category names and counts, never record contents | Receipt that a deletion happened |
| `civicbridge_error_reports` | Outdated-information reports sent from a service page, and the admin review queue | Shared review queue |
| `civicbridge_eligibility_test_cases_v1` | Fictional test cases a maintainer saved in the admin eligibility test bench. Holds made-up answers only, never a citizen's | Admin portal data |
| `civicbridge_service_drafts_v1` | Unpublished drafts of service guide edits, private to the admin's browser. Hold guide content only, never a citizen's data | Admin portal data |
| `civicbridge_catalogue_snapshots_v1` | The last 5 backups of the saved service catalogue, taken before a data migration or rollback. Guide content only, never a citizen's data | Admin portal data |
| `civicbridge_reader_preferences` | User reading mode preferences (font size, contrast, spacing) | Display preference |
| `civicbridge_catalogue_enrichment_queue_v1` | Proposed AI service enrichments pending admin review | Admin review queue |
| `civicbridge_dismissed_recommendations`, `civicbridge_catalogue_completeness_dismissals` | Dismissed recommendation IDs and admin catalogue completeness quality check dismissals | UI dismissals and admin review state |
| `civicbridge_custom_services`, `civicbridge_audit_logs`, `civicbridge_rbac_users`, `civicbridge_service_submissions` | Admin portal data | Not citizen data |
| `civicbridge_barrier_audit_logs`, `civicbridge_freshness_trust_reviews_v1`, `civicbridge_link_health_v1`, `civicbridge_public_notices_digest_v1`, `civicbridge_source_conflicts`, `civicbridge_conflict_audit_logs`, `civicbridge_duplicate_review_states` | Admin barrier moderation, freshness reviews, official link check results, public gazette digest cache, and source conflict audit queues | Admin portal moderation and public digest cache |
| `civicbridge_barrier_audit_logs`, `civicbridge_freshness_trust_reviews_v1`, `civicbridge_public_notices_digest_v1`, `civicbridge_service_availability_notices_v1`, `civicbridge_source_conflicts`, `civicbridge_conflict_audit_logs` | Admin barrier moderation, freshness reviews, public gazette digest cache, and source conflict audit queues | Admin portal moderation and public digest cache |
| `civicbridge_barrier_audit_logs`, `civicbridge_freshness_trust_reviews_v1`, `civicbridge_service_ownership_v1`, `civicbridge_public_notices_digest_v1`, `civicbridge_source_conflicts`, `civicbridge_conflict_audit_logs` | Admin barrier moderation, freshness reviews, service reviewer assignments, public gazette digest cache, and source conflict audit queues | Admin portal moderation and public digest cache |
| `civicbridge_location_denied` (sessionStorage) | A flag that the location permission was refused in this tab | No personal data, gone when the tab closes |
| `civicbridge_comparison_stale_dismissed` (sessionStorage) | A flag that the comparison stale-data warning was dismissed in this tab | No personal data, gone when the tab closes |
| `civicbridge_app_status_qr_tokens` | QR tokens for application status sharing | Shared feature data |
| `civicbridge_app_status_qr_rate_limits` | Rate limits for application status QR generation | Shared feature data |
| `civicbridge_catalogue_auditor_dismissals_v2` | Dismissed catalogue auditor review items | Admin moderation state |
| `civicbridge_dismissed_catalogue_conflicts` | Dismissed catalogue conflict review items | Admin moderation state |
| `civicbridge_helper_invitations` | Helper access invitations sent/received | Helper access feature |
| `civicbridge_helper_delegations` | Active helper delegations | Helper access feature |
| `civicbridge_helper_audit_logs` | Helper access audit trail | Helper access feature |
| `civicbridge_shareable_directory_views` | Shareable directory view tokens | Sharing feature |
| `civicbridge_shareable_citizen_profiles` | Shareable citizen profile tokens | Sharing feature |
| `civicbridge_voluntary_profile_opt_in` | Voluntary profile participation consent | Voluntary profile feature |
| `civicbridge_voluntary_profile_attrs` | Voluntary profile attribute selections | Voluntary profile feature |
| `civicbridge_synthetic_profiles_v1` | Testing scenario configurations and seeds | Synthetic dataset generation parameters (#778) |
| `civicbridge_synthetic_jobs_v1` | Local generation job statuses and execution logs | Asynchronous synthetic generation job tracking (#778) |
| `civicbridge_synthetic_artifacts_meta_v1` | Certified synthetic dataset metadata, checksums, and k-anonymity scores | Synthetic artifact cataloging (#778) |
| `civicbridge_synthetic_artifact_data_` | Isolated synthetic dataset payloads (offices, services, applications, grievances) | Ephemeral testing payload storage (#778) |
| `civicbridge_synthetic_validation_runs_v1` | Zero-PII compliance and referential integrity audit logs | Synthetic verification history (#778) |
| `civicbridge_synthetic_schema_catalog_v1` | Canonical schema definitions and field constraints | Schema catalog storage (#778) |
| `civicbridge_synthetic_audit_logs_v1` | Append-only audit logs for synthetic generation and migrations | Security audit trail (#778) |
| `civicbridge_synthetic_migration_backup_v1` | Pre-migration snapshot backup for zero-data-loss rollback | Schema rollback storage (#778) |
| `civicbridge_tenants_v1` | Multi-authority civic administration workspace profiles | Multi-tenant isolation feature (#779) |
| `civicbridge_tenant_memberships_v1` | Authority staff memberships, assigned roles, and ward jurisdictions | Multi-tenant isolation feature (#779) |
| `civicbridge_tenant_roles_v1` | Granular tenant role permission schemas | Multi-tenant isolation feature (#779) |
| `civicbridge_tenant_settings_v1` | Authority-specific SLA rules, emergency notices, and dispatch boundaries | Multi-tenant isolation feature (#779) |
| `civicbridge_tenant_audit_events_v1` | SHA-256 tamper-evident hash-chained authority audit trail | Multi-tenant isolation feature (#779) |
| `civicbridge_tenant_datasets_v1` | Partitioned authority operational datasets and ward service tickets | Multi-tenant isolation feature (#779) |
| `civicbridge_shared_catalogue_v1` | Controlled cross-tenant public catalogue guides with PII redacted | Multi-tenant isolation feature (#779) |
| `civicbridge_active_tenant_context_v1` | Active authority context selection on device | Multi-tenant isolation feature (#779) |
| `civicbridge_tenant_migration_backup_v1` | Snapshot backup for tenant schema migration rollback | Multi-tenant isolation feature (#779) |
| `civicbridge_counter_aggregates_v1`, `civicbridge_capacity_plans_v1`, `civicbridge_forecast_runs_v1`, `civicbridge_capacity_audit_logs_v1` | Historical footfall aggregates (Zero-PII), Erlang-C capacity plans, forecast runs, and append-only staffing override audit logs (#764) | Operations and capacity management |
| `civicbridge_tree_inventory_meta_v1`, `civicbridge_tree_assets_v1`, `civicbridge_tree_species_v1`, `civicbridge_tree_inspections_v1`, `civicbridge_tree_maintenance_orders_v1`, `civicbridge_tree_pruning_events_v1`, `civicbridge_tree_planting_sites_v1`, `civicbridge_tree_triage_suggestions_v1`, `civicbridge_tree_audit_events_v1`, `civicbridge_tree_idempotency_v1`, `civicbridge_tree_rate_limit_v1`, `civicbridge_tree_migration_backup_v1`, `civicbridge_trees_v1` | Municipal tree register, inspection history, maintenance orders, pruning history, planting sites, triage suggestions, append-only audit chain, idempotency/rate-limit state, schema metadata and rollback backup | Public-authority operating records, not a citizen profile. Kept so clearing a citizen's data cannot erase the public register or audit trail. The tree module applies its own 365-day retention to closed citizen reports |
| `civicbridge_ward_issue_events_v1`, `civicbridge_ward_geometries_v1`, `civicbridge_ward_metrics_v1`, `civicbridge_aggregation_runs_v1`, `civicbridge_privacy_rules_v1`, `civicbridge_ward_recommendations_v1`, `civicbridge_ward_issue_audit_logs_v1`, `civicbridge_ward_issue_rate_limit_v1`, `civicbridge_ward_heatmap_migration_backup_v1` | Anonymized ward-level civic issue heatmap, coarse events, published metrics, k-anonymity privacy thresholds, explainable recommendations, and audit logs | Municipal aggregate analytics and operating records. Coarse ward-level centroids only, zero citizen PII stored. Kept under retained operational records. |
| `civic_ghg_inventory_v1` | Municipal greenhouse-gas inventory bundle: emission sources, department activity records, versioned factors, reporting periods, calculation runs, human estimate decisions and the append-only audit trail | Public-authority environmental reporting records, not a citizen profile. Only approved aggregates are exposed publicly; internal notes and document metadata stay in the municipal workspace. The module applies its own retention and rollback policy (`applyGhgRetentionPolicy`) |
| `civicbridge_knowledge_sources_v1`, `civicbridge_source_snapshots_v1`, `civicbridge_transformation_runs_v1`, `civicbridge_provenance_edges_v1`, `civicbridge_editorial_reviews_v1`, `civicbridge_supersession_links_v1`, `civicbridge_provenance_audit_v1` | Public knowledge sources, snapshots, transformations, provenance DAG edges, editorial reviews, supersession links, and audit logs (#777) | Statutory provenance records, not citizen personal data |

## Remote data

- The app has no API of its own and no database. There is no Firestore, no server upload and no remote delete call anywhere in `src/`. The only network requests are loading the page, Google Fonts, and the QR code image service (`api.qrserver.com`, which receives the page URL it draws).
- Sign-in uses Clerk (`@clerk/clerk-react`). Clerk holds the account (email, name) and the profile details saved with **Edit Profile** (`phone`, `city`, `state`, `occupation`, `bio` in `unsafeMetadata`, written by `clerkUser.update` in `Profile.jsx`). The app has no code that deletes any of that. Clerk's own API only lets a signed-in user change their own record, so ownership there is enforced by Clerk, not by this app.
- To remove the extra profile details a person can edit the profile, empty the fields and save. To delete the account itself they have to use Clerk.
- Because there is no remote delete path in the app, **Clear my data** does not claim to delete anything remote.

## What the person is told is not deleted

The **Clear my data** screen says this next to the button:

- The sign-in account and the profile details held by Clerk.
- Anything already downloaded, printed, copied or shared (exports, PDFs, WhatsApp or Telegram shares, calendar events).
- Requests the browser already made to outside services (Google Fonts, the QR image service, map links). Those services and the internet provider may keep their own logs.
- Display preferences, privacy choices and the deletion receipt.
- Outdated-information reports in the review queue, and admin portal data.

## Known gaps

- `CONSENT_CATEGORIES[*].retentionDays` (14, 30, 60, 90, 365) is shown in the Privacy Center but nothing in the code enforces it. Real expiry would need a timestamp on every record and a cleanup on load. Not done here.
- Records are not encrypted in `localStorage`. The wording on the Privacy page about encrypted web storage does not match the code.
- `civicbridge_vault_pin` is reserved and nothing writes it, so the vault has no lock today.
