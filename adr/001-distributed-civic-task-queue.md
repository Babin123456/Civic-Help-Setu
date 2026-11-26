# Architecture Decision Record: Distributed Civic Task Queue

## Status
Accepted

## Date
2026-11-24

## Context
Long-running ingestion, OCR and agent jobs need reliable scheduling without starving low-volume jurisdictions. The existing Civic Help Setu services need a durable, observable task queue system that integrates with Firebase Firestore.

## Decision Drivers
1. **Durability**: Jobs must survive worker crashes and restarts
2. **Priority**: Different task types need different urgency levels (OCR critical, grievance normal, etc.)
3. **Fairness**: Per-tenant quotas to prevent any single jurisdiction from dominating resources
4. **Recovery**: Bounded retries with dead-letter queue for poisoned jobs
5. **Observability**: Metrics on queue health, processing times, failure rates
6. **Idempotency**: Tasks must be safely re-executable

## Considered Options

### Option A: In-memory Queue with Redis Backing
- Pros: Fast, mature ecosystem, fine-grained control
- Cons: Additional infrastructure (Redis), operational overhead, not natively integrated with existing Firebase setup

### Option B: Firestore-only Queue (Chosen)
- Pros: Already in use project-wide, native real-time updates, offline support, no additional infrastructure, automatic scaling
- Cons: Firestore write throughput limits (mitigated with batching), less fine-grained priority control than Redis

### Option C: Cloud Tasks / External Queue Service
- Pros: Fully managed, excellent reliability, native retries/DLQ
- Cons: Additional cost, vendor lock-in, less integration with existing codebase, network latency

## Chosen Option: Firestore-only Queue

The Firestore-backed queue (Option B) is chosen because:
1. **No additional infrastructure** - project already uses Firebase/Firestore
2. **Native integration** - same auth, same SDK, same observability stack
3. **Sufficient throughput** - Firestore handles the expected workload for civic task scheduling
4. **Built-in security rules** - can enforce tenant isolation at the database level
5. **Real-time monitoring** - Firestore listeners for live queue monitoring

## ADRs and Sub-decisions

### 1. Priority Scheme
- **Decision**: Use numeric priority (1-4) with higher = more priority
- **Rationale**: Simple, easy to reason about, compatible with Firestore ordering
- **Aging Policy**: Automatic promotion after time thresholds prevents starvation:
  - LOW → NORMAL after 2 hours
  - NORMAL → HIGH after 6 hours  
  - HIGH → CRITICAL after 14 hours

### 2. Bounded Retries
- **Decision**: Maximum 3 retries with exponential backoff
- **Backoff formula**: `min(1s * 2^(n-1), 30s)` where n is retry attempt
- **Rationale**: Prevents infinite retry loops, gives transient issues time to resolve, balances between giving up too soon vs. endless retrying

### 3. Dead-letter Queue
- **Decision**: Move tasks to `status: 'dead_letter'` after max retries exceeded
- **Rationale**: Poison jobs are isolated for operator review rather than silently dropped; failure reason is stored for debugging

### 4. Per-Tenant Quotas
- **Decision**: Enforce max concurrent jobs, max jobs/hour, max jobs/day per tenant
- **Rationale**: Ensures fair resource distribution across jurisdictions; prevents single-tenant starvation; configurable per-deployment

### 5. Idempotency
- **Decision**: Tasks must be designed idempotently; task queue stores retry count and failure history but does not enforce application-level idempotency
- **Rationale**: Keeps the queue infrastructure generic; idempotency is the responsibility of task handlers

### 6. Worker Claim Pattern
- **Decision**: Workers claim tasks by setting status to 'processing' and recording claim metadata; claim duration is 30 seconds with automatic re-queue if worker crashes
- **Rationale**: Prevents duplicate processing when multiple workers compete for the same task; 30s duration balances between quick claim and allowing sufficient processing time

## Data Flow

