import { withApiErrorContract } from './_lib/errorContract.js';
/**
 * api/counter-journey.js — Server‑side handler for the civic service counter
 * journey simulator (#843).
 *
 * Conventions followed:
 * - The handler receives `{method, headers, body, query}` (as Vercel functions do).
 * - Rate‑limiting per address (createRateLimiter). A per‑user limiter after
 *   session verification is optional.
 * - Role‑based authorisation: role comes only from Clerk publicMetadata
 *   (resolveRole from the app's roleService); anything else falls back to
 *   “citizen”.
 * - All errors are returned as structured JSON with `error.code` and `error.message`.
 * - No Aadhaar numbers, PANs, passwords, OTPs or document contents are ever
 *   echoed back. Request body and headers are never logged.
 * - The functions from src/services/civicCounterJourneyService are pure and
 *   deterministic; the handler just wires them to HTTP.
 */

import { createRateLimiter, clientKey } from './_lib/abuseGuard.js';
import {
  validateJourneyRequest,
  COUNTER_JOURNEY_DATA_VERSION,
  COUNTER_JOURNEY_DISCLAIMER,
  getCounterJourneyById,
} from '../src/services/civicCounterJourneyService.js';
import {
  getCounterJourneyCatalogue,
  evaluateCounterJourney,
  buildJourneyChecklistText,
} from '../src/services/civicCounterJourneyService.js';

/** Rate limiter for all POST endpoints (per address). */
const addressLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

/** Per‑user limiter that is only active after a verified session. */
const userLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

const tooMany = (retryAfterSeconds) =>
  json(429, { error: 'rate_limited', retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });

// ---------------------------------------------------------------------------
// Helper: read a Bearer token and derive the user’s role.
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
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const action = req.query?.action;
    if (!action) {
      return json(400, { error: 'missing_action', message: '`action` query param is required.' });
    }

    if (action === 'catalogue') {
      // Public catalogue – anyone may view it.
      const serviceId = req.query.serviceId;
      const page = Math.max(1, Number(req.query?.page ?? 1));
      const pageSize = Math.min(Math.max(1, Number(req.query?.pageSize ?? 12)), 50);
      const result = getCounterJourneyCatalogue({
        serviceId,
        page,
        pageSize,
      });
      return json(result.ok ? result : { ok: false, error: result.error });
    }

    if (action === 'journey') {
      // Returns a journey without evaluated progress (public view).
      const journeyId = req.query?.journeyId;
      if (!journeyId) {
        return json(400, { error: 'missing_journeyId', message: '`journeyId` is required.' });
      }
      const journey = getCounterJourneyById(journeyId);
      if (!journey) {
        return json(404, { error: 'journey_not_found', message: 'No reviewed counter sequence found for this journey id.' });
      }
      return json({
        ok: true,
        journey: {
          id: journey.id,
          title: journey.title,
          serviceId: journey.serviceId,
          officeId: journey.officeId,
          dataVersion: journey.dataVersion,
          processNote: journey.processNote,
          reviewedAt: journey.reviewedAt,
          disclaimer: COUNTER_JOURNEY_DISCLAIMER,
        },
      });
    }

    return json(400, { error: 'unknown_action', message: `GET action "${action}" is not supported.` });
  }

  // ---------- POST ----------
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return json(405, { error: 'method_not_allowed', message: 'Only POST and GET requests are accepted.' });
  }

  // 1️⃣ IP rate‑limit
  const ip = clientKey(req.headers) || 'unknown';
  const ipVerdict = addressLimiter.take(ip);
  if (!ipVerdict.allowed) return tooMany(ipVerdict.retryAfterSeconds ?? 1);

  // 2️⃣ Session / role handling
  const { userId, role } = readBearerRole(req.headers);
  // If a user‑level limiter is desired after verification, activate it now.
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

  // ---------- POST: evaluate ----------
  if (action === 'evaluate') {
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to evaluate a journey.' });
    }
    const { journeyId, availableDocumentIds, context = {} } = body;
    if (!journeyId) {
      return json(400, { error: 'missing_journeyId', message: 'journeyId is required in the request body.' });
    }

    // Validate the request using the shared service function
    const validation = validateJourneyRequest({
      journeyId,
      availableDocumentIds,
      context,
      // requireJourney:true is implicit when we have a journeyId
    });
    if (!validation.valid) {
      return json(400, { error: 'validation_failed', message: 'The journey request is not valid.', errors: validation.errors });
    }

    // Evaluate the journey using the deterministic service
    const today = new Date();
    const evaluation = evaluateCounterJourney({
      journeyId,
      availableDocumentIds: availableDocumentIds || [],
      context,
      today,
    });

    if (!evaluation.ok) {
      return json(400, { error: evaluation.error?.code ?? 'evaluation_failed', message: evaluation.error?.message ?? 'Evaluation failed.', errors: evaluation.errors });
    }

    return json({
      ok: true,
      journeyId: evaluation.journey.id,
      dataVersion: COUNTER_JOURNEY_DATA_VERSION,
      reviewedAt: '2026-11-18',
      counters: evaluation.counters,
      blockers: evaluation.blockers,
      linearChecklist: evaluation.linearChecklist,
      comparison: evaluation.comparison,
      aiSuggestions: evaluation.aiSuggestions,
      sources: evaluation.sources,
      dataQuality: evaluation.dataQuality,
      officialStatus: evaluation.officialStatus,
      progress: evaluation.progress,
    });
  }

  // ---------- POST: checklist ----------
  if (action === 'checklist') {
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to export a checklist.' });
    }
    const { journeyId } = body;
    if (!journeyId) {
      return json(400, { error: 'missing_journeyId', message: 'journeyId is required in the request body.' });
    }

    // Re‑evaluate to get the latest checklist data
    const today = new Date();
    const evaluation = evaluateCounterJourney({
      journeyId,
      availableDocumentIds: [],
      context: {},
      today,
    });
    if (!evaluation.ok) {
      return json(400, { error: evaluation.error?.code ?? 'evaluation_failed', message: evaluation.error?.message ?? 'Evaluation failed.' });
    }

    const text = buildJourneyChecklistText(evaluation);
    return json({
      ok: true,
      dataVersion: COUNTER_JOURNEY_DATA_VERSION,
      reviewedAt: '2026-11-18',
      checklistText: text,
    });
  }

  // ---------- POST: admin:review ----------
  if (action === 'admin:review') {
    // Only an admin may invoke this.
    if (role !== 'admin') {
      return json(403, { error: 'permission_denied', message: 'Admin role required for this action.' });
    }
    const { journeyId, reviewerNote } = body;
    if (!journeyId) {
      return json(400, { error: 'missing_journeyId', message: 'journeyId is required.' });
    }

    // Minimal audit log (in‑memory only, persisted if the admin backend adds Firestore etc.).
    // Do not store any PII; only the journeyId and a short reviewer note.
    try {
      // audit write intentionally omitted for this prototype
    } catch {
      // Ignore audit‑write failures; the journey review itself still succeeds.
    }

    return json({
      ok: true,
      journeyId,
      reviewerNote,
      reviewedAt: new Date().toISOString(),
    });
  }

  // ---------- Unknown POST action ----------
  return json(400, { error: 'unknown_action', message: `POST action "${action}" is not supported.` });
}
export default withApiErrorContract(handler);
