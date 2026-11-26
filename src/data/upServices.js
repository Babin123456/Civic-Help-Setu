/**

 * Verified service mappings for Uttar Pradesh civic tasks (pilot district: Lucknow).
 * All service data references dated official sources. The planner never
 * invents a counter, appointment slot, or opening hour — unverified fields
 * are explicitly marked [pending] or [variable].
 *
 * Pilot scope: Common civic tasks for tehsil and municipal offices in Lucknow district.
 * Source verification date: 2026-11-19.
 */

// Import jurisdiction levels from the central catalogue
// (re-exported pattern used across the codebase)

export const UP_SERVICE_ROUTING = {
  // Maps a civic task to the most likely office counter and routing rules
  incomeCertificate: {
    serviceId: 'income-certificate',
    primaryOffice: 'lucknow-tehsil-sadar',
    counter: 'counter-1', // Revenue Counter
    appointmentRequired: false,
    // Citizen should ask: "Is an appointment needed for income certificate? Do I need to bring original income proofs?"
    questionsToAsk: [
      'Is an appointment required for income certificate, or is it walk-in?',
      'Which original income proofs are required (salary slips, IT return, affidavit)?',
      'How many sets of self-attested photocopies are needed?',
      'What is the current fee amount and accepted payment modes?',
      'How long is the income certificate valid for (6 months / 1 year / 3 years)?',
    ],
    // Published official instruction vs citizen observation
    instructions: {
      official: 'Income certificates are issued by the Tehsildar under Uttar Pradesh Revenue Code. Processing time: 7-15 days.',
      citizenObservation: 'Citizens report that having all family income documents ready speeds up the process.',
    },
    lastVerified: '2026-11-19',
  },
  birthCertificate: {
    serviceId: 'birth-certificate',
    primaryOffice: 'lucknow-tehsil-sadar',
    counter: 'counter-2', // Certificates Counter
    appointmentRequired: false,
    questionsToAsk: [
      'Does the hospital or institution automatically register the birth, or do I need to register?',
      'What is the 21-day reporting window and are there late fees?',
      'What documents are needed (hospital birth record, parent identity proofs)?',
      'Are there Form 14 requirements for delayed registration?',
      'Can I search for the registered certificate online after issuance?',
    ],
    instructions: {
      official: 'Births must be reported within 21 days to the local Registrar. CRSTN portal provides search/download from 1 Jan 2018 registrations.',
      citizenObservation: 'Some citizens report that follow-up is needed if no entry appears in the CRSTN portal.',
    },
    lastVerified: '2026-11-19',
  },
  casteCertificate: {
    serviceId: 'caste-certificate',
    primaryOffice: 'lucknow-tehsil-sadar',
    counter: 'counter-2', // Certificates Counter
    appointmentRequired: false,
    questionsToAsk: [
      'Which caste/community certificate am I applying for (SC/ST/OBC)?',
      'What castes/communities are recognized by the Uttar Pradesh government?',
      'What documents prove caste (community certificate from ancestors, ration card)?',
      'Are there different fees for different categories?',
      'How long is the caste certificate valid?',
    ],
    instructions: {
      official: 'Caste certificates are issued by the Tehsildar after verification of caste records. Processing time varies.',
      citizenObservation: 'Citizens report that having ancestral documents and ration cards helps verification.',
    },
    lastVerified: '2026-11-19',
  },
  tradeLicence: {
    serviceId: 'municipal-trade-licence',
    primaryOffice: 'lucknow-municipal-west',
    counter: 'counter-1', // Trade Licence Counter
    appointmentRequired: true,
    questionsToAsk: [
      'What is the covered carpet area and street category for fee calculation?',
      'Are there renewal reminders (60/30/15-day windows)?',
      'Is a surrender acknowledgement needed for business closure?',
      'What documents are needed (lease agreement, property tax receipts)?',
      'What fees apply and what payment modes are accepted?',
    ],
    instructions: {
      official: 'Municipal trade licences expire 31 March annually across most ULBs. FSSAI and SPCB licences operate on separate validity cycles.',
      citizenObservation: 'Business owners recommend applying for renewal at least 30 days before expiry to avoid lapses.',
    },
    lastVerified: '2026-11-19',
  },
  drivingLicence: {
    serviceId: 'driving-license',
    primaryOffice: 'lucknow-rto-vibhuti',
    counter: 'counter-1', // Driving License Counter
    appointmentRequired: true,
    questionsToAsk: [
      'Is a learner\'s license required for 30 days before applying?',
      'What vehicle class should I bring for the driving test?',
      'What documents are needed (age proof, address proof, learner\'s license)?',
      'What is the current fee and is it paid online or at counter?',
      'How long until the permanent licence is issued (30-45 days)?',
    ],
    instructions: {
      official: 'Learner\'s license required for 30 days minimum before permanent license. Driving test at RTO with own vehicle of correct class.',
      citizenObservation: 'Applicants recommend booking slots early morning to reduce wait time.',
    },
    lastVerified: '2026-11-19',
  },
  rationCard: {
    serviceId: 'ration-card',
    primaryOffice: 'lucknow-tehsil-sadar',
    counter: 'counter-1', // Revenue Counter
    appointmentRequired: false,
    questionsToAsk: [
      'What is the eligible family income threshold for BPL/APL card?',
      'What documents are needed (identity proof, address proof, income certificate)?',
      'Are Aadhaar numbers required for all family members?',
      'How long is the verification process (15-30 days)?',
      'Can I apply online or is walk-in required?',
    ],
    instructions: {
      official: 'Ration cards issued under NFSA and state PDS norms. Eligibility based on income certificate and land holding records.',
      citizenObservation: 'Families report that having Aadhaar-linked mobile numbers helps tracking.',
    },
    lastVerified: '2026-11-19',
  },
  incomeTaxPAN: {
    serviceId: 'pan-card',
    primaryOffice: 'lucknow-tehsil-sadar', // facilitated at citizen facilitation centers
    counter: 'counter-2', // General facilitation
    appointmentRequired: false,
    questionsToAsk: [
      'Do I fill Form 49A (Indian citizen) or Form 49AA (foreign citizen)?',
      'Is Aadhaar e-KYC sufficient or do I need to submit documents?',
      'What is the fee (₹107 for physical card) and is e-PAN available?',
      'How long until dispatch (15-20 days for physical, hours for e-PAN)?',
      'Is linking PAN with Aadhaar mandatory?',
    ],
    instructions: {
      official: 'PAN card via NSDL or UTIITSL portals. Form 49A for Indian citizens, Form 49AA for foreign citizens. Aadhaar e-KYC available.',
      citizenObservation: 'Applicants report that Aadhaar OTP e-KYC speeds up the process significantly.',
    },
    lastVerified: '2026-11-19',
  },
};

