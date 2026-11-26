/**
 * Zero-Knowledge Credential Issuer Service (#1161)
 *
 * Simulates trusted public civil authority credential issuance.
 * Produces versioned credential envelopes with salted cryptographic attribute commitments,
 * maintaining raw secrets strictly client-side for storage in the citizen's vault.
 */

import {
  ZK_CREDENTIAL_SCHEMA_VERSION,
  validateCredentialEnvelope,
  SYNTHETIC_TEST_PERSONAS,
} from '../data/zkProofContracts';
import { sha256Hex, canonicalStringify } from './privacyIntegrityService';
import { generateCryptographicNonce, SYNTHETIC_ISSUERS } from './zkVerifierPolicyService';

/**
 * Synthetic Issuer Registry metadata and public/private prototype keys.
 */
export const SYNTHETIC_AUTHORITY_KEYS = Object.freeze({
  [SYNTHETIC_ISSUERS.DEPT_REVENUE_TN]: {
    name: 'Department of Revenue & Civil Status (Tamil Nadu - Prototype)',
    publicKey: 'pub-ecdsa-p256-revenue-tn-018f7a6b5c4d3e2f1a0b',
    privateKey: 'priv-synthetic-revenue-tn-secret-mock-key-018f7a6b5c4d3e2f1a0b',
  },
  [SYNTHETIC_ISSUERS.CIVIL_REGISTRY_TN]: {
    name: 'Civil Registry Directorate (Tamil Nadu - Prototype)',
    publicKey: 'pub-ecdsa-p256-civil-registry-tn-5b6c7d8e9f0a1b2c',
    privateKey: 'priv-synthetic-civil-registry-tn-secret-mock-key-5b6c7d8e9f0a1b2c',
  },
  [SYNTHETIC_ISSUERS.GREATER_CHENNAI_CORP]: {
    name: 'Greater Chennai Corporation (Ward Administration - Prototype)',
    publicKey: 'pub-ecdsa-p256-gcc-chennai-4d5e6f7a8b9c0d1e',
    privateKey: 'priv-synthetic-gcc-chennai-secret-mock-key-4d5e6f7a8b9c0d1e',
  },
});

/**
 * Computes a salted attribute commitment:
 * C = SHA-256(canonicalStringify({ attribute, value, salt }))
 *
 * @param {string} attributeName
 * @param {*} attributeValue
 * @param {string} salt
 * @returns {string} 64-character hex digest
 */
export function computeAttributeCommitment(attributeName, attributeValue, salt) {
  if (typeof attributeName !== 'string' || !attributeName.trim()) {
    throw new Error('attributeName must be a non-empty string.');
  }
  if (typeof salt !== 'string' || salt.length < 16) {
    throw new Error('salt must be at least 16 characters.');
  }

  const payload = {
    attribute: attributeName,
    value: attributeValue,
    salt,
  };

  return sha256Hex(canonicalStringify(payload));
}

/**
 * Computes the canonical credential root digest over public metadata and commitments.
 *
 * @param {Object} envelopeCore
 * @returns {string} 64-character hex digest
 */
export function computeCredentialRootDigest(envelopeCore) {
  const rootPayload = {
    schemaVersion: envelopeCore.schemaVersion,
    credentialId: envelopeCore.credentialId,
    issuerId: envelopeCore.issuer.id,
    issuedAt: envelopeCore.issuedAt,
    expiresAt: envelopeCore.expiresAt,
    revocation: envelopeCore.revocation,
    commitments: envelopeCore.commitments,
  };

  return sha256Hex(canonicalStringify(rootPayload));
}

/**
 * Computes a deterministic cryptographic signature over a digest using the issuer's key.
 *
 * @param {string} digest
 * @param {string} privateKey
 * @returns {string}
 */
export function signDigest(digest, privateKey) {
  return sha256Hex(`sig::${privateKey}::${digest}`);
}

/**
 * Verifies a cryptographic signature over a digest using the issuer's public key.
 *
 * @param {string} digest
 * @param {string} signature
 * @param {string} issuerId
 * @returns {boolean}
 */
export function verifyIssuerSignature(digest, signature, issuerId) {
  const authority = SYNTHETIC_AUTHORITY_KEYS[issuerId];
  if (!authority) return false;
  const expectedSig = signDigest(digest, authority.privateKey);

  // Constant-time string comparison
  if (typeof signature !== 'string' || signature.length !== expectedSig.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < signature.length; i += 1) {
    diff |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Issues a synthetic credential bundle for a citizen.
 *
 * Returns two components:
 * 1. `credentialEnvelope`: Public verifiable credential suitable for sharing with verifiers.
 * 2. `secretAttributes`: Private values and salts retained strictly client-side.
 *
 * @param {Object} options
 * @param {string} [options.issuerId]
 * @param {Object} options.attributes - Map of attribute name to value
 * @param {number} [options.statusListIndex]
 * @param {number} [options.validityYears=2]
 * @returns {{ credentialEnvelope: Object, secretAttributes: Object }}
 */
export function issueSyntheticCredential({
  issuerId = SYNTHETIC_ISSUERS.DEPT_REVENUE_TN,
  attributes = {},
  statusListIndex = 0,
  validityYears = 2,
}) {
  const authority = SYNTHETIC_AUTHORITY_KEYS[issuerId];
  if (!authority) {
    throw new Error(`Unauthorized or unknown synthetic issuer: "${issuerId}"`);
  }

  const credentialId = `cred-${generateCryptographicNonce(8)}`;
  const now = new Date();
  const expires = new Date(now.getTime() + validityYears * 365.25 * 24 * 60 * 60 * 1000);

  const commitments = {};
  const secretAttributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    const salt = generateCryptographicNonce(16);
    const commitment = computeAttributeCommitment(key, value, salt);
    commitments[key] = commitment;
    secretAttributes[key] = {
      value,
      salt,
      commitment,
    };
  }

  const envelopeCore = {
    schemaVersion: ZK_CREDENTIAL_SCHEMA_VERSION,
    credentialId,
    issuer: {
      id: issuerId,
      name: authority.name,
      publicKey: authority.publicKey,
    },
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    revocation: {
      statusListUrl: `/api/zk-revocation/${issuerId}`,
      statusListIndex,
    },
    commitments,
  };

  const rootDigest = computeCredentialRootDigest(envelopeCore);
  const issuerSignature = signDigest(rootDigest, authority.privateKey);

  const credentialEnvelope = {
    ...envelopeCore,
    issuerSignature,
  };

  const validation = validateCredentialEnvelope(credentialEnvelope);
  if (!validation.valid) {
    throw new Error(`Failed to construct valid credential envelope: ${validation.errors.join(', ')}`);
  }

  return {
    credentialEnvelope,
    secretAttributes,
  };
}

/**
 * Creates pre-seeded synthetic credential bundles for testing from the synthetic personas.
 *
 * @param {string} personaKey
 * @param {number} [statusListIndex=0]
 * @returns {{ credentialEnvelope: Object, secretAttributes: Object, persona: Object }}
 */
export function issueCredentialForPersona(personaKey, statusListIndex = 0) {
  const persona = SYNTHETIC_TEST_PERSONAS[personaKey];
  if (!persona) {
    throw new Error(`Unknown synthetic persona: "${personaKey}"`);
  }

  const result = issueSyntheticCredential({
    issuerId: SYNTHETIC_ISSUERS.DEPT_REVENUE_TN,
    attributes: persona.attributes,
    statusListIndex,
  });

  return {
    ...result,
    persona,
  };
}
