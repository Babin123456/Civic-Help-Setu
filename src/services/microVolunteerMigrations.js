/**
 * Persistence, schema migration, indexing and rollback for the Civic
 * Micro-Volunteer Task Board (#759).
 *
 * All five domain collections, the category reference table and deterministic
 * recommendation runs live in one JSON bundle. A single storage key makes a
 * multi-record change atomic: the new bundle replaces the old one only after
 * the mutator returns without throwing.
 *
 * The same API accepts an injected storage adapter. The browser page uses
 * localStorage; the serverless handler and tests use an isolated memory adapter.
 */

import {
  CLAIM_STATUS,
  COMPLETION_STATUS,
  MICRO_VOLUNTEER_ERROR_CODES,
  MICRO_VOLUNTEER_SCHEMA_VERSION,
  MICRO_VOLUNTEER_STORAGE_KEY,
  RECOMMENDATION_STATUS,
  TASK_CATEGORY_DEFINITIONS,
  TASK_CATEGORY_IDS,
  TASK_STATUS,
  isoDateOnly,
  isClaimStatus,
  isCompletionStatus,
  isTaskStatus,
  isValidId,
} from '../data/microVolunteerContract.js';
import { MicroVolunteerError } from './microVolunteerValidation.js';
import { logDiagnostic } from '../utils/diagnostics.js';
import {
  SEED_COMPLETION_SUBMISSIONS,
  SEED_MICRO_TASKS,
  SEED_MODERATION_EVENTS,
  SEED_TASK_CLAIMS,
} from '../data/microVolunteerSeed.js';

const memoryFallback = new Map();

export const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
};

const resolveStorage = (storage) => {
  if (
    storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function'
  ) {
    return storage;
  }
  return null;
};

const browserStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  } catch {
    return null;
  }
  return null;
};

export const getMicroVolunteerStorageMode = (storage = null) => {
  if (resolveStorage(storage)) return 'injected';
  return browserStorage() ? 'browser' : 'memory';
};

const safeGetItem = (key, storage) => {
  const custom = resolveStorage(storage);
  if (custom) {
    try {
      return custom.getItem(key);
    } catch {
      return memoryFallback.get(key) || null;
    }
  }
  const browser = browserStorage();
  if (browser) {
    try {
      return browser.getItem(key);
    } catch {
      // Fall through to memory.
    }
  }
  return memoryFallback.get(key) || null;
};

const safeSetItem = (key, value, storage) => {
  const custom = resolveStorage(storage);
  if (custom) {
    custom.setItem(key, value);
    return true;
  }
  const browser = browserStorage();
  if (browser) {
    try {
      browser.setItem(key, value);
      return true;
    } catch {
      memoryFallback.set(key, value);
      return false;
    }
  }
  memoryFallback.set(key, value);
  return true;
};

const safeRemoveItem = (key, storage) => {
  const custom = resolveStorage(storage);
  if (custom && typeof custom.removeItem === 'function') {
    custom.removeItem(key);
  } else {
    const browser = browserStorage();
    if (browser) {
      try {
        browser.removeItem(key);
      } catch {
        // Ignore.
      }
    }
  }
  memoryFallback.delete(key);
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = (now) => (now instanceof Date ? now.toISOString() : new Date(now || Date.now()).toISOString());
const dateOnly = (now) => isoDateOnly(now instanceof Date ? now : new Date(now || Date.now()));

const normaliseCategory = (category, index) => {
  const fallback = TASK_CATEGORY_DEFINITIONS[index % TASK_CATEGORY_DEFINITIONS.length];
  const id = category?.id && TASK_CATEGORY_IDS.includes(category.id) ? category.id : fallback.id;
  const base = TASK_CATEGORY_DEFINITIONS.find((item) => item.id === id) || fallback;
  return {
    ...base,
    ...category,
    id,
    label: category?.label || base.label,
    description: category?.description || base.description,
    defaultInstructions: category?.defaultInstructions || base.defaultInstructions,
    defaultEvidenceRequirements: Array.isArray(category?.defaultEvidenceRequirements)
      ? category.defaultEvidenceRequirements
      : base.defaultEvidenceRequirements,
    estimatedMinutesRange:
      Array.isArray(category?.estimatedMinutesRange) && category.estimatedMinutesRange.length === 2
        ? category.estimatedMinutesRange
        : base.estimatedMinutesRange,
    riskLevel: category?.riskLevel || base.riskLevel,
    safetyNote: category?.safetyNote || base.safetyNote,
    schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
  };
};

const normaliseCategories = (input) => {
  const source = Array.isArray(input) ? input : [];
  const byId = new Map();
  source.forEach((category, index) => {
    const normalised = normaliseCategory(category, index);
    byId.set(normalised.id, normalised);
  });
  TASK_CATEGORY_DEFINITIONS.forEach((category) => {
    if (!byId.has(category.id)) byId.set(category.id, normaliseCategory(category, 0));
  });
  return [...byId.values()];
};

export const createEmptyBoard = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    seeded: false,
    migrationHistory: [],
    warnings: [],
  },
  taskCategories: normaliseCategories([]),
  tasks: [],
  claims: [],
  submissions: [],
  moderationEvents: [],
  recommendationRuns: [],
});