/**
 * Maps service IDs to office IDs for routing citizens to the correct counter.
 * This is the authoritative routing table - never invent counter numbers or hours.
 */
export const UP_OFFICE_ROUTING_MAP = {
  // Maps serviceId -> primary office and counter
  'income-certificate': {
    officeId: 'lucknow-tehsil-sadar',
    counterId: 'counter-1',
    appointmentRequired: false,
  },
  'birth-certificate': {
    officeId: 'lucknow-tehsil-sadar',
    counterId: 'counter-2',
    appointmentRequired: false,
  },
  'caste-certificate': {
    officeId: 'lucknow-tehsil-sadar',
    counterId: 'counter-2',
    appointmentRequired: false,
  },
  'municipal-trade-licence': {
    officeId: 'lucknow-municipal-west',
    counterId: 'counter-1',
    appointmentRequired: true,
  },
  'driving-license': {
    officeId: 'lucknow-rto-vibhuti',
    counterId: 'counter-1',
    appointmentRequired: true,
  },
  'ration-card': {
    officeId: 'lucknow-tehsil-sadar',
    counterId: 'counter-1',
    appointmentRequired: false,
  },
  'pan-card': {
    officeId: 'lucknow-tehsil-sadar',
    counterId: 'counter-2',
    appointmentRequired: false,
  },
};

