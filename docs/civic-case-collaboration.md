# Civic Case Collaboration Space with Granular, Revocable Sharing (#1183)

## 1. Overview

The **Civic Case Collaboration Space** is a citizen workspace for sharing selected
case documents with a trusted helper (family member, legal representative, friend)
without exposing the citizen's entire account.

It supports **item-level sharing**, expiry, revocation, view/download scopes,
recipient authentication, watermarked exports, audit access, link-guessing
prevention, and blocked cached access after revocation.

Available at `/case-collaboration`.

---

## 2. Architecture decision record (ADR)

### 2.1 Context

Citizens may need help navigating a civic application (filling forms, gathering
documents, meeting deadlines) but should not have to share their entire account
or hand over credentials. Existing sharing features (e.g. shareable profiles) are
document-scoped; this feature extends that model to **case-level, item-scoped,
revocable collaboration** with fine-grained control over what a helper can view
or download and for how long.

### 2.2 Decision

Implement a **deterministic, token-based sharing engine** where each share is a
sealed record with a CSPRNG token, expiry, view/download scope, optional
passcode gate, max views, watermark and SHA-256 snapshot integrity seal.

| Principle | Implementation |
|---|---|
| Item-level sharing | Citizens select specific case items to share; `itemSnapshot` captures only those items. No account-wide data is exposed. |
| Versioned staging/snapshot | Each share records an immutable `snapshotSeal` (SHA-256) over token, owner, createdAt, items, scope, recipient. |
| Expiry | `expiresAt` set from `SHARE_EXPIRY_OPTIONS` (24h/3d/7d/30d/never); expired links refused. |
| Revocation | `revoked` flag; revoked links refused even if previously cached. |
| Restricted filesystem / no network | Runs client-side; no network calls for share logic; no filesystem access beyond namespaced `localStorage`. |
| Validate outputs | Output validated against expected schema; integrity seal verified on every read. |
| Scan dependencies/threats | Tokens are CSPRNG (128-bit) to prevent link guessing; passcodes salted+SHA-256 with brute-force lockout. |
| AI outputs untrusted with provenance | Every result carries `untrusted: true`, `requiresHumanReview: true`, `noCitizenData: true`, `illustrative: true`. |
| Explicit human approval | Creating and revoking shares are explicit human actions; never autonomous. |
| Validate all external input at trust boundaries | `validateCollaborationRequest` runs client and server; rejects sensitive fields/values and unknown ids. |

### 2.3 Component ownership

| Component | File | Owner | Responsibility |
|---|---|---|---|
| Data contract | `src/data/civicCaseCollaborationData.js` | Maintainer | Versioned synthetic cases, items, recipients, templates, audit entries |
| Collaboration engine | `src/services/civicCaseCollaborationService.js` | Maintainer | Validation, share create/resolve/download/revoke, audit log, integrity seals |
| API boundary | `api/_lib/handlers/case-collaboration.js` | Maintainer | Auth, rate limiting, structured errors, HTTP wiring |
| UI workspace | `src/components/caseCollaboration/CaseCollaborationWorkspace.jsx` | Maintainer | Share creation, viewer, owner management |
| Page | `src/pages/ServiceChangeSandboxWorkspace.jsx` | Maintainer | Route entry point |
| Tests | `src/services/civicCaseCollaborationService.test.js`, `tests/case-collaboration-api.test.js`, `src/components/caseCollaboration/*.test.jsx` | Maintainer | Unit, integration, API tests |
| Documentation | `docs/civic-case-collaboration.md` | Maintainer | ADR, data flow, threat model, deployment, evaluation |

### 2.4 Failure handling

