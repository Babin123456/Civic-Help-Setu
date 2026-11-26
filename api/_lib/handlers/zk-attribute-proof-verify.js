/**
 * api/zk-attribute-proof-verify.js
 * Server-side endpoint for validating Zero-Knowledge attribute proofs (#1161).
 *
 * Enforces:
 *  - Rate limiting & abuse guard protection.
 *  - Zero PII: Rejects submissions containing Aadhaar, PAN, personal phone, or raw secrets.
 *  - Strict schema validation on untrusted proof payloads and policy requests.
 *  - Deterministic cryptographic verification.
 *  - Explicit prototype disclaimer on all responses.
 */

import { createRateLimiter } from '../abuseGuard.js';
import {
  validateProofPayload,
  validatePolicyRequest,
  ZK_PROTOTYPE_DISCLAIMER,
} from '../../../src/data/zkProofContracts.js';
import { verifyAttributeProof } from '../../../src/services/zkAttributeProofService.js';
import { PREDEFINED_POLICIES } from '../../../src/services/zkVerifierPolicyService.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(?:\+91|0)?[6-9]\d{9}\b/;

function detectPiiViolation(obj) {
  const serialized = JSON.stringify(obj || {});
  if (AADHAAR_REGEX.test(serialized)) return 'Prohibited Aadhaar number pattern detected in payload.';
  if (PAN_REGEX.test(serialized)) return 'Prohibited PAN card pattern detected in payload.';
  if (PHONE_REGEX.test(serialized)) return 'Prohibited personal phone number pattern detected in payload.';
  return null;
}

export default async function handler(req, res) {
  const clientIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, retryAfterSeconds } = rateLimiter.take(clientIp);
  if (!allowed) {
    if (res.setHeader) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for attribute proof verification. Please retry in 1 minute.',
      disclaimer: ZK_PROTOTYPE_DISCLAIMER,
    });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'Civic Help Setu ZK Attribute Proof Verifier',
      status: 'ACTIVE_PROTOTYPE',
      disclaimer: ZK_PROTOTYPE_DISCLAIMER,
      policies: Object.values(PREDEFINED_POLICIES).map((p) => ({
        policyId: p.policyId,
        title: p.title,
        description: p.description,
        requiredPredicates: p.requiredPredicates,
        trustedIssuers: p.trustedIssuers,
      })),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST and GET methods are supported.',
    });
  }

  try {
    const body = req.body || {};
    const { proofPayload, policyRequest } = body;

    if (!proofPayload || !policyRequest) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Both "proofPayload" and "policyRequest" are required in the request body.',
        disclaimer: ZK_PROTOTYPE_DISCLAIMER,
      });
    }

    // Zero-PII gate
    const piiViolation = detectPiiViolation(body);
    if (piiViolation) {
      return res.status(422).json({
        error: 'Unprocessable Entity - Privacy Violation',
        message: piiViolation,
        disclaimer: ZK_PROTOTYPE_DISCLAIMER,
      });
    }

    // Schema validation at boundary
    const proofVal = validateProofPayload(proofPayload);
    const policyVal = validatePolicyRequest(policyRequest);

    if (!proofVal.valid || !policyVal.valid) {
      return res.status(400).json({
        error: 'Schema Validation Error',
        errors: [...proofVal.errors, ...policyVal.errors],
        disclaimer: ZK_PROTOTYPE_DISCLAIMER,
      });
    }

    // Perform deterministic cryptographic verification
    const result = verifyAttributeProof({
      proofPayload,
      policyRequest,
    });

    return res.status(200).json({
      success: true,
      result,
      disclaimer: ZK_PROTOTYPE_DISCLAIMER,
    });
  } catch (err) {
    console.error('ZK attribute proof endpoint error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Cryptographic proof evaluation encountered an unexpected condition.',
      disclaimer: ZK_PROTOTYPE_DISCLAIMER,
    });
  }
}
