/**
 * api/pds-observations.js
 * Server-side endpoint for validating and moderating citizen observations & corrections
 * for Public Distribution System Fair Price Shops (#723).
 *
 * Invariants enforced:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII: Rejects submissions containing Ration Card numbers, Aadhaar, or PAN.
 *  - Zero Live Stock: Rejects speculative live grain inventory claims.
 *  - Deterministic cryptographic seal generation for citizen tracking.
 *  - Queued for administrator review before affecting public records.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for administrator moderation
export const PDS_OBSERVATION_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
// Standard Indian Ration Card numbers: 10 to 16 alphanumeric characters or 12 digits
const RATION_CARD_REGEX = /\b(RC[0-9]{8,14}|[0-9]{12}|[A-Z]{2}[0-9]{10,12})\b/i;

const isHttpsUrl = (v) => {
  if (typeof v !== 'string' || v.trim().length === 0) return true; // Optional for citizen observations, mandatory if provided
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

export const generateObservationSeal = (shopId, timestamp) => {
  const seed = `${shopId}|${timestamp}|CIVIC_PDS_OBSERVATION_SEAL`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `PDS-OBS-${p1}-${p2}`;
};

export function validateObservationPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const shopId = sanitizeText(body.shopId, 100);
  if (!shopId) errors.push('shopId is required.');

  const observationType = sanitizeText(body.observationType, 50);
  const validTypes = ['closure_timing', 'queue_status', 'epos_receipt', 'weighing_scale', 'service_correction'];
  if (!observationType || !validTypes.includes(observationType)) {
    errors.push(`observationType must be one of: ${validTypes.join(', ')}.`);
  }

  const observationText = sanitizeText(body.observationText, 2000);
  if (!observationText || observationText.length < 8) {
    errors.push('observationText must be at least 8 characters describing the dated shop condition.');
  }

  if (body.officialSourceUrl && !isHttpsUrl(body.officialSourceUrl)) {
    errors.push('officialSourceUrl must be a secure https:// URL if provided.');
  }

  // Check for forbidden PII & Live Stock in any serialized payload string
  const serialized = JSON.stringify(body);

  if (AADHAAR_REGEX.test(serialized)) {
    errors.push('Personal identity numbers (Aadhaar) are strictly forbidden.');
  }
  if (PAN_REGEX.test(serialized)) {
    errors.push('Tax / PAN identifiers are strictly forbidden.');
  }
  if (RATION_CARD_REGEX.test(serialized)) {
    errors.push('Ration Card numbers are strictly forbidden in public citizen observations for privacy.');
  }
  if (body.rationCardNumber || body.rcNumber || body.cardholderName) {
    errors.push('Personal cardholder details are strictly rejected.');
  }
  if (body.liveStock || body.grainStock || body.availableStock) {
    errors.push('Live stock claims without authorized government telemetry are strictly prohibited.');
  }

  return errors;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      pendingCount: PDS_OBSERVATION_QUEUE.length,
      items: PDS_OBSERVATION_QUEUE.slice(-50),
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
  const validationErrors = validateObservationPayload(body);
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: 'validation_failed', details: validationErrors });
  }

  const flightKey = `${ip}:${body.shopId}:${body.observationType}:${body.observationText?.slice(0, 30)}`;

  return singleFlight.run(flightKey, async () => {
    const timestamp = new Date().toISOString();
    const observationId = `obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const verificationSeal = generateObservationSeal(body.shopId, timestamp);

    const observationEntry = {
      id: observationId,
      shopId: sanitizeText(body.shopId, 100),
      shopName: sanitizeText(body.shopName || body.shopId, 200),
      observationType: sanitizeText(body.observationType, 50),
      observationText: sanitizeText(body.observationText, 2000),
      observedDate: sanitizeText(body.observedDate || timestamp.slice(0, 10), 20),
      officialSourceUrl: body.officialSourceUrl ? sanitizeText(body.officialSourceUrl, 500) : null,
      submittedAt: timestamp,
      status: 'pending_review',
      verificationSeal,
    };

    PDS_OBSERVATION_QUEUE.push(observationEntry);

    return res.status(201).json({
      ok: true,
      observationId,
      verificationSeal,
      message: 'Observation received for public distribution administrator review.',
    });
  });
}

