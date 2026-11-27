/* global process */
/**
 * api/_lib/handlers/portal-change-monitor.js
 *
 * Server-side API handler for Government Portal Change Detection & Broken-Link Monitor (#1428).
 *
 * Routes (under /api/portal-change-monitor):
 *   GET  /api/portal-change-monitor           → list monitored portals & review queue
 *   POST /api/portal-change-monitor/check     → record portal check (admin/reviewer/monitor only)
 *   POST /api/portal-change-monitor/review    → approve/reject detected change (admin/reviewer only)
 *   GET  /api/portal-change-monitor/audit-log → redacted audit log (admin/reviewer only)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  listMonitoredPortals,
  listPortalReviewQueue,
  listPortalAuditLog,
  recordPortalCheck,
  reviewPortalChange,
} from '../../../src/services/portalChangeMonitorService.js';

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

export default async function portalChangeMonitorHandler(
  req,
  res,
  { authUserOverride = null } = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const segments = url.pathname.replace(/^\/api\/portal-change-monitor\/?/, '').split('/').filter(Boolean);
  const subRoute = segments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  if (subRoute === '' && method === 'GET') {
    return sendJson(res, 200, {
      portals: listMonitoredPortals(),
      reviewQueue: listPortalReviewQueue(),
    });
  }

  const authUser = authUserOverride || (await resolveAuth(req));
  if (!authUser || !authUser.userId) {
    return sendJson(res, 401, { error: 'Authentication required' });
  }

  const isPrivileged = ['admin', 'reviewer', 'municipal_officer', 'monitor'].includes(authUser.role);
  if (!isPrivileged) {
    return sendJson(res, 403, { error: 'Reviewer or admin role required' });
  }

  if (subRoute === 'audit-log' && method === 'GET') {
    const items = listPortalAuditLog();
    return sendJson(res, 200, { items, total: items.length });
  }

  if (subRoute === 'check' && method === 'POST') {
    const body = req.body || {};
    try {
      const result = recordPortalCheck({
        sourceId: body.sourceId,
        url: body.url,
        sourceOwner: body.sourceOwner,
        jurisdiction: body.jurisdiction,
        httpStatus: body.httpStatus,
        redirectedTo: body.redirectedTo,
        contentSample: body.contentSample,
        actorId: authUser.userId,
      });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (subRoute === 'review' && method === 'POST') {
    const body = req.body || {};
    try {
      const reviewed = reviewPortalChange({
        changeId: body.changeId,
        reviewerId: authUser.userId,
        reviewerRole: authUser.role,
        decision: body.decision,
        rationale: body.rationale || '',
      });
      return sendJson(res, 200, { item: reviewed });
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 400;
      return sendJson(res, status, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}
