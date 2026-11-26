/**
 * Typed service boundary for the Civic Micro-Volunteer Task Board (#759).
 *
 * Everything a screen or an API handler can do goes through a named function in
 * this module. Each write:
 *   1. resolves the caller's board role and jurisdiction from the signed-in actor;
 *   2. validates and sanitises the input at the trusted boundary;
 *   3. checks the state machine before changing anything;
 *   4. writes all affected records in one atomic bundle transaction;
 *   5. appends an internal audit event with a reason.
 *
 * Public projections deliberately omit account ids, internal record ids,
 * idempotency keys, payload hashes, private moderation notes and contact data.
 */

import {
  CLAIM_STATUS,
  CLAIM_STATUS_LABELS,
  CLAIM_TRANSITIONS,
  COMPLETION_STATUS,
  COMPLETION_STATUS_LABELS,
  COMPLETION_TRANSITIONS,
  MICRO_VOLUNTEER_ERROR_CODES,
  MICRO_VOLUNTEER_LIMITS,
  MICRO_VOLUNTEER_RULESET_VERSION,
  MICRO_VOLUNTEER_SCHEMA_VERSION,
  MODERATION_ACTIONS,
  RECOMMENDATION_STATUS,
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_TRANSITIONS,
  TASK_CATEGORY_DEFINITIONS,
  TASK_CATEGORY_LABELS,
  TASK_STATUS,
  TASK_STATUS_LABELS,
  TASK_TRANSITIONS,
  buildTaskRecommendations,
  isTaskAcceptingClaims,
} from '../data/microVolunteerContract.js';
import {
  loadMicroVolunteerBoard,
  runMicroVolunteerTransaction,
  getMicroVolunteerStorageMode,
  getMicroVolunteerRetentionPolicy,
  getMicroVolunteerMigrationMetadata,
  applyMicroVolunteerRetentionPolicy,
  MICRO_VOLUNTEER_STORAGE_KEY,
} from './microVolunteerMigrations.js';
import {
  MicroVolunteerError,
  assertNoPersonalData,
  assertTransition,
  computeEvidencePayloadHash,
  normalizeDecisionInput,
  normalizeEvidenceInput,
  normalizeModerationInput,
  normalizeOpenTaskFields,
  normalizePreferenceInput,
  normalizeSearchFilters,
  normalizeTaskInput,
  validateReason,
} from './microVolunteerValidation.js';
import {
  actorAuditRef,
  actorScopeKey,
  assertNotSelfModeration,
  canAccessJurisdiction,
  requireCapability,
  requireJurisdictionAccess,
  resolveMicroVolunteerActor,
} from './microVolunteerAccessControl.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = (now) => (now instanceof Date ? now.toISOString() : new Date(now || Date.now()).toISOString());
const nowMs = (now) => new Date(now || Date.now()).getTime();
const yearOf = (now) => new Date(now || Date.now()).getUTCFullYear();

const randomToken = () => Math.random().toString(36).slice(2, 10);

const computeTaskPayloadHash = (cleaned) => {
  const text = JSON.stringify({
    categoryId: cleaned.categoryId,
    title: cleaned.title,
    instructions: cleaned.instructions,
    jurisdictionId: cleaned.jurisdictionId,
    locality: cleaned.locality,
    timeEstimateMinutes: cleaned.timeEstimateMinutes,
    dueDate: cleaned.dueDate,
    capacity: cleaned.capacity,
    evidenceRequirements: cleaned.evidenceRequirements,
    safetyNote: cleaned.safetyNote,
    source: cleaned.source,
    publish: Boolean(cleaned.publish),
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `mvt-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const nextPublicRef = (records, prefix, now) => {
  const year = yearOf(now);
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const highest = records.reduce((max, record) => {
    const match = pattern.exec(String(record.publicRef || record.id || ''));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${year}-${String(highest + 1).padStart(3, '0')}`;
};

const ACTIVE_CLAIM_STATUSES = Object.freeze([
  CLAIM_STATUS.ACTIVE,
  CLAIM_STATUS.SUBMITTED,
  CLAIM_STATUS.CHANGES_REQUESTED,
  CLAIM_STATUS.REOPENED,
]);

const PENDING_SUBMISSION_STATUSES = Object.freeze([
  COMPLETION_STATUS.SUBMITTED,
  COMPLETION_STATUS.UNDER_REVIEW,
]);

const PUBLIC_TASK_STATUSES = Object.freeze([
  TASK_STATUS.OPEN,
  TASK_STATUS.ASSIGNED,
  TASK_STATUS.AWAITING_REVIEW,
  TASK_STATUS.COMPLETED,
  TASK_STATUS.REOPENED,
]);

const isActiveClaim = (claim) => ACTIVE_CLAIM_STATUSES.includes(claim.status);
const isPendingSubmission = (submission) => PENDING_SUBMISSION_STATUSES.includes(submission.status);

const findTask = (board, ref) =>
  board.tasks.find((task) => task.publicRef === ref || task.id === ref) || null;
const findClaim = (board, ref) =>
  board.claims.find((claim) => claim.publicRef === ref || claim.id === ref) || null;
const findSubmission = (board, ref) =>
  board.submissions.find((submission) => submission.publicRef === ref || submission.id === ref) || null;

const activeClaimsForTask = (board, taskId) =>
  board.claims.filter((claim) => claim.taskId === taskId && isActiveClaim(claim));

const approvedSubmissionsForTask = (board, taskId) =>
  board.submissions
    .filter((submission) => submission.taskId === taskId && submission.status === COMPLETION_STATUS.APPROVED)
    .sort((a, b) => String(b.moderatedAt || b.updatedAt).localeCompare(String(a.moderatedAt || a.updatedAt)));

const latestSubmissionForClaim = (board, claimId) =>
  board.submissions
    .filter((submission) => submission.claimId === claimId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;

const assertTaskFound = (board, ref) => {
  const task = findTask(board, ref);
  if (!task) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND,
      'That task does not exist. Refresh the board and try again.'
    );
  }
  return task;
};

const assertClaimFound = (board, ref) => {
  const claim = findClaim(board, ref);
  if (!claim) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND,
      'That claim does not exist. Refresh My activity and try again.'
    );
  }
  return claim;
};

const assertSubmissionFound = (board, ref) => {
  const submission = findSubmission(board, ref);
  if (!submission) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND,
      'That completion submission does not exist. Refresh the moderation queue.'
    );
  }
  return submission;
};

