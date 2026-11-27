# Tree-Plantation Survival and Public Green Asset Registry (#1441)

## Overview
Geotagged green-asset registry tracking planting batches, species, stewards, inspection dates, and survival status while distinguishing planted (unverified) saplings from verified surviving trees and preventing duplicate registrations.

## Architecture
- **Registry Service**: `src/services/treePlantationSurvivalService.js`
  - `registerGreenAsset`: enforces zero-PII, rounds geo-coordinates to 3 decimals (~110m privacy zone), and prevents duplicate registrations (`409` on matching `batchId + species + rounded lat/lng`).
  - `appendGreenAssetEvidence` & `verifyGreenAssetSurvival`: maintains append-only `evidenceHistory[]` separating `citizen_entered_fact` observations from `official_record` inspections.
  - `aggregateGreenAssetSummary`: distinguishes `verifiedSurvivingCount` from `unverifiedPlantedCount`.
- **Store & Serverless API**:
  - `api/_lib/treePlantationSurvivalStore.js`
  - `api/_lib/handlers/tree-plantation-survival.js` (registered in `api/[...path].js` under `/api/tree-plantation-survival`).
- **Offline-First Storage & UI**:
  - `src/services/treePlantationSurvivalStorage.js`
  - `src/pages/TreePlantationSurvivalWorkspace.jsx` (routes: `/tree-plantation-survival`, `/green-asset-registry`).

## Data Provenance, Monitoring & Rollback
- Official survival verifications require `source`, `jurisdiction`, `effectiveDate`, and `lastVerifiedAt`; incomplete sources are marked `unverified`.
- Zero Aadhaar, PAN, OTP, password, biometric, or contact PII is permitted.
- All asset registrations, evidence additions, and survival verifications append redacted entries to `GET /api/tree-plantation-survival/audit-log`.
