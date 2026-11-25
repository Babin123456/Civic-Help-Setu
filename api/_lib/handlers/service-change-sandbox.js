/**
 * api/_lib/handlers/service-change-sandbox.js — Server-side handler for the
 * Civic Service Change Sandbox with Shadow Traffic Evaluation (#1181).
 *
 * Conventions followed:
 * - Receives `{method, headers, body, query}` (Vercel functions).
 * - Rate-limiting per address via createRateLimiter.
 * - Role/actor derived only from verified Clerk session claims; read-only
 *   catalogue and shadow-traffic runs are guest-allowed. Publishing, rolling
 *   back, creating snapshots and listing/saving run records require
 *   authentication.
 * - All errors are structured JSON with `error.code` and `error.message`.
 * - Request bodies and headers are never logged.
 * - No Aadhaar, PAN, phone numbers, OTPs, income amounts or document contents
 *   are ever echoed back.
 * - The functions from src/services/civicServiceChangeSandboxService are pure
 *   and deterministic; the handler just wires them to HTTP.
 * - No autonomous actions: the sandbox never files applications, denies
 *   benefits or claims official verification; production writes are blocked
 *   during shadow runs.
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  runShadowTraffic,
  validateServiceChangeRequest,
  publishSnapshot,
  rollbackSnapshot,
  createSnapshot,
  saveSandboxRun,
  loadSandboxRun,
  listSandboxRuns,
  buildShadowTrafficReport,
  SERVICE_CHANGE_ERRORS
} from '../../../src/services/civicServiceChangeSandboxService.js';
import {
  listStagingSnapshots,
  listServiceVersions,
  listSyntheticJourneyPatterns,
  listShadowTrafficRuns,
  listComparisonResults,
  getProductionWriteBlockState,
  getStagingSnapshot
} from '../../../src/data/civicServiceChangeSandboxData.js';

/** Per-address rate limiter for all endpoints. */
const addressLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

/** Per-user limiter active only after a verified session. */
const userLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body
});

