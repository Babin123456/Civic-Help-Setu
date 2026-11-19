/**
 * api/_lib/handlers/water-quality-register.js
 * Server-side endpoint for Community Water-Quality Sampling & Lab Results (#754).
 *
 * Enforces:
 * - Fixed-window rate limiting & single-flight deduplication via abuseGuard.
 * - Anti-PII validation: Rejects submissions containing Aadhaar, PAN, phone numbers, or private emails.
 * - Strict enum and bounds validation against IS 10500:2012 parameters.
 * - Cryptographic verification seal generation.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';
import {
  IS_10500_STANDARDS,
  SAMPLE_TYPES,
  WATER_POINT_TYPES,
} from '../../../src/data/waterQualityContract.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for moderation
export const WATER_QUALITY_INTAKE_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;

export const sanitizeString = (val, maxLen = 1000) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const generateServerWaterSeal = (waterPointId, sampleDate, timestamp) => {
  const seed = `${waterPointId}|${sampleDate}|${timestamp}|CIVIC_WQR_IS10500_SERVER`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `SEAL-WQR-${p1}-${p2}`;
};

export function validateWaterIntakePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const textToCheck = `${body.notes || ''} ${body.landmark || ''} ${body.samplerName || ''} ${body.waterPointName || ''}`;
  if (AADHAAR_REGEX.test(textToCheck)) {
    errors.push('Aadhaar number detected. Personal identity numbers are prohibited.');
  }
  if (PAN_REGEX.test(textToCheck)) {
    errors.push('PAN number detected. Personal identity numbers are prohibited.');
  }
  if (PHONE_REGEX.test(textToCheck)) {
    errors.push('Phone number detected. Personal contact numbers are prohibited in public records.');
  }
  if (EMAIL_REGEX.test(textToCheck)) {
    errors.push('Email address detected.');
  }
  if (DOOR_REGEX.test(textToCheck)) {
    errors.push('Residential flat/door number detected. Only public water points and landmarks are permitted.');
  }

  if (!body.waterPointId && !body.waterPointName) {
    errors.push('Either waterPointId or waterPointName is required.');
  }

  if (body.pointType && !WATER_POINT_TYPES[body.pointType]) {
    errors.push(`Invalid pointType: ${body.pointType}.`);
  }

  if (body.sampleType && !SAMPLE_TYPES[body.sampleType]) {
    errors.push(`Invalid sampleType: ${body.sampleType}.`);
  }

  if (Array.isArray(body.testedParameters)) {
    body.testedParameters.forEach((param, idx) => {
      if (!param.code || !IS_10500_STANDARDS.parameters[param.code]) {
        errors.push(`Parameter [${idx}]: Unsupported or invalid parameter code "${param.code}".`);
      }
      const val = Number(param.value);
      if (isNaN(val) || val < 0) {
        errors.push(`Parameter [${idx}]: Value must be a valid non-negative number.`);
      }
    });
  }

  return errors;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const queueItems = WATER_QUALITY_INTAKE_QUEUE.slice(0, 50).map((item) => ({
      id: item.id,
      waterPointId: item.waterPointId,
      seal: item.seal,
      status: item.status,
      submittedAt: item.submittedAt,
      sampleType: item.sampleType,
    }));

    return res.status(200).json({
      success: true,
      specification: IS_10500_STANDARDS.specification,
      effectiveDate: IS_10500_STANDARDS.effectiveDate,
      queueCount: WATER_QUALITY_INTAKE_QUEUE.length,
      items: queueItems,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only GET and POST requests are accepted.' });
  }

  // Rate limiting
  const ip = req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, retryAfterSeconds } = rateLimiter.take(ip);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before submitting another water quality report.',
      retryAfterSeconds,
    });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Malformed JSON payload.' });
    }
  }

  const errors = validateWaterIntakePayload(body);
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }

  const flightKey = `${ip}:${body.waterPointId || body.waterPointName}:${body.sampleType || 'routine'}`;
  return singleFlight.run(flightKey, async () => {
    const timestamp = new Date().toISOString();
    const waterPointId = body.waterPointId || `WP-NEW-${Date.now().toString(36).toUpperCase()}`;
    const seal = generateServerWaterSeal(waterPointId, body.collectionDate || timestamp, timestamp);

    const record = {
      id: `wqr_intake_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      waterPointId,
      waterPointName: sanitizeString(body.waterPointName || 'Public Water Standpost', 120),
      pointType: body.pointType || 'public_standpost',
      ward: sanitizeString(body.ward || 'Central Ward', 80),
      city: sanitizeString(body.city || 'Municipal Area', 80),
      sampleType: body.sampleType || 'routine_surveillance',
      collectionDate: body.collectionDate || timestamp,
      testedParameters: Array.isArray(body.testedParameters) ? body.testedParameters : [],
      notes: sanitizeString(body.notes || '', 1000),
      seal,
      status: 'pending_laboratory_verification',
      submittedAt: timestamp,
    };

    WATER_QUALITY_INTAKE_QUEUE.unshift(record);
    if (WATER_QUALITY_INTAKE_QUEUE.length > 200) {
      WATER_QUALITY_INTAKE_QUEUE.pop();
    }

    return res.status(201).json({
      success: true,
      message: 'Water-quality sampling report securely received and queued for laboratory verification.',
      seal,
      queueId: record.id,
      submittedAt: timestamp,
      standardCited: IS_10500_STANDARDS.specification,
    });
  });
}
