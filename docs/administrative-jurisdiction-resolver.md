# Administrative Jurisdiction Resolver for Central, State, District, and Local Rules

This document details the hierarchical jurisdiction schema, privacy-preserving location resolution, scope containment, and concurrent power reconciliation in Civic Help Setu.

## Problem Statement
In the Indian constitutional structure (Union, State, and Concurrent Lists under the Seventh Schedule), civic rules differ dramatically across jurisdictions:
1. A property mutation rule in Maharashtra does not apply in Karnataka.
2. Building plan sanction fees in Pune Municipal Corporation (PMC) differ from rural Gram Panchayats in Pune District.
3. Central welfare programs (e.g. PM-KISAN, Ayushman Bharat PM-JAY) apply nationally, but implementation counters and supplemental state benefits vary.

Applying out-of-scope state or municipal rules misguides citizens, leading to rejected counter applications and wasted administrative fees.

## Administrative Hierarchy & Scope Filtering

```
                           [ Citizen Query ]
                                  │
                                  ▼
      +-------------------------------------------------------+
      |       Minimal Clarifying Location Resolution          |
      |   - State / UT selection                              |
      |   - District selection (Optional)                     |
      |   - Urban Local Body / Panchayat (Optional)           |
      |   - Zero mandatory GPS coordinate requirements        |
      +---------------------------+---------------------------+
                                  │
                                  ▼
      +-------------------------------------------------------+
      |              Scope Hierarchy Formulation              |
      |   e.g. ['ALL_INDIA', 'MAHARASHTRA', 'MH_PUNE_ULB']   |
      +---------------------------+---------------------------+
                                  │
                   +--------------+--------------+
                   |                             |
      [ If Unconfirmed ]             [ Confirmed Scope ]
                   |                             |
                   ▼                             ▼
      +--------------------------+  +--------------------------+
      | Fail-Safe Mode:          |  | Constrained Filter:      |
      | Only 'ALL_INDIA' shown   |  | In-scope rules ONLY      |
      | 'JURISDICTION_NOT_       |  | Alien state rules        |
      |  ESTABLISHED' alert      |  | strictly excluded        |
      +--------------------------+  +--------------------------+
                                  │
                                  ▼
      +-------------------------------------------------------+
      |        Concurrent Central / State Reconciliation       |
      |   - Central substantive standards prevail             |
      |   - State statutory fees & counter forms apply        |
      +-------------------------------------------------------+
```

## Privacy & Safety Principles
- **No Involuntary Geolocation**: The resolver accepts text dropdown or structured choices (State, District, Municipality) without tracking user IP addresses or requesting device GPS permissions.
- **Fail-Closed Boundary Guard**: If the citizen's state is unconfirmed, state-specific statutory guidance is never guessed; only national framework guidelines with prominent disclaimers are returned.
- **Concurrent Conflict Transparency**: Distinguishes national eligibility standards from state-mandated fee tables.
