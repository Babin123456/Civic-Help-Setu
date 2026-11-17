/**
 * api/_lib/handlers/ghg-inventory.js
 * Server-side boundary for municipal greenhouse-gas activity submissions (#753).
 *
 * The browser workspace is the primary review surface. This endpoint is the server-side
 * write boundary for department clients and enforces, in order:
 *   1. HTTP method and payload size;
 *   2. Clerk session verification (injected so the rule can be tested without a network);
 *   3. operator/administrator role and jurisdiction scope from verified claims only;
 *   4. strict schema, unit, file-metadata and PII validation;
 *   5. rate limiting and durable atomic idempotency with conflict detection;
 *   6. shared database persistence via the GHG repository.
 *
 * It never returns another department's records and never publishes unapproved data.
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';
import {
  ACTIVITY_UNITS,
  ALLOWED_SOURCE_DOCUMENT_TYPES,
  DATA_QUALITY,
  GHG_LIMITS,
} from '../../../src/services/ghgInventoryConstants.js';
import {
  findPersonalData,
  sanitizeText,
} from '../../../src/services/ghgInventoryValidation.js';
import {
  createGhgMemoryRepository,
  hashGhgSubmissionPayload,
} from '../ghgInventoryRepository.js';

const defaultSharedMemoryRepository = createGhgMemoryRepository();
const MAX_BODY_BYTES = 256 * 1024;

const ERROR_HELP = {
  authentication_required: 'Send a valid municipal staff session token in the Authorization header.',
  auth_not_configured: 'The server-side sign-in verifier is not configured. Use the municipal workspace or configure Clerk.',
  invalid_token: 'The staff session has expired. Sign in again.',
  forbidden_role: 'Only an operator or administrator may submit department activity data.',
  jurisdiction_forbidden: 'Your account is not assigned to this jurisdiction.',
  validation_failed: 'Correct the listed fields and retry with the same idempotency key.',
  payload_too_large: 'Reduce the submission size; document contents are never accepted.',
  rate_limited: 'Too many submissions. Wait for the retry window.',
  method_not_allowed: 'Use GET for published totals or POST for a department submission.',
  replayed: 'This idempotency key was already received; the original receipt is returned.',
  idempotency_conflict: 'This idempotency key was already used with a different activity payload. Use a new idempotency key.',
  database_unavailable: 'The submission could not be persisted to shared storage. Try again later.',
};

const fail = (status, code, details = null, extraHeaders = {}) => ({
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  body: {
    ok: false,
    error: code,
    help: ERROR_HELP[code] || 'The request could not be completed.',
    ...(details ? { details } : {}),
  },
});

const bearerToken = (headers = {}) => {
  const key = Object.keys(headers).find((name) => name.toLowerCase() === 'authorization');
  const value = key ? headers[key] : '';
  const match = typeof value === 'string' ? /^Bearer ([A-Za-z0-9._~+/=-]{10,4096})$/.exec(value.trim()) : null;
  return match ? match[1] : null;
};

const utf8Bytes = (value) => new TextEncoder().encode(value).length;

const bodySize = (body) => {
  if (body == null) return 0;
  if (typeof body === 'string') return utf8Bytes(body);
  try {
    return utf8Bytes(JSON.stringify(body));
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
};

const forbiddenDocumentFields = ['file', 'fileData', 'base64', 'content', 'documentData', 'buffer'];

/**
 * Pure payload validator. Exported so unit tests can exercise every rejection branch.
 */
