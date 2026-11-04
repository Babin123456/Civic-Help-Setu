/**
 * Statutory Civic Fee Waiver & Concession Eligibility Engine (#433)
 *
 * Evaluates citizen eligibility for statutory fee exemptions, concessions,
 * and stamp duty rebates under Indian public service laws (e.g., RTI Act Sec 7(5),
 * RPwD Act 2016, State Sakala/Sevottam Charters, and Social Welfare Department Rules).
 */

/**
 * Concession category identifiers
 */
export const CONCESSION_CATEGORIES = Object.freeze({
  BPL_ANTYODAYA: 'bpl_antyodaya',
  PWD_DIVYANG: 'pwd_divyang',
  SENIOR_CITIZEN: 'senior_citizen',
  WOMEN_BENEFICIARY: 'women_beneficiary',
  STUDENT: 'student',
  GENERAL: 'general',
});

/**
 * Configuration and metadata for each concession category
 */
export const CONCESSION_METADATA = Object.freeze({
  [CONCESSION_CATEGORIES.BPL_ANTYODAYA]: {
    id: CONCESSION_CATEGORIES.BPL_ANTYODAYA,
    title: 'BPL / Antyodaya Ration Cardholder',
    shortLabel: 'BPL / AAY',
    description: 'Families classified Below Poverty Line holding valid Yellow/Pink/PHH/AAY ration cards.',
    requiredProof: 'Self-attested copy of valid BPL/AAY Ration Card or BPL Certificate',
    defaultWaiverPercent: 100,
    statutoryCitation: 'Right to Information Act 2005 Sec 7(5) & State Citizen Service Delivery Rules',
  },
  [CONCESSION_CATEGORIES.PWD_DIVYANG]: {
    id: CONCESSION_CATEGORIES.PWD_DIVYANG,
    title: 'Person with Benchmark Disability (PwD / Divyangjan)',
    shortLabel: 'PwD / UDID',
    description: 'Citizens with 40%+ benchmark disability holding a Unique Disability ID (UDID).',
    requiredProof: 'UDID Card or Disability Certificate issued by Competent Medical Authority',
    defaultWaiverPercent: 100,
    statutoryCitation: 'Rights of Persons with Disabilities (RPwD) Act 2016, Section 24 & State Rules',
  },
  [CONCESSION_CATEGORIES.SENIOR_CITIZEN]: {
    id: CONCESSION_CATEGORIES.SENIOR_CITIZEN,
    title: 'Senior Citizen (Age 60+)',
    shortLabel: 'Senior Citizen',
    description: 'Citizens aged 60 years or older on the date of application submission.',
    requiredProof: 'Aadhaar Card, Senior Citizen ID Card, PAN Card, or Birth Certificate showing DOB',
    defaultWaiverPercent: 50,
    statutoryCitation: 'Maintenance and Welfare of Parents and Senior Citizens Act & State Welfare Circulars',
  },
  [CONCESSION_CATEGORIES.WOMEN_BENEFICIARY]: {
    id: CONCESSION_CATEGORIES.WOMEN_BENEFICIARY,
    title: 'Women Applicants & Single Mothers',
    shortLabel: 'Women',
    description: 'Female citizens applying for designated state welfare, health, and property registration concessions.',
    requiredProof: 'Identity proof confirming female gender (Aadhaar / Voter ID)',
    defaultWaiverPercent: 50,
    statutoryCitation: 'State Gender Equality Welfare Guidelines & State Revenue Concession Directives',
  },
  [CONCESSION_CATEGORIES.STUDENT]: {
    id: CONCESSION_CATEGORIES.STUDENT,
    title: 'Students & Youth Applicants',
    shortLabel: 'Student',
    description: 'Enrolled students seeking academic, caste, income, or employment verification certificates.',
    requiredProof: 'Valid Institution Student ID or Bonafide Certificate from School/College',
    defaultWaiverPercent: 50,
    statutoryCitation: 'Education Department Concession Orders & State Scholarship Guidelines',
  },
  [CONCESSION_CATEGORIES.GENERAL]: {
    id: CONCESSION_CATEGORIES.GENERAL,
    title: 'General Applicant (Standard Fee)',
    shortLabel: 'General',
    description: 'Standard tariff without statutory exemptions.',
    requiredProof: 'Standard service identity and address proofs as mandated',
    defaultWaiverPercent: 0,
    statutoryCitation: 'Standard Departmental Tariff Schedule',
  },
});

/**
 * Extracts a numeric base fee from service records.
 * @param {Object} service
 * @returns {number} Standard fee in INR
 */
export function parseServiceStandardFee(service) {
  if (!service) return 50;

  // If already a numeric fee field
  if (typeof service.fee === 'number' && Number.isFinite(service.fee)) {
    return Math.max(0, service.fee);
  }
  if (typeof service.fees === 'number' && Number.isFinite(service.fees)) {
    return Math.max(0, service.fees);
  }

  const raw = String(service.fees || service.fee || '').toLowerCase();
  if (raw.includes('free') || raw.includes('nil') || raw.includes('no fee')) {
    return 0;
  }

  // Parse digits e.g. "₹50", "Rs. 100", "30 to 50"
  const match = raw.match(/(\d+)/);
  if (match) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? 50 : val;
  }

  return 50; // default estimated civic certificate processing tariff
}

