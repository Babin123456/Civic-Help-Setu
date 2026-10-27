/**
 * Civic Service Fee Transparency Service (#145)
 *
 * Implements structured statutory fee discovery, optional third-party cost separation,
 * expired schedule warnings, non-collection disclaimers, fee calculations,
 * and admin validation guards for civic service charges.
 */

import { SERVICE_FEE_BREAKDOWNS } from '../data/serviceFeeBreakdowns';

export const FEE_PREFERENCES_STORAGE_KEY = 'civic_service_fee_preferences';
export const EXPIRY_THRESHOLD_DAYS = 365;

/**
 * Checks whether a fee schedule record is expired or due for review.
 *
 * @param {Object} record - The fee breakdown record.
 * @param {Date|string} [referenceDate=new Date()] - Reference date for time comparison.
 * @returns {boolean} True if expired or overdue for review.
 */
export const isFeeScheduleExpired = (record, referenceDate = new Date()) => {
  if (!record) return false;
  const now = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();

  // 1. Explicit expiry date in record
  if (record.expiryDate) {
    const expiryTime = new Date(record.expiryDate).getTime();
    if (!Number.isNaN(expiryTime) && expiryTime <= now) {
      return true;
    }
  }

  // 2. Scheduled review threshold check: if lastReviewedDate or effectiveDate is older than 365 days
  const auditDateStr = record.lastReviewedDate || record.effectiveDate;
  if (auditDateStr) {
    const auditTime = new Date(auditDateStr).getTime();
    if (!Number.isNaN(auditTime)) {
      const elapsedDays = Math.floor((now - auditTime) / (1000 * 60 * 60 * 24));
      if (elapsedDays > EXPIRY_THRESHOLD_DAYS) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Returns a structured fee breakdown for a given service.
 * If the service has no verified official data, returns a safe unverified fallback (never estimated).
 *
 * @param {string} serviceId - Unique ID of the civic service.
 * @param {Object} [options={}]
 * @param {Date|string} [options.referenceDate=new Date()] - Optional reference date for testing.
 * @returns {Object} Structured fee breakdown object.
 */
export const getServiceFeeBreakdown = (serviceId, options = {}) => {
  const referenceDate = options.referenceDate || new Date();

  if (!serviceId || typeof serviceId !== 'string') {
    return createUnverifiedFallback(serviceId);
  }

  const rawRecord = SERVICE_FEE_BREAKDOWNS[serviceId];

  // If no record exists or status is unverified, NEVER estimate or guess amounts.
  if (!rawRecord || rawRecord.status === 'unverified') {
    return createUnverifiedFallback(serviceId, rawRecord?.serviceName);
  }

  const isExpired = isFeeScheduleExpired(rawRecord, referenceDate);

  // Compute official statutory minimum and maximum costs
  let minOfficialCost = 0;
  let maxOfficialCost = 0;

  if (rawRecord.conditionalTiers && rawRecord.conditionalTiers.length > 0) {
    const tierAmounts = rawRecord.conditionalTiers.map((t) => Number(t.amount) || 0);
    minOfficialCost = Math.min(...tierAmounts);
    maxOfficialCost = Math.max(...tierAmounts);
  } else if (rawRecord.officialStatutoryFees && rawRecord.officialStatutoryFees.length > 0) {
    const totalStatutory = rawRecord.officialStatutoryFees.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
    minOfficialCost = totalStatutory;
    maxOfficialCost = totalStatutory;
  }

  const reviewWarning = isExpired
    ? `Caution: This fee schedule was published on ${rawRecord.effectiveDate || 'an unverified date'} and is past its ${EXPIRY_THRESHOLD_DAYS}-day review window. Always confirm current rates directly with the official department before making any payment.`
    : null;

  return {
    ...rawRecord,
    isVerified: true,
    isExpired,
    reviewWarning,
    minOfficialCost,
    maxOfficialCost,
    hasConditionalTiers: Boolean(rawRecord.conditionalTiers?.length),
    hasOptionalCharges: Boolean(rawRecord.optionalProviderCharges?.length),
    disclaimer:
      'Civic Help Setu does NOT collect or process any fees. All statutory payments must be made strictly on the official government portal or authorized treasury counter.',
  };
};

/**
 * Creates a safe fallback for unverified or unknown fee schedules.
 *
 * @param {string} serviceId
 * @param {string} [serviceName]
 * @returns {Object}
 */
const createUnverifiedFallback = (serviceId, serviceName = null) => ({
  serviceId: serviceId || 'unknown',
  serviceName: serviceName || 'Civic Public Service',
  status: 'unverified',
  isVerified: false,
  isFreeService: false,
  currency: 'INR',
  effectiveDate: null,
  expiryDate: null,
  lastReviewedDate: null,
  officialSource: null,
  officialStatutoryFees: [],
  conditionalTiers: [],
  optionalProviderCharges: [],
  acceptedPaymentMethods: [],
  refundPolicyNotes: null,
  minOfficialCost: null,
  maxOfficialCost: null,
  hasConditionalTiers: false,
  hasOptionalCharges: false,
  isExpired: false,
  reviewWarning:
    'Unverified Fee Notice: Official published gazette fee details are not verified on record for this specific service. Do not pay any unverified charges, commission agents, or informal demands.',
  disclaimer:
    'Civic Help Setu does NOT collect or process any fees. Never pay unverified or informal requests.',
});

/**
 * Calculates total expenditure based on selected tier and chosen optional provider charges.
 *
 * @param {Object} feeBreakdown - Enriched fee breakdown from getServiceFeeBreakdown.
 * @param {string} [selectedTierId] - Selected conditional tier ID.
 * @param {string[]} [selectedOptionalChargeIds=[]] - Array of chosen optional provider charge IDs.
 * @returns {Object} Calculated totals and categorized breakdown.
 */
export const calculateTotalExpenditure = (
  feeBreakdown,
  selectedTierId = null,
  selectedOptionalChargeIds = []
) => {
  if (!feeBreakdown || !feeBreakdown.isVerified) {
    return {
      officialTotal: 0,
      optionalTotal: 0,
      grandTotal: 0,
      currency: feeBreakdown?.currency || 'INR',
      appliedOfficialItems: [],
      appliedOptionalItems: [],
      isFree: false,
    };
  }

  let officialTotal = 0;
  const appliedOfficialItems = [];

  // 1. Evaluate selected tier or fallback to baseline statutory fees
  if (feeBreakdown.conditionalTiers && feeBreakdown.conditionalTiers.length > 0) {
    const matchedTier =
      feeBreakdown.conditionalTiers.find((t) => t.id === selectedTierId) ||
      feeBreakdown.conditionalTiers[0];

    if (matchedTier) {
      officialTotal = Number(matchedTier.amount) || 0;
      appliedOfficialItems.push({
        id: matchedTier.id,
        label: matchedTier.label,
        amount: officialTotal,
        mandatory: true,
        type: 'statutory_tier',
      });
    }
  } else if (feeBreakdown.officialStatutoryFees) {
    feeBreakdown.officialStatutoryFees.forEach((fee) => {
      const amt = Number(fee.amount) || 0;
      officialTotal += amt;
      appliedOfficialItems.push({
        id: fee.id,
        label: fee.label,
        amount: amt,
        mandatory: fee.mandatory !== false,
        type: 'statutory_fee',
      });
    });
  }

  // 2. Evaluate selected optional third-party provider charges
  let optionalTotal = 0;
  const appliedOptionalItems = [];
  const selectedSet = new Set(selectedOptionalChargeIds);

  if (feeBreakdown.optionalProviderCharges) {
    feeBreakdown.optionalProviderCharges.forEach((charge) => {
      if (selectedSet.has(charge.id)) {
        const amt = Number(charge.amount) || 0;
        optionalTotal += amt;
        appliedOptionalItems.push({
          id: charge.id,
          label: charge.label,
          amount: amt,
          mandatory: false,
          provider: charge.provider,
          type: 'optional_provider_charge',
        });
      }
    });
  }

  const grandTotal = officialTotal + optionalTotal;

  return {
    officialTotal,
    optionalTotal,
    grandTotal,
    currency: feeBreakdown.currency || 'INR',
    appliedOfficialItems,
    appliedOptionalItems,
    isFree: feeBreakdown.isFreeService && grandTotal === 0,
  };
};

/**
 * Validates a fee record before administrative publishing or updating.
 * Rejects malformed amounts, missing sources, and invalid effective dates.
 *
 * @param {Object} record - The fee record to validate.
 * @param {Date|string} [referenceDate=new Date()] - Reference date for future date checks.
 * @returns {Object} Validation result { isValid: boolean, errors: string[] }
 */
export const validateFeeRecord = (record, referenceDate = new Date()) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { isValid: false, errors: ['Fee record must be a valid non-null object.'] };
  }

  // 1. Mandatory IDs and status
  if (!record.serviceId || typeof record.serviceId !== 'string' || !record.serviceId.trim()) {
    errors.push('Service ID is mandatory and must be a non-empty string.');
  }

  const validStatuses = ['published', 'free', 'unverified'];
  if (!record.status || !validStatuses.includes(record.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
  }

  // 2. Currency validation
  if (!record.currency || typeof record.currency !== 'string' || record.currency.trim().length !== 3) {
    errors.push('Currency must be a valid 3-letter ISO code (e.g., "INR").');
  }

  // 3. Effective date validation
  if (record.status !== 'unverified') {
    if (!record.effectiveDate || typeof record.effectiveDate !== 'string') {
      errors.push('Effective date is required for verified fee records.');
    } else {
      const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!isoDatePattern.test(record.effectiveDate)) {
        errors.push('Effective date must follow YYYY-MM-DD format.');
      } else {
        const parsedEffective = new Date(record.effectiveDate);
        if (Number.isNaN(parsedEffective.getTime())) {
          errors.push('Effective date must be a valid calendar date.');
        } else {
          // Reject dates more than 365 days into the future
          const now = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
          const oneYearFuture = now + 365 * 24 * 60 * 60 * 1000;
          if (parsedEffective.getTime() > oneYearFuture) {
            errors.push('Effective date cannot be more than 365 days in the future.');
          }
        }
      }
    }
  }

  // 4. Official source validation
  if (record.status === 'published' || record.status === 'free') {
    if (!record.officialSource || typeof record.officialSource !== 'object') {
      errors.push('Official source attribution is required for verified fee schedules.');
    } else {
      if (!record.officialSource.name || typeof record.officialSource.name !== 'string') {
        errors.push('Official source must have a valid publication/authority name.');
      }
      if (!record.officialSource.url || typeof record.officialSource.url !== 'string' || !/^https?:\/\//i.test(record.officialSource.url)) {
        errors.push('Official source must have a valid HTTP/HTTPS URL.');
      }
    }
  }

  // 5. Amount validation: Statutory fees
  if (Array.isArray(record.officialStatutoryFees)) {
    record.officialStatutoryFees.forEach((fee, idx) => {
      if (typeof fee.amount !== 'number' || !Number.isFinite(fee.amount) || Number.isNaN(fee.amount) || fee.amount < 0) {
        errors.push(`Statutory fee at index ${idx} ("${fee.label || 'unnamed'}") has a malformed amount: ${fee.amount}. Amount must be a non-negative finite number.`);
      }
    });
  }

  // 6. Amount validation: Conditional tiers
  if (Array.isArray(record.conditionalTiers)) {
    record.conditionalTiers.forEach((tier, idx) => {
      if (typeof tier.amount !== 'number' || !Number.isFinite(tier.amount) || Number.isNaN(tier.amount) || tier.amount < 0) {
        errors.push(`Conditional tier at index ${idx} ("${tier.label || 'unnamed'}") has a malformed amount: ${tier.amount}. Amount must be a non-negative finite number.`);
      }
    });
  }

  // 7. Amount validation: Optional provider charges
  if (Array.isArray(record.optionalProviderCharges)) {
    record.optionalProviderCharges.forEach((charge, idx) => {
      if (typeof charge.amount !== 'number' || !Number.isFinite(charge.amount) || Number.isNaN(charge.amount) || charge.amount < 0) {
        errors.push(`Optional provider charge at index ${idx} ("${charge.label || 'unnamed'}") has a malformed amount: ${charge.amount}.`);
      }
      if (charge.maxPermissibleCap !== undefined) {
        if (typeof charge.maxPermissibleCap !== 'number' || charge.maxPermissibleCap < charge.amount) {
          errors.push(`Optional charge "${charge.label}" maximum permissible cap cannot be lower than the stated amount.`);
        }
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Formats a numeric currency amount into standard Indian Rupee notation.
 *
 * @param {number} amount
 * @param {string} [currency='INR']
 * @returns {string} Formatted string, e.g. "₹1,500" or "Free".
 */
export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === 0) return 'Free';
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Unverified';

  const prefix = currency === 'INR' ? '₹' : `${currency} `;
  return `${prefix}${amount.toLocaleString('en-IN')}`;
};

/**
 * Loads user fee calculator preferences from localStorage.
 *
 * @param {string} serviceId
 * @returns {Object|null}
 */
export const loadFeePreferences = (serviceId) => {
  if (typeof window === 'undefined' || !serviceId) return null;
  try {
    const raw = localStorage.getItem(FEE_PREFERENCES_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[serviceId] || null;
  } catch {
    return null;
  }
};

/**
 * Saves user fee calculator preferences to localStorage.
 *
 * @param {string} serviceId
 * @param {Object} prefs - { selectedTierId, selectedOptionalChargeIds }
 */
export const saveFeePreferences = (serviceId, prefs) => {
  if (typeof window === 'undefined' || !serviceId) return;
  try {
    const raw = localStorage.getItem(FEE_PREFERENCES_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[serviceId] = {
      ...prefs,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(FEE_PREFERENCES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Non-fatal
  }
};
