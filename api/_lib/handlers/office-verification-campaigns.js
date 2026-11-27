/* global process */
/**
 * api/_lib/handlers/office-verification-campaigns.js
 *
 * Server-side API handler for the Civic Office Contact Verification Campaign Manager (#1433).
 *
 * Routes (under /api/office-verification-campaigns):
 *   GET  /api/office-verification-campaigns                 → list campaigns & public stale badges
 *   POST /api/office-verification-campaigns                 → batch assign campaign (admin/officer)
 *   POST /api/office-verification-campaigns/submit-evidence → submit official-source evidence (auth)
 *   POST /api/office-verification-campaigns/review          → approve/reject verification (admin/officer)
 *   GET  /api/office-verification-campaigns/audit-log       → redacted audit log (admin/officer)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { getProductionOfficeVerificationCampaignStore } from '../officeVerificationCampaignStore.js';
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

function isHttpUrl(val) {
  try {
    const u = new URL(String(val || '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
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

export default async function officeVerificationCampaignsHandler(
  req,
  res,
  { authUserOverride = null, storeOverride = null } = {}
) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const segments = url.pathname.replace(/^\/api\/office-verification-campaigns\/?/, '').split('/').filter(Boolean);
  const subRoute = segments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded' });
  }

  const store = storeOverride || getProductionOfficeVerificationCampaignStore();

  // Public GET list
  if (subRoute === '' && method === 'GET') {
    const jurisdiction = url.searchParams.get('jurisdiction') || null;
    const items = store.listCampaigns({ jurisdiction });
    return sendJson(res, 200, { items, total: items.length });
  }

  // Auth required for all mutations and audit-log
  const authUser = authUserOverride || (await resolveAuth(req));
  if (!authUser || !authUser.userId) {
    return sendJson(res, 401, { error: 'Authentication required' });
  }

  const isReviewerOrAdmin = authUser.role === 'admin' || authUser.role === 'municipal_officer';

  if (subRoute === 'audit-log' && method === 'GET') {
    if (!isReviewerOrAdmin) {
      return sendJson(res, 403, { error: 'Admin or municipal officer role required' });
    }
    const items = store.getAuditLog();
    return sendJson(res, 200, { items, total: items.length });
  }

  if (subRoute === '' && method === 'POST') {
    if (!isReviewerOrAdmin) {
      return sendJson(res, 403, { error: 'Admin or municipal officer role required to assign verification campaigns' });
    }
    const body = req.body || {};
    if (!body.title || !Array.isArray(body.officeIds) || body.officeIds.length === 0 || !body.assigneeId) {
      return sendJson(res, 400, { error: 'title, assigneeId, and non-empty officeIds[] are required' });
    }
    const expiryDays = Number(body.expiryPolicyDays || 180);
    if (Number.isNaN(expiryDays) || expiryDays < 7 || expiryDays > 365) {
      return sendJson(res, 400, { error: 'expiryPolicyDays must be between 7 and 365 days' });
    }
    const pii = detectPII(body);
    if (pii) {
      return sendJson(res, 400, { error: `Payload contains forbidden PII (${pii.join(', ')})` });
    }
    const campaign = store.createCampaign({
      title: String(body.title).trim(),
      jurisdiction: body.jurisdiction || 'All',
      assigneeId: body.assigneeId,
      officeIds: body.officeIds,
      expiryPolicyDays: expiryDays,
      createdBy: authUser.userId,
    });
    return sendJson(res, 201, { campaign });
  }

  if (subRoute === 'submit-evidence' && method === 'POST') {
    const body = req.body || {};
    if (!body.campaignId || !body.officeId || !isHttpUrl(body.sourceUrl) || !body.effectiveDate) {
      return sendJson(res, 400, {
        error: 'campaignId, officeId, valid http(s) sourceUrl, and effectiveDate are required',
      });
    }
    const pii = detectPII(body);
    if (pii) {
      return sendJson(res, 400, { error: `Evidence notes contain forbidden PII (${pii.join(', ')})` });
    }
    const result = store.submitEvidence({
      campaignId: body.campaignId,
      officeId: body.officeId,
      verifierId: authUser.userId,
      sourceUrl: body.sourceUrl.trim(),
      effectiveDate: body.effectiveDate,
      jurisdiction: body.jurisdiction,
      provenanceKind: body.provenanceKind || 'official_record',
      notes: body.notes || '',
    });
    return sendJson(res, result.status, result.ok ? { campaign: result.campaign } : { error: result.error });
  }

  if (subRoute === 'review' && method === 'POST') {
    if (!isReviewerOrAdmin) {
      return sendJson(res, 403, { error: 'Admin or municipal officer role required to approve/reject verification' });
    }
    const body = req.body || {};
    if (!body.campaignId || !body.officeId || !['APPROVE', 'REJECT'].includes(body.decision)) {
      return sendJson(res, 400, { error: 'campaignId, officeId, and decision (APPROVE|REJECT) are required' });
    }
    const pii = detectPII(body);
    if (pii) {
      return sendJson(res, 400, { error: `Review rationale contains forbidden PII (${pii.join(', ')})` });
    }
    const result = store.reviewVerification({
      campaignId: body.campaignId,
      officeId: body.officeId,
      reviewerId: authUser.userId,
      decision: body.decision,
      rationale: body.rationale || '',
    });
    return sendJson(res, result.status, result.ok ? { campaign: result.campaign } : { error: result.error });
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}
