# UP Flooded-Road and Drain Blockage Community Response Board (#985)

## Overview & Civic Purpose

During intense monsoon rainfall and urban flooding in Uttar Pradesh cities and districts (e.g. Lucknow, Kanpur, Varanasi, Prayagraj, Agra, Gorakhpur), residents and commuters urgently need to identify:
1. Waterlogged roads, submerged underpasses, and hazardous intersections.
2. Blocked or overflowing stormwater drains and silted culverts.
3. Verified passable public corridors.

In chaotic weather events, unverified and outdated social media messages proliferate rapidly. Stale reports can misdirect citizens toward hazardous, submerged streets and open manholes. The **UP Flooded-Road and Drain Blockage Community Response Board** introduces strict time-bound freshness decay, unalterable source classification, privacy redaction, and navigation safeguards.

---

## Key Invariants & Safeguards

### 1. Mandatory Life-Threatening Emergency Barrier
* **Not an Emergency Dispatch Service:** Civic Help Setu provides peer observations and municipal updates.
* Prominently displayed non-dismissible emergency banner with direct, one-tap dialers:
  - **112**: Police, Emergency Response Support System (ERSS)
  - **1070**: UP State Disaster Management Authority (UPSDMA) State Emergency Helpline
  - **1077**: District Disaster Control Room
  - **101**: Fire & Rescue Services

### 2. Time-Bound Freshness Decay & Expiry Policy
* Every report records both `observedAt` and `reportedAt` timestamps.
* Observations older than their classification limit automatically decay to **STALE**:
  - `flooded_road`: **120 minutes (2 hours)**.
  - `passable_route`: **90 minutes (1.5 hours)**.
  - `blocked_drain`: **720 minutes (12 hours)**.
* **Exclusion from Hazard Math:** Stale reports are visibly tagged with a warning banner and are **strictly excluded** from route hazard calculations until fresh community reconfirmation arrives.

### 3. Strict Source Separation
* **Official Disaster Alert:** Issued by UPSDMA, District Magistrates, or Traffic Police. Requires validated issuing authority and official bulletin reference ID. Citizens cannot spoof this tier.
* **Municipal Advisory:** Issued by Nagar Nigam / Jal Sansthan drainage wings.
* **Citizen Community Observation:** Peer reports with depth category and observation timestamp.

### 4. Privacy & Anonymous Reporting
* Anonymous submissions require no login, phone number, or national identifiers.
* **Exact Location Redaction:** Automated regex sanitization strips door numbers, flat numbers, apartment names, and private contact numbers.
* Coordinates are snapped/jittered to 2 decimal places (~1.1 km grid) to prevent pinpointing private homes.

### 5. Route Hazard Safety Guarantee
* Routes and transit corridors are cross-referenced with active (non-stale) flood hazards.
* **Invariant:** The system **NEVER** routes users through a reported active water hazard. If an origin-destination corridor intersects deep standing water (`knee_deep` or `waist_deep_or_higher`), it is flagged as `DANGEROUS / IMPASSABLE` with guidance to remain sheltered or seek elevated bypasses.

### 6. Ward-Wise Drain Summaries & Maintenance Petitions
* Groups drain blockages by municipal ward, calculating desiltation urgency scores.
* Generates a formal, statutory petition addressed to the Municipal Commissioner and Executive Engineer (Drainage Wing) under the UP Municipal Corporation Act & Public Services Guarantee.

### 7. Low-Bandwidth Mode & Offline Draft Queue
* **Low-Bandwidth Mode:** Strips heavy map rendering and image assets, providing an accessible plain-table view designed for 2G connections and low battery during severe weather.
* **Offline Draft Queue:** Submissions made without internet are queued in local storage (`civicbridge_up_flood_draft_queue_v1`) and automatically synchronized when connectivity returns via the `online` event listener.

---

## Technical Architecture

```
src/
├── data/
│   ├── upFloodIncidentContract.js       # Schemas, depth tiers, UP bounds, validators
│   ├── upFloodIncidentContract.test.js  # Contract, PII redaction, & spoofing tests
│   └── upFloodIncidentSeed.js          # Authentic UP seed data (relative timestamps)
├── services/
│   ├── upFloodResponseService.js       # Freshness decay, route evaluator, offline queue
│   └── upFloodResponseService.test.js  # Expiry, conflicts, hazard routing, & sync tests
├── components/floodResponse/
│   ├── FloodResponseHeader.jsx         # Emergency banner, metrics, filters, low-BW toggle
│   ├── FloodIncidentList.jsx           # Card feed + Low-BW semantic table
│   ├── FloodInteractiveMap.jsx         # SVG map with 100% list parity
│   ├── FloodReportModal.jsx            # Anonymous reporting wizard with PII filter
│   ├── WardDrainSummaryModal.jsx       # Ward rollups + Statutory petition exporter
│   ├── RouteHazardCheckerModal.jsx     # Navigation safety evaluator
│   └── OfflineDraftQueueModal.jsx      # Offline draft inspector & sync action
└── pages/
    ├── UpFloodResponseBoard.jsx        # Unified response workspace
    └── UpFloodResponseBoard.test.jsx   # UI integration & parity test suite
```

---

## Testing & Verification Suite

Run all verification tests with Vitest:
```bash
npx vitest run src/data/upFloodIncidentContract.test.js
npx vitest run src/services/upFloodResponseService.test.js
npx vitest run src/pages/UpFloodResponseBoard.test.jsx
```
