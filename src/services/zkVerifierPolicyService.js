/**
 * Zero-Knowledge Verifier Policy Service (#1161)
 *
 * Manages verifier requirement policies, freshness nonces, interactive challenge
 * generation, and anti-replay protection.
 */

import {
  ZK_POLICY_SCHEMA_VERSION,
  validatePolicyRequest,
} from '../data/zkProofContracts';

/**
 * Known trusted synthetic issuers for prototype policies.
 */
export const SYNTHETIC_ISSUERS = Object.freeze({
  DEPT_REVENUE_TN: 'did:civic:dept-revenue-tn',
  CIVIL_REGISTRY_TN: 'did:civic:civil-registry-tn',
  GREATER_CHENNAI_CORP: 'did:civic:gcc-chennai',
});

/**
 * Standard Civic Verification Policies.
 */
export const PREDEFINED_POLICIES = Object.freeze({
  SENIOR_CITIZEN_CONCESSION_TN: {
    policyId: 'policy-senior-citizen-tn-v1',
    title: 'Senior Citizen Travel & Welfare Concession (TN)',
    description: 'Verifies applicant is aged 60 or above and resides in the Chennai Metropolitan Area without collecting date of birth or home address.',
    requiredPredicates: [
      {
        attribute: 'age',
        operator: 'gte',
        threshold: 60,
      },
      {
        attribute: 'jurisdiction.district',
        operator: 'in',
        allowedValues: ['Chennai', 'Tiruvallur', 'Chengalpattu', 'Kanchipuram'],
      },
    ],
    trustedIssuers: [SYNTHETIC_ISSUERS.DEPT_REVENUE_TN, SYNTHETIC_ISSUERS.CIVIL_REGISTRY_TN],
    ttlSeconds: 300,
  },
  ADULT_CIVIC_ELECTOR: {
    policyId: 'policy-adult-elector-universal-v1',
    title: 'Adult Civic Participant / Voter Eligibility',
    description: 'Verifies applicant is aged 18 or above without exposing date of birth or name.',
    requiredPredicates: [
      {
        attribute: 'age',
        operator: 'gte',
        threshold: 18,
      },
    ],
    trustedIssuers: [SYNTHETIC_ISSUERS.DEPT_REVENUE_TN, SYNTHETIC_ISSUERS.CIVIL_REGISTRY_TN],
    ttlSeconds: 300,
  },
  WARD_174_PARTICIPATORY_BUDGET: {
    policyId: 'policy-ward-174-budget-v1',
    title: 'Ward 174 Participatory Budget Voter',
    description: 'Verifies applicant is an adult resident of Ward 174 (Chennai) without collecting personal residential details.',
    requiredPredicates: [
      {
        attribute: 'age',
        operator: 'gte',
        threshold: 18,
      },
      {
        attribute: 'jurisdiction.district',
        operator: 'eq',
        targetValue: 'Chennai',
      },
      {
        attribute: 'jurisdiction.ward',
        operator: 'eq',
        targetValue: '174',
      },
    ],
    trustedIssuers: [SYNTHETIC_ISSUERS.GREATER_CHENNAI_CORP, SYNTHETIC_ISSUERS.DEPT_REVENUE_TN],
    ttlSeconds: 300,
  },
});

/**
 * Cache for tracking consumed nonces to prevent replay attacks.
 * Map<nonce, { expiresAt: number, consumedAt: number }>
 */
const consumedNonces = new Map();

/**
 * Active issued challenges awaiting response.
 * Map<nonce, { policyId: string, issuedAt: string, validUntil: string }>
 */
const activeChallenges = new Map();

/**
 * Generates a cryptographically strong random nonce.
 *
 * @param {number} [byteLen=16]
 * @returns {string} Hex string (at least 32 chars)
 */
