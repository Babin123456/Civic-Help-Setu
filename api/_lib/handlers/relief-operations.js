/**
 * Public relief need intake API (#747).
 *
 * This endpoint is the untrusted-public edge of the Relief Operations feature.
 * It accepts only the minimum fields needed to record a need, rejects personal
 * identifiers, applies per-address rate limits and single-flight deduplication,
 * and returns a public receipt that contains no internal record identifiers.
 *
 * The full operator workflow (verification, approval, reservations, delivery
 * confirmation) runs behind the authenticated service boundary in
 * src/services/reliefOperationsService.js. This endpoint never allocates,
 * approves, diagnoses or triages anything.
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

/** In-memory intake queue for the serverless function instance. */
export const RELIEF_PUBLIC_QUEUE = [];

export const ALLOWED_CATEGORIES = new Set([
  'shelter',
  'food',
  'water',
  'medicine',
  'transport',
  'sanitation',
  'power',
]);

export const ALLOWED_URGENCY = new Set(['low', 'moderate', 'high', 'immediate']);

export const RELIEF_API_ERRORS = Object.freeze({
  VALIDATION: 'RELIEF_VALIDATION_ERROR',
  RATE_LIMITED: 'RELIEF_RATE_LIMITED',
  IDEMPOTENCY_CONFLICT: 'RELIEF_IDEMPOTENCY_CONFLICT',
  METHOD_NOT_ALLOWED: 'RELIEF_METHOD_NOT_ALLOWED',
  SERVER_ERROR: 'RELIEF_SERVER_ERROR',
});

const GUIDANCE = Object.freeze({
  [RELIEF_API_ERRORS.VALIDATION]:
    'Check the highlighted fields. Report the need only; do not include names, phone numbers, Aadhaar or email addresses.',
  [RELIEF_API_ERRORS.RATE_LIMITED]:
    'Too many reports were submitted from this connection. Wait a few minutes before trying again.',
  [RELIEF_API_ERRORS.IDEMPOTENCY_CONFLICT]:
    'This request key was already used with different details. Refresh and submit a new report with a new key.',
  [RELIEF_API_ERRORS.METHOD_NOT_ALLOWED]: 'Use POST to submit a need or GET for the public aggregate status.',
  [RELIEF_API_ERRORS.SERVER_ERROR]: 'The report could not be saved. Nothing was recorded; please try again.',
});

const PII_PATTERNS = [
  ['aadhaar', /\b\d{4}\s?\d{4}\s?\d{4}\b/],
  ['pan', /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i],
  ['phone', /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/],
  ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
];

export const sanitizeString = (value, maxLength = 1000) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

export const detectPii = (text) =>
  PII_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);

const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const generateReliefReceiptId = (category, locality, submittedAt, nonce = '') =>
  `RLF-RCPT-${fnv1a(`${category}|${locality}|${submittedAt}|${nonce}`).toUpperCase()}`;

