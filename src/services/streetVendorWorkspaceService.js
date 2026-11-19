/**
 * Street-Vendor Certificate and Vending-Zone Application Workspace Service
 * 
 * Provides verified statutory workflows under Street Vendors (Protection of
 * Livelihood and Regulation of Street Vending) Act, 2014.
 * Covers Town Vending Committee (TVC) survey status, Certificate of Vending (CoV),
 * identity cards, vending zones, natural markets, and clear separation from
 * PM SVANidhi micro-credit loans.
 */

export const VENDING_CATEGORIES = {
  STATIONARY: {
    id: 'stationary',
    label: 'Stationary Vendor',
    description: 'Carries out street vending on a regular basis at a specific fixed location.'
  },
  MOBILE: {
    id: 'mobile',
    label: 'Mobile Vendor',
    description: 'Carries out vending on foot, pushcart, or bicycle moving from one area to another.'
  },
  PERIPATETIC: {
    id: 'peripatetic',
    label: 'Peripatetic / Weekly Haat Vendor',
    description: 'Vendors in weekly markets, heritage haats, night markets, or festival bazaars.'
  }
};

export const ZONE_TYPES = {
  VENDING: {
    id: 'vending_zone',
    label: 'Designated Vending Zone',
    description: 'Demarcated public space where vending is permitted subject to TVC conditions.'
  },
  RESTRICTED_VENDING: {
    id: 'restricted_vending_zone',
    label: 'Restricted / Regulated Vending Zone',
    description: 'Vending permitted only on specified days/hours or for capped vendor counts.'
  },
  NO_VENDING: {
    id: 'no_vending_zone',
    label: 'No-Vending Zone',
    description: 'Strict non-vending zones designated under statutory Master Plan or TVC notification.'
  }
};

export const STATUTORY_EVIDENCE_CHECKLIST = [
  {
    code: 'identity_proof',
    name: 'Identity Proof (Aadhaar / Voter ID / Ration Card)',
    mandatory: true,
    guidance: 'Must show vendor name matching municipal survey or self-declaration.'
  },
  {
    code: 'residence_proof',
    name: 'Local Residence Proof',
    mandatory: true,
    guidance: 'Proof of continuous residence within local urban body jurisdiction.'
  },
  {
    code: 'tvc_survey_acknowledgment',
    name: 'TVC Survey Slip or Token (if available)',
    mandatory: false,
    guidance: 'Town Vending Committee survey number speeds up verification.'
  },
  {
    code: 'vending_site_photograph',
    name: 'Passport Photograph & Site/Cart Photo',
    mandatory: true,
    guidance: 'Two passport photos and one geolocated photo of cart/stall.'
  },
  {
    code: 'no_other_vending_undertaking',
    name: 'Statutory Self-Declaration Undertaking',
    mandatory: true,
    guidance: 'Affidavit affirming street vending is primary livelihood and no alternate commercial allotment held.'
  }
];

export const SVANIDHI_DISTINCTION_FACTS = {
  certificateOfVending: {
    statute: 'Street Vendors Act, 2014 (Section 3 & 4)',
    purpose: 'Right to vend without harassment, allocation of vending slot, protection from unlawful eviction.',
    issuingAuthority: 'Town Vending Committee (TVC) / Local Municipal Corporation',
    financialBenefit: false
  },
  pmSvanidhiLoan: {
    statute: 'PM SVANidhi Central Sector Scheme',
    purpose: 'Collateral-free working capital micro-credit loan (₹10,000 / ₹20,000 / ₹50,000) with interest subsidy.',
    issuingAuthority: 'Scheduled Commercial Banks / NBFCs / MFIs under MoHUA',
    financialBenefit: true,
    prerequisite: 'Requires CoV, TVC Survey ID, or Letter of Recommendation (LoR).'
  }
};

/**
 * Validates vendor details and returns readiness status.
 * @param {Object} vendorData 
 * @returns {Object} assessment
 */
export function assessVendorReadiness(vendorData = {}) {
  const errors = [];
  const warnings = [];
  const submittedDocs = vendorData.documents || [];

  if (!vendorData.fullName || vendorData.fullName.trim().length < 2) {
    errors.push('Full name is required and must match legal identity proof.');
  }

  if (!vendorData.municipality || vendorData.municipality.trim().length < 2) {
    errors.push('Local urban body / municipal jurisdiction is required.');
  }

  if (!vendorData.category || !VENDING_CATEGORIES[vendorData.category.toUpperCase()]) {
    errors.push('Valid vending category (Stationary, Mobile, or Peripatetic) must be selected.');
  }

  if (!vendorData.age || Number(vendorData.age) < 14) {
    errors.push('Vendor must be at least 14 years of age as per statutory guidelines.');
  }

  // Check mandatory evidence
  STATUTORY_EVIDENCE_CHECKLIST.forEach(item => {
    if (item.mandatory && !submittedDocs.includes(item.code)) {
      warnings.push(`Missing mandatory evidence: ${item.name}`);
    }
  });

  const surveyStatus = vendorData.hasSurveySlip ? 'SURVEYED_TVC' : 'UNSURVEYED_APPLICANT';
  const readyToSubmit = errors.length === 0 && warnings.length === 0;

  return {
    readyToSubmit,
    surveyStatus,
    errors,
    warnings,
    recommendations: generateStatutoryRecommendations(surveyStatus, vendorData)
  };
}

