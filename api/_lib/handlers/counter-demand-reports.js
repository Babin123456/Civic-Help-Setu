/**
 * api/_lib/handlers/counter-demand-reports.js
 * Server-side endpoint for validating civic service counter demand anomalies,
 * unexpected closure reports, and queue staffing escalations (#764).
 *
 * Invariants enforced:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Zero PII: Rejects submissions containing Aadhaar, PAN, mobile numbers, or citizen application IDs.
 *  - Deterministic cryptographic seal generation for tracking.
 *  - Queued for administrator moderation before affecting capacity baselines.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 12, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue for administrator moderation
export const COUNTER_DEMAND_REPORT_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const APPLICATION_ID_REGEX = /\b(?:app|appl|token|ack)[-_]?[0-9]{6,16}\b/i;

export const REPORT_TYPES = {
  AGGREGATE_ANOMALY: 'AGGREGATE_ANOMALY',
  UNEXPECTED_CLOSURE: 'UNEXPECTED_CLOSURE',
  SURGE_NOTICE: 'SURGE_NOTICE',
  STAFFING_ESCALATION: 'STAFFING_ESCALATION',
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

export const generateCounterDemandSeal = (officeId, timestamp) => {
  const seed = `${officeId}|${timestamp}|CIVIC_COUNTER_DEMAND_VERIFICATION`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `CDR-${p1}-${p2}`;
};

export function validateCounterDemandReportPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  // 1. Mandatory Core Identifiers
  if (typeof body.officeId !== 'string' || body.officeId.trim().length === 0) {
    errors.push('officeId: Target civic centre office ID is required.');
  }

  if (typeof body.reportType !== 'string' || !Object.values(REPORT_TYPES).includes(body.reportType)) {
    errors.push(`reportType: Must be one of: ${Object.values(REPORT_TYPES).join(', ')}.`);
  }

  if (typeof body.observedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.observedDate)) {
    errors.push('observedDate: Must be a valid ISO date in YYYY-MM-DD format.');
  }

  if (typeof body.summary !== 'string' || body.summary.trim().length < 10) {
    errors.push('summary: Operational description must be at least 10 characters.');
  }

  // 2. Strict Zero-PII Invariant
  const combinedText = `${body.summary || ''} ${body.contactName || ''} ${body.additionalNotes || ''}`;
  if (AADHAAR_REGEX.test(combinedText)) {
    errors.push('Zero-PII violation: Submission contains a 12-digit Aadhaar number.');
  }
  if (PAN_REGEX.test(combinedText)) {
    errors.push('Zero-PII violation: Submission contains a PAN number.');
  }
  if (PHONE_REGEX.test(combinedText)) {
    errors.push('Zero-PII violation: Submission contains a personal telephone number.');
  }
  if (APPLICATION_ID_REGEX.test(combinedText)) {
    errors.push('Zero-PII violation: Submission contains a citizen application or token tracking ID.');
  }

  return errors;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      pendingCount: COUNTER_DEMAND_REPORT_QUEUE.length,
      items: COUNTER_DEMAND_REPORT_QUEUE.slice(-50),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'This endpoint only accepts POST and GET requests for operational counter reports.',
    });
  }

  // 1. Rate limiting by IP
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, retryAfterSeconds } = rateLimiter.take(clientIp);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Submission rate limit exceeded. Please wait before submitting additional reports.',
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

  // 2. Payload Validation
  const validationErrors = validateCounterDemandReportPayload(body);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Bad Request',
      validationErrors,
    });
  }

  // 3. Single-flight Deduplication
  const dedupeKey = `${clientIp}:${body.officeId}:${body.observedDate}:${body.reportType}`;
  return singleFlight.run(dedupeKey, async () => {
    const timestamp = Date.now();
    const verificationSeal = generateCounterDemandSeal(body.officeId, timestamp);

    const reportRecord = {
      reportId: `cdr_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
      officeId: body.officeId.trim(),
      reportType: body.reportType,
      observedDate: body.observedDate,
      timeSlot: body.timeSlot ? sanitizeText(body.timeSlot, 20) : null,
      summary: sanitizeText(body.summary, 1200),
      estimatedFootfallVariancePct: typeof body.estimatedFootfallVariancePct === 'number'
        ? body.estimatedFootfallVariancePct
        : null,
      verificationSeal,
      status: 'PENDING_ADMIN_REVIEW',
      submittedAt: new Date(timestamp).toISOString(),
    };

    COUNTER_DEMAND_REPORT_QUEUE.unshift(reportRecord);
    if (COUNTER_DEMAND_REPORT_QUEUE.length > 200) {
      COUNTER_DEMAND_REPORT_QUEUE.pop();
    }

    return res.status(201).json({
      success: true,
      message: 'Operational counter observation logged successfully for administrator review.',
      reportId: reportRecord.reportId,
      verificationSeal,
      status: reportRecord.status,
      submittedAt: reportRecord.submittedAt,
    });
  });
}
