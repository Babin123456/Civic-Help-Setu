# Government Portal Change Detection and Broken-Link Monitor

> **Issue**: [#1428](https://github.com/GoldRay19/Civic-Help-Setu/issues/1428)
> **Branch**: `feat/portal-change-broken-link-monitor-1428`
> **Extends**: `linkHealthService.js` and `LinkHealthPanel.jsx`

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `src/services/portalChangeMonitorService.js` | Source ownership metadata, noise-tolerant content fingerprinting (`normalizePortalContent` + `computeContentFingerprint`), HTTP/redirect status checks, human review queue, PII-free audit log |
| `api/_lib/handlers/portal-change-monitor.js` | Serverless REST API (`/api/portal-change-monitor`, `/check`, `/review`, `/audit-log`) with rate limiting & role-based access control |
| `src/pages/PortalChangeMonitorWorkspace.jsx` | Accessible UI (`/portal-monitor`, `/broken-link-monitor`) |

---

## 2. Meaningful Change Detection & Access Controls

- `normalizePortalContent()` strips ISO timestamps, clock times, and extra whitespace before hashing so routine dynamic renders do not trigger false alerts.
- Broken links (`4xx`/`5xx`), redirects, and meaningful fingerprint changes enter the `PENDING_REVIEW` queue for `admin` / `reviewer` / `municipal_officer` approval (`401`/`403` otherwise).

---

## 3. Configuration, Monitoring & Rollback

- **Configuration**: Uses `CLERK_SECRET_KEY` for privileged `/check`, `/review`, and `/audit-log` endpoints.
- **Monitoring**: Track `BROKEN_LINK`, `REDIRECTED`, `CONTENT_CHANGED`, and `PENDING_REVIEW` queue depth.
- **Rollback**: Remove `"portal-change-monitor"` from `api/[...path].js` and `/portal-monitor` from `src/App.jsx`.
