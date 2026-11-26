# Jurisdiction Hand-off Map for Services Spanning Multiple Authorities (#815)

## Overview & Constitutional Context
In the Indian constitutional federal framework, civic service delivery frequently crosses multiple jurisdictional tiers:
- **Ward Level**: Local field inspections, ward engineer verification, sanitation and municipal ward offices.
- **Urban Local Body (ULB) / Municipal Corporation**: Building permits, trade licenses, water connections, property tax assessments, birth/death registration.
- **District Administration**: District Magistrate approvals, land revenue (Bhoomi/e-Dharani) reconciliation, licensing, and appellate authorities.
- **State Government**: Statutory departmental approvals (Transport / RTO, Directorate of Municipal Administration, DISCOM electricity supply, Stamps & Registration).
- **Central Government**: National identity verification (UIDAI / Aadhaar, DigiLocker, Passport Seva, Central regulatory portals).

Issue #815 implements a complete citizen and administrator workflow that visually demystifies this hand-off path, preventing citizens from being sent between counters without knowing who owns each step or where responsibility changes.

---

## Architectural Principles & Guardrails

### 1. Deterministic Geospatial Resolution
- Boundary resolution uses maintained jurisdiction mappings (`src/data/jurisdictionBoundaries.js`), **never unconstrained free-text LLM boundary guessing**.
- Supports 6-digit Indian PIN codes and canonical locality names.
- Falls back to state-level and national statutory authorities when specific local body geometries are unavailable.

### 2. Ambiguity Detection & User Confirmation
- When multiple authorities overlap (e.g. adjacent urban wards, municipal corporation boundaries vs. peri-urban panchayats), the resolver surfaces `ambiguity: true` and flags `requiresConfirmation: true`.
- The user is prompted to manually select their applicable authority.

### 3. AI Plain-Language Explainer Guardrails
- Plain-language explanations generated for jurisdiction hand-offs are strictly labeled as **`[AI suggestion - confirm with official authority before proceeding]`** until confirmed.
- Every explanation includes statutory data provenance (`dataSource`, `version`, `effectiveDate`).

### 4. Privacy & Zero-PII Invariant
- Collects only non-sensitive locality strings or PIN codes.
- Zero mandatory GPS or involuntary device location tracking.
- Client and server validators reject Aadhaar numbers, PAN numbers, phone numbers, passwords, OTPs, or uploaded document contents.

### 5. Isolation of Saved Drafts from Official Government Status
- Non-sensitive inputs can be saved privately to browser session storage (`civic_jurisdiction_handoff_draft_v1`), allowing users to cancel, return, and resume without losing progress.
- Prominent banners explicitly state: **"Workspace Planning Mode — This does NOT represent or submit an official government application."**

---

## Data Models & API Specifications

### Authority Record Schema
```typescript
interface AuthorityRecord {
  id: string;               // Unique stable identifier, e.g. "local-chennai-corpid"
  name: string;             // Human-readable name, e.g. "Greater Chennai Corporation"
  level: 'ward' | 'municipal' | 'district' | 'state' | 'national';
  description: string;      // Operational mandate
  contact: string;          // Verified phone/helpline/office address
  portal: string;           // HTTPS URL to official government portal
  escalation: string;       // Next appellate officer or grievance channel
  source: string;           // Legal authority / Gazette citation
  effectiveFrom: Date;      // Statutory boundary date
  sourceVersion: string;    // Data version
}
```

### Hand-off Stage Schema
```typescript
interface JurisdictionStage {
  order: number;            // 1-based sequential position in the workflow
  name: string;             // Name of the stage (e.g. "Intake & Document Verification")
  description: string;      // Description of the hand-off action
  authority: AuthorityRecord; // Responsible administrative body
  locality?: string;
  state?: string;
  ambiguity?: boolean;
}
```

### Serverless Endpoint (`/api/jurisdiction-handoff`)
- **`GET /api/jurisdiction-handoff`**:
  - Parameters: `page` (default 1), `limit` (default 10, max 50), `serviceId`, `locality`, `state`, `action=source-info`.
  - Returns paginated supported services and metadata.
- **`POST /api/jurisdiction-handoff`**:
  - Payload: `{ serviceId: string, locality: string, state?: string, confirmedAuthorityId?: string }`
  - Validates zero-PII and honeypot traps.
  - Returns `{ success: true, receiptSeal: "JH-SEAL-XXXX-XXXX", resolution, graph, timestamp }`.

---

## Synthetic Data for Reviewers
Pre-loaded synthetic services and test mappings are available in `src/data/jurisdictionTestData.js`:
- `birth-certificate`: Multi-authority certificate service spanning municipal ward registrars, district statistical officers, and state civil registration systems.
- `driving-licence`: State RTO service with central Sarathi portal integration.
- `trade-licence`: Municipal health, fire safety, and revenue department hand-off.
- `water-connection`: Multi-stage pipeline feasibility, municipal engineering sanction, and water board meter installation.

---

## Manual Verification Steps
1. Navigate to `/jurisdiction-handoff` or `/services/birth-certificate/jurisdiction-map`.
2. Notice the top disclaimer distinguishing saved research progress from official government status.
3. In the **Locality or PIN code** field, enter `chennai` or `600001` with State `Tamil Nadu` and click **Resolve**.
4. Observe the interactive SVG map and hand-off graph updating to show the responsible authority sequence.
5. Click an authority card to view its direct contact number, official portal link, and escalation ladder.
6. Enter `north delhi` to test **Ambiguity Detection**: observe the amber advisory banner requesting user confirmation.
7. Click **Accessible Text-Only View** to verify the WCAG 2.1 AA accessible table representation.
8. Click **Save Progress**, refresh the page, and observe the **Resume Saved Inputs** prompt.
