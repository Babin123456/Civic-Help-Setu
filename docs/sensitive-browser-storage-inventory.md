# Sensitive Browser-Storage Inventory and Automated Leak Guard

## 1. Overview & Policy Rationale
Civic Help Setu operates on privacy-first and local-first architecture. While browser storage (`localStorage` and `sessionStorage`) is vital for persisting offline disaster drafts, language preferences, and consent timestamps, accidental storage of credentials or citizen identity records introduces severe security vulnerabilities.

This document establishes:
- The master inventory of permitted browser-storage keys.
- Data classifications and retention behaviors.
- The automated storage leak guard interceptor.
- Contributor rules for requesting storage key additions.

---

## 2. Browser Storage Inventory Allowlist

| Key | Storage Type | Data Classification | Owner Component | Retention Rule | Consent Bound |
|---|---|---|---|---|---|
| `civicbridge_theme` | `localStorage` | `PREFERENCE` | `UI/ThemeContext` | Permanent | No |
| `civicbridge_lang` | `localStorage` | `PREFERENCE` | `i18n/LanguageContext` | Permanent | No |
| `civicbridge_privacy_consent` | `localStorage` | `CONSENT_RECORD` | `Privacy/ConsentManager` | 1 Year / Until Revoked | Yes |
| `chs_post_auth_dest` | `sessionStorage` | `TRANSIENT_STATE` | `Auth/OAuthRedirectService` | Flushed on navigation | No |
| `civicbridge_location_denied`| `sessionStorage` | `TRANSIENT_STATE` | `Location/PermissionHelper` | Browser session | No |
| `chs_offline_report_drafts` | `localStorage` | `OFFLINE_DRAFT` | `Emergency/OfflineReportQueue` | Until sync / user purge | Yes |

---

## 3. Explicit Prohibitions
The following items are **strictly forbidden** from being stored in unencrypted browser storage:
1. **Bearer Tokens / Passwords**: Raw JWT tokens, Clerk session cookies, API secret keys.
2. **National Identity Identifiers**: 12-digit Aadhaar numbers, PAN cards, Voter ID numbers.
3. **Unencrypted Binary Documents**: Base64 raw document bytes, PDF payloads.
4. **Raw Unsanitized AI Prompts**: Prompts containing citizen personal names or medical records.

---

## 4. Automated Leak Guard Implementation
The service `sensitiveStorageGuardService.js` intercepts proposed storage writes:
- Validates the key against `STORAGE_INVENTORY_ALLOWLIST`.
- Checks the payload against regex signatures (`JWT_BEARER_TOKEN`, `AADHAAR_NUMBER`, `PASSWORD_FIELD`, `RAW_DOCUMENT_BASE64`).
- Blocks non-conforming writes and emits a warning.
- Provides `purgeCitizenStorageOnConsentWithdrawal()` to clear all consent-bound records when a user requests data deletion.

---

## 5. Contributor Checklist for Storage Modifications
Before introducing a new storage key:
- [ ] Has the key been registered in `STORAGE_INVENTORY_ALLOWLIST`?
- [ ] Is the data classification explicitly specified (`PREFERENCE`, `TRANSIENT_STATE`, `CONSENT_RECORD`, `OFFLINE_DRAFT`)?
- [ ] Does the payload exclude passwords, tokens, full Aadhaar numbers, and raw binary document blobs?
- [ ] Is there an automated unit test verifying that the key is cleared during `purgeCitizenStorageOnConsentWithdrawal()` if consent-bound?


## 6. Audit & Automated CI Storage Rules
- Running `npm test -- src/services/sensitiveStorageGuardService.test.js` guarantees that:
  - Unauthorized keys are rejected immediately.
  - Payloads matching JWT or 12-digit Aadhaar patterns are halted.
  - Consent withdrawal initiates atomic purging of private draft entries.
  - Clean serialized export payloads contain zero sensitive tokens.
