# Municipal Solid Waste Dumping, Bulk Waste Generator Audit & NGT Compensation Workspace

## 1. Overview & Statutory Background

Under the **Solid Waste Management Rules, 2016 (MoEFCC Notification S.O. 1357(E))**, the **Construction and Demolition Waste Management Rules, 2016 (G.S.R. 317(E))**, and landmark mandates of the **National Green Tribunal (NGT)**, citizens, resident welfare associations (RWAs), and civic bodies possess explicit legal instruments to combat illegal open dumping, unauthorized waste burning, and commercial bulk waste generator non-compliance.

This workspace (`/solid-waste-workspace`, `/bulk-waste-audit`, and `/ngt-compensation`) delivers:
1. **Bulk Waste Generator (BWG) Compliance Auditor:** Audits premises generating &ge; 100 kg/day or occupying &ge; 5,000 sq. meters under SWM Rule 3(1)(7) and Rule 4(6)-(8).
2. **Volumetric Dumping Hazard & NGT Penalty Estimator:** Computes waste tonnage from site geometry using Central Pollution Control Board (CPCB) standard bulk density constants and calculates NGT Environmental Compensation (EC) per continued day of default.
3. **C&D Waste Segregation Tracker:** Evaluates demolition debris under C&D Rules 2016, checking the 20 tonnes/day or 300 tonnes/project bulk thresholds and 4-stream on-site segregation.
4. **Statutory Notice & Escalation Drafter:** Generates formal Rule 15/16 representations to the Municipal Commissioner, District Magistrate, and SPCB Member Secretary, and formulates Section 14/15 Original Applications for the NGT.
5. **Offline Privacy Vault (`civicbridge_solid_waste_audits`):** Local browser storage with DPDP-compliant PII scrubbing and canonical SHA-256 digital seals.

---

## 2. Statutory Benchmarks & Calculation Models

### 2.1 Bulk Waste Generator Thresholds (SWM Rules, 2016)
Under Rule 3(1)(7), a Bulk Waste Generator includes:
- Any commercial, institutional, or residential complex generating an average of **&ge; 100 kg/day** of solid waste at source; OR
- Any gated community, commercial center, or campus occupying a plinth/plot area of **&ge; 5,000 sq. meters**.

#### Mandatory BWG Obligations:
- **Rule 4(6):** Facilitate 3-stream segregation (Wet, Dry, Domestic Hazardous).
- **Rule 4(7):** In-situ on-site processing, composting, or bio-methanation of 100% biodegradable wet waste.
- **Rule 4(8):** Hand over recyclable dry waste only to SPCB authorized recyclers or waste pickers; zero unsegregated waste handover to municipal collection vehicles.

---

### 2.2 Volumetric Tonnage Estimation (CPCB Standards)
Ground volume ($V = \text{Length} \times \text{Width} \times \text{Depth}$) is converted to metric tonnes using CPCB standard bulk density metrics:

$$\text{Tonnage (Metric Tonnes)} = V \times \rho_{\text{waste}}$$

| Waste Composition | Bulk Density ($\rho$) | CPCB Pollution Index (PI) |
|---|---|---|
| Uncompacted Open Street Mixed MSW | 0.45 tonnes/m³ | 80 (Red Category) |
| Compacted / Settled Dumpsite MSW | 0.85 tonnes/m³ | 80 (Red Category) |
| Organic Kitchen / Wet Waste | 0.60 tonnes/m³ | 50 (Orange Category) |
| Construction & Demolition Debris | 1.50 tonnes/m³ | 50 (Orange Category) |
| Dry Recyclable Packaging & Plastic | 0.25 tonnes/m³ | 50 (Orange Category) |

---

### 2.3 NGT Environmental Compensation (EC) Formula
Pursuant to the National Green Tribunal orders in *O.A. No. 606/2018 (Compliance of SWM Rules, 2016)* and CPCB Environmental Compensation guidelines:

$$EC = PI \times N \times R \times S \times LF$$

Where:
- $PI$: CPCB Pollution Index (80 for Mixed MSW; 50 for C&D/Dry).
- $N$: Number of days of continued default / unattended dumping.
- $R$: Base factor in Rupees (statutory base = ₹250/day).
- $S$: Scale factor of operation (1.5 for ULBs and large bulk entities; 1.0 for medium commercial; 0.5 for small).
- $LF$: Location factor based on city population:
  - Mega-Cities (> 10 Million): $LF = 2.0$
  - Class-I Cities (1M to 10M): $LF = 1.5$
  - Tier-2 Cities (500k to 1M): $LF = 1.25$
  - Towns (< 500k): $LF = 1.0$
- **Open Burning Penalty Multiplier:** If active burning or smoke is observed, NGT applies an automatic **1.5x aggravation multiplier** under Rule 15(v).

---

## 3. Construction & Demolition (C&D) Waste Rules, 2016

Under Rule 4(3) of C&D Waste Management Rules, 2016:
- Generators producing **&ge; 20 tonnes/day** or **&ge; 300 tonnes per project** are classified as Bulk C&D Generators.
- Bulk C&D generators must submit a detailed Waste Management Plan to the Municipal Corporation and obtain written approval prior to commencing work.
- Mandatory 4-stream physical segregation: Concrete & mortar, Soil & sand, Brick & masonry, and Recyclable metals/timber.

---

## 4. Offline Privacy Vault & Digital Integrity

All solid waste audits and NGT representations:
- Stored client-side in browser local storage under `civicbridge_solid_waste_audits`.
- Registered under `USER_DATA_STORES` in `src/services/privacyConsentService.js`.
- Cryptographic SHA-256 seal generated via canonical JSON serialization (`computeAuditDigest`).
- PII sanitized before external export (`minimizeForExternal`) to mask phone numbers and addresses.
- Exportable as plain-text legal representations and signed JSON dossiers.
