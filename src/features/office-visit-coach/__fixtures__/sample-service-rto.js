/**
 * Synthetic fixture: RTO (Regional Transport Office) service record
 * Used for testing the Multi-Agent Office Visit Preparation Coach.
 * 
 * NOTE: This fixture uses entirely synthetic data. No real citizen PII,
 * credentials, or documents are included. All source data is in the public
 * domain or mock data for testing purposes only.
 */

export const SAMPLE_RTO_SERVICE = {
  name: 'Driving License Renewal',
  category: 'Transport',
  department: 'Regional Transport Office',
  fees: '₹200 (Statutory fee - varies by state)',
  processingTime: '15 - 30 working days',
  documents: [
    'Valid Driving License (expired within last 1 year)',
    'Identity Proof (Aadhaar Card / Voter ID / Passport)',
    'Address Proof (Utility Bill / Bank Passport)',
    'Form 9 (Driving License Renewal Application)',
    'Self-attested photocopies of expired license',
  ],
  documentRequirements: {
    'Valid Identity Proof (Aadhaar / Voter ID / Passport)': {
      type: 'required',
      condition: null,
      source: 'https://parivahan.gov.in',
    },
    'Identity Proof (Aadhaar Card / Voter ID / Passport)': {
      type: 'required',
      condition: null,
      source: 'https://parivahan.gov.in',
    },
    'Valid Driving License (expired within last 1 year)': {
      type: 'required',
      condition: null,
      source: 'https://parivahan.gov.in',
    },
    'Address Proof (Utility Bill / Bank Passport)': {
      type: 'required',
      condition: null,
      source: 'https://parivahan.gov.in',
    },
    'Form 9 (Driving License Renewal Application)': {
      type: 'required',
      condition: null,
      source: 'https://parivahan.gov.in',
    },
    'Self-attested photocopies of expired license': {
      type: 'required',
      condition: null,
      source: 'https://parivahan.gov.in',
    },
  },
  steps: [
    { title: 'Token Collection', description: 'Obtain token at RTO counter using token kiosk.' },
    { title: 'Document Verification', description: 'Submit original documents for inspection at counter.' },
    { title: 'Eye Test', description: 'Compulsory eye test at RTO medical facility.' },
    { title: 'Fee Payment', description: 'Pay renewal fee at treasury counter or via UPI.' },
    { title: 'New License Issuance', description: 'Receive renewed driving license by post or in-person.' },
  ],
  officialSources: [
    { name: 'Parivahan Portal', url: 'https://parivahan.gov.in', verified: true },
    { name: 'State Transport Department', url: 'https://transport.state.gov.in', verified: true },
  ],
  lastVerified: '2026-11-20', // Recent verification (within 30-day TTL)
};

/**
 * Synthetic fixture: Tehsildar (Revenue) service record
 */
export const SAMPLE_TEHSILDAR_SERVICE = {
  name: 'Property Mutation',
  category: 'Revenue',
  department: 'Tehsildar Office',
  fees: '₹500 (Court stamp + processing fee)',
  processingTime: '30 - 60 days',
  documents: [
    'Original Sale Deed',
    'Identity Proof (Aadhaar Card)',
    'Address Proof (Utility Bill or Domicile Certificate)',
    'No Objection Certificate (NOC) from all legal heirs (if applicable)',
    'Property Card Copy',
  ],
  steps: [
    { title: 'Application Submission', description: 'Submit application with original documents at Tehsildar counter.' },
    { title: 'Patwari Verification', description: 'Revenue staff verifies property records and land records.' },
    { title: 'Public Notice', description: 'Public notice published for objections (15-day window).' },
    { title: 'Fee Payment', description: 'Pay court fee stamp and processing fee.' },
    { title: 'Order Passing', description: 'Mutated property records updated in revenue database.' },
  ],
  officialSources: [
    { name: 'State Revenue Portal', url: 'https://revenue.state.gov.in', verified: true },
  ],
  lastVerified: '2026-09-20', // Within TTL
};