- Invalid input → structured `{ error.code, error.message, errors[] }` HTTP 400.
- Unknown share/item/recipient → specific not-found error, never a 500 from bad input.
- Revoked/expired/view-limit/locked → specific status + structured error; no untrusted content returned.
- Passcode required / wrong passcode → `AUTHENTICATION_REQUIRED` with remaining attempts; lockout after `MAX_PIN_ATTEMPTS`.
- Storage unavailable → `STORAGE_UNAVAILABLE`, UI degrades gracefully.
- Rate limit exceeded → HTTP 429 with `Retry-After`.
- Network failure → error banner with Retry; no partial state shown as truth.
- Stale data (past review window) → `isStale: true`, banner shown.

---

## 3. Data flow

```
[Citizen owner]
   │ selects case + items + recipient + scope + expiry + optional passcode
   │ clicks "Create share link"
   ▼
[src/components/caseCollaboration/ShareCreator.jsx]
   │ POST /api/case-collaboration  { action: 'create-share', ... }
   ▼
[api/_lib/handlers/case-collaboration.js]
   ├─ rate limit (per address + per user)
   ├─ validateCollaborationRequest (trust boundary)
   ├─ createShare (deterministic engine)
   │     ├─ validate tool/policy... (case/item/recipient lookup)
   │     ├─ CSPRNG token, expiry, snapshotSeal (SHA-256)
   │     ├─ optional salted passcode hash
   │     └─ persist to namespaced localStorage
   ▼
[returns { ok, share: { id, title, scope, expiresAt, ... } }]
   │
   ▼
[Owner sees share link; shares token with recipient out-of-band]

[Recipient]
   │ opens /case-collaboration?token=<token>
   ▼
[CaseCollaborationWorkspace (view mode)]
   │ POST /api/case-collaboration  { action: 'resolve', shareId, pin? }
   ▼
[resolveShare]
   ├─ revocation / expiry / view-limit checks → block
   ├─ integrity seal verification → block on tamper
   ├─ passcode gate + brute-force lockout
   ├─ increment viewCount, append audit log
   └─ return itemSnapshot + watermark + integrityDigest
   ▼
[ShareViewer renders watermarked items; download only if scope=view-download]
```

### 3.1 Trust boundaries

| Boundary | Enforcement |
|---|---|
| Client → API | `validateCollaborationRequest` on both sides; sensitive-key/value scans; slug and range checks |
| API → Engine | Only validated parameters reach `createShare`/`resolveShare`/`recordDownload` |
| Engine → UI | Outputs carry `untrusted: true`, `readOnly: true`, `noCitizenData: true`, `disclaimer` |
| Storage | Share records in `localStorage` under `civicbridge_case_collaboration_shares_v1`; raw document content never stored |

---

## 4. Threat model

### 4.1 Assets

- Share records (token, owner, items, expiry, view/download counts, audit log).
- Share tokens (128-bit CSPRNG) — unguessable links.
- Passcodes (salted SHA-256) — optional gate.
- Audit access log (who accessed what, when, outcome).

### 4.2 Threats and mitigations

| Threat | Impact | Mitigation |
|---|---|---|
| Link guessing / enumeration | Unauthorised access | 128-bit CSPRNG tokens; not guessable |
| Link sharing beyond intended recipient | Over-sharing | Expiry, max views, passcode, revocation |
| Cached access after revocation | Unauthorised access post-revoke | `revoked` flag checked on every read; refused even if cached |
| Link tampering / replay | Data integrity loss | SHA-256 snapshot seal verified on every read; tampered → blocked |
| Password brute-force | Passcode compromise | Salted SHA-256, `MAX_PIN_ATTEMPTS=5`, 15-min lockout |
| PII leakage in share | Privacy harm | Item snapshots scrubbed; `noCitizenData: true`; no credentials/raw documents |
| API abuse / DoS | Service degradation | Per-address rate limit (30/min), per-user limit (10/min) |
| Share mistaken for official decision | Harmful reliance | Every result `illustrative: true`, `untrusted: true`, `disclaimer` |

### 4.3 Non-goals / explicitly prohibited

- Autonomous sharing or revocation without human action.
- Sharing raw document content or credentials.
- Treating a share as official verification or application status.
- Storing real citizen records or credentials.

