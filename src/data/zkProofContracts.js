/**
 * Zero-Knowledge Attribute Proof Prototype Data Contracts (#1161)
 *
 * Implements versioned domain contracts, validation logic, schema versioning,
 * and synthetic test fixtures for privacy-preserving attribute proofs.
 *
 * Principle: Untrusted input is strictly validated at all system boundaries.
 */

export const ZK_CREDENTIAL_SCHEMA_VERSION = 'civicbridge.zk.credential.v1';
export const ZK_POLICY_SCHEMA_VERSION = 'civicbridge.zk.policy.v1';
export const ZK_PROOF_SCHEMA_VERSION = 'civicbridge.zk.proof.v1';
export const ZK_VERIFICATION_SCHEMA_VERSION = 'civicbridge.zk.verification.v1';

export const ZK_PROTOTYPE_DISCLAIMER =
  'PROTOTYPE ZERO-KNOWLEDGE PROOF: Developed for research and demonstration of selective disclosure in civic workflows. ' +
  'Does NOT constitute official statutory identity verification under the Aadhaar Act, 2016 or IT Act, 2000. ' +
  'Never treat self-issued or prototype attestations as legally binding authority.';

export const PREDICATE_OPERATORS = Object.freeze(['gte', 'gt', 'lte', 'lt', 'eq', 'in']);

export const SUPPORTED_ATTRIBUTES = Object.freeze([
  'age',
  'birthDate',
  'jurisdiction.state',
  'jurisdiction.district',
  'jurisdiction.ward',
  'incomeCategory',
  'disabilityStatus',
]);

/**
 * Validates an ISO 8601 date-time string.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidIsoDateTime(str) {
  if (typeof str !== 'string' || !str) return false;
  const d = new Date(str);
  return !Number.isNaN(d.getTime()) && str.includes('T');
}

/**
 * Validates an ISO 8601 date string (YYYY-MM-DD).
 * @param {string} str
 * @returns {boolean}
 */
export function isValidIsoDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  return !Number.isNaN(d.getTime());
}

