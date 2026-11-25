# Regional service review and device-local ownership history

Issue #1269 extends the existing Services directory, jurisdiction filters and admin Review assignment modal. It does not create another service catalogue. The project administrator explicitly approved the device-local boundary in [this scope decision](https://github.com/GoldRay19/Civic-Help-Setu/issues/1269#issuecomment-7127400418).

## What a citizen sees

Refine the existing state/district/search filters, then expand **Regional directory review**. The panel shows the first 20 matches, their public authority, jurisdiction, recorded availability, source evidence/contact links and verification cadence. Missing or future dates, unsafe/missing source evidence and invalid jurisdictions stay unknown. A review becomes overdue exactly at its configured cadence and asks for maintainer review; stale availability is not a live service guarantee. Matching service names in an identical normalized jurisdiction with incompatible authority/availability/contact metadata are flagged for review rather than silently reconciled. Disjoint jurisdictions are not conflicts. National/state override or legal equivalence is not inferred.

The panel uses the existing catalogue and jurisdiction normalization. Existing `lastVerified`/resource metadata supplies a fallback when no device-local override exists. It does not check external websites or assert government approval. Public projections never include private reviewer names, notes or ownership history. They refresh on local review changes, cross-tab storage events and once per minute for overdue transitions. A corrupt review store makes local review status unknown and produces a visible notice.

## What an administrator changes

Open the existing service Review assignment modal. Its original reviewer/team/private-note controls retain their existing behavior. The new separate form records public availability, a 1–365 day cadence, a non-future real review date and public HTTPS source/contact URLs. Credentials, URL queries and fragments are refused. Reviewed availability requires dated evidence; otherwise use Unknown.

The warning **Device-local only** is visible inside the modal. These records live only in this browser/device, are not synchronized across staff devices and are **not an authoritative or organization-wide audit trail**. Existing client permission checks prevent accidental citizen UI calls; browser developer tools can still change local state. Shared authorization requires server-side identity and staff roles. No Firestore or shared datastore is introduced.

## History, concurrency and failure handling

Public review metadata uses `civicbridge_regional_reviews_v1` with `schemaVersion: 1`, a service-ID map, monotonically increasing revision and retained earlier review values. Each successful update and its previous verification revision are committed in one localStorage write. Updates use a same-origin Web Lock and expected revision: two stale-tab writes cannot both succeed. Browsers without Web Locks remain read-only for this form. Reopen a stale form to load the latest revision; failed/quota writes retain the form and previous stored bytes for retry.

Ownership transfers continue through `assignServiceOwnership` and the existing private admin audit log. The modal now displays its retained OWNERSHIP_CHANGED events for this service, excluding private notes. The existing audit retention is 150 events across the device: this feature cannot reconstruct old pruned events and does not call this history complete or tamper-proof. Clearing/deleting an assignment keeps the existing application semantics; retained audit events are the source for prior transfers.

Verification history is bounded to 100 earlier revisions per service, 5,000 service records, and a 2,000,000-character serialized store. At a limit, writes fail visibly rather than silently trimming verification history. Export local verification history before an approved archive or migration. The panel does not automatically delete/archive data or send emails. The public view renders at most 20 rows after existing filters; projection generation is linear in the catalogue and retained local review payload within these bounds.

## Rollout and rollback

There is no schema migration for existing catalogue or ownership records: old records remain valid, and absence of the new key uses the catalogue fallback. Deploy normal frontend assets. Check unknown/current/overdue/conflicting regional fixtures, staff access, two-tab revisions and quota failure before enabling use. Monitor read failures, save failures, capacity errors, stale counts and conflict counts through the visible panels; an unreadable store or lost save is an immediate operator investigation, and overdue/conflicting records require the responsible staff team's review. No external telemetry delivery is configured or claimed.

Rollback the frontend to the previous release while leaving the versioned key intact. Export before any repair; do not overwrite malformed bytes or a future-version store. Moving to shared persistence is a separate migration: export the versioned review records and available local ownership events, assign a server-side identity/authorization model, resolve device conflicts with staff approval, and preserve provenance and retention choices. A local revision number is not a cross-device trust root.

## Validation

Focused tests cover validation, private-field exclusion, unavailable locks, same-origin concurrent stale writes, corruption/future versions, capacity, quota/retry, date boundaries, jurisdiction conflicts and legacy ownership transfers. Browser checks must exercise actual components in an explicitly synthetic role/storage fixture; they are not proof of production authentication or shared-backend enforcement.
