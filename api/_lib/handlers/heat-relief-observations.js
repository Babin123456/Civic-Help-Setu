/**
 * api/_lib/handlers/heat-relief-observations.js
 * Server-side endpoint for validating community heatwave relief observations & partner capacity updates (#983).
 *
 * Enforces:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII: Rejects submissions containing Aadhaar, PAN, mobile numbers, or exact residential addresses.
 *  - UP Geo-bounding and coordinate snapping.
 *  - Deterministic cryptographic seal generation for citizen observation tracking.
 *  - In-memory moderation queue for DDMA / municipal partner verification.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';
import {
  OPERATIONAL_STATUS,
  CAPACITY_STATUS,
  isCoordinateWithinUP,
} from '../../../src/data/upHeatwaveReliefContract.js';

const rateLimiter = createRateLimiter({ limit: 12, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for administrator & DDMA partner verification
export const HEAT_RELIEF_OBSERVATION_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;

const sanitizeText = (val, maxLen = 1500) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const generateHeatObservationSeal = (facilityId, timestamp) => {
  const seed = `${facilityId}|${timestamp}|CIVIC_HEATWAVE_RELIEF_VERIFICATION`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `UP-HEAT-${p1}-${p2}`;
};

export function validateObservationPayload(body, referenceTime = new Date()) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const facilityId = sanitizeText(body.facilityId, 100);
  if (!facilityId) {
    errors.push('facilityId is required.');
  }

  const observedStatus = body.observedStatus;
  if (!observedStatus || !Object.values(OPERATIONAL_STATUS).includes(observedStatus)) {
    errors.push(`Invalid observedStatus: "${observedStatus}".`);
  }

  if (body.currentCapacityStatus && !Object.values(CAPACITY_STATUS).includes(body.currentCapacityStatus)) {
    errors.push(`Invalid currentCapacityStatus: "${body.currentCapacityStatus}".`);
  }

  // Anti-spoofing timestamp checks
  const nowMs = new Date(referenceTime).getTime();
  if (body.timestamp) {
    const reportMs = new Date(body.timestamp).getTime();
    if (isNaN(reportMs)) {
      errors.push('Invalid timestamp format.');
    } else if (reportMs > nowMs + 5 * 60 * 1000) {
      errors.push('Observation timestamp cannot be in the future.');
    } else if (nowMs - reportMs > 48 * 60 * 60 * 1000) {
      errors.push('Observation timestamp is older than 48 hours and cannot be accepted.');
    }
  }

  // Geographic coordinates validation if provided
  if (body.coordinates) {
    const { lat, lng } = body.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      errors.push('Coordinates must have numeric lat and lng properties.');
    } else if (!isCoordinateWithinUP(lat, lng)) {
      errors.push(`Coordinates fall outside Uttar Pradesh administrative boundaries.`);
    }
  }

  // Strict Zero-PII contract
  const fullPayloadString = JSON.stringify(body);
  if (AADHAAR_REGEX.test(fullPayloadString)) {
    errors.push('Personal identifier (Aadhaar) detected. Submission rejected for privacy.');
  }
  if (PAN_REGEX.test(fullPayloadString)) {
    errors.push('Financial identifier (PAN) detected. Submission rejected for privacy.');
  }
  if (PHONE_REGEX.test(fullPayloadString)) {
    errors.push('Personal telephone number detected. Submission rejected for privacy.');
  }
  if (DOOR_REGEX.test(fullPayloadString)) {
    errors.push('Private residential door/flat number detected. Location descriptions must use public landmarks.');
  }
  if (body.reporterName || body.citizenName) {
    errors.push('Personal names are strictly excluded to preserve community reporter anonymity.');
  }

  return errors;
}

export default async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');

  // GET: Retrieve pending moderation queue for partner / admin view
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      pendingCount: HEAT_RELIEF_OBSERVATION_QUEUE.filter((item) => item.status === 'pending_review').length,
      items: HEAT_RELIEF_OBSERVATION_QUEUE,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET or POST.' });
  }

  // 1. Rate Limiting via IP
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
      error: 'Observation rate limit exceeded. Please wait a minute before submitting further reports.',
      retryAfterSeconds,
    });
  }

  // 2. Body Parsing & Single-Flight execution
  const body = req.body || {};
  const flightKey = `${ip}:${body.facilityId || 'any'}`;

  return singleFlight.run(flightKey, async () => {
    // 3. Validation
    const validationErrors = validateObservationPayload(body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed for heat relief observation.',
        details: validationErrors,
      });
    }

    const timestamp = body.timestamp || new Date().toISOString();
    const seal = generateHeatObservationSeal(body.facilityId, timestamp);

    const submissionRecord = {
      id: `heat_obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      facilityId: sanitizeText(body.facilityId, 100),
      observedStatus: body.observedStatus,
      currentCapacityStatus: body.currentCapacityStatus || CAPACITY_STATUS.UNKNOWN,
      feedbackNote: sanitizeText(body.feedbackNote || '', 1000),
      coordinates: body.coordinates
        ? {
            lat: Math.round(body.coordinates.lat * 100) / 100,
            lng: Math.round(body.coordinates.lng * 100) / 100,
            isJittered: true,
          }
        : null,
      submittedAt: timestamp,
      status: 'pending_review',
      verificationSeal: seal,
    };

    HEAT_RELIEF_OBSERVATION_QUEUE.unshift(submissionRecord);

    return res.status(201).json({
      ok: true,
      message: 'Heatwave relief observation recorded and queued for partner verification.',
      verificationSeal: seal,
      submittedAt: timestamp,
      record: submissionRecord,
    });
  });
}
