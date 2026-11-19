import { safeHttpUrl } from '../../src/utils/safeContent.js';

export const APPLICATION_EVENT_CATEGORIES = Object.freeze([
  'submission',
  'acknowledgement',
  'review',
  'query',
  'outcome',
]);

export const APPLICATION_EVENT_SOURCES = Object.freeze([
  'official_portal',
  'official_office',
  'system',
  'citizen_note',
]);

const OFFICIAL_SOURCES = new Set(['official_portal', 'official_office']);
const CIVIC_STATUSES = new Set([
  'submitted',
  'in-progress',
  'action-required',
  'completed',
  'sla-breach',
]);
const AADHAAR_REGEX = /\b[2-9]\d{3}\s?-?\d{4}\s?-?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}\d{4}[A-Z]\b/i;
const SENSITIVE_PAYLOAD_KEYS = new Set([
  'aadhaar',
  'pan',
  'otp',
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'privatekey',
  'base64',
  'filedata',
  'fileblob',
  'documentcontent',
  'documentdata',
  'attachment',
  'binary',
]);
const normalizedKey = (key) => String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
const PAYLOAD_MAX_LENGTH = 4000;

const json = (status, body, extra = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  body,
});

const safeString = (value, max = 4000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const makeEventId = () =>
  `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const buildDataVersion = (events = []) =>
  fnv1a(
    events
      .map((event) => `${event.eventId}:${event.status}:${event.sourceTimestamp}`)
      .sort()
      .join('|')
  );

export const bearerToken = (headers = {}) => {
  const key = Object.keys(headers).find((name) => name.toLowerCase() === 'authorization');
  const value = key ? headers[key] : '';
  const match =
    typeof value === 'string'
      ? /^Bearer ([A-Za-z0-9._~+/=-]{10,4096})$/.exec(value.trim())
      : null;
  return match ? match[1] : null;
};

export const validateApplicationEventRequest = (body) => {
  const errors = [];
  if (!isPlainObject(body)) return ['Request body must be a JSON object.'];

  if (!safeString(body.applicationId, 120)) {
    errors.push('applicationId is required.');
  }

  const category = safeString(body.category, 40);
  if (!APPLICATION_EVENT_CATEGORIES.includes(category)) {
    errors.push(`category must be one of: ${APPLICATION_EVENT_CATEGORIES.join(', ')}.`);
  }

  const sourceType = safeString(body.sourceType, 40);
  if (!APPLICATION_EVENT_SOURCES.includes(sourceType)) {
    errors.push(`sourceType must be one of: ${APPLICATION_EVENT_SOURCES.join(', ')}.`);
  }

  if (!safeString(body.sourceTimestamp, 120)) {
    errors.push('sourceTimestamp is required.');
  }

  if (body.status !== null && body.status !== undefined) {
    const status = safeString(body.status, 40);
    if (!CIVIC_STATUSES.has(status)) {
      errors.push('status must be a recognised application status or null.');
    }
  }

  if (body.payloadVersion !== undefined) {
    const version = Number(body.payloadVersion);
    if (!Number.isInteger(version) || version < 1) {
      errors.push('payloadVersion must be a positive integer.');
    }
  }

  if (body.payload !== undefined && !isPlainObject(body.payload)) {
    errors.push('payload must be an object when provided.');
  }

  if (body.sourceUrl !== undefined && body.sourceUrl !== null && body.sourceUrl !== '') {
    if (!safeHttpUrl(body.sourceUrl)) {
      errors.push('sourceUrl must be a valid http(s) URL without embedded credentials.');
    }
  }

  if (isPlainObject(body.payload)) {
    const sensitiveKey = Object.keys(body.payload).find((key) =>
      SENSITIVE_PAYLOAD_KEYS.has(normalizedKey(key))
    );
    if (sensitiveKey) {
      errors.push(`payload must not contain sensitive field "${sensitiveKey}".`);
    }
  }
  const serialized = JSON.stringify({
    payload: body.payload || {},
    sourceRef: body.sourceRef || '',
  });
  if (serialized.length > PAYLOAD_MAX_LENGTH) {
    errors.push(`payload and sourceRef must be ${PAYLOAD_MAX_LENGTH} characters or fewer.`);
  }
  if (AADHAAR_REGEX.test(serialized)) {
    errors.push('Aadhaar numbers are not allowed in timeline event payloads.');
  }
  if (PAN_REGEX.test(serialized)) {
    errors.push('PAN identifiers are not allowed in timeline event payloads.');
  }

  if (sourceType === 'citizen_note' && body.isOfficial === true) {
    errors.push('Citizen notes cannot be submitted as official events.');
  }

  return errors;
};

const normalizeRequestedEvent = (body, userId, role) => {
  const sourceType = safeString(body.sourceType, 40);
  return {
    eventId: safeString(body.eventId, 160) || makeEventId(),
    applicationId: safeString(body.applicationId, 120).toUpperCase(),
    category: safeString(body.category, 40),
    sourceType,
    sourceRef: safeString(body.sourceRef, 240) || sourceType,
    sourceUrl: safeHttpUrl(body.sourceUrl),
    sourceTimestamp: safeString(body.sourceTimestamp, 120),
    ingestedAt: new Date().toISOString(),
    status: body.status === null || body.status === undefined ? null : safeString(body.status, 40),
    statusTransition: isPlainObject(body.statusTransition)
      ? {
          from: body.statusTransition.from ?? null,
          to: body.statusTransition.to ?? null,
        }
      : null,
    actorRole: role,
    payloadVersion: Number.isInteger(Number(body.payloadVersion))
      ? Number(body.payloadVersion)
      : 1,
    payload: isPlainObject(body.payload) ? JSON.parse(JSON.stringify(body.payload)) : {},
    idempotencyKey: safeString(body.idempotencyKey, 240) || null,
    isOfficial: OFFICIAL_SOURCES.has(sourceType),
    isPrivateGuidance: sourceType === 'citizen_note',
    ownerUserId: userId,
  };
};

const matchesIdentity = (candidate, existing) => {
  if (candidate.eventId === existing.eventId) return true;
  if (
    candidate.idempotencyKey &&
    existing.idempotencyKey &&
    candidate.idempotencyKey === existing.idempotencyKey
  ) {
    return true;
  }
  if (
    candidate.applicationId === existing.applicationId &&
    candidate.category === existing.category &&
    candidate.sourceType === existing.sourceType &&
    candidate.sourceTimestamp === existing.sourceTimestamp &&
    candidate.status === existing.status &&
    JSON.stringify(candidate.payload) === JSON.stringify(existing.payload)
  ) {
    return true;
  }
  return false;
};

export const createMemoryApplicationEventRepository = () => {
  const events = new Map();
  const auditEntries = [];
  let auditSequence = 0;

  return {
    reset() {
      events.clear();
      auditEntries.length = 0;
      auditSequence = 0;
    },
    audit(entry) {
      auditSequence += 1;
      const record = {
        ...entry,
        auditId: `audit-${auditSequence}`,
        recordedAt: new Date().toISOString(),
      };
      auditEntries.push(record);
      return record;
    },
    listAudit() {
      return auditEntries.map((entry) => ({ ...entry }));
    },
    list({ applicationId, limit = 25, cursor = 0 } = {}) {
      const cleanId = safeString(applicationId, 120).toUpperCase();
      const all = [...events.values()]
        .filter((event) => event.applicationId === cleanId)
        .sort((left, right) => {
          const leftTime = Date.parse(left.sourceTimestamp);
          const rightTime = Date.parse(right.sourceTimestamp);
          const leftValue = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
          const rightValue = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
          if (leftValue !== rightValue) return leftValue - rightValue;
          return Date.parse(left.ingestedAt) - Date.parse(right.ingestedAt);
        });
      const start = Math.max(Number(cursor) || 0, 0);
      const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 50);
      const items = all.slice(start, start + safeLimit);
      const next = start + items.length;
      return {
        items,
        nextCursor: next < all.length ? String(next) : null,
        total: all.length,
        ownerUserId: all[0]?.ownerUserId || null,
        dataVersion: buildDataVersion(all),
      };
    },
    create(event) {
      for (const existing of events.values()) {
        if (matchesIdentity(event, existing)) {
          return { status: 'duplicate', event: existing };
        }
      }
      events.set(event.eventId, event);
      return { status: 'created', event };
    },
  };
};

export const applicationEventRepository = createMemoryApplicationEventRepository();

const adminRoles = new Set(['admin', 'reviewer', 'official']);
const isAdmin = (role) => adminRoles.has(role);

export const createApplicationEventsHandler = ({
  verifySession,
  repository,
  ipLimiter = null,
}) => {
  if (typeof verifySession !== 'function') {
    throw new TypeError('createApplicationEventsHandler needs verifySession');
  }
  if (!repository || typeof repository.list !== 'function' || typeof repository.create !== 'function') {
    throw new TypeError('createApplicationEventsHandler needs a repository');
  }

  return async function handle({ method, headers = {}, body = null, query = {} } = {}) {
    if (!['GET', 'POST'].includes(method)) {
      return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
    }

    if (ipLimiter) {
      const address =
        (headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'] || '')
          .split(',')[0]
          .trim() || 'unknown';
      const verdict = ipLimiter.take(address);
      if (!verdict.allowed) {
        return json(429, { error: 'rate_limited', retryAfterSeconds: verdict.retryAfterSeconds }, {
          'Retry-After': String(verdict.retryAfterSeconds),
        });
      }
    }

    const token = bearerToken(headers);
    if (!token) return json(401, { error: 'missing_token' });

    let session;
    try {
      session = await verifySession(token);
    } catch {
      return json(401, { error: 'invalid_token' });
    }

    const userId = safeString(session?.userId, 160);
    const role = safeString(session?.role, 40) || 'citizen';
    if (!userId) return json(401, { error: 'invalid_token' });

    if (method === 'GET') {
      const applicationId = safeString(query.applicationId, 120);
      if (!applicationId) {
        return json(400, { error: 'validation_failed', details: ['applicationId is required.'] });
      }

      const limit = query.limit === undefined ? 25 : Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        return json(400, {
          error: 'validation_failed',
          details: ['limit must be an integer between 1 and 50.'],
        });
      }

      const cursor = query.cursor === undefined ? 0 : Number(query.cursor);
      if (!Number.isInteger(cursor) || cursor < 0) {
        return json(400, {
          error: 'validation_failed',
          details: ['cursor must be a non-negative integer.'],
        });
      }

      const result = repository.list({ applicationId, limit, cursor });
      if (!isAdmin(role) && result.ownerUserId && result.ownerUserId !== userId) {
        return json(403, { error: 'forbidden' });
      }

      return json(200, {
        items: result.items.map((event) => {
          const safeEvent = { ...event };
          delete safeEvent.ownerUserId;
          return safeEvent;
        }),
        nextCursor: result.nextCursor,
        total: result.total,
        dataVersion: result.dataVersion,
      });
    }

    const errors = validateApplicationEventRequest(body);
    if (errors.length > 0) {
      return json(400, { error: 'validation_failed', details: errors });
    }

    const sourceType = safeString(body.sourceType, 40);
    if (OFFICIAL_SOURCES.has(sourceType) && !isAdmin(role)) {
      return json(403, {
        error: 'forbidden',
        details: ['Official events can only be appended by an authorised reviewer.'],
      });
    }

    const applicationId = safeString(body.applicationId, 120).toUpperCase();
    const existing = repository.list({ applicationId, limit: 1, cursor: 0 });
    if (!isAdmin(role) && existing.ownerUserId && existing.ownerUserId !== userId) {
      return json(403, { error: 'forbidden' });
    }

    const event = normalizeRequestedEvent(body, userId, role);
    const result = repository.create(event);

    if (result.status === 'duplicate') {
      return json(409, {
        error: 'duplicate_event',
        details: ['An identical event record already exists; events are never overwritten.'],
        eventId: result.event.eventId,
      });
    }

    if (result.event.isOfficial && typeof repository.audit === 'function') {
      repository.audit({
        action: 'OFFICIAL_APPLICATION_EVENT_APPENDED',
        actorUserId: userId,
        actorRole: role,
        applicationId: result.event.applicationId,
        eventId: result.event.eventId,
        sourceType: result.event.sourceType,
        sourceTimestamp: result.event.sourceTimestamp,
      });
    }

    const safeEvent = { ...result.event };
    delete safeEvent.ownerUserId;
    return json(201, { ok: true, event: safeEvent });
  };
};
