/* global process */
/**
 * api/_lib/handlers/search-query-recovery.js
 *
 * Server-side endpoint for Civic Search Query Understanding & Spelling Recovery (#1431).
 *
 * Routes (under /api/search-query-recovery):
 *   POST /api/search-query-recovery             → understand & recover search query (public, rate-limited, zero-PII)
 *   POST /api/search-query-recovery/evaluate    → record reviewed query evaluation (admin/reviewer only)
 *   GET  /api/search-query-recovery/evaluations → list reviewed query evaluations (admin/reviewer only)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  understandAndRecoverQuery,
  recordReviewedQueryEvaluation,
} from '../../../src/services/civicSearchQueryRecoveryService.js';
import { inspectStringForPII } from '../../../src/services/piiLeakageGuardService.js';

const rateLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });
const EVALUATION_LOG = [];

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

function detectPII(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input || {});
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

export default async function searchQueryRecoveryHandler(
  req,
  res,
  { authUserOverride = null } = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const segments = url.pathname.replace(/^\/api\/search-query-recovery\/?/, '').split('/').filter(Boolean);
  const subRoute = segments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  if (subRoute === '' && method === 'POST') {
    const { query } = req.body || {};
    if (typeof query !== 'string' || !query.trim()) {
      return sendJson(res, 400, { error: 'query string is required' });
    }
    const pii = detectPII(query);
    if (pii) {
      return sendJson(res, 400, {
        error: `Search query must not contain personal identity numbers (${pii.join(', ')}).`,
      });
    }
    const recovery = understandAndRecoverQuery(query);
    return sendJson(res, 200, { recovery });
  }

  // Evaluation endpoints require admin/reviewer auth
  const authUser = authUserOverride || (await resolveAuth(req));
  if (!authUser || !authUser.userId) {
    return sendJson(res, 401, { error: 'Authentication required' });
  }
  const isReviewer = ['admin', 'reviewer', 'municipal_officer'].includes(authUser.role);
  if (!isReviewer) {
    return sendJson(res, 403, { error: 'Admin or reviewer role required' });
  }

  if (subRoute === 'evaluations' && method === 'GET') {
    return sendJson(res, 200, { items: EVALUATION_LOG, total: EVALUATION_LOG.length });
  }

  if (subRoute === 'evaluate' && method === 'POST') {
    const { originalQuery, correctedQuery, accepted, notes } = req.body || {};
    if (!originalQuery || typeof accepted !== 'boolean') {
      return sendJson(res, 400, { error: 'originalQuery and boolean accepted are required' });
    }
    const pii = detectPII({ originalQuery, correctedQuery, notes });
    if (pii) {
      return sendJson(res, 400, { error: `Evaluation contains forbidden PII (${pii.join(', ')})` });
    }
    const entry = recordReviewedQueryEvaluation({
      originalQuery,
      correctedQuery: correctedQuery || originalQuery,
      accepted,
      evaluatorId: authUser.userId,
      notes: notes || '',
    });
    EVALUATION_LOG.unshift(entry);
    if (EVALUATION_LOG.length > 500) EVALUATION_LOG.pop();
    return sendJson(res, 201, { evaluation: entry });
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}
