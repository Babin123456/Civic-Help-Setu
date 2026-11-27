# Architecture Decision Record: Supervisor-Agent Architecture for Complex Multi-Department Grievances

## Status
Accepted

## Date
2026-11-25

## Context
A single grievance may span municipal, utility and district authorities. Citizens often lodge complaints that involve multiple jurisdictions (e.g., a pothole that also affects drainage and electricity). The system needs a supervisor that decomposes such cases into bounded, verifiable tasks without inventing jurisdiction or filing on a citizen's behalf. This requires a supervisor-agent architecture with dependency DAG task representation, jurisdiction evidence citation, conflict detection, human-in-the-loop reassignment, deadline enforcement, and bounded tool permissions.

## Problem Motivation
- A single grievance may span municipal, utility and district authorities
- Need to decompose cases into bounded tasks
- Must not invent jurisdiction or file on citizen's behalf
- Must detect conflicting ownership between agents
- Must enforce deadlines and tool permissions
- Must support human reassignment

## Decision Drivers
1. **Modularity**: Each department/agent handles bounded, well-defined subtasks
2. **Traceability**: Every task must cite official jurisdiction evidence
3. **Safety**: No autonomous filing, benefit denial or official-status claims
4. **Human-in-the-loop**: Human operators can reassign and override
5. **Observability**: Full data flow and failure mode tracking
6. **Provider-neutral adapters**: Over tightly coupled prompt logic

## Considered Options

### Option A: Single-Agent Monolithic Processing
- **Pros**: Simpler initial implementation, single point of failure
- **Cons**: Cannot handle multi-department scope, harder to enforce jurisdiction boundaries, no natural conflict detection, difficult to test individual department interactions, violates "no autonomous filing" principle

### Option B: Peer-to-Peer Agent Mesh (No Supervisor)
- **Pros**: Decentralized, resilient to supervisor failure
- **Cons**: No coherent task decomposition, agents may double-count or conflict, no centralized deadline/enforcement, hard to ensure jurisdiction evidence citation, no deterministic DAG resolution

### Option C: Supervisor-Agent Architecture with DAG (Chosen)
- **Pros**: Deterministic task decomposition, clear dependency ordering, centralized conflict detection, enforceable deadlines and permissions, human-in-the-loop reassignment, traceable data flows, testable cycles and failure modes
- **Cons**: Requires supervisor infrastructure, need for agent registry, DAG management overhead

## Chosen Option: Supervisor-Agent Architecture with DAG

The supervisor decomposes a multi-department grievance into a Directed Acyclic Graph (DAG) of bounded tasks. Each task:
- Cites official jurisdiction evidence (document references, portal URLs, statutory authority)
- Is assigned to a domain-agent registered in the registry
- Has explicit dependencies on prerequisite tasks
- Has deadline enforcement with escalation
- Has bounded tool permissions (what tools/actions the agent can invoke)
- Supports human reassignment override

The domain-agent registry maps departments/jurisdictions to available agents, enabling conflict detection when multiple agents claim overlapping scope.

## ADRs and Sub-decisions

### 1. Task Type System
- **Decision**: Use typed task identifiers with payload schemas per task type
- **Rationale**: Enables validation at service boundaries; each task type has a defined payload and output contract
- **Task Types**:
  - `grievance-decomposition` - Supervisor decomposes incoming grievance into initial DAG
  - `department-investigation` - Agent investigates within its jurisdiction
  - `evidence-submission` - Citizen/submit evidence for a specific task
  - `conflict-resolution` - Human resolves conflicting agent ownership
  - `deadline-escalation` - Automated escalation when deadline approaches
  - `grievance-close` - Final closure task (human-approved)

### 2. DAG Dependency Structure
- **Decision**: Tasks represented as nodes; edges define `dependsOn` relationships
- **Rationale**: Ensures deterministic processing order; cycles indicate configuration errors; parallel execution where dependencies allow
- **Edge Types**:
  - `sequential` - Target must complete before source can start
  - `parallel` - Target can run independently
  - `alternative` - One of mutually exclusive paths (used for conflicting ownership)

### 3. Jurisdiction Evidence Requirement
- **Decision**: Every task must include `jurisdictionEvidence` citing official sources
- **Rationale**: Prevents jurisdiction invention; provides audit trail; supports conflict detection
- **Evidence Format**:
  ```json
  {
    "sourceType": "statutory-portal | government-document | official-portal",
    "sourceId": "string",
    "sourceUrl": "string",
    "citedBy": "agent-id or human-id",
    "citedAt": "ISO timestamp",
    "provenance": "how the evidence was obtained"
  }
  ```

