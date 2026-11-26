# API Mutation Security: CSRF, Origin & CORS Policy

This document describes how the Civic Help Setu API protects state-changing endpoints
against Cross-Site Request Forgery (CSRF) and cross-origin abuse, and how deployment
origins are configured.

## 1. Threat Model

| Attack Vector | Mitigation |
|---------------|------------|
| **Cross-site form post** (browser sends cookies automatically) | Double-submit CSRF token required for cookie-authenticated mutations; Origin header must match a trusted origin. |
| **Cross-site fetch with credentials** (attacker's page calls our API with cookies) | CORS never reflects `*` with `Access-Control-Allow-Credentials: true`. Preflight is rejected for untrusted origins. |
| **Forged Origin header** (attacker tries to spoof Origin from their server) | Server validates Origin against an explicit allow-list plus the deployment's own host header. Browser cannot override Origin in a real victim's request. |
| **Missing Origin** (legacy browser or server-to-server call) | Allowed only for bearer-token clients and when `APP_ALLOW_MISSING_ORIGIN=true`. Cookie calls without Origin are always rejected. |
| **Error leakage** (stack traces or secrets in responses) | All error paths return fixed JSON codes (`internalErrorResponse()`). No exception messages are serialized. |

## 2. Authentication Modes & CSRF Requirements

| Mode | How it works | CSRF Required? | Origin Required? |
|------|--------------|----------------|------------------|
| **Cookie** (session cookie set by our domain) | Browser sends cookie automatically on every request to our origin. Vulnerable to CSRF. | **Yes** — double-submit token in `X-CSRF-Token` header matching `__Host-csrf` cookie. | Yes — must be present and trusted. |
| **Bearer** (explicit `Authorization: Bearer <token>` header) | Caller (fetch/XHR, mobile app, server) attaches token. Browser never sends it automatically. | No — attacker cannot set this header on a victim's cross-site request. | Required unless `APP_ALLOW_MISSING_ORIGIN=true`. Forged Origin is still rejected. |
| **Anonymous** (public intake: flood reports, road hazards, etc.) | No credentials. Relies on Origin + rate limiting + honeypot. | No. | Yes — must be present and trusted. |

> **Note:** The `Authorization` header is checked before cookies. A request that presents both is treated as **Bearer**, so cookie CSRF is not enforced when a valid bearer token is also sent.

## 3. Protected Endpoints (Inventory)

All routes under `/api/` are covered by the central guard in `api/[...path].js`.
Mutation methods are `POST`, `PUT`, `PATCH`, `DELETE`. `GET`, `HEAD`, `OPTIONS` are read-only and never blocked.

### 3.1 Public Citizen Intake (Anonymous, Origin required)
| Endpoint | Methods | Purpose |
|---|---|---|
| `address-change-corrections` | POST | Community address corrections |
| `business-licence-feedback` | POST | Business licence feedback |
| `community-facility-corrections` | POST | Facility/permit corrections |
| `counter-demand-reports` | POST | Counter demand anomalies |
| `crematorium-corrections` | POST | Crematorium corrections |
| `civic-surveys` | POST | Survey submissions |
| `flood-incident-reports` | POST | Flood/drain incident reports |
| `heat-relief-observations` | POST | Heatwave relief observations |
| `library-corrections` | POST | Library/resource corrections |
| `pds-observations` | POST | PDS fair-price shop observations |
| `pedestrian-barriers` | POST | Accessibility barrier reports |
| `public-projects` | POST | Project progress submissions |
| `rental-checklist-corrections` | POST | Rental move-in/out corrections |
| `road-hazards` | POST | Road hazard reports |
| `school-zone-audits` | POST | School zone hazard audits |
| `tenant-administration` | POST | Multi-authority admin actions |
| `tender-corrections` | POST | Tender corrigenda reports |
| `transit-concessions` | PATCH, POST | Transit concession corrections |
| `ward-budget-proposals` | POST | Participatory budget proposals |
| `water-quality-register` | POST | Water quality sampling |
| `water-tanker-reports` | POST | Water tanker reports |
| `relief-operations` | POST | Public relief need intake |
| `synthetic-datasets` | POST | Synthetic dataset generation requests |
| `fire-compliance-feedback` | POST | Fire safety compliance feedback |
| `knowledge-provenance` | POST | Knowledge provenance corrections |
| `share-by-email` | POST | Service guide share by email |

### 3.2 Authenticated / Role-Gated (Cookie or Bearer, CSRF when cookie)
| Endpoint | Methods | Auth | Roles |
|---|---|---|---|
| `abuse-control-plane` | GET, POST, PATCH | Bearer / Cookie | operator/authenticated |
| `agent-incident-response` | GET, POST | Bearer/Cookie | admin/operator |
| `agent-sandbox` | GET, POST | Bearer | admin |
| `application-events` | POST | Bearer / Cookie | authenticated |
| `catalogue-visual-qa` | GET, POST | Bearer (preferred) / Cookie | admin |
| `civic-knowledge-graph` | GET, POST | Bearer / Cookie | admin/maintainer/reviewer |
| `civic-release-ledger` | GET, POST | Bearer / Cookie | admin/maintainer |
| `counter-journey` | GET, POST | Bearer / Cookie | admin/operator |
| `email/preferences` | GET, PATCH, POST | Bearer / Cookie | authenticated |
| `email/verify` | GET, POST | Bearer / Cookie | authenticated |
| `firebase-token` | POST | Bearer | authenticated |
| `ghg-inventory` | GET, POST | Bearer / Cookie | operator/admin |
| `import-batches` | GET, POST | Bearer / Cookie | admin/operator |
| `jurisdiction-handoff` | GET, POST, PUT | Cookie (admin check) | admin |
| `micro-volunteer` | GET, POST | Bearer / Cookie | admin/operator |
| `neighbourhood-resource-exchange` | GET, POST | Bearer / Cookie | authenticated |
| `office-comparison` | GET, POST, PATCH | Bearer / Cookie | admin |
| `open-contracting-analytics` | GET, POST | Bearer / Cookie | admin/operator |
| `policy-simulation` | GET, POST | Bearer / Cookie | admin/operator |
| `privacy-exports` | GET, POST | Bearer / Cookie | authenticated |
| `public-toilets` | GET, POST, PATCH | Bearer (moderation) / Cookie | moderator/admin |
| `send-email` | POST | Bearer / Cookie | authenticated |
| `ward-issue-heatmap` | GET, POST | Bearer / Cookie | operator/admin |

### 3.3 Read-Only (No Guard Needed, Always Allowed)
| Endpoint | Methods |
|---|---|
| `graph` | GET |
| `graph/review` | GET |
| `accessibility-inspector` (status/findings/history/report) | GET |
| `public-toilets` (list) | GET |
| `pedestrian-barriers` (list) | GET |
| All intake endpoints | GET (queue status) |

## 4. Configuration

All configuration is via **server-only** environment variables (never `VITE_` prefixed).
Set them in Vercel Project Settings → Environment Variables (Production, Preview, Development).

| Variable | Default | Description |
|---|---|---|
| `APP_ORIGIN` | — | Canonical site origin, e.g. `https://civic.example.org`. Added to trusted origins. |
| `APP_ALLOWED_ORIGINS` | — | Comma-separated extra origins for cross-origin clients (partner sites, staging). |
| `APP_CORS_ALLOW_CREDENTIALS` | `false` | Set `true` **only** with explicit origins in `APP_ORIGIN`/`APP_ALLOWED_ORIGINS`. Never combine with `*`. |
| `APP_REQUIRE_ORIGIN` | `true` | Require `Origin` header on mutations. Set `false` only for legacy server-to-server callers that cannot send it. |
| `APP_ALLOW_MISSING_ORIGIN` | `false` | Allow missing Origin on non-cookie mutations (bearer/anonymous). The main dispatcher defaults this to `true` for backwards compatibility with direct function calls. |
| `CSRF_COOKIE_NAME` | `__Host-csrf` | Cookie name for the double-submit token. Must be `__Host-` or `__Secure-` prefixed for browser enforcement. |
| `CSRF_HEADER_NAME` | `x-csrf-token` | Header name the client must send the token in. |

### Automatic Trusted Origins

The following are **always** trusted without configuration:

- `APP_ORIGIN` and `APP_ALLOWED_ORIGINS`
- Vercel deployment URLs from `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_BRANCH_URL`, `VERCEL_URL`
- Development origins when `NODE_ENV !== 'production'`:
  - `http://localhost:3000`
  - `http://localhost:5173`
  - `http://127.0.0.1:3000`
  - `http://127.0.0.1:5173`
- The request's own host (`Host` / `X-Forwarded-Host`) so same-origin deployments work without a build-time variable.

> A forged request from another site still fails because its `Origin` header cannot equal the host it was sent to.

## 5. Client Integration

### 5.1 CSRF Token Flow (Cookie Auth)

1. **Login / session start** — Server sets `__Host-csrf=<random>` cookie (Secure, SameSite=Lax/Strict, HttpOnly=false so JS can read it).
2. **Client reads cookie** — `document.cookie` or `js-cookie` library.
3. **Client sends header** — Every mutating `fetch`/`axios` call includes `X-CSRF-Token: <cookie value>`.
4. **Server validates** — Constant-time comparison of cookie vs header. Mismatch → `403 csrf_token_mismatch`.

```js
// Example: reading the cookie and sending with fetch
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|; )__Host-csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function mutate(url, body) {
  const token = getCsrfToken();
  if (!token) throw new Error('CSRF cookie missing — reload the page');
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',          // sends the session cookie
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,         // double-submit
    },
    body: JSON.stringify(body),
  });
  return res.json();
}
```

### 5.2 Bearer Token Clients

No CSRF header needed. Just send `Authorization: Bearer <token>`. Ensure the
request includes a valid `Origin` header (browsers do this automatically for
same-origin `fetch`; for cross-origin calls configure `APP_ALLOWED_ORIGINS`).

## 6. Error Codes (Stable, Non-Leaking)

| HTTP | Code | Message (user-facing) |
|---|---|---|
| 403 | `origin_missing` | "The request origin could not be verified. Reload the page and try again." |
| 403 | `origin_not_allowed` | "This origin is not allowed to change data on this site." |
| 403 | `csrf_token_missing` | "A CSRF token is required for this request. Reload the page and try again." |
| 403 | `csrf_token_invalid` | "The CSRF token is malformed. Reload the page and try again." |
| 403 | `csrf_token_mismatch` | "The CSRF token does not match this session. Reload the page and try again." |
| 405 | `method_not_allowed` | Standard allow header |
| 500 | `internal_server_error` | "The request could not be completed." |

**No exception messages, stack traces, cookie values or secrets are ever returned.**

## 7. Testing

Run the unit tests:

```bash
npm test -- tests/request-security.test.js
```

Tests cover:
- Forged origins (cross-site, invalid header values)
- Missing/invalid/mismatched CSRF tokens
- Allowed same-origin and configured cross-origin requests
- Bearer-token calls with and without Origin
- Preflight (OPTIONS) handling
- CORS header generation (wildcard vs explicit, credentials)
- Error response shape (no leakage)

## 8. Deployment Checklist

- [ ] `APP_ORIGIN` set to production URL in Vercel Production env
- [ ] `APP_ALLOWED_ORIGINS` includes any partner/staging origins (comma-separated)
- [ ] `APP_CORS_ALLOW_CREDENTIALS` is `false` unless explicit origins are configured
- [ ] `CSRF_COOKIE_NAME` is `__Host-csrf` (or `__Secure-csrf` if not on HTTPS apex)
- [ ] Clerk session cookie is `SameSite=Lax` or `Strict` (Clerk default)
- [ ] Preview deployments inherit from Vercel branch URL automatically
- [ ] Local development works without extra config (`NODE_ENV=development`)

## 9. Files

| File | Purpose |
|---|---|
| `api/_lib/requestSecurity.js` | Core policy: origin parsing, CSRF validation, CORS headers, `evaluateRequestSecurity`, `enforceRequestSecurity`, `withRequestSecurity` |
| `api/[...path].js` | Dispatcher wrapped with `withRequestSecurity(innerHandler, { allowMissingOrigin: true })` |
| `tests/request-security.test.js` | Unit tests for every helper and policy branch |
| `docs/security/API_MUTATION_SECURITY.md` | This document |