---

## 5. Data model (versioned schema)

Schema version: `civic-case-collaboration-v1`

### Case item (synthetic)

```
{ id, caseId, title, description, mime, sizeBytes, category, isSynthetic, notes }
```

### Case (synthetic)

```
{ id, title, serviceId, stage, ownerId, isSynthetic }
```

### Recipient (synthetic)

```
{ id, email, name, role, isSynthetic }
```

### Share record

```
{ id, shareId, ownerId, title, description, caseId, itemIds[], itemSnapshot[],
  recipientEmail, recipientId, scope, expiryOption, expiresAt, revoked, status,
  humanApproved, productionWriteBlocked, maxViews, viewCount, downloadCount,
  lastAccessedAt, passcodeSalt, passcodeHash, failedAttempts, lockedUntil,
  accessLog[], snapshotSeal, createdAt, updatedAt, ownerActor,
  illustrative: true, noCitizenData: true }
```

### Share result (viewer)

```
{ schemaVersion, dataVersion, reviewDate, staleAfterDays, isStale,
  run: { share, view: { shareId, title, description, caseId, itemIds,
    itemSnapshot[], scope, viewCount, viewsRemaining, expiresAt, createdAt,
    watermark, illustrative: true, noCitizenData: true, readOnly: true,
    integrityVerified: true, integrityDigest } },
  disclaimer, untrusted: true, requiresHumanReview: true }
```

### Saved run record (localStorage only)

```
{ runId, snapshotId, status, summary, updatedAt }
```

No PII, credentials or document contents are stored anywhere.

---

## 6. Evaluation criteria (measurable)

| Criterion | Target | How measured |
|---|---|---|
| Determinism | Same inputs → identical share/seal | `civicCaseCollaborationService.test.js` repeats runs |
| Input validation | 100% sensitive fields/values rejected | Unit tests for `validateCollaborationRequest` |
| Revocation blocks cached access | Revoked share refused on re-read | Service + API test |
| Expiry blocks access | Expired share refused | Service test |
| View limit enforced | Access refused after maxViews | Service test |
| Passcode gating | Passcode required; lockout after 5 fails | Service test |
| Download scope | view-only blocks download | Service + API test |
| API auth | create/revoke/list/audit return 401 for guest | `tests/case-collaboration-api.test.js` |
| Rate limiting | 429 with `Retry-After` | Abuse guard (existing patterns) |
| Accessibility | Keyboard navigable, ARIA labels, colour contrast | Component tests + Lighthouse |
| Mobile-first | Layout stacks below 768px | Component + manual review |

### Reproducible commands

```bash
# Install
npm install

# Run the app
npm run dev

# Unit tests (collaboration engine)
npx vitest run src/services/civicCaseCollaborationService.test.js

# API tests (handler)
npx vitest run tests/case-collaboration-api.test.js

# Component tests (static markup)
npx vitest run src/components/caseCollaboration/*.test.jsx

# Full checks
npm test
npm run lint
npm run lint:security
npm run build
```

### Evaluation report

Run the commands above; all tests must pass. The share engine is deterministic,
so shares created with identical inputs produce identical tokens/seals.

---

## 7. Dependencies, licences, performance and cost limits

### Dependencies

No new runtime dependencies. Reuses existing stack:

- React 19, Vite, React Router, Lucide React, Vitest, ESLint.
- Clerk (authentication; falls back to local demo mode).

Licences: existing project dependencies retain their own licences; this feature
adds no new packages.

### Performance limits

- Share create/resolve are synchronous and bounded by item count (≤ 50 items per
  share). Expected to complete well under 50 ms.
- Catalogue endpoint is public and returns the small synthetic dataset.

### Cost limits

- No AI model calls; zero inference cost.
- No external paid services beyond existing Clerk/Vercel hosting.
- Storage is `localStorage` only (client-side); no server-side persistence of
  shares.

---

