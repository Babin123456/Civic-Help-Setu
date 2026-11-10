# Evidence-Entailment Verification and Unsupported-Claim Detection

This document specifies the technical design, verification pipeline, and risk mitigation strategies for the Civic Help Setu Evidence-Entailment and Unsupported-Claim Detection Engine.

## Problem Statement
Large language model generation in citizen-facing public service workflows poses unique hallucination risks. When citizens ask queries regarding government services, incorrect statutory fees, non-existent deadlines, fabricated penalty clauses, or fictitious procedural requirements can lead to delayed administrative applications, financial loss, or legal penalties.

Deterministic ground-truth anchoring and clause-level natural language inference (NLI) are required to verify assistant responses before rendering or when generating structured guidance.

## Architecture & Verification Pipeline

```
                                      +--------------------------+
                                      |   Assistant Response     |
                                      +-------------+------------+
                                                    |
                                                    v
                                      +--------------------------+
                                      |    Claim Decomposition   |
                                      +-------------+------------+
                                                    |
                                                    v
                                      +--------------------------+
                                      |  Risk Category Classifier|
                                      |  (Fee, Deadline, Legal)  |
                                      +-------------+------------+
                                                    |
                                                    v
                                      +--------------------------+
                                      |  Cross-Evidence Scorer   |
                                      |  - Overlap Verification  |
                                      |  - Contradiction Check   |
                                      +-------------+------------+
                                                    |
                                                    v
                 +----------------------------------+----------------------------------+
                 |                                  |                                  |
                 v                                  v                                  v
     [ Status: SUPPORTED ]               [ Status: CONTRADICTED ]             [ Status: INSUFFICIENT ]
     Mapped Chunk Citations              Flagged Inconsistency                Uncertainty Warning Notice
```

## Risk Classification
Claims are classified into risk profiles based on citizen impact:
- **`HIGH_RISK_FEE`**: Mentions fee values, payment modes, charges, or currency tokens.
- **`HIGH_RISK_DEADLINE`**: References processing windows, turnaround times (TAT), or validity dates.
- **`HIGH_RISK_PENALTY_LEGAL`**: References statutes, criminal sanctions, fines, or penal sections.
- **`GENERAL_FACT`**: Procedural or descriptive text.

## Fail-Closed Principle
When high-risk claims fail to achieve the required entailment threshold against verified catalogue sources, the engine activates a fail-closed uncertainty notice, cautioning the citizen to verify fees and deadlines with the local competent revenue/civil office directly.
