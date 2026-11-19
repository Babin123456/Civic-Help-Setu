# Small-Business Licence Renewal and Closure Checklist Centre (#721)

## 1. Overview & Problem Definition
Small businesses, retail shops, food establishments, and MSMEs in India are subject to multifaceted compliance obligations administered across municipal corporations, state departments, central statutory regulators, and revenue bodies. 

Entrepreneurs commonly experience severe enforcement penalties, operational disruptions, and trailing financial liabilities due to:
1. **Missed Annual Renewal Windows**: Many municipal trade licences and regulatory permits expire on the financial year boundary ($31\text{ March}$) or on custom anniversary cycles, incurring heavy penalty surcharges if not renewed in advance.
2. **Conflating Amendments with Routine Renewals**: Relocating premises (address change) or modifying the business constitution (e.g., sole proprietorship to partnership/LLP) requires distinct evidentiary filings that cannot be resolved through regular renewal.
3. **Overlooking Temporary Suspension vs Formal Closure**: Ceasing business operations without executing formal licence surrender, final dues settlement, and deregistration leaves proprietors legally liable for recurring property taxes, statutory commercial levies, and civil penalties.
4. **Lack of Surrender Acknowledgement Tracking**: Closing a business without obtaining and archiving the official **Surrender Acknowledgement Receipt** leaves owners unable to disprove continuing liability if notices are issued years later.
5. **Multi-Establishment Blindspots**: Micro-enterprises and small chains running multiple branches across different municipal wards or urban local bodies fail to track varying local bylaws independently.

The **Small-Business Licence Renewal and Closure Checklist Centre** provides a multi-establishment, jurisdiction-aware, lifecycle checklist service grounded in dated official sources, adhering to strict zero-PII privacy invariants.

---

## 2. Core Legal & Non-Assumption Boundaries
> [!IMPORTANT]
> **Procedural Guidance Only**: Civic-Help-Setu provides administrative document preparation, evidentiary checklists, and statutory rule discovery. It **DOES NOT** provide legal representation, statutory licensing decisions, tax clearance certifications, or municipal approvals. Licences must be processed through official governmental single-window portals and designated Urban Local Body (ULB) offices.

### Anti-Assumption Rule
When municipal or sector-specific rules for an uncatalogued jurisdiction or license class are unknown or missing, the system **never invents or assumes requirements**. Such records are marked explicitly as `UNAVAILABLE_OR_UNVERIFIED`, with clear warnings directing citizens to consult the competent local licensing inspector or Directorate headquarters directly.

---

## 3. Data Provenance & Statutory Citations

| Jurisdiction / Tier | Licensing Authority | Governing Statutory Act | Official Portal | Verification Date |
| :--- | :--- | :--- | :--- | :--- |
| **Delhi (NCT)** | Municipal Corporation of Delhi (MCD) / NDMC | Delhi Municipal Corporation Act, 1957 (Sec 417, 421) | https://mcdonline.nic.in | 2026-11-05 |
| **Maharashtra (Mumbai)** | Brihanmumbai Municipal Corporation (BMC) | Mumbai Municipal Corporation Act, 1888 (Sec 394) | https://portal.mcgm.gov.in | 2026-11-05 |
| **Karnataka (Bengaluru)** | Bruhat Bengaluru Mahanagara Palike (BBMP) | Bruhat Bengaluru Mahanagara Palike Act, 2020 / KMC Act, 1976 | https://bbmptax.karnataka.gov.in | 2026-11-05 |
| **Tamil Nadu (Chennai)** | Greater Chennai Corporation (GCC) | Tamil Nadu Urban Local Bodies Act, 1998 & Rules 2023 | https://chennaicorporation.gov.in | 2026-11-05 |
| **Telangana (Hyderabad)** | Greater Hyderabad Municipal Corporation (GHMC) | GHMC Act, 1955 & TS-bPASS Act, 2020 | https://www.ghmc.gov.in | 2026-11-05 |
| **West Bengal (Kolkata)** | Kolkata Municipal Corporation (KMC) | Kolkata Municipal Corporation Act, 1980 (Sec 199) | https://www.kmcgov.in | 2026-11-05 |
| **National (Food Business)** | Food Safety and Standards Authority of India (FSSAI) | Food Safety and Standards Act, 2006 & Rules 2011 | https://foscos.fssai.gov.in | 2026-11-05 |
| **National / State (Labour)** | State Labour Department / Chief Inspector of Shops | State Shops and Commercial Establishments Acts | *State Specific Single Window* | 2026-11-05 |
| **National / State (Environment)** | State Pollution Control Boards (SPCB) | Water Act 1974, Air Act 1981, Environment Protection Act 1986 | *State OCMMS Portals* | 2026-11-05 |
| **National (Metrology)** | Legal Metrology Directorate (Weights & Measures) | Legal Metrology Act, 2009 & Rules 2011 | https://consumeraffairs.nic.in | 2026-11-05 |
| **National (GST Surrender)** | Central Board of Indirect Taxes and Customs (CBIC) | Central Goods and Services Tax Act, 2017 (Sec 29, Rule 20) | https://www.gst.gov.in | 2026-11-05 |
| **Unlisted Municipalities** | Competent Urban Local Body / Ward Health Office | State Municipal Corporation / Municipalities Acts | *Uncatalogued* | *Marked Unverified* |

