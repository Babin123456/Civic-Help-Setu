/**
 * Consumer Commission Complaint Preparation and Case-Readiness Tool Service
 * 
 * Provides guided preparation under Consumer Protection Act, 2019 (CPA 2019).
 * - Identifies pecuniary jurisdiction:
 *   - District Consumer Disputes Redressal Commission (DCDRC): Up to ₹50 Lakhs (per 2021 notified rules)
 *   - State Consumer Disputes Redressal Commission (SCDRC): ₹50 Lakhs to ₹2 Crores
 *   - National Consumer Disputes Redressal Commission (NCDRC): Above ₹2 Crores
 * - Directs filing to e-Jagriti (edaakhil.nic.in) portal
 * - Structures chronological evidence worksheet
 * - Drafts structured consumer complaint memorandum
 * - Enforces mandatory non-lawyer statutory disclaimer
 */

export const JURISDICTION_THRESHOLDS = {
  DISTRICT: {
    maxAmount: 5000000, // 50 Lakhs
    code: 'DISTRICT_COMMISSION',
    label: 'District Consumer Disputes Redressal Commission (DCDRC)',
    description: 'Complaints where the value of goods or services paid does not exceed ₹50 Lakhs.'
  },
  STATE: {
    minAmount: 5000001,
    maxAmount: 20000000, // 2 Crores
    code: 'STATE_COMMISSION',
    label: 'State Consumer Disputes Redressal Commission (SCDRC)',
    description: 'Complaints where the value of goods or services paid exceeds ₹50 Lakhs but does not exceed ₹2 Crores.'
  },
  NATIONAL: {
    minAmount: 20000001,
    maxAmount: Infinity,
    code: 'NATIONAL_COMMISSION',
    label: 'National Consumer Disputes Redressal Commission (NCDRC)',
    description: 'Complaints where the value of goods or services paid exceeds ₹2 Crores.'
  }
};

export const DEFICIENCY_TYPES = {
  DEFECTIVE_GOOD: {
    id: 'defective_good',
    label: 'Defect in Goods (Manufacturing / Performance / Safety)',
    reference: 'Section 2(10) of CPA 2019'
  },
  DEFICIENCY_SERVICE: {
    id: 'deficiency_service',
    label: 'Deficiency in Service (Delay / Negligence / Inadequate Quality)',
    reference: 'Section 2(11) of CPA 2019'
  },
  UNFAIR_TRADE_PRACTICE: {
    id: 'unfair_trade_practice',
    label: 'Unfair Trade Practice / Misleading Advertisement',
    reference: 'Section 2(47) & Section 2(28) of CPA 2019'
  },
  OVERCHARGING: {
    id: 'overcharging',
    label: 'Charging in Excess of MRP or Notified Price',
    reference: 'Section 2(47)(a) of CPA 2019'
  }
};

export const MANDATORY_LEGAL_DISCLAIMER =
  'IMPORTANT STATUTORY DISCLAIMER: This tool provides civic informational guidance and formatting assistance under the Consumer Protection Act, 2019. It does NOT constitute legal advice or formal legal representation. Under CPA 2019, consumers have the legal right to present their own case in person without hiring an advocate, or may engage an authorized counsel of their choice.';

/**
 * Calculates the appropriate consumer commission jurisdiction based on value of goods/services paid.
 * Under CPA 2019 Section 34/47/58 and 2021 Rules, pecuniary jurisdiction is determined by the
 * consideration actually paid as value of goods or services.
 * @param {number} paidAmount 
 * @returns {Object} jurisdictionInfo
 */
export function calculatePecuniaryJurisdiction(paidAmount = 0) {
  const amt = Number(paidAmount);
  if (isNaN(amt) || amt < 0) {
    return {
      error: 'Invalid consideration amount. Must be a positive numeric value.',
      commission: JURISDICTION_THRESHOLDS.DISTRICT
    };
  }

  if (amt <= JURISDICTION_THRESHOLDS.DISTRICT.maxAmount) {
    return {
      tier: 'DISTRICT',
      commission: JURISDICTION_THRESHOLDS.DISTRICT,
      amount: amt
    };
  } else if (amt <= JURISDICTION_THRESHOLDS.STATE.maxAmount) {
    return {
      tier: 'STATE',
      commission: JURISDICTION_THRESHOLDS.STATE,
      amount: amt
    };
  }

  return {
    tier: 'NATIONAL',
    commission: JURISDICTION_THRESHOLDS.NATIONAL,
    amount: amt
  };
}

/**
 * Validates consumer complaint readiness and identifies missing evidences.
 * @param {Object} complaintData 
 * @returns {Object} assessment
 */
