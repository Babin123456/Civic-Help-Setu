/**
 * syntheticEvidenceFixtures.js
 *
 * Synthetic test fixtures for Civic Evidence Graph evaluation (#1165).
 * Contains ZERO real citizen PII, credentials, or official documents.
 * Includes synthetic edge cases:
 * - Multilingual English/Indic OCR texts
 * - Indic name spelling transliterations (Lakshmi vs Laxmi)
 * - Initials expansions (K. Suresh vs Kumar Suresh)
 * - OCR glyph confusion (O vs 0, I vs 1)
 * - True date-of-birth contradictions
 * - Chronological sequence violations
 */

export const SYNTHETIC_VAULT_DOCUMENTS = [
  {
    id: 'syn-doc-aadhaar-1',
    type: 'Aadhaar Card',
    number: '9999 1111 2222',
    issuer: 'UIDAI',
    verified: true,
    ocrConfidence: 0.98,
    ocrText: `
      GOVERNMENT OF INDIA / BHARAT SARKAR
      Unique Identification Authority of India
      Name: Lakshmi Devi
      DOB: 15/08/1988
      Gender: Female
      Address: House No 42, Gandhi Nagar, Bengaluru, Karnataka - 560001
      UID: 9999 1111 2222
    `,
  },
  {
    id: 'syn-doc-school-cert-2',
    type: 'School Leaving Certificate',
    number: 'SLC/2004/8912',
    issuer: 'State Education Board',
    verified: false,
    ocrConfidence: 0.90,
    ocrText: `
      SECONDARY EDUCATION BOARD
      TRANSFER & CHARACTER CERTIFICATE
      Student Name: Laxmi Devi
      Father Name: Ram Prasad
      Date of Birth: 15/08/1989
      Certificate Ref: SLC/2004/8912
    `,
  },
  {
    id: 'syn-doc-pan-3',
    type: 'PAN Card',
    number: 'ABCDE1234F',
    issuer: 'Income Tax Department',
    verified: true,
    ocrConfidence: 0.96,
    ocrText: `
      INCOME TAX DEPARTMENT
      GOVT. OF INDIA
      Permanent Account Number: ABCDE1234F
      Name: Lakshmi Devi
      Father's Name: Ram Prasad
      Date of Birth: 15/08/1988
    `,
  },
  {
    id: 'syn-doc-ack-receipt-4',
    type: 'Application Acknowledgement',
    number: 'MH/APP/2024/0981',
    issuer: 'Municipal Corporation',
    issuanceDate: '2024-02-15',
    verified: false,
    ocrConfidence: 0.92,
    ocrText: `
      MUNICIPAL CORPORATION GRIEVANCE PORTAL
      ACKNOWLEDGEMENT RECEIPT
      Applicant: Laxmi Devi
      Tracking Number: MH/APP/2024/0981
      Date of Filing: 15/02/2024
    `,
  },
  {
    id: 'syn-doc-notice-ocr-confusion-5',
    type: 'Scrutiny Notice',
    number: 'MH/APP/2024/O981', // Notice has 'O' instead of '0' due to OCR
    issuer: 'Municipal Corporation',
    issuanceDate: '2024-02-28',
    verified: false,
    ocrConfidence: 0.75, // Low OCR confidence
    ocrText: `
      MUNICIPAL CORPORATION SCRUTINY WING
      NOTICE OF DISCREPANCY
      Reference File: MH/APP/2024/O981
      Issued to: Lakshmi Devi
      Date of Notice: 28/02/2024
    `,
  },
  {
    id: 'syn-doc-chronology-violation-6',
    type: 'Invalid Certificate',
    number: 'TEST/CHRONO/001',
    issuer: 'Transport Authority',
    issuanceDate: '2024-01-01',
    expiryDate: '2022-01-01', // Expired before issuance!
    verified: false,
    ocrConfidence: 0.95,
    ocrText: `
      DRIVING LICENCE
      Licence No: TEST/CHRONO/001
      Issue Date: 01/01/2024
      Valid Till: 01/01/2022
    `,
  },
];

export const SYNTHETIC_NAME_VARIATION_PAIRS = [
  { nameA: 'Lakshmi Devi', nameB: 'Laxmi Devi', expectedMatch: 'PHONETIC_NEAR_MATCH' },
  { nameA: 'K. Suresh', nameB: 'Kumar Suresh', expectedMatch: 'INITIALS_EXPANSION_VARIATION' },
  { nameA: 'Suresh Kumar', nameB: 'Kumar Suresh', expectedMatch: 'PHONETIC_NEAR_MATCH' }, // Inverted
  { nameA: 'Choudhary Rajesh', nameB: 'Chowdhury Rajesh', expectedMatch: 'PHONETIC_NEAR_MATCH' },
  { nameA: 'Rajesh Varma', nameB: 'Rajesh Warma', expectedMatch: 'PHONETIC_NEAR_MATCH' },
  { nameA: 'Amit Shah', nameB: 'Deepak Sharma', expectedMatch: 'EXACT_VALUE_MISMATCH' },
];

export const SYNTHETIC_OCR_CONFUSION_PAIRS = [
  { refA: 'APP20240981', refB: 'APP2024O981', isOcrConfusion: true }, // 0 vs O
  { refA: 'MH14AB1234', refB: 'MH14ABI234', isOcrConfusion: true }, // 1 vs I
  { refA: 'DL5S8901', refB: 'DL558901', isOcrConfusion: true }, // S vs 5
  { refA: 'RJ09B1122', refB: 'RJ0981122', isOcrConfusion: true }, // B vs 8
  { refA: 'KA01AA1111', refB: 'DL02BB9999', isOcrConfusion: false }, // Completely different
];
