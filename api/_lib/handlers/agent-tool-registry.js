/* global process */
/**
 * Serverless API handler for Governed Agent Tool Registry (#1146)
 * Routes (via api/[...path].js):
 *   GET  /api/agent-tool-registry?schema=1
 *   GET  /api/agent-tool-registry/tools
 *   POST /api/agent-tool-registry/capabilities
 *   POST /api/agent-tool-registry/invoke
 *   GET  /api/agent-tool-registry/audit        (admin only)
 *   POST /api/agent-tool-registry/revoke       (admin only)
 */

import { randomBytes } from 'node:crypto';
import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { scrubPii, scrubString } from '../piiScrubber.js';
import { resolveRole } from '../../../src/services/roleService.js';
import { createGovernedToolRegistry } from '../../../src/services/toolRegistry/governedToolRegistry.js';
import {
  schemaVersion,
  validateIssueCapabilityBody,
  validateInvokeToolBody,
  validateRevokeBody,
} from '../agentToolRegistrySchemas.js';

const defaultLimiter = createRateLimiter({ limit: 40, windowMs: 60 * 1000 });
let ephemeralDevSecret = null;
let sharedRegistry = null;

function resolveServerSecret(explicitSecret) {
  if (explicitSecret && explicitSecret.length >= 16) return explicitSecret;
  if (process.env.TOOL_CAPABILITY_SECRET && process.env.TOOL_CAPABILITY_SECRET.length >= 16) {
    return process.env.TOOL_CAPABILITY_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = randomBytes(32).toString('hex');
  }
  return ephemeralDevSecret;
}

function getDefaultRegistry() {
  if (sharedRegistry) return sharedRegistry;
  const secret = resolveServerSecret();
  if (!secret) return null;
  sharedRegistry = createGovernedToolRegistry({ secret });
  return sharedRegistry;
}

function respondJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
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
      actorId: scrubString(String(claims.sub || 'verified-user'), { maxStringLength: 80 }),
      role,
    };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

