/**
 * Temporal Policy Storage Service (#1155)
 *
 * Provides persistent storage for effective-dated civic rules and immutable
 * historical decision evaluation snapshots with resilient in-memory fallback.
 */

import { JURISDICTION_LEVELS, RULE_STATUS } from './temporalPolicyEngineService.js';

const STORAGE_KEY_RULES = 'civicbridge_temporal_rules_v1';
const STORAGE_KEY_SNAPSHOTS = 'civicbridge_temporal_snapshots_v1';

const inMemoryStore = new Map();

const safeGetItem = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    }
    if (inMemoryStore.has(key)) {
      return inMemoryStore.get(key);
    }
    return fallback;
  } catch (err) {
    console.warn(`[temporalPolicyStorage] Error reading ${key}:`, err);
    return fallback;
  }
};

const safeSetItem = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
    inMemoryStore.set(key, JSON.parse(JSON.stringify(value)));
  } catch (err) {
    console.warn(`[temporalPolicyStorage] Error saving ${key}:`, err);
  }
};

export const INITIAL_SEED_RULES = [
  // 1. Maharashtra EWS Certificate Timeline
  {
    id: 'rule_ews_mh_2019_v1',
    ruleFamilyId: 'scheme_ews_certificate',
    title: 'Maharashtra EWS Certificate (2019 Base Gazette)',
    version: '1.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-MH',
    jurisdictionName: 'Maharashtra',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2019-02-01T00:00:00.000Z',
    effectiveTo: '2022-03-31T23:59:59.999Z',
    supersedesRuleId: null,
    supersededByRuleId: 'rule_ews_mh_2022_v2',
    conditions: [
      {
        id: 'cond_income_2019',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 800000,
        unit: 'INR',
        description: 'Gross annual family income must not exceed ₹8,00,000/-',
      },
      {
        id: 'cond_agri_land_2019',
        field: 'agriculturalLandAcres',
        operator: 'LESS_THAN',
        value: 5,
        unit: 'ACRE',
        description: 'Agricultural land holding must be strictly less than 5 acres',
      },
    ],
    feeStructure: { amount: 20, currency: 'INR', concessionAvailable: false },
    requiredDocuments: [
      { documentCode: 'income_cert', title: 'Competent Authority Income Certificate', mandatory: true },
      { documentCode: 'land_extract', title: '7/12 Land Record Extract', mandatory: true },
      { documentCode: 'residence_proof', title: 'Proof of Maharashtra Domicile', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'GAZETTE_NOTIFICATION',
      notificationNumber: 'G.O.Ms.No. 12/2019/REV-4',
      issuingAuthority: 'Revenue and Forest Department, Government of Maharashtra',
      gazetteDate: '2019-01-28',
      citationUrl: 'https://egazette.mahaonline.gov.in/Forms/GazetteSearch.aspx',
      isVerified: true,
    },
    status: RULE_STATUS.SUPERSEDED,
    createdAt: '2019-01-28T00:00:00.000Z',
    updatedAt: '2022-04-01T00:00:00.000Z',
  },
  {
    id: 'rule_ews_mh_2022_v2',
    ruleFamilyId: 'scheme_ews_certificate',
    title: 'Maharashtra EWS Certificate (2022 Statutory Amendment)',
    version: '2.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-MH',
    jurisdictionName: 'Maharashtra',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2022-04-01T00:00:00.000Z',
    effectiveTo: '2025-02-28T23:59:59.999Z',
    supersedesRuleId: 'rule_ews_mh_2019_v1',
    supersededByRuleId: 'rule_ews_mh_2025_v3',
    conditions: [
      {
        id: 'cond_income_2022',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 800000,
        unit: 'INR',
        description: 'Gross annual family income must not exceed ₹8,00,000/-',
      },
      {
        id: 'cond_agri_land_2022',
        field: 'agriculturalLandAcres',
        operator: 'LESS_THAN',
        value: 5,
        unit: 'ACRE',
        description: 'Agricultural land holding must be strictly less than 5 acres',
      },
      {
        id: 'cond_urban_plot_2022',
        field: 'residentialPlotSqYards',
        operator: 'LESS_THAN',
        value: 200,
        unit: 'SQ_YARDS',
        description: 'Residential plot in notified municipalities must be under 200 sq yards',
      },
    ],
    feeStructure: { amount: 35, currency: 'INR', concessionAvailable: true, concessionDetails: 'BPL Cardholders exempt from user fees' },
    requiredDocuments: [
      { documentCode: 'income_cert', title: 'Competent Authority Income Certificate', mandatory: true },
      { documentCode: 'land_extract', title: '7/12 Land Record Extract', mandatory: true },
      { documentCode: 'property_tax_receipt', title: 'Municipal Property Assessment Extract', mandatory: true },
      { documentCode: 'self_affidavit', title: 'Affidavit on Non-Creamy / Non-Ownership', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'GAZETTE_NOTIFICATION',
      notificationNumber: 'G.O.Ms.No. 42/2022/REV-EWS',
      issuingAuthority: 'Revenue and Forest Department, Government of Maharashtra',
      gazetteDate: '2022-03-24',
      citationUrl: 'https://egazette.mahaonline.gov.in/Forms/GazetteSearch.aspx',
      isVerified: true,
    },
    status: RULE_STATUS.SUPERSEDED,
    createdAt: '2022-03-25T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
  },
  {
    id: 'rule_ews_mh_2025_v3',
    ruleFamilyId: 'scheme_ews_certificate',
    title: 'Maharashtra EWS Certificate (2025 Digital Governance Regime)',
    version: '3.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-MH',
    jurisdictionName: 'Maharashtra',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2025-03-01T00:00:00.000Z',
    effectiveTo: null, // Active open-ended
    supersedesRuleId: 'rule_ews_mh_2022_v2',
    supersededByRuleId: null,
    conditions: [
      {
        id: 'cond_income_2025',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 800000,
        unit: 'INR',
        description: 'Gross annual family income must not exceed ₹8,00,000/-',
      },
      {
        id: 'cond_agri_land_2025',
        field: 'agriculturalLandAcres',
        operator: 'LESS_THAN',
        value: 5,
        unit: 'ACRE',
        description: 'Agricultural land holding must be strictly less than 5 acres',
      },
      {
        id: 'cond_urban_plot_2025',
        field: 'residentialPlotSqYards',
        operator: 'LESS_THAN',
        value: 200,
        unit: 'SQ_YARDS',
        description: 'Residential plot in notified municipalities must be under 200 sq yards',
      },
      {
        id: 'cond_aadhaar_seed_2025',
        field: 'aadhaarSeededBankAccount',
        operator: 'EQUALS',
        value: true,
        description: 'Applicant must have an active Aadhaar-seeded bank account for DBT and validation',
      },
    ],
    feeStructure: { amount: 50, currency: 'INR', concessionAvailable: true, concessionDetails: 'Paperless digital portal statutory fee' },
    requiredDocuments: [
      { documentCode: 'income_cert_digital', title: 'DigiLocker Digitally Signed Income Certificate', mandatory: true },
      { documentCode: 'property_tax_receipt', title: 'Municipal Property Assessment Extract', mandatory: true },
      { documentCode: 'aadhaar_auth_ack', title: 'Aadhaar Demographic Verification Consent', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'GAZETTE_NOTIFICATION',
      notificationNumber: 'G.O.Ms.No. 08/2025/DIGITAL-GOV',
      issuingAuthority: 'Revenue and Forest Department, Government of Maharashtra',
      gazetteDate: '2025-02-18',
      citationUrl: 'https://egazette.mahaonline.gov.in/Forms/GazetteSearch.aspx',
      isVerified: true,
    },
    status: RULE_STATUS.PUBLISHED,
    createdAt: '2025-02-20T00:00:00.000Z',
    updatedAt: '2025-02-20T00:00:00.000Z',
  },

  // 2. Delhi Senior Citizen Financial Assistance Timeline
  {
    id: 'rule_sen_pension_dl_2018_v1',
    ruleFamilyId: 'scheme_senior_pension',
    title: 'Delhi Senior Citizen Monthly Assistance (2018 Scheme)',
    version: '1.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-DL',
    jurisdictionName: 'Delhi',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2018-01-01T00:00:00.000Z',
    effectiveTo: '2021-06-30T23:59:59.999Z',
    supersedesRuleId: null,
    supersededByRuleId: 'rule_sen_pension_dl_2021_v2',
    conditions: [
      {
        id: 'cond_age_2018',
        field: 'age',
        operator: 'GREATER_THAN_OR_EQUAL',
        value: 60,
        unit: 'YEARS',
        description: 'Applicant must be at least 60 years of age',
      },
      {
        id: 'cond_income_2018',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 100000,
        unit: 'INR',
        description: 'Annual family income must not exceed ₹1,00,000/-',
      },
      {
        id: 'cond_residence_2018',
        field: 'residenceYears',
        operator: 'GREATER_THAN_OR_EQUAL',
        value: 5,
        unit: 'YEARS',
        description: 'Continuous residence in NCT of Delhi for at least 5 years',
      },
    ],
    feeStructure: { amount: 0, currency: 'INR', concessionAvailable: false },
    requiredDocuments: [
      { documentCode: 'age_proof', title: 'Voter ID or Birth Certificate for Age', mandatory: true },
      { documentCode: 'residence_proof', title: '5-Year Proof of Residence in Delhi', mandatory: true },
      { documentCode: 'income_declaration', title: 'Self-Income Declaration with MLA / Councillor Attestation', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'STATUTORY_CIRCULAR',
      notificationNumber: 'F.31(18)/DSW/FAS/2018/1420',
      issuingAuthority: 'Department of Social Welfare, Government of NCT of Delhi',
      gazetteDate: '2017-12-20',
      isVerified: true,
    },
    status: RULE_STATUS.SUPERSEDED,
    createdAt: '2018-01-01T00:00:00.000Z',
    updatedAt: '2021-07-01T00:00:00.000Z',
  },
  {
    id: 'rule_sen_pension_dl_2021_v2',
    ruleFamilyId: 'scheme_senior_pension',
    title: 'Delhi Senior Citizen Monthly Assistance (2021 Revised Eligibility)',
    version: '2.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-DL',
    jurisdictionName: 'Delhi',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2021-07-01T00:00:00.000Z',
    effectiveTo: null, // Active
    supersedesRuleId: 'rule_sen_pension_dl_2018_v1',
    supersededByRuleId: null,
    conditions: [
      {
        id: 'cond_age_2021',
        field: 'age',
        operator: 'GREATER_THAN_OR_EQUAL',
        value: 60,
        unit: 'YEARS',
        description: 'Applicant must be at least 60 years of age',
      },
      {
        id: 'cond_income_2021',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 200000,
        unit: 'INR',
        description: 'Revised annual family income ceiling raised to ₹2,00,000/-',
      },
      {
        id: 'cond_residence_2021',
        field: 'residenceYears',
        operator: 'GREATER_THAN_OR_EQUAL',
        value: 3,
        unit: 'YEARS',
        description: 'Relaxed residence requirement in NCT of Delhi to 3 years',
      },
    ],
    feeStructure: { amount: 0, currency: 'INR', concessionAvailable: false },
    requiredDocuments: [
      { documentCode: 'age_proof', title: 'Aadhaar / Voter ID showing Date of Birth', mandatory: true },
      { documentCode: 'bank_passbook', title: 'Single Bank Account Passbook seeded with Aadhaar', mandatory: true },
      { documentCode: 'residence_proof', title: 'Electricity bill / Ration card showing 3 years residence', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'STATUTORY_CIRCULAR',
      notificationNumber: 'F.31(25)/DSW/FAS/2021/8801',
      issuingAuthority: 'Department of Social Welfare, Government of NCT of Delhi',
      gazetteDate: '2021-06-15',
      isVerified: true,
    },
    status: RULE_STATUS.PUBLISHED,
    createdAt: '2021-06-18T00:00:00.000Z',
    updatedAt: '2021-06-18T00:00:00.000Z',
  },

  // 3. Central Baseline Scheme (Fallback)
  {
    id: 'rule_ews_central_2019_v1',
    ruleFamilyId: 'scheme_ews_certificate',
    title: 'Central Government EWS Income & Asset Criteria (Baseline)',
    version: '1.0.0',
    jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
    jurisdictionCode: 'CENTRAL',
    jurisdictionName: 'Union Government of India',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2019-01-15T00:00:00.000Z',
    effectiveTo: null,
    supersedesRuleId: null,
    supersededByRuleId: null,
    conditions: [
      {
        id: 'cond_central_income',
        field: 'annualFamilyIncome',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 800000,
        unit: 'INR',
        description: 'Central criterion: Family income below ₹8,00,000/-',
      },
    ],
    feeStructure: { amount: 0, currency: 'INR', concessionAvailable: false },
    requiredDocuments: [
      { documentCode: 'income_cert', title: 'Income & Asset Certificate for EWS', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'EXECUTIVE_ORDER',
      notificationNumber: 'DoPT OM No. 36039/1/2019-Estt (Res)',
      issuingAuthority: 'Ministry of Personnel, Public Grievances and Pensions',
      gazetteDate: '2019-01-31',
      isVerified: true,
    },
    status: RULE_STATUS.PUBLISHED,
    createdAt: '2019-01-31T00:00:00.000Z',
    updatedAt: '2019-01-31T00:00:00.000Z',
  },

  // 4. Intentional Unverified Rule (For testing epistemic humility guardrail)
  {
    id: 'rule_draft_unverified_scheme_v1',
    ruleFamilyId: 'scheme_solar_subsidy',
    title: 'Proposed Rooftop Solar Concession (Unverified Draft)',
    version: '0.9.0',
    jurisdictionLevel: JURISDICTION_LEVELS.STATE,
    jurisdictionCode: 'IN-KA',
    jurisdictionName: 'Karnataka',
    eventDateType: 'APPLICATION_DATE',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    supersedesRuleId: null,
    supersededByRuleId: null,
    conditions: [
      {
        id: 'cond_solar_kw',
        field: 'rooftopCapacityKw',
        operator: 'GREATER_THAN_OR_EQUAL',
        value: 3,
        unit: 'KW',
        description: 'Installed solar system capacity must be at least 3 kW',
      },
    ],
    feeStructure: { amount: 100, currency: 'INR', concessionAvailable: false },
    requiredDocuments: [
      { documentCode: 'discom_sanction', title: 'DISCOM Feasibility Report', mandatory: true },
    ],
    sourceMetadata: {
      documentType: 'EXECUTIVE_ORDER',
      notificationNumber: 'UNVERIFIED-DRAFT-2026',
      issuingAuthority: 'Energy Department, Government of Karnataka',
      gazetteDate: '2026-01-01',
      isVerified: false, // Intentionally unverified
      verificationNotes: 'Pending official publication in the Karnataka State Gazette',
    },
    status: RULE_STATUS.DRAFT,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * Retrieves all stored temporal rules (or initializes with seeds)
 */
export function getStoredRules() {
  const rules = safeGetItem(STORAGE_KEY_RULES, null);
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    safeSetItem(STORAGE_KEY_RULES, INITIAL_SEED_RULES);
    return INITIAL_SEED_RULES;
  }
  return rules;
}

/**
 * Saves or updates a rule in storage
 */
export function saveStoredRule(rule) {
  const current = getStoredRules();
  const index = current.findIndex((r) => r.id === rule.id);
  let updated;
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...rule, updatedAt: new Date().toISOString() };
  } else {
    updated = [...current, { ...rule, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
  }
  safeSetItem(STORAGE_KEY_RULES, updated);
  return updated;
}

/**
 * Resets rules to the initial seed dataset
 */
export function resetRulesToDefault() {
  safeSetItem(STORAGE_KEY_RULES, INITIAL_SEED_RULES);
  return INITIAL_SEED_RULES;
}

/**
 * Retrieves all historical evaluation snapshots
 */
export function getStoredEvaluationSnapshots() {
  return safeGetItem(STORAGE_KEY_SNAPSHOTS, []);
}

/**
 * Appends an immutable evaluation snapshot to historical records
 */
export function saveEvaluationSnapshotRecord(snapshot) {
  if (!snapshot || !snapshot.evaluationId) return null;
  const current = getStoredEvaluationSnapshots();
  const updated = [snapshot, ...current].slice(0, 100); // Keep latest 100 snapshots
  safeSetItem(STORAGE_KEY_SNAPSHOTS, updated);
  return snapshot;
}

/**
 * Clears evaluation snapshots
 */
export function clearEvaluationSnapshots() {
  safeSetItem(STORAGE_KEY_SNAPSHOTS, []);
}
