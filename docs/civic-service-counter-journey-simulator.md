# Civic Service Counter Journey Simulator (#843)

## Overview

The **Civic Service Counter Journey Simulator** is a citizen-facing tool that helps users understand the counter sequence for a civic service, mark documents as available, inspect blockers, and compare a complete visit versus an incomplete one. It simulates the *process order* only — it does **not** show a live queue, token number, waiting time, or official application status.

The simulator integrates with the existing Civic Help Setu service catalogue, authentication, and design conventions. All data is clearly labelled as illustrative and linked to official sources.

---

## User Flow

1. **Select a service and office** — The citizen chooses a service (e.g., Income Certificate) and an office (e.g., District Magistrate Office - South Delhi). If multiple counter sequences exist for the service, the citizen can select one.

2. **Load a reviewed counter sequence** — The simulator displays the reviewed counter sequence specific to the chosen service and office. The order reflects the official guidance reviewed by Civic Help Setu reviewers.

3. **Mark documents available** — The citizen toggles documents they will carry (Aadhaar card, address proof, income proof, etc.). The simulator only stores document *types*, never numbers or contents. Progress can be saved and resumed via browser localStorage.

4. **Follow the simulated counter path** — The citizen proceeds counter-by-counter in the reviewed order. At each counter, document checkpoints are evaluated:
   - **COMPLETE** — all required documents are marked available.
   - **BLOCKED** — a required document is missing; the counter cannot proceed.
   - **BRANCH_REQUIRED** — a missing document has an approved alternative route (e.g., an affidavit). The citizen is shown the alternative and may mark it as taken.
   - **UPCOMING** — an earlier counter in the path is not yet clear.

5. **Inspect blockers** — A panel lists all blockers with:
   - The missing document label.
   - Whether a branch alternative exists (with guidance from reviewed office notes).
   - Whether a repeat visit is possible (`repeatVisit: true`).
   - Source references for the guidance.

6. **Compare a complete versus incomplete visit** — Two views are provided:
   - **Complete path** — assumes every checkpoint is ready. Shows the ideal process order.
   - **Incomplete view** — shows the current tick state. Highlights missing documents, blocked counters, and repeat‑visit risk.
   - The comparison includes a delta: number of blocked counters, missing document types, and repeat‑visit risk items.

7. **Export a preparation checklist** — Generates a plain‑text checklist that the citizen can download or print. The text includes:
   - Service and office name.
   - Reviewed data version and date.
   - The visit path with document ticks.
   - Blockers and repeat‑visit risk.
   - A clear disclaimer that this is *private preparation progress*, not an official application status.
   - Sources and links (never document numbers or contents).

8. **Cancel, return, and resume** — The citizen can:
   - **Reset** all document selections and restart the counter sequence.
   - **Save progress** — only non‑sensitive document type IDs are persisted in localStorage; no Aadhaar/PAN/OTP/document contents are stored.
   - **Resume** — on return, the simulator loads the previously saved document availability state.

---

## Data Model

### Office

- References the existing `CIVIC_OFFICES` directory so the simulator stays consistent with `Nearby Offices`.
- Contains: `id`, `name`, `city`, `state`, `officeType`, `sourceId` (links to `COUNTER_SOURCES`).

### Service Counter Sequence

- `id`, `serviceId`, `officeId`, `title`, `reviewedAt`, `dataVersion`, `processNote`, `disclaimer`.
- `processNote`: explains that the order is illustrative and must be confirmed with the office.
- `disclaimer`: `Process order only. This simulator does not show a live queue, token number, waiting time or official application status.`

### Counter

- `id`, `order`, `title`, `purpose`, `guidance` (approved office guidance), `dependsOn` (other counters), `effortBand` (only when officially sourced), `checkpoints` (document checkpoints), `branchCounters` (optional missing‑document branches).

### Document Checkpoint

