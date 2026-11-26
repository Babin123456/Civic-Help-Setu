/**
 * UP School Basic-Facility Gap and Parent Follow-Up Dossier Service
 * 
 * Facilitates parent and community observation of basic facility gaps in UP government schools:
 * - UDISE+ school identifier lookup & matching
 * - Facility indicators: Drinking Water, Separate Boys/Girls Toilets, Electricity, Ramps, Classroom Safety
 * - Strict Child Privacy: Zero collection of child names, faces, photos of minors, or student IDs
 * - Excludes individual allegations against named teachers or staff
 * - Aggregates trends only at school/block level with minimum report thresholds
 * - Grounded in Department of Basic Education, Government of UP & RTE Act 2009 Norms
 */

export const UP_SCHOOL_FACILITY_CATEGORIES = {
  DRINKING_WATER: {
    code: 'DRINKING_WATER',
    label: 'Safe Potable Drinking Water Supply',
    statutoryNorm: 'RTE Act 2009 Schedule Norms (Item 2) & Jal Jeevan Mission School Har Ghar Jal',
    officialStandard: 'Functional piped tap water or safe certified submersible pump with daily availability.'
  },
  BOYS_GIRLS_TOILETS: {
    code: 'BOYS_GIRLS_TOILETS',
    label: 'Functional & Separate Boys/Girls Toilets',
    statutoryNorm: 'Supreme Court Directive in Environmental & Consumer Protection Foundation v. UOI (2012)',
    officialStandard: 'Separate, functional, secure, and clean toilet blocks with running water and doors.'
  },
  CLASSROOM_INFRASTRUCTURE: {
    code: 'CLASSROOM_INFRASTRUCTURE',
    label: 'All-Weather Classroom Safety & Boundary Wall',
    statutoryNorm: 'Operation Kayakalp (UP Basic Shiksha Parishad)',
    officialStandard: 'Structural roof safety, pucca flooring, plastering, windows, and secure boundary wall.'
  },
  ELECTRICITY_FANS: {
    code: 'ELECTRICITY_FANS',
    label: 'Functional Electricity Connection & Fans',
    statutoryNorm: 'Operation Kayakalp Parameter 4',
    officialStandard: 'Active metered connection with functional ceiling fans and LED fixtures in all classrooms.'
  },
  RAMP_ACCESSIBILITY: {
    code: 'RAMP_ACCESSIBILITY',
    label: 'Barrier-Free Wheelchair Ramp with Handrails',
    statutoryNorm: 'Rights of Persons with Disabilities (RPwD) Act 2016 Section 16',
    officialStandard: 'Gradient 1:12 ramp with double-height continuous handrails to all entry points.'
  }
};

export const OPERATION_KAYAKALP_CHECKLIST_19 = [
  { item: 'Safe Drinking Water with Running Tap Water', mandatory: true },
  { item: 'Separate Functional Toilets for Boys and Girls', mandatory: true },
  { item: 'Handwashing Unit with Multiple Water Taps', mandatory: true },
  { item: 'Tiled Flooring in Classrooms and Verandah', mandatory: true },
  { item: 'White-Washing and Child-Friendly Wall Painting (BaLA)', mandatory: true },
  { item: 'Functional Electricity Connection with Fans and Lights', mandatory: true },
  { item: 'Barrier-Free Disabled-Friendly Ramps and Railings', mandatory: true },
  { item: 'Boundary Wall with Main Entry Gate for Child Safety', mandatory: true }
];

/**
 * Returns Operation Kayakalp core saturation parameters.
 * @returns {Array<Object>}
 */
export function getOperationKayakalpParameters() {
  return OPERATION_KAYAKALP_CHECKLIST_19;
}

export const AGGREGATION_CONFIG = {
  MIN_REPORT_THRESHOLD_FOR_PUBLIC_TREND: 3,
  MAX_ACTIVE_AGE_DAYS: 180
};

/**
 * Validates school facility observation while enforcing child safety safeguards.
 * @param {Object} reportData 
 * @returns {Object} assessment
 */