/**
 * Determines specific concession override based on service type.
 * e.g., RTI requests have 100% statutory fee waiver for BPL applicants under Central RTI Rules 2012.
 * @param {Object} service
 * @param {string} category
 * @returns {{ waiverPercent: number, customCitation: string|null }}
 */
export function resolveServiceSpecificConcession(service, category) {
  const meta = CONCESSION_METADATA[category] || CONCESSION_METADATA[CONCESSION_CATEGORIES.GENERAL];
  let waiverPercent = meta.defaultWaiverPercent;
  let customCitation = null;

  const text = `${service?.id || ''} ${service?.name || ''} ${service?.description || ''}`.toLowerCase();

  // 1. Right to Information (RTI)
  if (text.includes('rti') || text.includes('information') || text.includes('grievance')) {
    if (category === CONCESSION_CATEGORIES.BPL_ANTYODAYA) {
      waiverPercent = 100;
      customCitation = 'RTI Act 2005 Section 7(5) and Central RTI Rules 2012 Rule 5 (Complete Exemption for BPL)';
    }
  }

  // 2. Welfare & Certificates (Income, Caste, Domicile, Ration Card)
  if (text.includes('ration') || text.includes('income') || text.includes('caste') || text.includes('domicile')) {
    if (category === CONCESSION_CATEGORIES.BPL_ANTYODAYA || category === CONCESSION_CATEGORIES.PWD_DIVYANG) {
      waiverPercent = 100;
      customCitation = 'State Citizen Guarantee Service Delivery Rules (Complete Exemption for Priority Households & PwD)';
    }
  }

  // 3. Senior Citizen concessions on municipal and transit services
  if (text.includes('transport') || text.includes('municipal') || text.includes('birth') || text.includes('death')) {
    if (category === CONCESSION_CATEGORIES.SENIOR_CITIZEN) {
      waiverPercent = Math.max(waiverPercent, 50);
      customCitation = 'Municipal Corporation Citizen Charter Senior Citizen Welfare Concession';
    }
  }

  return { waiverPercent, customCitation };
}

/**
 * Main evaluation function computing net fee, discount, proofs, and statutory advice.
 * @param {Object} params
 * @param {Object} params.service Citizen service record
 * @param {string} [params.category=CONCESSION_CATEGORIES.GENERAL]
 * @param {number} [params.customFee=null]
 * @returns {Object} Complete concession calculation report
 */
export function evaluateFeeWaiverEligibility({
  service,
  category = CONCESSION_CATEGORIES.GENERAL,
  customFee = null,
} = {}) {
  const meta = CONCESSION_METADATA[category] || CONCESSION_METADATA[CONCESSION_CATEGORIES.GENERAL];
  const standardFee = typeof customFee === 'number' && Number.isFinite(customFee)
    ? Math.max(0, customFee)
    : parseServiceStandardFee(service);

  const { waiverPercent, customCitation } = resolveServiceSpecificConcession(service, category);

  const waivedAmount = Math.round((standardFee * waiverPercent) / 100);
  const netPayableFee = Math.max(0, standardFee - waivedAmount);
  const isFullyExempt = standardFee > 0 && netPayableFee === 0;
  const isPartiallyConcessional = waivedAmount > 0 && netPayableFee > 0;

  const statutoryCitation = customCitation || meta.statutoryCitation;

  let advice = '';
  if (isFullyExempt) {
    advice = `You are entitled to 100% statutory fee exemption under ${statutoryCitation}. Attach your verified proof to avoid rejection.`;
  } else if (isPartiallyConcessional) {
    advice = `You qualify for a ${waiverPercent}% concession under ${statutoryCitation}. Net payable fee is ₹${netPayableFee}.`;
  } else if (standardFee === 0) {
    advice = 'This citizen service is provided free of charge by default for all applicants.';
  } else {
    advice = 'Standard government processing fee applies. Check if you possess valid BPL, PwD, or age credentials for fee exemption.';
  }

  return {
    category,
    categoryTitle: meta.title,
    categoryShortLabel: meta.shortLabel,
    standardFee,
    waiverPercent,
    waivedAmount,
    netPayableFee,
    isFullyExempt,
    isPartiallyConcessional,
    requiredProof: meta.requiredProof,
    statutoryCitation,
    advice,
    safetyTip: 'Never hand over original proof documents or certificates. Always submit self-attested photocopies.',
  };
}

export default {
  CONCESSION_CATEGORIES,
  CONCESSION_METADATA,
  parseServiceStandardFee,
  resolveServiceSpecificConcession,
  evaluateFeeWaiverEligibility,
};
