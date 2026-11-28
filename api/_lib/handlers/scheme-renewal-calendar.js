/**
 * api/_lib/handlers/scheme-renewal-calendar.js
 *
 * Government Scheme Renewal and Recertification Calendar API (#1417).
 *
 * Enforces:
 *   - Authentication (401)
 *   - Owner authorization & admin/reviewer governance (403)
 *   - Zero-PII validation (400)
 *   - Rate limiting (429)
 */

import { createRateLimiter } from '../abuseGuard.js';
import {
  listSchemeRenewalRules,
  saveSchemeToCalendar,
  listSavedSchemeCalendar,
  updateReminderPreferences,
  exportSchemeCalendarIcs,
  updateSchemeRuleGovernance,
  hasForbiddenPII,
} from '../../../src/services/schemeRenewalCalendarService.js';

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
    return res.status(400).json({ error: 'pii_rejected', message: 'Sensitive PII (Aadhaar, PAN, OTP, password) is forbidden.' });
  }

  if (req.method === 'GET' && path.endsWith('/rules')) {
    return res.status(200).json({ ok: true, rules: listSchemeRenewalRules(serverStorage) });
  }

  if (!actorId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
  }

  if (req.method === 'GET' && path.endsWith('/export-ics')) {
    const result = exportSchemeCalendarIcs({ actorId, storage: serverStorage });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'GET') {
    const result = listSavedSchemeCalendar({ actorId, storage: serverStorage });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/save')) {
    const result = saveSchemeToCalendar({ ...body, actorId, storage: serverStorage });
    return res.status(result.ok ? 201 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/preferences')) {
    const result = updateReminderPreferences({ ...body, actorId, storage: serverStorage });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  if (req.method === 'POST' && path.endsWith('/rules')) {
    const result = updateSchemeRuleGovernance({ ...body, actorId, role, storage: serverStorage });
    return res.status(result.ok ? 200 : result.code || 400).json(result);
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
