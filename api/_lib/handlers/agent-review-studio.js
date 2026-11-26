/* global process */
/**
 * Serverless API handler for Human-in-the-Loop Agent Review Studio (#1150)
 * Route: /api/agent-review-studio
 *
 * Enforces:
 *  - Rate limiting & single-flight deduplication via abuseGuard.js
 *  - Verified session & RBAC: verifies Clerk Bearer token + publicMetadata role (never trusts client role headers)
 *  - Untrusted input validation & zero-PII enforcement at service boundary
 *  - Optimistic concurrency (409 on version mismatch) & post-approval silent-regeneration block
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  REVIEW_CONTRACT_VERSION,
  REVIEW_STATUS,
  validateReviewProposal,
  validateReviewDecision,
  assertCanRegenerateOrEdit,
  SilentRegenerationForbiddenError,
  VersionConflictError,
  sanitizeReviewText,
} from '../../../src/services/agentReviewStudioService.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

export const AGENT_REVIEW_STORE = new Map();
export const AGENT_REVIEW_AUDIT_LOG = [];
const MAX_STORE_ITEMS = 500;

function respondJson(res, status, body, extraHeaders = {}) {
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }
  return res.status(status).json(body);
}

async function verifyClerkActor(req) {
  const token = bearerToken(req.headers || {});
  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, status: 503, error: 'Authentication service is not configured.' };
  }

  try {
    const { verifyToken, createClerkClient } = await import('@clerk/backend');
    const claims = await verifyToken(token, { secretKey });
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(claims.sub);
    const role = resolveRole(user?.publicMetadata);
    return {
      ok: true,
      actorId: sanitizeReviewText(claims.sub, 80) || 'verified-user',
      role,
    };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

export function createAgentReviewStudioHandler({ verifyActor = verifyClerkActor } = {}) {
  return async function handler(req, res) {
    const key = clientKey(req.headers);
    if (key) {
      const rate = rateLimiter.take(key);
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSeconds));
        return respondJson(res, 429, { error: 'Too many requests. Please retry later.' });
      }
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return respondJson(res, auth?.status || 401, { error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';
    const actorId = sanitizeReviewText(auth.actorId || 'verified-user', 80);
    const method = (req.method || 'GET').toUpperCase();

    // GET: List or inspect review items (admin only)
    if (method === 'GET') {
      if (role !== 'admin') return respondJson(res, 403, { error: 'Forbidden: admin reviewer role required.' });

      const statusFilter = req.query?.status || 'all';
      const items = Array.from(AGENT_REVIEW_STORE.values()).filter((item) =>
        statusFilter === 'all' ? true : item.status === statusFilter
      );
      return respondJson(res, 200, {
        contractVersion: REVIEW_CONTRACT_VERSION,
        count: items.length,
        items,
      });
    }

    // POST: Submit untrusted AI proposal or fork an approved version
    if (method === 'POST') {
      const body = req.body;
      if (body && body.action === 'fork') {
        if (role !== 'admin') return respondJson(res, 403, { error: 'Forbidden: admin reviewer role required to fork.' });
        const target = AGENT_REVIEW_STORE.get(body.id);
        if (!target) return respondJson(res, 404, { error: 'Review item not found.' });

        const rationale = sanitizeReviewText(body.rationale, 2000);
        if (!rationale || rationale.length < 8) {
          return respondJson(res, 400, { error: 'Forking a new version requires a rationale of at least 8 characters.' });
        }

        const nowIso = new Date().toISOString();
        AGENT_REVIEW_STORE.set(target.id, { ...target, status: REVIEW_STATUS.SUPERSEDED, updatedAt: nowIso });

        const forked = {
          ...target,
          id: `${target.rootId || target.id}-v${target.version + 1}`,
          rootId: target.rootId || target.id,
          parentVersionId: target.id,
          version: target.version + 1,
          status: REVIEW_STATUS.PENDING_REVIEW,
          forkRationale: rationale,
          createdAt: nowIso,
          updatedAt: nowIso,
          lastDecision: null,
          decisionHistory: [],
        };
        AGENT_REVIEW_STORE.set(forked.id, forked);
        return respondJson(res, 201, { contractVersion: REVIEW_CONTRACT_VERSION, item: forked });
      }

      const { valid, errors, normalized } = validateReviewProposal(body);
      if (!valid) {
        return respondJson(res, 400, { error: 'Invalid proposal payload.', details: errors });
      }

      const flightKey = normalized.idempotencyKey
        ? `submit:${normalized.idempotencyKey}`
        : `submit:${Date.now()}:${Math.random()}`;

      const result = await singleFlight.run(flightKey, async () => {
        if (normalized.idempotencyKey) {
          for (const existing of AGENT_REVIEW_STORE.values()) {
            if (existing.idempotencyKey === normalized.idempotencyKey) {
              return { status: 200, item: existing };
            }
          }
        }

        if (AGENT_REVIEW_STORE.size >= MAX_STORE_ITEMS) {
          const oldestKey = AGENT_REVIEW_STORE.keys().next().value;
          if (oldestKey) AGENT_REVIEW_STORE.delete(oldestKey);
        }

        const nowIso = new Date().toISOString();
        const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = {
          id,
          rootId: id,
          version: 1,
          status: REVIEW_STATUS.PENDING_REVIEW,
          ...normalized,
          submittedByRole: role,
          createdAt: nowIso,
          updatedAt: nowIso,
          decisionHistory: [],
        };
        AGENT_REVIEW_STORE.set(id, record);
        AGENT_REVIEW_AUDIT_LOG.unshift({
          eventType: 'REVIEW_PROPOSAL_SUBMITTED',
          itemId: id,
          version: 1,
          actorRole: role,
          timestamp: nowIso,
        });
        return { status: 201, item: record };
      });

      return respondJson(res, result.status, {
        contractVersion: REVIEW_CONTRACT_VERSION,
        item: result.item,
      });
    }

    // PATCH: Record human reviewer decision with optimistic concurrency
    if (method === 'PATCH') {
      if (role !== 'admin') return respondJson(res, 403, { error: 'Forbidden: admin reviewer role required.' });

      const id = sanitizeReviewText(req.body?.id || req.query?.id || '', 100);
      if (!id) return respondJson(res, 400, { error: 'Review item id is required.' });

      const target = AGENT_REVIEW_STORE.get(id);
      if (!target) return respondJson(res, 404, { error: 'Review item not found.' });

      if (req.body?.action === 'regenerate') {
        try {
          assertCanRegenerateOrEdit(target);
        } catch (err) {
          if (err instanceof SilentRegenerationForbiddenError) {
            return respondJson(res, 409, { error: err.message, code: err.code });
          }
        }
        return respondJson(res, 409, {
          error: 'Silent regeneration is prohibited; submit a version fork for human review.',
          code: 'SILENT_REGEN_FORBIDDEN',
        });
      }

      const { valid, errors, normalized } = validateReviewDecision(req.body);
      if (!valid) {
        return respondJson(res, 400, { error: 'Invalid decision payload.', details: errors });
      }

      if (normalized.idempotencyKey) {
        const prior = target.decisionHistory.find((d) => d.idempotencyKey === normalized.idempotencyKey);
        if (prior) {
          return respondJson(res, 200, { contractVersion: REVIEW_CONTRACT_VERSION, item: target });
        }
      }

      try {
        assertCanRegenerateOrEdit(target);
        if (target.version !== normalized.expectedVersion) {
          throw new VersionConflictError(id, normalized.expectedVersion, target.version);
        }
      } catch (err) {
        if (err instanceof SilentRegenerationForbiddenError || err instanceof VersionConflictError) {
          return respondJson(res, 409, { error: err.message, code: err.code });
        }
        throw err;
      }

      const statusMap = {
        approve: REVIEW_STATUS.APPROVED,
        edit: REVIEW_STATUS.EDITED_APPROVED,
        reject: REVIEW_STATUS.REJECTED,
        escalate: REVIEW_STATUS.ESCALATED,
      };

      const nowIso = new Date().toISOString();
      const decisionEntry = {
        decision: normalized.decision,
        rationale: normalized.rationale,
        reviewer: actorId,
        reviewerRole: role,
        decidedAt: nowIso,
        fromVersion: target.version,
        toVersion: target.version + 1,
        idempotencyKey: normalized.idempotencyKey,
      };

      const updated = {
        ...target,
        status: statusMap[normalized.decision],
        version: target.version + 1,
        claims: normalized.decision === 'edit' ? normalized.editedClaims : target.claims,
        updatedAt: nowIso,
        lastDecision: decisionEntry,
        decisionHistory: [...target.decisionHistory, decisionEntry],
      };

      AGENT_REVIEW_STORE.set(id, updated);
      AGENT_REVIEW_AUDIT_LOG.unshift({
        eventType: 'REVIEW_DECISION_RECORDED',
        itemId: id,
        version: updated.version,
        decision: normalized.decision,
        status: updated.status,
        actorRole: role,
        timestamp: nowIso,
      });

      return respondJson(res, 200, { contractVersion: REVIEW_CONTRACT_VERSION, item: updated });
    }

    return respondJson(res, 405, { error: `Method ${method} not allowed.` });
  };
}

export default createAgentReviewStudioHandler();
