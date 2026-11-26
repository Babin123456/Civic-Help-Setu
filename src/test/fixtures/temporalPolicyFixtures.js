/**
 * Synthetic Test Fixtures for Temporal Policy Engine (#1155)
 *
 * Strictly synthetic test fixtures with zero real citizen records, credentials,
 * or PII. Used for unit, integration, and what-if simulation testing.
 */

import { JURISDICTION_LEVELS, RULE_STATUS } from '../../services/temporalPolicyEngineService';

export const SYNTHETIC_EWS_PROGRESSION_RULES = [
  {
    id: 'syn_rule_ews_v1',
    ruleFamilyId: 'syn_scheme_ews',
    title: 'Synthetic EWS Scheme (Phase 1 Baseline)',
    version: '1.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-TEST',
    jurisdictionName: 'Synthetic Test State',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2018-01-01T00:00:00.000Z',
    effectiveTo: '2021-03-31T23:59:59.999Z',
    supersedesRuleId: null,
    supersededByRuleId: 'syn_rule_ews_v2',
    conditions: [
      {
        id: 'cond_income_v1',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 600000,
        unit: 'INR',
        description: 'Family income <= 6,00,000',
      },
      {
        id: 'cond_land_v1',
        field: 'agriculturalLandAcres',
        operator: 'LESS_THAN',
        value: 5,
        unit: 'ACRE',
        description: 'Agricultural land < 5 acres',
      },
    ],
    feeStructure: { amount: 20, currency: 'INR', concessionAvailable: false },
    requiredDocuments: [
      { documentCode: 'doc_income_v1', title: 'Income Certificate', mandatory: true },
      { documentCode: 'doc_land_v1', title: 'Land Ownership Document', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'GAZETTE_NOTIFICATION',
      notificationNumber: 'SYN-GAZ-2018-01',
      issuingAuthority: 'Department of Revenue, Synthetic State',
      gazetteDate: '2017-12-15',
      isVerified: true,
    },
    status: RULE_STATUS.SUPERSEDED,
  },
  {
    id: 'syn_rule_ews_v2',
    ruleFamilyId: 'syn_scheme_ews',
    title: 'Synthetic EWS Scheme (Phase 2 Revised Thresholds)',
    version: '2.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-TEST',
    jurisdictionName: 'Synthetic Test State',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2021-04-01T00:00:00.000Z',
    effectiveTo: '2024-03-31T23:59:59.999Z',
    supersedesRuleId: 'syn_rule_ews_v1',
    supersededByRuleId: 'syn_rule_ews_v3',
    conditions: [
      {
        id: 'cond_income_v2',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 800000,
        unit: 'INR',
        description: 'Family income <= 8,00,000',
      },
      {
        id: 'cond_land_v2',
        field: 'agriculturalLandAcres',
        operator: 'LESS_THAN',
        value: 5,
        unit: 'ACRE',
        description: 'Agricultural land < 5 acres',
      },
    ],
    feeStructure: { amount: 35, currency: 'INR', concessionAvailable: true },
    requiredDocuments: [
      { documentCode: 'doc_income_v2', title: 'Digitized Income Certificate', mandatory: true },
      { documentCode: 'doc_land_v2', title: '7/12 Extract', mandatory: true },
      { documentCode: 'doc_affidavit_v2', title: 'Non-Creamy Layer Self-Affidavit', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'GAZETTE_NOTIFICATION',
      notificationNumber: 'SYN-GAZ-2021-42',
      issuingAuthority: 'Department of Revenue, Synthetic State',
      gazetteDate: '2021-03-20',
      isVerified: true,
    },
    status: RULE_STATUS.SUPERSEDED,
  },
  {
    id: 'syn_rule_ews_v3',
    ruleFamilyId: 'syn_scheme_ews',
    title: 'Synthetic EWS Scheme (Phase 3 Active Digital Era)',
    version: '3.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-TEST',
    jurisdictionName: 'Synthetic Test State',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2024-04-01T00:00:00.000Z',
    effectiveTo: null, // Active
    supersedesRuleId: 'syn_rule_ews_v2',
    supersededByRuleId: null,
    conditions: [
      {
        id: 'cond_income_v3',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 800000,
        unit: 'INR',
        description: 'Family income <= 8,00,000',
      },
      {
        id: 'cond_land_v3',
        field: 'agriculturalLandAcres',
        operator: 'LESS_THAN',
        value: 5,
        unit: 'ACRE',
        description: 'Agricultural land < 5 acres',
      },
      {
        id: 'cond_digi_consent_v3',
        field: 'aadhaarSeededBankAccount',
        operator: 'EQUALS',
        value: true,
        description: 'Aadhaar-seeded bank account verified',
      },
    ],
    feeStructure: { amount: 50, currency: 'INR', concessionAvailable: true },
    requiredDocuments: [
      { documentCode: 'doc_income_v3', title: 'DigiLocker Verified Income Certificate', mandatory: true },
      { documentCode: 'doc_land_v3', title: 'RoR Digital Extract', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'GAZETTE_NOTIFICATION',
      notificationNumber: 'SYN-GAZ-2024-08',
      issuingAuthority: 'Department of Revenue, Synthetic State',
      gazetteDate: '2024-03-15',
      isVerified: true,
    },
    status: RULE_STATUS.PUBLISHED,
  },
];

export const SYNTHETIC_GAP_RULES = [
  {
    id: 'syn_gap_rule_a',
    ruleFamilyId: 'syn_gap_scheme',
    title: 'Gap Scheme Part A',
    version: '1.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-GAP',
    effectiveFrom: '2020-01-01T00:00:00.000Z',
    effectiveTo: '2021-06-30T23:59:59.999Z',
    conditions: [],
    sourceMetadata: {
      documentType: 'STATUTORY_CIRCULAR',
      issuingAuthority: 'Gap Authority',
      notificationNumber: 'GAP-01',
      isVerified: true,
    },
    status: RULE_STATUS.SUPERSEDED,
  },
  {
    id: 'syn_gap_rule_b',
    ruleFamilyId: 'syn_gap_scheme',
    title: 'Gap Scheme Part B',
    version: '2.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-GAP',
    // 6-month gap between 2021-07-01 and 2021-12-31
    effectiveFrom: '2022-01-01T00:00:00.000Z',
    effectiveTo: null,
    conditions: [],
    sourceMetadata: {
      documentType: 'STATUTORY_CIRCULAR',
      issuingAuthority: 'Gap Authority',
      notificationNumber: 'GAP-02',
      isVerified: true,
    },
    status: RULE_STATUS.PUBLISHED,
  },
];

export const SYNTHETIC_CONFLICT_RULES = [
  {
    id: 'syn_conflict_rule_1',
    ruleFamilyId: 'syn_conflict_scheme',
    title: 'Conflicting Rule Variant 1',
    version: '1.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-CONF',
    effectiveFrom: '2022-01-01T00:00:00.000Z',
    effectiveTo: '2025-12-31T23:59:59.999Z',
    supersedesRuleId: null,
    supersededByRuleId: null,
    conditions: [],
    sourceMetadata: {
      documentType: 'EXECUTIVE_ORDER',
      issuingAuthority: 'Conflicting Board A',
      notificationNumber: 'CONF-01',
      isVerified: true,
    },
    status: RULE_STATUS.PUBLISHED,
  },
  {
    id: 'syn_conflict_rule_2',
    ruleFamilyId: 'syn_conflict_scheme',
    title: 'Conflicting Rule Variant 2',
    version: '1.1.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-CONF',
    effectiveFrom: '2023-01-01T00:00:00.000Z',
    effectiveTo: '2026-12-31T23:59:59.999Z',
    supersedesRuleId: null,
    supersededByRuleId: null,
    conditions: [],
    sourceMetadata: {
      documentType: 'EXECUTIVE_ORDER',
      issuingAuthority: 'Conflicting Board B',
      notificationNumber: 'CONF-02',
      isVerified: true,
    },
    status: RULE_STATUS.PUBLISHED,
  },
];

export const SYNTHETIC_CYCLIC_RULES = [
  {
    id: 'syn_cycle_1',
    ruleFamilyId: 'syn_cycle_scheme',
    version: '1.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-TEST',
    effectiveFrom: '2020-01-01T00:00:00.000Z',
    effectiveTo: '2021-01-01T00:00:00.000Z',
    supersedesRuleId: 'syn_cycle_2',
    conditions: [],
    sourceMetadata: { documentType: 'CIRCULAR', issuingAuthority: 'Board', isVerified: true },
    status: RULE_STATUS.PUBLISHED,
  },
  {
    id: 'syn_cycle_2',
    ruleFamilyId: 'syn_cycle_scheme',
    version: '2.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-TEST',
    effectiveFrom: '2021-01-01T00:00:00.000Z',
    effectiveTo: '2022-01-01T00:00:00.000Z',
    supersedesRuleId: 'syn_cycle_3',
    conditions: [],
    sourceMetadata: { documentType: 'CIRCULAR', issuingAuthority: 'Board', isVerified: true },
    status: RULE_STATUS.PUBLISHED,
  },
  {
    id: 'syn_cycle_3',
    ruleFamilyId: 'syn_cycle_scheme',
    version: '3.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-TEST',
    effectiveFrom: '2022-01-01T00:00:00.000Z',
    effectiveTo: '2023-01-01T00:00:00.000Z',
    supersedesRuleId: 'syn_cycle_1', // Creates 1 -> 2 -> 3 -> 1 cycle
    conditions: [],
    sourceMetadata: { documentType: 'CIRCULAR', issuingAuthority: 'Board', isVerified: true },
    status: RULE_STATUS.PUBLISHED,
  },
];

export const SYNTHETIC_UNVERIFIED_RULE = {
  id: 'syn_unverified_rule',
  ruleFamilyId: 'syn_unverified_scheme',
  version: '1.0.0',
  jurisdictionLevel: JURISDICTION_LEVELS.STATE,
  jurisdictionCode: 'IN-TEST',
  effectiveFrom: '2024-01-01T00:00:00.000Z',
  effectiveTo: null,
  conditions: [
    { field: 'annualFamilyIncome', operator: 'LESS_THAN_OR_EQUAL', value: 500000 },
  ],
  sourceMetadata: {
    documentType: 'DRAFT_NOTIFICATION',
    issuingAuthority: 'Unverified Test Agency',
    notificationNumber: 'UNVERIFIED-001',
    isVerified: false, // Explicitly unverified
  },
  status: RULE_STATUS.DRAFT,
};

export const SYNTHETIC_CITIZEN_CASES = {
  ELIGIBLE_V1_AND_V2: {
    annualFamilyIncome: 450000,
    agriculturalLandAcres: 2.5,
    aadhaarSeededBankAccount: true,
  },
  ELIGIBLE_V2_ONLY: {
    // Income 7,50,000 exceeds v1 ceiling (6,00,000) but satisfies v2 & v3 (8,00,000)
    annualFamilyIncome: 750000,
    agriculturalLandAcres: 3.0,
    aadhaarSeededBankAccount: true,
  },
  INELIGIBLE_EXCESS_LAND: {
    annualFamilyIncome: 400000,
    agriculturalLandAcres: 6.5, // Exceeds 5-acre limit
    aadhaarSeededBankAccount: true,
  },
  MISSING_FACTS: {
    annualFamilyIncome: 500000,
    // agriculturalLandAcres omitted
  },
  PII_INFUSED_INPUT: {
    name: 'Citizen Test User',
    phone: '+919876543210',
    email: 'citizen@example.test',
    aadhaar: '1234-5678-9012',
    annualFamilyIncome: 500000,
    agriculturalLandAcres: 2.0,
    aadhaarSeededBankAccount: true,
  },
};
