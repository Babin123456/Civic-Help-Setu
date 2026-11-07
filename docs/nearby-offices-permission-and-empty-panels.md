# Nearby Offices Location Permission & Empty-State Architecture

## Overview
This document specifies the architectural enhancements for geolocation permissions, non-blocking fallback mechanisms, and structured empty states in the **Nearby Offices & Seva Kendras Directory** (`src/pages/NearbyOffices.jsx`), resolving Issue `#581`.

---

## 1. Non-Blocking Location Permission Design

### Transparent Privacy Safeguards
Citizens are often reluctant to share device geolocation due to privacy concerns. The redesigned `LocationPermissionPanel` explicitly conveys:
1. **Zero-Tracking Guarantee**: Geolocation coordinates stay strictly within the local browser memory and are discarded when the tab closes.
2. **Voluntary Usage**: Users can expand the accordion ("Why does Civic Help Setu ask for location?") to view bulleted guarantees regarding client-side calculation and privacy.
3. **Non-Blocking Operation**: When location access is denied or dismissed, the panel transitions gracefully to a prominent **Manual Search Active** mode with state/district and locality shortcuts.

### Dual Manual Discovery Paths
Adjacent to the optional "Share my location" button, two primary manual pathways are directly surfaced:
- **Choose State / District manually**: Automatically focuses the state dropdown selector for broad regional search.
- **Search by locality or PIN**: Automatically focuses the full-text search input for immediate landmark, neighborhood, or PIN code queries.

---

## 2. Structured Empty State (`NearbyOfficesEmptyState`)

When search and facet filters yield 0 matching facilitation centers:
- **Filter Factor Breakdown**: Renders discrete chips for all active restrictive criteria (e.g., search text, selected state/district, channel, wheelchair accessibility requirement, active radius, and selected spoken languages).
- **Contextual Next-Step Actions**:
  - `Expand search radius to (R + 50) km` when GPS coordinates are present.
  - `Clear search text` when a specific keyword query returned no hits.
  - `Clear accessibility requirements` when facility/language filters exclude centers.
  - `Reset all filters` to quickly return to the pan-India directory.
- Fully accessible with `role="region"`, `aria-labelledby`, and keyboard-focusable actions.

---

## 3. Responsive & Theming Compliance
- High-contrast alert boxes and borders compatible with light, dark, and high-contrast color themes.
- Touch-friendly 44x44px minimum target sizes for all interactive buttons on mobile displays.
- Responsive grid arrangements prevent horizontal overflow at 320px and 375px viewports.
