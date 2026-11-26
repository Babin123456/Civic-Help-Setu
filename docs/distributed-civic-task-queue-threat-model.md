# Distributed Civic Task Queue - Threat Model

## Overview
This document outlines the security threat model for the distributed civic task queue system,
identifying potential threats, their likelihood/impact, and mitigation strategies.

## Trust Boundaries
The system has several trust boundaries where input validation and access control are critical:

1. **API Gateway Boundary** - All external requests enter through the Vercel API routes
2. **Firestore Boundary** - Database access controlled by Security Rules
3. **Tenant Boundary** - Per-tenant isolation and quota enforcement
4. **Worker Boundary** - Worker processes must authenticate and authorize task processing

## Threat Identification

### T1: Unauthorized Task Enqueue
**Description**: An attacker submits tasks to the queue without proper authentication,
potentially flooding the queue or assigning tasks to arbitrary tenants.

**Likelihood**: Medium
**Impact**: High (queue saturation, resource exhaustion, cost inflation)

**Mitigation**:
- Firebase Authentication middleware on all API routes
- Firestore Security Rules enforce that `tenantId` in the task document
  must match the authenticated user's assigned jurisdiction
- Rate limiting at the API gateway level (e.g., 10 tasks/min per authenticated user)
- Input schema validation (taskSchema.js) rejects malformed or malicious payloads

**Security Rules Example**:
```
service cloud.firestore {
  match /databases/{database}/documents {
    match /task_queue/{docId} {
      // Only allow task creation if tenantId matches authenticated user's jurisdiction
      create: if request.auth != null
              && request.resource.data.tenantId == getUserJurisdiction(request.auth)
              && request.resource.data.type is string
              && request.resource.data.payload is map
      
      // Prevent unauthorized reads
      read: if request.auth != null
            && (resource.data.tenantId == getUserJurisdiction(request.auth)
                || isOperator(request.auth))
      
      // Prevent unauthorized updates
      update: if request.auth != null
              && (isOperator(request.auth)
                  || (resource.data.tenantId == getUserJurisdiction(request.auth)
                      && !request.resource.data.status changes to processing))
    }
  }
}
```

### T2: Task Data Leakage Between Tenants
**Description**: A worker or client accesses tasks belonging to a different tenant,
violating jurisdiction isolation.

**Likelihood**: Medium
**Impact**: High (privacy violation, jurisdictional conflicts)

**Mitigation**:
- Firestore Security Rules enforce tenantId-based access control
- Worker processes check tenantId before processing each task
- `getPendingTasks()` automatically filters by tenantId when provided
- All task handlers validate tenantId consistency before execution

**Security Rules Enhancement**:
```
match /task_queue/{docId} {
  // Workers can only claim tasks assigned to their allowed tenants
  update: if request.auth != null
          && isAuthorizedWorker(request.auth)
          && (request.resource.data.tenantId in allowedTenants(request.auth)
              || request.resource.data.tenantId == getUserJurisdiction(request.auth))
}
```

### T3: Denial-of-Service via Task Flooding
**Description**: An attacker or misconfigured tenant submits an excessive number
of tasks, blocking legitimate work.

**Likelihood**: Medium
**Impact**: High (queue starvation, increased costs, degraded performance)

**Mitigation**:
- **Per-tenant quotas**: maxConcurrentJobs, maxJobsPerHour, maxJobsPerDay
- **Firestore document limits**: Practical ceiling on queue depth
- **API gateway rate limiting**: Configurable per-auth-user limits
- **Queue priority + aging**: Ensures no single tenant can monopolize the queue
- **Dead-letter queue**: Malformed or consistently failing tasks are isolated

**Quota Enforcement**:
```javascript
// checkTenantQuota() checks:
// 1. Concurrent jobs: count tasks with status=pending or processing
// 2. Jobs per hour: count tasks created in last 60 minutes
// 3. Jobs per day: count tasks created today
// Returns false if any limit exceeded, task is skipped by worker
```

### T4: Dead-letter Queue Data Exposure
**Description**: Failure reasons stored in DLQ tasks may contain sensitive information
(citizen data, error details with PII).

**Likelihood**: Low
**Impact**: Medium (privacy concern if DLQ data is exported or viewed improperly)

**Mitigation**:
- **Redaction before export**: DLQ failure reasons are sanitized in API responses
- **Access control**: DLQ tasks only visible to operators (isOperator check in Security Rules)
- **No PII in logs**: Task handlers strip sensitive data before logging
- **Retention policy**: DLQ tasks older than 30 days are automatically purged

