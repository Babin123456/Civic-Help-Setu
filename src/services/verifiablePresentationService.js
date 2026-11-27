/**
 * Verifiable Presentation and Selective Disclosure Service (#1159)
 *
 * Implements:
 * 1. Selective disclosure attribute commitments with blinding salts.
 * 2. Replay-resistant Presentation envelopes (Audience URI + Nonce Challenge + Expiry).
 * 3. Tamper-evident presentation digests.
 * 4. Revocation verification and Trust-Tier validation.
 * 5. Mandatory statutory disclaimer emission (avoiding false government authority claims).
 */

import {
  STATUTORY_WALLET_DISCLAIMER,
  TRUST_TIERS,
  validatePresentationPayload
} from '../data/walletContracts';
import { isPresentationRevoked } from './consentReceiptService';

/**
 * Computes deterministic SHA-256 hex string using WebCrypto subtle API.
 */
export async function sha256Hex(input) {
  const buffer = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback for environments lacking crypto.subtle
  let h = 0x811c9dc5;
  for (let i = 0; i < buffer.length; i++) {
    h ^= buffer[i];
    h = Math.imul(h, 0x01000193);
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8).repeat(8);
}

/**
 * Computes a cryptographic commitment for a single attribute key and value.
 * Salt prevents rainbow-table / brute-force inversion of low-entropy attributes (e.g. isOver18: true).
 */
export async function computeAttributeCommitment(attributeKey, value, salt) {
  if (!attributeKey || salt === undefined) {
    throw new Error('Attribute key and salt are required to compute commitment');
  }
  const serializedValue = JSON.stringify(value ?? null);
  const rawString = `${attributeKey}:${serializedValue}:${salt}`;
  return sha256Hex(rawString);
}

/**
 * Generates a random cryptographic hex salt.
 */
export function generateRandomSalt(byteLength = 16) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(36).substring(2, 18) + Date.now().toString(36);
}

/**
 * Canonical presentation digest calculation across envelope parameters.
 */
export async function computePresentationDigest({
  presentationId,
  audience,
  nonce,
  validUntil,
  trustTier,
  attributeCommitments
}) {
  const sortedKeys = Object.keys(attributeCommitments).sort();
  const commitmentsString = sortedKeys.map((k) => `${k}=${attributeCommitments[k]}`).join(';');
  const canonicalString = `${presentationId}|${audience}|${nonce}|${validUntil}|${trustTier}|${commitmentsString}`;
  return sha256Hex(canonicalString);
}

/**
 * Generates a Selective Disclosure Verifiable Presentation for a relying party.
 */
export async function generatePresentation({
  credential,
  selectedAttributeKeys = [],
  audience,
  nonce,
  validDurationSeconds = 1800,
  customSalts = {},
  now = Date.now()
}) {
  if (!credential || !credential.claims) {
    throw new Error('Valid credential with claims is required');
  }
  if (!audience || typeof audience !== 'string' || !audience.trim()) {
    throw new Error('Audience (relying party identifier) is required');
  }
  if (!nonce || typeof nonce !== 'string' || !nonce.trim()) {
    throw new Error('Challenge nonce is required to prevent replay attacks');
  }
  if (!Array.isArray(selectedAttributeKeys) || selectedAttributeKeys.length === 0) {
    throw new Error('At least one attribute must be selected for disclosure');
  }

  const allClaimKeys = Object.keys(credential.claims);
  const disclosedClaims = {};
  const attributeCommitments = {};
  const attributeSalts = {};

  for (const key of selectedAttributeKeys) {
    if (Object.prototype.hasOwnProperty.call(credential.claims, key)) {
      disclosedClaims[key] = credential.claims[key];
      const salt = customSalts[key] || generateRandomSalt();
      attributeSalts[key] = salt;
      attributeCommitments[key] = await computeAttributeCommitment(key, credential.claims[key], salt);
    }
  }

  const withheldClaimsCount = allClaimKeys.length - Object.keys(disclosedClaims).length;
  const createdAt = new Date(now).toISOString();
  const validUntil = new Date(now + validDurationSeconds * 1000).toISOString();
  const presentationId = `vp_${generateRandomSalt(8)}`;

  const presentationDigest = await computePresentationDigest({
    presentationId,
    audience,
    nonce,
    validUntil,
    trustTier: credential.trustTier || TRUST_TIERS.SELF_ASSERTED,
    attributeCommitments
  });

  const presentation = {
    presentationId,
    version: '1.0.0',
    createdAt,
    validUntil,
    audience,
    nonce,
    credentialId: credential.id,
    schemaType: credential.schemaType,
    trustTier: credential.trustTier || TRUST_TIERS.SELF_ASSERTED,
    issuer: credential.issuer || { name: 'Citizen Self-Wallet', id: 'did:civic:self' },
    disclosedClaims,
    withheldClaimsCount,
    attributeCommitments,
    attributeSalts,
    presentationDigest,
    statutoryDisclaimer: STATUTORY_WALLET_DISCLAIMER
  };

  const consentReceiptProposal = {
    presentationId,
    relyingParty: {
      serviceId: audience,
      audience
    },
    purpose: `Civic service attribute verification for ${audience}`,
    disclosedAttributes: Object.keys(disclosedClaims),
    withheldCount: withheldClaimsCount,
    validUntil,
    status: 'ACTIVE'
  };

  return { presentation, consentReceiptProposal };
}

