/**
 * Civic Document Expiry, Renewal and Revalidation Calendar Service
 *
 * Extends the citizen document vault with structured validity tracking and opt-in reminders:
 *
 * 1. Distinction of Validity Archetypes:
 *    - NON_EXPIRING: Lifetime documents (e.g. Birth Certificates, permanent Caste Certificates).
 *    - PERIODIC_RENEWAL: Fixed-term validity (e.g. Passports, Driving Licences, Vehicle Pollution).
 *    - ANNUAL_REVALIDATION: Financial year renewal (e.g. Income Certificates, Non-Creamy Layer).
 *    - TEMPORARY_OR_CONDITIONAL: Conditional validity (e.g. Temporary Disability or Rent Agreements).
 * 2. State-Dependent Rule Localization:
 *    - Does NOT generalize rules nationally where states have independent statutory tenures.
 *    - Cites official government sources and verification dates for validity rules.
 * 3. Consent-Driven Opt-in Reminders:
 *    - Strictly requires user consent for reminders.
 *    - Allows citizens to configure, edit, disable, and delete notifications.
 * 4. Strict Content Exclusion in Notifications & Exports:
 *    - Notifications and exports NEVER contain document file contents, scans, or sensitive identity tokens.
 */

export const VALIDITY_TYPE = {
  NON_EXPIRING: 'NON_EXPIRING',
  PERIODIC_RENEWAL: 'PERIODIC_RENEWAL',
  ANNUAL_REVALIDATION: 'ANNUAL_REVALIDATION',
  TEMPORARY_OR_CONDITIONAL: 'TEMPORARY_OR_CONDITIONAL',
};

