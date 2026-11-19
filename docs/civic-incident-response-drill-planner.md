# Civic Incident Response Drill & Public Service Continuity Planner (#780)

## Overview & Operational Purpose

Local municipal authorities and ward administration centers frequently experience disruptions: power grid outages, severe monsoon waterlogging, cyber incidents (such as ransomware on civil registries), and central database link cuts.

**Civic Help Setu's Continuity Planner & Drill Conductor** provides an end-to-end, offline-resilient capability for civic authorities to:
1. **Model Public Service Continuity Plans**: Document critical operations, alternate facilities, and tiered recovery targets ($RTO$ / $RPO$).
2. **Map Municipal Service Dependencies**: Map upstream prerequisites, identify unhedged Single Points of Failure ($SPOF$), and enforce acyclic dependency validation.
3. **Facilitate Tabletop Incident Exercises**: Conduct drills with realistic injects (T+0m, T+30m, T+90m), log commanding officer decisions, and quantify response gaps.
4. **Publish After-Action Reports (AAR) & Action Items**: Seal drill findings and track corrective infrastructure action items to closure.
5. **Print Offline Emergency Runbooks**: Generate high-contrast, zero-connectivity printable runbooks with emergency call trees and offline manual Standard Operating Procedures (SOPs).

---

## Architecture & Data Flow

```
[ Municipal Officer / Operator / Citizen ]
                 │
                 ├──> [ Access Control Guard ] (Admin, Operator, Citizen RBAC)
                 │
                 ▼
[ ContinuityPlannerWorkspace (/continuity-planner) ]
  ├── 1. Continuity Plans & BIA Tab (Scope, Recovery Targets, Call Tree)
  ├── 2. Dependency Graph & SPOF Matrix (Topological Sort, Cycle Alert)
  ├── 3. Tabletop Drills Conductor (Timeline Injects, Live Gap Meter)
  ├── 4. After-Action Reports & Action Items (Corrective Task Tracking)
  ├── 5. Explainable Recommendations (Ruleset v1.0.0, Audit Overrides)
  └── 6. Offline Printable Runbook (@media print runbook view)
                 │
                 ▼
[ Domain Services Layer ]
  ├── continuityPlannerService.js (State machines, invariants, CRUD)
  ├── dependencyGraphEngine.js (DFS 3-color cycle detector, SPOF analysis)
  └── continuityAuditService.js (Append-only audit trail)
                 │
                 ▼
[ Normalized Persistent Collections ]
  ├── civicbridge_continuity_plans_v1
  ├── civicbridge_incident_scenarios_v1
  ├── civicbridge_service_dependencies_v1
  ├── civicbridge_exercise_runs_v1
  ├── civicbridge_action_items_v1
  ├── civicbridge_continuity_audit_logs_v1
  └── civicbridge_continuity_recommendations_v1
```

---

## Domain State Machines & Invariant Transitions

### ContinuityPlan Invariants
```
[ DRAFT ] ──> [ IN_REVIEW ] ──> [ APPROVED ] ──> [ ACTIVE ] ──> [ SUPERSEDED ]
    │              │                               │
    └──────────────┴───────────────┬───────────────┘
                                   ▼
                              [ ARCHIVED ]
```
- `DRAFT -> IN_REVIEW`: Submitted by operator.
- `IN_REVIEW -> APPROVED`: Requires Administrator credentials (`requirePermission('continuity.approve')`).
- `APPROVED -> ACTIVE`: Automatically supersedes any previously active plan in the same jurisdiction to prevent policy conflicts.
- `ARCHIVED`: Terminal immutable state.

### ExerciseRun (Tabletop Drill) Invariants
```
[ SCHEDULED ] ──> [ IN_PROGRESS ] ──> [ PAUSED ]
                        │                 │
                        ▼                 ▼
                  [ AAR_REVIEW ] <────────┘
                        │
                        ▼
                    [ CLOSED ]
```
- `SCHEDULED -> IN_PROGRESS`: Drill initiated; timestamp locked.
- `IN_PROGRESS`: Decisions can only be recorded during this phase. Latencies increment the live estimated restoration time and reduce the resilience score.
- `AAR_REVIEW`: Injects completed; facilitators draft strengths, gaps, and recommendations.
- `CLOSED`: Exercise officially sealed and tamper-evident; immutable.