/**
 * Synthetic fixture: Passport Seva Kendra service record
 */
export const SAMPLE_PSK_SERVICE = {
  name: 'Fresh Passport Application',
  category: 'Passport',
  department: 'Passport Seva Kendra',
  fees: '₹1,500 (Normal category)',
  processingTime: '30 - 45 days',
  documents: [
    'Proof of Age (Birth Certificate / 10th Marksheet / Passport of parents)',
    'Proof of Address (Utility Bill / Bank Passport / Aadhaar)',
    'Self-attested photographs (3 copies, 3.5x4.5cm, white background)',
    'Signature on white paper',
    'Fee receipt acknowledgment',
  ],
  steps: [
    { title: 'Appointment Booking', description: 'Book slot at nearest Passport Seva Kendra online.' },
    { title: 'Document Submission', description: 'Submit original documents and self-attested photocopies at PSK.' },
    { title: 'Biometric Capture', description: 'Fingerprints and photograph captured at PSK.' },
    { title: 'Payment', description: 'Pay passport fees at counter or online.' },
    { title: 'Application Processing', description: 'Passport processed at central processing facility.' },
  ],
  officialSources: [
    { name: 'Passport India Portal', url: 'https://passportindia.gov.in', verified: true },
  ],
  lastVerified: '2026-11-01', // Very recent
};

/**
 * Synthetic fixture: CSC/Seva Kendra (Aadhaar) service record
 */
export const SAMPLE_CSC_AADHAAR_SERVICE = {
  name: 'Aadhaar Update',
  category: 'Aadhaar',
  department: 'Common Service Centre / Aadhaar Seva Kendra',
  fees: '₹50 (Demographic update) / ₹100 (Biometric update)',
  processingTime: '30 days',
  documents: [
    'Proof of Identity (Passport / PAN Card / Voter ID)',
    'Proof of Address (Utility Bill / Bank Passbook / Ration Card)',
    'Current Aadhaar Card (for update)',
    'Supporting document for change (e.g., marriage certificate for name change)',
  ],
  steps: [
    { title: 'Biometric Appointment', description: 'Book slot at nearest Aadhaar Seva Kendra.' },
    { title: 'Document Verification', description: 'Submit original documents for verification.' },
    { title: 'Live OTP Verification', description: 'OTP sent to registered mobile number for authorization.' },
    { title: 'Biometric Capture', description: 'Fingerprint and iris scan at CSC.' },
    { title: 'Aadhaar Update Request', description: 'Update processed and acknowledgment slip generated.' },
  ],
  officialSources: [
    { name: 'UIDAI Portal', url: 'https://uidai.gov.in', verified: true },
  ],
  lastVerified: '2026-10-28', // Within TTL
};

/**
 * Synthetic fixture: Municipal service record
 */
export const SAMPLE_MUNICIPAL_SERVICE = {
  name: 'Birth Certificate Issuance',
  category: 'Vital Records',
  department: 'Municipal Corporation',
  fees: '₹50 (Standard) / ₹100 (Expedited)',
  processingTime: '7 - 14 days',
  documents: [
    'Hospital birth memo or discharge summary',
    'Parent\'s identity proof (Aadhaar / Voter ID)',
    'Parent\'s address proof (Utility Bill / Ration Card)',
    'Identity proof of applicant (if adult)',
  ],
  steps: [
    { title: 'Application Submission', description: 'Submit application with documents at municipal counter.' },
    { title: 'Verification', description: 'Municipal staff verifies hospital records and parental details.' },
    { title: 'Payment', description: 'Pay issuance fee at cash counter or via UPI.' },
    { title: 'Certificate Collection', description: 'Collect birth certificate from counter.' },
  ],
  officialSources: [
    { name: 'Municipal Corp Portal', url: 'https://mcorp.gov.in', verified: true },
  ],
  lastVerified: '2026-11-10', // Very recent
};