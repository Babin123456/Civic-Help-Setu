/* global process */
/**
 * api/_lib/handlers/heat-relief-observations.js
 * Server-side endpoint for the Heatwave Public Cooling-Centre and Water-Point Directory (#983, #1436).
 *
 * Routes (mounted at /api/heat-relief-observations and /api/heatwave-cooling-directory):
 *   GET  /                           List verified facilities (auto-excluding expired temporary facilities) + observations
 *   GET  /audit-log                  Admin-gated redacted audit log
 *   POST /                           Submit a community condition report (rate-limited, zero PII, pending_review)
 *   POST /facilities                 Admin-gated + jurisdiction-checked verified municipal/DDMA facility registration
 *   POST /:id/moderate               Admin-gated + jurisdiction-checked moderation (approve/reject) of condition report
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import { inspectStringForPII } from '../../../src/services/piiLeakageGuardService.js';
import {
  OPERATIONAL_STATUS,
  CAPACITY_STATUS,
  isCoordinateWithinUP,
  isVerifiedMunicipalOrDisasterSource,
  isTemporaryFacilityExpired,
  validateFacilityRecord,
} from '../../../src/data/upHeatwaveReliefContract.js';
import { getProductionHeatReliefDirectoryStore } from '../heatReliefDirectoryStore.js';

const defaultRateLimiter = createRateLimiter({ limit: 12, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

// In-memory queue preserved for backward compatibility
export const HEAT_RELIEF_OBSERVATION_QUEUE = [];

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/;
const DOOR_REGEX = /\b(?:flat\s*(?:no\.?|#)?\s*[a-z0-9-]+|door\s*(?:no\.?|#)?\s*[a-z0-9/-]+|house\s*(?:no\.?|#)?\s*[a-z0-9/-]+)\b/i;
const SENSITIVE_KEY_REGEX = /^(?:aadhaar|pan|otp|password|biometric|fingerprint|iris|reporterName|citizenName)$/i;
const ID_SEGMENT = /^[a-z0-9][a-z0-9_-]{1,127}$/i;

const sanitizeText = (val, maxLen = 1500) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

function parseBody(body) {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function parseUrlQuery(url) {
  const q = {};
  const idx = (url || '').indexOf('?');
  if (idx === -1) return q;
  const search = url.slice(idx + 1);
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) q[decodeURIComponent(pair)] = '';
    else q[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }
  return q;
}

export async function defaultVerifyHeatActor(req) {
  const token = bearerToken(req.headers || {});
  if (!token) return { ok: false, status: 401, error: 'Authentication required.' };

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { ok: false, status: 503, error: 'Authentication service is not configured.' };

  try {
    const { verifyToken, createClerkClient } = await import('@clerk/backend');
    const claims = await verifyToken(token, { secretKey });
    const clerk = createClerkClient({ secretKey });
    const user = await clerk.users.getUser(claims.sub);
    const role = resolveRole(user?.publicMetadata);
    const jurisdiction =
      typeof user?.publicMetadata?.jurisdiction === 'string' && user.publicMetadata.jurisdiction.trim()
        ? user.publicMetadata.jurisdiction.trim()
        : '*';
    return { ok: true, actorId: claims.sub, role, jurisdiction };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token.' };
  }
}

function isJurisdictionAuthorized(operatorJurisdiction, targetJurisdiction) {
  if (!operatorJurisdiction || operatorJurisdiction === '*') return true;
  if (!targetJurisdiction || targetJurisdiction === 'UNSPECIFIED') return false;
  return operatorJurisdiction.toLowerCase() === String(targetJurisdiction).trim().toLowerCase();
}

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

function hasSensitiveKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Object.keys(obj).some((k) => SENSITIVE_KEY_REGEX.test(k));
}

function findPiiInObject(node) {
  if (typeof node === 'string') {
    const check = inspectStringForPII(node);
    return check.clean ? [] : check.violations;
  }
  if (Array.isArray(node)) {
    return node.flatMap(findPiiInObject);
  }
  if (node && typeof node === 'object') {
    return Object.values(node).flatMap(findPiiInObject);
  }
  return [];
}

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

  const nowMs = new Date(referenceTime).getTime();
  if (body.timestamp) {
    const reportMs = new Date(body.timestamp).getTime();
    if (Number.isNaN(reportMs)) {
      errors.push('Invalid timestamp format.');
    } else if (reportMs > nowMs + 5 * 60 * 1000) {
      errors.push('Observation timestamp cannot be in the future.');
    } else if (nowMs - reportMs > 48 * 60 * 60 * 1000) {
      errors.push('Observation timestamp is older than 48 hours and cannot be accepted.');
    }
  }

  if (body.coordinates) {
    const { lat, lng } = body.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      errors.push('Coordinates must have numeric lat and lng properties.');
    } else if (!isCoordinateWithinUP(lat, lng)) {
      errors.push('Coordinates fall outside Uttar Pradesh administrative boundaries.');
    }
  }

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
  if (body.reporterName || body.citizenName || hasSensitiveKeys(body)) {
    errors.push('Personal identifiers (names, Aadhaar, OTP, password, biometrics) are strictly prohibited.');
  }

  const piiViolations = findPiiInObject(body);
  if (piiViolations.length > 0) {
    errors.push(`Prohibited PII detected (${piiViolations.map((v) => v.type).join(', ')}).`);
  }

  return errors;
}

export function createHeatReliefDirectoryHandler({
  verifyActor = defaultVerifyHeatActor,
  getStore = getProductionHeatReliefDirectoryStore,
  rateLimiter = defaultRateLimiter,
} = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('content-type', 'application/json; charset=utf-8');

    const method = (req.method || 'GET').toUpperCase();
    const url = req.url || '';
    const query = { ...parseUrlQuery(url), ...(req.query || {}) };
    const pathname = url.split('?')[0];
    const segments = pathname.split('/').filter(Boolean);
    const rest = segments[0] === 'api' ? segments.slice(2) : segments.slice(1);

    const store = getStore();

    // GET /audit-log (Admin-gated)
    if (method === 'GET' && rest[0] === 'audit-log') {
      const auth = await verifyActor(req);
      if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
      if (auth.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Admin role required to inspect directory audit logs.' });
      }
      return res.status(200).json({ ok: true, auditLog: store.getAuditLog() });
    }

    // GET / (Public verified directory + moderated condition reports)
    if (method === 'GET' && rest.length === 0) {
      const includeExpired = query.includeExpired === 'true';
      const facilities = store.listFacilities({ includeExpired });
      const storeObservations = store.listObservations();
      const combinedObservations = storeObservations.length > 0 ? storeObservations : HEAT_RELIEF_OBSERVATION_QUEUE;
      return res.status(200).json({
        ok: true,
        facilitiesCount: facilities.length,
        facilities,
        pendingCount: combinedObservations.filter((item) => item.status === 'pending_review').length,
        items: combinedObservations,
      });
    }

    // Rate limit mutations
    const ip =
      req.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
      req.headers?.['x-real-ip'] ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    if (method === 'POST') {
      const { allowed, retryAfterSeconds } = rateLimiter.take(ip);
      if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          ok: false,
          error: 'Observation rate limit exceeded. Please wait a minute before submitting further reports.',
          retryAfterSeconds,
        });
      }
    }

    // POST /facilities (Admin-gated + jurisdiction-checked verified municipal/DDMA facility registration)
    if (method === 'POST' && rest[0] === 'facilities') {
      const auth = await verifyActor(req);
      if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
      if (auth.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Admin role required to register verified facilities.' });
      }

      const body = parseBody(req.body);
      if (!body) return res.status(400).json({ ok: false, error: 'Request body must be a valid JSON object.' });

      if (hasSensitiveKeys(body) || findPiiInObject(body).length > 0) {
        return res.status(400).json({ ok: false, error: 'Prohibited PII or sensitive personal fields detected.' });
      }

      const targetJurisdiction = body.jurisdiction || body.district;
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJurisdiction)) {
        return res.status(403).json({
          ok: false,
          error: `Operator jurisdiction "${auth.jurisdiction}" cannot modify "${targetJurisdiction}".`,
        });
      }

      if (!isVerifiedMunicipalOrDisasterSource(body)) {
        return res.status(400).json({
          ok: false,
          error: 'Directory accepts only verified municipal or disaster-management sources (responsibleAuthority, sourceUrl, verifiedAt).',
        });
      }

      const validation = validateFacilityRecord(body);
      if (!validation.isValid) {
        return res.status(400).json({ ok: false, error: 'Invalid facility record.', details: validation.errors });
      }

      if (body.isTemporary && (!body.expiresAt || isTemporaryFacilityExpired(body))) {
        return res.status(400).json({
          ok: false,
          error: 'Temporary facilities must include a future expiresAt ISO timestamp.',
        });
      }

      const record = {
        ...body,
        name: sanitizeText(body.name, 200),
        address: sanitizeText(body.address || '', 300),
        responsibleAuthority: sanitizeText(body.responsibleAuthority, 200),
        jurisdiction: sanitizeText(targetJurisdiction, 100),
        effectiveDate: body.effectiveDate || body.verifiedAt,
        originClassification: 'official_record',
      };
      store.addFacility(record, auth.actorId);
      return res.status(201).json({ ok: true, facility: record });
    }

    // POST /:id/moderate (Admin-gated + jurisdiction-checked condition report moderation)
    if (method === 'POST' && rest.length === 2 && ID_SEGMENT.test(rest[0]) && rest[1] === 'moderate') {
      const auth = await verifyActor(req);
      if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });
      if (auth.role !== 'admin') {
        return res.status(403).json({ ok: false, error: 'Admin role required to moderate condition reports.' });
      }

      const body = parseBody(req.body);
      if (!body || !['approve', 'reject'].includes(body.decision)) {
        return res.status(400).json({ ok: false, error: 'decision must be "approve" or "reject".' });
      }

      const targetObs = store.listObservations().find((o) => o.id === rest[0]);
      if (!targetObs) {
        return res.status(404).json({ ok: false, error: 'Condition report not found.' });
      }

      const facility = store.getFacilityById(targetObs.facilityId);
      const targetJurisdiction = facility?.jurisdiction || facility?.district || 'UNSPECIFIED';
      if (!isJurisdictionAuthorized(auth.jurisdiction, targetJurisdiction)) {
        return res.status(403).json({
          ok: false,
          error: `Operator jurisdiction "${auth.jurisdiction}" cannot moderate reports for "${targetJurisdiction}".`,
        });
      }

      const updated = store.moderateObservation(
        rest[0],
        body.decision,
        auth.actorId,
        sanitizeText(body.note || '', 400)
      );
      return res.status(200).json({ ok: true, observation: updated });
    }

    // POST / (Submit community condition report)
    if (method === 'POST' && rest.length === 0) {
      const body = parseBody(req.body) || {};
      const flightKey = `${ip}:${body.facilityId || 'any'}`;

      return singleFlight.run(flightKey, async () => {
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
          originClassification: 'citizen_entered_fact',
          verificationSeal: seal,
        };

        HEAT_RELIEF_OBSERVATION_QUEUE.unshift(submissionRecord);
        store.addObservation(submissionRecord);

        return res.status(201).json({
          ok: true,
          message: 'Heatwave relief observation recorded and queued for partner verification.',
          verificationSeal: seal,
          submittedAt: timestamp,
          record: submissionRecord,
        });
      });
    }

    res.setHeader('allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method or route not allowed.' });
  };
}

export default createHeatReliefDirectoryHandler();