const generateTrackingToken = (existing = []) => {
  const taken = new Set(existing.map((record) => record.trackingToken));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const token = `TRK-RLF-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!taken.has(token)) return token;
  }
  return `TRK-RLF-${String(Date.now()).slice(-6)}`;
};

const normalizeJurisdiction = (value, errors) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(raw)) {
    errors.push('A valid jurisdiction identifier (2–40 letters, digits, hyphen or underscore) is required.');
    return null;
  }
  return raw.toUpperCase();
};

/**
 * Strict server-side validation. Returns `{ errors, value }`; `value` is only
 * meaningful when `errors` is empty.
 */
export function validateReliefSubmissionPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a valid JSON object.'], value: null };
  }

  const category = sanitizeString(body.category, 30);
  if (!ALLOWED_CATEGORIES.has(category)) {
    errors.push(`Category must be one of: ${[...ALLOWED_CATEGORIES].join(', ')}.`);
  }

  const locality = sanitizeString(body.locality, 80);
  if (locality.length < 2) {
    errors.push('Locality must be between 2 and 80 characters.');
  }

  const jurisdictionId = normalizeJurisdiction(body.jurisdictionId, errors);

  const description = sanitizeString(body.description, 1000);
  if (description.length < 10) {
    errors.push('Description must be at least 10 characters so responders can act on it.');
  }
  const pii = detectPii(`${description} ${locality}`);
  if (pii.length > 0) {
    errors.push(
      `Personal identifiers detected (${pii.join(', ')}). Remove names, phone numbers, Aadhaar, PAN and email addresses.`
    );
  }

  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
    errors.push('Quantity must be a whole number between 1 and 100,000.');
  }

  const peopleAffected = Number(body.peopleAffected);
  if (!Number.isInteger(peopleAffected) || peopleAffected < 1 || peopleAffected > 500000) {
    errors.push('People affected must be a whole number between 1 and 500,000.');
  }

  const urgency = body.urgency ? sanitizeString(body.urgency, 20) : 'moderate';
  if (!ALLOWED_URGENCY.has(urgency)) {
    errors.push(`Urgency must be one of: ${[...ALLOWED_URGENCY].join(', ')}.`);
  }

  const idempotencyKey = body.idempotencyKey ? sanitizeString(body.idempotencyKey, 80) : null;
  if (body.idempotencyKey && !/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey || '')) {
    errors.push('Idempotency key must be 8–80 characters using letters, digits, dot, colon, underscore or hyphen.');
  }

  return {
    errors,
    value:
      errors.length > 0
        ? null
        : {
            category,
            locality,
            jurisdictionId,
            description,
            quantity,
            peopleAffected,
            urgency,
            idempotencyKey,
          },
  };
}

/** Public receipt: safe fields only. Internal ids and the original description are not returned. */
export const toPublicReceipt = (record) => ({
  receiptId: record.receiptId,
  trackingToken: record.trackingToken,
  category: record.category,
  locality: record.locality,
  jurisdictionId: record.jurisdictionId,
  quantity: record.quantity,
  peopleAffected: record.peopleAffected,
  urgency: record.urgency,
  status: record.status,
  submittedAt: record.submittedAt,
  deduplicated: Boolean(record.duplicateOfReceiptId),
  publicNote:
    'Your report has been recorded. Keep the tracking token to check its status. Only aggregate figures are public; personal details are never published.',
});

const findDuplicate = (value) => {
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  const tokens = new Set(value.description.toLowerCase().split(/\W+/).filter((token) => token.length > 3));
  return (
    RELIEF_PUBLIC_QUEUE.find((record) => {
      if (record.status === 'duplicate') return false;
      if (Date.parse(record.submittedAt) < cutoff) return false;
      if (record.category !== value.category) return false;
      if (record.jurisdictionId !== value.jurisdictionId) return false;
      if (record.locality.toLowerCase() !== value.locality.toLowerCase()) return false;
      const other = new Set(record.description.toLowerCase().split(/\W+/).filter((token) => token.length > 3));
      const intersection = [...tokens].filter((token) => other.has(token)).length;
      const union = new Set([...tokens, ...other]).size;
      return union > 0 && intersection / union >= 0.7;
    }) || null
  );
};

const fingerprint = (value) => fnv1a(JSON.stringify(value));

const aggregatePublicStatus = (jurisdictionId = null) => {
  const scoped = RELIEF_PUBLIC_QUEUE.filter(
    (record) =>
      record.status !== 'duplicate' && (!jurisdictionId || record.jurisdictionId === jurisdictionId)
  );
  const byCategory = new Map();
  const byLocality = new Map();
  scoped.forEach((record) => {
    const category = byCategory.get(record.category) || {
      category: record.category,
      reportCount: 0,
      peopleAffected: 0,
      remainingQuantity: 0,
    };
    category.reportCount += 1;
    category.peopleAffected += record.peopleAffected;
    category.remainingQuantity += record.quantity;
    byCategory.set(record.category, category);

    const locality = byLocality.get(record.locality) || {
      locality: record.locality,
      jurisdictionId: record.jurisdictionId,
      reportCount: 0,
      peopleAffected: 0,
      remainingQuantity: 0,
    };
    locality.reportCount += 1;
    locality.peopleAffected += record.peopleAffected;
    locality.remainingQuantity += record.quantity;
    byLocality.set(record.locality, locality);
  });

  const lastUpdatedAt = scoped.reduce(
    (latest, record) => Math.max(latest, Date.parse(record.submittedAt) || 0),
    0
  );

  return {
    generatedAt: new Date().toISOString(),
    jurisdictionId,
    openNeedCount: scoped.length,
    peopleAffected: scoped.reduce((sum, record) => sum + record.peopleAffected, 0),
    byCategory: [...byCategory.values()].sort((a, b) => b.remainingQuantity - a.remainingQuantity),
    byLocality: [...byLocality.values()].sort((a, b) => b.peopleAffected - a.peopleAffected),
    lastUpdatedAt: lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : null,
    scopeNote:
      'This endpoint aggregates reports received by this public intake API only. Operational inventories, allocations, private notes and verified partner records are never exposed here.',
    disclaimer:
      'Figures are indicative and may lag field verification. Follow instructions from district authorities in an emergency.',
  };
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const query = req.query || {};
    const rawJurisdiction = Array.isArray(query.jurisdictionId) ? query.jurisdictionId[0] : query.jurisdictionId;
    const jurisdictionId = rawJurisdiction ? sanitizeString(rawJurisdiction, 40).toUpperCase() : null;
    return res.status(200).json({
      success: true,
      ...aggregatePublicStatus(jurisdictionId),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      error: 'Method not allowed.',
      code: RELIEF_API_ERRORS.METHOD_NOT_ALLOWED,
      guidance: GUIDANCE[RELIEF_API_ERRORS.METHOD_NOT_ALLOWED],
    });
  }

  const key = clientKey(req.headers || {});
  if (key) {
    const limit = rateLimiter.take(key);
    if (!limit.allowed) {
      res.setHeader('Retry-After', limit.retryAfterSeconds);
      return res.status(429).json({
        error: 'Too many reports from this connection.',
        code: RELIEF_API_ERRORS.RATE_LIMITED,
        guidance: GUIDANCE[RELIEF_API_ERRORS.RATE_LIMITED],
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
  }

  const { errors, value } = validateReliefSubmissionPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed.',
      code: RELIEF_API_ERRORS.VALIDATION,
      guidance: GUIDANCE[RELIEF_API_ERRORS.VALIDATION],
      details: errors,
    });
  }

  const flightKey = value.idempotencyKey
    ? `relief:${value.idempotencyKey}`
    : `relief:${key || 'unknown'}:${value.category}:${value.locality}:${value.quantity}:${value.urgency}`;

  return singleFlight.run(flightKey, async () => {
    // Idempotency replay.
    if (value.idempotencyKey) {
      const existing = RELIEF_PUBLIC_QUEUE.find(
        (record) => record.idempotencyKey === value.idempotencyKey
      );
      if (existing) {
        if (existing.idempotencyFingerprint !== fingerprint(value)) {
          return res.status(409).json({
            error: 'Idempotency key conflict.',
            code: RELIEF_API_ERRORS.IDEMPOTENCY_CONFLICT,
            guidance: GUIDANCE[RELIEF_API_ERRORS.IDEMPOTENCY_CONFLICT],
          });
        }
        return res.status(200).json({
          success: true,
          idempotentReplay: true,
          record: toPublicReceipt(existing),
        });
      }
    }

    const duplicate = findDuplicate(value);
    const submittedAt = new Date().toISOString();
    const trackingToken = generateTrackingToken(RELIEF_PUBLIC_QUEUE);
    const record = {
      // Internal id is retained server-side only and never returned.
      internalId: `RLF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      receiptId: generateReliefReceiptId(value.category, value.locality, submittedAt, trackingToken),
      trackingToken,
      category: value.category,
      locality: value.locality,
      jurisdictionId: value.jurisdictionId,
      description: value.description,
      quantity: value.quantity,
      peopleAffected: value.peopleAffected,
      urgency: value.urgency,
      status: duplicate ? 'duplicate' : 'submitted',
      duplicateOfReceiptId: duplicate ? duplicate.receiptId : null,
      idempotencyKey: value.idempotencyKey,
      idempotencyFingerprint: value.idempotencyKey ? fingerprint(value) : null,
      submittedAt,
      schemaVersion: 1,
    };

    // Bound the in-memory queue for a warm serverless instance.
    RELIEF_PUBLIC_QUEUE.unshift(record);
    if (RELIEF_PUBLIC_QUEUE.length > 1000) RELIEF_PUBLIC_QUEUE.length = 1000;

    return res.status(201).json({
      success: true,
      record: toPublicReceipt(record),
    });
  });
}
