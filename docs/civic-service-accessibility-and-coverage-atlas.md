# Civic Service Accessibility and Coverage Comparison Atlas

## Overview
Civic access parity requires that citizens and urban planners understand not merely what services exist, but across which physical and digital channels they are accessible, and whether essential accessibility accommodations (e.g. wheelchair ramps, braille signage, ground-floor counters, audio assistance) are operational in practice.

The **Civic Service Accessibility and Coverage Comparison Atlas Service** (`src/services/civicServiceCoverageAtlasService.js`) provides an authoritative multi-channel aggregation engine, evidence freshness evaluator, and side-by-side locality comparison framework. It empowers citizens to plan journeys effectively, distinguishes verified coverage gaps from unsurveyed areas, and gives municipal administrators an accessible mechanism to track citizen gap reports.

---

## Architectural Principles & Workflow

```
       [ Multi-Channel Facility & Access Registry ]
   (Physical Centres, Digital Portals, CSCs, Mobile Vans)
                         |
                         v
       +------------------------------------+
       | Evidence Freshness & Age Evaluator |
       |   - Freshness Status (<90, >180 d) |
       |   - Distinguishes Unsurveyed Areas |
       +-----------------+------------------+
                         |
                         v
       +------------------------------------+
       | Locality Comparison Engine         |
       |   - Channel Aggregation (Physical, |
       |     Digital, Assisted, Mobile)     |
       |   - Accessibility Facility Matrix  |
       |   - Category-Specific Filtering    |
       +-----------------+------------------+
                         |
        +----------------+----------------+
        |                                 |
        v                                 v
+-------------------+           +-------------------+
| Atlas Map Layers  |           | Accessible Table  |
| (Centroids, Types,|           | (WCAG Non-Visual  |
|  Channel Badges)  |           |  Tabular Parity)  |
+-------------------+           +-------------------+
                         |
                         v
       +------------------------------------+
       | Outdated Data Report Queue (Audit) |
       |   - Privacy-Safe Citizen Feedback  |
       |   - Redacted Export Sanitization   |
       +------------------------------------+
```

---

## Core Capabilities

### 1. Multi-Channel Access Classification
Categorizes access options across four formal channels (`CHANNEL_TYPE`):
- **`PHYSICAL_CENTRE`**: Brick-and-mortar municipal citizen facilitation centres, sub-divisional administrative desks, and Tahsildar offices.
- **`DIGITAL_PORTAL`**: 24x7 web and mobile e-District portals.
- **`ASSISTED_CSC`**: Common Service Centres (Aaple Sarkar / Meeseva Kendram) providing human-assisted digital submission.
- **`MOBILE_UNIT`**: Periodic outreach vans servicing remote rural talukas and hilly hamlets.

### 2. Physical Accessibility Inventory
Inspects physical access standards (`ACCESSIBILITY_FEATURE`):
- `WHEELCHAIR_RAMP`: Graded ramp access for mobility-impaired citizens.
- `BRAILLE_SIGNAGE`: Tactile signs for visually-impaired individuals.
- `AUDIO_ASSISTANCE`: Audio aids and speech feedback systems.
- `GROUND_FLOOR_ACCESS`: Zero-stair access counters avoiding inaccessible upper storeys.
- `SIGN_LANGUAGE_FACILITATOR`: On-demand or scheduled sign language support.

### 3. Data Freshness & Non-Inference Rules
- Strictly avoids guessing: never infers coverage from population density or geographical proximity alone.
- Flags records older than 180 days with `STALE_DATA_WARNING`.
- Distinguishes between verified lack of coverage and unsurveyed settlements (`UNSURVEYED_GAP`).

### 4. Mathematical Parity Across Visual & Accessible Representations
- Guarantees that the grand total of channel facilities in `generateCoverageAtlasMapLayers` matches the sum of channels in `getAccessibleCoverageTable` exactly.
- Ensures screen-reader and non-mouse users have identical, lossless data access.

### 5. Citizen Gap Reporting & Privacy Safeguards
- `reportOutdatedCoverageInfo` accepts reports of permanent closures, inaccurate timings, or broken ramps.
- Does not gather or persist citizen tracking logs or precise device GPS traces. Locality data remains aggregated to ward and taluka centroids.

---

## Statutory Notice & Scope

> [!IMPORTANT]
> **Notice**: The Civic Service Accessibility & Coverage Atlas aggregates verified public access channels and physical amenities to assist citizen journey planning. It is an informational accessibility guide and does not guarantee counter queue availability or government portal uptime.

---

## Verification & Metrics
- **Unit Test Suite**: `src/services/civicServiceCoverageAtlasService.test.js`
- **Results**: 14/14 tests passing.
- **Linting & Security**: 0 errors, 0 warnings across ESLint and `eslint.security.config.js`.
