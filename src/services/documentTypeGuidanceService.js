/**
 * Document-Type Guidance Service (#405)
 * 
 * Maps published service requirement names to clear explanations and examples
 * of document categories without accessing, parsing, uploading, or storing
 * any personal document files or contents.
 * 
 * Safety & Privacy Principles:
 * 1. Zero Document Ingestion: Operates strictly on requirement strings from the public catalogue.
 *    Never inspects, uploads, parses, or retains vault file bytes or personal user data.
 * 2. Rule vs. Example Separation: Clearly separates statutory acceptance rules from illustrative examples.
 * 3. Ambiguity Transparency: When a requirement is ambiguous or non-standard, explicitly advises
 *    citizens to confirm acceptable proofs with the department instead of guessing.
 * 4. Educational Guidance Only: Does not perform or claim automated identity verification.
 */

export const DOCUMENT_CATEGORIES = {
  IDENTITY_PROOF: {
    id: 'identity_proof',
    name: 'Proof of Identity (PoI)',
    description: 'Statutory government documents establishing that the applicant is the individual named in the application.',
    generalRule: 'Must contain full official legal name, photograph, and unique identifier issued by a competent government authority.',
    commonExamples: [
      'Aadhaar Card (UIDAI / masked e-Aadhaar)',
      'Voter ID Card (Election Commission EPIC)',
      'Passport (Government of India)',
      'PAN Card (Income Tax Department)',
      'Driving License (State Transport Authority)',
    ],
    commonPitfalls: [
      'Laminated unofficial copies without QR code or verification mark',
      'Name mismatch between primary identity proof and educational records',
      'Blurry or damaged card surface obscuring photo or date of birth',
    ],
  },

  ADDRESS_PROOF: {
    id: 'address_proof',
    name: 'Proof of Address / Residence (PoA)',
    description: 'Official records certifying that the applicant currently resides within the relevant administrative or municipal jurisdiction.',
    generalRule: 'The address on the document must exactly match the residential address declared in the civic application form.',
    commonExamples: [
      'Recent Electricity, Water, or Piped Gas Bill (less than 3 months old)',
      'Registered Rent Agreement / Lease Deed on non-judicial stamp paper',
      'Bank Passbook with photo, address, and recent official branch stamp',
      'Domicile or Residence Certificate issued by Revenue Authority (Tehsildar)',
      'Post Office Savings Account Statement',
    ],
    commonPitfalls: [
      'Utility bills in landlord or prior occupant name without registered rental agreement',
      'Utility bills older than the stated validity window (typically 90 days)',
      'Address format missing pin code, ward number, or landmark required by department',
    ],
  },

  INCOME_PROOF: {
    id: 'income_proof',
    name: 'Proof of Income / Economic Means',
    description: 'Financial or revenue documentation certifying annual or monthly household income for subsidy or scheme eligibility.',
    generalRule: 'Must be issued by an authorized revenue officer (Tehsildar/SDM) or official employer payroll within the current financial year.',
    commonExamples: [
      'Income Certificate issued by Revenue Authority (Tehsildar / Sub-Divisional Magistrate)',
      'Form 16 or Annual Tax Return (ITR-V) for the previous assessment year',
      'Salary Slip with authorized company stamp and employer PAN',
      'BPL Ration Card / Antyodaya Anna Yojana Card',
    ],
    commonPitfalls: [
      'Self-declarations on plain paper without statutory notary or revenue attestation',
      'Income certificates past their validity period (many states expire certificates after 1-3 years)',
      'Declaring gross income when the scheme specifically checks net family agricultural income',
    ],
  },

  AGE_PROOF: {
    id: 'age_proof',
    name: 'Proof of Age / Date of Birth (DoB)',
    description: 'Statutory birth or educational certification confirming the applicant meets age eligibility criteria.',
    generalRule: 'Must reflect the exact calendar date of birth registered with civil registration authorities.',
    commonExamples: [
      'Birth Certificate issued by Municipal Corporation / Registrar of Births and Deaths',
      'Class 10 (Matriculation) Board Certificate or Marksheet showing date of birth',
      'Passport with verified date of birth',
      'Medical Board Age Assessment Certificate (in absence of institutional records)',
    ],
    commonPitfalls: [
      'Horoscopes or unregistered birth affidavits that lack statutory legal recognition',
      'Discrepancies in birth year between school marksheets and Aadhaar records',
    ],
  },

  RELATIONSHIP_PROOF: {
    id: 'relationship_proof',
    name: 'Proof of Relationship / Family Linkage',
    description: 'Documentation proving parentage, marriage, or legal guardianship for dependent or family-linked welfare schemes.',
    generalRule: 'Must clearly link the names of both the applicant and the related relative/beneficiary.',
    commonExamples: [
      'Legally Registered Marriage Certificate from Registrar of Marriages',
      'Ration Card family roster listing head of household and all dependent members',
      'Court-ordered Legal Guardianship or Adoption Certificate',
      'Birth Certificate listing parent names',
    ],
    commonPitfalls: [
      'Unregistered religious ceremony certificates lacking municipal registration stamp',
      'Ration cards with spelling errors in dependent member surnames',
    ],
  },

  LAND_PROPERTY_PROOF: {
    id: 'land_property_proof',
    name: 'Land & Property Ownership Records',
    description: 'Revenue records establishing ownership, title, survey number, or agricultural holding.',
    generalRule: 'Must be a certified true copy (RoR) from the State Revenue Department or digital portal with valid digital signature.',
    commonExamples: [
      'Record of Rights (RoR) / Khasra-Khatauni / Patta copy',
      'Registered Sale Deed / Conveyance Deed',
      'Recent Land Revenue / Municipal Property Tax receipt',
      'Encumbrance Certificate (EC) issued by Sub-Registrar Office',
    ],
    commonPitfalls: [
      'Unmutated land records where the title is still registered under previous owner or ancestor',
      'Rough field maps (Khasra naksha) without official Patwari signature',
    ],
  },

  CASTE_COMMUNITY_PROOF: {
    id: 'caste_community_proof',
    name: 'Caste / Community / Tribe Certificate',
    description: 'Statutory reservation certificate issued by competent district magistrate or revenue authority.',
    generalRule: 'Must explicitly specify caste/tribe name, presidential order notification, and competent issuing authority.',
    commonExamples: [
      'SC / ST / OBC Certificate issued by SDM / District Collector',
      'Non-Creamy Layer (NCL) Certificate for the relevant financial year (for OBC)',
      'Economically Weaker Section (EWS) Certificate issued by designated authority',
    ],
    commonPitfalls: [
      'Using state-level OBC certificate for central government appointments without Central list endorsement',
      'Expired OBC Non-Creamy Layer certificate (financial year validity expired)',
    ],
  },

  DISABILITY_MEDICAL_PROOF: {
    id: 'disability_medical_proof',
    name: 'Disability & Medical Certification',
    description: 'Medical assessment certificate confirming nature and benchmark percentage of disability.',
    generalRule: 'Must state disability percentage (e.g. 40%+ for benchmark disability) and be signed by Chief Medical Officer (CMO).',
    commonExamples: [
      'Unique Disability ID (UDID) Card issued by Department of Empowerment of Persons with Disabilities',
      'Disability Assessment Certificate issued by District Medical Board / Civil Surgeon',
      'Institutional Medical Discharge Summary from government hospital',
    ],
    commonPitfalls: [
      'Temporary disability certificate that has expired without re-assessment',
      'Certificates issued by private unregistered clinics not recognized by social welfare departments',
    ],
  },

  EDUCATIONAL_PROOF: {
    id: 'educational_proof',
    name: 'Educational & Technical Qualifications',
    description: 'Academic diplomas, marksheets, and degree certificates establishing required qualification standards.',
    generalRule: 'Must be issued by a UGC/AICTE/State Board recognized university or educational institution.',
    commonExamples: [
      'High School (10th) / Intermediate (12th) Passing Certificate and Marksheet',
      'Bachelor’s / Master’s Degree Certificate or Provisional Degree',
      'Technical Trade Diploma / ITI Certificate',
    ],
    commonPitfalls: [
      'Degrees from unaccredited or derecognized institutions',
      'Internet marksheets without official college principal stamp or DigiLocker verification',
    ],
  },

  PHOTOGRAPH_BIOMETRIC: {
    id: 'photograph_biometric',
    name: 'Applicant Photograph & Biometrics',
    description: 'Standard photographic or biometric captures complying with departmental specification.',
    generalRule: 'Recent passport-sized colour photograph against a plain white/light background with neutral facial expression.',
    commonExamples: [
      'Standard passport size color photographs (usually 3.5 cm x 4.5 cm)',
      'Live photo & fingerprint biometric capture done in-person at Kendra / CSC',
    ],
    commonPitfalls: [
      'Photographs with dark sunglasses, caps, or side-angle poses',
      'Photos older than 6 months where appearance has drastically changed',
    ],
  },

  AFFIDAVIT_DECLARATION: {
    id: 'affidavit_declaration',
    name: 'Sworn Affidavit & Self-Declaration',
    description: 'Legal sworn statement executed on non-judicial stamp paper or prescribed self-declaration form.',
    generalRule: 'Must be printed on requisite denomination non-judicial stamp paper and notarized by a licensed public notary.',
    commonExamples: [
      'Notarized affidavit on ₹10 / ₹50 / ₹100 Non-Judicial Stamp Paper',
      'Self-declaration undertaking prescribed in the service application annexure',
    ],
    commonPitfalls: [
      'Missing notary seal, signature, or stamp vendor entry',
      'Submitting an unsigned draft template without legal execution',
    ],
  },
};

