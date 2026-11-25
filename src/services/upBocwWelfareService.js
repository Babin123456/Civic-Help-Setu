/**
 * UP Construction Worker Welfare Benefit and Renewal Journey Builder Service
 * 
 * Supports unorganized construction and building workers under the
 * Uttar Pradesh Building and Other Construction Workers Welfare Board (UPBOCW / upbocw.in).
 * 
 * Key Capabilities:
 * - 90-day minimum annual construction work eligibility validation (Employer certificate, trade union, or Gram Pradhan declaration)
 * - Annual registration renewal timeline calculation and grace period tracking
 * - Welfare scheme matching (Sant Ravidas Shiksha Protsahan, Matritva Hitlabh, Kanya Vivah, Tool Kit Assistance)
 * - Document readiness checklist generation
 * - Step-by-step grievance / physical submission dossier export for Labour Enforcement Officer (LEO) / ALC
 * - Multilingual Hindi/English field guidance without sensitive Aadhaar or biometric harvesting
 */

export const UP_BOCW_OCCUPATIONS = [
  'Mason (Rajmistri)',
  'Carpenter (Badhai)',
  'Painter (Rangsaaz)',
  'Electrician / Wiring Worker',
  'Plumber / Pipe Fitter',
  'Bar Bender / Rebar Worker (Saria Binder)',
  'Earthwork & Excavation Labourer (Mitti Khodai)',
  'Tile & Marble Layer',
  'Blacksmith / Welder (Lohar / Welder)',
  'Centering & Shuttering Labourer',
  'Road & Asphalt Worker',
  'Concrete Mixer & Lift Operator'
];

export const UP_BOCW_BENEFIT_SCHEMES = {
  SANT_RAVIDAS_SHIKSHA: {
    code: 'SANT_RAVIDAS_SHIKSHA',
    name: 'Sant Ravidas Shiksha Protsahan Yojana',
    description: 'Monthly educational stipend for registered workers\' children from Class 1 to Higher Education (ITI/Polytechnic/Graduation).',
    minActiveMembershipYears: 1,
    requiredDocuments: [
      'Active UPBOCW Registration Card (Parichay Patra)',
      'School/College Bonafide Certificate & Fee Receipt',
      'Bank passbook photocopy showing active DBT mapping',
      'Child\'s Aadhaar card and family ration card'
    ],
    stipendRangeINR: '₹100 to ₹5,000 per month depending on academic level'
  },
  MATRITVA_SHISHU_HITLABH: {
    code: 'MATRITVA_SHISHU_HITLABH',
    name: 'Matritva, Shishu Evam Balika Madad Yojana',
    description: 'Financial maternity relief and newborn nutritional support for female construction workers or wives of male workers.',
    minActiveMembershipYears: 1,
    requiredDocuments: [
      'UPBOCW Registration Card',
      'Institutional Delivery Discharge Summary / Birth Certificate',
      'Mamta Card / Mother-Child Health Tracking Card (MCP)',
      'Bank passbook copy of the mother'
    ],
    stipendRangeINR: '₹20,000 to ₹25,000 lump-sum grant'
  },
  KANYA_VIVAH_SAHAYATA: {
    code: 'KANYA_VIVAH_SAHAYATA',
    name: 'Kanya Vivah Sahayata Yojana',
    description: 'Financial assistance for the solemnization of marriage of registered construction workers\' daughters.',
    minActiveMembershipYears: 1,
    requiredDocuments: [
      'UPBOCW Registration Card (minimum 1 year active)',
      'Bride age proof (minimum 18 years) and Groom age proof (minimum 21 years)',
      'Marriage Invitation Card / Marriage Registration Certificate / Gram Panchayat Certificate',
      'Worker\'s bank passbook'
    ],
    stipendRangeINR: '₹55,000 per daughter (up to 2 daughters) or ₹61,000 in mass marriage ceremonies'
  },
  TOOL_KIT_ASSISTANCE: {
    code: 'TOOL_KIT_ASSISTANCE',
    name: 'Kaushal Vikas Evam Tool Kit Vitran Sahayata',
    description: 'Assistance for modern tools or vocational training equipment based on the worker\'s registered trade.',
    minActiveMembershipYears: 1,
    requiredDocuments: [
      'UPBOCW Registration Card',
      'Trade Skill Certificate / Self-declaration of active occupation',
      'Bank passbook copy'
    ],
    stipendRangeINR: 'Tool kit distribution or up to ₹5,000 tool subsidy'
  }
};

