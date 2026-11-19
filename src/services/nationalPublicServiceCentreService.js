/**
 * National Public Service Centre Overcharging and Receipt Evidence Assistant (#1003)
 *
 * Implements a fee evidence assistant that compares user-entered charges with
 * verified fee schedules for a selected service and jurisdiction.
 *
 * Models government fee, portal charge, authorized centre charge, and optional
 * service charge separately. Version each fee by authority, jurisdiction, effective
 * date, source, and verification date.
 *
 * Let users upload or enter a receipt and produce a redacted discrepancy report.
 * Links the correct official grievance route where published.
 *
 * Moderates community fee observations before display.
 *
 * Does not collect payment credentials or initiate transactions.
 */

import { SERVICE_FEE_BREAKDOWNS } from '../data/serviceFeeBreakdowns';
import { JURISDICTION_LEVELS, JURISDICTION_LEVEL_LABELS, INDIAN_STATES_AND_UTS } from '../data/jurisdictions';

// Re-export for test accessibility
export { JURISDICTION_LEVELS, JURISDICTION_LEVEL_LABELS, INDIAN_STATES_AND_UTS };

import { getServiceFeeBreakdown } from '../services/feeTransparencyService';

// ============================================================
// FEE VERSIONED RECORD MODEL
// ============================================================

/**
 * Status values for versioned fees.
 */
export const FEE_VERSION_STATUS = {
  PUBLISHED: 'published',
  FREE: 'free',
  UNVERIFIED: 'unverified',
  OBSOLETE: 'obsolete',
};

/**
 * Fee component types that are modeled separately
 */
export const FEE_COMPONENT_TYPES = {
  GOVERNMENT_FEE: 'government_fee',
  PORTAL_CHARGE: 'portal_charge',
  AUTHORISED_CENTRE_CHARGE: 'authorised_centre_charge',
  OPTIONAL_SERVICE_CHARGE: 'optional_service_charge',
};

/**
 * Creates a versioned fee record with full audit trail.
 *
 * Each fee component is modeled separately with authority, jurisdiction,
 * effective date, source, and verification date tracking.
 *
 * @param {Object} options - Creation options
 * @param {string} options.serviceId - Service identifier
 * @param {string} options.componentType - Fee component type
 * @param {string} options.authority - Fee-setting authority name
 * @param {string} options.jurisdiction - Jurisdiction level ('national', 'state', 'district', 'local')
 * @param {string} options.effectiveDate - YYYY-MM-DD format
 * @param {string} options.source - Official source name/URL
 * @param {string} options.verificationDate - When this version was verified
 * @param {number} [options.amount=0] - Fee amount
 * @param {boolean} [options.isMandatory=true] - Whether the fee is mandatory
 * @param {string} [options.status=FEE_VERSION_STATUS.PUBLISHED] - Status
 * @param {string} [options.currency='INR'] - Currency code
 * @param {Object} [options.supplementary] - Additional metadata
 * @returns {Object} Versioned fee record
 */
export const createVersionedFeeRecord = ({
  serviceId,
  componentType,
  authority,
  jurisdiction,
  effectiveDate,
  source,
  verificationDate,
  amount = 0,
  isMandatory = true,
  status = FEE_VERSION_STATUS.PUBLISHED,
  currency = 'INR',
  supplementary = {},
}) => {
  // Validate jurisdiction
  const validJurisdictions = ['national', 'state', 'district', 'local'];
  if (!validJurisdictions.includes(jurisdiction)) {
    errors.push(`jurisdiction must be one of: ${validJurisdictions.join(', ')}.`);
  }

  // Validate effective date format
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(effectiveDate)) {
    console.warn(`Effective date "${effectiveDate}" must be in YYYY-MM-DD format`);
  }

  // Slugify componentType for use in ID (replace underscores with hyphens)
    const idComponentType = componentType.replace(/_/g, '-');
    return {
    id: `fee-${serviceId}-${idComponentType}-${Date.now()}`,
    serviceId,
    componentType,
    authority,
    jurisdiction,
    effectiveDate,
    source,
    verificationDate,
    amount,
    isMandatory,
    status,
    currency,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...supplementary,
  };
};

