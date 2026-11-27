/* global process */
/**
 * api/_lib/handlers/notice-order-explainer.js
 *
 * Server-side API handler for Plain-Language Government Notice & Order Explainer (#1422).
 *
 * Routes (under /api/notice-order-explainer):
 *   POST /api/notice-order-explainer                    → extract sections, citations & plain-language summary
 *   POST /api/notice-order-explainer/review-translation → record human-reviewed translation (reviewer/admin only)
 *   GET  /api/notice-order-explainer/audit-log          → PII-free audit log (reviewer/admin only)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { explainGovernmentNoticeOrOrder } from '../../../src/services/noticeOrderExplainerService.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });
const AUDIT_LOG = [];

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

export default async function noticeOrderExplainerHandler(
  req,
  res,
  { authUserOverride = null } = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const segments = url.pathname.replace(/^\/api\/notice-order-explainer\/?/, '').split('/').filter(Boolean);
  const subRoute = segments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  if (subRoute === '' && method === 'POST') {
    const body = req.body || {};
    try {
      const explanation = explainGovernmentNoticeOrOrder({
        title: body.title,
        text: body.text,
        sourceUrl: body.sourceUrl,
        jurisdiction: body.jurisdiction,
        effectiveDate: body.effectiveDate,
        lastVerifiedAt: body.lastVerifiedAt,
        ocrConfidence: body.ocrConfidence,
        targetLanguage: body.targetLanguage || 'en',
      });
      return sendJson(res, 200, { explanation });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  const authUser = authUserOverride || (await resolveAuth(req));
  if (!authUser || !authUser.userId) {
    return sendJson(res, 401, { error: 'Authentication required' });
  }
  const isReviewer = ['admin', 'reviewer', 'legal_reviewer'].includes(authUser.role);
  if (!isReviewer) {
    return sendJson(res, 403, { error: 'Reviewer or admin role required' });
  }

  if (subRoute === 'audit-log' && method === 'GET') {
    return sendJson(res, 200, { items: AUDIT_LOG, total: AUDIT_LOG.length });
  }

  if (subRoute === 'review-translation' && method === 'POST') {
    const { sectionId, language, approvedTranslation } = req.body || {};
    if (!sectionId || !language || !approvedTranslation) {
      return sendJson(res, 400, { error: 'sectionId, language, and approvedTranslation are required' });
    }
    const entry = {
      reviewId: `nrev_${Date.now()}`,
      sectionId,
      language,
      approvedTranslation: String(approvedTranslation).trim(),
      reviewedBy: authUser.userId,
      reviewedAt: new Date().toISOString(),
    };
    AUDIT_LOG.unshift({ action: 'NOTICE_TRANSLATION_REVIEWED', sectionId, language, actorId: authUser.userId, timestamp: entry.reviewedAt });
    return sendJson(res, 200, { review: entry });
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}
