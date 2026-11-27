/**
 * api/_lib/handlers/verifiable-evidence-bundles.js
 * Stateless server-side verification and schema validation endpoint
 * for Civic Verifiable Evidence Bundles (#1160).
 *
 * Allows third-party reviewers (ombudsmen, civic organizations, legal aid)
 * to verify evidence bundle manifests and attachment hashes via REST.
 *
 * Invariants:
 * - Rate limited & abuse protected.
 * - Zero storage of citizen evidence bytes on server.
 * - Strict validation against tampered hashes, broken chains, and clock skew.
 * - Explicit statutory disclaimer in all verification responses.
 */

import { createRateLimiter, createSingleFlight, clientKey } from '../abuseGuard.js';
import {
  BUNDLE_SCHEMA_VERSION,
  STATUTORY_EVIDENCE_DISCLAIMER,
  verifyBundleIntegrity,
  validateBundleManifest,
} from '../../../src/data/verifiableEvidenceBundleContract.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });
const singleFlight = createSingleFlight();

const MAX_PAYLOAD_STRING_LENGTH = 10 * 1024 * 1024; // 10 MB payload cap

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Version');
    return res.status(204).end();
  }

  // GET: Health and schema capabilities
  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'civic-verifiable-evidence-verifier',
      status: 'OPERATIONAL',
      supportedSchemaVersions: [BUNDLE_SCHEMA_VERSION],
      disclaimer: STATUTORY_EVIDENCE_DISCLAIMER,
      documentationUrl: 'https://github.com/GoldRay19/Civic-Help-Setu/issues/1160',
    });
  }

  // POST: Verify bundle manifest & optional attachments
  if (req.method === 'POST') {
    const ip = clientKey(req.headers) || 'direct-client';
    const limitDecision = rateLimiter.take(ip);

    if (!limitDecision.allowed) {
      res.setHeader('Retry-After', String(limitDecision.retryAfterSeconds));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please wait before submitting additional bundles.',
      });
    }

    const rawBody = req.body;
    if (!rawBody || typeof rawBody !== 'object') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object containing an evidence bundle or archive.',
      });
    }

    // Safety check on serialized payload size
    try {
      const serialized = JSON.stringify(rawBody);
      if (serialized.length > MAX_PAYLOAD_STRING_LENGTH) {
        return res.status(413).json({
          error: 'Payload Too Large',
          message: `Bundle payload exceeds maximum allowed size of ${Math.round(MAX_PAYLOAD_STRING_LENGTH / (1024 * 1024))} MB.`,
        });
      }
    } catch {
      return res.status(400).json({ error: 'Bad Request', message: 'Unable to serialize request body.' });
    }

    const manifest = rawBody.manifest || rawBody;
    const enclosedFiles = rawBody.enclosedFiles || {};

    const manifestValidation = validateBundleManifest(manifest);
    if (!manifestValidation.isValid) {
      return res.status(400).json({
        error: 'Schema Validation Failed',
        errors: manifestValidation.errors,
        disclaimer: STATUTORY_EVIDENCE_DISCLAIMER,
      });
    }

    const idempotencyKey = `${manifest.bundleId || 'unknown'}-${manifest.chainState?.manifestSeal || 'seal'}`;

    return singleFlight.run(idempotencyKey, async () => {
      try {
        const rawFiles = {};
        Object.keys(enclosedFiles).forEach((k) => {
          rawFiles[k] = enclosedFiles[k].payload || enclosedFiles[k];
        });

        const verification = await verifyBundleIntegrity(manifest, rawFiles);

        const responsePayload = {
          success: verification.isValid,
          verified: verification.isValid,
          bundleId: manifest.bundleId,
          complaintId: manifest.complaintId,
          status: verification.status,
          chainState: manifest.chainState,
          checkedEntriesCount: verification.checkedEntriesCount,
          errors: verification.errors,
          warnings: verification.warnings,
          verifiedAt: verification.verifiedAt,
          disclaimer: STATUTORY_EVIDENCE_DISCLAIMER,
        };

        if (verification.isValid) {
          return res.status(200).json(responsePayload);
        } else {
          return res.status(422).json(responsePayload);
        }
      } catch (err) {
        return res.status(500).json({
          error: 'Verification Execution Error',
          message: err.message || 'An error occurred during cryptographic verification.',
        });
      }
    });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Method Not Allowed' });
}
