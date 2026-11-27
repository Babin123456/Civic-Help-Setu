# Evidence-Based Contributor Badge Catalogue

## Overview
Recognition in Civic Help Setu must be transparent, tamper-proof, and grounded in verifiable technical accomplishments. The Evidence-Based Contributor Badge Catalogue replaces arbitrary badges with cryptographic, rule-verified credentials that link directly to merged pull requests, test additions, accessibility remediations, and security hardening contributions.

---

## Badge Catalogue & Qualification Rules

| Badge ID | Badge Title | Category | Qualification Rule |
| :--- | :--- | :--- | :--- |
| `FIRST_MERGED_PR` | First Voyage | Onboarding | Successfully merged first validated PR into `main` |
| `DOC_STEWARD` | Documentation Steward | Knowledge | Authored or updated 3+ substantive guides/docs |
| `ACCESSIBILITY_ADVOCATE` | Accessibility Advocate | Inclusivity | Delivered verified WCAG 2.1 AA improvements or screen reader fixes |
| `TEST_GUARDIAN` | Test Guardian | Reliability | Contributed 5+ passing test cases to repository test suites |
| `SECURITY_SENTINEL` | Security Sentinel | Security | Hardened security boundaries, CSP policies, or storage leak guards |

---

## Cryptographic Proof & Verification Architecture

1. **Immutable Proof Bindings**:
   Each badge awarded records:
   - Target pull request number (`prNumber`)
   - Merged Git commit hash (`commitSha`)
   - Unique evidence digest (`dig_xxxxxxxx`) computed over author, PR, and timestamp.
2. **Deduplication Safeguards**:
   Singular lifetime achievement badges (e.g. `FIRST_MERGED_PR`) cannot be re-awarded or duplicate-minted to the same profile.
3. **Decentralized Export**:
   Badges are exported as portable JSON schemas that can be verified by community mirrors or embedded within contributor profiles without central authority locking.

---

## Revocation & Integrity Auditing Protocols

1. **Reversible Corrections**:
   In cases where a merged pull request is later identified as plagiarized or spam and reverted, maintainers have authority to revoke the associated badge.
2. **Revocation Tombstones**:
   Revoked credentials record a tombstone reason and revocation timestamp in the audit log, ensuring complete transparency without erasing history.
3. **Decentralized Verifiability**:
   Anyone can verify the authenticity of an awarded badge by running SHA-256 checks over the public PR number, author, and merge timestamp, ensuring zero dependency on proprietary badge hosting platforms.

---

## Verification & Execution

Execute badge ledger tests:
```bash
npx vitest run src/services/contributorBadgeService.test.js
```
Automated maintainer workflows execute badge evaluation upon PR merge events.

Automated maintainer workflows execute badge evaluation upon PR merge events.