export const createSeedBoard = ({ now = new Date().toISOString() } = {}) => ({
  schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  meta: {
    schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
    migratedAt: now,
    lastSavedAt: now,
    seeded: true,
    migrationHistory: [
      { from: 0, to: MICRO_VOLUNTEER_SCHEMA_VERSION, appliedAt: now, kind: 'seed' },
    ],
    warnings: [],
  },
  taskCategories: normaliseCategories([]),
  tasks: clone(SEED_MICRO_TASKS),
  claims: clone(SEED_TASK_CLAIMS),
  submissions: clone(SEED_COMPLETION_SUBMISSIONS),
  moderationEvents: clone(SEED_MODERATION_EVENTS),
  recommendationRuns: [],
});

export const BOARD_COLLECTIONS = Object.freeze([
  'taskCategories',
  'tasks',
  'claims',
  'submissions',
  'moderationEvents',
  'recommendationRuns',
]);

export const isValidBoardShape = (data) =>
  Boolean(
    data &&
      typeof data === 'object' &&
      data.schemaVersion === MICRO_VOLUNTEER_SCHEMA_VERSION &&
      data.meta &&
      typeof data.meta === 'object' &&
      BOARD_COLLECTIONS.every((key) => Array.isArray(data[key]))
  );

const requireTaskId = (task, index) => {
  if (task && typeof task.id === 'string' && task.id.trim()) return task.id.trim();
  return `mvt_legacy_${index + 1}`;
};

const publicRefFor = (record, prefix, index) => {
  const value = typeof record?.publicRef === 'string' ? record.publicRef : '';
  if (/^(?:MVT|MVC|MVS|MVE|REC)-[A-Z0-9-]{3,40}$/.test(value)) return value;
  return `${prefix}-LEGACY-${String(index + 1).padStart(3, '0')}`;
};

/**
 * Upgrade the pre-#759 prototype shape (`micro_tasks`, `task_claims`,
 * `completion_submissions`, `moderation_events`) without dropping records.
 * Unknown enum values are coerced to a safe, visible state and reported as
 * migration warnings instead of disappearing silently.
 */
