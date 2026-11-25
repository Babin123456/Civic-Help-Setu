/**
 * api/synthetic-datasets.js
 *
 * Server-side endpoint for synthetic dataset generation requests, schema catalog discovery,
 * and server-side validation (#778).
 *
 * Invariants enforced:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII: Rejects any input containing real Aadhaar, PAN, or phone numbers.
 *  - Bounded scale constraints (prevents resource exhaustion).
 *  - Deterministic execution output.
 */

import { createRateLimiter, createSingleFlight, clientKey } from './abuseGuard.js';
import { validateGenerationPayload } from './syntheticSchemaContract.js';

const rateLimiter = createRateLimiter({ limit: 12, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

const AADHAAR_REGEX = /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const PHONE_REGEX = /(?<!\d)(?:\+?91[\s-]?)?(?!(?:99900))[6-9]\d{4}[\s-]?\d{5}(?!\d)/;

function containsRealPII(text) {
  if (typeof text !== 'string') return false;
  return AADHAAR_REGEX.test(text) || PAN_REGEX.test(text) || PHONE_REGEX.test(text);
}

function scanObjectForPII(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (typeof val === 'string' && containsRealPII(val)) return true;
    if (typeof val === 'object' && scanObjectForPII(val)) return true;
  }
  return false;
}

async function handler(req, res) {
  // CORS & Methods
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }

  // 1. Rate limiting
  const callerIp = clientKey(req.headers);
  const rate = rateLimiter.take(callerIp || '127.0.0.1');
  res.setHeader('X-RateLimit-Limit', '12');
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));

  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many synthetic generation requests. Please wait.',
      retryAfterSeconds: rate.retryAfterSeconds,
      code: 'ERR_SYNTH_RATE_LIMIT',
    });
  }

  // GET: Return schema catalog capabilities
  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'Civic Help Setu Synthetic Dataset Generator',
      version: '1.0.0',
      watermark: 'SYNTH-CIVIC-SETU-v1',
      supportedEntities: ['SyntheticService', 'SyntheticOffice', 'SyntheticApplication', 'SyntheticGrievance'],
      limits: {
        maxServicesPerRun: 100,
        maxApplicationsPerRun: 500,
        maxGrievancesPerRun: 250,
      },
      status: 'OPERATIONAL',
    });
  }

  // POST: Validate and register synthetic generation job
  if (req.method === 'POST') {
    const body = req.body || {};

    // Check for accidental real PII in request
    if (scanObjectForPII(body)) {
      return res.status(422).json({
        error: 'Payload rejected: Restricted citizen PII pattern detected in request configuration.',
        code: 'ERR_SYNTH_PII_SUSPECT',
      });
    }

    // Validate payload against schema contract
    const validation = validateGenerationPayload(body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid generation profile payload',
        details: validation.errors,
        code: 'ERR_SYNTH_INVALID_PAYLOAD',
      });
    }

    // Single-flight deduplication via idempotency token
    const idempotencyKey = req.headers['x-idempotency-key'] || `flight-${callerIp}-${body.seed || 'default'}`;

    return singleFlight.run(idempotencyKey, async () => {
      const seed = Math.abs(Number(body.seed)) || 1337;
      const jobId = `srv-job-${Date.now().toString(16)}`;

      return res.status(200).json({
        success: true,
        jobId,
        idempotencyKey,
        seed,
        status: 'ACCEPTED_FOR_GENERATION',
        watermark: 'SYNTH-CIVIC-SETU-v1',
        message: 'Synthetic generation request validated by server boundary.',
      });
    });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

export default handler;
