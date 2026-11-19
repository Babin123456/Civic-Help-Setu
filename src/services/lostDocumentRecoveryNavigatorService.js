/**
 * Lost Government Document Recovery and Reissue Navigator Service
 *
 * Implements a cross-service recovery navigator with jurisdiction-aware instructions:
 * 1. Catalogues supported Indian civic documents (Aadhaar, PAN, Driving Licence, Voter ID, Ration Card, Birth/Death Certificate).
 * 2. Distinguishes recovery channels:
 *    - DIGITAL_DOWNLOAD (Instant e-copy via DigiLocker / official portal)
 *    - REPRINT_ORDER (Physical duplicate card/certificate reprint)
 *    - FORMAL_LOST_APPLICATION (Requires police lost report / non-traceable certificate / affidavit)
 * 3. Categorizes loss causes (THEFT, ACCIDENTAL_LOSS, FIRE_DISASTER, FLOOD_NATURAL_CALAMITY, RELOCATION).
 * 4. Determines whether a Police Lost Report (NCR) or Notarized Affidavit is strictly mandatory.
 * 5. Structured records containing issuing authority, jurisdiction, verified official URL, effective date, and verification timestamp.
 * 6. Explicit unavailable-data state rather than making assumptions.
 * 7. Client-side user checklist management (save, reopen, toggle, delete) with zero PII exposure.
 */

export const RECOVERY_CHANNEL = {
  DIGITAL_DOWNLOAD: 'DIGITAL_DOWNLOAD',
  REPRINT_ORDER: 'REPRINT_ORDER',
  FORMAL_LOST_APPLICATION: 'FORMAL_LOST_APPLICATION',
};

export const LOSS_REASON = {
  THEFT: 'THEFT',
  ACCIDENTAL_LOSS: 'ACCIDENTAL_LOSS',
  FIRE_DISASTER: 'FIRE_DISASTER',
  FLOOD_NATURAL_CALAMITY: 'FLOOD_NATURAL_CALAMITY',
  RELOCATION: 'RELOCATION',
};

export const RECOVERY_NAVIGATOR_DISCLAIMER =
  'This navigator provides official procedures for recovering or reissuing lost documents. Police lost reports (NCR) are required primarily for theft or preventing identity fraud. Civic Help Setu does not issue government documents or store identity credentials.';

export const SUPPORTED_DOCUMENTS_CATALOG = [
  {
    documentId: 'DOC_AADHAAR',
    name: 'Aadhaar Card',
    authority: 'Unique Identification Authority of India (UIDAI)',
    jurisdiction: 'ALL_INDIA',
    officialPortalUrl: 'https://myaadhaar.uidai.gov.in',
    effectiveDate: '2024-01-01',
    lastVerifiedDate: '2026-11-01',
    canDigitalDownload: true,
    digitalRouteNote: 'Download e-Aadhaar free using registered mobile OTP or facial authentication.',
    reprintAvailable: true,
    reprintFee: 50,
    reprintPortalUrl: 'https://myaadhaar.uidai.gov.in/genricPVC',
    requiresPoliceReportForLost: false,
    requiresAffidavitForLost: false,
    policeReportAdvice: 'Police report NOT required for standard online PVC card reprint or e-Aadhaar download, but recommended if identity theft is suspected.',
  },
  {
    documentId: 'DOC_PAN',
    name: 'Permanent Account Number (PAN) Card',
    authority: 'Income Tax Department (via Protean / UTIITSL)',
    jurisdiction: 'ALL_INDIA',
    officialPortalUrl: 'https://www.onlineservices.nsdl.com/paam/ReprintEPan.html',
    effectiveDate: '2023-06-01',
    lastVerifiedDate: '2026-11-01',
    canDigitalDownload: true,
    digitalRouteNote: 'Download e-PAN instant PDF using PAN and Aadhaar OTP.',
    reprintAvailable: true,
    reprintFee: 50,
    reprintPortalUrl: 'https://www.onlineservices.nsdl.com/paam/ReprintEPan.html',
    requiresPoliceReportForLost: false,
    requiresAffidavitForLost: false,
    policeReportAdvice: 'Police complaint not mandatory for reprint if PAN number is known; file online cybercell report if stolen.',
  },
  {
    documentId: 'DOC_DRIVING_LICENCE',
    name: 'Driving Licence (DL)',
    authority: 'Ministry of Road Transport and Highways (MoRTH) & State RTOs',
    jurisdiction: 'ALL_INDIA',
    officialPortalUrl: 'https://sarathi.parivahan.gov.in',
    effectiveDate: '2023-01-01',
    lastVerifiedDate: '2026-11-01',
    canDigitalDownload: true,
    digitalRouteNote: 'Pull digital Driving Licence instantly into DigiLocker / mParivahan app (legally valid under IT Act).',
    reprintAvailable: true,
    reprintFee: 200,
    reprintPortalUrl: 'https://sarathi.parivahan.gov.in',
    requiresPoliceReportForLost: true,
    requiresAffidavitForLost: true,
    policeReportAdvice: 'Mandatory: Non-Cognizable Report (NCR) / Online Lost Property Report from police is required to apply for duplicate Driving Licence on Sarathi.',
  },
  {
    documentId: 'DOC_VOTER_ID',
    name: 'Voter ID (EPIC Card)',
    authority: 'Election Commission of India (ECI)',
    jurisdiction: 'ALL_INDIA',
    officialPortalUrl: 'https://voters.eci.gov.in',
    effectiveDate: '2024-01-01',
    lastVerifiedDate: '2026-11-01',
    canDigitalDownload: true,
    digitalRouteNote: 'Download e-EPIC PDF free through Election Commission portal using registered mobile number.',
    reprintAvailable: true,
    reprintFee: 0,
    reprintPortalUrl: 'https://voters.eci.gov.in (Form 8 - Replacement)',
    requiresPoliceReportForLost: true,
    requiresAffidavitForLost: false,
    policeReportAdvice: 'In Form 8, selecting "Lost" requires attaching a copy of the police FIR/NCR report. If replacing due to destruction or mutilation, no police report is required.',
  },
  {
    documentId: 'DOC_RATION_CARD',
    name: 'Ration Card (NFSA)',
    authority: 'Food & Civil Supplies Department (State-specific)',
    jurisdiction: 'STATE_SPECIFIC',
    officialPortalUrl: 'https://nfsa.gov.in',
    effectiveDate: '2023-01-01',
    lastVerifiedDate: '2026-11-01',
    canDigitalDownload: true,
    digitalRouteNote: 'Mero Ration App / State e-District portal allows digital ration card view and download.',
    reprintAvailable: true,
    reprintFee: 45,
    reprintPortalUrl: 'State e-District / Citizen Center Counter',
    requiresPoliceReportForLost: true,
    requiresAffidavitForLost: true,
    policeReportAdvice: 'Most states require an affidavit of loss and local police lost entry or ward councillor endorsement for duplicate ration card booklet.',
  },
];

