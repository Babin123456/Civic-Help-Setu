/**
 * Senior Citizen Maintenance & Welfare Tribunal Service
 *
 * Enforces statutory protections under The Maintenance and Welfare of Parents
 * and Senior Citizens Act, 2007 (Central Act 56 of 2007).
 * Provides tribunal case classification, equitable maintenance apportionment,
 * Section 23 property transfer revocation validation, 90-day statutory SLA tracking,
 * evidence checklists, and SDM Tribunal petition drafting (#858).
 */

import { sha256Hex, canonicalStringify } from './privacyIntegrityService.js';
import { minimizeForExternal } from '../utils/dataMinimization.js';

export const CASE_TYPES = {
  MAINTENANCE_AND_EXPENSES: {
    id: 'MAINTENANCE_AND_EXPENSES',
    title: 'Monthly Maintenance & Medical Relief',
    statutorySection: 'Sections 4 & 5',
    formCode: 'FORM-A',
    description:
      'Claim for monthly living, dietary, healthcare, and caregiver expenses from adult children or legal heirs.',
  },
  PROPERTY_REVOCATION_SEC23: {
    id: 'PROPERTY_REVOCATION_SEC23',
    title: 'Section 23 Property Revocation & Eviction',
    statutorySection: 'Section 23',
    formCode: 'FORM-B',
    description:
      'Application to declare gift deed/settlement void for failure of basic amenities, and seek eviction of abusive occupants.',
  },
  INTERIM_MAINTENANCE_RELIEF: {
    id: 'INTERIM_MAINTENANCE_RELIEF',
    title: 'Urgent Interim Maintenance & Restraining Order',
    statutorySection: 'Section 5(2)',
    formCode: 'FORM-C',
    description:
      'Immediate interim monthly allowance payable during inquiry pendency and protection against dispossession.',
  },
  CONCILIATION_OFFICER_SETTLEMENT: {
    id: 'CONCILIATION_OFFICER_SETTLEMENT',
    title: 'Conciliation Conference & Settlement Accord',
    statutorySection: 'Section 6',
    formCode: 'FORM-D',
    description:
      'Referral to Tribunal Conciliation Officer for mediated family settlement enforceable as a decree.',
  },
};

export const STATUTORY_TIMELINES = {
  NOTICE_SERVICE_DAYS: 15,
  CONCILIATION_WINDOW_DAYS: 30,
  TOTAL_STATUTORY_SLA_DAYS: 90,
  MAX_STATUTORY_EXTENSION_DAYS: 30,
};

function scrubField(val, fallback = '') {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed) return fallback;
  return minimizeForExternal(trimmed);
}

/**
 * Calculates equitable maintenance requirement and apportions liability
 * across multiple adult children/legal heirs based on income and inheritance prospects.
 *
 * @param {Object} params
 * @param {Object} params.expenses - { food, shelter, medical, caregiver, other }
 * @param {number} params.existingIncome - Existing pension/rental income of petitioner
 * @param {Array<Object>} params.respondents - List of children { name, relationship, monthlyIncome, hasInheritedProperty }
 * @returns {Object} Calculation result with recommended awards and breakdown
 */
