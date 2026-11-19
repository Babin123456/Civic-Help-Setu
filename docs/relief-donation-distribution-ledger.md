# Public Relief Donation and Distribution Reconciliation Ledger

## Purpose & Scope
This service establishes an open, audited, and tamper-evident reconciliation ledger for natural disaster and emergency civic relief operations. It accounts for donated goods, essential supplies, and financial relief consignments managed by District Disaster Management Authorities (DDMA) and municipal bodies.

---

## Core Entities & Accounting Logic

### 1. Relief Campaign
- **Attributes**: `campaignId`, `campaignName`, `disasterAuthority`, `reliefCategory` (Ration, Water, Medicines, Blankets), `targetQuantity`.
- **States**: `ACTIVE` ➔ `PAUSED` ➔ `RECONCILING` ➔ `AUDITED` ➔ `CLOSED`.

### 2. Consignment Receipts (`InventoryBatch`)
- Records physical arrivals at central relief warehouses.
- Requires verified gate pass / consignment challan number and timestamp.
- Stores donor pseudonyms (e.g. Red Cross, Community Collective) to prevent commercial endorsement.

### 3. Distribution Dispatches (`DistributionBatch`)
- Logs outbound dispatches to designated relief camps, community kitchens, or affected ward distribution centres.
- Validates that dispatched quantity does NOT exceed real-time available depot stock (`totalReceived - totalDistributed`).
- Tracks estimated citizen beneficiary counts reached.

---

## Reconciliation & Deficit Audits

$$\text{Depot Stock Balance} = \sum (\text{Receipts}) - \sum (\text{Dispatches})$$

- If $\text{Depot Balance} \ge 0$, the ledger is classified as `RECONCILED_HEALTHY`.
- If an unaccounted deficit occurs ($\text{Depot Balance} < 0$), an automated audit alert `DEFICIT_AUDIT_REQUIRED` is flagged for executive inquiry.

---

## Strict Privacy Guardrails
- Under Section 72 of the Disaster Management Act, 2005 and citizen privacy laws, **no beneficiary names, Aadhaar numbers, or individual bank account details are exposed on public dashboards**.
- Aggregate summaries provide complete public transparency without violating the dignity or privacy of vulnerable affected families.
