/**
 * api/_lib/handlers/catalogue-visual-qa.js
 * Server endpoint for the civic service catalogue visual QA workspace (#841).
 *
 * Invariants:
 *  - Synthetic fixtures only. Production catalogue content and citizen records are refused.
 *  - Strict, structured request validation on the server even though the client validates first.
 *  - Paginated scans; a scan never loads the whole catalogue.
 *  - Role-based authorization. In production the role comes from a verified Clerk session,
 *    never from an x-user-role request header. The header fallback exists only for local
 *    development and automated tests where no Clerk secret is configured.
 *  - No provider credentials, tokens or citizen data are returned or logged.
 */

/* global process */
import { createRateLimiter, clientKey } from '../abuseGuard.js';
import { bearerToken } from '../firebaseToken.js';
import { resolveRole } from '../../../src/services/roleService.js';
import { SERVICE_CATEGORIES } from '../../../src/data/serviceCategories.js';
import {
  CONTENT_LENGTHS,
  DEFAULT_FILTERS,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_SEED,
  VIEWPORT_IDS,
  buildReviewSnapshot,
  containsCitizenData,
  hashString,
  normalizeFilters,
  runVisualQaScan,
  validateVisualQaFilters,
} from '../../../src/services/catalogueVisualQaService.js';

const rateLimiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

const ACTION_SCAN = 'scan';
const ACTION_METADATA = 'metadata';
const ACTION_EXPORT = 'export-snapshot';
const ACTION_CONFIRM = 'confirm-suggestion';
const ALLOWED_POST_ACTIONS = [ACTION_EXPORT, ACTION_CONFIRM];

const PRODUCTION_CONTENT_KEYS = [
  'services',
  'catalogue',
  'serviceRecords',
  'productionContent',
  'productionCatalogue',
  'records',
];

const json = (status, body, extra = {}) => ({
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  },
  body,
});

const failure = (status, code, message, fields = []) =>
  json(status, {
    error: {
      code,
      message,
      ...(fields.length > 0 ? { fields } : {}),
    },
  });

const getHeader = (headers = {}, name) => {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
};

const stripControlCharacters = (text) =>
  [...text]
    .filter((char) => {
      const code = char.codePointAt(0);
      return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
    })
    .join('');

const sanitizeText = (value, maxLength = 300) => {
  if (typeof value !== 'string') return '';
  return stripControlCharacters(value.replace(/<[^>]*>/g, '')).trim().slice(0, maxLength);
};

async function resolveReviewer(req) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (secretKey) {
    const sessionToken = bearerToken(req.headers || {});
    if (!sessionToken) {
      return { ok: false, response: failure(401, 'ERR_AUTH_REQUIRED', 'A signed-in reviewer is required.') };
    }
    try {
      const { verifyToken, createClerkClient } = await import('@clerk/backend');
      const claims = await verifyToken(sessionToken, { secretKey });
      const clerk = createClerkClient({ secretKey });
      const user = await clerk.users.getUser(claims.sub);
      const role = resolveRole(user.publicMetadata);
      if (role !== 'admin') {
        return { ok: false, response: failure(403, 'ERR_UNAUTHORIZED', 'Only an authorized reviewer can use this workspace.') };
      }
      return { ok: true, userId: claims.sub, role };
    } catch {
      return { ok: false, response: failure(401, 'ERR_INVALID_SESSION', 'The reviewer session could not be verified.') };
    }
  }

  if (isProduction) {
    return {
      ok: false,
      response: failure(503, 'ERR_AUTH_NOT_CONFIGURED', 'Reviewer authentication is not configured on this deployment.'),
    };
  }

  // Development and test only: no Clerk secret is configured, so accept an explicit
  // synthetic reviewer header. Production never reaches this branch.
  const role = sanitizeText(getHeader(req.headers, 'x-user-role'), 20).toLowerCase();
  if (!role) {
    return { ok: false, response: failure(401, 'ERR_AUTH_REQUIRED', 'A reviewer role is required.') };
  }
  if (role !== 'admin') {
    return { ok: false, response: failure(403, 'ERR_UNAUTHORIZED', 'Only an authorized reviewer can use this workspace.') };
  }
  return { ok: true, userId: sanitizeText(getHeader(req.headers, 'x-user-id'), 80) || 'dev-reviewer', role };
}

