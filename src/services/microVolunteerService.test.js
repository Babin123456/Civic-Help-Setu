import { describe, it, expect, beforeEach } from 'vitest';
import {
  CLAIM_STATUS,
  COMPLETION_STATUS,
  MICRO_VOLUNTEER_ERROR_CODES,
  MODERATION_ACTIONS,
  TASK_STATUS,
} from '../data/microVolunteerContract.js';
import { createMemoryStorage, resetMicroVolunteerStorageToEmpty } from './microVolunteerMigrations.js';
import {
  archiveTask,
  buildRecommendationsForActor,
  claimTask,
  createTask,
  decideRecommendation,
  getPublicTask,
  listAuditEvents,
  listModerationQueue,
  listMyActivity,
  listPublicTasks,
  listTasksForStaff,
  moderateSubmission,
  reopenTask,
  submitCompletion,
  withdrawClaim,
} from './microVolunteerService.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');
const DUE = '2026-12-04';

const operator = {
  id: 'operator-ward42',
  role: 'staff',
  microVolunteerRole: 'operator',
  jurisdictionIds: ['WARD-042'],
};
const operatorOtherWard = {
  id: 'operator-ward84',
  role: 'staff',
  microVolunteerRole: 'operator',
  jurisdictionIds: ['WARD-084'],
};
const reviewer = {
  id: 'reviewer-ward42',
  role: 'staff',
  microVolunteerRole: 'reviewer',
  jurisdictionIds: ['WARD-042'],
};
const reviewerOtherWard = {
  id: 'reviewer-ward84',
  role: 'staff',
  microVolunteerRole: 'reviewer',
  jurisdictionIds: ['WARD-084'],
};
const admin = { id: 'admin-board', role: 'admin', microVolunteerRole: 'admin', jurisdictionIds: [] };
const citizen = { id: 'citizen-one', role: 'citizen' };
const otherCitizen = { id: 'citizen-two', role: 'citizen' };

const taskInput = (overrides = {}) => ({
  categoryId: 'link_check',
  title: 'Check the ward holiday list link',
  instructions:
    'Open the public holiday-list link from the ward notice board and confirm the page title and year.',
  jurisdictionId: 'WARD-042',
  locality: 'Indiranagar',
  timeEstimateMinutes: 10,
  dueDate: DUE,
  capacity: 1,
  evidenceRequirements: ['The public link you checked', 'The page title and any error message'],
  safetyAcknowledgements: {
    no_private_data: true,
    no_enforcement: true,
    no_unsafe_activity: true,
    separate_from_official_application: true,
  },
  safetyNote: 'Never enter a password, OTP or personal detail on a page you are checking.',
  source: 'Municipal volunteer desk · Ward 42',
  publish: true,
  ...overrides,
});

