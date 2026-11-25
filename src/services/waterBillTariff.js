/**
 * Water Bill Tariff and Slab Configuration
 *
 * Deterministic published tariff rules for municipal water consumption charges.
 * Each water board defines its own slab structure and rates.
 * Tariff versions are tracked for source reference and data versioning.
 */

// Standard 3-slab structure (can be overridden per water board)
export const DEFAULT_SLAB_STRUCTURE = {
  // Slab name -> { from (inclusive, liters), to (exclusive, liters), ratePerLiter (paise) }
  slab1: { from: 0, to: 1000, ratePerLiter: 2 },   // 0-1000L: ₹2 per 100L = ₹0.02/L
  slab2: { from: 1001, to: 3000, ratePerLiter: 4 }, // 1001-3000L: ₹4 per 100L = ₹0.04/L
  slab3: { from: 3001, to: Infinity, ratePerLiter: 7 }, // 3001+L: ₹7 per 100L = ₹0.07/L
};

// Pune Municipal Corporation (PMC) tariff configuration
export const PMC_TARIFF = {
  boardKey: 'PMC_PUNE',
  boardName: 'Pune Municipal Corporation - Water Supply Department',
  tariffVersion: '2.3.0',
  effectiveDate: '2024-04-01',
  lastVerifiedDate: '2026-11-01',
  slabStructure: {
    slab1: { from: 0, to: 1000, ratePerLiter: 2 },
    slab2: { from: 1001, to: 3000, ratePerLiter: 4 },
    slab3: { from: 3001, to: Infinity, ratePerLiter: 7 },
  },
  fixedChargePerPeriod: 50,
};

// Delhi Jal Board (DJB) tariff configuration
export const DJB_TARIFF = {
  boardKey: 'DJB_DELHI',
  boardName: 'Delhi Jal Board (Government of NCT of Delhi)',
  tariffVersion: '3.1.0',
  effectiveDate: '2023-01-01',
  lastVerifiedDate: '2026-11-01',
  slabStructure: {
    slab1: { from: 0, to: 1000, ratePerLiter: 1 },
    slab2: { from: 1001, to: 3000, ratePerLiter: 2 },
    slab3: { from: 3001, to: Infinity, ratePerLiter: 3 },
  },
  fixedChargePerPeriod: 30,
};

// Bangalore Water Supply and Sewerage Board (BWSSB) tariff configuration
export const BWSSB_TARIFF = {
  boardKey: 'BWSSB_BENGALURU',
  boardName: 'Bangalore Water Supply and Sewerage Board',
  tariffVersion: '2.0.0',
  effectiveDate: '2024-01-01',
  lastVerifiedDate: '2026-11-01',
  slabStructure: {
    slab1: { from: 0, to: 1000, ratePerLiter: 1.5 },
    slab2: { from: 1001, to: 3000, ratePerLiter: 3 },
    slab3: { from: 3001, to: Infinity, ratePerLiter: 5 },
  },
  fixedChargePerPeriod: 40,
};

// Generic ULB tariff configuration
export const GENERIC_ULB_TARIFF = {
  boardKey: 'GENERIC_ULB',
  boardName: 'Local Municipal Corporation / Water Board',
  tariffVersion: '1.0.0',
  effectiveDate: '2023-01-01',
  lastVerifiedDate: '2026-11-01',
  slabStructure: { ...DEFAULT_SLAB_STRUCTURE },
  fixedChargePerPeriod: 20,
};

/**
 * Gets tariff configuration for a given board key.
 *
 * @param {string} boardKey - One of: PMC_PUNE, DJB_DELHI, BWSSB_BENGALURU, GENERIC_ULB
 * @returns {Object} Tariff configuration object
 */
export function getTariffConfig(boardKey = 'PMC_PUNE') {
  const catalog = {
    PMC_PUNE: PMC_TARIFF,
    DJB_DELHI: DJB_TARIFF,
    BWSSB_BENGALURU: BWSSB_TARIFF,
    GENERIC_ULB: GENERIC_ULB_TARIFF,
  };
  return catalog[boardKey] || GENERIC_ULB_TARIFF;
}