export const migrateMicroVolunteerData = (legacy, { now = new Date().toISOString() } = {}) => {
  if (!legacy || typeof legacy !== 'object') {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.MIGRATION_FAILED,
      'The saved board is not an object and cannot be upgraded safely.'
    );
  }
  if (isValidBoardShape(legacy)) {
    return { data: legacy, migrated: false, historyEntry: null, warnings: [] };
  }

  const warnings = [];
  const fromVersion = Number(legacy.schemaVersion ?? legacy.version ?? 0);
  const categories = normaliseCategories(
    legacy.taskCategories || legacy.task_categories || legacy.categories || []
  );

  const rawTasks = legacy.tasks || legacy.microTasks || legacy.micro_tasks || [];
  const tasks = (Array.isArray(rawTasks) ? rawTasks : []).map((task, index) => {
    const id = requireTaskId(task, index);
    let status = task.status || task.taskStatus || TASK_STATUS.OPEN;
    if (!isTaskStatus(status)) {
      warnings.push(`Task ${id} had unknown status "${status}"; set to open.`);
      status = TASK_STATUS.OPEN;
    }
    const dueDate =
      typeof task.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
        ? task.dueDate
        : (() => {
            const date = new Date(now);
            date.setUTCDate(date.getUTCDate() + 30);
            return isoDateOnly(date);
          })();
    return {
      id,
      publicRef: publicRefFor(task, 'MVT', index),
      title: task.title || `Legacy micro-task ${index + 1}`,
      categoryId: TASK_CATEGORY_IDS.includes(task.categoryId) ? task.categoryId : 'public_information_verification',
      jurisdictionId: String(task.jurisdictionId || task.ward || 'WARD-042').toUpperCase(),
      locality: task.locality || task.ward || 'Unassigned locality',
      instructions: task.instructions || task.description || 'Legacy task instructions were not recorded.',
      timeEstimateMinutes: Number(task.timeEstimateMinutes) || 15,
      dueDate,
      capacity: Math.max(1, Math.min(20, Number(task.capacity) || 1)),
      status,
      evidenceRequirements:
        Array.isArray(task.evidenceRequirements) && task.evidenceRequirements.length
          ? task.evidenceRequirements
          : ['Describe what was completed'],
      safetyNote: task.safetyNote || 'Complete the task from a safe public place.',
      source: task.source || 'Legacy volunteer board',
      safetyAcknowledgements: task.safetyAcknowledgements || {
        no_private_data: true,
        no_enforcement: true,
        no_unsafe_activity: true,
        separate_from_official_application: true,
      },
      createdBy: task.createdBy || 'legacy.migration',
      createdAt: task.createdAt || now,
      updatedAt: task.updatedAt || now,
      archivedAt: task.archivedAt || null,
      schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
    };
  });

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const rawClaims = legacy.claims || legacy.taskClaims || legacy.task_claims || [];
  const claims = (Array.isArray(rawClaims) ? rawClaims : []).map((claim, index) => {
    let status = claim.status || CLAIM_STATUS.ACTIVE;
    if (!isClaimStatus(status)) {
      warnings.push(`Claim ${claim.id || index} had unknown status "${status}"; set to active.`);
      status = CLAIM_STATUS.ACTIVE;
    }
    const taskId = claim.taskId || tasks[0]?.id || 'mvt_legacy_1';
    if (!taskById.has(taskId)) {
      warnings.push(`Claim ${claim.id || index} referenced missing task ${taskId}; kept for audit.`);
    }
    return {
      id: claim.id || `mvc_legacy_${index + 1}`,
      publicRef: publicRefFor(claim, 'MVC', index),
      taskId,
      taskPublicRef: claim.taskPublicRef || taskById.get(taskId)?.publicRef || 'MVT-LEGACY-001',
      citizenId: claim.citizenId || claim.actorId || 'legacy.contributor',
      jurisdictionId: String(claim.jurisdictionId || taskById.get(taskId)?.jurisdictionId || 'WARD-042').toUpperCase(),
      status,
      idempotencyKey: claim.idempotencyKey || `legacy-claim-${index + 1}`,
      createdAt: claim.createdAt || now,
      updatedAt: claim.updatedAt || now,
      schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
    };
  });

  const rawSubmissions =
    legacy.submissions || legacy.completionSubmissions || legacy.completion_submissions || [];
  const submissions = (Array.isArray(rawSubmissions) ? rawSubmissions : []).map((submission, index) => {
    let status = submission.status || COMPLETION_STATUS.SUBMITTED;
    if (!isCompletionStatus(status)) {
      warnings.push(`Submission ${submission.id || index} had unknown status "${status}"; set to submitted.`);
      status = COMPLETION_STATUS.SUBMITTED;
    }
    const claimId = submission.claimId || claims[0]?.id || null;
    const claim = claims.find((item) => item.id === claimId);
    return {
      id: submission.id || `mvs_legacy_${index + 1}`,
      publicRef: publicRefFor(submission, 'MVS', index),
      taskId: submission.taskId || claim?.taskId || tasks[0]?.id || 'mvt_legacy_1',
      taskPublicRef: submission.taskPublicRef || claim?.taskPublicRef || 'MVT-LEGACY-001',
      claimId,
      claimPublicRef: submission.claimPublicRef || claim?.publicRef || null,
      citizenId: submission.citizenId || claim?.citizenId || 'legacy.contributor',
      jurisdictionId: String(
        submission.jurisdictionId || claim?.jurisdictionId || 'WARD-042'
      ).toUpperCase(),
      status,
      note: submission.note || submission.evidenceNote || 'Legacy completion evidence.',
      link: submission.link || '',
      files: Array.isArray(submission.files) ? submission.files : [],
      publicOutcomeNote: submission.publicOutcomeNote || '',
      moderationReason: submission.moderationReason || '',
      moderatedByRole: submission.moderatedByRole || '',
      moderatedAt: submission.moderatedAt || null,
      idempotencyKey: submission.idempotencyKey || `legacy-submission-${index + 1}`,
      payloadHash: submission.payloadHash || `legacy-${index + 1}`,
      createdAt: submission.createdAt || now,
      updatedAt: submission.updatedAt || now,
      schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
    };
  });

  const rawEvents = legacy.moderationEvents || legacy.moderation_events || legacy.events || [];
  const moderationEvents = (Array.isArray(rawEvents) ? rawEvents : []).map((event, index) => ({
    id: event.id || `mve_legacy_${index + 1}`,
    taskId: event.taskId || null,
    taskPublicRef: event.taskPublicRef || null,
    claimId: event.claimId || null,
    submissionId: event.submissionId || null,
    action: event.action || 'legacy_event',
    actorRole: event.actorRole || 'system',
    actorRef: event.actorRef || 'legacy',
    reason: event.reason || '',
    details: event.details && typeof event.details === 'object' ? event.details : {},
    visibility: 'internal',
    createdAt: event.createdAt || now,
    schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
  }));

  const rawRuns = legacy.recommendationRuns || legacy.recommendation_runs || [];
  const recommendationRuns = (Array.isArray(rawRuns) ? rawRuns : []).map((run, index) => ({
    ...run,
    id: run.id || `rec_legacy_${index + 1}`,
    recommendations: Array.isArray(run.recommendations) ? run.recommendations : [],
    schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
  }));

  const historyEntry = {
    from: fromVersion,
    to: MICRO_VOLUNTEER_SCHEMA_VERSION,
    appliedAt: now,
    kind: 'upgrade',
  };

  const data = {
    schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
    createdAt: legacy.createdAt || now,
    updatedAt: now,
    meta: {
      schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      migratedAt: now,
      lastSavedAt: now,
      seeded: false,
      migrationHistory: [...(legacy.meta?.migrationHistory || []), historyEntry],
      warnings,
    },
    taskCategories: categories,
    tasks,
    claims,
    submissions,
    moderationEvents,
    recommendationRuns,
  };

  return { data, migrated: true, historyEntry, warnings };
};

