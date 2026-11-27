/**
 * api/_lib/handlers/caregiver-document-checklist.js
 *
 * Caregiver-Managed Multi-Person Civic Document Checklist API (#1421).
 *
 * Enforces:
 *   - Authentication (401 when missing)
 *   - Per-person access scopes & guardian/consent rules (403 on cross-profile or revoked consent)
 *   - Zero-PII validation (400 on Aadhaar/PAN/password/OTP/biometrics)
 *   - Rate limiting
 */

import { createRateLimiter } from '../abuseGuard.js';
import {
  createHouseholdWorkspace,
  addPersonRecord,
  updatePersonConsent,
  addApplicationChecklist,
  toggleChecklistItem,
  getPersonWorkspace,
  exportPersonChecklist,
  deletePersonOrApplication,
  getHouseholdAuditLog,
  hasForbiddenPII,
} from '../../../src/services/caregiverChecklistService.js';

const limiter = createRateLimiter({ limit: 40, windowMs: 60_000 });

// In-memory storage adapter for serverless API handler
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

  if (req.method === 'POST' && path.endsWith('/households')) {
    try {
      const household = createHouseholdWorkspace({
        householdName: body.householdName,
        caregiverId: actorId,
        storage: serverStorage,
      });
      return res.status(201).json({ ok: true, household });
    } catch (err) {
      return res.status(400).json({ error: 'invalid_request', message: err.message });
    }
  }

  if (req.method === 'POST' && path.endsWith('/persons')) {
    const result = addPersonRecord({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 201 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/consent')) {
    const result = updatePersonConsent({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/applications')) {
    const result = addApplicationChecklist({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 201 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/checklist-toggle')) {
    const result = toggleChecklistItem({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'GET' && path.endsWith('/export')) {
    const query = req.query || {};
    const result = exportPersonChecklist({
      householdId: query.householdId,
      personId: query.personId,
      applicationId: query.applicationId || null,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'GET' && path.endsWith('/audit-log')) {
    const query = req.query || {};
    const result = getHouseholdAuditLog({
      householdId: query.householdId,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'GET') {
    const query = req.query || {};
    const result = getPersonWorkspace({
      householdId: query.householdId,
      personId: query.personId,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'DELETE') {
    const query = req.query || {};
    const result = deletePersonOrApplication({
      householdId: query.householdId || body.householdId,
      personId: query.personId || body.personId,
      applicationId: query.applicationId || body.applicationId || null,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
