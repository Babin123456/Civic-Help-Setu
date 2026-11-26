/**
 * UP Caste, Income, and Residence Certificate Rejection-Reason Explainer Service
 * 
 * Supports citizens navigating revenue service rejections and objections under
 * e-District UP (edistrict.up.gov.in) and the UP Revenue Department (Revenue Code 2006).
 * 
 * Covers:
 * - Caste Certificate (Jati Praman Patra - SC/ST/OBC)
 * - Income Certificate (Aay Praman Patra)
 * - Residence / Domicile Certificate (Niwas Praman Patra)
 * 
 * Analyzes common administrative objection remarks by Lekhpal, Revenue Inspector (Kanoongo),
 * and Tehsildar, providing plain-language explanations, concrete documentary remedies,
 * and time-bound statutory appeal pathways under UP Janhit Guarantee Adhiniyam.
 */

export const UP_EDISTRICT_SERVICES = {
  CASTE_CERTIFICATE: {
    code: 'CASTE_CERTIFICATE',
    name: 'Caste Certificate (Jati Praman Patra)',
    issuingAuthority: 'Tehsildar / Sub-Divisional Magistrate (SDM)',
    fieldInquiryOfficer: 'Lekhpal & Revenue Inspector (RI)',
    statutoryDeliveryDays: 15,
    appealOfficerFirst: 'Sub-Divisional Magistrate (SDM)',
    appealOfficerSecond: 'District Magistrate (DM) / Additional District Magistrate (ADM)'
  },
  INCOME_CERTIFICATE: {
    code: 'INCOME_CERTIFICATE',
    name: 'Income Certificate (Aay Praman Patra)',
    issuingAuthority: 'Tehsildar',
    fieldInquiryOfficer: 'Lekhpal',
    statutoryDeliveryDays: 15,
    appealOfficerFirst: 'Sub-Divisional Magistrate (SDM)',
    appealOfficerSecond: 'District Magistrate (DM)'
  },
  DOMICILE_CERTIFICATE: {
    code: 'DOMICILE_CERTIFICATE',
    name: 'Domicile / Residence Certificate (Niwas Praman Patra)',
    issuingAuthority: 'Sub-Divisional Magistrate (SDM) / Tehsildar',
    fieldInquiryOfficer: 'Lekhpal / Revenue Inspector',
    statutoryDeliveryDays: 20,
    appealOfficerFirst: 'District Magistrate (DM)',
    appealOfficerSecond: 'Divisional Commissioner'
  }
};

export const COMMON_REJECTION_REASONS = [
  {
    code: 'LAND_REVENUE_RECORD_MISMATCH',
    patterns: ['khatauni mismatch', 'khatauni me naam nahi hai', 'bhoomi vivad', 'land record'],
    plainLanguageReason: 'Lekhpal noted that land ownership or agricultural holding in Khatauni (RoR) contradicts claimed household income or family tree.',
    remedySteps: [
      'Obtain an updated certified copy of Khatauni from Tehsil computer centre or bhulekh.up.gov.in.',
      'If land is undivided ancestral property (Shamilat), attach family tree affidavit (Virasat/Vanshavali) signed by Gram Pradhan or Councillor.',
      'Submit clarification to Tehsildar during office hours.'
    ]
  },
  {
    code: 'PATERNAL_LINEAGE_PROOF_MISSING',
    patterns: ['pita ke paksh ka praman nahi', 'father caste proof', 'paternal proof', 'pitrak'],
    plainLanguageReason: 'Caste in Uttar Pradesh is determined solely by paternal lineage. Documents showing mother\'s or husband\'s caste alone are legally insufficient.',
    remedySteps: [
      'Attach father\'s, paternal grandfather\'s, or real paternal uncle\'s official school transfer certificate (TC) or pre-existing Jati Praman Patra.',
      'Submit certified family pedigree (Shajra/Vanshavali) issued by Gram Panchayat / Nagar Palika.',
      'For married women, present maternal village lineage certificate confirming father\'s caste.'
    ]
  },
  {
    code: 'NON_RESIDENCE_OR_TEMPORARY_STAY',
    patterns: ['mool niwasi nahi', 'mauke par upastithi nahi', 'absent during inquiry', 'kirayedar'],
    plainLanguageReason: 'Lekhpal visited during field inquiry and recorded that applicant was not physically residing at the declared address or resides elsewhere.',
    remedySteps: [
      'Obtain verification certificate from Gram Pradhan or local Municipal Ward Councillor confirming 3+ years continuous residence.',
      'Attach supporting address proofs: Electricity bill, Voter ID, Ration card, or LPG connection receipt in applicant or parent\'s name.',
      'File an application before Tehsildar requesting a re-inquiry with advance phone intimation.'
    ]
  },
  {
    code: 'INCOMPLETE_OR_INCORRECT_AFFIDAVIT',
    patterns: ['shapath patra apurna', 'notary stamp missing', 'affidavit not valid', 'swaghosana'],
    plainLanguageReason: 'The mandatory self-declaration affidavit (Swaghoshit Shapath Patra) is missing notarization, court fee stamp, or has unchecked declaration checkboxes.',
    remedySteps: [
      'Download standard UP e-District self-declaration format (Swaghoshit Ghoshana Patra).',
      'Affix required ₹10 non-judicial e-stamp or court fee stamp with Advocate/Notary attestation.',
      'Upload high-resolution scanned copy (under 100 KB) in the re-application portal.'
    ]
  },
  {
    code: 'SALARY_SLIP_OR_ITR_DISCREPANCY',
    patterns: ['vetan praman patra', 'itr mismatch', 'aay adhik hai', 'income exceeds limit'],
    plainLanguageReason: 'Declared agricultural or informal income conflicts with formal sector salary records, IT returns, or employer statements found during scrutiny.',
    remedySteps: [
      'Submit the most recent 3 months payslips, Form 16, or Income Tax Return acknowledgment.',
      'For agricultural households, attach Lekhpal fasal (crop) assessment statement indicating net family land yield.',
      'Provide sworn statement explaining household dependents and gross income components.'
    ]
  }
];

