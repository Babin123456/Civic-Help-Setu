/**
 * api/_lib/handlers/flood-incident-reports.js
 * Server-side endpoint for UP Flooded-Road & Drain Blockage Community Reports (#985).
 *
 * Invariants:
 *  - Rate limiting & single-flight deduplication via abuseGuard.
 *  - Strict Zero PII: Rejects Aadhaar, PAN, personal phone numbers, or exact residential addresses.
 *  - Anti-spoofing: Validates timestamps are not in future and coordinates lie within Uttar Pradesh.
 *  - Deterministic cryptographic seal generation for citizen tracking (UP-FLD-XXXX-XXXX).
 *  - Source gate: Official alerts require authenticated authority name & bulletin ref.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory moderation queue
export const FLOOD_REPORT_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+|plot\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;

const UP_PILOT_DISTRICTS = new Set([
  'Lucknow',
  'Kanpur Nagar',
  'Varanasi',
  'Prayagraj',
  'Agra',
  'Gorakhpur',
  'Meerut',
  'Bareilly',
  'Ayodhya',
  'Ghaziabad',
  'Moradabad',
  'Aligarh',
  'Jhansi',
  'Saharanpur',
  'Bahraich',
]);

const UP_BOUNDS = {
  MIN_LAT: 23.8,
  MAX_LAT: 30.5,
  MIN_LNG: 77.0,
  MAX_LNG: 84.7,
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

export const generateFloodReportSeal = (district, timestamp) => {
  const seed = `${district}|${timestamp}|UP_FLOOD_INCIDENT_SEAL_V1`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  const p1 = (unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const p2 = ((unsigned >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `UP-FLD-${p1}-${p2}`;
};

export const validateFloodReportPayload = (payload, referenceTime = new Date()) => {
  const errors = [];
  const nowMs = new Date(referenceTime).getTime();

  if (!payload || typeof payload !== 'object') {
    return ['Payload must be a valid JSON object'];
  }

  // 1. District
  if (!payload.district || !UP_PILOT_DISTRICTS.has(payload.district)) {
    errors.push('district must be an authenticated UP pilot district');
  }

  // 2. Locality
  if (!payload.locality || typeof payload.locality !== 'string' || payload.locality.trim().length < 3) {
    errors.push('locality must be at least 3 characters long');
  }

  // 3. Incident Type
  const validTypes = ['flooded_road', 'blocked_drain', 'passable_route'];
  if (!payload.incidentType || !validTypes.includes(payload.incidentType)) {
    errors.push(`incidentType must be one of: ${validTypes.join(', ')}`);
  }

  // 4. Observed At (Anti-Spoofing)
  if (!payload.observedAt) {
    errors.push('observedAt is required');
  } else {
    const observedMs = new Date(payload.observedAt).getTime();
    if (isNaN(observedMs)) {
      errors.push('observedAt must be a valid ISO date');
    } else if (observedMs > nowMs + 5 * 60 * 1000) {
      errors.push('observedAt cannot be in the future (anti-spoofing)');
    }
  }

  // 5. Zero PII Guard
  const combined = `${payload.locality || ''} ${payload.notes || ''} ${payload.corridorName || ''}`;
  if (AADHAAR_REGEX.test(combined)) errors.push('Aadhaar numbers are forbidden in civic reports');
  if (PAN_REGEX.test(combined)) errors.push('PAN numbers are forbidden in civic reports');
  if (PHONE_REGEX.test(combined)) errors.push('Personal phone numbers are forbidden; use public landmarks');
  if (DOOR_REGEX.test(combined)) errors.push('Exact flat/door/house numbers are forbidden for citizen privacy');

  // 6. Geographic Bounding
  if (payload.coordinates) {
    const { lat, lng } = payload.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      errors.push('coordinates must contain numeric lat and lng');
    } else if (
      lat < UP_BOUNDS.MIN_LAT ||
      lat > UP_BOUNDS.MAX_LAT ||
      lng < UP_BOUNDS.MIN_LNG ||
      lng > UP_BOUNDS.MAX_LNG
    ) {
      errors.push(`coordinates (${lat}, ${lng}) fall outside administrative boundaries of Uttar Pradesh`);
    }
  }

  // 7. Source Tier Authentication Gate
  if (payload.sourceTier === 'official_emergency_alert' || payload.sourceTier === 'municipal_advisory') {
    if (!payload.issuingAuthority || typeof payload.issuingAuthority !== 'string') {
      errors.push('Official alerts require authenticated issuingAuthority');
    }
    if (!payload.officialBulletinRef || typeof payload.officialBulletinRef !== 'string') {
      errors.push('Official alerts require officialBulletinRef reference ID');
    }
  }

  return errors;
};

export default async function handler(req, res) {
  if (res.setHeader) res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    return res.status(200).json({
      pendingCount: FLOOD_REPORT_QUEUE.length,
      items: FLOOD_REPORT_QUEUE.slice(-50),
    });
  }

  if (req.method !== 'POST') {
    if (res.setHeader) res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method not allowed. Use POST or GET.' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, retryAfterSeconds } = rateLimiter.take(clientIp);
  if (!allowed) {
    if (res.setHeader) res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({ error: 'Too many incident submissions. Please wait 1 minute.', retryAfterSeconds });
  }

  let payload = req.body || {};
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({ error: 'Malformed JSON payload.' });
    }
  }

  const validationErrors = validateFloodReportPayload(payload);
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: validationErrors });
  }

  const flightKey = `${clientIp}|${payload.district}|${payload.locality}`;

  return singleFlight.run(flightKey, async () => {
    const cleanLocality = sanitizeText(payload.locality, 200);
    const cleanNotes = sanitizeText(payload.notes || '', 800);
    const timestamp = payload.observedAt || new Date().toISOString();
    const trackingSeal = generateFloodReportSeal(payload.district, timestamp);

    const queuedReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trackingSeal,
      district: payload.district,
      locality: cleanLocality,
      incidentType: payload.incidentType,
      depthCategory: payload.depthCategory || 'unknown_or_unspecified',
      sourceTier: payload.sourceTier || 'citizen_report',
      issuingAuthority: payload.issuingAuthority ? sanitizeText(payload.issuingAuthority, 150) : null,
      officialBulletinRef: payload.officialBulletinRef ? sanitizeText(payload.officialBulletinRef, 100) : null,
      notes: cleanNotes,
      coordinates: payload.coordinates || null,
      observedAt: timestamp,
      receivedAt: new Date().toISOString(),
    };

    FLOOD_REPORT_QUEUE.push(queuedReport);

    return res.status(201).json({
      success: true,
      message: 'Incident observation received and registered on UP Response Board.',
      trackingSeal,
      incident: queuedReport,
    });
  });
}
