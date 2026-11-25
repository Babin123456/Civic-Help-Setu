# Resumable Bulk Import Engine with Validation, Checkpoints & Dead-Letter Recovery (Slice 1 & Slice 2)

This document specifies the architecture, storage engine, security threat model, data provenance guarantees, operational failure modes, and recovery procedures for the bulk import engine in Civic-Help-Setu.

---

## 1. Architecture Overview

The bulk import engine provides end-to-end resilience for municipal service catalog imports through schema validation, non-overwrite integrity checks, dead-letter queue quarantine, chunked execution with progress checkpoints, and an IndexedDB-backed persistence layer with automatic fallback.

```
                    ┌───────────────────────────────┐
                    │  Upload Dataset (CSV / JSON)  │
                    │  Size <= 5 MB, Rows <= 5,000  │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      buildImportPreview       │
                    │  Schema & Duplicate Checking  │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     Chunked executeImport     │
                    │ (Default: 100 rows per chunk) │
                    └───────┬───────────────┬───────┘
                            │               │
            ┌───────────────┘               └───────────────┐
            ▼                                               ▼
┌───────────────────────┐                       ┌───────────────────────┐
│ Commit Valid to Cat.  │                       │ Dead-Letter Queue     │
│ (importAdminServices) │                       │ (Invalid & Duplicate) │
└───────────┬───────────┘                       └───────────┬───────────┘
            │                                               │
            └───────────────────────┬───────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      Persist Checkpoint       │
                    │ (IndexedDB / LocalStorage)    │
                    │ Row Index, Counts, Timestamp  │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │  Interrupted / Paused │       │   Import Complete     │
        │     Batch Status      │       │ (VALIDATED / APPROVED)│
        └───────────┬───────────┘       └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │     resumeImport      │
        │ Resume from checkpoint│
        │ (Strict Idempotency)  │
        └───────────────────────┘
```

### Component Roles

- **`ImportConsole.jsx`**: Administrative UI providing file selection, live preview tables, dead-letter queue inspection, one-click failed-rows CSV download, targeted retry execution, checkpoint progress indicators (`Row X of Total`), and one-click **Resume** for interrupted imports.
- **`importValidationService.js`**: Core validation, parsing (RFC 4180 CSV & JSON), schema conformance checks, accurate reason-code tagging, CSV formula-injection neutralization, chunked slice processing (`DEFAULT_CHUNK_SIZE = 100`), and resumable execution orchestration (`resumeImport`).
- **`importBatchService.js`**: Dual-tier storage adapter (IndexedDB primary with automatic `localStorage`/in-memory fallback), batch metadata lifecycle manager, checkpoint persistence (`saveCheckpoint`, `getCheckpoint`, `clearCheckpoint`), dead-letter queue storage, rollback snapshot management, and retry reprocessing engine.
- **`adminService.js`**: Catalog persistence adapter (`civicbridge_custom_services`), enforcing atomic catalog updates, non-overwrite constraints on built-in services, and audit logging.

---

## 2. Storage Layer & Fallback Model (Slice 2)

The engine implements a resilient storage architecture that overcomes browser `localStorage` size limits while retaining full backward compatibility:

1. **IndexedDB Primary Store (`civicbridge_import_db`, version 1)**:
   - Stores:
     - `batches`: Full batch metadata records.
     - `checkpoints`: Resumable execution progress markers indexed by `batchId`.
     - `deadLetterQueue`: Quarantined rows with raw data and failure metadata.
   - Fully asynchronous, transaction-safe, and capable of holding large civic datasets.
2. **Synchronous Fallback (`localStorage` & In-Memory)**:
   - Automatically engaged if `indexedDB` is undefined (e.g. headless test runners, Node.js) or if database opening fails (e.g. privacy mode, security blocks, quota limits).
   - Allows synchronous access for existing components (`importRollbackService`, synchronous test fixtures) while supporting `.then()` and `await` promises.
3. **Zero Diagnostics Leak**:
   - All storage read/write exceptions are sanitized and reported through `logDiagnostic` from `src/utils/diagnostics.js`. No raw `console.error` or unhandled exceptions escape to the client.

---

## 3. Resumable Checkpoints & Chunked Execution

Large bulk imports are executed in discrete slices rather than all at once:

### 3.1 Checkpoint Data Structure

```json
{
  "id": "imp_9x8k2la",
  "batchId": "imp_9x8k2la",
  "processedRowIndex": 200,
  "processedRecordIndex": 200,
  "totalRecords": 850,
  "nextChunkIndex": 2,
  "status": "validating",
  "validRows": 190,
  "invalidRows": 8,
  "duplicateRows": 2,
  "updatedAt": "2026-11-24T14:40:00.000Z"
}
```

### 3.2 Resumption Semantics & Idempotency Guarantee

- **Safe Interruption**: If an import is interrupted by browser closure, network disconnect, or administrative pause, the progress up to the last completed chunk remains safely persisted in the catalog, dead-letter queue, and checkpoint store.
- **Strict Idempotency**: When `resumeImport` is triggered, the engine reads `checkpoint.processedRecordIndex` and skips all records prior to that index.
- **No Double-Imports**: Succeeded records from earlier chunks are never re-inserted into `civicbridge_custom_services`.
- **Completion & Cleanup**: When the final chunk completes, batch status transitions to `validated`, the checkpoint is cleared, and an approval event is logged with cumulative metrics.

---

## 4. Data Ownership & Provenance

Every record processed by the import engine tracks immutable provenance attributes throughout its lifecycle:

| Attribute | Description | Storage Location |
| :--- | :--- | :--- |
| `batchId` | Globally unique import batch identifier (`imp_...`) | Batch metadata & DLQ items |
| `sourceFile` | Original filename uploaded by the administrator | Batch record & DLQ metadata |
| `rowIndex` | 1-based original line number in the source file | DLQ records & validation errors |
| `rawData` | Exact raw field values extracted prior to schema normalization | DLQ entry |
| `reasonCodes` | Explicit machine-readable validation code (`VALIDATION_ERROR_CODE`) | DLQ entry & error logs |
| `fields` | Specific schema or file fields responsible for rejection | DLQ entry |
| `attemptCount` | Number of processing attempts (starts at 1, increments on retry) | DLQ entry |
| `actor` | Verified user identity initiating import or retry (`actorLabel()`) | Audit log & approval events |
| `timestamp` | UTC ISO-8601 timestamp of quarantine or mutation | DLQ entry & snapshots |

---

## 5. Threat Model & Security Controls

### 5.1 CSV Formula Injection (Direct Dynamic Execution / DDE)

- **Risk**: Spreadsheet software (Microsoft Excel, LibreOffice Calc, Google Sheets) interprets cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` as executable formula commands or external macro links (`DDE`).
- **Mitigation**: When exporting quarantined rows via `generateFailedRowsCsv` / `formatCsvCell`, any cell value whose string representation begins with one of those prefix characters is neutralized by prefixing an apostrophe (`'`). RFC 4180 quotation and comma escaping are also applied.

### 5.2 Oversized Payload Denial of Service (DoS)

- **Risk**: Extremely large files could exhaust browser memory or block the main JavaScript event loop during parsing.
- **Mitigation**:
  - Byte limit: `MAX_IMPORT_BYTES = 5,242,880` (5 MB, raised for Slice 2).
  - Row limit: `MAX_IMPORT_ROWS = 5,000` records per import batch (raised for Slice 2).
  - Chunked execution: Records are committed in batches of `100` (`DEFAULT_CHUNK_SIZE`) to ensure the browser remains responsive.
  - Files exceeding size or row thresholds are rejected immediately with descriptive error messages before processing begins.

### 5.3 Silent Overwrite Prevention & Catalog Integrity

- **Risk**: In bulk imports, accidental name or ID clashes could silently overwrite existing published services, corrupting municipal service directories.
- **Mitigation**:
  - Duplicate checks compare incoming records against both built-in (`MOCK_SERVICES`) and custom (`civicbridge_custom_services`) catalogs.
  - Checks evaluate both slugified ID (`service.id`) and normalized name (`normalizeName(service.name)`).
  - Any matching record is diverted to `report.duplicates` and quarantined in the dead-letter queue with `DUPLICATE_ID` or `DUPLICATE_NAME`. It is never written to the catalog.

---

## 6. Operational Failure Modes & Recovery

| Failure Mode | Detection | System Behavior & Fallback |
| :--- | :--- | :--- |
| **Interrupted / Paused Import** | Batch status is `validating` with an active checkpoint | Administrator clicks **Resume** in `ImportConsole`. Processing continues from `checkpoint.processedRecordIndex` without duplicating existing records. |
| **IndexedDB Unavailable / Blocked** | `indexedDB` is undefined or throws security error | Transparently falls back to `localStorage` and in-memory caches. Error logged via `logDiagnostic`. |
| **Storage Quota Exceeded** | `DOMException: QuotaExceededError` | Catches write failure, preserves pre-existing state without partial commits, and returns `{ ok: false, error: 'Saving failed...' }`. |
| **Corrupted Batch Storage** | `SyntaxError` on `JSON.parse` | Catches parse exception, logs diagnostic warning, and falls back to empty array default without throwing unhandled exceptions. |
| **Failed-Row Retry with Existing Catalog ID** | Re-evaluation during retry | If a row in the dead-letter queue still matches an existing catalog entry, it is marked as `duplicate` and stays quarantined with incremented attempt count. |

---

## 7. Operational Limits: Slice 1 vs. Slice 2

| Feature / Limit | Slice 1 | Slice 2 |
| :--- | :--- | :--- |
| **Primary Storage** | Synchronous `localStorage` | Asynchronous, transactional `IndexedDB` |
| **Storage Fallback** | Empty array default on parse error | Synchronous `localStorage` + in-memory store |
| **Maximum File Size** | 1 MB (`1,048,576` bytes) | 5 MB (`5,242,880` bytes) |
| **Maximum Rows** | 500 records | 5,000 records |
| **Execution Model** | Single-pass all-at-once | Chunked slices (`100` rows/chunk default) |
| **Resumption Support** | None (restart from zero) | Resumable checkpoints (`resumeImport`) |
| **UI Progress Tracking** | Card status badge | Live chunk/row progress + one-click Resume |

---

## 8. Rollout & Rollback Procedures

### Rollout Procedure
1. Enable `ImportConsole` route for administrative users (`role === 'admin'`).
2. Verify access control checks (`requirePermission('services.import')`).
3. Validate that pre-existing custom services, checkpoints, and IndexedDB stores initialize cleanly.

### Rollback Procedure
1. If an import batch produces undesired side-effects, navigate to the batch in `ImportConsole` and select **Rollback Batch**.
2. Rollback uses the pre-import snapshot recorded at `ROLLBACK_SNAPSHOT_TYPE.POST_VALIDATION` to revert batch status to `rolled_back` and records a structured audit event.
3. If an entire release rollback is required, existing catalog records in `civicbridge_custom_services` remain completely backward compatible.