/**
 * Analyzes rejection remark text from e-District portal and returns actionable diagnosis.
 * @param {string} serviceCode 
 * @param {string} rawRemarkText 
 * @returns {Object} rejection explanation
 */
export function explainCertificateRejection(serviceCode, rawRemarkText = '') {
  const service = UP_EDISTRICT_SERVICES[serviceCode] || {
    name: 'Revenue Certificate',
    statutoryDeliveryDays: 15,
    appealOfficerFirst: 'Sub-Divisional Magistrate (SDM)'
  };

  const normalized = String(rawRemarkText).toLowerCase();
  let matchedReason = COMMON_REJECTION_REASONS.find(reason =>
    reason.patterns.some(pattern => normalized.includes(pattern))
  );

  if (!matchedReason) {
    matchedReason = {
      code: 'GENERAL_DOCUMENTARY_DEFICIENCY',
      plainLanguageReason: 'Application was rejected due to an unspecified field inquiry report or incomplete evidentiary supporting files.',
      remedySteps: [
        'Visit the concerned Tehsil Revenue Registry (Lekhpal Record Room) to obtain a physical copy of the Lekhpal inquiry report (Aakhiya).',
        'Address specific observations noted by Lekhpal and attach countersigned supporting proofs.',
        'Re-apply on edistrict.up.gov.in quoting prior Application Number or file a statutory first appeal.'
      ]
    };
  }

  return {
    serviceName: service.name,
    rawRemarkText: rawRemarkText || 'No official remark text provided.',
    identifiedCode: matchedReason.code,
    plainLanguageReason: matchedReason.plainLanguageReason,
    remedySteps: matchedReason.remedySteps,
    appealPathway: {
      statutoryDeliveryDays: service.statutoryDeliveryDays,
      firstAppellateAuthority: service.appealOfficerFirst,
      secondAppellateAuthority: service.appealOfficerSecond,
      legalAct: 'UP Right to Public Services Act (Janhit Guarantee Adhiniyam, 2011)',
      appealWindowDays: 30
    }
  };
}

/**
 * Generates formal First Appeal draft representation under UP Janhit Guarantee Adhiniyam.
 * @param {Object} details 
 * @returns {string} markdown appeal document
 */
