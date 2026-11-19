# Public Transport Stop Accessibility & Amenities Verification Directory

## Architectural Scope
This module provides a centralized, audited directory of public bus, tram, and transit stops evaluated against national accessibility guidelines:
- **Rights of Persons with Disabilities (RPwD) Act, 2016**
- **Harmonised Guidelines and Space Standards for Barrier-Free Built Environment for Persons with Disabilities and Elderly Persons**

---

## Core Entities & Verification Attributes

### 1. Universal Accessibility Features
- **Wheelchair Ramp & Level Boarding**: Low-gradient ramp matching curb height for step-free boarding.
- **Tactile Paving**: Directional and warning blister paving guiding visually impaired passengers from pavement to bus boarding bay.
- **Audio Route Announcements**: Automated voice systems announcing approaching route numbers.
- **Braille & High-Contrast Signage**: Tactile route indicators on boarding poles.

### 2. Passenger Amenities
- Weather-proof roof shelter protecting against rain and extreme sun.
- Ergonomic bench seating with armrests for senior citizens.
- LED night illumination for pedestrian safety.
- Passenger Information System (PIS) digital display screens.

---

## Moderated Ground Audit Workflow

```
[1. Official Stop GTFS Feed Ingestion]
                │
                ▼
[2. Initial Verification Status: PENDING_INSPECTION]
                │
                ▼
[3. Citizen / Divyangjan Ground Feedback Submission]
                │
                ▼
[4. Municipal / Transport Operator Review & Acceptance]
                │
                ▼
[5. Published Status: VERIFIED_OFFICIAL / COMMUNITY_AUDITED]
```

---

## Privacy & Safety Controls
- Citizen reporters submit observations without public disclosure of their personal contact details.
- Missing amenities are explicitly designated as `UNKNOWN` or `MISSING` rather than inferred as absent.
- Operator audits maintain immutable resolution logs recording inspection date and operator signoff.
