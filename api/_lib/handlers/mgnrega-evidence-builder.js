/**
 * api/_lib/handlers/mgnrega-evidence-builder.js
 *
 * MGNREGA Work-Demand and Wage Delay Evidence Builder API (#1419).
 *
 * Enforces:
 *   - Authentication (401)
 *   - Worker-owner authorization (403)
 *   - Zero-PII validation (400)
 *   - Rate limiting (429)
 */

import { createRateLimiter } from '../abuseGuard.js';
import {
  createEvidenceCase,
  recordWorkAllocation,
  addMusterRollAndWageEvidence,
  exportPrivacySafeComplaintDossier,
  getEvidenceCase,
  hasForbiddenPII,
} from '../../../src/services/mgnregaEvidenceBuilderService.js';

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
    return res.status(400).json({ error: 'pii_rejected', message: 'Sensitive PII (Aadhaar, PAN, OTP, password, bank account) is forbidden.' });
  }

  if (req.method === 'POST' && path.endsWith('/cases')) {
    const result = createEvidenceCase({
      ...body,
      workerId: actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 201 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/allocation')) {
    const result = recordWorkAllocation({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/muster-evidence')) {
    const result = addMusterRollAndWageEvidence({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 201 : result.code || 400).json(result);
  }

  if (req.method === 'GET' && path.endsWith('/export')) {
    const query = req.query || {};
    const result = exportPrivacySafeComplaintDossier({
      caseId: query.caseId,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'GET') {
    const query = req.query || {};
    const result = getEvidenceCase({
      caseId: query.caseId,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