- `id`, `documentId`, `label`, `requirement` (`REQUIRED`/`CONDITIONAL`/`OPTIONAL`), `sourceIds`, `applicable` (derived from `context`), `available` ( citizen‑marked), `status` (AVAILABLE/Missing/Branch‑Available/Not‑Applicable), `missingBranch` (if the document is missing and an alternative route exists).

### Missing‑Document Branch

- When a required document is missing and an approved alternative exists, the checkpoint contains a `missingBranch` object:
  - `id`, `title`, `purpose`, `guidance` (reviewed office note), `requires` (document IDs needed), `repeatVisit: true`, `sourceIds`.

### Sources

- Every counter and checkpoint links to `COUNTER_SOURCES` entries. Sources have: `id`, `title`, `authority`, `url`, `reviewedAt`, `official: true/false`.

### Effort Band

- Shown **only** when a reviewed source supports it.
- `{ band: 'MEDIUM', label: 'Medium process effort', basis: 'Reviewed guidance separates document verification from certificate issuance. This is a process‑complexity band, not a waiting‑time estimate.', sourceIds: [...] }`.
- If no sourced band is available, `effortBand: null` and the UI explains “No officially sourced effort band available.”

---

## AI Guardrails

An AI‑style suggestion is provided for each counter, but **always labelled `SUGGESTION`** until the citizen confirms it.

- **Text**: derived strictly from the `guidance` field of the counter (approved office text). Never generated by a language model.
- **Confidence**: high if official sources are present and guidance exists; low (≈0.55) if only non‑official sources exist.
- **Requires review**: `true` if guidance is missing, conflicting, or confidence < 0.7. In that case the text routes the citizen to confirm with the office.
- **No fabricated wait‑time claims**: the `detectQueueClaim` guard checks the suggestion text for patterns like “queue is 20 minutes”, “live token”, etc. If found, `requiresReview` is forced to `true` and the text is flagged.
- **Source references**: every suggestion includes the resolved source objects (title + URL) and the data version (`2026.11.18-r1`).
- **Confirmation**: the citizen must click “Confirm” before the suggestion is treated as guidance; confirmed counters are tracked separately from private progress.

---

## States

| State | When it appears | UI |
|---|---|---|
| **Loading** | Initial load or re‑evaluation after document toggle | Spinner + “Loading counter sequence…” |
| **Empty** | No evaluation yet (no docs marked) | Gentle empty‑state text: “Mark at least one document above to load the counter sequence.” |
| **Error** | Evaluation failed (invalid journey, network error) | Error banner with “Retry” button |
| **Stale** | Data review date is past the 365‑day window | Banner: “Data review date XX‑XX‑XXXX is past the 365‑day review window. Confirm every step with the office.” |
| **Permission‑denied** | API route requires auth and user is guest | 401/403 error from the API; UI shows authentication required. |

---

## Accessibility

- **Keyboard navigation**: all interactive elements (selects, buttons, checkboxes) are focus‑able with visible `focus-visible` outlines. Tab order follows the logical flow: service select → office select → view‑mode toggles → counter board → blockers panel → comparison → export → AI panel → reset.
- **Essential information without hover**: all counter status, checkpoint availability, blocker messages, source names and URLs are visible in the markup; no information is conveyed only on hover.
- **Reduced motion**: `prefers-reduced-motion` disables all CSS transitions and spinner animations.
- **Table alternative**: the complete vs incomplete comparison is also available as a semantic `<table>` with a `<caption>`.
- **ARIA**: main regions (`role="region"`), live regions for blocker updates (`aria-live="polite"`), error messages (`role="alert"`), and source links (`target="_blank" rel="noreferrer"`).
- **Colour contrast**: meets WCAG AA for text and UI components.
- **Scalable fonts**: `clamp()`‑based fluid typography respecting `var(--font-size)`.

---

## Responsive Design

- **Wide (>768px)**: counter board is a 2‑column grid; linear checklist appears as a separate tab.
- **Narrow (≤768px)**: board stacks into a single‑column list; the linear checklist is the default view; effort bands and source panels reflow to full width.

