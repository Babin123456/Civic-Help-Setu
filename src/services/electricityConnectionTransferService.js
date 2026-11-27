/**
 * Electricity Connection and Consumer-Name Transfer Guide Service
 *
 * Implements a state-DISCOM-aware guide for electricity utilities:
 * 1. Categorizes primary consumer workflows:
 *    - NEW_CONNECTION (Fresh meter installation for new building or tenant partition)
 *    - NAME_TRANSFER (Ownership change via property purchase or legal inheritance)
 *    - LOAD_CHANGE (Sanctioned load enhancement or reduction in kW)
 *    - PERMANENT_DISCONNECTION (Meter surrender & final bill settlement)
 * 2. Indexes major Indian State Electricity Distribution Companies (DISCOMs):
 *    - BESCOM (Bangalore Electricity Supply Company - Karnataka)
 *    - MSEDCL / Mahavitaran (Maharashtra State Electricity Distribution Co Ltd)
 *    - TATA_POWER_DELHI / BSES (Delhi Discoms)
 *    - TANGEDCO (Tamil Nadu Generation and Distribution Corporation)
 *    - UPPCL (Uttar Pradesh Power Corporation Ltd)
 * 3. Delineates required evidence:
 *    - Ownership sale deed / Registered gift deed
 *    - Legal heir certificate / Death certificate (for inheritance name change)
 *    - Registered tenant lease agreement + Owner NOC (for tenant sub-metering)
 *    - Latest electricity bill with zero outstanding arrears
 * 4. Breaks down utility fee heads:
 *    - Security Deposit / Consumption Deposit (Refundable)
 *    - Service Line cum Development charges
 *    - Meter testing / installation fee
 * 5. Milestone tracking & grievance redressal (Consumer Grievance Redressal Forum - CGRF / Ombudsman).
 */

export const ELECTRICITY_JOURNEY = {
  NEW_CONNECTION: 'NEW_CONNECTION',
  NAME_TRANSFER: 'NAME_TRANSFER',
  LOAD_CHANGE: 'LOAD_CHANGE',
  PERMANENT_DISCONNECTION: 'PERMANENT_DISCONNECTION',
};

export const DISCOM_ID = {
  BESCOM_KARNATAKA: 'BESCOM_KARNATAKA',
  MAHADISCOM_MAHARASHTRA: 'MAHADISCOM_MAHARASHTRA',
  BSES_DELHI: 'BSES_DELHI',
  GENERIC_DISCOM: 'GENERIC_DISCOM',
};

export const ELECTRICITY_DISCLAIMER =
  'Electricity tariffs, security deposit slabs, and line extension fees are regulated by State Electricity Regulatory Commissions (SERC). All payments must be made directly on the official DISCOM portal or sub-divisional counter.';

export const DISCOM_CATALOG = {
  BESCOM_KARNATAKA: {
    discomId: 'BESCOM_KARNATAKA',
    name: 'Bangalore Electricity Supply Company Limited (BESCOM)',
    state: 'Karnataka',
    jurisdiction: 'KARNATAKA',
    officialPortalUrl: 'https://bescom.karnataka.gov.in',
    cgrfPortalUrl: 'https://kerc.karnataka.gov.in',
    effectiveDate: '2023-04-01',
    lastVerifiedDate: '2026-11-01',
    domesticSecurityDepositPerKw: 2500,
    serviceLineChargesBase: 1500,
    nameTransferProcessingFee: 100,
  },
  MAHADISCOM_MAHARASHTRA: {
    discomId: 'MAHADISCOM_MAHARASHTRA',
    name: 'Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL / Mahavitaran)',
    state: 'Maharashtra',
    jurisdiction: 'MAHARASHTRA',
    officialPortalUrl: 'https://wss.mahadiscom.in',
    cgrfPortalUrl: 'https://www.merc.gov.in',
    effectiveDate: '2023-04-01',
    lastVerifiedDate: '2026-11-01',
    domesticSecurityDepositPerKw: 2000,
    serviceLineChargesBase: 1200,
    nameTransferProcessingFee: 150,
  },
  BSES_DELHI: {
    discomId: 'BSES_DELHI',
    name: 'BSES Rajdhani / Yamuna Power Limited',
    state: 'Delhi NCT',
    jurisdiction: 'DELHI_NCT',
    officialPortalUrl: 'https://www.bsesdelhi.com',
    cgrfPortalUrl: 'https://www.derc.gov.in',
    effectiveDate: '2024-01-01',
    lastVerifiedDate: '2026-11-01',
    domesticSecurityDepositPerKw: 1500,
    serviceLineChargesBase: 1000,
    nameTransferProcessingFee: 50,
  },
};

/**
 * Retrieves DISCOM metadata.
 * @param {string} discomId
 * @returns {object} DISCOM specification
 */
export function getDiscomSpecs(discomId = DISCOM_ID.BESCOM_KARNATAKA) {
  return (
    DISCOM_CATALOG[discomId] || {
      discomId: 'GENERIC_DISCOM',
      name: 'State Electricity Distribution Company',
      state: 'State Discom Area',
      jurisdiction: 'ALL_INDIA',
      officialPortalUrl: 'State Energy / DISCOM Web Portal',
      cgrfPortalUrl: 'State Electricity Regulatory Commission Desk',
      effectiveDate: '2023-01-01',
      lastVerifiedDate: '2026-11-01',
      domesticSecurityDepositPerKw: 2000,
      serviceLineChargesBase: 1200,
      nameTransferProcessingFee: 100,
    }
  );
}