export function createAgentToolRegistryHandler({
  verifyActor = verifyClerkActor,
  getRegistry = getDefaultRegistry,
  rateLimiter = defaultLimiter,
} = {}) {
  return async function handler(req, res) {
    const key = clientKey(req.headers || {});
    if (key && rateLimiter) {
      const rate = rateLimiter.take(key);
      if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfterSeconds));
        return respondJson(res, 429, { error: 'Too many requests. Please retry later.' });
      }
    }

    const method = (req.method || 'GET').toUpperCase();
    const pathname = (req.url || '').split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    // segments: ['api', 'agent-tool-registry', ...rest]
    const rest = segments.slice(2);

    const registry = getRegistry();
    if (!registry) {
      return respondJson(res, 503, {
        error: 'Tool capability signing secret is not configured.',
        code: 'SERVICE_UNAVAILABLE',
      });
    }

    // Public metadata / health / tool catalog endpoints
    if (method === 'GET' && rest.length === 0) {
      return respondJson(res, 200, {
        schemaVersion: schemaVersion(),
        service: 'agent-tool-registry',
        status: 'healthy',
        metrics: scrubPii(registry.getMetrics()),
      });
    }

    if (method === 'GET' && rest[0] === 'tools' && rest.length === 1) {
      return respondJson(res, 200, {
        schemaVersion: schemaVersion(),
        tools: registry.listTools({ includeSchemas: true }),
      });
    }

    // All capability issuance, invocation, audit, and revocation routes require a verified actor
    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return respondJson(res, auth?.status || 401, { error: auth?.error || 'Authentication required.' });
    }

    const actorId = String(auth.actorId || '');
    const actorRole = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'POST' && rest[0] === 'capabilities' && rest.length === 1) {
      const parsed = validateIssueCapabilityBody(req.body);
      if (!parsed.valid) {
        return respondJson(res, 400, {
          error: 'Invalid capability request.',
          code: 'INVALID_REQUEST',
          details: parsed.errors,
        });
      }

      const body = parsed.value;
      // Never allow citizens to mint humanApproved capabilities directly
      const safeHumanApproved = actorRole === 'admin' ? Boolean(body.humanApproved) : false;
      const result = registry.issueCapability({
        actorUserId: actorId,
        actorRole,
        sessionId: body.sessionId || 'default-session',
        toolName: body.toolName,
        requestedScopes: body.requestedScopes || [],
        ttlSeconds: body.ttlSeconds,
        singleUse: body.singleUse !== undefined ? body.singleUse : true,
        citizenConfirmed: Boolean(body.citizenConfirmed),
        humanApproved: safeHumanApproved,
        provenanceRef: body.provenanceRef || null,
        boundArgs: body.boundArgs || null,
        correlationId: body.correlationId || 'api-cap-issue',
      });

      return respondJson(res, result.status, result.ok ? result : {
        error: result.reason,
        code: result.code,
      });
    }

    if (method === 'POST' && rest[0] === 'invoke' && rest.length === 1) {
      const parsed = validateInvokeToolBody(req.body);
      if (!parsed.valid) {
        return respondJson(res, 400, {
          error: 'Invalid tool invocation payload.',
          code: 'INVALID_REQUEST',
          details: parsed.errors,
        });
      }

      const body = parsed.value;
      const result = await registry.invokeTool({
        capabilityToken: body.capabilityToken,
        toolName: body.toolName,
        args: body.args,
        actorUserId: actorId,
        actorRole,
        sessionId: body.sessionId || 'default-session',
        correlationId: body.correlationId || 'api-tool-invoke',
        citizenConfirmed: Boolean(body.citizenConfirmed),
        humanApproved: actorRole === 'admin' ? Boolean(body.humanApproved) : false,
        provenance: body.provenance || null,
      });

      return respondJson(res, result.status, result);
    }

    // Admin-only governance routes
    if (method === 'GET' && rest[0] === 'audit' && rest.length === 1) {
      if (actorRole !== 'admin') {
        return respondJson(res, 403, { error: 'Forbidden: admin role required.', code: 'FORBIDDEN' });
      }
      const limit = Number(req.query?.limit) || 50;
      const toolName = typeof req.query?.toolName === 'string' ? req.query.toolName : null;
      const decision = typeof req.query?.decision === 'string' ? req.query.decision : null;
      return respondJson(res, 200, {
        schemaVersion: schemaVersion(),
        metrics: scrubPii(registry.getMetrics()),
        revocations: scrubPii(registry.getRevocationSnapshot()),
        events: scrubPii(registry.getAuditEvents({ limit, toolName, decision })),
      });
    }

    if (method === 'POST' && rest[0] === 'revoke' && rest.length === 1) {
      if (actorRole !== 'admin') {
        return respondJson(res, 403, { error: 'Forbidden: admin role required.', code: 'FORBIDDEN' });
      }
      const parsed = validateRevokeBody(req.body);
      if (!parsed.valid) {
        return respondJson(res, 400, {
          error: 'Invalid revocation request.',
          code: 'INVALID_REQUEST',
          details: parsed.errors,
        });
      }
      const { targetType, targetId, action = 'revoke', reason } = parsed.value;
      const safeReason = scrubString(reason || 'Admin governance action', { maxStringLength: 240 });

      if (targetType === 'tool') {
        if (action === 'restore') {
          const restored = registry.restoreTool(targetId, { actorId, reason: safeReason });
          return respondJson(res, 200, { ok: true, restored, targetType, targetId });
        }
        const record = registry.revokeTool(targetId, { actorId, reason: safeReason });
        return respondJson(res, 200, { ok: true, record: scrubPii(record) });
      }

      if (targetType === 'user') {
        if (action === 'restore') {
          const restored = registry.restoreUser(targetId);
          return respondJson(res, 200, { ok: true, restored, targetType, targetId });
        }
        const record = registry.revokeUser(targetId, { actorId, reason: safeReason });
        return respondJson(res, 200, { ok: true, record: scrubPii(record) });
      }

      if (action === 'restore') {
        return respondJson(res, 400, { error: 'Individual capabilities cannot be restored after revocation.' });
      }
      const record = registry.revokeCapability(targetId, { actorId, reason: safeReason });
      return respondJson(res, 200, { ok: true, record: scrubPii(record) });
    }

    return respondJson(res, 404, { error: 'Tool registry endpoint not found.' });
  };
}

export default createAgentToolRegistryHandler();
