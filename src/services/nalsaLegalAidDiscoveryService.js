/**
 * National Legal Services Authority (NALSA) Legal-Aid Discovery Directory Service
 * 
 * Implements discovery, entitlement verification, and legal-aid application readiness
 * under the Legal Services Authorities Act, 1987.
 * Structures NALSA statutory eligibility under Section 12:
 * - Women & Children
 * - Members of SC / ST
 * - Persons with Disabilities (PwD)
 * - Industrial Workmen
 * - Persons in Custody / Detention / Juvenile Home
 * - Victims of Trafficking / Beggar Homes / Disaster / Violence
 * - General citizens with annual income below notified State Legal Services Authority (SLSA) ceilings.
 */

export const NALSA_STATUTORY_CATEGORIES = {
  WOMEN_CHILDREN: {
    code: 'WOMEN_CHILDREN',
    statuteRef: 'Section 12(c)',
    label: 'Women and Children',
    meansTestExempt: true,
    description: 'All women and children are entitled to free legal aid irrespective of financial status.'
  },
  SC_ST: {
    code: 'SC_ST',
    statuteRef: 'Section 12(a)',
    label: 'Scheduled Castes & Scheduled Tribes',
    meansTestExempt: true,
    description: 'Members of SC and ST communities are entitled without an income barrier.'
  },
  PWD: {
    code: 'PWD',
    statuteRef: 'Section 12(d)',
    label: 'Persons with Disabilities',
    meansTestExempt: true,
    description: 'Persons with disabilities covered under Rights of Persons with Disabilities Act.'
  },
  CUSTODY: {
    code: 'CUSTODY',
    statuteRef: 'Section 12(g)',
    label: 'Persons in Custody or Juvenile Homes',
    meansTestExempt: true,
    description: 'Individuals in police/judicial custody, protective homes, psychiatric hospitals, or juvenile homes.'
  },
  WORKMEN: {
    code: 'WORKMEN',
    statuteRef: 'Section 12(e)',
    label: 'Industrial Workmen',
    meansTestExempt: true,
    description: 'Industrial workers facing labour disputes or retrenchment.'
  },
  DISASTER_VICTIMS: {
    code: 'DISASTER_VICTIMS',
    statuteRef: 'Section 12(b)',
    label: 'Victims of Trafficking, Disaster, or Violence',
    meansTestExempt: true,
    description: 'Victims of human trafficking, flood, drought, earthquake, ethnic violence, or caste atrocities.'
  },
  INCOME_ELIGIBLE: {
    code: 'INCOME_ELIGIBLE',
    statuteRef: 'Section 12(h)',
    label: 'General Citizen below Income Ceiling',
    meansTestExempt: false,
    description: 'Persons with annual income below the threshold notified by the respective State Government / SLSA.'
  }
};

export const DEFAULT_STATE_INCOME_CEILINGS = {
  DELHI: 300000,
  MAHARASHTRA: 300000,
  UTTAR_PRADESH: 300000,
  BIHAR: 150000,
  WEST_BENGAL: 300000,
  KARNATAKA: 300000,
  TAMIL_NADU: 300000,
  DEFAULT: 300000 // Supreme Court Middle Income Group Scheme / SLSA standard baseline
};

export const LEGAL_SERVICES_INSTITUTIONS = [
  { level: 'SUPREME_COURT', body: 'Supreme Court Legal Services Committee (SCLSC)', jurisdiction: 'Apex Court Appeals' },
  { level: 'STATE_HIGH_COURT', body: 'High Court Legal Services Committee (HCLSC) / SLSA', jurisdiction: 'State High Court' },
  { level: 'DISTRICT', body: 'District Legal Services Authority (DLSA)', jurisdiction: 'District & Sessions Courts' },
  { level: 'SUB_DIVISION', body: 'Taluk Legal Services Committee (TLSC)', jurisdiction: 'Sub-divisional & Munsiff Courts' },
  { level: 'GRASSROOTS', body: 'Front Office & Legal Aid Clinics', jurisdiction: 'Jails, community centers, remote taluks' }
];

export const MANDATORY_LEGAL_AID_SERVICES = [
  'Free assignment of panel advocate to file or defend legal proceedings',
  'Payment of process fees, title search, drafting, and certified copies',
  'Preparation of appeals, paper books, and translations',
  'Pre-litigation mediation and Lok Adalat dispute settlement'
];

/**
 * Evaluates an applicant's entitlement under Section 12 of the Legal Services Authorities Act, 1987.
 * @param {Object} applicantDetails 
 * @returns {Object} evaluation
 */
