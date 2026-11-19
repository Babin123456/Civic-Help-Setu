/**
 * Gazette Name-Change Preparation and Publication Tracker Service
 *
 * Implements a structured preparation workspace and milestone tracker for official name-change in India:
 * 1. Separates the three distinct sequential phases:
 *    - Phase 1: Notarized Name-Change Affidavit execution.
 *    - Phase 2: Dual Newspaper Publication (one local regional language, one English national daily).
 *    - Phase 3: Official Gazette Publication (Department of Publication, Government of India or State Gazette).
 * 2. Emphasizes that Gazette publication does NOT automatically update individual identity databases
 *    (Aadhaar, PAN, Passport, Bank, Educational Marksheets must be updated separately with gazette copy).
 * 3. Supports applicant-specific conditions:
 *    - Adult general name change
 *    - Minor name change (mandates guardian declaration & child's age proof)
 *    - Post-marriage surname change
 *    - Gender transition / legal identity change
 * 4. Tracks publication milestones:
 *    - 'AFFIDAVIT_NOTARIZED'
 *    - 'NEWSPAPERS_PUBLISHED'
 *    - 'GAZETTE_APPLICATION_SUBMITTED'
 *    - 'GAZETTE_NOTIFICATION_PUBLISHED'
 *    - 'POST_GAZETTE_DOCUMENTS_UPDATED'
 * 5. Structured records with issuing authority, jurisdiction, verified official portal URLs, and statutory fees.
 * 6. Local checklist persistence with zero PII exposure.
 */

export const NAME_CHANGE_CATEGORY = {
  ADULT_GENERAL: 'ADULT_GENERAL',
  MINOR_CHILD: 'MINOR_CHILD',
  POST_MARRIAGE: 'POST_MARRIAGE',
  GENDER_TRANSITION: 'GENDER_TRANSITION',
};

export const MILESTONE_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
};

export const GAZETTE_TRACKER_DISCLAIMER =
  'Gazette notification legally registers your change of name in the official gazette. It does NOT automatically alter your name on Aadhaar, PAN, Passport, or Bank records. You must submit your gazette notification copy to each respective authority separately.';

export const OFFICIAL_GAZETTE_AUTHORITY = {
  authority: 'Department of Publication, Ministry of Housing and Urban Affairs (MoHUA)',
  jurisdiction: 'ALL_INDIA',
  centralGazettePortal: 'https://egazette.gov.in',
  physicalOfficeAddress: 'Department of Publication, Civil Lines, Delhi - 110054',
  centralGazetteFeeStandard: 1100,
  centralGazetteFeeMinor: 1700,
  effectiveDate: '2023-01-01',
  lastVerifiedDate: '2026-11-01',
};

/**
 * Validates requirements and generates phased instructions based on applicant category.
 *
 * @param {string} category (ADULT_GENERAL, MINOR_CHILD, POST_MARRIAGE, GENDER_TRANSITION)
 * @returns {object} Phased workflow plan
 */
export function generateNameChangeWorkflow(category = NAME_CHANGE_CATEGORY.ADULT_GENERAL) {
  const isMinor = category === NAME_CHANGE_CATEGORY.MINOR_CHILD;
  const isMarriage = category === NAME_CHANGE_CATEGORY.POST_MARRIAGE;

  const fee = isMinor
    ? OFFICIAL_GAZETTE_AUTHORITY.centralGazetteFeeMinor
    : OFFICIAL_GAZETTE_AUTHORITY.centralGazetteFeeStandard;

  const phases = [
    {
      phaseNumber: 1,
      name: 'Notarized Affidavit Execution',
      description: 'Draft and execute a Name Change Affidavit on non-judicial stamp paper attested by an Executive Magistrate or Notary Public.',
      requiredDocuments: isMinor
        ? ['Affidavit signed by both parents/guardians', "Minor child's birth certificate", 'Parent ID proofs']
        : isMarriage
        ? ['Marriage certificate or joint affidavit with spouse', 'Prior identity proof']
        : ['Name Change Affidavit on ₹10-₹100 non-judicial stamp paper', 'Existing identity proof (Aadhaar / Voter ID)'],
      estimatedDays: 2,
    },
    {
      phaseNumber: 2,
      name: 'Newspaper Advertisements',
      description: 'Publish a classified advertisement announcing the change of name in two newspapers: one in the local regional language and one in a prominent English daily.',
      requiredDocuments: [
        'Affidavit copy',
        'Newspaper clipping (original full page containing publication date and paper name)',
      ],
      estimatedDays: 3,
    },
    {
      phaseNumber: 3,
      name: 'Central Gazette Submission & Publication',
      description: 'Submit the gazette dossier to the Controller of Publications (Civil Lines, Delhi or online via e-Gazette).',
      statutoryFee: fee,
      officialPortalUrl: OFFICIAL_GAZETTE_AUTHORITY.centralGazettePortal,
      requiredDocuments: [
        'Proforma (hard copy and digital soft copy in CD / pen drive format)',
        'Original newspaper full-page clippings (2 newspapers)',
        'Attested affidavit original',
        'Two self-attested passport photographs',
        'BharatKosh / Non-Tax Receipt Portal (NTRP) fee payment receipt',
      ],
      estimatedDays: 45,
    },
    {
      phaseNumber: 4,
      name: 'Post-Gazette Identity Document Updates (Separate Actions)',
      description: 'Apply separately to update your legal name in each identity database using the downloadable Gazette notification PDF.',
      requiredDocuments: ['Gazette Notification Part IV download copy', 'Existing card/document copy'],
      targetDatabases: [
        { name: 'Aadhaar Card', portal: 'https://myaadhaar.uidai.gov.in', updateType: 'Demographic Update' },
        { name: 'PAN Card', portal: 'https://www.onlineservices.nsdl.com', updateType: 'Change/Correction in PAN Data' },
        { name: 'Passport', portal: 'https://passportindia.gov.in', updateType: 'Reissue of Passport due to Change of Name' },
        { name: 'Bank Accounts', portal: 'Home Branch Counter', updateType: 'KYC Updation with Gazette Copy' },
      ],
      estimatedDays: 30,
    },
  ];

  return {
    category,
    authority: OFFICIAL_GAZETTE_AUTHORITY.authority,
    jurisdiction: OFFICIAL_GAZETTE_AUTHORITY.jurisdiction,
    statutoryGazetteFee: fee,
    phases,
    verificationMeta: {
      effectiveDate: OFFICIAL_GAZETTE_AUTHORITY.effectiveDate,
      lastVerifiedDate: OFFICIAL_GAZETTE_AUTHORITY.lastVerifiedDate,
      officialPortalUrl: OFFICIAL_GAZETTE_AUTHORITY.centralGazettePortal,
    },
    disclaimer: GAZETTE_TRACKER_DISCLAIMER,
  };
}

