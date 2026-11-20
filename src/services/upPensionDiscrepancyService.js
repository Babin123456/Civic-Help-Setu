/**
 * UP Pension Payment Discrepancy and Life-Certificate Preparation Workspace Service
 * 
 * Facilitates elderly and disabled pensioners across Uttar Pradesh schemes:
 * - Schemes: Old Age Pension (SSP UP), Destitute Widow Pension, Divyangjan Disability Pension
 * - Discrepancy diagnosis: Missed quarterly instalments, annual Jeevan Pramaan life-certificate lapse,
 *   Aadhaar NPCI bank account de-linking, Public Financial Management System (PFMS) rejection codes
 * - Zero Credential Collection: No bank passwords, OTPs, or full Aadhaar numbers collected
 * - Masked printable discrepancy representation statement for District Social Welfare Officer (DSWO)
 * - Revocable caregiver-assisted consent mode
 */

export const UP_PENSION_SCHEMES = {
  OLD_AGE_PENSION: {
    code: 'OLD_AGE_PENSION',
    name: 'UP Old Age Pension (Vridhavastha Pension Yojana)',
    department: 'Social Welfare Department, Government of UP',
    portalUrl: 'https://sspy-up.gov.in/',
    monthlyRateINR: 1000,
    disbursementFrequency: 'QUARTERLY_3000_INR',
    annualVerificationMonth: 'May – June',
    helpline: 'Toll-Free 14568 / 1076'
  },
  WIDOW_PENSION: {
    code: 'WIDOW_PENSION',
    name: 'UP Destitute Widow Pension (Nirashrit Mahila Pension Yojana)',
    department: 'Women and Child Development Department, UP',
    portalUrl: 'https://sspy-up.gov.in/',
    monthlyRateINR: 1000,
    disbursementFrequency: 'QUARTERLY_3000_INR',
    annualVerificationMonth: 'Annual Re-Verification',
    helpline: 'Toll-Free 181 / 1076'
  },
  DIVYANG_PENSION: {
    code: 'DIVYANG_PENSION',
    name: 'UP Divyangjan Disability Pension Yojana',
    department: 'Divyangjan Empowerment Department, UP',
    portalUrl: 'https://sspy-up.gov.in/',
    monthlyRateINR: 1000,
    disbursementFrequency: 'QUARTERLY_3000_INR',
    annualVerificationMonth: 'Annual Medical / Life Certificate',
    helpline: 'Toll-Free 1800-180-1995 / 1076'
  }
};

export const UP_PENSION_ESCALATION_OFFICERS = [
  { level: 'BLOCK', designation: 'Assistant Development Officer (Social Welfare) / ADO Samaj Kalyan', role: 'Initial scrutiny of village applications' },
  { level: 'TEHSIL', designation: 'Sub-Divisional Magistrate (SDM) / Tehsildar', role: 'Annual income and physical verification oversight' },
  { level: 'DISTRICT', designation: 'District Social Welfare Officer (DSWO) / District Probation Officer (DPO)', role: 'Final sanction and payment re-triggering' }
];

/**
 * Returns escalation hierarchy for UP pension grievances.
 * @returns {Array<Object>}
 */
export function getPensionEscalationHierarchy() {
  return UP_PENSION_ESCALATION_OFFICERS;
}

export const COMMON_DISCREPANCY_ROOT_CAUSES = {
  LIFE_CERTIFICATE_LAPSED: {
    code: 'LIFE_CERTIFICATE_LAPSED',
    label: 'Annual Digital Life Certificate (Jeevan Pramaan) Not Updated',
    solution: 'Submit biometric DLC at local CSC, India Post Payments Bank (IPPB) postman visit, or SSPY portal.'
  },
  NPCI_DBT_MAPPING_FAILED: {
    code: 'NPCI_DBT_MAPPING_FAILED',
    label: 'Bank Account Not Active in NPCI Aadhaar Payment Bridge (APB)',
    solution: 'Visit bank branch with Aadhaar card to re-seed account for Direct Benefit Transfer (DBT).'
  },
  PFMS_BENEFICIARY_REJECTED: {
    code: 'PFMS_BENEFICIARY_REJECTED',
    label: 'PFMS Name Mismatch Between Pension Portal and Bank Account',
    solution: 'Request District Social Welfare Officer (DSWO) to update pensioner name spelling matching passbook.'
  },
  ANNUAL_REVERIFICATION_PENDING: {
    code: 'ANNUAL_REVERIFICATION_PENDING',
    label: 'Block / Tehsil Annual Physical Verification Pending',
    solution: 'Submit self-declaration to Village Panchayat Secretary (Gram Vikas Adhikari) or Ward Councillor.'
  }
};

