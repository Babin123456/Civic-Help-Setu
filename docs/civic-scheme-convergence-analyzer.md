# Civic Scheme Convergence Analyzer for Overlapping Benefits

This document specifies the technical architecture, non-duplication detection logic, and privacy principles for analyzing overlapping public schemes across Central, State, and Local tiers.

## Problem Statement
Indian households frequently navigate hundreds of overlapping welfare schemes across agriculture, housing, education, health insurance, and nutrition. A citizen may qualify for both a Central scheme (e.g. PM-KISAN, PM-JAY, PMAY) and an analogous State scheme (e.g. state agricultural cash transfer, state health card, state housing grant).

Crucial challenges include:
1. **Uncertain Concurrency**: Are both benefits allowed together, or does availing one trigger disqualification from the other?
2. **Silence in Guidelines**: If departmental rules do not explicitly forbid concurrency, speculative models often hallucinate either blanket permission or false disqualification.
3. **Privacy Concerns**: Citizens should be able to explore eligibility scenarios completely anonymously without uploading income or sensitive personal identifiers.

## Convergence States

```
                    +------------------------------------+
                    | Pairwise / Portfolio Evaluation    |
                    +-----------------+------------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
         v                            v                            v
  [ COMPLEMENTARY ]            [ CONDITIONAL ]              [ RESTRICTED ]
  Different benefit            Allowed as top-up            Explicit non-duplication
  sectors or explicit          up to defined ceiling        clause in gazette order
  coexistence circular         with circular citation       with exact passage

                                      |
                                      v
                                 [ UNKNOWN ]
                       Same benefit category but no
                       published circular exists.
                       (NEVER infer exclusion from silence)
```

## Architectural Principles & Guarantees
- **Anonymous Exploration**: Operates solely on scheme IDs and benefit types. No PII, Aadhaar numbers, or demographic attributes are ingested.
- **Never Infer Restriction from Silence**: In the absence of a documented exclusion circular, the state is categorized strictly as `UNKNOWN`, advising the citizen to consult the local sanctioning desk.
- **Statutory Authority**: Citations link to official gazette numbers or department orders.