const assertClaimOwner = (claim, actor) => {
  const resolved = resolveMicroVolunteerActor(actor);
  if (claim.citizenId !== resolved.id && resolved.role !== 'admin') {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED,
      'This claim belongs to another contributor.'
    );
  }
  return resolved;
};

const appendEvent = (draft, event, now) => {
  draft.moderationEvents.push({
    id: `mve_${nowMs(now)}_${randomToken()}`,
    taskId: event.taskId || null,
    taskPublicRef: event.taskPublicRef || null,
    claimId: event.claimId || null,
    submissionId: event.submissionId || null,
    action: event.action,
    actorRole: event.actorRole,
    actorRef: event.actorRef,
    reason: event.reason || '',
    details: event.details || {},
    visibility: 'internal',
    createdAt: nowIso(now),
    schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
  });
};

const takeRateLimit = (draft, { key, action, limit, windowMs, now, message }) => {
  const at = nowMs(now);
  const cutoff = at - windowMs;
  const current = draft.meta.abuse && typeof draft.meta.abuse === 'object' ? draft.meta.abuse : {};
  const previous = Array.isArray(current[action]) ? current[action] : [];
  const recent = previous.filter((entry) => new Date(entry.at).getTime() >= cutoff);
  const mine = recent.filter((entry) => entry.key === key);
  if (mine.length >= limit) {
    throw new MicroVolunteerError(MICRO_VOLUNTEER_ERROR_CODES.RATE_LIMITED, message, {
      action,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((Math.min(...mine.map((entry) => new Date(entry.at).getTime())) + windowMs - at) / 1000)
      ),
    });
  }
  recent.push({ key, at: nowIso(now) });
  draft.meta.abuse = { ...current, [action]: recent.slice(-250) };
};

const normaliseNote = (note) =>
  String(note || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const assertNotSpam = (draft, { citizenId, note, now }) => {
  const cutoff = nowMs(now) - 24 * 60 * 60 * 1000;
  const comparable = normaliseNote(note);
  const duplicate = draft.submissions.some(
    (submission) =>
      submission.citizenId === citizenId &&
      normaliseNote(submission.note) === comparable &&
      new Date(submission.createdAt).getTime() >= cutoff
  );
  if (duplicate) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.SPAM_BLOCKED,
      'The same completion note was already submitted in the last 24 hours. A moderator must review it manually.'
    );
  }
  const lines = String(note || '')
    .split(/\n+/)
    .map(normaliseNote)
    .filter((line) => line.length > 12);
  if (lines.length >= 4 && new Set(lines).size === 1) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.SPAM_BLOCKED,
      'The completion note repeats the same line. Describe what you actually did instead.'
    );
  }
  if (/(.)\1{19,}/.test(String(note || ''))) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.SPAM_BLOCKED,
      'The completion note looks like filler text. Describe what you actually did instead.'
    );
  }
};

const taskIsFull = (board, task) => activeClaimsForTask(board, task.id).length >= task.capacity;

const openPlaces = (board, task) =>
  Math.max(0, Number(task.capacity || 0) - activeClaimsForTask(board, task.id).length);

const publicTaskView = (task, board) => {
  const completed = approvedSubmissionsForTask(board, task.id);
  return {
    publicRef: task.publicRef,
    title: task.title,
    categoryId: task.categoryId,
    categoryLabel: TASK_CATEGORY_LABELS[task.categoryId] || task.categoryId,
    jurisdictionId: task.jurisdictionId,
    locality: task.locality,
    instructions: task.instructions,
    timeEstimateMinutes: task.timeEstimateMinutes,
    dueDate: task.dueDate,
    capacity: task.capacity,
    openPlaces: openPlaces(board, task),
    status: task.status,
    statusLabel: TASK_STATUS_LABELS[task.status] || task.status,
    evidenceRequirements: [...(task.evidenceRequirements || [])],
    safetyNote: task.safetyNote,
    source: task.source,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedCount: completed.length,
    latestPublicOutcome: completed[0]?.publicOutcomeNote || '',
  };
};

const staffTaskView = (task, board) => ({
  ...publicTaskView(task, board),
  safetyAcknowledgements: { ...(task.safetyAcknowledgements || {}) },
  archivedAt: task.archivedAt || null,
  activeClaimCount: activeClaimsForTask(board, task.id).length,
});

const publicClaimView = (claim, board) => {
  const submission = latestSubmissionForClaim(board, claim.id);
  return {
    claimPublicRef: claim.publicRef,
    taskPublicRef: claim.taskPublicRef,
    jurisdictionId: claim.jurisdictionId,
    status: claim.status,
    statusLabel: CLAIM_STATUS_LABELS[claim.status] || claim.status,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    submission: submission
      ? {
          submissionPublicRef: submission.publicRef,
          status: submission.status,
          statusLabel: COMPLETION_STATUS_LABELS[submission.status] || submission.status,
          submittedAt: submission.createdAt,
          publicOutcomeNote: submission.status === COMPLETION_STATUS.APPROVED ? submission.publicOutcomeNote : '',
        }
      : null,
  };
};

const ownerSubmissionView = (submission) => ({
  submissionPublicRef: submission.publicRef,
  taskPublicRef: submission.taskPublicRef,
  claimPublicRef: submission.claimPublicRef,
  status: submission.status,
  statusLabel: COMPLETION_STATUS_LABELS[submission.status] || submission.status,
  note: submission.note,
  link: submission.link,
  files: clone(submission.files || []),
  publicOutcomeNote: submission.publicOutcomeNote,
  moderationReason: submission.moderationReason,
  moderatedAt: submission.moderatedAt,
  submittedAt: submission.createdAt,
  updatedAt: submission.updatedAt,
});

const moderationSubmissionView = (submission, task) => ({
  submissionPublicRef: submission.publicRef,
  taskPublicRef: submission.taskPublicRef,
  claimPublicRef: submission.claimPublicRef,
  taskTitle: task?.title || 'Task removed',
  categoryId: task?.categoryId || null,
  categoryLabel: task ? TASK_CATEGORY_LABELS[task.categoryId] || task.categoryId : null,
  jurisdictionId: submission.jurisdictionId,
  contributorRef: actorAuditRef({ id: submission.citizenId }),
  status: submission.status,
  statusLabel: COMPLETION_STATUS_LABELS[submission.status] || submission.status,
  note: submission.note,
  link: submission.link,
  files: clone(submission.files || []),
  publicOutcomeNote: submission.publicOutcomeNote,
  moderationReason: submission.moderationReason,
  submittedAt: submission.createdAt,
  updatedAt: submission.updatedAt,
});

