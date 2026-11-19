/**
 * Government School Admission and RTE 12(1)(c) Application Navigator Service
 * 
 * Implements guidance and validation for:
 * 1. General Government School Admissions (State Board, Kendriya Vidyalaya, Navodaya, Municipal)
 * 2. Right to Education (RTE) Act 2009 Section 12(1)(c) 25% free seats in private unaided schools
 * for Disadvantaged Groups (DG) and Economically Weaker Sections (EWS).
 * Enforces age-eligibility calculation, neighbourhood distance criteria (1km/3km/6km),
 * income/caste documentation, lottery milestones, and grievance pathways.
 */

export const ADMISSION_CHANNELS = {
  GOVT_REGULAR: {
    id: 'govt_regular',
    label: 'State Government / Municipal School Admission',
    description: 'Free general admission to state government or municipal corporation schools.'
  },
  RTE_PRIVATE_QUOTA: {
    id: 'rte_private_quota',
    label: 'RTE Section 12(1)(c) Private School Quota (25%)',
    description: 'Free elementary education in private unaided schools for EWS and Disadvantaged Groups.'
  },
  KENDRIYA_VIDYALAYA: {
    id: 'kendriya_vidyalaya',
    label: 'Kendriya Vidyalaya (KVS) Admission',
    description: 'Central government school system with priority category lottery allocations.'
  }
};

export const RTE_CATEGORIES = {
  EWS: {
    id: 'ews',
    label: 'Economically Weaker Section (EWS)',
    incomeLimitRequired: true,
    description: 'Families with annual household income below notified state threshold (e.g. ₹1 Lakh to ₹2.5 Lakh).'
  },
  DG: {
    id: 'dg',
    label: 'Disadvantaged Group (DG)',
    incomeLimitRequired: false,
    description: 'SC, ST, OBC (non-creamy layer), CWSN (Children with Special Needs), or HIV-affected/orphan children.'
  }
};

export const DISTANCE_TIERS = {
  TIER_1: { maxKm: 1, priority: 1, label: 'Walking Distance (0–1 km) - First Preference' },
  TIER_2: { maxKm: 3, priority: 2, label: 'Neighbourhood (1–3 km) - Second Preference' },
  TIER_3: { maxKm: 6, priority: 3, label: 'Extended Zone (3–6 km) - Third Preference' },
  OUT_OF_BOUNDS: { maxKm: Infinity, priority: 4, label: 'Beyond 6 km - Generally Ineligible for RTE Quota' }
};

export const STATUTORY_EVIDENCE = [
  {
    code: 'child_dob_proof',
    name: 'Child Date of Birth Proof (Birth Certificate / Hospital Card / Anganwadi Record / Parent Affidavit)',
    mandatory: true,
    channel: 'ALL',
    notes: 'Under Section 14 of RTE Act, no child can be denied admission for lack of age proof.'
  },
  {
    code: 'parent_id_residence',
    name: 'Parent Identity & Residential Address Proof (Aadhaar / Voter ID / Utility Bill / Domicile)',
    mandatory: true,
    channel: 'ALL',
    notes: 'Used to verify neighbourhood catchment zone.'
  },
  {
    code: 'income_certificate',
    name: 'Revenue Authority Income Certificate',
    mandatory: false,
    channel: 'RTE_PRIVATE_QUOTA',
    notes: 'Mandatory for EWS category. Must be issued within valid validity window by Tehsildar/SDM.'
  },
  {
    code: 'caste_or_dg_certificate',
    name: 'Caste Certificate / Disability Certificate / Orphanage Document',
    mandatory: false,
    channel: 'RTE_PRIVATE_QUOTA',
    notes: 'Mandatory for DG category (SC/ST/OBC-NCL/CWSN).'
  },
  {
    code: 'child_passport_photo',
    name: 'Recent Passport-size Photograph of Child',
    mandatory: true,
    channel: 'ALL',
    notes: 'Clear front-facing digital or physical photograph.'
  }
];

