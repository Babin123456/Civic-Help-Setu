# Abuse Control Plane — Deployment, Migration, and Rollback (#1174)

## 1. Environment variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `ABUSE_CONTROL_SECRET` | Yes | HMAC secret for privacy-minimized identifiers. Rotate periodically. | `dev-secret-change-me` (dev only) |
| `FIREBASE_SERVICE_ACCOUNT` | No | Firestore Admin credentials. If absent, limits run in-memory per instance. | — |

## 2. Deployment

The control plane is a Vercel serverless function:

```json
// vercel.json (existing routes remain; add this)
{
  "routes": [
    { "src": "/api/abuse-control-plane(.*)", "dest": "/api/abuse-control-plane.js" }
  ]
}
```

The file `api/abuse-control-plane.js` is auto-deployed by Vercel as a
serverless function. No build step is required.

### Operator access

Operator endpoints (`/quotas`, `/signals`, `/blocklist`, `/allowlist`,
`PATCH /appeals/:id`) require a verified Clerk session with the `operator` or
`admin` role. Configure `authorizeOperator` in the Vercel runtime to verify the
Clerk session and resolve the role from Clerk publicMetadata (see
`src/services/roleService.js`).

## 3. Data model (Firestore)

Collections used by `api/_lib/abuseStore.js`:

| Collection | Document ID | Fields |
|------------|-------------|--------|
| `abuseControlQuotas` | `quota:{method}:{route}` | route, method, limit, windowMs, adaptive, updatedAt |
| `abuseControlSignals` | `{bucket}:{at}:{random}` | bucket, kind, at, route, severity, recordedAt |
| `abuseControlAllowlists` | `{hash}:{route}` | identifierHash, route, reason, expiresAt |
| `abuseControlBlocklists` | `{hash}:{route}` | identifierHash, route, reason, expiresAt |
| `abuseControlAppeals` | `{appealId}` | id, identifierHash, route, reason, userId, status, reviewerNote, createdAt, updatedAt |

No raw caller addresses or citizen records are stored. Identifier hashes are
HMAC-SHA256 outputs.

### Firestore indexes required

A composite index is needed for signal queries:

```
Collection: abuseControlSignals
Fields: bucket (ascending), at (descending)
```

For appeals listing:
```
Collection: abuseControlAppeals
Fields: status (ascending), createdAt (descending)
```

These can be created in the Firebase console or via `firebase deploy --only
firestore:indexes`.

## 4. Migration

There is no breaking data migration. The control plane introduces new
collections only. Existing rate-limiting code
(`api/_lib/abuseGuard.js`, `src/services/rateLimiter.js`) is unchanged and
continues to work independently.

To enable per-route quotas, an operator POSTs to
`/api/abuse-control-plane/quotas`:

```http
POST /api/abuse-control-plane/quotas
Authorization: Bearer <clerk-session>
Content-Type: application/json

{ "route": "/api/report", "method": "POST", "limit": 10, "windowMs": 60000, "adaptive": true }
```

## 5. Rollback

### Code rollback

Revert the commit that adds `api/abuse-control-plane.js` and its supporting
files. The route will stop being served; existing `abuseGuard`-based rate
limiting continues unaffected.

### Data rollback

New Firestore collections can be deleted:

```
abuseControlQuotas
abuseControlSignals
abuseControlAllowlists
abuseControlBlocklists
abuseControlAppeals
```

Deleting them has no impact on existing application data. No citizen records
are stored in these collections.

### Secret rotation

Rotating `ABUSE_CONTROL_SECRET` invalidates all existing identifier hashes.
Allowlists/blocklists keyed by old hashes will no longer match. Operators must
re-enter list entries after rotation.

## 6. Verification

```bash
# Lint
npm run lint

# Control plane tests
npx vitest run api/_lib/abuseControlPlane.test.js tests/abuse-control-plane.test.js src/components/abuse-control-plane/AbuseDashboard.test.jsx

# Schema contract tests are included in abuseControlPlane.test.js
```

## 7. Cost and performance limits

- Per-instance memory: bounded to 5000 windows per counter type.
- Signal retention: 24 hours (configurable via `signalRetentionMs`).
- Signal query limit: 500 most recent signals per bucket.
- Appeals list page size: max 100.
- Rate limit config: limit 1–10000, windowMs 1000–86400000.
