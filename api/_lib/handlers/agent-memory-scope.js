/* global process */
/**
 * api/_lib/handlers/agent-memory-scope.js
 *
 * Serverless API handler for Civic Agent Memory Scope and Per-Case Context Isolation (#1447):
 *   GET    /api/agent-memory-scope
 *   GET    /api/agent-memory-scope/audit-log                                (Admin-gated)
 *   GET    /api/agent-memory-scope/partitions/:tenantId/:caseId/context     (Auth + tenant/case scope)
 *   POST   /api/agent-memory-scope/partitions/:tenantId/:caseId/entries     (Auth + tenant/case scope)
 *   POST   /api/agent-memory-scope/partitions/:tenantId/:caseId/mode        (Auth + tenant/case scope)
 *   DELETE /api/agent-memory-scope/partitions/:tenantId/:caseId             (Auth + tenant/case scope)
 *   DELETE /api/agent-memory-scope/partitions/:tenantId/:caseId/entries/:id (Auth + tenant/case scope)
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import {
  CaseBoundaryViolationError,
  InvalidScopeIdentifierError,
  validateScopeIdentifier,
} from '../../../src/services/agentMemory/caseIsolationGuard.js';
import {
  MEMORY_SCOPE_MODES,
  MEMORY_SCOPE_SCHEMA_VERSION,
  createScopedMemoryEntry,
  detectSecretsOrSensitiveData,
  retrieveScopedContext,
} from '../../../src/services/agentMemory/memoryScopeIsolationLayer.js';
import { getProductionAgentMemoryScopeStore } from '../agentMemoryScopeStore.js';

const defaultRateLimiter = createRateLimiter({ limit: 40, windowMs: 60 * 1000 });

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

export async function defaultVerifyMemoryActor(req) {
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
    const tenantId =
      typeof user?.publicMetadata?.tenantId === 'string' && user.publicMetadata.tenantId.trim()
        ? user.publicMetadata.tenantId.trim()
        : '*';
    return { ok: true, actorId: claims.sub, role, tenantId };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

function isTenantAuthorized(actorTenantId, targetTenantId, role) {
  if (role === 'admin' && (!actorTenantId || actorTenantId === '*')) return true;
  if (!actorTenantId || actorTenantId === '*') return true;
  return actorTenantId === targetTenantId;
}

export function createAgentMemoryScopeHandler({
  verifyActor = defaultVerifyMemoryActor,
  getStore = getProductionAgentMemoryScopeStore,
  rateLimiter = defaultRateLimiter,
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
      return res.status(503).json({ error: 'Memory scope store unavailable.' });
    }

    if (method === 'GET' && rest.length === 0) {
      return res.status(200).json({
        schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION,
        service: 'agent-memory-scope',
        status: 'healthy',
      });
    }

    const auth = await verifyActor(req);
    if (!auth?.ok) {
      return res.status(auth?.status || 401).json({ error: auth?.error || 'Authentication required.' });
    }

    const role = auth.role === 'admin' ? 'admin' : 'citizen';

    if (method === 'GET' && rest[0] === 'audit-log' && rest.length === 1) {
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required for audit log.' });
      }
      const entries = await store.listAuditLog({ limit: query.limit });
      return res.status(200).json({ schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION, entries });
    }

    if (rest[0] === 'partitions' && rest.length >= 3) {
      let tenantId;
      let caseId;
      try {
        tenantId = validateScopeIdentifier(rest[1], 'tenantId');
        caseId = validateScopeIdentifier(rest[2], 'caseId');
      } catch (err) {
        return res.status(400).json({ error: err.message, code: 'INVALID_SCOPE_ID' });
      }

      if (!isTenantAuthorized(auth.tenantId, tenantId, role)) {
        return res.status(403).json({
          error: `Cross-tenant access denied for tenant '${tenantId}'.`,
          code: 'BOUNDARY_VIOLATION',
        });
      }

      // Enforce explicit requesting context header if provided to prevent cross-case leakage
      const headerCaseId = req.headers?.['x-case-id'];
      const headerTenantId = req.headers?.['x-tenant-id'];
      const requestingTenantId = typeof headerTenantId === 'string' && headerTenantId ? headerTenantId : tenantId;
      const requestingCaseId = typeof headerCaseId === 'string' && headerCaseId ? headerCaseId : caseId;

      if (method === 'GET' && rest.length === 4 && rest[3] === 'context') {
        try {
          const partition = await store.getOrCreatePartition(tenantId, caseId);
          const effectiveMode =
            query.noMemory === 'true' ? MEMORY_SCOPE_MODES.NO_MEMORY : partition.mode;
          const result = retrieveScopedContext({
            entries: partition.entries,
            tenantId,
            caseId,
            requestingTenantId,
            requestingCaseId,
            mode: effectiveMode,
            allowlistedCategories: partition.allowlistedCategories,
          });
          return res.status(200).json({
            schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION,
            tenantId,
            caseId,
            allowlistedCategories: partition.allowlistedCategories,
            ...result,
          });
        } catch (err) {
          const code =
            err instanceof CaseBoundaryViolationError
              ? 403
              : err instanceof InvalidScopeIdentifierError
                ? 400
                : 400;
          return res.status(code).json({ error: err.message, code: err.code || 'CONTEXT_ERROR' });
        }
      }

      if (method === 'DELETE' && rest.length === 3) {
        const deleted = await store.deletePartition(tenantId, caseId);
        await store.appendAuditLog({
          action: 'DELETE_CASE_PARTITION',
          actorId: auth.actorId,
          role,
          tenantId,
          caseId,
          status: deleted ? 'deleted' : 'not_found',
          summary: `Deleted memory partition ${tenantId}:${caseId}`,
        });
        return res.status(200).json({ schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION, deleted });
      }

      if (method === 'DELETE' && rest.length === 5 && rest[3] === 'entries') {
        const entryId = rest[4];
        const deleted = await store.deleteEntry(tenantId, caseId, entryId);
        if (!deleted) return res.status(404).json({ error: 'Memory entry not found.' });
        await store.appendAuditLog({
          action: 'DELETE_MEMORY_ENTRY',
          actorId: auth.actorId,
          role,
          tenantId,
          caseId,
          status: 'deleted',
          summary: `Deleted entry ${entryId} from ${tenantId}:${caseId}`,
        });
        return res.status(200).json({ schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION, deleted: true, entryId });
      }

      const body = parseBody(req.body);
      if (!body) {
        return res.status(400).json({ error: 'Request body must be valid JSON.' });
      }

      const secretScan = detectSecretsOrSensitiveData(body, 'request');
      if (!secretScan.clean) {
        return res.status(400).json({
          error: 'Secrets, credentials, or sensitive PII are excluded by default.',
          code: 'ERR_SECRET_OR_PII_EXCLUDED',
          details: secretScan.violations,
        });
      }

      if (method === 'POST' && rest.length === 4 && rest[3] === 'entries') {
        const partition = await store.getOrCreatePartition(tenantId, caseId);
        if (partition.mode === MEMORY_SCOPE_MODES.NO_MEMORY) {
          return res.status(200).json({
            schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION,
            stored: false,
            deterministicNoMemory: true,
            message: 'Partition is in deterministic no-memory mode; entry was not persisted.',
          });
        }
        try {
          const entry = createScopedMemoryEntry({
            tenantId,
            caseId,
            requestingTenantId,
            requestingCaseId,
            origin: body.origin,
            category: body.category || 'interaction_summary',
            content: body.content,
            sourceReference: body.sourceReference || {},
            ttlSeconds: body.ttlSeconds,
          });
          await store.saveEntry(tenantId, caseId, entry);
          await store.appendAuditLog({
            action: 'CREATE_MEMORY_ENTRY',
            actorId: auth.actorId,
            role,
            tenantId,
            caseId,
            status: entry.origin,
            summary: `Stored ${entry.category} entry (${entry.entryId})`,
          });
          return res.status(201).json({ schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION, stored: true, entry });
        } catch (err) {
          const statusCode = err instanceof CaseBoundaryViolationError ? 403 : 400;
          return res.status(statusCode).json({ error: err.message, code: err.code || 'WRITE_ERROR' });
        }
      }

      if (method === 'POST' && rest.length === 4 && rest[3] === 'mode') {
        const updated = await store.setPartitionPolicy(tenantId, caseId, {
          mode: body.mode,
          allowlistedCategories: body.allowlistedCategories,
        });
        await store.appendAuditLog({
          action: 'UPDATE_MEMORY_POLICY',
          actorId: auth.actorId,
          role,
          tenantId,
          caseId,
          status: updated.mode,
          summary: `Updated memory mode to ${updated.mode} for ${tenantId}:${caseId}`,
        });
        return res.status(200).json({
          schemaVersion: MEMORY_SCOPE_SCHEMA_VERSION,
          tenantId,
          caseId,
          mode: updated.mode,
          allowlistedCategories: updated.allowlistedCategories,
        });
      }
    }

    return res.status(404).json({ error: 'Agent memory scope endpoint not found.' });
  };
}

export default createAgentMemoryScopeHandler();
