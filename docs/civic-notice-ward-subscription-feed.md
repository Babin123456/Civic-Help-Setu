# Civic Public Notice Subscription by Ward and Topic

## Purpose & Scope
This service enables citizens to subscribe to official municipal notices, gazette circulars, emergency service disruptions, and public hearing schedules filtered by **Ward / Locality** and **Civic Topic**.

---

## Privacy-Preserving Locality Granularity
- **No Exact Geolocation or House Address Collection**: Subscriptions operate purely at the **Ward Number / Municipal Zone** level.
- Preserves privacy under the Digital Personal Data Protection (DPDP) Act, 2023, avoiding unnecessary tracking of citizen residences.
- Contact details (email or SMS) are strictly mapped to subscription topic hashes.

---

## Civic Topic Taxonomies
1. **Water Supply & Drainage**: Planned pipeline maintenance, rationing schedules, water contamination advisories.
2. **Road Works & Traffic Diversions**: Digging permissions, resurfacing, storm water drain widening, flyover maintenance.
3. **Solid Waste & Sanitation**: Door-to-door collection schedules, dry waste collection centres, special clean-up drives.
4. **Public Hearings & Ward Committees**: Monthly ward sabha dates, budget consultations, citizen question submissions.
5. **Property Tax & Trade Licences**: Rebate deadlines, property assessment revisions, self-assessment compliance.
6. **Zoning & Environment**: Tree felling permissions, environmental clearance notices, master plan draft objections.

---

## Corrigenda and Amendment Audit Trail
Civic public notices frequently undergo date extensions, venue adjustments, or amendments. The system tracks:
- **Original Notice ID**: The initial publication.
- **Corrigendum Notice ID**: Linked revision highlighting exact parameter changes.
- **Supersession Status**: Clear visual indication if an earlier notice has been withdrawn or superseded, preventing citizen confusion.

---

## Unsubscribe & Audit Guarantees
- Every notification dispatch includes a cryptographic one-click unsubscribe token.
- Subscription state changes (opt-in, topic filter modification, pause, unsubscribe) are recorded in an immutable audit log ensuring zero unsolicited communication.
- No third-party data tracking or cross-site telemetry is permitted.

---

## Delivery Frequency Preferences
- **Immediate Alert**: Reserved for emergency civic disruptions (e.g., sudden water trunk line burst or severe storm warnings).
- **Daily Morning Digest (Default)**: Summarized list delivered at 8:00 AM.
- **Weekly Digest**: Delivered on Sunday mornings with upcoming week works and public hearings.
