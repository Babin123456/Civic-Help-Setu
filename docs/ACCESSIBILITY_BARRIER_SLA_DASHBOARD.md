# Accessibility Barrier Resolution SLA Dashboard (#1443)

## Overview
Provides aggregate visibility into accessibility barrier categories, responsible authorities, report-to-resolution durations, SLA compliance rates, and repeat incidents across public facilities while anonymizing reporters and suppressing small groups.

## Architecture
- **SLA Aggregation & Privacy Service**: `src/services/accessibilityBarrierSlaService.js`
  - `anonymizeBarrierReporter`: deterministic non-reversible pseudonymous reporter IDs.
  - `aggregateBarrierSlaMetrics`: filters by `wardId`, `facilityId`, `category`, and `verificationState`, computes repeat incident locations, and suppresses categories with `count < minGroupSize` (default `5`).
  - `verifySlaRuleProvenance`: enforces `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`, marking incomplete rules `unverified`.
- **Store & Serverless API**:
  - `api/_lib/accessibilityBarrierSlaStore.js`
  - `api/_lib/handlers/accessibility-barrier-sla.js` (registered in `api/[...path].js` under `/api/accessibility-barrier-sla`).
- **Offline-First Storage & UI**:
  - `src/services/accessibilityBarrierSlaStorage.js`
  - `src/pages/AccessibilityBarrierSlaDashboard.jsx` (routes: `/accessibility-barrier-sla`, `/barrier-sla-dashboard`).

## Data Provenance, Monitoring & Rollback
- Zero Aadhaar, PAN, OTP, password, biometric, or contact PII is permitted.
- All report submissions and resolutions append redacted entries to `GET /api/accessibility-barrier-sla/audit-log`.
- To increase privacy suppression strictly without code changes, raise `minGroupSize` in aggregation queries.
