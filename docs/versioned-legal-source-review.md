# Versioned Legal Source Review for Workspace Templates (#949)

## 1. Overview & Problem Context

Legal drafting templates across civic platforms risk citing outdated provisions, repealed amendments, or rules inapplicable to a citizen's specific regional jurisdiction. 

Under the Indian legal framework, statutory provisions frequently evolve through central rule notifications, state-specific amendments (e.g. State Real Estate Rules under RERA 2016), and appellate tribunal rulings. Directly embedding citations inside template text makes version review, gazette verification, and historical tracking impossible.

**CivicBridge's Versioned Legal Source Review Registry** introduces a centralized, reviewed, and cryptographically verified statutory reference catalog. It protects citizens and legal administrators by providing:
- Explicit SemVer version transitions (`DRAFT` $\rightarrow$ `REVIEWED` $\rightarrow$ `SUPERSEDED`).
- Mandatory role-based authorization: Only verified administrators with `legalSources.review` permission can approve drafts, publish versions, or execute rollbacks.
- Automated template citation audits flagging missing citations, stale provisions (>365 days since review), superseded enactments, and regional jurisdiction conflicts.
- Immutable snapshot preservation for citizen drafts, guaranteeing that petitions generated on a given date retain exact historical references even if statutes are amended later.
- Strict statutory outcome neutrality, linking to official gazettes without promising case outcomes.

---

## 2. Architecture & Capabilities

```mermaid
flowchart TD
    subgraph Authoring & Review
        A[Statutory Draft Created] -->|requirePermission('legalSources.manage')| B[Status: DRAFT v0.1.0]
        B --> C{Authorized Reviewer Check}
        C -->|Admin Privilege Verified| D[Review & Publish v1.0.0]
        C -->|Citizen / Non-Admin| E[FORBIDDEN: PermissionDeniedError]
        D --> F[Status: REVIEWED]
    end

    subgraph Version Evolution & Rollback
        F -->|Statutory Amendment| G[Supersede Source]
        G -->|Links to New Provision| H[Status: SUPERSEDED]
        F -->|Tribunal Directive| I[Rollback to Historical Revision]
        I -->|Restores Prior Statutory Excerpt| F
    end

    subgraph Citation Audit Engine
        J[Workspace Template Citation Audit] --> K[Check Missing Citations]
        J --> L[Check Staleness >365d]
        J --> M[Check Superseded Rules]
        J --> N[Check Jurisdiction Mismatch]
        K & L & M & N --> O[Citation Health Score 0-100%]
    end

    subgraph Citizen Draft Preservation
        P[Citizen Generates Draft Petition] --> Q[bindHistoricalSourcesSnapshot]
        Q --> R[(Immutable Snapshot Store)]
        R --> S[Non-Repudiation & Historical Fidelity]
    end
```

### 2.1 Version Lifecycles
- `DRAFT`: Initial draft citation created by administrators. Cannot be cited in production citizen templates without raising audit warnings.
- `REVIEWED`: Officially certified by an authorized reviewer with gazette notification citation, reviewer notes, and SemVer version tag (`1.0.0`, `1.1.0`, etc.).
- `SUPERSEDED`: Provision has been repealed, struck down, or superseded by a subsequent enactment. Points to `supersededBy` modern provision ID.

### 2.2 Access Control & Authorization Enforcement
Privileged operations are guarded by CivicBridge's unified RBAC layer (`src/services/accessControl.js`):
- `legalSources.manage` (`roles: ['admin']`): Permits creating draft sources and updating draft attributes.
- `legalSources.review` (`roles: ['admin']`): Permits reviewing, publishing, superseding, and rolling back versions. Direct calls by citizens or unauthenticated actors throw a synchronous `PermissionDeniedError`.

### 2.3 Template Citation Health Engine
The citation auditor (`auditTemplateCitations`) evaluates template citations against user circumstances:
1. **Missing Citations**: Required statutory citations absent from the registry (Severity: `CRITICAL`).
2. **Unreviewed Drafts**: Citations currently in `DRAFT` status (Severity: `HIGH`).
3. **Superseded Enactments**: Citations pointing to repealed rules (Severity: `CRITICAL`). Points to the modern replacement.
4. **Stale Citations**: Provisions whose last review date exceeds 365 days (Severity: `WARNING`).
5. **Jurisdiction Mismatches**: State-specific provisions (e.g. Maharashtra RERA Rule 3) cited in petitions for other states (e.g. Delhi) (Severity: `HIGH`).