export function assessComplaintReadiness(complaintData = {}) {
  const errors = [];
  const warnings = [];

  if (!complaintData.complainantName || complaintData.complainantName.trim().length < 2) {
    errors.push('Complainant full name and contact address are required.');
  }

  if (!complaintData.oppositePartyName || complaintData.oppositePartyName.trim().length < 2) {
    errors.push('Opposite Party (seller/company/service provider) registered name and address are required.');
  }

  if (complaintData.paidAmount === undefined || complaintData.paidAmount === null || Number(complaintData.paidAmount) <= 0) {
    errors.push('Valid consideration amount paid for goods/services is required to determine jurisdiction.');
  }

  if (!complaintData.causeOfActionDate) {
    errors.push('Date of cause of action (when defect occurred or service failed) is required.');
  } else {
    // Check 2-year limitation period under Section 69 of CPA 2019
    const causeDate = new Date(complaintData.causeOfActionDate);
    if (!isNaN(causeDate.getTime())) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      if (causeDate < twoYearsAgo) {
        warnings.push('Cause of action arose more than 2 years ago. Section 69 limitation requires filing an application for condonation of delay with sufficient cause.');
      }
    }
  }

  const events = complaintData.chronology || [];
  if (events.length === 0) {
    warnings.push('No chronological timeline events entered. A chronological incident log is critical for commission scrutiny.');
  }

  const evidences = complaintData.documents || [];
  if (!evidences.includes('invoice_or_receipt')) {
    errors.push('Tax invoice, receipt, or proof of payment is essential to establish consumer status under Section 2(7).');
  }
  if (!evidences.includes('legal_notice_or_email')) {
    warnings.push('No record of prior legal notice or written grievance to the opposite party. A pre-litigation notice establishes opportunity to cure.');
  }

  const jurisdiction = calculatePecuniaryJurisdiction(complaintData.paidAmount || 0);

  return {
    readyToDraft: errors.length === 0,
    jurisdiction,
    errors,
    warnings,
    eDaakhilPortalUrl: 'https://edaakhil.nic.in/',
    disclaimer: MANDATORY_LEGAL_DISCLAIMER
  };
}

/**
 * Generates a formal Consumer Complaint Memorandum outline for e-Jagriti / e-Daakhil.
 * @param {Object} complaintData 
 * @returns {string} memorandumText
 */
export function generateComplaintMemorandum(complaintData = {}) {
  const assessment = assessComplaintReadiness(complaintData);
  const events = complaintData.chronology || [];

  return [
    `BEFORE THE HON'BLE ${assessment.jurisdiction.commission.label.toUpperCase()}`,
    `AT ${complaintData.districtOrCity ? complaintData.districtOrCity.toUpperCase() : '[DISTRICT/STATE]'}`,
    ``,
    `CONSUMER COMPLAINT NO. ________ / ${new Date().getFullYear()}`,
    ``,
    `IN THE MATTER OF:`,
    `${complaintData.complainantName || '[COMPLAINANT NAME]'}`,
    `Address: ${complaintData.complainantAddress || '[COMPLAINANT ADDRESS]'}`,
    `Phone / Email: ${complaintData.complainantContact || '[CONTACT]'}`,
    `... COMPLAINANT`,
    ``,
    `VERSUS`,
    ``,
    `${complaintData.oppositePartyName || '[OPPOSITE PARTY NAME]'}`,
    `Address: ${complaintData.oppositePartyAddress || '[OPPOSITE PARTY ADDRESS]'}`,
    `... OPPOSITE PARTY`,
    ``,
    `COMPLAINT UNDER SECTION 35 / 47 / 58 OF THE CONSUMER PROTECTION ACT, 2019`,
    `FOR DEFICIENCY OF SERVICE / DEFECT IN GOODS / UNFAIR TRADE PRACTICE`,
    ``,
    `1. RESPECTFULLY SHOWETH:`,
    `That the Complainant is a consumer as defined under Section 2(7) of the Consumer Protection Act, 2019, having purchased goods / availed services for consideration of ₹${complaintData.paidAmount || 0}.`,
    ``,
    `2. JURISDICTION:`,
    `This Hon'ble Commission has pecuniary jurisdiction as the consideration paid falls within the limits of ${assessment.jurisdiction.commission.label}. This Commission has territorial jurisdiction under Section 34(2) as the Complainant resides / cause of action arose within this jurisdiction.`,
    ``,
    `3. CHRONOLOGY OF FACTS:`,
    ...(events.length > 0
      ? events.map(e => `   - [${e.date || 'Date'}]: ${e.description || ''}`)
      : ['   - [Timeline of events to be documented chronologically from purchase to defect and refusal to rectify]']),
    ``,
    `4. DEFICIENCY & CAUSE OF ACTION:`,
    `The Opposite Party committed deficiency in service and unfair trade practice causing substantial mental agony and financial loss to the Complainant. The cause of action arose on ${complaintData.causeOfActionDate || '[Date]'} and continues to subsist.`,
    ``,
    `5. PRAYER / RELIEF SOUGHT:`,
    `It is therefore most respectfully prayed that this Hon'ble Commission may be pleased to:`,
    `   a) Direct Opposite Party to refund the sum of ₹${complaintData.paidAmount || 0} along with interest @ 12% p.a.`,
    `   b) Direct Opposite Party to pay compensation of ₹${complaintData.compensationClaimed || 25000} for mental agony and harassment.`,
    `   c) Award litigation costs of ₹${complaintData.litigationCostClaimed || 10000}.`,
    `   d) Pass any other relief deemed fit and proper in the interest of justice.`,
    ``,
    `VERIFICATION:`,
    `I, the Complainant above named, do hereby verify that the contents of paragraphs 1 to 5 are true to my knowledge and belief. Verified at this ____ day of ________, 20___.`,
    ``,
    `__________________________`,
    `Complainant In-Person`,
    ``,
    `----------------------------------------------------------------------`,
    MANDATORY_LEGAL_DISCLAIMER
  ].join('\n');
}
