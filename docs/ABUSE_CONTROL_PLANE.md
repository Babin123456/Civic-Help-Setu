# Abuse Control Plane — Architecture Decision Record (#1174)

**Status:** Proposed
**Owner:** Civic Help Setu platform team
**Issue:** #1174 — Build a Civic Service API Rate-Limit and Abuse Detection Control Plane

## 1. Problem statement

Public API endpoints must remain available during scraping, spam, and automated
abuse without blocking legitimate low-bandwidth users. The existing rate
limiting (docs/ABUSE_CONTROLS.md) is per-function-instance, has no adaptive
behaviour, no abuse signal detection, no operator dashboard, and no appeal
path. A shared-NAT address can be hard-blocked for one abusive user, punishing
everyone behind it.

## 2. Decision

Build a server-side **Abuse Control Plane** with:

- **Per-route quotas** — configurable limits per route pattern (with
  longest-prefix fallback).
- **Adaptive throttling** — when abuse signals fire, the effective limit is
  scaled by an adaptive multiplier (default 0.5) until signals subside.
- **Abuse signals** — rapid-fire, error-burst, route-anomaly, and blocked-retry
  signals recorded per privacy-minimized identifier.
- **Privacy-minimized identifiers** — caller addresses and user IDs are
  HMAC-SHA256 hashed with a server secret before storage. Raw addresses are
  never retained.
- **NAT-user protection** — an address seen with many distinct authenticated
  users is treated as shared; the per-address limit is skipped for it, and the
  per-user limit applies instead.
- **Allowlist / blocklist** — operator-managed lists per hashed identifier +
  route.
- **Appeal path** — users can submit appeals; operators approve/reject with
  explicit human review.
- **Operator dashboard** — React UI to review signals, appeals, and list
  changes.
- **Versioned schemas** — all external input validated against v1 contracts at
  trust boundaries (api/_lib/abuseSchemas.js).

## 3. Components

| Component | File | Responsibility |
|-----------|------|--------------|
| Control plane core | `api/_lib/abuseControlPlane.js` | Quota checks, signals, NAT detection, allow/blocklist, appeals |
| Window counter | `api/_lib/abuseControlPlane.js` (`createWindowCounter`) | Fixed-window counter, injectable clock, bounded memory |
| Signal detector | `api/_lib/abuseControlPlane.js` (`createAbuseSignalDetector`) | Rapid-fire / error-burst detection |
| Privacy identifier | `api/_lib/abuseControlPlane.js` (`privacyIdentifier`) | HMAC-SHA256 of raw identifier |
| Store contract | `api/_lib/abuseControlPlane.js` | Injectable store interface |
| Firestore store | `api/_lib/abuseStore.js` | Production Firestore-backed store |
| Test fixture | `tests/helpers/abuseFixture.js` | In-memory transactional test double |
| Schemas | `api/_lib/abuseSchemas.js` | Versioned v1 request/response validation |
| API route | `api/abuse-control-plane.js` | Vercel serverless handler |
| Client service | `src/services/abuseControlPlaneService.js` | Browser-side fetch wrapper |
| Operator dashboard | `src/components/abuse-control-plane/AbuseDashboard.jsx` | Mobile-first React UI |
| Synthetic fixtures | `tests/fixtures/abuseSyntheticFixtures.js` | Non-citizen test data |

## 4. Data flow

```
Client request
      │
      ▼
Vercel edge (sets x-vercel-forwarded-for / x-real-ip)
      │
      ▼
api/abuse-control-plane.js
      │
      ├─▶ validate input against v1 schemas (abuseSchemas.js)
      ├─▶ resolve store (Firestore or in-memory)
      ├─▶ operator auth (Clerk session + role) for operator endpoints
      └─▶ user auth (Clerk session) for appeal endpoints
      │
      ▼
createAbuseControlPlane.check()
      │
      ├─▶ privacyIdentifier(rawAddress, secret)  → addressHash
      ├─▶ privacyIdentifier(rawUserId, secret)   → userHash
      ├─▶ blocklist check → 403 if listed
      ├─▶ allowlist check → bypass if listed
      ├─▶ NAT detection (distinct users per address)
      ├─▶ per-user limit (always, if userId) → 429 if exceeded
      ├─▶ per-address limit (anonymous only, not NAT-shared) → 429 if exceeded
      ├─▶ record rapid_fire / error_burst signals
      └─▶ return { allowed, reason, retryAfterSeconds, ... }
      │
      ▼
JSON response with Retry-After header on 429
```

## 5. Threat model

| Threat | Mitigation |
|--------|------------|
| IP spoofing via `x-forwarded-for` | Only `x-vercel-forwarded-for` and `x-real-ip` (set by Vercel edge) are read. |
| Address exhaustion attack | Bounded memory (max 5000 windows); oldest windows evicted. |
| Shared NAT false-positive | Per-address limit skipped for NAT-shared addresses; per-user limit applies. |
| Raw address logging/storage | Only HMAC-SHA256 hashes retained; raw addresses never stored or displayed. |
| Credential leakage in logs | Error responses use stable codes; no stack traces or PII returned. |
| Automated appeal spam | Appeals require a verified Clerk session; one appeal per identifier+route. |
| Unauthorized blocklist | Blocklist/allowlist mutations require operator Clerk session. |
| Replay of blocked requests | Retry-After + retryAfterSeconds; clients must back off. |

## 6. Failure handling

| Failure | Behaviour |
|---------|-----------|
| Firestore unavailable | `getStore()` returns null; control plane degrades to in-memory per-instance limits. |
| Clerk unavailable | Operator endpoints return 503; appeal endpoints return 401. |
| Store write failure | Error caught; caller receives 503 `store_unavailable`, no partial state. |
| Invalid input | 400 with `validation_failed` and stable error codes; no internal details leaked. |

## 7. Component ownership

- **Platform team:** control plane core, store, API route, schemas.
- **Frontend team:** operator dashboard React component, client service.
- **Security team:** threat model review, secret rotation (`ABUSE_CONTROL_SECRET`).

## 8. Related documents

- `docs/ABUSE_CONTROL_PLANE_DEPLOYMENT.md` — deployment, migration, rollback.
- `docs/ABUSE_CONTROL_PLANE_EVALUATION.md` — evaluation criteria, reproducible commands.
- `docs/ABUSE_CONTROLS.md` — existing abuse controls inventory (superseded in part by this ADR).
