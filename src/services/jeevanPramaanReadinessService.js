/**
 * Jeevan Pramaan and Pension Life-Certificate Readiness Centre Service
 *
 * Implements a comprehensive readiness guide and personal submission tracker for Indian pensioners:
 * 1. Distinguishes pension sanctioning pathways:
 *    - CENTRAL_CIVIL (Central Government Civil Pensioners - CPAO)
 *    - DEFENCE_SPARSH (Armed Forces Pensioners - SPARSH / PCDA Prayagraj)
 *    - STATE_GOVERNMENT (State Civil & Police Pensioners via State Treasuries)
 *    - EMPLOYEES_PENSION_SCHEME (EPS-95 Pensioners under EPFO)
 *    - TELECOM_RAILWAYS_OTHER (Specialized Central Disbursing Authorities)
 * 2. Structures life certificate submission methods:
 *    - DIGITAL_FACE_AUTHENTICATION (Aadhaar FaceRD App on Android/iOS - Zero Biometric Device Cost)
 *    - BIOMETRIC_DEVICE (Iris scanner or Fingerprint sensor connected to Jeevan Pramaan App)
 *    - POSTMAN_DOORSTEP_DLC (India Post Payments Bank - IPPB doorstep assisted DLC)
 *    - BANK_BRANCH_PHYSICAL (Physical Life Certificate Form submission at Home Pension Branch)
 *    - CITIZEN_SERVICE_CENTRE (CSC / Grama One / MeeSeva assisted biometric counter)
 * 3. Handles statutory submission windows (1st to 30th November standard, super-senior 80+ window from 1st October).
 * 4. Diagnostic troubleshooter for authentication failures (biometric timeout, eye blink error, PPO mismatch, Aadhaar demographic divergence).
 * 5. Accessible family-helper checklist operating without soliciting credentials, passwords, or biometric scans.
 */

export const PENSION_PATHWAY = {
  CENTRAL_CIVIL: 'CENTRAL_CIVIL',
  DEFENCE_SPARSH: 'DEFENCE_SPARSH',
  STATE_GOVERNMENT: 'STATE_GOVERNMENT',
  EMPLOYEES_PENSION_SCHEME: 'EMPLOYEES_PENSION_SCHEME',
  RAILWAYS: 'RAILWAYS',
};

export const SUBMISSION_MODE = {
  DIGITAL_FACE_AUTHENTICATION: 'DIGITAL_FACE_AUTHENTICATION',
  BIOMETRIC_DEVICE: 'BIOMETRIC_DEVICE',
  POSTMAN_DOORSTEP_DLC: 'POSTMAN_DOORSTEP_DLC',
  BANK_BRANCH_PHYSICAL: 'BANK_BRANCH_PHYSICAL',
  CITIZEN_SERVICE_CENTRE: 'CITIZEN_SERVICE_CENTRE',
};

export const SUBMISSION_STATUS = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  SUBMITTED_PENDING_PDA_ACCEPTANCE: 'SUBMITTED_PENDING_PDA_ACCEPTANCE',
  ACCEPTED_BY_PDA: 'ACCEPTED_BY_PDA',
  REJECTED_AUTHENTICATION_FAILURE: 'REJECTED_AUTHENTICATION_FAILURE',
};

export const PENSION_DISCLAIMER =
  'The Readiness Centre provides official instructions and troubleshooting for Digital Life Certificate (DLC) submission. Civic Help Setu never requests your Aadhaar OTP, biometric scans, bank account passwords, or pension login credentials.';