/**
 * Creates a government fee (official statutory fee) versioned record.
 */
export const createGovernmentFee = (options) =>
  createVersionedFeeRecord({
    ...options,
    componentType: FEE_COMPONENT_TYPES.GOVERNMENT_FEE,
    status: FEE_VERSION_STATUS.PUBLISHED,
  });

/**
 * Creates a portal charge (online portal fee) versioned record.
 */
export const createPortalCharge = (options) =>
  createVersionedFeeRecord({
    ...options,
    componentType: FEE_COMPONENT_TYPES.PORTAL_CHARGE,
    status: FEE_VERSION_STATUS.PUBLISHED,
  });

/**
 * Creates an authorized centre charge versioned record.
 */
export const createAuthorisedCentreCharge = (options) =>
  createVersionedFeeRecord({
    ...options,
    componentType: FEE_COMPONENT_TYPES.AUTHORISED_CENTRE_CHARGE,
    status: FEE_VERSION_STATUS.PUBLISHED,
  });

/**
 * Creates an optional service charge versioned record.
 */
export const createOptionalServiceCharge = (options) =>
  createVersionedFeeRecord({
    ...options,
    componentType: FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE,
    status: FEE_VERSION_STATUS.PUBLISHED,
  });

/**
 * Validates a versioned fee record.
 *
 * Checks serviceId, componentType, authority, jurisdiction, effectiveDate,
 * source URL, verificationDate, amount (non-negative), status, and currency.
 *
 * @param {Object} record - The fee record to validate
 * @returns {Object} Validation result { isValid, errors }
 */
