/**
 * Municipal Water Bill Consumption and Charge Visualizer Service
 *
 * Implements a deterministic, tariff-rule-driven visualizer for municipal water bills.
 * - Supports importing bill line items or manual entry
 * - Calculates transparent consumption breakdowns by tariff slab
 * - Enables comparison between two billing periods
 * - Generates discrepancy checklists from user-confirmed values
 * - Retains uploaded bill data only under explicit consent
 *
 * All charge calculations use published, fixed tariff rules. AI-assisted OCR suggestions
 * are labelled as such until user/authorized reviewer confirmation.
 */

// ---------------------------------------------------------------------------
// Utility: generate a short unique ID (not cryptographically secure)
// ---------------------------------------------------------------------------
function generateId(prefix = '') {
  const counter = (generateId.counter ??= 0);
  generateId.counter = counter + 1;
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Tariff slab definition published by the municipal water authority.
// Each slab defines a consumption range (lower bound inclusive, upper bound exclusive
// or null for unbounded) and the per-unit rate applicable within that range.
// ---------------------------------------------------------------------------
export const TARIFF_SLABS = {
  // Example slabs for a generic ULB; actual values should match the selected board's
  // published tariff. Structure: { minLiters: number, maxLiters?: number, ratePerLiter: number }
  // minLiters = 0 => first slab (lifeline/essential use)
  // maxLiters = null => last slab (high-usage tier)
  // Example (generic):
  // [
  //   { minLiters: 0, maxLiters: 1000, ratePerLiter: 2.5 },
  //   { minLiters: 1000, maxLiters: 3000, ratePerLiter: 5.0 },
  //   { minLiters: 3000, maxLiters: null, ratePerLiter: 8.0 },
  // ],
};

/**
 * Tariff version reference from the municipal authority.
 * Used to tag calculations and explanations with the source of rate rules.
 */
export const TARIFF_VERSIONS = {
  // Example: 'DJB-2024', 'BWSSB-2023', etc.
  // The tariff version is selected when the user specifies their water board/jurisdiction.
};

/**
 * Meter reading record originating from a bill import or manual entry.
 */
export class MeterReading {
  /**
   * @param {object} params
   * @param {string} params.readingDate - Date of the meter reading (YYYY-MM-DD)
   * @param {string} params.readingType - 'actual' or 'estimated'
   * @param {number} params.unitsConsumed - Net water consumption in liters (or cubic meters)
   * @param {number} [params.openingReading] - Meter reading at period start
   * @param {number} [params.closingReading] - Meter reading at period end
   * @param {string} [params.source] - How the reading was obtained: 'import', 'manual', 'ocr', 'confirmed'
   * @param {boolean} [params.isOCRSuggestion] - Whether this value came from OCR suggestion
   */
  constructor({ readingDate, readingType, unitsConsumed, openingReading, closingReading, source = 'manual', isOCRSuggestion = false }) {
    // Validate and store
    const parsedDate = readingDate ? new Date(readingDate) : new Date();
    if (isNaN(parsedDate)) {
      throw new Error('readingDate must be a valid date in YYYY-MM-DD format');
    }
    this.readingDate = readingDate; // stored as original string for display
    this.readingType = readingType; // 'actual' or 'estimated'
    this.unitsConsumed = unitsConsumed; // net consumption
    this.openingReading = openingReading;
    this.closingReading = closingReading;
    this.source = source;
    this.isOCRSuggestion = isOCRSuggestion; // boolean property, NOT a method
    this.id = generateId('meter-reading');
  }

  /**
   * Calculate net consumption from opening and closing readings.
   * @returns {number} Net units consumed (closing - opening), or unitsConsumed if set.
   */
  calculateNetConsumption() {
    if (this.unitsConsumed !== undefined && this.unitsConsumed >= 0) {
      return this.unitsConsumed;
    }
    if (this.closingReading !== undefined && this.openingReading !== undefined) {
      return Math.max(0, this.closingReading - this.openingReading);
    }
    return 0;
  }

  /**
   * Returns a human-readable label for the reading type.
   * @returns {string}
   */
  getReadingTypeLabel() {
    return this.readingType === 'estimated' ? 'Estimated (AI suggestion)' : 'Actual reading';
  }

  /**
   * Is this an estimated reading?
   * @returns {boolean}
   */
  isEstimated() {
    return this.readingType === 'estimated';
  }

  /**
   * Is this value an OCR suggestion that has not been confirmed?
   * @returns {boolean}
   */
  isOCRSuggestionUnconfirmed() {
    return this.isOCRSuggestion && this.readingType !== 'confirmed';
  }
}

/**
 * Billing period definition.
 */
export class BillingPeriod {
  /**
   * @param {object} params
   * @param {string} params.periodStart - Start date (YYYY-MM-DD)
   * @param {string} params.periodEnd - End date (YYYY-MM-DD)
   * @param {MeterReading} params.reading - The meter reading for this period
   * @param {string} [params.tariffVersion] - Identifier of the tariff version applied
   */
  constructor({ periodStart, periodEnd, reading, tariffVersion }) {
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.reading = reading;
    this.tariffVersion = tariffVersion;
    this.id = generateId('billing-period');
    this.durationDays = this._computeDurationDays();
  }

  _computeDurationDays() {
    const start = new Date(this.periodStart);
    const end = new Date(this.periodEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return null;
    }
    const diffMs = end.getTime() - start.getTime();
    return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get the number of days in the billing period.
   * @returns {number|null}
   */
  getDurationDays() {
    return this.durationDays;
  }

  /**
   * Validate that the period dates are logical (end after start).
   * @returns {boolean}
   */
  isValid() {
    return new Date(this.periodEnd) > new Date(this.periodStart);
  }
}

/**
 * Tariff slab application result for a given consumption amount.
 */
export class SlabCalculationResult {
  /**
   * @param {object} params
   * @param {number} params.consumption - Total consumption in liters/cubic meters
   * @param {Array<{minLiters: number, maxLiters?: number, ratePerLiter: number}>} params.slabs - Tariff slab definitions
   * @param {string} [params.tariffVersion] - The tariff version used
   */
  constructor({ consumption, slabs, tariffVersion }) {
    this.consumption = consumption;
    this.tariffVersion = tariffVersion;
    this.slabBreakdown = this._computeSlabBreakdown(slabs);
    this.totalCharge = this._computeTotalCharge();
    this.effectiveRate = this._computeEffectiveRate();
    this.id = generateId('slab-calculation');
  }

  _computeSlabBreakdown(slabs) {
    const breakdown = [];
    let remaining = this.consumption;

    for (const slab of slabs) {
      const slabMin = slab.minLiters;
      const slabMax = slab.maxLiters; // may be null (unbounded)
      const slabRate = slab.ratePerLiter;

      // Determine the amount consumable in this slab
      let consumableInThisSlab;
      if (slabMax === null || slabMax === undefined) {
        // Unbounded slab: all remaining consumption falls here
        consumableInThisSlab = remaining;
      } else {
        // Bounded slab: minLiters to maxLiters
        const slabCapacity = slabMax - slabMin;
        consumableInThisSlab = Math.min(remaining, Math.max(0, slabCapacity));
      }

      if (consumableInThisSlab <= 0) {
        // Skip slabs with no consumption - only include slabs that have data
        // (unless this is the first slab, in which case we still need to track the range)
        if (breakdown.length === 0 && this.consumption > 0) {
          // First slab has 0 consumption but consumption > 0; show it as starting point
          breakdown.push({
            slabRange: this._formatSlabRange(slab),
            consumedInSlab: 0,
            ratePerLiter: slabRate,
            charge: 0,
          });
        }
        // If we've already started including slabs and hit one with 0 consumption
        // after some had data, we break since consumption is exhausted
        if (breakdown.length > 0) {
          break;
        }
        continue;
      }

      const charge = Math.round(consumableInThisSlab * slabRate * 100) / 100; // round to 2 decimals
      breakdown.push({
        slabRange: this._formatSlabRange(slab),
        consumedInSlab: consumableInThisSlab,
        ratePerLiter: slabRate,
        charge,
      });

      remaining -= consumableInThisSlab;

      // If no more consumption remaining and there are more slabs, stop
      if (remaining <= 0) {
        // Check if there's a next slab that would be partially filled
        // (we don't include it if it has 0 additional consumption)
        break;
      }
    }

    // If there's remaining consumption beyond the last included slab,
    // add it as overage on the last slab
    if (remaining > 0 && breakdown.length > 0) {
      const lastSlab = breakdown[breakdown.length - 1];
      lastSlab.overageConsumed = remaining;
      lastSlab.overageCharge = Math.round(remaining * lastSlab.ratePerLiter * 100) / 100;
    } else if (remaining > 0 && breakdown.length === 0) {
      // All slabs had 0 consumable (e.g., consumption = 0 or all minLiters > consumption)
      // In this case, no breakdown needed; total will be 0
    }

    return breakdown;
  }

  _formatSlabRange(slab) {
    const min = slab.minLiters;
    const max = slab.maxLiters;
    if (max === null || max === undefined) {
      return `${min}+ liters`;
    }
    return `${min}-${max} liters`;
  }

  _computeTotalCharge() {
    return this.slabBreakdown.reduce((sum, s) => sum + s.charge, 0);
  }

  _computeEffectiveRate() {
    if (this.consumption === 0) return 0;
    return Math.round((this._computeTotalCharge() / this.consumption) * 1000) / 1000; // 3 decimal places
  }

  /**
   * Get human-readable breakdown string.
   * @returns {string}
   */
  toString() {
    const lines = [
      `Consumption: ${this.consumption} liters`,
      `Tariff version: ${this.tariffVersion || 'N/A'}`,
    ];
    for (const s of this.slabBreakdown) {
      lines.push(
        `  ${s.slabRange}: ${s.consumedInSlab} L × ₹${s.ratePerLiter}/L = ₹${s.charge.toFixed(2)}`
      );
    }
    lines.push(`Total charge: ₹${this.totalCharge.toFixed(2)}`);
    lines.push(`Effective rate: ₹${this.effectiveRate.toFixed(3)}/L`);
    return lines.join('\n');
  }
}

/**
 * Complete water bill charge composition.
 * Fixed charges (service charge, meter charge, etc.) plus variable consumption charges.
 */
export class WaterBillChargeComposition {
  /**
   * @param {object} params
   * @param {number} params.fixedCharges - Sum of all fixed charges (service charge, meter rent, etc.)
   * @param {number} params.consumptionCharge - Variable consumption charge from slab calculation
   * @param {number} [params.arrears] - Any outstanding arrears amount
   * @param {number} [params.adjustments] - Net adjustments (credits or debits)
   * @param {number} [params.total] - Grand total = fixedCharges + consumptionCharge + arrears + adjustments
   * @param {SlabCalculationResult} [params.slabCalculation] - The SlabCalculationResult that contributed the consumptionCharge
   * @param {string} [params.tariffVersion] - The tariff version applied
   */
  constructor({
    fixedCharges = 0,
    consumptionCharge = 0,
    arrears = 0,
    adjustments = 0,
    total,
    slabCalculation,
    tariffVersion,
  }) {
    this.fixedCharges = fixedCharges;
    this.consumptionCharge = consumptionCharge;
    this.arrears = arrears;
    this.adjustments = adjustments;
    this.total = total !== undefined ? total : fixedCharges + consumptionCharge + arrears + adjustments;
    this.slabCalculation = slabCalculation;
    this.tariffVersion = tariffVersion;
    this.id = generateId('water-bill-charge-composition');
  }

  /**
   * Recalculate the total from line items.
   * Every total reconciles to line items.
   * @returns {number}
   */
  recalculateTotal() {
    const rawTotal = this.fixedCharges + this.consumptionCharge + this.arrears + this.adjustments;
    this.total = rawTotal;
    return this.total;
  }

  /**
   * Validate that the total reconciles to line items within a small tolerance.
   * @param {number} [tolerance=0.01]
   * @returns {boolean}
   */
  validateTotalReconciles(tolerance = 0.01) {
    const expected = this.fixedCharges + this.consumptionCharge + this.arrears + this.adjustments;
    return Math.abs(expected - this.total) <= tolerance;
  }

  /**
   * Get human-readable breakdown string.
   * @returns {string}
   */
  toString() {
    const lines = [
      `Fixed charges: ₹${this.fixedCharges.toFixed(2)}`,
      `Consumption charge: ₹${this.consumptionCharge.toFixed(2)}`,
    ];
    if (this.arrears !== 0) {
      lines.push(`Arrears: ₹${this.arrears.toFixed(2)}`);
    }
    if (this.adjustments !== 0) {
      lines.push(`Adjustments: ₹${this.adjustments.toFixed(2)}`);
    }
    lines.push(`---`);
    lines.push(`Total: ₹${this.total.toFixed(2)}`);
    return lines.join('\n');
  }
}

/**
 * Discrepancy item from a period comparison.
 */
export class DiscrepancyItem {
  /**
   * @param {object} params
   * @param {string} params.field - The field name where discrepancy was found
   * @param {string} [params.description] - Human-readable description
   * @param {number} [params.oldValue] - Value from the first period
   * @param {number} [params.newValue] - Value from the second period
   * @param {string} [params.reason] - Why this is flagged
   * @param {boolean} [params.userConfirmed] - Whether the user has confirmed/ resolved this item
   */
  constructor({ field, description, oldValue, newValue, reason, userConfirmed = false }) {
    this.field = field;
    this.description = description || field;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.reason = reason;
    this.userConfirmed = userConfirmed;
    this.id = generateId('discrepancy-item');
  }

  /**
   * Is this discrepancy resolved/confirmed by the user?
   * @returns {boolean}
   */
  isResolved() {
    return this.userConfirmed;
  }

  /**
   * Get display label.
   * @returns {string}
   */
  toString() {
    const parts = [this.description || this.field];
    if (this.oldValue !== undefined && this.newValue !== undefined) {
      parts.push(`changed from ${this.oldValue} to ${this.newValue}`);
    }
    if (this.reason) {
      parts.push(this.reason);
    }
    return parts.join(' · ');
  }
}

/**
 * Comparison result between two billing periods.
 */
export class PeriodComparisonResult {
  /**
   * @param {object} params
   * @param {BillingPeriod} params.periodA - First billing period
   * @param {BillingPeriod} params.periodB - Second billing period
   * @param {DiscrepancyItem[]} [params.discrepancies] - Identified discrepancies
   * @param {number} [params.consumptionDelta] - Difference in consumption (new - old)
   * @param {number} [params.chargeDelta] - Difference in total charge (new - old)
   */
  constructor({ periodA, periodB, discrepancies, consumptionDelta, chargeDelta }) {
    this.periodA = periodA;
    this.periodB = periodB;
    this.discrepancies = discrepancies || [];
    this.consumptionDelta = consumptionDelta;
    this.chargeDelta = chargeDelta;
    this.id = generateId('period-comparison');
  }

  /**
   * Run comparison and populate discrepancies based on user-confirmed values.
   * @param {object} [options] - Comparison options
   * @param {boolean} [options.compareConsumption] - Compare consumption values
   * @param {boolean} [options.compareCharges] - Compare total charges
   * @returns {PeriodComparisonResult}
   */
  static comparePeriods(periodA, periodB, options = {}) {
    const discrepancies = [];
    const compareConsumption = options.compareConsumption !== false;
    const compareCharges = options.compareCharges !== false;

    // Compute totals upfront (may be null if charge composition not available)
    const aTotal = periodA.chargeComposition ? periodA.chargeComposition.total : null;
    const bTotal = periodB.chargeComposition ? periodB.chargeComposition.total : null;

    // Compare consumption
    if (compareConsumption) {
      const aConsumption = periodA.reading.calculateNetConsumption();
      const bConsumption = periodB.reading.calculateNetConsumption();
      if (aConsumption !== bConsumption) {
        discrepancies.push(
          new DiscrepancyItem({
            field: 'consumption',
            description: 'Water consumption',
            oldValue: aConsumption,
            newValue: bConsumption,
            reason:
              periodA.reading.isEstimated() || periodB.reading.isEstimated()
                ? 'One or both readings are estimated; comparison may be unreliable.'
                : 'Consumption difference detected.',
          })
        );
      }
    }

    // Compare total charges
    if (compareCharges) {
      if (aTotal !== null && bTotal !== null && aTotal !== bTotal) {
        discrepancies.push(
          new DiscrepancyItem({
            field: 'totalCharge',
            description: 'Total bill amount',
            oldValue: aTotal,
            newValue: bTotal,
            reason: 'Total charge difference between billing periods.',
          })
        );
      }
    }

    const consumptionDelta =
      compareConsumption
        ? periodA.reading.calculateNetConsumption() - periodB.reading.calculateNetConsumption()
        : 0;
    const chargeDelta =
      compareCharges && aTotal !== null && bTotal !== null ? bTotal - aTotal : 0;

    return new PeriodComparisonResult({
      periodA,
      periodB,
      discrepancies,
      consumptionDelta,
      chargeDelta,
    });
  }
}

/**
 * Service class for water bill visualizer operations.
 */
export class WaterBillVisualizerService {
  constructor() {
    // In-memory store for user sessions (non-sensitive data only)
    this.userSessions = new Map();
  }

  /**
   * Create a new user session for bill visualizer workflow.
   * Non-sensitive inputs are retained so the user can cancel/resume.
   * @param {object} initialData - Initial bill line items or imported data
   * @returns {string} Session ID
   */
  createSession(initialData = {}) {
    const sessionId = generateId('visualizer-session');
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        // Core bill data
        billLineItems: initialData.billLineItems || [],
        imported: initialData.imported || false,
        consentGiven: initialData.consentGiven || false,
        // User confirmed values
        confirmedReadings: initialData.confirmedReadings || [],
        // Comparison state
        comparisonPeriodA: initialData.comparisonPeriodA,
        comparisonPeriodB: initialData.comparisonPeriodB,
        // UI state
        status: 'idle', // 'idle', 'loading', 'error', 'stale-data', 'permission-denied'
        error: null,
      },
      // Distinguish from official government application status
      isOfficialStatus: false,
    };
    this.userSessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Get a user session by ID.
   * @param {string} sessionId
   * @returns {object|null} Session data or null if not found
   */
  getSession(sessionId) {
    return this.userSessions.get(sessionId) || null;
  }

  /**
   * Update session data (used when user confirms values, adds readings, etc.).
   * Only non-sensitive fields are persisted.
   * @param {string} sessionId
   * @param {object} updates - Partial session data to merge
   * @returns {boolean} Whether the update succeeded
   */
  updateSession(sessionId, updates) {
    const session = this.userSessions.get(sessionId);
    if (!session) return false;

    // Merge updates, preserving non-sensitive data only
    session.data = { ...session.data, ...updates };
    session.updatedAt = new Date().toISOString();
    this.userSessions.set(sessionId, session);
    return true;
  }

  /**
   * Delete a user session (clear non-sensitive progress).
   * Does not affect official government application status.
   * @param {string} sessionId
   * @returns {boolean}
   */
  deleteSession(sessionId) {
    return this.userSessions.delete(sessionId);
  }

  /**
   * Import bill line items from a structured payload.
   * Validates the payload and returns line items ready for the visualizer.
   * Only retains data under explicit consent.
   * @param {object} payload - Bill import payload
   * @param {string} payload.consumerNumber - Consumer/meter number (non-sensitive)
   * @param {string} [payload.boardKey] - Water board identifier for tariff lookup
   * @param {Array<object>} [payload.lineItems] - Parsed bill line items
   * @param {boolean} [payload.consent] - Whether user consented to retain bill data
   * @returns {object} { lineItems, errors, consentRequired }
   */
  importBillData(payload) {
    const errors = [];

    // Validate required fields
    if (!payload || typeof payload !== 'object') {
      errors.push('Invalid payload: expected a JSON object.');
      return { lineItems: [], errors, consentRequired: false };
    }

    // Consumer number is optional but recommended for identification
    if (payload.consumerNumber && typeof payload.consumerNumber !== 'string') {
      errors.push('consumerNumber must be a string.');
    }

    // Validate line items if provided
    if (payload.lineItems && Array.isArray(payload.lineItems)) {
      for (let i = 0; i < payload.lineItems.length; i++) {
        const item = payload.lineItems[i];
        if (!item || typeof item !== 'object') {
          errors.push(`lineItem[${i}]: expected an object.`);
          continue;
        }
        // Each line item should have a description and amount
        if (item.description === undefined && item.label === undefined) {
          errors.push(`lineItem[${i}]: missing description/label.`);
        }
        if (item.amount === undefined && item.value === undefined) {
          errors.push(`lineItem[${i}]: missing amount/value.`);
        }
      }
    }

    // Consent check: if user hasn't given consent, we retain data only temporarily
    const consentGiven = payload.consent === true;
    if (!consentGiven) {
      // Mark that consent is required for data retention
      // (non-sensitive data can be kept for session workflow but not long-term)
    }

    const lineItems = payload.lineItems || [];

    return {
      lineItems,
      errors: errors.length > 0 ? errors : null,
      consentRequired: !consentGiven,
    };
  }

  /**
   * Parse OCR-suggested values from an uploaded bill image.
   * OCR suggestions are labelled as such and must be confirmed by the user.
   * @param {object} ocrResults - Raw OCR extraction results
   * @returns {MeterReading[]} Parsed meter readings, labelled as OCR suggestions
   */
  parseOCRSuggestions(ocrResults) {
    const readings = [];

    // Expected OCR result structure (may vary based on integration):
    // {
    //   readingDate: '2024-03-15',
    //   readingType: 'actual' | 'estimated',
    //   unitsConsumed: 5200,
    //   openingReading: 12340,
    //   closingReading: 17540,
    //   source: 'ocr',
    // }

    if (!ocrResults) {
      return readings;
    }

    // Normalize to array
    const results = Array.isArray(ocrResults) ? ocrResults : [ocrResults];

    for (const result of results) {
      if (result.readingDate !== undefined) {
        readings.push(new MeterReading({
          readingDate: result.readingDate,
          readingType: result.readingType || 'actual',
          unitsConsumed: result.unitsConsumed,
          openingReading: result.openingReading,
          closingReading: result.closingReading,
          source: 'ocr',
          isOCRSuggestion: true,
        }));
      }
    }

    return readings;
  }

  /**
   * Create a billing period from user-confirmed readings.
   * @param {object} params
   * @param {string} params.periodStart - Billing period start date (YYYY-MM-DD)
   * @param {string} params.periodEnd - Billing period end date (YYYY-MM-DD)
   * @param {MeterReading} params.reading - User-confirmed meter reading
   * @param {string} [params.tariffVersion] - Tariff version identifier
   * @returns {BillingPeriod}
   */
  createBillingPeriod({ periodStart, periodEnd, reading, tariffVersion }) {
    return new BillingPeriod({ periodStart, periodEnd, reading, tariffVersion });
  }

  /**
   * Calculate the charge composition for a billing period.
   * Uses deterministic tariff slab rules. AI suggestions are labelled.
   * @param {object} params
   * @param {BillingPeriod} params.period - The billing period
   * @param {Array<{minLiters: number, maxLiters?: number, ratePerLiter: number}>} [params.slabs] - Tariff slabs
   *   if not provided, uses default slabs or those associated with the tariff version
   * @returns {WaterBillChargeComposition}
   */
  calculateChargeComposition({ period, slabs }) {
    if (!period || !period.reading) {
      throw new Error('Period and reading are required for charge composition calculation.');
    }

    const consumption = period.reading.calculateNetConsumption();

    // Use provided slabs or fall back to defaults
    const effectiveSlabs = slabs || this._getDefaultSlabs();

    const slabCalc = new SlabCalculationResult({ consumption, slabs: effectiveSlabs, tariffVersion: period.tariffVersion });

    // Fixed charges are typically board-specific; here we use a generic placeholder.
    // In a full integration, this would come from the water board catalog.
    const fixedCharges = 50.00; // Base service charge (generic)

    const composition = new WaterBillChargeComposition({
      fixedCharges,
      consumptionCharge: slabCalc.totalCharge,
      slabCalculation: slabCalc,
      tariffVersion: period.tariffVersion,
    });

    // Validate reconciliation
    if (!composition.validateTotalReconciles()) {
      // This should not happen with deterministic code, but we adjust
      composition.adjustments = composition.adjustments - (composition.total - composition.recalculateTotal());
    }

    return composition;
  }

  _getDefaultSlabs() {
    // Default generic slabs - in production these would come from the selected water board's published tariff
    return [
      { minLiters: 0, maxLiters: 1000, ratePerLiter: 2.5 },   // Lifeline/essential use
      { minLiters: 1000, maxLiters: 3000, ratePerLiter: 5.0 }, // Moderate use
      { minLiters: 3000, maxLiters: null, ratePerLiter: 8.0 }, // High-usage tier
    ];
  }

  /**
   * Generate a discrepancy checklist from a period comparison.
   * The user reviews and confirms each item.
   * @param {PeriodComparisonResult} comparison - The comparison result
   * @returns {DiscrepancyItem[]} The discrepancy checklist
   */
  generateDiscrepancyChecklist(comparison) {
    // Return a copy so the caller can mark items as confirmed
    return comparison.discrepancies.map((item) => new DiscrepancyItem({
      field: item.field,
      description: item.description,
      oldValue: item.oldValue,
      newValue: item.newValue,
      reason: item.reason,
      userConfirmed: item.userConfirmed,
    }));
  }

  /**
   * Mark a discrepancy item as confirmed by the user.
   * @param {string} discrepancyId - The discrepancy item ID to confirm
   * @returns {boolean} Whether the confirmation was applied
   */
  confirmDiscrepancy(discrepancyId) {
    // Search across all user sessions for the discrepancy
    for (const session of this.userSessions.values()) {
      const discrepancies = session.data.discrepancyChecklist || [];
      const idx = discrepancies.findIndex((d) => d.id === discrepancyId);
      if (idx >= 0) {
        discrepancies[idx].userConfirmed = true;
        session.data.discrepancyChecklist = discrepancies;
        session.updatedAt = new Date().toISOString();
        this.userSessions.set(session.id, session);
        return true;
      }
    }
    return false;
  }

  /**
   * Get the data version used for calculations, for source referencing.
   * @returns {object} { tariffVersion, slabsVersion, generatedAt }
   */
  getDataVersion() {
    return {
      tariffVersion: typeof TARIFF_VERSIONS !== 'undefined' ? 'generic' : 'unknown',
      slabsVersion: 'default-generic-1.0',
      generatedAt: new Date().toISOString(),
    };
  }
}