/**
 * Formulates an electricity connection or transfer preparation guide.
 *
 * @param {object} params
 * @param {string} params.journey (NEW_CONNECTION, NAME_TRANSFER, LOAD_CHANGE, PERMANENT_DISCONNECTION)
 * @param {string} params.discomId
 * @param {object} [params.details] { loadKw, isInheritance, isTenant, existingConsumerNumber }
 * @returns {object} Actionable utility guide
 */
export function generateElectricityGuide({
  journey = ELECTRICITY_JOURNEY.NEW_CONNECTION,
  discomId = DISCOM_ID.BESCOM_KARNATAKA,
  details = {},
}) {
  const discom = getDiscomSpecs(discomId);
  const { loadKw = 2, isInheritance = false, isTenant = false } = details;

  const isNew = journey === ELECTRICITY_JOURNEY.NEW_CONNECTION;
  const isTransfer = journey === ELECTRICITY_JOURNEY.NAME_TRANSFER;
  const isDisconnect = journey === ELECTRICITY_JOURNEY.PERMANENT_DISCONNECTION;

  // Fee calculation
  const securityDeposit = isDisconnect
    ? 0
    : isTransfer
    ? discom.nameTransferProcessingFee
    : loadKw * discom.domesticSecurityDepositPerKw;

  const serviceLineCharge = isNew ? discom.serviceLineChargesBase : 0;

  // Evidence Checklist
  const evidenceChecklist = [];

  if (isNew) {
    evidenceChecklist.push(
      { document: 'Registered Sale Deed / Property Tax Paid Receipt', details: 'Proof of legal ownership of premises', isMandatory: true },
      { document: 'Applicant Identity & Address Proof', details: 'Aadhaar / Voter ID / Passport of applicant', isMandatory: true },
      { document: 'Licensed Electrical Contractor Wiring Certificate', details: 'Test report certifying internal domestic electrical installation', isMandatory: true }
    );
  } else if (isTransfer) {
    evidenceChecklist.push(
      { document: 'Latest Electricity Bill with Zero Arrears', details: 'Paid receipt proving no pending electricity dues', isMandatory: true },
      { document: 'Applicant Identity Proof', details: 'Aadhaar / PAN of new consumer', isMandatory: true }
    );

    if (isInheritance) {
      evidenceChecklist.push(
        { document: 'Death Certificate of Prior Consumer', details: 'Municipal death record', isMandatory: true },
        { document: 'Legal Heir Certificate / Succession Proof', details: 'Revenue Tehsildar certificate or registered family partition', isMandatory: true }
      );
    } else {
      evidenceChecklist.push(
        { document: 'Registered Sale Deed / Conveyance Deed', details: 'Proof of transfer of title to new owner', isMandatory: true },
        { document: 'Prior Owner Consent / NOC (Form U)', details: 'NOC from previous registered consumer or indemnity bond', isMandatory: true }
      );
    }
  }

  if (isTenant) {
    evidenceChecklist.push({
      document: 'Registered Tenancy Agreement & Landlord NOC',
      details: 'Unconditional NOC from property owner consenting to connection in tenant name',
      isMandatory: true,
    });
  }

  // Milestones
  const milestones = [
    { step: 1, name: 'Online Application & Consumer Reference Generation', estimatedDays: 2 },
    { step: 2, name: 'Sub-Divisional Field Inspection & Meter Feasibility', estimatedDays: 5 },
    { step: 3, name: 'Demand Note Payment (Security Deposit & Service Charges)', estimatedDays: 3 },
    { step: 4, name: isTransfer ? 'Approval of Name Transfer & Meter Transfer Endorsement' : 'Meter Installation & Supply Energization', estimatedDays: 7 },
  ];

  return {
    journey,
    discomName: discom.name,
    jurisdiction: discom.jurisdiction,
    officialPortalUrl: discom.officialPortalUrl,
    cgrfPortalUrl: discom.cgrfPortalUrl,
    estimatedFeeBreakdown: {
      depositOrFee: securityDeposit,
      serviceLineCharges: serviceLineCharge,
      estimatedTotal: securityDeposit + serviceLineCharge,
      note: isTransfer
        ? 'Security deposit from prior consumer may be adjusted or transferred with consent indemnity.'
        : 'Security deposit is refundable upon termination of power supply.',
    },
    evidenceChecklist,
    milestones,
    disclaimer: ELECTRICITY_DISCLAIMER,
  };
}

/**
 * Client-side Electricity Application Tracker.
 */
export class ElectricityApplicationTracker {
  constructor() {
    this.trackerMap = new Map();
  }

  createTracking(trackingId, guide) {
    if (!trackingId || !guide) throw new Error('Tracking ID and guide are required');

    const item = {
      trackingId,
      journey: guide.journey,
      discomName: guide.discomName,
      officialPortalUrl: guide.officialPortalUrl,
      milestones: guide.milestones.map((m) => ({
        step: m.step,
        name: m.name,
        isCompleted: false,
        completedAt: null,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.trackerMap.set(trackingId, item);
    return item;
  }

  getTracking(trackingId) {
    return this.trackerMap.get(trackingId) || null;
  }

  toggleMilestone(trackingId, step) {
    const tracker = this.trackerMap.get(trackingId);
    if (!tracker) return null;

    const target = tracker.milestones.find((m) => m.step === step);
    if (target) {
      target.isCompleted = !target.isCompleted;
      target.completedAt = target.isCompleted ? new Date().toISOString() : null;
      tracker.updatedAt = new Date().toISOString();
    }
    return tracker;
  }

  deleteTracking(trackingId) {
    return this.trackerMap.delete(trackingId);
  }
}
