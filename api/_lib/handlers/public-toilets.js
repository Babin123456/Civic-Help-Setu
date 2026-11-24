/**
 * api/_lib/handlers/public-toilets.js
 * Server-side endpoint for validating public toilet incident reports,
 * citizen feedback, and operator status updates (#758).
 *
 * Invariants:
 *  - Rate limiting via abuseGuard; durable transactional idempotency.
 *  - Honeypot anti-bot validation.
 *  - Zero PII: Rejects submissions containing Aadhaar, PAN, phone numbers, or passwords.
 *  - Returns a server-issued receipt only after durable persistence.
 *  - Queued for audit and moderation before persisting to verified public directory records.
 */

import { createRateLimiter } from '../abuseGuard.js';
import { getProductionToiletStore } from '../publicToiletStore.js';
import { authorizeToiletModerator } from '../toiletModerator.js';

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const FORBIDDEN_WORDS = ['password', 'secret', 'auth_token', 'private_key'];

const sanitizeText = (val, maxLen = 1000) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

/** Legacy display checksum only; durable receipts are issued by the store. */
export const generateToiletReceiptSeal = (facilityId, timestamp) => {
  const seed = `${facilityId}|${timestamp}|CIVIC_TOILET_SEAL`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `PT-SEAL-${p1}-${p2}`;
};

export function validateToiletSubmissionPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a valid JSON object.'];
  }

  // Honeypot check
  if (body.website_trap || body.bot_honey) {
    errors.push('Automated submission detected.');
  }

  const facilityId = sanitizeText(body.facilityId, 100);
  if (!facilityId) {
    errors.push('facilityId is mandatory.');
  }

  const reportType = sanitizeText(body.reportType, 50);
  if (!['maintenance_issue', 'citizen_feedback', 'cleaning_log'].includes(reportType)) {
    errors.push('Invalid reportType: must be maintenance_issue, citizen_feedback, or cleaning_log.');
  }

  const description = sanitizeText(body.description || body.comment || '', 1000);
  if (reportType !== 'cleaning_log' && description.length < 5) {
    errors.push('Description/comment must be at least 5 characters long.');
  }

  // Zero-PII validations
  if (AADHAAR_REGEX.test(description)) {
    errors.push('Submission contains sensitive Aadhaar identity number.');
  }
  if (PAN_REGEX.test(description)) {
    errors.push('Submission contains sensitive PAN card number.');
  }
  if (PHONE_REGEX.test(description)) {
    errors.push('Submission contains personal phone numbers; please use anonymous issue descriptions.');
  }

  const lowerDesc = description.toLowerCase();
  for (const forbidden of FORBIDDEN_WORDS) {
    if (lowerDesc.includes(forbidden)) {
      errors.push('Submission contains forbidden authentication keywords.');
      break;
    }
  }

  return errors;
}

export function createPublicToiletHandler({
  getStore = getProductionToiletStore,
  authorizeModerator = authorizeToiletModerator,
} = {}) {
const rateLimiter = createRateLimiter({ limit: 15, windowMs: 60 * 1000 });
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method === 'GET' && req.query?.view === 'moderation') || req.method === 'PATCH') {
    let actor;
    try { actor = await authorizeModerator(req); }
    catch { return res.status(503).json({ error: 'moderation_access_unavailable' }); }
    if (actor.status) return res.status(actor.status).json({ error: 'moderation_access_denied' });
    if (!actor.userId) return res.status(403).json({ error: 'moderation_access_denied' });
    try {
      const store = await getStore();
      if (req.method === 'PATCH') {
        const { id, decision } = req.body || {};
        if (typeof id !== 'string' || !['approved', 'dismissed'].includes(decision)) {
          return res.status(400).json({ error: 'invalid_review' });
        }
        return res.status(200).json(await store.review(id, decision, actor.userId));
      }
      const limit = req.query?.limit === undefined ? 20 : Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ error: 'invalid_limit' });
      return res.status(200).json(await store.list({ limit, cursor: req.query?.cursor }));
    } catch (error) {
      const status = { invalid_cursor: 400, invalid_id: 400, not_found: 404, review_conflict: 409 }[error.code] || 503;
      return res.status(status).json({ error: status === 503 ? 'storage_unavailable' : error.code });
    }
  }
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      service: 'public-toilet-service',
      schemaVersion: 1,
      endpoints: ['POST /api/public-toilets', 'GET /api/public-toilets?view=moderation'],
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // IP extraction for rate limiting
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress || '127.0.0.1';

  const rate = rateLimiter.take(clientIp);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: 'Rate limit exceeded. Too many reports submitted from this network. Please wait.',
      retryAfter: rate.retryAfterSeconds,
    });
  }

    try {
      const payload = req.body || {};
      const validationErrors = validateToiletSubmissionPayload(payload);

      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationErrors,
        });
      }
      const key = req.headers?.['idempotency-key'] || payload.idempotencyKey;
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
        return res.status(400).json({ error: 'valid_idempotency_key_required' });
      }
      if (payload.rating !== undefined && (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5)) {
        return res.status(400).json({ error: 'invalid_rating' });
      }

      if (payload.severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(payload.severity)) {
        return res.status(400).json({ error: 'invalid_severity' });
      }
      if (payload.cleanlinessLevel !== undefined && !['spotless', 'clean', 'moderate', 'dirty', 'unusable'].includes(payload.cleanlinessLevel)) {
        return res.status(400).json({ error: 'invalid_cleanliness_level' });
      }
      const facilityId = sanitizeText(payload.facilityId, 100);

      const submissionEntry = {
        facilityId,
        reportType: sanitizeText(payload.reportType, 50),
        description: sanitizeText(payload.description || payload.comment || '', 1000),
        category: sanitizeText(payload.category || 'hygiene_cleanliness', 50),
        ...(payload.rating !== undefined ? { rating: payload.rating } : {}),
        ...(payload.severity !== undefined ? { severity: payload.severity } : {}),
        ...(payload.cleanlinessLevel !== undefined ? { cleanlinessLevel: payload.cleanlinessLevel } : {}),
      };
      const record = await (await getStore()).create(submissionEntry, key);

      return res.status(201).json({
        success: true,
        receiptSeal: record.receiptSeal,
        message: 'Report submitted successfully and queued for verification.',
        submittedAt: record.timestamp,
      });
    } catch (error) {
      return res.status(error.code === 'idempotency_conflict' ? 409 : 503).json({
        error: error.code === 'idempotency_conflict' ? 'idempotency_conflict' : 'storage_unavailable',
      });
    }
};
}

export default createPublicToiletHandler();