const recommendationView = (run) => ({
  runPublicRef: run.id,
  rulesetVersion: run.rulesetVersion,
  generatedAt: run.generatedAt,
  inputWindow: clone(run.inputWindow || {}),
  sourceFields: [...(run.sourceFields || [])],
  recommendations: run.recommendations.map((item) => ({
    taskPublicRef: item.taskPublicRef,
    title: item.title,
    categoryId: item.categoryId,
    categoryLabel: TASK_CATEGORY_LABELS[item.categoryId] || item.categoryId,
    jurisdictionId: item.jurisdictionId,
    timeEstimateMinutes: item.timeEstimateMinutes,
    dueDate: item.dueDate,
    score: item.score,
    reasons: clone(item.reasons || []),
    status: item.statusOfSuggestion,
    statusLabel: RECOMMENDATION_STATUS_LABELS[item.statusOfSuggestion] || item.statusOfSuggestion,
    decision: item.decision || null,
  })),
});

const boardMeta = (board) => ({
  storageMode: getMicroVolunteerStorageMode(),
  schemaVersion: board.schemaVersion,
  lastSavedAt: board.meta?.lastSavedAt || null,
  migration: getMicroVolunteerMigrationMetadata(board),
  retention: getMicroVolunteerRetentionPolicy(),
});

export const getMicroVolunteerBoardMeta = ({ storage = null, now = new Date() } = {}) => {
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  return boardMeta(board);
};

export const listTaskCategories = () =>
  TASK_CATEGORY_DEFINITIONS.map((category) => clone(category));

export const listJurisdictions = ({ storage = null, now = new Date() } = {}) => {
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  return [...new Set(board.tasks.map((task) => task.jurisdictionId))].sort();
};

export const getPublicBoardSummary = (
  { jurisdictionId = null } = {},
  { storage = null, now = new Date() } = {}
) => {
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  const code = jurisdictionId ? String(jurisdictionId).toUpperCase() : null;
  const tasks = board.tasks.filter(
    (task) =>
      PUBLIC_TASK_STATUSES.includes(task.status) && (!code || task.jurisdictionId === code)
  );
  const publicIds = new Set(tasks.map((task) => task.id));
  const submissions = board.submissions.filter(
    (submission) => publicIds.has(submission.taskId) && submission.status === COMPLETION_STATUS.APPROVED
  );

  const byCategory = TASK_CATEGORY_DEFINITIONS.map((category) => ({
    categoryId: category.id,
    label: category.label,
    open: tasks.filter(
      (task) =>
        task.categoryId === category.id &&
        [TASK_STATUS.OPEN, TASK_STATUS.ASSIGNED, TASK_STATUS.REOPENED].includes(task.status)
    ).length,
    completed: submissions.filter((submission) => {
      const task = tasks.find((item) => item.id === submission.taskId);
      return task?.categoryId === category.id;
    }).length,
  }));

  return {
    generatedAt: nowIso(now),
    jurisdictionId: code,
    totalOpen: tasks.filter((task) =>
      [TASK_STATUS.OPEN, TASK_STATUS.ASSIGNED, TASK_STATUS.REOPENED].includes(task.status)
    ).length,
    totalAwaitingReview: tasks.filter((task) => task.status === TASK_STATUS.AWAITING_REVIEW).length,
    totalCompleted: tasks.filter((task) => task.status === TASK_STATUS.COMPLETED).length,
    totalApprovedContributions: submissions.length,
    openPlaces: tasks.reduce((sum, task) => sum + openPlaces(board, task), 0),
    byCategory,
    byJurisdiction: [...new Set(tasks.map((task) => task.jurisdictionId))].sort().map((codeValue) => ({
      jurisdictionId: codeValue,
      open: tasks.filter(
        (task) =>
          task.jurisdictionId === codeValue &&
          [TASK_STATUS.OPEN, TASK_STATUS.ASSIGNED, TASK_STATUS.REOPENED].includes(task.status)
      ).length,
    })),
  };
};

export const listPublicTasks = (filters = {}, { storage = null, now = new Date() } = {}) => {
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  const { page, pageSize, status, categoryId, jurisdictionId, search, sort, includeArchived } =
    normalizeSearchFilters(filters);

  const term = search.toLowerCase();
  const filtered = board.tasks
    .filter((task) => PUBLIC_TASK_STATUSES.includes(task.status))
    .filter((task) => (includeArchived ? true : task.status !== TASK_STATUS.ARCHIVED))
    .filter((task) => (status ? task.status === status : true))
    .filter((task) => (categoryId ? task.categoryId === categoryId : true))
    .filter((task) => (jurisdictionId ? task.jurisdictionId === jurisdictionId : true))
    .filter((task) =>
      term
        ? `${task.title} ${task.locality} ${task.instructions} ${task.source}`
            .toLowerCase()
            .includes(term)
        : true
    );

  const sorted = filtered.slice().sort((a, b) => {
    if (sort === 'created_at') return String(b.createdAt).localeCompare(String(a.createdAt));
    if (sort === 'updated_at') return String(b.updatedAt).localeCompare(String(a.updatedAt));
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return String(a.publicRef).localeCompare(String(b.publicRef));
  });

  const total = sorted.length;
  const start = (page - 1) * pageSize;
  return {
    items: sorted.slice(start, start + pageSize).map((task) => publicTaskView(task, board)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasNext: start + pageSize < total,
    },
    filters: { status, categoryId, jurisdictionId, search, sort },
    generatedAt: nowIso(now),
  };
};

/**
 * Staff list used by the operator workspace to publish drafts and inspect the
 * full task lifecycle. It never returns citizen identifiers or moderation notes.
 */
export const listTasksForStaff = (
  filters = {},
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.create', actor);
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  const { page, pageSize } = normalizeSearchFilters(filters);
  const status = typeof filters.status === 'string' ? filters.status : null;
  const jurisdictionId = filters.jurisdictionId
    ? String(filters.jurisdictionId).toUpperCase()
    : null;

  const filtered = board.tasks
    .filter((task) => (status ? task.status === status : true))
    .filter((task) =>
      canAccessJurisdiction(resolved, task.jurisdictionId, { write: true })
    )
    .filter((task) => (jurisdictionId ? task.jurisdictionId === jurisdictionId : true))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize).map((task) => staffTaskView(task, board)),
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      hasNext: start + pageSize < filtered.length,
    },
    generatedAt: nowIso(now),
  };
};