export const UP_LABOUR_OFFICE_ESCALATION = [
  { level: 'SUB_DIVISION', officer: 'Labour Enforcement Officer (LEO / Shram Pravartan Adhikari)', jurisdiction: 'Tehsil / Sub-division area' },
  { level: 'DISTRICT', officer: 'Assistant Labour Commissioner (ALC / Sahayak Shram Ayukt)', jurisdiction: 'District Labour Office' },
  { level: 'DIVISION', officer: 'Deputy Labour Commissioner (DLC / Up Shram Ayukt)', jurisdiction: 'Commissionerate Division' }
];

/**
 * Validates worker eligibility for UPBOCW registration or annual renewal.
 * Statutory requirement: Minimum 90 days of construction work in the preceding 12 months.
 * Age limit: 18 to 60 years.
 * @param {Object} workerProfile 
 * @returns {Object} eligibility assessment
 */
export function assessBocwEligibility(workerProfile = {}) {
  const errors = [];
  const warnings = [];

  const age = Number(workerProfile.age);
  if (isNaN(age) || age < 18 || age > 60) {
    errors.push('Worker age must be between 18 and 60 years as prescribed under the BOCW Act.');
  }

  const daysWorked = Number(workerProfile.daysWorkedLast12Months);
  if (isNaN(daysWorked) || daysWorked < 90) {
    errors.push(`Statutory requirement not met: Must have completed at least 90 days of construction labour in the past 12 months (Recorded: ${isNaN(daysWorked) ? 0 : daysWorked} days).`);
  }

  if (!workerProfile.occupation || !UP_BOCW_OCCUPATIONS.includes(workerProfile.occupation)) {
    warnings.push('Selected trade is not listed in standard UPBOCW schedules. Provide trade description in physical verification.');
  }

  const isValidCertification = Boolean(
    workerProfile.hasEmployerCertificate ||
    workerProfile.hasTradeUnionCertificate ||
    workerProfile.hasGramPradhanCertificate
  );

  if (!isValidCertification) {
    errors.push('90-day work certificate required: Must have certification from employer/contractor, registered trade union, or Gram Pradhan / Ward Member.');
  }

  return {
    isEligible: errors.length === 0,
    errors,
    warnings,
    statutoryMinimumDays: 90,
    daysRecorded: daysWorked || 0
  };
}

/**
 * Calculates renewal status, fee, and grace period for existing UPBOCW registration.
 * Standard fee: ₹20 per year (or ₹60 for 3 years). Grace period: 90 days past expiry.
 * @param {Object} registrationRecord 
 * @returns {Object} renewal plan
 */