---

## 4. Staleness Horizon & Refresh Protocol
* **Max Staleness Limit**: $180\text{ days}$.
* Any regulation record where `(Date.now() - verificationTimestamp) > 180 days` triggers an amber **Stale Data Advisory** in the user interface, cautioning that municipal tariff schedules, renewal penalty structures, or online forms may have been modified by recent gazette notifications.
* Community members and administrators can submit verified official gazette links to refresh records via `/api/business-licence-feedback`.

---

## 5. Dual-Track Licensing Architecture
The checklist centre segregates regulatory compliance into two complementary tracks:

### Track 1: Municipal Licences (Local Body Level)
1. **General Municipal Trade Licence**: Mandatory permission to conduct commercial or trade activity within municipal boundaries without causing public nuisance.
2. **Health / Sanitary Trade Licence**: Specialized municipal clearance for establishments involving public health or food handling (restaurants, sweet shops, hair salons, meat/fish retailers, clinics).
3. **Signboard / Commercial Advertisement Permission**: Urban local body authorization to display commercial boards, illuminated neon signs, or facade lettering over public rights-of-way.
4. **Storage of Hazardous / Flammable Materials Licence**: Required for storing fuels, chemicals, or bulk packaging materials.

### Track 2: Sector-Specific & Statutory Licences (State & Central Level)
1. **Shops & Commercial Establishments Registration**: State labour directorate registration governing working hours, employee leaves, holidays, and opening/closing times.
2. **FSSAI Food Business Registration / State Licence**: Mandatory food safety licence graded by annual turnover ($< ₹12\text{ Lakh}$ for registration; $> ₹12\text{ Lakh}$ for state licence).
3. **State Pollution Control Board (SPCB) Consent**: Consent to Establish (CTE) / Consent to Operate (CTO) or White Category Exemption Certificate under environmental pollution control byelaws.
4. **Legal Metrology (Weights & Measures) Verification**: Periodic stamping and verification certificate for commercial weighing scales, petrol pumps, or measure counters.
5. **Fire Safety Certificate / Fire NOC**: Clearances required for premises with high occupant density or commercial kitchen installations.
6. **Professional Tax Registration (PT-EC / PT-RC)**: Employer registration (PT-RC) to deduct professional tax from employees, and establishment certificate (PT-EC) for business entity liability.
7. **GSTIN Cancellation (GSTR-10)**: Surrender of GST identification upon cessation of taxable business activity.

---

## 6. Four-Stage Lifecycle Separation

```
+---------------------------------------------------------------------------------------+
|                                    LIFECYCLE ENGINE                                   |
+-------------------+-------------------+-----------------------+-----------------------+
|    1. RENEWAL     |   2. AMENDMENT    |     3. SUSPENSION     | 4. CLOSURE/SURRENDER  |
+-------------------+-------------------+-----------------------+-----------------------+
| * Annual Cycle    | * Address Change  | * Voluntary Holding   | * Final Dues Settle   |
| * Validity Status | * Ownership Mod   | * Showcause Cure      | * Surrender Filing    |
| * Advance Windows | * Constitution    | * Appeal Deadline     | * Ack Receipt Retain  |
| * Late Penalties  | * Evidentiary Doc | * Temporary Lockdown  | * Trailing Shield     |
+-------------------+-------------------+-----------------------+-----------------------+
```

1. **Stage 1: Renewal**
   * Focus on expiration tracking, fee schedules, grace periods, penalty surcharges, and prerequisite inspection logbooks.
