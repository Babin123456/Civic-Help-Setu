/**
 * Civic Application Form Field Guidance Mode Service (#403)
 * 
 * Provides field-by-field explanations for official civic and government application forms.
 * 
 * Safety & Privacy Principles:
 * 1. Educational Explanations Only: Explains field meanings, formats, and where to find documents
 *    WITHOUT inventing, synthesizing, or autofilling personal answers.
 * 2. Official Sourcing: Identifies information that must be confirmed directly from official instructions.
 * 3. No External Submission: Explicitly clarifies that the tool does not integrate with,
 *    fill, or submit external government forms.
 * 4. Zero Data Transmission: Operates entirely locally. Never requires or transmits sensitive personal numbers.
 */

export const STANDARD_FIELD_REGISTRY = {
  // --- IDENTIFICATION ---
  aadhaar_number: {
    id: 'aadhaar_number',
    labels: ['aadhaar', 'aadhaar number', 'uid', 'unique identity number', 'aadhaar card no'],
    meaning: 'The 12-digit Unique Identification Number issued by the Unique Identification Authority of India (UIDAI).',
    whereToFind: 'Printed prominently on the front of your plastic/laminated Aadhaar card, e-Aadhaar PDF, or mAadhaar app.',
    formatRule: '12 numeric digits without spaces or dashes (e.g. 123456789012).',
    pitfalls: 'Ensure your mobile number linked to Aadhaar is active if the service requires OTP authentication.',
    requiresOfficialConfirmation: false,
    sensitivityWarning: 'Never share OTPs or biometric credentials. Enter this only on authorized .gov.in or .nic.in portals.',
  },
  pan_number: {
    id: 'pan_number',
    labels: ['pan', 'pan number', 'permanent account number', 'pan card no'],
    meaning: 'A 10-digit alphanumeric code issued by the Income Tax Department of India for taxpayer identification.',
    whereToFind: 'Printed on the face of your laminated PAN card or e-PAN certificate directly beneath your name.',
    formatRule: '10 characters: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F). 4th letter signifies taxpayer status (e.g. P for Person).',
    pitfalls: 'Name on the application must match the exact spelling printed on the PAN card.',
    requiresOfficialConfirmation: false,
  },
  voter_id: {
    id: 'voter_id',
    labels: ['voter id', 'epic number', 'electors photo identity card', 'voter card no'],
    meaning: 'The unique alphanumeric identifier issued by the Election Commission of India (ECI) for registered voters.',
    whereToFind: 'Printed horizontally at the top of your EPIC / Voter ID card or downloadable from the National Voters Service Portal (voters.eci.gov.in).',
    formatRule: 'Typically 3 uppercase letters followed by 7 digits (e.g., ABC1234567).',
    pitfalls: 'If recently relocated, check whether your EPIC number is assigned to the current assembly constituency.',
    requiresOfficialConfirmation: false,
  },

  // --- RESIDENCY & JURISDICTION ---
  pincode: {
    id: 'pincode',
    labels: ['pincode', 'pin code', 'postal code', 'zip code'],
    meaning: 'The 6-digit Postal Index Number code designating your local post office delivery jurisdiction.',
    whereToFind: 'On electricity bills, Aadhaar card back face, water utility receipts, or postal mail envelopes.',
    formatRule: 'Exactly 6 numeric digits (e.g., 560001).',
    pitfalls: 'Do not enter the pincode of your office or temporary address if the scheme is domicile-restricted.',
    requiresOfficialConfirmation: false,
  },
  khasra_khatauni: {
    id: 'khasra_khatauni',
    labels: ['khasra', 'khatauni', 'khasra number', 'dag number', 'patta number', 'survey number', 'rtc'],
    meaning: 'Specific land survey parcel and landholding record numbers maintained in state land revenue registries (e.g. Bhulekh, RTC, Patta).',
    whereToFind: 'Found on your computerized Record of Rights (RoR), Jamabandi copy, or state revenue portal certificate.',
    formatRule: 'Varies by state: may be single numbers, slash-separated sub-plots (e.g. 142/1), or hyphenated survey codes.',
    pitfalls: 'Ensure you enter the survey number of the cultivable land registered under the applicant’s name, not ancestral undivided land unless joint holding is allowed.',
    requiresOfficialConfirmation: true,
  },
  domicile_cert_no: {
    id: 'domicile_cert_no',
    labels: ['domicile certificate', 'residence certificate number', 'nativity certificate no', 'mul niwas'],
    meaning: 'The official certificate serial number issued by the local Tehsildar, Revenue Inspector, or Sub-Divisional Magistrate proving residence in the state.',
    whereToFind: 'Printed at the top-left or top-right corner of the state-issued digital revenue certificate, often with a QR code or barcode.',
    formatRule: 'Alphanumeric application/acknowledgment code defined by the state portal (e.g. RD00384729182).',
    pitfalls: 'Check the validity period: some states require domicile certificates issued within the past 1 to 3 years.',
    requiresOfficialConfirmation: true,
  },

  // --- FINANCIAL & BANKING ---
  bank_ifsc: {
    id: 'bank_ifsc',
    labels: ['ifsc', 'ifsc code', 'bank ifsc', 'branch code', 'rtgs code'],
    meaning: 'Indian Financial System Code: An 11-character alphanumeric code identifying your specific bank and branch for electronic funds transfer (NEFT/RTGS/IMPS/DBT).',
    whereToFind: 'Printed clearly on the first page of your bank passbook, on the face of personalized cheque leaves, or on your bank’s mobile app.',
    formatRule: '11 characters: 4 letters (bank code) + 0 (fifth character is always zero) + 6 characters (branch code). E.g., SBIN0001234.',
    pitfalls: 'Fifth character is the number zero "0", NOT the letter "O". If your bank recently merged (e.g. Syndicate into Canara), use the updated IFSC.',
    requiresOfficialConfirmation: false,
  },
  bank_account_number: {
    id: 'bank_account_number',
    labels: ['bank account', 'account number', 'savings account no', 'dbt account'],
    meaning: 'The unique savings bank account number where government direct benefit transfer (DBT) subsidies or grants will be credited.',
    whereToFind: 'Printed on the front page of your bank passbook or monthly account statement.',
    formatRule: '9 to 18 numeric digits, depending on the banking institution.',
    pitfalls: 'Account MUST be linked to your Aadhaar (Aadhaar seeding / NPCI mapping) to receive central DBT payments.',
    requiresOfficialConfirmation: false,
  },
  annual_income: {
    id: 'annual_income',
    labels: ['annual income', 'family income', 'household income', 'gross income'],
    meaning: 'The combined gross annual earnings of all earning members of your household from all sources (agriculture, salary, business, pensions).',
    whereToFind: 'Must match the figure stated on your officially issued Revenue Income Certificate or Form 16 / ITR acknowledgment.',
    formatRule: 'Numeric currency value in Indian Rupees (INR) per annum (e.g. 120000 for ₹1,20,000).',
    pitfalls: 'Do not enter monthly income. Enter annual aggregate. Ensure it does not exceed the scheme’s statutory income ceiling.',
    requiresOfficialConfirmation: true,
  },

  // --- SOCIAL & WELFARE CATEGORIES ---
  ration_card_number: {
    id: 'ration_card_number',
    labels: ['ration card', 'ration card number', 'nfsa card no', 'rc no', 'bpl card number', 'aay card'],
    meaning: 'The unique household food security card number issued by the state Food and Civil Supplies Department.',
    whereToFind: 'Printed on the front cover of your physical ration card booklet or downloadable as an e-Ration slip from the state Food portal.',
    formatRule: 'Typically 10 to 12 digits, prefixed by state initials in some portals.',
    pitfalls: 'Applicant’s name must be listed as a family member on the card; verify whether the scheme specifies BPL, AAY, or Priority Household (PHH).',
    requiresOfficialConfirmation: true,
  },
  caste_certificate_no: {
    id: 'caste_certificate_no',
    labels: ['caste certificate', 'category certificate no', 'sc st certificate', 'obc certificate number'],
    meaning: 'The official certificate number proving reservation category eligibility (SC, ST, OBC, SEBC, or EWS).',
    whereToFind: 'Found on the digital revenue certificate issued by the competent district magistrate, sub-collector, or tehsildar.',
    formatRule: 'Alphanumeric certificate identification number issued by the state revenue or e-District portal.',
    pitfalls: 'Central government schemes require Central OBC format certificates with non-creamy layer (NCL) status issued in the current financial year.',
    requiresOfficialConfirmation: true,
  },
  udid_number: {
    id: 'udid_number',
    labels: ['udid', 'udid number', 'disability certificate no', 'swavlamban card'],
    meaning: 'Unique Disability ID issued under the Department of Empowerment of Persons with Disabilities (DEPwD) Swavlamban scheme.',
    whereToFind: 'Printed on the plastic Swavlamban UDID card or top-right corner of the disability medical assessment certificate.',
    formatRule: '18 alphanumeric characters (e.g. MH1234520201234567).',
    pitfalls: 'Check the certified percentage of disability (many schemes require benchmark disability >= 40%).',
    requiresOfficialConfirmation: true,
  },
};

