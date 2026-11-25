# Maintainer Guide: Zero-Knowledge Attribute Proofs Prototype (#1161)

## Overview
This document guides maintainers, security auditors, and civic engineers on operating, evaluating, and extending the **Zero-Knowledge Age & Residency Attribute Proof Prototype** in Civic Help Setu.

The module allows citizens to prove selective attributes—such as being a Senior Citizen ($\text{Age} \ge 60$), an Adult Civic Elector ($\text{Age} \ge 18$), or a resident of Ward 174—without disclosing full identity documents, exact dates of birth, or home addresses.

---

## Evaluation Commands & Verification Benchmarks

To reproduce evaluation results and verify cryptographic integrity across all components:

```bash
# 1. Run all ZK attribute proof unit, integration, and UI tests
npx vitest run src/data/zkProofContracts.test.js src/services/zk*.test.js src/components/vault/ZkProofGeneratorModal.test.jsx src/pages/ZkAttributeVerifierView.test.jsx tests/zk-attribute-proof-verify.test.js

# 2. Run repository security audit linter
npm run lint:security

# 3. Check Vercel deployment headers and CSP compliance
npm run headers:check
```

### Performance & Latency Benchmarks
- **Client Prover Execution**: $< 50\text{ ms}$ on modern mobile/desktop browsers (target ceiling: $250\text{ ms}$).
- **Verifier Execution**: $< 15\text{ ms}$ per proof evaluation (target ceiling: $50\text{ ms}$).
- **Bundle Footprint**: Added client code is $< 18\text{ KB}$ gzipped (zero heavy WASM circuits or multi-megabyte proving keys).
- **Server Overhead**: Zero compute cost for client-to-client counter verifications; lightweight Vercel serverless function (`api/zk-attribute-proof-verify`) for online counter desks.

---

## Architecture & Trust Model

### Actor Boundaries
1. **Issuer (Synthetic Authority)**: Signs credential root commitments using ECDSA / cryptographic signatures. Publishes versioned Revocation Status Lists (bit vectors).
2. **Citizen (Prover)**: Stores raw documents and salts locally in WebCrypto encrypted vault (`AES-256-GCM`). Generates commitment-bound predicate proofs bound to fresh verifier nonces.
3. **Verifier (Desk / Scheme Wizard)**: Issues freshness challenge nonces, checks issuer root signatures, checks revocation list, evaluates mathematical predicate, and outputs a binary decision.

### Anti-Replay Guarantees
- Interactive challenges enforce a **300-second (5-minute) TTL**.
- Single-use nonces (`ch-<32-hex>`) are stored in an anti-replay cache (`consumedNonces`) upon first presentation. Re-submitting the same nonce fails with `NONCE_ALREADY_CONSUMED`.

### Revocation Status Lists (RSL)
- Bit-vector status index: `0 = ACTIVE`, `1 = REVOKED`.
- Verifiers query the published status list index. If a credential's index is flagged as revoked, verification fails with `Credential has been revoked`.

---

## Synthetic Personas & Test Data (Zero PII)

In accordance with Issue #1161 acceptance criteria, all tests and simulations use synthetic test fixtures defined in `src/data/zkProofContracts.js`:
- `SENIOR_CITIZEN_CHENNAI`: Fictional age 64, Chennai Ward 174 resident.
- `ADULT_TIRUVALLUR`: Fictional age 28, Tiruvallur resident.
- `MINOR_RESIDENT`: Fictional age 15, Chennai resident.
- `OUT_OF_STATE_RESIDENT`: Fictional age 45, Bengaluru resident.

**Strict Privacy Rule**: Never commit real citizen records, Aadhaar numbers, PAN cards, or private phone numbers to this repository or test suite. All endpoints enforce regex scrubbers rejecting `\b\d{12}\b` and `\b[A-Z]{5}[0-9]{4}[A-Z]\b`.

---

## Deployment & Hosting Configuration

- **Frontend Routes**:
  - `/verify-attribute` (Desktop and mobile counter verifier portal)
  - `/vault` (Citizen Prover modal trigger via "ZK Proofs" action button)
- **Vercel Serverless Function**:
  - `api/zk-attribute-proof-verify` (handled via `api/[...path].js`)
  - Protected with `abuseGuard.js` rate limiting (30 requests/minute per IP).
- **Rollback Guidance**:
  - If the prototype needs to be deactivated, remove the route from `src/App.jsx` or disable the button in `src/pages/Vault.jsx`. The core application and existing vault documents are completely decoupled and unaffected.

---

## Legal & Statutory Disclaimer

```
PROTOTYPE NOTICE:
Civic Help Setu's Zero-Knowledge Attribute Proof module is a technological research prototype demonstrating privacy-preserving selective disclosure. It does not constitute statutory identity verification under the Aadhaar Act, 2016, the Information Technology Act, 2000, or official state civil registration rules. Prototype proofs must never be used to grant statutory entitlements without independent legal authorization.
```
