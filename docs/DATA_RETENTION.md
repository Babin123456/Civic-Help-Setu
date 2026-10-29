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
| `civicbridge_checklists` | `checklistStorage.js` | Which checklist items are ticked, per checklist or application id | Drafts and in-progress work |
| `civic_journey_progress_<journeyId>` (one per journey) | `journeyDependencyEngine.js` | Completed tasks of a journey plan | Drafts and in-progress work |
| `civic_accessibility_visit_plans` | `accessibilityPlannerService.js` | Saved citizen accessibility needs, accommodations, and office pre-visit confirmation checklists | Drafts and in-progress work |
| `civic_grievance_evidence_drafts` | `grievanceEvidenceService.js` | Private user-controlled grievance preparation drafts and timelines | Drafts and in-progress work |
| `civic_life_event_journeys` | `lifeEventNavigatorService.js` | Saved life-event roadmap progress, hidden tasks and regional selections | Drafts and in-progress work |
| `civicbridge_eligibility_assessments` | `assessmentStorage.js` | Answers and results of eligibility checks | Drafts and in-progress work |
| `civicbridge_applicant_profiles_v1` | `applicantProfileService.js` | Household and family member applicant profiles for scoped assessments | Drafts and in-progress work |
| `civicbridge_applications` | `trackingService.js` | Applications the person tracks: reference id, service, status, stages | Tracking records |
| `civicbridge_office_tokens` | `locationService.js` | Office visit tokens and appointments | Tracking records |
| `civic_grievance_tickets` | `grievanceService.js` | Grievance tickets raised from the app | Tracking records |
| `civicbridge_reminders` | `reminderNotificationService.js` | Renewal, submission and document expiry reminders | Tracking records |
| `civicbridge_notification_settings` | `reminderNotificationService.js` | Reminder lead time settings | Tracking records |
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
| `civicbridge_barrier_reports` | `barrierReportService.js` | Citizen-reported accessibility and physical service delivery barriers | Reviews, votes and reports |
| `civicbridge_bottleneck_feedback_v1` | `bottleneckFeedbackService.js` | Citizen bottleneck and delay feedback submissions | Reviews, votes and reports |
| `civicbridge_checklist` | `dataPortabilityService.js` | Saved checklist items exported/imported across devices | Drafts and in-progress work |
| `civicbridge_track_applications` | `dataPortabilityService.js` | Application tracking records staged for import or export | Tracking records |
| `civicbridge_form_drafts` | `dataPortabilityService.js` | Form drafts prepared by citizen | Drafts and in-progress work |
| `civicbridge_journey_handoffs_v1` | `journeyHandoffService.js` | Journey handoff bundles and shared checklist links | Drafts and in-progress work |
| `civicbridge_readiness_scorecards` | `readinessScorecardService.js` | Citizen application readiness scores and missing document audits | Drafts and in-progress work |
| `civicbridge_offline_cache` | `offlineCacheService.js` | Copies of saved guides and application stages for offline use | Offline copies and location |
| `civicbridge_offline_last_sync` | `offlineCacheService.js` | Time of the last offline sync | Offline copies and location |
| `civicbridge_cached_shelters` | `disasterReliefService.js` | Copy of the public relief shelter list (no personal data) | Offline copies and location |
| `civicbridge_user_coords` (sessionStorage) | `locationService.js` | Last location the browser gave the app, for the nearby offices page. Gone when the tab closes | Offline copies and location |

The offline copies only duplicate tracking records and saved items, so clearing either of those clears them too. The result list says so.

After clearing, the sample reviews, sample audit reports and the sample vault documents are put back the next time those pages are opened. They are demo content, not the person's data.

## Data the "Clear my data" screen keeps on purpose

| Key | What it holds | Why it stays |
|---|---|---|
| `civicbridge_theme`, `civicbridge_lang`, `civicbridge_plain_lang`, `civicbridge_a11y_prefs`, `civicbridge_focus_mode`, `civicbridge_active_applicant_profile_id_v1` | Theme, language, plain language, accessibility, and active applicant profile selection settings | Display preferences, not records. Removing them would reset the page the person is looking at |
| `civicbridge_demo_user` | Demo sign-in session (only when Clerk is not configured) | Signing out is its own action |
| `civicbridge_consent_preferences` | Privacy choices | Reset by the Full Account Purge only |
| `civicbridge_privacy_audit_log` | Last 100 privacy events (consent change, export, clear). It holds ids, category names and counts, never record contents | Receipt that a deletion happened |
| `civicbridge_error_reports` | Outdated-information reports sent from a service page, and the admin review queue | Shared review queue |
| `civicbridge_eligibility_test_cases_v1` | Fictional test cases a maintainer saved in the admin eligibility test bench. Holds made-up answers only, never a citizen's | Admin portal data |
| `civicbridge_custom_services`, `civicbridge_audit_logs`, `civicbridge_rbac_users`, `civicbridge_service_submissions` | Admin portal data | Not citizen data |
| `civicbridge_barrier_audit_logs`, `civicbridge_freshness_trust_reviews_v1`, `civicbridge_link_health_v1`, `civicbridge_public_notices_digest_v1`, `civicbridge_source_conflicts`, `civicbridge_conflict_audit_logs` | Admin barrier moderation, freshness reviews, official link check results, public gazette digest cache, and source conflict audit queues | Admin portal moderation and public digest cache |
| `civicbridge_barrier_audit_logs`, `civicbridge_freshness_trust_reviews_v1`, `civicbridge_public_notices_digest_v1`, `civicbridge_service_availability_notices_v1`, `civicbridge_source_conflicts`, `civicbridge_conflict_audit_logs` | Admin barrier moderation, freshness reviews, public gazette digest cache, and source conflict audit queues | Admin portal moderation and public digest cache |
| `civicbridge_barrier_audit_logs`, `civicbridge_freshness_trust_reviews_v1`, `civicbridge_service_ownership_v1`, `civicbridge_public_notices_digest_v1`, `civicbridge_source_conflicts`, `civicbridge_conflict_audit_logs` | Admin barrier moderation, freshness reviews, service reviewer assignments, public gazette digest cache, and source conflict audit queues | Admin portal moderation and public digest cache |
| `civicbridge_location_denied` (sessionStorage) | A flag that the location permission was refused in this tab | No personal data, gone when the tab closes |

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
