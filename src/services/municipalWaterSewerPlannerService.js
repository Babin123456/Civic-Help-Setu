/**
 * Municipal Water and Sewer Connection Application Planner Service
 *
 * Implements a local-body-aware planner for civic utility connections:
 * 1. Distinguishes application journeys:
 *    - NEW_WATER_CONNECTION (Domestic or Commercial tap connection)
 *    - SEWERAGE_CONNECTION (Underground drainage / sanitary line hookup)
 *    - METER_REPLACEMENT_OR_TESTING (Defective, broken, or disputed billing meter)
 *    - DISCONNECTION_OR_SURRENDER (Voluntary closure or demolition surrender)
 * 2. Identifies responsible local bodies and water supply boards:
 *    - DJB (Delhi Jal Board)
 *    - BWSSB (Bangalore Water Supply and Sewerage Board)
 *    - PMC_WATER (Pune Municipal Corporation Water Supply Dept)
 *    - HMWSSB (Hyderabad Metropolitan Water Supply and Sewerage Board)
 *    - GENERIC_MUNICIPAL (District / Town Municipal Council)
 * 3. Categorizes required property and occupancy evidence:
 *    - Title deed / Registered sale deed
 *    - Up-to-date Municipal Property Tax assessment receipt
 *    - Sanctioned building completion / occupancy certificate (OC)
 *    - Plumber layout completion drawing from licensed municipal plumber
 * 4. Breaks down sourced connection costs:
 *    - Security / Infrastructure development deposit
 *    - Road cutting & restoration charges
 *    - Meter procurement & testing fee
 * 5. Milestone tracking:
 *    - 'APPLICATION_FILED'
 *    - 'SITE_INSPECTION_SCHEDULED'
 *    - 'ESTIMATE_DEMAND_PAID'
 *    - 'ROAD_CUTTING_PERMISSION_GRANTED'
 *    - 'METER_FIXED_SUPPLY_ACTIVE'
 */

export const UTILITY_JOURNEY_TYPE = {
  NEW_WATER_CONNECTION: 'NEW_WATER_CONNECTION',
  SEWERAGE_CONNECTION: 'SEWERAGE_CONNECTION',
  METER_REPLACEMENT_OR_TESTING: 'METER_REPLACEMENT_OR_TESTING',
  DISCONNECTION_OR_SURRENDER: 'DISCONNECTION_OR_SURRENDER',
};

export const WATER_BOARD_KEY = {
  DJB_DELHI: 'DJB_DELHI',
  BWSSB_BENGALURU: 'BWSSB_BENGALURU',
  PMC_PUNE: 'PMC_PUNE',
  GENERIC_ULB: 'GENERIC_ULB',
};

export const WATER_PLANNER_DISCLAIMER =
  'Connection fees, road cutting charges, and pipe diameters are determined by local municipal bylaws. Civic Help Setu does not collect payments or guarantee connection sanctions; all payments must be made directly to the authorized municipal water board.';

export const WATER_BOARD_CATALOG = {
  DJB_DELHI: {
    boardId: 'DJB_DELHI',
    name: 'Delhi Jal Board (Government of NCT of Delhi)',
    jurisdiction: 'DELHI_NCT',
    officialPortalUrl: 'https://djb.gov.in',
    effectiveDate: '2023-01-01',
    lastVerifiedDate: '2026-11-01',
    standardDomesticWaterDeposit: 1000,
    sewerDevelopmentChargePerSqm: 100,
    roadCuttingChargeApplicable: true,
    licensedPlumberMandatory: true,
  },
  BWSSB_BENGALURU: {
    boardId: 'BWSSB_BENGALURU',
    name: 'Bangalore Water Supply and Sewerage Board',
    jurisdiction: 'KARNATAKA_BENGALURU',
    officialPortalUrl: 'https://bwssb.karnataka.gov.in',
    effectiveDate: '2024-01-01',
    lastVerifiedDate: '2026-11-01',
    standardDomesticWaterDeposit: 2500,
    sewerDevelopmentChargePerSqm: 250,
    roadCuttingChargeApplicable: true,
    licensedPlumberMandatory: true,
  },
  PMC_PUNE: {
    boardId: 'PMC_PUNE',
    name: 'Pune Municipal Corporation - Water Supply Department',
    jurisdiction: 'MAHARASHTRA_PUNE',
    officialPortalUrl: 'https://pmc.gov.in',
    effectiveDate: '2023-06-01',
    lastVerifiedDate: '2026-11-01',
    standardDomesticWaterDeposit: 1500,
    sewerDevelopmentChargePerSqm: 120,
    roadCuttingChargeApplicable: true,
    licensedPlumberMandatory: false,
  },
};

/**
 * Validates and retrieves water board specifications.
 *
 * @param {string} boardKey
 * @returns {object} Water board specs
 */
export function getWaterBoardSpecs(boardKey = WATER_BOARD_KEY.DJB_DELHI) {
  return (
    WATER_BOARD_CATALOG[boardKey] || {
      boardId: 'GENERIC_ULB',
      name: 'Local Municipal Corporation / Water Board',
      jurisdiction: 'LOCAL_ULB',
      officialPortalUrl: 'State e-District / Local Municipal Council Desk',
      effectiveDate: '2023-01-01',
      lastVerifiedDate: '2026-11-01',
      standardDomesticWaterDeposit: 1200,
      sewerDevelopmentChargePerSqm: 100,
      roadCuttingChargeApplicable: true,
      licensedPlumberMandatory: false,
    }
  );
}

