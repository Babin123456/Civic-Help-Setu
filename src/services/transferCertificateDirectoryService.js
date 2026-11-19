/**
 * Public School and College Transfer-Certificate Process Directory Service
 * 
 * Provides structured guidance for obtaining, verifying, and correcting educational certificates:
 * 1. School Leaving Certificate / Transfer Certificate (TC) - Issued by School under RTE Act Section 5
 * 2. Board Migration Certificate - Issued by Education Board (CBSE, ICSE, State Secondary/Higher Secondary Boards)
 * 3. College Leaving Certificate (CLC) / University Migration Certificate - For higher education admissions
 * 
 * Implements:
 * - Distinction between Institution (School/College) vs. Examination Board jurisdiction
 * - Protection under Section 5(2) and 5(3) of RTE Act 2009 (TC cannot be delayed for unpaid fees)
 * - Duplicate issuance route (loss, theft, damage)
 * - Name / Parentage / DOB correction procedure
 */

export const CERTIFICATE_TYPES = {
  SCHOOL_TC: {
    code: 'SCHOOL_TC',
    title: 'School Transfer Certificate (TC) / School Leaving Certificate (SLC)',
    issuingAuthority: 'Principal / Headmaster of the attended school',
    statuteRef: 'RTE Act 2009 Section 5',
    purpose: 'Transfer from one recognized school to another within or across states.',
    tatDays: 7
  },
  BOARD_MIGRATION: {
    code: 'BOARD_MIGRATION',
    title: 'Board Migration Certificate',
    issuingAuthority: 'Examination Board (CBSE / CISCE / State Secondary Board)',
    statuteRef: 'Board Affiliation & Examination Bye-laws',
    purpose: 'Admission to a different educational board, university, or pre-university college.',
    tatDays: 14
  },
  COLLEGE_MIGRATION: {
    code: 'COLLEGE_MIGRATION',
    title: 'College Leaving Certificate (CLC) / University Migration Certificate',
    issuingAuthority: 'University Registrar / College Principal',
    statuteRef: 'University Grants Commission (UGC) Guidelines',
    purpose: 'Inter-university post-graduate transfer or professional council registration.',
    tatDays: 15
  }
};

export const APPLICATION_ROUTES = {
  FRESH_PASS_OUT: { code: 'FRESH', label: 'Regular Passing Out / Voluntary Transfer' },
  DUPLICATE_LOST: { code: 'DUPLICATE', label: 'Duplicate Copy (Original Lost / Damaged / Destroyed)' },
  CORRECTION: { code: 'CORRECTION', label: 'Name / Date of Birth / Parentage Correction' }
};

export const RTE_TC_PROTECTION = {
  statute: 'Right of Children to Free and Compulsory Education Act, 2009 (Section 5)',
  clause2: 'Where a child is required to move from one school to another, such child shall have a right to seek transfer to any other school.',
  clause3: 'The Head-teacher or in-charge of the school shall immediately issue the transfer certificate. Delay in producing transfer certificate shall not be a ground for delaying or denying admission in such other school.',
  penalAction: 'Disciplinary action under service rules applies to Head-teacher for withholding or delaying TC.'
};

export const FREQUENTLY_ASKED_QUESTIONS = [
  {
    q: 'Can a school refuse to issue a TC because of unpaid school fees?',
    a: 'No. The Right to Education (RTE) Act 2009 Section 5 and various High Court rulings affirm that withholding a transfer certificate over fee disputes is unlawful.'
  },
  {
    q: 'Is countersignature by the District Education Officer (DEO) always required?',
    a: 'Only if transferring between different school education boards (e.g., State Board to ICSE) or across state borders, depending on the receiving state admitting rules.'
  },
  {
    q: 'Can I use a DigiLocker migration certificate for university admissions?',
    a: 'Yes. Under Rule 9A of the Information Technology Rules, 2016, electronic records on DigiLocker are treated at par with original physical certificates.'
  },
  {
    q: 'How can an error in the student date of birth on the TC be corrected?',
    a: 'Submit an application along with the original municipal birth certificate and admission register extract to the head of the school.'
  }
];

export const CERTIFICATE_VERIFICATION_CHECKLIST = [
  { item: 'Student PEN (Permanent Education Number) / U-DISE ID', mandatory: true },
  { item: 'Accurate spelling of Student, Mother and Father names', mandatory: true },
  { item: 'Date of Birth in figures and words', mandatory: true },
  { item: 'Date of admission and date of leaving school', mandatory: true },
  { item: 'Conduct and character remarks', mandatory: false },
  { item: 'School affiliation code and principal official stamp', mandatory: true }
];

/**
 * Validates whether a physical or digital TC has all required statutory fields.
 * @param {Object} certificateData 
 * @returns {Object} verificationResult
 */
export function verifyCertificateFields(certificateData = {}) {
  const missing = [];
  CERTIFICATE_VERIFICATION_CHECKLIST.forEach(check => {
    if (check.mandatory && !certificateData[check.item.split(' ')[0].toLowerCase()]) {
      missing.push(check.item);
    }
  });

  return {
    isFullyVerified: missing.length === 0,
    missingFields: missing,
    totalChecked: CERTIFICATE_VERIFICATION_CHECKLIST.length
  };
}

/**
 * Assesses an applicant's TC or migration request and provides readiness guidance.
 * @param {Object} details 
 * @returns {Object} assessment
 */
