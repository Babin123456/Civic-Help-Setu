# Civic Moving-Home Address-Change Action Planner (#725)

## 1. Citizen Problem Statement & Administrative Context
When an Indian citizen relocates their home—whether moving to a new neighborhood in the same city, to another district within the same state, or across state borders—**government departments do not automatically synchronize or share updated address records**.

Citizens routinely experience:
- **Circular Dependency Deadlocks**: Service B demands updated Aadhaar as Proof of Address (POA), while updating Aadhaar requires a registered rent agreement or utility bill that may take weeks to obtain.
- **Form Confusion**: Submitting the wrong statutory form (e.g., submitting Form 6 instead of Form 8 for voter registration, which creates duplicate voter entries punishable under Section 31 of the Representation of the People Act, 1950).
- **Inter-State Legal Traps**: Failing to obtain a No Objection Certificate (Form 28) from the parent RTO before moving personal vehicles across state lines for more than 11 months, leading to re-registration fines under Section 47 of the Motor Vehicles Act, 1988.
- **Ration Card Dual Entitlement Pitfalls**: Cancelling ration cards unnecessarily instead of utilizing One Nation One Ration Card (ONORC) biometric portability.

The Civic Moving-Home Address-Change Action Planner resolves these issues by coordinating independent processes into a single sequential, dependency-aware action checklist.

---

## 2. Core Architectural Invariants & Ethical Guardrails

### Invariant 1: Non-Transactional Planning Guardrail
Civic Help Setu **strictly does not log into citizen government accounts, harvest passwords or OTPs, or submit applications on the citizen's behalf**. Prominently displayed across all views:
> *"Non-Transactional Planning Guardrail: Civic Help Setu coordinates official address update checklists and document requirements without accessing government portal logins, collecting passwords or Aadhaar OTPs, or submitting applications on your behalf."*

### Invariant 2: Client-Side Local Storage & Complete Data Autonomy
All citizen tracking data—including Application Reference Numbers / URNs, submission dates, documents gathered, and personal notes—is stored **strictly in client-side `localStorage`** (`civic_address_change_planner_v1`).
- No personal data or reference numbers are uploaded or synced to external servers.
- Citizens have complete autonomy to inspect, edit, export, or permanently erase all saved planner data via the `"Delete My Checklist Data"` action.

### Invariant 3: Fail-Closed Grounding & Official Provenance
Every address update requirement, form number, statutory basis, fee, and timeline must link to a dated official government HTTPS portal (`.gov.in` or official Oil Marketing Company portals):
- Aadhaar: `https://myaadhaar.uidai.gov.in`
- Voter Roll: `https://voters.eci.gov.in`
- Driving Licence & RC: `https://parivahan.gov.in`
- Food Security & Ration Cards: `https://nfsa.gov.in`
- LPG Gas: `https://www.pmuy.gov.in` / `https://myhpgas.in`
- Banking KYC: `https://www.rbi.org.in`

Non-HTTPS URLs or third-party commercial blogs are rejected by typed contract schemas.

### Invariant 4: Explicit Unavailable Data State
If an inter-state procedure, state-level portal link, or municipal rule is unverified or varies widely without a central online portal (e.g., state-specific inter-state ration card replacement), the system displays an explicit **Unverified / Unavailable** banner (`unavailableData: { isUnavailable: true, reason: '...' }`) rather than filling gaps with guesses.

### Invariant 5: Strict Separation of Official Instructions from Editorial Tips
In detail views and modals:
1. **Official Instructions**: Verbatim statutory clauses from gazettes or official department circulars (e.g. Regulation 3 of Aadhaar Regulations 2016; Rule 26 of Registration of Electors Rules 1960).
2. **Civic Help Setu Editorial Guidance**: Pragmatic tips, common gotchas, and advice authored by civic researchers, clearly badged with distinct visual styles.

### Invariant 6: Zero PII in Public Views, Community Submissions, and Analytics
- No citizen identifiers appear in URLs, route parameters, or diagnostic events.
- Community corrections submitted via `/api/address-change-corrections` are scanned server-side to reject submissions containing Aadhaar numbers, PAN, phone numbers, email addresses, or passwords.

---

## 3. Data Schema & Typed Contract
Defined in `src/data/addressChangeContract.js`:
- `id`: Lowercase kebab-case slug (e.g. `aadhaar-address-update`).
- `name`: Full service record title.
- `recordType`: `'aadhaar' | 'voter_id' | 'driving_licence' | 'vehicle_rc' | 'ration_card' | 'lpg_gas' | 'bank_kyc' | 'electricity_water'`.
- `authority`: `{ name, jurisdictionLevel, portalUrl }`.
- `applicableMoveTypes`: Array of `['same_city', 'inter_district', 'inter_state']`.
- `dependencyOrder`: Positive integer representing chronological sequence (Aadhaar = 1).
- `prerequisites`: Array of prerequisite record IDs.
- `acceptedProofs`: Array of `{ proofType, name, issuingAuthority, description, isConditional, conditionNotes }`.
- `officialInstructions`: Verbatim statutory clause.
- `editorialNotes`: Civic Help Setu practical advice.
- `sourceUrl`: Strict HTTPS dated government portal link.
- `effectiveDate` & `lastVerified`: ISO dates `YYYY-MM-DD`.
- `unavailableData`: `{ isUnavailable, reason, unverifiedFields }`.

---

## 4. Chronological Prerequisite Dependency Graph

```
           [ 1. Aadhaar Address Update (UIDAI) ]
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
[ 2. Voter ID (ECI) ] [ 6. LPG Transfer ] [ 7. Bank KYC (RBI) ]
         │               │
         ▼               ▼
[ 3. Driving Licence ] [ 4. Vehicle RC (Form 28 / 33) ]
         │
         ▼
[ 5. Ration Card / PDS Transfer (NFSA / State Food Dept) ]
```

1. **Step 1: Aadhaar**: Update first using registered rental agreement or electricity bill.
2. **Step 2–3: Voter ID & Driving Licence**: Once Aadhaar is updated, ECI Form 8 and Parivahan Sarathi allow instant online e-KYC without physical visits.
3. **Step 4: Vehicle RC**: Intimation of address change under Form 33 within 30 days. For inter-state moves (>11 months), Form 28 NOC is mandatory.
4. **Step 5: Ration Card / PDS**: Utilize One Nation One Ration Card (ONORC) for immediate grain access; obtain Surrender Certificate only if requesting a new state card.

---

## 5. Community Submissions & Administrator Review
- **Endpoint**: `/api/address-change-corrections.js`.
- **Abuse Controls**: Fixed-window rate limiting (10 req/min/IP) and single-flight execution via `api/_lib/abuseGuard.js`.
- **Verification Seal**: Emits deterministic cryptographic receipts (e.g. `AC-CORR-XXXX-XXXX`).
- **Moderator Queue**: Embedded in `src/pages/Admin.jsx` (`AddressChangeCorrectionQueue.jsx`), enabling civic moderators to click-test dated official sources before publishing updates.

---

## 6. Refresh Cadence & Fallback Handling
- **Quarterly Audit**: State rules and portal URLs are re-verified every 90 days.
- **Stale Data Notice**: A visual banner flags records where verification exceeds 90 days (`AddressChangeStaleNotice.jsx`).
- **Storage Corruption Recovery**: If `localStorage` data is corrupted, `readAddressChangePlan()` safely recovers and resets to default unblocked state without throwing errors.

