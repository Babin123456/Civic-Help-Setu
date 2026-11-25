# Distributed Civic Task Queue - Data Flow Diagram

## Overview
This document describes the data flow through the distributed task queue system,
from job submission through processing, retry, and completion/dead-letter handling.

## Diagram: Job Lifecycle

```
+---------------------+     +----------------------+     +----------------------+
|   API Gateway / UI  |     |   Task Queue Service |     |   Worker Processes   |
+----------+----------+     +----------+-----------+     +----------+-----------+
           |                       |                      |
           | 1. enqueueTask()      |                      |
           |    type, payload,     |                      |
           |    tenantId, priority |                      |
           v                       |                      v
+----------+----------+     +----------------------+     +----------------------+
|  Firestore          |     |  Security Rules      |     |  Claim & Processing  |
|  task_queue col     |     |  - tenantId auth     |     |  - status=processing |
|  - document         |     |  - quota enforcement |     |  - claim metadata    |
|  - priority         |     |  - schema validation |     |  - timeout handling  |
|  - retryCount       |     +----------------------+     +----------------------+
|  - status           |
|  - createdAt        |
+----------+----------+                           |
           |                                       |
           |                                       |
           |   2. Worker polls getPendingTasks()   |
           |   3. Filters: quota, capability      |
           v                                       v
+----------+----------+     +----------------------+     +----------------------+
|   Query Tasks     |     |   Effective Priority |     |   Execute Handler    |
|   (orderBy priority)|   |   (aging promotion) |     |   - type-specific    |
+----------+----------+     +----------------------+     |   - OCR, classify,   |
           |                                       |    form-validation)  |
           |                                       v                    +-----+------+
           |                               +---------------------+     |   Handler    |
           |                               |  Firestore Updater  |          +-----+------+
           |                               |  (updateTask)       |           |   Result   |
           |                               +---------------------+           +-----+------+
           |                                   |                     |         |
           |         success                 |                     |   failure
           |                                   v                     v
           |                            +---------------------+  +---------------------+
           |                            |  updateTask()      |  | moveToDeadLetter()  |
           |                            | (status=completed) |  | (status=dead_letter)|
           |                            +---------------------+  +---------------------+
           |                                   |                     |
           |                                   |                     |
           |                    +            v                     v
           |                    +         +---------------------+
           |                    +         |  Firestore Doc      |
           |                    +         |  (retried/task)     |
           |                    +         +---------------------+
           |                                  |
           |                       +            v
           |                       +          +---------------------+
           |                       +   retries  |  updateTask()      |
           |                       +          | (retryCount++)    |
           |                       +          +---------------------+
           |                                  |
           |                       +            v
           |                       +     +---------------------+
           |                       +     |  re-queue as PENDING|
           |                       +     |  with backoff delay |
           |                       +     +---------------------+
           |                                  |
           +----------------------[Cycle]----+

## Data Flow Details

### 1. Job Submission (enqueueTask)
**Input**: type, payload, tenantId (optional), priority (default: NORMAL), metadata
**Validation**: 
- Schema validation at trust boundaries (taskSchema.js)
- Type checking, priority range validation
- Payload object type check
**Firestore Write**:
- Collection: `task_queue`
- Document fields: id, type, tenantId, priority, status, payload, metadata,
  retryCount, maxRetries, createdAt, updatedAt, agingInfo, deadLetterInfo,
  _schemaVersion
- Atomic write with server timestamps for _createdAt and _updatedAt

### 2. Task Retrieval (getPendingTasks)
**Query Parameters**: tenantId (optional), limit, minPriority
**Firestore Query**:
- where('status', '==', 'pending')
- where('priority', '>=', minPriority) [note: higher number = higher priority]
- Optional: where('tenantId', '===', tenantId)
- orderBy('priority', 'desc')
- limit(N)
**Sorting**: Within same priority, sorted by createdAt (FIFO)

### 3. Worker Claim & Processing
**Steps**:
1. Worker calls getPendingTasks() with its tenantId and capability filter
2. For each task, check tenant quota (checkTenantQuota)
3. Check task type matches worker capabilities
4. Claim task: updateTask(taskId, { status: 'processing', metadata: { claimedBy, claimedAt } })
5. Execute handler (routeTask → handler-specific function)
6. On success: updateTask(taskId, { status: 'completed', retryCount: 0, metadata: { completedAt, result } })
7. On failure: increment retryCount; if < maxRetries, re-queue with backoff; else moveToDeadLetter

### 4. Aging Policy (runAgingPolicy)
**Interval**: Every 30 minutes (configurable)
**Process**:
1. Get pending tasks with limit=100, minPriority=LOW
2. For each task, compute effective priority using computeEffectivePriority()
3. If task has been at LOW priority for >2 hours → promote to NORMAL
4. If task has been at NORMAL for >6 hours → promote to HIGH
5. If task has been at HIGH for >14 hours → promote to CRITICAL
6. Update task priority and agingInfo.lastPromotionAt

### 5. Dead-letter Queue (moveToDeadLetter)
**Trigger**: retryCount >= maxRetries (default 3)
**Action**:
- updateTask(taskId, {
    status: 'dead_letter',
    retryCount: maxRetries,
    failureReason: errorMessage,
    deadLetterInfo: { movedToDeadLetter: true, failureReason }
  })
**Aftermath**:
- Task no longer picked up by getPendingTasks() (filtered by status != dead_letter)
- Visible to operators for review and manual intervention
- Failure analytics and monitoring

### 6. Queue Status Query (getQueueStats)
**Returns**:
- pending: count of pending tasks
- completed: count of completed tasks
- failed: count of failed (non-DLQ) tasks
- deadLetter: count of dead-lettered tasks
- active: count of non-completed, non-DLQ tasks
- byPriority: object with count per priority level
- total: total task count

## Sample Firestore Document

```javascript
{
  id: "task-abc123",
  type: "grievance-classification",
  tenantId: "municipality-5",
  priority: 3,  // HIGH
  status: "processing",
  payload: {
    grievanceText: "Pothole on Main Street causing accidents",
    options: { jurisdiction: "city" }
  },
  metadata: {
    createdBy: "web-app",
    claimedBy: "worker-xyz-123",
    claimedAt: "2026-11-24T10:30:00Z"
  },
  retryCount: 0,
  maxRetries: 3,
  createdAt: "2026-11-24T10:00:00Z",
  updatedAt: "2026-11-24T10:35:00Z",
  agingInfo: {
    queuedAt: "2026-11-24T10:00:00Z",
    lastPromotionAt: "2026-11-24T10:00:00Z"
  },
  deadLetterInfo: {
    movedToDeadLetter: false,
    failureReason: null
  },
  _schemaVersion: "1.0.0",
  _path: "task_queue/task-abc123"
}
```

## Priority & Aging Behavior

```
Task Priority Levels (numeric, higher = more urgent):
  CRITICAL(4)   - Emergency civic emergencies, immediate response needed
  HIGH(3)       - Time-sensitive operations, OCR processing, urgent grievances
  NORMAL(2)     - Standard processing, routine grievances, form validation
  LOW(1)        - Background, best-effort, non-urgent background jobs

