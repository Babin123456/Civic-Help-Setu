# Firebase security rules

The app does **not use Firebase yet** (see [INTEGRATIONS.md](INTEGRATIONS.md) and the threat model, T2). This folder holds the rules for the planned Firestore and Cloud Storage backend, written and tested **before** any data goes there, so the first deploy is already deny-by-default. Client-side checks (`ProtectedRoute`, `can()` in [ACCESS_CONTROL.md](ACCESS_CONTROL.md)) never secure a database; these rules do.

```
firebase/
  firebase.json          emulator and rules configuration
  firestore.rules        Firestore rules
  storage.rules          Cloud Storage rules
  emulator/              tests that run both rule files against the Firebase emulators
```

## Assumptions

- **Sign-in.** Users sign in with Clerk. `POST /api/firebase-token` (a Vercel function, `api/firebase-token.js`) checks the Clerk session token and returns a Firebase **custom token** whose only claim is `role` (`admin` or `citizen`), copied from Clerk `publicMetadata.role` with the same rule as `src/services/roleService.js`. The browser cannot set it. See "Token service" below.
- **The role is never read from a document.** `isAdmin()` looks only at the signed token (`request.auth.token.role == 'admin'`), so a `roles/{uid}` or `users/{uid}` document that says `admin` grants nothing. Test: "a role stored in a Firestore document does not make anyone an admin".
- **Anonymous sessions** (Firebase anonymous auth) may only file reports and feedback. They cannot keep a profile, personal records, vault files or vote.
- **Server writes** (the Admin SDK or Cloud Functions) bypass rules, so aggregates such as `barrierInsights` and role changes are written there.

## Access policy

"Owner" is the signed-in, non-anonymous account whose id is in the path or in `reporterId`. "Admin" is a token with `role: admin`.

### Firestore

| Path | Read | Create | Update | Delete | Fields |
| --- | --- | --- | --- | --- | --- |
| `users/{uid}` | owner | owner | owner | owner | only `displayName`, `language`, `theme`, `createdAt` (server time, immutable), `updatedAt`; text length limits |
| `users/{uid}/{vaultDocs, saved, applications, officeTokens, reminders, settings, assessments, grievanceTickets, checklists, drafts, applicantProfiles, scorecards, assistantChats}/{id}` | owner | owner | owner | owner | one envelope: `data` (map, at most 60 keys, no `role`/`isAdmin`/`verified`/`permissions`/`uid`/`ownerId`), `schemaVersion` (1-100), `updatedAt` (server time), optional `createdAt` (immutable). Any other collection name is refused. **Admins have no access** |
| `users/{uid}/privacyAudit/{id}` | owner | owner | never | never | `action`, `category`, `createdAt` (server time) |
| `services/{id}` | **public** | admin | admin | admin | `name` (1-200), `category`, optional `shortDescription`; at most 60 fields |
| `notices/{id}` | public if `status == approved`, else admin | admin | admin | admin | `title`, `status` in `pending_review`, `approved`, `rejected`, `archived` |
| `barrierInsights/{id}` | **public** | never | never | never | server only |
| `errorReports/{id}` | filer, admin | any session (including anonymous), as itself | admin: `status`, `resolutionNotes`, `resolvedAt` only | admin | `reporterId` must equal the caller; `status` starts `pending`; `createdAt` is server time; text limits |
| `serviceSubmissions/{id}` | filer, admin | any session, as itself | admin: `status`, `reviewNotes`, `reviewedAt` only | admin | starts `pending`; limits on every text field |
| `barrierReports/{id}` | filer, admin | any session, as itself | admin: `status`, `reviewerNotes`, `reviewedAt`, `reviewedBy` | admin | starts `pending` |
| `bottleneckFeedback/{id}` | filer, admin | any session, as itself | admin: `status`, `adminNotes`, `reviewedAt`, `reviewedBy` | admin | starts `new`; message at most 1500 |
| `communityAudits/{id}` | **public** | account (not anonymous), as itself | admin: `status`, `adminNote`, `resolvedBy`, `resolvedAt` | admin | starts `PENDING_CORROBORATION` |
| `communityAudits/{id}/votes/{uid}` | that voter, admin | that voter | that voter | that voter | `vote` is `UP` or `DOWN` (one vote per account; counters are computed server-side, never edited by a client) |
| `roles/{uid}` | that user, admin | never | never | never | role changes happen in the identity provider |
| `auditLogs/{id}` | admin | admin, with `actorId` equal to their own uid and server time | never | never | append-only |
| `sourceConflicts/{id}`, `reviewOverrides/{id}` | admin | admin | admin | admin | admin-only workflow data |
| anything else | no | no | no | no | catch-all `allow read, write: if false` |

Reports and submissions can hold an e-mail address, so only the person who filed one and admins can read them. Public reads are limited to service guides, approved notices, published aggregates and community audits, which the site already shows to everyone.

A query on `notices` must filter on `status == 'approved'` (an unfiltered list is refused, because it would include unapproved notices); a query on `errorReports` for a non-admin must filter on `reporterId == <their uid>`.

### Cloud Storage

| Path | Read, list, delete | Create, replace | Rules |
| --- | --- | --- | --- |
| `vault/{uid}/{fileName}` | owner only (admins included: **no**) | owner only | PDF, JPEG or PNG; 1 byte to 5 MB (same limits as `src/services/vaultValidation.js`); file name at most 160 characters; anonymous sessions refused |
| anything else | no | no | catch-all deny |

## Token service

`api/firebase-token.js` is the only place that decides a Firebase `role`.

