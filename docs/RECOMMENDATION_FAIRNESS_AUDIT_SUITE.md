# Civic Recommendation Fairness & Coverage Audit Suite (#1449)

## Overview
The **Civic Recommendation Fairness & Coverage Audit Suite** evaluates service recommendation retrieval and completion outcomes across non-sensitive, user-consented cohorts (`language`, `district`, `deviceType`, `connectivityTier`). It extends `src/services/fairnessErrorMonitoringService.js`, `src/services/recommendationEngine.js`, and `src/services/piiLeakageGuardService.js`.

## Architecture
- **Contracts & Privacy Guards**: `src/services/recommendationFairnessAuditContract.js`
  - Defines `COHORT_AXES`, `RECORD_ORIGIN`, `DEFAULT_AUDIT_POLICY`, `PROHIBITED_SENSITIVE_AND_PROXY_KEYS`.
  - Enforces `validateNoSensitiveTraitOrPii` (rejecting Aadhaar, PAN, OTP, password, biometric, mobile, email, caste, religion, disability, health status, and proxy/inference keys).
  - Enforces `evaluateProvenanceVerification` (unknown or incomplete official rules are marked `unverified`).
  - Provides backward-compatible `migrateAuditStoreState`.
- **Audit Engine**: `src/services/recommendationFairnessAuditService.js`
  - Computes per-cohort `Recall@k`, `nDCG@k`, `Retrieval Rate`, `Completion Rate`, `Abstention Rate`, `Catalog Coverage`, and `Brier Calibration Score`.
  - Computes 95% confidence intervals (`computeWilsonConfidenceInterval` for proportions, `computeMeanConfidenceInterval` for continuous metrics).
  - Enforces **small-group suppression** (`minCohortSize = 10`, hard floor `>= 5`).
  - Evaluates **release regression gates** (`PASS`, `WARN`, `BLOCK`) against both absolute thresholds and optional baseline runs.
- **Serverless API & Store**:
  - `api/_lib/recommendationFairnessAuditStore.js`
  - `api/_lib/handlers/recommendation-fairness-audit.js` (registered in `api/[...path].js` under `/api/recommendation-fairness-audit`).
  - Enforces Clerk authentication, `admin` role + jurisdiction authorization, rate limiting, single-flight deduplication, `Cache-Control: no-store`, and redacted audit logs.
- **Accessible Dashboard UI**:
  - `src/services/recommendationFairnessAuditStorage.js` (offline-first storage + API sync).
  - `src/pages/RecommendationFairnessAuditWorkspace.jsx` (routes: `/recommendation-fairness-audit`, `/fairness-audit`).
  - Supports loading, empty, error, and offline states; accessible `<table>` semantics; and visibly distinct `Official Gate Policy`, `Citizen-Consented Cohorts`, and `AI Suggestions (Non-binding)` origins.

## Data Provenance & Privacy
Every dataset and threshold policy carries `source`, `jurisdiction`, `effectiveDate`, `lastVerifiedAt`, and `consentMode` (`user_consented_offline_eval` or `synthetic_benchmark`). Any rule or dataset missing required provenance fields is flagged `unverified`.

## Configuration & Deployment
- **Server environment variables**: `CLERK_SECRET_KEY` for operator verification; `APP_ORIGIN` / `APP_ALLOWED_ORIGINS` for `api/[...path].js` request security.
- **Default Policy**: `minCohortSize: 10`, `minParityRatio: 0.80`, `minRecallAt5: 0.65`, `minCompletionRate: 0.55`, `maxAbstentionRate: 0.35`, `maxRegressionDelta: 0.05`.

## Monitoring & Rollback
- All mutations (`REGISTER_DATASET`, `RUN_FAIRNESS_AUDIT`, `UPDATE_THRESHOLDS`) append redacted entries to the operator audit log (`GET /api/recommendation-fairness-audit/audit-log`).
- If a candidate release triggers `BLOCK` (`BLOCK_RELEASE_AND_ROLLBACK`), revert the recommendation ranking weights or route traffic back to the last `PASS` baseline run and verify via `npm test -- --run src/services/recommendationFairnessAuditService.test.js tests/recommendation-fairness-audit.test.js`.