export function generateCertificateAppealDraft(details = {}) {
  return [
    `# Memorandum of First Appeal under Section 5(1) of UP Janhit Guarantee Adhiniyam, 2011`,
    ``,
    `**To:** The First Appellate Authority / Sub-Divisional Magistrate (SDM)`,
    `**Tehsil:** ${details.tehsil || 'Concerned Tehsil'}, **District:** ${details.district || 'Uttar Pradesh'}`,
    ``,
    `**Subject:** Appeal against arbitrary rejection/delay of application for ${details.serviceName || 'Revenue Certificate'}`,
    `**Application Number:** \`${details.maskedApplicationNumber || 'EDIST-UP-****-XXXX'}\``,
    `**Date of Rejection / Inquiry:** ${details.rejectionDate || 'As per e-District portal'}`,
    ``,
    `### Grounds of Appeal:`,
    `1. The Appellant applied for ${details.serviceName} through the e-District UP portal with all prescribed initial enclosures.`,
    `2. The application was rejected with the following official remark: *"${details.rawRemarkText || 'Report adverse'}"*.`,
    `3. **Clarification by Appellant:** ${details.appellantClarification || 'The objection raised is erroneous as appellant satisfies all eligibility criteria and possesses necessary documentary evidence.'}`,
    `4. The Appellant has compiled the necessary documentary rebuttal as advised under the Citizen Redressal Framework:`,
    ...(details.remedySteps?.length > 0 ? details.remedySteps.map(s => `   - ${s}`) : ['   - Attached supporting verified revenue documents.']),
    ``,
    `### Prayer:`,
    `It is respectfully prayed that this Appellate Authority may direct a physical re-inquiry by an independent Naib Tehsildar / Revenue Inspector and issue the requested ${details.serviceName} in accordance with prescribed public service delivery deadlines.`,
    ``,
    `**Appellant Name (Masked):** ${details.applicantName || 'Citizen Applicant'}`,
    `**Date:** ${new Date().toLocaleDateString('en-IN')}`,
    `**Place:** ${details.district || 'Uttar Pradesh'}`
  ].join('\n');
}


export const UP_TEHSIL_DIWAS_GUIDELINES = [
  {
    step: 1,
    title: 'Attend Sampoorna Samadhan Diwas (Tehsil Diwas)',
    timing: '1st and 3rd Tuesday of every month from 10:00 AM to 2:00 PM',
    attendees: 'District Magistrate (DM), Senior Superintendent of Police (SSP), SDM, Tehsildar, and all district department heads.',
    advice: 'Bring original rejected application acknowledgment, photo ID, and two copies of the representation.'
  },
  {
    step: 2,
    title: 'Obtain Inward Diary Receipt',
    advice: 'Ensure the computer registration counter enters your grievance into the IGRS portal and issues a physical barcode slip.'
  },
  {
    step: 3,
    title: 'Time-bound Tracking & Re-Inquiry',
    advice: 'SDM typically marks the application for re-inquiry by a different Lekhpal or Naib Tehsildar with a 7-day disposal timeline.'
  }
];

export const UP_CERTIFICATE_DOCUMENT_CHECKLISTS = {
  CASTE: [
    'Self-attested copy of Aadhaar card',
    'Self-declaration affidavit (Swaghoshit Ghoshana Patra)',
    'Paternal lineage proof (Father/Grandfather Jati Praman Patra or land deed)',
    'Gram Pradhan or Municipal Councillor verification letter',
    'Passport-size photograph (scanned < 50 KB)'
  ],
  INCOME: [
    'Self-declaration of family income',
    'Certified Khatauni extract (if owning agricultural land)',
    'Salary slip / Form 16 / Bank statement (for salaried applicants)',
    'Rent agreement or electricity bill copy',
    'Passport-size photograph'
  ],
  DOMICILE: [
    'Proof of 3+ years residence in Uttar Pradesh',
    'Electricity bill / Water bill / Gas connection in self or parent\'s name',
    'High school marksheet / Transfer certificate showing education in UP',
    'Voter identity card / Ration card',
    'Self-declaration affidavit'
  ]
};

/**
 * Returns document checklist required for specified certificate type.
 * @param {'CASTE'|'INCOME'|'DOMICILE'} certType 
 * @returns {Array<string>} checklist items
 */
export function getCertificateDocumentChecklist(certType) {
  return UP_CERTIFICATE_DOCUMENT_CHECKLISTS[certType] || [];
}


export const UP_CERTIFICATE_FREQUENT_FAQS = [
  {
    q: 'Can a married woman apply for a caste certificate in her husband’s tehsil?',
    a: 'Under UP revenue rules, a married woman must establish her caste according to her father’s residence and lineage. She can apply online but must attach father\'s paternal documents.'
  },
  {
    q: 'What is the validity period of an Income Certificate in UP?',
    a: 'An Income Certificate issued through e-District UP is legally valid for a period of 3 years from the date of issue.'
  },
  {
    q: 'How long does a Domicile Certificate remain valid?',
    a: 'A Domicile Certificate in UP does not have an expiry date unless specifically superseded or cancelled by a competent revenue authority.'
  },
  {
    q: 'Is an affidavit mandatory for all e-District certificate services?',
    a: 'Yes, a self-declaration affidavit (Swaghoshit Ghoshana Patra) in the prescribed government format is a statutory mandatory attachment.'
  }
];

/**
 * Returns UP certificate FAQs.
 * @returns {Array<{q: string, a: string}>}
 */
export function getCertificateFaqs() {
  return UP_CERTIFICATE_FREQUENT_FAQS;
}
