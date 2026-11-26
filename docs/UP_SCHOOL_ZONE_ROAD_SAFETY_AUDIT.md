# UP School-Zone Road Safety Hazard and Safe-Crossing Audit System (#984)

## Civic Problem & Purpose

Children and caregivers navigating routes to schools across Uttar Pradesh urban and rural settlements frequently face dangerous physical road conditions:
* Absent or completely faded zebra crossings at school gates.
* Broken, encroached, or non-existent pedestrian footpaths forcing children into high-speed motorized traffic lanes.
* Missing speed-calming interventions (speed humps, rumble strips, table-top pedestrian tables).
* Missing school-zone warning signage and absence of mandatory 20–25 km/h school-approach speed limit boards.
* Poor sightlines caused by blind curves, untrimmed vegetation, and unorganized commercial vehicle parking.
* Severe monsoon drainage waterlogging and open storm drains right outside gate entrances.
* High-intensity conflicts between through-traffic and school vans, auto-rickshaws, e-rickshaws, and two-wheelers during bell ringing hours (8:00 AM – 9:00 AM & 1:30 PM – 2:30 PM).

Historically, parent and teacher concerns are expressed informally or in scattered verbal complaints without a verifiable evidence trail. When written grievances are submitted, they are often bounced between departments (e.g. Nagar Nigam blaming UP PWD, or PWD blaming NHAI).

The **UP School-Zone Road Safety Hazard and Safe-Crossing Audit System** enables community members, caregivers, teachers, and School Management Committees (SMCs) to:
1. Conduct structured, objective civil safety audits grounded in public school identifiers (UDISE+).
2. Protect child and bystander privacy via automated face and vehicle license plate redaction.
3. Classify and route hazards to the correct road-owning authority with transparent source attribution and manual correction override.
4. Track statutory resolution lifecycle stages with an unalterable rule preventing premature closure without field verification.
5. Generate formal, printable audit reports tailored for School Management Committees (SMC) under the Right to Education Act.

---

## Key Invariants & Safeguards

### 1. Grounded School Zone Register (UDISE+)
* Each audited zone is anchored to a public 11-digit **UDISE+ (Unified District Information System for Education Plus)** institutional code.
* Physical audits identify the specific school gate entrance (e.g. *Gate 1 - North Frontage*, *Pedestrian Gate 2*) and facing road geometry.
* Covers pilot government schools in Uttar Pradesh urban municipal corporations (Lucknow, Kanpur) as well as rural approach roads (Mohanlalganj, Sarojini Nagar).

### 2. Privacy Redaction & Reporter Confidentiality (AC-2)
* **Public Displays Redacted:** Any photo attached to a hazard audit undergoes privacy blurring. Faces of children, pedestrians, and bystanders, as well as vehicle registration number plates, are obscured before public display.
* **Original Kept Private:** The unredacted original photo reference is accessible exclusively to the authenticated reporter via a private session token. Public API consumers and peer community members receive only the privacy-redacted artifact.
* **Text Redaction:** Vehicle license plate numbers inadvertently written into comments are automatically neutralized.

### 3. Transparent Jurisdiction Routing with Manual Override (AC-3)
* Road ownership in Uttar Pradesh is multi-tiered:
  - **Municipal Corporation (Nagar Nigam / Urban Local Body):** Ward streets, colony roads, internal urban connectors.
  - **Uttar Pradesh Public Works Department (UP PWD):** Major District Roads (MDR), Other District Roads (ODR), State Highways (SH).
  - **National Highways Authority of India (NHAI):** National Highways and bypass service roads.
  - **Urban Development Authorities (LDA / KDA):** Planned master-plan sector roads.
  - **Gram Panchayat / Rural Engineering Department (RED / PMGSY):** Village connector link roads.
* The system evaluates road name and location against the reviewed jurisdiction directory, citing the specific administrative source (e.g. *UP PWD Road Inventory GIS*, *NHAI Gazette Notification*, *Nagar Nigam Ward Street Register*).
* **Manual Override Guarantee:** Community auditors can correct the suggested jurisdiction with a noted rationale if localized municipal jurisdiction has shifted.

### 4. Non-Accusatory Civil Audit Principle
* The system provides an objective civil audit of physical conditions (measurements, missing infrastructure, visibility obstacles).
* **Strict Invariant:** The system **does not automatically assert criminal liability, traffic misconduct, or statutory fault**. Reports state physical infrastructural deficiencies to facilitate engineering remediation.

### 5. Enforced Status Lifecycle Invariant (AC-4)
* Lifecycle progression:
  ```
  REPORTED -> ACKNOWLEDGED -> INSPECTION_SCHEDULED -> INSPECTED -> INTERIM_MEASURE_IMPLEMENTED -> RESOLVED
  ```
* **Statutory Guardrail:** A report **CANNOT be marked `RESOLVED` directly from `ACKNOWLEDGED`**. An administrative acknowledgement simply confirms receipt; marking resolution requires verified evidence of either a completed physical site inspection or an interim safety measure (e.g. temporary rumble strips, traffic cones, crossing marshals).

### 6. School Management Committee (SMC) Printable Audit Export (AC-5)
* SMCs constituted under Section 21 of the Right to Education (RTE) Act 2009 need structured documentation for their monthly safety resolutions.
* The system provides a 1-click printable audit dossier including:
  - School UDISE+ and gate details.
  - Categorized checklist of 7 road safety dimensions.
  - Recommended responsible road-owning authority and contact office.
  - Severity rationale and photos.
  - Formal signature block for SMC Chairperson, Head Teacher, and Ward Road Engineer.

### 7. Duplicate Audit Suppression (AC-6)
* Submissions within 100 meters of an existing active audit for the same school gate and hazard type are detected as duplicates.
* Community members can add their co-endorsement and fresh timestamp to the existing audit rather than creating fragmented parallel reports.

---

## Technical Architecture

```
src/
├── data/
│   ├── upSchoolZoneSafetyContract.js       # Schemas, hazard types, authorities, state machine
│   ├── upSchoolZoneSafetyContract.test.js  # Contract invariant unit tests
│   └── upSchoolZoneSafetySeed.js           # Authentic UP school zones (Lucknow urban + rural)
├── services/
│   ├── upSchoolZoneSafetyService.js        # Audit submission, privacy redaction, routing, duplicate checks
│   └── upSchoolZoneSafetyService.test.js   # AC-1 through AC-7 test suite
├── components/schoolZoneSafety/
│   ├── SchoolZoneSafetyHeader.jsx          # Header, live metrics, pilot scope indicator
│   ├── SchoolZoneAuditFeed.jsx             # Card list with severity badges, authority routing tags
│   ├── SchoolZoneAuditModal.jsx            # Audit wizard: hazard checklist, photo redaction, jurisdiction review
│   ├── SchoolZoneStatusTrackerModal.jsx    # State transition dialog enforcing lifecycle invariants
│   └── SmcPrintableAuditModal.jsx          # Printable SMC formal report with signature blocks
└── pages/
    ├── UpSchoolZoneSafetyAudit.jsx         # Unified workspace page
    └── UpSchoolZoneSafetyAudit.test.jsx    # UI testing suite
```

---

## Verification Suite

Execute the test suites with Vitest:
```bash
npx vitest run src/data/upSchoolZoneSafetyContract.test.js
npx vitest run src/services/upSchoolZoneSafetyService.test.js
npx vitest run src/pages/UpSchoolZoneSafetyAudit.test.jsx
```
