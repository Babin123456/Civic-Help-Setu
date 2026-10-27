# Third-party integrations

What leaves the browser, what is a public key and what is a real secret, and which
restrictions to switch on in each provider console. Written for issue #225 from the
code on `main` at the time (grep of `src/`, `index.html`, `vite.config.js`, git history
and a production build). Re-check it whenever a provider is added.

## The one rule

Everything prefixed `VITE_` is copied into the public JavaScript. Anyone who opens the
site can read it. So a `VITE_` variable is **public configuration by definition**, and a
real server secret must never be named `VITE_...`. `vite.config.js` now fails the build
if a `VITE_` variable is named or valued like a secret (`scripts/envGuard.js`).

## Summary

| Provider | Live in code | Data sent | Key type |
|---|---|---|---|
| Clerk | yes (`@clerk/clerk-react`) | sign-in/up details, profile fields, avatar | publishable key, public |
| Google Fonts | yes (`src/index.css`) | IP address, user agent, origin | none |
| Browser speech recognition | yes (mic buttons) | microphone audio, processed by the browser vendor | none |
| Google Calendar / Outlook web links | yes (user clicks) | office, address, time, service name | none |
| Google Maps links | yes (user clicks) | public office or shelter coordinates | none |
| WhatsApp / Telegram / mailto share | code exists, modal not mounted | public service checklist and a link | none |
| api.qrserver.com (QR image) | code exists, modal not mounted | page URL (origin + path only now) | none |
| AI / LLM provider | **no** | nothing | none |
| Analytics / telemetry | **no** | nothing | none |
| Firebase / Firestore | **no** (planned) | nothing yet | public web config |
| Email sending (SMTP, SendGrid, ...) | **no** | nothing | none |
| Map tiles / Leaflet / geocoder | **no** (map is an inline SVG) | nothing | none |

"Not mounted" means the component is in the repo but no page imports it, so it does not
run in the production bundle today (`api.qrserver.com` does not appear in `dist/`).

## Provider details

### Clerk (authentication)

- Code: `src/main.jsx`, `src/context/AuthContext.jsx`, `src/pages/Login.jsx`,
  `src/pages/SignUp.jsx`, `src/pages/Profile.jsx`, `src/pages/SSOCallback.jsx`.
- Sent to Clerk: email, password (sign-up form, goes only to Clerk), username, first and
  last name, Google OAuth profile, avatar image if uploaded. The Profile page also writes
  `phone`, `city`, `state`, `occupation` and `bio` into `unsafeMetadata`, so those are
  stored at Clerk. They are entered by the user on a form that says they are stored via
  Clerk.
- Key: `VITE_CLERK_PUBLISHABLE_KEY` (`pk_test_` / `pk_live_`) is public. The Clerk
  **secret key (`sk_...`) is not used anywhere** in this repo and must stay out of it.
- `unsafeMetadata` is writable by the signed-in user. Never use it for roles or
  permissions. Roles come from `publicMetadata.role` (`src/services/roleService.js`),
  which only the dashboard or a backend can change. That check is client side, so any
  real data behind "admin" has to be enforced by a server or Firestore rules as well.
- Provider errors: `src/utils/authFailure.js` (sign-in redirect) and
  `src/utils/providerError.js` (forms) map errors to fixed wording. Provider messages,
  ids and tokens are not shown, and in production not logged.
- Retention: Clerk keeps the user record until the account is deleted from the Clerk
  dashboard or by the user. Decide and document the real policy; the app's own purge
  (`privacyConsentService.js`) only clears this browser's localStorage and does not
  delete the Clerk user.

### Google Fonts

- `src/index.css` imports `fonts.googleapis.com` (Outfit, Inter); the font files come from
  `fonts.gstatic.com`. Google sees the visitor IP, user agent and the site origin
  (browsers send only the origin as referrer to other sites by default). No civic data.
- Option: self-host with `@fontsource/outfit` and `@fontsource/inter` and drop the
  `@import`. Not done here because it adds dependencies and a lockfile change.

