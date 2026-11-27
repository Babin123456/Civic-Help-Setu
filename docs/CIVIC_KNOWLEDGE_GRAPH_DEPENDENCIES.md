# Civic Knowledge Graph for Cross-Department Service Dependencies

> **Issue**: [#1429](https://github.com/GoldRay19/Civic-Help-Setu/issues/1429)
> **Branch**: `feat/civic-knowledge-graph-deps-1429`
> **Extends**: `#1184` (`civicKnowledgeGraphService.js`, `civic-knowledge-graph.js`, `KnowledgeGraphQueryWorkspace.jsx`)

---

## 1. Architecture Overview

| Component | Role |
|-----------|------|
| `src/services/civicKnowledgeGraphEdgeWorkflow.js` | Static DFS cycle detection, contributor edge proposals, reviewer/admin publication with role separation, accessible flat dependency list builder, PII-free audit log |
| `api/_lib/handlers/civic-knowledge-graph.js` | Extended with `POST action=propose_edge`, `POST action=review_edge`, and `GET ?action=edge_audit_log` |
| `src/components/knowledgeGraph/DependencyEdgeWorkflowPanel.jsx` | Accessible list view + edge proposal/review UI embedded in `KnowledgeGraphQueryWorkspace.jsx` |

---

## 2. Safety & Governance Guarantees

- **Cycle Detection**: `detectCycleWithCandidateEdge()` performs DFS before proposing and before publishing; cyclic edges return `409 ERR_CYCLE_DETECTED`.
- **Jurisdiction & Effective Dates**: Queries and list views filter by `jurisdiction` and `effectiveAsOf` (`effectiveFrom <= asOf <= effectiveTo`).
- **Role Separation**: Contributors cannot approve or publish their own edge proposals (`403`).
- **Rollback**: Revert `DependencyEdgeWorkflowPanel` from `KnowledgeGraphQueryWorkspace.jsx` and the `propose_edge` / `review_edge` / `edge_audit_log` actions from `api/_lib/handlers/civic-knowledge-graph.js`.