export function assessTransferCertificateRequest(details = {}) {
  const errors = [];
  const warnings = [];

  if (!details.studentName || details.studentName.trim().length < 2) {
    errors.push('Student full name as per school/college records is required.');
  }

  const certType = CERTIFICATE_TYPES[details.certificateType];
  if (!certType) {
    errors.push('Valid certificate type (SCHOOL_TC, BOARD_MIGRATION, or COLLEGE_MIGRATION) must be specified.');
  }

  const route = APPLICATION_ROUTES[details.route] || APPLICATION_ROUTES.FRESH_PASS_OUT;

  const docs = details.documents || [];
  if (route.code === 'DUPLICATE') {
    if (!docs.includes('police_lost_report')) {
      warnings.push('A Police Lost Article Report / NCR is generally required for duplicate certificate issuance.');
    }
    if (!docs.includes('notarized_affidavit')) {
      warnings.push('Notarized affidavit declaring loss of original certificate is required.');
    }
  } else if (route.code === 'CORRECTION') {
    if (!docs.includes('gazette_or_court_order') && !docs.includes('birth_certificate')) {
      warnings.push('Primary supporting proof (Birth certificate or Gazette notification) required for official correction.');
    }
  }

  // Check no-dues status
  if (details.pendingDues === true) {
    if (details.certificateType === 'SCHOOL_TC') {
      warnings.push('Under RTE Act Section 5, school cannot withhold or deny TC due to fee disputes; admission in new school cannot be blocked.');
    } else {
      warnings.push('Higher education institutions typically require Library and Laboratory No-Dues clearance before issuing CLC.');
    }
  }

  const isReady = errors.length === 0;

  return {
    isReady,
    certificate: certType || null,
    route,
    errors,
    warnings,
    statutoryProtection: certType?.code === 'SCHOOL_TC' ? RTE_TC_PROTECTION : null,
    procedureSteps: getCertificateProcedureSteps(certType?.code, route.code)
  };
}

/**
 * Returns procedural steps based on certificate type and route.
 * @param {string} certCode 
 * @param {string} routeCode 
 * @returns {Array<string>}
 */
export function getCertificateProcedureSteps(certCode, routeCode) {
  if (certCode === 'BOARD_MIGRATION') {
    return [
      'Access Board Online Portal (e.g., CBSE Pariksha Sangam / Digilocker / State Board portal).',
      'Enter Roll Number, School Code, Year of Passing, and Center Number.',
      'Pay prescribed board verification fee (₹250–₹500).',
      'Download digitally signed copy from DigiLocker or opt for speed post delivery of physical certificate within 14 days.'
    ];
  }

  if (routeCode === 'DUPLICATE') {
    return [
      'File an online Lost Article Report (NCR) with local police station.',
      'Execute a ₹10/₹50 Non-Judicial Stamp Paper Affidavit declaring loss of original.',
      'Submit written application along with affidavit, NCR, and copy of mark sheet to Principal.',
      'School verifies admission register and issues duplicate TC marked "DUPLICATE COPY".'
    ];
  }

  return [
    'Submit written application for Transfer Certificate to the Head of Institution.',
    'Obtain clearance slip from school office (accounts, library, sports).',
    'School verifies admission record and generates TC with Student PEN (Permanent Education Number) / U-DISE ID.',
    'Principal signs and affixes school seal within 7 working days.',
    'If transferring to another state or board, get TC countersigned by District Education Officer (DEO / BEO) if required.'
  ];
}

/**
 * Exports Transfer Certificate Request Summary in markdown.
 * @param {Object} details 
 * @returns {string} markdown
 */
export function exportTransferCertificateSummary(details = {}) {
  const assessment = assessTransferCertificateRequest(details);

  return [
    `# Educational Transfer Certificate (TC) & Migration Dossier`,
    `**Student Name:** ${details.studentName || 'N/A'}`,
    `**Institution:** ${details.institutionName || 'N/A'}`,
    `**Certificate Type:** ${assessment.certificate ? assessment.certificate.title : 'N/A'}`,
    `**Application Route:** ${assessment.route.label}`,
    `**Status:** ${assessment.isReady ? 'READY TO PROCEED' : 'ACTION REQUIRED'}`,
    ``,
    `## Issuing Authority & Timeline`,
    `- **Issuing Body:** ${assessment.certificate ? assessment.certificate.issuingAuthority : 'N/A'}`,
    `- **Standard Turnaround:** ~${assessment.certificate ? assessment.certificate.tatDays : 7} working days`,
    ``,
    ...(assessment.statutoryProtection
      ? [
          `## Statutory Right to Transfer (RTE Act, 2009)`,
          `> ${assessment.statutoryProtection.clause2}`,
          `> **Mandate:** ${assessment.statutoryProtection.clause3}`,
          ``
        ]
      : []),
    `## Step-by-Step Procedure`,
    ...assessment.procedureSteps.map((s, idx) => `${idx + 1}. ${s}`),
    ...(assessment.errors.length > 0 ? [``, `## Deficiencies`, ...assessment.errors.map(e => `- ❌ ${e}`)] : []),
    ...(assessment.warnings.length > 0 ? [``, `## Important Precautions`, ...assessment.warnings.map(w => `- ⚠️ ${w}`)] : [])
  ].join('\n');
}