### ActionItem Invariants
```
[ OPEN ] ──> [ IN_PROGRESS ] ──> [ IMPLEMENTED ] ──> [ VERIFIED ]
```
- `IMPLEMENTED`: Operator records completion notes.
- `VERIFIED`: Administrator inspects site or attests verification evidence.

---

## Graph Intelligence & Single Point of Failure (SPOF) Analysis

### 1. Cycle Detection (DFS 3-Coloring)
- Graph representation: Vertices $V$ (Services), Directed Edges $E$ (Dependencies).
- Uses white (unvisited: 0), gray (visiting: 1), black (visited: 2).
- If a back-edge to a gray vertex is discovered during traversal, the cycle path is recorded (e.g. `Water Pumping ➔ Grid Power ➔ Water Pumping`) and writes that would create a circular deadlock are rejected with error code `CYCLE_DETECTED`.

### 2. Topological Phased Restoration
- Services with 0 upstream dependencies are assigned to Phase 1. Subsequent services are assigned to Phase $N+1$ only after their dependencies are satisfied.
- Deterministic fallback: If an unforeseen cycle is present, services are restored strictly sorted by Criticality Tier (Tier 1 Critical first, then Tier 2 Essential, then Tier 3 Deferred).

### 3. Bounded Explainable Recommendations
Every automated suggestion contains:
- `rulesetVersion`: `"1.0.0"`
- `executionTimestamp`: ISO 8601 string
- `inputFeatureWindow`: `{ timestamp, serviceCount, dependencyCount, targetRTO }`
- `rationale`: Transparent explanation of which rules triggered the finding.
- `contributingFields`: Explicit list of source parameters evaluated.
- `requiresHumanSignoff`: An authorized officer must click `[Accept]`, `[Modify SOP]`, or `[Dismiss]` with a mandatory reason written to the audit log.

---

## Privacy, Security & Data Minimization

1. **Contact Information Minimization**:
   - Phone numbers are masked preserving only the last 4 digits (`XXXXXX1234`).
   - Emails are masked preserving the initial/terminal characters (`o***r@ward.gov.in`).
   - Unauthenticated or citizen actors are only served sanitized contact trees. Privileged administrators see full verified dispatch numbers.
2. **Separation of Drills from Real Incidents**:
   - Exercise runs (`civicbridge_exercise_runs_v1`) are strictly isolated from real citizen tracking records and civic works reports.
3. **Append-Only Audit Log**:
   - Sensitive transitions (approvals, supersessions, drill closures, recommendation overrides) are appended with sequential numbers (`seq #`) and cannot be silently overwritten.

---

## Schema Migration & Rollback Strategy

1. **Collection Names**:
   - Versioned suffix `_v1` on all keys (e.g., `civicbridge_continuity_plans_v1`).
2. **Forward Migration**:
   - On evaluation, services check if storage keys exist. If uninitialized, standard municipal templates (Pune Ward 12, Cyber Ransomware, Monsoon Flash Flood) are seeded.
3. **Rollback**:
   - In case of breaking schema revisions, `localStorage.removeItem('civicbridge_continuity_*')` or the **Clear my data** screen (`/privacy`) safely purges the local cache without corrupting adjacent modules.

---

## Verification & Testing

Run the targeted test suites locally:
```bash
# Graph algorithm & cycle detection tests
npm test -- src/services/dependencyGraphEngine.test.js

# Domain service, state machine & privacy masking tests
npm test -- src/services/continuityPlannerService.test.js

# UI components, accessibility & offline runbook tests
npm test -- src/pages/ContinuityPlannerWorkspace.test.jsx

# Access control & RBAC verification
npm test -- src/services/accessControl.test.js

# Data retention & storage registry verification
npm test -- src/services/clearMyDataService.test.js
```