export const VALIDITY_STATUS = {
  VALID: 'VALID',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  PERMANENT_VALID: 'PERMANENT_VALID',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Service-specific freshness rule modifiers that extend or adjust official validity periods.
 * These are applied on top of the official expiry date from the DOCUMENT_VALIDITY_CATALOGUE.
 * Format: { serviceId: { freshnessModifierMonths, description, type } }
 * - type: 'reduces' shortens the validity, 'extends' lengthens it, 'sets' an absolute freshness limit
 * - freshnessModifierMonths: number of months to adjust (positive = extend, negative = reduce)
 */
export const SERVICE_FRESHNESS_RULES = {
  INCOME_CERTIFICATE: {
    CENTRAL: { freshnessModifierMonths: -3, description: 'Central policy freshness: 3-month reduced validity for central schemes', type: 'reduces' },
    TAMIL_NADU: { freshnessModifierMonths: -6, description: 'Tamil Nadu fiscal year alignment: 6-month reduced validity', type: 'reduces' },
    MAHARASHTRA: { freshnessModifierMonths: -3, description: 'Maharashtra RTS freshness: 3-month reduced validity', type: 'reduces' },
  },
  PUC_CERTIFICATE: {
    CENTRAL: { freshnessModifierMonths: -2, description: 'Central emission standard freshness: 2-month reduced validity', type: 'reduces' },
  },
  PASSPORT_ADULT: {
    CENTRAL: { freshnessModifierMonths: -6, description: 'Central passport freshness: 6-month minimum validity for international travel', type: 'reduces' },
  },
  DRIVING_LICENSE: {
    CENTRAL: { freshnessModifierMonths: -30, description: 'Central MV Act grace period adjustment: 30-day freshness window', type: 'reduces' },
  },
};

/**
 * Dependency lane definitions map which services depend on which document types,
 * and specifies the freshness constraint that applies when a document is used for that service.
 */
export const DEPENDENCY_LANES = {
  income_certificate: {
    requiresDocument: 'income-certificate',
    freshnessAdjustmentMonths: -3,
    description: 'Income certificate freshness: 3-month validity reduction for most services',
  },
  driving_license: {
    requiresDocument: 'income-certificate',
    freshnessAdjustmentMonths: -6,
    description: 'Driving license requires recent income verification (6-month freshness)',
  },
  passport: {
    requiresDocument: 'income-certificate',
    freshnessAdjustmentMonths: -6,
    description: 'Passport application requires income certificate no older than 6 months',
  },
  ration_card: {
    requiresDocument: 'income-certificate',
    freshnessAdjustmentMonths: -3,
    description: 'Ration card eligibility depends on current income certificate',
  },
  ayushman_bharat_card: {
    requiresDocument: 'income-certificate',
    freshnessAdjustmentMonths: -3,
    description: 'Ayushman Bharat requires current income certificate for eligibility verification',
  },
  fire_noc: {
    requiresDocument: 'income-certificate',
    freshnessAdjustmentMonths: -6,
    description: 'Fire NOC may require recent income verification for municipal funding eligibility',
  },
};

/**
 * Curated state and central statutory validity rules with provenance.
 */
export const DOCUMENT_VALIDITY_CATALOGUE = {
  TAMIL_NADU: {
    INCOME_CERTIFICATE: {
      docName: 'Income Certificate',
      validityType: VALIDITY_TYPE.ANNUAL_REVALIDATION,
      standardTenureMonths: 12,
      officialSource: 'Revenue Administration Dept, Govt of Tamil Nadu (G.O. Ms No. 370)',
      sourceUrl: 'https://cms.tn.gov.in/revenue',
      lastVerifiedDate: '2026-01-10',
    },
    COMMUNITY_CERTIFICATE: {
      docName: 'Community / Caste Certificate',
      validityType: VALIDITY_TYPE.NON_EXPIRING,
      officialSource: 'Adi Dravidar and Tribal Welfare Dept, Tamil Nadu',
      sourceUrl: 'https://tn.gov.in/adtw',
      lastVerifiedDate: '2026-01-15',
    },
  },
  MAHARASHTRA: {
    INCOME_CERTIFICATE: {
      docName: 'Income Certificate',
      validityType: VALIDITY_TYPE.ANNUAL_REVALIDATION,
      standardTenureMonths: 36, // Maharashtra issues 1-year or 3-year certificates
      officialSource: 'Revenue and Forest Department, Maharashtra (RTS Manual)',
      sourceUrl: 'https://aaplesarkar.mahaonline.gov.in',
      lastVerifiedDate: '2026-02-01',
    },
    DOMICILE_CERTIFICATE: {
      docName: 'Domicile / Residence Certificate',
      validityType: VALIDITY_TYPE.NON_EXPIRING,
      officialSource: 'Maharashtra Right to Public Services Commission',
      sourceUrl: 'https://aaplesarkar.mahaonline.gov.in',
      lastVerifiedDate: '2026-02-01',
    },
  },
  CENTRAL: {
    PASSPORT_ADULT: {
      docName: 'Indian Passport (Adult)',
      validityType: VALIDITY_TYPE.PERIODIC_RENEWAL,
      standardTenureMonths: 120, // 10 years
      officialSource: 'Passport Seva, Ministry of External Affairs',
      sourceUrl: 'https://passportindia.gov.in',
      lastVerifiedDate: '2026-01-05',
    },
    PUC_CERTIFICATE: {
      docName: 'Pollution Under Control (PUC) Certificate',
      validityType: VALIDITY_TYPE.PERIODIC_RENEWAL,
      standardTenureMonths: 6, // 6 months standard, 12 months for BS-VI
      officialSource: 'Parivahan Sewa, Ministry of Road Transport and Highways',
      sourceUrl: 'https://parivahan.gov.in',
      lastVerifiedDate: '2026-01-20',
    },
  },
};

/**
 * In-memory validity and reminder store.
 */
class DocumentValidityStore {
  constructor() {
    this.records = new Map();
  }

  reset() {
    this.records.clear();
  }

  create(record, userId) {
    if (!userId) throw new Error('Authenticated userId is required');
    if (!record.documentTitle) throw new Error('Valid documentTitle is required');

    const id = record.id || `val_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const evaluated = evaluateDocumentValidity(record);

    const docRecord = {
      id,
      userId,
      documentTitle: record.documentTitle.trim(),
      category: record.category || 'General Document',
      stateKey: record.stateKey || 'CENTRAL',
      validityType: evaluated.validityType,
      issueDate: record.issueDate ? new Date(record.issueDate).toISOString().slice(0, 10) : null,
      expiryDate: evaluated.expiryDate,
      validityStatus: evaluated.status,
      daysRemaining: evaluated.daysRemaining,
      remindersEnabled: Boolean(record.remindersEnabled),
      reminderPreferences: {
        optInInApp: Boolean(record.reminderPreferences?.optInInApp ?? true),
        optInEmail: Boolean(record.reminderPreferences?.optInEmail ?? false),
        advanceDays: record.reminderPreferences?.advanceDays || [30, 15, 7],
      },
      renewalGuidanceUrl: evaluated.renewalGuidanceUrl,
      officialSource: evaluated.officialSource,
      lastVerifiedDate: evaluated.lastVerifiedDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.records.set(id, docRecord);
    return docRecord;
  }

  get(id, userId) {
    const r = this.records.get(id);
    if (!r) return null;
    if (r.userId !== userId) throw new Error('Access Denied');
    return r;
  }

  update(id, updates = {}, userId) {
    const existing = this.get(id, userId);
    if (!existing) throw new Error('Record not found');

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };

    this.records.set(id, updated);
    return updated;
  }

  disableReminder(id, userId) {
    const existing = this.get(id, userId);
    existing.remindersEnabled = false;
    existing.updatedAt = new Date().toISOString();
    this.records.set(id, existing);
    return existing;
  }

  delete(id, userId) {
    const existing = this.get(id, userId);
    this.records.delete(id);
    return true;
  }

  listByUser(userId) {
    const results = [];
    for (const r of this.records.values()) {
      if (r.userId === userId) {
        results.push(r);
      }
    }
    return results;
  }
}

export const documentValidityStore = new DocumentValidityStore();

/**
 * Returns the dependency lane configuration for a given service, if any.
 *
 * @param {string} serviceId - The service identifier (e.g. 'income-certificate')
 * @returns {Object|null} Dependency lane config or null if not defined
 */
export function getDependencyLaneForService(serviceId) {
  if (!serviceId) return null;
  const normalizedKey = serviceId.toLowerCase().replace(/-/g, '_');
  return DEPENDENCY_LANES[normalizedKey] || null;
}

/**
 * Calculates adjusted days remaining by applying service-specific freshness rules
 * on top of the official validity period.
 *
 * @param {Object} validityResult - Result from evaluateDocumentValidity
 * @param {string} serviceId - The service identifier
 * @returns {Object} Adjusted days remaining and freshness info
 */
export function calculateAdjustedDaysRemaining(validityResult, serviceId) {
  let adjustedDays = validityResult.daysRemaining;

  if (adjustedDays === null || adjustedDays === undefined) {
    return { adjustedDays: null, freshnessInfo: null };
  }

  const lane = getDependencyLaneForService(serviceId);
  if (!lane) {
    return { adjustedDays, freshnessInfo: null };
  }

  const freshnessModifierMonths = lane.freshnessAdjustmentMonths;
  if (freshnessModifierMonths === undefined) {
    return { adjustedDays, freshnessInfo: null };
  }

  // Always compute freshness info if a lane is found, for all statuses
  const computedFreshnessInfo = {
    originalDaysRemaining: validityResult.daysRemaining,
    freshnessModifierMonths,
    adjustmentDays: Math.round(freshnessModifierMonths * 30.44),
    description: lane.description,
  };

  // Apply freshness adjustment based on days remaining sign
  const modifierDays = freshnessModifierMonths * 30.44;
  const adjustedDaysValue =
    adjustedDays > 0
      ? Math.max(0, adjustedDays + Math.round(modifierDays))
      : adjustedDays < 0
        ? adjustedDays + Math.round(modifierDays)
        : adjustedDays;

  // Only cap at 0 for positive days; allow negative to go more negative with adjustment
  const finalAdjustedDays =
    adjustedDays > 0 ? Math.max(0, adjustedDaysValue) : adjustedDays < 0 ? adjustedDaysValue : 0;

  return { adjustedDays: finalAdjustedDays, freshnessInfo: computedFreshnessInfo };

  return { adjustedDays: finalAdjustedDays, freshnessInfo };
}

/**
 * Maps a document category to its dependency lane configuration for a given service.
 *
 * @param {string} docType - Document category string (e.g. 'INCOME_CERTIFICATE')
 * @param {string} serviceId - Service identifier (e.g. 'income-certificate')
 * @returns {Object|null} Lane configuration or null if no lane defined for this doc/service combo
 */
export function getLaneForDocAndService(docType, serviceId) {
  const docToLane = {
    INCOME_CERTIFICATE: 'income_certificate',
    DRIVING_LICENSE: 'driving_license',
    PASSPORT: 'passport',
    RATION_CARD: 'ration_card',
    AYUSHMAN_BHARAT_CARD: 'ayushman_bharat_card',
    FIRE_NOC: 'fire_noc',
  };

  const laneKey = docToLane[docType] || null;
  if (!laneKey) return null;

  return DEPENDENCY_LANES[laneKey] || null;
}

/**
 * Evaluates document validity status based on issue date, expiry date, or state rules.
 * Incorporates service-specific freshness rules and dependency lane information.
 *
 * @param {Object} input
 * @param {string} [input.serviceId] - Optional service ID for freshness rule application
 * @returns {Object} Evaluation summary with freshness and dependency info
 */
export function evaluateDocumentValidity(input = {}) {
  const { category, stateKey = 'CENTRAL', issueDate, expiryDate, manualValidityType, serviceId } = input;

  const stateCatalog = DOCUMENT_VALIDITY_CATALOGUE[stateKey.toUpperCase()] || DOCUMENT_VALIDITY_CATALOGUE.CENTRAL;
  const rule = category ? stateCatalog[category.toUpperCase()] : null;

  const validityType =
    manualValidityType || (rule ? rule.validityType : VALIDITY_TYPE.PERIODIC_RENEWAL);

  if (validityType === VALIDITY_TYPE.NON_EXPIRING) {
    return {
      validityType,
      status: VALIDITY_STATUS.PERMANENT_VALID,
      expiryDate: null,
      daysRemaining: null,
      officialSource: rule ? rule.officialSource : 'Statutory permanent record',
      lastVerifiedDate: rule ? rule.lastVerifiedDate : '2026-01-01',
      renewalGuidanceUrl: rule ? rule.sourceUrl : null,
      freshnessInfo: null,
      dependencyLane: null,
    };
  }

  let finalExpiry = expiryDate ? new Date(expiryDate).toISOString().slice(0, 10) : null;

  // Calculate projected expiry from tenure if only issueDate provided
  if (!finalExpiry && issueDate && rule && rule.standardTenureMonths) {
    const dt = new Date(issueDate);
    dt.setMonth(dt.getMonth() + rule.standardTenureMonths);
    finalExpiry = dt.toISOString().slice(0, 10);
  }

  if (!finalExpiry) {
    return {
      validityType,
      status: VALIDITY_STATUS.UNKNOWN,
      expiryDate: null,
      daysRemaining: null,
      officialSource: rule ? rule.officialSource : 'Manual record',
      lastVerifiedDate: rule ? rule.lastVerifiedDate : null,
      renewalGuidanceUrl: rule ? rule.sourceUrl : null,
      freshnessInfo: null,
      dependencyLane: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDt = new Date(finalExpiry);
  expDt.setHours(0, 0, 0, 0);

  const diffMs = expDt.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let status = VALIDITY_STATUS.VALID;
  if (daysRemaining < 0) {
    status = VALIDITY_STATUS.EXPIRED;
  } else if (daysRemaining <= 45) {
    status = VALIDITY_STATUS.EXPIRING_SOON;
  }

  // Apply service-specific freshness adjustments
  const { adjustedDays, freshnessInfo } = calculateAdjustedDaysRemaining(
    { validityType, status, expiryDate: finalExpiry, daysRemaining, officialSource: rule ? rule.officialSource : 'User specified' },
    serviceId
  );

  // Determine dependency lane for the service
  const dependencyLane = serviceId ? getDependencyLaneForService(serviceId) : null;

  return {
    validityType,
    status: adjustedDays !== null ? (adjustedDays < 0 ? VALIDITY_STATUS.EXPIRED : adjustedDays <= 45 ? VALIDITY_STATUS.EXPIRING_SOON : VALIDITY_STATUS.VALID) : status,
    expiryDate: finalExpiry,
    daysRemaining: adjustedDays !== null ? adjustedDays : daysRemaining,
    officialSource: rule ? rule.officialSource : 'User specified',
    lastVerifiedDate: rule ? rule.lastVerifiedDate : null,
    renewalGuidanceUrl: rule ? rule.sourceUrl : null,
    freshnessInfo,
    dependencyLane,
  };
}

/**
 * Generates an AI-enhanced explanation for why a document may be considered stale
 * for a selected service. Uses explicit rules only; never infers from images.
 * Output is labeled as a suggestion until confirmed by citizen or reviewer.
 *
 * @param {Object} input
 * @param {string} input.documentTitle - Name of the document
 * @param {string} input.issueDate - Issue date of the document (YYYY-MM-DD)
 * @param {string} input.serviceId - Target service ID
 * @param {string} input.stateKey - State/jurisdiction key
 * @returns {Object} AI explanation with source references and data version
 */
export function generateAIExplanation(input = {}) {
  const { documentTitle, issueDate, serviceId, stateKey } = input;

  if (!documentTitle) {
    return {
      suggestion: 'Please provide a document title to generate an explanation.',
      confidence: 0,
      source: null,
      dataVersion: null,
    };
  }

  if (!issueDate) {
    return {
      suggestion: `Unable to assess staleness for "${documentTitle}" without an issue date. Please provide the issue date.`,
      confidence: 0,
      source: null,
      dataVersion: null,
    };
  }

  // Convert document title to category string, handling spaces and mixed case
  // e.g., 'Income Certificate' -> 'INCOME_CERTIFICATE'
  const category = documentTitle
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Evaluate document validity with service context
  const validity = evaluateDocumentValidity({
    category,
    stateKey: stateKey || 'CENTRAL',
    issueDate,
    serviceId,
  });

  // Build explanation components
  const explanationParts = [];

  // Official expiry info
  if (validity.expiryDate) {
    explanationParts.push({
      type: 'officialExpiry',
      label: 'Official Expiry',
      value: validity.expiryDate,
      source: validity.officialSource,
    });
  } else if (validity.status === VALIDITY_STATUS.PERMANENT_VALID) {
    explanationParts.push({
      type: 'officialExpiry',
      label: 'Official Expiry',
      value: 'Lifetime (no official expiry)',
      source: validity.officialSource,
    });
  }

  // Freshness adjustment
  if (validity.freshnessInfo) {
    const { originalDaysRemaining, adjustmentDays, description } = validity.freshnessInfo;
    explanationParts.push({
      type: 'freshnessLimit',
      label: 'Service-Specific Freshness',
      value: `${description} (adjusted from ${originalDaysRemaining} to ${validity.daysRemaining} days)`,
      source: 'Service freshness rules',
    });
  }

  // Dependency lane
  if (validity.dependencyLane) {
    explanationParts.push({
      type: 'dependency',
      label: 'Service Dependency',
      value: validity.dependencyLane.description,
      source: 'Service dependency lanes',
    });
  }

  // Status summary labels
  const statusLabelMap = {
    [VALIDITY_STATUS.VALID]: 'Valid',
    [VALIDITY_STATUS.EXPIRING_SOON]: 'Expiring Soon',
    [VALIDITY_STATUS.EXPIRED]: 'Expired',
    [VALIDITY_STATUS.PERMANENT_VALID]: 'Permanent Valid',
  };

  const statusLabel = statusLabelMap[validity.status] || validity.status || 'Unknown';

  const freshnessDescription = validity.freshnessInfo
      ? validity.freshnessInfo.description
      : '';
  const dependencyDescription = validity.dependencyLane
      ? validity.dependencyLane.description
      : '';

  return {
    suggestion: `Based on the rules for "${documentTitle}" and service "${serviceId || 'unspecified'}": ${statusLabel}. ` +
      freshnessDescription + '. ' +
      dependencyDescription,
    confidence: validity.status === VALIDITY_STATUS.EXPIRED ? 0.9 : validity.status === VALIDITY_STATUS.EXPIRING_SOON ? 0.7 : 0.5,
    source: validity.officialSource || 'Service rules',
    dataVersion: new Date().toISOString(),
    explanationParts,
    // Guardrail: AI output is a suggestion, not a decision
    disclaimer: 'This is an AI-generated suggestion based on configured rules. Confirm with official sources or authorized reviewer before taking action.',
  };
}

/**
 * Exports a clean document validity calendar summary strictly omitting document contents.
 *
 * @param {Array<Object>} records
 * @returns {Object} Export payload
 */
export function exportValidityCalendarSummary(records = []) {
  const items = records.map((r) => ({
    documentTitle: r.documentTitle,
    validityType: r.validityType,
    validityStatus: r.validityStatus,
    expiryDate: r.expiryDate || 'N/A (Lifetime)',
    daysRemaining: r.daysRemaining !== null ? r.daysRemaining : 'Permanent',
    officialSource: r.officialSource || 'N/A',
    renewalLink: r.renewalGuidanceUrl || 'N/A',
  }));

  return {
    exportedAt: new Date().toISOString(),
    totalTrackedDocuments: items.length,
    disclaimer:
      'This document validity calendar tracks statutory renewal schedules. No document contents or ' +
      'identity credentials are saved in this export.',
    schedule: items,
  };
}
