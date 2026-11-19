/**
 * Government Scholarship Application Evidence and Renewal Workspace Service
 * 
 * Supports National Scholarship Portal (NSP) and State Scholarship Portals
 * (e.g., SSP Karnataka, MahaDBT, Oasis Bengal, Medhashree, Post-Matric schemes).
 * Key capabilities:
 * - Fresh vs. Renewal application pathway tracking
 * - Evidence dossier inspection (Income, Domicile, Bonafide Student, Mark sheet, Caste)
 * - Academic progression verification (minimum required percentage/GPA for renewal)
 * - Strict Zero Bank Credential Collection rule (only checks if bank account is Aadhaar-seeded via NPCI mapper)
 * - Institute Level (L1) and District Nodal Officer (L2) verification status tracking
 */

export const SCHOLARSHIP_MODES = {
  FRESH: {
    code: 'FRESH',
    label: 'Fresh Scholarship Application',
    description: 'First-time applicant for the scheme in current academic cycle.'
  },
  RENEWAL: {
    code: 'RENEWAL',
    label: 'Scholarship Renewal Application',
    description: 'Continuing student renewing existing scholarship from previous academic year.'
  }
};

export const SCHEME_TIERS = {
  PRE_MATRIC: {
    code: 'PRE_MATRIC',
    label: 'Pre-Matric Scholarship (Grades 1 to 10)',
    incomeCeiling: 250000,
    minAttendancePercent: 75
  },
  POST_MATRIC: {
    code: 'POST_MATRIC',
    label: 'Post-Matric Scholarship (Class 11, 12, ITI, Diploma, Graduation)',
    incomeCeiling: 250000,
    minMarksPercent: 50
  },
  MERIT_CUM_MEANS: {
    code: 'MERIT_CUM_MEANS',
    label: 'Merit-cum-Means Professional & Technical Courses',
    incomeCeiling: 250000,
    minMarksPercent: 50
  }
};

export const SCHOLARSHIP_EVIDENCE_ITEMS = [
  { code: 'bonafide_certificate', title: 'Institution Bonafide Certificate with Roll No & U-DISE/AISHE code', mandatory: true },
  { code: 'income_certificate', title: 'Competent Authority Income Certificate (Current Financial Year)', mandatory: true },
  { code: 'domicile_certificate', title: 'State Domicile / Residential Certificate', mandatory: true },
  { code: 'previous_marksheet', title: 'Previous Year / Semester Qualifying Marksheet', mandatory: true },
  { code: 'fee_receipt', title: 'Current Academic Year Fee Receipt', mandatory: true },
  { code: 'caste_certificate', title: 'Community / Caste Certificate (for SC/ST/OBC schemes)', mandatory: false },
  { code: 'disability_certificate', title: 'UDID / Medical Board Certificate (for Divyangjan schemes)', mandatory: false }
];

export const NPCI_AADHAAR_SEEDING_NOTICE =
  'IMPORTANT: Government scholarship funds are disbursed directly through DBT (Direct Benefit Transfer) via the NPCI Aadhaar Payment Bridge. Do NOT enter bank PINs, OTPs, or net banking passwords. Simply ensure your savings bank account is seeded with Aadhaar at your bank branch or via the UIDAI / NPCI status check.';

export const SCHOLARSHIP_GRIEVANCE_CHANNELS = {
  NSP_HELPDESK: { phone: '0120-6619540', email: 'helpdesk@nsp.gov.in' },
  CPGRAMS: { portal: 'https://pgportal.gov.in/', department: 'Department of Higher Education / Social Justice' }
};

/**
 * Returns portal grievance contact details.
 * @returns {Object}
 */
export function getScholarshipGrievanceContacts() {
  return SCHOLARSHIP_GRIEVANCE_CHANNELS;
}

export const FREQUENTLY_ASKED_QUESTIONS = [
  {
    q: 'What is One-Time Registration (OTR) on the National Scholarship Portal?',
    a: 'OTR is a unique 14-digit number assigned to students that simplifies scholarship applications and eliminates the need to upload credentials repeatedly.'
  },
  {
    q: 'What should I do if my bank account is not mapped to NPCI?',
    a: 'Visit your home branch with an Aadhaar linking mandate form and request the bank official to enable DBT/NPCI mapping.'
  },
  {
    q: 'Can a student avail more than one government scholarship at the same time?',
    a: 'Generally no. Under central guidelines, a student can only draw maintenance allowance and fee reimbursement from one government scholarship scheme per academic year.'
  },
  {
    q: 'What happens if the Institute Nodal Officer (INO) marks my application as defective?',
    a: 'You will receive an SMS and dashboard notification with the defect remarks. You can edit the form and re-upload corrected documents within the defect correction window.'
  }
];

