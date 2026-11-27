/* global process */
/**
 * api/_lib/handlers/civic-draft-sync.js
 *
 * Server-side API handler for the Offline-First Civic Application Draft Sync Engine (#1424).
 *
 * Routes (all under /api/civic-draft-sync):
 *   GET  /api/civic-draft-sync            → list authenticated user's synced drafts
 *   POST /api/civic-draft-sync            → upsert a draft (idempotent, with conflict detection)
 *   POST /api/civic-draft-sync/resolve    → resolve a conflict for a specific draft
 *   GET  /api/civic-draft-sync/audit-log  → admin-only redacted audit log
 *
 * Invariants:
 *  - Clerk JWT auth required for all routes.
 *  - Rate limiting via abuseGuard.
 *  - Zero PII: payloads are screened with inspectStringForPII.
 *  - Idempotency via idempotencyMiddleware.
 *  - No Aadhaar, PAN, OTPs, passwords, or biometrics.
 *  - Admin role required for audit log.
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { getProductionCivicDraftSyncStore } from '../civicDraftSyncStore.js';
import { inspectStringForPII } from '../../src/services/piiLeakageGuardService.js';

// Re-use the shared idempotency layer already imported in [...path].js (applied at gateway level).
// Here we also do local key-based short-circuit for the POST route.

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

const ALLOWED_ENTITY_TYPES = new Set(['checklist', 'application_draft', 'saved_note']);
const MAX_PAYLOAD_BYTES = 500 * 1024; // 500 KiB
const SCHEMA_VERSION_SUPPORTED = [1];

// ---------------------------------------------------------------------------
// AUTH HELPER (Clerk)
// ---------------------------------------------------------------------------

async function resolveAuthUser(req) {
  try {
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const authHeader = req.headers?.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!bearerToken) return null;
    const { sub: userId, role } = await clerkClient.verifyToken(bearerToken);
    return { userId, role: role || 'citizen' };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PII SCREENING
// ---------------------------------------------------------------------------

function screenPayloadForPII(payload) {
  const payloadStr = JSON.stringify(payload || {});
  try {
    const result = inspectStringForPII(payloadStr);
    if (result && result.hasPII) {
      return result.detectedFields || ['unknown'];
    }
  } catch {
    // Fall back to basic regex check
    const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
    const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
    const PHONE_RE = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;
    if (AADHAAR_RE.test(payloadStr)) return ['aadhaar'];
    if (PAN_RE.test(payloadStr)) return ['pan'];
    if (PHONE_RE.test(payloadStr)) return ['phone'];
  }
  return null;
}

// ---------------------------------------------------------------------------
// VALIDATORS
// ---------------------------------------------------------------------------

function validateUpsertPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body must be a JSON object'];

  if (!body.draftId || typeof body.draftId !== 'string' || !/^[\w-]{1,128}$/.test(body.draftId)) {
    errors.push('draftId must be a 1-128 character alphanumeric/hyphen/underscore string');
  }
  if (!ALLOWED_ENTITY_TYPES.has(body.entityType)) {
    errors.push(`entityType must be one of: ${[...ALLOWED_ENTITY_TYPES].join(', ')}`);
  }
  if (body.schemaVersion !== undefined && !SCHEMA_VERSION_SUPPORTED.includes(Number(body.schemaVersion))) {
    errors.push(`schemaVersion ${body.schemaVersion} is not supported; supported: ${SCHEMA_VERSION_SUPPORTED.join(', ')}`);
  }
  if (body.payload !== undefined) {
    const payloadStr = JSON.stringify(body.payload);
    if (new Blob([payloadStr]).size > MAX_PAYLOAD_BYTES) {
      errors.push('payload exceeds 500 KiB limit');
    }
  }

  // PII screen on the entire body
  const piiFields = screenPayloadForPII(body.payload);
  if (piiFields) {
    errors.push(`Payload contains forbidden personal data (${piiFields.join(', ')}). No Aadhaar, PAN, phone numbers or biometrics.`);
  }

  return errors;
}

function validateResolvePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body must be a JSON object'];
  if (!body.draftId || typeof body.draftId !== 'string') errors.push('draftId is required');
  const VALID_STRATEGIES = ['KEEP_LOCAL', 'KEEP_REMOTE', 'MANUAL_MERGE'];
  if (!VALID_STRATEGIES.includes(body.strategy)) {
    errors.push(`strategy must be one of: ${VALID_STRATEGIES.join(', ')}`);
  }
  if (body.strategy === 'MANUAL_MERGE' && (!body.resolvedPayload || typeof body.resolvedPayload !== 'object')) {
    errors.push('resolvedPayload is required when strategy is MANUAL_MERGE');
  }
  if (body.resolvedPayload) {
    const piiFields = screenPayloadForPII(body.resolvedPayload);
    if (piiFields) {
      errors.push(`resolvedPayload contains forbidden personal data (${piiFields.join(', ')})`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// RESPONSE HELPERS
// ---------------------------------------------------------------------------

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).end(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// ROUTE HANDLERS
// ---------------------------------------------------------------------------

async function handleGet(req, res, store, userId) {
  const url = new URL(req.url || '/', `https://localhost`);
  const entityType = url.searchParams.get('entityType') || null;
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
  const offset = Number(url.searchParams.get('offset') || 0);

  if (entityType && !ALLOWED_ENTITY_TYPES.has(entityType)) {
    return json(res, 400, { error: `Invalid entityType: ${entityType}` });
  }

  const result = store.listUserDrafts(userId, { entityType, limit, offset });
  return json(res, 200, {
    items: result.items,
    total: result.total,
    limit,
    offset,
    generatedAt: new Date().toISOString(),
  });
}

async function handlePost(req, res, store, userId) {
  const body = req.body || {};

  const errors = validateUpsertPayload(body);
  if (errors.length) {
    return json(res, 400, { error: 'Validation failed', details: errors });
  }

  const { draftId, entityType, schemaVersion, payload, idempotencyKey, jurisdictionId } = body;

  const result = store.upsertDraft({
    draftId,
    userId,
    entityType,
    schemaVersion: Number(schemaVersion || 1),
    payload,
    idempotencyKey,
    jurisdictionId: jurisdictionId || 'all',
  });

  if (result._conflict) {
    return json(res, 409, {
      error: 'Conflict detected',
      code: 'ERR_CONFLICT_DETECTED',
      conflict: {
        draftId,
        serverRevision: result._conflict.serverRevision,
        clientRevision: result._conflict.clientRevision,
        conflictAt: result._conflict.conflictAt,
      },
      instructions: 'Retrieve the server copy, merge locally, then POST again with the resolved payload.',
    });
  }

  return json(res, 201, { draftId: result.draftId, revision: result.revision, syncStatus: result.syncStatus });
}

async function handleResolve(req, res, store, userId) {
  const body = req.body || {};

  const errors = validateResolvePayload(body);
  if (errors.length) {
    return json(res, 400, { error: 'Validation failed', details: errors });
  }

  const { draftId, strategy, resolvedPayload } = body;

  // Verify ownership
  const existing = store.getDraft(draftId, userId);
  if (!existing) {
    return json(res, 404, { error: 'Draft not found or access denied', draftId });
  }
  if (existing.syncStatus !== 'CONFLICTED') {
    return json(res, 409, { error: 'Draft is not in CONFLICTED state', currentStatus: existing.syncStatus });
  }

  const resolved = store.resolveConflict(draftId, userId, {
    resolvedPayload: strategy === 'KEEP_LOCAL'
      ? existing._conflict?.clientPayload
      : strategy === 'KEEP_REMOTE'
        ? existing._conflict?.serverPayload
        : resolvedPayload,
    strategy,
    resolvedBy: userId,
  });

  return json(res, 200, {
    draftId: resolved.draftId,
    revision: resolved.revision,
    syncStatus: resolved.syncStatus,
    strategy,
    resolvedAt: resolved.updatedAt,
  });
}

async function handleAuditLog(req, res, store, userRole) {
  if (userRole !== 'admin' && userRole !== 'municipal_officer') {
    return json(res, 403, { error: 'Admin or municipal officer role required for audit log access' });
  }

  const url = new URL(req.url || '/', `https://localhost`);
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
  const offset = Number(url.searchParams.get('offset') || 0);

  const result = store.getAuditLog({ limit, offset });
  return json(res, 200, {
    items: result.items,
    total: result.total,
    limit,
    offset,
    generatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// MAIN HANDLER (registered in api/[...path].js as "civic-draft-sync")
// ---------------------------------------------------------------------------

export default async function civicDraftSyncHandler(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', `https://localhost`);
  const pathSegments = url.pathname.replace(/^\/api\/civic-draft-sync\/?/, '').split('/').filter(Boolean);
  const subRoute = pathSegments[0] || '';

  // Rate limit (applied to all routes)
  const ck = clientKey(req);
  if (!rateLimiter(ck)) {
    return json(res, 429, { error: 'Rate limit exceeded. Please retry after 60 seconds.' });
  }

  // Auth (required for all routes)
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    return json(res, 401, { error: 'Authentication required. Provide a valid Bearer token.' });
  }
  const { userId, role } = authUser;

  // Get the store
  const store = getProductionCivicDraftSyncStore();

  // Route dispatch
  if (subRoute === 'audit-log' && method === 'GET') {
    return handleAuditLog(req, res, store, role);
  }

  if (subRoute === 'resolve' && method === 'POST') {
    return handleResolve(req, res, store, userId);
  }

  if (subRoute === '' && method === 'GET') {
    return handleGet(req, res, store, userId);
  }

  if (subRoute === '' && method === 'POST') {
    return handlePost(req, res, store, userId);
  }

  return json(res, 405, { error: `Method ${method} not allowed for this route` });
}