export const PENSION_PATHWAY_SPECS = {
  CENTRAL_CIVIL: {
    name: 'Central Government Civil Pension',
    disbursingAuthority: 'Central Pension Accounting Office (CPAO)',
    trackingPortal: 'https://cpao.nic.in',
    jeevanPramaanSupported: true,
    sparshMigrated: false,
    statutoryWindowStandard: '1st November to 30th November',
    superSeniorWindow: '1st October to 30th November (for age 80+)',
    requiredIdentifiers: ['PPO Number (12 digits)', 'Pension Disbursing Bank Account', 'Aadhaar Number'],
  },
  DEFENCE_SPARSH: {
    name: 'Defence Pension (Armed Forces & Veterans)',
    disbursingAuthority: 'System for Pension Administration (RAKSHA) - SPARSH / PCDA',
    trackingPortal: 'https://sparsh.defencepension.gov.in',
    jeevanPramaanSupported: true,
    sparshMigrated: true,
    statutoryWindowStandard: 'Annual birth-month or November cycle depending on SPARSH profile',
    superSeniorWindow: '1st October onwards',
    requiredIdentifiers: ['SPARSH PPO Number (12 digits)', 'Original Defence PPO Number', 'Bank Account', 'Aadhaar'],
    specialNotice: 'Ensure Pension Disbursing Agency (PDA) is selected as "SPARSH (PCDA Defence)" on Jeevan Pramaan.',
  },
  STATE_GOVERNMENT: {
    name: 'State Government Civil & Police Pension',
    disbursingAuthority: 'State Treasury / Directorate of Accounts & Treasuries',
    trackingPortal: 'State e-Treasury / Cyber Treasury Portal',
    jeevanPramaanSupported: true,
    sparshMigrated: false,
    statutoryWindowStandard: '1st November to 30th November',
    superSeniorWindow: 'Varies by State Treasury rules',
    requiredIdentifiers: ['State Treasury PPO Number', 'Treasury / Bank Branch Code', 'Aadhaar Number'],
  },
  EMPLOYEES_PENSION_SCHEME: {
    name: 'EPFO EPS-95 Private Sector Pension',
    disbursingAuthority: 'Employees Provident Fund Organisation (EPFO)',
    trackingPortal: 'https://unifiedportal-mem.epfindia.gov.in',
    jeevanPramaanSupported: true,
    sparshMigrated: false,
    statutoryWindowStandard: 'Any time of year (valid for 12 months from last submission date)',
    superSeniorWindow: 'Same rolling 12-month validity',
    requiredIdentifiers: ['12-digit PPO Number', 'UAN (Universal Account Number)', 'Bank Account', 'Aadhaar'],
  },
};

/**
 * Evaluates pension readiness prerequisites and eligible submission window.
 *
 * @param {object} params
 * @param {string} params.pathway (CENTRAL_CIVIL, DEFENCE_SPARSH, STATE_GOVERNMENT, EMPLOYEES_PENSION_SCHEME)
 * @param {number} params.age Pensioner age in years
 * @param {string} [params.currentMonthStr] Current month string (e.g. 'October', 'November')
 * @returns {object} Readiness evaluation
 */
export function evaluatePensionReadiness({
  pathway = PENSION_PATHWAY.CENTRAL_CIVIL,
  age = 65,
  currentMonthStr = 'November',
}) {
  const specs = PENSION_PATHWAY_SPECS[pathway] || PENSION_PATHWAY_SPECS.CENTRAL_CIVIL;
  const isSuperSenior = age >= 80;

  const isWindowActive =
    pathway === PENSION_PATHWAY.EMPLOYEES_PENSION_SCHEME
      ? true // EPS-95 has rolling 12-month validity
      : isSuperSenior
      ? ['October', 'November', 'December'].includes(currentMonthStr)
      : ['November', 'December'].includes(currentMonthStr);

  return {
    pathway,
    pensionSchemeName: specs.name,
    disbursingAuthority: specs.disbursingAuthority,
    pensionerAge: age,
    isSuperSenior,
    submissionWindowActive: isWindowActive,
    activeWindowDescription: isSuperSenior ? specs.superSeniorWindow : specs.statutoryWindowStandard,
    requiredIdentifiers: specs.requiredIdentifiers,
    specialNotice: specs.specialNotice || null,
    trackingPortal: specs.trackingPortal,
    disclaimer: PENSION_DISCLAIMER,
  };
}

/**
 * Troubleshoots common Jeevan Pramaan submission or authentication failures.
 *
 * @param {string} errorCode or issue symptom
 * @returns {{ cause: string, solution: string, fallbackChannel: string }}
 */
