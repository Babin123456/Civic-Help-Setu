# Distributed Civic Task Queue - Deployment Guide

## Prerequisites

### Firebase Project Setup
1. Create a Firebase project in the Google Cloud Console
2. Enable Firestore in `native` mode (recommended) or `datastore` mode
3. Set up Firebase Authentication (Email/Password, Google, or Phone)
4. Configure Firestore Security Rules (see below)
5. Download `firebaseConfig` and place it at `api/_lib/firebaseConfig.js`

### Repository Setup
```bash
# Install dependencies
npm install

# Verify Firestore emulator (optional, for local development)
npm run rules:test

# Run type checks / lint
npm run lint
```

### Environment Configuration
Create a `.env.local` file (or add to existing env vars):

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id

# Task Queue Configuration
TASK_QUEUE_MAX_WORKERS=3
TASK_QUEUE_AGING_INTERVAL_MS=1800000  # 30 minutes
TASK_QUEUE_DEFAULT_PRIORITY=NORMAL  # NORMAL, HIGH, CRITICAL
TASK_QUEUE_MAX_RETRIES=3
TASK_QUEUE_BACKOFF_BASE_MS=1000
TASK_QUEUE_BACKOFF_MAX_MS=30000

# Quota Configuration (per tenant, adjustable per deployment)
TASK_QUEUE_MAX_CONCURRENT_PER_TENANT=5
TASK_QUEUE_MAX_JOBS_PER_HOUR=100
TASK_QUEUE_MAX_JOBS_PER_DAY=1000

# Feature Flag (enable/disable task queue)
FEATURE_TASK_QUEUE_ENABLED=true
```

## Firestore Security Rules

Deploy these rules to your Firebase project:

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Get the user's assigned jurisdiction from auth claims
    function getUserJurisdiction(auth) {
      return auth.token.jurisdiction || auth.token.tenant || null;
    }
    
    function isAuthenticated(auth) {
      return auth != null;
    }
    
    function isOperator(auth) {
      return auth.token.role === 'operator' || auth.token.role === 'admin';
    }
    
    function isValidTaskType(type) {
      return type in ['grievance-classification', 'ocr-processing'];
    }
    
    /****************************************
     * Task Queue Collection Rules
     ****************************************/
    
    match /task_queue/{docId} {
      
      // ------- CREATE: Enqueue a new task -------
      create {
        allow create: if isAuthenticated(request.auth)
                      && getUserJurisdiction(request.auth) == request.resource.data.tenantId
                      && isValidTaskType(request.resource.data.type)
                      && request.resource.data.type is string
                      && request.resource.data.payload is map
                      && request.resource.data.priority >= 1
                      && request.resource.data.priority <= 4;
        
        // Post-create: ensure tenantId is set correctly
        // (enforced by the create-time check above)
      }
      
      // ------- READ: Read tasks -------
      read {
        allow read: if isAuthenticated(request.auth)
                    && (getUserJurisdiction(request.auth) == resource.data.tenantId
                        || isOperator(request.auth));
      }
      
      // ------- UPDATE: Worker claims, status updates -------
      update {
        allow update: if isAuthenticated(request.auth)
                      && (isOperator(request.auth)
                          || (getUserJurisdiction(request.auth) == resource.data.tenantId
                              && !request.resource.data.status changes to processing
                              && !request.resource.data.status changes to completed));
        
        // Workers can claim tasks (set status to processing)
        // Only if they are authorized for the tenant
        // Admin/operators have full update capability
      }
      
      // ------- DELETE: Remove tasks (operators only) -------
      delete {
        allow delete: if isOperator(request.auth);
      }
    }
    
    /****************************************
     * Dead-letter Queue Notes
     ****************************************/
    // Dead-letter tasks have status=dead_letter and are filtered out
    // of normal query operations (getPendingTasks excludes them).
    // Operators can view DLQ via special admin endpoint or direct Firestore query.
  }
}
```

## Installation Steps

### 1. Add Task Queue Module to Project
```bash
# The task queue is already included in the src/tasks/ directory
# No separate installation needed - it's part of the monorepo

# Verify the module is importable:
cd /Users/divya/Documents/Civic-Help-Setu
node -e "import('./src/tasks/index.js').then(m => console.log('Module loaded:', Object.keys(m).join(', ')))"
```

