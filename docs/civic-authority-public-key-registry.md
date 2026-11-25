# Civic Authority Public-Key Registry & Signature Verifier

## Executive Summary
Citizens need a trustworthy method to verify whether a posted civic notification, circular, or tender notice was authentically signed by an authorized municipal authority (e.g. BBMP, Food & Civil Supplies, Revenue Dept) without uploading sensitive citizen information to public blockchains or relying solely on centralized proprietary services.

The Civic Authority Public-Key Registry provides a decentralized and permissionless verification registry where authority public keys and key rotation states are anchored, while notice contents remain strictly off-chain.

---

## Architectural Principles & Security Boundaries

1. **Off-Chain Content Isolation**:
   - Zero citizen identifiers, personal grievances, or raw document contents are ever written to the blockchain or distributed registry.
   - Only authority identifiers, public-key fingerprints (`fp_xxxxxxxx`), validity periods, and revocation metadata are stored.
2. **Key Rotation & Historical Verification**:
   - Public keys carry defined `validFrom` and `validTo` windows. Historical notices signed by an older key remain cryptographically verifiable even after key rotation occurs.
3. **Revocation Tombstones**:
   - If an authority key is compromised or superseded, a revocation entry records the timestamp and reason, preventing further signature verifications.
4. **Critical Trust Distinction**:
   - The user interface explicitly distinguishes:
     * **Signature Authenticated**: Proves the document's cryptographic integrity and origin from the authority.
     * **Notice Legally Current**: A separate statutory check indicating whether the circular has been superseded or repealed.
5. **Non-Blockchain Local Fallback**:
   - In environments without active blockchain testnets, verification executes against a local trusted keystore using standard cryptographic algorithms.

---

## Public Key Lifecycle & Threat Model

```mermaid
flowchart TD
    A[Civic Authority Generates Keypair] --> B[Registers Public Key & Validity Window]
    B --> C[Compute Key Fingerprint: fp_xxxxxxxx]
    C --> D[Authority Signs Public Notice with Private Key]
    D --> E[Citizen / Verifier Queries Key Registry]
    E --> F{Key Revoked or Expired?}
    F -->|Yes| G[Reject Signature: Notice Untrusted]
    F -->|No| H{Cryptographic Signature Matches Document Hash?}
    H -->|No| I[Reject Signature: Content Modified]
    H -->|Yes| J[Verified Authenticity (Display Statutory Notice)]
```

### Threat Modeling & Attack Mitigations

- **Key Compromise**: An emergency revocation entry can be published immediately. Once revoked, past signatures outside the compromise window are audited.
- **Man-in-the-Middle Alterations**: Any byte altered in the circular PDF breaks the signature hash check immediately.
- **Gas / Cost Limits**: Anchoring public fingerprints requires minimal transactions; batch key rotations amortize costs to negligible fractions of a cent on testnets.

---

## Verification & Execution

Execute unit tests:
```bash
npx vitest run src/services/civicAuthorityKeyRegistryService.test.js
```
Automated tests validate key fingerprint calculation, active signature verification, revocation blocking, and expiration checks.