/**
 * Calculates child age in years and months as of the academic cutoff date (typically 31st March / 1st June).
 * @param {string} dobString - YYYY-MM-DD
 * @param {string} cutoffDateString - YYYY-MM-DD (defaults to current year March 31)
 * @returns {Object} ageDetails
 */
export function calculateAdmissionAge(dobString, cutoffDateString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  const cutoff = cutoffDateString ? new Date(cutoffDateString) : new Date(new Date().getFullYear(), 2, 31);

  if (isNaN(dob.getTime()) || isNaN(cutoff.getTime())) return null;

  let years = cutoff.getFullYear() - dob.getFullYear();
  let months = cutoff.getMonth() - dob.getMonth();
  if (cutoff.getDate() < dob.getDate()) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months, decimalAge: +(years + months / 12).toFixed(2) };
}

/**
 * Evaluates candidate admission readiness and RTE quota eligibility.
 * @param {Object} applicantData 
 * @returns {Object} assessment
 */
export function evaluateAdmissionReadiness(applicantData = {}) {
  const errors = [];
  const warnings = [];
  const submittedDocs = applicantData.documents || [];

  if (!applicantData.childName || applicantData.childName.trim().length < 2) {
    errors.push('Child full name is required.');
  }

  if (!applicantData.parentName || applicantData.parentName.trim().length < 2) {
    errors.push('Parent or legal guardian name is required.');
  }

  const age = calculateAdmissionAge(applicantData.dob, applicantData.cutoffDate);
  if (!age) {
    errors.push('Valid child date of birth (YYYY-MM-DD) is required.');
  }

  const channel = applicantData.channel || 'govt_regular';
  const selectedChannel = Object.values(ADMISSION_CHANNELS).find(c => c.id === channel) || ADMISSION_CHANNELS.GOVT_REGULAR;

  // Grade/Entry level age check (Standard Grade 1 cutoff is 6 years as per NEP 2020)
  const targetGrade = applicantData.targetGrade || 'Grade 1';
  if (age) {
    if (targetGrade === 'Grade 1') {
      if (age.years < 6) {
        warnings.push(`Child is ${age.years}y ${age.months}m. Under NEP 2020 guidelines, Grade 1 entry age is 6+ years. Consider Pre-School / Balvatika.`);
      } else if (age.years > 7) {
        warnings.push(`Child is ${age.years} years old. Exceeds standard entry age of 7 for Grade 1. Special bridge enrolment may be required.`);
      }
    }
  }

  // Distance evaluation for RTE quota
  let distanceTier = DISTANCE_TIERS.OUT_OF_BOUNDS;
  if (applicantData.distanceKm !== undefined && applicantData.distanceKm !== null) {
    const km = Number(applicantData.distanceKm);
    if (km <= 1) distanceTier = DISTANCE_TIERS.TIER_1;
    else if (km <= 3) distanceTier = DISTANCE_TIERS.TIER_2;
    else if (km <= 6) distanceTier = DISTANCE_TIERS.TIER_3;
    else distanceTier = DISTANCE_TIERS.OUT_OF_BOUNDS;

    if (channel === 'rte_private_quota' && km > 3) {
      warnings.push(`Distance (${km} km) is outside primary 1-3 km neighbourhood. Most RTE private school allotments prioritize within 1–3 km.`);
    }
  }

  // Document verification
  if (!submittedDocs.includes('child_dob_proof')) {
    errors.push('Mandatory proof of date of birth is missing.');
  }
  if (!submittedDocs.includes('parent_id_residence')) {
    errors.push('Mandatory parent residence proof is missing.');
  }

  // RTE specific rules
  if (channel === 'rte_private_quota') {
    const rteCat = applicantData.rteCategory;
    if (!rteCat) {
      errors.push('RTE category selection (EWS or Disadvantaged Group) is required for 25% quota application.');
    } else if (rteCat === 'ews') {
      if (!submittedDocs.includes('income_certificate')) {
        warnings.push('Income certificate is required for EWS category application.');
      }
      if (applicantData.annualIncome && Number(applicantData.annualIncome) > 250000) {
        warnings.push('Declared income exceeds ₹2.5 Lakh per annum. Verify state-specific EWS ceiling.');
      }
    } else if (rteCat === 'dg' && !submittedDocs.includes('caste_or_dg_certificate')) {
      warnings.push('Caste or Disadvantaged Group certificate is required.');
    }
  }

  const eligible = errors.length === 0;

  return {
    eligible,
    channel: selectedChannel,
    calculatedAge: age,
    distanceTier,
    errors,
    warnings,
    lotteryMilestones: getAdmissionMilestones(channel)
  };
}