/**
 * Normalize and tokenize field labels
 */
export const normalizeFieldLabel = (label) => {
  if (!label || typeof label !== 'string') return '';
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Match a raw field label to the standard civic field registry
 */
export const matchFieldToRegistry = (rawLabel) => {
  const norm = normalizeFieldLabel(rawLabel);
  if (!norm) return null;

  for (const field of Object.values(STANDARD_FIELD_REGISTRY)) {
    for (const label of field.labels) {
      if (norm === label || norm.includes(label) || label.includes(norm)) {
        return field;
      }
    }
  }

  return null;
};

/**
 * Generate field guidance given a field name/label and optional service context
 */
export const getFormFieldGuidance = (rawLabel, service = null) => {
  if (!rawLabel || typeof rawLabel !== 'string' || !rawLabel.trim()) {
    return {
      fieldLabel: 'Unknown Field',
      isRecognized: false,
      meaning: 'Please select or enter a valid application form field label to view guidance.',
      whereToFind: 'Refer to the printed instructions on the official application form.',
      formatRule: 'Follow the format instructions provided on the portal.',
      pitfalls: 'Never guess answers. Consult the official counter if confused.',
      requiresOfficialConfirmation: true,
      officialNotice: 'This is educational guidance only. Civic Help Setu does not submit forms or verify personal documents.',
    };
  }

  const matched = matchFieldToRegistry(rawLabel);
  const serviceTitle = service?.title || service?.name || 'Civic Service';

  if (matched) {
    return {
      fieldLabel: rawLabel.trim(),
      standardId: matched.id,
      isRecognized: true,
      meaning: matched.meaning,
      whereToFind: matched.whereToFind,
      formatRule: matched.formatRule,
      pitfalls: matched.pitfalls,
      requiresOfficialConfirmation: matched.requiresOfficialConfirmation,
      sensitivityWarning: matched.sensitivityWarning || null,
      serviceContext: serviceTitle,
      officialNotice:
        'Educational Guidance Only: Civic Help Setu provides explanatory guidance and never autofills or submits applications to external government servers.',
    };
  }

  // Fallback for unknown / service-specific ambiguous fields
  return {
    fieldLabel: rawLabel.trim(),
    standardId: 'custom_field',
    isRecognized: false,
    meaning: `The field "${rawLabel.trim()}" is specific to this department's procedure and cannot be automatically verified from standard templates.`,
    whereToFind: `Check the official application brochure or guidelines for ${serviceTitle}.`,
    formatRule: 'Follow the specific input pattern prescribed on the government portal.',
    pitfalls: 'Do not enter estimated or assumed values. If uncertain, obtain clarification from the official helpline.',
    requiresOfficialConfirmation: true,
    officialNotice:
      'Unrecognized Field Notice: Guidance is generated from generic civic guidelines. Confirm requirements directly from official department instructions.',
  };
};

/**
 * Extract known and candidate form fields from a service object's requirements and process steps
 */
export const extractCandidateFieldsFromService = (service) => {
  if (!service || typeof service !== 'object') return [];

  const candidates = new Set();

  // Add standard fields that match documents
  const docs = Array.isArray(service.documents) ? service.documents : [];
  docs.forEach((doc) => {
    if (/aadhaar/i.test(doc)) candidates.add('Aadhaar Number');
    if (/pan/i.test(doc)) candidates.add('PAN Number');
    if (/voter|epic/i.test(doc)) candidates.add('Voter ID (EPIC)');
    if (/ration/i.test(doc)) candidates.add('Ration Card Number');
    if (/income/i.test(doc)) candidates.add('Annual Family Income');
    if (/caste|community/i.test(doc)) candidates.add('Caste Certificate Number');
    if (/domicile|residence/i.test(doc)) candidates.add('Domicile Certificate Number');
    if (/bank|passbook/i.test(doc)) {
      candidates.add('Bank Account Number');
      candidates.add('Bank IFSC Code');
    }
    if (/land|khasra|patta/i.test(doc)) candidates.add('Khasra / Khatauni Survey Number');
    if (/disability|udid/i.test(doc)) candidates.add('UDID / Disability Certificate Number');
  });

  // Always include standard universal fields
  candidates.add('Pincode & Address');

  return Array.from(candidates);
};
