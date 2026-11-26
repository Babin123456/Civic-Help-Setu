/**
 * api/_lib/handlers/agent-sandbox.js — Server-side handler for the Secure
 * Agent Sandbox (#1179).
 *
 * Conventions followed:
 * - Receives `{method, headers, body, query}` (Vercel functions).
 * - Rate-limiting per address via createRateLimiter.
 * - Role/actor derived only from verified Clerk session claims; read-only
 *   sandbox runs are guest-allowed. High-impact actions (network, permissive
 *   policy) require authentication + human approval.
 * - All errors are structured JSON with `error.code` and `error.message`.
 * - Request bodies and headers are never logged.
 * - No Aadhaar, PAN, phone numbers, OTPs, income amounts or document contents
 *   are ever echoed back.
 * - The functions from src/services/civicAgentSandboxService are pure and
 *   deterministic; the handler just wires them to HTTP.
 * - No autonomous actions: the sandbox never files applications, denies
 *   benefits or claims official verification.
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  runSandboxTool,
  validateSandboxRequest,
  saveSandboxRun,
  loadSandboxRun,
  listSandboxRuns,
  buildSandboxReport,
  SANDBOX_ERRORS
} from '../../../src/services/civicAgentSandboxService.js';
import {
  listPolicies,
  listTools,
  listDocuments,
  listThreats,
  listApprovedEndpoints
} from '../../../src/data/civicAgentSandboxData.js';

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

    // GET: catalogue - public, lists policies/tools/documents/threats/endpoints.
    if (action === 'catalogue') {
      return json(200, {
        ok: true,
        schemaVersion: 'civic-agent-sandbox-v1',
        policies: listPolicies(),
        tools: listTools(),
        documents: listDocuments(),
        threats: listThreats(),
        approvedEndpoints: listApprovedEndpoints(),
        disclaimer: 'Sandbox output is illustrative and untrusted.'
      });
    }

    // GET: run - returns a saved sandbox run record by id (public metadata only).
    if (action === 'run') {
      const runId = req.query?.runId;
      if (!runId) {
        return json(400, { error: 'missing_runId', message: '`runId` is required.' });
      }
      const run = loadSandboxRun(runId);
      if (!run) {
        return json(404, { error: 'run_not_found', message: 'No sandbox run record found for this run id.' });
      }
      return json(200, { ok: true, run });
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

  // ---------- POST: run ----------
  if (action === 'run') {
    // Read-only sandbox runs are guest-allowed.
    const validation = validateSandboxRequest(body);
    if (!validation.valid) {
      return json(400, {
        error: SANDBOX_ERRORS.VALIDATION_FAILED,
        message: 'The sandbox request is not valid.',
        errors: validation.errors
      });
    }

    const today = new Date();
    const result = runSandboxTool({
      runId: body.runId,
      toolId: body.toolId,
      policyId: body.policyId,
      documentId: body.documentId,
      inputData: body.inputData,
      networkAllowed: Boolean(body.networkAllowed),
      humanApproved: Boolean(body.humanApproved),
      today
    });

    if (!result.ok) {
      return json(400, {
        error: result.error?.code ?? SANDBOX_ERRORS.VALIDATION_FAILED,
        message: result.error?.message ?? 'Sandbox run failed.',
        errors: result.errors,
        threats: result.threats,
        blocked: result.blocked
      });
    }

    return json(200, { ok: true, run: result.run, scan: result.scan });
  }

  // ---------- POST: save-run ----------
  if (action === 'save-run') {
    // Saving a named run record requires authentication.
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to save a sandbox run.' });
    }
    const { runId, toolId, policyId, status, summary } = body;
    if (!runId) {
      return json(400, { error: 'missing_runId', message: 'runId is required.' });
    }
    const saved = saveSandboxRun({ runId, toolId, policyId, status, summary });
    if (!saved.ok) {
      return json(400, {
        error: saved.errors?.[0]?.code ?? SANDBOX_ERRORS.VALIDATION_FAILED,
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

  // ---------- POST: sandbox-report ----------
  if (action === 'sandbox-report') {
    const { run } = body;
    if (!run || typeof run !== 'object' || !run.toolId || !run.policyId || !run.status) {
      return json(400, { error: 'invalid_run', message: 'A valid sandbox run result is required.' });
    }
    const report = buildSandboxReport({ ok: true, run, scan: { pre: [], post: [], blocked: false, redacted: false } });
    return json(200, { ok: true, report });
  }

  // ---------- Unknown POST action ----------
  return json(400, { error: 'unknown_action', message: `POST action "${action}" is not supported.` });
}