export function troubleshootJeevanPramaanFailure(errorCode = '') {
  const codeLower = String(errorCode).toLowerCase();

  if (codeLower.includes('face') || codeLower.includes('blink') || codeLower.includes('lighting')) {
    return {
      cause: 'Aadhaar FaceRD app lighting or camera resolution mismatch.',
      solution: 'Ensure frontal diffuse lighting without backlight. Hold phone 1.5 feet away at eye level. Remove spectacles if reflections occur.',
      fallbackChannel: SUBMISSION_MODE.POSTMAN_DOORSTEP_DLC,
    };
  }

  if (codeLower.includes('sparsh') || codeLower.includes('pda') || codeLower.includes('agency')) {
    return {
      cause: 'Incorrect Pension Disbursing Agency selected during Jeevan Pramaan setup.',
      solution: 'For Defence veterans migrated to SPARSH, select Disbursing Agency as "SPARSH PCDA (P)" and Agency as "SPARSH", not the legacy bank.',
      fallbackChannel: SUBMISSION_MODE.CITIZEN_SERVICE_CENTRE,
    };
  }

  if (codeLower.includes('biometric') || codeLower.includes('fingerprint') || codeLower.includes('scanner')) {
    return {
      cause: 'Faded epidermal ridges in elderly pensioners causing sensor timeout.',
      solution: 'Clean fingers and sensor glass with dry cloth. If fingerprint fails repeatedly, switch to FaceRD mobile app or Iris scanner.',
      fallbackChannel: SUBMISSION_MODE.DIGITAL_FACE_AUTHENTICATION,
    };
  }

  if (codeLower.includes('ppo') || codeLower.includes('mismatch')) {
    return {
      cause: 'PPO number format mismatch or bank account digits divergent from treasury master.',
      solution: 'Verify exact 12-digit PPO number from recent pension slip or Form 16. Do not include slashes or spaces.',
      fallbackChannel: SUBMISSION_MODE.BANK_BRANCH_PHYSICAL,
    };
  }

  return {
    cause: 'General network timeout or server congestion on Jeevan Pramaan gateway.',
    solution: 'Retry outside peak hours (early morning or late evening), or book doorstep DLC service via Postman.',
    fallbackChannel: SUBMISSION_MODE.POSTMAN_DOORSTEP_DLC,
  };
}

/**
 * Builds a family-helper readiness checklist for an elderly relative without asking for private data.
 *
 * @param {object} readinessContext
 * @returns {Array<object>} Checklist items
 */
export function generateFamilyHelperChecklist(readinessContext) {
  const items = [
    {
      step: 1,
      label: 'Identify Exact PPO Number & Sanctioning Authority',
      note: `Verify from latest pension passbook. Pathway: ${readinessContext.pensionSchemeName || 'Central/State'}.`,
      isDone: false,
    },
    {
      step: 2,
      label: 'Check Mobile Number Linked to Aadhaar',
      note: 'Ensure phone receiving UIDAI OTP is charged and active with the pensioner.',
      isDone: false,
    },
    {
      step: 3,
      label: 'Select Submission Method',
      note: 'Recommended: Aadhaar FaceRD app on Android/iPhone (free) or Postman Doorstep service (nominal ₹50 fee).',
      isDone: false,
    },
    {
      step: 4,
      label: 'Download Pramaan Certificate Acknowledgement',
      note: 'Save Pramaan ID (10-digit number) received via SMS post successful scan.',
      isDone: false,
    },
    {
      step: 5,
      label: 'Verify Acceptance with Bank / SPARSH within 48 Hours',
      note: `Check status on official disbursing portal: ${readinessContext.trackingPortal || 'PDA portal'}.`,
      isDone: false,
    },
  ];

  return items;
}

/**
 * Validates Pramaan ID format and generates verification status lookup link.
 *
 * @param {string} pramaanId 10-digit numeric DLC identifier
 * @returns {{ isValid: boolean, formattedId: string|null, lookupUrl: string }}
 */
export function formatPramaanLookup(pramaanId = '') {
  const clean = String(pramaanId).replace(/[^0-9]/g, '');
  const isValid = clean.length === 10;

  return {
    isValid,
    formattedId: isValid ? clean : null,
    lookupUrl: 'https://jeevanpramaan.gov.in/ppouser/login',
    instructions:
      'Enter the 10-digit Pramaan ID received on your registered mobile to view and print your digitally signed Life Certificate PDF.',
  };
}

/**
 * Exports printable family-helper pension readiness guide.
 *
 * @param {object} readinessContext
 * @returns {string} Markdown dossier
 */
export function exportPensionReadinessGuide(readinessContext) {
  const checklist = generateFamilyHelperChecklist(readinessContext);

  const steps = checklist.map((s) => {
    return `${s.step}. **${s.label}**\n   ${s.note}`;
  });

  return `# Pension Life-Certificate Readiness Guide
**Pension Scheme**: ${readinessContext.pensionSchemeName}
**Disbursing Authority**: ${readinessContext.disbursingAuthority}
**Submission Window**: ${readinessContext.activeWindowDescription} (Window Active: ${readinessContext.submissionWindowActive ? 'YES' : 'NO'})

### Actionable Readiness Steps for Pensioner & Caregivers
${steps.join('\n\n')}

---
### Failure Prevention & Diagnostic Support
- For camera/FaceRD lighting errors: Ensure face is evenly lit with zero backlight.
- For SPARSH defence pensioners: Ensure PDA selected is "SPARSH (PCDA Defence)".
- For fingerprint timeout: Request IPPB Postman doorstep visit or use FaceRD app.

> 🔒 **Security Notice**:
> ${readinessContext.disclaimer || PENSION_DISCLAIMER}
`;
}
