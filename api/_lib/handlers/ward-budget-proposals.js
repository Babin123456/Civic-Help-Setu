/**
 * api/_lib/handlers/ward-budget-proposals.js
 * Server-side endpoint for Participatory Ward Budget proposal intake and queue management (#765).
 *
 * Enforces:
 * - Rate limiting & single-flight deduplication via abuseGuard.
 * - Anti-PII validation: Rejects submissions containing Aadhaar, PAN, phone numbers, or private emails.
 * - Strict length, bounds, and enum checks on title, category, and cost estimate.
 * - Deterministic seal generation for proposal tracking.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for serverless runtime
export const WARD_PROPOSAL_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(\+91[-\s]?)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

export const ALLOWED_CATEGORIES = new Set([
  'roads_footpaths',
  'parks_greenery',
  'sanitation_drainage',
  'street_lighting',
  'public_facilities',
  'traffic_safety',
]);

export const sanitizeString = (val, maxLen = 1000) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const generateProposalSeal = (title, ward, timestamp) => {
  const seed = `${title}|${ward}|${timestamp}|CIVIC_WARD_BUDGET_v1`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `SEAL-WBP-${p1}-${p2}`;
};

export function validateProposalSubmissionPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const title = sanitizeString(body.title, 120);
  if (!title || title.length < 10) {
    errors.push('Proposal title must be between 10 and 120 characters.');
  }

  const description = sanitizeString(body.description, 2000);
  if (!description || description.length < 30) {
    errors.push('Proposal description must be at least 30 characters.');
  }

  if (!body.category || !ALLOWED_CATEGORIES.has(body.category)) {
    errors.push(`Category must be one of: ${Array.from(ALLOWED_CATEGORIES).join(', ')}.`);
  }

  const ward = sanitizeString(body.ward, 60);
  if (!ward || ward.length < 2) {
    errors.push('Ward name or number is required.');
  }

  const location = sanitizeString(body.approximateLocation, 200);
  if (!location || location.length < 5) {
    errors.push('Approximate location/landmark is required.');
  }

  const minCost = Number(body.costEstimateRange?.min);
  const maxCost = Number(body.costEstimateRange?.max);
  if (Number.isNaN(minCost) || Number.isNaN(maxCost) || minCost <= 0 || maxCost < minCost) {
    errors.push('Valid cost range (min and max > 0, max >= min) is required.');
  } else if (maxCost > 50000000) {
    errors.push('Cost estimate exceeds the ₹5,00,00,000 ward ceiling.');
  }

  // PII checks
  const fullText = `${title} ${description} ${location}`;
  if (AADHAAR_REGEX.test(fullText)) {
    errors.push('Payload contains Aadhaar number pattern. PII is strictly prohibited.');
  }
  if (PAN_REGEX.test(fullText)) {
    errors.push('Payload contains PAN number pattern. PII is strictly prohibited.');
  }
  if (PHONE_REGEX.test(fullText)) {
    errors.push('Payload contains phone number pattern. PII is strictly prohibited.');
  }
  if (EMAIL_REGEX.test(fullText)) {
    errors.push('Payload contains email address pattern. PII is strictly prohibited.');
  }

  return errors;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      queueLength: WARD_PROPOSAL_QUEUE.length,
      submissions: WARD_PROPOSAL_QUEUE.slice(-20),
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
      error: 'Too many requests. Please try again later.',
      retryAfter: limitCheck.retryAfterSeconds,
    });
  }

  const errors = validateProposalSubmissionPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }

  const { title, category, ward, approximateLocation, description, costEstimateRange } = req.body;
  const flightKey = `${clientIp}|${title}|${ward}`;

  return singleFlight.run(flightKey, async () => {
    const timestamp = new Date().toISOString();
    const seal = generateProposalSeal(title, ward, timestamp);

    const record = {
      id: `PROP-${Date.now()}`,
      title: sanitizeString(title, 120),
      category,
      ward: sanitizeString(ward, 60),
      approximateLocation: sanitizeString(approximateLocation, 200),
      description: sanitizeString(description, 2000),
      costEstimateRange: {
        min: Number(costEstimateRange.min),
        max: Number(costEstimateRange.max),
        currency: 'INR',
      },
      status: 'submitted',
      seal,
      submittedAt: timestamp,
    };

    WARD_PROPOSAL_QUEUE.push(record);

    return res.status(201).json({
      success: true,
      message: 'Ward budget proposal successfully received for public deliberation.',
      record,
    });
  });
}