/**
 * Keyword and regex pattern matchers to classify published requirement strings
 */
const PATTERN_MAPPINGS = [
  {
    category: DOCUMENT_CATEGORIES.IDENTITY_PROOF,
    regex: /(aadhaar|uidai|voter|epic|passport|pan card|pan|driving licen[cs]e|identity card|id proof|photo id)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.ADDRESS_PROOF,
    regex: /(address|residence|domicile|utility bill|electricity bill|water bill|gas bill|ration card|rent agreement|tenant agreement)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.INCOME_PROOF,
    regex: /(income certificate|salary slip|form 16|itr|bpl card|antyodaya|economic means|wealth certificate)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.AGE_PROOF,
    regex: /(birth certificate|date of birth|dob proof|matriculation certificate|school leaving certificate|10th certificate)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.LAND_PROPERTY_PROOF,
    regex: /(khasra|khatauni|ror|record of rights|patta|land deed|property tax|registry|encumbrance|sale deed|land record)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.RELATIONSHIP_PROOF,
    regex: /(marriage certificate|paternity|maternity|guardianship|family roster|relationship certificate)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.CASTE_COMMUNITY_PROOF,
    regex: /(caste certificate|tribe certificate|sc certificate|st certificate|obc certificate|non-creamy|ews certificate)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.DISABILITY_MEDICAL_PROOF,
    regex: /(disability certificate|udid|medical board|handicapped|cmo certificate|medical certificate)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.EDUCATIONAL_PROOF,
    regex: /(degree|diploma|marksheet|matric|intermediate|graduation|iti certificate|educational qualification)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.PHOTOGRAPH_BIOMETRIC,
    regex: /(photograph|passport photo|passport size photo|biometric|photo of applicant)/i,
  },
  {
    category: DOCUMENT_CATEGORIES.AFFIDAVIT_DECLARATION,
    regex: /(affidavit|stamp paper|self-declaration|undertaking|notarized)/i,
  },
];