/**
 * Diagnoses pension payment disruption and suggests targeted administrative remediation.
 * @param {Object} pensionRecord 
 * @returns {Object} diagnosis
 */
export function diagnosePensionDiscrepancy(pensionRecord = {}) {
  const errors = [];
  const identifiedCauses = [];

  const scheme = UP_PENSION_SCHEMES[pensionRecord.schemeCode];
  if (!scheme) {
    errors.push('Valid UP Pension Scheme must be selected from the reviewed SSPY catalogue.');
  }

  if (pensionRecord.monthsDelayed && Number(pensionRecord.monthsDelayed) >= 3) {
    if (!pensionRecord.hasUpdatedLifeCertificateThisYear) {
      identifiedCauses.push(COMMON_DISCREPANCY_ROOT_CAUSES.LIFE_CERTIFICATE_LAPSED);
    }
    if (!pensionRecord.isBankAadhaarSeeded) {
      identifiedCauses.push(COMMON_DISCREPANCY_ROOT_CAUSES.NPCI_DBT_MAPPING_FAILED);
    }
    if (pensionRecord.pfmsStatus === 'REJECTED') {
      identifiedCauses.push(COMMON_DISCREPANCY_ROOT_CAUSES.PFMS_BENEFICIARY_REJECTED);
    }
  }

  if (identifiedCauses.length === 0 && Number(pensionRecord.monthsDelayed) >= 3) {
    identifiedCauses.push(COMMON_DISCREPANCY_ROOT_CAUSES.ANNUAL_REVERIFICATION_PENDING);
  }

  return {
    scheme: scheme || null,
    monthsDelayed: Number(pensionRecord.monthsDelayed) || 0,
    hasDiscrepancy: (Number(pensionRecord.monthsDelayed) || 0) >= 3,
    identifiedCauses,
    errors,
    nextSteps: identifiedCauses.map(c => c.solution)
  };
}

/**
 * Creates a privacy-masked printable discrepancy statement for the District Social Welfare Office (DSWO).
 * @param {Object} pensionerData 
 * @param {Object} caregiverData 
 * @returns {Object} statement
 */
export function buildMaskedPensionStatement(pensionerData = {}, caregiverData = null) {
  const scheme = UP_PENSION_SCHEMES[pensionerData.schemeCode] || UP_PENSION_SCHEMES.OLD_AGE_PENSION;

  // Mask bank account showing only last 4 digits
  const rawAcct = pensionerData.bankAccountNumber ? pensionerData.bankAccountNumber.toString().trim() : '';
  const maskedAccount = rawAcct.length >= 4 ? 'XXXX-XXXX-' + rawAcct.slice(-4) : 'XXXX-XXXX-XXXX';

  // Mask pension registration number
  const rawReg = pensionerData.pensionRegistrationNumber ? pensionerData.pensionRegistrationNumber.trim() : '';
  const maskedReg = rawReg.length >= 4 ? rawReg.substring(0, 4) + 'XXXX' + rawReg.slice(-2) : 'UP-PENS-XXXX';

  const statement = {
    statementId: 'stmt_' + Math.random().toString(36).substring(2, 9),
    schemeName: scheme.name,
    department: scheme.department,
    district: pensionerData.district || 'Uttar Pradesh',
    maskedPensionRegistrationNumber: maskedReg,
    maskedBankAccount: maskedAccount,
    bankName: pensionerData.bankName || 'Nationalized / Gramin Bank',
    lastPaymentReceivedMonth: pensionerData.lastPaymentReceivedMonth || 'N/A',
    unpaidQuartersCount: pensionerData.unpaidQuartersCount || 1,
    estimatedArrearsDueINR: (Number(pensionerData.unpaidQuartersCount) || 1) * 3000,
    caregiverAssisted: Boolean(caregiverData?.isConsented),
    caregiverDetails: caregiverData?.isConsented ? {
      relationship: caregiverData.relationship || 'Family Member',
      consentRecordedAt: new Date().toISOString()
    } : null,
    generatedAt: new Date().toISOString()
  };

  return statement;
}

