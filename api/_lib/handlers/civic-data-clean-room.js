/**
 * api/_lib/handlers/civic-data-clean-room.js
 * Server-side endpoint for Privacy-Safe Civic Data Clean Room (#1164)
 *
 * Implements:
 * - Rate limiting & single-flight deduplication via abuseGuard
 * - Zero PII scanner (blocks Aadhaar, PAN, phone numbers)
 * - Isolated aggregate-only query execution
 * - Data Steward human-in-the-loop governance
 * - Differential privacy & k-anonymity budget enforcement
 */

import { createRateLimiter, createSingleFlight } from '../abuseGuard.js';
import { CleanRoomService } from '../../../src/services/cleanRoomService.js';
import { CLEAN_ROOM_ERROR_CODES } from '../../../src/data/cleanRoomContract.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /(?:(?:\+91|0)?[6-9]\d{9})/;
const FORBIDDEN_WORDS = ['password', 'secret', 'private_key', 'raw_citizen_export'];

export function scanPayloadForPii(obj) {
  const serialized = JSON.stringify(obj).toLowerCase();
  const violations = [];

  if (AADHAAR_REGEX.test(serialized)) {
    violations.push('Aadhaar number detected');
  }
  if (PAN_REGEX.test(serialized)) {
    violations.push('PAN number detected');
  }
  if (PHONE_REGEX.test(serialized)) {
    violations.push('Contact phone number detected');
  }
  for (const forbidden of FORBIDDEN_WORDS) {
    if (serialized.includes(forbidden)) {
      violations.push(`Forbidden token '${forbidden}' detected`);
    }
  }

  return {
    hasPii: violations.length > 0,
    violations,
  };
}

export default async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Type', 'application/json');

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const rate = rateLimiter.take(ip);
  if (!rate.allowed) {
    res.setHeader('Retry-After', rate.retryAfterSeconds);
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many clean room requests. Please retry later.',
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  // Handle GET Requests
  if (req.method === 'GET') {
    const action = req.query?.action || 'workspaces';

    switch (action) {
      case 'workspaces': {
        const workspaces = CleanRoomService.listWorkspaces();
        return res.status(200).json({ success: true, workspaces });
      }
      case 'templates': {
        const templates = CleanRoomService.listTemplates();
        return res.status(200).json({ success: true, templates });
      }
      case 'datasets': {
        const datasets = CleanRoomService.listDatasets();
        return res.status(200).json({ success: true, datasets });
      }
      case 'audit-logs': {
        const auditLogs = CleanRoomService.getAuditLogs();
        return res.status(200).json({ success: true, auditLogs });
      }
      case 'metrics': {
        const metrics = CleanRoomService.getEvaluationMetrics();
        return res.status(200).json({ success: true, metrics });
      }
      default:
        return res.status(400).json({
          error: 'INVALID_ACTION',
          message: `Unknown action '${action}' requested`,
        });
    }
  }

  // Handle POST Requests
  if (req.method === 'POST') {
    const body = req.body || {};
    const { action } = body;

    // Scan for PII leaks in input
    const piiCheck = scanPayloadForPii(body);
    if (piiCheck.hasPii) {
      return res.status(400).json({
        error: CLEAN_ROOM_ERROR_CODES.RE_IDENTIFICATION_RISK,
        message: 'Personal identifying information (PII) detected in request payload. Request blocked.',
        violations: piiCheck.violations,
      });
    }

    if (!action) {
      return res.status(400).json({
        error: 'MISSING_ACTION',
        message: 'Field "action" is required in POST body',
      });
    }

    try {
      if (action === 'execute-query') {
        const { workspaceId, templateId, filters } = body;
        const flightKey = `${workspaceId}-${templateId}-${JSON.stringify(filters || {})}`;

        const result = await singleFlight.run(flightKey, async () => {
          return CleanRoomService.executeQuery({ workspaceId, templateId, filters });
        });

        if (!result.success) {
          return res.status(400).json(result);
        }
        return res.status(200).json(result);
      }

      if (action === 'register-workspace') {
        const result = CleanRoomService.registerWorkspace(body);
        if (!result.success) {
          return res.status(400).json(result);
        }
        return res.status(201).json(result);
      }

      if (action === 'review-workspace') {
        const { workspaceId, decision, stewardId, notes, reason } = body;
        const result = CleanRoomService.reviewWorkspace(workspaceId, {
          decision,
          stewardId,
          notes,
          reason,
        });
        if (!result.success) {
          return res.status(400).json(result);
        }
        return res.status(200).json(result);
      }

      if (action === 'replenish-budget') {
        const { workspaceId, additionalQueries, additionalEpsilon, stewardId } = body;
        const result = CleanRoomService.replenishBudget(workspaceId, {
          additionalQueries,
          additionalEpsilon,
          stewardId,
        });
        if (!result.success) {
          return res.status(400).json(result);
        }
        return res.status(200).json(result);
      }

      return res.status(400).json({
        error: 'INVALID_ACTION',
        message: `Action '${action}' is not supported by clean room endpoint`,
      });
    } catch (err) {
      console.error('[CleanRoomAPI] Unexpected internal error:', err);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected clean room error occurred',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` });
}