/**
 * Validates a Credential Envelope structure.
 *
 * @param {unknown} credential
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCredentialEnvelope(credential) {
  const errors = [];
  if (!credential || typeof credential !== 'object' || Array.isArray(credential)) {
    return { valid: false, errors: ['Credential must be a non-null object.'] };
  }

  if (credential.schemaVersion !== ZK_CREDENTIAL_SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion: expected "${ZK_CREDENTIAL_SCHEMA_VERSION}".`);
  }

  if (typeof credential.credentialId !== 'string' || !credential.credentialId.trim()) {
    errors.push('credentialId must be a non-empty string.');
  }

  if (!credential.issuer || typeof credential.issuer !== 'object') {
    errors.push('issuer must be a valid object.');
  } else {
    if (typeof credential.issuer.id !== 'string' || !credential.issuer.id.trim()) {
      errors.push('issuer.id must be a non-empty string identifier.');
    }
    if (typeof credential.issuer.name !== 'string' || !credential.issuer.name.trim()) {
      errors.push('issuer.name must be a non-empty string.');
    }
    if (typeof credential.issuer.publicKey !== 'string' || !credential.issuer.publicKey.trim()) {
      errors.push('issuer.publicKey must be a non-empty string.');
    }
  }

  if (!isValidIsoDateTime(credential.issuedAt)) {
    errors.push('issuedAt must be a valid ISO 8601 date-time string.');
  }

  if (!isValidIsoDateTime(credential.expiresAt)) {
    errors.push('expiresAt must be a valid ISO 8601 date-time string.');
  } else if (isValidIsoDateTime(credential.issuedAt)) {
    if (new Date(credential.expiresAt) <= new Date(credential.issuedAt)) {
      errors.push('expiresAt must be strictly after issuedAt.');
    }
  }

  if (!credential.revocation || typeof credential.revocation !== 'object') {
    errors.push('revocation metadata object is required.');
  } else {
    if (typeof credential.revocation.statusListUrl !== 'string' || !credential.revocation.statusListUrl.trim()) {
      errors.push('revocation.statusListUrl must be a non-empty string.');
    }
    if (!Number.isInteger(credential.revocation.statusListIndex) || credential.revocation.statusListIndex < 0) {
      errors.push('revocation.statusListIndex must be a non-negative integer.');
    }
  }

  if (!credential.commitments || typeof credential.commitments !== 'object' || Array.isArray(credential.commitments)) {
    errors.push('commitments must be an object mapping attribute names to 64-character hex digests.');
  } else {
    const keys = Object.keys(credential.commitments);
    if (keys.length === 0) {
      errors.push('commitments must contain at least one attribute commitment.');
    }
    for (const key of keys) {
      const commit = credential.commitments[key];
      if (typeof commit !== 'string' || !/^[a-f0-9]{64}$/i.test(commit)) {
        errors.push(`Commitment for attribute "${key}" must be a 64-character hex string.`);
      }
    }
  }

  if (typeof credential.issuerSignature !== 'string' || !credential.issuerSignature.trim()) {
    errors.push('issuerSignature must be a non-empty string.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Verifier Policy Request.
 *
 * @param {unknown} policy
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePolicyRequest(policy) {
  const errors = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return { valid: false, errors: ['Policy request must be a non-null object.'] };
  }

  if (policy.schemaVersion !== ZK_POLICY_SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion: expected "${ZK_POLICY_SCHEMA_VERSION}".`);
  }

  if (typeof policy.policyId !== 'string' || !policy.policyId.trim()) {
    errors.push('policyId must be a non-empty string.');
  }

  if (typeof policy.nonce !== 'string' || policy.nonce.length < 16) {
    errors.push('nonce must be a cryptographic challenge string with at least 16 characters.');
  }

  if (!isValidIsoDateTime(policy.issuedAt)) {
    errors.push('issuedAt must be a valid ISO 8601 date-time string.');
  }

  if (!isValidIsoDateTime(policy.validUntil)) {
    errors.push('validUntil must be a valid ISO 8601 date-time string.');
  } else if (isValidIsoDateTime(policy.issuedAt)) {
    if (new Date(policy.validUntil) <= new Date(policy.issuedAt)) {
      errors.push('validUntil must be strictly after issuedAt.');
    }
  }

  if (!Array.isArray(policy.requiredPredicates) || policy.requiredPredicates.length === 0) {
    errors.push('requiredPredicates must be a non-empty array of predicate objects.');
  } else {
    policy.requiredPredicates.forEach((pred, idx) => {
      if (!pred || typeof pred !== 'object') {
        errors.push(`Predicate at index ${idx} must be an object.`);
        return;
      }
      if (typeof pred.attribute !== 'string' || !pred.attribute.trim()) {
        errors.push(`Predicate at index ${idx} must specify an attribute name.`);
      }
      if (!PREDICATE_OPERATORS.includes(pred.operator)) {
        errors.push(
          `Predicate at index ${idx} has invalid operator "${pred.operator}". Allowed: ${PREDICATE_OPERATORS.join(', ')}.`
        );
      }
      if (pred.operator === 'in') {
        if (!Array.isArray(pred.allowedValues) || pred.allowedValues.length === 0) {
          errors.push(`Predicate at index ${idx} with "in" operator requires a non-empty allowedValues array.`);
        }
      } else if (['gte', 'gt', 'lte', 'lt'].includes(pred.operator)) {
        if (typeof pred.threshold !== 'number' || Number.isNaN(pred.threshold)) {
          errors.push(`Predicate at index ${idx} with operator "${pred.operator}" requires a numeric threshold.`);
        }
      } else if (pred.operator === 'eq') {
        if (pred.targetValue === undefined || pred.targetValue === null) {
          errors.push(`Predicate at index ${idx} with "eq" operator requires targetValue.`);
        }
      }
    });
  }

  if (!Array.isArray(policy.trustedIssuers) || policy.trustedIssuers.length === 0) {
    errors.push('trustedIssuers must be a non-empty array of trusted issuer IDs.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Zero-Knowledge Proof Payload.
 *
 * @param {unknown} proof
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProofPayload(proof) {
  const errors = [];
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
    return { valid: false, errors: ['Proof payload must be a non-null object.'] };
  }

  if (proof.schemaVersion !== ZK_PROOF_SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion: expected "${ZK_PROOF_SCHEMA_VERSION}".`);
  }

  if (typeof proof.policyId !== 'string' || !proof.policyId.trim()) {
    errors.push('policyId must be a non-empty string.');
  }

  if (typeof proof.nonce !== 'string' || !proof.nonce.trim()) {
    errors.push('nonce must be a non-empty string matching the verifier challenge.');
  }

  if (!isValidIsoDateTime(proof.timestamp)) {
    errors.push('timestamp must be a valid ISO 8601 date-time string.');
  }

  if (typeof proof.issuerId !== 'string' || !proof.issuerId.trim()) {
    errors.push('issuerId must be a non-empty string.');
  }

  if (typeof proof.credentialId !== 'string' || !proof.credentialId.trim()) {
    errors.push('credentialId must be a non-empty string.');
  }

  if (!proof.disclosedCommitments || typeof proof.disclosedCommitments !== 'object') {
    errors.push('disclosedCommitments must be an object.');
  }

  if (!proof.predicateProofs || typeof proof.predicateProofs !== 'object') {
    errors.push('predicateProofs must be an object containing mathematical predicate proofs.');
  }

  if (!proof.revocationWitness || typeof proof.revocationWitness !== 'object') {
    errors.push('revocationWitness object is required.');
  } else {
    if (!Number.isInteger(proof.revocationWitness.statusListIndex) || proof.revocationWitness.statusListIndex < 0) {
      errors.push('revocationWitness.statusListIndex must be a non-negative integer.');
    }
  }

  if (typeof proof.issuerSignature !== 'string' || !proof.issuerSignature.trim()) {
    errors.push('issuerSignature must be a non-empty string.');
  }

  if (typeof proof.proofSignature !== 'string' || !proof.proofSignature.trim()) {
    errors.push('proofSignature must be a non-empty string.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a Verification Result.
 *
 * @param {unknown} result
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateVerificationResult(result) {
  const errors = [];
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { valid: false, errors: ['Verification result must be a non-null object.'] };
  }

  if (result.schemaVersion !== ZK_VERIFICATION_SCHEMA_VERSION) {
    errors.push(`Invalid schemaVersion: expected "${ZK_VERIFICATION_SCHEMA_VERSION}".`);
  }

  if (typeof result.verified !== 'boolean') {
    errors.push('verified must be a boolean.');
  }

  if (typeof result.policyId !== 'string' || !result.policyId.trim()) {
    errors.push('policyId must be a non-empty string.');
  }

  if (!isValidIsoDateTime(result.timestamp)) {
    errors.push('timestamp must be a valid ISO 8601 date-time string.');
  }

  if (!result.checks || typeof result.checks !== 'object') {
    errors.push('checks detail object is required.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Synthetic Test Personas (Strictly zero real PII).
 * Designed for reproducible evaluation and unit/integration testing.
 */
