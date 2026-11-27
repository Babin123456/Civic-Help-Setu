/* global process */
/**
 * api/_lib/handlers/agent-approval-inbox.js
 *
 * Serverless API handler for Civic Agent Approval Inbox and Action Simulation (#1446):
 *   GET  /api/agent-approval-inbox
 *   GET  /api/agent-approval-inbox/proposals              (Admin-gated)
 *   GET  /api/agent-approval-inbox/proposals/:id          (Admin-gated)
 *   GET  /api/agent-approval-inbox/decision-log           (Admin-gated)
 *   POST /api/agent-approval-inbox/proposals              (Authenticated + server-side idempotency)
 *   POST /api/agent-approval-inbox/proposals/:id/simulate (Admin-gated dry-run simulation)
 *   POST /api/agent-approval-inbox/proposals/:id/decide   (Admin-gated + jurisdiction + idempotency)
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  APPROVAL_INBOX_SCHEMA_VERSION,
  createActionProposal,
  decideActionProposal,
  simulateActionProposal,
  validateInboxZeroPii,
} from '../../../src/services/agentApprovalInboxService.js';
import { getProductionAgentApprovalInboxStore } from '../agentApprovalInboxStore.js';

const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const defaultRateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });
const defaultSingleFlight = createSingleFlight();

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

export async function defaultVerifyApprovalActor(req) {
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
    const jurisdiction =
      typeof user?.publicMetadata?.jurisdiction === 'string' && user.publicMetadata.jurisdiction.trim()
        ? user.publicMetadata.jurisdiction.trim()
        : '*';
    return { ok: true, actorId: claims.sub, role, jurisdiction };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

function isJurisdictionAuthorized(operatorJurisdiction, targetJurisdiction) {
  if (!operatorJurisdiction || operatorJurisdiction === '*') return true;
  if (!targetJurisdiction || targetJurisdiction === 'UNSPECIFIED') return false;
  return operatorJurisdiction.toLowerCase() === String(targetJurisdiction).trim().toLowerCase();
}

export function createAgentApprovalInboxHandler({
  verifyActor = defaultVerifyApprovalActor,
  getStore = getProductionAgentApprovalInboxStore,
  rateLimiter = defaultRateLimiter,
  singleFlight = defaultSingleFlight,
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
      return res.status(503).json({ error: 'Approval inbox store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION,
        service: 'agent-approval-inbox',
        status: 'healthy',
      });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'proposals' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin operator role required.' });
      const proposals = await store.listProposals({
        status: query.status || null,
        jurisdiction: query.jurisdiction || null,
        limit: query.limit,
      });
      return res.status(200).json({ schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION, proposals });
    }

    if (method === 'GET' && rest[0] === 'proposals' && rest.length === 2) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin operator role required.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid proposalId format.' });
      const proposal = await store.getProposal(rest[1]);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });
      return res.status(200).json({ schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION, proposal });
    }

    if (method === 'GET' && rest[0] === 'decision-log' && rest.length === 1) {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin operator role required.' });
      const log = await store.listDecisionLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION, ...log });
    }

    const body = parseBody(req.body);
    if (!body) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    const piiCheck = validateInboxZeroPii(body, 'request');
    if (!piiCheck.valid) {
      return res.status(400).json({
        error: 'PII or sensitive credentials are strictly prohibited.',
        code: 'ERR_PII_PROHIBITED',
        details: piiCheck.violations,
      });
    }

    if (method === 'POST' && rest[0] === 'proposals' && rest.length === 1) {
      const idempotencyKey =
        req.headers?.['idempotency-key'] || body.idempotencyKey || null;
      if (idempotencyKey) {
        const existing = await store.findByIdempotencyKey(idempotencyKey);
        if (existing) {
          return res.status(200).json({
            schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION,
            proposal: existing,
            idempotentReplay: true,
          });
        }
      }

      const created = createActionProposal({ ...body, idempotencyKey }, auth.actorId);
      if (!created.valid) {
        return res.status(400).json({ error: 'Invalid action proposal.', details: created.errors });
      }

      const saved = await singleFlight.run(`apr:${idempotencyKey || created.proposal.proposalId}`, async () => {
        await store.saveProposal(created.proposal);
        return created.proposal;
      });

      return res.status(201).json({
        schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION,
        proposal: saved,
        idempotentReplay: false,
      });
    }

    if (method === 'POST' && rest[0] === 'proposals' && rest.length === 3 && rest[2] === 'simulate') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin operator role required.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid proposalId.' });
      const proposal = await store.getProposal(rest[1]);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });

      const simulation = simulateActionProposal(proposal);
      return res.status(200).json({ schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION, simulation });
    }

    if (method === 'POST' && rest[0] === 'proposals' && rest.length === 3 && rest[2] === 'decide') {
      if (role !== 'admin') return res.status(403).json({ error: 'Admin operator role required.' });
      if (!ID_SEGMENT.test(rest[1])) return res.status(400).json({ error: 'Invalid proposalId.' });
      const proposal = await store.getProposal(rest[1]);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });

      if (!isJurisdictionAuthorized(auth.jurisdiction, proposal.jurisdiction)) {
        return res.status(403).json({
          error: `Operator jurisdiction '${auth.jurisdiction}' cannot decide proposal for '${proposal.jurisdiction}'.`,
        });
      }

      const idempotencyKey = req.headers?.['idempotency-key'] || body.idempotencyKey || null;
      const prevLogHash = await store.getLatestLogHash();

      try {
        const result = decideActionProposal(proposal, {
          actorId: auth.actorId,
          role,
          decision: body.decision,
          rationale: body.rationale || '',
          editedToolCalls: body.editedToolCalls || null,
          idempotencyKey,
          prevLogHash,
        });

        if (!result.idempotentReplay) {
          await store.saveProposal(result.proposal);
          if (result.logEntry) {
            await store.appendDecisionLog(result.logEntry);
          }
        }

        return res.status(200).json({
          schemaVersion: APPROVAL_INBOX_SCHEMA_VERSION,
          proposal: result.proposal,
          logEntry: result.logEntry,
          idempotentReplay: result.idempotentReplay,
        });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    return res.status(404).json({ error: 'Approval inbox endpoint not found.' });
  };
}

export default createAgentApprovalInboxHandler();
