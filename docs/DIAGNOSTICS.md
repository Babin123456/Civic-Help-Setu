# Diagnostics, error reporting and what they may contain

Short version: **nothing is sent to an error tracker or analytics service today**, and anything that is added later must go through `src/utils/diagnostics.js`, which removes form contents, contact and identity details, reference IDs, tokens, query strings and request bodies before an event exists.

## Where diagnostics go (destinations)

| Destination | Sends anything? | What | Notes |
| --- | --- | --- | --- |
| Error tracker (Sentry, Bugsnag, ...) | **No** | nothing | Not installed. A test fails if one is referenced in `src/`. |
| Analytics | **No** | nothing | The consent center has an `analytics_telemetry` switch with no code behind it. |
| Clerk usage telemetry (`clerk-telemetry.com`) | **No** (switched off) | was: anonymous Clerk usage events | `main.jsx` passes `telemetry={false}`. The origin is still in the CSP (`scripts/securityHeaders.js`); it can be removed once a preview deployment with a real Clerk key shows no request to it. |
| Browser console | Yes, local only | a fixed label; in development also the safe fields below | See `logDiagnostic`. |
| Diagnostics sink (`setDiagnosticsSink`) | Only if someone registers one | the safe event below | None is registered. |

## What an event may contain

`buildErrorEvent(error, { route })` returns exactly these fields, and nothing else:

| Field | Value |
| --- | --- |
| `type` | `"error"` |
| `name` | the error class if it is a standard one (`TypeError`, `SyntaxError`, `AbortError`, ...), otherwise `"Error"` |
| `code` | the error's `code` (or Clerk's `errors[0].code`) if it looks like a code: letters, digits, `_ . : -`, up to 64 characters |
| `status` | an HTTP status between 100 and 599 |
| `message` | the message with emails, phone numbers, Aadhaar, PAN, voter/passport numbers, `SRV-`/`GRV-`/`TKN-` references, coordinates, tokens and keys masked, URLs cut to their origin, query strings removed, and at most 200 characters |
| `route` | the route **pattern**: `/services/:id`, `/shared-checklist/:token`, `/track`. Unknown paths become `/[other]`; the real path, query string and fragment are never kept |

Never copied: the stack, `cause`, `errors` array, a response or request attached to the error, form state, or any other property.

`describeRequest({ method, url, body, headers })` returns only `{ method, target, hasBody }`. `target` is the route pattern for this site or just the origin for another one. **Request bodies and headers (which carry `Authorization` and cookies) are never included**, in any environment. There is no option to turn that on.

`redactValue(object)` keeps only the keys in `SAFE_KEYS` (`code`, `status`, `route`, `type`, `kind`, `method`, `level`, `event`, `reason`, `count`, `size`, `length`, `attempt`) and replaces every other value with `[REDACTED]`. It is deny-by-default: a new field such as `phoneNumber` is hidden without anyone having to remember to list it.

## Logging in app code

Use `logDiagnostic(label, error)` from `src/utils/diagnostics.js` instead of `console.error(label, error)`:

- **Production:** logs the fixed label only.
- **Development:** the label and the safe event above.

The reason is not only form data. A `JSON.parse` error on corrupted storage quotes part of the stored text (`Unexpected token ... "[{"id":"SRV-98..."`), and the raw error object printed to the console, or passed to a tracker, would carry it. Labels must be fixed text; do not build them from user data. A test fails if `console.error` or `console.warn` is added outside the few allowed files.

## Adding an error tracker later

1. Install it with its automatic capture of request bodies, breadcrumbs of input values, URLs and `localStorage` **turned off**.
2. Do not give it raw errors. Register `setDiagnosticsSink((event) => tracker.capture(event))` and call `reportError(error, { route })` where errors are caught (for example in the error boundary).
3. Add its origin to `connect-src` in `scripts/securityHeaders.js` with a reason, run `npm run headers:generate`, and update the table above and `docs/INTEGRATIONS.md`.
4. Respect the `analytics_telemetry` consent switch before sending.

## Tests

`src/utils/diagnostics.test.js` covers: route names without ids, tokens or query strings; masking of emails, phone numbers, Aadhaar, PAN, references and tokens, including inside URLs in messages; allow-list behaviour for objects (cycles, depth, size, functions); that an error's stack, cause, response, request and form state are never copied; that safe codes, status, error names and route names are kept; request descriptions without bodies or headers; the sink receives only safe events and a failing sink does not break the app; production versus development logging; and scans of `src/` for raw `console.error`/`console.warn` and for tracker or beacon code.
