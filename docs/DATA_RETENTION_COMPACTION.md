# Deterministic Data Retention, Archival & Tombstone Compaction (#1350)

## Architecture
`api/_lib/retentionCompactor.js` provides a policy-driven retention, cold-archival, and cryptographic tombstone compaction engine for civic collections.

### Key Guarantees
- **Dry-run by default**: `mode: 'dry-run'` scans bounded batches and reports exact `expiredCandidates` and `skippedLegalHold` counts without mutating records.
- **Legal-hold & active-dispute protection**: Records with `legalHold: true` or `activeDispute: true` are never archived or deleted.
- **Privacy-safe tombstones**: `computeTombstoneHash` hashes only `(collection, id, createdAt, updatedAt, archivedAt)` using SHA-256—no citizen PII is retained in tombstones.
- **Idempotency & partial-batch resilience**: Records with an existing tombstone are skipped cleanly; single-record errors are captured in `summary.errors` without aborting the batch.

## Operator Runbook
1. Run `compactor.runAll({ mode: 'dry-run' })` and inspect `expiredCandidates` and `skippedLegalHold`.
2. Execute `compactor.runAll({ mode: 'enforce' })` during low-traffic windows.
3. Monitor `summary.errors.length` (alert if `> 0`) and `summary.compacted`.
