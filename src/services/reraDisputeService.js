/**
 * RERA Homebuyer Dispute & Statutory Interest Service
 *
 * Implements deterministic statutory calculations, jurisdiction rules,
 * Section 14 structural defect evaluations, and Form M / Form N dispute
 * petition drafting under the Real Estate (Regulation and Development) Act, 2016.
 */

/**
 * Standard SBI 1-Year Marginal Cost of Funds Based Lending Rate (MCLR).
 * State RERA Rules benchmark statutory delay interest to SBI MCLR + 2%.
 */
export const DEFAULT_SBI_MCLR_RATE = 8.75; // 8.75% per annum
export const STATUTORY_MARGIN_RATE = 2.0;  // +2.0% statutory margin
export const DEFAULT_STATUTORY_INTEREST_RATE = DEFAULT_SBI_MCLR_RATE + STATUTORY_MARGIN_RATE; // 10.75%

/**
 * Supported State RERA Jurisdictions with official portals, statutory benches,
 * standard filing fees, and conciliation availability.
 */
export const RERA_JURISDICTIONS = {
  MAHARASHTRA: {
    id: 'MAHARASHTRA',
    stateName: 'Maharashtra',
    authorityName: 'Maharashtra Real Estate Regulatory Authority (MahaRERA)',
    portalUrl: 'https://maharera.mahaonline.gov.in',
    standardFeeInr: 5000,
    conciliationFeeInr: 1000,
    executionFeeInr: 1000,
    reatAppealFeeInr: 5000,
    postalNoticeInr: 500,
    hasConciliationForum: true,
    rulesCitation: 'MahaRERA (General) Regulations, 2017 & Rule 18',
    registrationPrefix: 'P5',
  },
  KARNATAKA: {
    id: 'KARNATAKA',
    stateName: 'Karnataka',
    authorityName: 'Karnataka Real Estate Regulatory Authority (K-RERA)',
    portalUrl: 'https://rera.karnataka.gov.in',
    standardFeeInr: 2000,
    conciliationFeeInr: 1000,
    executionFeeInr: 1000,
    reatAppealFeeInr: 5000,
    postalNoticeInr: 500,
    hasConciliationForum: true,
    rulesCitation: 'Karnataka Real Estate (Regulation and Development) Rules, 2017 - Rule 15',
    registrationPrefix: 'PRM/KA/RERA',
  },
  UTTAR_PRADESH: {
    id: 'UTTAR_PRADESH',
    stateName: 'Uttar Pradesh',
    authorityName: 'Uttar Pradesh Real Estate Regulatory Authority (UP RERA)',
    portalUrl: 'https://www.up-rera.in',
    standardFeeInr: 1000,
    conciliationFeeInr: 500,
    executionFeeInr: 500,
    reatAppealFeeInr: 1000,
    postalNoticeInr: 300,
    hasConciliationForum: true,
    rulesCitation: 'UP Real Estate (Regulation and Development) Rules, 2016 - Rule 16',
    registrationPrefix: 'UPRERAPRJ',
  },
  HARYANA_GURUGRAM: {
    id: 'HARYANA_GURUGRAM',
    stateName: 'Haryana (Gurugram)',
    authorityName: 'Haryana Real Estate Regulatory Authority (HARERA Gurugram)',
    portalUrl: 'https://haryanarera.gov.in',
    standardFeeInr: 1000,
    conciliationFeeInr: 500,
    executionFeeInr: 1000,
    reatAppealFeeInr: 1000,
    postalNoticeInr: 500,
    hasConciliationForum: true,
    rulesCitation: 'Haryana Real Estate (Regulation and Development) Rules, 2017 - Rule 18',
    registrationPrefix: 'RC/REP/HARERA/GGM',
  },
  TAMIL_NADU: {
    id: 'TAMIL_NADU',
    stateName: 'Tamil Nadu',
    authorityName: 'Tamil Nadu Real Estate Regulatory Authority (TNRERA)',
    portalUrl: 'https://www.rera.tn.gov.in',
    standardFeeInr: 1000,
    conciliationFeeInr: 500,
    executionFeeInr: 1000,
    reatAppealFeeInr: 2000,
    postalNoticeInr: 400,
    hasConciliationForum: true,
    rulesCitation: 'Tamil Nadu Real Estate (Regulation and Development) Rules, 2017 - Rule 19',
    registrationPrefix: 'TN/RERA',
  },
  DELHI: {
    id: 'DELHI',
    stateName: 'NCT of Delhi',
    authorityName: 'Real Estate Regulatory Authority Delhi (Delhi RERA)',
    portalUrl: 'https://rera.delhi.gov.in',
    standardFeeInr: 1000,
    conciliationFeeInr: 500,
    executionFeeInr: 1000,
    reatAppealFeeInr: 1000,
    postalNoticeInr: 500,
    hasConciliationForum: false,
    rulesCitation: 'National Capital Territory of Delhi Real Estate Rules, 2016',
    registrationPrefix: 'DLRERA',
  },
  GUJARAT: {
    id: 'GUJARAT',
    stateName: 'Gujarat',
    authorityName: 'Gujarat Real Estate Regulatory Authority (GujRERA)',
    portalUrl: 'https://gujrera.gujarat.gov.in',
    standardFeeInr: 1000,
    conciliationFeeInr: 500,
    executionFeeInr: 1000,
    reatAppealFeeInr: 1000,
    postalNoticeInr: 500,
    hasConciliationForum: true,
    rulesCitation: 'Gujarat Real Estate (Regulation and Development) Rules, 2017',
    registrationPrefix: 'PR/GJ',
  },
};

/**
 * Statutory relief types under RERA Section 18.
 */
export const RERA_RELIEF_TYPE = {
  WITHDRAWAL_REFUND: 'WITHDRAWAL_REFUND', // Section 18(1) 1st Proviso: Return of paid amount + interest + compensation
  POSSESSION_DELAY_INTEREST: 'POSSESSION_DELAY_INTEREST', // Section 18(1) 2nd Proviso: Stay in project, monthly delay interest
};

/**
 * Statutory petition forms.
 */
export const RERA_FORM_TYPE = {
  FORM_M: 'FORM_M', // Section 31 complaint before Real Estate Regulatory Authority
  FORM_N: 'FORM_N', // Section 71 complaint before Adjudicating Officer for compensation
};

/**
 * Section 14(3) defect classifications.
 */
export const STRUCTURAL_DEFECT_CATEGORIES = {
  RCC_STRUCTURAL: {
    id: 'RCC_STRUCTURAL',
    label: 'Structural Foundation & RCC Failure (Cracks, Beam deflection, Sinking)',
    severity: 'CRITICAL',
    statutoryRef: 'Section 14(3) - Structural Defect',
  },
  WATERPROOFING_SEEPAGE: {
    id: 'WATERPROOFING_SEEPAGE',
    label: 'Waterproofing & Severe Efflorescence / Leakage (Roof, Podium, Basement)',
    severity: 'HIGH',
    statutoryRef: 'Section 14(3) - Workmanship / Quality Defect',
  },
  FIRE_SAFETY_ELECTRICAL: {
    id: 'FIRE_SAFETY_ELECTRICAL',
    label: 'Fire Fighting System & Substation / Transformer Defect',
    severity: 'CRITICAL',
    statutoryRef: 'Section 14(3) - Provision of Services Defect',
  },
  PLUMBING_DRAINAGE: {
    id: 'PLUMBING_DRAINAGE',
    label: 'Sewage Ingress, Common Riser Pipe Rupture & Water Supply Failure',
    severity: 'HIGH',
    statutoryRef: 'Section 14(3) - Workmanship / Quality Defect',
  },
  FINISHING_PLASTER: {
    id: 'FINISHING_PLASTER',
    label: 'Exterior Plaster Spalling, Hollow Tiles & Material Delamination',
    severity: 'MODERATE',
    statutoryRef: 'Section 14(3) - Workmanship Defect',
  },
};

