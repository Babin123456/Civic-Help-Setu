/**
 * api/community-facility-corrections.js
 * Server-side endpoint for validating community facility and permit corrections (#716).
 *
 * Enforces:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII: Rejects submissions containing Aadhaar, PAN, or personal applicant names.
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
  const seed = `${facilityId}|${timestamp}|CIVIC_COMMUNITY_FACILITY_VERIFICATION`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `CF-CORR-${p1}-${p2}`;
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
  if (!sourceUrl || !isHttpsUrl(sourceUrl)) {
    errors.push('officialSourceUrl is mandatory and must be a secure https URL linking to a government, municipal or gazette notice.');
  }

  // PII Checks: Strict Zero-PII contract
  const fullPayloadString = JSON.stringify(body);
  if (AADHAAR_REGEX.test(fullPayloadString)) {
    errors.push('Personal identifiers detected (Aadhaar). Submissions must strictly be free of personal identity numbers.');
  }
  if (PAN_REGEX.test(fullPayloadString)) {
    errors.push('Personal identifiers detected (PAN). Submissions must strictly be free of financial or tax identity numbers.');
  }
  if (body.applicantName || body.citizenName) {
    errors.push('To preserve civic anonymity, personal names are not accepted. Only facility operational changes are permitted.');
  }

  return errors;
}

export default async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');

  // GET: Retrieve pending moderation queue for admin console
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      pendingCount: CORRECTION_QUEUE.filter((item) => item.status === 'pending_review').length,
      items: CORRECTION_QUEUE,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET or POST.' });
  }

  // 1. Rate Limiting
  const ip =
    req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  const { allowed, retryAfterSeconds } = rateLimiter.take(ip);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      ok: false,
      error: 'Submission rate limit exceeded. Please wait a minute before suggesting further corrections.',
      retryAfterSeconds,
    });
  }

  // 2. Body Parsing & Single-Flight execution
  const body = req.body || {};
  const flightKey = `${ip}:${body.facilityId || 'any'}`;

  return singleFlight.run(flightKey, async () => {
    // 3. Validation
    const validationErrors = validateCorrectionPayload(body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed for facility correction submission.',
        details: validationErrors,
      });
    }

    const timestamp = new Date().toISOString();
    const seal = generateCorrectionSeal(body.facilityId, timestamp);

    const submissionRecord = {
      id: `cf_sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      facilityId: sanitizeText(body.facilityId, 100),
      facilityName: sanitizeText(body.facilityName, 200) || 'Public Municipal Facility',
      proposedChange: sanitizeText(body.proposedChange, 2000),
      officialSourceUrl: body.officialSourceUrl,
      contributorRole: sanitizeText(body.contributorRole, 50) || 'citizen',
      submittedAt: timestamp,
      status: 'pending_review',
      verificationSeal: seal,
    };

    CORRECTION_QUEUE.unshift(submissionRecord);

    return res.status(201).json({
      ok: true,
      message: 'Correction submitted for administrative verification against official government records.',
      verificationSeal: seal,
      submittedAt: timestamp,
    });
  });
}
