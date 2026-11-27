/**
 * api/_lib/handlers/complaint-quality-coach.js
 *
 * Serverless API handler for the Agentic Civic Complaint Quality and Completeness Coach (#1190).
 *
 * Implements:
 * - Rate limiting per client.
 * - Deterministic validation at the trust boundary.
 * - PII scrubbed before response synthesis.
 * - Strict error contracts and status codes.
 * - Provenance metadata attached to all suggestions.
 */

import { createRateLimiter, clientKey } from '../abuseGuard.js';
import {
  analyzeComplaintQuality,
  validateComplaintInput,
  ERROR_CODES,
} from '../../../src/services/complaintQualityCoachService.js';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_CATEGORY_LABELS,
  SYNTHETIC_COMPLAINT_FIXTURES,
} from '../../../src/data/complaintQualityContract.js';

const addressLimiter = createRateLimiter({ limit: 40, windowMs: 60 * 1000 });

const json = (status, body, extra = {}) => ({
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extra,
  },
  body,
});

export default async function handler(req) {
  const method = (req.method || 'GET').toUpperCase();

  // Rate Limiting
  const ip = clientKey(req);
  const rateLimitResult = addressLimiter.take(ip);
  if (!rateLimitResult.allowed) {
    return json(429, {
      error: {
        code: 'CQC_RATE_LIMITED',
        message: 'Too many requests. Please slow down and try again shortly.',
        retryAfter: rateLimitResult.retryAfterSeconds,
      },
    });
  }

  if (method === 'GET') {
    // Provide catalogue of supported complaint categories and synthetic fixtures
    const action = req.query?.action || 'catalogue';

    if (action === 'catalogue') {
      return json(200, {
        categories: Object.keys(COMPLAINT_CATEGORIES).map((key) => ({
          id: key,
          label: COMPLAINT_CATEGORY_LABELS[key],
        })),
        fixtures: SYNTHETIC_COMPLAINT_FIXTURES.map((f) => ({
          id: f.id,
          name: f.name,
          category: f.category,
          language: f.language,
        })),
      });
    }

    if (action === 'fixture') {
      const fixtureId = req.query?.fixtureId;
      const fixture = SYNTHETIC_COMPLAINT_FIXTURES.find((f) => f.id === fixtureId);
      if (!fixture) {
        return json(404, {
          error: {
            code: 'CQC_FIXTURE_NOT_FOUND',
            message: `Synthetic fixture '${fixtureId}' not found.`,
          },
        });
      }
      return json(200, { fixture });
    }

    return json(400, {
      error: {
        code: ERROR_CODES.INVALID_INPUT,
        message: `Unknown action: '${action}'. Supported: 'catalogue', 'fixture'.`,
      },
    });
  }

  if (method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return json(400, {
          error: {
            code: ERROR_CODES.INVALID_INPUT,
            message: 'Malformed JSON payload.',
          },
        });
      }
    }

    if (!body || typeof body !== 'object') {
      return json(400, {
        error: {
          code: ERROR_CODES.INVALID_INPUT,
          message: 'Request body must be a valid JSON object.',
        },
      });
    }

    const { action = 'analyze', ...payload } = body;

    if (action === 'analyze') {
      const validation = validateComplaintInput(payload);
      if (!validation.isValid) {
        return json(400, {
          error: {
            code: ERROR_CODES.INVALID_INPUT,
            message: 'Validation failed for complaint inputs.',
            errors: validation.errors,
          },
        });
      }

      const result = analyzeComplaintQuality(payload);
      if (!result.success) {
        if (result.errorCode === ERROR_CODES.PROMPT_INJECTION_DETECTED) {
          return json(400, {
            error: {
              code: result.errorCode,
              message: result.error,
              details: result.injectionDetails,
            },
          });
        }
        return json(400, {
          error: {
            code: result.errorCode || ERROR_CODES.INVALID_INPUT,
            message: result.errors?.join(', ') || 'Complaint analysis failed.',
          },
        });
      }

      return json(200, { analysis: result });
    }

    return json(400, {
      error: {
        code: ERROR_CODES.INVALID_INPUT,
        message: `Unknown action: '${action}'. Supported: 'analyze'.`,
      },
    });
  }

  return json(405, {
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP ${method} is not supported. Allowed: GET, POST.`,
    },
  });
}
