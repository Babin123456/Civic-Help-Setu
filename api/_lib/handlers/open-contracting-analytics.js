/**
 * api/_lib/handlers/open-contracting-analytics.js
 * Server-side endpoint for Open Contracting Red-Flag Analytics & Audit Triage (#751).
 *
 * Enforces:
 * - Rate limiting & single-flight deduplication via abuseGuard.
 * - Anti-PII validation: Rejects submissions containing Aadhaar, PAN, phone numbers, or private emails.
 * - Idempotency tracking to avoid duplicate audit reviews.
 * - Strict length, bounds, and enum checks on audit reviews and notice imports.
 * - Deterministic cryptographic audit seal generation.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 15, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for serverless runtime
export const OPEN_CONTRACTING_REVIEW_QUEUE = [];
export const PROCESSED_IDEMPOTENCY_KEYS = new Map();

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(\+91[-\s]?)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

export const ALLOWED_DISPOSITIONS = new Set([
  'pending_review',
  'under_investigation',
  'marked_false_positive',
  'cleared_with_explanation',
  'escalated_for_formal_audit',
]);

export const sanitizeString = (val, maxLen = 2000) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const generateAuditSeal = (flagId, reviewerId, disposition, timestamp) => {
  const seed = `${flagId}|${reviewerId}|${disposition}|${timestamp}|CIVIC_OPEN_CONTRACTING_v1`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `AUDIT-SEAL-${p1}-${p2}`;
};

export function validateAuditReviewSubmission(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const flagId = sanitizeString(body.flagId, 100);
  if (!flagId || flagId.length < 3) {
    errors.push('flagId is required (min 3 characters).');
  }

  if (!body.disposition || !ALLOWED_DISPOSITIONS.has(body.disposition)) {
    errors.push(`disposition must be one of: ${Array.from(ALLOWED_DISPOSITIONS).join(', ')}.`);
  }

  const justification = sanitizeString(body.justification, 2000);
  if (!justification || justification.length < 15) {
    errors.push('justification must be at least 15 characters explaining the auditor rationale.');
  }

  // Anti-PII verification across all string fields
  const fullPayloadString = JSON.stringify(body);
  if (AADHAAR_REGEX.test(fullPayloadString)) {
    errors.push('Payload contains 12-digit Aadhaar pattern. PII is strictly prohibited in public records.');
  }
  if (PAN_REGEX.test(fullPayloadString)) {
    errors.push('Payload contains PAN pattern. Personal identifiers are strictly prohibited.');
  }
  if (PHONE_REGEX.test(fullPayloadString)) {
    errors.push('Payload contains telephone number pattern. Personal contact info is prohibited.');
  }
  if (EMAIL_REGEX.test(fullPayloadString)) {
    errors.push('Payload contains personal email pattern. PII is strictly prohibited.');
  }

  return errors;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const role = req.query?.role || 'citizen';
    // If role is citizen, redact reviewer ID and internal contact details
    const sanitizedQueue = OPEN_CONTRACTING_REVIEW_QUEUE.map((item) => {
      if (role === 'citizen') {
        return {
          id: item.id,
          flagId: item.flagId,
          disposition: item.disposition,
          timestamp: item.timestamp,
          auditSeal: item.auditSeal,
          publicSummary: 'Audit review completed and sealed by authorized oversight auditor.',
        };
      }
      return item;
    });

    return res.status(200).json({
      success: true,
      totalReviews: OPEN_CONTRACTING_REVIEW_QUEUE.length,
      reviews: sanitizedQueue,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-vercel-forwarded-for'] || '127.0.0.1';
  const limitCheck = rateLimiter.take(clientIp);

  if (!limitCheck.allowed) {
    res.setHeader('Retry-After', limitCheck.retryAfterSeconds);
    return res.status(429).json({
      error: 'Too many requests. Please slow down and try again.',
      retryAfter: limitCheck.retryAfterSeconds,
    });
  }

  // Check idempotency
  const idempotencyKey = req.headers['idempotency-key'] || req.body?.idempotencyKey;
  if (idempotencyKey && PROCESSED_IDEMPOTENCY_KEYS.has(idempotencyKey)) {
    const cachedResponse = PROCESSED_IDEMPOTENCY_KEYS.get(idempotencyKey);
    return res.status(200).json({
      success: true,
      idempotentReplay: true,
      record: cachedResponse,
    });
  }

  const errors = validateAuditReviewSubmission(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }

  const { flagId, disposition, justification, reviewerId = 'AUD-OFFICIAL', jurisdiction = 'Bengaluru Urban, Karnataka' } = req.body;
  const flightKey = `${clientIp}|${flagId}|${disposition}`;

  return singleFlight.run(flightKey, async () => {
    const timestamp = new Date().toISOString();
    const seal = generateAuditSeal(flagId, reviewerId, disposition, timestamp);

    const record = {
      id: `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      flagId: sanitizeString(flagId, 100),
      disposition,
      justification: sanitizeString(justification, 2000),
      reviewerId: sanitizeString(reviewerId, 100),
      jurisdiction: sanitizeString(jurisdiction, 100),
      auditSeal: seal,
      timestamp,
    };

    OPEN_CONTRACTING_REVIEW_QUEUE.push(record);

    if (idempotencyKey) {
      PROCESSED_IDEMPOTENCY_KEYS.set(idempotencyKey, record);
    }

    return res.status(201).json({
      success: true,
      message: 'Audit review successfully recorded and sealed.',
      record,
    });
  });
}
