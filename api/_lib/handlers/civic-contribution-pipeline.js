/* global process */
/**
 * api/_lib/handlers/civic-contribution-pipeline.js
 *
 * Server-side API handler for the Human-Reviewed Civic Data Contribution Pipeline (#1432).
 *
 * Routes (under /api/civic-contribution-pipeline):
 *   GET  /api/civic-contribution-pipeline            → list proposals
 *   POST /api/civic-contribution-pipeline            → submit proposal (contributor auth)
 *   POST /api/civic-contribution-pipeline/assign     → assign reviewer (publisher/admin)
 *   POST /api/civic-contribution-pipeline/review     → publish or reject (publisher/admin, no self-review)
 *   POST /api/civic-contribution-pipeline/rollback   → rollback published proposal (publisher/admin)
 *   GET  /api/civic-contribution-pipeline/audit-log  → immutable audit log (publisher/admin)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { getProductionCivicContributionPipelineStore } from '../civicContributionPipelineStore.js';
import { inspectStringForPII } from '../../../src/services/piiLeakageGuardService.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

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

function isHttpsUrl(url) {
  try {
    return new URL(String(url || '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

async function resolveAuth(req) {
  try {
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const authHeader = req.headers?.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;
    const { sub: userId, role } = await clerkClient.verifyToken(token);
    return { userId, role: role || 'contributor' };
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).end(JSON.stringify(body));
}

export default async function civicContributionPipelineHandler(
  req,
  res,
  { authUserOverride = null, storeOverride = null } = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const segments = url.pathname.replace(/^\/api\/civic-contribution-pipeline\/?/, '').split('/').filter(Boolean);
  const subRoute = segments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  const store = storeOverride || getProductionCivicContributionPipelineStore();

  if (subRoute === '' && method === 'GET') {
    const items = store.listProposals();
    return sendJson(res, 200, { items, total: items.length });
  }

  const authUser = authUserOverride || (await resolveAuth(req));
  if (!authUser || !authUser.userId) {
    return sendJson(res, 401, { error: 'Authentication required' });
  }

  const isPublisher = ['admin', 'publisher', 'municipal_officer'].includes(authUser.role);

  if (subRoute === 'audit-log' && method === 'GET') {
    if (!isPublisher) {
      return sendJson(res, 403, { error: 'Publisher or admin role required for audit log access' });
    }
    const items = store.getAuditLog();
    return sendJson(res, 200, { items, total: items.length });
  }

  if (subRoute === '' && method === 'POST') {
    const body = req.body || {};
    if (!body.targetEntityId || !body.sourceAttachment || !isHttpsUrl(body.sourceAttachment.sourceUrl)) {
      return sendJson(res, 400, {
        error: 'targetEntityId and sourceAttachment with valid https:// sourceUrl are required',
      });
    }
    const pii = detectPII(body);
    if (pii) {
      return sendJson(res, 400, { error: `Proposal contains forbidden PII (${pii.join(', ')})` });
    }
    const result = store.submitProposal({
      targetEntityId: body.targetEntityId,
      entityType: body.entityType || 'office_contact',
      contributorId: authUser.userId,
      baseRevision: body.baseRevision || 1,
      beforeFields: body.beforeFields || {},
      proposedFields: body.proposedFields || {},
      sourceAttachment: body.sourceAttachment,
      provenanceKind: body.provenanceKind || 'community_suggestion',
      rationale: body.rationale || '',
    });
    return sendJson(res, result.status, result.ok ? { proposal: result.proposal } : { error: result.error });
  }

  if (subRoute === 'assign' && method === 'POST') {
    if (!isPublisher) return sendJson(res, 403, { error: 'Publisher or admin role required' });
    const { proposalId, reviewerId } = req.body || {};
    if (!proposalId || !reviewerId) return sendJson(res, 400, { error: 'proposalId and reviewerId are required' });
    const result = store.assignReviewer(proposalId, reviewerId, authUser.userId);
    return sendJson(res, result.status, result.ok ? { proposal: result.proposal } : { error: result.error });
  }

  if (subRoute === 'review' && method === 'POST') {
    if (!isPublisher) return sendJson(res, 403, { error: 'Publisher or admin role required to review/publish' });
    const { proposalId, decision, rejectionReason, resolveConflict } = req.body || {};
    if (!proposalId || !['PUBLISH', 'REJECT'].includes(decision)) {
      return sendJson(res, 400, { error: 'proposalId and decision (PUBLISH|REJECT) are required' });
    }
    const pii = detectPII({ rejectionReason });
    if (pii) return sendJson(res, 400, { error: `Rejection reason contains forbidden PII (${pii.join(', ')})` });
    const result = store.reviewProposal({
      proposalId,
      publisherId: authUser.userId,
      decision,
      rejectionReason: rejectionReason || '',
      resolveConflict: Boolean(resolveConflict),
    });
    return sendJson(
      res,
      result.status,
      result.ok
        ? { proposal: result.proposal, entityRevision: result.entityRevision }
        : { error: result.error, code: result.code }
    );
  }

  if (subRoute === 'rollback' && method === 'POST') {
    if (!isPublisher) return sendJson(res, 403, { error: 'Publisher or admin role required to rollback' });
    const { proposalId, reason } = req.body || {};
    if (!proposalId) return sendJson(res, 400, { error: 'proposalId is required' });
    const result = store.rollbackProposal(proposalId, authUser.userId, reason || 'Rolled back by publisher');
    return sendJson(
      res,
      result.status,
      result.ok
        ? { proposal: result.proposal, entityRevision: result.entityRevision }
        : { error: result.error }
    );
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}