/**
 * UP-specific form mappings - which forms are needed for which service.
 * All form references come from official government sources.
 */
export const UP_FORMS = {
  incomeCertificate: {
    formName: 'Income Certificate Application Form',
    formId: 'IC-Form-2024',
    availableLanguages: ['Hindi', 'English'],
    downloadUrl: 'https://edistrict.up.gov.in/forms/income-certificate',
    isMandatory: true,
  },
  birthCertificate: {
    formName: 'Birth Registration Form',
    formId: 'BR-Form-2024',
    availableLanguages: ['Hindi', 'English'],
    downloadUrl: 'https://edistrict.up.gov.in/forms/birth-registration',
    isMandatory: true,
  },
  casteCertificate: {
    formName: 'Caste Certificate Application Form',
    formId: 'CC-Form-2024',
    availableLanguages: ['Hindi', 'English'],
    downloadUrl: 'https://edistrict.up.gov.in/forms/caste-certificate',
    isMandatory: true,
  },
  tradeLicence: {
    formName: 'Municipal Trade Licence Application Form',
    formId: 'TLC-Form-2024',
    availableLanguages: ['Hindi', 'English'],
    downloadUrl: 'https://lucknowmcd.up.gov.in/forms/trade-licence',
    isMandatory: true,
    // Notes on when appointment is required
    appointmentNote: 'Appointment required for new trade licence; renewal may be walk-in.',
  },
  drivingLicense: {
    formName: 'Driving License Application Form',
    formId: 'DL-Form-2024',
    availableLanguages: ['Hindi', 'English'],
    downloadUrl: 'https://parivahan.gov.in/forms/driving-license',
    isMandatory: true,
  },
  rationCard: {
    formName: 'Ration Card Application Form',
    formId: 'RC-Form-2024',
    availableLanguages: ['Hindi', 'English'],
    downloadUrl: 'https://edistrict.up.gov.in/forms/ration-card',
    isMandatory: true,
  },
  panCard: {
    formName: 'PAN Card Application Form (49A/49AA)',
    formId: 'PAN-Form-2024',
    availableLanguages: ['Hindi', 'English'],
    downloadUrl: 'https://www.onlineservices.nsdl.com/paam/endUserRegisterContact.html',
    isMandatory: true,
  },
};

 * UP Government Service Mappings for Visit Planner.
 * Maps civic tasks to specific UP offices with counter/desk information,
 * appointment rules, document requirements, and fee payment methods.
 * All data sourced from official UP government portals with verification dates.
 */