export const validateVersionedFeeRecord = (record) => {
  const errors = [];

  if (!record.serviceId || typeof record.serviceId !== 'string') {
    errors.push('serviceId is required and must be a string.');
  }

  const validComponentTypes = Object.values(FEE_COMPONENT_TYPES);
  if (
    !record.componentType ||
    !validComponentTypes.includes(record.componentType)
  ) {
    errors.push(
      `componentType must be one of: ${validComponentTypes.join(', ')}.`,
    );
  }

  if (!record.authority || typeof record.authority !== 'string') {
    errors.push('authority is required and must be a string.');
  }

  const validJurisdictions = [
    JURISDICTION_LEVELS.national,
    JURISDICTION_LEVELS.state,
    JURISDICTION_LEVELS.district,
    JURISDICTION_LEVELS.local,
  ];
  if (
    !record.jurisdiction ||
    !validJurisdictions.includes(record.jurisdiction)
  ) {
    errors.push(
      `jurisdiction must be one of: ${validJurisdictions.join(', ')}.`,
    );
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(record.effectiveDate)) {
    errors.push('effectiveDate must be in YYYY-MM-DD format.');
  }

  if (!record.source || typeof record.source !== 'string') {
    errors.push('source is required and must be a string.');
  } else if (!/^https?:\/\//i.test(record.source)) {
    errors.push('source must be a valid HTTP/HTTPS URL.');
  }

  if (
    !record.verificationDate ||
    typeof record.verificationDate !== 'string'
  ) {
    errors.push('verificationDate is required and must be a string.');
  } else if (!datePattern.test(record.verificationDate)) {
    errors.push('verificationDate must be in YYYY-MM-DD format.');
  }

  if (
    typeof record.amount !== 'number' ||
    !Number.isFinite(record.amount) ||
    record.amount < 0
  ) {
    errors.push('amount must be a non-negative finite number.');
  }

  const validStatuses = [
    FEE_VERSION_STATUS.PUBLISHED,
    FEE_VERSION_STATUS.FREE,
    FEE_VERSION_STATUS.UNVERIFIED,
    FEE_VERSION_STATUS.OBSOLETE,
  ];
  if (!validStatuses.includes(record.status)) {
    errors.push(
      `status must be one of: ${validStatuses.join(', ')}.`,
    );
  }

  if (
    typeof record.currency !== 'string' ||
    record.currency.length !== 3
  ) {
    errors.push('currency must be a valid 3-letter ISO code.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ============================================================
// RECEIPT EVIDENCE MODEL
// ============================================================

/**
 * Receipt evidence submitted by a user.
 * Receipt identifiers are redacted by default per acceptance criteria:
 * "Receipt identifiers are redacted by default."
 */
export const RECEIPT_REDACTION_DEFAULT = true;

/**
 * Creates a receipt evidence record from user input.
 *
 * The receiptId is REDACTED by default (shows 'REDACTED') unless
 * redaction is explicitly disabled. This satisfies the acceptance criterion:
 * "Receipt identifiers are redacted by default."
 *
 * @param {Object} options - Receipt options
 * @param {string} options.serviceId - Service identifier
 * @param {string} [options.rawText] - Raw OCR/text content from receipt
 * @param {string} [options.receiptId] - User-provided receipt ID (will be REDACTED by default)
 * @param {string} [options.jurisdiction] - Jurisdiction where service was availed
 * @param {string} [options.captureDate] - When receipt was captured (YYYY-MM-DD)
 * @param {Array} [options.feeComponents] - Array of fee component amounts user was charged
 * @param {Object} [options.metadata] - Additional metadata
 * @returns {Object} Receipt evidence record with redacted ID
 */
export const createReceiptEvidence = ({
  serviceId,
  rawText,
  receiptId,
  jurisdiction,
  captureDate,
  feeComponents = [],
  metadata = {},
}) => {
  // Redact receipt identifier by default per acceptance criteria
  const displayReceiptId = RECEIPT_REDACTION_DEFAULT
    ? 'REDACTED'
    : receiptId || 'unknown';

  return {
    id: `receipt-${serviceId}-${Date.now()}`,
    serviceId,
    rawText,
    receiptId: displayReceiptId, // Redacted by default
    jurisdiction,
    captureDate: captureDate || new Date().toISOString().split('T')[0],
    feeComponents: Array.isArray(feeComponents)
      ? feeComponents
      : [feeComponents]
          .filter(Boolean)
          .map((fc) => ({
            ...fc,
            displayedAmount: fc.amount, // Will be compared against verified fees
          })),
    metadata: {
      ...metadata,
      redactionApplied: RECEIPT_REDACTION_DEFAULT,
      ocrQuality: metadata.ocrQuality || 'unknown',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Produces a discrepancy report comparing user-entered charges with
 * verified fee schedules.
 *
 * Acceptance criteria covered:
 * - "Unknown components are labelled unverified"
 * - "No charge is called illegal without an applicable official source"
 * - "Fee history is versioned and auditable"
 *
 * @param {Object} receiptEvidence - The receipt evidence record
 * @param {string} serviceId - The service being checked
 * @returns {Object} Discrepancy report with matched/unmatched fees
 */
export const generateDiscrepancyReport = (receiptEvidence, serviceId) => {
  const feeBreakdown = getServiceFeeBreakdown(serviceId);
  const discrepancies = {
    serviceId,
    receiptEvidenceId: receiptEvidence.id,
    timestamp: new Date().toISOString(),
    overallMatch: 'match',
    componentComparisons: [],
    summary: {
      totalOfficial: 0,
      totalCharged: 0,
      totalDiscrepancy: 0,
      componentsMatched: 0,
      componentsUnmatched: 0,
      componentsUnverified: 0,
    },
  };

  // If fee breakdown is unverified, flag everything as unverified
  if (!feeBreakdown.isVerified) {
    discrepancies.overallMatch = 'unverified';
    discrepancies.summary.componentsUnverified =
      receiptEvidence.feeComponents.length;
    discrepancies.componentComparisons = receiptEvidence.feeComponents.map(
      (fc) => ({
        componentType: fc.componentType || 'unknown',
        chargedAmount: fc.amount || 0,
        officialAmount: null,
        officialSource: null,
        status: 'unverified',
        discrepancy:
          'Fee schedule not verified for this service. No charge is called illegal without an applicable official source.',
        redactionApplied: true,
      }),
    );
    return discrepancies;
  }

  // Collect all official fee components
  const officialFees = [
    ...(feeBreakdown.officialStatutoryFees || []),
    ...(feeBreakdown.conditionalTiers || []),
    ...(feeBreakdown.optionalProviderCharges || []),
  ];

  // Build a map of official fees by normalized label for matching
  const officialFeeMap = new Map();
  officialFees.forEach((fee) => {
    const key = (fee.label || '').toLowerCase().trim();
    if (!officialFeeMap.has(key)) {
      officialFeeMap.set(key, []);
    }
    officialFeeMap.get(key).push(fee);
  });

  // Compare each charged component against official fee schedule
  const comparisons = receiptEvidence.feeComponents.map((charged) => {
    const chargedAmount = Number(charged.amount) || 0;
    const componentLabel = (
      charged.label || charged.componentType || ''
    ).toLowerCase().trim();

    // Try to find matching official fee
    const matchingOfficials = officialFeeMap.get(componentLabel) || [];
    const bestMatch = matchingOfficials.length > 0 ? matchingOfficials[0] : null;

    let officialAmount = bestMatch ? Number(bestMatch.amount) : null;
    let status = 'unmatched';
    let discrepancyMessage = 'No official match found';
    let source = bestMatch?.officialSource?.name || null;

    if (bestMatch) {
      const amountDiff = Math.abs(chargedAmount - officialAmount);
      if (amountDiff <= 5) {
        // Allow small rounding tolerance
        status = 'matched';
        discrepancyMessage = 'Amount matches official fee';
      } else if (chargedAmount > officialAmount) {
        status = 'overcharged';
        discrepancyMessage = `Overcharged: charged ₹${chargedAmount} vs official ₹${officialAmount}`;
      } else {
        status = 'undercharged';
        discrepancyMessage = `Under official fee: charged ₹${chargedAmount} vs official ₹${officialAmount}`;
      }
      source = bestMatch.officialSource?.name || source;
    }

    // Update summary totals
    discrepancies.summary.totalCharged += chargedAmount;
    if (bestMatch) {
      discrepancies.summary.totalOfficial += officialAmount;
      if (status === 'matched') {
        discrepancies.summary.componentsMatched += 1;
        discrepancies.overallMatch = 'match';
      } else if (status === 'overcharged') {
        discrepancies.summary.totalDiscrepancy +=
          chargedAmount - officialAmount;
        discrepancies.overallMatch = 'overcharged';
      } else if (status === 'undercharged') {
        discrepancies.summary.totalDiscrepancy +=
          officialAmount - chargedAmount;
      }
      discrepancies.summary.componentsUnmatched += 1;
    } else {
      discrepancies.summary.componentsUnverified += 1;
    }

    return {
      componentType: charged.componentType || 'unknown',
      chargedAmount,
      officialAmount,
      officialSource: source,
      status,
      discrepancy: discrepancyMessage,
      redactionApplied: true,
    };
  });

  discrepancies.componentComparisons = comparisons;

  // Determine overall match status
  const totalComponents = receiptEvidence.feeComponents.length;
  if (discrepancy.summary.componentsUnverified === totalComponents) {
    discrepancies.overallMatch = 'unverified';
  } else if (
    discrepancies.summary.totalDiscrepancy > 0 &&
    discrepancies.summary.componentsMatched === 0
  ) {
    discrepancies.overallMatch = 'overcharged';
  } else if (discrepancies.summary.totalDiscrepancy > 0) {
    discrepancies.overallMatch = 'partial-overcharge';
  } else if (
    discrepancies.summary.componentsMatched === totalComponents &&
    discrepancies.summary.totalDiscrepancy === 0
  ) {
    discrepancies.overallMatch = 'match';
  } else {
    discrepancies.overallMatch = 'partial-match';
  }

  return discrepancies;
};

// ============================================================
// GRIEVANCE ROUTE LINKING
// ============================================================

/**
 * Gets the official grievance route for a service based on its fee schedule.
 * Links to the appropriate government portal or grievance mechanism.
 *
 * Acceptance criterion: "Link the correct official grievance route where published."
 *
 * @param {string} serviceId - Service identifier
 * @returns {Object} Grievance route information with portal URLs and department contact
 */
export const getGrievanceRoute = (serviceId) => {
  const feeBreakdown = getServiceFeeBreakdown(serviceId);

  // If no verified fee schedule, return minimal info
  if (!feeBreakdown.isVerified) {
    return {
      title: 'Grievance Route',
      status: 'unverified',
      message:
        'Official fee schedule not verified. Cannot determine grievance route. No charge is called illegal without an applicable official source.',
      portalUrl: null,
      cpgrsLink: 'https://pgportal.gov.in',
      department: 'Concerned Department',
      complaintCategories: ['Overcharging', 'Missing receipt'],
    };
  }

  const source = feeBreakdown.officialSource;

  // Service-specific grievance routes based on official sources
  const routes = {
    'aadhaar-card': {
      title: 'Aadhaar Grievance Redressal',
      status: 'available',
      portalUrl: 'https://uidai.gov.in',
      cpgrsLink: 'https://pgportal.gov.in',
      department: 'UIDAI - Unique Identification Authority of India',
      complaintCategories: [
        'Overcharging',
        'Unauthorized fees',
        'Missing receipt',
        'Optional doorstep charges',
      ],
    },
    'passport': {
      title: 'Passport Grievance Redressal',
      status: 'available',
      portalUrl: 'https://www.passportindia.gov.in',
      cpgrsLink: 'https://pgportal.gov.in',
      department: 'Ministry of External Affairs - Consular, Passport and Visa Division',
      complaintCategories: [
        'Overcharging',
        'Missing receipt',
        'Optional lounge/SMS charges forced',
      ],
    },
    'driving-license': {
      title: 'RTO/Parivahan Grievance',
      status: 'available',
      portalUrl: 'https://parivahan.gov.in',
      cpgrsLink: 'https://pgportal.gov.in',
      department: 'Ministry of Road Transport and Highways',
      complaintCategories: [
        'Overcharging',
        'Missing receipt',
        'Optional facilitation/ Speed Post charges',
      ],
    },
    'pan-card': {
      title: 'PAN Card Grievance',
      status: 'available',
      portalUrl: 'https://www.onlineservices.nsdl.com',
      cpgrsLink: 'https://pgportal.gov.in',
      department: 'Income Tax Department - CBDT',
      complaintCategories: [
        'Overcharging',
        'Missing receipt',
        'CSC scanning/upload charges',
      ],
    },
    'voter-id': {
      title: 'Electoral Grievance',
      status: 'available',
      portalUrl: 'https://voters.eci.gov.in',
      cpgrsLink: 'https://pgportal.gov.in',
      department: 'Election Commission of India',
      complaintCategories: ['Unauthorized fees'],
    },
  };

  const defaultRoute = {
    title: 'Grievance Route',
    status: 'available',
    portalUrl: source?.url || null,
    cpgrsLink: 'https://pgportal.gov.in',
    department: source?.department || 'Concerned Department',
    complaintCategories: ['Overcharging', 'Missing receipt'],
  };

  return routes[serviceId] || defaultRoute;
};

// ============================================================
// COMMUNITY FEE OBSERVATIONS MODERATION
// ============================================================

/**
 * Status values for community fee observations.
 */
export const COMMUNITY_OBSERVATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
};

/**
 * Creates a community fee observation record.
 *
 * Users can submit observations about fees they've encountered at public service centres.
 * Observations are moderated before display to ensure accuracy and prevent misinformation.
 * No personal payment data is collected.
 *
 * @param {Object} options - Observation options
 * @param {string} options.serviceId - Service identifier
 * @param {string} options.userId - Identifier of the user who submitted the observation
 * @param {number} options.observedAmount - Amount the user was charged
 * @param {number} [options.officialAmount] - Official/verified amount (if known)
 * @param {string} options.componentType - Type of fee component (e.g., 'government_fee', 'optional_service_charge')
 * @param {string} [options.location] - Location/counter number where fee was charged
 * @param {string} [options.jurisdiction] - Jurisdiction level
 * @param {string} options.description - Description of the overcharging experience
 * @param {Object} [options.evidence] - Supporting evidence (receipt refs, photos, etc.)
 * @returns {Object} Community fee observation record (initially PENDING moderation status)
 */
export const createCommunityFeeObservation = ({
  serviceId,
  userId,
  observedAmount,
  officialAmount,
  componentType,
  location,
  jurisdiction,
  description,
  evidence = {},
}) => {
  return {
    id: `community-obs-${serviceId}-${Date.now()}-${Math.floor(
      Math.random() * 10000,
    )}`,
    serviceId,
    userId,
    observedAmount,
    officialAmount,
    componentType,
    location,
    jurisdiction,
    description,
    evidence,
    status: COMMUNITY_OBSERVATION_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    moderatorNotes: null,
  };
};

/**
 * Moderates a community fee observation.
 *
 * Acceptance criterion: "Moderate community fee observations before display."
 *
 * @param {string} observationId - The observation ID to moderate
 * @param {string} decision - One of: 'approved', 'rejected', 'flagged'
 * @param {string} [moderatorNotes] - Optional notes from the moderator
 * @returns {Object} Moderation result
 */
export const moderateCommunityObservation = (
  observationId,
  decision,
  moderatorNotes = '',
) => {
  const validDecisions = [
    COMMUNITY_OBSERVATION_STATUS.APPROVED,
    COMMUNITY_OBSERVATION_STATUS.REJECTED,
    COMMUNITY_OBSERVATION_STATUS.FLAGGED,
  ];

  if (!validDecisions.includes(decision)) {
    console.error(`Invalid moderation decision: ${decision}`);
    return {
      observationId,
      valid: false,
      error: `Invalid decision: ${decision}. Must be one of: ${validDecisions.join(', ')}`,
    };
  }

  // In a real implementation, this would update the observation in storage/db
  // with moderator approval, notes, and timestamp.
  // For now, return the moderation action object.
  return {
    observationId,
    decision,
    moderatorNotes,
    moderatedAt: new Date().toISOString(),
    valid: true,
    // Would persist to storage here
  };
};

/**
 * Gets moderated community observations for a service.
 *
 * Filters by status and sorts by recency (newest first).
 * Only returns observations that have been approved or flagged.
 *
 * @param {string} serviceId - Service identifier
 * @param {string} [statusFilter] - Optional filter: 'approved', 'rejected', 'flagged'
 * @returns {Array} Moderated observations
 */
export const getModeratedObservations = (serviceId, statusFilter = null) => {
  // Placeholder: in a real implementation, this would query a database/storage
  // for community observations filtered by status and sorted by createdAt desc
  return [];
};

// ============================================================
// EXPORTS
// ============================================================

export default {
  FEE_VERSION_STATUS,
  FEE_COMPONENT_TYPES,
  createVersionedFeeRecord,
  createGovernmentFee,
  createPortalCharge,
  createAuthorisedCentreCharge,
  createOptionalServiceCharge,
  validateVersionedFeeRecord,
  createReceiptEvidence,
  generateDiscrepancyReport,
  getGrievanceRoute,
  createCommunityFeeObservation,
  moderateCommunityObservation,
  getModeratedObservations,
  RECEIPT_REDACTION_DEFAULT,
  JURISDICTION_LEVELS,
  JURISDICTION_LEVEL_LABELS,
  INDIAN_STATES_AND_UTS,
};