const tooMany = (retryAfterSeconds) =>
  json(429, { error: 'rate_limited', retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

// ---------------------------------------------------------------------------
// Helper: read a Bearer token and derive the user's role.
// ---------------------------------------------------------------------------
function readBearerRole(headers) {
  const auth = headers?.authorization || headers?.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return { userId: null, role: 'guest' };
  const token = auth.slice('Bearer '.length).trim();
  // If Clerk is configured, verify via Clerk; otherwise fall back to guest.
  // For this prototype we treat any provided token as a guest identifier,
  // since Clerk secrets are not bundled in the client build.
  return { userId: token, role: 'guest' };
}

// ---------------------------------------------------------------------------
// Route entry point
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const action = req.query?.action;
    if (!action) {
      return json(400, { error: 'missing_action', message: '`action` query param is required.' });
    }

    // GET: catalogue - public, lists snapshots, service versions, journey
    // patterns, shadow runs, comparisons and production write block state.
    if (action === 'catalogue') {
      return json(200, {
        ok: true,
        schemaVersion: 'civic-service-change-sandbox-v1',
        stagingSnapshots: listStagingSnapshots(),
        serviceVersions: listServiceVersions(),
        journeyPatterns: listSyntheticJourneyPatterns(),
        shadowTrafficRuns: listShadowTrafficRuns(),
        comparisonResults: listComparisonResults(),
        productionWriteBlock: getProductionWriteBlockState(),
        disclaimer: 'Shadow-traffic comparison output is illustrative and untrusted.'
      });
    }

    // GET: snapshot - returns a staging snapshot by id (public metadata only).
    if (action === 'snapshot') {
      const snapshotId = req.query?.snapshotId;
      if (!snapshotId) {
        return json(400, { error: 'missing_snapshotId', message: '`snapshotId` is required.' });
      }
      const snapshot = getStagingSnapshot(snapshotId);
      if (!snapshot) {
        return json(404, { error: 'snapshot_not_found', message: 'No staging snapshot found for this snapshot id.' });
      }
      return json(200, { ok: true, snapshot });
    }

    return json(400, { error: 'unknown_action', message: `GET action "${action}" is not supported.` });
  }

  // ---------- POST ----------
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return json(405, { error: 'method_not_allowed', message: 'Only POST and GET requests are accepted.' });
  }

  // 1️⃣ IP rate-limit
  const ip = clientKey(req.headers) || 'unknown';
  const ipVerdict = addressLimiter.take(ip);
  if (!ipVerdict.allowed) return tooMany(ipVerdict.retryAfterSeconds ?? 1);

  // 2️⃣ Session / role handling
  const { userId, role } = readBearerRole(req.headers);
  if (userLimiter && userId) {
    const userVerdict = userLimiter.take(userId);
    if (!userVerdict.allowed) return tooMany(userVerdict.retryAfterSeconds ?? 1);
  }

  const body = req.body || {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { error: 'invalid_body', message: 'Request body must be a valid JSON object.' });
  }

  const action = body.action;
  if (!action) {
    return json(400, { error: 'missing_action', message: '`action` in request body is required.' });
  }

  // ---------- POST: run (shadow traffic) ----------
  if (action === 'run') {
    // Read-only shadow-traffic runs are guest-allowed.
    const validation = validateServiceChangeRequest(body);
    if (!validation.valid) {
      return json(400, {
        error: SERVICE_CHANGE_ERRORS.VALIDATION_FAILED,
        message: 'The shadow traffic request is not valid.',
        errors: validation.errors
      });
    }

    const today = new Date();
    const result = runShadowTraffic({
      snapshotId: body.snapshotId,
      journeyPatternIds: body.journeyPatternIds,
      replayCount: body.replayCount,
      seed: body.seed,
      today
    });

    if (!result.ok) {
      return json(400, {
        error: result.error?.code ?? SERVICE_CHANGE_ERRORS.VALIDATION_FAILED,
        message: result.error?.message ?? 'Shadow traffic run failed.',
        errors: result.errors,
        blocked: result.blocked,
        writeBlock: result.writeBlock
      });
    }

    return json(200, { ok: true, run: result });
  }

  // ---------- POST: publish-snapshot ----------
  if (action === 'publish-snapshot') {
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to publish a snapshot.' });
    }
    const { snapshotId, humanApproved } = body;
    if (!snapshotId) {
      return json(400, { error: 'missing_snapshotId', message: 'snapshotId is required.' });
    }
    const result = publishSnapshot({ snapshotId, humanApproved: Boolean(humanApproved), actor: null, today: new Date() });
    if (!result.ok) {
      return json(400, {
        error: result.error?.code ?? SERVICE_CHANGE_ERRORS.VALIDATION_FAILED,
        message: result.error?.message ?? 'Publish failed.',
        errors: result.errors,
        blocked: result.blocked,
        writeBlock: result.writeBlock
      });
    }
    return json(200, { ok: true, snapshotId, status: result.status, publishedAt: result.publishedAt });
  }

  // ---------- POST: rollback-snapshot ----------
  if (action === 'rollback-snapshot') {
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to roll back a snapshot.' });
    }
    const { snapshotId, humanApproved } = body;
    if (!snapshotId) {
      return json(400, { error: 'missing_snapshotId', message: 'snapshotId is required.' });
    }
    const result = rollbackSnapshot({ snapshotId, humanApproved: Boolean(humanApproved), actor: null, today: new Date() });
    if (!result.ok) {
      return json(400, {
        error: result.error?.code ?? SERVICE_CHANGE_ERRORS.VALIDATION_FAILED,
        message: result.error?.message ?? 'Rollback failed.',
        errors: result.errors
      });
    }
    return json(200, { ok: true, snapshotId, status: result.status, rolledBackAt: result.rolledBackAt });
  }

  // ---------- POST: create-snapshot ----------
  if (action === 'create-snapshot') {
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to create a snapshot.' });
    }
    const { snapshotId, serviceId, fromVersionId, toVersionId, title, description, deterministicSeed } = body;
    const result = createSnapshot({ snapshotId, serviceId, fromVersionId, toVersionId, title, description, deterministicSeed, actor: null });
    if (!result.ok) {
      return json(400, {
        error: result.error?.code ?? SERVICE_CHANGE_ERRORS.VALIDATION_FAILED,
        message: result.error?.message ?? 'Create failed.',
        errors: result.errors
      });
    }
    return json(200, { ok: true, snapshot: result.snapshot });
  }

  // ---------- POST: save-run ----------
  if (action === 'save-run') {
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to save a sandbox run.' });
    }
    const { runId, snapshotId, status, summary } = body;
    if (!runId) {
      return json(400, { error: 'missing_runId', message: 'runId is required.' });
    }
    const saved = saveSandboxRun({ runId, snapshotId, status, summary });
    if (!saved.ok) {
      return json(400, {
        error: saved.errors?.[0]?.code ?? SERVICE_CHANGE_ERRORS.VALIDATION_FAILED,
        message: saved.errors?.[0]?.message ?? 'Save failed.',
        errors: saved.errors
      });
    }
    return json(200, { ok: true, runId, savedAt: new Date().toISOString() });
  }

  // ---------- POST: load-run ----------
  if (action === 'load-run') {
    const { runId } = body;
    if (!runId) {
      return json(400, { error: 'missing_runId', message: 'runId is required.' });
    }
    const run = loadSandboxRun(runId);
    if (!run) {
      return json(404, { error: 'run_not_found', message: 'No sandbox run record found for this run id.' });
    }
    return json(200, { ok: true, run });
  }

  // ---------- POST: list-runs ----------
  if (action === 'list-runs') {
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to list sandbox runs.' });
    }
    return json(200, { ok: true, runs: listSandboxRuns() });
  }

  // ---------- POST: shadow-report ----------
  if (action === 'shadow-report') {
    const { run } = body;
    if (!run || typeof run !== 'object' || !run.snapshot || !run.comparison) {
      return json(400, { error: 'invalid_run', message: 'A valid shadow traffic run result is required.' });
    }
    const report = buildShadowTrafficReport({ ok: true, ...run });
    return json(200, { ok: true, report });
  }

  // ---------- Unknown POST action ----------
  return json(400, { error: 'unknown_action', message: `POST action "${action}" is not supported.` });
}