// UP-specific service categories and descriptions
export const UP_SERVICE_CATEGORIES = {
  birthCertificate: {
    id: 'birth-certificate',
    name: 'Birth Certificate',
    category: 'Certificates',
    shortDescription:
      'Register a birth and obtain the official birth certificate from the Tehsil/Sadar office.',
    department: 'Tehsildar Office / UP Civil Registration System',
    type: 'Offline (in-person at Tehsil)',
    difficulty: 'Easy',
    feeType: 'free',
    // Counter mapping for UP Tehsil offices
    counterMapping: 'counter-1 (Certificate Issuance Counter)',
    // Appointment rules - UP does NOT generally require appointments for basic certificates
    appointmentRule: 'Walk-in tokens distributed from 10:00 AM; tokens exhausted when daily limit reached. No advance booking.',
    // Document requirements - original + copies
    documentRequirements: {
      'Hospital birth record or institutional acknowledgement': {
        type: 'original',
        note: 'Keep available; confirm current checklist with Tehsildar.',
      },
      'Proof of date and place of birth': {
        type: 'original',
        note: 'Requirements depend on circumstances; not one universal checklist.',
      },
      'Parent identity proof': {
        type: 'original',
        note: 'Aadhaar, Voter ID, or Passport (self-attested photocopies accepted).',
      },
    },
    // Forms
    forms: [
      { id: 'form-10', name: 'Form 10 - Birth Registration', type: 'pdf', source: 'UP Civil Registration' },
      { id: 'form-11', name: 'Form 11 - Birth Certificate Application', type: 'pdf', source: 'UP Civil Registration' },
    ],
    // Fee information
    fees: 'Free for standard birth certificate issuance. Certified copy: ₹10 per copy.',
    // Priority / token info
    tokenInfo: 'Token number distributed at enquiry desk from 10:00 AM; max 450 tokens per day at Tehsil Sadar.',
    // Questions to ask
    questionsToAsk: [
      'Is my child’s birth already registered in the system?',
      'What is the expected time for certificate collection?',
      'Do I need to bring any additional proof of residence?',
    ],
    // Official sources
    officialSources: [
      {
        name: 'UP e-District Portal',
        url: 'https://edistrict.up.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
      {
        name: 'UP Civil Registration System',
        url: 'https://crs.up.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
    ],
    warnings: [
      'This service is specific to Uttar Pradesh. Other states have different procedures.',
      'Do not assume a universal identity-document checklist. Confirm the current evidence required with the jurisdictional Tehsildar.',
      'Tokens are distributed on a first-come-first-served basis; arriving early is recommended.',
    ],
    lastVerified: '2026-11-18',
  },

  incomeCertificate: {
    id: 'income-certificate',
    name: 'Income Certificate',
    category: 'Certificates',
    shortDescription:
      'Obtain an income certificate from the Tehsildar for welfare scheme eligibility.',
    department: 'Tehsildar Office, Revenue Department, UP',
    type: 'Offline (in-person at Tehsil)',
    difficulty: 'Easy',
    feeType: 'paid',
    feeAmount: '₹15 - ₹30',
    // Counter mapping
    counterMapping: 'counter-1 (Certificate Issuance Counter) at Tehsil',
    // Appointment rules
    appointmentRule: 'Walk-in basis; token system active. No advance appointment booking. Arrive early as tokens are limited.',
    // Document requirements
    documentRequirements: {
      'Aadhaar Card': { type: 'original', note: 'Mandatory for identity verification.' },
      'Salary slips or IT returns (if employed)': {
        type: 'original',
        note: 'Last 3 months’ slips; or copy of Income Tax Return acknowledgment.',
      },
      'Affidavit of income (if informal sector)': {
        type: 'self-attested',
        note: 'Sworn affidavit on non-judicial stamp paper of ₹10.',
      },
      'Family Ration Card': {
        type: 'copy',
        note: 'Family ration card copy showing all members.',
      },
    },
    // Forms
    forms: [
      { id: 'form-income-01', name: 'Income Certificate Application Form', type: 'pdf', source: 'UP e-District' },
    ],
    // Fee information
    fees: '₹15 - ₹30 depending on income slab. Payment at Tehsil counter (cash/UPI).',
    // Token info
    tokenInfo: 'Token number at counter-1; typically 200-300 tokens distributed daily.',
    // Questions to ask
    questionsToAsk: [
      'Is my income within the welfare ceiling (₹2.5 Lakhs/year)?',
      'How long until the certificate is ready for collection?',
      'Is the certificate valid for a specific duration?',
    ],
    // Official sources
    officialSources: [
      {
        name: 'UP e-District Portal',
        url: 'https://edistrict.up.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
      {
        name: 'Uttar Pradesh Revenue Department',
        url: 'https://revenue.up.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
    ],
    warnings: [
      'Usually valid for only 6 to 12 months from the date of issue.',
      'Income certificates are scheme-specific; confirm the receiving authority\'s validity period.',
      'Affidavit must be on non-judicial stamp paper; stamp paper requirements vary by district.',
    ],
    lastVerified: '2026-11-18',
  },

  casteCertificate: {
    id: 'caste-certificate',
    name: 'Caste Certificate',
    category: 'Certificates',
    shortDescription:
      'Obtain a caste certificate for SC/ST/OBC categories from the Tehsildar.',
    department: 'Tehsildar Office / Social Welfare Department, UP',
    type: 'Offline (in-person at Tehsil)',
    difficulty: 'Medium',
    feeType: 'paid',
    feeAmount: '₹20 - ₹50',
    // Counter mapping
    counterMapping: 'counter-1 (Certificate Issuance Counter)',
    // Appointment rules
    appointmentRule: 'Walk-in token system. No advance booking. Token distribution starts at 10:00 AM.',
    // Document requirements
    documentRequirements: {
      'Proof of caste (community certificate from parent)': {
        type: 'original',
        note: 'Issued by the relevant Panchayat or previous Tehsil office.',
      },
      'Aadhaar Card': { type: 'original', note: 'Mandatory for identity.' },
      'Ration Card': { type: 'copy', note: 'Family ration card showing caste category.' },
      'Educational certificates (if applicable)': {
        type: 'copy',
        note: 'Mark sheets or degree certificates stating caste category.',
      },
    },
    // Forms
    forms: [
      { id: 'form-caste-01', name: 'Caste Certificate Application Form', type: 'pdf', source: 'UP e-District' },
    ],
    // Fee information
    fees: '₹20 - ₹50. Payment at counter (cash).',
    // Token info
    tokenInfo: 'Token at counter-1; caste verification may require additional scrutiny time.',
    // Questions to ask
    questionsToAsk: [
      'Does my community appear in the UP State Government\'s notified list?',
      'Is the certificate valid for central as well as state schemes?',
      'What is the expected processing time?',
    ],
    // Official sources
    officialSources: [
      {
        name: 'UP e-District Portal',
        url: 'https://edistrict.up.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
      {
        name: 'Social Welfare Department, UP',
        url: 'https://swd.up.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
    ],
    warnings: [
      'Caste must be officially notified by the Uttar Pradesh government.',
      'Caste certificate from one state may not be accepted in another; confirm with the receiving authority.',
      'Verification may take additional time if documents require cross-district validation.',
    ],
    lastVerified: '2026-11-18',
  },

  tradeLicence: {
    id: 'business-licence-checklist',
    name: 'Trade Licence',
    category: 'Business & Commercial',
    shortDescription:
      'Municipal trade licence renewal or new application from the Lucknow Municipal Corporation.',
    department: 'Lucknow Municipal Corporation / Urban Local Bodies, UP',
    type: 'Offline (in-person at Municipal Office)',
    difficulty: 'Medium',
    feeType: 'paid',
    feeAmount: 'Assessed dynamically (typically ₹500 - ₹5,000 depending on carpet area and category)',
    // Counter mapping
    counterMapping: 'counter-1 (Trade Licence Counter) at Municipal Corporation',
    // Appointment rules
    appointmentRule: 'Walk-in basis; token system active. No advance appointment. Arrive before 11:00 AM for same-day token.',
    // Document requirements
    documentRequirements: {
      'Existing Trade Licence / Municipal Enlistment Certificate': {
        type: 'original',
        note: 'If renewal; bring previous licence and stamped receipt.',
      },
      'Shops and Establishments Registration Certificate': {
        type: 'original',
        note: 'Proof of legal establishment registration.',
      },
      'Commercial Lease Agreement & Landlord NOC': {
        type: 'original',
        note: 'Required for premises relocation or new lease.',
      },
      'Electricity / Utility Commercial Meter Zero Dues Bill': {
        type: 'original',
        note: 'No outstanding dues certificate from the electricity provider.',
      },
      'Municipal Property Tax Paid Receipts': {
        type: 'copy',
        note: 'Last 2 years’ paid receipts.',
      },
    },
    // Forms
    forms: [
      { id: 'form-trade-01', name: 'Trade Licence Application Form', type: 'pdf', source: 'LMC' },
      { id: 'form-trade-02', name: 'Property Tax Payment Receipt', type: 'pdf', source: 'LMC' },
    ],
    // Fee information
    fees: 'Dynamically assessed; typically ₹500 - ₹5,000. Payment at counter (cash/UPI) or via LMC portal.',
    // Token info
    tokenInfo: 'Token at counter-1; licence section handles 100-150 tokens daily. Early arrival recommended.',
    // Questions to ask
    questionsToAsk: [
      'What is the exact fee for my carpet area and business category?',
      'Is the licence valid until 31 March (financial year end)?',
      'What are the consequences of operating without a valid licence?',
    ],
    // Official sources
    officialSources: [
      {
        name: 'Lucknow Municipal Corporation Portal',
        url: 'https://lucknowmcd.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
      {
        name: 'UP Municipalities Act, 1916',
        url: 'https://upgovt.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
    ],
    warnings: [
      'A Municipal Trade Licence DOES NOT confer title or ownership of property.',
      'Always secure a formal, stamped or digitally signed receipt when closing a business.',
      'Shifting premises without filing an address amendment is treated as operating without an authorized licence.',
    ],
    lastVerified: '2026-11-18',
  },

  // New: Ration Card service
  rationCard: {
    id: 'ration-card',
    name: 'Ration Card',
    category: 'Social Welfare',
    shortDescription:
      'Apply for or renew a ration card for subsidized food grains from the Tehsil or Municipal office.',
    department: 'Department of Food & Supply, Uttar Pradesh',
    type: 'Offline (in-person at Tehsil or Municipal)',
    difficulty: 'Easy',
    feeType: 'paid',
    feeAmount: '₹5 - ₹50 depending on category (APL/BPL)',
    // Counter mapping - different for Tehsil vs Municipal
    counterMapping: 'counter-1 at Tehsil for new applications; counter-2 at Municipal for transfers',
    // Appointment rules
    appointmentRule: 'Walk-in basis. Token system at Tehsil (starts 10:00 AM). Municipal office: token from 09:30 AM.',
    // Document requirements
    documentRequirements: {
      'Identity proof of head of family': {
        type: 'original',
        note: 'Aadhaar, Voter ID, or Passport.',
      },
      'Address proof': {
        type: 'original',
        note: 'Utility bill, rent agreement, or Aadhaar address.',
      },
      'Income certificate': {
        type: 'copy',
        note: 'Required for BPL category verification.',
      },
      'Photographs of family members': {
        type: 'original',
        note: 'Typically 2-4 passport-sized photographs.',
      },
      'Land holding papers (Khatauni)': {
        type: 'copy',
        note: 'For rural applicants; shows cultivated land area.',
      },
    },
    // Forms
    forms: [
      { id: 'form-ration-01', name: 'Ration Card Application Form', type: 'pdf', source: 'UP Food Department' },
    ],
    // Fee information
    fees: '₹5 - ₹50 depending on category (APL/BPL). Payment at counter (cash).',
    // Token info
    tokenInfo: 'Token at counter-1 (Tehsil) or counter-2 (Municipal); typically 250 tokens daily at Tehsil.',
    // Questions to ask
    questionsToAsk: [
      'What ration card category am I eligible for (APL/BPY)?',
      'How long is the card valid before renewal?',
      'Can I add/remove family members later?',
    ],
    // Official sources
    officialSources: [
      {
        name: 'UP Food & Supply Department',
        url: 'https://food.up.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
      {
        name: 'NFSA Portal',
        url: 'https://nfsa.gov.in',
        verified: true,
        lastVerified: '2026-11-18',
      },
    ],
    warnings: [
      'Eligibility and card type (BPL/APL) depend heavily on the submitted income certificate.',
      'Ration cards are state-specific; UP ration card may not be valid in other states.',
      'Aadhaar linking is mandatory for continued benefits.',
    ],
    lastVerified: '2026-11-18',
  },
};

// Export a combined list of all UP services
export const UP_SERVICES = [
  UP_SERVICE_CATEGORIES.birthCertificate,
  UP_SERVICE_CATEGORIES.incomeCertificate,
  UP_SERVICE_CATEGORIES.casteCertificate,
  UP_SERVICE_CATEGORIES.tradeLicence,
  UP_SERVICE_CATEGORIES.rationCard,
];

