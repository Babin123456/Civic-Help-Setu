/**
 * Municipal Water Bill Consumption and Charge Visualizer Service
 *
 * Implements an interactive water bill visualizer with deterministic tariff calculations,
 * slab boundary analysis, period comparison, and discrepancy detection.
 */

// Import utility functions from waterBillTariff
import {
  calculateTotalBill,
  calculateVariableCharge,
  compareBillPeriods,
  formatRupee,
  formatLiters,
  isReadingEstimated,
  getTariffConfig,
  listAvailableTariffs,
  validateBillInput,
  DEFAULT_SLAB_STRUCTURE,
} from './waterBillTariff.js';

// Internal storage for user progress (in-memory for demo; replace with persistence as needed)
const userProgressStore = new Map();

// Define import sources (since not exported from waterBillTariff)
export const IMPORT_SOURCE = {
  MANUAL: 'MANUAL',
  OCR: 'OCR',
};

// Consent status constants
export const CONSENT_STATUS = {
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
};

// Visualizer view state constants
export const VISUALIZER_VIEW_STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  READY: 'READY',
  COMPARISON: 'COMPARISON',
};

/**
 * Initializes or retrieves a user's visualizer progress dossier.
 *
 * @param {string} userId - Authenticated citizen user ID
 * @returns {Object} Visualizer progress dossier
 */