```
+-------------------+     +---------------------+     +------------------+
|   API/Client      | --> |  enqueueTask()      | --> |  Firestore       |
|  (submit job)     |     |  (add to collection)|     |  task_queue col  |
+-------------------+     +---------------------+     +------------------+
           ^                           |                            |
           |                           v                            v
           |                  +------------------+        +---------------------+
           |                  |  Worker Process  | ---->  |   Task Execution    |
           |                  |  (claim+process) |        | (OCR, classification, etc) |
           |                  +------------------+        +---------------------+
           |                           |                            |
           |                 success   |    failure               | max retries exceeded
           |                           v                            v
           |                +---------------------+        +---------------------+
           |                |  updateTask()       | ---->   | moveToDeadLetter()  |
           |                | (status=completed) |        | (status=dead_letter)|
           +----------------+---------------------+        +---------------------+

## Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| Unauthorized task enqueue | Medium | High | Firestore Security Rules - only authenticated tenants can enqueue tasks for their jurisdiction |
| Task data leakage between tenants | Medium | High | Security rules enforce `tenantId` matching the authenticated user's jurisdiction |
| Dead-letter queue data exposure | Low | Medium | DLQ documents contain failure reasons; redact sensitive data before export |
| Denial-of-service via task flooding | Medium | High | Per-tenant quotas + Firestore rate limiting; max 100 jobs/hour per tenant |
| Stale task processing after restart | Medium | Medium | Claim duration + idempotent task design; tasks re-queued on worker crash |
| Priority manipulation | Low | Medium | Priority validated at schema level; aging policy overrides manual priority after time thresholds |
| Firestore quota exhaustion | Low | High | Batch operations; exponential backoff on write failures; monitor document count |

## Component Ownership

| Component | Owner | Responsibilities |
|-----------|-------|------------------|
| Task Schema | Core Infrastructure | Document structure, versioning, validation |
| Task Queries | Core Infrastructure | Firestore CRUD operations, batching, stats |
| Task Processor | Integration Team | Worker logic, handler integration, retry/DLQ handling |
| Scheduler | Integration Team | Aging policy enforcement, worker pool management |
| Handler: grievance-classification | Grievance Team | OCR/service integration, payload validation |
| Handler: ocr-processing | OCR Team | Document service integration, error handling |
| Task Router | Core Infrastructure | Type dispatch, handler registration, extension points |

## Failure Handling

1. **Worker Crash**: Tasks remain in `processing` state for 30s claim duration; on worker restart, unclaimed tasks are re-picked up
2. **Transient Failure**: Exponential backoff retry (max 3 attempts); task returns to `pending` state
3. **Poison Job**: After 3 failures, task moved to `dead_letter` with failure reason stored; operator intervention required
4. **Queue Saturation**: Per-tenant quotas prevent any single tenant from blocking the queue; waitlisted tasks are picked up in next cycle
5. **Firestore Unavailability**: Operations fail with clear error messages; upper layers should implement retry logic at the API gateway level

## Rollback Plan

1. **Feature flag**: Task queue operations guarded by feature flag in config
2. **Disable**: Set feature flag to `false`; routes fall back to synchronous processing
3. **Data migration**: Existing tasks in queue remain in Firestore; can be migrated or deleted
4. **Rollback**: Replace `enqueueTask` calls with direct service invocations; no data loss expected since tasks are idempotent

## Evaluation Criteria (Post-Implementation)

- **Queue Latency**: Time from enqueue to first worker pickup < 5 seconds (95th percentile)
- **Fairness**: No tenant exceeds its quota; distribution across tenants within 10% variance
- **Reliability**: 99.9% of tasks eventually complete or are dead-lettered with clear reason
- **Priority Correctness**: 95% of tasks processed in priority order (considering aging promotions)
- **Retry Efficiency**: >80% of retries succeed within 2 attempts; <5% of tasks reach dead-letter queue
- **Observability**: All metrics (queue depth, processing time, failure rate) available via `getQueueStats()`
- **Test Coverage**: >80% line coverage across all task queue modules
- **Performance**: Firestore read/write costs within budget; <50ms per queue operation