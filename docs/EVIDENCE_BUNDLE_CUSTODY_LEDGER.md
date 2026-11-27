# Civic Evidence Bundle Integrity & Chain-of-Custody Ledger

> **Issue**: [#1425](https://github.com/GoldRay19/Civic-Help-Setu/issues/1425)
> **Branch**: `feat/evidence-bundle-custody-1425`
> **Extends**: `#1160` (`verifiableEvidenceBundleContract.js`, `verifiableEvidenceBundleService.js`, `VerifiableEvidenceBundleWorkspace.jsx`, `api/_lib/handlers/verifiable-evidence-bundles.js`)

---

## 1. Architecture Overview

The Chain-of-Custody Ledger extends Civic Help Setu's existing **Verifiable Evidence Bundle** subsystem without creating a parallel store or duplicate verification pipeline.

| Component | Role |
|-----------|------|
| `src/data/verifiableEvidenceBundleContract.js` | Canonical JSON (RFC 8785), SHA-256 hashing, Merkle root, manifest seal, statutory disclaimer |
| `src/services/verifiableEvidenceBundleService.js` | Bundle creation, append-only entry addition, JSON/Markdown export, archive import |
| `src/services/evidenceCustodyLedgerExtension.js` | **New (#1425)**: Hash-chained custody ledger, original preservation, selective redaction, PII log guard, custody verification |
| `src/pages/VerifiableEvidenceBundleWorkspace.jsx` | UI for bundle management, **Selective Redact** action, and **Chain-of-Custody Ledger** timeline |
| `api/_lib/handlers/verifiable-evidence-bundles.js` | Stateless REST verification endpoint extended with `custodyLedger` hash-chain & PII checks |

---

## 2. Original Preservation & Transformations

- Every evidence entry in `bundle.entries[]` retains its original `entryHash` and `attachment.sha256`.
- Selective redactions and transformations **never mutate** `entry.entryHash` or `entry.attachment.sha256`.
- Instead, `applySelectiveRedaction()` produces a derived `redactedViews[entryId]` entry with its own `redactedContentHash` and appends a `REDACTED` event to the bundle's `custodyLedger` referencing `originalHash`.
- Supported custody event types: `CAPTURED`, `IMPORTED`, `ANNOTATED`, `REDACTED`, `TRANSFORMED`, `EXPORTED`, `VERIFIED`.

---

## 3. Data Provenance & Statutory Disclaimer

- **Citizen Assertion (`CITIZEN_ASSERTION`)**, **Independently Verified Record (`INDEPENDENT_VERIFICATION`)**, and **System Observed Metadata (`SYSTEM_OBSERVED`)** remain visibly distinct in both the UI and exported Markdown/JSON dossiers.
- All verification reports and exports include `STATUTORY_EVIDENCE_DISCLAIMER` and `authenticityNotice`: mathematical integrity and chain-of-custody logs prove data continuity and tamper detection only—they do **not** certify factual truth or sovereign legal authenticity.

---

## 4. Privacy & PII Guardrails

- Custody event rationales and metadata are screened via `detectForbiddenPII()` (`inspectStringForPII` + regex fallback) to reject Aadhaar numbers, PAN numbers, and personal phone numbers before persisting or accepting in API requests (`400 Privacy Policy Violation`).
- `redactPIIPatterns()` replaces Aadhaar, PAN, and phone spans with `[REDACTED:AADHAAR]`, `[REDACTED:PAN]`, and `[REDACTED:PHONE]`.

---

## 5. Configuration, Deployment, Monitoring & Rollback

- **Configuration**: Stateless API endpoint (`api/_lib/handlers/verifiable-evidence-bundles.js`) requires no new environment variables. Client persistence uses `localStorage` key `civic_evidence_custody_ledgers_v1` with in-memory fallback.
- **Monitoring**: Track `400` (schema/PII rejections) and `422` (tampered manifest or custody chain) responses on `POST /api/verifiable-evidence-bundles`.
- **Rollback**: Revert `evidenceCustodyLedgerExtension.js` imports in `VerifiableEvidenceBundleWorkspace.jsx` and `api/_lib/handlers/verifiable-evidence-bundles.js`. Existing `#1160` bundle manifests remain 100% backward-compatible.
