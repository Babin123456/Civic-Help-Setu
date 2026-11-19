# Municipal Water and Sewer Connection Application Planner

This document outlines the local-body catalog, application journeys, property evidence checklists, and fee breakdown formulas for Civic Help Setu's Water and Sewer Connection Planner.

## Problem Statement
Securing a municipal water tap or underground sewerage connection in Indian urban areas is fraught with bureaucratic ambiguity:
1. **Jurisdiction Mismatches**: Residents often apply to general city municipal corporations without realizing that an independent statutory utility board (e.g. Delhi Jal Board - DJB, Bangalore Water Supply and Sewerage Board - BWSSB, HMWSSB) holds exclusive sanctioning authority.
2. **Opaque Fee Estimates**: Charges comprise multiple distinct heads (statutory security deposit, sewer infrastructure development cess calculated per square meter of built-up area, and road cutting restoration charges assessed by PWD engineers).
3. **Different Journeys**: Applying for a new domestic tap connection requires architectural completion drawings, whereas testing a malfunctioning meter or requesting disconnection involves different documentation.

## Journey Classifications

```
  1. NEW_WATER_CONNECTION
     ├── Property Sale Deed / Title Proof
     ├── Latest Municipal Property Tax Paid Receipt (PID)
     ├── Architectural Building Sanction / Occupancy Certificate (OC)
     └── Licensed Plumber Execution Diagram
           │
  2. SEWERAGE_CONNECTION
     ├── Underground drainage hookup
     └── Infrastructure development charge per sq.m. of built-up area
           │
  3. METER_REPLACEMENT_OR_TESTING
     ├── Defective / non-functional meter report
     └── Standard calibration testing deposit (₹500)
           │
  4. DISCONNECTION_OR_SURRENDER
     ├── Demolition or voluntary closure
     └── Final meter reading & No Dues Certificate (NDC)
```

## Supported Water Supply Boards

| Board | Jurisdiction | Standard Domestic Deposit | Sewer Charge (per sq.m.) | Licensed Plumber Mandatory? |
|---|---|---|---|---|
| **Delhi Jal Board (DJB)** | NCT of Delhi | ₹1,000 | ₹100 / sq.m. | Yes |
| **BWSSB Bengaluru** | Bengaluru Urban | ₹2,500 | ₹250 / sq.m. | Yes |
| **PMC Water Dept** | Pune Municipal Corp | ₹1,500 | ₹120 / sq.m. | No (Optional) |
| **Generic ULB** | Other Municipal Councils | ₹1,200 | ₹100 / sq.m. | Local bylaw |

## Privacy & Safety Safeguards
- **Zero Payment Intermediation**: Citizens are provided verified portal links (`djb.gov.in`, `bwssb.karnataka.gov.in`); connection charges must be paid directly to the government treasury.
- **Anonymous Progress Tracking**: Milestones are stored with non-identifying keys on the client device.
