# UP Public Distribution Shop (PDS) Stock-Availability Transparency Ledger

## Overview
Under the **National Food Security Act (NFSA), 2013** and the **Pradhan Mantri Garib Kalyan Anna Yojana (PMGKAY)**, the Food and Civil Supplies Department of Uttar Pradesh (`fcs.up.gov.in`) provides free monthly food grains to over 15 crore beneficiaries.

Despite electronic Point-of-Sale (e-PoS) integration at all Fair Price Shops (FPS / *Kotedar*), cardholders frequently encounter arbitrary dealer closures, claims of grain stock exhaustion, or forced biometric authentication without physical distribution.

This service establishes a transparent ledger bifurcating official government e-PoS records from fresh community ground observations.

---

## Statutory Entitlements in Uttar Pradesh

### 1. Antyodaya Anna Yojana (AAY - Red / Yellow Card)
- **Target**: Poorest of the poor families (destitute, disabled head of family, primitive tribal groups).
- **Entitlement**: Fixed **35 kg food grains per family per month** (14 kg Wheat + 21 kg Rice).
- **Price**: ₹0.00 (Completely free under PMGKAY).

### 2. Priority Household (PHH / Patra Grihasti - White Card)
- **Target**: BPL and eligible vulnerable households meeting inclusion criteria.
- **Entitlement**: **5 kg food grains per registered family unit per month** (2 kg Wheat + 3 kg Rice per unit).
- **Price**: ₹0.00 (Completely free under PMGKAY).

---

## Architectural Rules of the Transparency Ledger

1. **Strict Data Separation**:
   - **Official Government Data**: Opening stock, e-PoS quota received, and transaction balances from the state FCS portal.
   - **Community Data**: Ground reports of physical shop shuttering, queue congestion, or dealer refusals. The UI visually marks community reports with citizen consensus flags.

2. **48-Hour Freshness Decay**:
   - Ground grain distribution situations change daily. Any citizen report older than 48 hours is automatically moved to archival status to prevent stale misinformation.

3. **Discrepancy Engine**:
   - Automatically cross-examines official active inventory against community stock-out claims. When multiple cardholders report being turned away empty-handed while the e-PoS ledger indicates surplus grain (>500 kg), a high-priority administrative inspection is flagged.

---

## Grievance Escalation & Statutory Penalties
- **Supply Inspector (Poorti Nirikshak)**: Local block/ward verification authority.
- **Sub-Divisional Magistrate (SDM)**: Presides over dealer license suspension and cancellation.
- **District Supply Officer (DSO)**: Nodal district authority.
- **Statutory Legal Action**: Unlawful diversion or black-marketing of PDS food grains attracts FIR and prosecution under Section 3/7 of the **Essential Commodities Act, 1955**.
- **UP Food Helpline**: Toll-Free **1967** or **1800-1800-150**.


## Citizen Observation Recording Protocol
Cardholders visiting Fair Price Shops can record non-personal factual observations:
- **Shop Shutter Status**: Whether the dealer shop was open during mandatory operating hours (08:00 AM - 12:00 PM and 02:00 PM - 06:00 PM).
- **Physical Weighment Display**: Whether the e-Weighing scale was visible to the customer.
- **Transaction Receipt Slip**: Whether a printed electronic cash-memo/distribution slip was handed over after biometric authentication.
- **Stock Exhaustion Claim**: Specific date and time dealer refused grains citing godown vacancy.


- Privacy Commitment: No biometric data, full 12-digit ration card numbers, or citizen contact details are stored.
