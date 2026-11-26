/**
 * api/_lib/handlers/temporal-policy.js
 * Server-side Vercel serverless function for the Temporal Policy Engine (#1155).
 *
 * Implements:
 * 1. Strict schema and boundary validation for all untrusted inputs.
 * 2. Abuse controls: Rate limiting & single-flight deduplication via abuseGuard.
 * 3. Privacy & Zero-PII Defense: Rejects payloads containing Aadhaar, PAN, or phone numbers.
 * 4. Versioned API contracts (schemaVersion: '1.0.0') and outbox event integration.
 * 5. Deterministic As-Of evaluation and multi-date shift simulation.
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import {
  resolveAsOfRule,
  evaluateEffectiveDatedPolicy,
  simulatePolicyAcrossDates,
  detectTemporalAnomalies,
  createEvaluationSnapshot,
  isValidIsoDate,
  STATUTORY_DISCLAIMER,
} from '../../../src/services/temporalPolicyEngineService.js';
import { getStoredRules } from '../../../src/services/temporalPolicyStorage.js';
import { stageOutboxEvent } from '../../../src/services/civicDomainEventBusService.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(?:\+91|0)?[6-9]\d{9}\b/;

export function detectPiiViolation(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const str = JSON.stringify(obj);
  return AADHAAR_REGEX.test(str) || PAN_REGEX.test(str) || PHONE_REGEX.test(str);
}

export function validateEvaluationRequest(body = {}) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return ['Request body must be a valid JSON object.'];
  }

  if (!body.ruleFamilyId || typeof body.ruleFamilyId !== 'string') {
    errors.push('ruleFamilyId is required and must be a string.');
  }

  if (body.asOfDate && !isValidIsoDate(body.asOfDate)) {
    errors.push('asOfDate must be a valid ISO 8601 date string.');
  }

  if (detectPiiViolation(body)) {
    errors.push('Direct citizen PII (Aadhaar, PAN, phone) is strictly forbidden in request payloads.');
  }

  return errors;
}

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Key, Idempotency-Key');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Rate Limiting
  const key = clientKey(req);
  const check = rateLimiter.take(key);
  if (!check.allowed) {
    res.setHeader('Retry-After', String(check.retryAfterSeconds));
    return res.status(429).json({
      error: 'Rate limit exceeded. Please wait before retrying.',
      retryAfterSeconds: check.retryAfterSeconds,
    });
  }

  // Handle GET (As-Of Resolution & Anomaly Discovery)
  if (req.method === 'GET') {
    const { ruleFamilyId, jurisdictionCode, asOfDate } = req.query || {};

    if (!ruleFamilyId) {
      return res.status(400).json({ error: 'Query parameter "ruleFamilyId" is required.' });
    }

    const rules = getStoredRules();
    const targetDate = asOfDate || new Date().toISOString();

    const resolution = resolveAsOfRule({
      rules,
      ruleFamilyId,
      jurisdictionCode: jurisdictionCode || 'CENTRAL',
      asOfDate: targetDate,
      fallbackToCentral: true,
    });

    const anomalies = detectTemporalAnomalies(rules, ruleFamilyId, jurisdictionCode || 'CENTRAL');

    return res.status(200).json({
      schemaVersion: '1.0.0',
      ruleFamilyId,
      jurisdictionCode: jurisdictionCode || 'CENTRAL',
      asOfDate: targetDate,
      resolution,
      anomalies,
      disclaimer: STATUTORY_DISCLAIMER,
    });
  }

  // Handle POST (Evaluate or Simulate)
  if (req.method === 'POST') {
    const flightKey = `${key}:${req.headers['idempotency-key'] || JSON.stringify(req.body)}`;

    return singleFlight.run(flightKey, async () => {
      const body = req.body || {};
      const validationErrors = validateEvaluationRequest(body);

      if (validationErrors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed at service boundary.',
          details: validationErrors,
        });
      }

      const { action = 'EVALUATE', ruleFamilyId, jurisdictionCode = 'CENTRAL', asOfDate, citizenFacts = {}, dates = [] } = body;
      const rules = getStoredRules();
      const targetDate = asOfDate || new Date().toISOString();

      if (action === 'SIMULATE') {
        const sim = simulatePolicyAcrossDates({
          rules,
          ruleFamilyId,
          jurisdictionCode,
          citizenFacts,
          dates,
        });

        return res.status(200).json({
          schemaVersion: '1.0.0',
          action: 'SIMULATE',
          ruleFamilyId,
          jurisdictionCode,
          simulation: sim,
          disclaimer: STATUTORY_DISCLAIMER,
        });
      }

      // Default: EVALUATE
      const resolution = resolveAsOfRule({
        rules,
        ruleFamilyId,
        jurisdictionCode,
        asOfDate: targetDate,
        fallbackToCentral: true,
      });

      if (!resolution.rule) {
        return res.status(200).json({
          schemaVersion: '1.0.0',
          outcome: 'INDETERMINATE',
          status: resolution.status,
          error: resolution.error,
          gapDetails: resolution.gapDetails,
          disclaimer: STATUTORY_DISCLAIMER,
        });
      }

      const evalResult = evaluateEffectiveDatedPolicy({
        rule: resolution.rule,
        citizenFacts,
        asOfDate: targetDate,
        operatorOrCitizenId: key,
      });

      const snapshot = createEvaluationSnapshot({
        evaluationResult: evalResult,
        citizenFacts,
        asOfDate: targetDate,
        rule: resolution.rule,
        operatorOrCitizenId: key,
      });

      // Stage versioned domain event in outbox for asynchronous tracking
      try {
        stageOutboxEvent({
          eventType: 'TEMPORAL_POLICY_EVALUATED',
          aggregateId: snapshot.evaluationId,
          producerDomain: 'TEMPORAL_POLICY_ENGINE',
          schemaVersion: '1.0.0',
          idempotencyKey: snapshot.snapshotHash,
          payload: {
            evaluationId: snapshot.evaluationId,
            ruleFamilyId,
            ruleId: snapshot.ruleId,
            ruleVersion: snapshot.ruleVersion,
            outcome: snapshot.outcome,
            asOfDate: snapshot.asOfDate,
            ruleDigestHash: snapshot.ruleDigestHash,
          },
        });
      } catch (err) {
        console.warn('[temporal-policy] Outbox staging skipped:', err.message);
      }

      return res.status(200).json({
        schemaVersion: '1.0.0',
        action: 'EVALUATE',
        evaluation: evalResult,
        snapshot,
        disclaimer: STATUTORY_DISCLAIMER,
      });
    });
  }

  return res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
