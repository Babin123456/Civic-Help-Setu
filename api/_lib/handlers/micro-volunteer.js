/**
 * api/_lib/handlers/micro-volunteer.js
 * Server-side boundary for the Civic Micro-Volunteer Task Board (#759).
 *
 * The browser board is the primary contributor surface. This endpoint gives
 * partner deployments and mobile clients the same typed actions with:
 *   1. a strict body size and method check;
 *   2. a per-address rate limit and single-flight retry collapse;
 *   3. Clerk session verification through injected functions (no network in tests);
 *   4. role and jurisdiction scope resolved from verified claims only;
 *   5. the same validation and state machine as the browser service;
 *   6. public projections that omit account ids, internal record ids,
 *      idempotency keys, private moderation notes and contact details.
 */

import { clientKey, createRateLimiter, createSingleFlight } from '../abuseGuard.js';
import {
  MICRO_VOLUNTEER_ERROR_CODES,
  MICRO_VOLUNTEER_RULESET_VERSION,
} from '../../../src/data/microVolunteerContract.js';
import {
  archiveTask,
  buildRecommendationsForActor,
  claimTask,
  createTask,
  decideRecommendation,
  getPublicBoardSummary,
  getPublicTask,
  listAuditEvents,
  listModerationQueue,
  listMyActivity,
  listPublicCategoriesWithCounts,
  listPublicTasks,
  listTaskCategories,
  listJurisdictions,
  moderateSubmission,
  publishTask,
  reopenTask,
  runRetentionPolicy,
  submitCompletion,
  updateTask,
  withdrawClaim,
} from '../../../src/services/microVolunteerService.js';
import { MicroVolunteerError, toUserMessage } from '../../../src/services/microVolunteerValidation.js';
import {
  createMicroVolunteerMemoryRepository,
  defaultMicroVolunteerRepository,
} from '../microVolunteerRepository.js';

const MAX_BODY_BYTES = 64 * 1024;

const STATUS_BY_CODE = Object.freeze({
  [MICRO_VOLUNTEER_ERROR_CODES.NOT_FOUND]: 404,
  [MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR]: 422,
  [MICRO_VOLUNTEER_ERROR_CODES.UNAUTHENTICATED]: 401,
  [MICRO_VOLUNTEER_ERROR_CODES.PERMISSION_DENIED]: 403,
  [MICRO_VOLUNTEER_ERROR_CODES.JURISDICTION_DENIED]: 403,
  [MICRO_VOLUNTEER_ERROR_CODES.SELF_MODERATION]: 403,
  [MICRO_VOLUNTEER_ERROR_CODES.INVALID_TRANSITION]: 409,
  [MICRO_VOLUNTEER_ERROR_CODES.DUPLICATE_CLAIM]: 409,
  [MICRO_VOLUNTEER_ERROR_CODES.TASK_FULL]: 409,
  [MICRO_VOLUNTEER_ERROR_CODES.TASK_CLOSED]: 409,
  [MICRO_VOLUNTEER_ERROR_CODES.TASK_EXPIRED]: 409,
  [MICRO_VOLUNTEER_ERROR_CODES.DUPLICATE_SUBMISSION]: 409,
  [MICRO_VOLUNTEER_ERROR_CODES.IDEMPOTENCY_CONFLICT]: 409,
  [MICRO_VOLUNTEER_ERROR_CODES.RATE_LIMITED]: 429,
  [MICRO_VOLUNTEER_ERROR_CODES.SPAM_BLOCKED]: 429,
  [MICRO_VOLUNTEER_ERROR_CODES.UNSUPPORTED_FILE]: 422,
  [MICRO_VOLUNTEER_ERROR_CODES.STORAGE_UNAVAILABLE]: 503,
  [MICRO_VOLUNTEER_ERROR_CODES.MIGRATION_FAILED]: 503,
});

const PUBLIC_DISCLOSURE =
  'Micro-volunteer tasks are neighbourhood contributions. They are not official government applications, decisions or enforcement actions. Only approved outcomes appear on the public board.';

const fail = (status, code, message = null, details = null, extraHeaders = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  body: {
    ok: false,
    error: code,
    message: message || toUserMessage({ code }),
    ...(details ? { details } : {}),
  },
});

const ok = (body = {}, status = 200) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: { ok: true, ...body },
});

