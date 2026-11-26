# Secure Partner Data Ingestion Boundary with Signed Manifests (#1275)

## 1. Executive Summary & Problem Context

Civic datasets (such as ration distribution metrics, public facility repairs, citizen feedback feeds, and municipal utility inventories) are frequently provided by external partners, non-governmental organizations, and regional administrative nodes. Ingesting this data directly into internal databases without rigorous cryptographic and authorization controls introduces severe vulnerabilities:
- **Tampered or Malicious Payloads:** Files modified in transit or substituted with unverified contents.
- **Replay Attacks:** Resubmission of previous valid packages to manipulate civic metrics or overwrite updated records.
- **Revoked Credential Abuse:** Compromised partner keys used after administrative revocation.
- **Data Classification Violations:** Low-trust partners attempting to publish into restricted or internal-only categories.
- **Audit Poisoning & Secret Leakage:** Storing sensitive raw payload data or cryptographic keys in logs and audit trails.

The **Partner Ingestion Boundary Engine** (`api/_lib/partnerIngestionBoundary.js`) establishes a hardened, transport-agnostic security perimeter. It enforces an immutable 7-step cryptographic verification sequence, serialized atomic nonce replay protection, strict key lifecycle controls, durable Firestore persistence with memory fallback, and a **fail-closed production storage policy**.

---

## 2. Ingestion Entry Point Discovery

Before implementing this subsystem, an architectural survey of the codebase identified existing data ingestion mechanisms:

1. **`api/import-batches.js`**:
   - The primary backend endpoint handling bulk dataset imports (CSV and JSON) with Clerk-based authentication, single-flight locking, dry-run parsing, and snapshot rollbacks.
2. **`src/services/importValidationService.js`**:
   - The client- and server-side record validation service that parses individual row schemas, validates required civic fields, and flags malformed entries.

### Architectural Gatekeeper Model

The Partner Ingestion Boundary operates upstream of these mechanisms:
```
[External Partner / Ingestion Transport]
                   │
                   ▼ (Normalized Package: Manifest + Signed Digest + Payloads)
┌─────────────────────────────────────────────────────────────┐
│             Partner Ingestion Boundary Engine               │
│   (Immutable 7-Step Verification, Nonce Replay Guard)       │
└──────────────┬───────────────────────────────┬──────────────┘
               │ (Rejected / Quarantined)      │ (Verified / PROMOTE_ELIGIBLE)
               ▼                               ▼
       [Quarantine Storage]          [Internal Batch Processing]
  (Zero PII / Audit Logged)         (`api/import-batches.js` &
                                 `src/services/importValidationService.js`)
```

By decoupling verification from transport, the boundary can ingest packages originating from HTTP multipart uploads, webhooks, asynchronous cloud storage triggers, or message brokers without duplicating security logic.

---

## 3. Package & Manifest Specification

A partner ingestion submission consists of a normalized package containing:
- `manifest`: JSON object detailing metadata, file checksums, and authorization context.
- `files`: In-memory dictionary or map of file buffers (`{ "filename.csv": "<content or buffer>" }`).
- `signature`: Hex-encoded HMAC-SHA256 signature generated over canonical JSON representation of the manifest.

### Canonical Manifest Schema (`partner_manifest_v1`)

```json
{
  "schemaVersion": "partner_manifest_v1",
  "manifestId": "man_2026_q1_pds_0042",
  "partnerId": "partner_civic_org_01",
  "keyId": "key_2026_primary",
  "issuedAt": "2026-11-24T10:00:00.000Z",
  "expiresAt": "2026-11-24T12:00:00.000Z",
  "nonce": "c49a64e1-2f6d-4951-872e-0a56d98c25cf",
  "dataClassification": "PUBLIC",
  "files": [
    {
      "name": "ration_distribution_nov2026.csv",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "sizeBytes": 1048576
    }
  ]
}
```

---

## 4. Fixed 7-Step Verification Protocol

