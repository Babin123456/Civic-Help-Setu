/**
 * Public Digital Service Centre Verification and Visit Feedback Directory Service
 * 
 * Provides verified discovery and integrity checking for public digital service points:
 * - Common Service Centres (CSC 2.0 / 3.0 VLE - Village Level Entrepreneurs)
 * - State Kiosks (e-Mitra Rajasthan, MeeSeva AP/Telangana, Maha e-Seva, Banglar Sahayata Kendra)
 * - Post Office Aadhaar & Passport Seva Kendras (POPSK)
 * 
 * Features:
 * - Official Kendra ID verification & rate chart lookup
 * - Statutory fee vs. Notified facilitation fee transparency (preventing overcharging)
 * - Privacy-safe visit feedback collection (zero PII storage, moderated rate compliance reporting)
 * - Grievance routing for unauthorized kiosks or illegal fee demands
 */

export const SERVICE_CENTRE_TYPES = {
  CSC_VLE: {
    code: 'CSC_VLE',
    name: 'Common Service Centre (CSC / Digital Seva Kendra)',
    governance: 'CSC e-Governance Services India Limited (MeitY)',
    maxFacilitationFee: 30
  },
  STATE_KIOSK: {
    code: 'STATE_KIOSK',
    name: 'State Public Service Kiosk (e-Mitra / MeeSeva / BSK)',
    governance: 'State Electronic Delivery of Services (EDS) Directorate',
    maxFacilitationFee: 25
  },
  POST_OFFICE_SEVA: {
    code: 'POST_OFFICE_SEVA',
    name: 'Department of Posts Citizen Seva Kendra',
    governance: 'India Post / Ministry of Communications',
    maxFacilitationFee: 0 // strictly prescribed by Dept of Posts
  }
};

export const NOTIFIED_SERVICE_FEES = {
  AADHAAR_MANDATORY_BIOMETRIC: { govtFee: 0, maxKioskFee: 0, label: 'Aadhaar Biometric Update (Age 5 & 15)' },
  AADHAAR_DEMOGRAPHIC_UPDATE: { govtFee: 50, maxKioskFee: 0, label: 'Aadhaar Demographic Update (Name/Address/DOB)' },
  AADHAAR_BIOMETRIC_UPDATE: { govtFee: 100, maxKioskFee: 0, label: 'Aadhaar Demographic + Biometric Update' },
  PAN_APPLICATION: { govtFee: 107, maxKioskFee: 30, label: 'New PAN Application / Correction (Form 49A)' },
  CERTIFICATE_APPLICATION: { govtFee: 20, maxKioskFee: 30, label: 'Income / Caste / Domicile Certificate Filing' },
  PM_KISAN_EKYC: { govtFee: 0, maxKioskFee: 15, label: 'PM-KISAN Biometric e-KYC' }
};

export const DEGS_ESCALATION_GUIDELINES = {
  authority: 'District e-Governance Society (DeGS) chaired by the District Magistrate / Collector',
  escalationSteps: [
    'Obtain transaction failure receipt or SMS showing timestamp and Kendra ID.',
    'Lodge formal grievance with DeGS District Project Manager (DPM).',
    'DeGS conducts spot inspection and issues show-cause notice within 7 days.',
    'Upon confirmation of overcharging, VLE security deposit is forfeited.'
  ]
};

/**
 * Returns formal escalation details for citizen redressal.
 * @returns {Object}
 */
export function getDegsEscalationMatrix() {
  return DEGS_ESCALATION_GUIDELINES;
}

export const CSC_COMPLIANCE_STANDARDS = [
  { item: 'Biometric Scanner / Iris Scanner certified by STQC', required: true },
  { item: 'Web camera and high-speed broadband connectivity', required: true },
  { item: 'Thermal receipt printer or laser printer for physical acknowledgments', required: true },
  { item: 'Ramp or ground-floor accessible facility for persons with disabilities', required: true },
  { item: 'Clean drinking water and citizen seating area', required: true }
];

export const CSC_HELPDESK_CONTACTS = {
  CSC_DIGITAL_INDIA: { tollFree: '14599', email: 'helpdesk@csc.gov.in' },
  UIDAI_AADHAAR: { tollFree: '1947', email: 'help@uidai.gov.in' }
};

/**
 * Validates physical and technical infrastructure readiness of a kiosk.
 * @param {Array<string>} activeEquipment 
 * @returns {Object} audit
 */
export function auditCentreInfrastructure(activeEquipment = []) {
  const missing = CSC_COMPLIANCE_STANDARDS.filter(
    std => std.required && !activeEquipment.includes(std.item.split(' ')[0].toLowerCase())
  );

  return {
    isFullyCompliant: missing.length === 0,
    missingStandards: missing,
    totalStandards: CSC_COMPLIANCE_STANDARDS.length,
    helpdesk: CSC_HELPDESK_CONTACTS
  };
}

/**
 * Validates a digital service centre profile and verifies rate compliance.
 * @param {Object} centreDetails 
 * @returns {Object} verification
 */