### 2.4 Immutable Historical Draft Citation Snapshots
When a citizen compiles a petition (e.g. Senior Citizen Tribunal application or RERA Section 18 dispute), `bindHistoricalSourcesSnapshot(draftId, templateId, metadata)` creates an immutable copy of the active citations at that instant. 

If statutes are amended months later:
- The citizen's draft retains the exact statutory text effective at the time of creation.
- Upon inspection, the system provides non-repudiation and evolution notices without corrupting the historical record.

### 2.5 Statutory Outcome Neutrality
In compliance with ethical civic technology standards, the registry forbids promissory or predictive legal outcome claims. Citations link to official gazette sources (India Code, eGazette, Ministry URLs) and maintain neutral descriptions.

---

## 3. Data Storage & Privacy Registry

The feature adheres to DPDP Act 2023 client-side storage standards and is registered in `src/services/privacyConsentService.js` and `docs/DATA_RETENTION.md`:

| Storage Key | Module | Purpose | Retention |
|---|---|---|---|
| `civicbridge_legal_sources_v1` | `legalSourceStorage.js` | Versioned statutory source citations, provisions, and SemVer lifecycle states | LocalStorage / Memory Fallback |
| `civicbridge_legal_draft_snapshots_v1` | `legalSourceStorage.js` | Immutable historical citation snapshots sealed in citizen drafting templates | LocalStorage / Memory Fallback |
| `civicbridge_legal_sources_audit_v1` | `legalSourceStorage.js` | Append-only audit trail for statutory reviews, publications, and rollbacks | LocalStorage / Memory Fallback |

---

## 4. Primary Workspace Templates Covered

1. **RERA Delay Possession & Execution Complaint** (`rera_homebuyer_dispute`):
   - Section 18(1), RERA 2016 (Return of amount and delay interest).
   - Section 40(1), RERA 2016 (Revenue Recovery Certificate execution).
2. **Senior Citizen Maintenance & Welfare Tribunal Petition** (`senior_citizen_maintenance`):
   - Section 4 & 9, MWPSC Act 2007 (Statutory maintenance entitlement).
   - Section 23, MWPSC Act 2007 (Transfer of property voidance).
3. **Street Vendor TVC & Section 20 Grievance Redressal** (`street_vendor_tvc_petition`):
   - Section 3(3), Street Vendors Act 2014 (Absolute eviction immunity).
   - Section 19, Street Vendors Act 2014 (Seizure inventory & 2-day perishables return).
4. **Electricity Consumer CGRF & Outage Compensation Petition** (`electricity_cgrf_petition`):
   - Section 42(5), Electricity Act 2003 (CGRF establishment).
   - Rule 13 & Schedule II, Electricity (Rights of Consumers) Rules 2020.
5. **RTE Section 12(1)(c) Admission Non-Compliance Grievance** (`rte_ews_admission_petition`):
   - Section 12(1)(c), Right to Education Act 2009 (25% EWS quota).
6. **Clinical Establishment Emergency Care & Overbilling Grievance** (`clinical_establishment_grievance`):
   - Section 12 & 56, Clinical Establishments Act 2010 (Emergency stabilization non-refusal).
7. **RPwD Commissioner Built Environment Accessibility Petition** (`accessibility_commissioner_petition`):
   - Section 20 & 45, RPwD Act 2016 & Harmonised Guidelines 2021.
8. **CCPA Dark Pattern & Drip Pricing Grievance** (`consumer_protection_drip_pricing`):
   - Guidelines for Prevention and Regulation of Dark Patterns 2023 under CPA 2019.
9. **Solid Waste Management Compliance Notice** (`solid_waste_notice`):
   - Rule 4 & 22, Solid Waste Management Rules 2016.
10. **Tree Officer Felling & Compensatory Afforestation Notice** (`tree_preservation_notice`):
    - Section 9, Delhi Preservation of Trees Act 1994 (Demonstrative stale audit check).