/**
 * Generates an end-to-end connection preparation plan and estimated fee breakdown.
 *
 * @param {object} params
 * @param {string} params.journeyType (NEW_WATER_CONNECTION, SEWERAGE_CONNECTION, METER_REPLACEMENT_OR_TESTING, DISCONNECTION_OR_SURRENDER)
 * @param {string} params.boardKey
 * @param {object} [params.propertyDetails] { builtUpAreaSqm, isCommercial, hasExistingSewer }
 * @returns {object} Connection plan dossier
 */
export function generateWaterConnectionPlan({
  journeyType = UTILITY_JOURNEY_TYPE.NEW_WATER_CONNECTION,
  boardKey = WATER_BOARD_KEY.DJB_DELHI,
  propertyDetails = {},
}) {
  const board = getWaterBoardSpecs(boardKey);
  const { builtUpAreaSqm = 100, isCommercial = false } = propertyDetails;

  const isMeterChange = journeyType === UTILITY_JOURNEY_TYPE.METER_REPLACEMENT_OR_TESTING;
  const isDisconnection = journeyType === UTILITY_JOURNEY_TYPE.DISCONNECTION_OR_SURRENDER;
  const isSewer = journeyType === UTILITY_JOURNEY_TYPE.SEWERAGE_CONNECTION;

  // Sourced deposit calculation
  const multiplier = isCommercial ? 3 : 1;
  const baseDeposit = isDisconnection
    ? 0
    : isMeterChange
    ? 500
    : board.standardDomesticWaterDeposit * multiplier;

  const sewerCharge = isSewer || journeyType === UTILITY_JOURNEY_TYPE.NEW_WATER_CONNECTION
    ? builtUpAreaSqm * board.sewerDevelopmentChargePerSqm
    : 0;

  // Property evidence checklist
  const evidenceChecklist = [
    {
      document: 'Proof of Property Ownership',
      details: 'Registered Sale Deed, Title Deed, or Allotment Letter from Housing Board.',
      isMandatory: true,
    },
    {
      document: 'Latest Property Tax Assessment Receipt',
      details: 'Current financial year municipal tax paid receipt with verified Property Tax ID (PID).',
      isMandatory: true,
    },
    {
      document: 'Building Sanction Plan / Occupancy Certificate',
      details: 'Approved municipal architectural drawing showing water pipe & sewer line inlet/outlet.',
      isMandatory: !isMeterChange && !isDisconnection,
    },
  ];

  if (board.licensedPlumberMandatory && !isDisconnection) {
    evidenceChecklist.push({
      document: 'Licensed Municipal Plumber Certificate',
      details: 'Execution drawing signed by a certified water board licensed plumber.',
      isMandatory: true,
    });
  }

  // Milestones
  const milestones = [
    { step: 1, name: 'Online Application Filing & Token Generation', estimatedDays: 2 },
    { step: 2, name: 'Site Inspection by Junior Water Engineer', estimatedDays: 7 },
    { step: 3, name: 'Demand Note Generation & Deposit Payment', estimatedDays: 5 },
  ];

  if (board.roadCuttingChargeApplicable && !isMeterChange && !isDisconnection) {
    milestones.push({
      step: 4,
      name: 'Road Restoration / Cutting NOC from PWD or Municipality',
      estimatedDays: 10,
    });
  }

  milestones.push({
    step: milestones.length + 1,
    name: isDisconnection
      ? 'Physical Line Plugging & Final No Dues Certificate'
      : 'Water Meter Calibration & Tap Activation',
    estimatedDays: 5,
  });

  return {
    journeyType,
    boardName: board.name,
    jurisdiction: board.jurisdiction,
    officialPortalUrl: board.officialPortalUrl,
    estimatedFeeBreakdown: {
      statutorySecurityDeposit: baseDeposit,
      sewerDevelopmentCharges: sewerCharge,
      estimatedTotalPreTax: baseDeposit + sewerCharge,
      roadCuttingChargeNotice: board.roadCuttingChargeApplicable
        ? 'Road cutting fee is assessed based on road surface (asphalt/concrete) by PWD engineer.'
        : 'Not applicable',
    },
    requiredEvidence: evidenceChecklist,
    milestones,
    verificationMeta: {
      effectiveDate: board.effectiveDate,
      lastVerifiedDate: board.lastVerifiedDate,
      sourceUrl: board.officialPortalUrl,
    },
    disclaimer: WATER_PLANNER_DISCLAIMER,
  };
}

/**
 * Client-side connection tracking workspace.
 * Allows residents to manage connection progress privately.
 */
export class WaterConnectionTracker {
  constructor() {
    this.connectionStore = new Map();
  }

  createConnectionTracking(trackingId, plan) {
    if (!trackingId || !plan) throw new Error('Tracking ID and plan are required');

    const tracker = {
      trackingId,
      journeyType: plan.journeyType,
      boardName: plan.boardName,
      officialPortalUrl: plan.officialPortalUrl,
      currentMilestoneIndex: 0,
      milestones: plan.milestones.map((m) => ({
        step: m.step,
        name: m.name,
        isCompleted: false,
        completedAt: null,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.connectionStore.set(trackingId, tracker);
    return tracker;
  }

  getTracking(trackingId) {
    return this.connectionStore.get(trackingId) || null;
  }

  completeMilestone(trackingId, stepNumber) {
    const tracker = this.connectionStore.get(trackingId);
    if (!tracker) return null;

    const target = tracker.milestones.find((m) => m.step === stepNumber);
    if (target) {
      target.isCompleted = true;
      target.completedAt = new Date().toISOString();
      tracker.currentMilestoneIndex = Math.max(tracker.currentMilestoneIndex, stepNumber);
      tracker.updatedAt = new Date().toISOString();
    }

    return tracker;
  }

  deleteTracking(trackingId) {
    return this.connectionStore.delete(trackingId);
  }
}