/**
 * Calculates the variable charge based on consumption and slab structure.
 *
 * @param {number} consumptionLiters - Total consumption in liters for the billing period
 * @param {Object} [slabStructure] - Optional custom slab structure; uses defaults if not provided
 * @returns {Object} Calculation breakdown
 */
export function calculateVariableCharge(consumptionLiters, slabStructure = null) {
  const structure = slabStructure || DEFAULT_SLAB_STRUCTURE;

  let charge = 0;
  let remaining = consumptionLiters;

  // Slabs are processed in order: slab1, slab2, slab3
  const slabs = [structure.slab1, structure.slab2, structure.slab3];

  slabs.forEach((slab) => {
    if (remaining <= 0) {
      charge += 0;
      return;
    }

    const slabWidth = slab.to - slab.from;
    const applicableAmount = Math.min(remaining, slabWidth);
    const slabCharge = applicableAmount * (slab.ratePerLiter / 100); // ratePerLiter is in paise, convert to rupees
    charge += slabCharge;
    remaining -= applicableAmount;
  });

  return {
    totalVariableCharge: Math.round(charge * 100) / 100, // round to 2 decimal places
    slabBreakdown: slabs.map((slab, i) => {
      const applied = Math.min(consumptionLiters, slab.to - slab.from);
      const slabLiters = applied > 0 ? applied : 0;
      const slabRate = slab.ratePerLiter; // paise per liter
      const slabAmount = slabLiters * (slabRate / 100);
      return {
        slabName: `slab${i + 1}`,
        fromLiters: slab.from,
        toLiters: slab.to,
        litersInSlab: slabLiters,
        ratePerLiterPaise: slabRate,
        chargeInRupees: Math.round(slabAmount * 100) / 100,
      };
    }),
  };
}

/**
 * Calculates the total water bill charge including variable consumption,
 * fixed charges, arrears, and adjustments.
 *
 * @param {Object} params
 * @param {number} params.consumptionLiters - Total consumption in liters
 * @param {number} [params.fixedCharge=50] - Fixed charge per period (₹)
 * @param {number} [params.arrears=0] - Arrears amount (₹)
 * @param {number} [params.adjustment=0] - Adjustment amount (₹, can be negative)
 * @param {Object} [params.slabStructure] - Custom slab structure
 * @param {string} [params.tariffVersion] - Tariff version for source reference
 * @param {string} [params.boardKey] - Water board key for source reference
 * @returns {Object} Complete bill breakdown
 */
export function calculateTotalBill({
  consumptionLiters,
  fixedCharge = 50,
  arrears = 0,
  adjustment = 0,
  slabStructure = null,
  tariffVersion = '2.3.0',
  boardKey = 'PMC_PUNE',
}) {
  const variable = calculateVariableCharge(consumptionLiters, slabStructure);
  const totalBeforeArrearsAdjustment =
    variable.totalVariableCharge + fixedCharge + arrears + adjustment;

  return {
    // Core inputs
    consumptionLiters,
    tariffVersion,
    boardKey,

    // Charge breakdown
    variableCharge: variable.totalVariableCharge,
    variableSlabBreakdown: variable.slabBreakdown,
    fixedCharge,

    // Additional amounts
    arrears,
    adjustment,

    // Calculated totals
    totalBeforeTax: Math.round(totalBeforeArrearsAdjustment * 100) / 100,
    totalPayable: Math.round((totalBeforeArrearsAdjustment + adjustment) * 100) / 100,

    // Source reference
    sourceReference: {
      tariffVersion,
      boardKey,
      effectiveDate: getTariffConfig(boardKey).effectiveDate,
      calculationMethod: 'deterministic-published-tariff-rules',
    },

    // Arrears/Adjustment breakdown notes
    notes: {
      variableCalculation: `Consumption charge computed using ${tariffVersion} tariff slab rates for ${boardKey}.`,
      arrearsLabel: arrears > 0 ? 'Outstanding arrears from previous periods' : 'No arrears',
      adjustmentLabel: adjustment !== 0 ? 'Adjustment applied' : 'No adjustment',
    },
  };
}