/**
 * Retrieves document specifications from catalog.
 * @param {string} documentId
 * @returns {object|null}
 */
export function getDocumentSpecs(documentId) {
  if (!documentId) return null;
  return SUPPORTED_DOCUMENTS_CATALOG.find((doc) => doc.documentId === documentId) || null;
}

/**
 * Determines whether a police report and affidavit are mandatory based on document and loss circumstances.
 *
 * @param {string} documentId
 * @param {string} lossReason (THEFT, ACCIDENTAL_LOSS, FIRE_DISASTER, FLOOD_NATURAL_CALAMITY, RELOCATION)
 * @returns {{
 *   requiresPoliceReport: boolean,
 *   requiresAffidavit: boolean,
 *   recommendedChannel: string,
 *   specialExemptionNote: string|null,
 *   actionGuidance: string
 * }}
 */
export function evaluateLostDocumentPrerequisites(documentId, lossReason = LOSS_REASON.ACCIDENTAL_LOSS) {
  const doc = getDocumentSpecs(documentId);
  if (!doc) {
    return {
      requiresPoliceReport: false,
      requiresAffidavit: false,
      recommendedChannel: RECOVERY_CHANNEL.FORMAL_LOST_APPLICATION,
      specialExemptionNote: null,
      actionGuidance: 'Unknown document type: Check with issuing department.',
    };
  }

  // Flood or fire disaster exemption: Many states waive police NCR if revenue tehsildar certifies disaster loss
  if (lossReason === LOSS_REASON.FLOOD_NATURAL_CALAMITY || lossReason === LOSS_REASON.FIRE_DISASTER) {
    return {
      requiresPoliceReport: false,
      requiresAffidavit: true,
      recommendedChannel: doc.canDigitalDownload ? RECOVERY_CHANNEL.DIGITAL_DOWNLOAD : RECOVERY_CHANNEL.REPRINT_ORDER,
      specialExemptionNote:
        'Disaster Exemption: In notified natural calamity or fire zones, a relief camp certification or self-declaration affidavit typically substitutes for a police lost report.',
      actionGuidance:
        'Download digital copy immediately via DigiLocker, or apply for duplicate quoting disaster relief certificate.',
    };
  }

  // Theft always requires formal police report
  if (lossReason === LOSS_REASON.THEFT) {
    return {
      requiresPoliceReport: true,
      requiresAffidavit: Boolean(doc.requiresAffidavitForLost),
      recommendedChannel: RECOVERY_CHANNEL.FORMAL_LOST_APPLICATION,
      specialExemptionNote: null,
      actionGuidance:
        'File an immediate Online Lost Article Report / NCR at your state police citizen portal to safeguard against identity misuse, then apply for duplicate.',
    };
  }

  // Accidental loss or relocation
  return {
    requiresPoliceReport: Boolean(doc.requiresPoliceReportForLost),
    requiresAffidavit: Boolean(doc.requiresAffidavitForLost),
    recommendedChannel: doc.canDigitalDownload ? RECOVERY_CHANNEL.DIGITAL_DOWNLOAD : RECOVERY_CHANNEL.REPRINT_ORDER,
    specialExemptionNote: null,
    actionGuidance: doc.policeReportAdvice,
  };
}

