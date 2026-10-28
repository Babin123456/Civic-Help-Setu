# Security headers and Content Security Policy

Browser-side defence in depth. If an injection bug ever lets someone put markup or script on a
page, these headers limit what it can do. They also stop the site being framed, sniffed or leaking
full URLs.

The headers are served by Vercel from `vercel.json`. **`scripts/securityHeaders.js` is the source of
truth**: `vercel.json` is generated from it, and a test fails if the two drift apart.

## Current state

| Header | Value | Mode |
| --- | --- | --- |
| `Content-Security-Policy-Report-Only` | the policy below | **report-only** (blocks nothing) |
| `X-Content-Type-Options` | `nosniff` | enforced |
| `X-Frame-Options` | `DENY` | enforced |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | enforced |
| `Permissions-Policy` | camera, payment, usb, sensors off; microphone and geolocation `self` only | enforced |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | enforced |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | enforced |

The CSP starts in report-only mode, as planned. Moving to enforcement is a one-line change (see
"Rollout").

## Required origins

Everything else is `'self'`. Taken from a search of `src/`, `index.html` and `vite.config.js`, from
[INTEGRATIONS.md](INTEGRATIONS.md), and from a real browser run (below).

| Origin | Directive | Why |
| --- | --- | --- |
| `https://*.clerk.accounts.dev` | `script-src`, `connect-src` | Clerk development instances: loads `clerk-js` and calls the Clerk API. This is the only wildcard. A production Clerk domain is added with `--clerk-host` (see below). |
| `https://challenges.cloudflare.com` | `script-src`, `frame-src` | Cloudflare Turnstile, Clerk's bot check on sign-up and sign-in. |
| `https://clerk-telemetry.com` | `connect-src` | Clerk's optional usage telemetry. |
| `https://img.clerk.com` | `img-src` | User avatars. |
| `https://fonts.googleapis.com` | `style-src` | The Google Fonts stylesheet imported in `src/index.css`. |
| `https://fonts.gstatic.com` | `font-src` | The font files that stylesheet points to. |
| `blob:` | `img-src`, `frame-src`, `worker-src`, `media-src` | The document vault preview (a sandboxed frame) and the worker Clerk starts. |
| `data:` | `img-src` | Inline icons. |

Not allowed because the app does not use them today: AI providers, analytics, Firebase, map tiles,
`api.qrserver.com`. The QR image modal (`QRCodeView`, used only by `ShareServiceModal`) is not
mounted by any page; **if it is mounted, add `https://api.qrserver.com` to `img-src`**. A test fails
until you do.

### The one relaxation: `style-src 'unsafe-inline'`

Clerk injects `<style>` elements at runtime, so inline styles must be allowed. This does **not**
allow inline scripts: `script-src` has no `'unsafe-inline'` and no `'unsafe-eval'`. Tightening styles
later means using nonces, which needs a server that can write a per-request value.

### Other directives

`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and
`upgrade-insecure-requests` once enforced (browsers ignore it in report-only mode).

## What was checked

* **Source**: no inline scripts or event handlers in `index.html`; no `eval`, `new Function` or string timers in `src/`; HTML is written from strings only into the three blank print windows (`FormTemplatePreview`, `RtiPreviewLetter`, `AppellateEscalationModal`), whose HTML contains no script. Tests guard each of these (`scripts/securityHeaders.test.js`).
* **Real browser** (headless Edge against the production build served with these headers): all 15 routes (`/`, `/login`, `/signup`, `/assistant`, `/services`, `/services/1`, `/eligibility`, `/nearby`, `/track`, `/saved`, `/vault`, `/profile`, `/open-source`, `/privacy`, `/admin`) rendered and produced **0 policy violations**, both in report-only and with the policy enforced.
* **Not covered by that run**: the build used no Clerk publishable key, so Clerk's own script, frames and API calls were not exercised. The Clerk entries come from Clerk's documented CSP requirements. Check them on a preview deployment with a real key (below) before enforcing.

## Rollout

1. **Report-only (now).** Deploy. Nothing is blocked.
2. **Collect violations.** Open a preview deployment with the real Clerk key and use every flow: sign up, sign in with email and with Google, sign out, profile avatar, vault upload and preview, speech input, nearby offices, print. Watch the browser console for `[Report Only] Refused to ...` lines, or set a report endpoint:
   ```bash
   npm run headers:generate -- --report-uri https://<your-collector>/csp
   ```
   Any service that accepts `report-uri` reports works (report-uri.com, Sentry, ...). The URL must be `https`.
3. **Add what is legitimately needed.** For a production Clerk domain (the host inside your publishable key, for example `clerk.example.org`):
   ```bash
   npm run headers:generate -- --clerk-host clerk.example.org
   ```
   For anything else, add it to `POLICY` in `scripts/securityHeaders.js` **with a reason**, document it in the table above, and run `npm run headers:generate`.
4. **Enforce** when a full pass of the checklist shows no unexpected violations:
   ```bash
   npm run headers:generate -- --mode enforce
   ```
   Options you do not repeat (clerk host, report URI, mode) are kept from the current `vercel.json`.
5. **Smoke test after the rollout**: sign in and out, then load each route listed above. The auth flows are the ones most likely to break.
6. **Rollback**: `npm run headers:generate -- --mode report-only`, redeploy. No code changes are involved.

## Changing the policy safely

* Edit `scripts/securityHeaders.js`, never `vercel.json` by hand. Then run `npm run headers:generate`.
* `npm run headers:check` (and the test suite) fails if `vercel.json` is out of date.
* The tests also reject: `unsafe-eval`, inline scripts, bare `*`, `https:` or `ws:` sources, a wildcard other than the Clerk development one, `data:` or `blob:` outside images, frames, workers and media, and any external origin used in `src/` that the policy does not allow.
* Add a new third-party service the same way as the others: reason in `POLICY`, row in the table above, update [INTEGRATIONS.md](INTEGRATIONS.md).
* Do not add `'unsafe-inline'` or `'unsafe-eval'` to `script-src` to make something work. Find the inline script and move it into the bundle.

## Commands

| Command | What it does |
| --- | --- |
| `npm run headers:generate` | Writes the headers into `vercel.json`, keeping the current mode, Clerk host and report URI |
| `npm run headers:generate -- --mode enforce` | Enforce the policy (`report-only` goes back) |
| `npm run headers:generate -- --clerk-host <host>` | Allow a production Clerk frontend API host (repeatable) |
| `npm run headers:generate -- --report-uri <https url>` | Send violation reports to a collector |
| `npm run headers:check` | Fails if `vercel.json` is out of date |

Other hosts: these headers apply to Vercel. On another host, copy the values from `vercel.json` into
that host's header configuration.