const bearerToken = (headers = {}) => {
  const key = Object.keys(headers).find((name) => name.toLowerCase() === 'authorization');
  const value = key ? headers[key] : '';
  const match =
    typeof value === 'string' ? /^Bearer ([A-Za-z0-9._~+/=-]{10,4096})$/.exec(value.trim()) : null;
  return match ? match[1] : null;
};

const utf8Bytes = (value) => new TextEncoder().encode(value).length;

const bodySize = (body) => {
  if (body == null) return 0;
  if (typeof body === 'string') return utf8Bytes(body);
  try {
    return utf8Bytes(JSON.stringify(body));
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const sanitizeFilter = (value, max = 80) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const parseBody = (body) => {
  if (body == null) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return typeof body === 'object' ? body : null;
};

const publicMeta = () => ({
  rulesetVersion: MICRO_VOLUNTEER_RULESET_VERSION,
  disclosure: PUBLIC_DISCLOSURE,
});

const getActor = async ({ headers, verifySession, resolveActor }) => {
  const token = bearerToken(headers);
  if (!token) {
    return { error: fail(401, MICRO_VOLUNTEER_ERROR_CODES.UNAUTHENTICATED) };
  }
  let verified;
  try {
    verified = await verifySession(token);
  } catch {
    return { error: fail(401, MICRO_VOLUNTEER_ERROR_CODES.UNAUTHENTICATED, 'The staff session has expired. Sign in again.') };
  }
  if (!verified || typeof verified.userId !== 'string' || !verified.userId) {
    return { error: fail(401, MICRO_VOLUNTEER_ERROR_CODES.UNAUTHENTICATED) };
  }
  let actor;
  try {
    actor = await resolveActor(verified.userId);
  } catch {
    return { error: fail(401, MICRO_VOLUNTEER_ERROR_CODES.UNAUTHENTICATED) };
  }
  if (!actor || typeof actor !== 'object') {
    return { error: fail(401, MICRO_VOLUNTEER_ERROR_CODES.UNAUTHENTICATED) };
  }
  return { actor: { ...actor, id: actor.id || verified.userId } };
};

export function createMicroVolunteerHandler({
  verifySession = null,
  resolveActor = null,
  repository = null,
  ipLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 }),
} = {}) {
  const singleFlight = createSingleFlight();
  const repo = repository || defaultMicroVolunteerRepository;
  const storage = repo.storage;

  const withActor = async (context) => {
    if (typeof verifySession !== 'function' || typeof resolveActor !== 'function') {
      return { error: fail(503, 'auth_not_configured', 'The server-side sign-in verifier is not configured. Use the browser board or configure Clerk.') };
    }
    return getActor({ ...context, verifySession, resolveActor });
  };

  return async function handle({ method, headers = {}, body = null, query = {} }) {
    if (method === 'GET') {
      const view = sanitizeFilter(query.view, 40) || 'board';
      const now = new Date();
      try {
        if (view === 'task') {
          const ref = sanitizeFilter(query.ref, 120);
          if (!ref) return fail(422, MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR, 'A task reference is required.');
          const detail = getPublicTask(ref, { storage, now });
          return ok({ ...detail, ...publicMeta(), generatedAt: now.toISOString() });
        }
        if (view === 'categories') {
          return ok({ categories: listTaskCategories(), counts: listPublicCategoriesWithCounts({ storage, now }), ...publicMeta() });
        }
        if (view === 'summary') {
          return ok({
            summary: getPublicBoardSummary(
              { jurisdictionId: sanitizeFilter(query.jurisdictionId, 40) || null },
              { storage, now }
            ),
            ...publicMeta(),
          });
        }
        if (['my_activity', 'moderation_queue', 'audit'].includes(view)) {
          const auth = await withActor({ headers, verifySession, resolveActor });
          if (auth.error) return auth.error;
          if (view === 'my_activity') {
            return ok({ activity: listMyActivity({ actor: auth.actor, storage, now }), ...publicMeta() });
          }
          if (view === 'moderation_queue') {
            return ok({
              queue: listModerationQueue(
                {
                  page: query.page,
                  pageSize: query.pageSize,
                  status: sanitizeFilter(query.status, 40) || undefined,
                  jurisdictionId: sanitizeFilter(query.jurisdictionId, 40) || undefined,
                },
                { actor: auth.actor, storage, now }
              ),
              ...publicMeta(),
            });
          }
          return ok({
            events: listAuditEvents(
              {
                page: query.page,
                pageSize: query.pageSize,
                taskPublicRef: sanitizeFilter(query.taskPublicRef, 120) || null,
              },
              { actor: auth.actor, storage, now }
            ),
            ...publicMeta(),
          });
        }

        const tasks = listPublicTasks(
          {
            page: query.page,
            pageSize: query.pageSize,
            status: sanitizeFilter(query.status, 40) || undefined,
            categoryId: sanitizeFilter(query.categoryId, 60) || undefined,
            jurisdictionId: sanitizeFilter(query.jurisdictionId, 40) || undefined,
            search: sanitizeFilter(query.search, 80),
            sort: sanitizeFilter(query.sort, 20) || undefined,
          },
          { storage, now }
        );
        return ok({
          summary: getPublicBoardSummary(
            { jurisdictionId: sanitizeFilter(query.jurisdictionId, 40) || null },
            { storage, now }
          ),
          categories: listTaskCategories(),
          jurisdictions: listJurisdictions({ storage, now }),
          ...tasks,
          ...publicMeta(),
          generatedAt: now.toISOString(),
        });
      } catch (error) {
        if (error instanceof MicroVolunteerError) {
          return fail(STATUS_BY_CODE[error.code] || 400, error.code, error.message, error.details);
        }
        return fail(500, 'internal_error', 'The board could not be read. Try again.');
      }
    }

    if (method !== 'POST') {
      return fail(405, 'method_not_allowed', 'Use GET for public board data or POST for a board action.', null, {
        Allow: 'GET, POST',
      });
    }

    if (bodySize(body) > MAX_BODY_BYTES) {
      return fail(413, 'payload_too_large', `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
    }

    const address = clientKey(headers) || 'unknown';
    const verdict = ipLimiter.take(address);
    if (!verdict.allowed) {
      return fail(
        429,
        MICRO_VOLUNTEER_ERROR_CODES.RATE_LIMITED,
        'Too many board actions from this address. Wait for the retry window.',
        { retryAfterSeconds: verdict.retryAfterSeconds },
        { 'Retry-After': String(verdict.retryAfterSeconds) }
      );
    }

    const auth = await withActor({ headers, verifySession, resolveActor });
    if (auth.error) return auth.error;
    const actor = auth.actor;

    const payload = parseBody(body);
    if (!payload) {
      return fail(422, MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR, 'Malformed JSON payload.');
    }

    const action = sanitizeFilter(payload.action, 40);
    if (!action) {
      return fail(422, MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR, 'An action is required.');
    }

    const flightKey = `${actor.id}:${action}:${sanitizeFilter(payload.idempotencyKey, 128) || sanitizeFilter(payload.taskPublicRef, 120) || sanitizeFilter(payload.claimPublicRef, 120) || sanitizeFilter(payload.submissionPublicRef, 120)}`;
    const now = new Date();

    return singleFlight.run(flightKey, async () => {
      try {
        switch (action) {
          case 'create_task': {
            const result = createTask(payload.task || payload, {
              actor,
              idempotencyKey: payload.idempotencyKey || null,
              storage,
              now,
            });
            return ok({ ...result, ...publicMeta() }, 201);
          }
          case 'update_task': {
            const task = updateTask(payload.taskPublicRef, payload.updates || {}, { actor, storage, now });
            return ok({ task, ...publicMeta() });
          }
          case 'publish_task': {
            const task = publishTask(payload.taskPublicRef, { actor, storage, now });
            return ok({ task, ...publicMeta() });
          }
          case 'archive_task': {
            const task = archiveTask(payload.taskPublicRef, payload.reason, { actor, storage, now });
            return ok({ task, ...publicMeta() });
          }
          case 'claim_task': {
            const result = claimTask(payload.taskPublicRef, {
              actor,
              idempotencyKey: payload.idempotencyKey || null,
              storage,
              now,
            });
            return ok({ ...result, ...publicMeta() }, result.replayed ? 200 : 201);
          }
          case 'withdraw_claim': {
            const claim = withdrawClaim(payload.claimPublicRef, payload.reason, { actor, storage, now });
            return ok({ claim, ...publicMeta() });
          }
          case 'submit_completion': {
            const result = submitCompletion(payload.claimPublicRef, payload.evidence || {}, {
              actor,
              idempotencyKey: payload.idempotencyKey || null,
              storage,
              now,
            });
            return ok({ ...result, ...publicMeta() }, result.replayed ? 200 : 201);
          }
          case 'moderate_submission': {
            const moderationInput =
              payload.decision && typeof payload.decision === 'object'
                ? payload.decision
                : {
                    decision: payload.decision,
                    reason: payload.reason,
                    publicOutcomeNote: payload.publicOutcomeNote,
                  };
            const result = moderateSubmission(payload.submissionPublicRef, moderationInput, {
              actor,
              storage,
              now,
            });
            return ok({ ...result, ...publicMeta() });
          }
          case 'reopen_task': {
            const task = reopenTask(payload.taskPublicRef, payload.reason, { actor, storage, now });
            return ok({ task, ...publicMeta() });
          }
          case 'generate_recommendations': {
            const run = buildRecommendationsForActor(payload.preferences || {}, { actor, storage, now });
            return ok({ run, ...publicMeta() });
          }
          case 'decide_recommendation': {
            const decisionInput =
              payload.decision && typeof payload.decision === 'object'
                ? payload.decision
                : {
                    decision: payload.decision,
                    editedCategoryId: payload.editedCategoryId,
                    reason: payload.reason,
                  };
            const run = decideRecommendation(
              payload.runPublicRef,
              payload.taskPublicRef,
              decisionInput,
              { actor, storage, now }
            );
            return ok({ run, ...publicMeta() });
          }
          case 'my_activity': {
            return ok({ activity: listMyActivity({ actor, storage, now }), ...publicMeta() });
          }
          case 'moderation_queue': {
            return ok({
              queue: listModerationQueue(payload.filters || {}, { actor, storage, now }),
              ...publicMeta(),
            });
          }
          case 'audit_events': {
            return ok({
              events: listAuditEvents(payload.filters || {}, { actor, storage, now }),
              ...publicMeta(),
            });
          }
          case 'run_retention': {
            const counts = runRetentionPolicy({ actor, storage, now });
            return ok({ counts, ...publicMeta() });
          }
          default:
            return fail(422, MICRO_VOLUNTEER_ERROR_CODES.VALIDATION_ERROR, `Unknown board action: ${action}`);
        }
      } catch (error) {
        if (error instanceof MicroVolunteerError) {
          return fail(STATUS_BY_CODE[error.code] || 400, error.code, error.message, error.details);
        }
        return fail(500, 'internal_error', 'The board action could not be completed. Try again.');
      }
    });
  };
}

export const resetMicroVolunteerApiForTests = () => {
  defaultMicroVolunteerRepository.clear();
};

export const createTestMicroVolunteerRepository = () => createMicroVolunteerMemoryRepository();

let defaultHandler = null;
let defaultHandlerError = null;

export async function buildDefaultHandler() {
  /* global process */
  const { CLERK_SECRET_KEY } = process.env || {};
  if (!CLERK_SECRET_KEY) return null;
  const { verifyToken, createClerkClient } = await import('@clerk/backend');
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  return createMicroVolunteerHandler({
    verifySession: async (token) => {
      const claims = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
      return { userId: claims.sub };
    },
    resolveActor: async (userId) => {
      const user = await clerk.users.getUser(userId);
      const metadata = user.publicMetadata || {};
      return {
        id: userId,
        role: metadata.role || 'citizen',
        microVolunteerRole: metadata.microVolunteerRole || metadata.volunteerRole || null,
        jurisdictionIds: Array.isArray(metadata.jurisdictionIds)
          ? metadata.jurisdictionIds
          : metadata.jurisdictionId
            ? [metadata.jurisdictionId]
            : [],
      };
    },
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!defaultHandler && !defaultHandlerError) {
      defaultHandler = await buildDefaultHandler();
    }
  } catch (error) {
    defaultHandlerError = error;
    defaultHandler = null;
  }

  const route =
    defaultHandler ||
    createMicroVolunteerHandler({
      verifySession: null,
      resolveActor: null,
    });

  const result = await route({
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query || {},
  });

  for (const [name, value] of Object.entries(result.headers || {})) res.setHeader(name, value);
  return res.status(result.status).json(result.body);
}
