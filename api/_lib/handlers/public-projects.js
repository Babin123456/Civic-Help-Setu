/**
 * api/_lib/handlers/public-projects.js
 * Server-side endpoint for Geospatial Public Project Progress Verification & Evidence Timeline (#752).
 *
 * Enforces:
 * - Rate limiting & single-flight deduplication via abuseGuard.
 * - Strict Anti-PII validation: Rejects submissions containing Aadhaar, PAN, phone numbers, or private emails.
 * - Validates project creation, milestone progress submissions, and reviewer decisions.
 * - Deterministic seal generation for evidence timeline verification.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

export const PUBLIC_PROJECT_API_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(\+91[-\s]?)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

export const ALLOWED_CATEGORIES = new Set([
  'roads',
  'drains',
  'schools',
  'public_buildings',
  'parks',
  'healthcare',
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

export const generateProjectEvidenceSeal = (projectId, milestoneId, timestamp) => {
  const seed = `${projectId}|${milestoneId}|${timestamp}|CIVIC_PROJECT_EVIDENCE_v1`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `SEAL-PPP-${p1}-${p2}`;
};

export function validateProgressSubmissionPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const projectId = sanitizeString(body.projectId, 60);
  if (!projectId || projectId.length < 3) {
    errors.push('Valid projectId is required.');
  }

  const milestoneId = sanitizeString(body.milestoneId, 60);
  if (!milestoneId || milestoneId.length < 3) {
    errors.push('Valid milestoneId is required.');
  }

  const narrative = sanitizeString(body.narrative, 2000);
  if (!narrative || narrative.length < 20) {
    errors.push('Progress narrative must be at least 20 characters.');
  }

  const reportedPercent = Number(body.reportedPercent);
  if (Number.isNaN(reportedPercent) || reportedPercent < 0 || reportedPercent > 100) {
    errors.push('Reported percentage must be an integer between 0 and 100.');
  }

  if (!Array.isArray(body.evidenceAssets) || body.evidenceAssets.length === 0) {
    errors.push('At least one evidence asset is required for progress submission.');
  } else {
    for (let i = 0; i < body.evidenceAssets.length; i += 1) {
      const asset = body.evidenceAssets[i];
      if (!asset || (!asset.storageUrl && !asset.data && !asset.publicPreviewUrl)) {
        errors.push(`Evidence asset at index ${i} is missing valid URL or content payload.`);
      }
    }
  }

  // PII checks
  const fullText = `${narrative} ${body.caption || ''} ${body.notes || ''}`;
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

export function validateProjectCreationPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  const title = sanitizeString(body.title, 150);
  if (!title || title.length < 10) {
    errors.push('Project title must be between 10 and 150 characters.');
  }

  const description = sanitizeString(body.description, 2000);
  if (!description || description.length < 20) {
    errors.push('Project description must be at least 20 characters.');
  }

  if (!body.category || !ALLOWED_CATEGORIES.has(body.category)) {
    errors.push(`Category must be one of: ${Array.from(ALLOWED_CATEGORIES).join(', ')}.`);
  }

  if (!body.jurisdiction || !body.jurisdiction.wardNumber) {
    errors.push('Jurisdiction with wardNumber is required.');
  }

  const fullText = `${title} ${description}`;
  if (AADHAAR_REGEX.test(fullText) || PAN_REGEX.test(fullText) || PHONE_REGEX.test(fullText) || EMAIL_REGEX.test(fullText)) {
    errors.push('PII detected in project title or description.');
  }

  return errors;
}

export function validateVerificationReviewPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  if (!body.projectId || !body.milestoneId || !body.submissionId) {
    errors.push('projectId, milestoneId, and submissionId are all required.');
  }

  const allowedDecisions = ['APPROVE', 'REJECT', 'REQUEST_EVIDENCE'];
  if (!allowedDecisions.includes(body.decision)) {
    errors.push(`Decision must be one of: ${allowedDecisions.join(', ')}.`);
  }

  const findings = sanitizeString(body.findings, 2000);
  if (!findings || findings.length < 15) {
    errors.push('Verification findings must be at least 15 characters.');
  }

  return errors;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      queueLength: PUBLIC_PROJECT_API_QUEUE.length,
      recentEntries: PUBLIC_PROJECT_API_QUEUE.slice(-20),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-vercel-forwarded-for'] || '127.0.0.1';
  const limitCheck = rateLimiter.take(clientIp);

  if (!limitCheck.allowed) {
    res.setHeader('Retry-After', limitCheck.retryAfterSeconds);
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMITED',
      retryAfter: limitCheck.retryAfterSeconds,
    });
  }

  const action = req.body?.action || 'submit_progress';

  if (action === 'create_project') {
    const errors = validateProjectCreationPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: errors });
    }

    const { title, description, category, jurisdiction, budgetReference } = req.body;
    const flightKey = `${clientIp}|CREATE|${title}`;

    return singleFlight.run(flightKey, async () => {
      const timestamp = new Date().toISOString();
      const projectId = `proj-${category}-${Date.now()}`;
      const record = {
        action: 'create_project',
        id: projectId,
        title: sanitizeString(title, 150),
        description: sanitizeString(description, 2000),
        category,
        jurisdiction: {
          wardNumber: sanitizeString(jurisdiction.wardNumber, 50),
          zone: sanitizeString(jurisdiction.zone || 'General Zone', 50),
        },
        budgetReference: budgetReference || { sanctionedAmountInr: 1000000 },
        createdAt: timestamp,
      };

      PUBLIC_PROJECT_API_QUEUE.push(record);
      return res.status(201).json({
        success: true,
        message: 'Project created successfully in intake queue.',
        project: record,
      });
    });
  }

  if (action === 'verify_milestone') {
    const errors = validateVerificationReviewPayload(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: errors });
    }

    const { projectId, milestoneId, submissionId, decision, findings, overrideReason } = req.body;
    const timestamp = new Date().toISOString();
    const record = {
      action: 'verify_milestone',
      id: `rev-${Date.now()}`,
      projectId,
      milestoneId,
      submissionId,
      decision,
      findings: sanitizeString(findings, 2000),
      overrideReason: sanitizeString(overrideReason || '', 500),
      verifiedAt: timestamp,
    };

    PUBLIC_PROJECT_API_QUEUE.push(record);
    return res.status(200).json({
      success: true,
      message: 'Verification review recorded successfully.',
      review: record,
    });
  }

  // Default: submit_progress
  const errors = validateProgressSubmissionPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors,
    });
  }

  const { projectId, milestoneId, narrative, reportedPercent, evidenceAssets, idempotencyKey } = req.body;
  const flightKey = `${clientIp}|${projectId}|${milestoneId}|${idempotencyKey || narrative}`;

  return singleFlight.run(flightKey, async () => {
    const timestamp = new Date().toISOString();
    const seal = generateProjectEvidenceSeal(projectId, milestoneId, timestamp);

    const record = {
      action: 'submit_progress',
      id: `SUB-${Date.now()}`,
      projectId,
      milestoneId,
      narrative: sanitizeString(narrative, 2000),
      reportedPercent: Number(reportedPercent),
      evidenceAssetCount: evidenceAssets.length,
      seal,
      submittedAt: timestamp,
      status: 'pending_review',
    };

    PUBLIC_PROJECT_API_QUEUE.push(record);

    return res.status(201).json({
      success: true,
      message: 'Progress submission queued for verification.',
      seal,
      submission: record,
    });
  });
}
