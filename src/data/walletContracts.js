/**
 * Core Domain Contracts and Schemas for Consent-Driven Citizen Data Wallet (#1159)
 *
 * Implements strict domain enums, verifiable credential metadata,
 * presentation payload validation, and DPDP-compliant consent receipt contracts.
 */

export const TRUST_TIERS = {
  SELF_ASSERTED: 'SELF_ASSERTED',
  COMMUNITY_VERIFIED: 'COMMUNITY_VERIFIED',
  CRYPTOGRAPHICALLY_ATTESTED: 'CRYPTOGRAPHICALLY_ATTESTED'
};

export const TRUST_TIER_DESCRIPTIONS = {
  SELF_ASSERTED: 'Entered and self-declared by the citizen. Unverified by third party.',
  COMMUNITY_VERIFIED: 'Attested by an authorized local civic community observer or ward committee.',
  CRYPTOGRAPHICALLY_ATTESTED: 'Signed and verified using genuine cryptographic public-key infrastructure.'
};

export const CREDENTIAL_SCHEMA_TYPES = {
  RESIDENCE_PROOF: 'RESIDENCE_PROOF',
  INCOME_AFFIDAVIT: 'INCOME_AFFIDAVIT',
  AGE_IDENTITY_DECLARATION: 'AGE_IDENTITY_DECLARATION',
  CASTE_CATEGORY_DECLARATION: 'CASTE_CATEGORY_DECLARATION',
  MUNICIPAL_TAX_RECORD: 'MUNICIPAL_TAX_RECORD'
};

export const CONSENT_STATUSES = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED'
};

export const STATUTORY_WALLET_DISCLAIMER =
  'This credential is self-managed in the citizen data wallet. It provides cryptographic proof of presentation integrity and data minimization. It does NOT claim statutory government authority, official DigiLocker verification, or guaranteed administrative approval unless cryptographically signed by the competent public issuing authority.';

export const CREDENTIAL_SCHEMA_DEFINITIONS = {
  [CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF]: {
    id: CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF,
    title: 'Local Residence Proof',
    description: 'Declaration of domicile, ward locality, and municipal jurisdiction.',
    attributes: [
      { key: 'fullName', label: 'Full Name', sensitive: false, type: 'string' },
      { key: 'locality', label: 'Locality / Area', sensitive: false, type: 'string' },
      { key: 'wardNumber', label: 'Ward Number', sensitive: false, type: 'string' },
      { key: 'city', label: 'City / Municipality', sensitive: false, type: 'string' },
      { key: 'district', label: 'District', sensitive: false, type: 'string' },
      { key: 'state', label: 'State', sensitive: false, type: 'string' },
      { key: 'pincode', label: 'PIN Code', sensitive: false, type: 'string' },
      { key: 'addressLine', label: 'Full Street Address', sensitive: true, type: 'string' }
    ]
  },
  [CREDENTIAL_SCHEMA_TYPES.INCOME_AFFIDAVIT]: {
    id: CREDENTIAL_SCHEMA_TYPES.INCOME_AFFIDAVIT,
    title: 'Income & Entitlement Declaration',
    description: 'Annual family income declaration and BPL economic qualification status.',
    attributes: [
      { key: 'fullName', label: 'Beneficiary Name', sensitive: false, type: 'string' },
      { key: 'annualIncomeInr', label: 'Annual Income (INR)', sensitive: true, type: 'number' },
      { key: 'isBplQualified', label: 'BPL Economic Qualification', sensitive: false, type: 'boolean' },
      { key: 'primaryOccupation', label: 'Primary Occupation', sensitive: false, type: 'string' },
      { key: 'householdSize', label: 'Total Household Members', sensitive: false, type: 'number' }
    ]
  },
  [CREDENTIAL_SCHEMA_TYPES.AGE_IDENTITY_DECLARATION]: {
    id: CREDENTIAL_SCHEMA_TYPES.AGE_IDENTITY_DECLARATION,
    title: 'Age & Identity Declaration',
    description: 'Basic demographic and age eligibility declaration.',
    attributes: [
      { key: 'fullName', label: 'Full Name', sensitive: false, type: 'string' },
      { key: 'isOver18', label: 'Adult (18+ Years)', sensitive: false, type: 'boolean' },
      { key: 'isSeniorCitizen', label: 'Senior Citizen (60+ Years)', sensitive: false, type: 'boolean' },
      { key: 'gender', label: 'Gender', sensitive: false, type: 'string' },
      { key: 'dateOfBirth', label: 'Date of Birth', sensitive: true, type: 'string' }
    ]
  },
  [CREDENTIAL_SCHEMA_TYPES.CASTE_CATEGORY_DECLARATION]: {
    id: CREDENTIAL_SCHEMA_TYPES.CASTE_CATEGORY_DECLARATION,
    title: 'Affirmative Action / Category Declaration',
    description: 'Social category declaration for welfare, reservation, and fee waiver schemes.',
    attributes: [
      { key: 'fullName', label: 'Full Name', sensitive: false, type: 'string' },
      { key: 'socialCategory', label: 'Social Category (General / OBC / SC / ST / EWS)', sensitive: false, type: 'string' },
      { key: 'subCaste', label: 'Sub-Caste / Community', sensitive: true, type: 'string' },
      { key: 'isNonCreamyLayer', label: 'Non-Creamy Layer Status', sensitive: false, type: 'boolean' }
    ]
  },
  [CREDENTIAL_SCHEMA_TYPES.MUNICIPAL_TAX_RECORD]: {
    id: CREDENTIAL_SCHEMA_TYPES.MUNICIPAL_TAX_RECORD,
    title: 'Municipal Property / Water Tax Record',
    description: 'Proof of municipal property tax or civic charges payment history.',
    attributes: [
      { key: 'fullName', label: 'Owner / Occupant Name', sensitive: false, type: 'string' },
      { key: 'wardNumber', label: 'Ward Number', sensitive: false, type: 'string' },
      { key: 'assessmentYear', label: 'Assessment Year', sensitive: false, type: 'string' },
      { key: 'isDuesCleared', label: 'Municipal Dues Fully Paid', sensitive: false, type: 'boolean' },
      { key: 'propertyAssessmentId', label: 'Property Assessment Number', sensitive: true, type: 'string' }
    ]
  }
};

