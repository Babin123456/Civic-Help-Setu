/**
 * api/road-hazards.js
 * Server-side endpoint for validating citizen road hazard reports, defect disclosures,
 * and corridor maintenance observations (#769).
 *
 * Invariants enforced:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII: Rejects submissions containing Aadhaar, PAN, personal phone numbers, or exact flat/door addresses.
 *  - Sanitization of user description.
 *  - Deterministic cryptographic seal generation for citizen verification tracking.
 *  - Queued for administrator review before affecting public blackspot scores.
 */

import { createRateLimiter, createSingleFlight } from './_lib/abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for administrator moderation
export const ROAD_HAZARD_REPORT_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;

export const HAZARD_TYPES = [
  'pothole_surface',
  'missing_signage',
  'poor_streetlight',
  'broken_median',
  'blind_curve_encroachment',
  'dangerous_intersection',
  'missing_pedestrian_crossing',
];

const isHttpsUrl = (v) => {
  if (typeof v !== 'string' || v.trim().length === 0) return true;
  try {
    const url = new URL(v);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

const sanitizeText = (val, maxLen = 1500) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const generateRoadHazardSeal = (segmentId, timestamp) => {
  const seed = `${segmentId}|${timestamp}|CIVIC_ROAD_HAZARD_VERIFICATION`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `RH-HAZ-${p1}-${p2}`;
};

export function validateRoadHazardReportPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  // 1. Mandatory Core Identifiers
  if (typeof body.segmentId !== 'string' || body.segmentId.trim().length === 0) {
    errors.push('segmentId: Target road segment corridor ID is required.');
  }

  if (!HAZARD_TYPES.includes(body.hazardType)) {
    errors.push(`hazardType: Must be one of [${HAZARD_TYPES.join(', ')}].`);
  }

  if (typeof body.description !== 'string' || body.description.trim().length < 10) {
    errors.push('description: Hazard description must be at least 10 characters.');
  }

  // 2. Strict Zero PII Checks
  const fullText = `${body.description || ''} ${body.locationHint || ''}`;

  if (AADHAAR_REGEX.test(fullText)) {
    errors.push('description: Submission contains an Aadhaar number; personal identity markers are strictly prohibited.');
  }
  if (PAN_REGEX.test(fullText)) {
    errors.push('description: Submission contains a PAN card number; personal tax IDs are strictly prohibited.');
  }
  if (PHONE_REGEX.test(fullText)) {
    errors.push('description: Submission contains a personal phone number; citizen contacts are strictly prohibited.');
  }
  if (DOOR_REGEX.test(fullText)) {
    errors.push('description: Submission contains an exact flat/door/house number; exact residential addresses are prohibited.');
  }

  // 3. Evidence / Official Source URL (if provided)
  if (body.evidenceUrl && !isHttpsUrl(body.evidenceUrl)) {
    errors.push('evidenceUrl: Evidence link must use secure https:// protocol.');
  }

  return errors;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      pendingCount: ROAD_HAZARD_REPORT_QUEUE.length,
      items: ROAD_HAZARD_REPORT_QUEUE.slice(-50),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method Not Allowed. Only POST and GET requests are accepted.' });
  }

  // Abuse protection & rate limiting
  const ip = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, retryAfterSeconds } = rateLimiter.take(ip);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'Rate limit exceeded: Too many reports submitted. Please wait 1 minute.', retryAfterSeconds });
  }

  const flightKey = `${ip}-${req.body?.segmentId || 'hazard'}`;
  return singleFlight.run(flightKey, async () => {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Malformed JSON payload.' });
      }
    }

    const validationErrors = validateRoadHazardReportPayload(body);
    if (validationErrors.length > 0) {
      return res.status(422).json({ error: 'Validation failed', details: validationErrors });
    }

    const timestamp = new Date().toISOString();
    const verificationSeal = generateRoadHazardSeal(body.segmentId, timestamp);
    const reportItem = {
      id: `rh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      segmentId: body.segmentId.trim(),
      hazardType: body.hazardType,
      severity: body.severity || 'medium',
      description: sanitizeText(body.description),
      locationHint: sanitizeText(body.locationHint || '', 200),
      evidenceUrl: body.evidenceUrl || null,
      submittedAt: timestamp,
      verificationSeal,
      status: 'pending_review',
    };

    ROAD_HAZARD_REPORT_QUEUE.push(reportItem);

    return res.status(201).json({
      success: true,
      reportId: reportItem.id,
      verificationSeal,
      message: 'Citizen road hazard logged successfully for engineering moderation.',
    });
  });
}
