/* global process */
/**
 * api/_lib/handlers/duplicate-case-detector.js
 *
 * Server-side API handler for the Civic Application Duplicate & Related-Case Detector (#1427).
 *
 * Routes (under /api/duplicate-case-detector):
 *   POST /api/duplicate-case-detector           → detect duplicate/related cases (auth required)
 *   POST /api/duplicate-case-detector/confirm   → record human confirmation (auth required, preserves separate IDs)
 *   GET  /api/duplicate-case-detector/eval      → precision/recall eval on synthetic fixtures (admin/reviewer only)
 *   GET  /api/duplicate-case-detector/audit-log → PII-free audit log (admin/reviewer only)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  detectDuplicateAndRelatedCases,
  confirmCaseRelationship,
  evaluateDuplicateDetector,
  listCaseLinkAuditLog,
} from '../../../src/services/civicCaseDuplicateDetectorService.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

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

export default async function duplicateCaseDetectorHandler(
  req,
  res,
  { authUserOverride = null } = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const segments = url.pathname.replace(/^\/api\/duplicate-case-detector\/?/, '').split('/').filter(Boolean);
  const subRoute = segments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  const authUser = authUserOverride || (await resolveAuth(req));
  if (!authUser || !authUser.userId) {
    return sendJson(res, 401, { error: 'Authentication required' });
  }

  const isPrivileged = ['admin', 'reviewer', 'municipal_officer'].includes(authUser.role);

  if (subRoute === 'eval' && method === 'GET') {
    if (!isPrivileged) return sendJson(res, 403, { error: 'Admin or reviewer role required' });
    return sendJson(res, 200, { evaluation: evaluateDuplicateDetector() });
  }

  if (subRoute === 'audit-log' && method === 'GET') {
    if (!isPrivileged) return sendJson(res, 403, { error: 'Admin or reviewer role required' });
    const items = listCaseLinkAuditLog();
    return sendJson(res, 200, { items, total: items.length });
  }

  if (subRoute === '' && method === 'POST') {
    const { candidateCase, existingCases = [], timeWindowDays = 30 } = req.body || {};
    if (!candidateCase || !candidateCase.caseId) {
      return sendJson(res, 400, { error: 'candidateCase with caseId is required' });
    }
    try {
      const result = detectDuplicateAndRelatedCases(candidateCase, existingCases, { timeWindowDays });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (subRoute === 'confirm' && method === 'POST') {
    const { primaryCaseId, candidateCaseId, decision, reason = '' } = req.body || {};
    try {
      const link = confirmCaseRelationship({
        primaryCaseId,
        candidateCaseId,
        decision,
        confirmedBy: authUser.userId,
        reason,
      });
      return sendJson(res, 200, { link });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}
