# Architecture Decision Record: Consent-Driven Citizen Data Wallet with Verifiable Presentations (#1159)

## Status
**Accepted / Implemented** (Level 3 Architecture)

## Context & Problem Statement
In public administrative processes (e.g. municipal water connections, trade licences, welfare pensions, scholarship verifications), citizens are routinely required to repeatedly supply identity and entitlement documents (Aadhaar, income certificates, caste declarations, residence proofs). This common workflow has critical security and privacy shortcomings:
1. **Severe Over-disclosure**: Verifiers (relying parties) requesting simple eligibility checks (e.g., "Is applicant above 18?" or "Does applicant reside in Ward 12?") receive unredacted identity certificates containing Aadhaar numbers, parental names, full home addresses, and photographs.
2. **Replay & Uncontrolled Secondary Transfer**: Shared copies can be replayed or passed along to unauthorized third parties without citizen awareness or enforceable purpose boundaries.
3. **Lack of Provable Consent Lifecycle**: Under Section 6 of the Digital Personal Data Protection Act, 2023 (DPDP Act), personal data processing requires specified purpose limitation, clear notice, and freely revocable consent accompanied by auditable consent receipts.
4. **False Claims of Authority**: Many digital wallet solutions misleadingly claim official statutory status or government verification without genuine cryptographic signatures from the issuing authority.

## Decision
We implement a **Local-First, Consent-Driven Citizen Data Wallet with Selective Disclosure Verifiable Presentations (VPs)** directly within Civic Help Setu.

### 1. Key Architectural Principles
- **Local-First & Client-Encrypted**: Credentials and wallet state are stored exclusively in the citizen's browser storage (WebCrypto `AES-256-GCM` with `PBKDF2` key derivation, 210,000 iterations), with zero server-side key escrow and zero centralized storage of citizen documents.
- **Selective Disclosure by Default**: The wallet decomposes credentials into discrete, individually committed attributes. Citizens select only the minimum attributes required for the target civic service.
- **Cryptographic Presentation Binding**: Disclosed attributes are packaged into an ephemeral Verifiable Presentation (VP) envelope containing:
  - Cryptographic Salted Commitments: `SHA-256(attributeKey + ":" + value + ":" + salt)`.
  - Audience Binding: Bound to the specific relying party / service identifier.
  - Replay Defense: Ephemeral single-use challenge nonce and strict time-to-live (`validUntil`).
  - Presentation Digest: Cryptographic envelope hash ensuring zero tampering.
- **Standardized Machine-Readable Consent Receipts**: Every issued presentation generates a Consent Receipt adhering to DPDP Act principles, recording data subject ID, relying party, purpose, disclosed attributes, valid duration, and revocation state.
- **Active Consent Revocation**: Citizens can revoke any active presentation at any time. Verifiers validate revocation status against the wallet revocation registry prior to processing.
- **Anti-Authority-Claiming Boundary (Truth in Verification)**: Every credential explicitly classifies its trust tier:
  - `SELF_ASSERTED`: Entered by citizen; disclaims government verification.
  - `COMMUNITY_VERIFIED`: Attested by localized civic peer or ward observer.
  - `CRYPTOGRAPHICALLY_ATTESTED`: Signed by an external cryptographic key pair.
  The UI and API strictly output statutory disclaimers stating that self-asserted credentials do not represent statutory government grants.

---

## 2. Component Boundaries & Data Flow

```
+───────────────────────────────────────────────────────────────────────────────────+
│                                 CITIZEN DEVICE                                    │
│                                                                                   │
│   +───────────────────────────+          +────────────────────────────────────+   │
│   │ Local Encrypted Storage   │          │ Selective Disclosure Engine        │   │
│   │ (AES-256-GCM / PBKDF2)    │ ───────> │ - Attribute selection & filtering  │   │
│   │ Credentials, Salt Chains  │          │ - Blinding salts & commitments     │   │
│   +───────────────────────────+          +────────────────────────────────────+   │
│                                                            │                      │
│                                                            ▼                      │
│   +───────────────────────────+          +────────────────────────────────────+   │
│   │ Consent Receipt Registry  │ <─────── │ Verifiable Presentation Generator  │   │
│   │ - Purpose & Scope Log     │          │ - Audience & Nonce Binding         │   │
│   │ - Revocation State Flag   │          │ - Time-bound Expiry (validUntil)   │   │
│   +───────────────────────────+          +────────────────────────────────────+   │
│                                                            │                      │
+────────────────────────────────────────────────────────────┼──────────────────────+
                                                             │
                                                             │ (Presentation Token / JSON)
                                                             ▼
+───────────────────────────────────────────────────────────────────────────────────+
│                          VERIFIER / RELYING PARTY SERVICE                         │
│                                                                                   │
│   POST /api/verifiable-presentations                                              │
│                                                                                   │
│   1. Nonce & Audience Validation (rejection of cross-service/stale replays)       │
│   2. Expiration Check (rejection if timestamp > validUntil)                       │
│   3. Revocation Check (validation against wallet/revocation status)                │
│   4. Commitment Verification (SHA-256 integrity match)                            │
│   5. Trust Tier Disclosure & Statutory Disclaimer Emission                        │
+───────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. Threat Model & Failure Modes

| Threat | Risk Level | Mitigation Architecture |
|---|---|---|
| **Replay Attack** | High | Every VP includes an audience URI, verifier challenge nonce, and short validity window (`validUntil`). Re-submitting to another service or after expiry fails deterministically. |
| **Attribute Tampering** | Critical | Each claim is committed via `SHA-256(key + ":" + value + ":" + salt)`. Modifying claim values breaks the presentation digest. |
| **Over-disclosure** | High | Selective disclosure wizard UI displays a data minimization indicator, allowing granular attribute toggling and withholding sensitive unneeded claims. |
| **Statutory Impersonation** | High | Clear `trustTier` enums and mandatory disclaimers prevent self-asserted credentials from displaying official government badges. |
| **Lost Device / Data Loss** | Medium | Passphrase-derived encrypted backup export/import allows citizens to back up their wallet without server-side key escrow. |
| **Revocation Bypass** | High | Real-time status lookup rejects revoked presentations immediately upon citizen withdrawal. |

---

## 4. Consequences & Trade-offs
- **Advantages**:
  - Zero PII retained on centralized application servers.
  - Full compliance with DPDP Act, 2023 Section 6.
  - Modular, provider-neutral architecture compatible with future W3C Verifiable Credentials and OpenID for Verifiable Presentations (OID4VP).
- **Trade-offs**:
  - Local device storage dependency requires users to maintain their encrypted backup for cross-device migration.
  - Verifiers require connectivity to the citizen's presentation endpoint or wallet registry to evaluate revocation in real-time.
