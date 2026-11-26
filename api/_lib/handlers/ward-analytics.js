/**
 * api/_lib/handlers/ward-analytics.js
 * Serverless API endpoint for Differentially Private Ward Analytics (#1163).
 *
 * Implements:
 * - Rate limiting via abuseGuard
 * - Untrusted query parameter validation
 * - Ephemeral & persistent privacy budget accounting (with 429 on exhaustion)
 * - Safe HTTP caching headers
 * - Zero PII disclosure
 */

import { createRateLimiter } from '../abuseGuard.js';
import {
  fetchDifferentiallyPrivateWardAnalytics,
} from '../../../src/services/wardIssueHeatmapService.js';
import {
  saveCivicReport,
} from '../../../src/services/wardIssueHeatmapStorage.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(\+91[-\s]?)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

export default async function handler(req, res) {
  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-vercel-forwarded-for'] || '127.0.0.1';
  const limitCheck = rateLimiter.take(clientIp);

  if (!limitCheck.allowed) {
    res.setHeader('Retry-After', limitCheck.retryAfterSeconds);
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please retry shortly.',
      retryAfter: limitCheck.retryAfterSeconds,
    });
  }

  // GET: Fetch differentially private ward analytics
  if (req.method === 'GET') {
    const query = req.query || {};
    const result = fetchDifferentiallyPrivateWardAnalytics({
      wardId: query.wardId,
      category: query.category,
      timeWindow: query.timeWindow,
      epsilon: query.epsilon,
      sparseThreshold: query.sparseThreshold,
      clientId: clientIp,
    });

    if (!result.success) {
      if (result.error === 'BUDGET_EXHAUSTED') {
        if (result.retryAfterSeconds) {
          res.setHeader('Retry-After', result.retryAfterSeconds);
        }
        return res.status(429).json(result);
      }

      if (result.error === 'INVALID_QUERY_PARAMS') {
        return res.status(400).json(result);
      }

      return res.status(500).json(result);
    }

    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    return res.status(200).json(result);
  }

  // POST: Record civic report into analytics storage
  if (req.method === 'POST') {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, error: 'Request body must be a JSON object.' });
    }

    // Inspect text fields for forbidden PII
    const fullText = JSON.stringify(body);
    if (AADHAAR_REGEX.test(fullText) || PAN_REGEX.test(fullText) || PHONE_REGEX.test(fullText) || EMAIL_REGEX.test(fullText)) {
      return res.status(400).json({
        success: false,
        error: 'PII_DETECTED',
        message: 'Personal identifying information (Aadhaar, PAN, phone, email) is prohibited.',
      });
    }

    try {
      const saved = saveCivicReport({
        id: body.id || `RPT-${Date.now()}`,
        wardId: body.wardId,
        category: body.category,
        timestamp: body.timestamp || new Date().toISOString(),
        status: 'reported',
      });

      return res.status(201).json({
        success: true,
        reportId: saved.id,
        message: 'Civic report registered for private analytics aggregation.',
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: err.message,
      });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