export function generateCryptographicNonce(byteLen = 16) {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const bytes = new Uint8Array(byteLen);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback for pseudo-random test environments
  let s = '';
  for (let i = 0; i < byteLen; i += 1) {
    s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return s;
}

/**
 * Creates an interactive policy challenge for a verifier.
 *
 * @param {string|Object} policyOrKey
 * @param {number} [customTtlSeconds]
 * @returns {Object} Validated Policy Request with active nonce
 */
export function createPolicyChallenge(policyOrKey, customTtlSeconds) {
  let basePolicy;
  if (typeof policyOrKey === 'string') {
    basePolicy = PREDEFINED_POLICIES[policyOrKey] || Object.values(PREDEFINED_POLICIES).find((p) => p.policyId === policyOrKey);
    if (!basePolicy) {
      throw new Error(`Unknown policy key or ID: "${policyOrKey}"`);
    }
  } else if (policyOrKey && typeof policyOrKey === 'object') {
    basePolicy = policyOrKey;
  } else {
    throw new Error('Invalid policy parameter.');
  }

  const ttl = customTtlSeconds || basePolicy.ttlSeconds || 300;
  const now = new Date();
  const validUntil = new Date(now.getTime() + ttl * 1000);
  const nonce = `ch-${generateCryptographicNonce(16)}`;

  const policyRequest = {
    schemaVersion: ZK_POLICY_SCHEMA_VERSION,
    policyId: basePolicy.policyId,
    title: basePolicy.title,
    description: basePolicy.description,
    nonce,
    issuedAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    requiredPredicates: basePolicy.requiredPredicates,
    trustedIssuers: basePolicy.trustedIssuers,
  };

  const validation = validatePolicyRequest(policyRequest);
  if (!validation.valid) {
    throw new Error(`Failed to generate valid policy challenge: ${validation.errors.join(', ')}`);
  }

  activeChallenges.set(nonce, {
    policyId: policyRequest.policyId,
    issuedAt: policyRequest.issuedAt,
    validUntil: policyRequest.validUntil,
  });

  return policyRequest;
}

/**
 * Verifies freshness and single-use anti-replay status of a nonce.
 * Consumes the nonce so it can never be re-used.
 *
 * @param {string} nonce
 * @param {string} policyId
 * @param {Date} [referenceDate]
 * @returns {{ valid: boolean, error?: string }}
 */
export function verifyAndConsumeNonce(nonce, policyId, referenceDate = new Date()) {
  if (typeof nonce !== 'string' || !nonce.trim()) {
    return { valid: false, error: 'MISSING_NONCE' };
  }

  // Check if nonce was already consumed (Replay Attack)
  if (consumedNonces.has(nonce)) {
    return { valid: false, error: 'NONCE_ALREADY_CONSUMED' };
  }

  const challenge = activeChallenges.get(nonce);
  if (!challenge) {
    return { valid: false, error: 'UNRECOGNIZED_CHALLENGE' };
  }

  if (challenge.policyId !== policyId) {
    return { valid: false, error: 'POLICY_ID_MISMATCH' };
  }

  const validUntil = new Date(challenge.validUntil);
  if (referenceDate.getTime() > validUntil.getTime()) {
    activeChallenges.delete(nonce);
    return { valid: false, error: 'CHALLENGE_EXPIRED' };
  }

  // Consume nonce
  consumedNonces.set(nonce, {
    expiresAt: validUntil.getTime(),
    consumedAt: referenceDate.getTime(),
  });
  activeChallenges.delete(nonce);

  cleanExpiredNonces(referenceDate);

  return { valid: true };
}

/**
 * Removes expired nonces from memory to prevent memory leaks.
 *
 * @param {Date} [now]
 */
export function cleanExpiredNonces(now = new Date()) {
  const currentEpoch = now.getTime();
  for (const [nonce, data] of consumedNonces.entries()) {
    // Keep in consumed map for an extra 10 minutes past expiration to guarantee replay rejection
    if (currentEpoch > data.expiresAt + 600000) {
      consumedNonces.delete(nonce);
    }
  }

  for (const [nonce, challenge] of activeChallenges.entries()) {
    if (currentEpoch > new Date(challenge.validUntil).getTime()) {
      activeChallenges.delete(nonce);
    }
  }
}

/**
 * Resets state for tests.
 */
export function resetPolicyCache() {
  consumedNonces.clear();
  activeChallenges.clear();
}