const addToMapArray = (map, key, value) => {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

/**
 * Secondary indexes for the filters used by the board and moderation queue.
 * They are rebuilt after each transaction and never persisted as source data.
 */
export const buildMicroVolunteerIndexes = (data = {}) => {
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const claims = Array.isArray(data.claims) ? data.claims : [];
  const submissions = Array.isArray(data.submissions) ? data.submissions : [];
  const events = Array.isArray(data.moderationEvents) ? data.moderationEvents : [];
  const runs = Array.isArray(data.recommendationRuns) ? data.recommendationRuns : [];

  const tasksById = new Map();
  const tasksByPublicRef = new Map();
  const tasksByStatus = new Map();
  const tasksByCategory = new Map();
  const tasksByJurisdictionStatus = new Map();
  const tasksByJurisdiction = new Map();

  tasks.forEach((task) => {
    tasksById.set(task.id, task);
    if (task.publicRef) tasksByPublicRef.set(task.publicRef, task);
    addToMapArray(tasksByStatus, task.status, task);
    addToMapArray(tasksByCategory, task.categoryId, task);
    const jid = String(task.jurisdictionId || 'UNKNOWN').toUpperCase();
    addToMapArray(tasksByJurisdiction, jid, task);
    addToMapArray(tasksByJurisdictionStatus, `${jid}|${task.status}`, task);
  });

  const tasksSortedByCreatedAt = tasks
    .slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const claimsById = new Map();
  const claimsByPublicRef = new Map();
  const claimsByTask = new Map();
  const claimsByCitizen = new Map();
  const claimsByStatus = new Map();

  claims.forEach((claim) => {
    claimsById.set(claim.id, claim);
    if (claim.publicRef) claimsByPublicRef.set(claim.publicRef, claim);
    addToMapArray(claimsByTask, claim.taskId, claim);
    addToMapArray(claimsByCitizen, claim.citizenId, claim);
    addToMapArray(claimsByStatus, claim.status, claim);
  });

  const submissionsById = new Map();
  const submissionsByPublicRef = new Map();
  const submissionsByTask = new Map();
  const submissionsByClaim = new Map();
  const submissionsByStatus = new Map();
  const submissionsByCitizen = new Map();

  submissions.forEach((submission) => {
    submissionsById.set(submission.id, submission);
    if (submission.publicRef) submissionsByPublicRef.set(submission.publicRef, submission);
    addToMapArray(submissionsByTask, submission.taskId, submission);
    addToMapArray(submissionsByClaim, submission.claimId, submission);
    addToMapArray(submissionsByStatus, submission.status, submission);
    addToMapArray(submissionsByCitizen, submission.citizenId, submission);
  });

  const eventsByTask = new Map();
  events.forEach((event) => addToMapArray(eventsByTask, event.taskId, event));

  return {
    tasksById,
    tasksByPublicRef,
    tasksByStatus,
    tasksByCategory,
    tasksByJurisdiction,
    tasksByJurisdictionStatus,
    tasksSortedByCreatedAt,
    claimsById,
    claimsByPublicRef,
    claimsByTask,
    claimsByCitizen,
    claimsByStatus,
    submissionsById,
    submissionsByPublicRef,
    submissionsByTask,
    submissionsByClaim,
    submissionsByStatus,
    submissionsByCitizen,
    eventsByTask,
    recommendationRunsById: new Map(runs.map((run) => [run.id, run])),
  };
};

const loadRawBoard = ({ storage = null, now = new Date().toISOString() } = {}) => {
  const raw = safeGetItem(MICRO_VOLUNTEER_STORAGE_KEY, storage);
  if (!raw) {
    const seeded = createSeedBoard({ now });
    persistMicroVolunteerBoard(seeded, { storage, now });
    return { data: seeded, changed: true, source: 'seed' };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logDiagnostic('Corrupt micro-volunteer board storage; restoring the reviewed seed.', error);
    const seeded = createSeedBoard({ now });
    persistMicroVolunteerBoard(seeded, { storage, now });
    return { data: seeded, changed: true, source: 'recovered' };
  }

  if (isValidBoardShape(parsed)) {
    return { data: parsed, changed: false, source: 'stored' };
  }

  const migration = migrateMicroVolunteerData(parsed, { now });
  persistMicroVolunteerBoard(migration.data, { storage, now });
  return { data: migration.data, changed: true, source: 'migrated' };
};

export const loadMicroVolunteerBoard = ({ storage = null, now = new Date().toISOString() } = {}) => {
  const { data } = loadRawBoard({ storage, now });
  return { ...data, indexes: buildMicroVolunteerIndexes(data) };
};

export const ensureMicroVolunteerBoard = (options = {}) => loadMicroVolunteerBoard(options);

export const persistMicroVolunteerBoard = (data, { storage = null, now = new Date().toISOString() } = {}) => {
  if (!isValidBoardShape(data)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.MIGRATION_FAILED,
      'Refusing to save an incomplete board. Every normalized collection must be present.'
    );
  }
  const savedAt = nowIso(now);
  const next = {
    ...data,
    updatedAt: savedAt,
    meta: {
      ...data.meta,
      schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      lastSavedAt: savedAt,
    },
  };
  const serialised = JSON.stringify(next);
  if (!safeSetItem(MICRO_VOLUNTEER_STORAGE_KEY, serialised, storage)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.STORAGE_UNAVAILABLE,
      'The device could not save the board change. Free some browser storage and retry.'
    );
  }
  return next;
};

