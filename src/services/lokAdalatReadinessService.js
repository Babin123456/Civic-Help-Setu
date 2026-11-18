/**
 * Lok Adalat Schedule and Settlement-Readiness Guide Service
 * 
 * Provides workflow guidance and case settlement preparation under Chapter VI
 * of the Legal Services Authorities Act, 1987.
 * Key statutory principles:
 * - Pre-litigation disputes vs. Pending court cases
 * - Mutual voluntary consent rule: Conciliators cannot impose an involuntary settlement
 * - Section 21 Award: Deemed a decree of a Civil Court, final and binding, NO appeal lies
 * - Full refund of court fees under Section 16 of the Court Fees Act, 1870
 * - Eligible matters: MACT, bank recovery, cheque bounce (NI Act 138), labour disputes,
 *   compoundable criminal cases, matrimonial/family maintenance, electricity/water bills.
 */

export const LOK_ADALAT_STAGES = {
  PRE_LITIGATION: {
    code: 'PRE_LITIGATION',
    label: 'Pre-Litigation Settlement (Before filing in Court)',
    description: 'Dispute referred directly to Lok Adalat without filing a regular court plaint. Zero court fees required.'
  },
  PENDING_CASE: {
    code: 'PENDING_CASE',
    label: 'Pending Court Case Referral',
    description: 'Case currently pending before a court referred by joint consent or application under Section 20(1).'
  }
};

export const SUITABLE_CASE_CATEGORIES = {
  MOTOR_ACCIDENT_MACT: {
    code: 'MACT',
    label: 'Motor Accident Claims (MACT)',
    suitableForLokAdalat: true,
    commonOutcome: 'Mutual insurance settlement on compensation quantum without protracted trial.'
  },
  CHEQUE_BOUNCE_NI_138: {
    code: 'NI_ACT_138',
    label: 'Cheque Bounce Cases (Section 138 NI Act)',
    suitableForLokAdalat: true,
    commonOutcome: 'Structured repayment installment agreement and compounding of offense.'
  },
  BANK_LOAN_RECOVERY: {
    code: 'BANK_RECOVERY',
    label: 'Bank / Financial Institution Recovery',
    suitableForLokAdalat: true,
    commonOutcome: 'One-Time Settlement (OTS) with waiver of penal interest charges.'
  },
  MATRIMONIAL_MAINTENANCE: {
    code: 'MATRIMONIAL',
    label: 'Family & Matrimonial Disputes (Maintenance / Custody)',
    suitableForLokAdalat: true,
    commonOutcome: 'Amicable reconciliation or mutually consented settlement of permanent alimony.'
  },
  CIVIL_LAND_DISPUTE: {
    code: 'CIVIL_LAND',
    label: 'Civil Suits & Partition Disputes',
    suitableForLokAdalat: true,
    commonOutcome: 'Compromise decree resolving boundary, rent, or inheritance disputes.'
  },
  NON_COMPOUNDABLE_CRIMINAL: {
    code: 'NON_COMPOUNDABLE',
    label: 'Non-Compoundable Criminal Offenses',
    suitableForLokAdalat: false,
    statutoryBar: 'Under Section 19(5) proviso, Lok Adalat has NO jurisdiction over non-compoundable offenses.'
  }
};

export const STATUTORY_AWARD_FACTS = {
  statute: 'Legal Services Authorities Act, 1987 (Section 21)',
  natureOfAward: 'Every award of the Lok Adalat shall be deemed to be a decree of a civil court.',
  appealability: 'No appeal shall lie to any court against the award of the Lok Adalat (final and binding).',
  courtFeeRefund: 'Court fee paid in court is fully refunded under Section 16 of the Court Fees Act, 1870 upon compromise.'
};

export const FREQUENTLY_ASKED_QUESTIONS = [
  {
    q: 'Can a party back out during Lok Adalat proceedings?',
    a: 'Yes. Until the settlement terms are mutually agreed, signed, and the award is pronounced by the bench, either party can withdraw consent without penalty.'
  },
  {
    q: 'What if one party does not comply with the Lok Adalat Award?',
    a: 'Because Section 21 deems the Award a decree of a Civil Court, it is executable directly through regular Civil Court execution proceedings (Order XXI of CPC).'
  },
  {
    q: 'Is an advocate mandatory in Lok Adalat?',
    a: 'No. Parties can present their settlement terms directly in person before the conciliator bench.'
  },
  {
    q: 'Are court fees refunded if the case is only partially settled?',
    a: 'Under Section 16 of the Court Fees Act 1870, refund certificates are issued upon compromise of the suit in Lok Adalat as certified by the presiding officer.'
  }
];

export const SETTLEMENT_DOCUMENT_CHECKLIST = [
  { code: 'ID_PROOF', title: 'Valid Government Photo ID of all parties', mandatory: true },
  { code: 'CASE_PAPERS', title: 'Plaint / Written Statement / FIR copy / Charge sheet', mandatory: true },
  { code: 'COMPROMISE_TERMS', title: 'Written memo of agreed settlement terms & installment schedule', mandatory: true },
  { code: 'PAYMENT_INSTRUMENT', title: 'Demand Draft / Cheque / Bank Transfer receipt for agreed consideration', mandatory: false },
  { code: 'AUTHORIZATION_LETTER', title: 'Board Resolution / Power of Attorney if representing a company or bank', mandatory: false }
];