export const getPublicTask = (taskRef, { storage = null, now = new Date() } = {}) => {
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  // Public callers may only address a task by its published reference. Internal
  // record ids are not enumerable through the public board API.
  if (!/^MVT-[A-Za-z0-9-]+$/.test(String(taskRef || ''))) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND,
      'That task does not exist. Refresh the board and try again.'
    );
  }
  const task = assertTaskFound(board, taskRef);
  if (!PUBLIC_TASK_STATUSES.includes(task.status)) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND,
      'That task is not published on the public board.'
    );
  }
  return {
    task: publicTaskView(task, board),
    approvedOutcomes: approvedSubmissionsForTask(board, task.id)
      .map((submission) => ({
        submissionPublicRef: submission.publicRef,
        publicOutcomeNote: submission.publicOutcomeNote,
        approvedAt: submission.moderatedAt,
      }))
      .filter((outcome) => outcome.publicOutcomeNote),
  };
};

export const listPublicCategoriesWithCounts = ({ storage = null, now = new Date() } = {}) => {
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  return TASK_CATEGORY_DEFINITIONS.map((category) => ({
    ...clone(category),
    openCount: board.tasks.filter(
      (task) =>
        task.categoryId === category.id &&
        [TASK_STATUS.OPEN, TASK_STATUS.ASSIGNED, TASK_STATUS.REOPENED].includes(task.status)
    ).length,
  }));
};

export const createTask = (
  input,
  { actor = null, idempotencyKey = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.create', actor);
  const cleaned = normalizeTaskInput(input, { now });
  requireJurisdictionAccess(resolved, cleaned.jurisdictionId, { write: true });
  const key = idempotencyKey ? String(idempotencyKey).trim() : null;
  const payloadHash = computeTaskPayloadHash(cleaned);

  const { data, result } = runMicroVolunteerTransaction(
    (draft) => {
      if (key) {
        const existing = draft.tasks.find(
          (task) => task.idempotencyKey === key && task.createdBy === resolved.id
        );
        if (existing) {
          if (existing.payloadHash && existing.payloadHash !== payloadHash) {
            throw new MicroVolunteerError(
              MICRO_VOLUNTEER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
              'This retry key was already used for a different task. Refresh the board and try again.'
            );
          }
          return { task: existing, replayed: true };
        }
      }
      const at = nowIso(now);
      const task = {
        id: `mvt_${nowMs(now)}_${randomToken()}`,
        publicRef: nextPublicRef(draft.tasks, 'MVT', now),
        title: cleaned.title,
        categoryId: cleaned.categoryId,
        jurisdictionId: cleaned.jurisdictionId,
        locality: cleaned.locality,
        instructions: cleaned.instructions,
        timeEstimateMinutes: cleaned.timeEstimateMinutes,
        dueDate: cleaned.dueDate,
        capacity: cleaned.capacity,
        status: cleaned.publish ? TASK_STATUS.OPEN : TASK_STATUS.DRAFT,
        evidenceRequirements: cleaned.evidenceRequirements,
        safetyNote: cleaned.safetyNote,
        source: cleaned.source,
        safetyAcknowledgements: cleaned.safetyAcknowledgements,
        createdBy: resolved.id,
        idempotencyKey: key,
        payloadHash,
        createdAt: at,
        updatedAt: at,
        archivedAt: null,
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      };
      draft.tasks.push(task);
      appendEvent(
        draft,
        {
          taskId: task.id,
          taskPublicRef: task.publicRef,
          action: 'task_created',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: cleaned.publish ? 'Task published to the public board.' : 'Task saved as a draft.',
          details: { categoryId: task.categoryId, capacity: task.capacity },
        },
        now
      );
      return { task, replayed: false };
    },
    { storage, now: nowIso(now) }
  );

  const task = data.tasks.find((item) => item.id === result.task.id);
  return { task: staffTaskView(task, data), replayed: result.replayed };
};

export const updateTask = (
  taskRef,
  updates = {},
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.create', actor);
  const cleaned = normalizeOpenTaskFields(updates);

  const { data } = runMicroVolunteerTransaction(
    (draft) => {
      const task = assertTaskFound(draft, taskRef);
      requireJurisdictionAccess(resolved, task.jurisdictionId, { write: true });
      if ([TASK_STATUS.COMPLETED, TASK_STATUS.ARCHIVED].includes(task.status)) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.INVALID_TRANSITION,
          'Completed or archived tasks cannot be edited. Reopen the task first.'
        );
      }
      const merged = normalizeTaskInput(
        {
          categoryId: task.categoryId,
          title: cleaned.title ?? task.title,
          instructions: cleaned.instructions ?? task.instructions,
          jurisdictionId: task.jurisdictionId,
          locality: cleaned.locality ?? task.locality,
          timeEstimateMinutes: cleaned.timeEstimateMinutes ?? task.timeEstimateMinutes,
          dueDate: cleaned.dueDate ?? task.dueDate,
          capacity: cleaned.capacity ?? task.capacity,
          evidenceRequirements: cleaned.evidenceRequirements ?? task.evidenceRequirements,
          safetyAcknowledgements: task.safetyAcknowledgements,
          safetyNote: cleaned.safetyNote ?? task.safetyNote,
          source: cleaned.source ?? task.source,
        },
        { now }
      );
      const active = activeClaimsForTask(draft, task.id).length;
      if (merged.capacity < active) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
          `Places cannot be fewer than the ${active} active claim(s) already on this task.`
        );
      }
      Object.assign(task, {
        title: merged.title,
        instructions: merged.instructions,
        locality: merged.locality,
        timeEstimateMinutes: merged.timeEstimateMinutes,
        dueDate: merged.dueDate,
        capacity: merged.capacity,
        evidenceRequirements: merged.evidenceRequirements,
        safetyNote: merged.safetyNote,
        source: merged.source,
        updatedAt: nowIso(now),
      });
      appendEvent(
        draft,
        {
          taskId: task.id,
          taskPublicRef: task.publicRef,
          action: 'task_updated',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: 'Task details updated by a ward operator.',
          details: { changedFields: Object.keys(cleaned) },
        },
        now
      );
      return task;
    },
    { storage, now: nowIso(now) }
  );

  const task = data.tasks.find((item) => item.id === findTask(data, taskRef).id);
  return staffTaskView(task, data);
};