export function evaluateLegalAidEntitlement(applicantDetails = {}) {
  const errors = [];
  const warnings = [];

  if (!applicantDetails.applicantName || applicantDetails.applicantName.trim().length < 2) {
    errors.push('Applicant full legal name is required.');
  }

  const stateKey = (applicantDetails.state || 'DEFAULT').toUpperCase();
  const stateCeiling = DEFAULT_STATE_INCOME_CEILINGS[stateKey] || DEFAULT_STATE_INCOME_CEILINGS.DEFAULT;

  const categoryKey = (applicantDetails.category || '').toUpperCase();
  const matchedCategory = NALSA_STATUTORY_CATEGORIES[categoryKey];

  if (!matchedCategory) {
    errors.push('Valid statutory eligibility category under Section 12 must be specified.');
  }

  let isEntitled = false;
  let entitlementReason = '';

  if (matchedCategory) {
    if (matchedCategory.meansTestExempt) {
      isEntitled = true;
      entitlementReason = `Statutorily entitled under ${matchedCategory.statuteRef} (${matchedCategory.label}) without income restriction.`;
    } else {
      // Means test required
      const income = Number(applicantDetails.annualIncome);
      if (isNaN(income) || income < 0) {
        errors.push('Annual income must be specified for general category assessment under Section 12(h).');
      } else if (income <= stateCeiling) {
        isEntitled = true;
        entitlementReason = `Annual income (₹${income.toLocaleString('en-IN')}) is within the SLSA ceiling of ₹${stateCeiling.toLocaleString('en-IN')}.`;
      } else {
        isEntitled = false;
        warnings.push(`Annual income (₹${income.toLocaleString('en-IN')}) exceeds the general SLSA threshold of ₹${stateCeiling.toLocaleString('en-IN')}. Consider Middle Income Group Scheme or Lok Adalat.`);
      }
    }
  }

  return {
    isEntitled: isEntitled && errors.length === 0,
    matchedCategory: matchedCategory || null,
    stateCeiling,
    entitlementReason,
    errors,
    warnings,
    nalsaNationalHelpline: '15100',
    nalsaPortalUrl: 'https://nalsa.gov.in/'
  };
}

/**
 * Builds an actionable directory dossier for visiting the local DLSA / TLSC.
 * @param {Object} queryDetails 
 * @returns {Object} clinicDossier
 */
export function buildLegalAidVisitDossier(queryDetails = {}) {
  const { district = 'Local District', state = 'State', matterType = 'Civil / Criminal' } = queryDetails;

  return {
    authority: `District Legal Services Authority (DLSA), ${district}`,
    stateJurisdiction: state,
    caseNature: matterType,
    helpline: '15100 (National Legal Services Authority 24x7 Toll-Free Helpline)',
    portal: 'https://nalsa.gov.in/',
    institutionalHierarchy: LEGAL_SERVICES_INSTITUTIONS,
    entitledServices: MANDATORY_LEGAL_AID_SERVICES,
    checklistForVisit: [
      { document: 'Identity Proof', details: 'Aadhaar Card, Voter ID, or Ration Card' },
      { document: 'Address Proof', details: 'Document showing residence within district jurisdiction' },
      { document: 'Court Summons / Notice / FIR', details: 'Copies of any received court summons, police report, or notice' },
      { document: 'Category Proof or Income Affidavit', details: 'Caste/disability certificate, custody order, or self-declared income affidavit' },
      { document: 'Chronological Summary', details: 'Brief written explanation of the dispute and relief requested' }
    ],
    procedure: [
      'Walk into the DLSA Front Office at District Court Complex or apply online via NALSA Portal.',
      'Front Office Retainer Lawyer conducts initial intake interview and fills Legal Aid Form-1.',
      'Secretary, DLSA verifies Section 12 eligibility within 7 working days.',
      'Panel Lawyer is assigned with zero fee payable by the applicant.',
      'Advocate contact details and appointment date communicated via SMS/notice.'
    ]
  };
}

/**
 * Exports complete Legal Aid Discovery Dossier in markdown format.
 * @param {Object} applicantDetails 
 * @returns {string} markdown
 */
export function exportLegalAidDossier(applicantDetails = {}) {
  const assessment = evaluateLegalAidEntitlement(applicantDetails);
  const dossier = buildLegalAidVisitDossier({
    district: applicantDetails.district,
    state: applicantDetails.state,
    matterType: applicantDetails.matterType
  });

  return [
    `# National Legal Services Authority (NALSA) Free Legal-Aid Dossier`,
    `**Applicant Name:** ${applicantDetails.applicantName || 'N/A'}`,
    `**Location:** ${applicantDetails.district || 'District'}, ${applicantDetails.state || 'State'}`,
    `**Statutory Category:** ${assessment.matchedCategory ? assessment.matchedCategory.label : 'N/A'}`,
    `**Entitlement Status:** ${assessment.isEntitled ? 'CONFIRMED ELIGIBLE UNDER SECTION 12' : 'NOT VERIFIED'}`,
    `**National 24x7 Helpline:** ${assessment.nalsaNationalHelpline}`,
    ``,
    `## Basis of Entitlement`,
    `> ${assessment.entitlementReason || 'Awaiting verification of statutory category and income criteria.'}`,
    ``,
    `## Entitled Free Legal Services`,
    ...dossier.entitledServices.map(s => `- ${s}`),
    ``,
    `## Checklist for DLSA Front Office Visit`,
    ...dossier.checklistForVisit.map(c => `- **${c.document}:** ${c.details}`),
    ``,
    `## Step-by-Step Procedure`,
    ...dossier.procedure.map((p, idx) => `${idx + 1}. ${p}`),
    ...(assessment.warnings.length > 0 ? [``, `## Important Notices`, ...assessment.warnings.map(w => `- ⚠️ ${w}`)] : [])
  ].join('\n');
}