/**
 * Returns timeline milestones for school admission process.
 * @param {string} channel 
 * @returns {Array<Object>}
 */
export function getAdmissionMilestones(channel) {
  if (channel === 'rte_private_quota') {
    return [
      { step: 1, title: 'Notification & Online Registration', timeWindow: 'January – February' },
      { step: 2, title: 'Document Verification by Block Education Officer (BEO)', timeWindow: 'February – March' },
      { step: 3, title: 'Computerized Transparent Lottery Round 1', timeWindow: 'Late March' },
      { step: 4, title: 'School Reporting & Zero-Fee Admission Confirmation', timeWindow: 'April' },
      { step: 5, title: 'Lottery Round 2 (for unfilled seats)', timeWindow: 'April – May' }
    ];
  }

  return [
    { step: 1, title: 'School Admission Form Distribution', timeWindow: 'February – March' },
    { step: 2, title: 'Submission of Documents & Age Proof', timeWindow: 'March' },
    { step: 3, title: 'Neighbourhood Verification & Enrolment', timeWindow: 'April' },
    { step: 4, title: 'Distribution of Free Textbooks, Uniforms & Mid-Day Meal Enrolment', timeWindow: 'April – July' }
  ];
}

/**
 * Exports complete admission roadmap in markdown format.
 * @param {Object} applicantData 
 * @returns {string} markdownReport
 */
export function exportSchoolAdmissionReport(applicantData = {}) {
  const assessment = evaluateAdmissionReadiness(applicantData);

  return [
    `# Government School & RTE 12(1)(c) Admission Readiness Dossier`,
    `**Child Name:** ${applicantData.childName || 'N/A'}`,
    `**Parent/Guardian:** ${applicantData.parentName || 'N/A'}`,
    `**Admission Channel:** ${assessment.channel.label}`,
    `**Calculated Age:** ${assessment.calculatedAge ? `${assessment.calculatedAge.years} yrs ${assessment.calculatedAge.months} mos` : 'N/A'}`,
    `**Neighbourhood Tier:** ${assessment.distanceTier.label}`,
    `**Status:** ${assessment.eligible ? 'ELIGIBLE TO PROCEED' : 'DEFICIENCIES DETECTED'}`,
    ``,
    `## Statutory Legal Guarantees`,
    `- **RTE Act 2009 Section 3:** Free and compulsory elementary education to every child of age 6 to 14 years.`,
    `- **RTE Act 2009 Section 12(1)(c):** Mandatory 25% free seats in private unaided schools for EWS and DG children.`,
    `- **RTE Act 2009 Section 14:** No child shall be denied admission for lack of age proof or mid-term transfers.`,
    ``,
    `## Admission Timeline & Milestones`,
    ...assessment.lotteryMilestones.map(m => `- **Step ${m.step} (${m.timeWindow}):** ${m.title}`),
    ...(assessment.errors.length > 0 ? [``, `## Mandatory Deficiencies`, ...assessment.errors.map(e => `- ❌ ${e}`)] : []),
    ...(assessment.warnings.length > 0 ? [``, `## Recommended Actions & Warnings`, ...assessment.warnings.map(w => `- ⚠️ ${w}`)] : [])
  ].join('\n');
}