```
browser -- Clerk session token --> POST /api/firebase-token
        <-- { token } ------------   Firebase custom token with { role }
browser -- signInWithCustomToken(token) --> Firebase Auth -- ID token (role claim) --> Firestore / Storage rules
```

- **Clerk session required.** No `Authorization: Bearer <session token>`, or a token Clerk rejects, gets `401` and nothing else happens.
- **The role is looked up, never supplied.** It is read from the user's Clerk `publicMetadata` and mapped by `resolveRole` (`admin` is exactly `admin`; anything else is `citizen`). Nothing in the request body, query or other headers can change it. If the lookup fails the function answers `502`: it does not issue a "citizen" token, which would silently demote an admin.
- **Only one claim, `role`.** The Firebase uid is the Clerk user id.
- **Errors are fixed codes** (`missing_token`, `invalid_token`, `role_lookup_failed`, `token_failed`, `not_configured`), never a library message; responses are `Cache-Control: no-store`; only `POST` is answered.
- **Configuration** is two server-side environment variables in the Vercel project: `CLERK_SECRET_KEY` and `FIREBASE_SERVICE_ACCOUNT` (the service account JSON on one line). Without them the function answers `503 not_configured`. They are never read by the browser bundle (a test checks that `src/` imports neither `firebase` nor `firebase-admin`).
- **Content-Security-Policy.** The function is same-origin (`connect-src 'self'`). When the Firebase client SDK is added to the app, its Google endpoints must be added to `connect-src` in `scripts/securityHeaders.js`, with a reason.

Setting it up (once, by whoever owns the Firebase and Clerk projects): create a Firebase project and a service account key, set the two variables in Vercel, deploy `firebase/` with the release instructions below, and set `publicMetadata.role` to `admin` in Clerk for the admin accounts only.

## Mapping the app's stores to records

`src/services/cloudRecords.js` is the contract between the browser's local stores and the personal collections:

- Every key in the privacy registry (`USER_DATA_STORES`) is either a **cloud store** (it names its collection) or **device only** with a written reason (the vault PIN, caches, and items that are sent as submissions instead). A test fails when a new store is added to the registry without being classified.
- A record is `{ data: { value, position? }, schemaVersion: 1, updatedAt }`. Lists keep one record per item (`position` keeps the order); documents keep the whole value in `value`. Keeping the user's content under `value` means its own field names (`role`, `status`, ...) never collide with the rules' checks and nothing is dropped.
- Ids are `<store slug>--<item id>` cleaned to a valid Firestore id, so two stores in one collection never collide. A record over 900 KB is refused (Firestore's limit is 1 MiB).

The app itself still reads and writes `localStorage`. Nothing calls Firestore yet; the sync layer that does will use these functions, so what it writes is already known to pass the rules.

## What has been verified, and what has not

| | Status |
| --- | --- |
| Rules allow and deny the right operations | Verified on the Firestore and Storage emulators (`firestore-rules.test.mjs`, `storage-rules.test.mjs`) |
| The token a Clerk session turns into carries `role` and `sign_in_provider: custom` | Verified on the Auth emulator with the real handler and `firebase-admin` (`token-flow.test.mjs`), including real ID tokens sent to the Firestore emulator |
| Every personal store's records pass the rules and read back unchanged | Verified on the emulator (`cloud-records.test.mjs`) |
| Clerk token verification and the `publicMetadata` lookup | **Not verified against Clerk**: the tests stand in for it (no Clerk secret key was available) |
| A real Firebase project and service account | **Not set up**: needs the project owner (see "Setting it up") |
| The app syncing its stores to Firestore | **Not built**: the stores are still local only |
| The `Firebase rules` GitHub workflow | Runs on pull requests that touch `firebase/` |

## Run the tests

Needs Node 20+ and Java 11+ (the emulators).

```bash
npm run rules:test          # installs firebase/emulator and runs both suites on the emulators
```

`firebase/emulator/firestore-rules.test.mjs` and `storage-rules.test.mjs` (with `token-flow.test.mjs` and `cloud-records.test.mjs`, 77 tests) try every row above as an anonymous session, a citizen without the admin claim, another citizen, and an admin, and check allowed **and** denied operations: owner scoping, forged `reporterId`, forged status or timestamps, privileged and unexpected fields, oversized values, unfiltered list queries, append-only logs, and unknown paths.

Without the emulators, `npm test` runs `scripts/firebaseRules.test.js`, which checks that the rule files, `firebase.json`, this table and the emulator tests stay in step (every collection in the rules is documented and has a test; nothing is open to everyone; both files end in a deny-all).

## Release instructions

Before **any** deploy of rules (`firebase deploy --only firestore:rules,storage`):

1. `npm run rules:test` passes on the commit you will deploy. A deploy of rules that were not tested is not allowed.
2. If you changed a rule, you changed the table above and added or updated a test in the same pull request.
3. Deploy to a staging project first and sign in as a citizen, an anonymous visitor and an admin to run one allowed and one denied action each.
4. Only then deploy to production, and keep the previous rules file in git so a bad release is one `git revert` and redeploy away.

The `Firebase rules` workflow runs the emulator tests on every pull request that touches `firebase/`.

## When you add a collection or a storage path

1. Add it to the table above with who can read, create, update and delete, and which fields are allowed.
2. Add the `match` block (deny by default: only allow what the table says), with `onlyKeys([...])` for the allowed fields and limits on text.
3. Add allowed and denied cases to the emulator tests, including the roles that must be refused.
4. Run `npm run rules:test` and `npm test`.

## What rules cannot do

Rules see one request at a time: they cannot rate limit per IP or per minute, send an e-mail or check a value against another service. Use Firebase App Check and quotas for abuse limits, and keep anything that needs a trusted decision (changing roles, publishing aggregates) in server code.