Aging Promotion Timeline:
  • After 2 hours at LOW → automatically promoted to NORMAL
  • After 6 hours at NORMAL → automatically promoted to HIGH
  • After 14 hours at HIGH → automatically promoted to CRITICAL

This ensures low-volume jurisdictions are not starved of processing capacity:
  - A LOW priority job submitted by a small jurisdiction will gradually
    be promoted as it waits, eventually receiving the same priority as
    naturally HIGH jobs from other jurisdictions.
```

## Error Handling Flow

```
Task Execution → Success Path:
  updateTask(status=completed, retryCount=0)
  → Worker increments tasksProcessed counter
  → Queue depth decreases

Task Execution → Failure Path (transient):
  retryCount++
  if retryCount < maxRetries:
    updateTask(status=pending, retryCount, metadata={error, backoffDelayMs})
    → Worker waits backoffDelayMs before re-queuing
    → Queue depth stays same, task gets retried
  if retryCount >= maxRetries:
    moveToDeadLetter(failureReason)
    → Worker increments tasksDeadLettered counter
    → Task moves to DLQ, visible to operators

Task Execution → Poison Job Path:
  Same transient failure path, but task consistently fails
  After 3 retries: moved to DLQ with stored failure reason
  Operator can: delete, re-enqueue with modified payload, or investigate
```