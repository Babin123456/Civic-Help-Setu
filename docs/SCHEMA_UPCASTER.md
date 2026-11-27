# Versioned Payload Schema Upcaster & Backward-Compatibility Layer (#1462)

## Architecture
`api/_lib/schemaUpcaster.js` provides a deterministic, multi-hop payload schema upcaster and optional downcaster for civic APIs and offline-sync records.

- **Multi-hop pure transforms**: Registers per-version upcasters (`1 -> 2 -> 3`) and executes them deterministically without mutating caller inputs.
- **Prototype-pollution protection**: `safeClonePayload` strips `__proto__`, `constructor`, and `prototype` at every hop.
- **Idempotency**: Re-upcasting a payload already at `latestVersion` is a safe no-op (`upcasted: false`).
- **Unknown future versions**: Rejects payloads with `schemaVersion > latestVersion` using structured `SchemaUpcastError('UNSUPPORTED_FUTURE_VERSION')`.