/**
 * Atomic multi-record write. Mutate the draft in the callback and return any
 * result; if the callback throws, the previous bundle is left untouched.
 */
export const runMicroVolunteerTransaction = (
  mutator,
  { storage = null, now = new Date().toISOString() } = {}
) => {
  if (typeof mutator !== 'function') {
    throw new TypeError('runMicroVolunteerTransaction needs a mutator function.');
  }
  const { data } = loadRawBoard({ storage, now });
  const draft = clone(data);
  const result = mutator(draft);
  const saved = persistMicroVolunteerBoard(draft, { storage, now });
  return {
    data: { ...saved, indexes: buildMicroVolunteerIndexes(saved) },
    result,
  };
};

export const rollbackMicroVolunteerStorage = ({ storage = null, now = new Date().toISOString() } = {}) => {
  safeRemoveItem(MICRO_VOLUNTEER_STORAGE_KEY, storage);
  const seeded = createSeedBoard({ now });
  persistMicroVolunteerBoard(seeded, { storage, now });
  return { ...seeded, indexes: buildMicroVolunteerIndexes(seeded) };
};

export const resetMicroVolunteerStorageToEmpty = ({ storage = null, now = new Date().toISOString() } = {}) => {
  safeRemoveItem(MICRO_VOLUNTEER_STORAGE_KEY, storage);
  const empty = createEmptyBoard({ now });
  persistMicroVolunteerBoard(empty, { storage, now });
  return { ...empty, indexes: buildMicroVolunteerIndexes(empty) };
};

