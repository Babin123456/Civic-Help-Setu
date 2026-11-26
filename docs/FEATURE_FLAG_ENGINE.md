# Deterministic Feature Flag & Gradual Rollout Engine (#1337)

## Architecture
- **`src/services/featureFlagEngine.js`**: Isomorphic deterministic evaluator shared across browser and Node serverless functions.
- **`api/_lib/featureFlagGateway.js`**: Server-side registry loader (`DEFAULT_PLATFORM_FLAGS` + `FEATURE_FLAGS_JSON` + optional `remoteLoader`) with safe static defaults when remote config is unreachable.

### Evaluation Precedence
1. **Emergency Kill-Switch** (`killSwitch: true` -> disabled immediately)
2. **Blocklist** (`userIds`, `tenantIds`, `jurisdictions`)
3. **Allowlist** (`userIds`, `tenantIds`, `jurisdictions`)
4. **Deterministic Percentage Rollout** (32-bit FNV-1a mapped to `0..9999` basis points so rollouts are sticky and monotonic as `rolloutPercentage` increases)
5. **Static Default** (`defaultEnabled`)

## Threat Boundaries
- **Server-only flag isolation**: `GET` client projections filter `exposure: 'client'`, never exposing `exposure: 'server'` flags.
- **Kill-switch authorization**: `POST` mutations require `req.auth.role === 'admin'` or a valid `FEATURE_FLAG_ADMIN_TOKEN` and emit structured audit events.

## Failure Modes, Metrics & Rollback
- **Remote config outage**: `createServerFeatureFlagGateway` catches loader/validation errors, sets `degraded: true`, and falls back to `DEFAULT_PLATFORM_FLAGS` + `FEATURE_FLAGS_JSON`.
- **Instant rollback**: Activate `setKillSwitch(flagKey, true)` to disable a degraded feature without redeploying.
