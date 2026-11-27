/**
 * Synthetic, Privacy-Safe Seed Fixtures for Citizen Data Wallet (#1159)
 *
 * NOTE: These fixtures contain purely synthetic test identities.
 * NO real citizen PII, real Aadhaar numbers, real addresses, or actual documents are included.
 */

import { CREDENTIAL_SCHEMA_TYPES, TRUST_TIERS } from './walletContracts';

export const SEED_CREDENTIALS = [
  {
    id: 'cred_synth_residence_001',
    schemaType: CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF,
    title: 'Ward 12 Municipal Domicile Certificate',
    trustTier: TRUST_TIERS.SELF_ASSERTED,
    issuer: {
      id: 'issuer:citizen:self',
      name: 'Self-Declared Residence (Local Wallet)',
      disclaimer: 'Self-asserted citizen record. Not an official municipal registry extract.'
    },
    createdAt: '2026-11-20T10:00:00.000Z',
    claims: {
      fullName: 'Priya Sharma',
      locality: 'Shivaji Nagar, Sector 4',
      wardNumber: 'Ward 12',
      city: 'Pune',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411005',
      addressLine: 'Flat 402, Greenfield Meadows, Shivaji Nagar'
    }
  },
  {
    id: 'cred_synth_income_002',
    schemaType: CREDENTIAL_SCHEMA_TYPES.INCOME_AFFIDAVIT,
    title: 'Family Income & BPL Subsidy Eligibility',
    trustTier: TRUST_TIERS.COMMUNITY_VERIFIED,
    issuer: {
      id: 'issuer:community:ward-12-committee',
      name: 'Ward 12 Citizens Advisory Scrutiny Committee',
      disclaimer: 'Verified by local civic committee peer audit. Does not substitute for Tehsildar statutory certificate.'
    },
    createdAt: '2026-11-22T14:30:00.000Z',
    claims: {
      fullName: 'Priya Sharma',
      annualIncomeInr: 180000,
      isBplQualified: true,
      primaryOccupation: 'Small Business Vendor',
      householdSize: 4
    }
  },
  {
    id: 'cred_synth_age_003',
    schemaType: CREDENTIAL_SCHEMA_TYPES.AGE_IDENTITY_DECLARATION,
    title: 'Age Eligibility & Demographic Proof',
    trustTier: TRUST_TIERS.SELF_ASSERTED,
    issuer: {
      id: 'issuer:citizen:self',
      name: 'Self-Declared Age Proof (Local Wallet)',
      disclaimer: 'Self-asserted citizen record.'
    },
    createdAt: '2026-11-15T09:15:00.000Z',
    claims: {
      fullName: 'Priya Sharma',
      isOver18: true,
      isSeniorCitizen: false,
      gender: 'Female',
      dateOfBirth: '1996-08-14'
    }
  },
  {
    id: 'cred_synth_tax_004',
    schemaType: CREDENTIAL_SCHEMA_TYPES.MUNICIPAL_TAX_RECORD,
    title: 'Municipal Water & Property Tax Clearance',
    trustTier: TRUST_TIERS.CRYPTOGRAPHICALLY_ATTESTED,
    issuer: {
      id: 'issuer:civicbridge:mock-municipal-billing',
      name: 'Civic Help Setu Test Municipal Billing Gateway',
      disclaimer: 'Simulated digital signature for developer testing.'
    },
    createdAt: '2026-11-24T16:00:00.000Z',
    claims: {
      fullName: 'Priya Sharma',
      wardNumber: 'Ward 12',
      assessmentYear: '2025-2026',
      isDuesCleared: true,
      propertyAssessmentId: 'PROP-PN-W12-88219'
    }
  }
];

export const MOCK_RELYING_PARTIES = [
  {
    id: 'civicbridge:service:water-tanker-priority',
    name: 'Municipal Water Tanker Priority Subsidy',
    description: 'Requires proof of Ward Number and BPL Qualification.',
    requiredSchema: CREDENTIAL_SCHEMA_TYPES.INCOME_AFFIDAVIT,
    recommendedAttributes: ['fullName', 'isBplQualified', 'householdSize']
  },
  {
    id: 'civicbridge:service:trade-licence-fasttrack',
    name: 'Fast-Track Municipal Trade Licence',
    description: 'Requires proof of Adult Age (18+) and Local Ward Residence.',
    requiredSchema: CREDENTIAL_SCHEMA_TYPES.RESIDENCE_PROOF,
    recommendedAttributes: ['fullName', 'wardNumber', 'city', 'state']
  },
  {
    id: 'civicbridge:service:education-scholarship',
    name: 'District Welfare Merit Scholarship',
    description: 'Requires proof of Income Level and Local Residence.',
    requiredSchema: CREDENTIAL_SCHEMA_TYPES.INCOME_AFFIDAVIT,
    recommendedAttributes: ['fullName', 'isBplQualified', 'annualIncomeInr']
  }
];