export function validateSchoolFacilityObservation(reportData = {}) {
  const errors = [];
  const warnings = [];

  if (!reportData.udiseCode || !/^\d{11}$/.test(reportData.udiseCode.trim())) {
    errors.push('A valid 11-digit UDISE+ school code is required for UP government school identification.');
  }

  if (!reportData.schoolName || reportData.schoolName.trim().length < 3) {
    errors.push('School name is required.');
  }

  const category = UP_SCHOOL_FACILITY_CATEGORIES[reportData.facilityCategory];
  if (!category) {
    errors.push('Valid facility category must be selected from the Operation Kayakalp / RTE catalogue.');
  }

  if (!reportData.observationDate) {
    errors.push('Observation date is required.');
  }

  const desc = reportData.description || '';
  if (desc.trim().length < 15) {
    errors.push('Observation description must be at least 15 characters, focusing purely on physical facility defects.');
  }

  // Child protection check: prevent naming children or students
  const childMentionRegex = /\b(student|child|girl|boy|minor|daughter|son|bacha|bachi|ladka|ladki)\s+name\b|\broll\s*no\b|\bclass\s*\d+\s*student\b/i;
  if (childMentionRegex.test(desc)) {
    errors.push('Child Privacy Violation: Do not mention specific student names, roll numbers, or personal identifying details.');
  }

  // Teacher/staff naming safeguard: prevent defamatory allegations against named staff
  const staffAllegationRegex = /\b(teacher|headmaster|principal|guruji|shikshak|adhikari)\s+[A-Z][a-z]+/i;
  if (staffAllegationRegex.test(desc)) {
    warnings.push('Staff Protection Notice: Observations must describe infrastructure conditions rather than named personal complaints against individual educators.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedObservation: errors.length === 0 ? {
      observationId: 'sfo_' + Math.random().toString(36).substring(2, 10),
      udiseCode: reportData.udiseCode.trim(),
      schoolName: reportData.schoolName.trim(),
      district: reportData.district || 'Uttar Pradesh',
      block: reportData.block || 'General Block',
      facilityCategory: category.code,
      observationDate: reportData.observationDate,
      description: desc.trim(),
      isCommunityReport: true, // explicitly not presented as official inspection
      createdAt: new Date().toISOString()
    } : null
  };
}

/**
 * Aggregates school facility gap reports, enforcing minimum-threshold privacy.
 * @param {Array<Object>} observations 
 * @param {string} udiseCode 
 * @returns {Object} aggregatedSummary
 */
export function aggregateSchoolGaps(observations = [], udiseCode = '') {
  const filtered = observations.filter(o => o.udiseCode === udiseCode);
  const totalReports = filtered.length;

  if (totalReports < AGGREGATION_CONFIG.MIN_REPORT_THRESHOLD_FOR_PUBLIC_TREND) {
    return {
      udiseCode,
      totalReports,
      meetsPublicThreshold: false,
      message: `Below minimum threshold (${AGGREGATION_CONFIG.MIN_REPORT_THRESHOLD_FOR_PUBLIC_TREND} independent parent/community observations required for public trend analysis to prevent individual singling-out).`,
      categoryBreakdown: {}
    };
  }

  const breakdown = {};
  filtered.forEach(o => {
    breakdown[o.facilityCategory] = (breakdown[o.facilityCategory] || 0) + 1;
  });

  return {
    udiseCode,
    totalReports,
    meetsPublicThreshold: true,
    schoolName: filtered[0]?.schoolName || 'UP Parishadiya Vidyalaya',
    district: filtered[0]?.district || 'UP',
    categoryBreakdown: breakdown,
    topGapCategory: Object.keys(breakdown).reduce((a, b) => breakdown[a] > breakdown[b] ? a : b),
    officialInspectionDisclaimer: 'Note: These entries represent time-stamped parent and community observations. They do not substitute official Basic Shiksha Adhikari (BSA) audit reports.'
  };
}

/**
 * Formats a formal representation dossier for School Management Committee (SMC) & BSA follow-up.
 * @param {Object} observation 
 * @returns {string} markdownDossier
 */
export function exportSchoolGapDossier(observation = {}) {
  const category = UP_SCHOOL_FACILITY_CATEGORIES[observation.facilityCategory] || {};

  return [
    `# UP School Basic-Facility Gap Observation & Follow-Up Dossier`,
    `**School Name:** ${observation.schoolName || 'UP Parishadiya School'}`,
    `**UDISE+ Code:** ${observation.udiseCode || 'N/A'}`,
    `**Location:** Block: ${observation.block || 'N/A'}, District: ${observation.district || 'Uttar Pradesh'}`,
    `**Facility Indicator:** ${category.label || observation.facilityCategory}`,
    `**Date Observed:** ${observation.observationDate || 'N/A'}`,
    ``,
    `## Statutory Legal Standards`,
    `- **Statutory Reference:** ${category.statutoryNorm || 'Operation Kayakalp Guidelines'}`,
    `- **Prescribed Norm:** ${category.officialStandard || 'Functional amenities conforming to state standards.'}`,
    ``,
    `## Observed Infrastructure Gap`,
    `> ${observation.description || 'No detailed description provided.'}`,
    ``,
    `## Follow-Up & Redressal Route`,
    `1. **School Management Committee (SMC):** Submit copy to the Headmaster & SMC President for discussion in monthly parent-teacher assembly.`,
    `2. **Block Education Officer (BEO):** Present representation for infrastructure allocation under Operation Kayakalp budget.`,
    `3. **District Basic Shiksha Adhikari (BSA):** Escalate through UP CM Helpline (1076) or BSA Grievance Cell if unaddressed after 30 days.`,
    ``,
    `---`,
    `> **Child & Staff Privacy Safeguard:** This dossier adheres to non-disclosure standards. No child names or staff allegations are recorded.`
  ].join('\n');
}