### Browser speech recognition

- Code: `src/pages/Assistant.jsx`, `src/components/common/VoiceSearchInput.jsx`.
- `SpeechRecognition` / `webkitSpeechRecognition` is a browser feature. In Chrome the
  audio is processed by Google's speech service; this app does not control that. The mic
  buttons now say so in their tooltip. Spoken text can contain personal details, so a
  stricter option is a one-time "voice uses your browser's speech service" confirmation
  before the first use (not built).

### Calendar, maps, share links (user-initiated)

These only run when the user clicks a link, and then the destination receives the URL:

- Google Calendar / Outlook web (`src/services/calendarExportService.js`): office name,
  office address, date and slot, service name. The **appointment token is no longer in
  these URLs**; it stays in the `.ics` file, which is built on the device.
- Google Maps (`directionsUrl` in `src/data/locationOffices.js`, shelter links): public
  coordinates of the office or shelter. The user's own location is not put in any link.
- WhatsApp / Telegram / mailto (`src/services/checklistExportService.js`): public service
  name, fees, document list and a link to `/services/<id>`. No personal data.
- QR code (`src/components/common/QRCodeView.jsx`): sends only origin + path to
  `api.qrserver.com`, with `referrerPolicy="no-referrer"`.

### Geolocation

`navigator.geolocation` is used for the nearby-offices distance. The coordinates are kept
in `sessionStorage` (`civicbridge_user_coords`) and used only to sort offices locally.
They are not sent to any server.

### AI assistant

There is no LLM or other AI endpoint. `src/ai/*` answers from bundled data in the
browser, and the question text never leaves it (checked with request interception, see
the PR). The old `.env.example` listed `VITE_OPENAI_API_KEY`, which nothing used and which
would have invited putting an OpenAI key into the public bundle. It is removed. If an AI
provider is added later: call it from a server you control, keep the key there, and pass
text through `minimizeForExternal()` from `src/utils/dataMinimization.js` at the single
call site (or ask the user first).

### Analytics

None. The consent center has an `analytics_telemetry` switch that is off by default, but
no code collects anything. If analytics is added, keep it behind that switch and never put
names, phones, reference IDs, grievance text or coordinates in events.

### Firebase / Firestore (planned, not in code)

The maintainer plans Firestore with security rules. Nothing is wired yet. When it is:

- The web config (`apiKey`, `authDomain`, `projectId`, ...) is public, not a secret.
  Its protection is Firestore Security Rules and App Check, not hiding the key.
- Rules: start from default deny. Allow a user to read and write only documents whose
  `ownerUid` equals `request.auth.uid`, validate field names, types and sizes, and do not
  let clients write role or admin fields. Rules cannot trust `unsafeMetadata`.
- Turn on App Check (reCAPTCHA Enterprise or v3) and enforce it for Firestore.
- Restrict the browser API key (see below).
- Never put a service account JSON, Admin SDK key or `FIREBASE_TOKEN` in a `VITE_`
  variable; the build guard will stop it, but do not rely on that alone.
- Store the minimum: grievance text and locations only after an explicit submit, with a
  retention period and a deletion path (DPDP Act 2023 / GDPR).

## Environment variables

| Variable | Public or secret | Notes |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | public | only variable the app reads |
| `VITE_OPENAI_API_KEY` | would be a secret | removed from `.env.example`, unused |
| `VITE_API_BASE_URL` | public if ever used | removed from `.env.example`, unused |
| `CLERK_SECRET_KEY`, any `sk_...` | secret | not used by this repo, server only |
| Firebase web config | public | restrict the key, enforce rules and App Check |
| Firebase Admin / service account | secret | server only |

`import.meta.env` is read in `src/main.jsx` and `AuthContext.jsx` (for
`VITE_CLERK_PUBLISHABLE_KEY`) and in `src/utils/providerError.js` (only the built-in `DEV` flag). `vite.config.js` has no `define`.

## How it was checked