The verification engine enforces a deterministic, fail-fast sequence. Each step evaluates a single security dimension; if any step fails, verification halts immediately, records the designated failure step and reason code, quarantines the package, and writes a tamper-evident audit record.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   Fixed 7-Step Verification Pipeline                    │
├──────┬──────────────────────────────────────────┬───────────────────────┤
│ Step │ Verification Stage                       │ Failure Reason Code   │
├──────┼──────────────────────────────────────────┼───────────────────────┤
│  1   │ Schema Version & Required Fields         │ ERR_SCHEMA_INVALID    │
│      │                                          │ ERR_REQUIRED_FIELD_*  │
├──────┼──────────────────────────────────────────┼───────────────────────┤
│  2   │ Signature & Hex Format Check             │ ERR_SIGNATURE_INVALID │
│      │ (Web Crypto HMAC-SHA256 over canonical)  │ ERR_SIGNATURE_MAL*    │
├──────┼──────────────────────────────────────────┼───────────────────────┤
│  3   │ Partner & Key Status / Revocation        │ ERR_PARTNER_UNKNOWN   │
│      │ (Active partner, non-revoked key)        │ ERR_KEY_REVOKED       │
├──────┼──────────────────────────────────────────┼───────────────────────┤
│  4   │ Manifest Validity Window & Expiration    │ ERR_MANIFEST_EXPIRED  │
│      │ (issuedAt <= now <= expiresAt <= maxWin) │ ERR_MANIFEST_NOT_YET* │
├──────┼──────────────────────────────────────────┼───────────────────────┤
│  5   │ Atomic Nonce Replay Check & Consume      │ ERR_NONCE_REPLAYED    │
│      │ (Serialized atomic uniqueness by partner)│                       │
├──────┼──────────────────────────────────────────┼───────────────────────┤
│  6   │ File Checksum & Size Integrity Check     │ ERR_FILE_MISSING      │
│      │ (Byte-length and SHA-256 hex match)      │ ERR_FILE_CHECKSUM_*   │
├──────┼──────────────────────────────────────────┼───────────────────────┤
│  7   │ Data Classification Authorization        │ ERR_DATA_CLASSIFI*    │
│      │ (PUBLIC, OFFICIAL, RESTRICTED, CONFID*)  │                       │
└──────┴──────────────────────────────────────────┴───────────────────────┘
```

### Detailed Pipeline Stages

1. **Step 1: Schema Version & Required Fields**
   - Validates `schemaVersion === 'partner_manifest_v1'`.
   - Ensures all mandatory attributes (`manifestId`, `partnerId`, `keyId`, `issuedAt`, `expiresAt`, `nonce`, `files`, `dataClassification`) exist.
   - Verifies `files` is a non-empty array with valid file descriptors (`name`, `sha256`, `sizeBytes`).
2. **Step 2: Signature Verification via Web Crypto**
   - Enforces valid hex format (`/^[0-9a-f]+$/i` and even length).
   - Canonicalizes manifest keys recursively using deterministic ASCII sort (omitting any embedded `signature` property).
   - Verifies HMAC-SHA256 using standard Node.js Web Crypto (`globalThis.crypto.subtle`) with zero third-party dependencies.
3. **Step 3: Partner & Key Status / Revocation Check**
   - Resolves partner status (`ACTIVE`).
   - Verifies cryptographic key ID is actively registered to the partner and not marked `REVOKED`.
4. **Step 4: Manifest Validity Window**
   - Ensures `issuedAt <= currentTime <= expiresAt`.
   - Prevents stale manifests and enforces `expiresAt - issuedAt <= maxValidityWindowMs` (default 24 hours).
5. **Step 5: Atomic Nonce Replay Protection**
   - Consumes compound key `${partnerId}:${nonce}` atomically within a synchronized queue lock.
   - Persists nonce until `expiresAtMs` to prevent concurrent race conditions or replay submissions.
6. **Step 6: Per-File SHA-256 Checksum & Size Integrity**
   - Confirms every file in the manifest exists in the payload package.
   - Calculates exact byte length and SHA-256 digest using Web Crypto, comparing against the manifest's declared values.
7. **Step 7: Declared Data Classification Authorization**
   - Validates `dataClassification` against allowed classifications configured for the partner (`PUBLIC`, `OFFICIAL`, `RESTRICTED`, `CONFIDENTIAL`).

---

## 5. Storage Adapters & Fail-Closed Production Rule

### Storage Adapter Contract
Any storage adapter powering the boundary must fulfill the contract:
- `read(key)`: Retrieves record.
- `write(key, data)`: Persists record.
- `remove(key)`: Deletes record.
- `consumeNonce(partnerId, nonce, expiresAtMs, currentTime)`: Atomically checks existence and consumes a nonce.
- `getPartner(partnerId)` / `registerPartner(partner)`: Partner profile management.
- `getKey(partnerId, keyId)` / `registerKey(key)` / `revokeKey(partnerId, keyId)`: Key lifecycle.
- `getBatch(batchId)` / `saveBatch(batch)`: Ingestion batch tracking.
- `isDurable`: Boolean indicating whether persistence spans multiple process lifecycles.

### Firestore Durable Storage Adapter (`createFirestoreIngestionStorageAdapter`)
Implemented in Slice 2, the Firestore adapter provides distributed, persistent storage across serverless instances:
- **Collections:**
  - `${prefix}_partners`: Partner configuration, status, allowed classifications.
  - `${prefix}_keys`: Key records with revoked flags (`${partnerId}:${keyId}`).
  - `${prefix}_nonces`: Consumed nonces with TTL tracking (`${partnerId}:${nonce}`).
  - `${prefix}_batches`: Audit logs and batch status records (`pkg_${manifestId}`).
- **Atomic Transactions:** Uses Firestore `runTransaction` to atomically check whether a nonce exists and is unexpired, rejecting replays and safely overwriting stale nonces.
- **Graceful Memory Fallback:** If Firebase Admin is unconfigured (`getFirestoreAdmin()` returns `null` or credentials are missing), the adapter gracefully delegates to `createMemoryStorageAdapter()`, logs diagnostics via `logDiagnostic` (never raw console errors), and marks `isDurable: false`.

### Process-Local Memory Adapter
`createMemoryStorageAdapter()` stores keys, nonces, and batches in process memory. It explicitly declares:
```javascript
isDurable: false
```
**Limitation:** Memory storage is process-local. It does not provide global replay protection across distributed serverless instances or surviving process restarts.

### Fail-Closed Production Rule
To guarantee system integrity in production deployments, `promoteBatch` enforces the fail-closed invariant:
```javascript
if (environment === 'production' && !storage.isDurable && !allowMemoryInProduction) {
  return {
    ok: false,
    status: 500,
    decision: 'REJECTED',
    reasonCode: REASON_CODES.FAIL_CLOSED_PRODUCTION_DURABLE_STORAGE_REQUIRED,
    message: 'Production batch promotion requires a durable storage adapter.',
  };
}
```
In-memory storage is strictly prohibited from promoting batches in `production` unless an explicit testing flag is passed.

---

## 6. HTTP API Route & Serverless Dispatcher

The boundary is exposed via `api/partner-ingestion.js` and `createPartnerIngestionHandler`:

### Supported Endpoints & Actions

| Endpoint | Method | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `/api/partner-ingestion` | `POST` | None (Signed Manifest) | Ingests and verifies a partner package `{ manifest, files, signature }`. Returns `200` on success or `400` with quarantine details. |
| `/api/partner-ingestion` | `POST` (`action: 'promote'`) | Admin Only | Promotes an accepted batch (`{ action: 'promote', batchId }`). Fails closed (500) if durable storage is missing in production. |
| `/api/partner-ingestion?batchId=<id>` | `GET` | Authenticated User | Retrieves sanitized, non-PII batch metadata. Returns `200` or `404`. |
| `/api/partner-ingestion?metrics=true` | `GET` | Admin Only | Returns boundary telemetry metrics snapshot (`totalProcessed`, `replaysPrevented`, etc.). |

---

## 7. Threat Model & Mitigations

| Threat Vector | Attack Scenario | Boundary Mitigation |
| :--- | :--- | :--- |
| **Replay Attack** | Attacker intercepts a valid package and resubmits it 5 minutes later. | Step 5 detects identical compound nonce `${partnerId}:${nonce}` in Firestore / memory and quarantines package with `ERR_NONCE_REPLAYED`. |
| **Concurrent Double-Submit** | Two parallel HTTP worker threads submit identical nonces simultaneously. | `withLock` promise queue + Firestore `runTransaction` serializes nonce checks, ensuring only one submission succeeds. |
| **Manifest Tampering** | Attacker alters `dataClassification` from `PUBLIC` to `RESTRICTED`. | Canonical JSON serialization changes the payload digest, causing Step 2 HMAC verification to fail with `ERR_SIGNATURE_INVALID`. |
| **File Substitution** | Attacker keeps valid signed manifest but modifies CSV file rows. | Step 6 computes SHA-256 over received bytes and rejects with `ERR_FILE_CHECKSUM_MISMATCH`. |
| **Revoked Key Reuse** | Attacker uses a leaked key after the partner reported it revoked. | Step 3 checks key revocation registry before processing files, failing with `ERR_KEY_REVOKED`. |
| **Secret / PII Leakage** | Operational logs or audit records expose secrets or citizen data. | Zero raw secrets or file payloads stored in batch records or audit entries. Only manifest digests and metadata are retained. |
| **Storage Fault Degradation** | Storage adapter experiences I/O error during key lookup. | Engine catches storage exceptions, logs diagnostics via sanitized logger, and safely falls back to quarantine without crashing. |

---

## 8. Observability, Metrics & Operational Runbook

### Telemetry Snapshot (`getMetrics()`)
The engine exposes operational metrics:
```javascript
const metrics = engine.getMetrics();
// {
//   totalProcessed: 142,
//   acceptedCount: 138,
//   quarantinedCount: 4,
//   replaysPrevented: 2,
//   revokedKeyAttempts: 1,
//   reasonCodeCounts: {
//     ERR_NONCE_REPLAYED: 2,
//     ERR_KEY_REVOKED: 1,
//     ERR_FILE_MISSING: 1
//   }
// }
```

### Alerting Thresholds & Operational SLOs
1. **Nonce Replay Alert:** `replaysPrevented > 0` triggers an operational security warning.
2. **Revoked Key Alert:** Any submission under a revoked key immediately generates an audit flag for partner investigation.
3. **Quarantine Spike:** Quarantined ratio exceeding 5% over 15 minutes suggests partner configuration drift or signature tooling issues.

---

## 9. Verification & Test Suite

The test suite in `tests/partner-ingestion-boundary.test.js` covers 43 synthetic test cases across:
1. **Cryptographic Operations:** Web Crypto SHA-256 consistency, canonical JSON key sorting, HMAC signing and verification.
2. **Storage Adapter Contracts:** In-memory adapter vs. custom durable adapter contract validation.
3. **Fixed 7-Step Verification Order:** Isolated step-by-step tests (Steps 1 through 7) and machine-readable reason codes.
4. **Concurrency & Replay Safety:** Concurrent race condition tests verifying serialized nonce consumption.
5. **Promotion & Quarantine Invariants:** Permanent quarantine lock and production fail-closed enforcement.
6. **Audit Privacy:** Ensuring zero secrets or payload content leak into audit events.
7. **Degraded Storage Resilience:** Storage disk and I/O failure containment via `logDiagnostic`.
8. **Firestore Storage Adapter (Slice 2):** Contract, `isDurable: true`, transactions, key revocation, and memory fallback.
9. **HTTP API Handler (Slice 2):** Package verification POST, rate limiting, authenticated GET by batchId, admin promotion, admin metrics, and method rejection.
10. **State Continuity Across Re-instantiation (Slice 2):** Cross-instance replay prevention and key revocation enforcement against shared durable storage.

---

## 10. Slice 1 + Slice 2 Completion & Production Verification

Both Slice 1 and Slice 2 are fully implemented and verified:
- **Boundary Engine:** `api/_lib/partnerIngestionBoundary.js`
- **Serverless API Route:** `api/partner-ingestion.js`
- **Test Suite:** `tests/partner-ingestion-boundary.test.js` (43 passed tests)
- **Security Audit:** Zero warnings under `eslint.security.config.js`
- **Build Verification:** Successful `vite build` production compilation