**Example Redaction**:
```javascript
// In the API response layer, before returning DLQ task details:
const sanitizeFailureReason = (reason) => {
  if (!reason) return null;
  // Remove patterns that might contain PII
  return reason.replace(/(Aadhaar|PAN|Account\s*\d{10})/g, 'REDACTED');
};
```

### T5: Priority Manipulation
**Description**: A malicious actor sets task priority to CRITICAL to bypass
queuing delays and get immediate processing.

**Likelihood**: Low
**Impact**: Medium (unfair resource allocation, bypass of normal queuing)

**Mitigation**:
- Priority validated at schema level (1-4 range only)
- **Aging policy overrides manual priority**: After time thresholds, effective
  priority is computed regardless of original setting
- Firestore Security Rules restrict who can set initial priority
- Operators can manually re-prioritize via admin UI, but changes are audited

**Aging Override Example**:
```
Task submitted with priority=LOW
After 2.5 hours in queue:
  Effective priority = NORMAL (promoted by aging policy)
  Worker picks it up at NORMAL priority, not LOW
  
Task submitted with priority=CRITICAL
After 20 hours in queue (unlikely but possible):
  Effective priority = CRITICAL (already at max, no further promotion needed)
```

### T6: Firestore Quota Exhaustion
**Description**: Task queue operations exceed Firestore's read/write quotas,
causing queue paralysis.

**Likelihood**: Low (Firestore quotas are generous for typical workloads)
**Impact**: High (complete system outage, no task processing)

**Mitigation**:
- **Batched writes**: batchEnqueueTasks() reduces write operations
- **Exponential backoff**: On write failures, retry with backoff
- **Monitoring**: getQueueStats() provides real-time depth metrics
- **Circuit breaker**: Upper-level API gates fail gracefully when queue is overwhelmed
- **Document count limits**: Hard limit on total tasks; new tasks rejected when exceeded

### T7: Stale Task Processing After Worker Restart
**Description**: After worker crash/restart, tasks claimed but not completed
may be processed twice or lost.

**Likelihood**: Medium (workers are processes that can crash)
**Impact**: Medium (duplicate processing, inconsistent state)

**Mitigation**:
- **Claim duration**: 30-second claim window; tasks automatically become
  eligible for re-claim after duration expires
- **Idempotent task design**: Handlers must be designed to handle
  duplicate execution safely (no side effects that aren't idempotent)
- **Status-based deduplication**: If task was already `completed`, re-processing
  is skipped (`if (task.status === 'completed') return`)
- **Retry with backoff**: Failed tasks re-queued with delay, not immediate re-processing

**Worker Crash Recovery**:
```
Worker starts up:
  1. Polls getPendingTasks() - gets tasks with status=pending
  2. Does NOT re-process tasks already in 'completed' status
  3. Claims tasks by setting status=processing
  4. If task was previously 'processing' and now 'pending', it's fair game
```

### T8: Invalid Payload / Code Injection
**Description**: Malicious payload data injected into tasks, executed by handlers.

**Likelihood**: Low (handlers validate input, no arbitrary code execution)
**Impact**: High (if handlers eval() or otherwise execute payload data)

**Mitigation**:
- **Schema validation**: All payloads validated via taskSchema.js before processing
- **No code execution**: Handlers use structured data, not eval() or similar
- **Input sanitization**: String payloads are trimmed and validated
- **Type checking**: All payload fields have expected types enforced

## Threat Summary Table

| Threat | Likelihood | Impact | Overall Risk | Mitigation Status |
|--------|-----------|--------|-------------|-------------------|
| T1: Unauthorized enqueue | Medium | High | High | ✅ Security rules + auth |
| T2: Tenant data leakage | Medium | High | High | ✅ tenantId isolation |
| T3: DoS via flooding | Medium | High | High | ✅ Quotas + aging policy |
| T4: DLQ data exposure | Low | Medium | Medium | ✅ Redaction + access control |
| T5: Priority manipulation | Low | Medium | Medium | ✅ Aging override |
| T6: Firestore quota exhaustion | Low | High | High | ✅ Batching + monitoring |
| T7: Stale processing | Medium | Medium | Medium | ✅ Claim duration + idempotency |
| T8: Code injection | Low | High | High | ✅ Schema validation |

## Risk Acceptance
All high-risk threats have mitigations implemented at the architecture level.
Residual medium risks are acceptable given:
1. The closed ecosystem (authenticated users only)
2. Per-tenant isolation prevents cross-jurisdiction issues
3. Operator oversight for DLQ and quota management
4. Continuous monitoring via getQueueStats()
```