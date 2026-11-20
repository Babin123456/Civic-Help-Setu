# Public Service Centre Fee Evidence Assistant (#1003)

## Overview

The **Public Service Centre Fee Evidence Assistant** helps a citizen compare the
charges printed on an assisted-service-centre receipt with verified, published
fee schedules. It separates statutory government fees from portal charges,
authorised-centre charges, and optional service charges, then produces a
redacted discrepancy report with the source and verification date used for every
matched amount.

The feature is available at:

- `/fee-evidence`
- `/fee-evidence-assistant`
- `/service-centre-fees`

Implementation:

- Domain service: `src/services/nationalPublicServiceCentreService.js`
- Workspace UI: `src/pages/FeeEvidenceAssistant.jsx`
- Service tests: `src/services/nationalPublicServiceCentreService.test.js`
- UI tests: `src/pages/FeeEvidenceAssistant.test.jsx`
- Verified schedule dataset: `src/data/serviceFeeBreakdowns.js`

---

## What the assistant does

1. The citizen selects a service, jurisdiction level, State/UT when applicable,
   and the date for which the fee should apply.
2. The citizen uploads a **text** receipt, pastes OCR output, or types each
   charge, amount, and component type.
3. OCR digit confusions are corrected transparently, with every correction
   shown for review.
4. The assistant matches each charge to the most specific applicable fee version
   (local > district > state > national, then newest version and effective date).
5. A redacted discrepancy report classifies each component as `matched`,
   `overcharged`, `undercharged`, or `unverified`.
6. The published grievance route is linked when one exists. Otherwise the UI
   says so explicitly and offers the generic CPGRAMS portal.
7. The full versioned fee history for the service is displayed, including
   authority, jurisdiction, effective date, source URL, and verification date.
8. Community observations can be submitted, but remain hidden until a moderator
   approves them.

---

## Fee data model

### Component types

| Constant | Meaning |
| --- | --- |
| `government_fee` | Statutory or government-set fee |
| `portal_charge` | Online portal or payment-gateway charge |
| `authorised_centre_charge` | Charge by an authorised centre or operator |
| `optional_service_charge` | Optional facilitation, SMS, lounge, courier, etc. |

### Version fields

Every fee version carries:

- `serviceId`
- `componentType`
- `authority`
- `jurisdiction` (`national`, `state`, `district`, `local`)
- `state` / `district` / `localBody` when applicable
- `effectiveDate`
- `source` (official http/https URL)
- `verificationDate`
- `amount` and `currency`
- `status` (`published`, `free`, `unverified`, `obsolete`)
- `fingerprint` for audit comparison
- `auditTrail`

### Baseline and recorded versions

`getFeeHistory(serviceId)` combines:

- **Baseline versions** (`version: 0`, `origin: 'dataset'`) derived from the
  verified gazette dataset in `src/data/serviceFeeBreakdowns.js`.
- **Recorded versions** (`version: 1+`, `origin: 'recorded'`) appended through
  `recordFeeVersion(record, { actor, reason })`.

A fee change is appended, never overwritten. Invalid records are rejected before
they can be stored. The audit trail records who recorded the version and why.

### Applicable version resolution

`getApplicableFeeVersion(serviceId, { jurisdiction, state, effectiveDate })`
uses this precedence:

1. Narrower jurisdiction (local > district > state > national).
2. Higher version number.
3. Latest effective date.

Versions with an effective date after the check date, or with an `obsolete`
status, are excluded. A State/UT-specific version is not applied without a
selected State/UT, to a different State/UT, or outside its district/local body
when those narrower places are recorded. If no narrower version is applicable,
the national/state schedule is used.

---

## Receipt privacy and redaction

Receipt identifiers are **redacted by default**:

- The receipt ID field becomes `REDACTED`.
- Identifiers inside pasted text are replaced with `[REDACTED:TYPE]`.
- Detected categories include email, PAN, Aadhaar, mobile numbers, labelled
  receipt/ARN/application numbers, long numeric identifiers, card-like payment
  numbers, CVV/PIN/OTP values, UPI IDs, and IFSC codes.
- The original identifier values are not stored or returned in the report.
- Redaction can be explicitly disabled for a report with
  `redactIdentifiers: false`; the UI warns when this is enabled.

**Payment credentials are out of scope.** The assistant does not accept or
process card numbers, CVV/CVC, PIN, OTP, bank account numbers, IFSC, or UPI IDs.
Community observations containing these patterns are rejected.

---

## OCR correction

`correctOcrText(text)` repairs OCR digit confusions only inside numeric tokens,
so words such as "Passport" are not altered. Common substitutions include:

| OCR output | Corrected |
| --- | --- |
| `O` / `o` | `0` |
| `I` / `l` | `1` |
| `S` | `5` |
| `B` | `8` |
| `Z` | `2` |

`detectOcrCorrections(text)` returns every change so the UI can display a
before/after review list. `parseReceiptText(text)` then reads the last amount on
each line, ignores total/date/header lines, cleans separators from labels, and
returns candidate components with an inferred component type and a
`requiresReview` flag for unknown labels.

Image and PDF OCR is intentionally not performed in the browser. Users can paste
existing OCR text or type the amounts.

---

## Discrepancy safeguards

- Without a verified official schedule, **every** component is labelled
  `unverified`. No overcharge conclusion is drawn.
- A schedule past its review window is treated as not applicable for an
  overcharge conclusion.
- A schedule that was not yet effective on the selected check date is treated as
  not applicable; the report does not compare a receipt with a later fee version.
- Unknown components are labelled `unverified` even when other components match.
- Matched components expose the official amount, source name, source URL, fee
  version, and verification date. Unmatched components expose no official source
  link, so a source is never implied for an unverified charge.
- A small rounding tolerance is allowed.
- The report states that it does not determine whether a charge is lawful and is
  not legal advice.
- The report contains a redacted receipt evidence ID, not the raw receipt text.

Overall results are `match`, `partial-match`, `overcharged`,
`partial-overcharge`, `undercharged`, `unverified`, or `no-components`.

---

## Grievance routes

Published service-specific routes are included for Aadhaar, passport, driving
licence, PAN, and voter ID. Each route includes the department, portal URL,
CPGRAMS link, and complaint categories.

When no service-specific route is published, the response is marked
`unverified` and explains that only the generic CPGRAMS route is available. A
schedule past its review window is marked `review-required`.

---

## Community observations and moderation

Lifecycle:

1. `createCommunityFeeObservation(...)` stores a **pending** observation.
2. Pending observations are not returned by the public
   `getModeratedObservations(serviceId)` call.
3. A moderator calls
   `moderateCommunityObservation(id, 'approved' | 'rejected' | 'flagged', notes, { moderatorId })`.
4. Only approved observations are displayed publicly.
5. Public output omits the user ID, evidence payload, moderator notes,
   moderator identity, and internal audit trail; it exposes only whether
   evidence was attached.
6. Sensitive evidence keys are removed and identifier-like text is redacted.

Local storage keys:

- `civicbridge_npsc_fee_history_v1`
- `civicbridge_npsc_fee_observations_v1`

`resetFeeEvidenceAssistantData()` clears both for tests or an explicit reset.

---

## Acceptance criteria mapping

| Criterion | Implementation | Test coverage |
| --- | --- | --- |
| No charge called illegal without an applicable official source | Report only says "above/below published fee" after a verified, in-window match; otherwise `unverified` | unknown service, expired schedule, matched/over/undercharge tests |
| Unknown components labelled unverified | `findOfficialFeeMatch` returns no match; summary increments `componentsUnverified` | OCR unknown label and mixed-component tests |
| Receipt identifiers redacted by default | `createReceiptEvidence` + `redactReceiptText`; report never contains raw text | receipt ID, email/mobile/Aadhaar/PAN, report serialization tests |
| Fee history versioned and auditable | Baseline v0 + appended v1+ with audit trail and fingerprints | fee change, effective-date, state override, obsolete tests |
| Tests cover jurisdiction variants, OCR correction, redaction, fee changes | Dedicated suites in the service test file and UI test file | 61 service tests + 7 UI tests |

---

## Safeguards

- No payment credentials are collected.
- No transaction or payment is initiated.
- No receipt images or text are uploaded to a server by this feature.
- The service only compares entered amounts with published schedules.
- The assistant does not provide a legal determination.
- Local storage is used for fee history and community moderation in this
  frontend implementation; production deployment should move moderation and fee
  version records to an authenticated backend with the same audit fields.

---

## Verification

```bash
npx vitest run src/services/nationalPublicServiceCentreService.test.js
npx vitest run src/pages/FeeEvidenceAssistant.test.jsx
npx eslint src/services/nationalPublicServiceCentreService.js src/services/nationalPublicServiceCentreService.test.js src/pages/FeeEvidenceAssistant.jsx src/pages/FeeEvidenceAssistant.test.jsx
npm run lint:security
npm run build
```

The repository-wide `npm run lint` and full test suite contain pre-existing
failures in unrelated areas; the commands above cover this feature's files and
the security lint.
