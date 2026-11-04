/**
 * rejectionNoticeExplainerService.js
 *
 * Translates terse, legalistic, or bureaucratic government rejection and
 * deficiency notices into plain-language explanations with actionable next steps,
 * statutory re-submission/appeal deadlines, and catalogue requirement links.
 */

export const REJECTION_CATEGORIES = {
  ANNEXURE_DEFICIENCY: 'ANNEXURE_DEFICIENCY',
  DEMOGRAPHIC_MISMATCH: 'DEMOGRAPHIC_MISMATCH',
  EXPIRED_DOCUMENT: 'EXPIRED_DOCUMENT',
  ATTESTATION_OR_SIGNATURE: 'ATTESTATION_OR_SIGNATURE',
  JURISDICTION_MISMATCH: 'JURISDICTION_MISMATCH',
  FEE_DEFICIT: 'FEE_DEFICIT',
  PHOTO_BIOMETRICS: 'PHOTO_BIOMETRICS',
  UNKNOWN_FALLBACK: 'UNKNOWN_FALLBACK',
};

/**
 * Standard dictionary of rejection pattern rules.
 */
const PATTERN_RULES = [
  {
    category: REJECTION_CATEGORIES.ATTESTATION_OR_SIGNATURE,
    regex: /unattested|signature\s+missing|missing\s+signature|unsigned|notary\s+seal|self-attestation|gazetted\s+attestation/i,
    title: 'Missing Signature or Invalid Attestation',
    plainLanguageExplanation:
      'One or more uploaded document photocopies were submitted without your signature, or lacked the required gazetted officer / notary stamp.',
    statutoryDeadline: 'Rectify within 14 days of the deficiency communication.',
    remediationSteps: [
      'Print clean photocopies of all attached supporting documents.',
      'Sign across the lower half of each page with the text: "Self-Attested by [Your Name]" and the current date.',
      'If the service rules require Gazetted Officer attestation, take the physical papers to a local government school principal, doctor, or Tehsildar.',
      'Scan the signed documents at 200 DPI resolution and re-upload.',
    ],
  },
  {
    category: REJECTION_CATEGORIES.EXPIRED_DOCUMENT,
    regex: /expired\s+validity|validity\s+expired|outdated\s+certificate|financial\s+year\s+invalid|valid\s+only\s+for|non-current\s+proof|income\s+certificate\s+expired|has\s+expired\s+validity|certificate.*expired|expired.*certificate/i,
    title: 'Expired or Outdated Validity Certificate',
    plainLanguageExplanation:
      'A mandatory proof document you attached (such as an Income, EWS, or Non-Creamy Layer certificate) has crossed its validity date and is no longer recognized for this financial year.',
    statutoryDeadline: 'Most state revenue departments require current-year renewal within 21 days of notice.',
    remediationSteps: [
      'Check the issue date and statutory validity stamp on your current certificate.',
      'Income certificates in most states are valid only for 1 to 3 financial years.',
      'Apply online for a renewed certificate from your local Tehsildar or revenue portal.',
      'Once the new certificate number is generated, upload the renewed copy to cure the deficiency.',
    ],
  },
  {
    category: REJECTION_CATEGORIES.DEMOGRAPHIC_MISMATCH,
    regex: /name\s+mismatch|disparity\s+in\s+name|father('s)?\s+name\s+differ|dob\s+inconsisten|spelling\s+variation|demographic\s+mismatch/i,
    title: 'Mismatched Personal Details Across Identity Documents',
    plainLanguageExplanation:
      'The name, date of birth, or parent name written in your application does not match the exact spelling printed on your Aadhaar, school certificate, or supporting proof.',
    statutoryDeadline: 'Objections must be rectified within 30 days before the file is marked permanently closed.',
    remediationSteps: [
      'Compare your application line-by-line with your primary proof (e.g. 10th Class Marks Sheet or Aadhaar).',
      'If the spelling error is minor (e.g. expanded initials or phonetic variation), obtain a "One and the Same Person" notary affidavit.',
      'If the error is in your government ID, apply for an Aadhaar/PAN demographic update first before re-submitting.',
      'Submit the correction explanation letter along with both original identity documents.',
    ],
  },
  {
    category: REJECTION_CATEGORIES.ANNEXURE_DEFICIENCY,
    regex: /annexure\s+[a-z0-9]+|schedule\s+[a-z0-9]+|form\s+\d+\s+incomplete|affidavit\s+deficien|incomplete\s+annexure/i,
    title: 'Missing or Incomplete Supporting Annexure / Form',
    plainLanguageExplanation:
      'The issuing authority rejected or halted your application because an attached declaration form or statutory annexure was left blank, incomplete, or missing entirely.',
    statutoryDeadline: 'Standard statutory correction window is 15 to 30 days from date of notice under Public Service Guarantee acts.',
    remediationSteps: [
      'Download the specific Annexure or Schedule form mentioned in the notice from the official portal.',
      'Fill in all mandatory sections, ensuring no required fields (such as family details or property schedule) are left blank.',
      'If an affidavit is required, get it printed on non-judicial stamp paper of prescribed denomination and notarized.',
      'Re-upload the rectified annexure through the portal cure section or submit physical copies to the dealing counter.',
    ],
  },
  {
    category: REJECTION_CATEGORIES.JURISDICTION_MISMATCH,
    regex: /jurisdiction\s+mismatch|wrong\s+office|out\s+of\s+jurisdiction|transferred\s+to\s+circle|not\s+within\s+territorial\s+limits/i,
    title: 'Application Submitted to Wrong Local Office or Jurisdiction',
    plainLanguageExplanation:
      'The administrative office, municipal ward, or Tehsildar circle you selected does not cover your residential pin code or territorial boundary.',
    statutoryDeadline: 'Transfer or fresh submission should be initiated immediately.',
    remediationSteps: [
      'Locate your exact local municipal ward, police station, or revenue circle using your electricity bill address.',
      'Check if the portal provides an "Application Transfer" option to route the file to the correct sub-registrar/ward.',
      'If transfer is not supported, request cancellation/refund of challan and re-apply under the appropriate jurisdictional office.',
    ],
  },
  {
    category: REJECTION_CATEGORIES.FEE_DEFICIT,
    regex: /fee\s+deficit|short\s+payment|challan\s+reconciliation|payment\s+mismatch|court\s+fee\s+short|grn\s+failed/i,
    title: 'Short Payment or Unreconciled Government Fee Challan',
    plainLanguageExplanation:
      'The government fees deposited did not match the latest statutory schedule, or your online bank challan transaction was not credited to the treasury head.',
    statutoryDeadline: 'Deficit payment must be settled within 10 to 15 days.',
    remediationSteps: [
      'Check the payment receipt or GRN (Government Reference Number) from your net banking statement.',
      'Verify if supplementary fees (such as postal delivery or fast-track user charges) were left unpaid.',
      'Generate a supplementary challan on the state treasury portal for the exact deficit amount.',
      'Upload the supplementary payment receipt alongside the original e-challan.',
    ],
  },
  {
    category: REJECTION_CATEGORIES.PHOTO_BIOMETRICS,
    regex: /photo\s+rejected|biometric\s+failure|white\s+background|face\s+unclear|specifications\s+not\s+met|fingerprint\s+unmatched/i,
    title: 'Photograph or Biometric Specification Issue',
    plainLanguageExplanation:
      'Your uploaded photograph or captured biometrics do not meet mandatory statutory dimensions (e.g. 35mm x 45mm, white background) or image clarity standards.',
    statutoryDeadline: 'Upload replacement photo within 7 to 15 days.',
    remediationSteps: [
      'Take a fresh passport-style photograph with neutral facial expression against an even, plain white background.',
      'Ensure both ears are clearly visible with zero glare on spectacles or heavy facial shadows.',
      'Crop image to standard dimensions (3.5 cm width x 4.5 cm height) with file size under 100 KB.',
      'If biometric failure occurred at a kiosk, clean your fingers with mild soap before re-scanning.',
    ],
  },
];

/**
 * Curated realistic sample rejection notices for testing & citizen demonstration.
 */
export const SAMPLE_REJECTION_NOTICES = [
  {
    id: 'sample-passport-name',
    service: 'Passport Application',
    rawNotice:
      'Application halted at Verification Stage: Name mismatch detected between Aadhaar card (R. K. Sharma) and Class X matriculation certificate (Rajesh Kumar Sharma). Submit clarification.',
  },
  {
    id: 'sample-annexure-iv',
    service: 'Ration Card Food Security',
    rawNotice:
      'Deficiency observed in Annexure IV statutory income declaration. Field 4 (BPL status verification) left blank. File placed in objection queue.',
  },
  {
    id: 'sample-caste-expired',
    service: 'Caste Certificate / Non-Creamy Layer',
    rawNotice:
      'Rejected due to invalid validity: Parental annual income certificate attached has expired validity date (Issued 2021-22). Fresh financial year certificate required.',
  },
  {
    id: 'sample-fee-deficit',
    service: 'Birth Certificate Late Registration',
    rawNotice:
      'Court fee deficit of Rs. 50/- noted under Section 13(3) of RBD Act. E-Challan payment reconciliation failed for sub-head 0070.',
  },
];

/**
 * Explains an official government rejection or deficiency notice in plain language.
 *
 * @param {string} noticeText - Raw rejection reason text from government portal
 * @param {Object} [serviceContext] - Optional service metadata (serviceName, officialWebsite)
 * @returns {Object} Structured plain-language analysis and remediation guide
 */
export function explainRejectionNotice(noticeText = '', serviceContext = {}) {
  const safeText = String(noticeText || '').trim();

  if (!safeText) {
    return {
      isValid: false,
      reason: 'No rejection notice text provided for explanation.',
      explanation: null,
    };
  }

  // Find matching pattern
  const matchedRule = PATTERN_RULES.find((rule) => rule.regex.test(safeText));

  if (!matchedRule) {
    // Graceful fallback for cryptic or unrecognized notices
    return {
      isValid: true,
      category: REJECTION_CATEGORIES.UNKNOWN_FALLBACK,
      title: 'General Bureaucratic Objection or Document Query',
      plainLanguageExplanation:
        'The government department flagged an objection on your file, but the text uses non-standard departmental terminology. In most cases, this indicates an incomplete field, missing attachment, or unverified counter query.',
      statutoryDeadline:
        'Standard statutory review period is typically 15 to 30 days under citizen charter rules.',
      remediationSteps: [
        'Log in to the official service portal to download the complete PDF objection memo or defect list.',
        'Contact the public relations officer or call the citizen helpline of the issuing department.',
        'Keep your application reference number and original submission receipts ready.',
        'File an official clarification letter addressing the specific clerk remarks.',
      ],
      serviceName: serviceContext.name || 'Civic Service',
      officialWebsite: serviceContext.officialWebsite || serviceContext.portalUrl || null,
      disclaimer: getLegalDisclaimer(serviceContext),
    };
  }

  return {
    isValid: true,
    category: matchedRule.category,
    title: matchedRule.title,
    plainLanguageExplanation: matchedRule.plainLanguageExplanation,
    statutoryDeadline: matchedRule.statutoryDeadline,
    remediationSteps: matchedRule.remediationSteps,
    rawNotice: safeText,
    serviceName: serviceContext.name || 'Civic Service',
    officialWebsite: serviceContext.officialWebsite || serviceContext.portalUrl || null,
    disclaimer: getLegalDisclaimer(serviceContext),
  };
}

/**
 * Explains statutory appeal rights if rectification is rejected.
 */
export function getStatutoryAppealRights(serviceName = 'Public Service') {
  return {
    appellateTitle: 'First Appellate Authority (Right to Public Services Act)',
    description: `If your cured response is unfairly rejected or delayed beyond statutory limits, you have the legal right to file a First Appeal before the designated Appellate Officer within 30 days without court fees.`,
    groundsForAppeal: [
      'Arbitrary rejection despite supplying all documented catalogue requirements',
      'Failure of dealing officer to specify the deficiency within the citizen charter timeline',
      'Demand for unofficial documents not prescribed in official government rules',
    ],
  };
}

function getLegalDisclaimer(serviceContext) {
  const name = serviceContext?.name || 'the department';
  return `This plain-language explanation is generated for informational assistance to help you understand bureaucratic feedback. It does not replace the statutory order issued by ${name}. Always follow the instructions in the official rejection memo.`;
}
