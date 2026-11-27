# Offline-First Civic Application Draft Sync Engine

> **Issue**: [#1424](https://github.com/GoldRay19/Civic-Help-Setu/issues/1424)
> **Branch**: `feat/offline-draft-sync-1424`
> **Status**: Implemented

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Flow](#3-data-flow)
4. [Schema Versioning Strategy](#4-schema-versioning-strategy)
5. [Encryption Approach](#5-encryption-approach)
6. [Conflict Resolution Flow](#6-conflict-resolution-flow)
7. [Idempotency](#7-idempotency)
8. [Interrupted-Upload Recovery](#8-interrupted-upload-recovery)
9. [Privacy & PII Enforcement](#9-privacy--pii-enforcement)
10. [API Reference](#10-api-reference)
11. [Configuration](#11-configuration)
12. [Monitoring & Alerting](#12-monitoring--alerting)
13. [Rollback Procedure](#13-rollback-procedure)
14. [Testing](#14-testing)
15. [Data Provenance Badges](#15-data-provenance-badges)

---

## 1. Problem Statement

Users with unstable or intermittent connectivity can lose long civic application drafts or create duplicate submissions when reconnecting. The system must:

- Persist drafts locally while offline
- Sync reliably when connectivity returns, without duplicates
- Detect and surface edit conflicts when multiple devices or sessions modify the same draft
- Give users explicit control over conflict resolution
- Never silently overwrite civic application data
- Enforce zero-PII in all stored and transmitted payloads

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Browser / Client                          │
│                                                             │
│  CitizenDraftSyncWorkspace.jsx (UI)                        │
│      │                                                      │
│      ├─── citizenDraftService.js (domain state machine)     │
│      │        └─── citizenDraftSyncEngine.js (core engine)  │
│      │                  ├── localStorage (ops queue)        │
│      │                  └── localStorage (draft store)      │
│      │                                                      │
│      └─── civicDraftSyncExtension.js (new in #1424)        │
│               ├── Schema migration                          │
│               ├── AES-GCM encrypted storage                │
│               ├── Deterministic idempotency keys            │
│               ├── Exponential backoff retry                 │
│               └── Interrupted-upload recovery               │
└─────────────────────────────────────────────────────────────┘
                           │  HTTPS + Bearer JWT
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Vercel Serverless API                     │
│                                                             │
│  api/[...path].js (router)                                  │
│      └─── handlers/civic-draft-sync.js (new in #1424)      │
│               ├── Clerk JWT auth                            │
│               ├── Rate limiting (30 req/min)                │
│               ├── PII screening                             │
│               └── civicDraftSyncStore.js                   │
│                       └── InMemoryCivicDraftSyncStore       │
│                               (bounded, 500 max, audit log) │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Role |
|------|------|
| `src/services/citizenDraftSyncEngine.js` | Core offline sync engine (3-way merge, op queue, tombstones, revisions) |
| `src/services/citizenDraftService.js` | Domain state machine (DRAFT_LOCAL → QUEUED → SYNCING → SYNCED/CONFLICTED) |
| `src/services/civicDraftSyncExtension.js` | **New (#1424)**: schema migration, encryption, idempotency keys, backoff retry |
| `src/pages/CitizenDraftSyncWorkspace.jsx` | UI: draft list, conflict resolution panel, offline banner, sync controls |
| `api/_lib/handlers/civic-draft-sync.js` | **New (#1424)**: server-side REST handler |
| `api/_lib/civicDraftSyncStore.js` | **New (#1424)**: bounded in-memory draft store with audit log |

---

## 3. Data Flow

```
flowchart TD
    A[User edits draft offline] --> B[citizenDraftService.updateDraft]
    B --> C{Is online?}
    C -- No --> D[enqueueOperation — localStorage]
    C -- Yes --> E[enqueueOperation + processSyncQueue]
    D --> F[browser 'online' event fires]
    F --> G[recoverInterruptedUploads]
    G --> H[processSyncQueueWithRetry]
    H --> I{3-Way Diff}
    I -- No conflict --> J[saveRevision — SYNCED]
    I -- Conflict --> K[ConflictRecord stored — CONFLICTED]
    K --> L[User resolves in UI]
    L --> M[resolveConflict — SYNCED]
    H -->|POST /api/civic-draft-sync| N[Server handler]
    N --> O[civicDraftSyncStore.upsertDraft]
    O -->|Stale revision| P[409 Conflict response]
    O -->|Fresh| Q[201 Created]
```

---

## 4. Schema Versioning Strategy

The engine uses a monotonic `SCHEMA_VERSION` constant (currently `1`) exported from `citizenDraftSyncEngine.js`.

### Versioning Rules

1. **Never decrement** the schema version.
2. All stored records carry a `schemaVersion` field.
3. On application startup, `migrateAllLocalDrafts()` upgrades stale records.
4. Migration functions are registered with `registerSchemaMigration(fromVersion, fn)`.

### Adding a New Migration

```js
// src/services/civicDraftSyncExtension.js
registerSchemaMigration(1, (record) => ({
  ...record,
  newField: record.newField ?? 'default_value',
  schemaVersion: 2,
}));
// Also bump SCHEMA_VERSION in citizenDraftSyncEngine.js to 2
```

The migration function must be **pure** (no side effects) and **idempotent** (safe to apply twice).

---

## 5. Encryption Approach

Sensitive draft payloads can be encrypted at rest in localStorage using the **Web Crypto API (AES-GCM, 256-bit)**.

### How It Works

1. A per-session passphrase is derived from the user's Clerk session identity (not stored).
2. `encryptedWrite(key, value, passphrase)` derives an AES-GCM key via **PBKDF2** (100,000 iterations, SHA-256) with a random 16-byte salt + 12-byte IV.
3. The IV, salt, and ciphertext are stored as a JSON object under a namespaced key (`civicbridge_enc_v1_<key>`).
4. `encryptedRead(key, passphrase)` reverses the process.
5. **Graceful fallback**: If `crypto.subtle` is unavailable (e.g., non-secure origins, test environments), data is stored as plaintext with an `_enc: false` marker.

### What Is Encrypted

- Currently: opt-in encryption for `application_draft` payloads containing sensitive form fields.
- Not encrypted: checklist items or saved notes (lower sensitivity, encrypted at transport by HTTPS).

> [!IMPORTANT]
> The passphrase must NEVER be persisted to localStorage or transmitted to any server.

---

## 6. Conflict Resolution Flow

The engine performs **3-way merging** using base, local, and remote snapshots.

### Auto-Merge Rules

| Scenario | Outcome |
|----------|---------|
| Only local changed | Accept local |
| Only remote changed | Accept remote |
| Both changed to same value | Accept (no conflict) |
| Both changed, arrays of strings | Set union (safe merge) |
| Both changed, different scalars | **ConflictRecord required** |

### Manual Resolution (UI)

When a genuine conflict is detected:

1. The draft's `syncStatus` is set to `CONFLICTED`.
2. A `ConflictRecord` is persisted with `localData`, `remoteData`, and `conflictFields`.
3. The UI shows a **side-by-side comparison** of conflicting fields.
4. The user chooses one of:
   - **Keep Mine** (`KEEP_LOCAL`) — overwrite server version with local
   - **Use Server** (`KEEP_REMOTE`) — discard local changes
   - **Custom Merge** (`MANUAL_MERGE`) — per-field or free-text custom value
5. `resolveConflict()` commits the chosen state as a new revision and clears the conflict.

> [!WARNING]
> Conflicts are **never auto-resolved for free-text civic fields** (names, descriptions, notes). These always require explicit user confirmation to avoid silently overwriting civic application data.

---

## 7. Idempotency

### Client-Side (Operation Queue)

Each offline operation carries an `idempotencyKey` generated by `generateDraftIdempotencyKey()`:

```js
const key = generateDraftIdempotencyKey({ draftId, userId, schemaVersion, revisionHint });
// → "dsync_a1b2c3d4"  (stable FNV-1a hash)
```

Submitting the same operation twice returns the existing queued op without re-enqueueing.

### Server-Side (API Layer)

The API endpoint re-uses the existing `idempotencyMiddleware.js` / `idempotencyStore.js` layer (registered in `api/[...path].js`). A duplicate POST with the same `Idempotency-Key` header returns the cached `201` response.

---

## 8. Interrupted-Upload Recovery

When the browser tab is closed or the page reloads during a sync:

1. Any operations with `status: IN_FLIGHT` are orphaned.
2. On next mount, `recoverInterruptedUploads()` resets them to `PENDING`.
3. `processSyncQueueWithRetry()` picks them up and retries with exponential backoff.

**Backoff schedule** (defaults):

| Attempt | Min delay | Max delay (with jitter) |
|---------|-----------|------------------------|
| 1 | ~1 s | ~1.3 s |
| 2 | ~2 s | ~2.6 s |
| 3 | ~4 s | ~5.2 s |
| 4 | ~8 s | ~10.4 s |
| 5 | ~16 s | ~20.8 s |

---

## 9. Privacy & PII Enforcement

> [!CAUTION]
> The following data is **explicitly forbidden** in any draft payload, both client-side and server-side.

- **Aadhaar numbers** (12-digit patterns)
- **PAN numbers** (ABCDE1234F patterns)
- **Personal phone numbers**
- **Exact residential addresses** (flat/door/house numbers)
- **Passwords, OTPs, biometrics**
- **Child names or faces**

Enforcement is multi-layered:
1. `citizenDraftSyncEngine.js` → `sanitizeTextFields()` strips HTML and control chars before storing
2. `civicDraftSyncExtension.js` → `isCryptoAvailable()` + encrypted storage where supported
3. `handlers/civic-draft-sync.js` → `screenPayloadForPII()` runs on every POST payload (uses `inspectStringForPII` from `piiLeakageGuardService.js`)
4. Admin audit log entries are stripped of payload content

---

## 10. API Reference

### Authentication

All endpoints require a Clerk JWT Bearer token: `Authorization: Bearer <token>`

### Rate Limits

30 requests per minute per client key.

---

### `GET /api/civic-draft-sync`

List the authenticated user's server-synced drafts.

**Query parameters:**

| Name | Type | Description |
|------|------|-------------|
| `entityType` | string | Filter by `checklist`, `application_draft`, `saved_note` |
| `limit` | integer | Max 100, default 50 |
| `offset` | integer | Pagination offset, default 0 |

**Response `200`:**
```json
{
  "items": [ { "draftId": "...", "entityType": "...", "revision": 2, "syncStatus": "SYNCED", ... } ],
  "total": 5,
  "limit": 50,
  "offset": 0,
  "generatedAt": "2026-11-27T10:00:00.000Z"
}
```

---

### `POST /api/civic-draft-sync`

Upsert a draft. Idempotent via `Idempotency-Key` header.

**Headers:** `Idempotency-Key: <client-generated-key>`

**Request body:**
```json
{
  "draftId": "draft-abc123",
  "entityType": "application_draft",
  "schemaVersion": 1,
  "payload": { "serviceName": "Ration Card", "formData": { "ward": "Ward 5" } },
  "idempotencyKey": "dsync_a1b2c3d4",
  "jurisdictionId": "ward-5"
}
```

**Response `201`:** Draft created/updated successfully.
```json
{ "draftId": "draft-abc123", "revision": 1, "syncStatus": "SYNCED" }
```

**Response `409`:** Conflict detected (stale revision).
```json
{
  "error": "Conflict detected",
  "code": "ERR_CONFLICT_DETECTED",
  "conflict": {
    "draftId": "draft-abc123",
    "serverRevision": 3,
    "clientRevision": 1,
    "conflictAt": "2026-11-27T10:05:00.000Z"
  },
  "instructions": "Retrieve the server copy, merge locally, then POST again with the resolved payload."
}
```

**Response `400`:** Validation error (missing fields, PII detected, payload too large).

---

### `POST /api/civic-draft-sync/resolve`

Resolve a conflict for a draft. Requires ownership.

**Request body:**
```json
{
  "draftId": "draft-abc123",
  "strategy": "MANUAL_MERGE",
  "resolvedPayload": { "serviceName": "Ration Card", "ward": "Ward 5 (merged)" }
}
```

**Strategies:** `KEEP_LOCAL`, `KEEP_REMOTE`, `MANUAL_MERGE`

**Response `200`:**
```json
{ "draftId": "draft-abc123", "revision": 4, "syncStatus": "SYNCED", "strategy": "MANUAL_MERGE", "resolvedAt": "..." }
```

---

### `GET /api/civic-draft-sync/audit-log`

**Roles:** `admin`, `municipal_officer` only.

Returns a paginated, payload-free audit trail of all store operations.

---

## 11. Configuration

| Environment variable | Required | Description |
|----------------------|----------|-------------|
| `CLERK_SECRET_KEY` | Yes | Clerk SDK secret key for JWT verification |
| `APP_ORIGIN` | Yes | Allowed CORS origin (enforced by `requestSecurity.js`) |

---

## 12. Monitoring & Alerting

### Metrics to Track

- `civic_draft_sync_upsert_total` — total successful upserts per hour
- `civic_draft_sync_conflict_total` — conflicts detected per day
- `civic_draft_sync_conflict_resolution_total` — by strategy
- `civic_draft_sync_pii_reject_total` — PII rejections per day (should be near-zero)
- `civic_draft_sync_rate_limit_total` — rate limit hits

### Alert Thresholds

- PII rejections > 0 in a 10-minute window → urgent investigation
- Conflict rate > 20% of upserts → sync algorithm review needed
- Store size approaches 500 → scale or add persistence layer

---

## 13. Rollback Procedure

The handler is stateless in production (no DB). Rolling back is a code rollback:

1. `git revert` the commit adding `civic-draft-sync` import in `api/[...path].js`
2. The route handler is simply not registered; requests return 404
3. Client-side: the extension module is tree-shaken out at build time
4. Local draft data in localStorage is unaffected by a server rollback

For the client-side extension:

1. Remove the import of `civicDraftSyncExtension.js` from `CitizenDraftSyncWorkspace.jsx`
2. The existing `citizenDraftSyncEngine.js` continues to function independently

---

## 14. Testing

### Run All Tests for This Feature

```powershell
npm.cmd test -- --run src/services/civicDraftSyncExtension.test.js tests/civic-draft-sync.test.js src/pages/CitizenDraftSyncWorkspace.test.jsx
```

### Test Coverage Areas

| Test file | Covers |
|-----------|--------|
| `src/services/civicDraftSyncExtension.test.js` | Idempotency keys, schema migration, backoff, interrupted recovery, PII |
| `tests/civic-draft-sync.test.js` | Store CRUD, conflict detection, data scoping, audit log |
| `src/pages/CitizenDraftSyncWorkspace.test.jsx` | UI rendering, offline/error states, conflict resolution UI |
| `src/services/citizenDraftSyncEngine.test.js` | Core engine (pre-existing, extended) |

---

## 15. Data Provenance Badges

All data shown in the UI must clearly indicate its source. The `getProvenanceLabel()` function and `PROVENANCE_TYPES` enum in `civicDraftSyncExtension.js` provide canonical labels:

| Type | Label shown to user |
|------|-------------------|
| `citizen_entered` | "You entered this" |
| `official_record` | "From official records" |
| `ai_suggestion` | "AI suggestion — please verify" |
| `community_submission` | "Community submission — unverified" |

These badges must be rendered alongside any pre-filled or auto-suggested draft fields in the UI.