export const validateGhgSubmissionPayload = (body, actor = null) => {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  if (bodySize(body) > MAX_BODY_BYTES) {
    return [`Request body exceeds ${MAX_BODY_BYTES} bytes. Uploaded documents are not accepted; send metadata only.`];
  }

  const periodId = sanitizeText(body.periodId, 100);
  if (!periodId) errors.push('periodId is required.');
  const jurisdictionId = sanitizeText(body.jurisdictionId, 40).toUpperCase();
  if (!/^[A-Z0-9-]{2,40}$/.test(jurisdictionId)) {
    errors.push('jurisdictionId must be a stable code such as WARD-042.');
  }

  const department = sanitizeText(body.department, 120);
  if (department.length < 3) errors.push('department must be at least 3 characters.');
  const title = sanitizeText(body.title, 160);
  if (title.length < 5) errors.push('title must be at least 5 characters.');

  const idempotencyKey = sanitizeText(body.idempotencyKey, 128);
  if (idempotencyKey.length < 8) {
    errors.push('idempotencyKey of at least 8 characters is required to prevent duplicate submissions.');
  }

  if (!Array.isArray(body.records) || body.records.length === 0) {
    errors.push('records must contain at least one activity record.');
  } else if (body.records.length > GHG_LIMITS.MAX_RECORDS_PER_SUBMISSION) {
    errors.push(`records may contain at most ${GHG_LIMITS.MAX_RECORDS_PER_SUBMISSION} rows.`);
  } else {
    const seenSources = new Set();
    body.records.forEach((record, index) => {
      const row = `records[${index}]`;
      if (!record || typeof record !== 'object') {
        errors.push(`${row} must be an object.`);
        return;
      }
      if (!record.sourceId || typeof record.sourceId !== 'string') {
        errors.push(`${row}.sourceId is required.`);
      } else if (seenSources.has(record.sourceId)) {
        errors.push(`${row}.sourceId repeats a source; combine values to prevent double counting.`);
      } else {
        seenSources.add(record.sourceId);
      }
      const quantity = typeof record.quantity === 'string' ? Number(record.quantity) : record.quantity;
      if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) {
        errors.push(`${row}.quantity must be a non-negative number.`);
      } else if (quantity > GHG_LIMITS.MAX_QUANTITY) {
        errors.push(`${row}.quantity exceeds the supported range.`);
      }
      if (!ACTIVITY_UNITS[record.unit]) {
        errors.push(`${row}.unit must be one of: ${Object.keys(ACTIVITY_UNITS).join(', ')}.`);
      }
      if (!Object.values(DATA_QUALITY).includes(record.dataQuality)) {
        errors.push(`${row}.dataQuality must be measured, estimated or excluded.`);
      }
      if (record.sourceDocument) {
        if (forbiddenDocumentFields.some((field) => record.sourceDocument[field] != null)) {
          errors.push(`${row}.sourceDocument must contain metadata only; file contents are not accepted.`);
        }
        if (
          record.sourceDocument.mimeType &&
          !ALLOWED_SOURCE_DOCUMENT_TYPES.includes(record.sourceDocument.mimeType)
        ) {
          errors.push(`${row}.sourceDocument.mimeType must be PDF, CSV or XLSX.`);
        }
        if (
          record.sourceDocument.sizeBytes != null &&
          (!Number.isFinite(Number(record.sourceDocument.sizeBytes)) ||
            Number(record.sourceDocument.sizeBytes) < 0 ||
            Number(record.sourceDocument.sizeBytes) > GHG_LIMITS.MAX_PDF_BYTES)
        ) {
          errors.push(`${row}.sourceDocument.sizeBytes is outside the allowed range.`);
        }
      }
    });
  }

  const freeText = [title, body.department, body.correctionNotes, body.reviewNotes, body.reason]
    .filter(Boolean)
    .join(' ');
  const findings = findPersonalData(freeText);
  if (findings.length) {
    errors.push(`Submission notes appear to contain ${findings.join(', ')}. Remove personal identifiers.`);
  }

  // Document content must not travel in any undeclared field.
  if (body.attachment || body.upload || body.documentContent) {
    errors.push('Attachments are not accepted. Send only document name, type, size and hash metadata.');
  }

  if (actor) {
    const roles = [actor.ghgRole, actor.role].filter(Boolean);
    if (!roles.some((role) => role === 'operator' || role === 'admin')) {
      errors.push('Verified role must be operator or administrator.');
    }
    const assigned = Array.isArray(actor.jurisdictionIds)
      ? actor.jurisdictionIds.map((item) => String(item).toUpperCase())
      : [];
    const isAdminAll = actor.role === 'admin' && assigned.length === 0;
    if (!isAdminAll && !assigned.includes(jurisdictionId)) {
      errors.push('Verified account is not assigned to the submitted jurisdiction.');
    }
  }

  return errors;
};

