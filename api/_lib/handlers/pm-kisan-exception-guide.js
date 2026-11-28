/**
 * api/_lib/handlers/pm-kisan-exception-guide.js
 *
 * PM-KISAN Installment Exception Diagnosis Guide API (#1418).
 *
 * Enforces:
 *   - Authentication (401)
 *   - Role authorization for mapping governance & audit logs (403)
 *   - Zero credential/PII collection (400)
 *   - Rate limiting (429)
 */

import { createRateLimiter } from '../abuseGuard.js';
import {
  listVersionedMappings,
  diagnosePmKisanStatus,
  toggleHelpDeskChecklistItem,
  updateStatusMappingGovernance,
  getGovernanceAuditLog,
  hasForbiddenPII,
  PM_KISAN_MAPPING_VERSION,
} from '../../../src/services/pmKisanExceptionGuideService.js';

const limiter = createRateLimiter({ limit: 40, windowMs: 60_000 });

const memoryMap = new Map();
const serverStorage = {
  getItem: (k) => (memoryMap.has(k) ? memoryMap.get(k) : null),
  setItem: (k, v) => memoryMap.set(k, String(v)),
  removeItem: (k) => memoryMap.delete(k),
};

function getActor(req) {
  const id = req.user?.id || req.headers?.['x-user-id'] || null;
  const role = req.user?.role || req.headers?.['x-user-role'] || 'citizen';
  return { actorId: id ? String(id).trim() : null, role: String(role).trim() };
}

export default async function handler(req, res) {
  const clientIp = req.headers?.['x-forwarded-for'] || 'local';
  const rate = limiter.take(clientIp);
  if (!rate.allowed) {
    return res.status(429).json({ error: 'rate_limit_exceeded', message: 'Too many requests.' });
  }

  const { actorId, role } = getActor(req);
  const url = String(req.url || '/');
  const path = url.split('?')[0];
  const body = req.body || {};

  if (hasForbiddenPII(body)) {
    return res.status(400).json({
      error: 'pii_rejected',
      message: 'Credentials and sensitive PII (Aadhaar, PAN, OTP, password, bank account) are never collected.',
    });
  }

  if (req.method === 'GET' && path.endsWith('/mappings')) {
    return res.status(200).json({
      ok: true,
      version: PM_KISAN_MAPPING_VERSION,
      mappings: listVersionedMappings(serverStorage),
    });
  }

  if (!actorId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
  }

  if (req.method === 'POST' && path.endsWith('/diagnose')) {
    const result = diagnosePmKisanStatus({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 201 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/checklist-toggle')) {
    const result = toggleHelpDeskChecklistItem({
      ...body,
      actorId,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/mappings')) {
    const result = updateStatusMappingGovernance({
      ...body,
      actorId,
      role,
      storage: serverStorage,
    });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'GET' && path.endsWith('/audit-log')) {
    const result = getGovernanceAuditLog({ actorId, role, storage: serverStorage });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