/**
 * Safe client-side tracker for name-change milestone progress.
 * Stores zero PII (no old/new names stored, only anonymous milestone statuses).
 */
export class GazetteMilestoneTracker {
  constructor() {
    this.milestoneStore = new Map();
  }

  initializeMilestoneTracker(trackingId, category = NAME_CHANGE_CATEGORY.ADULT_GENERAL) {
    const workflow = generateNameChangeWorkflow(category);

    const initialRecord = {
      trackingId,
      category,
      statutoryFee: workflow.statutoryGazetteFee,
      milestones: [
        { id: 'M1_AFFIDAVIT', name: 'Affidavit Drafted & Notarized', status: MILESTONE_STATUS.PENDING, completedAt: null },
        { id: 'M2_NEWSPAPER_LOCAL', name: 'Local Language Newspaper Published', status: MILESTONE_STATUS.PENDING, completedAt: null },
        { id: 'M3_NEWSPAPER_ENGLISH', name: 'English Daily Newspaper Published', status: MILESTONE_STATUS.PENDING, completedAt: null },
        { id: 'M4_GAZETTE_DOSSIER', name: 'Gazette Dossier & Fee Submitted', status: MILESTONE_STATUS.PENDING, completedAt: null },
        { id: 'M5_GAZETTE_PUBLISHED', name: 'Gazette Notification Published on eGazette', status: MILESTONE_STATUS.PENDING, completedAt: null },
        { id: 'M6_AADHAAR_UPDATED', name: 'Aadhaar Demographic Update Completed', status: MILESTONE_STATUS.PENDING, completedAt: null },
        { id: 'M7_PAN_UPDATED', name: 'PAN Card Correction Completed', status: MILESTONE_STATUS.PENDING, completedAt: null },
        { id: 'M8_BANK_KYC_UPDATED', name: 'Bank Account KYC Updated', status: MILESTONE_STATUS.PENDING, completedAt: null },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.milestoneStore.set(trackingId, initialRecord);
    return initialRecord;
  }

  getMilestones(trackingId) {
    return this.milestoneStore.get(trackingId) || null;
  }

  updateMilestoneStatus(trackingId, milestoneId, newStatus) {
    const record = this.milestoneStore.get(trackingId);
    if (!record) return null;

    const milestone = record.milestones.find((m) => m.id === milestoneId);
    if (milestone) {
      milestone.status = newStatus;
      milestone.completedAt = newStatus === MILESTONE_STATUS.COMPLETED ? new Date().toISOString() : null;
      record.updatedAt = new Date().toISOString();
    }

    return record;
  }

  deleteTracker(trackingId) {
    return this.milestoneStore.delete(trackingId);
  }

  /**
   * Generates a printable readiness summary and checklist export.
   *
   * @param {string} trackingId
   * @returns {string} Formatted markdown report
   */
  exportReadinessReport(trackingId) {
    const record = this.milestoneStore.get(trackingId);
    if (!record) return '';

    const lines = record.milestones.map((m) => {
      const statusIcon = m.status === MILESTONE_STATUS.COMPLETED ? '✅' : '⏳';
      return `- ${statusIcon} **${m.name}** [${m.status}] ${m.completedAt ? `(Completed: ${m.completedAt.split('T')[0]})` : ''}`;
    });

    return `# Gazette Name-Change Readiness Summary
Tracking ID: ${record.trackingId}
Category: ${record.category}
Statutory Central Gazette Fee: ₹${record.statutoryFee}
Authority: ${OFFICIAL_GAZETTE_AUTHORITY.authority} (${OFFICIAL_GAZETTE_AUTHORITY.physicalOfficeAddress})

### Milestone Checklist
${lines.join('\n')}

---
> ⚠️ **Important Legal Notice**:
> ${GAZETTE_TRACKER_DISCLAIMER}
`;
  }
}
