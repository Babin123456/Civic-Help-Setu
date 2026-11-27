# Civic Office Contact Verification Campaign Manager

> **Issue**: [#1433](https://github.com/GoldRay19/Civic-Help-Setu/issues/1433)
> **Branch**: `feat/office-verification-campaigns-1433`

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `api/_lib/officeVerificationCampaignStore.js` | Bounded store (500 campaigns, 2,000 audit logs), batch assignment, official-source evidence tracking, reviewer approval, expiry policies, public stale badges |
| `api/_lib/handlers/office-verification-campaigns.js` | Serverless REST API (`/api/office-verification-campaigns`) with role-based auth (`admin`/`municipal_officer`), 30 req/min rate limit, `http(s)` source URL validation, and PII guard |
| `src/services/officeVerificationCampaignService.js` | Offline-first client service integrated with `CIVIC_OFFICES` (`locationOffices.js`) |
| `src/pages/OfficeVerificationCampaignWorkspace.jsx` | Accessible workspace (`/office-verification-campaigns`, `/office-campaigns`) |

---

## 2. Expiry Policies & Public Stale Badges

- `VERIFIED_FRESH`: Verified and more than 14 days remaining before `expiresAt`.
- `EXPIRING_SOON`: Verified and within 14 days of `expiresAt`.
- `STALE_EXPIRED`: `expiresAt <= now` — automatically surfaces a public stale badge.
- `UNVERIFIED`: Never verified or rejected by a reviewer.

---

## 3. Configuration, Monitoring & Rollback

- **Configuration**: Uses `CLERK_SECRET_KEY` for JWT verification; no new env vars required.
- **Monitoring**: Track `STALE_EXPIRED` counts, `403` role rejections, `400` PII/URL validation errors, and `audit-log` events.
- **Rollback**: Remove `"office-verification-campaigns"` from `api/[...path].js` and `/office-verification-campaigns` from `src/App.jsx`.