2. **Stage 2: Amendment**
   * **Address / Premises Change**: Requires new registered rent agreement, landlord NOC, updated commercial electricity meter bill, site map sketch, and municipal property tax zero-dues receipt.
   * **Ownership / Constitution Change**: Requires revised partnership deed / ROC Certificate of Incorporation, dissolution/relinquishment deed, board resolutions, PAN transfer affidavits, and capital structure declarations.
3. **Stage 3: Suspension**
   * Focus on handling voluntary seasonal/temporary business suspension without triggering forfeiture of grandfathered rights, as well as curing departmental showcause suspension notices within statutory limitation periods.
4. **Stage 4: Closure & Surrender**
   * **Final Dues Clearance**: Municipal property tax, commercial electricity/water meter disconnection dues, and commercial tax liabilities.
   * **Surrender Application**: Formal return of original physical licence certificates and cancellation filings on single-window portals.
   * **Surrender Acknowledgement Receipt**: Mandates tracking and securely archiving the dated departmental acknowledgement receipt to protect owners against future claims.

---

## 7. Multi-Establishment & Expiry Reminder Support
* Entrepreneurs can register multiple business locations (e.g., Branch 1: South Delhi retail, Branch 2: Bengaluru fulfillment center).
* Each establishment maintains independent municipal and sector licensing profiles.
* Configurable reminder windows ($60\text{ days}$, $30\text{ days}$, $15\text{ days}$, and $7\text{ days}$) alert citizens to pending renewals.
* One-click calendar reminder export (.ics) allows users to sync expiry deadlines to Google Calendar, Apple Calendar, or Outlook.

---

## 8. Data Privacy & Zero Personal Identifier Invariant
* All establishment profiles, licence numbers, and custom checklists are persisted **exclusively in client-side storage** (`localStorage`).
* Dossier exports and shared summaries scrub all Personally Identifiable Information (PII):
  * GSTIN $\to$ `[REDACTED_GSTIN]`
  * PAN $\to$ `[REDACTED_PAN]`
  * Aadhaar $\to$ `[REDACTED_AADHAAR]`
  * Proprietor / Director Names $\to$ `[REDACTED_ENTITY_REPRESENTATIVE]`
  * Mobile / Phone Numbers $\to$ `[REDACTED_CONTACT_NUMBER]`
  * Street Address / Shop No $\to$ `[REDACTED_PREMISES_ADDRESS]`
* No personal data or business financial records are sent to remote analytics or unvetted external servers.

---

## 9. TypeScript / JSDoc Schema Definitions

```typescript
export type LicenceTrack = 'MUNICIPAL' | 'SECTOR_SPECIFIC';
export type LifecycleStage = 'RENEWAL' | 'AMENDMENT' | 'SUSPENSION' | 'CLOSURE';
export type AmendmentType = 'ADDRESS_CHANGE' | 'OWNERSHIP_CONSTITUTION_CHANGE' | 'NAME_CHANGE';

export interface LicenceDefinition {
  id: string;
  key: string;
  track: LicenceTrack;
  name: string;
  governingAuthority: string;
  statutoryAct: string;
  portalUrl: string | null;
  renewalCycle: string;
  advanceRenewalWindowDays: number;
  gracePeriodDays: number;
  officialInstruction: string;
  editorialExplanation: string;
  verificationTimestamp: string | null;
  verified: boolean;
}

export interface EstablishmentProfile {
  id: string;
  establishmentName: string;
  category: 'RETAIL' | 'FOOD_BEVERAGE' | 'MANUFACTURING' | 'SERVICES' | 'OTHER';
  jurisdictionKey: string;
  municipalWard: string;
  selectedLicenceKeys: string[];
  licenceExpiries: Record<string, string>; // licenceKey -> YYYY-MM-DD
  reminderOffsetDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItemRecord {
  id: string;
  licenceKey: string;
  stage: LifecycleStage;
  title: string;
  officialRule: string;
  editorialTip: string;
  isMandatory: boolean;
  admissibleEvidence: string[];
  completed: boolean;
  notes?: string;
}

export interface ClosureMilestoneRecord {
  stepId: string;
  title: string;
  department: string;
  actionRequired: string;
  evidenceRequired: string;
  acknowledgementMandatory: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  receiptReference?: string;
  completedAt?: string;
}
```