/**
 * Exports masked pension statement in markdown format.
 * @param {Object} statement 
 * @param {Object} diagnosis 
 * @returns {string} markdown
 */
export function exportPensionDiscrepancyDossier(statement = {}, diagnosis = {}) {
  return [
    `# Uttar Pradesh Social Welfare Pension Discrepancy Statement`,
    `**Scheme:** ${statement.schemeName || 'UP Pension Yojana'}`,
    `**Department:** ${statement.department || 'Social Welfare Department, UP'}`,
    `**District:** ${statement.district || 'Uttar Pradesh'}`,
    `**Pension Application Ref:** \`${statement.maskedPensionRegistrationNumber}\``,
    `**Disbursement Bank:** ${statement.bankName} (\`${statement.maskedBankAccount}\`)`,
    `**Discrepancy Scope:** ~${statement.unpaidQuartersCount || 1} Quarter(s) Pending (Est. Due: ₹${(statement.estimatedArrearsDueINR || 0).toLocaleString('en-IN')})`,
    ``,
    `## Probable Administrative Blockers Identified`,
    ...(diagnosis.identifiedCauses?.length > 0
      ? diagnosis.identifiedCauses.map(c => `- **${c.label}**\n  *Remedy:* ${c.solution}`)
      : ['- Routine treasury clearance cycle or batch re-verification.']),
    ``,
    `## Recommended Physical Submission Pack for DSWO Office`,
    `1. Copy of Bank Passbook front page showing IFSC and account details.`,
    `2. Recent Digital Life Certificate (Jeevan Pramaan) submission slip or CSC acknowledgment.`,
    `3. Written representation addressed to **District Social Welfare Officer (DSWO)** / **District Probation Officer (DPO)**.`,
    `4. Bank Branch Manager endorsement confirming active Aadhaar NPCI seeding.`,
    ``,
    `---`,
    `> **Privacy & Credential Safeguard:** Full account and Aadhaar credentials are masked. No banking passwords or OTPs are stored.`
  ].join('\n');
}


export const UP_PENSION_HELP_FAQS = [
  {
    q: 'What is the schedule of pension release in UP?',
    a: 'Pensions under SSPY are disbursed on a quarterly cycle (Q1: April-June, Q2: July-Sept, Q3: Oct-Dec, Q4: Jan-March), releasing ₹3000 per quarter.'
  },
  {
    q: 'Can a pensioner change their bank account after sanction?',
    a: 'Yes, but the request must be submitted along with a cancelled cheque or passbook copy to the respective District Social Welfare Officer (DSWO) or District Probation Officer (DPO).'
  },
  {
    q: 'What happens if the annual life certificate is submitted late?',
    a: 'Payments are paused upon lapse. Once the digital life certificate (DLC) is updated, arrears for withheld quarters are credited in the subsequent PFMS cycle.'
  },
  {
    q: 'How can home-bound senior citizens submit Jeevan Pramaan?',
    a: 'They can request the India Post Payments Bank (IPPB) Doorstep DLC service, where the local postman or Gramin Dak Sevak visits the home with a biometric device.'
  }
];

/**
 * Returns procedural FAQs for UP pension beneficiaries.
 * @returns {Array<{q: string, a: string}>}
 */
export function getPensionFaqs() {
  return UP_PENSION_HELP_FAQS;
}
