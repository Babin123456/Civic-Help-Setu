/* global process */
/**
 * api/_lib/handlers/grievance-completeness-coach.js
 *
 * Serverless API handler for Public Grievance Language Quality & Completeness Coach (#1444):
 *   GET  /api/grievance-completeness-coach
 *   GET  /api/grievance-completeness-coach/prompts?lang=hi
 *   GET  /api/grievance-completeness-coach/drafts             (Auth required: owner or admin)
 *   GET  /api/grievance-completeness-coach/audit-log          (Admin-gated)
 *   POST /api/grievance-completeness-coach/analyze            (Auth required)
 *   POST /api/grievance-completeness-coach/drafts/:id/decide  (Owner or admin)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  COACH_SCHEMA_VERSION,
  MULTILINGUAL_COACH_PROMPTS,
  analyzeGrievanceDraft,
  decideCoachSuggestion,
  validateCoachZeroPii,
} from '../../../src/services/grievanceCompletenessCoachService.js';
import { getProductionGrievanceCoachStore } from '../grievanceCompletenessCoachStore.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const defaultRateLimiter = createRateLimiter({ limit: 40, windowMs: 60 * 1000 });

function parseBody(body) {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function parseUrlQuery(url) {
  const q = {};
  const idx = (url || '').indexOf('?');
  if (idx === -1) return q;
  const search = url.slice(idx + 1);
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) q[decodeURIComponent(pair)] = '';
    else q[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }
  return q;
}

export async function defaultVerifyCoachActor(req) {
  const token = bearerToken(req.headers || {});
  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { ok: false, status: 503, error: 'Authentication service is not configured.' };

  try {
    const { verifyToken, createClerkClient } = await import('@clerk/backend');
    const claims = await verifyToken(token, { secretKey });
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(claims.sub);
    const role = resolveRole(user?.publicMetadata);
    return { ok: true, actorId: claims.sub, role };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

export function createGrievanceCompletenessCoachHandler({
  verifyActor = defaultVerifyCoachActor,
  getStore = getProductionGrievanceCoachStore,
  rateLimiter = defaultRateLimiter,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    const method = (req.method || 'GET').toUpperCase();
    const url = req.url || '';
    const query = { ...parseUrlQuery(url), ...(req.query || {}) };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments[0] === 'api' ? segments.slice(2) : segments.slice(1);

    const ipKey = clientKey(req);
    const rate = rateLimiter.take(ipKey);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      return res.status(429).json({ error: 'Rate limit exceeded.', code: 'ERR_RATE_LIMIT' });
    }

    let store;
    try {
      store = await getStore();
    } catch {
      return res.status(503).json({ error: 'Coach store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: COACH_SCHEMA_VERSION,
        service: 'grievance-completeness-coach',
        status: 'healthy',
      });
    }

    if (method === 'GET' && rest[0] === 'prompts' && rest.length === 1) {
      const lang = MULTILINGUAL_COACH_PROMPTS[query.lang] ? query.lang : 'en';
      return res.status(200).json({
        schemaVersion: COACH_SCHEMA_VERSION,
        language: lang,
        prompts: MULTILINGUAL_COACH_PROMPTS[lang],
      });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin role required for audit log.' });
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: COACH_SCHEMA_VERSION, entries });
    }

    if (method === 'GET' && rest[0] === 'drafts' && rest.length === 1) {
      const drafts = await store.listDrafts({
        ownerId: role === 'admin' ? null : auth.actorId,
        limit: query.limit,
      });
      return res.status(200).json({ schemaVersion: COACH_SCHEMA_VERSION, drafts });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateCoachZeroPii(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'analyze' && rest.length === 1) {
      try {
        const draft = analyzeGrievanceDraft({
          originalText: body.originalText,
          language: body.language || 'en',
          jurisdiction: body.jurisdiction || 'IN-UP',
        });
        const stored = { ...draft, ownerId: auth.actorId };
        await store.saveDraft(stored);
        await store.appendAuditLog({
          action: 'ANALYZE_DRAFT',
          actorId: auth.actorId,
          role,
          targetId: stored.draftId,
          status: `completeness:${stored.completenessScore}`,
          summary: `Analyzed draft ${stored.draftId} (${stored.language})`,
        });
        return res.status(201).json({ schemaVersion: COACH_SCHEMA_VERSION, draft: stored });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (method === 'POST' && rest[0] === 'drafts' && rest.length === 3 && rest[2] === 'decide') {
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid draftId.' });
      const existing = await store.getDraft(rest[1]);
      if (!existing) return res.status(404).json({ error: 'Draft not found.' });
      if (role !== 'admin' && existing.ownerId !== auth.actorId) {
        return res.status(403).json({ error: 'Forbidden: cannot modify another citizen draft.' });
      }

      try {
        const updated = decideCoachSuggestion(existing, {
          suggestionId: body.suggestionId,
          decision: body.decision,
        });
        await store.saveDraft(updated);
        await store.appendAuditLog({
          action: 'DECIDE_SUGGESTION',
          actorId: auth.actorId,
          role,
          targetId: updated.draftId,
          status: body.decision,
          summary: `Suggestion ${body.suggestionId} ${body.decision}d`,
        });
        return res.status(200).json({ schemaVersion: COACH_SCHEMA_VERSION, draft: updated });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Grievance completeness coach endpoint not found.' });
  };
}

export default createGrievanceCompletenessCoachHandler();