### 4. Agent Registry with Capability Contracts
- **Decision**: Separate registry from supervisor; registry publishes capability contracts
- **Rationale**: Allows independent agent deployment/upgrade; supervisor only needs registry API
- **Capability Contract per Agent**:
  ```json
  {
    "agentId": "string",
    "department": "string",
    "jurisdictionLevel": "local | state | national",
    "capabilities": ["investigate", "evidence-review", "escalate"],
    "permittedTools": ["document-upload", "portal-query", "email-notify"],
    "maxConcurrentTasks": number,
    "slaDays": number
  }
  ```

### 5. Human-in-the-Loop Reassignment
- **Decision**: All task reassignments require human approval; supervisor logs all reassignment events
- **Rationale**: Prevents agent autonomy bypass; provides audit trail; aligns with "no autonomous filing" principle
- **Reassignment Event**:
  ```json
  {
    "eventType": "task-reassigned",
    "taskId": "string",
    "fromAgentId": "string",
    "toAgentId": "string",
    "reason": "string",
    "approvedBy": "human-id",
    "approvedAt": "ISO timestamp",
    "handled": true
  }
  ```

### 6. Deadline Enforcement with Escalation
- **Decision**: Each task has an `deadlineAt` timestamp; violations trigger escalation chain
- **Rationale**: Ensures grievances don't stagnate; provides clear ownership handoff timing
- **Escalation Chain**:
  - T-24h: Notification to assigned agent
  - T-12h: Notification to supervisor operations
  - T-0 (missed): Auto-revert to human reassignment, notify citizen

### 7. Bounded Tool Permissions
- **Decision**: Agents only have access to explicitly permitted tools; tool invocations are audited and logged
- **Rationale**: Principle of least privilege; prevents unauthorized actions; supports security audit
- **Permission Enforcement**: Middleware wraps all agent tool calls; checks agent ID against permitted tools for the task

## Data Flows

### 1. Grievance Intake → Supervisor Decomposition
```
Citizen submits grievance
         |
         v
Supervisor receives grievance with preliminary categorization
         |
         v
Supervisor decomposes into initial DAG (grievance-decomposition task)
         |
         v
DAG nodes enqueued as independent tasks with jurisdiction evidence requirements
         |
         v
Agents claim tasks from queue based on registry jurisdiction mapping
```

### 2. Agent Task Processing → Evidence Citation → Conflict Detection
```
Agent claims task
         |
         v
Agent processes within bounded tool permissions
         |
         v
Agent outputs result + jurisdictionEvidence citations
         |
         v
Supervisor validates evidence against registry jurisdiction mapping
         |
         v
If evidence invalid or conflicting:
         |
         v
Supervisor triggers conflict-resolution task or human reassignment
         |
         v
Task proceeds to next dependency edge or closure
```

### 3. Deadline Escalation
```
Task assigned with deadlineAt
         |
         v
Timer monitors progress toward deadlineAt
         |
         v
If deadline approaching (T-24h, T-12h):
         |
         v
Escalation notifications sent
         |
         v
If deadline missed:
         |
         v
Task auto-escalates to human reassignment
         |
         v
Citizen notified of status change
```

## Failure Modes and Error Handling

| Failure Mode | Detection | Recovery |
|---|---|---|
| **Task DAG Cycle** | Topological sort fails during construction | Log error, return grievance to human for manual decomposition |
| **Unavailable Agent** | Registry query returns no agents for jurisdiction | Escalate to human operator; notify citizen of delay |
| **Conflicting Ownership** | Two agents claim same task jurisdiction | Trigger conflict-resolution task; human decides ownership |
| **Unsupported Authority Claim** | Jurisdiction evidence doesn't match any registered agent | Mark task as "unsupported authority"; require human jurisdiction selection |
| **Deadline Missed** | Current time > deadlineAt | Auto-escalate to human reassignment; citizen notified |
| **Invalid Jurisdiction Evidence** | Evidence sourceType not in allowed list | Strip invalid evidence; flag task for human review |
| **Tool Permission Violation** | Agent invokes tool not in permitted list | Reject tool call; log violation; escalate to security review |
| **Payload Schema Violation** | Task payload doesn't match expected type | Reject task enqueue; log schema violation; require correction |
| **Concurrent DAG Write** | Two supervisors decompose same grievance simultaneously | Firestore security rules + version guards; keep first writer wins |

## Component Ownership

