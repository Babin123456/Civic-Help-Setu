# Bulk Import Engine with Validation & Dead-Letter Recovery (Slice 1)

This document specifies the architecture, security threat model, data provenance guarantees, operational failure modes, and recovery procedures for the bulk import engine in Civic-Help-Setu.

---

## 1. Architecture Overview

Slice 1 establishes validation correctness, dead-letter quarantine with raw row data preservation, CSV formula injection defense, failed-row extraction, and targeted retry workflows.

```
                    ┌─────────────────────────┐
                    │ Upload (CSV / JSON)     │
                    │ Size <= 1 MB, Rows<= 500│
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │  buildImportPreview     │
                    │ Schema + Duplicate Check│
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
┌──────────────┐        ┌──────────────┐         ┌──────────────┐
│ Valid Rows   │        │ Invalid Rows │         │ Duplicate    │
│ Ready to save│        │ Schema errors│         │ Name/ID match│
└───────┬──────┘        └───────┬──────┘         └───────┬──────┘
        │                       │                        │
        │                       └───────────┬────────────┘
        │                                   ▼
        │                       ┌────────────────────────┐
        │                       │ Dead-Letter Quarantine │
        │                       │ Raw row data + reasons │
        │                       └───────────┬────────────┘
        │                                   │
        │                       ┌───────────┴────────────┐
        │                       ▼                        ▼
        ▼              ┌─────────────────┐     ┌──────────────────┐
┌───────────────┐      │ Export Failed   │     │ Targeted Retry   │
│ executeImport │      │ Rows (CSV)      │     │ Reprocess DLQ    │
│ Save to Cat.  │      │ DDE-neutralized │     │ (Idempotent)     │
└───────────────┘      └─────────────────┘     └──────────────────┘
```

### Component Roles

- **`ImportConsole.jsx`**: Administrative UI providing file selection, live preview tables, dead-letter queue inspection, one-click failed-rows CSV download, and targeted retry execution.
- **`importValidationService.js`**: Core validation, parsing (RFC 4180 CSV & JSON), schema conformance checks, accurate reason-code tagging, CSV formula-injection neutralization, and batch execution orchestration.
- **`importBatchService.js`**: Batch metadata lifecycle manager, dead-letter queue storage, rollback snapshot management, and retry reprocessing engine. Encapsulates storage operations to facilitate migration to IndexedDB in Slice 2.
- **`adminService.js`**: Storage adapter for custom services catalog (`civicbridge_custom_services`), enforcing atomic catalog updates, non-overwrite constraints on built-in services, and audit logging.

---

## 2. Data Ownership & Provenance

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

## 3. Threat Model & Security Controls

### 3.1 CSV Formula Injection (Direct Dynamic Execution / DDE)

- **Risk**: Spreadsheet software (Microsoft Excel, LibreOffice Calc, Google Sheets) interprets cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` as executable formula commands or external macro links (`DDE`).
- **Mitigation**: When exporting quarantined rows via `generateFailedRowsCsv` / `formatCsvCell`, any cell value whose string representation begins with one of those prefix characters is neutralized by prefixing an apostrophe (`'`). RFC 4180 quotation and comma escaping are also applied.

### 3.2 Oversized Payload Denial of Service (DoS)

- **Risk**: Extremely large files could exhaust browser memory or block the main JavaScript event loop during synchronous parsing.
- **Mitigation**: Strict pre-flight size limits are enforced before parsing begins:
  - Byte limit: `MAX_IMPORT_BYTES = 1,048,576` (1 MB).
  - Row limit: `MAX_IMPORT_ROWS = 500` records per import batch.
  - Files exceeding either threshold are rejected immediately with descriptive error messages.

### 3.3 Silent Overwrite Prevention & Catalog Integrity

- **Risk**: In bulk imports, accidental name or ID clashes could silently overwrite existing published services, corrupting municipal service directories.
- **Mitigation**:
  - Duplicate checks compare incoming records against both built-in (`MOCK_SERVICES`) and custom (`civicbridge_custom_services`) catalogs.
  - Checks evaluate both slugified ID (`service.id`) and normalized name (`normalizeName(service.name)`).
  - Any matching record is diverted to `report.duplicates` and quarantined in the dead-letter queue with `DUPLICATE_ID` or `DUPLICATE_NAME`. It is never written to the catalog.

---

## 4. Operational Failure Modes & Handling

| Failure Mode | Detection | System Behavior & Fallback |
| :--- | :--- | :--- |
| **Storage Quota Exceeded** | `DOMException: QuotaExceededError` | Catches write failure, cancels import, preserves pre-existing state without partial commits, and returns `{ ok: false, error: 'Saving failed...' }`. |
| **Corrupted Batch Storage** | `SyntaxError` on `JSON.parse` | Catches parse exception, logs diagnostic warning, and falls back to empty array default without throwing unhandled exceptions. |
| **Corrupted Catalog Storage** | Non-array / invalid JSON in services key | `adminService` refuses to import over corrupt catalog data, protecting historical records from accidental overwriting. |
| **Failed-Row Retry with Existing Catalog ID** | Re-evaluation during retry | If a row in the dead-letter queue still matches an existing catalog entry, it is marked as `duplicate` and stays quarantined with incremented attempt count. |

---

## 5. Current Limits (Slice 1) vs. Slice 2 Roadmap

### Slice 1 Limits
- Storage: Synchronous `localStorage` with JSON serialization.
- Max Payload: 1 MB.
- Max Rows: 500 rows per batch.
- Execution: Single-pass validation and execution in main thread.

### Slice 2 Roadmap
- **IndexedDB Storage**: Asynchronous, transactional storage replacing `localStorage` to overcome 5 MB browser storage limits.
- **Chunked Resumable Checkpoints**: Progress tracking across large datasets with pause/resume support.
- **Web Worker Offloading**: Moving CSV parsing and schema validation off the UI thread for zero frame drops.

---

## 6. Rollout & Rollback Procedures

### Rollout Procedure
1. Enable `ImportConsole` route for administrative users (`role === 'admin'`).
2. Verify access control checks (`requirePermission('services.import')`).
3. Validate that pre-existing custom services and built-in mock services load cleanly.

### Rollback Procedure
1. If an import batch produces undesired side-effects, navigate to the batch in `ImportConsole` and select **Rollback Batch**.
2. Rollback uses the pre-import snapshot recorded at `ROLLBACK_SNAPSHOT_TYPE.POST_VALIDATION` to revert batch status to `rolled_back` and records a structured audit event.
3. If an entire release rollback is required, existing catalog records in `civicbridge_custom_services` remain completely backward compatible with pre-Slice-1 versions.