export const calculateEquitableMaintenance = ({
  expenses = {},
  existingIncome = 0,
  respondents = [],
} = {}) => {
  const food = Math.max(0, Number(expenses.food) || 0);
  const shelter = Math.max(0, Number(expenses.shelter) || 0);
  const medical = Math.max(0, Number(expenses.medical) || 0);
  const caregiver = Math.max(0, Number(expenses.caregiver) || 0);
  const other = Math.max(0, Number(expenses.other) || 0);

  const totalMonthlyNeed = food + shelter + medical + caregiver + other;
  const selfIncome = Math.max(0, Number(existingIncome) || 0);
  const netDeficit = Math.max(0, totalMonthlyNeed - selfIncome);

  const validRespondents = Array.isArray(respondents)
    ? respondents.filter((r) => r && typeof r === 'object')
    : [];

  const sanitizedRespondents = validRespondents.map((r, idx) => ({
    name: scrubField(r.name, `Respondent Child ${idx + 1}`),
    relationship: scrubField(r.relationship, 'Child'),
    monthlyIncome: Math.max(0, Number(r.monthlyIncome) || 0),
    hasInheritedProperty: Boolean(r.hasInheritedProperty),
  }));

  const totalRespondentIncome = sanitizedRespondents.reduce(
    (acc, curr) => acc + curr.monthlyIncome,
    0
  );

  let apportionedBreakdown;

  if (sanitizedRespondents.length === 0) {
    apportionedBreakdown = [];
  } else if (totalRespondentIncome > 0) {
    apportionedBreakdown = sanitizedRespondents.map((resp) => {
      // Base share based on income proportion
      let weight = resp.monthlyIncome / totalRespondentIncome;
      // Weight adjustment: +15% liability if respondent already received transferred/gifted property
      if (resp.hasInheritedProperty) {
        weight *= 1.15;
      }
      return {
        ...resp,
        weight,
      };
    });

    const sumWeights = apportionedBreakdown.reduce((sum, r) => sum + r.weight, 0);

    apportionedBreakdown = apportionedBreakdown.map((resp) => {
      const normalizedWeight = resp.weight / sumWeights;
      const share = Math.round(netDeficit * normalizedWeight);
      return {
        name: resp.name,
        relationship: resp.relationship,
        monthlyIncome: resp.monthlyIncome,
        hasInheritedProperty: resp.hasInheritedProperty,
        percentageContribution: Math.round(normalizedWeight * 100),
        recommendedMonthlyShare: share,
      };
    });
  } else {
    // Equal distribution if no income figures reported
    const equalShare = Math.round(netDeficit / sanitizedRespondents.length);
    apportionedBreakdown = sanitizedRespondents.map((resp) => ({
      name: resp.name,
      relationship: resp.relationship,
      monthlyIncome: 0,
      hasInheritedProperty: resp.hasInheritedProperty,
      percentageContribution: Math.round(100 / sanitizedRespondents.length),
      recommendedMonthlyShare: equalShare,
    }));
  }

  // Statutory assessment: Section 9 originally specified a cap of ₹10,000,
  // but landmark High Court rulings have interpreted this as a minimum guidance floor.
  const statutoryCeilingNoticed = netDeficit > 10000;

  return {
    totalMonthlyNeed,
    existingIncome: selfIncome,
    netDeficit,
    respondentsCount: sanitizedRespondents.length,
    apportionedBreakdown,
    statutoryCeilingNoticed,
    statutoryCapNote: statutoryCeilingNoticed
      ? 'Claim exceeds historical ₹10,000 cap; supported by Delhi & Bombay HC rulings allowing higher awards for medical/caregiver necessity.'
      : 'Claim is within standard statutory maintenance band.',
  };
};

/**
 * Validates grounds and readiness for Section 23 Property Transfer Revocation.
 *
 * @param {Object} deedInfo
 * @param {string} deedInfo.deedType - 'gift', 'settlement', 'sale_without_consideration', 'relinquishment'
 * @param {string} deedInfo.transferYear - Year or Date of execution
 * @param {boolean} deedInfo.hasAmenityCondition - Whether deed mentions providing care or amenities
 * @param {boolean} deedInfo.isSeniorCitizenAtTransfer - Whether parent was 60+ at transfer
 * @param {boolean} deedInfo.neglectDocumented - Whether failure of basic needs/medical care is documented
 * @param {boolean} deedInfo.parentInPossession - Whether parent is currently staying in the property or evicted
 * @returns {Object} Section 23 readiness evaluation
 */