### 2. Deploy Firestore Security Rules
```bash
firebase deploy --only firestore:rules
# Or using the rules file:
firebase firestore:rules --file firestore.rules
```

### 3. Start the Development Server
```bash
npm run dev
# or
vite
```

### 4. Initialize the Scheduler (one-time or via cron)
The task queue scheduler can be started in several ways:

**Option A: One-time script (for deployment scripts)**
```bash
node -e "
import { createScheduler, getQueueStats } from './src/tasks/index.js';
async function init() {
  const scheduler = createScheduler({
    maxWorkers: 3,
    tenantId: 'municipality-5',
  });
  await scheduler.start();
  const stats = await getQueueStats();
  console.log('Initial queue stats:', stats);
  scheduler.stop();
}
init();
"
```

**Option B: Via Vercel Cron Function**
Add a cron endpoint in `api/` that triggers the scheduler:
```javascript
// api/cron/task-queue.js
import { createScheduler } from '../../src/tasks/scheduler/scheduler.js';

export default async function handler(req, res) {
  const scheduler = createScheduler({
    maxWorkers: Number(req.query.workers || 3),
  });
  await scheduler.start();
  // Run for one cycle, then stop
  scheduler.stop();
  res.json({ status: 'task-queue-cycle-completed' });
}
```

**Option C: Via Node Script in package.json**
Add to `package.json` scripts:
```json
"scripts": {
  "task-queue:start": "node -e \"import('./src/tasks/index.js').then(m => { const s = m.createScheduler({maxWorkers: 3}); s.start(); setTimeout(() => { s.stop(); process.exit(0); }, 5000); })\""
}
```

### 5. Verify Deployment
```bash
# Test enqueue Task
curl -X POST https://your-app.vercel.app/api/task-queue/enqueue \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"grievance-classification","payload":{"grievanceText":"Pothole on Main Street"}}'

# Test queue stats
curl https://your-app.vercel.app/api/task-queue/stats \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN"
```

## Migration Guide

### From Legacy In-memory Queue (if applicable)
If your deployment previously used an in-memory task queue:

1. **Export existing tasks** (if any):
   ```bash
   # Export all tasks from previous system
   firebase firestore:export ./export-tasks.json
   ```

2. **Migrate tasks to new Firestore queue**:
   ```javascript
   // migration-script.js
   import { db } from './api/_lib/firebaseAdmin.js';
   import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
   
   async function migrate() {
     const col = collection(db, 'legacy_tasks');
     const snapshot = await getDocs(col);
     
     const taskCol = collection(db, 'task_queue');
     const batch = writeBatch(db);
     
     snapshot.forEach(doc => {
       const data = doc.data();
       const newTask = {
         type: data.type,
         tenantId: data.tenantId,
         priority: data.priority || 2,
         status: 'pending',
         payload: data.payload,
         metadata: { migratedFrom: 'legacy-system', migratedAt: new Date().toISOString() },
         retryCount: 0,
         maxRetries: 3,
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
         agingInfo: {
           queuedAt: new Date().toISOString(),
           lastPromotionAt: new Date().toISOString(),
         },
         deadLetterInfo: {
           movedToDeadLetter: false,
           failureReason: null,
         },
         _schemaVersion: '1.0.0',
       };
       
       const newDocRef = doc(taskCol); // Let Firestore generate ID
       batch.set(newDocRef, newTask);
     });
     
     await batch.commit();
     console.log(`Migrated ${snapshot.size} tasks to new queue`);
   }
   
   migrate().catch(console.error);
   ```

3. **Update code to use new queue**:
   - Replace `enqueueTask()` calls with new Firestore-backed `enqueueTask()`
   - Update worker processes to use `TaskWorker` instead of custom logic
   - Update UI to use `getQueueStats()` for monitoring

4. **Update Security Rules**:
   - Deploy new Firestore rules (see above)
   - Update existing rules to accommodate new document structure

5. **Rollback Plan**:
   - Feature flag `FEATURE_TASK_QUEUE_ENABLED` can be set to `false`
   - When disabled, fall back to direct service calls
   - Existing tasks remain in Firestore; can be re-migrated if needed
   - No data loss expected since tasks are idempotent