export function calculateBocwRenewalTimeline(registrationRecord = {}) {
  const expiryDate = new Date(registrationRecord.validUptoDate);
  const now = new Date();
  const isExpired = expiryDate < now;

  const msDiff = Math.abs(now.getTime() - expiryDate.getTime());
  const daysDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24));

  let status = 'ACTIVE';
  let gracePeriodExpired = false;

  if (isExpired) {
    if (daysDiff <= 90) {
      status = 'GRACE_PERIOD';
    } else {
      status = 'LAPSED';
      gracePeriodExpired = true;
    }
  }

  return {
    registrationNumber: registrationRecord.registrationNumber ? `UPBOCW-****-${String(registrationRecord.registrationNumber).slice(-4)}` : 'UPBOCW-PENDING',
    status,
    expiryDate: registrationRecord.validUptoDate || 'UNKNOWN',
    daysSinceExpiry: isExpired ? daysDiff : 0,
    gracePeriodDaysRemaining: status === 'GRACE_PERIOD' ? 90 - daysDiff : 0,
    annualRenewalFeeINR: 20,
    threeYearRenewalFeeINR: 60,
    canRenewOnline: status !== 'LAPSED',
    actionRequired: status === 'ACTIVE'
      ? 'No immediate action required. Plan renewal 30 days before expiry.'
      : status === 'GRACE_PERIOD'
      ? 'Urgent: Renew before 90-day grace period lapses to prevent benefit de-registration.'
      : 'Registration lapsed. Fresh re-enrolment and physical verification before Assistant Labour Commissioner (ALC) required.'
  };
}

/**
 * Matches qualified worker profile against UPBOCW welfare schemes.
 * @param {Object} workerProfile 
 * @returns {Array<Object>} matched schemes with eligibility details
 */
export function matchBocwSchemes(workerProfile = {}) {
  const activeYears = Number(workerProfile.activeMembershipYears) || 0;
  const matches = [];

  Object.values(UP_BOCW_BENEFIT_SCHEMES).forEach(scheme => {
    const isQualifying = activeYears >= scheme.minActiveMembershipYears;
    matches.push({
      ...scheme,
      isQualifying,
      reason: isQualifying
        ? `Worker has completed ${activeYears} year(s) of active membership.`
        : `Requires minimum ${scheme.minActiveMembershipYears} year(s) active cardholder status (Current: ${activeYears} years).`
    });
  });

  return matches;
}

/**
 * Builds printable markdown representation dossier for submission to Labour Enforcement Officer (LEO) / ALC.
 * @param {Object} workerDetails 
 * @param {Object} eligibility 
 * @param {Object} renewal 
 * @returns {string} markdown dossier
 */
export function exportBocwDossier(workerDetails = {}, eligibility = {}, renewal = {}) {
  return [
    `# UPBOCW Labour Welfare & Registration Representation`,
    `**Applicant Trade:** ${workerDetails.occupation || 'Construction Labourer'}`,
    `**District:** ${workerDetails.district || 'Uttar Pradesh'}`,
    `**Card Status:** ${renewal.status || 'NEW_APPLICATION'} (Ref: \`${renewal.registrationNumber || 'N/A'}\`)`,
    `**90-Day Construction Labour Verified:** ${eligibility.isEligible ? 'YES (Meets Statutory Requirement)' : 'NO / INCOMPLETE'}`,
    ``,
    `## Summary of Statutory Eligibility`,
    `- Recorded Work Days: **${eligibility.daysRecorded || 0} / 90 days**`,
    `- Minimum Prescribed Age: 18–60 Years`,
    ...(eligibility.errors && eligibility.errors.length > 0
      ? eligibility.errors.map(err => `- ❌ Block: ${err}`)
      : ['- ✅ All initial statutory criteria satisfied.']),
    ``,
    `## Document Verification Checklist for Submission`,
    `1. Original 90-day work certificate signed by Contractor / Registered Union / Gram Pradhan.`,
    `2. Copy of Bank Passbook (Aadhaar NPCI DBT seeded).`,
    `3. Passport-sized photograph (2 copies).`,
    `4. Ration Card / Family Composition Proof.`,
    `5. Self-declaration that worker is not registered under EPFO/ESIC as an organized sector employee.`,
    ``,
    `## Escalation & Redressal Authorities`,
    ...UP_LABOUR_OFFICE_ESCALATION.map(e => `- **${e.officer}** (${e.level}) — *Jurisdiction:* ${e.jurisdiction}`),
    ``,
    `---`,
    `> **Privacy Commitment:** No Aadhaar numbers, biometric data, or passwords are stored or requested.`
  ].join('\n');
}