/**
 * Validates whether a date string is valid ISO YYYY-MM-DD.
 */
export function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;
  const d = new Date(dateStr);
  return !Number.isNaN(d.getTime());
}

/**
 * Computes difference in calendar days between two ISO dates.
 */
export function getDaysBetween(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Computes difference in approximate months between two ISO dates.
 */
export function getMonthsBetween(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * Calculates RERA Section 18 statutory delayed possession interest and refund entitlement.
 *
 * @param {Object} params
 * @param {string} params.committedPossessionDate ISO date (YYYY-MM-DD) committed in Agreement for Sale
 * @param {number} [params.gracePeriodMonths=0] Grace period granted in Agreement (e.g. 3 or 6 months)
 * @param {string} [params.evaluationDate] Current evaluation date (defaults to today's date)
 * @param {number} params.totalPaidInr Total monetary amount paid by homebuyer to promoter (in INR)
 * @param {number} [params.totalAgreementCostInr=0] Total sanctioned purchase price in Agreement for Sale
 * @param {number} [params.annualInterestRate=DEFAULT_STATUTORY_INTEREST_RATE] Annual interest percentage (SBI MCLR + 2%)
 * @param {string} [params.reliefType=RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST] Relief type (Withdrawal vs Possession)
 * @returns {Object} Comprehensive delay interest and claim breakdown
 */
export function calculateReraDelayInterest({
  committedPossessionDate,
  gracePeriodMonths = 0,
  evaluationDate,
  totalPaidInr = 0,
  totalAgreementCostInr = 0,
  annualInterestRate = DEFAULT_STATUTORY_INTEREST_RATE,
  reliefType = RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST,
}) {
  const paid = Math.max(0, Number(totalPaidInr) || 0);
  const agreementCost = Math.max(0, Number(totalAgreementCostInr) || paid);
  const rate = Math.max(0.1, Number(annualInterestRate) || DEFAULT_STATUTORY_INTEREST_RATE);
  const grace = Math.max(0, parseInt(gracePeriodMonths, 10) || 0);

  if (!isValidDate(committedPossessionDate)) {
    return {
      isValid: false,
      error: 'Invalid or missing committed possession date.',
      isDelayed: false,
      delayDays: 0,
      delayMonths: 0,
      accruedInterestInr: 0,
      monthlyDelayCompensationInr: 0,
      totalClaimableAmountInr: paid,
    };
  }

  const effectivePossessionDateObj = new Date(committedPossessionDate);
  if (grace > 0) {
    effectivePossessionDateObj.setMonth(effectivePossessionDateObj.getMonth() + grace);
  }
  const effectivePossessionDate = effectivePossessionDateObj.toISOString().slice(0, 10);

  const evalDate = isValidDate(evaluationDate)
    ? evaluationDate
    : new Date().toISOString().slice(0, 10);

  const delayDays = getDaysBetween(effectivePossessionDate, evalDate);
  const isDelayed = delayDays > 0;
  const delayMonths = isDelayed ? getMonthsBetween(effectivePossessionDate, evalDate) : 0;

  // Statutory simple interest formula: Interest = Principal * Rate * (Days / 365)
  // Per Section 18 and standard appellate tribunal benchmarks:
  const accruedInterestInr = isDelayed
    ? Math.round((paid * (rate / 100) * delayDays) / 365)
    : 0;

  // Monthly delay compensation (for Option B: staying in the project):
  // Monthly interest = Principal * (Rate / 100) / 12
  const monthlyDelayCompensationInr = isDelayed
    ? Math.round((paid * (rate / 100)) / 12)
    : 0;

  // Total claimable amount:
  // If WITHDRAWAL_REFUND: Principal Paid + Accrued Delay Interest
  // If POSSESSION_DELAY_INTEREST: Accrued Delay Interest up to evaluation date (Principal remains invested in unit)
  const totalClaimableAmountInr = reliefType === RERA_RELIEF_TYPE.WITHDRAWAL_REFUND
    ? paid + accruedInterestInr
    : accruedInterestInr;

  const paidPercentage = agreementCost > 0
    ? Math.min(100, Math.round((paid / agreementCost) * 100))
    : 100;

  return {
    isValid: true,
    isDelayed,
    committedPossessionDate,
    gracePeriodMonths: grace,
    effectivePossessionDate,
    evaluationDate: evalDate,
    delayDays,
    delayMonths,
    totalPaidInr: paid,
    totalAgreementCostInr: agreementCost,
    paidPercentage,
    annualInterestRate: rate,
    reliefType,
    accruedInterestInr,
    monthlyDelayCompensationInr,
    totalClaimableAmountInr,
    statutoryCitation: reliefType === RERA_RELIEF_TYPE.WITHDRAWAL_REFUND
      ? 'Section 18(1) First Proviso - Full Refund with Statutory Interest at SBI MCLR + 2%'
      : 'Section 18(1) Second Proviso - Monthly Delay Compensation until Possession Handover',
  };
}

/**
 * Evaluates Section 14(3) 5-year structural defect liability and 30-day notice SLA.
 *
 * @param {Object} params
 * @param {string} params.possessionHandoverDate Date when physical possession was taken (YYYY-MM-DD)
 * @param {string} params.defectNoticeDate Date when written notice was served to promoter (YYYY-MM-DD)
 * @param {string} params.defectCategory Category key from STRUCTURAL_DEFECT_CATEGORIES
 * @param {string} [params.evaluationDate] Current evaluation date (defaults to today)
 * @returns {Object} Defect liability evaluation
 */
export function evaluateStructuralDefectLiability({
  possessionHandoverDate,
  defectNoticeDate,
  defectCategory,
  evaluationDate,
}) {
  if (!isValidDate(possessionHandoverDate)) {
    return {
      isValid: false,
      error: 'Invalid or missing possession handover date.',
      withinFiveYearWindow: false,
      isPromoterSlaBreached: false,
    };
  }

  const evalDate = isValidDate(evaluationDate)
    ? evaluationDate
    : new Date().toISOString().slice(0, 10);

  const handoverObj = new Date(possessionHandoverDate);
  const fiveYearExpiryObj = new Date(handoverObj);
  fiveYearExpiryObj.setFullYear(fiveYearExpiryObj.getFullYear() + 5);
  const fiveYearExpiryDate = fiveYearExpiryObj.toISOString().slice(0, 10);

  const noticeDate = isValidDate(defectNoticeDate) ? defectNoticeDate : evalDate;
  const daysSinceHandover = getDaysBetween(possessionHandoverDate, noticeDate);
  const withinFiveYearWindow = new Date(noticeDate) <= fiveYearExpiryObj;

  // Section 14(3) mandates rectification within 30 days from notice
  let daysSinceNotice = 0;
  let isPromoterSlaBreached = false;
  let remainingSlaDays = 30;

  if (isValidDate(defectNoticeDate)) {
    daysSinceNotice = getDaysBetween(defectNoticeDate, evalDate);
    isPromoterSlaBreached = daysSinceNotice > 30;
    remainingSlaDays = Math.max(0, 30 - daysSinceNotice);
  }

  const defectMeta = STRUCTURAL_DEFECT_CATEGORIES[defectCategory] || {
    id: 'OTHER',
    label: 'Unspecified Workmanship / Material Defect',
    severity: 'MODERATE',
    statutoryRef: 'Section 14(3)',
  };

  return {
    isValid: true,
    possessionHandoverDate,
    fiveYearExpiryDate,
    defectNoticeDate: isValidDate(defectNoticeDate) ? defectNoticeDate : null,
    evaluationDate: evalDate,
    daysSinceHandover,
    withinFiveYearWindow,
    daysSinceNotice,
    remainingSlaDays,
    isPromoterSlaBreached,
    defectCategory: defectMeta.id,
    defectLabel: defectMeta.label,
    severity: defectMeta.severity,
    statutoryRemedy: withinFiveYearWindow
      ? isPromoterSlaBreached
        ? 'Statutory 30-Day SLA Expired: Allottee entitled to claim compensatory damages under Section 14(3) read with Section 71.'
        : `Within 30-Day Rectification Period: ${remainingSlaDays} days remaining for promoter to rectify without charge.`
      : 'Defect reported after expiry of 5-year statutory warranty window.',
  };
}

/**
 * Standard evidence items required for filing a RERA Form M or Form N complaint.
 */
export const RERA_EVIDENCE_CHECKLIST = [
  {
    id: 'agreement_for_sale',
    label: 'Registered Agreement for Sale / Builder-Buyer Agreement (BBA)',
    mandatory: true,
    description: 'Stamped agreement detailing unit specification, total consideration, and promised possession date.',
  },
  {
    id: 'allotment_letter',
    label: 'Allotment Letter & Booking Application Form',
    mandatory: true,
    description: 'Initial booking confirmation establishing locus standi and unit assignment.',
  },
  {
    id: 'payment_receipts',
    label: 'Payment Receipts & Bank Account Statement',
    mandatory: true,
    description: 'Chronological proof of every installment paid to the promoter or escrow account.',
  },
  {
    id: 'rera_project_certificate',
    label: 'RERA Project Registration Certificate / Web Printout',
    mandatory: false,
    description: 'Official RERA registration number and quarterly progress report (QPR) printout.',
  },
  {
    id: 'delay_correspondence',
    label: 'Delay Notices & Communication with Promoter',
    mandatory: false,
    description: 'Emails, demand letters, or replies acknowledging delay or force majeure claims.',
  },
  {
    id: 'site_photographs',
    label: 'Photographs of Incomplete Work / Structural Defects',
    mandatory: false,
    description: 'Geotagged site inspection images evidencing unfinished construction or structural flaws.',
  },
  {
    id: 'demand_notice_served',
    label: 'Written Legal Notice / Demand Letter Served to Promoter',
    mandatory: false,
    description: 'Proof of dispatch and delivery of formal notice claiming possession or defect cure.',
  },
];

/**
 * Evaluates evidence completeness and readiness score.
 */
export function evaluateReraEvidenceReadiness(checklistState = {}) {
  const items = RERA_EVIDENCE_CHECKLIST.map((item) => ({
    ...item,
    attached: Boolean(checklistState[item.id]),
  }));

  const mandatoryItems = items.filter((i) => i.mandatory);
  const attachedMandatory = mandatoryItems.filter((i) => i.attached);
  const allMandatoryAttached = attachedMandatory.length === mandatoryItems.length;

  const totalAttached = items.filter((i) => i.attached).length;
  const readinessPercentage = Math.round((totalAttached / items.length) * 100);

  return {
    items,
    readinessPercentage,
    allMandatoryAttached,
    totalAttached,
    totalItems: items.length,
    missingMandatory: mandatoryItems.filter((i) => !i.attached).map((i) => i.label),
  };
}

/**
 * Drafts a formal, court-ready RERA Form M or Form N Dispute Complaint.
 *
 * @param {Object} petitionData
 * @returns {string} Formatted statutory legal petition text
 */
export function draftReraDisputePetition(petitionData = {}) {
  const jurisdictionKey = petitionData.jurisdiction || 'MAHARASHTRA';
  const jurisdiction = RERA_JURISDICTIONS[jurisdictionKey] || RERA_JURISDICTIONS.MAHARASHTRA;
  const formType = petitionData.formType || RERA_FORM_TYPE.FORM_M;

  const calculation = calculateReraDelayInterest({
    committedPossessionDate: petitionData.committedPossessionDate,
    gracePeriodMonths: petitionData.gracePeriodMonths || 0,
    evaluationDate: petitionData.evaluationDate,
    totalPaidInr: petitionData.totalPaidInr || 0,
    totalAgreementCostInr: petitionData.totalAgreementCostInr || 0,
    annualInterestRate: petitionData.annualInterestRate || DEFAULT_STATUTORY_INTEREST_RATE,
    reliefType: petitionData.reliefType || RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST,
  });

  const isFormM = formType === RERA_FORM_TYPE.FORM_M;
  const forumTitle = isFormM
    ? `BEFORE THE REAL ESTATE REGULATORY AUTHORITY, ${jurisdiction.stateName.toUpperCase()}`
    : `BEFORE THE ADJUDICATING OFFICER, ${jurisdiction.stateName.toUpperCase()}`;

  const complainantName = petitionData.complainant?.name || '[COMPLAINANT NAME]';
  const complainantAddress = petitionData.complainant?.address || '[COMPLAINANT RESIDENTIAL ADDRESS]';
  const complainantContact = petitionData.complainant?.contact || '[COMPLAINANT PHONE / EMAIL]';

  const promoterName = petitionData.promoter?.name || '[PROMOTER / BUILDER NAME]';
  const projectName = petitionData.promoter?.projectName || '[PROJECT NAME]';
  const reraRegNo = petitionData.promoter?.reraRegNo || '[RERA REGISTRATION NUMBER]';
  const projectLocation = petitionData.promoter?.projectLocation || '[PROJECT LOCATION / TALUK / DISTRICT]';
  const unitNo = petitionData.unitDetails?.unitNo || '[UNIT / FLAT / PLOT NUMBER]';

  const interimReliefs = Array.isArray(petitionData.interimReliefs) && petitionData.interimReliefs.length > 0
    ? petitionData.interimReliefs
    : [
        'Restrain the Respondent Promoter from creating any third-party rights or alienating the subject unit.',
        'Direct the Respondent Promoter to submit escrow account bank statements for the subject project.',
      ];

  const lines = [
    '================================================================================',
    forumTitle,
    `COMPLAINT UNDER SECTION ${isFormM ? '31' : '71'} OF THE REAL ESTATE (REGULATION AND DEVELOPMENT) ACT, 2016`,
    `[STATUTORY ${isFormM ? 'FORM M' : 'FORM N'}]`,
    '================================================================================',
    '',
    'IN THE MATTER OF:',
    `1. COMPLAINANT / ALLOTTEE:`,
    `   ${complainantName}`,
    `   Address: ${complainantAddress}`,
    `   Contact: ${complainantContact}`,
    '',
    '                       VERSUS',
    '',
    `2. RESPONDENT / PROMOTER:`,
    `   ${promoterName}`,
    `   Project Name: ${projectName}`,
    `   RERA Registration No.: ${reraRegNo}`,
    `   Project Site: ${projectLocation}`,
    '',
    '--------------------------------------------------------------------------------',
    'I. PARTICULARS OF THE SUBJECT UNIT & TRANSACTION:',
    '--------------------------------------------------------------------------------',
    `1. Unit Assigned: ${unitNo}`,
    `2. Agreement for Sale Executed On: ${petitionData.agreementDate || '[DATE OF AGREEMENT]'}`,
    `3. Committed Possession Handover Date: ${calculation.committedPossessionDate || '[COMMITTED DATE]'}`,
    `4. Permissible Grace Period: ${calculation.gracePeriodMonths} Months`,
    `5. Effective Statutory Possession Deadline: ${calculation.effectivePossessionDate || '[EFFECTIVE DEADLINE]'}`,
    `6. Total Agreed Consideration: Rs. ${calculation.totalAgreementCostInr.toLocaleString('en-IN')}`,
    `7. Total Amount Disbursed by Complainant: Rs. ${calculation.totalPaidInr.toLocaleString('en-IN')} (${calculation.paidPercentage}% of agreed consideration)`,
    '',
    '--------------------------------------------------------------------------------',
    'II. CONCISE STATEMENT OF FACTS & GROUNDS OF COMPLAINT:',
    '--------------------------------------------------------------------------------',
    '1. The Complainant booked the aforementioned residential unit in the Respondent\'s registered project and has faithfully paid all demanded installments in accordance with the construction-linked payment plan.',
    `2. Under the registered Agreement for Sale, the Respondent was under a strict statutory duty under Section 18 to deliver vacant and peaceful possession on or before ${calculation.effectivePossessionDate}.`,
    `3. As of the evaluation date (${calculation.evaluationDate}), the Respondent has failed to obtain an Occupancy Certificate (OC) or hand over lawful possession, resulting in an unlawful delay of ${calculation.delayDays} days (${calculation.delayMonths} months).`,
    '4. The default is solely attributable to gross neglect, financial diversion, and administrative mismanagement by the Respondent Promoter, causing immense financial distress and mental agony to the Complainant.',
    '',
    '--------------------------------------------------------------------------------',
    'III. STATUTORY DELAY INTEREST & COMPENSATION COMPUTATION:',
    '--------------------------------------------------------------------------------',
    `Prescribed Benchmark Interest Rate: ${calculation.annualInterestRate}% p.a. (SBI MCLR of ${DEFAULT_SBI_MCLR_RATE}% + 2.0% statutory margin)`,
    `Statutory Remedy Invoked: ${calculation.statutoryCitation}`,
    `Total Accrued Statutory Delay Interest: Rs. ${calculation.accruedInterestInr.toLocaleString('en-IN')}`,
    calculation.reliefType === RERA_RELIEF_TYPE.POSSESSION_DELAY_INTEREST
      ? `Ongoing Monthly Delay Compensation: Rs. ${calculation.monthlyDelayCompensationInr.toLocaleString('en-IN')} per month until actual possession handover.`
      : `Full Refund Entitlement (Principal + Interest): Rs. ${calculation.totalClaimableAmountInr.toLocaleString('en-IN')}`,
    '',
    '--------------------------------------------------------------------------------',
    'IV. INTERIM PRAYERS / DIRECTIONS SOUGHT PENDING INQUIRY:',
    '--------------------------------------------------------------------------------',
    ...interimReliefs.map((relief, idx) => `${idx + 1}. ${relief}`),
    '',
    '--------------------------------------------------------------------------------',
    'V. FINAL PRAYER / RELIEFS:',
    '--------------------------------------------------------------------------------',
    'In light of the statutory facts and violations stated above, the Complainant respectfully prays that this Hon\'ble Forum may be pleased to:',
    calculation.reliefType === RERA_RELIEF_TYPE.WITHDRAWAL_REFUND
      ? `(a) Direct the Respondent to forthwith refund the entire principal sum of Rs. ${calculation.totalPaidInr.toLocaleString('en-IN')} along with statutory interest of Rs. ${calculation.accruedInterestInr.toLocaleString('en-IN')} computed at ${calculation.annualInterestRate}% p.a.`
      : `(a) Direct the Respondent to pay monthly delay compensation of Rs. ${calculation.monthlyDelayCompensationInr.toLocaleString('en-IN')} from the default date (${calculation.effectivePossessionDate}) until actual handover of possession with valid Occupancy Certificate.`,
    '(b) Award compensatory costs towards mental harassment and legal litigation expenses under Section 71.',
    '(c) Pass any such further orders as this Hon\'ble Authority deems fit and proper in the interest of justice.',
    '',
    '--------------------------------------------------------------------------------',
    'VI. VERIFICATION',
    '--------------------------------------------------------------------------------',
    `I, ${complainantName}, the Complainant above-named, do hereby verify that the contents of paragraphs I to V are true and correct to the best of my knowledge, and no part thereof is false and nothing material has been concealed therefrom.`,
    '',
    `Verified at: ${jurisdiction.stateName}`,
    `Date: ${calculation.evaluationDate}`,
    '',
    '______________________________',
    'Signature of Complainant',
    '================================================================================',
  ];

  return lines.join('\n');
}

/**
 * Standard legal grounds for Section 40 Execution and Revenue Recovery Certificate.
 */
export const RERA_EXECUTION_GROUNDS = {
  NON_COMPLIANCE_60_DAYS: {
    id: 'NON_COMPLIANCE_60_DAYS',
    label: 'Promoter failure to deposit or refund awarded sum within statutory 60-day compliance window',
    statutoryRef: 'Section 40(1) & State RERA Execution Rules',
  },
  BANK_ACCOUNT_ATTACHMENT: {
    id: 'BANK_ACCOUNT_ATTACHMENT',
    label: 'Prayer for garnishment and attachment of Promoter master, escrow, and operational bank accounts',
    statutoryRef: 'Section 40(2) & Order XXI Rule 46 Code of Civil Procedure (CPC)',
  },
  UNSOLD_INVENTORY_ATTACHMENT: {
    id: 'UNSOLD_INVENTORY_ATTACHMENT',
    label: 'Prayer for attachment and public auction of unsold apartments, commercial units, and project land',
    statutoryRef: 'Section 40(2) & Order XXI Rule 54 CPC',
  },
  REVENUE_RECOVERY_CERTIFICATE: {
    id: 'REVENUE_RECOVERY_CERTIFICATE',
    label: 'Issuance of Form P / Revenue Recovery Certificate (RRC) to District Collector for recovery as arrears of land revenue',
    statutoryRef: 'Section 40(1) RFCTLARR / RERA 2016',
  },
};

/**
 * Statutory Order types before RERA Appellate Tribunal (REAT).
 */
export const RERA_REAT_ORDER_TYPE = {
  REFUND_COMPENSATION: 'REFUND_COMPENSATION',
  PENALTY: 'PENALTY',
  DIRECTION_INTERIM: 'DIRECTION_INTERIM',
};

/**
 * Calculates Section 40 execution post-order running statutory interest and default status.
 *
 * @param {Object} params
 * @param {string} params.orderDate Date RERA order was pronounced (YYYY-MM-DD)
 * @param {number} params.orderAwardInr Total monetary decree awarded by RERA Authority / AO (INR)
 * @param {string} [params.evaluationDate] Evaluation date (defaults to today)
 * @param {number} [params.annualInterestRate=DEFAULT_STATUTORY_INTEREST_RATE] Annual simple interest rate (SBI MCLR + 2%)
 * @param {number} [params.statutoryComplianceGraceDays=60] Statutory compliance grace period (typically 60 days)
 * @returns {Object} Execution calculations and default assessment
 */
export function calculateExecutionPostOrderInterest({
  orderDate,
  orderAwardInr = 0,
  evaluationDate,
  annualInterestRate = DEFAULT_STATUTORY_INTEREST_RATE,
  statutoryComplianceGraceDays = 60,
}) {
  const award = Math.max(0, Number(orderAwardInr) || 0);
  const rate = Math.max(0.1, Number(annualInterestRate) || DEFAULT_STATUTORY_INTEREST_RATE);
  const graceDays = Math.max(0, parseInt(statutoryComplianceGraceDays, 10) || 60);

  if (!isValidDate(orderDate)) {
    return {
      isValid: false,
      error: 'Invalid or missing RERA order date.',
      isDefaulted: false,
      daysSinceOrder: 0,
      overdueDays: 0,
      postOrderInterestInr: 0,
      totalExecutableDebtInr: award,
      statutoryCitation: 'Section 40(1) Recovery as Arrears of Land Revenue',
    };
  }

  const evalDate = isValidDate(evaluationDate)
    ? evaluationDate
    : new Date().toISOString().slice(0, 10);

  const daysSinceOrder = getDaysBetween(orderDate, evalDate);
  const isDefaulted = daysSinceOrder > graceDays;
  const overdueDays = isDefaulted ? daysSinceOrder - graceDays : 0;

  // Running statutory simple interest on unpaid decree debt: Principal * (Rate / 100) * (Days / 365)
  const postOrderInterestInr = isDefaulted
    ? Math.round((award * (rate / 100) * overdueDays) / 365)
    : 0;

  const totalExecutableDebtInr = award + postOrderInterestInr;

  const orderDateObj = new Date(orderDate);
  orderDateObj.setDate(orderDateObj.getDate() + graceDays);
  const complianceDeadlineDate = orderDateObj.toISOString().slice(0, 10);

  return {
    isValid: true,
    orderDate,
    complianceDeadlineDate,
    evaluationDate: evalDate,
    orderAwardInr: award,
    statutoryComplianceGraceDays: graceDays,
    daysSinceOrder,
    isDefaulted,
    overdueDays,
    annualInterestRate: rate,
    postOrderInterestInr,
    totalExecutableDebtInr,
    statutoryCitation: 'Section 40(1) Recovery as Arrears of Land Revenue & Rule 25 Execution as Decree of Civil Court',
  };
}

/**
 * Formats a court-ready Execution Application / Form 'P' under Section 40.
 *
 * @param {Object} executionData
 * @returns {string} Formatted legal execution petition text
 */
export function generateSection40ExecutionPetition(executionData = {}) {
  const jurisdictionKey = executionData.jurisdiction || 'MAHARASHTRA';
  const jurisdiction = RERA_JURISDICTIONS[jurisdictionKey] || RERA_JURISDICTIONS.MAHARASHTRA;

  const complainantName = executionData.complainant?.name || '[NAME OF DECREE HOLDER / ALLOTTEE]';
  const complainantAddress = executionData.complainant?.address || '[ADDRESS OF DECREE HOLDER]';
  const complainantContact = executionData.complainant?.contact || '[CONTACT NUMBER]';

  const promoterName = executionData.promoter?.name || '[NAME OF JUDGMENT DEBTOR / PROMOTER]';
  const projectName = executionData.promoter?.projectName || '[PROJECT NAME]';
  const reraRegNo = executionData.promoter?.reraRegNo || '[RERA REGISTRATION NUMBER]';
  const registeredOffice = executionData.promoter?.registeredOffice || '[REGISTERED OFFICE ADDRESS OF BUILDER]';

  const orderNumber = executionData.orderNumber || '[ORIGINAL RERA COMPLAINT NO. / ORDER NO.]';
  const orderDate = executionData.orderDate || '[DATE OF RERA ORDER]';

  const executionCalculation = calculateExecutionPostOrderInterest({
    orderDate: executionData.orderDate,
    orderAwardInr: executionData.awardedAmountInr,
    evaluationDate: executionData.evaluationDate,
    annualInterestRate: executionData.annualInterestRate,
    statutoryComplianceGraceDays: executionData.graceDays || 60,
  });

  const lines = [
    '================================================================================',
    'IN THE COURT OF THE ADJUDICATING OFFICER / REAL ESTATE REGULATORY AUTHORITY',
    `BEFORE THE ${jurisdiction.authorityName.toUpperCase()}`,
    '================================================================================',
    '',
    `EXECUTION APPLICATION NO. __________ OF ${new Date().getFullYear()}`,
    `IN THE MATTER OF ORIGINAL COMPLAINT / ORDER NO.: ${orderNumber}`,
    '',
    'BETWEEN:',
    `1. ${complainantName},`,
    `   Residing at: ${complainantAddress}`,
    `   Contact / Email: ${complainantContact}`,
    '   ... DECREE HOLDER / EXECUTION APPLICANT (ALLOTTEE)',
    '',
    'AND',
    '',
    `1. ${promoterName},`,
    `   Having Registered Office at: ${registeredOffice}`,
    `   Project: "${projectName}"`,
    `   RERA Registration No.: ${reraRegNo}`,
    '   ... JUDGMENT DEBTOR / RESPONDENT PROMOTER',
    '',
    '--------------------------------------------------------------------------------',
    'APPLICATION UNDER SECTION 40 OF THE REAL ESTATE (REGULATION AND DEVELOPMENT) ACT,',
    '2016 READ WITH RULE 25 AND ORDER XXI OF THE CODE OF CIVIL PROCEDURE, 1908 FOR',
    'EXECUTION OF ORDER AND RECOVERY OF DECREETAL AMOUNT AS ARREARS OF LAND REVENUE.',
    '--------------------------------------------------------------------------------',
    '',
    'MOST RESPECTFULLY SHOWETH:',
    '',
    '1. PARTICULARS OF THE DECREE / ORDER:',
    `   (a) Forum: ${jurisdiction.authorityName}`,
    `   (b) Date of Final Order / Decree: ${orderDate}`,
    `   (c) Case Reference Number: ${orderNumber}`,
    `   (d) Principal Award / Refund Granted: Rs. ${Number(executionData.principalAwardInr || executionData.awardedAmountInr || 0).toLocaleString('en-IN')}`,
    `   (e) Statutory Interest & Costs Awarded: Rs. ${Number(executionData.interestAndCostsInr || 0).toLocaleString('en-IN')}`,
    `   (f) Total Decreetal Amount Awarded: Rs. ${executionCalculation.orderAwardInr.toLocaleString('en-IN')}`,
    `   (g) Statutory Compliance Deadline (60 Days): ${executionCalculation.complianceDeadlineDate}`,
    '',
    '2. GROUNDS OF WILLFUL DEFAULT & CONTEMPT:',
    `   (a) Under Section 40 of RERA, 2016 and the applicable statutory regulations, the Judgment Debtor was under a mandatory obligation to satisfy the order within 60 days, i.e., on or before ${executionCalculation.complianceDeadlineDate}.`,
    `   (b) As of ${executionCalculation.evaluationDate}, ${executionCalculation.daysSinceOrder} days have elapsed since the date of order, and the Judgment Debtor has deliberately failed, neglected, and refused to comply with the decree.`,
    `   (c) The default is deliberate, contumacious, and designed to deprive the Decree Holder of their hard-earned life savings in blatant disregard of this Hon'ble Authority's mandate.`,
    '',
    '3. COMPUTATION OF CURRENT EXECUTABLE DEBT:',
    `   (a) Principal Decreetal Debt: Rs. ${executionCalculation.orderAwardInr.toLocaleString('en-IN')}`,
    `   (b) Overdue Default Period: ${executionCalculation.overdueDays} Days (beyond 60-day grace period)`,
    `   (c) Running Post-Decree Statutory Simple Interest (${executionCalculation.annualInterestRate}% p.a.): Rs. ${executionCalculation.postOrderInterestInr.toLocaleString('en-IN')}`,
    `   (d) TOTAL EXECUTABLE AMOUNT RECOVERABLE: Rs. ${executionCalculation.totalExecutableDebtInr.toLocaleString('en-IN')}`,
    '',
    '4. PRAYER:',
    'In view of the contumacious non-compliance by the Judgment Debtor, the Decree Holder respectfully prays that this Hon\'ble Authority may be pleased to:',
    `   (a) Issue a REVENUE RECOVERY CERTIFICATE (RRC) / Form 'P' under Section 40(1) to the District Collector / District Magistrate, directing attachment and recovery of Rs. ${executionCalculation.totalExecutableDebtInr.toLocaleString('en-IN')} as arrears of land revenue.`,
    '   (b) Issue an order under Section 40(2) read with Order XXI Rule 46 CPC attaching all operational and project bank accounts of the Judgment Debtor including any RERA escrow accounts.',
    `   (c) Issue a prohibitory injunction under Order XXI Rule 54 CPC restraining the Judgment Debtor from alienating, selling, or encumbering unsold apartments or project land in "${projectName}".`,
    '   (d) Award actual costs of the present execution proceedings.',
    '',
    '--------------------------------------------------------------------------------',
    'VERIFICATION',
    '--------------------------------------------------------------------------------',
    `I, ${complainantName}, the Decree Holder above-named, do hereby verify that the contents of paragraphs 1 to 4 are true to my knowledge and based on records of this Hon'ble Court.`,
    '',
    `Verified at: ${jurisdiction.stateName}`,
    `Date: ${executionCalculation.evaluationDate}`,
    '',
    '___________________________________',
    'Signature of Decree Holder / Applicant',
    '================================================================================',
  ];

  return lines.join('\n');
}

/**
 * Evaluates Section 43(5) statutory pre-deposit requirements for filing appeals before REAT.
 *
 * @param {Object} params
 * @param {string} [params.appealFilerRole='PROMOTER'] Role of appellant ('PROMOTER' or 'ALLOTTEE')
 * @param {string} [params.orderType=RERA_REAT_ORDER_TYPE.REFUND_COMPENSATION] Type of order being appealed
 * @param {number} [params.penaltyAmountInr=0] Penalty imposed if orderType is PENALTY
 * @param {number} [params.totalRefundAwardInr=0] Total refund/compensation awarded to allottee
 * @returns {Object} Pre-deposit evaluation
 */
export function evaluateReatPreDepositRequirement({
  appealFilerRole = 'PROMOTER',
  orderType = RERA_REAT_ORDER_TYPE.REFUND_COMPENSATION,
  penaltyAmountInr = 0,
  totalRefundAwardInr = 0,
}) {
  const penalty = Math.max(0, Number(penaltyAmountInr) || 0);
  const refund = Math.max(0, Number(totalRefundAwardInr) || 0);
  const isPromoter = appealFilerRole === 'PROMOTER';

  if (!isPromoter) {
    return {
      appealFilerRole: 'ALLOTTEE',
      orderType,
      isPreDepositMandatory: false,
      mandatoryPreDepositPercentage: 0,
      mandatoryDepositInr: 0,
      isCompliant: true,
      legalBasis: 'Section 43(5) Proviso applies exclusively to promoter appellants. Allottees/Homebuyers are fully exempt from pre-deposit requirements.',
      rulingPrecedent: 'Techno Trexim Pvt. Ltd. vs. State of Maharashtra & Ors. (MahaREAT / Bombay HC)',
    };
  }

  if (orderType === RERA_REAT_ORDER_TYPE.PENALTY) {
    const mandatoryDepositInr = Math.round(penalty * 0.30);
    return {
      appealFilerRole: 'PROMOTER',
      orderType,
      isPreDepositMandatory: true,
      mandatoryPreDepositPercentage: 30,
      penaltyAmountInr: penalty,
      mandatoryDepositInr,
      isCompliant: false,
      legalBasis: 'Section 43(5) Proviso: At least thirty percent (30%) of penalty imposed by Authority must be deposited before appeal is entertained.',
      rulingPrecedent: 'Section 43(5) Central Act No. 16 of 2016',
    };
  }

  // REFUND_COMPENSATION
  const mandatoryDepositInr = refund;
  return {
    appealFilerRole: 'PROMOTER',
    orderType,
    isPreDepositMandatory: true,
    mandatoryPreDepositPercentage: 100,
    totalRefundAwardInr: refund,
    mandatoryDepositInr,
    isCompliant: false,
    legalBasis: 'Section 43(5) Proviso: The promoter MUST deposit the total amount to be paid to the allottee (100% of principal + interest + compensation) with the Appellate Tribunal before the appeal is entertained.',
    rulingPrecedent: 'Hon\'ble Supreme Court of India in M/s Newtech Promoters and Developers Pvt. Ltd. v. State of UP & Ors. (2021) 19 SCC 655',
  };
}

/**
 * Generates an Objection Petition under Section 43(5) Proviso for Allottee
 * seeking summary dismissal of Promoter's appeal for non-compliance with mandatory pre-deposit.
 *
 * @param {Object} objectionData
 * @returns {string} Formatted objection petition text
 */
export function generateReatAppealDismissalObjection(objectionData = {}) {
  const jurisdictionKey = objectionData.jurisdiction || 'MAHARASHTRA';
  const jurisdiction = RERA_JURISDICTIONS[jurisdictionKey] || RERA_JURISDICTIONS.MAHARASHTRA;

  const allotteeName = objectionData.complainant?.name || '[NAME OF ALLOTTEE / RESPONDENT]';
  const promoterName = objectionData.promoter?.name || '[NAME OF APPELLANT PROMOTER]';
  const appealNo = objectionData.appealNumber || '[REAT APPEAL NUMBER]';
  const originalOrderNo = objectionData.originalOrderNumber || '[ORIGINAL RERA ORDER NO.]';
  const totalAwardedInr = Number(objectionData.totalAwardedInr || 0);

  const lines = [
    '================================================================================',
    'BEFORE THE REAL ESTATE APPELLATE TRIBUNAL (REAT)',
    `APPELLATE JURISDICTION FOR ${jurisdiction.stateName.toUpperCase()}`,
    '================================================================================',
    '',
    `IN APPEAL NO. ${appealNo} OF ${new Date().getFullYear()}`,
    `AGAINST ORDER DATED: ${objectionData.orderDate || '[DATE]'} IN CASE NO.: ${originalOrderNo}`,
    '',
    'IN THE MATTER OF:',
    `${promoterName} ... APPELLANT / PROMOTER`,
    'VERSUS',
    `${allotteeName} ... RESPONDENT / ALLOTTEE`,
    '',
    '--------------------------------------------------------------------------------',
    'PRELIMINARY OBJECTION UNDER SECTION 43(5) PROVISO OF RERA, 2016 SEEKING SUMMARY',
    'DISMISSAL OF APPEAL IN LIMINE FOR NON-DEPOSIT OF MANDATORY 100% DECREETAL AMOUNT.',
    '--------------------------------------------------------------------------------',
    '',
    'THE RESPONDENT ALLOTTEE MOST RESPECTFULLY SUBMITS AS UNDER:',
    '',
    '1. MANDATORY STATUTORY EMBARGO UNDER SECTION 43(5):',
    '   The proviso to Section 43(5) of the Real Estate (Regulation and Development) Act, 2016 strictly mandates:',
    '   "Provided that where a promoter files an appeal with the Appellate Tribunal, it shall not be entertained without the promoter first having deposited with the Appellate Tribunal at least thirty per cent of the penalty, or such higher percentage as may be determined by the Appellate Tribunal, or the total amount to be paid to the allottee including interest and compensation imposed on him, if any, or with both, as the case may be, before the said appeal is heard."',
    '',
    '2. BINDING CONSTITUTIONAL PRECEDENT OF THE SUPREME COURT:',
    '   The Hon\'ble Supreme Court of India in the landmark judgment of "M/s Newtech Promoters and Developers Pvt. Ltd. v. State of UP & Ors." (2021) 19 SCC 655 has authoritatively settled that:',
    '   (a) The condition of pre-deposit under Section 43(5) is an absolute condition precedent and a condition sine qua non.',
    '   (b) The Appellate Tribunal has NO jurisdiction or discretionary power to waive, relax, or reduce the mandatory 100% deposit where refund or compensation is awarded to an allottee.',
    '   (c) An appeal instituted without proof of complete pre-deposit is non-est in the eyes of law and must be rejected at the threshold.',
    '',
    '3. PARTICULARS OF DEFAULT BY APPELLANT PROMOTER:',
    `   (a) Total Decreetal Sum Awarded to Respondent: Rs. ${totalAwardedInr.toLocaleString('en-IN')}`,
    '   (b) Amount Deposited with this Hon\'ble Tribunal: NIL / Incomplete Proof',
    '   (c) Deficit Mandatory Pre-Deposit: Rs. ' + totalAwardedInr.toLocaleString('en-IN'),
    '',
    '4. PRAYER:',
    'In light of the statutory mandate and binding Supreme Court ruling, the Respondent prays that this Hon\'ble Tribunal be pleased to:',
    '   (a) Dismiss the present Appeal in limine under Section 43(5) without hearing on merits;',
    '   (b) Direct the Respondent to proceed with execution of the original decree under Section 40; and',
    '   (c) Impose exemplary costs upon the Appellant for abusing judicial process.',
    '',
    'VERIFICATION:',
    `Verified at ${jurisdiction.stateName} that the statements made above are true to my knowledge.`,
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '____________________________________',
    'Signature of Respondent Allottee',
    '================================================================================',
  ];

  return lines.join('\n');
}

/**
 * Formulates a Section 44 Memorandum of Appeal to the RERA Appellate Tribunal (REAT)
 * for an aggrieved allottee.
 *
 * @param {Object} appealData
 * @returns {string} Formatted Memorandum of Appeal
 */
export function generateReatMemorandumOfAppeal(appealData = {}) {
  const jurisdictionKey = appealData.jurisdiction || 'MAHARASHTRA';
  const jurisdiction = RERA_JURISDICTIONS[jurisdictionKey] || RERA_JURISDICTIONS.MAHARASHTRA;

  const appellantName = appealData.complainant?.name || '[NAME OF APPELLANT ALLOTTEE]';
  const appellantAddress = appealData.complainant?.address || '[ADDRESS OF APPELLANT]';
  const respondentName = appealData.promoter?.name || '[NAME OF RESPONDENT PROMOTER]';
  const originalOrderNo = appealData.originalOrderNumber || '[ORIGINAL RERA COMPLAINT NO.]';
  const orderDate = appealData.orderDate || '[DATE OF IMPUGNED ORDER]';
  const certifiedCopyDate = appealData.certifiedCopyDate || orderDate;

  const lines = [
    '================================================================================',
    'MEMORANDUM OF APPEAL UNDER SECTION 44 OF RERA, 2016',
    `BEFORE THE REAL ESTATE APPELLATE TRIBUNAL (REAT) AT ${jurisdiction.stateName.toUpperCase()}`,
    '================================================================================',
    '',
    `APPEAL NO. __________ OF ${new Date().getFullYear()}`,
    `AGAINST IMPUGNED ORDER DATED ${orderDate} IN COMPLAINT NO. ${originalOrderNo}`,
    '',
    'BETWEEN:',
    `1. ${appellantName},`,
    `   Residing at: ${appellantAddress}`,
    '   ... APPELLANT (ALLOTTEE)',
    '',
    'AND',
    '',
    `1. ${respondentName},`,
    '   ... RESPONDENT (PROMOTER)',
    '',
    '--------------------------------------------------------------------------------',
    'I. LIMITATION UNDER SECTION 44(2):',
    '--------------------------------------------------------------------------------',
    `1. Date of Impugned Order: ${orderDate}`,
    `2. Date of Receipt of Certified Copy: ${certifiedCopyDate}`,
    `3. Sixty (60) Days Statutory Limitation Expires On: ${appealData.limitationExpiryDate || '[60 DAYS FROM RECEIPT]'}`,
    '4. The present appeal is filed strictly within the prescribed limitation period of 60 days.',
    '',
    '--------------------------------------------------------------------------------',
    'II. GROUNDS OF APPEAL:',
    '--------------------------------------------------------------------------------',
    '1. The learned Authority / Adjudicating Officer erred in failing to grant statutory interest at SBI MCLR + 2% strictly in accordance with Section 18.',
    '2. The impugned order erroneously overlooked the promoter\'s gross structural defects under Section 14(3).',
    '3. The forum erred in granting unreasoned extensions to the promoter without compensatory relief to the allottee.',
    '',
    '--------------------------------------------------------------------------------',
    'III. PRAYER:',
    '--------------------------------------------------------------------------------',
    'The Appellant prays that this Hon\'ble Appellate Tribunal be pleased to:',
    '   (a) Set aside / modify the impugned order dated ' + orderDate + ' passed in Case No. ' + originalOrderNo + ';',
    '   (b) Direct full refund with statutory delay interest computed at benchmark SBI MCLR + 2% from the committed date of possession; and',
    '   (c) Award adequate litigation costs.',
    '',
    'VERIFICATION:',
    `Verified at ${jurisdiction.stateName} on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '______________________________',
    'Signature of Appellant Allottee',
    '================================================================================',
  ];

  return lines.join('\n');
}

/**
 * Audits Section 4(2)(l)(D) project escrow account (70% dedicated account) compliance
 * and calculates unauthorized diversion and Section 60/61 penal liability.
 *
 * @param {Object} params
 * @param {number} params.totalEstimatedProjectCostInr Total estimated project cost declared in RERA registration (INR)
 * @param {number} params.totalAllotteeCollectionsInr Total collections realized from allottees across all units (INR)
 * @param {number} params.certifiedCompletionPercentage Architect/Engineer certified site progress percentage (0 - 100)
 * @param {number} params.totalFundsWithdrawnInr Total funds withdrawn from project bank accounts by promoter (INR)
 * @param {number} [params.currentEscrowBalanceInr=0] Current ledger balance in dedicated 70% escrow account (INR)
 * @returns {Object} Comprehensive forensic escrow audit report
 */
export function auditProjectEscrowCompliance({
  totalEstimatedProjectCostInr = 0,
  totalAllotteeCollectionsInr = 0,
  certifiedCompletionPercentage = 0,
  totalFundsWithdrawnInr = 0,
  currentEscrowBalanceInr = 0,
}) {
  const estimatedCost = Math.max(0, Number(totalEstimatedProjectCostInr) || 0);
  const collections = Math.max(0, Number(totalAllotteeCollectionsInr) || 0);
  const completionPct = Math.min(100, Math.max(0, Number(certifiedCompletionPercentage) || 0));
  const withdrawn = Math.max(0, Number(totalFundsWithdrawnInr) || 0);
  const balance = Math.max(0, Number(currentEscrowBalanceInr) || 0);

  // Mandatory 70% retention under Section 4(2)(l)(D):
  const mandatoryEscrowRetentionInr = Math.round(collections * 0.70);

  // Allowable withdrawal strictly proportional to certified completion:
  const maximumPermissibleWithdrawalInr = Math.round(
    mandatoryEscrowRetentionInr * (completionPct / 100)
  );

  // Minimum required escrow balance that must remain in account:
  const minimumRequiredEscrowBalanceInr = mandatoryEscrowRetentionInr - maximumPermissibleWithdrawalInr;

  // Escrow diversion shortfall:
  // If actual withdrawn exceeds maximum permissible withdrawal:
  const unauthorizedEscrowDiversionInr = Math.max(0, withdrawn - maximumPermissibleWithdrawalInr);

  // Section 60 & Section 61 Penal Exposure: up to 5% of estimated project cost
  const section60PenaltyMaxInr = Math.round(estimatedCost * 0.05);
  const section61PenaltyMaxInr = Math.round(estimatedCost * 0.05);

  let riskCategory = 'COMPLIANT';
  if (unauthorizedEscrowDiversionInr > 0) {
    riskCategory = unauthorizedEscrowDiversionInr > (mandatoryEscrowRetentionInr * 0.20)
      ? 'SEVERE_DIVERSION'
      : 'MODERATE_DEFICIT';
  }

  const recommendations = [];
  if (unauthorizedEscrowDiversionInr > 0) {
    recommendations.push('File immediate petition under Section 35 demanding forensic audit of RERA dedicated escrow account.');
    recommendations.push('Seek interim order under Section 36 freezing developer operational accounts.');
    recommendations.push(`Demand promoter penalty under Section 60/61 up to Rs. ${(section60PenaltyMaxInr + section61PenaltyMaxInr).toLocaleString('en-IN')}.`);
  } else {
    recommendations.push('Project withdrawals comply with Section 4(2)(l)(D) milestone completion threshold.');
  }

  return {
    isValid: true,
    totalEstimatedProjectCostInr: estimatedCost,
    totalAllotteeCollectionsInr: collections,
    certifiedCompletionPercentage: completionPct,
    mandatoryEscrowRetentionInr,
    maximumPermissibleWithdrawalInr,
    minimumRequiredEscrowBalanceInr,
    totalFundsWithdrawnInr: withdrawn,
    currentEscrowBalanceInr: balance,
    unauthorizedEscrowDiversionInr,
    section60PenaltyMaxInr,
    section61PenaltyMaxInr,
    riskCategory,
    isCompliant: unauthorizedEscrowDiversionInr === 0,
    recommendations,
    statutoryCitation: 'Section 4(2)(l)(D) 70% Project Dedicated Escrow & Sections 35, 36, 60, 61 of RERA, 2016',
  };
}

/**
 * Generates Section 35 & 36 application for Investigation & Injunction on Escrow Diversion.
 *
 * @param {Object} auditData
 * @returns {string} Formatted legal application text
 */
export function generateSection35EscrowInvestigationPetition(auditData = {}) {
  const jurisdictionKey = auditData.jurisdiction || 'MAHARASHTRA';
  const jurisdiction = RERA_JURISDICTIONS[jurisdictionKey] || RERA_JURISDICTIONS.MAHARASHTRA;

  const applicantName = auditData.complainant?.name || '[NAME OF APPLICANT ALLOTTEE / ASSOCIATION]';
  const promoterName = auditData.promoter?.name || '[NAME OF PROMOTER / DEVELOPER]';
  const projectName = auditData.promoter?.projectName || '[PROJECT NAME]';
  const reraRegNo = auditData.promoter?.reraRegNo || '[RERA REGISTRATION NO.]';

  const auditReport = auditProjectEscrowCompliance({
    totalEstimatedProjectCostInr: auditData.totalEstimatedProjectCostInr,
    totalAllotteeCollectionsInr: auditData.totalAllotteeCollectionsInr,
    certifiedCompletionPercentage: auditData.certifiedCompletionPercentage,
    totalFundsWithdrawnInr: auditData.totalFundsWithdrawnInr,
    currentEscrowBalanceInr: auditData.currentEscrowBalanceInr,
  });

  const lines = [
    '================================================================================',
    `BEFORE THE ${jurisdiction.authorityName.toUpperCase()}`,
    '================================================================================',
    '',
    `MISCELLANEOUS APPLICATION NO. __________ OF ${new Date().getFullYear()}`,
    `IN RE: "${projectName.toUpperCase()}" (RERA REG. NO.: ${reraRegNo})`,
    '',
    'IN THE MATTER OF:',
    `${applicantName} ... APPLICANT (ALLOTTEE / AOBA)`,
    'VERSUS',
    `${promoterName} ... RESPONDENT (PROMOTER)`,
    '',
    '--------------------------------------------------------------------------------',
    'APPLICATION UNDER SECTION 35 READ WITH SECTION 36 & SECTION 4(2)(l)(D) OF THE',
    'REAL ESTATE (REGULATION AND DEVELOPMENT) ACT, 2016 FOR ORDERING FORENSIC AUDIT OF',
    'THE 70% DEDICATED ESCROW ACCOUNT AND PASSING INTERIM INJUNCTION FREEZING ACCOUNTS.',
    '--------------------------------------------------------------------------------',
    '',
    'THE APPLICANT HUMBLY SUBMITS:',
    '',
    '1. STATUTORY VIOLATION OF SECTION 4(2)(l)(D):',
    `   (a) Total collections extracted from homebuyers: Rs. ${auditReport.totalAllotteeCollectionsInr.toLocaleString('en-IN')}`,
    `   (b) Statutory 70% mandatory escrow deposit: Rs. ${auditReport.mandatoryEscrowRetentionInr.toLocaleString('en-IN')}`,
    `   (c) Architect/Engineer certified physical completion: ${auditReport.certifiedCompletionPercentage}%`,
    `   (d) Maximum legitimate withdrawal permissible: Rs. ${auditReport.maximumPermissibleWithdrawalInr.toLocaleString('en-IN')}`,
    `   (e) Actual funds withdrawn by promoter: Rs. ${auditReport.totalFundsWithdrawnInr.toLocaleString('en-IN')}`,
    `   (f) Siphoned / Diverted Escrow Deficit: Rs. ${auditReport.unauthorizedEscrowDiversionInr.toLocaleString('en-IN')}`,
    '',
    '2. GROUNDS FOR INTERIM INJUNCTION UNDER SECTION 36:',
    '   The promoter has unlawfully siphoned funds to other projects/subsidiaries, stalling the project and creating severe insolvency risk for homebuyers.',
    '',
    '3. PRAYER:',
    'The Applicant prays that this Hon\'ble Authority be pleased to:',
    '   (a) Order a forensic audit under Section 35 by an independent empanelled Chartered Accountant of the dedicated escrow bank account;',
    '   (b) Issue an interim injunction under Section 36 freezing all debits from the promoter\'s project and operational accounts;',
    `   (c) Initiate penal proceedings under Section 60 and Section 61 exposing the promoter to penalties up to Rs. ${(auditReport.section60PenaltyMaxInr + auditReport.section61PenaltyMaxInr).toLocaleString('en-IN')}; and`,
    '   (d) Pass such further orders as this Hon\'ble Authority deems fit.',
    '',
    'VERIFICATION:',
    `Verified at ${jurisdiction.stateName} on ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '______________________________',
    'Signature of Applicant',
    '================================================================================',
  ];

  return lines.join('\n');
}
