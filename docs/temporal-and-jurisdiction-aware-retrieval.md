# Temporal and Jurisdiction-Aware Retrieval for Versioned Civic Rules (#610)

## Overview
This architectural document details the design and implementation of Temporal and Jurisdiction-Aware Retrieval in Civic-Help-Setu, preventing obsolete statutory circulars or geographically incorrect state policies from surfacing in response to present-day citizen queries.

---

## 1. Problem Statement
Government policies, eligibility criteria, fees, and processing roadmaps evolve over time and vary widely across India's 36 States and Union Territories. A pure text-matching retriever risks:
- Quoting expired deadlines (e.g. historical fee exemptions) as active.
- Presenting a State-specific procedure (e.g. Delhi doorstep delivery) as an all-India standard.

---

## 2. Technical Architecture

### A. Versioned Evidence Schema
Every catalogue chunk carries structured temporal and jurisdictional provenance:
- `jurisdictionLevel`: `'central' | 'state' | 'district' | 'local'`
- `jurisdictionCode`: Standard ISO 3166-2:IN code (e.g. `IN-MH`, `IN-DL`, `IN-KA`).
- `effectiveFrom`: ISO 8601 publication / enforcement timestamp.
- `effectiveTo`: ISO timestamp or `null` for open-ended active rules.
- `supersededBy` / `supersedes`: Explicit genealogical pointer tracking policy updates.

### B. Lifecycle Status Resolver
Categorizes rules into 4 distinct phases based on reference timestamps:
1. `CURRENT`: Effective date $\le \text{referenceTime} \le \text{expiryDate}$, with no superseding record.
2. `HISTORICAL`: Expired past records retained strictly for audit or retrospective research.
3. `FUTURE_EFFECTIVE`: Gazetted regulations enacted for future implementation.
4. `SUPERSEDED`: Invalidation caused by a newer statutory amendment.

### C. Pre-Ranking Constraint Pipeline
- All default queries execute against `CURRENT` rules only.
- Historical rules are queried only when queries explicitly include retrospective cues (e.g. *"in 2021"*, *"old rule"*).
- When citizen location is known, filters out conflicting state records.
- When location is absent but state-level variations exist, emits a transparent limitation warning:
  *"Rules for this service differ by state (...). Displaying central baseline; please specify your State/UT for exact local rules."*

---

## 3. Benchmark Verification

| Scenario | Standard Semantic Retriever | Temporal & Jurisdiction Retriever |
| :--- | :--- | :--- |
| **Present query on amended fee** | Surfaces both old and new fees randomly | Surfaces current version exclusively; suppresses superseded rule |
| **Historical query ("rule in 2021")** | Returns current 2026 rule | Reconstructs 2021 active snapshot accurately |
| **State-specific query ("Maharashtra")**| Merges Delhi and MH rules into one response | Isolates Maharashtra specific regulations |
| **Unspecified State query** | Hallucinates single uniform rule | Emits explicit scope limitation notice |

---

## 4. Verification & Testing
- Unit test suite: `src/services/temporalJurisdictionRetrievalService.test.js`.
- Verified 100% test pass with zero ESLint security warnings.