const isOlderThan = (value, cutoffMs) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) && time < cutoffMs;
};

/**
 * Retention is deliberately conservative and documented in
 * docs/micro-volunteer-task-board.md:
 *  - completed tasks move to `archived` after 180 days;
 *  - citizen identifiers and evidence notes are redacted after 90 days;
 *  - withdrawn/expired claims are removed after 30 days (the audit event stays);
 *  - moderation events are retained for 730 days, then removed.
 */
export const applyMicroVolunteerRetentionPolicy = (
  {
    taskRetentionDays = 180,
    claimRetentionDays = 90,
    purgeStaleClaimsDays = 30,
    eventRetentionDays = 730,
    now = new Date().toISOString(),
  } = {},
  { storage = null } = {}
) => {
  const nowMs = new Date(now).getTime();
  const taskCutoff = nowMs - taskRetentionDays * 24 * 60 * 60 * 1000;
  const claimCutoff = nowMs - claimRetentionDays * 24 * 60 * 60 * 1000;
  const staleClaimCutoff = nowMs - purgeStaleClaimsDays * 24 * 60 * 60 * 1000;
  const eventCutoff = nowMs - eventRetentionDays * 24 * 60 * 60 * 1000;

  const { result } = runMicroVolunteerTransaction(
    (draft) => {
      const counts = {
        archivedTasks: 0,
        redactedClaims: 0,
        redactedSubmissions: 0,
        purgedClaims: 0,
        removedEvents: 0,
      };

      draft.tasks = draft.tasks.map((task) => {
        if (task.status === TASK_STATUS.COMPLETED && isOlderThan(task.updatedAt, taskCutoff)) {
          counts.archivedTasks += 1;
          return {
            ...task,
            status: TASK_STATUS.ARCHIVED,
            archivedAt: now,
            updatedAt: now,
          };
        }
        return task;
      });

      draft.claims = draft.claims
        .filter((claim) => {
          if (
            [CLAIM_STATUS.WITHDRAWN, CLAIM_STATUS.EXPIRED].includes(claim.status) &&
            isOlderThan(claim.updatedAt, staleClaimCutoff)
          ) {
            counts.purgedClaims += 1;
            return false;
          }
          return true;
        })
        .map((claim) => {
          if (
            [
              CLAIM_STATUS.APPROVED,
              CLAIM_STATUS.REJECTED,
              CLAIM_STATUS.CHANGES_REQUESTED,
              CLAIM_STATUS.WITHDRAWN,
              CLAIM_STATUS.EXPIRED,
            ].includes(claim.status) &&
            isOlderThan(claim.updatedAt, claimCutoff) &&
            claim.citizenId !== 'archived.contributor'
          ) {
            counts.redactedClaims += 1;
            return {
              ...claim,
              citizenId: 'archived.contributor',
              idempotencyKey: 'archived',
              redactedAt: now,
              updatedAt: now,
            };
          }
          return claim;
        });

      draft.submissions = draft.submissions.map((submission) => {
        const shouldRedact =
          isOlderThan(submission.updatedAt || submission.createdAt, claimCutoff) &&
          [
            COMPLETION_STATUS.APPROVED,
            COMPLETION_STATUS.REJECTED,
            COMPLETION_STATUS.CHANGES_REQUESTED,
            COMPLETION_STATUS.REOPENED,
            COMPLETION_STATUS.WITHDRAWN,
          ].includes(submission.status);
        if (!shouldRedact || submission.redactedAt) return submission;
        counts.redactedSubmissions += 1;
        return {
          ...submission,
          citizenId: 'archived.contributor',
          note: '[redacted after the retention period]',
          link: '',
          files: [],
          moderationReason: '',
          redactedAt: now,
          updatedAt: now,
        };
      });

      const eventsBefore = draft.moderationEvents.length;
      draft.moderationEvents = draft.moderationEvents.filter(
        (event) => !isOlderThan(event.createdAt, eventCutoff)
      );
      counts.removedEvents = eventsBefore - draft.moderationEvents.length;

      draft.moderationEvents.push({
        id: `mve_retention_${nowMs}`,
        taskId: null,
        taskPublicRef: null,
        claimId: null,
        submissionId: null,
        action: 'retention_applied',
        actorRole: 'admin',
        actorRef: 'retention-policy',
        reason: 'Documented retention and archival policy applied.',
        details: counts,
        visibility: 'internal',
        createdAt: now,
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      });

      draft.meta.retention = {
        appliedAt: now,
        policy: {
          taskRetentionDays,
          claimRetentionDays,
          purgeStaleClaimsDays,
          eventRetentionDays,
        },
      };
      return counts;
    },
    { storage, now }
  );

  return result;
};