/**
 * Validates a credential object structure before saving or importing.
 */
export function validateCredential(credential) {
  if (!credential || typeof credential !== 'object') {
    return { valid: false, error: 'Credential must be a valid non-null object' };
  }
  if (!credential.id || typeof credential.id !== 'string') {
    return { valid: false, error: 'Credential id is required' };
  }
  if (!credential.schemaType || !CREDENTIAL_SCHEMA_DEFINITIONS[credential.schemaType]) {
    return { valid: false, error: `Invalid or unsupported schemaType: ${credential.schemaType}` };
  }
  if (!credential.trustTier || !TRUST_TIERS[credential.trustTier]) {
    return { valid: false, error: `Invalid trustTier: ${credential.trustTier}` };
  }
  if (!credential.claims || typeof credential.claims !== 'object') {
    return { valid: false, error: 'Credential claims must be an object' };
  }
  if (!credential.createdAt || Number.isNaN(Date.parse(credential.createdAt))) {
    return { valid: false, error: 'Valid createdAt ISO timestamp is required' };
  }

  return { valid: true };
}

/**
 * Validates a Verifiable Presentation payload against required schema bounds.
 */
export function validatePresentationPayload(presentation) {
  if (!presentation || typeof presentation !== 'object') {
    return { valid: false, error: 'Presentation must be a valid object' };
  }
  if (!presentation.presentationId || typeof presentation.presentationId !== 'string') {
    return { valid: false, error: 'presentationId is required' };
  }
  if (!presentation.audience || typeof presentation.audience !== 'string') {
    return { valid: false, error: 'audience identifier is required' };
  }
  if (!presentation.nonce || typeof presentation.nonce !== 'string') {
    return { valid: false, error: 'nonce challenge is required' };
  }
  if (!presentation.validUntil || Number.isNaN(Date.parse(presentation.validUntil))) {
    return { valid: false, error: 'validUntil timestamp is required' };
  }
  if (!presentation.disclosedClaims || typeof presentation.disclosedClaims !== 'object') {
    return { valid: false, error: 'disclosedClaims object is required' };
  }
  if (!presentation.attributeCommitments || typeof presentation.attributeCommitments !== 'object') {
    return { valid: false, error: 'attributeCommitments object is required' };
  }
  if (!presentation.presentationDigest || typeof presentation.presentationDigest !== 'string') {
    return { valid: false, error: 'presentationDigest is required' };
  }

  return { valid: true };
}

/**
 * Validates a Consent Receipt payload under DPDP Act requirements.
 */
export function validateConsentReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') {
    return { valid: false, error: 'Consent receipt must be an object' };
  }
  if (!receipt.receiptId || typeof receipt.receiptId !== 'string') {
    return { valid: false, error: 'receiptId is required' };
  }
  if (!receipt.relyingParty || typeof receipt.relyingParty !== 'object') {
    return { valid: false, error: 'relyingParty details are required' };
  }
  if (!receipt.purpose || typeof receipt.purpose !== 'string') {
    return { valid: false, error: 'purpose specification is required' };
  }
  if (!Array.isArray(receipt.disclosedAttributes) || receipt.disclosedAttributes.length === 0) {
    return { valid: false, error: 'disclosedAttributes array must not be empty' };
  }
  if (!receipt.status || !CONSENT_STATUSES[receipt.status]) {
    return { valid: false, error: `Invalid consent status: ${receipt.status}` };
  }

  return { valid: true };
}