/**
 * Compares two bill periods and generates a discrepancy checklist.
 *
 * @param {Object} params
 * @param {number} params.period1Consumption - Consumption for period 1 (liters)
 * @param {number} params.period2Consumption - Consumption for period 2 (liters)
 * @param {Object} [params.period1Bill] - Optional full bill object for period 1
 * @param {Object} [params.period2Bill] - Optional full bill object for period 2
 * @returns {Object} Comparison results with discrepancy checklist
 */
export function compareBillPeriods({
  period1Consumption,
  period2Consumption,
  period1Bill = null,
  period2Bill = null,
}) {
  const consumptionDiff = period2Consumption - period1Consumption;
  const diffDirection = consumptionDiff >= 0 ? 'increase' : 'decrease';

  // Calculate charges for both periods using existing bills if available, or just consumption
  const bill1 = period1Bill
    ? calculateTotalBill({ consumptionLiters: period1Consumption, ...period1Bill })
    : calculateTotalBill({ consumptionLiters: period1Consumption });

  const bill2 = period2Bill
    ? calculateTotalBill({ consumptionLiters: period2Consumption, ...period2Bill })
    : calculateTotalBill({ consumptionLiters: period2Consumption });

  const chargeDiff = bill2.totalPayable - bill1.totalPayable;

  // Generate discrepancy checklist items
  const checklistItems = [];

  // Consumption change
  checklistItems.push({
    id: 'consumption-change',
    category: 'consumption',
    title: 'Consumption Change',
    description: `Period 1: ${period1Consumption} L → Period 2: ${period2Consumption} L (${Math.abs(
      consumptionDiff
    )} L ${diffDirection})`,
    isCritical: Math.abs(consumptionDiff) > 500,
    userConfirmable: true,
  });

  // Variable charge change
  checklistItems.push({
    id: 'variable-charge-change',
    category: 'charges',
    title: 'Variable Charge Change',
    description: `₹${bill1.variableCharge.toFixed(2)} → ₹${bill2.variableCharge.toFixed(2)} (₹${(bill2.variableCharge - bill1.variableCharge).toFixed(2)})`,
    isCritical: Math.abs(bill2.variableCharge - bill1.variableCharge) > 100,
    userConfirmable: true,
  });

  // Fixed charge change (should be constant)
  checklistItems.push({
    id: 'fixed-charge-change',
    category: 'charges',
    title: 'Fixed Charge Consistency',
    description: `Period 1: ₹${bill1.fixedCharge} → Period 2: ₹${bill2.fixedCharge}`,
    isCritical: bill1.fixedCharge !== bill2.fixedCharge,
    userConfirmable: bill1.fixedCharge !== bill2.fixedCharge,
  });

  // Total charge change
  checklistItems.push({
    id: 'total-charge-change',
    category: 'charges',
    title: 'Total Payable Change',
    description: `₹${bill1.totalPayable.toFixed(2)} → ₹${bill2.totalPayable.toFixed(2)} (₹${chargeDiff.toFixed(2)})`,
    isCritical: Math.abs(chargeDiff) > 150,
    userConfirmable: true,
  });

  // Arrears change
  checklistItems.push({
    id: 'arrears-change',
    category: 'arrears',
    title: 'Arrears Change',
    description: `Period 1: ₹${bill1.arrears} → Period 2: ₹${bill2.arrears}`,
    isCritical: bill1.arrears !== bill2.arrears,
    userConfirmable: bill1.arrears !== bill2.arrears,
  });

  // Adjustment change
  checklistItems.push({
    id: 'adjustment-change',
    category: 'adjustments',
    title: 'Adjustment Change',
    description: `Period 1: ₹${bill1.adjustment} → Period 2: ₹${bill2.adjustment}`,
    isCritical: bill1.adjustment !== bill2.adjustment,
    userConfirmable: bill1.adjustment !== bill2.adjustment,
  });

  return {
    period1Consumption,
    period2Consumption,
    consumptionDiff,
    diffDirection,
    bill1,
    bill2,
    chargeDiff,
    diffPercentage: bill1.totalPayable > 0 ? Math.round((chargeDiff / bill1.totalPayable) * 100) : 0,
    checklistItems,
    summary: {
      consumptionChanged: consumptionDiff !== 0,
      variableChargeChanged: bill1.variableCharge !== bill2.variableCharge,
      fixedChargeChanged: bill1.fixedCharge !== bill2.fixedCharge,
      totalPayableChanged: chargeDiff !== 0,
    },
  };
}

