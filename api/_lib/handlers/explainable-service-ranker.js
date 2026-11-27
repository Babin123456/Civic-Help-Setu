/* global process */
/**
 * api/_lib/handlers/explainable-service-ranker.js
 *
 * Server-side endpoint for the Explainable Civic Service Recommendation Ranker (#1430).
 *
 * Routes (under /api/explainable-service-ranker):
 *   POST /api/explainable-service-ranker      → rank services with explanation factors
 *   GET  /api/explainable-service-ranker/eval → offline eval & fairness report (admin/reviewer only)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  rankCivicServices,
  evaluateRankerOffline,
} from '../../../src/services/explainableServiceRanker.js';
import { inspectStringForPII } from '../../../src/services/piiLeakageGuardService.js';

const rateLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

function detectPII(payload) {
  const str = JSON.stringify(payload || {});
  try {
    const res = inspectStringForPII(str);
    if (res && res.hasPII) return res.detectedFields || ['pii'];
  } catch {
    // fallback
  }
  const found = [];
  if (AADHAAR_RE.test(str)) found.push('aadhaar');
  if (PAN_RE.test(str)) found.push('pan');
  return found.length > 0 ? found : null;
}

async function resolveAuth(req) {
  try {
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;
    const { sub: userId, role } = await clerkClient.verifyToken(token);
    return { userId, role: role || 'citizen' };
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).end(JSON.stringify(body));
}

export default async function explainableServiceRankerHandler(
  req,
  res,
  { authUserOverride = null } = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const segments = url.pathname.replace(/^\/api\/explainable-service-ranker\/?/, '').split('/').filter(Boolean);
  const subRoute = segments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  if (subRoute === 'eval' && method === 'GET') {
    const authUser = authUserOverride || (await resolveAuth(req));
    if (!authUser || !authUser.userId) {
      return sendJson(res, 401, { error: 'Authentication required' });
    }
    if (!['admin', 'reviewer', 'municipal_officer'].includes(authUser.role)) {
      return sendJson(res, 403, { error: 'Admin or reviewer role required to view evaluation metrics' });
    }
    return sendJson(res, 200, { evaluation: evaluateRankerOffline() });
  }

  if (subRoute === '' && method === 'POST') {
    const body = req.body || {};
    const pii = detectPII(body);
    if (pii) {
      return sendJson(res, 400, { error: `Ranking request must not contain PII (${pii.join(', ')})` });
    }
    const ranked = rankCivicServices(body);
    return sendJson(res, 200, ranked);
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}
