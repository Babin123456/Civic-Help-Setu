# UP Road Excavation and Utility-Cut Reinstatement Monitor

## Overview
Uncoordinated trench digging and utility cuts by water, sewerage, city gas, electricity, and telecommunications agencies are a leading cause of severe traffic congestion, pedestrian falls, and fatal road accidents in Uttar Pradesh cities.

This service implements a monitoring framework aligning with **UP PWD Road Restoration Guidelines** and the **Uttar Pradesh Municipal Corporation Act, 1959**.

---

## Core Regulatory Standards & Timelines

### 1. Mandatory Pre-Digging Permission & Security Deposit
- Any agency (UP Jal Nigam, GAIL/Torrent Gas, Telecom OFC, or private contractors) must obtain a formal road-cutting permit from the custodian authority:
  - **PWD**: State Highways & Major District Roads.
  - **Nagar Nigam / Nagar Palika**: Internal municipal roads and residential colony avenues.
  - **Development Authorities (LDA, KDA, NOIDA, etc.)**: Planned sector roads.
- The applicant utility must deposit a **Restoration Security Deposit (Bank Guarantee / Cash)** equivalent to 1.5x the estimated resurfacing cost.

### 2. Statutory Reinstatement SLA
- **Maximum 14 Calendar Days**: Once pipeline or cable laying is completed, trench backfilling with compacted Wet Mix Macadam (WMM) and final bituminous/asphalt surfacing must be delivered within 14 days.
- **Default & Forfeiture**: If an agency abandons an excavation or exceeds the 14-day window by more than 15 days, the Municipal Commissioner / PWD Executive Engineer is empowered to forfeit the bank guarantee and execute municipal road repairs.

### 3. Safety Hazard Prescriptions
- Continuous barricading with reflective red-and-white boards.
- Solar amber flashers or warning lamps at night.
- Protective pedestrian bridge plates over trenches near commercial establishments, schools, and hospitals.

---

## Technical Features of the Service
1. **Safety Risk Scoring**: Automatically assesses open cut depth, barricading status, and proximity to sensitive urban institutions.
2. **SLA Breach Engine**: Computes elapsed days from reported trench closure to flag non-compliant agencies.
3. **Crowdsourced Verification**: Multi-citizen consensus aggregation requiring at least 3 independent observations before public escalation.
4. **Printable Escalation Demand**: Formats a formal public demand notice for the Municipal Commissioner and Ward Junior Engineer.


## Grievance Escalation & Emergency Reporting Channels
When open trenches pose imminent public safety threats (e.g. unlit road collapse risk during monsoons):
1. **Dial 1533**: Centralized Urban Local Body / Nagar Nigam 24x7 control room for municipal road hazards.
2. **Dial 112 (State Emergency Service)**: When an unbarricaded ditch directly obstructs fast-moving highway or arterial traffic posing life-threatening collision risks.
3. **IGRS / Jan Sunwai Portal**: Formal complaint against the contractor and concerned Junior Engineer (JE) for dereliction of safety oversight.
4. **PWD Toll-Free Helpline**: 1800-180-0199 for state highways and major district roads.


## Technical Integration & Transparency
- All road cut monitoring data is purely physical and spatial; no personal citizen identity or caller private numbers are exposed.
- Status logs and escalation notices are exportable in compliant Markdown for automated ingestion by municipal grievance dashboards.


- Integrates with local ward volunteer networks to verify physical completion before an agency's security deposit is released.
