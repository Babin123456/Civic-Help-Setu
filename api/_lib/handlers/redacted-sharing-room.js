/* global process */
/**
 * api/_lib/handlers/redacted-sharing-room.js
 *
 * Server-side API handler for the Secure Redacted Document Sharing Room (#1426).
 *
 * Routes (under /api/redacted-sharing-room):
 *   GET  /api/redacted-sharing-room             → list owner's rooms (auth required)
 *   POST /api/redacted-sharing-room             → create room (auth + zero-PII + per-file perms)
 *   POST /api/redacted-sharing-room/access      → view/download permitted file (replay + expiry + revocation)
 *   POST /api/redacted-sharing-room/revoke      → revoke room immediately (owner-only)
 *   GET  /api/redacted-sharing-room/logs        → audited access log (owner-only)
 *
 * Invariants:
 *  - Non-indexable responses (`X-Robots-Tag: noindex, nofollow, noarchive` + `Cache-Control: no-store`).
 *  - Rate limiting via abuseGuard (30 req/min).
 *  - Zero PII in room metadata, summaries, and access logs.
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  FILE_PERMISSIONS,
  getProductionRedactedSharingRoomStore,
} from '../redactedSharingRoomStore.js';
import { inspectStringForPII } from '../../../src/services/piiLeakageGuardService.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

const AADHAAR_RE = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_RE = /(?<!\d)(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/;

export function screenForPII(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input || {});
  try {
    const res = inspectStringForPII(str);
    if (res && res.hasPII) return res.detectedFields || ['pii'];
  } catch {
    // fallback
  }
  const found = [];
  if (AADHAAR_RE.test(str)) found.push('aadhaar');
  if (PAN_RE.test(str)) found.push('pan');
  if (PHONE_RE.test(str)) found.push('phone');
  return found.length > 0 ? found : null;
}

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

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.status(status).end(JSON.stringify(body));
}

function validateCreateRoom(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body must be a JSON object'];
  if (!body.title || typeof body.title !== 'string' || body.title.trim().length < 2) {
    errors.push('title must be at least 2 characters');
  }
  if (!Array.isArray(body.files) || body.files.length === 0) {
    errors.push('At least one redacted file must be included in files[]');
  } else if (body.files.length > 25) {
    errors.push('Maximum 25 files per sharing room');
  } else {
    body.files.forEach((f, idx) => {
      if (!f.fileId || typeof f.fileId !== 'string') errors.push(`files[${idx}].fileId is required`);
      if (!f.title || typeof f.title !== 'string') errors.push(`files[${idx}].title is required`);
      if (f.permission && !Object.values(FILE_PERMISSIONS).includes(f.permission)) {
        errors.push(`files[${idx}].permission must be view, download, or denied`);
      }
    });
  }
  const expiresInMs = Number(body.expiresInMs || 24 * 60 * 60 * 1000);
  if (Number.isNaN(expiresInMs) || expiresInMs < 60 * 1000 || expiresInMs > 7 * 24 * 60 * 60 * 1000) {
    errors.push('expiresInMs must be between 1 minute and 7 days');
  }
  const pii = screenForPII({ title: body.title, files: body.files });
  if (pii) {
    errors.push(`Sharing room payload contains unredacted PII (${pii.join(', ')}). Redact before sharing.`);
  }
  return errors;
}

export default async function redactedSharingRoomHandler(req, res, { authUserOverride = null, storeOverride = null } = {}) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'https://localhost');
  const pathSegments = url.pathname.replace(/^\/api\/redacted-sharing-room\/?/, '').split('/').filter(Boolean);
  const subRoute = pathSegments[0] || '';

  const ck = clientKey(req.headers || {});
  const limitDecision = rateLimiter.take(ck);
  if (!limitDecision.allowed) {
    res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
    return sendJson(res, 429, { error: 'Rate limit exceeded. Retry shortly.' });
  }

  const authUser = authUserOverride || (await resolveAuthUser(req));
  if (!authUser || !authUser.userId) {
    return sendJson(res, 401, { error: 'Authentication required. Provide a valid Bearer token.' });
  }

  const store = storeOverride || getProductionRedactedSharingRoomStore();
  const userId = authUser.userId;

  if (subRoute === 'logs' && method === 'GET') {
    const roomId = url.searchParams.get('roomId');
    if (!roomId) return sendJson(res, 400, { error: 'roomId query param is required' });
    const logRes = store.getAccessLog(roomId, userId);
    return sendJson(res, logRes.status, logRes.ok ? { items: logRes.items, total: logRes.total } : { error: logRes.error });
  }

  if (subRoute === 'revoke' && method === 'POST') {
    const { roomId } = req.body || {};
    if (!roomId) return sendJson(res, 400, { error: 'roomId is required' });
    const revRes = store.revokeRoom(roomId, userId);
    return sendJson(res, revRes.status, revRes.ok ? { room: revRes.room } : { error: revRes.error });
  }

  if (subRoute === 'access' && method === 'POST') {
    const { roomId, shareToken, fileId, action = 'view', nonce = null } = req.body || {};
    if (!roomId || !fileId) return sendJson(res, 400, { error: 'roomId and fileId are required' });
    const accRes = store.accessFile({
      roomId,
      shareToken,
      fileId,
      actorId: userId,
      action,
      nonce,
    });
    return sendJson(
      res,
      accRes.status,
      accRes.ok ? { file: accRes.file } : { error: accRes.error, code: accRes.code }
    );
  }

  if (subRoute === '' && method === 'GET') {
    const rooms = store.listOwnerRooms(userId);
    return sendJson(res, 200, { items: rooms, total: rooms.length });
  }

  if (subRoute === '' && method === 'POST') {
    const body = req.body || {};
    const errors = validateCreateRoom(body);
    if (errors.length > 0) {
      return sendJson(res, 400, { error: 'Validation failed', details: errors });
    }
    const room = store.createRoom({
      ownerId: userId,
      title: body.title.trim(),
      recipientId: body.recipientId || null,
      files: body.files,
      expiresInMs: Number(body.expiresInMs || 24 * 60 * 60 * 1000),
      maxDownloadsPerFile: Number(body.maxDownloadsPerFile || 5),
    });
    return sendJson(res, 201, { room });
  }

  return sendJson(res, 405, { error: `Method ${method} not allowed` });
}
