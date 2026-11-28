/**
 * api/_lib/handlers/senior-proxy-assistance.js
 *
 * Senior-Citizen Public Service Proxy and Assistance API (#1420).
 *
 * Enforces:
 *   - Authentication (401)
 *   - Separate credentials & owner-only approval/revocation (403)
 *   - Permission expiry & immediate revocation propagation (403)
 *   - Zero-PII validation (400)
 *   - Rate limiting (429)
 */

import { createRateLimiter } from '../abuseGuard.js';
import {
  createProxyDelegation,
  approveProxyDelegation,
  revokeProxyDelegation,
  performDelegatedChecklistEdit,
  performDelegatedReminder,
  performDelegatedTrackingUpdate,
  getProxyActivityHistory,
  hasForbiddenPII,
} from '../../../src/services/seniorProxyAssistanceService.js';

const limiter = createRateLimiter({ limit: 40, windowMs: 60_000 });

const memoryMap = new Map();
const serverStorage = {
  getItem: (k) => (memoryMap.has(k) ? memoryMap.get(k) : null),
  setItem: (k, v) => memoryMap.set(k, String(v)),
  removeItem: (k) => memoryMap.delete(k),
};

function getActorId(req) {
  if (req.user?.id) return String(req.user.id);
  const hdr = req.headers?.['x-user-id'];
  if (hdr) return String(hdr).trim();
  const auth = req.headers?.authorization || '';
  if (auth.startsWith('Bearer ') && auth.length > 7) {
    return auth.slice(7).trim();
  }
  return null;
}

export default async function handler(req, res) {
  const clientIp = req.headers?.['x-forwarded-for'] || 'local';
  const rate = limiter.take(clientIp);
  if (!rate.allowed) {
    return res.status(429).json({ error: 'rate_limit_exceeded', message: 'Too many requests.' });
  }

  const actorId = getActorId(req);
  if (!actorId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
  }

  const url = String(req.url || '/');
  const path = url.split('?')[0];
  const body = req.body || {};

  if (hasForbiddenPII(body)) {
    return res.status(400).json({ error: 'pii_rejected', message: 'Sensitive PII (Aadhaar, PAN, OTP, password, biometric) is forbidden.' });
  }

  if (req.method === 'POST' && path.endsWith('/delegations')) {
    const result = createProxyDelegation({
      ...body,
      seniorOwnerId: actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 201 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/approve')) {
    const result = approveProxyDelegation({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/revoke')) {
    const result = revokeProxyDelegation({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/checklist-edit')) {
    const result = performDelegatedChecklistEdit({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/reminders')) {
    const result = performDelegatedReminder({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 201 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/tracking-update')) {
    const result = performDelegatedTrackingUpdate({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'GET' && path.endsWith('/activity')) {
    const query = req.query || {};
    const result = getProxyActivityHistory({
      delegationId: query.delegationId,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