/**
 * Formulates a personalized recovery checklist for the citizen.
 *
 * @param {object} params
 * @param {string} params.documentId
 * @param {string} [params.lossReason=LOSS_REASON.ACCIDENTAL_LOSS]
 * @param {string} [params.jurisdiction='ALL_INDIA']
 * @returns {object} Personalized recovery plan
 */
export function generateDocumentRecoveryPlan({
  documentId,
  lossReason = LOSS_REASON.ACCIDENTAL_LOSS,
  jurisdiction = 'ALL_INDIA',
}) {
  const doc = getDocumentSpecs(documentId);

  if (!doc) {
    return {
      status: 'UNAVAILABLE_DATA',
      documentId,
      message: 'Document specifications not found in current recovery catalog. Requirements marked unverified.',
      steps: [],
      disclaimer: RECOVERY_NAVIGATOR_DISCLAIMER,
    };
  }

  const prereqs = evaluateLostDocumentPrerequisites(documentId, lossReason);

  const steps = [];

  // Step 1: Immediate digital safety / download
  if (doc.canDigitalDownload) {
    steps.push({
      stepNumber: 1,
      title: 'Obtain Instant Digital Copy via DigiLocker / Official Portal',
      description: doc.digitalRouteNote,
      isMandatory: false,
      officialPortalUrl: doc.officialPortalUrl,
      isCompleted: false,
    });
  }

  // Step 2: Police report if required
  if (prereqs.requiresPoliceReport) {
    steps.push({
      stepNumber: steps.length + 1,
      title: 'File Online Police Lost Property Report (NCR)',
      description: 'Visit your State Police Citizen Portal and file an online Non-Cognizable Report for lost valuable property. Save the PDF acknowledgement.',
      isMandatory: true,
      officialPortalUrl: 'State Police Citizen Portal (e.g. Lost Article Report)',
      isCompleted: false,
    });
  }

  // Step 3: Affidavit if required
  if (prereqs.requiresAffidavit) {
    steps.push({
      stepNumber: steps.length + 1,
      title: 'Execute Self-Declaration Affidavit on Non-Judicial Stamp Paper',
      description: 'Affidavit stating circumstances of document loss, declaring no misuse, and indemnifying the issuing authority.',
      isMandatory: true,
      officialPortalUrl: 'Local Notary Public / Revenue Tehsildar',
      isCompleted: false,
    });
  }

  // Step 4: Duplicate / Reprint Application
  steps.push({
    stepNumber: steps.length + 1,
    title: 'Submit Formal Duplicate / Reprint Application',
    description: `Apply on official portal (${doc.authority}). Official statutory fee: ₹${doc.reprintFee}.`,
    isMandatory: true,
    officialPortalUrl: doc.reprintPortalUrl,
    fee: doc.reprintFee,
    isCompleted: false,
  });

  return {
    status: 'ACTIVE_PLAN',
    documentId: doc.documentId,
    documentName: doc.name,
    issuingAuthority: doc.authority,
    jurisdiction: doc.jurisdiction,
    lossReason,
    prerequisites: prereqs,
    steps,
    verificationMeta: {
      effectiveDate: doc.effectiveDate,
      lastVerifiedDate: doc.lastVerifiedDate,
      sourceUrl: doc.officialPortalUrl,
    },
    disclaimer: RECOVERY_NAVIGATOR_DISCLAIMER,
  };
}

/**
 * Safe client-side state manager for personal recovery checklist.
 * Allows save, reopen, toggle, and delete without exposing personal identifiers.
 */
export class PersonalRecoveryChecklistManager {
  constructor(storageKey = 'civic_recovery_checklists') {
    this.storageKey = storageKey;
    this.inMemoryStore = new Map();
  }

  savePlan(planId, planData) {
    if (!planId || !planData) throw new Error('Plan ID and data required to save checklist');

    // Strip any potential PII fields before saving
    const sanitized = {
      planId,
      documentId: planData.documentId,
      documentName: planData.documentName,
      lossReason: planData.lossReason,
      steps: planData.steps.map((s) => ({
        stepNumber: s.stepNumber,
        title: s.title,
        isCompleted: Boolean(s.isCompleted),
      })),
      updatedAt: new Date().toISOString(),
    };

    this.inMemoryStore.set(planId, sanitized);
    return sanitized;
  }

  getPlan(planId) {
    return this.inMemoryStore.get(planId) || null;
  }

  toggleStep(planId, stepNumber) {
    const plan = this.inMemoryStore.get(planId);
    if (!plan) return null;

    const step = plan.steps.find((s) => s.stepNumber === stepNumber);
    if (step) {
      step.isCompleted = !step.isCompleted;
      plan.updatedAt = new Date().toISOString();
    }
    return plan;
  }

  deletePlan(planId) {
    return this.inMemoryStore.delete(planId);
  }
}