/**
 * Generates tailored statutory recommendations based on TVC survey status.
 * @param {string} surveyStatus 
 * @param {Object} vendorData 
 * @returns {Array<string>}
 */
function generateStatutoryRecommendations(surveyStatus, vendorData) {
  const recommendations = [];

  if (surveyStatus === 'UNSURVEYED_APPLICANT') {
    recommendations.push(
      'Apply to Town Vending Committee (TVC) for interim vending permit or Letter of Recommendation (LoR) under Section 3(3) of the 2014 Act.',
      'Request Ward Vending Committee inclusion in the upcoming natural market cycle survey.'
    );
  } else {
    recommendations.push(
      'Submit Form-A to TVC secretariat along with your survey token for Certificate of Vending (CoV) issuance.',
      'Verify that your designated spot falls in a notified Vending Zone and not in an exclusion corridor.'
    );
  }

  if (vendorData.interestedInLoan) {
    recommendations.push(
      'Once CoV or LoR is issued, you can apply for the PM SVANidhi collateral-free loan at any participating bank branch or CSC centre.'
    );
  }

  return recommendations;
}

/**
 * Builds a structured checklist and process guide for local municipal submission.
 * @param {Object} params 
 * @returns {Object} processGuide
 */
export function buildStreetVendorApplicationGuide(params = {}) {
  const { municipality = 'Local Municipal Corporation', category = 'stationary', zoneType = 'vending_zone' } = params;

  const resolvedCategory = Object.values(VENDING_CATEGORIES).find(
    c => c.id.toLowerCase() === category.toLowerCase()
  ) || VENDING_CATEGORIES.STATIONARY;

  const resolvedZone = Object.values(ZONE_TYPES).find(
    z => z.id.toLowerCase() === zoneType.toLowerCase()
  ) || ZONE_TYPES.VENDING;

  return {
    authority: municipality,
    statutoryFramework: 'Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014',
    categoryDetails: resolvedCategory,
    zoneDetails: resolvedZone,
    checklist: STATUTORY_EVIDENCE_CHECKLIST.map(doc => ({
      code: doc.code,
      title: doc.name,
      mandatory: doc.mandatory,
      notes: doc.guidance
    })),
    steps: [
      {
        stepNumber: 1,
        title: 'TVC Survey Verification & Inclusion',
        action: 'Confirm if your street vending site was recorded in the latest municipal natural market survey.'
      },
      {
        stepNumber: 2,
        title: 'Application for Certificate of Vending (CoV)',
        action: 'Submit prescribed Form-1 with identity, residence proof, and self-declaration affidavit to TVC.'
      },
      {
        stepNumber: 3,
        title: 'Site Demarcation & Identity Card Issuance',
        action: 'TVC inspects vending slot and issues CoV with embedded QR identity card within 30 days.'
      },
      {
        stepNumber: 4,
        title: 'Vending Zone Compliance & Fee Payment',
        action: 'Deposit monthly municipal vending maintenance fee and adhere to hygiene and waste management norms.'
      }
    ],
    protectionNotice: 'Section 3(3): No street vendor shall be evicted or relocated until the survey specified under sub-section (1) has been completed and a certificate of vending has been granted to all street vendors.'
  };
}

/**
 * Generates an exportable text summary of the vendor application readiness.
 * @param {Object} vendorData 
 * @returns {string} markdownSummary
 */
export function exportStreetVendorReadinessSummary(vendorData = {}) {
  const assessment = assessVendorReadiness(vendorData);
  const guide = buildStreetVendorApplicationGuide({
    municipality: vendorData.municipality,
    category: vendorData.category,
    zoneType: vendorData.zoneType
  });

  return [
    `# Street Vendor Certificate & Vending-Zone Application Summary`,
    `**Applicant Name:** ${vendorData.fullName || 'N/A'}`,
    `**Municipality:** ${vendorData.municipality || 'N/A'}`,
    `**Category:** ${guide.categoryDetails.label}`,
    `**Zone Designation:** ${guide.zoneDetails.label}`,
    `**TVC Survey Status:** ${assessment.surveyStatus}`,
    `**Readiness:** ${assessment.readyToSubmit ? 'READY FOR FILING' : 'ACTION REQUIRED'}`,
    ``,
    `## Statutory Legal Protections`,
    `> ${guide.protectionNotice}`,
    ``,
    `## Distinguishing Certificate of Vending vs PM SVANidhi`,
    `- **Certificate of Vending (CoV):** Legal right to vend under Street Vendors Act 2014 issued by TVC. Non-financial statutory permit.`,
    `- **PM SVANidhi Loan:** Working capital loan scheme (₹10k–₹50k) offered via banks. Requires CoV or LoR as prerequisite.`,
    ``,
    `## Recommended Next Steps`,
    ...assessment.recommendations.map(r => `- ${r}`),
    ...(assessment.warnings.length > 0 ? [``, `## Pending Document Evidences`, ...assessment.warnings.map(w => `- ${w}`)] : [])
  ].join('\n');
}