| Component | Owner | Responsibilities |
|-----------|-------|------------------|
| Supervisor Core | Core Infrastructure | DAG management, decomposition logic, deadline enforcement, conflict detection |
| Agent Registry | Platform Team | Agent onboarding, capability contract publication, jurisdiction mapping |
| Task Handlers | Department Teams | Department-specific investigation logic, evidence gathering, portal interactions |
| Human Operators | Grievance Operations | Reassignment approval, conflict resolution, escalation oversight |
| Observability | Site Reliability | Metrics, tracing, alerting on failure modes, cost monitoring |

## Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|---|---|---|
| Unauthorized task enqueue | Medium | High | Firestore Security Rules - only authenticated tenants can enqueue tasks for their jurisdiction; supervisor validates jurisdiction evidence before accepting |
| Task data leakage between tenants | Medium | High | Security rules enforce `tenantId` matching the authenticated user's jurisdiction; supervisor isolates tasks by tenant |
| Jurisdiction evidence forgery | Low | High | Evidence source validated against registry; source URLs must be official government domains; cryptographic provenance where possible |
| Dead-letter queue data exposure | Low | Medium | DLQ documents contain failure reasons; redact sensitive data before export; no PII in logs |
| Denial-of-service via task flooding | Medium | High | Per-tenant quotas + supervisor rate limiting; max 50 tasks/grievance; aging policy prevents starvation |
| Agent autonomy bypass (unauthorized filing) | Low | Critical | Bounded tool permissions; human approval required for all high-impact actions (filing, benefit denial, official-status claims); all actions audited |
| Priority manipulation | Low | Medium | Priority validated at schema level; aging policy overrides manual priority after time thresholds; supervisor ignores client-reported priority |
| Firestore quota exhaustion | Low | High | Batch operations; exponential backoff on write failures; monitor document count; quotas per tenant |
| Conflicting agent decisions | Medium | Medium | Conflict detection via jurisdiction evidence overlap; human reassignment required for resolution |
| Unsupported authority claims | Medium | Medium | Supervisor validates all jurisdiction evidence against registry; unsupported claims trigger human review loop |

## Rollback Plan

1. **Feature flag**: Supervisor operations guarded by feature flag in config
2. **Disable**: Set feature flag to `false`; routes fall back to existing grievance submission flow
3. **Data migration**: Existing grievances in queue remain; can be migrated manually or left for fallback flow
4. **Rollback**: Replace supervisor enqueue calls with direct grievanceClassificationService calls; no data loss since tasks are idempotent and versioned

## Evaluation Criteria (Post-Implementation)

- **Decomposition Correctness**: 95% of multi-department grievances correctly decomposed into valid DAG within 2 attempts
- **Jurisdiction Evidence Validation**: 100% of tasks cite valid official jurisdiction evidence; unsupported claims flagged
- **Conflict Detection**: >90% of conflicting ownership cases detected and escalated to human resolution
- **Deadline Metric**: 80% of tasks completed before deadline; missed deadlines auto-escalate within 5 minutes
- **Agent Availability**: >95% of tasks have at least one available agent in registry; unavailable agents trigger graceful fallback
- **Human Reassignment Latency**: >90% of reassignment requests processed within 15 minutes
- **Tool Permission Compliance**: 100% of agent tool calls comply with permitted-tool lists; violations logged and alerted
- **Test Coverage**: >80% line coverage across all supervisor modules; negative, concurrency, retry and permission-boundary cases
- **Performance**: Firestore read/write costs within budget; <50ms per supervisor operation; DAG construction <200ms for <20 tasks
- **Accessibility**: UI compliant with WCAG 2.1 AA for all supervisor operator interfaces
- **Data Retention**: All task provenance retained for 365 days minimum; no citizen PII in logs or analytics beyond pseudonymized identifiers
- **Cost Limits**: Model API costs capped at $0.05 per grievance decomposition; supervisor overhead <$0.01 per task

## Synthetic Fixtures for Tests

All tests use synthetic fixtures - fully anonymized grievance descriptions, zero individual citizen PII. Test datasets include:
- Multi-department grievances (pothole+drainage+electricity spanning 3 jurisdictions)
- Unsupportable authority claims (citizen incorrectly claims "Supreme Court jurisdiction")
- Conflicting agent ownership (two agents claim same department jurisdiction)
- Unavailable agent scenarios (no registry agent for specific jurisdiction)
- Deadline miss scenarios (tasks approaching/beyond deadline)
- Tool permission violation attempts
- DAG cycle detection fixtures
- Reassignment flow fixtures

No real citizen records, credentials or private documents exposed in logs, prompts or analytics.