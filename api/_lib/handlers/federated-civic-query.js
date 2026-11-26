/**
 * api/_lib/handlers/federated-civic-query.js
 * Server-side endpoint for Federated Civic Data Query Layer (#1162).
 *
 * Enforces:
 * - Rate limiting (15 req/min) & single-flight deduplication via abuseGuard.
 * - Anti-PII scanning: Rejects any payloads containing Aadhaar, PAN, phone numbers, or emails.
 * - Strict contract validation & purpose checking.
 * - Partial availability semantics and tamper-evident provenance seals.
 */

import { createRateLimiter, createSingleFlight, clientKey } from "../abuseGuard.js";
import {
  executeFederatedCivicQuery,
  checkFederatedNodeHealth,
  PRESET_CIVIC_QUERIES,
} from "../../../src/services/federatedCivicQueryService.js";
import {
  FEDERATED_SCHEMA_VERSION,
  FEDERATED_DEPARTMENTS,
  AUTHORIZED_CIVIC_PURPOSES,
} from "../../../src/data/federatedQueryContract.js";

const rateLimiter = createRateLimiter({ limit: 15, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(\+91[-\s]?)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

export function scanPayloadForPII(body) {
  const text = JSON.stringify(body || {});
  if (AADHAAR_REGEX.test(text)) return "Aadhaar number detected in query payload";
  if (PAN_REGEX.test(text)) return "PAN number detected in query payload";
  if (PHONE_REGEX.test(text)) return "Phone number detected in query payload";
  if (EMAIL_REGEX.test(text)) return "Email address detected in query payload";
  return null;
}

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Rate Limiting
  const ip = clientKey(req.headers);
  if (ip) {
    const rateCheck = rateLimiter.take(ip);
    if (!rateCheck.allowed) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds));
      return res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Please retry in ${rateCheck.retryAfterSeconds}s.`,
      });
    }
  }

  // Handle GET: Metadata, Node Health, and Presets
  if (req.method === "GET") {
    try {
      const nodeHealth = await checkFederatedNodeHealth();
      return res.status(200).json({
        service: "Federated Civic Data Query Layer",
        schemaVersion: FEDERATED_SCHEMA_VERSION,
        status: "OPERATIONAL",
        registeredDepartments: Object.values(FEDERATED_DEPARTMENTS),
        authorizedPurposes: Object.values(AUTHORIZED_CIVIC_PURPOSES),
        presets: PRESET_CIVIC_QUERIES,
        nodeHealth,
      });
    } catch (err) {
      console.error("Federated query GET error:", err);
      return res.status(500).json({ error: "Failed to retrieve node health metadata" });
    }
  }

  // Handle POST: Execute Federated Query
  if (req.method === "POST") {
    const piiViolation = scanPayloadForPII(req.body);
    if (piiViolation) {
      return res.status(400).json({
        error: "PII Violation",
        message: `Untrusted payload rejected: ${piiViolation}. No personal records allowed in federated queries.`,
      });
    }

    const cacheKey = `${ip || "anon"}:${JSON.stringify(req.body)}`;

    return singleFlight.run(cacheKey, async () => {
      try {
        const result = await executeFederatedCivicQuery(req.body, { timeoutMs: 1500 });

        if (!result.success && result.status === "INVALID_REQUEST") {
          return res.status(400).json({
            error: "Bad Request",
            details: result.errors,
          });
        }

        if (!result.success && result.status === "FAILED") {
          return res.status(503).json({
            error: "Service Unavailable",
            message: "All targeted departmental connectors are currently unavailable.",
            details: result,
          });
        }

        return res.status(200).json(result);
      } catch (err) {
        console.error("Federated query execution error:", err);
        return res.status(500).json({ error: "Internal Server Error in query coordinator" });
      }
    });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