const transitionTask = (task, nextStatus) => {
  if (task.status === nextStatus) return;
  assertTransition(TASK_TRANSITIONS, task.status, nextStatus, 'task');
  task.status = nextStatus;
};

export const publishTask = (taskRef, { actor = null, storage = null, now = new Date() } = {}) => {
  const resolved = requireCapability('task.create', actor);
  const { data } = runMicroVolunteerTransaction(
    (draft) => {
      const task = assertTaskFound(draft, taskRef);
      requireJurisdictionAccess(resolved, task.jurisdictionId, { write: true });
      transitionTask(task, TASK_STATUS.OPEN);
      task.updatedAt = nowIso(now);
      appendEvent(
        draft,
        {
          taskId: task.id,
          taskPublicRef: task.publicRef,
          action: 'task_published',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: 'Draft task published to the public board.',
          details: {},
        },
        now
      );
      return task;
    },
    { storage, now: nowIso(now) }
  );
  return staffTaskView(findTask(data, taskRef), data);
};

export const archiveTask = (
  taskRef,
  reason,
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.archive', actor);
  const cleanedReason = validateReason(reason, { required: true });
  const { data } = runMicroVolunteerTransaction(
    (draft) => {
      const task = assertTaskFound(draft, taskRef);
      requireJurisdictionAccess(resolved, task.jurisdictionId, { write: true });
      assertTransition(TASK_TRANSITIONS, task.status, TASK_STATUS.ARCHIVED, 'task');
      task.status = TASK_STATUS.ARCHIVED;
      task.archivedAt = nowIso(now);
      task.updatedAt = nowIso(now);
      appendEvent(
        draft,
        {
          taskId: task.id,
          taskPublicRef: task.publicRef,
          action: 'task_archived',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: cleanedReason,
          details: {},
        },
        now
      );
      return task;
    },
    { storage, now: nowIso(now) }
  );
  return staffTaskView(findTask(data, taskRef), data);
};

export const claimTask = (
  taskRef,
  { actor = null, idempotencyKey = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.claim', actor);
  const scopeKey = actorScopeKey(resolved);
  const key = idempotencyKey ? String(idempotencyKey).trim() : '';
  if (key.length < MICRO_VOLUNTEER_LIMITS.MIN_IDEMPOTENCY_KEY_LENGTH) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'A retry key of at least 8 characters is required when claiming a task.',
      { field: 'idempotencyKey' }
    );
  }

  const { data, result } = runMicroVolunteerTransaction(
    (draft) => {
      const task = assertTaskFound(draft, taskRef);
      requireJurisdictionAccess(resolved, task.jurisdictionId, { write: true });

      const existingByKey = draft.claims.find((claim) => claim.idempotencyKey === key);
      if (existingByKey) {
        if (existingByKey.citizenId === resolved.id && existingByKey.taskId === task.id) {
          return { claim: existingByKey, replayed: true };
        }
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          'This retry key was already used for another claim. Start a new claim instead of retrying.'
        );
      }

      const duplicate = draft.claims.find(
        (claim) => claim.taskId === task.id && claim.citizenId === resolved.id && isActiveClaim(claim)
      );
      if (duplicate) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.DUPLICATE_CLAIM,
          'You already have an active claim on this task. Open My activity to continue it.',
          { claimPublicRef: duplicate.publicRef }
        );
      }

      if (task.status === TASK_STATUS.ARCHIVED || task.status === TASK_STATUS.DRAFT) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.TASK_CLOSED,
          'This task is not published and cannot be claimed.'
        );
      }
      if (!isTaskAcceptingClaims(task, { now })) {
        if (task.dueDate < nowIso(now).slice(0, 10)) {
          throw new MicroVolunteerError(
            MICRO_VOLUNTEER_ERROR_CODES.TASK_EXPIRED,
            'The due date has passed. A moderator must reopen the task before a new claim can be made.'
          );
        }
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.TASK_CLOSED,
          'This task is not accepting claims right now. Refresh the board to see its latest status.'
        );
      }
      if (taskIsFull(draft, task)) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.TASK_FULL,
          'Every place on this task is taken. Browse other open tasks or check back later.'
        );
      }

      takeRateLimit(draft, {
        key: scopeKey,
        action: 'claim',
        limit: MICRO_VOLUNTEER_LIMITS.MAX_CLAIMS_PER_CITIZEN_PER_WINDOW,
        windowMs: MICRO_VOLUNTEER_LIMITS.CLAIM_WINDOW_MS,
        now,
        message: 'Too many claims in a short time. Wait a few minutes before claiming another task.',
      });

      const at = nowIso(now);
      const claim = {
        id: `mvc_${nowMs(now)}_${randomToken()}`,
        publicRef: nextPublicRef(draft.claims, 'MVC', now),
        taskId: task.id,
        taskPublicRef: task.publicRef,
        citizenId: resolved.id,
        jurisdictionId: task.jurisdictionId,
        status: CLAIM_STATUS.ACTIVE,
        idempotencyKey: key,
        createdAt: at,
        updatedAt: at,
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      };
      draft.claims.push(claim);
      transitionTask(task, TASK_STATUS.ASSIGNED);
      task.updatedAt = at;
      appendEvent(
        draft,
        {
          taskId: task.id,
          taskPublicRef: task.publicRef,
          claimId: claim.id,
          action: 'claim_created',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: 'Citizen claimed the task.',
          details: { openPlacesAfter: openPlaces(draft, task) },
        },
        now
      );
      return { claim, replayed: false };
    },
    { storage, now: nowIso(now) }
  );

  return {
    claim: publicClaimView(
      data.claims.find((claim) => claim.id === result.claim.id),
      data
    ),
    replayed: result.replayed,
  };
};