const readSingle = (value) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') return value[0];
  return null;
};

const readViewportIds = (value) => {
  if (value === undefined || value === null) return undefined;
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map((entry) => String(entry).trim()).filter(Boolean);
};

const readInteger = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
  if (typeof value === 'string' && /^\d{1,10}$/.test(value.trim())) return Number(value);
  return NaN;
};

/**
 * Strictly reads filters. Unlike the client query parser, an unknown filter value
 * is an error rather than a silent fallback.
 */
export function readAndValidateFilters(source = {}) {
  const errors = [];
  const filters = {
    category: source.category ?? source.cat ?? DEFAULT_FILTERS.category,
    language: source.language ?? source.lang ?? DEFAULT_FILTERS.language,
    contentLength: source.contentLength ?? source.length ?? DEFAULT_FILTERS.contentLength,
    seed: readInteger(source.seed, DEFAULT_FILTERS.seed),
    page: readInteger(source.page, DEFAULT_FILTERS.page),
    pageSize: readInteger(source.pageSize, DEFAULT_FILTERS.pageSize),
    viewportIds: readViewportIds(source.viewportIds ?? source.viewport ?? source.view),
  };
  if (filters.viewportIds === undefined) filters.viewportIds = [...VIEWPORT_IDS];

  if (typeof filters.category !== 'string' || (filters.category !== 'All' && !SERVICE_CATEGORIES.includes(filters.category))) {
    errors.push({ field: 'category', reason: `must be "All" or one of: ${SERVICE_CATEGORIES.join(', ')}` });
  }
  if (typeof filters.language !== 'string' || !['en', 'hi', 'bn', 'ta'].includes(filters.language)) {
    errors.push({ field: 'language', reason: 'must be one of: en, hi, bn, ta' });
  }
  if (typeof filters.contentLength !== 'string' || !CONTENT_LENGTHS.includes(filters.contentLength)) {
    errors.push({ field: 'contentLength', reason: `must be one of: ${CONTENT_LENGTHS.join(', ')}` });
  }
  if (!Number.isInteger(filters.seed) || filters.seed < 0 || filters.seed > MAX_SEED) {
    errors.push({ field: 'seed', reason: `must be a whole number from 0 to ${MAX_SEED}` });
  }
  if (!Number.isInteger(filters.page) || filters.page < 1 || filters.page > MAX_PAGE) {
    errors.push({ field: 'page', reason: `must be a whole number from 1 to ${MAX_PAGE}` });
  }
  if (!Number.isInteger(filters.pageSize) || filters.pageSize < 1 || filters.pageSize > MAX_PAGE_SIZE) {
    errors.push({ field: 'pageSize', reason: `must be a whole number from 1 to ${MAX_PAGE_SIZE}` });
  }
  errors.push(
    ...validateVisualQaFilters({
      category: filters.category,
      language: filters.language,
      contentLength: filters.contentLength,
      seed: filters.seed,
      page: filters.page,
      pageSize: filters.pageSize,
      viewportIds: filters.viewportIds,
    })
  );

  // Remove duplicates between the local checks and the shared validator while keeping field context.
  const unique = [...new Map(errors.map((entry) => [`${entry.field}:${entry.reason}`, entry])).values()];
  return { filters: normalizeFilters(filters), errors: unique };
}

