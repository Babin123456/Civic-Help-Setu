# Multi-Stage Civic Procedure Planner Using Verified Dependency Graphs

This document specifies the technical design, dependency validation, topological ordering, and edge-evidence verification for the Civic Help Setu Procedure Planning Engine.

## Problem Statement
A citizen's journey to obtain government certificates, licences, welfare benefits, or property records frequently spans multiple discrete stages across different departmental portals and physical counters:
1. Prerequisite document issuance (e.g. proof of age, residence affidavit, income certificate).
2. Slot booking, biometric verification, or in-person appearances.
3. Statutory fee disbursement and receipt retention.
4. Post-approval inspection or postal dispatch.

Standard generative large language models often fabricate procedural shortcuts, omit required intermediate certifications, or hallucinate non-existent prerequisites.

## Architectural Design

The Multi-Stage Civic Procedure Planner enforces deterministic graph execution grounded in verified statutory rules:

```
                            +-----------------------------+
                            |     Citizen Goal & Context  |
                            | (e.g. DL, State: MH, Age: 20|
                            +--------------+--------------+
                                           |
                                           v
                            +-----------------------------+
                            |  Procedure Catalog Filter   |
                            |  & Prerequisite Graph Load  |
                            +--------------+--------------+
                                           |
                                           v
                            +-----------------------------+
                            |  Jurisdiction Evidence Audit|
                            |  (Validate every edge)      |
                            +--------------+--------------+
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
                   v                                               v
        [ All Edges Supported ]                          [ Unsupported / Conflict ]
                   |                                               |
                   v                                               v
        +----------------------+                         +-----------------------+
        |  Topological Sort    |                         | Mark Step UNRESOLVED  |
        |  Dependency Status   |                         | Prompt Clarification  |
        |  (READY / BLOCKED)   |                         | No Hallucinated Edges |
        +----------------------+                         +-----------------------+
```

## Dependency Classifications
- **`MANDATORY`**: Strict statutory prerequisite backed by official legal rule or departmental gazette notification. Missing evidence triggers `UNRESOLVED` state.
- **`RECOMMENDED`**: Best-practice guidance (e.g. keeping digital backup copies, checking tracking portals). Does not block step readiness.
- **`CONDITIONAL`**: Applies only under specific applicant context conditions (e.g., minor applicant requires guardian declaration; vehicle type requires medical Form 1A).

## Evaluation Metrics
- **Dependency Precision**: $\frac{\text{Supported Edges}}{\text{Total Edges}}$
- **Unsupported-Edge Rate**: $\frac{\text{Total Edges} - \text{Supported Edges}}{\text{Total Edges}}$