export const withdrawClaim = (
  claimRef,
  reason,
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('submission.create', actor);
  const cleanedReason = validateReason(reason || 'Withdrawn by the contributor.', { required: false });

  const { data } = runMicroVolunteerTransaction(
    (draft) => {
      const claim = assertClaimFound(draft, claimRef);
      assertClaimOwner(claim, resolved);
      if (![CLAIM_STATUS.ACTIVE, CLAIM_STATUS.CHANGES_REQUESTED, CLAIM_STATUS.REOPENED].includes(claim.status)) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.INVALID_TRANSITION,
          'This claim can no longer be withdrawn. A moderator must decide the submitted evidence.'
        );
      }
      assertTransition(CLAIM_TRANSITIONS, claim.status, CLAIM_STATUS.WITHDRAWN, 'claim');
      claim.status = CLAIM_STATUS.WITHDRAWN;
      claim.updatedAt = nowIso(now);

      const task = findTask(draft, claim.taskId);
      if (task && !activeClaimsForTask(draft, task.id).length) {
        if (task.status === TASK_STATUS.ASSIGNED) {
          task.status = TASK_STATUS.OPEN;
          task.updatedAt = nowIso(now);
        }
      }
      appendEvent(
        draft,
        {
          taskId: claim.taskId,
          taskPublicRef: claim.taskPublicRef,
          claimId: claim.id,
          action: 'claim_withdrawn',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: cleanedReason,
          details: {},
        },
        now
      );
      return claim;
    },
    { storage, now: nowIso(now) }
  );

  return publicClaimView(data.claims.find((claim) => claim.id === findClaim(data, claimRef).id), data);
};

export const submitCompletion = (
  claimRef,
  evidence,
  { actor = null, idempotencyKey = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('submission.create', actor);
  const cleaned = normalizeEvidenceInput(evidence);
  const scopeKey = actorScopeKey(resolved);
  const key = idempotencyKey ? String(idempotencyKey).trim() : '';
  if (key.length < MICRO_VOLUNTEER_LIMITS.MIN_IDEMPOTENCY_KEY_LENGTH) {
    throw new MicroVolunteerError(
      MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR,
      'A retry key of at least 8 characters is required when submitting evidence.',
      { field: 'idempotencyKey' }
    );
  }

  const { data, result } = runMicroVolunteerTransaction(
    (draft) => {
      const claim = assertClaimFound(draft, claimRef);
      assertClaimOwner(claim, resolved);
      const task = assertTaskFound(draft, claim.taskId);
      requireJurisdictionAccess(resolved, claim.jurisdictionId, { write: true });

      const payloadHash = computeEvidencePayloadHash({
        claimId: claim.id,
        note: cleaned.note,
        link: cleaned.link,
        files: cleaned.files,
      });

      const existingByKey = draft.submissions.find(
        (submission) => submission.idempotencyKey === key
      );
      if (existingByKey) {
        if (
          existingByKey.claimId === claim.id &&
          existingByKey.citizenId === resolved.id &&
          existingByKey.payloadHash === payloadHash
        ) {
          return { submission: existingByKey, replayed: true };
        }
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          'This retry key was already used with different evidence. Start a new submission instead of retrying.'
        );
      }

      if (latestSubmissionForClaim(draft, claim.id) && isPendingSubmission(latestSubmissionForClaim(draft, claim.id))) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.DUPLICATE_SUBMISSION,
          'This claim already has completion evidence waiting for moderation.'
        );
      }
      if (![CLAIM_STATUS.ACTIVE, CLAIM_STATUS.CHANGES_REQUESTED, CLAIM_STATUS.REOPENED].includes(claim.status)) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.INVALID_TRANSITION,
          'Evidence cannot be submitted for this claim in its current state.'
        );
      }

      assertNotSpam(draft, { citizenId: resolved.id, note: cleaned.note, now });

      takeRateLimit(draft, {
        key: scopeKey,
        action: 'submission',
        limit: MICRO_VOLUNTEER_LIMITS.MAX_SUBMISSIONS_PER_CITIZEN_PER_WINDOW,
        windowMs: MICRO_VOLUNTEER_LIMITS.SUBMISSION_WINDOW_MS,
        now,
        message: 'Too many completion submissions in a short time. Wait a few minutes before trying again.',
      });

      assertTransition(CLAIM_TRANSITIONS, claim.status, CLAIM_STATUS.SUBMITTED, 'claim');
      claim.status = CLAIM_STATUS.SUBMITTED;
      claim.updatedAt = nowIso(now);

      const at = nowIso(now);
      const submission = {
        id: `mvs_${nowMs(now)}_${randomToken()}`,
        publicRef: nextPublicRef(draft.submissions, 'MVS', now),
        taskId: task.id,
        taskPublicRef: task.publicRef,
        claimId: claim.id,
        claimPublicRef: claim.publicRef,
        citizenId: resolved.id,
        jurisdictionId: claim.jurisdictionId,
        status: COMPLETION_STATUS.SUBMITTED,
        note: cleaned.note,
        link: cleaned.link,
        files: cleaned.files,
        publicOutcomeNote: '',
        moderationReason: '',
        moderatedByRole: '',
        moderatedAt: null,
        idempotencyKey: key,
        payloadHash,
        createdAt: at,
        updatedAt: at,
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      };
      draft.submissions.push(submission);
      transitionTask(task, TASK_STATUS.AWAITING_REVIEW);
      task.updatedAt = at;
      appendEvent(
        draft,
        {
          taskId: task.id,
          taskPublicRef: task.publicRef,
          claimId: claim.id,
          submissionId: submission.id,
          action: 'completion_submitted',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: 'Citizen submitted completion evidence.',
          details: { fileCount: submission.files.length, hasLink: Boolean(submission.link) },
        },
        now
      );
      return { submission, replayed: false };
    },
    { storage, now: nowIso(now) }
  );

  return {
    submission: ownerSubmissionView(
      data.submissions.find((submission) => submission.id === result.submission.id)
    ),
    replayed: result.replayed,
  };
};

const decisionToCompletionStatus = (decision) => {
  if (decision === MODERATION_ACTIONS.APPROVE) return COMPLETION_STATUS.APPROVED;
  if (decision === MODERATION_ACTIONS.REJECT) return COMPLETION_STATUS.REJECTED;
  if (decision === MODERATION_ACTIONS.REQUEST_CHANGES) return COMPLETION_STATUS.CHANGES_REQUESTED;
  if (decision === MODERATION_ACTIONS.REOPEN) return COMPLETION_STATUS.REOPENED;
  return null;
};

const decisionToClaimStatus = (decision) => {
  if (decision === MODERATION_ACTIONS.APPROVE) return CLAIM_STATUS.APPROVED;
  if (decision === MODERATION_ACTIONS.REJECT) return CLAIM_STATUS.REJECTED;
  if (decision === MODERATION_ACTIONS.REQUEST_CHANGES) return CLAIM_STATUS.CHANGES_REQUESTED;
  if (decision === MODERATION_ACTIONS.REOPEN) return CLAIM_STATUS.REOPENED;
  return null;
};