---

## API Integration

The server‑side handler at `/api/counter-journey` supports the following actions:

| Action | Auth | Description |
|---|---|---|
| `catalogue` | Public | Paginated list of reviewed counter sequences. |
| `journey` | Public | Returns a journey’s basic info (no progress). |
| `evaluate` | Citizen (Bearer) | Full evaluation: counters, blockers, comparison, AI suggestions, sources, data quality. |
| `checklist` | Citizen (Bearer) | Exports a plain‑text preparation checklist. |
| `admin:review` | Admin (Bearer + role=admin) | Records a reviewer note for audit purposes. |

All routes return structured JSON errors (`code` + `message`). Sensitive data (Aadhaar, PAN, OTP, document contents) is never echoed back. Rate limiting is enforced per address (30 requests/minute) and per user (10/minute after session verification).

---

## Security, Privacy, and Audits

- **Minimum data collection**: only document *type* IDs are stored (e.g., `aadhaar`, `address-proof`). No numbers, contents, passwords, or OTPs are ever collected or logged.
- **LocalStorage only**: progress is saved via `localStorage.setItem(JOURNEY_PROGRESS_KEY, ...)`. The key `civicbridge_counter_journey_progress_v1` is namespaced and never sent to any server unless the citizen explicitly exports a checklist.
- **No PII in logs**: the API handler never logs request bodies or headers. The `findSensitiveKeys`/`collectSensitiveText` guards reject any request containing password/OTP/aadhaar/pan patterns.
- **Role‑based authorisation**: the API derives role from Clerk `publicMetadata` (via `resolveRole`). Admin actions (`admin:review`) require `role === 'admin'`; all other actions require authentication (`role !== 'guest'`).
- **Audit**: the `admin:review` action records a short reviewer note and `reviewedAt` timestamp. No PII is stored in the audit entry.
- **Content safety**: the `detectQueueClaim` guard prevents fabricated waiting‑time claims in AI suggestions. Suggestions are always labelled `SUGGESTION` and must be confirmed by the citizen.

---

## Manual Verification

1. **Select a service** (e.g., `income-certificate`) and an office. The simulator loads the reviewed counter sequence specific to that service/office combination.
2. **Mark at least one document** as available (e.g., `aadhaar`). The counter path loads, showing which checkpoints are satisfied and which are blocked.
3. **Inspect blockers** — the panel lists missing documents and any branch alternatives (e.g., income affidavit).
4. **Compare visits** — toggle the “Complete vs incomplete visit” view. Note the difference in counters cleared, missing documents, and repeat‑visit risk.
5. **Export the checklist** — download the text file. Read the disclaimer: “This is an illustrative preparation aid. Confirm every step with the office.”
6. **Reset and resume** — use the “Reset” button to clear all selections; then re‑mark documents and verify the simulator resumes from the saved state.
7. **Observe the AI suggestion panel** — if no docs are marked, an AI suggestion appears labelled “SUGGESTION (unconfirmed)”. Click “Confirm” to mark it confirmed; the label changes to reflect confirmation.

---

## Related Links

- [Civic Help Setu Home](/) — entry point and service discovery.
- [Service Details](/services/:id) — full service record with eligibility, documents, and steps.
- [Nearby Offices](/nearby) — find physical facilitation offices.
- [Civic Document Validity Calendar](/civic-document-validity-renewal-calendar) — document expiry and renewal tracking.
- [API reference](/api/counter-journey) — server‑side handler specification.

---

## Acknowledgement

This simulator uses **illustrative, reviewed data** drawn from official government sources. Every counter, checkpoint, and source is cited. The simulator does **not** claim to show official rules, decisions, live queues, or waiting times. Citizens must always confirm steps with the relevant government office before relying on any information.

*Generated on 2026‑11‑18. Data version: `2026.11.18-r1`. Review date: `2026-11-18`.*