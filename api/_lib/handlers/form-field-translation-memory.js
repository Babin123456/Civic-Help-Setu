/* global process */
/**
 * api/_lib/handlers/form-field-translation-memory.js
 *
 * Server-side API handler for Multilingual Civic Form Field Translation Memory (#1423).
 *
 * Routes (under /api/form-field-translation-memory):
 *   GET  /api/form-field-translation-memory           → list or resolve form field translation (with fallback)
 *   POST /api/form-field-translation-memory           → propose translation (auth required, zero-PII)
 *   POST /api/form-field-translation-memory/approve   → approve/reject translation (reviewer/admin only, no self-review)
 *   GET  /api/form-field-translation-memory/audit-log → redacted audit log (reviewer/admin only)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  listFormFieldTranslations,
  resolveFormFieldLabel,
  proposeFormFieldTranslation,
  approveFormFieldTranslation,
  listTranslationAuditLog,
} from '../../../src/services/formFieldTranslationMemoryExtension.js';

const rateLimiter = createRateLimiter({ limit: 45, windowMs: 60 * 1000 });

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

export default async function formFieldTranslationMemoryHandler(
  req,
  res,
  { authUserOverride = null } = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const segments = url.pathname.replace(/^\/api\/form-field-translation-memory\/?/, '').split('/').filter(Boolean);
  const subRoute = segments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  if (subRoute === '' && method === 'GET') {
    const phrase = url.searchParams.get('phrase');
    const lang = url.searchParams.get('lang') || 'hi';
    if (phrase) {
      return sendJson(res, 200, { resolution: resolveFormFieldLabel({ sourcePhrase: phrase, targetLanguage: lang }) });
    }
    const items = listFormFieldTranslations();
    return sendJson(res, 200, { items, total: items.length });
  }

  const authUser = authUserOverride || (await resolveAuth(req));
  if (!authUser || !authUser.userId) {
    return sendJson(res, 401, { error: 'Authentication required' });
  }

  const isReviewer = ['admin', 'reviewer', 'legal_reviewer'].includes(authUser.role);

  if (subRoute === 'audit-log' && method === 'GET') {
    if (!isReviewer) return sendJson(res, 403, { error: 'Reviewer or admin role required' });
    const items = listTranslationAuditLog();
    return sendJson(res, 200, { items, total: items.length });
  }

  if (subRoute === '' && method === 'POST') {
    const body = req.body || {};
    try {
      const entry = proposeFormFieldTranslation({
        sourcePhrase: body.sourcePhrase,
        proposedTranslation: body.proposedTranslation,
        language: body.language || 'hi',
        script: body.script,
        jurisdiction: body.jurisdiction || 'All India',
        proposedBy: authUser.userId,
      });
      return sendJson(res, 201, { entry });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (subRoute === 'approve' && method === 'POST') {
    if (!isReviewer) return sendJson(res, 403, { error: 'Reviewer or admin role required to approve translations' });
    const body = req.body || {};
    try {
      const entry = approveFormFieldTranslation({
        entryId: body.entryId,
        reviewerId: authUser.userId,
        reviewerRole: authUser.role,
        decision: body.decision || 'APPROVE',
        rationale: body.rationale || '',
      });
      return sendJson(res, 200, { entry });
    } catch (err) {
      const status = err.message.includes('Role separation') ? 403 : err.message.includes('not found') ? 404 : 400;
      return sendJson(res, status, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}
