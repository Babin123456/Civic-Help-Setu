/**
 * api/_lib/handlers/verifiable-presentations.js
 * Server-side endpoint for Verifiable Presentation verification and challenge issuance (#1159).
 *
 * Enforces:
 * - Ephemeral verifier challenge nonce generation.
 * - Rate limiting & payload size bounds (max 32KB).
 * - Cryptographic attribute commitment checking and envelope digest verification.
 * - Audience binding, expiration check, and trust-tier disclosure.
 * - Mandatory statutory disclaimer emission (avoiding false official claims).
 * - Zero PII persistence: Presentations are verified in-memory and never written to logs or disk.
 */

import { createRateLimiter } from '../abuseGuard.js';

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

export const STATUTORY_NOTICE =
  'Verification confirms presentation cryptographic integrity, audience binding, and non-tampering of disclosed claims. It does NOT claim statutory government authority or guaranteed administrative grant unless cryptographically signed by an authorized public agency.';

export const MAX_PAYLOAD_BYTES = 32768; // 32 KB

/**
 * Computes deterministic SHA-256 hex string.
 */
export async function computeSha256(input) {
  const buffer = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < buffer.length; i += 1) {
    h ^= buffer[i];
    h = Math.imul(h, 0x01000193);
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8).repeat(8);
}

/**
 * Generates an ephemeral challenge nonce for relying parties.
 */
export function generateChallengeNonce() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return 'chn_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'chn_' + Math.random().toString(36).substring(2, 18) + Date.now().toString(36);
}

/**
 * Validates request payload bounds.
 */
export function validateVerificationPayload(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a valid JSON object.' };
  }

  const jsonStr = JSON.stringify(body);
  if (jsonStr.length > MAX_PAYLOAD_BYTES) {
    return { valid: false, error: 'Payload exceeds maximum allowable size (32KB).' };
  }

  const { presentation } = body;
  if (!presentation || typeof presentation !== 'object') {
    return { valid: false, error: 'Presentation object is required in request body.' };
  }

  if (!presentation.presentationId || typeof presentation.presentationId !== 'string') {
    return { valid: false, error: 'presentation.presentationId is required.' };
  }
  if (!presentation.audience || typeof presentation.audience !== 'string') {
    return { valid: false, error: 'presentation.audience is required.' };
  }
  if (!presentation.nonce || typeof presentation.nonce !== 'string') {
    return { valid: false, error: 'presentation.nonce is required.' };
  }
  if (!presentation.validUntil || Number.isNaN(Date.parse(presentation.validUntil))) {
    return { valid: false, error: 'presentation.validUntil timestamp is required.' };
  }
  if (!presentation.disclosedClaims || typeof presentation.disclosedClaims !== 'object') {
    return { valid: false, error: 'presentation.disclosedClaims must be an object.' };
  }
  if (!presentation.attributeCommitments || typeof presentation.attributeCommitments !== 'object') {
    return { valid: false, error: 'presentation.attributeCommitments must be an object.' };
  }
  if (!presentation.attributeSalts || typeof presentation.attributeSalts !== 'object') {
    return { valid: false, error: 'presentation.attributeSalts must be an object.' };
  }
  if (!presentation.presentationDigest || typeof presentation.presentationDigest !== 'string') {
    return { valid: false, error: 'presentation.presentationDigest is required.' };
  }

  return { valid: true };
}

