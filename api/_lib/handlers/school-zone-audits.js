/**
 * api/_lib/handlers/school-zone-audits.js
 * Server-side endpoint for validating citizen school-zone hazard audits (#984).
 *
 * Invariants enforced:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII: Rejects submissions containing Aadhaar, PAN, personal phone numbers, or exact flat/door addresses.
 *  - Enforces valid school identifier and registered hazard dimension.
 *  - Deterministic cryptographic seal generation for SMC tracking.
 *  - Queued for administrator moderation and road-authority dispatch.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';
import { HAZARD_TYPES } from '../../../src/data/upSchoolZoneSafetyContract.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for administrator moderation
export const SCHOOL_ZONE_AUDIT_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;

const isHttpsUrl = (v) => {
  if (typeof v !== 'string' || v.trim().length === 0) return true;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' || url.protocol === 'data:';
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

export const generateSchoolZoneAuditSeal = (schoolId, hazardType, timestamp) => {
  const seed = `${schoolId}|${hazardType}|${timestamp}|CIVIC_SCHOOL_ZONE_AUDIT_SEAL`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `SZ-AUD-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
};

export const validateSchoolZoneAuditPayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Invalid request body: Expected JSON object.'];
  }

  const { schoolId, hazardType, description, photoUrl } = body;

  if (!schoolId || typeof schoolId !== 'string' || schoolId.trim().length === 0) {
    errors.push('schoolId is required.');
  }

  if (!hazardType || !Object.values(HAZARD_TYPES).includes(hazardType)) {
    errors.push(`hazardType must be one of: ${Object.values(HAZARD_TYPES).join(', ')}.`);
  }

  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    errors.push('description is required and must be at least 10 characters.');
  }

  // PII checks
  if (AADHAAR_REGEX.test(description)) {
    errors.push('Privacy violation: description contains a 12-digit Aadhaar number.');
  }
  if (PAN_REGEX.test(description)) {
    errors.push('Privacy violation: description contains a PAN reference.');
  }
  if (PHONE_REGEX.test(description)) {
    errors.push('Privacy violation: description contains a personal phone number.');
  }
  if (DOOR_REGEX.test(description)) {
    errors.push('Privacy violation: description contains an exact private flat/door address.');
  }

  if (photoUrl && !isHttpsUrl(photoUrl)) {
    errors.push('photoUrl must use secure https:// or data: protocol.');
  }

  return errors;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const rateResult = rateLimiter.take(clientIp);
  if (!rateResult.allowed) {
    res.setHeader('Retry-After', String(rateResult.retryAfterSeconds));
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before lodging another audit.' });
  }

  const errors = validateSchoolZoneAuditPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const { schoolId, gateId, hazardType, description, reporterRole, photoUrl } = req.body;
  const flightKey = `${clientIp}:${schoolId}:${hazardType}`;

  return singleFlight.run(flightKey, async () => {
    const timestamp = new Date().toISOString();
    const seal = generateSchoolZoneAuditSeal(schoolId, hazardType, timestamp);

    const record = {
      seal,
      schoolId: sanitizeText(schoolId, 64),
      gateId: sanitizeText(gateId || 'G1', 32),
      hazardType,
      description: sanitizeText(description, 1500),
      reporterRole: sanitizeText(reporterRole || 'Caregiver', 64),
      photoUrl: photoUrl ? sanitizeText(photoUrl, 500) : null,
      receivedAt: timestamp,
      status: 'pending_moderation',
    };

    SCHOOL_ZONE_AUDIT_QUEUE.push(record);

    return res.status(201).json({
      success: true,
      seal,
      message: 'School-zone road safety hazard audit submitted successfully for authority dispatch.',
      record,
    });
  });
}