export const validateSection23RevocationReadiness = (deedInfo = {}) => {
  const deedType = String(deedInfo.deedType || 'gift').toLowerCase();
  const transferYear = Number(deedInfo.transferYear) || 0;
  const hasAmenityCondition = Boolean(deedInfo.hasAmenityCondition);
  const isSeniorCitizenAtTransfer = Boolean(deedInfo.isSeniorCitizenAtTransfer);
  const neglectDocumented = Boolean(deedInfo.neglectDocumented);
  const parentInPossession = Boolean(deedInfo.parentInPossession);

  const findings = [];
  let score = 0;

  // 1. Deed classification
  if (
    deedType.includes('gift') ||
    deedType.includes('settlement') ||
    deedType.includes('relinquishment')
  ) {
    score += 10;
    findings.push({
      status: 'PASS',
      title: 'Eligible Deed Category',
      description: `Deed categorized as ${deedType.toUpperCase()}; squarely falls within Section 23 gratuitous transfer scope.`,
    });
  } else {
    findings.push({
      status: 'INFO',
      title: 'Deed Consideration Scrutiny',
      description: 'Ensure transfer was gratuitous or without adequate financial consideration.',
    });
  }

  // 2. Age at execution
  if (isSeniorCitizenAtTransfer) {
    score += 10;
    findings.push({
      status: 'PASS',
      title: 'Senior Citizen Age Qualification',
      description: 'Petitioner had attained 60+ years at the time of deed execution.',
    });
  } else {
    findings.push({
      status: 'WARN',
      title: 'Age at Transfer Caveat',
      description: 'If petitioner was under 60 at transfer, establish parent status under Section 2(d).',
    });
  }

  // 3. Post-2007 Act execution check
  if (transferYear >= 2007) {
    score += 20;
    findings.push({
      status: 'PASS',
      title: 'Transfer Post-Dates 2007 Act',
      description: 'The property transfer occurred after the 2007 Act came into force.',
    });
  } else if (transferYear > 0) {
    findings.push({
      status: 'CAUTION',
      title: 'Pre-2007 Act Execution',
      description:
        'Deed executed prior to 2007. Direct Section 23 void declaration is disputed; civil court declaratory suit or eviction under Senior Citizens Rules advised.',
    });
  } else {
    findings.push({
      status: 'WARN',
      title: 'Transfer Date Unspecified',
      description: 'Provide deed registration year to confirm Section 23 temporal applicability.',
    });
  }

  // 4. Conditionality check
  if (hasAmenityCondition) {
    score += 30;
    findings.push({
      status: 'PASS',
      title: 'Basic Amenities Condition Present',
      description:
        'Transfer deed includes explicit condition that transferee shall provide basic amenities.',
    });
  } else {
    score += 15;
    findings.push({
      status: 'INFO',
      title: 'Implied Condition Ground',
      description:
        'Under Supreme Court & High Court precedents (e.g. Sudesh Chhikara), condition may be inferred from circumstances, but strong evidence of neglect is required.',
    });
  }

  // 5. Neglect & refusal documentation
  if (neglectDocumented) {
    score += 20;
    findings.push({
      status: 'PASS',
      title: 'Documentation of Neglect Available',
      description:
        'Medical bills unpaid by child, police diary entries, or witness statements verify neglect.',
    });
  } else {
    findings.push({
      status: 'WARN',
      title: 'Documentation Needed',
      description:
        'Gather medical prescriptions, bank records, or local panchayat/ward notices proving neglect.',
    });
  }

  // 6. Eviction remedy applicability
  if (!parentInPossession) {
    score += 10;
    findings.push({
      status: 'ACTION_REQUIRED',
      title: 'Dispossession / Eviction Relief Required',
      description:
        'Petitioner has been locked out or evicted. Seek immediate restoration of possession under Tribunal summary powers.',
    });
  } else {
    score += 10;
    findings.push({
      status: 'PASS',
      title: 'Parent in Possession',
      description: 'Petitioner retains physical possession; seek injunction against alienation or harassment.',
    });
  }

  let verdict = 'WEAK';
  if (score >= 80) verdict = 'STRONG';
  else if (score >= 50) verdict = 'MODERATE';

  return {
    score,
    verdict,
    findings,
    applicablePrecedents: [
      {
        citation: 'Sunny Paul v. State of NCT Delhi (Delhi HC)',
        relevance: 'Tribunal has jurisdiction to order eviction of abusive children from senior citizen home.',
      },
      {
        citation: 'Manmohan Singh v. Surya Kant (Punjab & Haryana HC)',
        relevance: 'Children residing in parent house are mere licensees; license revocable upon neglect.',
      },
      {
        citation: 'Sudesh Chhikara v. Ramti Devi (Supreme Court 2022)',
        relevance: 'Section 23 void declaration requires proof of condition of maintenance at transfer.',
      },
    ],
  };
};