/**
 * Validates documentation completeness for a Lok Adalat session.
 * @param {Array<string>} submittedDocCodes 
 * @returns {Object} docReadiness
 */
export function validateSettlementDocuments(submittedDocCodes = []) {
  const missingMandatory = SETTLEMENT_DOCUMENT_CHECKLIST.filter(
    doc => doc.mandatory && !submittedDocCodes.includes(doc.code)
  );
  return {
    isReady: missingMandatory.length === 0,
    missingMandatory,
    submittedCount: submittedDocCodes.length,
    totalRequired: SETTLEMENT_DOCUMENT_CHECKLIST.filter(d => d.mandatory).length
  };
}

/**
 * Assesses whether a matter is suitable for Lok Adalat referral and validates preparation.
 * @param {Object} caseDetails 
 * @returns {Object} assessment
 */
export function assessLokAdalatReadiness(caseDetails = {}) {
  const errors = [];
  const warnings = [];

  if (!caseDetails.disputeSummary || caseDetails.disputeSummary.trim().length < 5) {
    errors.push('A concise summary of the dispute and claims is required.');
  }

  const category = SUITABLE_CASE_CATEGORIES[caseDetails.matterCategory];
  if (!category) {
    errors.push('A valid matter category must be selected.');
  } else if (!category.suitableForLokAdalat) {
    errors.push(`Statutory bar: ${category.statutoryBar}`);
  }

  const stage = LOK_ADALAT_STAGES[caseDetails.stage] || LOK_ADALAT_STAGES.PRE_LITIGATION;

  // Mutual consent readiness check
  if (caseDetails.willingToCompromise === false) {
    warnings.push('Voluntary compromise is the bedrock of Lok Adalat. If either party refuses conciliation, the bench cannot adjudicate and must return the case.');
  }

  if (stage.code === 'PENDING_CASE' && !caseDetails.courtCaseNumber) {
    warnings.push('Existing court case number / CNR number is recommended for pending case referral.');
  }

  const isEligible = errors.length === 0;

  return {
    isEligible,
    stage,
    category: category || null,
    errors,
    warnings,
    statutoryAwardNotice: STATUTORY_AWARD_FACTS,
    nextSteps: getLokAdalatNextSteps(stage.code)
  };
}

/**
 * Returns procedural steps based on stage (Pre-litigation vs Pending).
 * @param {string} stageCode 
 * @returns {Array<string>}
 */
export function getLokAdalatNextSteps(stageCode) {
  if (stageCode === 'PENDING_CASE') {
    return [
      'File a joint memo or individual application under Section 20(1) before the presiding trial court requesting referral to the upcoming National Lok Adalat.',
      'Trial court passes an order referring the matter to the Lok Adalat bench.',
      'Both parties and authorized counsels appear before the bench (comprising a sitting/retired judge and an advocate/social worker).',
      'Upon mutually agreeable terms, bench records statements and signs the formal Award.',
      'Apply to trial court registry for 100% refund certificate of court fees paid.'
    ];
  }

  return [
    'Submit pre-litigation dispute petition Form-1 to the Secretary, District Legal Services Authority (DLSA).',
    'DLSA issues an informal conciliation notice to the opposite party with a proposed date.',
    'Parties attend pre-sitting conciliation to explore settlement figures or terms.',
    'If agreement is reached, it is placed before the National/State Lok Adalat Bench for passing of formal Decree Award.',
    'If opposite party refuses or negotiations fail, parties are free to file regular litigation with no prejudice.'
  ];
}

/**
 * Formats a Lok Adalat Case-Readiness Dossier for the citizen.
 * @param {Object} caseDetails 
 * @returns {string} markdownReport
 */
export function exportLokAdalatDossier(caseDetails = {}) {
  const assessment = assessLokAdalatReadiness(caseDetails);

  return [
    `# Lok Adalat Settlement-Readiness Dossier`,
    `**Dispute Title:** ${caseDetails.title || 'Civic Settlement Matter'}`,
    `**Matter Category:** ${assessment.category ? assessment.category.label : 'N/A'}`,
    `**Procedural Stage:** ${assessment.stage.label}`,
    `**Readiness Status:** ${assessment.isEligible ? 'SUITABLE FOR LOK ADALAT CONCILIATION' : 'INELIGIBLE / ACTION REQUIRED'}`,
    ``,
    `## Essential Statutory Principles`,
    `- **Mutual Consent Principle:** Lok Adalat has no adjudicatory power to impose a decision without consent.`,
    `- **Finality (Section 21):** Once an Award is passed, it is final, treated as a Civil Court Decree, and NO appeal lies.`,
    `- **Court Fee Refund:** Full refund of court fees under Section 16 Court Fees Act if a pending case is settled.`,
    ``,
    `## Recommended Procedural Roadmap`,
    ...assessment.nextSteps.map((s, idx) => `${idx + 1}. ${s}`),
    ...(assessment.errors.length > 0 ? [``, `## Statutory Disqualifications / Errors`, ...assessment.errors.map(e => `- ❌ ${e}`)] : []),
    ...(assessment.warnings.length > 0 ? [``, `## Important Precautions`, ...assessment.warnings.map(w => `- ⚠️ ${w}`)] : [])
  ].join('\n');
}