export const SYNTHETIC_TEST_PERSONAS = Object.freeze({
  SENIOR_CITIZEN_CHENNAI: {
    id: 'synthetic-user-senior-chennai',
    label: 'Synthetic Senior Citizen (Age 64, Chennai)',
    attributes: {
      birthDate: '1962-04-10',
      'jurisdiction.state': 'Tamil Nadu',
      'jurisdiction.district': 'Chennai',
      'jurisdiction.ward': '174',
      incomeCategory: 'low-income',
    },
  },
  ADULT_TIRUVALLUR: {
    id: 'synthetic-user-adult-tiruvallur',
    label: 'Synthetic Adult Citizen (Age 28, Tiruvallur)',
    attributes: {
      birthDate: '1998-08-22',
      'jurisdiction.state': 'Tamil Nadu',
      'jurisdiction.district': 'Tiruvallur',
      'jurisdiction.ward': '012',
      incomeCategory: 'middle-income',
    },
  },
  MINOR_RESIDENT: {
    id: 'synthetic-user-minor',
    label: 'Synthetic Minor Resident (Age 15, Chennai)',
    attributes: {
      birthDate: '2011-02-14',
      'jurisdiction.state': 'Tamil Nadu',
      'jurisdiction.district': 'Chennai',
      'jurisdiction.ward': '174',
      incomeCategory: 'dependent',
    },
  },
  OUT_OF_STATE_RESIDENT: {
    id: 'synthetic-user-out-of-state',
    label: 'Synthetic Out-of-State Citizen (Age 45, Bengaluru)',
    attributes: {
      birthDate: '1981-11-05',
      'jurisdiction.state': 'Karnataka',
      'jurisdiction.district': 'Bengaluru Urban',
      'jurisdiction.ward': '085',
      incomeCategory: 'middle-income',
    },
  },
});
