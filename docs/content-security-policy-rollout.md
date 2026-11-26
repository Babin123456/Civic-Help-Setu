# Content Security Policy (CSP) Configuration and Rollout Guide

## 1. Executive Summary & Objective
A strict Content Security Policy (CSP) mitigates Cross-Site Scripting (XSS), malicious script injection, and clickjacking attacks. However, applying a strict enforcement policy without accounting for third-party integrations (e.g. Clerk authentication, Vercel web analytics, Firebase APIs, and OpenStreetMap tiles) can break mission-critical citizen workflows.

This document establishes:
1. Complete origin inventory.
2. Report-only staged deployment.
3. Violation reporting with strict PII sanitization.
4. Clear rollback and enforcement criteria.

---

## 2. Origin Inventory

| Directive | Approved Origin | Justification / Owner |
|---|---|---|
| `script-src` | `'self'`, `'unsafe-inline'` (development/Vite hydration) | Application bundles |
| `script-src` | `https://*.clerk.accounts.dev`, `https://clerk.civichelpsetu.in` | Clerk authentication frontend components |
| `script-src` | `https://challenges.cloudflare.com` | Cloudflare Turnstile bot detection (Clerk auth) |
| `script-src` | `https://va.vercel-scripts.com` | Vercel performance analytics |
| `style-src` | `'self'`, `'unsafe-inline'`, `https://fonts.googleapis.com` | Tailwind CSS and Google Fonts typography |
| `font-src` | `'self'`, `data:`, `https://fonts.gstatic.com` | Web fonts delivery |
| `img-src` | `'self'`, `data:`, `blob:`, `https://img.clerk.com` | User avatars and uploaded preview thumbnails |
| `img-src` | `https://*.tile.openstreetmap.org`, `https://unpkg.com` | Leaflet / OpenStreetMap geographic tiles |
| `connect-src` | `https://*.clerk.accounts.dev`, `https://api.clerk.com` | Clerk API and user session validation |
| `connect-src` | `https://vitals.vercel-insights.com` | Vercel Real User Monitoring (RUM) |
| `connect-src` | `https://*.firebaseio.com`, `https://*.googleapis.com` | Firebase Firestore and Cloud Storage |
| `frame-src` | `https://challenges.cloudflare.com` | Turnstile iframe captcha execution |
| `object-src` | `'none'` | Absolute prevention of Flash / Java plugin exploits |
| `base-uri` | `'self'` | Prevents malicious `<base>` tag DOM redirection |

---

## 3. Staged Rollout Strategy

### Phase 1: Report-Only Mode (Current Default)
- Header: `Content-Security-Policy-Report-Only`
- Violation Endpoint: `/api/csp-report`
- Actions: Browser will execute scripts normally while reporting violations to the collector.
- Metric to proceed: Zero genuine application functional errors over 7 consecutive days.

### Phase 2: Staged Enforcement
- Header: `Content-Security-Policy`
- Staged transition on staging/preview deployments first.
- Continuous verification of Clerk sign-in, multi-lingual translation engines, and OpenStreetMap rendering.

### Phase 3: Rollback Protocol
- If critical route breakdown occurs, instantly switch configuration mode to `report-only`.
- Review report logs for missing legitimate origin domains.


## 4. Verification & Testing Matrix

### Automated Header Assertions
- Header response builders guarantee that `nosniff` and `SAMEORIGIN` accompany all CSP headers.
- Report-Only mode outputs `Content-Security-Policy-Report-Only` without blocking execution.
- Enforce mode activates `Content-Security-Policy`.

### Query String & PII Stripping
- Any violation payload sent to `/api/csp-report` has its query parameters stripped (`document-uri`, `blocked-uri`), ensuring JWT tokens, session tickets, and citizen identifiers never leak into monitoring logs.
- The `originalPolicySnippet` is replaced with `REDACTED_FOR_PRIVACY`.