/**
 * Calculates Tribunal 90-day statutory SLA progress and escalation status.
 *
 * @param {Object} timelineData
 * @param {string} timelineData.filingDate - YYYY-MM-DD
 * @param {string} timelineData.noticeServedDate - YYYY-MM-DD
 * @param {string} timelineData.currentStage - 'FILED', 'NOTICE_SERVED', 'CONCILIATION', 'INQUIRY', 'DISPOSED'
 * @returns {Object} SLA status and timeline tracking
 */
export const calculateTribunalSla = (timelineData = {}) => {
  const filingStr = timelineData.filingDate || new Date().toISOString().slice(0, 10);
  const filingDate = new Date(filingStr);
  const now = new Date();

  const daysSinceFiling = Math.max(
    0,
    Math.floor((now.getTime() - filingDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const statutoryLimitDays = STATUTORY_TIMELINES.TOTAL_STATUTORY_SLA_DAYS;
  const daysRemaining = Math.max(0, statutoryLimitDays - daysSinceFiling);
  const isOverdue = daysSinceFiling > statutoryLimitDays;
  const percentElapsed = Math.min(100, Math.round((daysSinceFiling / statutoryLimitDays) * 100));

  let currentPhase = 'Stage 1: Filing & Notice';
  if (daysSinceFiling > 70) {
    currentPhase = 'Stage 4: Final Order & Enforcement';
  } else if (daysSinceFiling > 30) {
    currentPhase = 'Stage 3: Summary Tribunal Inquiry';
  } else if (daysSinceFiling > 15) {
    currentPhase = 'Stage 2: Conciliation Conference';
  }

  const escalationReady = isOverdue && timelineData.currentStage !== 'DISPOSED';

  return {
    filingDate: filingStr,
    daysSinceFiling,
    daysRemaining,
    statutoryLimitDays,
    percentElapsed,
    isOverdue,
    currentPhase,
    escalationReady,
    escalationRemedy: escalationReady
      ? 'Section 16 Appeal to Appellate Tribunal (District Magistrate) due to breach of statutory 90-day inquiry window.'
      : 'Inquiry is within the statutory 90-day resolution window.',
  };
};

/**
 * Generates an evidentiary checklist customized to the case type.
 *
 * @param {string} caseType
 * @returns {Array<Object>} Categorized checklist of evidence
 */
export const generateEvidenceChecklist = (caseType = 'MAINTENANCE_AND_EXPENSES') => {
  const baseChecklist = [
    {
      id: 'AGE_PROOF',
      name: 'Proof of Age (Senior Citizen Status)',
      mandatory: true,
      description: 'Aadhaar card, Voter ID, Passport, or Government Pension Card showing age 60+.',
    },
    {
      id: 'ADDRESS_PROOF',
      name: 'Proof of Residence',
      mandatory: true,
      description: 'Ration card, Electricity bill, or Voter ID establishing SDM Tribunal jurisdiction.',
    },
    {
      id: 'CHILDREN_DETAILS',
      name: 'Children / Legal Heirs Address & Employment Details',
      mandatory: true,
      description: 'Full residential addresses and employer/business details of respondent children for summons.',
    },
  ];

  if (caseType === 'PROPERTY_REVOCATION_SEC23') {
    return [
      ...baseChecklist,
      {
        id: 'DEED_COPY',
        name: 'Registered Transfer Deed Copy',
        mandatory: true,
        description: 'Certified copy of Gift Deed, Settlement Deed, or Relinquishment Deed executed with child.',
      },
      {
        id: 'REVENUE_EXTRACT',
        name: 'Revenue / Municipal Record Extract (Khata / Patta)',
        mandatory: true,
        description: 'Property tax receipt or municipal mutation copy verifying property description.',
      },
      {
        id: 'NEGLECT_EVIDENCE',
        name: 'Proof of Neglect / Non-Provision of Amenities',
        mandatory: true,
        description: 'Self-declaration affidavit detailing failure to provide food, shelter, medicines, or physical threats.',
      },
      {
        id: 'POLICE_RECORD',
        name: 'Police / Elder Helpline Diary Entry (Optional)',
        mandatory: false,
        description: 'Copy of 14567 National Elder Helpline complaint or local police station non-cognizable report.',
      },
    ];
  }

  if (caseType === 'INTERIM_MAINTENANCE_RELIEF') {
    return [
      ...baseChecklist,
      {
        id: 'MEDICAL_PRESCRIPTIONS',
        name: 'Current Medical Prescriptions & Pharmacy Bills',
        mandatory: true,
        description: 'Doctor prescriptions, hospital invoices, and chronic disease treatment records.',
      },
      {
        id: 'BANK_STATEMENT',
        name: 'Bank Account Passbook / Statement',
        mandatory: true,
        description: 'Passbook extract demonstrating absence of regular independent income or depleted savings.',
      },
      {
        id: 'URGENCY_AFFIDAVIT',
        name: 'Affidavit of Immediate Need',
        mandatory: true,
        description: 'Statement showing acute financial distress necessitating immediate Section 5(2) interim relief.',
      },
    ];
  }

  // Default: Maintenance & Medical Expenses
  return [
    ...baseChecklist,
    {
      id: 'EXPENSE_BILLS',
      name: 'Living & Healthcare Expense Records',
      mandatory: true,
      description: 'Recent grocery receipts, house rent slips, diagnostic lab receipts, and medicine bills.',
    },
    {
      id: 'INCOME_EVIDENCE',
      name: 'Petitioner & Respondent Income Estimates',
      mandatory: false,
      description: 'Salary slips, IT returns, or known business assets of respondent children to justify award.',
    },
  ];
};

/**
 * Builds a formal statutory petition document for filing before the SDM Maintenance Tribunal.
 *
 * @param {Object} data
 * @returns {Object} Structured petition ready for print and text export
 */
export const buildTribunalPetition = (data = {}) => {
  const caseTypeKey = data.caseType || 'MAINTENANCE_AND_EXPENSES';
  const caseDef = CASE_TYPES[caseTypeKey] || CASE_TYPES.MAINTENANCE_AND_EXPENSES;

  const petitionerName = scrubField(data.petitionerName, 'Elder Citizen');
  const petitionerAge = Number(data.petitionerAge) || 65;
  const district = scrubField(data.district, 'Jurisdictional District');
  const state = scrubField(data.state, 'State');
  const tribunalTitle = `BEFORE THE MAINTENANCE TRIBUNAL / SUB-DIVISIONAL MAGISTRATE (SDM), ${district.toUpperCase()}, ${state.toUpperCase()}`;

  const cleanAddress = scrubField(data.address, 'Resident within Tribunal Jurisdiction');
  const cleanPhone = scrubField(data.phone, 'Not Disclosed');

  const rawRespondents = Array.isArray(data.respondents) ? data.respondents : [];
  const respondentsList = rawRespondents.map((r, i) => ({
    name: scrubField(r.name, `Respondent Child ${i + 1}`),
    relationship: scrubField(r.relationship, 'Child'),
    address: scrubField(r.address, 'Resident of the District'),
    monthlyIncome: Number(r.monthlyIncome) || 0,
    hasInheritedProperty: Boolean(r.hasInheritedProperty),
  }));

  const monthlyClaim = Number(data.monthlyClaim) || 0;
  const propertyDescription = scrubField(
    data.propertyDescription,
    caseTypeKey === 'PROPERTY_REVOCATION_SEC23' ? 'Residential Property' : ''
  );
  const narrative = scrubField(
    data.narrative,
    'The petitioner is an elderly parent unable to maintain themselves from their own earnings or property and is being neglected by the respondent(s).'
  );

  const payload = {
    version: 1,
    caseType: caseDef.id,
    formCode: caseDef.formCode,
    tribunalTitle,
    petitioner: {
      name: petitionerName,
      age: petitionerAge,
      address: cleanAddress,
      phone: cleanPhone,
    },
    respondents: respondentsList,
    monthlyClaim,
    propertyDescription,
    narrative,
  };

  const digest = sha256Hex(canonicalStringify(payload));

  return {
    ...payload,
    statutorySection: caseDef.statutorySection,
    statutoryAct: 'The Maintenance and Welfare of Parents and Senior Citizens Act, 2007 (Act No. 56 of 2007)',
    sha256Digest: digest,
    filingReference: `MWPSC-${district.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
    generatedDate: new Date().toISOString().slice(0, 10),
  };
};

/**
 * Formats formal legal petition text formatted for court submission.
 *
 * @param {Object} petition
 * @returns {string} Plain-text legal draft
 */
export const formatPetitionAsPlainText = (petition) => {
  if (!petition) return '';

  const border = '================================================================================';
  const subBorder = '--------------------------------------------------------------------------------';

  const lines = [
    border,
    petition.tribunalTitle || 'BEFORE THE MAINTENANCE TRIBUNAL',
    'APPLICATION UNDER ' + (petition.statutorySection || 'THE PROVISIONS') + ' OF',
    (
      petition.statutoryAct ||
      'The Maintenance and Welfare of Parents and Senior Citizens Act, 2007'
    ).toUpperCase(),
    border,
    `Filing Ref No : ${petition.filingReference || 'MWPSC-DRAFT'}`,
    `Date of Draft : ${petition.generatedDate || new Date().toISOString().slice(0, 10)}`,
    `Security Seal : ${petition.sha256Digest || 'NOT_SEALED'}`,
    subBorder,
    'IN THE MATTER OF:',
    `1. ${petition.petitioner?.name || 'Petitioner'}, Age: ${petition.petitioner?.age || 65} Years,`,
    `   Residing at: ${petition.petitioner?.address || 'Jurisdictional District'}`,
    '                                                              ... PETITIONER / PARENT',
    '',
    '                             VERSUS',
    '',
  ];

  if (petition.respondents && petition.respondents.length > 0) {
    petition.respondents.forEach((resp, idx) => {
      lines.push(`1.${idx + 1} ${resp.name} (${resp.relationship}),`);
      lines.push(`     Residing at: ${resp.address}`);
    });
  } else {
    lines.push('1. Respondent Child(ren) / Legal Heir(s)');
  }
  lines.push(
    '                                                              ... RESPONDENT(S)',
    subBorder,
    'MOST RESPECTFULLY SHOWETH:',
    '',
    '1. That the Petitioner is a senior citizen aged ' +
      petition.petitioner.age +
      ' years and is entitled to statutory protection under Act 56 of 2007.',
    '2. That the Respondent(s) are the adult children / legal heirs of the Petitioner possessing sufficient means.',
    '3. That the Petitioner is unable to maintain herself/himself from independent income or assets.',
    '4. STATEMENT OF GRIEVANCE & FACTS:',
    `   ${petition.narrative}`,
    ''
  );

  if (petition.caseType === 'PROPERTY_REVOCATION_SEC23') {
    lines.push(
      '5. GROUNDS FOR SECTION 23 PROPERTY TRANSFER REVOCATION:',
      `   a) Property Description: ${petition.propertyDescription}`,
      '   b) That the transfer of the said property was subject to the basic condition of care and maintenance.',
      '   c) That the Respondent has failed and refused to provide basic physical amenities and basic physical needs.',
      '   d) That by statutory mandate of Section 23, the transfer deed is deemed to have been made by fraud/coercion and is void at the option of the Petitioner.'
    );
  }

  if (petition.monthlyClaim > 0) {
    lines.push(
      `6. That the Petitioner requires a monthly maintenance allowance of Rs. ${petition.monthlyClaim} /- towards basic subsistence, medical care, and attendant expenses.`
    );
  }

  lines.push(
    subBorder,
    'PRAYER:',
    'Wherefore, in the interest of justice, it is most respectfully prayed that this Hon\'ble Tribunal may graciously be pleased to:',
    petition.caseType === 'PROPERTY_REVOCATION_SEC23'
      ? 'a) Declare the transfer deed in respect of ' +
          petition.propertyDescription +
          ' to be VOID under Section 23 of the Act.\nb) Direct immediate restoration of possession and eviction of the Respondent(s).\nc) Pass restraining orders protecting the life and dignity of the Petitioner.'
      : 'a) Direct the Respondent(s) to pay monthly maintenance of Rs. ' +
          petition.monthlyClaim +
          ' /- to the Petitioner.\nb) Grant urgent interim maintenance under Section 5(2) pending inquiry.\nc) Award medical expenses and costs of these proceedings.',
    subBorder,
    'VERIFICATION:',
    `Verified at ${petition.petitioner.address} on this date that the contents above are true to my knowledge.`,
    '',
    '                                                    (SIGNATURE / THUMB IMPRESSION)',
    '                                                                         PETITIONER',
    border
  );

  return lines.join('\n');
};