### 3. Configuration Updates
To adjust quotas or aging policy without code changes:

1. **Environment variables** (in `.env.local` or Vercel dashboard):
   - `TASK_QUEUE_MAX_CONCURRENT_PER_TENANT`
   - `TASK_QUEUE_MAX_JOBS_PER_HOUR`
   - `TASK_QUEUE_MAX_JOBS_PER_DAY`
   - `TASK_QUEUE_AGING_INTERVAL_MS`
   - `TASK_QUEUE_DEFAULT_PRIORITY`

2. **Runtime configuration** (via admin API):
   ```javascript
   import { checkTenantQuota } from './src/tasks/queries/taskQueries.js';
   // Quotas are checked per-operation; update database config tables
   // or environment vars and redeploy
   ```

## Rollback Procedures

### Emergency Rollback
If the task queue is causing issues:

1. **Disable feature flag**: Set `FEATURE_TASK_QUEUE_ENABLED=false` in environment
2. **Redeploy**: `vercel --prod` or `npm run build && npx vercel`
3. **Fall back**: All task submissions route to direct service calls
4. **Drain queue**: Existing tasks continue processing; new tasks go to direct path
5. **Investigate**: Review logs, export problematic data, fix root cause

### Partial Rollback (specific features)
- **Disable aging policy**: Set `TASK_QUEUE_AGING_INTERVAL_MS` to `0` or a very large value
- **Reduce worker count**: Lower `TASK_QUEUE_MAX_WORKERS` 
- **Tighten quotas**: Lower quota environment variables

### Data Preservation
- All tasks remain in Firestore during rollback
- No task data is deleted unless explicitly purged
- Task queue metadata (`_schemaVersion`, `createdAt`, etc.) preserved
- Can re-enable feature flag later; tasks resume from where they left off

## Cost Monitoring

### Firestore Operations (approximate per 1M tasks)
| Operation | Cost (USD) |
|-----------|-----------|
| Document writes (enqueue) | ~$1.20 |
| Document reads (getPendingTasks) | ~$0.80 |
| Document updates (retry/DLQ) | ~$1.20 |
| **Total per 1M tasks** | **~$3.20** |

### Expected Workload
- **Small deployment**: < 100 tasks/day, <$0.10/day
- **Medium deployment**: < 1000 tasks/day, <$1.00/day
- **Large deployment**: < 10000 tasks/day, ~$3.00/day

### Monitoring Commands
```bash
# Check current queue depth and metrics
curl https://your-app.vercel.app/api/task-queue/stats \
  -H "Authorization: Bearer $TOKEN"

# Export metrics for analysis
node -e "
import { getQueueStats } from './src/tasks/index.js';
getQueueStats().then(stats => {
  console.log(JSON.stringify(stats, null, 2));
});
"
```

## Troubleshooting

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Tasks not being picked up | Workers not running | Start scheduler `node task-queue:start` |
| All tasks go to dead-letter | Handler errors | Check handler logs, fix payload format |
| Quota errors for legitimate tenants | Quota too tight | Increase `TASK_QUEUE_MAX_*` env vars |
| Priority ordering wrong | Aging not running | Check aging interval, ensure scheduler running |
| Firestore security errors | Rules not deployed | `firebase deploy --only firestore:rules` |
| High latency on queue ops | Firestore throughput | Use batch operations, check quotas |
| Tasks processed twice | Claim duration too short | Increase CLAIM_DURATION_MS in taskProcessor.js |

### Logs and Monitoring
- **Structured logging**: All queue operations log with `taskId`, `workerId`, `status`
- **Metrics endpoint**: `GET /api/task-queue/stats` returns JSON with:
  - `pending`, `completed`, `failed`, `deadLetter` counts
  - `byPriority` breakdown
  - `total` task count
- **Health check**: `GET /api/task-queue/health` returns `ok` or error details
- **DLQ review**: Query `status=dead_letter` documents for operator review

### Debug Mode
Set `NODE_ENV=development` for detailed error stacks and additional logging.
In production, errors are sanitized to avoid exposing internal details.
```