const expectCode = (work, code) => {
  let caught = null;
  try {
    work();
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected ${code} to be thrown`).toBeTruthy();
  expect(caught.code).toBe(code);
};

describe('microVolunteerService (#759)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    resetMicroVolunteerStorageToEmpty({ storage, now: NOW.toISOString() });
  });

  const createOpenTask = (overrides = {}) =>
    createTask(taskInput(overrides), { actor: operator, storage, now: NOW }).task;

  const claim = (taskPublicRef, actor = citizen, key = 'claim-key-0001') =>
    claimTask(taskPublicRef, { actor, idempotencyKey: key, storage, now: NOW }).claim;

  const submit = (claimPublicRef, note = 'I opened the public link and checked the page title and year.', key = 'submission-key-0001') =>
    submitCompletion(
      claimPublicRef,
      { note, link: 'https://example.gov.in/ward-42/holidays', files: [] },
      { actor: citizen, idempotencyKey: key, storage, now: NOW }
    ).submission;

  it('runs the full claim, submit, moderate and reopen lifecycle', () => {
    const task = createOpenTask();
    expect(task.status).toBe(TASK_STATUS.OPEN);
    expect(task.publicRef).toMatch(/^MVT-\d{4}-\d{3}$/);

    const activeClaim = claim(task.publicRef);
    expect(activeClaim.status).toBe(CLAIM_STATUS.ACTIVE);
    expect(activeClaim.claimPublicRef).toMatch(/^MVC-\d{4}-\d{3}$/);

    const submission = submit(activeClaim.claimPublicRef);
    expect(submission.status).toBe(COMPLETION_STATUS.SUBMITTED);

    const pending = listModerationQueue({}, { actor: reviewer, storage, now: NOW });
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0].taskPublicRef).toBe(task.publicRef);
    expect(pending.items[0].contributorRef).toMatch(/^contributor-/);

    const moderated = moderateSubmission(
      submission.submissionPublicRef,
      {
        decision: MODERATION_ACTIONS.APPROVE,
        reason: 'The page title and year match the official notice.',
        publicOutcomeNote: 'The holiday-list link is current for this financial year.',
      },
      { actor: reviewer, storage, now: NOW }
    );
    expect(moderated.submission.status).toBe(COMPLETION_STATUS.APPROVED);
    expect(moderated.task.status).toBe(TASK_STATUS.COMPLETED);

    const publicDetail = getPublicTask(task.publicRef, { storage, now: NOW });
    expect(publicDetail.task.status).toBe(TASK_STATUS.COMPLETED);
    expect(publicDetail.approvedOutcomes[0].publicOutcomeNote).toContain('holiday-list link');

    const activity = listMyActivity({ actor: citizen, storage, now: NOW });
    expect(activity.claims[0].status).toBe(CLAIM_STATUS.APPROVED);
    expect(activity.submissions[0].status).toBe(COMPLETION_STATUS.APPROVED);

    const reopened = reopenTask(
      task.publicRef,
      'The official page changed after the approval; a fresh check is needed.',
      { actor: reviewer, storage, now: NOW }
    );
    expect(reopened.status).toBe(TASK_STATUS.REOPENED);
    const reopenedSubmission = listModerationQueue(
      { status: COMPLETION_STATUS.SUBMITTED },
      { actor: reviewer, storage, now: NOW }
    );
    expect(reopenedSubmission.items).toHaveLength(0);
  });

  it('prevents duplicate claims, over-capacity claims and idempotency conflicts', () => {
    const task = createOpenTask();
    const first = claim(task.publicRef);

    const replay = claimTask(task.publicRef, {
      actor: citizen,
      idempotencyKey: 'claim-key-0001',
      storage,
      now: NOW,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.claim.claimPublicRef).toBe(first.claimPublicRef);

    expectCode(
      () => claim(task.publicRef, citizen, 'claim-key-0002'),
      MICRO_VOLUNTEER_ERROR_CODES.DUPLICATE_CLAIM
    );
    expectCode(
      () => claim(task.publicRef, otherCitizen, 'claim-key-0003'),
      MICRO_VOLUNTEER_ERROR_CODES.TASK_FULL
    );

    const secondTask = createOpenTask({ title: 'Check another public ward link' });
    expectCode(
      () => claim(secondTask.publicRef, citizen, 'claim-key-0001'),
      MICRO_VOLUNTEER_ERROR_CODES.IDEMPOTENCY_CONFLICT
    );
  });

  it('replays an identical completion and rejects a changed payload under the same key', () => {
    const task = createOpenTask();
    const activeClaim = claim(task.publicRef);
    const first = submit(activeClaim.claimPublicRef);

    const replay = submitCompletion(
      activeClaim.claimPublicRef,
      {
        note: 'I opened the public link and checked the page title and year.',
        link: 'https://example.gov.in/ward-42/holidays',
        files: [],
      },
      { actor: citizen, idempotencyKey: 'submission-key-0001', storage, now: NOW }
    );
    expect(replay.replayed).toBe(true);
    expect(replay.submission.submissionPublicRef).toBe(first.submissionPublicRef);

    expectCode(
      () =>
        submitCompletion(
          activeClaim.claimPublicRef,
          { note: 'A completely different note that should conflict.', link: '', files: [] },
          { actor: citizen, idempotencyKey: 'submission-key-0001', storage, now: NOW }
        ),
      MICRO_VOLUNTEER_ERROR_CODES.IDEMPOTENCY_CONFLICT
    );

    expectCode(
      () => submit(activeClaim.claimPublicRef, 'A second note that is not a retry.', 'submission-key-0002'),
      MICRO_VOLUNTEER_ERROR_CODES.DUPLICATE_SUBMISSION
    );
  });

  it('enforces role capabilities and jurisdiction scope', () => {
    expectCode(
      () => createTask(taskInput(), { actor: citizen, storage, now: NOW }),
      MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED
    );
    expectCode(
      () => createTask(taskInput(), { actor: operatorOtherWard, storage, now: NOW }),
      MICRO_VOLUNTEER_ERROR_CODES.JURISDICTION_DENIED
    );

    const task = createOpenTask();
    const activeClaim = claim(task.publicRef);
    const submission = submit(activeClaim.claimPublicRef);

    expectCode(
      () =>
        moderateSubmission(
          submission.submissionPublicRef,
          { decision: MODERATION_ACTIONS.APPROVE, publicOutcomeNote: 'Looks right.' },
          { actor: operator, storage, now: NOW }
        ),
      MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED
    );
    expectCode(
      () =>
        moderateSubmission(
          submission.submissionPublicRef,
          { decision: MODERATION_ACTIONS.APPROVE, publicOutcomeNote: 'Looks right.' },
          { actor: reviewerOtherWard, storage, now: NOW }
        ),
      MICRO_VOLUNTEER_ERROR_CODES.JURISDICTION_DENIED
    );
    expectCode(
      () => reopenTask(task.publicRef, 'Needs another attempt.', { actor: citizen, storage, now: NOW }),
      MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED
    );
  });

  it('blocks self-moderation by an administrator who claimed the task', () => {
    const task = createOpenTask();
    const adminClaim = claim(task.publicRef, admin, 'claim-key-admin');
    const submission = submitCompletion(
      adminClaim.claimPublicRef,
      { note: 'I checked the public link and the page title myself.', link: '', files: [] },
      { actor: admin, idempotencyKey: 'submission-key-admin', storage, now: NOW }
    ).submission;

    expectCode(
      () =>
        moderateSubmission(
          submission.submissionPublicRef,
          {
            decision: MODERATION_ACTIONS.APPROVE,
            reason: 'Approving my own work.',
            publicOutcomeNote: 'Checked.',
          },
          { actor: admin, storage, now: NOW }
        ),
      MICRO_VOLUNTEER_ERROR_CODES.SELF_MODERATION
    );
  });

  it('supports request-changes, resubmission and rejection with a reason', () => {
    const task = createOpenTask();
    const activeClaim = claim(task.publicRef);
    const first = submit(activeClaim.claimPublicRef, 'The link opened but I did not record the page title.');

    const changes = moderateSubmission(
      first.submissionPublicRef,
      {
        decision: MODERATION_ACTIONS.REQUEST_CHANGES,
        reason: 'Please include the exact page title and the financial year shown.',
      },
      { actor: reviewer, storage, now: NOW }
    );
    expect(changes.submission.status).toBe(COMPLETION_STATUS.CHANGES_REQUESTED);
    expect(changes.task.status).toBe(TASK_STATUS.REOPENED);

    const second = submitCompletion(
      activeClaim.claimPublicRef,
      {
        note: 'The page title was Ward 42 Holiday List and the year shown was 2026.',
        link: 'https://example.gov.in/ward-42/holidays',
        files: [],
      },
      { actor: citizen, idempotencyKey: 'submission-key-0002', storage, now: NOW }
    ).submission;

    const rejected = moderateSubmission(
      second.submissionPublicRef,
      {
        decision: MODERATION_ACTIONS.REJECT,
        reason: 'The linked page is for a different ward office.',
      },
      { actor: reviewer, storage, now: NOW }
    );
    expect(rejected.submission.status).toBe(COMPLETION_STATUS.REJECTED);
    expect(rejected.task.status).toBe(TASK_STATUS.REOPENED);
    expect(rejected.submission.moderationReason).toContain('different ward office');
  });

  it('blocks repeated spam notes and rate-limits rapid claims', () => {
    const firstTask = createOpenTask();
    const secondTask = createOpenTask({ title: 'Check a second public ward link' });
    const firstClaim = claim(firstTask.publicRef, citizen, 'claim-key-1001');
    const secondClaim = claim(secondTask.publicRef, citizen, 'claim-key-1002');
    const repeatedNote = 'I opened the public link and it looked correct to me today.';

    submit(firstClaim.claimPublicRef, repeatedNote, 'submission-key-1001');
    expectCode(
      () => submit(secondClaim.claimPublicRef, repeatedNote, 'submission-key-1002'),
      MICRO_VOLUNTEER_ERROR_CODES.SPAM_BLOCKED
    );

    for (let index = 0; index < 6; index += 1) {
      createOpenTask({ title: `Rate limit task ${index + 1} for the ward` });
    }
    const tasks = listTasksForStaff({ status: TASK_STATUS.OPEN, pageSize: 20 }, {
      actor: operator,
      storage,
      now: NOW,
    }).items;
    const unclaimed = tasks.filter(
      (task) => task.publicRef !== firstTask.publicRef && task.publicRef !== secondTask.publicRef
    );
    let rateLimited = null;
    for (let index = 0; index < unclaimed.length; index += 1) {
      try {
        claim(unclaimed[index].publicRef, citizen, `claim-rate-${index}`);
      } catch (error) {
        rateLimited = error;
        break;
      }
    }
    expect(rateLimited?.code).toBe(MICRO_VOLUNTEER_ERROR_CODES.RATE_LIMITED);
  });

  it('withdraws a claim and reopens the task when no active claim remains', () => {
    const task = createOpenTask();
    const activeClaim = claim(task.publicRef);
    const withdrawn = withdrawClaim(activeClaim.claimPublicRef, 'I cannot complete this today.', {
      actor: citizen,
      storage,
      now: NOW,
    });
    expect(withdrawn.status).toBe(CLAIM_STATUS.WITHDRAWN);
    const publicDetail = getPublicTask(task.publicRef, { storage, now: NOW });
    expect(publicDetail.task.status).toBe(TASK_STATUS.OPEN);
    expect(publicDetail.task.openPlaces).toBe(1);
  });

  it('keeps drafts private and lets an operator publish them', () => {
    const draft = createTask(taskInput({ publish: false }), { actor: operator, storage, now: NOW }).task;
    expect(draft.status).toBe(TASK_STATUS.DRAFT);

    const publicPage = listPublicTasks({}, { storage, now: NOW });
    expect(publicPage.items.some((task) => task.publicRef === draft.publicRef)).toBe(false);

    const staffDrafts = listTasksForStaff({ status: TASK_STATUS.DRAFT }, { actor: operator, storage, now: NOW });
    expect(staffDrafts.items.map((task) => task.publicRef)).toContain(draft.publicRef);
  });

  it('archives instead of deleting and keeps the audit trail', () => {
    const task = createOpenTask();
    const archived = archiveTask(task.publicRef, 'Duplicate of an existing ward task.', {
      actor: admin,
      storage,
      now: NOW,
    });
    expect(archived.status).toBe(TASK_STATUS.ARCHIVED);
    expect(listPublicTasks({}, { storage, now: NOW }).items).toHaveLength(0);

    const audit = listAuditEvents({}, { actor: reviewer, storage, now: NOW });
    expect(audit.items.some((event) => event.action === 'task_archived')).toBe(true);
    expect(audit.items.find((event) => event.action === 'task_archived').reason).toContain('Duplicate');
  });

  it('produces deterministic, explainable suggestions and records human decisions', () => {
    const linkTask = createOpenTask();
    createTask(
      taskInput({
        categoryId: 'notice_translation',
        title: 'Translate the ward water notice into Kannada',
        jurisdictionId: 'WARD-084',
        timeEstimateMinutes: 40,
      }),
      { actor: operatorOtherWard, storage, now: NOW }
    );

    const preferences = {
      categoryIds: ['link_check'],
      jurisdictionId: 'WARD-042',
      availableMinutes: 15,
    };
    const firstRun = buildRecommendationsForActor(preferences, { actor: citizen, storage, now: NOW });
    const secondRun = buildRecommendationsForActor(preferences, { actor: citizen, storage, now: NOW });

    expect(firstRun.rulesetVersion).toMatch(/^micro-volunteer-match-/);
    expect(firstRun.inputWindow.evaluatedAt).toBe(NOW.toISOString());
    expect(firstRun.recommendations[0].taskPublicRef).toBe(linkTask.publicRef);
    expect(firstRun.recommendations[0].reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(['category_match', 'same_jurisdiction', 'fits_time'])
    );
    expect(firstRun.recommendations.map((item) => [item.taskPublicRef, item.score])).toEqual(
      secondRun.recommendations.map((item) => [item.taskPublicRef, item.score])
    );

    const accepted = decideRecommendation(
      firstRun.runPublicRef,
      linkTask.publicRef,
      { decision: 'accept', reason: 'I can do this today.' },
      { actor: citizen, storage, now: NOW }
    );
    expect(accepted.recommendations[0].status).toBe('accepted');

    expectCode(
      () =>
        decideRecommendation(
          firstRun.runPublicRef,
          linkTask.publicRef,
          { decision: 'reject', reason: 'Not mine.' },
          { actor: otherCitizen, storage, now: NOW }
        ),
      MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED
    );
  });

  it('never exposes account ids, internal record ids or private moderation notes publicly', () => {
    const task = createOpenTask();
    const activeClaim = claim(task.publicRef);
    const submission = submit(activeClaim.claimPublicRef);
    moderateSubmission(
      submission.submissionPublicRef,
      {
        decision: MODERATION_ACTIONS.APPROVE,
        reason: 'Private reviewer note that must stay internal.',
        publicOutcomeNote: 'The public link is current.',
      },
      { actor: reviewer, storage, now: NOW }
    );

    const publicPayload = JSON.stringify({
      board: listPublicTasks({}, { storage, now: NOW }),
      detail: getPublicTask(task.publicRef, { storage, now: NOW }),
    });
    expect(publicPayload).not.toContain('citizen-one');
    expect(publicPayload).not.toContain('operator-ward42');
    expect(publicPayload).not.toContain('reviewer-ward42');
    expect(publicPayload).not.toContain('Private reviewer note');
    expect(publicPayload).not.toContain('idempotencyKey');
    expect(publicPayload).not.toContain('payloadHash');
    expect(publicPayload).not.toContain('createdBy');
    expect(publicPayload).not.toContain('mvt_');
    expect(publicPayload).not.toContain('mvc_');
    expect(publicPayload).not.toContain('mvs_');
  });
});
