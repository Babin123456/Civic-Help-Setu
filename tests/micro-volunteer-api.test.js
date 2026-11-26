import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMicroVolunteerHandler,
  createTestMicroVolunteerRepository,
} from '../api/_lib/handlers/micro-volunteer.js';
import { createRateLimiter } from '../api/_lib/abuseGuard.js';

const VALID_TOKEN = 'valid-session-token-123456';
const CITIZEN_TOKEN = 'citizen-session-token-123456';

const operator = {
  id: 'operator-ward42',
  role: 'staff',
  microVolunteerRole: 'operator',
  jurisdictionIds: ['WARD-042'],
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
const citizen = { id: 'citizen-one', role: 'citizen' };

const dueWithinWindow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
};

const taskPayload = (overrides = {}) => ({
  categoryId: 'link_check',
  title: 'Check the ward holiday list link',
  instructions:
    'Open the public holiday-list link from the ward notice board and confirm the page title and year.',
  jurisdictionId: 'WARD-042',
  locality: 'Indiranagar',
  timeEstimateMinutes: 10,
  dueDate: dueWithinWindow(),
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

const buildHandler = ({
  actor = operator,
  repository = createTestMicroVolunteerRepository(),
  ipLimiter = createRateLimiter({ limit: 100, windowMs: 60_000 }),
} = {}) => {
  const handler = createMicroVolunteerHandler({
    verifySession: async (token) => {
      if (token !== VALID_TOKEN && token !== CITIZEN_TOKEN) throw new Error('invalid');
      return { userId: token === CITIZEN_TOKEN ? citizen.id : actor.id };
    },
    resolveActor: async () => actor,
    repository,
    ipLimiter,
  });
  return { handler, repository };
};

const post = (handler, body, token = VALID_TOKEN, headers = {}) =>
  handler({
    method: 'POST',
    headers: {
      authorization: token ? `Bearer ${token}` : '',
      'x-vercel-forwarded-for': '203.0.113.10',
      ...headers,
    },
    body,
  });

const get = (handler, query = {}) => handler({ method: 'GET', headers: {}, query });

const createTask = async (handler, overrides = {}) => {
  const response = await post(handler, {
    action: 'create_task',
    idempotencyKey: `task-key-${Math.random().toString(36).slice(2, 10)}`,
    task: taskPayload(overrides),
  });
  return response;
};

const expectNoInternalIds = (payload) => {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(/mvt_|mvc_|mvs_/);
  expect(serialized).not.toContain('idempotencyKey');
  expect(serialized).not.toContain('payloadHash');
  expect(serialized).not.toContain('createdBy');
  expect(serialized).not.toContain('citizenId');
};

describe('api/micro-volunteer (#759)', () => {
  let handler;
  let repository;

  beforeEach(() => {
    ({ handler, repository } = buildHandler());
  });

  it('serves the public board projection without internal identifiers', async () => {
    const response = await get(handler, { jurisdictionId: 'ward-042' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.summary).toBeTruthy();
    expect(response.body.categories.length).toBeGreaterThan(0);
    expect(response.body.rulesetVersion).toMatch(/^micro-volunteer-match-/);
    expect(response.body.disclosure).toContain('not official government applications');
    expect(response.headers['Cache-Control']).toBe('no-store');
    expectNoInternalIds(response.body);
  });

  it('serves task detail, categories and summary views', async () => {
    const board = await get(handler);
    const publicRef = board.body.items[0].publicRef;

    const detail = await get(handler, { view: 'task', ref: publicRef });
    expect(detail.status).toBe(200);
    expect(detail.body.task.publicRef).toBe(publicRef);
    expectNoInternalIds(detail.body);

    const categories = await get(handler, { view: 'categories' });
    expect(categories.status).toBe(200);
    expect(categories.body.counts.length).toBeGreaterThan(0);

    const summary = await get(handler, { view: 'summary', jurisdictionId: 'WARD-042' });
    expect(summary.status).toBe(200);
    expect(summary.body.summary.jurisdictionId).toBe('WARD-042');
  });

  it('rejects unsupported methods and unknown actions with stable error codes', async () => {
    const method = await handler({ method: 'DELETE', headers: {}, body: null });
    expect(method.status).toBe(405);
    expect(method.body.error).toBe('method_not_allowed');
    expect(method.headers.Allow).toBe('GET, POST');

    const unknown = await post(handler, { action: 'delete_everything' });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error).toBe('MICRO_VOLUNTEER_VALIDATION_ERROR');
  });

  it('requires a verified session for every write action', async () => {
    const missing = await post(handler, { action: 'create_task', task: taskPayload() }, null);
    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe('MICRO_VOLUNTEER_UNAUTHENTICATED');

    const invalid = await post(handler, { action: 'create_task', task: taskPayload() }, 'expired-token-123456');
    expect(invalid.status).toBe(401);

    const stored = repository.storage.getItem('civic_micro_volunteer_board_v1');
    expect(stored || '').not.toContain('Check the ward holiday list link');
  });

  it('returns 503 when the server-side sign-in verifier is not configured', async () => {
    const unconfigured = createMicroVolunteerHandler({ repository: createTestMicroVolunteerRepository() });
    const response = await post(unconfigured, { action: 'create_task', task: taskPayload() });
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('auth_not_configured');
  });

  it('runs create, claim, submit and moderate through the API boundary', async () => {
    const created = await createTask(handler);
    expect(created.status).toBe(201);
    const taskPublicRef = created.body.task.publicRef;
    expect(taskPublicRef).toMatch(/^MVT-\d{4}-\d{3}$/);

    const citizenHandler = buildHandler({ actor: citizen, repository }).handler;
    const claimed = await post(
      citizenHandler,
      { action: 'claim_task', taskPublicRef, idempotencyKey: 'claim-key-0001' },
      CITIZEN_TOKEN
    );
    expect(claimed.status).toBe(201);
    const claimPublicRef = claimed.body.claim.claimPublicRef;

    const replay = await post(
      citizenHandler,
      { action: 'claim_task', taskPublicRef, idempotencyKey: 'claim-key-0001' },
      CITIZEN_TOKEN
    );
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);

    const submitted = await post(
      citizenHandler,
      {
        action: 'submit_completion',
        claimPublicRef,
        idempotencyKey: 'submission-key-0001',
        evidence: {
          note: 'I opened the public link and checked the page title and year.',
          link: 'https://example.gov.in/ward-42/holidays',
          files: [],
        },
      },
      CITIZEN_TOKEN
    );
    expect(submitted.status).toBe(201);
    const submissionPublicRef = submitted.body.submission.submissionPublicRef;

    const reviewerHandler = buildHandler({ actor: reviewer, repository }).handler;
    const approved = await post(reviewerHandler, {
      action: 'moderate_submission',
      submissionPublicRef,
      decision: {
        decision: 'approve',
        reason: 'The page title and year match the official notice.',
        publicOutcomeNote: 'The holiday-list link is current for this financial year.',
      },
    });
    expect(approved.status).toBe(200);
    expect(approved.body.submission.status).toBe('approved');
    expect(approved.body.task.status).toBe('completed');
    expectNoInternalIds(approved.body);
  });

  it('awards the last place to only one of two concurrent claims', async () => {
    const created = await createTask(handler);
    const taskPublicRef = created.body.task.publicRef;

    const firstCitizen = buildHandler({
      actor: { id: 'citizen-one', role: 'citizen' },
      repository,
    }).handler;
    const secondCitizen = buildHandler({
      actor: { id: 'citizen-two', role: 'citizen' },
      repository,
    }).handler;

    const [first, second] = await Promise.all([
      post(
        firstCitizen,
        { action: 'claim_task', taskPublicRef, idempotencyKey: 'race-claim-0001' },
        CITIZEN_TOKEN
      ),
      post(
        secondCitizen,
        { action: 'claim_task', taskPublicRef, idempotencyKey: 'race-claim-0002' },
        VALID_TOKEN
      ),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
    const rejected = first.status === 409 ? first : second;
    expect(rejected.body.error).toBe('MICRO_VOLUNTEER_TASK_FULL');
  });

  it('enforces least privilege and jurisdiction scope on the server', async () => {
    const citizenCreate = await createTask(buildHandler({ actor: citizen }).handler);
    expect(citizenCreate.status).toBe(403);
    expect(citizenCreate.body.error).toBe('MICRO_VOLUNTEER_PERMISSION_DENIED');

    const otherWardCreate = await createTask(
      buildHandler({ actor: { ...operator, jurisdictionIds: ['WARD-084'] } }).handler
    );
    expect(otherWardCreate.status).toBe(403);
    expect(otherWardCreate.body.error).toBe('MICRO_VOLUNTEER_JURISDICTION_DENIED');

    const created = await createTask(handler);
    const taskPublicRef = created.body.task.publicRef;
    const citizenHandler = buildHandler({ actor: citizen, repository }).handler;
    const claimed = await post(
      citizenHandler,
      { action: 'claim_task', taskPublicRef, idempotencyKey: 'claim-scope-0001' },
      CITIZEN_TOKEN
    );
    const claimPublicRef = claimed.body.claim.claimPublicRef;
    const submitted = await post(
      citizenHandler,
      {
        action: 'submit_completion',
        claimPublicRef,
        idempotencyKey: 'submission-scope-0001',
        evidence: {
          note: 'I opened the public link and checked the page title and year.',
          link: '',
          files: [],
        },
      },
      CITIZEN_TOKEN
    );

    const wrongWardReview = await post(buildHandler({ actor: reviewerOtherWard, repository }).handler, {
      action: 'moderate_submission',
      submissionPublicRef: submitted.body.submission.submissionPublicRef,
      decision: { decision: 'approve', publicOutcomeNote: 'Looks right.' },
    });
    expect(wrongWardReview.status).toBe(403);
    expect(wrongWardReview.body.error).toBe('MICRO_VOLUNTEER_JURISDICTION_DENIED');

    const auditDenied = await post(citizenHandler, { action: 'audit_events' }, CITIZEN_TOKEN);
    expect(auditDenied.status).toBe(403);
    expect(auditDenied.body.error).toBe('MICRO_VOLUNTEER_PERMISSION_DENIED');
  });

  it('rate-limits repeated writes and sets Retry-After', async () => {
    const limited = buildHandler({
      ipLimiter: createRateLimiter({ limit: 2, windowMs: 60_000 }),
    }).handler;

    await post(limited, { action: 'audit_events' });
    await post(limited, { action: 'audit_events' });
    const blocked = await post(limited, { action: 'audit_events' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('MICRO_VOLUNTEER_RATE_LIMITED');
    expect(blocked.headers['Retry-After']).toBeTruthy();
  });

  it('rejects oversized bodies before parsing', async () => {
    const huge = await post(handler, { action: 'create_task', task: taskPayload({ title: 'x'.repeat(70_000) }) });
    expect(huge.status).toBe(413);
    expect(huge.body.error).toBe('payload_too_large');
  });

  it('sanitizes search input and never enumerates internal record ids', async () => {
    const board = await get(handler);
    const publicRef = board.body.items[0].publicRef;

    const injected = await get(handler, {
      search: "' OR 1=1 -- <script>alert(1)</script>",
      categoryId: 'link_check',
    });
    expect(injected.status).toBe(200);
    expect(JSON.stringify(injected.body)).not.toContain('<script>');

    const internalId = await get(handler, { view: 'task', ref: 'mvt_2026_001' });
    expect(internalId.status).toBe(404);
    expect(internalId.body.error).toBe('MICRO_VOLUNTEER_NOT_FOUND');

    const detail = await get(handler, { view: 'task', ref: publicRef });
    expectNoInternalIds(detail.body);
  });

  it('replays an identical idempotent action and rejects a changed payload', async () => {
    const first = await createTask(handler, { title: 'Check the ward notice link' });
    const body = {
      action: 'create_task',
      idempotencyKey: 'task-replay-key-0001',
      task: taskPayload({ title: 'Check the ward notice link' }),
    };

    const created = await post(handler, body);
    expect(created.status).toBe(201);
    const replay = await post(handler, body);
    expect(replay.status).toBe(201);
    expect(replay.body.task.publicRef).toBe(created.body.task.publicRef);

    const conflict = await post(handler, {
      ...body,
      task: taskPayload({ title: 'A different task under the same key' }),
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toBe('MICRO_VOLUNTEER_IDEMPOTENCY_CONFLICT');

    expect(first.status).toBe(201);
  });
});
