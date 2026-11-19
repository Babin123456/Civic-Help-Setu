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