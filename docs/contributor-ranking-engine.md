# Multi-Signal Contributor Ranking Engine

## Motivation & Problem Statement
Open-source civic projects often suffer from distorted contributor recognition metrics that rely strictly on raw commit counts or line volume. Such simplistic measurements encourage gaming (e.g. superficial formatting PRs or micro-commits) while neglecting vital contributions such as thorough code reviews, test writing, comprehensive documentation, and issue reproduction.

The Civic Help Setu Multi-Signal Contributor Ranking Engine establishes a balanced, transparent, and fair scoring framework.

---

## Scoring Architecture & Signal Weights

| Contribution Vector | Weight (Pts) | Guardrails & Anti-Gaming Rules |
| :--- | :--- | :--- |
| **Merged Feature PR** | +25 pts | Requires review approval; core functionality delivery |
| **Merged Bugfix PR** | +18 pts | Addresses verified bug or regression |
| **Documentation PR** | +10 pts | Capped at 50 pts per evaluation cycle to prevent doc spam |
| **Constructive Code Review** | +8 pts | Inline comments & PR approvals; capped at 80 pts |
| **Test Suite Contribution** | +15 pts | Unit, integration, or smoke test coverage additions |
| **Issue Triage & Reproduction**| +5 pts | Triaging citizen/developer reports; capped at 30 pts |
| **Spam / Malicious PR Penalty**| -30 pts | Deterrent penalty applied by repository maintainers |

---

## Progressive Recognition Tiers

1. **Initiate** (0 – 29 pts): Newcomers taking their first steps in the codebase.
2. **Apprentice** (30 – 74 pts): Consistent contributors with multiple validated PRs.
3. **Builder** (75 – 149 pts): Seasoned engineers delivering substantive features and tests.
4. **Core Steward** (150 – 299 pts): Active reviewers and architecture contributors.
5. **Fellow** (300+ pts): Long-term pillars steering repository quality and community growth.

---

## Transparency & Explainability Guarantees

- **Zero Black-Box Metrics**: Every score breakdown details exactly which PRs, reviews, and tests contributed to the point tally.
- **Automated Bot Exclusion**: Accounts matching known bots (`[bot]`, `dependabot`, `renovate`, `github-actions`) are omitted from public leaderboards.
- **Score Floor**: Total score is floored at 0 to prevent negative point debt.

---

## Community Governance & Anti-Gaming Protocols

1. **Sybil Resistance & Activity Scrubbing**:
   Contributors attempting to split work across multiple disposable accounts are identified via commit signatures and IP/session fingerprints during audit reviews.
2. **Review Quality Safeguards**:
   Automated or repetitive comments such as "LGTM" or "+1" are filtered out from qualifying as constructive code reviews; qualified reviews must contain actionable change requests or substantive code feedback.
3. **Appeals and Manual Re-evaluation**:
   Contributors may submit scoring appeals if legitimate contributions were incorrectly penalized or flagged by automated filters.
4. **Decentralized Leaderboard Export**:
   Leaderboard state is serialized periodically to versioned JSON feeds, enabling community dashboards to render live standing tables without querying live database instances.

---

## Verification & Execution

Run unit test suite:
```bash
npx vitest run src/services/contributorRankingService.test.js
```
Automated GitHub workflows recalculate contributor scores nightly and upon PR merges to `main`.