export const APPLICATION_DEFECT_CATEGORIES = {
  INCORRECT_INCOME: 'Income Certificate expired or income figure mismatched with application.',
  UNVERIFIED_BONAFIDE: 'Bonafide certificate lacks official stamp, roll number, or principal signature.',
  MARKS_MISMATCH: 'Uploaded marksheet scores do not match entry in portal fields.',
  BANK_NAME_MISMATCH: 'Name in Aadhaar does not match bank passbook record.'
};

/**
 * Validates scholarship application readiness and detects blockers.
 * @param {Object} applicationData 
 * @returns {Object} assessment
 */
export function evaluateScholarshipReadiness(applicationData = {}) {
  const errors = [];
  const warnings = [];

  if (!applicationData.studentName || applicationData.studentName.trim().length < 2) {
    errors.push('Student legal name is required.');
  }

  const mode = SCHOLARSHIP_MODES[applicationData.mode] || SCHOLARSHIP_MODES.FRESH;
  const tier = SCHEME_TIERS[applicationData.schemeTier] || SCHEME_TIERS.POST_MATRIC;

  // Renewal specific verification
  if (mode.code === 'RENEWAL') {
    if (!applicationData.previousApplicationId) {
      errors.push('Previous Year Application ID is mandatory for scholarship renewal.');
    }
    if (applicationData.previousMarksPercent !== undefined) {
      const marks = Number(applicationData.previousMarksPercent);
      if (marks < tier.minMarksPercent) {
        warnings.push(`Renewal criteria requires minimum ${tier.minMarksPercent}% marks. Current score is ${marks}%. Verify specific relaxation guidelines.`);
      }
    }
  }

  // Financial income eligibility
  if (applicationData.annualIncome !== undefined) {
    const income = Number(applicationData.annualIncome);
    if (income > tier.incomeCeiling) {
      warnings.push(`Family annual income (₹${income.toLocaleString('en-IN')}) exceeds scheme ceiling of ₹${tier.incomeCeiling.toLocaleString('en-IN')}.`);
    }
  }

  // Bank seeding reminder
  if (!applicationData.isAadhaarBankSeeded) {
    warnings.push('Aadhaar-Bank account linking with active NPCI mapping is required for DBT disbursement.');
  }

  // Document evidence
  const submittedDocs = applicationData.documents || [];
  SCHOLARSHIP_EVIDENCE_ITEMS.forEach(doc => {
    if (doc.mandatory && !submittedDocs.includes(doc.code)) {
      errors.push(`Missing mandatory document: ${doc.title}`);
    }
  });

  const isEligible = errors.length === 0;

  return {
    isEligible,
    mode,
    tier,
    errors,
    warnings,
    npciNotice: NPCI_AADHAAR_SEEDING_NOTICE,
    verificationStages: getVerificationWorkflowStages()
  };
}

/**
 * Returns multi-stage institutional and governmental verification workflow.
 * @returns {Array<Object>}
 */
export function getVerificationWorkflowStages() {
  return [
    { level: 'L1', title: 'Institute Verification (INO)', description: 'College / School Nodal Officer verifies bonafide enrolment and marks record.' },
    { level: 'L2', title: 'District Nodal Officer (DNO)', description: 'District Welfare / Minority Officer validates revenue income certificates.' },
    { level: 'L3', title: 'State Nodal Officer (SNO)', description: 'State department approves merit list and prepares disbursement bill.' },
    { level: 'L4', title: 'PFMS / DBT Aadhaar Bridge', description: 'Public Financial Management System transfers funds to Aadhaar-seeded bank account.' }
  ];
}

/**
 * Exports scholarship readiness summary in markdown.
 * @param {Object} applicationData 
 * @returns {string} markdown
 */
export function exportScholarshipSummary(applicationData = {}) {
  const assessment = evaluateScholarshipReadiness(applicationData);

  return [
    `# Government Scholarship Application & Renewal Dossier`,
    `**Student Name:** ${applicationData.studentName || 'N/A'}`,
    `**Portal:** ${applicationData.portalName || 'National Scholarship Portal (NSP)'}`,
    `**Application Mode:** ${assessment.mode.label}`,
    `**Scheme Level:** ${assessment.tier.label}`,
    `**Status:** ${assessment.isEligible ? 'VERIFIED READY FOR PORTAL SUBMISSION' : 'ACTION REQUIRED'}`,
    ``,
    `## Direct Benefit Transfer (DBT) Safeguards`,
    `> ${assessment.npciNotice}`,
    ``,
    `## Verification Workflow Stages`,
    ...assessment.verificationStages.map(s => `- **[${s.level}] ${s.title}:** ${s.description}`),
    ``,
    ...(assessment.errors.length > 0 ? [`## Pending Deficiencies`, ...assessment.errors.map(e => `- ❌ ${e}`), ``] : []),
    ...(assessment.warnings.length > 0 ? [`## Important Warnings`, ...assessment.warnings.map(w => `- ⚠️ ${w}`), ``] : [])
  ].join('\n');
}
