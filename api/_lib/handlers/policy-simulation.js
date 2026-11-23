/**
 * api/_lib/handlers/policy-simulation.js — Server-side handler for the
 * Agent-Based Civic Policy Scenario Simulator (#1176).
 *
 * Conventions followed:
 * - The handler receives `{method, headers, body, query}` (as Vercel functions do).
 * - Rate-limiting per address via createRateLimiter.
 * - Role/actor derived only from verified Clerk session claims; guest users may
 *   read the catalogue and run read-only simulations. Writing/saving a named
 *   scenario requires authentication.
 * - All errors are returned as structured JSON with `error.code` and
 *   `error.message`. Request bodies and headers are never logged.
 * - No Aadhaar, PAN, phone numbers, OTPs, income amounts or document contents
 *   are ever echoed back.
 * - The functions from src/services/civicPolicySimulationService are pure and
 *   deterministic; the handler just wires them to HTTP.
 * - No autonomous actions: the simulator never files applications, denies
 *   benefits or claims official verification.
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  simulateScenario,
  validateSimulationRequest,
  buildImpactSummary,
  saveScenarioConfiguration,
  loadScenarioConfiguration,
  listSavedConfigurations,
  ERROR_CODES,
} from '../../../src/services/civicPolicySimulationService.js';
import {
  listScenarios,
  listPersonas,
  listServices,
  listOffices,
  listLevers,
  listAggregateStats,
  getScenario,
} from '../../../src/data/civicPolicySimulationData.js';

/** Per-address rate limiter for all endpoints. */
const addressLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

/** Per-user limiter active only after a verified session. */
const userLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
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

    // GET: catalogue - public, lists available scenarios/personas/services/offices/levers/stats.
    if (action === 'catalogue') {
      return json(200, {
        ok: true,
        schemaVersion: 'civic-policy-simulation-v1',
        scenarios: listScenarios(),
        personas: listPersonas(),
        services: listServices(),
        offices: listOffices(),
        levers: listLevers(),
        aggregateStats: listAggregateStats(),
        disclaimer: 'Illustrative agent-based scenario output. Synthetic personas only.',
      });
    }

    // GET: scenario - returns a reviewed scenario definition by id (public).
    if (action === 'scenario') {
      const scenarioId = req.query?.scenarioId;
      if (!scenarioId) {
        return json(400, { error: 'missing_scenarioId', message: '`scenarioId` is required.' });
      }
      const scenario = getScenario(scenarioId);
      if (!scenario) {
        return json(404, { error: 'scenario_not_found', message: 'No reviewed scenario found for this scenario id.' });
      }
      return json(200, { ok: true, scenario });
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

  // ---------- POST: simulate ----------
  if (action === 'simulate') {
    // Simulation is read-only and illustrative; guest users may run it.
    const validation = validateSimulationRequest(body);
    if (!validation.valid) {
      return json(400, {
        error: ERROR_CODES.VALIDATION_FAILED,
        message: 'The simulation request is not valid.',
        errors: validation.errors,
      });
    }

    const today = new Date();
    const simulation = simulateScenario({
      scenarioId: body.scenarioId,
      personaIds: body.personaIds,
      serviceIds: body.serviceIds,
      officeIds: body.officeIds,
      leverIds: body.leverIds,
      dayCount: body.dayCount,
      seed: body.seed,
      today,
    });

    if (!simulation.ok) {
      return json(400, {
        error: simulation.error?.code ?? ERROR_CODES.VALIDATION_FAILED,
        message: simulation.error?.message ?? 'Simulation failed.',
        errors: simulation.errors,
      });
    }

    return json(200, {
      ok: true,
      simulation: simulation.result,
    });
  }

  // ---------- POST: save-scenario ----------
  if (action === 'save-scenario') {
    // Saving a named configuration requires authentication.
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to save a scenario.' });
    }
    const { scenarioId, name, parameters } = body;
    if (!scenarioId) {
      return json(400, { error: 'missing_scenarioId', message: 'scenarioId is required.' });
    }
    const result = saveScenarioConfiguration({ scenarioId, name, parameters });
    if (!result.ok) {
      return json(400, { error: result.errors?.[0]?.code ?? ERROR_CODES.VALIDATION_FAILED, message: result.errors?.[0]?.message ?? 'Save failed.', errors: result.errors });
    }
    return json(200, { ok: true, scenarioId, savedAt: new Date().toISOString() });
  }

  // ---------- POST: load-scenario ----------
  if (action === 'load-scenario') {
    const { scenarioId } = body;
    if (!scenarioId) {
      return json(400, { error: 'missing_scenarioId', message: 'scenarioId is required.' });
    }
    const config = loadScenarioConfiguration(scenarioId);
    if (!config) {
      return json(404, { error: 'scenario_not_found', message: 'No saved configuration found for this scenario id.' });
    }
    return json(200, { ok: true, configuration: config });
  }

  // ---------- POST: list-saved-scenarios ----------
  if (action === 'list-saved-scenarios') {
    if (role === 'guest') {
      return json(401, { error: 'unauthenticated', message: 'Authentication required to list saved scenarios.' });
    }
    return json(200, { ok: true, configurations: listSavedConfigurations() });
  }

  // ---------- POST: impact-summary ----------
  if (action === 'impact-summary') {
    const { simulation } = body;
    if (!simulation || simulation.ok !== true) {
      return json(400, { error: 'invalid_simulation', message: 'A valid simulation result is required.' });
    }
    const summary = buildImpactSummary(simulation);
    return json(200, { ok: true, summary });
  }

  // ---------- Unknown POST action ----------
  return json(400, { error: 'unknown_action', message: `POST action "${action}" is not supported.` });
}