/**
 * Evaluates and cryptographically verifies a presentation against verifier constraints.
 */
export async function verifyPresentation(presentation, options = {}) {
  const {
    expectedAudience = null,
    expectedNonce = null,
    currentTime = Date.now(),
    isRevokedChecker = isPresentationRevoked
  } = options;

  // 1. Schema Validation
  const validation = validatePresentationPayload(presentation);
  if (!validation.valid) {
    return {
      valid: false,
      code: 'INVALID_PAYLOAD',
      error: `Presentation validation failed: ${validation.error}`,
      verdict: 'FAIL'
    };
  }

  // 2. Expiration Verification
  const expiryTime = Date.parse(presentation.validUntil);
  if (Number.isNaN(expiryTime) || currentTime > expiryTime) {
    return {
      valid: false,
      code: 'PRESENTATION_EXPIRED',
      error: `Presentation expired at ${presentation.validUntil} (current time: ${new Date(currentTime).toISOString()})`,
      verdict: 'FAIL'
    };
  }

  // 3. Audience Binding Verification (Replay defense across relying parties)
  if (expectedAudience && presentation.audience !== expectedAudience) {
    return {
      valid: false,
      code: 'AUDIENCE_MISMATCH',
      error: `Audience mismatch: presentation audience '${presentation.audience}' does not match expected '${expectedAudience}'`,
      verdict: 'FAIL'
    };
  }

  // 4. Nonce Binding Verification (Replay defense across sessions)
  if (expectedNonce && presentation.nonce !== expectedNonce) {
    return {
      valid: false,
      code: 'NONCE_MISMATCH',
      error: 'Nonce mismatch: presentation challenge does not match the active session nonce',
      verdict: 'FAIL'
    };
  }

  // 5. Revocation Status Check
  if (isRevokedChecker && isRevokedChecker(presentation.presentationId)) {
    return {
      valid: false,
      code: 'PRESENTATION_REVOKED',
      error: 'This presentation was revoked by the citizen in their consent registry.',
      verdict: 'FAIL'
    };
  }

  // 6. Cryptographic Attribute Commitment Verification
  for (const [key, value] of Object.entries(presentation.disclosedClaims)) {
    const salt = presentation.attributeSalts?.[key];
    const commitment = presentation.attributeCommitments?.[key];

    if (!salt || !commitment) {
      return {
        valid: false,
        code: 'MISSING_COMMITMENT',
        error: `Attribute '${key}' is missing its cryptographic salt or commitment`,
        verdict: 'FAIL'
      };
    }

    const recomputed = await computeAttributeCommitment(key, value, salt);
    if (recomputed !== commitment) {
      return {
        valid: false,
        code: 'TAMPERED_ATTRIBUTE',
        error: `Cryptographic commitment mismatch for attribute '${key}'. Attribute value has been tampered with.`,
        verdict: 'FAIL'
      };
    }
  }

  // 7. Presentation Envelope Digest Verification
  const expectedDigest = await computePresentationDigest({
    presentationId: presentation.presentationId,
    audience: presentation.audience,
    nonce: presentation.nonce,
    validUntil: presentation.validUntil,
    trustTier: presentation.trustTier,
    attributeCommitments: presentation.attributeCommitments
  });

  if (expectedDigest !== presentation.presentationDigest) {
    return {
      valid: false,
      code: 'TAMPERED_DIGEST',
      error: 'Presentation digest check failed. Envelope headers or commitments were altered.',
      verdict: 'FAIL'
    };
  }

  // 8. Trust Tier Assessment & Statutory Disclaimer
  const warnings = [];
  const isSelfAsserted = presentation.trustTier === TRUST_TIERS.SELF_ASSERTED;
  if (isSelfAsserted) {
    warnings.push(
      'Self-asserted credential. Does not constitute official government or statutory verification.'
    );
  }

  return {
    valid: true,
    code: 'SUCCESS',
    verdict: 'PASS',
    presentationId: presentation.presentationId,
    trustTier: presentation.trustTier,
    isSelfAsserted,
    disclosedClaims: presentation.disclosedClaims,
    withheldClaimsCount: presentation.withheldClaimsCount,
    audience: presentation.audience,
    validUntil: presentation.validUntil,
    warnings,
    statutoryDisclaimer: presentation.statutoryDisclaimer || STATUTORY_WALLET_DISCLAIMER,
    verifiedAt: new Date(currentTime).toISOString()
  };
}