export const moderateSubmission = (
  submissionRef,
  input,
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.moderate', actor);
  const cleaned = normalizeModerationInput(input);
  if (cleaned.publicOutcomeNote) assertNoPersonalData(cleaned.publicOutcomeNote, 'public outcome');

  const { data } = runMicroVolunteerTransaction(
    (draft) => {
      const submission = assertSubmissionFound(draft, submissionRef);
      const claim = findClaim(draft, submission.claimId);
      const task = findTask(draft, submission.taskId);
      if (!claim || !task) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND,
          'The claim or task linked to this submission is missing.'
        );
      }
      requireJurisdictionAccess(resolved, submission.jurisdictionId, { write: true });
      assertNotSelfModeration(resolved, submission);
      assertNotSelfModeration(resolved, task);

      const completionStatus = decisionToCompletionStatus(cleaned.decision);
      const claimStatus = decisionToClaimStatus(cleaned.decision);
      assertTransition(COMPLETION_TRANSITIONS, submission.status, completionStatus, 'completion submission');
      assertTransition(CLAIM_TRANSITIONS, claim.status, claimStatus, 'claim');

      const at = nowIso(now);
      submission.status = completionStatus;
      submission.moderationReason = cleaned.reason;
      submission.publicOutcomeNote =
        cleaned.decision === MODERATION_ACTIONS.APPROVE ? cleaned.publicOutcomeNote : '';
      submission.moderatedByRole = resolved.role;
      submission.moderatedAt = at;
      submission.updatedAt = at;

      claim.status = claimStatus;
      claim.updatedAt = at;

      if (cleaned.decision === MODERATION_ACTIONS.APPROVE) {
        transitionTask(task, TASK_STATUS.COMPLETED);
      } else if (cleaned.decision === MODERATION_ACTIONS.REOPEN) {
        transitionTask(task, TASK_STATUS.REOPENED);
      } else {
        transitionTask(task, TASK_STATUS.REOPENED);
      }
      task.updatedAt = at;

      appendEvent(
        draft,
        {
          taskId: task.id,
          taskPublicRef: task.publicRef,
          claimId: claim.id,
          submissionId: submission.id,
          action: `completion_${cleaned.decision}`,
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: cleaned.reason,
          details: {
            decision: cleaned.decision,
            publicOutcomeNote: Boolean(cleaned.publicOutcomeNote),
          },
        },
        now
      );
      return submission;
    },
    { storage, now: nowIso(now) }
  );

  const submission = data.submissions.find((item) => item.id === findSubmission(data, submissionRef).id);
  const task = findTask(data, submission.taskId);
  return {
    submission: moderationSubmissionView(submission, task),
    task: publicTaskView(task, data),
  };
};

export const reopenTask = (
  taskRef,
  reason,
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.moderate', actor);
  const cleanedReason = validateReason(reason, { required: true });

  const { data } = runMicroVolunteerTransaction(
    (draft) => {
      const task = assertTaskFound(draft, taskRef);
      requireJurisdictionAccess(resolved, task.jurisdictionId, { write: true });
      assertNotSelfModeration(resolved, task);

      if (![TASK_STATUS.COMPLETED, TASK_STATUS.AWAITING_REVIEW, TASK_STATUS.ASSIGNED, TASK_STATUS.REOPENED].includes(task.status)) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.INVALID_TRANSITION,
          'Only a claimed, awaiting-review or completed task can be reopened.'
        );
      }

      const at = nowIso(now);
      if (task.status !== TASK_STATUS.REOPENED) {
        assertTransition(TASK_TRANSITIONS, task.status, TASK_STATUS.REOPENED, 'task');
        task.status = TASK_STATUS.REOPENED;
      }
      task.updatedAt = at;

      draft.submissions
        .filter((submission) => submission.taskId === task.id)
        .forEach((submission) => {
          if ([COMPLETION_STATUS.APPROVED, COMPLETION_STATUS.REJECTED].includes(submission.status)) {
            assertTransition(COMPLETION_TRANSITIONS, submission.status, COMPLETION_STATUS.REOPENED, 'completion submission');
            submission.status = COMPLETION_STATUS.REOPENED;
            submission.updatedAt = at;
          }
        });
      draft.claims
        .filter((claim) => claim.taskId === task.id)
        .forEach((claim) => {
          if ([CLAIM_STATUS.APPROVED, CLAIM_STATUS.REJECTED].includes(claim.status)) {
            assertTransition(CLAIM_TRANSITIONS, claim.status, CLAIM_STATUS.REOPENED, 'claim');
            claim.status = CLAIM_STATUS.REOPENED;
            claim.updatedAt = at;
          }
        });

      appendEvent(
        draft,
        {
          taskId: task.id,
          taskPublicRef: task.publicRef,
          action: 'task_reopened',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: cleanedReason,
          details: {},
        },
        now
      );
      return task;
    },
    { storage, now: nowIso(now) }
  );

  return staffTaskView(findTask(data, taskRef), data);
};

export const listMyActivity = (
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.claim', actor);
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  const claims = board.claims
    .filter((claim) => claim.citizenId === resolved.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((claim) => {
      const task = findTask(board, claim.taskId);
      return {
        ...publicClaimView(claim, board),
        task: task
          ? {
              publicRef: task.publicRef,
              title: task.title,
              categoryId: task.categoryId,
              categoryLabel: TASK_CATEGORY_LABELS[task.categoryId] || task.categoryId,
              dueDate: task.dueDate,
              status: task.status,
              statusLabel: TASK_STATUS_LABELS[task.status] || task.status,
            }
          : null,
      };
    });
  const submissions = board.submissions
    .filter((submission) => submission.citizenId === resolved.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(ownerSubmissionView);
  return { claims, submissions };
};

export const listModerationQueue = (
  filters = {},
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('task.moderate', actor);
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  const { page, pageSize } = normalizeSearchFilters(filters);
  const status = [COMPLETION_STATUS.SUBMITTED, COMPLETION_STATUS.UNDER_REVIEW].includes(filters.status)
    ? filters.status
    : null;
  const jurisdictionId = filters.jurisdictionId
    ? String(filters.jurisdictionId).toUpperCase()
    : null;

  const filtered = board.submissions
    .filter((submission) => (status ? submission.status === status : isPendingSubmission(submission)))
    .filter((submission) =>
      jurisdictionId
        ? submission.jurisdictionId === jurisdictionId &&
          canAccessJurisdiction(resolved, submission.jurisdictionId, { write: true })
        : canAccessJurisdiction(resolved, submission.jurisdictionId, { write: true })
    )
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    items: filtered
      .slice(start, start + pageSize)
      .map((submission) => moderationSubmissionView(submission, findTask(board, submission.taskId))),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasNext: start + pageSize < total,
    },
    generatedAt: nowIso(now),
  };
};