const validateDecisionMap = (value) => {
  if (value === undefined) return { decisions: {}, errors: [] };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decisions: {}, errors: [{ field: 'decisions', reason: 'must be an object keyed by suggestion id' }] };
  }
  const decisions = {};
  const errors = [];
  for (const [key, decision] of Object.entries(value)) {
    if (!/^[a-z0-9][a-z0-9-]{2,120}$/.test(key)) {
      errors.push({ field: `decisions.${key}`, reason: 'must be a synthetic suggestion id' });
      continue;
    }
    if (decision !== 'confirmed' && decision !== 'rejected') {
      errors.push({ field: `decisions.${key}`, reason: 'must be confirmed or rejected' });
      continue;
    }
    decisions[key] = decision;
  }
  return { decisions, errors };
};

const auditReceipt = (scanRunId, action, role) =>
  `VQA-${hashString(`${scanRunId}:${action}:${role}`).toString(16).padStart(8, '0').toUpperCase()}`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'ERR_METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const address = clientKey(req.headers || {});
  if (address) {
    const limit = rateLimiter.take(address);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({
        error: {
          code: 'ERR_RATE_LIMIT',
          message: 'Too many visual QA requests. Please wait before trying again.',
          retryAfterSeconds: limit.retryAfterSeconds,
        },
      });
    }
  }

  const reviewer = await resolveReviewer(req);
  if (!reviewer.ok) {
    const { status, body, headers } = reviewer.response;
    for (const [name, value] of Object.entries(headers || {})) res.setHeader(name, value);
    return res.status(status).json(body);
  }

  if (req.method === 'GET') {
    const action = readSingle(req.query?.action) || ACTION_SCAN;
    if (action !== ACTION_SCAN && action !== ACTION_METADATA) {
      return res.status(400).json(
        failure(400, 'ERR_INVALID_ACTION', 'Unknown action.', [{ field: 'action', reason: `must be ${ACTION_SCAN} or ${ACTION_METADATA}` }]).body
      );
    }

    if (action === ACTION_METADATA) {
      return res.status(200).json({
        data: {
          schemaVersion: 'civic-catalogue-visual-qa/v1',
          componentVersion: 'catalogue-service-card@1.0.0',
          dataVersion: 'service-schema-v1',
          categories: ['All', ...SERVICE_CATEGORIES],
          languages: ['en', 'hi', 'bn', 'ta'],
          contentLengths: CONTENT_LENGTHS,
          viewports: VIEWPORT_IDS,
          pageSize: { default: DEFAULT_FILTERS.pageSize, max: MAX_PAGE_SIZE },
          syntheticOnly: true,
        },
      });
    }

    const { filters, errors } = readAndValidateFilters(req.query || {});
    if (errors.length > 0) {
      return res.status(400).json(
        failure(400, 'ERR_INVALID_QUERY', 'The visual QA query is not valid.', errors).body
      );
    }

    try {
      const report = runVisualQaScan(filters);
      return res.status(200).json({
        data: report,
        meta: {
          syntheticOnly: true,
          containsCitizenData: false,
          productionContentIncluded: false,
          servedBy: 'catalogue-visual-qa-api',
        },
      });
    } catch (error) {
      if (error?.code === 'ERR_INVALID_FILTERS') {
        return res.status(400).json(
          failure(400, 'ERR_INVALID_QUERY', 'The visual QA query is not valid.', error.fields || []).body
        );
      }
      return res.status(500).json(
        failure(500, 'ERR_SCAN_FAILED', 'The visual QA scan could not be completed.').body
      );
    }
  }

  // POST
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json(
        failure(400, 'ERR_MALFORMED_JSON', 'The request body must be valid JSON.').body
      );
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json(
      failure(400, 'ERR_INVALID_BODY', 'The request body must be a JSON object.').body
    );
  }

  if (Object.keys(body).some((key) => PRODUCTION_CONTENT_KEYS.includes(key))) {
    return res.status(400).json(
      failure(
        400,
        'ERR_PRODUCTION_CONTENT_PROHIBITED',
        'Production catalogue content cannot be submitted to the fixture workspace.'
      ).body
    );
  }

  if (containsCitizenData(body)) {
    return res.status(400).json(
      failure(
        400,
        'ERR_PII_PROHIBITED',
        'Citizen identifiers, contact details and credentials are not accepted by this endpoint.'
      ).body
    );
  }

  const action = sanitizeText(body.action, 40);
  if (!ALLOWED_POST_ACTIONS.includes(action)) {
    return res.status(400).json(
      failure(400, 'ERR_INVALID_ACTION', 'Unknown action.', [
        { field: 'action', reason: `must be one of: ${ALLOWED_POST_ACTIONS.join(', ')}` },
      ]).body
    );
  }

  if (action === ACTION_EXPORT) {
    const { filters, errors } = readAndValidateFilters(body.filters || {});
    const decisionsCheck = validateDecisionMap(body.decisions);
    const allErrors = [...errors, ...decisionsCheck.errors];
    if (allErrors.length > 0) {
      return res.status(400).json(
        failure(400, 'ERR_INVALID_FILTERS', 'The snapshot filters are not valid.', allErrors).body
      );
    }
    const report = runVisualQaScan({ ...filters, decisions: decisionsCheck.decisions });
    const snapshot = buildReviewSnapshot(report, {
      now: new Date(),
      reviewerRole: reviewer.role,
      decisions: decisionsCheck.decisions,
    });
    return res.status(200).json({
      data: {
        snapshot,
        audit: {
          receipt: auditReceipt(report.scanRunId, ACTION_EXPORT, reviewer.role),
          action: 'CATALOGUE_VISUAL_QA_SNAPSHOT_EXPORTED',
          actorRole: reviewer.role,
          scanRunId: report.scanRunId,
          at: new Date().toISOString(),
          containsCitizenData: false,
        },
      },
    });
  }

  // confirm-suggestion
  const fixtureId = sanitizeText(body.fixtureId, 120);
  const suggestionId = sanitizeText(body.suggestionId, 160);
  const decision = sanitizeText(body.decision, 20);
  const reviewerNote = sanitizeText(body.reviewerNote, 300);

  const errors = [];
  if (!/^qa-sample-[a-z0-9-]{2,110}$/.test(fixtureId)) {
    errors.push({ field: 'fixtureId', reason: 'must be a synthetic qa-sample- fixture id' });
  }
  if (!/^qa-sample-[a-z0-9-]{2,150}-title$/.test(suggestionId)) {
    errors.push({ field: 'suggestionId', reason: 'must be a synthetic fixture title suggestion id' });
  }
  if (decision !== 'confirmed' && decision !== 'rejected') {
    errors.push({ field: 'decision', reason: 'must be confirmed or rejected' });
  }
  if (reviewerNote && reviewerNote.length < 4) {
    errors.push({ field: 'reviewerNote', reason: 'when present must be at least 4 characters' });
  }
  if (errors.length > 0) {
    return res.status(400).json(
      failure(400, 'ERR_INVALID_SUGGESTION_DECISION', 'The suggestion decision is not valid.', errors).body
    );
  }

  return res.status(200).json({
    data: {
      fixtureId,
      suggestionId,
      status: decision,
      reviewedByRole: reviewer.role,
      reviewedAt: new Date().toISOString(),
      noteStored: false,
      fixtureOnly: true,
      audit: {
        receipt: auditReceipt(`${fixtureId}:${suggestionId}`, decision, reviewer.role),
        action: decision === 'confirmed' ? 'VISUAL_QA_SUGGESTION_CONFIRMED' : 'VISUAL_QA_SUGGESTION_REJECTED',
        actorRole: reviewer.role,
        at: new Date().toISOString(),
        containsCitizenData: false,
      },
    },
  });
}

export const __test__ = {
  readAndValidateFilters,
  validateDecisionMap,
};
