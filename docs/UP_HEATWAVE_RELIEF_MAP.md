# UP Community Heatwave Exposure and Cooling-Relief Coordination Map (#983)

## 1. Overview & Citizen Need
During severe heatwave conditions in Uttar Pradesh (temperatures frequently exceeding 44°C–46°C), outdoor workers, street vendors, daily wage earners, elderly citizens, and transit commuters face extreme risks of heat exhaustion and fatal heatstroke. While official meteorological advisories (IMD / UPSDMA) alert citizens of general weather hazards, they do not provide hyper-local, actionable visibility into **which cooling shelters, cold drinking water kiosks, shaded rest stops, or health help desks are physically open, accessible, and functioning right now**.

The **UP Community Heatwave Exposure and Cooling-Relief Coordination Map** provides a ward- and village-level directory combining verified municipal facilities with time-stamped community corrections and partner capacity updates.

---

## 2. Core Architecture & Separation of Concerns

### A. Separation of Permanent Infrastructure vs. Dynamic Availability
To prevent speculative or vandalized community reports from overwriting statutory public assets:
1. **Permanent Facility Infrastructure**:
   - `id`, `name`, `facilityType`, `district`, `wardOrVillage`, `address`, `coordinates`.
   - `operatingHours`, `nominalCapacity`, `accessibility` (wheelchair, seating, drinking water, restroom, ORS availability, cooling type).
   - **Statutory Provenance**: `responsibleAuthority` (e.g. Lucknow Municipal Corporation, District Disaster Management Authority, Chief Medical Officer, UP Jal Nigam), `sourceUrl` (official gazette/order URL), `verifiedAt`, `seasonalValidity` (March–July).
2. **Dynamic Live Status**:
   - `effectiveOperationalStatus`: `open`, `temporarily_closed`, `at_capacity`, `unverified`.
   - `effectiveCapacityStatus`: `available`, `crowded`, `full`, `unknown`.
   - `temporaryClosureReason`: Specific operational notes (e.g., pump maintenance, generator servicing).
   - `lastReportedAt`, `lastReportSource` (`official_authority`, `verified_partner`, `citizen_observation`).

---

## 3. Provenance, Stale Decay & Seasonal Expiry Policies

* **Every facility has a verified authority, source URL, and verified date**: Records lacking provenance are quarantined under `unverified` and never presented as confirmed available.
* **Automatic Stale Decay**:
  - Verification records older than **14 days** are automatically marked as `stale_verification` with a visible warning: *"Marked for Re-verification"*.
  - Real-time temporary capacity observations older than **6 hours** decay to `stale_observation` awaiting fresh reports.
* **Seasonal Validity**:
  - In Uttar Pradesh, active heatwave relief facilities operate between March and July (months 3 to 7).
  - Outside this window, records automatically transition to `seasonal_inactive` to avoid misleading citizens during cooler months.

---

## 4. Conflict Resolution Engine

When conflicting observations are submitted:
1. **Authoritative Priority**: Official Authority (DDMA / Municipal Corp) and Verified Humanitarian Partner updates take precedence over isolated single reports.
2. **Anomaly & Dispute Flagging**:
   - If an official facility is marked `open`, but **2 or more recent citizen reports within 4 hours** report `temporarily_closed` or `water_exhausted`, the facility status is marked **`isDisputed: true`**.
   - The UI surfaces a distinct warning badge and displays the dispute rationale, alerting the local partner and other citizens without destructively deleting the official record.

---

## 5. Privacy & Location Consent Policy

In adherence with the **Digital Personal Data Protection (DPDP) Act 2023** and Civic-Help-Setu privacy standards:
1. **Explicit Location Consent**:
   - No GPS coordinates are queried or stored without explicit user consent.
   - The directory is 100% functional via manual District and Ward/Village dropdowns.
   - When consent is granted, distance calculations occur **in-memory only**.
2. **Zero-PII Community Observations**:
   - All community reports pass through sanitization regexes that redact Aadhaar numbers, PAN, mobile numbers, and private residential door/flat addresses.
   - Coordinates attached to citizen observations are snapped to a **~1.1 km grid (2 decimal places)** to prevent identifying private residential premises.
3. **Geo-Bounding**: All coordinates are validated against Uttar Pradesh boundaries (Lat: 23.8°N–30.5°N, Lng: 77.0°E–84.7°E).

---

## 6. Offline Mode & Low-Bandwidth Support

* **Low-Bandwidth Mode**: Drops heavy vector tiles and renders an ultra-low-weight schematic grid layout tailored for weak 2G/3G mobile connections in rural and congested urban zones.
* **Text-Only Accessible View**: Provides semantic HTML with high-contrast badges for screen readers.
* **Offline Draft Queue**: Allows users to record observations and status corrections even when mobile network connectivity drops. Queued drafts are automatically synced upon reconnection.
* **Offline Emergency Guidance**: Includes pre-cached first-aid guidance for heat exhaustion vs. heatstroke, standard WHO-formula homemade ORS preparation, and 24x7 emergency helpline access (`1077`, `108`, `112`).

---

## 7. Pilot District Scope

* **Primary Pilot**: **Lucknow District** in collaboration with Lucknow DDMA, Lucknow Municipal Corporation (LMC), and the Chief Medical Officer (CMO).
* **Pilot Wards Covered**: Hazratganj, Charbagh, Chowk, Qaisar Bagh, Aliganj, Alambagh, Gomti Nagar, Dubagga Peri-Urban Village.
* **Expansion Readiness**: Initial verified records in Varanasi and Kanpur Nagar validate multi-district scalability.

---

## 8. Verification & Test Suite

The feature is comprehensively verified by Vitest:
* `src/data/upHeatwaveReliefContract.test.js` (20 tests): Schema validation, PII redaction, coordinate bounding, stale decay, seasonal validity.
* `src/services/upHeatwaveReliefService.test.js` (16 tests): District/ward filtering, stale decay, conflicting report resolution, location consent gating, offline draft queue.
* `src/pages/UpHeatwaveReliefMap.test.jsx` (7 tests): Page rendering, low-bandwidth mode toggle, text-only list, emergency guidance modal, observation modal.
* `tests/heat-relief-observations.test.js` (8 tests): API serverless handler, rate limiting, cryptographic seal generation, zero-PII rejection.