## 8. Deployment documentation

### 8.1 Route registration

- `src/App.jsx`: `/case-collaboration` renders `ServiceChangeSandboxWorkspacePage`.
- `api/[...path].js`: `case-collaboration` handler registered under `/api/case-collaboration`.

### 8.2 Environment variables

No new environment variables required. Existing `VITE_CLERK_PUBLISHABLE_KEY`
controls auth mode (Clerk vs local demo). Creating/revoking/listing shares
requires a session; resolving a share is token-based (guest-allowed, passcode
gated when configured).

### 8.3 Build & deploy

```bash
npm run build       # Vite production build
# Deploy to Vercel (existing vercel.json applies)
```

### 8.4 Rollback / migration

- Schema version `civic-case-collaboration-v1` is recorded on every result.
- No server-side migrations required (no persistent share store).
- Share records live in `localStorage` under a namespaced key; clearing them
  removes only the current user's shares, never public data.
- To roll back the feature, remove the route registrations, the handler entry
  in `api/[...path].js`, and the `src/components/caseCollaboration`,
  `src/data/civicCaseCollaborationData.js` and
  `src/services/civicCaseCollaborationService.js` files.

### 8.5 Observability

- All API errors return structured JSON (`error.code`, `error.message`).
- Rate-limit responses include `Retry-After`.
- No request bodies or headers are logged by the handler.
- Every access is recorded in the per-share `accessLog` (outcome, timestamp,
  actor, scope) for audit.

---

## 9. User workflow

### Citizen owner (create/share)
1. Open `/case-collaboration`.
2. Choose a case and select the specific items to share (item chips).
3. Choose a trusted helper (recipient), scope (view-only or view+download),
   expiry, optional max views and optional passcode.
4. Click **Create share link**. The engine returns a share token.
5. Share the token (e.g. `/case-collaboration?token=<token>`) with the helper
   through a separate channel. Pass the passcode separately if set.

### Helper (view/download)
1. Open the shared link `/case-collaboration?token=<token>`.
2. If passcode-protected, enter the passcode.
3. View the watermarked, read-only items. Download only if scope allows.
4. Access is time-bound and revocable; the owner can revoke at any time.

### Owner (manage/revoke)
1. Open `/case-collaboration` and switch to **Manage my shares**.
2. View active/revoked shares with view/download counts.
3. Click **Revoke** on any link to block access immediately (including cached).

---

## 10. Acceptance criteria status

| Criterion | Status |
|---|---|
| Architecture decision record | ✅ this document |
| Data-flow diagram | ✅ §3 |
| Threat model | ✅ §4 |
| Component ownership | ✅ §2.3 |
| Failure handling | ✅ §2.4 |
| Versioned schemas/contracts | ✅ §5 |
| Validate external input at trust boundaries | ✅ §3.1, `validateCollaborationRequest` |
| Unit + integration + end-to-end tests | ✅ service, API, component tests |
| Negative, permission, retry, concurrency cases | ✅ API tests |
| Observability | ✅ §8.5 |
| Safe error handling | ✅ structured errors, no body/header logging |
| Migration / rollback | ✅ §8.4 |
| Deployment documentation | ✅ §8 |
| Measurable evaluation criteria | ✅ §6 |
| Reproducible commands | ✅ §6 |
| Dependencies, licences, performance, cost limits | ✅ §7 |
| Synthetic fixtures; no citizen records / credentials / raw documents / sensitive prompts | ✅ §1, §5 |

---

## 11. Limitations & non-goals

- The sandbox stores shares in `localStorage` (client-side only); a production
  deployment should persist shares server-side with proper authentication while
  preserving the same policy contract (token, expiry, scope, revocation, audit).
- Share output is never acted upon autonomously; a human must create and revoke.
- Real citizen documents and production traffic are out of scope; production PII
  must never enter the share store.

*Data version: `civic-case-collaboration-v1`. Review date: `2026-11-23`.*