export const listAuditEvents = (
  { page = 1, pageSize = 25, taskPublicRef = null } = {},
  { actor = null, storage = null, now = new Date() } = {}
) => {
  requireCapability('audit.read', actor);
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  const filtered = board.moderationEvents
    .filter((event) => (taskPublicRef ? event.taskPublicRef === taskPublicRef : true))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const safePage = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const safePageSize = Math.min(
    MICRO_VOLUNTEER_LIMITS.MAX_PAGE_SIZE,
    Math.max(1, Number(pageSize) || 25)
  );
  const start = (safePage - 1) * safePageSize;
  return {
    items: filtered.slice(start, start + safePageSize).map((event) => ({
      eventRef: event.id,
      taskPublicRef: event.taskPublicRef,
      claimPublicRef: event.claimId
        ? board.claims.find((claim) => claim.id === event.claimId)?.publicRef || null
        : null,
      submissionPublicRef: event.submissionId
        ? board.submissions.find((submission) => submission.id === event.submissionId)?.publicRef || null
        : null,
      action: event.action,
      actorRole: event.actorRole,
      actorRef: event.actorRef,
      reason: event.reason,
      details: clone(event.details || {}),
      createdAt: event.createdAt,
    })),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / safePageSize)),
    },
  };
};

export const buildRecommendationsForActor = (
  preferences = {},
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('recommendation.view', actor);
  const cleaned = normalizePreferenceInput(preferences);
  const board = loadMicroVolunteerBoard({ storage, now: nowIso(now) });
  const candidates = board.tasks
    .filter((task) => PUBLIC_TASK_STATUSES.includes(task.status))
    .filter((task) => isTaskAcceptingClaims(task, { now }))
    .filter((task) => openPlaces(board, task) > 0)
    .filter((task) => canAccessJurisdiction(resolved, task.jurisdictionId, { write: true }));

  const run = buildTaskRecommendations(candidates, cleaned, {
    now,
    rulesetVersion: MICRO_VOLUNTEER_RULESET_VERSION,
  });

  const { data, result } = runMicroVolunteerTransaction(
    (draft) => {
      const publicRef = nextPublicRef(draft.recommendationRuns, 'REC', now);
      const record = {
        id: publicRef,
        actorScopeKey: actorScopeKey(resolved),
        actorRef: actorAuditRef(resolved),
        rulesetVersion: run.rulesetVersion,
        generatedAt: run.generatedAt,
        inputWindow: run.inputWindow,
        sourceFields: run.sourceFields,
        recommendations: run.recommendations.map((item) => {
          const task = draft.tasks.find((candidate) => candidate.id === item.taskId);
          return {
            ...item,
            taskPublicRef: task?.publicRef || item.taskPublicRef,
            decision: null,
          };
        }),
        schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
      };
      draft.recommendationRuns.push(record);
      appendEvent(
        draft,
        {
          action: 'recommendation_run_created',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: `Deterministic suggestions generated with ruleset ${run.rulesetVersion}.`,
          details: { runPublicRef: publicRef, count: record.recommendations.length },
        },
        now
      );
      return record;
    },
    { storage, now: nowIso(now) }
  );

  return recommendationView(data.recommendationRuns.find((item) => item.id === result.id));
};

export const decideRecommendation = (
  runPublicRef,
  taskPublicRef,
  input,
  { actor = null, storage = null, now = new Date() } = {}
) => {
  const resolved = requireCapability('recommendation.decide', actor);
  const cleaned = normalizeDecisionInput(input);
  const { data } = runMicroVolunteerTransaction(
    (draft) => {
      const run = draft.recommendationRuns.find((item) => item.id === runPublicRef);
      if (!run) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND,
          'That suggestion run no longer exists. Generate a new set of suggestions.'
        );
      }
      if (run.actorScopeKey !== actorScopeKey(resolved)) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED,
          'These suggestions belong to another contributor.'
        );
      }
      const item = run.recommendations.find((candidate) => candidate.taskPublicRef === taskPublicRef);
      if (!item) {
        throw new MicroVolunteerError(
          MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND,
          'That suggestion is not part of this run.'
        );
      }
      const nextStatus =
        cleaned.decision === 'accept'
          ? RECOMMENDATION_STATUS.ACCEPTED
          : cleaned.decision === 'edit'
            ? RECOMMENDATION_STATUS.EDITED
            : RECOMMENDATION_STATUS.REJECTED;
      assertTransition(RECOMMENDATION_TRANSITIONS, item.statusOfSuggestion, nextStatus, 'suggestion');
      item.statusOfSuggestion = nextStatus;
      item.decision = {
        decision: cleaned.decision,
        editedCategoryId: cleaned.decision === 'edit' ? cleaned.editedCategoryId : null,
        reason: cleaned.reason,
        decidedAt: nowIso(now),
      };
      appendEvent(
        draft,
        {
          action: 'recommendation_decided',
          actorRole: resolved.role,
          actorRef: actorAuditRef(resolved),
          reason: cleaned.reason || `Suggestion ${cleaned.decision}ed by the contributor.`,
          details: {
            runPublicRef,
            taskPublicRef,
            decision: cleaned.decision,
            editedCategoryId: item.decision.editedCategoryId,
          },
        },
        now
      );
      return run;
    },
    { storage, now: nowIso(now) }
  );

  return recommendationView(data.recommendationRuns.find((item) => item.id === runPublicRef));
};

export const runRetentionPolicy = (
  { actor = null, storage = null, now = new Date() } = {}
) => {
  requireCapability('retention.run', actor);
  return applyMicroVolunteerRetentionPolicy({ now: nowIso(now) }, { storage });
};

export const getMicroVolunteerStorageInfo = () => ({
  key: MICRO_VOLUNTEER_STORAGE_KEY,
  schemaVersion: MICRO_VOLUNTEER_SCHEMA_VERSION,
  rulesetVersion: MICRO_VOLUNTEER_RULESET_VERSION,
  storageMode: getMicroVolunteerStorageMode(),
});

export { MicroVolunteerError };