export const getMicroVolunteerRetentionPolicy = () =>
  Object.freeze({
    taskRetentionDays: 180,
    claimRetentionDays: 90,
    purgeStaleClaimsDays: 30,
    eventRetentionDays: 730,
    description:
      'Completed tasks are archived after 180 days; citizen references and evidence notes are redacted after 90 days; withdrawn or expired claims are removed after 30 days; moderation events are retained for 730 days. Documentation and rollback steps are in docs/micro-volunteer-task-board.md.',
  });

export const getMicroVolunteerStorageKey = () => MICRO_VOLUNTEER_STORAGE_KEY;

export const getMicroVolunteerMigrationMetadata = (data) => ({
  schemaVersion: data?.schemaVersion ?? MICRO_VOLUNTEER_SCHEMA_VERSION,
  seeded: Boolean(data?.meta?.seeded),
  lastSavedAt: data?.meta?.lastSavedAt || null,
  migratedAt: data?.meta?.migratedAt || null,
  migrationHistory: Array.isArray(data?.meta?.migrationHistory)
    ? data.meta.migrationHistory
    : [],
  warnings: Array.isArray(data?.meta?.warnings) ? data.meta.warnings : [],
  retention: data?.meta?.retention || null,
  today: dateOnly(new Date()),
  recommendationStatuses: Object.values(RECOMMENDATION_STATUS),
});

export { MICRO_VOLUNTEER_STORAGE_KEY, isValidId };
