# Citizen Data Wallet: Threat Model & Security Architecture (#1159)

## 1. Executive Summary & Security Objectives
The Consent-Driven Citizen Data Wallet allows citizens to securely hold civic credentials locally, share selectively disclosed attributes with civic relying parties, issue tamper-evident Verifiable Presentations (VPs), and track or revoke consent receipts.

This document outlines the threat model, attack vectors, cryptographic invariants, and operational runbook for maintainers.

---

## 2. Assets & Trust Boundaries

### 2.1 Assets
1. **Raw Citizen Credentials**: Structured claims (name, address, ward, caste, annual income, age, education).
2. **Cryptographic Salts**: Per-attribute blinding salts enabling selective disclosure without revealing withheld claims.
3. **Wallet Encryption Keys**: Client-derived `AES-256-GCM` keys derived via `PBKDF2` with `SHA-256` (minimum 210,000 iterations).
4. **Consent Receipts**: Machine-readable records of granted disclosures, purposes, and active/revoked states.
5. **Verifiable Presentations**: Ephemeral tokens presented to relying parties containing disclosed claims and proof metadata.

### 2.2 Trust Boundaries
- **Boundary 1: Local Browser Runtime vs. Host Environment**: Browser `localStorage` holds the encrypted ciphertext. Raw credentials exist in memory only while the wallet is unlocked.
- **Boundary 2: Citizen Wallet vs. Relying Party (Verifier)**: Relying parties receive only the explicitly disclosed claims. Withheld claims and unselected fields remain isolated in the citizen's device.
- **Boundary 3: Client vs. Serverless Verification API (`/api/verifiable-presentations`)**: The verification API validates presentations without storing citizen records or logging payload contents.

---

## 3. Threat Matrix & Mitigations (STRIDE Analysis)

| STRIDE Category | Threat Vector | Impact | Mitigation Strategy |
|---|---|---|---|
| **Spoofing** | Citizen enters false claims and claims they are verified by UIDAI or State Government. | Relying party misled into granting benefits based on fabricated official credentials. | Strict **Trust Tier** categorization (`SELF_ASSERTED` vs `COMMUNITY_VERIFIED` vs `CRYPTOGRAPHICALLY_ATTESTED`). Warning banners enforce that self-asserted claims have no statutory legal guarantee. |
| **Tampering** | Intermediary or malicious browser extension modifies disclosed attribute values (e.g., changes age or income). | Fraudulent eligibility clearance. | Salted SHA-256 commitments for all claims. Verification recalculates hashes and verifies the presentation digest. Any mismatch triggers immediate verification failure (`TAMPERED_PRESENTATION`). |
| **Repudiation** | Relying party or citizen disputes what attributes were consented to and shared. | Unresolvable data dispute under DPDP Act. | Standardized, immutable **Consent Receipts** generated on issuance, storing timestamp, relying party ID, purpose, and hash of disclosed attributes. |
| **Information Disclosure** | Over-disclosure of sensitive identity markers (e.g., full Aadhaar number when only age verification is required). | Privacy violation and identity theft risk. | **Selective Disclosure Engine**: Claims are partitioned. Withheld attributes are never included in the presentation payload. |
| **Denial of Service** | Flooding verification API with bloated presentation payloads or malformed JSON. | Serverless CPU exhaustion and API latency. | Strict payload size limits (maximum 32 KB), bounded string lengths, and schema validation before parsing cryptographic elements. |
| **Elevation of Privilege / Replay** | Attacker intercepts a valid VP issued for Service A and replays it to Service B or resubmits an expired VP. | Unauthorized benefit access or impersonation. | Mandatory **Audience Binding** (`expectedAudience`) + **Single-Use Challenge Nonce** + **Time-to-Live (`validUntil`)**. Stale or re-targeted presentations are rejected. |

---

## 4. Cryptographic Invariants

1. **Envelope Authenticity**:
   Every Verifiable Presentation includes a deterministic SHA-256 digest computed across:
   `presentationId | audience | nonce | validUntil | sorted(attribute_commitments)`
2. **Selective Disclosure Commitment**:
   For any claim `(key, value)` with blinding salt `S`:
   `commitment = SHA-256(key + ":" + value + ":" + S)`
   The verifier can verify that the commitment matches the disclosed claim without knowing any withheld claims.
3. **Replay Prevention**:
   A presentation is valid if and only if:
   - `presentation.audience === verifier.expectedAudience`
   - `presentation.nonce === verifier.expectedNonce`
   - `currentTime <= Date.parse(presentation.validUntil)`
4. **Revocation Invariant**:
   If `consentReceipt.status === 'REVOKED'`, the presentation is considered void regardless of its remaining validity window.

---

## 5. Privacy & Zero-PII Observability Guidelines

1. **No Cloud PII Escrow**:
   The verification API (`api/_lib/handlers/verifiable-presentations.js`) must **never** persist, database-write, or third-party transmit raw claims.
2. **Sanitized Telemetry**:
   Logging at the verification boundary is restricted strictly to:
   - `event`: `PRESENTATION_VERIFIED` | `VERIFICATION_FAILED`
   - `reason`: Bounded error code (e.g., `EXPIRED`, `AUDIENCE_MISMATCH`, `REVOKED`)
   - `trustTier`: Categorical string
   - `durationMs`: Latency metric
   **Never log citizen names, addresses, income values, or document identifiers.**

---

## 6. Maintainer Runbook & Troubleshooting

### Scenario A: Presentation Fails Verification
1. Verify if `validUntil` has passed (clock skew between client and server).
2. Check if the verifier passed the identical `expectedAudience` and `expectedNonce` used during generation.
3. Check if the citizen has revoked the presentation in their Consent Receipts tab.

### Scenario B: Lost Device Recovery
1. The wallet provides a passphrase-protected JSON backup (`exportEncryptedWalletBackup`).
2. To restore, the citizen uses `importEncryptedWalletBackup(fileData, passphrase)` on the new device.
3. If the citizen forgot their backup passphrase, recovery is cryptographically impossible by design (zero key escrow).
