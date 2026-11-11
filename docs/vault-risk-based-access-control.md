# Document Vault Risk-Based Access Control and Anomalous Session Detection

## Overview
Citizen document vaults hold sensitive certificates, identity proofs, and personal records. Route-level authorization alone cannot protect against compromised sessions, stale terminal logins, or malicious bulk data scraping.

The `vaultRiskBasedAccessService` (`src/services/vaultRiskBasedAccessService.js`) introduces adaptive, risk-based access controls and explainable session anomaly detection without invasive browser fingerprinting or logging document contents.

## Key Capabilities

### 1. High-Risk Action Identification & Fresh Authentication
The service identifies high-risk operations:
- `BULK_EXPORT`: Large-scale document downloading.
- `SHARE_DOCUMENT`: Creating public or third-party share links.
- `PERMANENT_DELETE`: Irreversible document purging.
- `RECOVERY_KEYS_CHANGE`: Modifying emergency access credentials.

Operations require fresh authentication verification (`authAgeSeconds < maxFreshAuthAgeSeconds`). Critical actions (`PERMANENT_DELETE`, `RECOVERY_KEYS_CHANGE`) require multi-factor authentication (`challengeType: 'MFA_CODE'`).

### 2. Explainable Anomaly & Rate-Limit Detection
- **Burst Access Detection**: Evaluates sliding-window request volume (default: > 8 requests in 60s) to block automated scraping or unauthorized exfiltration.
- **Stale Session Gating**: Enforces automatic session expiration after inactivity thresholds (default: 30 minutes).
- **No Invasive Fingerprinting**: Detection relies strictly on transparent rate limits and session metadata rather than invasive canvas/audio fingerprinting.

### 3. Session Review & Revocation
- Citizens can list all active devices and sessions (`getActiveSessions()`).
- Unrecognized or suspicious sessions can be immediately revoked (`revokeSession()`), locking out further vault access.

### 4. Privacy-First Security Audit Logging
- Security audit logs record only operational metadata (`eventType`, `timestamp`, `sessionId`, `riskLevel`).
- **Document Exclusions**: Document filenames, file contents, and personal citizen attributes are strictly excluded from all audit records.

### 5. False-Positive Recovery
- When legitimate users trigger rate limits or step-up locks, `verifyAndConsumeStepUpToken()` allows self-serve challenge clearance via re-authentication.
- Built-in replay protection ensures each one-time step-up token can be consumed only once.

## Verification & Testing
- Unit tests in `src/services/vaultRiskBasedAccessService.test.js` verify:
  - Fresh authentication for standard access.
  - Step-up re-authentication requirement on high-risk operations.
  - MFA enforcement on permanent deletion.
  - Burst rate anomaly detection.
  - Inactivity timeout gating on stale sessions.
  - Active session listing and immediate revocation.
  - Single-use step-up token consumption and replay prevention.
  - Absence of document content and filenames in security logs.