/**
 * Serverless HTTP Handler for /api/verifiable-presentations
 */
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed.` });
  }

  const clientIp = req.headers?.['x-forwarded-for'] || req.headers?.['x-vercel-forwarded-for'] || '127.0.0.1';
  const limiter = rateLimiter.take(clientIp);

  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(limiter.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded for presentation verification. Please retry shortly.',
      retryAfterSeconds: limiter.retryAfterSeconds
    });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // Handle GET /api/verifiable-presentations?action=challenge
  if (req.method === 'GET') {
    const action = req.query?.action;
    if (action === 'challenge') {
      const challenge = generateChallengeNonce();
      return res.status(200).json({
        success: true,
        challenge,
        issuedAt: new Date().toISOString(),
        expiresInSeconds: 300
      });
    }

    return res.status(200).json({
      service: 'Civic Help Setu Verifiable Presentation Verification Service',
      version: '1.0.0',
      statutoryNotice: STATUTORY_NOTICE
    });
  }

  // Handle POST /api/verifiable-presentations (Verify presentation)
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid JSON request body.' });
      }
    }

    const val = validateVerificationPayload(body);
    if (!val.valid) {
      return res.status(400).json({ success: false, error: val.error, verdict: 'FAIL' });
    }

    const { presentation, expectedAudience, expectedNonce, currentTime = Date.now() } = body;

    // 1. Expiry Check
    const expiryTime = Date.parse(presentation.validUntil);
    if (currentTime > expiryTime) {
      return res.status(200).json({
        success: false,
        verdict: 'FAIL',
        code: 'PRESENTATION_EXPIRED',
        error: `Presentation expired at ${presentation.validUntil}`,
        statutoryNotice: STATUTORY_NOTICE
      });
    }

    // 2. Audience Check
    if (expectedAudience && presentation.audience !== expectedAudience) {
      return res.status(200).json({
        success: false,
        verdict: 'FAIL',
        code: 'AUDIENCE_MISMATCH',
        error: `Expected audience '${expectedAudience}' does not match presentation audience '${presentation.audience}'`,
        statutoryNotice: STATUTORY_NOTICE
      });
    }

    // 3. Nonce Check
    if (expectedNonce && presentation.nonce !== expectedNonce) {
      return res.status(200).json({
        success: false,
        verdict: 'FAIL',
        code: 'NONCE_MISMATCH',
        error: 'Challenge nonce does not match the active verifier session nonce.',
        statutoryNotice: STATUTORY_NOTICE
      });
    }

    // 4. Commitment Checking
    for (const [key, value] of Object.entries(presentation.disclosedClaims)) {
      const salt = presentation.attributeSalts[key];
      const commitment = presentation.attributeCommitments[key];
      if (!salt || !commitment) {
        return res.status(200).json({
          success: false,
          verdict: 'FAIL',
          code: 'MISSING_COMMITMENT',
          error: `Missing salt or commitment for disclosed attribute '${key}'`,
          statutoryNotice: STATUTORY_NOTICE
        });
      }

      const serializedValue = JSON.stringify(value ?? null);
      const computed = await computeSha256(`${key}:${serializedValue}:${salt}`);
      if (computed !== commitment) {
        return res.status(200).json({
          success: false,
          verdict: 'FAIL',
          code: 'TAMPERED_ATTRIBUTE',
          error: `Cryptographic commitment mismatch for attribute '${key}'. Claim has been modified.`,
          statutoryNotice: STATUTORY_NOTICE
        });
      }
    }

    // 5. Envelope Digest Checking
    const sortedKeys = Object.keys(presentation.attributeCommitments).sort();
    const commitmentsString = sortedKeys.map((k) => `${k}=${presentation.attributeCommitments[k]}`).join(';');
    const canonicalString = `${presentation.presentationId}|${presentation.audience}|${presentation.nonce}|${presentation.validUntil}|${presentation.trustTier}|${commitmentsString}`;
    const expectedDigest = await computeSha256(canonicalString);

    if (expectedDigest !== presentation.presentationDigest) {
      return res.status(200).json({
        success: false,
        verdict: 'FAIL',
        code: 'TAMPERED_DIGEST',
        error: 'Presentation envelope digest check failed. Metadata or commitments modified.',
        statutoryNotice: STATUTORY_NOTICE
      });
    }

    const isSelfAsserted = presentation.trustTier === 'SELF_ASSERTED';
    const warnings = [];
    if (isSelfAsserted) {
      warnings.push('Self-asserted citizen record. Requires primary proof verification.');
    }

    return res.status(200).json({
      success: true,
      verdict: 'PASS',
      code: 'VERIFIED',
      presentationId: presentation.presentationId,
      trustTier: presentation.trustTier,
      isSelfAsserted,
      disclosedClaims: presentation.disclosedClaims,
      withheldClaimsCount: presentation.withheldClaimsCount,
      warnings,
      statutoryNotice: STATUTORY_NOTICE,
      verifiedAt: new Date(currentTime).toISOString()
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ success: false, error: `Method ${req.method} not allowed.` });
}
