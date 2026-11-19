# Electricity (Rights of Consumers) Rules 2020 Guaranteed Service Compensation, Outage Audit & CGRF Dispute Workspace

## 1. Overview & Statutory Background

Under the **Electricity Act, 2003** read with the **Electricity (Rights of Consumers) Rules, 2020** notified by the Ministry of Power, electricity consumers are granted enforceable statutory rights to 24x7 uninterrupted power supply, transparent metering, and automatic financial compensation for standard of performance defaults.

Historically, distribution licensees (DISCOMs) have operated with systemic immunity regarding unscheduled load-shedding, unannounced transformer burnouts, erratic kWh billing surges, and summary disconnections. Consumers lacked a standardized mechanism to compute guaranteed performance delay penalties, verify disconnection notice legality, and draft formal petitions to the **Consumer Grievance Redressal Forum (CGRF)** established under Section 42(5) and the **State Electricity Ombudsman** under Section 42(6).

This workspace (`/electricity-consumer-workspace`, `/discom-outage-audit`, `/cgrf-compensation-drafter`) introduces:
1. **Guaranteed Standard of Performance (SoP) Compensation Calculator (Rule 11):**
   - Implements statutory compensation credit schedules under Rule 11(2) & 11(3) for power interruptions, burnt transformer replacement delays, delayed new connections, and unresolved voltage dips.
2. **Section 56(1) Disconnection Legality & Due Process Auditor:**
   - Evaluates mandatory 15-day clear written notice requirements, after-hours disconnection prohibitions (post 1:00 PM), holiday bans, and statutory protection for disputed bills deposited under protest.
3. **Fast / Defective Meter Diagnostic & Billing Adjustment Engine:**
   - Detects erratic consumption surges (>2.5x historical baseline) and calculates retroactive financial refunds based on accredited third-party NABL laboratory test bench error percentages.
4. **Section 42(5) CGRF & Electricity Ombudsman Statutory Drafter:**
   - Auto-generates formal petitions with legal prayers for emergency reconnection, bill adjustment, automatic delay compensation credits, and Section 142 penal proceedings.
5. **Confidential Utility Grievance Vault (`civicbridge_electricity_cgrf_vault`):**
   - Offline-first storage with SHA-256 digital seals (`computeElectricityGrievanceDigest`), tamper integrity verification (`verifyElectricityGrievanceIntegrity`), and DPDP Act 2023 compliant PII redaction.

---

## 2. Statutory Benchmarks & Compensation Schedules

### 2.1 Prescribed Timelines and Compensation under Rule 11

| Service Parameter | Permissible Benchmark | Statutory Delay Compensation | Legal Basis |
|---|---|---|---|
| Unscheduled Outage Duration | Max 4 hours | ₹10 / hour (min ₹100 / day) | Rule 11(2) & State SoP |
| Burnt Transformer Replacement | 24h Metro / 48h Rural | ₹150 / day of delay | Rule 11 Standard of Performance |
| New Power Connection Release | 7 days Metro / 15 days Rural | ₹500 / week of delay | Section 43 & Rule 4 |
| Burnt / Defective Meter Replacement | 24 to 48 hours | ₹50 / day of delay | Rule 7 & CEA Metering Regs |
| Persistent Voltage Fluctuation (>10%) | 5 days to resolve | ₹100 / day of delay | Rule 10 Power Quality Standards |

*Note: Under Rule 11(3), the compensation must be credited automatically to the consumer's electricity account in the subsequent billing cycle.*

---

## 3. Disconnection Safeguards under Section 56(1)

Under Section 56(1) of the Electricity Act, 2003:
- **Mandatory 15 Clear Days Notice:** No connection can be disconnected without serving at least 15 clear days' notice in writing detailing the specific default.
- **Prohibited Hours:** Supply cannot be disconnected after 1:00 PM on any working day to allow the consumer reasonable opportunity to rectify or deposit.
- **Prohibited Days:** Disconnections on Fridays, weekends, or declared public holidays are prohibited.
- **Proviso to Section 56(1):** If the consumer deposits under protest the average of the last 6 months or 50% of the disputed bill, the licensee is statutorily barred from disconnecting power.

---

## 4. CGRF & Electricity Ombudsman Adjudication Procedure

Under Section 42(5) and 42(6):
1. **Filing:** Aggrieved consumer submits the generated petition to the Member Secretary / Chairperson of the Consumer Grievance Redressal Forum (CGRF).
2. **Hearing & Orders:** CGRF is statutorily mandated to resolve grievances within 30 to 45 days.
3. **Appellate Ombudsman Recourse:** If the DISCOM fails to comply or the CGRF rejects the petition, an appeal lies directly before the State Electricity Ombudsman under Section 42(6).
4. **Penalties under Section 142:** Persistent non-compliance by DISCOM engineers attracts fines up to ₹1,00,000 and ₹6,000 per day of continuing non-compliance.