/**
 * Formats a bill value with rupee symbol and proper decimal places.
 *
 * @param {number} value - Numeric value in rupees
 * @returns {string} Formatted string like "₹1,234.56"
 */
export function formatRupee(value) {
  return '₹' + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formats consumption in liters with appropriate units.
 *
 * @param {number} liters - Consumption in liters
 * @returns {string} Formatted string
 */
export function formatLiters(liters) {
  if (liters >= 1000000) {
    return (liters / 1000000).toFixed(2) + ' ML';
  }
  if (liters >= 1000) {
    return (liters / 1000).toFixed(2) + ' KL';
  }
  return liters + ' L';
}

/**
 * Determines if a reading is estimated or actual based on bill metadata.
 *
 * @param {Object} [bill] - Bill object with reading type metadata
 * @returns {Object} { isEstimated: boolean, reason?: string }
 */
export function isReadingEstimated(bill) {
  if (!bill || !bill.readingType) return { isEstimated: false, reason: 'No bill data provided' };

  const { readingType, source, ocrConfidence } = bill;

  // Check explicit reading type
  if (readingType === 'estimated') return { isEstimated: true, reason: 'Marked as estimated reading' };
  if (readingType === 'actual') return { isEstimated: false, reason: 'Actual meter reading' };

  // Check source
  if (source && source.toLowerCase().includes('estimate')) return { isEstimated: true, reason: 'Source indicates estimated' };

  // Check OCR confidence - low confidence may indicate estimated
  if (ocrConfidence !== undefined && ocrConfidence < 50) return { isEstimated: true, reason: 'Low OCR confidence' };

  return { isEstimated: false, reason: 'Actual reading' };
}

/**
 * Lists all available water board tariff configurations.
 *
 * @returns {Array<Object>} Array of tariff config objects
 */
export function listAvailableTariffs() {
  return [PMC_TARIFF, DJB_TARIFF, BWSSB_TARIFF, GENERIC_ULB_TARIFF];
}

/**
 * Validates a bill input payload.
 *
 * @param {Object} payload - Bill input payload to validate
 * @param {string} [payload.boardKey] - Water board key
 * @param {number} [payload.consumptionLiters] - Consumption in liters (must be >= 0)
 * @param {number} [payload.fixedCharge] - Fixed charge (₹, must be >= 0)
 * @param {number} [payload.arrears] - Arrears amount (₹, must be >= 0)
 * @param {number} [payload.adjustment] - Adjustment amount (₹, can be negative)
 * @returns {Object} Validation result { valid: boolean, errors: Array<string> }
 */
export function validateBillInput(payload) {
  const errors = [];

  if (payload.boardKey && !['PMC_PUNE', 'DJB_DELHI', 'BWSSB_BENGALURU', 'GENERIC_ULB'].includes(payload.boardKey)) {
    errors.push('Invalid boardKey. Must be one of: PMC_PUNE, DJB_DELHI, BWSSB_BENGALURU, GENERIC_ULB');
  }

  if (payload.consumptionLiters === undefined || payload.consumptionLiters === null) {
    errors.push('consumptionLiters is required and must be a number');
  } else if (typeof payload.consumptionLiters !== 'number' || payload.consumptionLiters < 0) {
    errors.push('consumptionLiters must be a non-negative number');
  }

  if (payload.fixedCharge !== undefined && (typeof payload.fixedCharge !== 'number' || payload.fixedCharge < 0)) {
    errors.push('fixedCharge must be a non-negative number if provided');
  }

  if (payload.arrears !== undefined && (typeof payload.arrears !== 'number' || payload.arrears < 0)) {
    errors.push('arrears must be a non-negative number if provided');
  }

  if (payload.adjustment !== undefined && typeof payload.adjustment !== 'number') {
    errors.push('adjustment must be a number if provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}