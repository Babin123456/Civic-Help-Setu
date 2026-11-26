/**
 * Versioned Rule Graph Registry
 * Issue #1156: Explainable Eligibility Simulation Engine with Counterfactuals
 *
 * Encapsulates statutory welfare and service eligibility as explicit, versioned
 * Directed Acyclic Graphs (DAGs) with statutory citations, boundary detectors,
 * and conflict analyzers.
 */

import { validateRuleGraph } from './simulationContracts.js';

const inr = (n) => `₹${n.toLocaleString('en-IN')}`;

export const RULE_GRAPHS = {
  'pm-kisan': {
    id: 'pm-kisan',
    version: '1.0.0',
    title: 'PM-KISAN Samman Nidhi',
    category: 'Agriculture',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    benefitSummary: '₹6,000/year direct cash support in three equal tranches of ₹2,000.',
    nodes: [
      {
        id: 'pm_kisan_landholding',
        label: 'Cultivable Agricultural Land Ownership',
        type: 'BOOLEAN',
        field: 'ownsAgriculturalLand',
        isMutable: true,
        citation: {
          authority: 'Ministry of Agriculture & Farmers Welfare',
          orderNo: '1-1/2019-Credit-I',
          gazetteDate: '2019-02-01',
          sourceUrl: 'https://pmkisan.gov.in',
        },
        evaluate: (profile) => {
          const isFarmer = profile.employment === 'farmer' || profile.ownsAgriculturalLand === true;
          if (profile.employment === null && profile.ownsAgriculturalLand === null) {
            return {
              state: 'unknown',
              detail: 'Agricultural land ownership or farming occupation has not been declared.',
            };
          }
          if (isFarmer) {
            return {
              state: 'satisfied',
              detail: 'Verified agricultural landholder / farming occupation declaration.',
            };
          }
          return {
            state: 'unsatisfied',
            detail: 'Scheme requires ownership of cultivable agricultural land in revenue records.',
          };
        },
      },
      {
        id: 'pm_kisan_income',
        label: 'Statutory Family Income Ceiling',
        type: 'THRESHOLD',
        field: 'annualIncome',
        isMutable: true,
        citation: {
          authority: 'Department of Agriculture & Cooperation',
          orderNo: 'DAC/IT/PMK/2021-08',
          gazetteDate: '2021-06-15',
          sourceUrl: 'https://pmkisan.gov.in',
        },
        evaluate: (profile) => {
          const income = profile.annualIncome;
          if (income === null || income === undefined) {
            return { state: 'unknown', detail: 'Family annual income was not provided.' };
          }
          const ceiling = 400000;
          const isNearBoundary = income >= 380000 && income <= 420000;
          if (income <= ceiling) {
            return {
              state: 'satisfied',
              detail: `Declared income (${inr(income)}) is within statutory ceiling (${inr(ceiling)}).`,
              isBoundary: isNearBoundary,
              boundaryNotice: isNearBoundary
                ? 'Your income is within 5% of the statutory threshold. Ensure your latest ITR / Income Certificate reflects exact figures.'
                : null,
            };
          }
          return {
            state: 'unsatisfied',
            detail: `Declared income (${inr(income)}) exceeds scheme limit of ${inr(ceiling)}.`,
            isBoundary: isNearBoundary,
          };
        },
      },
      {
        id: 'pm_kisan_aadhaar_ekyc',
        label: 'Aadhaar Direct Benefit Transfer (DBT) Linking',
        type: 'DOCUMENT_PREREQUISITE',
        field: 'hasAadhaar',
        isMutable: true,
        citation: {
          authority: 'UIDAI & Ministry of Finance',
          orderNo: 'OM No. 13/2/2016-DBT',
          gazetteDate: '2022-03-31',
          sourceUrl: 'https://dbtbharat.gov.in',
        },
        evaluate: (profile) => {
          if (profile.hasAadhaar === null) {
            return { state: 'unknown', detail: 'Aadhaar bank-linking status not indicated.' };
          }
          if (profile.hasAadhaar === true) {
            return {
              state: 'satisfied',
              detail: 'Aadhaar e-KYC requirement fulfilled for direct bank disbursement.',
            };
          }
          return {
            state: 'unsatisfied',
            detail: 'Aadhaar seeding is mandatory under Section 7 of Aadhaar Act for DBT cash grants.',
          };
        },
      },
      {
        id: 'pm_kisan_patwari_verification',
        label: 'State Revenue Land Record (Patta/Khatauni) Authentication',
        type: 'DOCUMENT_PREREQUISITE',
        field: 'ownsAgriculturalLand',
        isMutable: false,
        citation: {
          authority: 'State Revenue & Land Records Directorate',
          orderNo: 'REV/LR-VERIF/2023',
          gazetteDate: '2023-01-10',
          sourceUrl: 'https://pmkisan.gov.in',
        },
        evaluate: (profile) => {
          if (!profile.ownsAgriculturalLand && profile.employment !== 'farmer') {
            return {
              state: 'unsatisfied',
              detail: 'No agricultural land declared for revenue record matching.',
            };
          }
          return {
            state: 'needs_official_verification',
            detail: 'Land title mutation and Patta/Khatauni ownership must be physically verified by the local Patwari / Revenue Officer.',
          };
        },
      },
    ],
  },

  'pmay-u': {
    id: 'pmay-u',
    version: '1.0.0',
    title: 'PM Awas Yojana (PMAY Urban / Credit-Linked Subsidy)',
    category: 'Housing',
    ministry: 'Ministry of Housing and Urban Affairs',
    benefitSummary: 'Up to ₹2.67 Lakh upfront interest subsidy on home construction/purchase.',
    nodes: [
      {
        id: 'pmay_no_pucca_house',
        label: 'Pucca House Non-Ownership Criteria',
        type: 'BOOLEAN',
        field: 'ownsPuccaHouse',
        isMutable: true,
        citation: {
          authority: 'Ministry of Housing and Urban Affairs',
          orderNo: 'N-11011/12/2015-HFA-III',
          gazetteDate: '2015-06-25',
          sourceUrl: 'https://pmay-urban.gov.in',
        },
        evaluate: (profile) => {
          if (profile.ownsPuccaHouse === null) {
            return { state: 'unknown', detail: 'Existing housing structure type not specified.' };
          }
          if (profile.ownsPuccaHouse === false) {
            return {
              state: 'satisfied',
              detail: 'Applicant family does not own an existing all-weather pucca dwelling.',
            };
          }
          return {
            state: 'unsatisfied',
            detail: 'Disqualified: Beneficiary or immediate family already owns a pucca dwelling anywhere in India.',
          };
        },
      },
      {
        id: 'pmay_income_limit',
        label: 'EWS / LIG Annual Household Income Bracket',
        type: 'THRESHOLD',
        field: 'annualIncome',
        isMutable: true,
        citation: {
          authority: 'MoHUA National Mission Directorate',
          orderNo: 'PMAY-U/EWS-LIG/REV-2020',
          gazetteDate: '2020-04-12',
          sourceUrl: 'https://pmay-urban.gov.in',
        },
        evaluate: (profile) => {
          const income = profile.annualIncome;
          if (income === null || income === undefined) {
            return { state: 'unknown', detail: 'Annual family income not provided.' };
          }
          const ceiling = 600000;
          if (income <= ceiling) {
            return {
              state: 'satisfied',
              detail: `Family income (${inr(income)}) meets EWS/LIG subsidy parameters (ceiling ${inr(ceiling)}).`,
            };
          }
          return {
            state: 'unsatisfied',
            detail: `Family income (${inr(income)}) exceeds statutory ₹6L ceiling for credit-linked subsidy.`,
          };
        },
      },
      {
        id: 'pmay_bpl_conflict_auditor',
        label: 'Income & BPL Card Evidentiary Consistency',
        type: 'DOCUMENT_PREREQUISITE',
        field: 'hasBplCard',
        isMutable: true,
        citation: {
          authority: 'Department of Social Justice & Empowerment',
          orderNo: 'SJE/BPL-AUDIT/2019-21',
          gazetteDate: '2019-11-04',
          sourceUrl: 'https://socialjustice.gov.in',
        },
        evaluate: (profile) => {
          const income = profile.annualIncome;
          const hasBpl = profile.hasBplCard;
          if (hasBpl === true && income !== null && income > 300000) {
            return {
              state: 'conflicting',
              detail: `Evidentiary conflict: Declared income is ${inr(income)} but BPL Card is claimed. Statutory BPL ceiling is typically under ₹1,20,000.`,
              conflict: {
                fieldA: 'annualIncome',
                valueA: income,
                fieldB: 'hasBplCard',
                valueB: true,
                message: 'Self-declared income exceeds the statutory BPL threshold. Clarification or revised certificate required.',
              },
            };
          }
          if (hasBpl === true) {
            return { state: 'satisfied', detail: 'BPL entitlement documentation noted.' };
          }
          return { state: 'satisfied', detail: 'No contradictory BPL entitlement documentation found.' };
        },
      },
    ],
  },

  'birth-certificate-delayed': {
    id: 'birth-certificate-delayed',
    version: '1.0.0',
    title: 'Birth Registration Statutory Window & Evidence',
    category: 'Civic Registration',
    ministry: 'Registrar General of India & Ministry of Home Affairs',
    benefitSummary: 'Direct municipal birth certificate issuance or delayed registration authorization.',
    nodes: [
      {
        id: 'birth_reporting_window',
        label: 'Statutory 21-Day Event Reporting Window',
        type: 'DATE_BOUNDARY',
        field: 'birthRegistrationDays',
        isMutable: true,
        citation: {
          authority: 'Registrar General of India',
          orderNo: 'Registration of Births and Deaths Act, 1969 (Sec 13)',
          gazetteDate: '1969-05-31',
          sourceUrl: 'https://crsorgi.gov.in',
        },
        evaluate: (profile) => {
          const days = profile.birthRegistrationDays;
          if (days === null || days === undefined) {
            return { state: 'unknown', detail: 'Number of days elapsed since birth not specified.' };
          }
          if (days <= 21) {
            const isNearDeadline = days >= 18;
            return {
              state: 'satisfied',
              detail: `Birth reported within statutory 21-day timeline (${days} days elapsed). Standard fee-free processing.`,
              isBoundary: isNearDeadline,
              boundaryNotice: isNearDeadline
                ? `CRITICAL DEADLINE: Only ${21 - days} day(s) remain before delayed registration penalties and affidavit requirements apply.`
                : null,
            };
          }
          if (days <= 365) {
            return {
              state: 'needs_official_verification',
              detail: `Reported after 21 days but within 1 year (${days} days). Requires Registrar late fee and notary self-declaration.`,
            };
          }
          return {
            state: 'unsatisfied',
            detail: `Reported over 1 year after birth (${days} days). Statutory law mandates an inquiry and formal order from an Executive Magistrate.`,
          };
        },
      },
      {
        id: 'birth_parent_id',
        label: 'Parental Government Identity Verification',
        type: 'DOCUMENT_PREREQUISITE',
        field: 'hasAadhaar',
        isMutable: true,
        citation: {
          authority: 'Ministry of Home Affairs / RBD Rule 5',
          orderNo: 'MHA/CRS/RULE-5/2023',
          gazetteDate: '2023-10-01',
          sourceUrl: 'https://crsorgi.gov.in',
        },
        evaluate: (profile) => {
          if (profile.hasAadhaar === null) {
            return { state: 'unknown', detail: 'Parent identification status not indicated.' };
          }
          if (profile.hasAadhaar) {
            return { state: 'satisfied', detail: 'Parent government identity proof available.' };
          }
          return {
            state: 'unsatisfied',
            detail: 'Valid government photo identity of at least one parent/guardian is mandatory under statutory rules.',
          };
        },
      },
      {
        id: 'birth_institutional_slip',
        label: 'Hospital Discharge Summary / Institutional Slip',
        type: 'DOCUMENT_PREREQUISITE',
        field: 'hasHospitalBirthSlip',
        isMutable: true,
        citation: {
          authority: 'State Directorate of Health & Family Welfare',
          orderNo: 'HFW/RBD-FORM-1/2018',
          gazetteDate: '2018-03-15',
          sourceUrl: 'https://crsorgi.gov.in',
        },
        evaluate: (profile) => {
          if (profile.hasHospitalBirthSlip === null) {
            return { state: 'unknown', detail: 'Institutional birth slip status not indicated.' };
          }
          if (profile.hasHospitalBirthSlip) {
            return { state: 'satisfied', detail: 'Hospital Form-1 / institutional birth record available.' };
          }
          return {
            state: 'needs_official_verification',
            detail: 'Home or non-institutional birth requires verification by Village Health Worker (ANM/ASHA) or Councillor affidavit.',
          };
        },
      },
    ],
  },

  'ayushman-bharat': {
    id: 'ayushman-bharat',
    version: '1.0.0',
    title: 'Ayushman Bharat PM-JAY Healthcare Cover',
    category: 'Healthcare',
    ministry: 'National Health Authority',
    benefitSummary: '₹5,00,000 per family per year secondary and tertiary hospitalization cover.',
    nodes: [
      {
        id: 'pmjay_deprivation_income',
        label: 'Socio-Economic Deprivation & Income Ceiling',
        type: 'THRESHOLD',
        field: 'annualIncome',
        isMutable: true,
        citation: {
          authority: 'National Health Authority',
          orderNo: 'NHA/AB-PMJAY/GUIDELINES/2018',
          gazetteDate: '2018-09-23',
          sourceUrl: 'https://pmjay.gov.in',
        },
        evaluate: (profile) => {
          const income = profile.annualIncome;
          const hasBpl = profile.hasBplCard;
          if (hasBpl === true) {
            return {
              state: 'satisfied',
              detail: 'Covered under SECC deprivation criteria via active BPL / Ration Card enumeration.',
            };
          }
          if (income === null || income === undefined) {
            return { state: 'unknown', detail: 'Annual family income not specified.' };
          }
          const ceiling = 250000;
          if (income <= ceiling) {
            return {
              state: 'satisfied',
              detail: `Declared family income (${inr(income)}) meets public healthcare subsidy criteria (ceiling ${inr(ceiling)}).`,
            };
          }
          return {
            state: 'unsatisfied',
            detail: `Declared family income (${inr(income)}) exceeds standard PM-JAY threshold (${inr(ceiling)}).`,
          };
        },
      },
      {
        id: 'pmjay_aadhaar_seed',
        label: 'Aadhaar Beneficiary Identification System (BIS)',
        type: 'DOCUMENT_PREREQUISITE',
        field: 'hasAadhaar',
        isMutable: true,
        citation: {
          authority: 'National Health Authority BIS Manual',
          orderNo: 'NHA/BIS-2.0/2021',
          gazetteDate: '2021-08-14',
          sourceUrl: 'https://pmjay.gov.in',
        },
        evaluate: (profile) => {
          if (profile.hasAadhaar === null) {
            return { state: 'unknown', detail: 'Aadhaar e-KYC status not specified.' };
          }
          if (profile.hasAadhaar) {
            return {
              state: 'satisfied',
              detail: 'Aadhaar authentication enabled for instant e-Card creation at empanelled hospital kiosks.',
            };
          }
          return {
            state: 'unsatisfied',
            detail: 'Aadhaar card or enrolment slip required for hospital desk authentication.',
          };
        },
      },
    ],
  },
};

/**
 * Validates all registered rule graphs at system startup.
 * Throws early in CI / test environments if any graph is cyclic or malformed.
 */
export function validateAllRegisteredGraphs() {
  const issues = [];
  for (const [id, graph] of Object.entries(RULE_GRAPHS)) {
    const check = validateRuleGraph(graph);
    if (!check.valid) {
      issues.push(`Graph "${id}": ${check.errors.join('; ')}`);
    }
  }
  if (issues.length > 0) {
    throw new Error(`Rule Graph Registry validation failed:\n${issues.join('\n')}`);
  }
  return true;
}

/**
 * Retrieves a registered rule graph by ID.
 * @param {string} schemeId
 * @returns {Object|null}
 */
export function getRuleGraph(schemeId) {
  return RULE_GRAPHS[schemeId] ?? null;
}

/**
 * Lists all available registered rule graphs.
 * @returns {Array<{ id: string, version: string, title: string, category: string }>}
 */
export function listRegisteredGraphs() {
  return Object.values(RULE_GRAPHS).map((g) => ({
    id: g.id,
    version: g.version,
    title: g.title,
    category: g.category,
    ministry: g.ministry,
    benefitSummary: g.benefitSummary,
    nodeCount: g.nodes.length,
  }));
}