export function initializeUserVisualizerDossier(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid ownerId is required');
  }

  if (userProgressStore.has(userId)) {
    return userProgressStore.get(userId);
  }

  const dossier = {
    dossierId: `wv_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    period1: {
      consumptionLiters: null,
      readingType: 'actual',
      source: IMPORT_SOURCE.MANUAL,
      tariffVersion: '2.3.0',
      boardKey: 'PMC_PUNE',
      fixedCharge: 50,
      arrears: 0,
      adjustment: 0,
      isConsentGiven: false,
      isOcrImport: false,
    },
    period2: {
      consumptionLiters: null,
      readingType: 'actual',
      source: IMPORT_SOURCE.MANUAL,
      tariffVersion: '2.3.0',
      boardKey: 'PMC_PUNE',
      fixedCharge: 50,
      arrears: 0,
      adjustment: 0,
      isConsentGiven: false,
      isOcrImport: false,
    },
    viewState: 'idle',
    step: 1,
    consentGivenAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  userProgressStore.set(userId, dossier);
  return dossier;
}

/**
 * Retrieves a user visualizer dossier with authorization enforcement.
 *
 * @param {string} userId
 * @param {string} authenticatedUserId
 * @returns {Object} Dossier or null
 */
export function getUserVisualizerDossier(userId, authenticatedUserId) {
  if (!userId || !authenticatedUserId) return null;
  if (userId !== authenticatedUserId) {
    throw new Error('Access Denied: You cannot inspect another user visualizer records');
  }
  return initializeUserVisualizerDossier(userId);
}

/**
 * Grants consent for the visualizer to process bill data.
 *
 * @param {string} userId
 * @param {string} authenticatedUserId
 * @returns {Object} Updated dossier
 */
export function grantVisualizerConsent(userId, authenticatedUserId) {
  const dossier = getUserVisualizerDossier(userId, authenticatedUserId);
  const now = new Date();

  dossier.period1.isConsentGiven = true;
  dossier.period2.isConsentGiven = true;
  dossier.consentGivenAt = now.toISOString();
  dossier.viewState = 'ready';
  dossier.updatedAt = now.toISOString();

  userProgressStore.set(userId, dossier);
  return dossier;
}

/**
 * Sets period 1 bill data.
 *
 * @param {string} userId
 * @param {Object} params
 * @param {number} params.consumptionLiters - Consumption in liters
 * @param {string} [params.readingType] - 'actual' or 'estimated'
 * @param {string} [params.source] - IMPORT_SOURCE.MANUAL or IMPORT_SOURCE.OCR
 * @param {number} [params.fixedCharge] - Override fixed charge
 * @param {number} [params.arrears] - Override arrears
 * @param {number} [params.adjustment] - Override adjustment
 * @returns {Object} Updated dossier
 */
export function setPeriod1Bill(userId, { consumptionLiters, readingType = 'actual', source = IMPORT_SOURCE.MANUAL, fixedCharge, arrears, adjustment }) {
  const dossier = getUserVisualizerDossier(userId, userId);

  dossier.period1.consumptionLiters = consumptionLiters;
  dossier.period1.readingType = readingType;
  dossier.period1.source = source;
  if (fixedCharge !== undefined) dossier.period1.fixedCharge = fixedCharge;
  if (arrears !== undefined) dossier.period1.arrears = arrears;
  if (adjustment !== undefined) dossier.period1.adjustment = adjustment;
  dossier.period1.isOcrImport = source === IMPORT_SOURCE.OCR;
  dossier.updatedAt = new Date().toISOString();

  // Auto-advance if period 2 is also set
  if (dossier.period2.consumptionLiters !== null) {
    dossier.viewState = 'ready';
  }

  userProgressStore.set(userId, dossier);
  return dossier;
}

/**
 * Sets period 2 bill data for comparison.
 *
 * @param {string} userId
 * @param {Object} params - Same structure as setPeriod1Bill
 * @returns {Object} Updated dossier
 */
export function setPeriod2Bill(userId, { consumptionLiters, readingType = 'actual', source = IMPORT_SOURCE.MANUAL, fixedCharge, arrears, adjustment }) {
  const dossier = getUserVisualizerDossier(userId, userId);

  dossier.period2.consumptionLiters = consumptionLiters;
  dossier.period2.readingType = readingType;
  dossier.period2.source = source;
  if (fixedCharge !== undefined) dossier.period2.fixedCharge = fixedCharge;
  if (arrears !== undefined) dossier.period2.arrears = arrears;
  if (adjustment !== undefined) dossier.period2.adjustment = adjustment;
  dossier.period2.isOcrImport = source === IMPORT_SOURCE.OCR;
  dossier.updatedAt = new Date().toISOString();

  // Advance to comparison view
  dossier.viewState = 'comparison';

  userProgressStore.set(userId, dossier);
  return dossier;
}

/**
 * Advances the workflow step.
 *
 * @param {string} userId
 * @param {number} step - Step number (1-4)
 * @returns {Object} Updated dossier
 */
export function advanceStep(userId, step) {
  const dossier = getUserVisualizerDossier(userId, userId);
  dossier.step = step;
  dossier.updatedAt = new Date().toISOString();

  if (step >= 4) {
    dossier.viewState = 'ready';
  } else if (step >= 3) {
    dossier.viewState = 'comparison';
  }

  userProgressStore.set(userId, dossier);
  return dossier;
}

/**
 * Cancels the current visualizer session, preserving confirmed non-sensitive inputs.
 *
 * @param {string} userId
 * @returns {Object} Preserved progress dossier
 */
export function cancelVisualizerSession(userId) {
  const dossier = getUserVisualizerDossier(userId, userId);
  dossier.viewState = 'idle';
  dossier.step = 1;
  dossier.consentGivenAt = null;
  dossier.updatedAt = new Date().toISOString();

  // Preserve entered data but reset workflow state
  userProgressStore.set(userId, dossier);
  return dossier;
}

/**
 * Resumes a previously cancelled or paused visualizer session.
 *
 * @param {string} userId
 * @returns {Object} Resumed dossier
 */
export function resumeVisualizerSession(userId) {
  const dossier = userProgressStore.get(userId);

  if (!dossier) {
    return initializeUserVisualizerDossier(userId);
  }

  // Restore view state based on data we have
  if (dossier.period1.consumptionLiters !== null && dossier.period2.consumptionLiters !== null) {
    dossier.viewState = 'ready';
  } else if (dossier.period1.consumptionLiters !== null) {
    dossier.viewState = 'idle';
  } else {
    dossier.viewState = 'empty';
  }

  userProgressStore.set(userId, dossier);
  return dossier;
}

/**
 * Generates a transparent bill breakdown for a given period.
 * Uses deterministic published tariff rules; no AI-generated charge calculations.
 *
 * @param {string} userId
 * @returns {Object} Bill breakdown or error
 */
export function generateBillBreakdown(userId) {
  const dossier = getUserVisualizerDossier(userId, userId);

  if (dossier.viewState !== 'ready') {
    return { error: 'Visualizer not ready. Please enter both period bill data first.' };
  }

  if (dossier.period1.consumptionLiters === null || dossier.period2.consumptionLiters === null) {
    return { error: 'Both period consumptions must be entered before generating breakdown.' };
  }

  // Calculate bills for both periods using deterministic tariff rules
  const bill1 = calculateTotalBill({
    consumptionLiters: dossier.period1.consumptionLiters,
    fixedCharge: dossier.period1.fixedCharge,
    arrears: dossier.period1.arrears,
    adjustment: dossier.period1.adjustment,
    tariffVersion: dossier.period1.tariffVersion,
    boardKey: dossier.period1.boardKey,
  });

  const bill2 = calculateTotalBill({
    consumptionLiters: dossier.period2.consumptionLiters,
    fixedCharge: dossier.period2.fixedCharge,
    arrears: dossier.period2.arrears,
    adjustment: dossier.period2.adjustment,
    tariffVersion: dossier.period2.tariffVersion,
    boardKey: dossier.period2.boardKey,
  });

  return {
    dossier,
    period1Bill: bill1,
    period2Bill: bill2,
    consumptionDiff: dossier.period2.consumptionLiters - dossier.period1.consumptionLiters,
    readingType1: dossier.period1.readingType,
    readingType2: dossier.period2.readingType,
    source1: dossier.period1.source,
    source2: dossier.period2.source,
    isEstimated1: isReadingEstimated({ readingType: dossier.period1.readingType }).isEstimated,
    isEstimated2: isReadingEstimated({ readingType: dossier.period2.readingType }).isEstimated,
    tariffSource: getTariffConfig(dossier.period1.boardKey),
    accessibleSummary: {
      period1: {
        consumption: formatLiters(dossier.period1.consumptionLiters),
        consumptionRaw: dossier.period1.consumptionLiters,
        readingType: dossier.period1.readingType,
        variableCharge: formatRupee(bill1.variableCharge),
        fixedCharge: formatRupee(bill1.fixedCharge),
        totalPayable: formatRupee(bill1.totalPayable),
      },
      period2: {
        consumption: formatLiters(dossier.period2.consumptionLiters),
        consumptionRaw: dossier.period2.consumptionLiters,
        readingType: dossier.period2.readingType,
        variableCharge: formatRupee(bill2.variableCharge),
        fixedCharge: formatRupee(bill2.fixedCharge),
        totalPayable: formatRupee(bill2.totalPayable),
      },
      difference: {
        consumptionChange: formatLiters(dossier.period2.consumptionLiters - dossier.period1.consumptionLiters),
        totalChange: formatRupee(bill2.totalPayable - bill1.totalPayable),
      },
    },
  };
}

/**
 * Generates a discrepancy checklist from user-confirmed bill values.
 *
 * @param {string} userId
 * @returns {Object} Discrepancy checklist with user confirm/correct actions
 */
export function generateDiscrepancyChecklist(userId) {
  const dossier = getUserVisualizerDossier(userId, userId);

  if (dossier.viewState !== 'ready') {
    return { error: 'Visualizer not ready. Please complete period entry first.' };
  }

  if (dossier.period1.consumptionLiters === null || dossier.period2.consumptionLiters === null) {
    return { error: 'Both period consumptions must be entered.' };
  }

  // Use compareBillPeriods from waterBillTariff for consistent logic
  const comparison = compareBillPeriods({
    period1Consumption: dossier.period1.consumptionLiters,
    period2Consumption: dossier.period2.consumptionLiters,
  });

  // Enhance with reading type and source info from dossier
  const enhancedChecklist = comparison.checklistItems.map((item) => ({
    ...item,
    userConfirmable: item.userConfirmable,
    readingType1: dossier.period1.readingType,
    readingType2: dossier.period2.readingType,
    isEstimated1: isReadingEstimated({ readingType: dossier.period1.readingType }).isEstimated,
    isEstimated2: isReadingEstimated({ readingType: dossier.period2.readingType }).isEstimated,
    source1: dossier.period1.source,
    source2: dossier.period2.source,
  }));

  return {
    dossier,
    checklist: enhancedChecklist,
    summary: {
      totalItems: enhancedChecklist.length,
      criticalItems: enhancedChecklist.filter((i) => i.isCritical).length,
      userConfirmableItems: enhancedChecklist.filter((i) => i.userConfirmable).length,
    },
    consentGiven: dossier.consentGivenAt !== null,
    tariffVersion1: dossier.period1.tariffVersion,
    tariffVersion2: dossier.period2.tariffVersion,
    boardKey1: dossier.period1.boardKey,
    boardKey2: dossier.period2.boardKey,
  };
}

/**
 * Updates a specific checklist item user confirmation status.
 *
 * @param {string} userId
 * @param {string} itemId - The checklist item id
 * @param {boolean} confirmed - User confirmation status
 * @returns {Object} Updated checklist
 */
export function updateChecklistItemConfirmation(userId, itemId, confirmed) {
  const dossier = getUserVisualizerDossier(userId, userId);

  if (dossier.viewState !== 'ready') {
    return { error: 'Visualizer not ready for checklist updates.' };
  }

  // Regenerate checklist with updated confirmation
  const comparison = generateDiscrepancyChecklist(userId);

  if (comparison.checklist) {
    comparison.checklist.forEach((item) => {
      if (item.id === itemId) {
        item.userConfirmed = confirmed;
      }
    });
  }

  return comparison;
}

/**
 * Gets available water board tariff configurations.
 *
 * @returns {Array<Object>} List of tariff config objects with board info
 */
export function getAvailableBoards() {
  return listAvailableTariffs().map((tariff) => ({
    boardKey: tariff.boardKey,
    boardName: tariff.boardName,
    tariffVersion: tariff.tariffVersion,
    effectiveDate: tariff.effectiveDate,
    fixedCharge: tariff.fixedChargePerPeriod,
  }));
}

/**
 * Gets the unit explainer text for display in the UI.
 *
 * @param {string} boardKey - Water board key
 * @returns {Object} Unit explainer with definition and table alternative
 */
export function getUnitExplainer(boardKey = 'PMC_PUNE') {
  const tariff = getTariffConfig(boardKey);

  return {
    title: 'Consumption Units (Liters)',
    definition: `Water consumption is measured in liters (L) for each billing period. Your bill shows the total volume of water supplied through your meter during the period.`,
    tableAlternative: {
      headers: ['Term', 'Description'],
      rows: [
        ['Liter (L)', 'Standard unit of volume; 1,000L = 1 cubic meter (1 m³)'],
        ['KL (Kiloliter)', '1,000 liters; used for higher consumption ranges'],
        ['ML (Megaliter)', '1,000,000 liters; typically for industrial/commercial connections'],
        ['Billing Period', 'Fixed interval (usually monthly) during which consumption is measured'],
        ['Slab Rate', 'Tiered pricing: consumption within each slab band is charged at a different rate'],
        ['Fixed Charge', 'Flat fee applied regardless of consumption per billing period'],
      ],
    },
    tariffVersion: tariff.tariffVersion,
    boardName: tariff.boardName,
    sourceReference: `Tariff version ${tariff.tariffVersion} effective ${tariff.effectiveDate} for ${tariff.boardName}`,
  };
}

/**
 * Gets tariff slab band explanations for display.
 *
 * @param {string} boardKey - Water board key
 * @returns {Array<Object>} Slab band explanations
 */
export function getSlabBandExplanations(boardKey = 'PMC_PUNE') {
  return [
    {
      name: 'Slab 1 (Low Consumption)',
      from: 0,
      to: 1000,
      ratePerLiter: 2,
      description: 'First tier: basic consumption needs at the lowest rate',
    },
    {
      name: 'Slab 2 (Medium Consumption)',
      from: 1001,
      to: 3000,
      ratePerLiter: 4,
      description: 'Second tier: moderate consumption at a moderate rate',
    },
    {
      name: 'Slab 3 (High Consumption)',
      from: 3001,
      to: Infinity,
      ratePerLiter: 7,
      description: 'Third tier: high consumption at the highest rate (conservation incentive)',
    },
  ];
}

/**
 * Gets the billing period comparison display data.
 *
 * @param {string} userId
 * @returns {Object} Comparison display data or error
 */
export function getComparisonDisplay(userId) {
  const dossier = getUserVisualizerDossier(userId, userId);

  if (dossier.viewState !== 'ready' && dossier.viewState !== 'comparison') {
    return { error: 'No comparison data available. Please enter both period bill data.' };
  }

  const { period1, period2 } = dossier;

  if (period1.consumptionLiters === null || period2.consumptionLiters === null) {
    return { error: 'Incomplete period data for comparison.' };
  }

  // Calculate bills
  const bill1 = calculateTotalBill({
    consumptionLiters: period1.consumptionLiters,
    fixedCharge: period1.fixedCharge,
    arrears: period1.arrears,
    adjustment: period1.adjustment,
    tariffVersion: period1.tariffVersion,
    boardKey: period1.boardKey,
  });

  const bill2 = calculateTotalBill({
    consumptionLiters: period2.consumptionLiters,
    fixedCharge: period2.fixedCharge,
    arrears: period2.arrears,
    adjustment: period2.adjustment,
    tariffVersion: period2.tariffVersion,
    boardKey: period2.boardKey,
  });

  const consumptionDiff = period2.consumptionLiters - period1.consumptionLiters;
  const chargeDiff = bill2.totalPayable - bill1.totalPayable;

  return {
    dossier,
    period1: {
      consumption: formatLiters(period1.consumptionLiters),
      consumptionRaw: period1.consumptionLiters,
      readingType: period1.readingType,
      readingTypeLabel: period1.readingType === 'estimated' ? 'Estimated (marked by system)' : 'Actual meter reading',
      isEstimated: isReadingEstimated({ readingType: period1.readingType }).isEstimated,
      variableCharge: formatRupee(bill1.variableCharge),
      fixedCharge: formatRupee(bill1.fixedCharge),
      totalPayable: formatRupee(bill1.totalPayable),
      source: period1.source,
      sourceLabel: period1.source === 'OCR' ? 'OCR-imported (AI suggestion until confirmed)' : 'Manually entered',
    },
    period2: {
      consumption: formatLiters(period2.consumptionLiters),
      consumptionRaw: period2.consumptionLiters,
      readingType: period2.readingType,
      readingTypeLabel: period2.readingType === 'estimated' ? 'Estimated (marked by system)' : 'Actual meter reading',
      isEstimated: isReadingEstimated({ readingType: period2.readingType }).isEstimated,
      variableCharge: formatRupee(bill2.variableCharge),
      fixedCharge: formatRupee(bill2.fixedCharge),
      totalPayable: formatRupee(bill2.totalPayable),
      source: period2.source,
      sourceLabel: period2.source === 'OCR' ? 'OCR-imported (AI suggestion until confirmed)' : 'Manually entered',
    },
    comparison: {
      consumptionChange: formatLiters(consumptionDiff),
      consumptionDiff,
      direction: consumptionDiff >= 0 ? 'increase' : 'decrease',
      totalChange: formatRupee(chargeDiff),
      chargeDiff,
    },
    slabBreakdown1: calculateVariableCharge(period1.consumptionLiters, getTariffConfig(period1.boardKey).slabStructure).slabBreakdown,
    slabBreakdown2: calculateVariableCharge(period2.consumptionLiters, getTariffConfig(period2.boardKey).slabStructure).slabBreakdown,
    accessibleTable: {
      headers: ['Attribute', 'Period 1', 'Period 2', 'Difference'],
      rows: [
        ['Consumption', formatLiters(period1.consumptionLiters), formatLiters(period2.consumptionLiters), formatLiters(consumptionDiff)],
        ['Variable Charge', formatRupee(bill1.variableCharge), formatRupee(bill2.variableCharge), formatRupee(bill2.variableCharge - bill1.variableCharge)],
        ['Fixed Charge', formatRupee(period1.fixedCharge), formatRupee(period2.fixedCharge), formatRupee(period2.fixedCharge - period1.fixedCharge)],
        ['Arrears', formatRupee(period1.arrears), formatRupee(period2.arrears), formatRupee(period2.arrears - period1.arrears)],
        ['Adjustment', formatRupee(period1.adjustment), formatRupee(period2.adjustment), formatRupee(period2.adjustment - period1.adjustment)],
        ['Total Payable', formatRupee(bill1.totalPayable), formatRupee(bill2.totalPayable), formatRupee(chargeDiff)],
      ].map((row, i) => ({
        label: ['Consumption', 'Variable', 'Fixed', 'Arrears', 'Adjustment', 'Total'][i],
        ...row,
      })),
    },
    tariffVersion1: period1.tariffVersion,
    tariffVersion2: period2.tariffVersion,
  };
}
export { validateBillInput } from './waterBillTariff.js';
