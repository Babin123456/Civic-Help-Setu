# Civic Knowledge Entity Graph (#611)

## Overview
This architectural document details the design and implementation of the Civic Knowledge Entity Graph in Civic-Help-Setu, enabling provenance-preserving relational discovery between schemes, government departments, prerequisite documents, facilitation offices, and application portals.

---

## 1. Problem Statement
Civic knowledge is inherently relational rather than flat. For instance:
- A vehicle registration certificate requires an address document (e.g. Aadhaar).
- A driving licence is issued by the transport department, which also oversees commercial badges and fitness certifications.
Standard chunk retrieval misses these multi-hop relationships and cannot explain *why* an associated service or prerequisite document is pertinent.

---

## 2. Technical Architecture

### A. Graph Schema & Node Types
- `SERVICE`: Schemes, statutory application roadmaps, and citizen entitlements.
- `DEPARTMENT`: Administrative ministries, state commissionerates, and municipal corporations.
- `DOCUMENT`: Pre-requisite certificates, application forms, and affidavits.
- `OFFICE`: Facilitation centers (RTO, Seva Kendra, Collectorate).
- `PORTAL`: Verified government domains (`parivahan.gov.in`, `myaadhaar.uidai.gov.in`).
- `JURISDICTION`: Geographic bounding entities (`National`, `State`, `District`).

### B. Typed Relationships (Edges)
- `ADMINISTERED_BY`: Service $\to$ Department.
- `REQUIRES_DOCUMENT`: Service $\to$ Document.
- `ACCESSIBLE_VIA`: Service $\to$ Official Portal.
- `OPERATES_IN`: Service $\to$ Jurisdiction.

### C. Provenance Tracking
Every relational edge strictly preserves:
- Source catalogue service ID.
- Schema field originating the relationship.
- Verified official portal URL.
- Audit ingestion timestamp.

### D. Bounded Graph Expansion
- Expands query candidates through breadth-first search (BFS) up to a configurable maximum of $2$ hops.
- Enforces strict candidate limits (default $10$ entities) to avoid semantic drift.

### E. Archive Synchronization & Cascading Purge
- Whenever a service is archived, rejected, or updated, corresponding graph nodes and derived provenance edges are purged automatically to prevent stale graph traversal.

---

## 3. Graph Benchmark & Traversal Integrity

| Operation / Invariant | Baseline Flat Search | Entity Graph Traversal |
| :--- | :--- | :--- |
| **Prerequisite Discovery** | Independent manual search | Multi-hop BFS traversal linking required forms |
| **Edge Provenance Record** | 0% (Heuristic correlation) | 100% Traceable back to catalogue fields |
| **Draft / Unapproved Leakage** | Guarded by RAG filters | Blocked at graph ingestion boundary |
| **Orphan Edge Avoidance** | N/A | Strict cascading purge on service archive |

---

## 4. Verification & Testing
- Unit test suite: `src/services/civicEntityGraphService.test.js`.
- Verified 100% test pass with zero ESLint security warnings.
