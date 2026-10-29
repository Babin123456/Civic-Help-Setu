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

- **Sign-in.** Users sign in with Clerk. The app exchanges the Clerk session for a Firebase **custom token** whose claims include `role` (`admin` or `citizen`), copied from Clerk `publicMetadata.role` by the token service (the same source as `src/services/roleService.js`). The browser cannot set it.
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

## Run the tests

Needs Node 20+ and Java 11+ (the emulators).

```bash
npm run rules:test          # installs firebase/emulator and runs both suites on the emulators
```

`firebase/emulator/firestore-rules.test.mjs` and `storage-rules.test.mjs` try every row above as an anonymous session, a citizen without the admin claim, another citizen, and an admin, and check allowed **and** denied operations: owner scoping, forged `reporterId`, forged status or timestamps, privileged and unexpected fields, oversized values, unfiltered list queries, append-only logs, and unknown paths.

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