- `git log --all -G` for `sk_live`, `sk_test`, `pk_live_...`, `AIza...`, `sk-...`, `AKIA`,
  PEM private keys, `ghp_`, `firebase`: no key-like value was ever committed. The only
  `.env*` file ever added is `.env.example`, which held empty variable names.
  `sk_live_abc` appears once in `src/utils/authFailure.test.js` as a fake string.
- Production build (`vite build`), then grep of `dist/` for `sk_live`, `sk_test`,
  `AIza`, `sk-`, `OPENAI`, `CLERK_SECRET`, `SECRET_KEY`, `service_account`,
  `PRIVATE KEY`, `api.openai.com`, `firebase`, `firestore`, `api.qrserver.com`: no hits.
  The only third-party origins in the output are the ones in the table above. A build with
  server-style variables set (`CLERK_SECRET_KEY`, `OPENAI_API_KEY`) did not include them,
  because Vite only exposes `VITE_` names.
- Repeat with: `npx vite build && grep -rlE "sk_(live|test)_|AIza|OPENAI|CLERK_SECRET" dist`.

## Restrictions to set in the provider consoles

These cannot be done from the repo. They need the owner of each account.

**Clerk dashboard**
- Allowed origins / allowed redirect URLs: only the production domain (and localhost for
  dev instances). Use a separate production instance with `pk_live_`.
- Turn on bot protection / sign-up protection, set session lifetime, and disable sign-in
  methods the app does not use.
- Keep the secret key only in a server environment, rotate it if it was ever pasted
  anywhere shared.

**Google Cloud console (Firebase web API key or any Maps key, when added)**
- Application restriction: HTTP referrers, limited to the production origin(s).
- API restriction: only the APIs used (for example Identity Toolkit, Firestore, the
  specific Maps API). A referrer restriction is not authentication, it only limits abuse.
- Set quotas and billing alerts.

**Firebase console**
- Publish the Firestore rules above, enable App Check enforcement, pick the data
  location, add TTL policies for data that should expire, restrict who has project access.

**Hosting (Vercel)**
- Consider adding a Content-Security-Policy that lists only the origins in this document
  (Clerk frontend API and its script host, `img.clerk.com`, Cloudflare Turnstile if bot
  protection is on, Google Fonts). It was not added here because a wrong policy breaks
  sign-in and could not be tested against a real Clerk instance.

## Retention

| Data | Where | Retention today |
|---|---|---|
| Account and profile fields | Clerk | until the account is deleted |
| Chat, vault metadata, saved items, appointments, grievances | this browser's localStorage | until cleared or purged from the privacy center |
| Cached coordinates | sessionStorage | until the tab closes |
| Font requests | Google | Google's own logs |
| Calendar events | the user's own calendar | the user controls it |

## Findings and remediation

| Finding | Status | Where |
|---|---|---|
| Appointment token sent to Google/Outlook in the URL | fixed | `calendarExportService.js` |
| Raw Clerk error text shown on sign-up and profile save | fixed | `providerError.js`, `SignUp.jsx`, `Profile.jsx` |
| Raw provider error objects written to the console in production | fixed | `providerError.js`, `Login.jsx`, `SignUp.jsx`, `Profile.jsx` |
| `.env.example` invited a `VITE_OPENAI_API_KEY` | fixed | `.env.example`, `README.md` |
| Nothing stopped a secret being named `VITE_...` | fixed | `scripts/envGuard.js`, `vite.config.js` |
| QR URL could carry query string, image sent a referrer | fixed (not mounted yet) | `QRCodeView.jsx` |
| Voice input audio goes to the browser vendor, not disclosed | disclosed in tooltip | mic buttons |
| Google Fonts request exposes the visitor IP | open | self-host fonts |
| Clerk, Google Cloud and Firebase console restrictions | open, owner only | see above |
| Appointment form says SMS confirmation is sent, but no SMS provider exists | open, wording | `AppointmentModal.jsx` |
| Visit pass and calendar modals stack in the wrong order (calendar one is behind) | open, unrelated bug | `CalendarSyncModal.jsx` |