export function verifyServiceCentre(centreDetails = {}) {
  const errors = [];
  const warnings = [];

  if (!centreDetails.kendraId || centreDetails.kendraId.trim().length < 4) {
    errors.push('Official Centre / VLE ID (e.g. 12-digit CSC ID or State Kiosk ID) is required.');
  }

  if (!centreDetails.operatorName || centreDetails.operatorName.trim().length < 2) {
    errors.push('Registered Operator / VLE Name is required.');
  }

  const type = SERVICE_CENTRE_TYPES[centreDetails.centreType] || SERVICE_CENTRE_TYPES.CSC_VLE;

  if (!centreDetails.hasRateChartDisplayed) {
    warnings.push('Mandatory Requirement: Service point must display official government rate chart at a prominent location.');
  }

  return {
    isValidId: errors.length === 0,
    centreType: type,
    errors,
    warnings,
    isCompliant: errors.length === 0 && warnings.length === 0
  };
}

/**
 * Evaluates whether a fee charged at a digital centre complies with notified rates.
 * @param {string} serviceCode 
 * @param {number} chargedAmount 
 * @returns {Object} feeAudit
 */
export function auditKioskFeeCompliance(serviceCode, chargedAmount) {
  const service = NOTIFIED_SERVICE_FEES[serviceCode];
  if (!service) {
    return {
      isAudited: false,
      message: 'Unknown civic service code.'
    };
  }

  const permissibleMax = service.govtFee + service.maxKioskFee;
  const charged = Number(chargedAmount);

  if (isNaN(charged) || charged < 0) {
    return { isAudited: false, message: 'Invalid charged amount.' };
  }

  const isOvercharging = charged > permissibleMax;
  const excessAmount = isOvercharging ? charged - permissibleMax : 0;

  return {
    isAudited: true,
    serviceName: service.label,
    statutoryGovtFee: service.govtFee,
    maxPermissibleFee: permissibleMax,
    actualChargedFee: charged,
    isCompliant: !isOvercharging,
    isOvercharging,
    excessAmount,
    remedy: isOvercharging
      ? `Excess charge of ₹${excessAmount} detected. Ask operator for official computerized receipt. If denied, report to District e-Governance Society (DeGS).`
      : 'Fee is within official government notified limits.'
  };
}

/**
 * Validates and records citizen feedback while maintaining strict privacy.
 * @param {Object} feedbackData 
 * @returns {Object} processedFeedback
 */
export function processCentreFeedback(feedbackData = {}) {
  const errors = [];

  if (!feedbackData.kendraId) {
    errors.push('Kendra ID is required to associate feedback.');
  }

  if (!feedbackData.rating || Number(feedbackData.rating) < 1 || Number(feedbackData.rating) > 5) {
    errors.push('Rating must be a valid score between 1 and 5.');
  }

  // Strict PII check: citizen name/phone is not stored with public review
  const sanitizedFeedback = {
    feedbackId: 'fb_' + Math.random().toString(36).substring(2, 9),
    kendraId: feedbackData.kendraId ? feedbackData.kendraId.trim() : '',
    serviceCode: feedbackData.serviceCode || 'GENERAL',
    rating: Number(feedbackData.rating) || 5,
    operatorProvidedReceipt: Boolean(feedbackData.providedReceipt),
    overchargingReported: Boolean(feedbackData.overchargingReported),
    reviewRemarks: feedbackData.remarks ? feedbackData.remarks.substring(0, 200).trim() : '',
    submittedAt: new Date().toISOString()
  };

  return {
    success: errors.length === 0,
    errors,
    feedbackRecord: errors.length === 0 ? sanitizedFeedback : null
  };
}

/**
 * Exports centre visit checklist and rate chart summary in markdown.
 * @param {Object} centreDetails 
 * @returns {string} markdown
 */
export function exportCentreVisitDossier(centreDetails = {}) {
  const verification = verifyServiceCentre(centreDetails);

  return [
    `# Digital Service Centre (CSC / Kiosk) Verification Dossier`,
    `**Centre Name:** ${centreDetails.centreName || 'Digital Seva Kendra'}`,
    `**Kendra / VLE ID:** ${centreDetails.kendraId || 'N/A'}`,
    `**Operator:** ${centreDetails.operatorName || 'N/A'}`,
    `**Type:** ${verification.centreType.name}`,
    `**Governance Authority:** ${verification.centreType.governance}`,
    `**Compliance Status:** ${verification.isCompliant ? 'VERIFIED COMPLIANT' : 'SCRUTINY REQUIRED'}`,
    ``,
    `## Notified Citizen Service Rate Chart`,
    ...Object.values(NOTIFIED_SERVICE_FEES).map(
      s => `- **${s.label}:** Official ₹${s.govtFee} + Max Kiosk Fee ₹${s.maxKioskFee} = **Total Permissible: ₹${s.govtFee + s.maxKioskFee}**`
    ),
    ``,
    `## Citizen Rights at Service Centres`,
    `- **Mandatory Receipt:** The VLE / operator MUST generate an official computerized portal receipt for every transaction.`,
    `- **Rate Chart Display:** Centre must display bilingual printed rate charts approved by District Administration.`,
    `- **Grievance Reporting:** Overcharging or denial of receipt is grounds for cancellation of CSC ID by DeGS.`,
    ``,
    ...(verification.warnings.length > 0 ? [`## Important Observations`, ...verification.warnings.map(w => `- ⚠️ ${w}`)] : [])
  ].join('\n');
}
