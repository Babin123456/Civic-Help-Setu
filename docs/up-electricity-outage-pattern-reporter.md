# UP Electricity Transformer and Feeder Outage Pattern Reporter

## Overview
Under the **Uttar Pradesh Electricity Regulatory Commission (UPERC) Electricity Supply Code, 2005** and **Standards of Performance (SOP) Regulations**, electricity distribution companies (Discoms) across Uttar Pradesh are bound by strict statutory timelines for restoring power interruptions and replacing burnt distribution transformers (DTs).

Covering all five government Discoms:
1. **MVVNL** (Madhyanchal - Central UP, Lucknow HQ)
2. **PVVNL** (Pashchimanchal - Western UP, Meerut HQ)
3. **PuVVNL** (Purvanchal - Eastern UP, Varanasi HQ)
4. **DVVNL** (Dakshinanchal - Southern/Bundelkhand, Agra HQ)
5. **KESCO** (Kanpur Electricity Supply Company)

This service enables consumers to diagnose the physical scope of their outage, track SLA breaches, aggregate neighbor reports, and prepare statutory compensation petitions.

---

## Statutory Restoration SLAs under UPERC Standards of Performance

| Outage Type | Area Classification | Maximum Statutory Restoration Window | Penalty for Delay |
|---|---|---|---|
| **Burnt Distribution Transformer (DT)** | **Urban Areas** | **24 Hours** | ₹50–₹100 per day payable to affected consumers |
| **Burnt Distribution Transformer (DT)** | **Rural Areas** | **48 Hours** | ₹50–₹100 per day payable to affected consumers |
| **11 kV / 33 kV Feeder Tripping** | All Areas | **8 Hours** | Disciplinary accountability on Sub-station JE |
| **Local Consumer Service Cable / Fuse** | All Areas | **4 Hours** | Standard Lineman repair |

---

## Escalation Matrix & Redressal Hierarchy

1. **Sub-Station Level**: Junior Engineer (JE / Avar Abhiyanta). Responsible for inspecting line breakdowns and requisitioning replacement transformers from the central workshop.
2. **Sub-Division Level**: Sub-Divisional Officer (SDO / Sahayak Abhiyanta).
3. **Division Level**: Executive Engineer (EE / Adhishasi Abhiyanta) - Electricity Distribution Division (EDD).
4. **Consumer Grievance Redressal Forum (CGRF / Upbhokta Forum)**: Independent statutory judicial forum established by UPERC to award compensation for deficient service.
5. **UPPCL Centralized Call Centre**: Dial **1912** (24x7 Toll-Free).

---

## Consumer Privacy & Security Safeguards
- Full 10/12-digit consumer connection numbers are truncated or masked (`UPPCL-****-XXXX`).
- No billing passwords, bank account numbers, or debit card credentials are ever requested or stored.


## Consumer Daily Outage Diary Protocol
For areas facing persistent unannounced load shedding or voltage fluctuations:
1. **Diary Maintenance**: Log date, start time, restoration time, and whether neighborhood shops had power.
2. **Docket Generation**: Always note the 1912 docket number and SMS confirmation text for each call.
3. **Escalation Trigger**: If cumulative monthly unscheduled outages exceed 50 hours in an urban area or 80 hours in a rural area, the logs can be submitted as evidence to the CGRF for tariff rebate claims.
4. **Physical Safety First**: In case of fallen live wires during monsoon storms, dial 112 and 1912 immediately and keep villagers at a safe 10-meter perimeter.


- Strict data minimization: Zero consumer passwords, banking payment tokens, or unmasked account IDs are stored.
- Supports both Hindi and English guidance to bridge rural digital divides across Purvanchal and Bundelkhand regions.
- Aligned directly with the Uttar Pradesh Electricity Regulatory Commission (UPERC) guidelines.
