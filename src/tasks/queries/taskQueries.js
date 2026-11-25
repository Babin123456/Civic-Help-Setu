/**
 * @file Task queue Firestore queries and mutations
 * 
 * All Firestore interactions are centralized here for testability and
 * separation of concerns. Input validation is performed at the schema level
 * before any database operations.
 * 
 * @version 1.0.0
 */

import { db } from '../_lib/firebaseAdmin.js';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  writeBatch,
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';

// Collection name for the task queue
const TASK_COLLECTION = 'task_queue';

/**
 * Adds a new task to the queue
 * @param {object} task - Task object (as created by createTask)
 * @returns {Promise<string>} The task ID
 * @throws {Error} If the task fails validation or Firestore operation fails
 */
export async function enqueueTask(task) {
  // Validate the task schema
  const validated = task.validateTask
    ? task.validateTask()
    : validateTask(task);

  const taskData = toFirestore(task);

  try {
    const docRef = await addDoc(collection(db, TASK_COLLECTION), {
      ...taskData,
      _createdAt: serverTimestamp(),
      _updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Failed to enqueue task:', error);
    throw new Error(`Failed to enqueue task: ${error.message}`);
  }
}

/**
 * Gets all pending tasks, ordered by effective priority (high first) and then
 * by creation time (oldest first within same priority).
 * 
 * @param {object} [options] - Query options
 * @param {string} [options.tenantId] - Filter by tenant ID (for per-tenant quotas)
 * @param {number} [options.limit] - Maximum number of tasks to return
 * @param {TaskPriority} [options.minPriority] - Only return tasks at or above this priority
 * @returns {Promise<Array<object>>} Array of task documents
 */
export async function getPendingTasks({ tenantId, limit = 50, minPriority = TaskPriority.LOW } = {}) {
  const colRef = collection(db, TASK_COLLECTION);

  // Build query constraints
  const constraints = [
    where('status', '==', TaskStatus.PENDING),
    where('priority', '>=', minPriority), // Higher number = higher priority
  ];

  // Filter by tenant if specified
  if (tenantId) {
    constraints.push(where('tenantId', '===', tenantId));
  }

  // Order by effective priority (descending), then by createdAt (ascending)
  // Note: Firestore composite query limitation - we order by priority first,
  // then we'll sort by creation time in JS for same-priority tasks
  constraints.push(orderBy('priority', 'desc'));

  if (limit) {
    constraints.push(limit(limit));
  }

  const q = query(colRef, ...constraints);

  try {
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(doc => fromFirestore({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort within same priority by creation time (FIFO)
    // Firestore orderBy('priority', 'desc') groups by priority,
    // but within each priority group, we need to sort by createdAt
    tasks.sort((a, b) => {
      // First compare by effective priority (higher first)
      const effA = computeEffectivePriority(a);
      const effB = computeEffectivePriority(b);
      if (effA !== effB) return effB - effA;

      // Same effective priority - sort by createdAt (older first)
      const createdA = new Date(a.createdAt).getTime();
      const createdB = new Date(b.createdAt).getTime();
      return createdA - createdB;
    });

    return tasks;
  } catch (error) {
    console.error('Failed to fetch pending tasks:', error);
    throw new Error(`Failed to fetch pending tasks: ${error.message}`);
  }
}

/**
 * Gets a single task by ID
 * @param {string} taskId - The task ID
 * @returns {Promise<object>} The task document
 * @throws {Error} If the task is not found
 */
export async function getTaskById(taskId) {
  if (!taskId || typeof taskId !== 'string') {
    throw new TypeError('Task ID must be a string');
  }

  const docRef = doc(db, TASK_COLLECTION, taskId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    throw new Error(`Task not found: ${taskId}`);
  }

  return fromFirestore({
    id: snap.id,
    ...snap.data(),
  });
}

/**
 * Updates a task's status and metadata
 * @param {string} taskId - The task ID
 * @param {object} updates - Updates to apply (status, retryCount, etc.)
 * @param {TaskStatus} [updates.status] - New status
 * @param {number} [updates.retryCount] - New retry count
 * @param {string} [updates.failureReason] - Failure reason (for dead-letter)
 * @param {object} [updates.metadata] - Additional metadata to merge
 * @returns {Promise<void>}
 * @throws {Error} If the update fails
 */
export async function updateTask(taskId, updates) {
  if (!taskId || typeof taskId !== 'string') {
    throw new TypeError('Task ID must be a string');
  }

  const updatesWithTimestamp = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const docRef = doc(db, TASK_COLLECTION, taskId);

  try {
    await updateDoc(docRef, updatesWithTimestamp);
  } catch (error) {
    console.error(`Failed to update task ${taskId}:`, error);
    throw new Error(`Failed to update task: ${error.message}`);
  }
}

/**
 * Moves a task to the dead-letter queue
 * @param {string} taskId - The task ID
 * @param {string} failureReason - Reason for dead-lettering
 * @returns {Promise<void>}
 */
export async function moveToDeadLetter(taskId, failureReason) {
  if (!taskId || typeof taskId !== 'string') {
    throw new TypeError('Task ID must be a string');
  }
  if (!failureReason || typeof failureReason !== 'string') {
    throw new TypeError('Failure reason must be a string');
  }

  await updateTask(taskId, {
    status: TaskStatus.DEAD_LETTER,
    retryCount: MAX_RETRIES, // Mark as having reached max retries
    failureReason,
    deadLetterInfo: {
      movedToDeadLetter: true,
      failureReason,
    },
  });
}

/**
 * Batch enqueues multiple tasks atomically
 * @param {Array<object>} tasks - Array of task objects to enqueue
 * @returns {Promise<Array<string>>} Array of task IDs
 * @throws {Error} If any task fails validation or the batch fails
 */
export async function batchEnqueueTasks(tasks) {
  if (!Array.isArray(tasks)) {
    throw new TypeError('Tasks must be an array');
  }
  if (tasks.length === 0) {
    return [];
  }

  const batch = writeBatch(db);
  const taskIds = [];

  for (const task of tasks) {
    // Validate each task
    validateTask(task);

    const taskData = toFirestore(task);
    const docRef = doc(db, TASK_COLLECTION, uuidv4());
    batch.set(docRef, {
      ...taskData,
      _createdAt: serverTimestamp(),
      _updatedAt: serverTimestamp(),
    });
    taskIds.push(docRef.id);
  }

  try {
    await batch.commit();
    return taskIds;
  } catch (error) {
    console.error('Failed to batch enqueue tasks:', error);
    throw new Error(`Failed to batch enqueue tasks: ${error.message}`);
  }
}

/**
 * Counts pending tasks, optionally filtered by tenant
 * @param {string} [tenantId] - Optional tenant ID filter
 * @returns {Promise<number>} Count of pending tasks
 */
export async function countPendingTasks({ tenantId } = {}) {
  const colRef = collection(db, TASK_COLLECTION);

  const constraints = [
    where('status', '==', TaskStatus.PENDING),
  ];

  if (tenantId) {
    constraints.push(where('tenantId', '===', tenantId));
  }

  const q = query(colRef, ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Failed to count pending tasks:', error);
    throw new Error(`Failed to count pending tasks: ${error.message}`);
  }
}

/**
 * Checks if a tenant is within its quota limits
 * @param {string} tenantId - The tenant ID to check
 * @param {object} [options] - Quota check options
 * @param {number} [options.maxPerHour] - Override default max jobs per hour
 * @param {number} [options.maxPerDay] - Override default max jobs per day
 * @param {number} [options.maxConcurrent] - Override default max concurrent jobs
 * @returns {Promise<boolean>} Whether the tenant is within quota
 * @throws {Error} If the check fails
 */
export async function checkTenantQuota(tenantId, { maxPerHour, maxPerDay, maxConcurrent } = {}) {
  const now = new Date();

  // Check concurrent jobs
  if (maxConcurrent !== undefined) {
    const concurrentRef = collection(db, TASK_COLLECTION);
    const concurrentQ = query(
      concurrentRef,
      where('tenantId', '===', tenantId),
      where('status', 'in', [TaskStatus.PENDING, TaskStatus.PROCESSING])
    );
    const concurrentSnap = await getDocs(concurrentQ);
    if (concurrentSnap.size >= maxConcurrent) {
      return false;
    }
  }

  // Check jobs per hour
  if (maxPerHour !== undefined) {
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourlyRef = collection(db, TASK_COLLECTION);
    const hourlyQ = query(
      hourlyRef,
      where('tenantId', '===', tenantId),
      where('createdAt', '>=', hourAgo.toISOString()),
      where('status', 'in', [TaskStatus.PENDING, TaskStatus.PROCESSING, TaskStatus.COMPLETED])
    );
    const hourlySnap = await getDocs(hourlyQ);
    const hourlyCount = hourlySnap.size;
    if (hourlyCount >= maxPerHour) {
      return false;
    }
  }

  // Check jobs per day
  if (maxPerDay !== undefined) {
    const dayStart = new Date(now.setHours(0, 0, 0, 0));
    const dailyRef = collection(db, TASK_COLLECTION);
    const dailyQ = query(
      dailyRef,
      where('tenantId', '===', tenantId),
      where('createdAt', '>=', dayStart.toISOString())
    );
    const dailySnap = await getDocs(dailyQ);
    const dailyCount = dailySnap.size;
    if (dailyCount >= maxPerDay) {
      return false;
    }
  }

  return true;
}

/**
 * Gets stats for the task queue - used for observability
 * @param {object} [options] - Stats options
 * @param {string} [options.tenantId] - Optional tenant ID filter
 * @returns {Promise<object>} Queue statistics
 */
export async function getQueueStats({ tenantId } = {}) {
  const colRef = collection(db, TASK_COLLECTION);

  // Build base query
  const baseConstraints = [
    where('status', '!=', TaskStatus.DEAD_LETTER), // Exclude DLQ from active counts
  ];

  // Add tenant filter if specified
  if (tenantId) {
    baseConstraints.push(where('tenantId', '===', tenantId));
  }

  const baseQ = query(colRef, ...baseConstraints);

  // Count by status
  const statusConstraints = [...baseConstraints, where('status', '==', TaskStatus.PENDING)];
  const pendingQ = query(colRef, ...statusConstraints);
  const pendingSnap = await getDocs(pendingQ);
  const pendingCount = pendingSnap.size;

  // Count completed
  const statusConstraints2 = [...baseConstraints, where('status', '==', TaskStatus.COMPLETED)];
  const completedQ = query(colRef, ...statusConstraints2);
  const completedSnap = await getDocs(completedQ);
  const completedCount = completedSnap.size;

  // Count failed
  const statusConstraints3 = [...baseConstraints, where('status', '==', TaskStatus.FAILED)];
  const failedQ = query(colRef, ...statusConstraints3);
  const failedSnap = await getDocs(failedQ);
  const failedCount = failedSnap.size;

  // Count dead-letter
  const statusConstraints4 = [...baseConstraints, where('status', '==', TaskStatus.DEAD_LETTER)];
  const dlQ = query(colRef, ...statusConstraints4);
  const dlSnap = await getDocs(dlQ);
  const dlCount = dlSnap.size;

  // Count by priority
  const priorityCounts = {};
  for (const pri of Object.values(TaskPriority)) {
    const priQ = query(colRef, ...baseConstraints, where('priority', '===', pri));
    const priSnap = await getDocs(priQ);
    priorityCounts[pri] = priSnap.size;
  }

  // Total active (pending + processing)
  const activeConstraints = [...baseConstraints, where('status', '!=', TaskStatus.COMPLETED), where('status', '!=', TaskStatus.DEAD_LETTER)];
  const activeQ = query(colRef, ...activeConstraints);
  const activeSnap = await getDocs(activeQ);
  const activeCount = activeSnap.size;

  return {
    pending: pendingCount,
    completed: completedCount,
    failed: failedCount,
    deadLetter: dlCount,
    active: activeCount,
    byPriority: priorityCounts,
    total: pendingCount + completedCount + failedCount + dlCount,
  };
}