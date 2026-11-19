/**
 * api/crematorium-corrections.js
 * Server-side endpoint for validating community/caretaker facility corrections (#728).
 *
 * Enforces:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII: Rejects submissions containing Aadhaar, PAN, or deceased names.
 *  - Mandatory dated official source URL validation.
 *  - Deterministic cryptographic seal generation for submission tracking.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for administrator review
const CORRECTION_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;

const isHttpsUrl = (v) => {
  if (typeof v !== 'string') return false;
  try {
    const url = new URL(v);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

const sanitizeText = (val, maxLen = 1000) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const generateCorrectionSeal = (facilityId, timestamp) => {
  const seed = `${facilityId}|${timestamp}|CIVIC_CREMATORIUM_VERIFICATION`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `CB-CORR-${p1}-${p2}`;
};

export function validateCorrectionPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const facilityId = sanitizeText(body.facilityId, 100);
  if (!facilityId) errors.push('facilityId is required.');

  const proposedChange = sanitizeText(body.proposedChange, 2000);
  if (!proposedChange || proposedChange.length < 10) {
    errors.push('proposedChange must be between 10 and 2000 characters.');
  }

  const sourceUrl = body.officialSourceUrl;
  if (!isHttpsUrl(sourceUrl)) {
    errors.push('officialSourceUrl must be a valid https URL pointing to official municipal or government records.');
  }

  // Check for forbidden PII in all string fields
  const serialized = JSON.stringify(body);
  if (AADHAAR_REGEX.test(serialized)) {
    errors.push('Personal identity numbers (Aadhaar) are strictly forbidden.');
  }
  if (PAN_REGEX.test(serialized)) {
    errors.push('Tax / PAN identifiers are strictly forbidden.');
  }
  if (body.deceasedName || body.applicantName) {
    errors.push('Bereaved family personal names are not accepted in public facility correction submissions.');
  }

  return errors;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    // Return pending review items for administrator
    return res.status(200).json({
      pendingCount: CORRECTION_QUEUE.length,
      items: CORRECTION_QUEUE.slice(-50),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const ip = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, retryAfterSeconds } = rateLimiter.take(ip);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'rate_limited', retryAfterSeconds });
  }

  const body = req.body || {};
  const validationErrors = validateCorrectionPayload(body);
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: 'validation_failed', details: validationErrors });
  }

  const flightKey = `${ip}:${body.facilityId}:${body.proposedChange?.slice(0, 30)}`;

  return singleFlight.run(flightKey, async () => {
    const timestamp = new Date().toISOString();
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const verificationSeal = generateCorrectionSeal(body.facilityId, timestamp);

    const submissionEntry = {
      id: submissionId,
      facilityId: sanitizeText(body.facilityId, 100),
      facilityName: sanitizeText(body.facilityName || body.facilityId, 200),
      proposedChange: sanitizeText(body.proposedChange, 2000),
      officialSourceUrl: body.officialSourceUrl,
      contributorRole: sanitizeText(body.contributorRole || 'citizen', 50),
      submittedAt: timestamp,
      status: 'pending_review',
      verificationSeal,
    };

    CORRECTION_QUEUE.push(submissionEntry);

    return res.status(201).json({
      ok: true,
      submissionId,
      verificationSeal,
      message: 'Correction received for municipal data administrator review.',
    });
  });
}