export const generateGhgReceiptCode = (jurisdictionId, idempotencyKey, receivedAt) => {
  const seed = `${jurisdictionId}|${idempotencyKey}|${receivedAt}|GHG_ACTIVITY_RECEIPT`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  return `GHG-${(unsigned & 0xffff).toString(16).toUpperCase().padStart(4, '0')}-${(
    (unsigned >>> 16) &
    0xffff
  )
    .toString(16)
    .toUpperCase()
    .padStart(4, '0')}`;
};

export function createGhgInventoryHandler({
  verifySession = null,
  resolveActor = null,
  getPublishedSummary = null,
  repository = null,
  ipLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 }),
} = {}) {
  const singleFlight = createSingleFlight();
  const repo = repository || defaultSharedMemoryRepository;

  return async function handle({ method, headers = {}, body = null, query = {} }) {
    if (method === 'GET') {
      if (typeof getPublishedSummary !== 'function') {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          body: {
            ok: true,
            available: false,
            disclosure:
              'No approved inventory is published through this deployment. Public totals are produced by the municipal workspace after a reviewer approves the period.',
          },
        };
      }
      try {
        const summary = await getPublishedSummary({
          periodId: query.periodId || null,
          jurisdictionId: String(query.jurisdictionId || 'WARD-042').toUpperCase(),
        });
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          body: { ok: true, ...summary },
        };
      } catch {
        return fail(404, 'not_found');
      }
    }

    if (method !== 'POST') {
      return fail(405, 'method_not_allowed', null, { Allow: 'GET, POST' });
    }

    if (bodySize(body) > MAX_BODY_BYTES) {
      return fail(413, 'payload_too_large');
    }

    const ip =
      headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() ||
      headers['x-forwarded-for'] ||
      headers['x-real-ip'] ||
      'unknown';
    const verdict = ipLimiter.take(ip);
    if (!verdict.allowed) {
      return fail(429, 'rate_limited', { retryAfterSeconds: verdict.retryAfterSeconds }, {
        'Retry-After': String(verdict.retryAfterSeconds),
      });
    }

    if (typeof verifySession !== 'function' || typeof resolveActor !== 'function') {
      return fail(503, 'auth_not_configured');
    }
    const token = bearerToken(headers);
    if (!token) return fail(401, 'authentication_required');

    let verified;
    try {
      verified = await verifySession(token);
    } catch {
      return fail(401, 'invalid_token');
    }
    if (!verified || typeof verified.userId !== 'string' || !verified.userId) {
      return fail(401, 'invalid_token');
    }

    let actor;
    try {
      actor = await resolveActor(verified.userId);
    } catch {
      return fail(401, 'invalid_token');
    }
    if (!actor || typeof actor !== 'object') return fail(401, 'invalid_token');

    let payload = body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return fail(400, 'validation_failed', ['Malformed JSON payload.']);
      }
    }

    const errors = validateGhgSubmissionPayload(payload, actor);
    if (errors.length) {
      const roleError = errors.find((message) => message.startsWith('Verified role'));
      const jurisdictionError = errors.find((message) =>
        message.startsWith('Verified account is not assigned')
      );
      if (roleError) return fail(403, 'forbidden_role', errors);
      if (jurisdictionError) return fail(403, 'jurisdiction_forbidden', errors);
      return fail(422, 'validation_failed', errors);
    }

    const payloadHash = hashGhgSubmissionPayload(payload);
    const flightKey = `${payload.jurisdictionId.toUpperCase()}:${payload.idempotencyKey}`;

    return singleFlight.run(flightKey, async () => {
      const receivedAt = new Date().toISOString();
      const submissionId = `ghg_sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const receipt = {
        submissionId,
        idempotencyKey: sanitizeText(payload.idempotencyKey, 128),
        jurisdictionId: payload.jurisdictionId.toUpperCase(),
        periodId: sanitizeText(payload.periodId, 100),
        status: 'queued_for_review',
        recordCount: payload.records.length,
        receivedAt,
        receiptCode: generateGhgReceiptCode(
          payload.jurisdictionId.toUpperCase(),
          payload.idempotencyKey,
          receivedAt
        ),
      };

      const submissionRecord = {
        ...receipt,
        department: sanitizeText(payload.department, 120),
        title: sanitizeText(payload.title, 160),
        // Keep only the validated values; no document contents, tokens or actor contacts.
        records: payload.records.map((record) => ({
          sourceId: sanitizeText(record.sourceId, 100),
          quantity: Number(record.quantity),
          unit: record.unit,
          dataQuality: record.dataQuality,
          correctionNotes: sanitizeText(record.correctionNotes, GHG_LIMITS.MAX_NOTE_LENGTH),
          sourceDocument: record.sourceDocument
            ? {
                name: sanitizeText(record.sourceDocument.name, 160),
                mimeType: record.sourceDocument.mimeType || 'application/pdf',
                sizeBytes:
                  record.sourceDocument.sizeBytes != null
                    ? Number(record.sourceDocument.sizeBytes)
                    : null,
                sha256:
                  typeof record.sourceDocument.sha256 === 'string'
                    ? record.sourceDocument.sha256.toLowerCase()
                    : null,
                storage: 'metadata_only',
              }
            : null,
        })),
        verifiedRole: actor.ghgRole || actor.role,
      };

      let recordResult;
      try {
        recordResult = await repo.recordSubmission({
          submission: submissionRecord,
          receipt,
          idempotencyKey: payload.idempotencyKey,
          jurisdictionId: payload.jurisdictionId,
          payloadHash,
          actorId: actor.id,
        });
      } catch (error) {
        return fail(503, 'database_unavailable', error?.message || null);
      }

      if (recordResult.status === 'conflict') {
        return fail(409, 'idempotency_conflict');
      }

      if (recordResult.status === 'replayed') {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          body: {
            ok: true,
            replayed: true,
            help: ERROR_HELP.replayed,
            receipt: recordResult.receipt,
          },
        };
      }

      return {
        status: 202,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: {
          ok: true,
          help: 'Activity data is queued for municipal review. It does not affect published totals until a reviewer approves it.',
          receipt: recordResult.receipt,
        },
      };
    });
  };
}

export const resetGhgRepositoryForTests = () => {
  defaultSharedMemoryRepository.clear();
};

export const resetGhgSubmissionQueueForTests = resetGhgRepositoryForTests;

let defaultHandler = null;
let defaultHandlerError = null;

export async function buildDefaultHandler() {
  /* global process */
  const { CLERK_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT } = process.env || {};
  if (!CLERK_SECRET_KEY) return null;
  const { verifyToken, createClerkClient } = await import('@clerk/backend');
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  let repository = null;
  if (FIREBASE_SERVICE_ACCOUNT) {
    const { getFirestoreAdmin } = await import('../firebaseAdmin.js');
    const firestore = await getFirestoreAdmin();
    if (firestore) {
      const { createGhgFirestoreRepository } = await import('../ghgInventoryRepository.js');
      repository = createGhgFirestoreRepository({ firestore });
    }
  }

  const { getPublicInventorySummary } = await import('../../../src/services/ghgInventoryService.js');

  return createGhgInventoryHandler({
    verifySession: async (token) => {
      const claims = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
      return { userId: claims.sub };
    },
    resolveActor: async (userId) => {
      const user = await clerk.users.getUser(userId);
      const metadata = user.publicMetadata || {};
      return {
        id: userId,
        role: metadata.role || 'citizen',
        ghgRole: metadata.ghgRole || metadata.inventoryRole || null,
        jurisdictionIds: Array.isArray(metadata.jurisdictionIds)
          ? metadata.jurisdictionIds
          : metadata.jurisdictionId
            ? [metadata.jurisdictionId]
            : [],
      };
    },
    getPublishedSummary: getPublicInventorySummary,
    repository,
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!defaultHandler && !defaultHandlerError) {
      defaultHandler = await buildDefaultHandler();
    }
  } catch (error) {
    defaultHandlerError = error;
    defaultHandler = null;
  }
  const route =
    defaultHandler ||
    createGhgInventoryHandler({
      getPublishedSummary: async (params) => {
        const { getPublicInventorySummary } = await import('../../../src/services/ghgInventoryService.js');
        return getPublicInventorySummary(params);
      },
    });
  const result = await route({
    method: req.method,
    headers: req.headers,
    body: req.body,
    query: req.query || {},
  });
  for (const [name, value] of Object.entries(result.headers || {})) res.setHeader(name, value);
  return res.status(result.status).json(result.body);
}