/**
 * Clean text string
 */
const clean = (val) => (typeof val === 'string' ? val.trim() : '');

/**
 * Analyze a single requirement label and produce structured guidance.
 * Zero document bytes or file contents are involved.
 */
export const getDocumentTypeGuidance = (requirementLabel = '') => {
  const label = clean(requirementLabel);
  if (!label) {
    return {
      label: '',
      isAmbiguous: true,
      category: null,
      explanation: 'No requirement specified in catalogue record.',
      officialRule: 'Please consult the relevant government department for official document checklists.',
      acceptableExamples: [],
      unacceptableExamples: [],
      confirmationNotice: 'Please verify with the issuing office directly.',
      privacyNotice: 'Zero Document Ingestion: Civic Help Setu never accesses or stores your personal file contents.',
    };
  }

  // Attempt to match against known pattern mappings
  const match = PATTERN_MAPPINGS.find(({ regex }) => regex.test(label));

  if (match) {
    const cat = match.category;
    return {
      label,
      isAmbiguous: false,
      category: cat.id,
      categoryName: cat.name,
      description: cat.description,
      officialRule: cat.generalRule,
      acceptableExamples: cat.commonExamples,
      unacceptableExamples: cat.commonPitfalls,
      confirmationNotice:
        'Always verify if original documents are required for physical verification during office appointments.',
      privacyNotice:
        'Zero Document Ingestion: This is informational guidance based on catalogue metadata. No document files or personal data are stored or processed.',
    };
  }

  // Requirement does not match standard canonical civic document categories (Ambiguous/Custom)
  return {
    label,
    isAmbiguous: true,
    category: 'custom_or_ambiguous',
    categoryName: 'Department-Specific or Ambiguous Requirement',
    description: `The requirement "${label}" appears to be specific to this service or is not listed in standard civil identity categories.`,
    officialRule:
      'Official Acceptance Rule: Acceptance criteria for this specific requirement are determined directly by the department authority.',
    acceptableExamples: [
      `Official documents specifically titled or referencing "${label}"`,
      'Written confirmation from the concerned administrative branch',
    ],
    unacceptableExamples: [
      'Generic or unrelated identity cards without matching reference',
      'Unsigned informal declarations',
    ],
    confirmationNotice:
      'Ambiguity Alert: Because this requirement name does not map to a standard national category, you must confirm accepted document types directly with the department before applying.',
    privacyNotice:
      'Zero Document Ingestion: This is informational guidance based on catalogue metadata. No document files or personal data are stored or processed.',
  };
};

/**
 * Produce a comprehensive guidance dossier for all requirements of a service
 */
export const getServiceDocumentGuidance = (service = {}) => {
  const serviceId = clean(service.id) || 'unknown_service';
  const serviceName = clean(service.name) || 'Civic Service';
  const documents = Array.isArray(service.documents) ? service.documents : [];

  const guidanceItems = documents.map((docLabel) => getDocumentTypeGuidance(docLabel));
  const totalCount = guidanceItems.length;
  const ambiguousCount = guidanceItems.filter((item) => item.isAmbiguous).length;
  const standardCount = totalCount - ambiguousCount;

  return {
    serviceId,
    serviceName,
    items: guidanceItems,
    totalCount,
    ambiguousCount,
    standardCount,
    hasAmbiguousRequirements: ambiguousCount > 0,
    guidanceGeneratedAt: new Date().toISOString(),
    privacyNotice:
      'Zero Document Ingestion Guarantee: Document-Type Guidance runs entirely locally using published service catalogue requirements. Civic Help Setu does NOT upload, scan, verify, or inspect your personal document contents or vault files.',
  };
};
