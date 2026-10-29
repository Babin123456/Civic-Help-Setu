# Access control for privileged actions

Hiding a button, or wrapping a page in `<ProtectedRoute>`, only changes what a page **shows**. Every function that reads or changes admin-only records also checks who is asking, so a direct call is refused even when the UI is bypassed.

The rules live in one file: [`src/services/accessControl.js`](../src/services/accessControl.js).

## How it works

- **Deny by default.** An action that is not in `PERMISSIONS`, no signed-in user, or a role that is not allowed are all refused with a `PermissionDeniedError` (`code: 'FORBIDDEN'`).
- **The caller does not say who it is.** `AuthProvider` registers the signed-in user (`setCurrentActor`) and the data layer reads it from there. A `reviewerRole`, `userRole` or `actorName` argument is never used to decide access.
- **One role check.** Only the exact role `admin` is an admin; `Admin`, `moderator`, `superadmin`, an empty value or a non-string are citizens. With Clerk the role comes from `publicMetadata` (`roleService.js`).
- **Checks run before anything is written** and outside `try/catch` blocks that would swallow the error, so a refused call changes nothing.
- **The UI asks the same question.** `can('action')` / `can('action', user)` decides whether a link or panel is shown (navigation bar, footer, barrier moderation tab), so the screen and the data layer cannot disagree.

## Inventory

| Action | Who | What it protects | Enforced in |
| --- | --- | --- | --- |
| `services.write` | admin | add or edit a service guide (`civicbridge_custom_services`) | `saveAdminService` |
| `services.import` | admin | bulk import of guides | `importAdminServices` |
| `services.delete` | admin | remove a guide | `deleteAdminService` |
| `reports.read` | admin | error report queue (holds reporter emails) | `getReports` |
| `reports.resolve`, `reports.dismiss` | admin | resolve or dismiss a report | `resolveReport`, `dismissReport` |
| `audit.read`, `audit.write` | admin | the admin audit trail | `getAuditLogs`, `addAuditLog` |
| `users.read`, `users.updateRole` | admin | the role list | `getUserList`, `updateUserRole` |
| `submissions.read`, `submissions.review` | admin | community submissions (hold contributor emails) | `getServiceSubmissions`, `approveServiceSubmission`, `rejectServiceSubmission` |
| `communityAudits.resolve` | admin | resolving a community audit report | `resolveAuditReport` |
| `sourceConflicts.review` | admin | resolving or reopening a source conflict | `resolveSourceConflict`, `reopenSourceConflict` |
| `barriers.moderate` | admin | approving or rejecting a barrier report | `moderateBarrierReport` |
| `feedback.moderate` | admin | bottleneck feedback review queue | `reviewBottleneckFeedback`, `queryFeedbackForModeration`, `resetFeedbackDefaults` |
| `notices.manage` | admin | notice digest | `addNotice`, `updateNotice`, `changeNoticeStatus`, `resetNoticesToDefault` |
| `availabilityNotices.manage` | admin | service availability notices | `addAvailabilityNotice`, `updateAvailabilityNotice`, `publishAvailabilityNotice`, `withdrawAvailabilityNotice`, `deleteAvailabilityNotice` |
| `freshness.review` | admin | "this guide was reviewed" records | `recordServiceReview` |
| `links.check` | admin | official link check results | `saveLinkCheck`, `recordManualCheck`, `reviewRedirect` |

Public on purpose (anyone, including signed-out visitors): reading the service catalogue, submitting an error report (`submitErrorReport`), submitting and voting on community audits, submitting barrier reports and bottleneck feedback, reading approved notices.

## Adding a privileged feature

1. Add the action to `PERMISSIONS` with its roles, the storage it touches and a one-line description.
2. Call `requirePermission('your.action')` as the first line of the function that reads or writes the data (before any `try`).
3. Add it to `CALLS` in `src/services/accessControl.test.js`. That test fails if an action in the table has no test call, or is never enforced in `src/services`.
4. Use `can('your.action')` in the component to decide what to show.

## What this does not do

This app has **no server**: all records are in each browser's `localStorage`. The checks above stop mistakes, stale tabs and UI-only gating, and they make the intended rules explicit and testable. They cannot stop someone who opens the browser's developer tools, because that person can edit `localStorage` directly or call the functions after faking the signed-in user. Two things are still needed before shared data exists:

- **A backend or Firebase rules** that check the role on the server for every write (see `docs/security/threat-model.md`, T2, and the Firebase rules audit in #220). The inventory above is the list of actions those rules must cover.
- **No demo admin in production builds.** Without a Clerk key the login page lets anyone pick the admin role. That is a separate item in the threat model (F1) and is not changed here.
