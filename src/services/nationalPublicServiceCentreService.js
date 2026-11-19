/**
 * National Public Service Centre Overcharging and Receipt Evidence Assistant (#1003)
 *
 * Compares charges entered from a receipt with verified, versioned public fee
 * schedules for a selected service and jurisdiction.
 *
 * Design rules enforced by this module:
 * - Government fees, portal charges, authorised-centre charges, and optional
 *   service charges are separate component types.
 * - Every fee version carries authority, jurisdiction, effective date, source,
 *   verification date, and an audit trail.
 * - Receipt identifiers are redacted by default, including identifiers found
 *   inside pasted OCR text.
 * - No charge is described as unlawful without an applicable official source.
 *   Unknown components are labelled "unverified".
 * - Payment credentials are never collected and no transaction is initiated.
 */

import { SERVICE_FEE_BREAKDOWNS } from '../data/serviceFeeBreakdowns';
import {
  JURISDICTION_LEVELS,
  JURISDICTION_LEVEL_LABELS,
  INDIAN_STATES_AND_UTS,
} from '../data/jurisdictions';
import { getServiceFeeBreakdown } from './feeTransparencyService';
import { sanitizePlainText } from '../utils/safeContent';

export {
  JURISDICTION_LEVELS,
  JURISDICTION_LEVEL_LABELS,
  INDIAN_STATES_AND_UTS,
};

// ============================================================
// CONSTANTS & STORAGE
// ============================================================

export const FEE_VERSION_STATUS = {
  PUBLISHED: 'published',
  FREE: 'free',
  UNVERIFIED: 'unverified',
  OBSOLETE: 'obsolete',
};

export const FEE_COMPONENT_TYPES = {
  GOVERNMENT_FEE: 'government_fee',
  PORTAL_CHARGE: 'portal_charge',
  AUTHORISED_CENTRE_CHARGE: 'authorised_centre_charge',
  OPTIONAL_SERVICE_CHARGE: 'optional_service_charge',
};

export const COMMUNITY_OBSERVATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
};

export const RECEIPT_REDACTION_DEFAULT = true;

export const FEE_EVIDENCE_STORAGE_KEYS = {
  FEE_HISTORY: 'civicbridge_npsc_fee_history_v1',
  OBSERVATIONS: 'civicbridge_npsc_fee_observations_v1',
};

const COMPONENT_TYPE_LABELS = {
  [FEE_COMPONENT_TYPES.GOVERNMENT_FEE]: 'Government / statutory fee',
  [FEE_COMPONENT_TYPES.PORTAL_CHARGE]: 'Portal charge',
  [FEE_COMPONENT_TYPES.AUTHORISED_CENTRE_CHARGE]: 'Authorised centre charge',
  [FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE]: 'Optional service charge',
};

const JURISDICTION_RANK = {
  national: 1,
  state: 2,
  district: 3,
  local: 4,
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OCR_TEXT_LENGTH = 20000;

const inMemoryStore = new Map();
const memoryFallbackKeys = new Set();

const getsBrowserStorage = () => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {
    // Privacy modes can throw on access.
  }
  return null;
};

const readStoredArray = (key) => {
  try {
    const storage = getsBrowserStorage();
    if (storage && !memoryFallbackKeys.has(key)) {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Fall through to the in-memory copy.
  }
  const fallback = inMemoryStore.get(key);
  return Array.isArray(fallback) ? fallback : [];
};

const writeStoredArray = (key, value) => {
  const safeValue = Array.isArray(value) ? value : [];
  try {
    const storage = getsBrowserStorage();
    if (storage) {
      storage.setItem(key, JSON.stringify(safeValue));
      memoryFallbackKeys.delete(key);
      inMemoryStore.delete(key);
      return;
    }
  } catch {
    // Fall through to the in-memory copy.
  }
  memoryFallbackKeys.add(key);
  inMemoryStore.set(key, JSON.parse(JSON.stringify(safeValue)));
};

const todayIsoDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const isValidIsoDate = (value) => {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const toReferenceTime = (referenceDate) => {
  const parsed =
    referenceDate instanceof Date
      ? referenceDate
      : new Date(`${referenceDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
};

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const componentTypeLabel = (componentType) =>
  COMPONENT_TYPE_LABELS[componentType] || 'Unclassified charge';

let lastTimestamp = 0;
const nextTimestamp = () => {
  const now = Date.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
};

/**
 * Non-cryptographic fingerprint used to make fee versions easy to compare in
 * an audit view. It is not a signature and does not replace the source URL.
 */
export const createFeeFingerprint = (record = {}) => {
  const payload = [
    record.serviceId,
    record.componentType,
    record.authority,
    record.jurisdiction,
    record.state,
    record.district,
    record.localBody,
    record.label,
    record.effectiveDate,
    record.source,
    record.verificationDate,
    record.amount,
    record.currency,
    record.status,
    record.isMandatory,
    record.maxPermissibleCap,
  ].join('|');

  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fee-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const componentKey = (record = {}) =>
  [
    record.serviceId,
    record.componentType,
    record.authority,
    record.jurisdiction,
    record.state || '',
    record.district || '',
    record.localBody || '',
    record.label || '',
  ].join('|');

// ============================================================
// VERSIONED FEE RECORDS
// ============================================================

/**
 * Creates a versioned fee record.
 *
 * Invalid input is never silently treated as verified: the returned record
 * carries `validationErrors` and `recordFeeVersion` refuses to publish it.
 */
export const createVersionedFeeRecord = (options = {}) => {
  const {
    serviceId,
    componentType,
    authority,
    jurisdiction,
    state = null,
    district = null,
    localBody = null,
    effectiveDate,
    source,
    verificationDate,
    amount = 0,
    isMandatory = true,
    status = FEE_VERSION_STATUS.PUBLISHED,
    currency = 'INR',
    label = '',
    applicability = null,
    maxPermissibleCap = null,
    supplementary = {},
  } = options;

  const idComponentType = String(componentType || 'unknown').replace(/_/g, '-');
  const timestamp = nextTimestamp();

  const record = {
    id: `fee-${serviceId}-${idComponentType}-${timestamp}`,
    serviceId,
    componentType,
    authority,
    jurisdiction,
    state,
    district,
    localBody,
    effectiveDate,
    source,
    verificationDate,
    amount,
    isMandatory,
    status,
    currency,
    label,
    applicability,
    maxPermissibleCap,
    version: null,
    origin: 'recorded',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...supplementary,
  };

  record.fingerprint = createFeeFingerprint(record);
  const validation = validateVersionedFeeRecord(record);
  if (!validation.isValid) record.validationErrors = validation.errors;

  return record;
};

// The component helpers set only the component type. `createVersionedFeeRecord`
// already defaults the status to "published", while still letting a caller
// record a free or obsolete version explicitly.
export const createGovernmentFee = (options = {}) =>
  createVersionedFeeRecord({
    ...options,
    componentType: FEE_COMPONENT_TYPES.GOVERNMENT_FEE,
  });

export const createPortalCharge = (options = {}) =>
  createVersionedFeeRecord({
    ...options,
    componentType: FEE_COMPONENT_TYPES.PORTAL_CHARGE,
  });

export const createAuthorisedCentreCharge = (options = {}) =>
  createVersionedFeeRecord({
    ...options,
    componentType: FEE_COMPONENT_TYPES.AUTHORISED_CENTRE_CHARGE,
  });

export const createOptionalServiceCharge = (options = {}) =>
  createVersionedFeeRecord({
    ...options,
    componentType: FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE,
  });

/**
 * Validates a versioned fee record. Dates are checked as real calendar dates,
 * not merely with a regex; source URLs must be http(s).
 *
 * @param {Object} record
 * @param {{referenceDate?: Date|string}} [options]
 * @returns {{isValid: boolean, errors: string[]}}
 */
export const validateVersionedFeeRecord = (record, options = {}) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return {
      isValid: false,
      errors: ['Fee record must be a non-null object.'],
    };
  }

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

  if (
    !record.jurisdiction ||
    !JURISDICTION_LEVELS.includes(record.jurisdiction)
  ) {
    errors.push(
      `jurisdiction must be one of: ${JURISDICTION_LEVELS.join(', ')}.`,
    );
  }

  if (record.state !== null && record.state !== undefined && typeof record.state !== 'string') {
    errors.push('state must be a string when provided.');
  }

  if (record.jurisdiction && record.jurisdiction !== 'national') {
    if (!normalizeString(record.state)) {
      errors.push(
        'state is required for state, district, or local fee records.',
      );
    }
    if (
      (record.jurisdiction === 'district' ||
        record.jurisdiction === 'local') &&
      !normalizeString(record.district)
    ) {
      errors.push('district is required for district or local fee records.');
    }
    if (
      record.jurisdiction === 'local' &&
      !normalizeString(record.localBody)
    ) {
      errors.push('localBody is required for local fee records.');
    }
  }

  if (!isValidIsoDate(record.effectiveDate)) {
    errors.push('effectiveDate must be a valid date in YYYY-MM-DD format.');
  } else {
    const effectiveTime = new Date(`${record.effectiveDate}T00:00:00`).getTime();
    const referenceTime = toReferenceTime(options.referenceDate);
    if (effectiveTime > referenceTime + 365 * ONE_DAY_MS) {
      errors.push('effectiveDate must not be more than 365 days in the future.');
    }
  }

  if (!record.source || typeof record.source !== 'string') {
    errors.push('source is required and must be a string.');
  } else if (!/^https?:\/\//i.test(record.source)) {
    errors.push('source must be a valid HTTP/HTTPS URL.');
  }

  if (!record.verificationDate || typeof record.verificationDate !== 'string') {
    errors.push('verificationDate is required and must be a string.');
  } else if (!isValidIsoDate(record.verificationDate)) {
    errors.push('verificationDate must be a valid date in YYYY-MM-DD format.');
  } else {
    const verificationTime = new Date(
      `${record.verificationDate}T00:00:00`,
    ).getTime();
    const referenceTime = toReferenceTime(options.referenceDate);
    if (verificationTime > referenceTime + ONE_DAY_MS) {
      errors.push('verificationDate cannot be in the future.');
    }
  }

  if (
    typeof record.amount !== 'number' ||
    !Number.isFinite(record.amount) ||
    record.amount < 0
  ) {
    errors.push('amount must be a non-negative finite number.');
  }

  const validStatuses = Object.values(FEE_VERSION_STATUS);
  if (!validStatuses.includes(record.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}.`);
  }

  if (
    typeof record.currency !== 'string' ||
    !/^[A-Za-z]{3}$/.test(record.currency)
  ) {
    errors.push('currency must be a valid 3-letter ISO code.');
  }

  if (
    record.version !== null &&
    record.version !== undefined &&
    (!Number.isInteger(record.version) || record.version < 1)
  ) {
    errors.push('version must be a positive integer when provided.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ============================================================
// FEE HISTORY (VERSIONING & AUDIT)
// ============================================================

const baselineSource = (rawRecord) => {
  const source = rawRecord?.officialSource;
  if (!source || !source.url || !/^https?:\/\//i.test(source.url)) return null;
  return source;
};

const buildDatasetBaselineVersions = (serviceId) => {
  const rawRecord = SERVICE_FEE_BREAKDOWNS[serviceId];
  const source = baselineSource(rawRecord);
  if (!rawRecord || !source || rawRecord.status === 'unverified') return [];

  const effectiveDate = isValidIsoDate(rawRecord.effectiveDate)
    ? rawRecord.effectiveDate
    : null;
  const verificationDate = isValidIsoDate(rawRecord.lastReviewedDate)
    ? rawRecord.lastReviewedDate
    : effectiveDate;
  if (!effectiveDate || !verificationDate) return [];

  const records = [];

  const addRecord = (fee, componentType, bucket) => {
    if (!fee || typeof fee !== 'object') return;
    const record = {
      id: `baseline-${serviceId}-${bucket}-${fee.id || records.length}`,
      serviceId,
      componentType,
      authority: source.department || source.name || 'Published authority',
      jurisdiction: rawRecord.jurisdiction || 'national',
      state: rawRecord.state || null,
      district: null,
      localBody: null,
      effectiveDate,
      source: source.url,
      sourceName: source.name || source.department || 'Official fee schedule',
      verificationDate,
      amount: Number(fee.amount) || 0,
      isMandatory: fee.mandatory !== false,
      status:
        rawRecord.status === 'free'
          ? FEE_VERSION_STATUS.FREE
          : FEE_VERSION_STATUS.PUBLISHED,
      currency: fee.currency || rawRecord.currency || 'INR',
      label: fee.label || 'Unlabelled official fee',
      applicability: fee.applicability || null,
      maxPermissibleCap:
        typeof fee.maxPermissibleCap === 'number' ? fee.maxPermissibleCap : null,
      provider: fee.provider || null,
      version: 0,
      origin: 'dataset',
      fingerprint: null,
      auditTrail: [
        {
          action: 'dataset-import',
          at: `${verificationDate}T00:00:00.000Z`,
          actor: 'published-schedule',
          reason: 'Verified gazette schedule imported as the baseline version.',
        },
      ],
      createdAt: `${verificationDate}T00:00:00.000Z`,
      updatedAt: `${verificationDate}T00:00:00.000Z`,
    };
    record.fingerprint = createFeeFingerprint(record);
    records.push(record);
  };

  (rawRecord.officialStatutoryFees || []).forEach((fee) =>
    addRecord(fee, FEE_COMPONENT_TYPES.GOVERNMENT_FEE, 'statutory'),
  );
  (rawRecord.conditionalTiers || []).forEach((fee) =>
    addRecord(fee, FEE_COMPONENT_TYPES.GOVERNMENT_FEE, 'tier'),
  );
  (rawRecord.portalCharges || []).forEach((fee) =>
    addRecord(fee, FEE_COMPONENT_TYPES.PORTAL_CHARGE, 'portal'),
  );
  (rawRecord.authorisedCentreCharges || []).forEach((fee) =>
    addRecord(fee, FEE_COMPONENT_TYPES.AUTHORISED_CENTRE_CHARGE, 'centre'),
  );
  (rawRecord.optionalProviderCharges || []).forEach((fee) =>
    addRecord(fee, FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE, 'optional'),
  );

  return records;
};

const loadRecordedFeeHistory = () =>
  readStoredArray(FEE_EVIDENCE_STORAGE_KEYS.FEE_HISTORY);

/**
 * Returns all fee versions for a service, newest first.
 *
 * Baseline versions (version 0) come from the verified gazette dataset.
 * Recorded versions (version 1+) are appended by `recordFeeVersion` and keep
 * an audit trail, so a fee change can be reviewed rather than overwritten.
 *
 * @param {string} serviceId
 * @param {{includeBaseline?: boolean}} [options]
 * @returns {Array<Object>}
 */
export const getFeeHistory = (serviceId, options = {}) => {
  if (!serviceId) return [];
  const { includeBaseline = true } = options;

  const recorded = loadRecordedFeeHistory().filter(
    (record) => record?.serviceId === serviceId,
  );
  const baseline = includeBaseline
    ? buildDatasetBaselineVersions(serviceId)
    : [];

  return [...baseline, ...recorded].sort((left, right) => {
    if (right.version !== left.version) return right.version - left.version;
    return String(right.effectiveDate).localeCompare(String(left.effectiveDate));
  });
};

const uniqueVersionId = (record, existingIds) => {
  const baseId = record.id || `fee-${record.serviceId}-${nextTimestamp()}`;
  if (!existingIds.has(baseId)) return baseId;
  return `${baseId}-v${nextTimestamp()}`;
};

/**
 * Records (publishes) a new fee version. Invalid records are rejected instead
 * of being stored as if they were verified.
 *
 * @param {Object} record
 * @param {{actor?: string, reason?: string}} [options]
 * @returns {{success: boolean, record?: Object, version?: number, errors?: string[]}}
 */
export const recordFeeVersion = (record, options = {}) => {
  const validation = validateVersionedFeeRecord(record);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  const stored = loadRecordedFeeHistory();
  const key = componentKey(record);
  const sameSchedule = stored.filter(
    (item) => componentKey(item) === key && item.serviceId === record.serviceId,
  );
  const nextVersion =
    sameSchedule.reduce(
      (maximum, item) => Math.max(maximum, Number(item.version) || 0),
      0,
    ) + 1;

  const now = new Date().toISOString();
  const existingIds = new Set(stored.map((item) => item.id));
  const saved = {
    ...record,
    id: uniqueVersionId(record, existingIds),
    version: nextVersion,
    origin: 'recorded',
    fingerprint: createFeeFingerprint(record),
    auditTrail: [
      ...(Array.isArray(record.auditTrail) ? record.auditTrail : []),
      {
        action: 'version-recorded',
        at: now,
        actor: normalizeString(options.actor) || 'system',
        reason:
          normalizeString(options.reason) ||
          'New verified fee version recorded.',
        version: nextVersion,
        fingerprint: createFeeFingerprint(record),
      },
    ],
    createdAt: record.createdAt || now,
    updatedAt: now,
  };

  writeStoredArray(FEE_EVIDENCE_STORAGE_KEYS.FEE_HISTORY, [...stored, saved]);
  return { success: true, record: saved, version: nextVersion };
};

/**
 * Returns one recorded version for a service, or null.
 */
export const getFeeVersion = (serviceId, version) => {
  if (!serviceId || !Number.isInteger(Number(version))) return null;
  return (
    getFeeHistory(serviceId, { includeBaseline: false }).find(
      (record) => Number(record.version) === Number(version),
    ) || null
  );
};

const isVersionApplicable = (
  record,
  {
    requestedRank,
    requestedState,
    requestedDistrict,
    requestedLocalBody,
    effectiveDate,
  },
) => {
  if (
    record.status !== FEE_VERSION_STATUS.PUBLISHED &&
    record.status !== FEE_VERSION_STATUS.FREE
  ) {
    return false;
  }
  if (!isValidIsoDate(record.effectiveDate)) return false;
  if (effectiveDate && record.effectiveDate > effectiveDate) return false;

  const rank = JURISDICTION_RANK[record.jurisdiction] || 0;
  if (rank === 0 || rank > requestedRank) return false;
  if (rank === JURISDICTION_RANK.national) return true;

  // A narrower schedule is never applied without the matching place. This
  // prevents a Delhi-only fee from being used when no State/UT was selected.
  if (!requestedState || !record.state || record.state !== requestedState) {
    return false;
  }
  if (rank === JURISDICTION_RANK.state) return true;

  if (
    !requestedDistrict ||
    !record.district ||
    record.district !== requestedDistrict
  ) {
    return false;
  }
  if (rank === JURISDICTION_RANK.district) return true;

  if (!requestedLocalBody) return false;
  return Boolean(record.localBody) && record.localBody === requestedLocalBody;
};

/**
 * Resolves the most specific applicable verified version for a date and place.
 *
 * Precedence: local > district > state > national, then newest version, then
 * latest effective date. Expired/obsolete versions are excluded.
 *
 * @param {string} serviceId
 * @param {{jurisdiction?: string, state?: string, district?: string, localBody?: string, effectiveDate?: string, componentType?: string}} [options]
 * @returns {Object|null}
 */
export const getApplicableFeeVersion = (serviceId, options = {}) => {
  const {
    jurisdiction = 'national',
    state = null,
    district = null,
    localBody = null,
    effectiveDate = todayIsoDate(),
    componentType = null,
  } = options;

  const requestedRank =
    JURISDICTION_RANK[jurisdiction] || JURISDICTION_RANK.national;
  const referenceDate = isValidIsoDate(effectiveDate)
    ? effectiveDate
    : todayIsoDate();

  const candidates = getFeeHistory(serviceId).filter((record) => {
    if (componentType && record.componentType !== componentType) return false;
    return isVersionApplicable(record, {
      requestedRank,
      requestedState: state,
      requestedDistrict: district,
      requestedLocalBody: localBody,
      effectiveDate: referenceDate,
    });
  });

  candidates.sort((left, right) => {
    const rankDifference =
      (JURISDICTION_RANK[right.jurisdiction] || 0) -
      (JURISDICTION_RANK[left.jurisdiction] || 0);
    if (rankDifference !== 0) return rankDifference;
    if ((right.version || 0) !== (left.version || 0)) {
      return (right.version || 0) - (left.version || 0);
    }
    return String(right.effectiveDate).localeCompare(
      String(left.effectiveDate),
    );
  });

  return candidates[0] || null;
};

const isMoreSpecificVersion = (candidate, current) => {
  const candidateRank = JURISDICTION_RANK[candidate.jurisdiction] || 0;
  const currentRank = JURISDICTION_RANK[current.jurisdiction] || 0;
  if (candidateRank !== currentRank) return candidateRank > currentRank;
  if ((candidate.version || 0) !== (current.version || 0)) {
    return (candidate.version || 0) > (current.version || 0);
  }
  return String(candidate.effectiveDate).localeCompare(
    String(current.effectiveDate),
  ) > 0;
};

/**
 * Resolves the applicable version for every component of a service.
 */
export const getApplicableFeeSchedule = (serviceId, options = {}) => {
  const {
    jurisdiction = 'national',
    state = null,
    district = null,
    localBody = null,
    effectiveDate = todayIsoDate(),
  } = options;
  const requestedRank =
    JURISDICTION_RANK[jurisdiction] || JURISDICTION_RANK.national;
  const referenceDate = isValidIsoDate(effectiveDate)
    ? effectiveDate
    : todayIsoDate();

  const applicable = getFeeHistory(serviceId).filter((record) =>
    isVersionApplicable(record, {
      requestedRank,
      requestedState: state,
      requestedDistrict: district,
      requestedLocalBody: localBody,
      effectiveDate: referenceDate,
    }),
  );

  const byComponent = new Map();
  applicable.forEach((record) => {
    const key = `${record.componentType}|${record.label}`;
    const current = byComponent.get(key);
    if (!current || isMoreSpecificVersion(record, current)) {
      byComponent.set(key, record);
    }
  });

  return Array.from(byComponent.values());
};

/**
 * Lists the services that have a published, non-obsolete fee schedule.
 */
export const listVerifiedServices = () =>
  Object.values(SERVICE_FEE_BREAKDOWNS)
    .filter(
      (record) =>
        record &&
        record.serviceId &&
        !record.serviceId.startsWith('test-') &&
        record.status !== 'unverified' &&
        record.officialSource,
    )
    .map((record) => ({
      serviceId: record.serviceId,
      serviceName: record.serviceName || record.serviceId,
      status: record.status,
      effectiveDate: record.effectiveDate || null,
      verificationDate: record.lastReviewedDate || null,
      department:
        record.officialSource?.department ||
        record.officialSource?.name ||
        'Published authority',
    }))
    .sort((left, right) =>
      left.serviceName.localeCompare(right.serviceName),
    );

/**
 * Clears locally recorded fee versions. Baseline gazette data is not stored and
 * is never modified by this helper.
 */
export const resetFeeHistory = () => {
  inMemoryStore.delete(FEE_EVIDENCE_STORAGE_KEYS.FEE_HISTORY);
  memoryFallbackKeys.delete(FEE_EVIDENCE_STORAGE_KEYS.FEE_HISTORY);
  try {
    const storage = getsBrowserStorage();
    if (storage) storage.removeItem(FEE_EVIDENCE_STORAGE_KEYS.FEE_HISTORY);
  } catch {
    // Non-fatal.
  }
};

// ============================================================
// RECEIPT EVIDENCE & REDACTION
// ============================================================

const IDENTIFIER_PATTERNS = [
  {
    type: 'payment-card',
    // Card-like numbers with optional spaces or hyphens. Redacted before
    // shorter identifiers so a 16-digit card is not partially matched.
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
  },
  {
    type: 'payment-secret',
    pattern:
      /\b(?:cvv|cvc|otp|upi\s*pin|atm\s*pin|card\s*pin)\b\s*[:#-]?\s*\d{3,6}\b/gi,
  },
  {
    type: 'email',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    type: 'upi-id',
    // UPI handles are not limited to one bank list, so redact any @handle
    // that is not an email address (the email pattern above runs first).
    pattern: /\b[\w.-]+@[A-Za-z][A-Za-z0-9-]{1,}(?![\w.-])/g,
  },
  {
    type: 'ifsc',
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi,
  },
  {
    type: 'pan',
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  },
  {
    type: 'aadhaar',
    pattern: /(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)/g,
  },
  {
    type: 'mobile',
    pattern: /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g,
  },
  {
    type: 'labelled-identifier',
    pattern:
      /\b(?:ARN|ACK|ACKNOWLEDGEMENT|RECEIPT|REC|TXN|TRANSACTION|INVOICE|APPLICATION|APP|SRN|TOKEN)\s*(?:NO\.?|NUMBER|#|:|-)?\s*[A-Z0-9][A-Z0-9/-]{3,}\b/gi,
  },
  {
    type: 'long-number',
    pattern: /\b\d{8,}\b/g,
  },
];

/**
 * Removes receipt identifiers from free text. Returns only the redacted text
 * and the identifier categories that were removed; the original value is not
 * stored or returned.
 *
 * @param {string} text
 * @returns {{redactedText: string, redactedTypes: string[], redactionCount: number}}
 */
export const redactReceiptText = (text) => {
  if (typeof text !== 'string' || !text) {
    return { redactedText: '', redactedTypes: [], redactionCount: 0 };
  }

  let redactedText = text;
  const redactedTypes = new Set();
  let redactionCount = 0;

  IDENTIFIER_PATTERNS.forEach(({ type, pattern }) => {
    redactedText = redactedText.replace(pattern, () => {
      redactionCount += 1;
      redactedTypes.add(type);
      return `[REDACTED:${type.toUpperCase()}]`;
    });
  });

  return {
    redactedText,
    redactedTypes: Array.from(redactedTypes),
    redactionCount,
  };
};

/**
 * Redacts one identifier value, such as a receipt number.
 */
export const redactIdentifier = (value) => {
  if (value === null || value === undefined || value === '') return 'REDACTED';
  return 'REDACTED';
};

const normalizeFeeComponent = (component = {}) => {
  const label = sanitizePlainText(
    component.label || component.name || component.componentType || 'Charge',
    { max: 200, multiline: false },
  );
  const amount = Number(component.amount);

  return {
    label: label || 'Charge',
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    componentType:
      component.componentType || inferFeeComponentType(label),
    quantity:
      Number.isFinite(Number(component.quantity)) && Number(component.quantity) > 0
        ? Number(component.quantity)
        : 1,
    note: component.note
      ? sanitizePlainText(component.note, { max: 300, multiline: false })
      : undefined,
  };
};

/**
 * Creates receipt evidence from user-entered amounts and/or pasted OCR text.
 *
 * By default, receipt identifiers are redacted both as the receiptId field and
 * anywhere they appear in the pasted text. Pass `redactIdentifiers: false` (or
 * `metadata: { redaction: false }`) only for an explicit, user-controlled
 * session where the identifier is needed.
 */
export const createReceiptEvidence = (options = {}) => {
  const {
    serviceId,
    rawText = '',
    receiptId = '',
    jurisdiction = null,
    state = null,
    district = null,
    localBody = null,
    captureDate,
    feeComponents = [],
    metadata = {},
    redactIdentifiers,
  } = options;

  const redactionEnabled =
    redactIdentifiers === undefined
      ? metadata?.redaction !== false
      : Boolean(redactIdentifiers);

  const safeRawText = sanitizePlainText(String(rawText || ''), {
    max: MAX_OCR_TEXT_LENGTH,
    multiline: true,
  });
  const redaction = redactionEnabled
    ? redactReceiptText(safeRawText)
    : { redactedText: safeRawText, redactedTypes: [], redactionCount: 0 };

  const inputComponents = Array.isArray(feeComponents)
    ? feeComponents
    : feeComponents
      ? [feeComponents]
      : [];

  const normalizedComponents = inputComponents
    .filter((component) => component && typeof component === 'object')
    .map(normalizeFeeComponent);

  return {
    id: `receipt-${serviceId || 'unknown'}-${nextTimestamp()}`,
    serviceId,
    rawText: redaction.redactedText,
    receiptId: redactionEnabled
      ? receiptId
        ? redactIdentifier(receiptId)
        : ''
      : receiptId || 'unknown',
    jurisdiction,
    state,
    district,
    localBody,
    captureDate: isValidIsoDate(captureDate) ? captureDate : todayIsoDate(),
    feeComponents: normalizedComponents,
    metadata: {
      ...metadata,
      redactionApplied: redactionEnabled,
      redactedIdentifiers: redaction.redactionCount,
      redactedTypes: redaction.redactedTypes,
      ocrQuality: metadata?.ocrQuality || 'unknown',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

// ============================================================
// OCR CORRECTION & RECEIPT PARSING
// ============================================================

const OCR_DIGIT_MAP = {
  O: '0',
  o: '0',
  I: '1',
  l: '1',
  S: '5',
  B: '8',
  Z: '2',
};

const NUMERIC_TOKEN_PATTERN = /^[₹$]?(?:Rs\.?|INR)?[\dOoIlSBZ,.]+$/i;

const correctNumericToken = (token) => {
  const prefixMatch = token.match(/^(₹|Rs\.?|INR)/i);
  const prefix = prefixMatch ? prefixMatch[0] : '';
  const numericBody = token.slice(prefix.length);
  return (
    prefix +
    numericBody.replace(
      /[OoIlSBZ]/g,
      (character) => OCR_DIGIT_MAP[character] || character,
    )
  );
};

/**
 * Repairs common OCR character substitutions inside numeric tokens without
 * touching words such as "Passport". The original text is never mutated.
 *
 * @param {string} rawText
 * @returns {string}
 */
export const correctOcrText = (rawText) => {
  if (typeof rawText !== 'string') return '';
  return rawText
    .split(/(\s+)/)
    .map((token) => {
      if (!NUMERIC_TOKEN_PATTERN.test(token) || !/\d/.test(token)) return token;
      return correctNumericToken(token);
    })
    .join('');
};

/**
 * Reports every OCR correction made, for transparency in the UI.
 *
 * @param {string} rawText
 * @returns {Array<{original: string, corrected: string}>}
 */
export const detectOcrCorrections = (rawText) => {
  if (typeof rawText !== 'string') return [];
  const corrections = [];
  rawText.split(/\s+/).forEach((token) => {
    if (!NUMERIC_TOKEN_PATTERN.test(token) || !/\d/.test(token)) return;
    const corrected = correctNumericToken(token);
    if (corrected !== token) corrections.push({ original: token, corrected });
  });
  return corrections;
};

/**
 * Infers the fee component type from a label. This is a suggestion only; the
 * discrepancy report still requires an official label match.
 */
export const inferFeeComponentType = (label) => {
  const text = normalizeString(label).toLowerCase();
  if (!text) return 'unknown';

  if (
    /optional|sms|lounge|doorstep|courier|speed post|photocopy|facilitation|convenience|premium|value[- ]added|typing|scanning|notary|agent/.test(
      text,
    )
  ) {
    return FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE;
  }
  if (/portal|online|e-?payment|gateway|internet|booking/.test(text)) {
    return FEE_COMPONENT_TYPES.PORTAL_CHARGE;
  }
  if (/centre|center|kiosk|\bcsc\b|counter|operator/.test(text)) {
    return FEE_COMPONENT_TYPES.AUTHORISED_CENTRE_CHARGE;
  }
  if (
    /statutory|government|govt|application|issue|issuance|test|registration|license|licence|passport|aadhaar|pan\b|voter|fee/.test(
      text,
    )
  ) {
    return FEE_COMPONENT_TYPES.GOVERNMENT_FEE;
  }
  return 'unknown';
};

const AMOUNT_PATTERN = /(?:₹|Rs\.?|INR)?\s*(-?\d[\d,]*(?:\.\d{1,2})?)/gi;
const NON_CHARGE_LINE_PATTERNS = [
  // Dates and times, e.g. "Date 15/01/2026" or "Time 10:30".
  /^(?:date|time)\b\s*[:#-]?\s*(?:\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}|\d{1,2}:\d{2})/i,
  // Identifier headers, e.g. "Receipt No: REC-123" or "ARN-98234710".
  /^(?:invoice|receipt|arn|ack(?:nowledgement)?|application|srn|token)\s*(?:no\.?|number)\b\s*(?:#|:|-)?\s*[A-Z0-9]/i,
  /^(?:invoice|receipt|arn|ack(?:nowledgement)?|application|srn|token)\s*(?:#|:|-)\s*[A-Z0-9]/i,
  // Label/value headers that require a separator, so a charge such as
  // "Name Change Fee" or "Address Correction Fee" is still parsed.
  /^(?:mobile|phone|email|gstin|address|name|counter)\b\s*[:#-]/i,
  // A bare counter number, e.g. "Counter 3".
  /^counter\b\s*[:#-]?\s*\d+\s*$/i,
  // Phone numbers written without a separator, e.g. "Mobile 9876543210".
  /^(?:mobile|phone)\b\s*[:#-]?\s*\+?\d[\d\s-]{7,}\s*$/i,
  // An email address written without a separator.
  /^email\b\s*[:#-]?\s*\S+@\S+/i,
  // A GSTIN written without a separator.
  /^gstin\b\s*[:#-]?\s*[0-9A-Z]{15}\s*$/i,
];
const isNonChargeLine = (line) =>
  NON_CHARGE_LINE_PATTERNS.some((pattern) => pattern.test(line));
const TOTAL_LINE_PATTERN =
  /^(?:total|grand\s+total|sub\s*total|subtotal|amount\s+paid|balance|net\s+(?:payable|amount))\b/i;

const cleanParsedLabel = (value) => {
  let cleaned = value
    .replace(/[|]+/g, ' ')
    .replace(/^\d+[).]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // A label often ends with "Rs. " or a dash before the amount. Strip the
  // separators repeatedly because removing one can expose the other.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = cleaned
      .replace(/[-–—:;,]+$/, '')
      .replace(/(?:₹|Rs\.?|INR)\s*$/i, '')
      .trim();
    if (next === cleaned) break;
    cleaned = next;
  }

  return cleaned;
};

/**
 * Parses pasted receipt or OCR text into candidate fee components.
 *
 * The parser repairs OCR digit confusions first, then reads the last amount on
 * each line. It never assumes an unknown line is an official fee; components
 * are returned as candidates and are labelled unverified later unless matched.
 *
 * @param {string} rawText
 * @returns {{correctedText: string, corrections: Array, components: Array, warnings: string[]}}
 */
export const parseReceiptText = (rawText) => {
  const boundedText = sanitizePlainText(String(rawText || ''), {
    max: MAX_OCR_TEXT_LENGTH,
    multiline: true,
  });
  const corrections = detectOcrCorrections(boundedText);
  const correctedText = correctOcrText(boundedText);
  const components = [];
  const warnings = [];

  correctedText.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (isNonChargeLine(trimmed)) return;

    const matches = Array.from(trimmed.matchAll(AMOUNT_PATTERN));
    if (matches.length === 0) return;

    const lastMatch = matches[matches.length - 1];
    const amountText = lastMatch[1];
    const amount = Number(amountText.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return;

    const rawLabel = trimmed.slice(0, lastMatch.index);
    const label = cleanParsedLabel(rawLabel);
    if (!label) {
      warnings.push(`Ignored a line with an amount but no charge label: ${trimmed}`);
      return;
    }
    if (TOTAL_LINE_PATTERN.test(label)) {
      warnings.push(`Total lines are not treated as separate charges: ${trimmed}`);
      return;
    }

    components.push({
      label,
      amount,
      componentType: inferFeeComponentType(label),
      sourceLine: trimmed,
      requiresReview:
        /unknown|other|misc|sundry/i.test(label) ||
        inferFeeComponentType(label) === 'unknown',
    });
  });

  return { correctedText, corrections, components, warnings };
};

// ============================================================
// DISCREPANCY REPORT
// ============================================================

const LABEL_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'application',
  'charge',
  'charges',
  'fee',
  'fees',
  'for',
  'of',
  'per',
  'service',
  'services',
  'the',
  'to',
  'type',
]);

const labelTokens = (value) =>
  normalizeString(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !LABEL_STOPWORDS.has(token))
    .map((token) =>
      token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token,
    );

const tokensMatch = (left, right) => {
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length < 4) return false;
  // Prefix matching handles common administrative morphology such as
  // "issue"/"issuance" and "charge"/"charges" without matching short words.
  return longer.startsWith(shorter) || longer.startsWith(shorter.slice(0, 4));
};

const labelMatchScore = (leftLabel, rightLabel) => {
  const left = labelTokens(leftLabel);
  const right = labelTokens(rightLabel);
  if (left.length === 0 || right.length === 0) return 0;

  let intersection = 0;
  left.forEach((leftToken) => {
    if (right.some((rightToken) => tokensMatch(leftToken, rightToken))) {
      intersection += 1;
    }
  });

  const smallerSize = Math.min(left.length, right.length);
  const containment = intersection === smallerSize ? 1 : 0;
  const jaccard = intersection / (left.length + right.length - intersection);
  return Math.max(containment, jaccard);
};

const findOfficialFeeMatch = (charged, officialFees) => {
  const chargedTokenCount = labelTokens(charged.label).length;

  const candidates = officialFees
    .map((fee) => {
      let score = labelMatchScore(charged.label, fee.label);
      if (
        charged.componentType &&
        charged.componentType !== 'unknown' &&
        fee.componentType &&
        charged.componentType !== fee.componentType
      ) {
        score -= 0.15;
      }
      return {
        fee,
        score,
        tokenDistance: Math.abs(
          labelTokens(fee.label).length - chargedTokenCount,
        ),
      };
    })
    .filter((candidate) => candidate.score >= 0.5)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      // A state/district/local fee overrides a broader schedule for the same
      // label, even when both entries have the same text.
      const leftRank = JURISDICTION_RANK[left.fee.jurisdiction] || 0;
      const rightRank = JURISDICTION_RANK[right.fee.jurisdiction] || 0;
      if (rightRank !== leftRank) return rightRank - leftRank;
      // Prefer the label whose token count is closest to the charged label.
      if (left.tokenDistance !== right.tokenDistance) {
        return left.tokenDistance - right.tokenDistance;
      }
      // Then prefer the newest applicable version. This is deliberately
      // before the exact-amount check so a superseded amount can never win
      // merely because the old receipt matches it.
      if ((right.fee.version || 0) !== (left.fee.version || 0)) {
        return (right.fee.version || 0) - (left.fee.version || 0);
      }
      const leftExact = left.fee.amount === charged.amount ? 1 : 0;
      const rightExact = right.fee.amount === charged.amount ? 1 : 0;
      if (rightExact !== leftExact) return rightExact - leftExact;
      return left.fee.amount - right.fee.amount;
    });

  return candidates.length > 0 ? candidates[0].fee : null;
};

const officialFeesForReport = (serviceId, feeBreakdown, options) => {
  const jurisdiction = options.jurisdiction || 'national';
  const effectiveDate = isValidIsoDate(options.checkDate)
    ? options.checkDate
    : todayIsoDate();

  // Resolve one applicable version per component. Without this collapse, an
  // older version with the same label could win the report match merely
  // because its amount happened to equal the charged amount.
  const applicable = getApplicableFeeSchedule(serviceId, {
    jurisdiction,
    state: options.state || null,
    district: options.district || null,
    localBody: options.localBody || null,
    effectiveDate,
  });

  return applicable.map((record) => ({
    ...record,
    jurisdictionRank: JURISDICTION_RANK[record.jurisdiction] || 0,
    sourceName:
      record.sourceName ||
      record.authority ||
      feeBreakdown.officialSource?.name ||
      'Official fee schedule',
  }));
};

/**
 * Produces a redacted discrepancy report comparing user-entered charges with
 * the applicable verified fee versions.
 *
 * Acceptance criteria covered:
 * - Only an applicable official source can support an "overcharged" result.
 * - Unknown components are labelled "unverified".
 * - Receipt identifiers stay redacted in the report.
 * - The report carries the fee version/source/verification date used.
 *
 * @param {Object} receiptEvidence
 * @param {string} serviceId
 * @param {{jurisdiction?: string, state?: string, checkDate?: string}} [options]
 * @returns {Object}
 */
export const generateDiscrepancyReport = (receiptEvidence, serviceId, options = {}) => {
  const components = Array.isArray(receiptEvidence?.feeComponents)
    ? receiptEvidence.feeComponents
    : [];
  const checkDate = isValidIsoDate(options.checkDate)
    ? options.checkDate
    : todayIsoDate();
  const jurisdiction =
    options.jurisdiction || receiptEvidence?.jurisdiction || 'national';
  const state = options.state || receiptEvidence?.state || null;
  const district = options.district || receiptEvidence?.district || null;
  const localBody = options.localBody || receiptEvidence?.localBody || null;
  const feeBreakdown = getServiceFeeBreakdown(serviceId, {
    referenceDate: checkDate,
  });

  const report = {
    serviceId,
    serviceName: feeBreakdown.serviceName || serviceId,
    receiptEvidenceId: receiptEvidence?.id || null,
    receiptIdentifier: receiptEvidence?.receiptId || null,
    jurisdiction,
    state,
    district,
    localBody,
    checkDate,
    timestamp: new Date().toISOString(),
    overallMatch: 'match',
    isOfficialScheduleApplicable: false,
    officialSchedule: null,
    componentComparisons: [],
    summary: {
      totalCharged: 0,
      totalOfficial: 0,
      totalDiscrepancy: 0,
      totalOvercharge: 0,
      totalUndercharge: 0,
      componentsMatched: 0,
      componentsExactMatch: 0,
      componentsOvercharged: 0,
      componentsUndercharged: 0,
      componentsUnverified: 0,
      componentsUnmatched: 0,
    },
    warnings: [],
    disclaimer:
      'This evidence report compares entered amounts with a published fee schedule. It does not determine whether a charge is lawful and is not legal advice. Civic Help Setu does not collect payment credentials or initiate transactions.',
  };

  const officialFees = officialFeesForReport(serviceId, feeBreakdown, {
    ...options,
    jurisdiction,
    state,
    district,
    localBody,
    checkDate,
  });
  const hasApplicableFeeVersion = officialFees.length > 0;

  const sourceIsApplicable =
    feeBreakdown.isVerified &&
    !feeBreakdown.isExpired &&
    Boolean(feeBreakdown.officialSource) &&
    hasApplicableFeeVersion;

  report.isOfficialScheduleApplicable = sourceIsApplicable;

  if (!sourceIsApplicable) {
    const reason = feeBreakdown.isExpired
      ? 'The official fee schedule is past its review window, so no overcharge conclusion can be drawn. Confirm the current fee with the department.'
      : !feeBreakdown.isVerified
        ? 'Fee schedule not verified for this service. No overcharge conclusion is drawn without an applicable official source.'
        : 'No official fee version is effective on the selected check date for this jurisdiction. No overcharge conclusion is drawn.';
    report.overallMatch = 'unverified';
    report.warnings.push(reason);
    report.componentComparisons = components.map((component) => ({
      componentType: component.componentType || 'unknown',
      componentTypeLabel: componentTypeLabel(component.componentType),
      label: component.label,
      chargedAmount: Number(component.amount) || 0,
      officialAmount: null,
      officialSource: null,
      officialSourceUrl: null,
      status: 'unverified',
      discrepancy: reason,
      redactionApplied: Boolean(receiptEvidence?.metadata?.redactionApplied),
    }));
    report.summary.componentsUnverified = components.length;
    report.summary.componentsUnmatched = components.length;
    report.summary.totalCharged = components.reduce(
      (total, component) => total + (Number(component.amount) || 0),
      0,
    );
    if (components.length === 0) report.overallMatch = 'no-components';
    return report;
  }

  report.officialSchedule = {
    name: feeBreakdown.officialSource?.name || 'Official fee schedule',
    department:
      feeBreakdown.officialSource?.department || 'Published authority',
    url: feeBreakdown.officialSource?.url || null,
    effectiveDate: feeBreakdown.effectiveDate || null,
    verificationDate: feeBreakdown.lastReviewedDate || null,
    componentCount: officialFees.length,
  };

  report.componentComparisons = components.map((component) => {
    const chargedAmount = Number(component.amount) || 0;
    const match = findOfficialFeeMatch(
      {
        label: component.label,
        amount: chargedAmount,
        componentType: component.componentType,
      },
      officialFees,
    );

    if (!match) {
      report.summary.componentsUnverified += 1;
      report.summary.componentsUnmatched += 1;
      return {
        componentType: component.componentType || 'unknown',
        componentTypeLabel: componentTypeLabel(component.componentType),
        label: component.label,
        chargedAmount,
        officialAmount: null,
        officialSource: null,
        officialSourceUrl: null,
        officialFeeLabel: null,
        officialVerificationDate: null,
        status: 'unverified',
        discrepancy:
          'No official match found. This component is unverified; no overcharge conclusion is drawn without an applicable official source.',
        redactionApplied: Boolean(receiptEvidence?.metadata?.redactionApplied),
      };
    }

    const officialAmount = Number(match.amount) || 0;
    const difference = chargedAmount - officialAmount;
    const tolerance = Math.max(5, officialAmount * 0.01);
    let status = 'matched';
    let message = 'Amount matches the published official fee.';

    if (difference > tolerance) {
      status = 'overcharged';
      message = `Above the published fee: charged ₹${chargedAmount} vs official ₹${officialAmount}.`;
      report.summary.componentsOvercharged += 1;
      report.summary.totalOvercharge += difference;
      report.summary.totalDiscrepancy += difference;
    } else if (difference < -tolerance) {
      status = 'undercharged';
      message = `Below the published fee: charged ₹${chargedAmount} vs official ₹${officialAmount}.`;
      report.summary.componentsUndercharged += 1;
      report.summary.totalUndercharge += Math.abs(difference);
      report.summary.totalDiscrepancy += Math.abs(difference);
    } else {
      report.summary.componentsExactMatch += 1;
    }

    report.summary.componentsMatched += 1;
    report.summary.totalOfficial += officialAmount;
    report.summary.totalCharged += chargedAmount;

    return {
      componentType: component.componentType || match.componentType || 'unknown',
      componentTypeLabel: componentTypeLabel(
        component.componentType || match.componentType,
      ),
      label: component.label,
      chargedAmount,
      officialAmount,
      officialSource:
        match.sourceName ||
        feeBreakdown.officialSource?.name ||
        'Official fee schedule',
      officialSourceUrl:
        match.source || feeBreakdown.officialSource?.url || null,
      officialFeeLabel: match.label || null,
      officialFeeId: match.id || null,
      officialAuthority: match.authority || null,
      officialEffectiveDate: match.effectiveDate || null,
      officialVerificationDate: match.verificationDate || null,
      officialFeeVersion: match.version ?? null,
      status,
      discrepancy: message,
      redactionApplied: Boolean(receiptEvidence?.metadata?.redactionApplied),
    };
  });

  const matchedSources = report.componentComparisons.filter(
    (comparison) => comparison.officialSourceUrl,
  );
  const uniqueSources = new Map(
    matchedSources.map((comparison) => [
      comparison.officialSourceUrl,
      {
        name:
          comparison.officialSource ||
          comparison.officialAuthority ||
          'Official fee schedule',
        department: comparison.officialAuthority || 'Published authority',
        url: comparison.officialSourceUrl,
        effectiveDate: comparison.officialEffectiveDate || null,
        verificationDate: comparison.officialVerificationDate || null,
      },
    ]),
  );

  if (uniqueSources.size === 1) {
    const [source] = Array.from(uniqueSources.values());
    report.officialSchedule = {
      ...source,
      componentCount: officialFees.length,
    };
  } else if (uniqueSources.size > 1) {
    report.officialSchedule = {
      name: 'Multiple official sources',
      department: 'See the source for each matched component',
      url: null,
      effectiveDate: null,
      verificationDate: null,
      componentCount: officialFees.length,
      sources: Array.from(uniqueSources.values()),
    };
  }

  // The comparison map adds charged totals only for matched components; make
  // sure the summary reflects every entered charge exactly once.
  report.summary.totalCharged = components.reduce(
    (total, component) => total + (Number(component.amount) || 0),
    0,
  );

  const totalComponents = components.length;
  const {
    componentsUnverified,
    componentsOvercharged,
    componentsUndercharged,
    componentsExactMatch,
  } = report.summary;

  if (totalComponents === 0) {
    report.overallMatch = 'no-components';
  } else if (componentsUnverified === totalComponents) {
    report.overallMatch = 'unverified';
  } else if (componentsOvercharged > 0) {
    report.overallMatch =
      componentsOvercharged === totalComponents
        ? 'overcharged'
        : 'partial-overcharge';
  } else if (
    componentsUndercharged > 0 &&
    componentsUnverified === 0
  ) {
    report.overallMatch = 'undercharged';
  } else if (
    componentsExactMatch === totalComponents &&
    componentsUnverified === 0
  ) {
    report.overallMatch = 'match';
  } else {
    report.overallMatch = 'partial-match';
  }

  if (report.summary.componentsUnverified > 0) {
    report.warnings.push(
      'Unknown components are labelled unverified. They are not treated as an overcharge without an applicable official source.',
    );
  }

  return report;
};

// ============================================================
// GRIEVANCE ROUTES
// ============================================================

const SERVICE_GRIEVANCE_ROUTES = {
  'aadhaar-card': {
    title: 'Aadhaar Grievance Redressal',
    portalUrl: 'https://uidai.gov.in',
    department: 'UIDAI - Unique Identification Authority of India',
    complaintCategories: [
      'Overcharging',
      'Unauthorized fees',
      'Missing receipt',
      'Optional doorstep charges',
    ],
  },
  passport: {
    title: 'Passport Grievance Redressal',
    portalUrl: 'https://www.passportindia.gov.in',
    department:
      'Ministry of External Affairs - Consular, Passport and Visa Division',
    complaintCategories: [
      'Overcharging',
      'Missing receipt',
      'Optional lounge/SMS charges forced',
    ],
  },
  'driving-license': {
    title: 'RTO/Parivahan Grievance',
    portalUrl: 'https://parivahan.gov.in',
    department: 'Ministry of Road Transport and Highways',
    complaintCategories: [
      'Overcharging',
      'Missing receipt',
      'Optional facilitation/Speed Post charges',
    ],
  },
  'pan-card': {
    title: 'PAN Card Grievance',
    portalUrl: 'https://www.onlineservices.nsdl.com',
    department: 'Income Tax Department - CBDT',
    complaintCategories: [
      'Overcharging',
      'Missing receipt',
      'CSC scanning/upload charges',
    ],
  },
  'voter-id': {
    title: 'Electoral Grievance',
    portalUrl: 'https://voters.eci.gov.in',
    department: 'Election Commission of India',
    complaintCategories: ['Unauthorized fees', 'Missing receipt'],
  },
};

/**
 * Returns the published grievance route for a service, or a clearly marked
 * generic CPGRAMS fallback when no service-specific route is published.
 *
 * @param {string} serviceId
 * @returns {Object}
 */
export const getGrievanceRoute = (serviceId) => {
  const feeBreakdown = getServiceFeeBreakdown(serviceId);
  const specificRoute = SERVICE_GRIEVANCE_ROUTES[serviceId];

  if (!feeBreakdown.isVerified) {
    return {
      title: 'Grievance Route',
      status: 'unverified',
      serviceName: feeBreakdown.serviceName || serviceId,
      message:
        'No service-specific fee grievance route is published for this service. You can still file a generic complaint on CPGRAMS and attach the receipt and fee schedule you relied on.',
      portalUrl: null,
      cpgrsLink: 'https://pgportal.gov.in',
      department: 'Not published for this service',
      complaintCategories: ['Overcharging', 'Missing receipt'],
      verificationDate: null,
    };
  }

  if (specificRoute) {
    return {
      ...specificRoute,
      status: 'available',
      serviceName: feeBreakdown.serviceName || serviceId,
      cpgrsLink: 'https://pgportal.gov.in',
      sourceName: feeBreakdown.officialSource?.name || null,
      sourceUrl: feeBreakdown.officialSource?.url || null,
      verificationDate: feeBreakdown.lastReviewedDate || null,
      message: feeBreakdown.isExpired
        ? 'The published fee schedule is past its review window. Confirm the current rate with the department before relying on this route.'
        : 'Use the official portal or CPGRAMS link and attach the redacted receipt and the fee schedule you compared against.',
    };
  }

  return {
    title: 'Grievance Route',
    status: feeBreakdown.isExpired ? 'review-required' : 'available',
    serviceName: feeBreakdown.serviceName || serviceId,
    message: feeBreakdown.isExpired
      ? 'The published fee schedule is past its review window. Confirm the current rate with the department before filing.'
      : 'Use the official source below or CPGRAMS, and attach the redacted receipt and fee schedule.',
    portalUrl: feeBreakdown.officialSource?.url || null,
    cpgrsLink: 'https://pgportal.gov.in',
    department:
      feeBreakdown.officialSource?.department || 'Concerned Department',
    complaintCategories: ['Overcharging', 'Missing receipt'],
    sourceName: feeBreakdown.officialSource?.name || null,
    verificationDate: feeBreakdown.lastReviewedDate || null,
  };
};

// ============================================================
// COMMUNITY FEE OBSERVATIONS (MODERATED)
// ============================================================

const SENSITIVE_KEY_PATTERN =
  /card|cvv|cvc|pin|otp|password|passcode|account|ifsc|upi|iban|wallet/i;
const PAYMENT_CREDENTIAL_PATTERNS = [
  /\b(?:\d[ -]?){13,19}\b/, // payment card-like number
  /\b(?:cvv|cvc|otp|upi\s*pin|atm\s*pin|card\s*pin)\b/i,
  /\b[A-Z]{4}0[A-Z0-9]{6}\b/i, // IFSC
  /\b[\w.-]+@[A-Za-z][A-Za-z0-9-]{1,}(?![\w.-])/, // UPI handle
];

/**
 * Detects payment credentials in free text. Community observations must never
 * collect card numbers, CVV/PIN/OTP values, bank account numbers, or UPI IDs.
 */
export const containsPaymentCredentials = (value) => {
  if (typeof value !== 'string' || !value) return false;
  return PAYMENT_CREDENTIAL_PATTERNS.some((pattern) => pattern.test(value));
};

const sanitizeEvidence = (value, depth = 0) => {
  if (depth > 4 || value === null || value === undefined) return {};
  if (typeof value === 'string') {
    const redaction = redactReceiptText(value);
    return redaction.redactedText;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEvidence(item, depth + 1));
  }
  const result = {};
  Object.entries(value).forEach(([key, item]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) return;
    result[key] = sanitizeEvidence(item, depth + 1);
  });
  return result;
};

const publicObservation = (observation = {}) => {
  const rest = { ...observation };
  const hasEvidence = Boolean(
    observation.evidence && Object.keys(observation.evidence).length > 0,
  );
  delete rest.userId;
  delete rest.evidence;
  delete rest.moderatorNotes;
  delete rest.moderatedBy;
  delete rest.auditTrail;
  return {
    ...rest,
    evidenceAttached: hasEvidence,
  };
};

const loadObservations = () =>
  readStoredArray(FEE_EVIDENCE_STORAGE_KEYS.OBSERVATIONS);

/**
 * Creates a community fee observation in PENDING state. It is not visible to
 * the public until a moderator approves it.
 *
 * @param {Object} options
 * @returns {Object} observation with `valid`/`error` when rejected
 */
export const createCommunityFeeObservation = (options = {}) => {
  const {
    serviceId,
    userId,
    observedAmount,
    officialAmount = null,
    componentType,
    location = '',
    jurisdiction = null,
    state = null,
    description,
    evidence = {},
  } = options;

  const normalizedObserved = Number(observedAmount);
  const normalizedOfficial =
    officialAmount === null || officialAmount === undefined
      ? null
      : Number(officialAmount);

  const safeLocation = redactReceiptText(
    sanitizePlainText(location, { max: 160, multiline: false }),
  ).redactedText;
  const safeDescription = redactReceiptText(
    sanitizePlainText(description || '', {
      max: 1000,
      multiline: true,
    }),
  ).redactedText;

  const base = {
    id: `community-obs-${serviceId || 'unknown'}-${nextTimestamp()}-${Math.floor(
      Math.random() * 10000,
    )}`,
    serviceId,
    userId: userId || 'anonymous',
    observedAmount: normalizedObserved,
    officialAmount: normalizedOfficial,
    componentType:
      componentType || FEE_COMPONENT_TYPES.OPTIONAL_SERVICE_CHARGE,
    location: safeLocation,
    jurisdiction,
    state,
    description: safeDescription,
    evidence: sanitizeEvidence(evidence),
    status: COMMUNITY_OBSERVATION_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    moderatorNotes: null,
    moderatedAt: null,
    moderatedBy: null,
  };

  const errors = [];
  if (!serviceId || typeof serviceId !== 'string') {
    errors.push('A service must be selected.');
  }
  if (!Number.isFinite(normalizedObserved) || normalizedObserved < 0) {
    errors.push('Observed amount must be a non-negative number.');
  }
  if (
    normalizedOfficial !== null &&
    (!Number.isFinite(normalizedOfficial) || normalizedOfficial < 0)
  ) {
    errors.push('Official amount must be a non-negative number when provided.');
  }
  if (!base.description || base.description.length < 10) {
    errors.push('Please describe what happened in at least 10 characters.');
  }
  let evidenceText;
  try {
    evidenceText = JSON.stringify(evidence) || '';
  } catch {
    evidenceText = '';
  }

  if (
    containsPaymentCredentials(description) ||
    containsPaymentCredentials(evidenceText)
  ) {
    errors.push(
      'Payment credentials were detected. Do not submit card numbers, CVV/PIN/OTP values, bank account numbers, or UPI IDs.',
    );
  }

  if (errors.length > 0) {
    return { ...base, valid: false, errors };
  }

  const stored = loadObservations();
  writeStoredArray(FEE_EVIDENCE_STORAGE_KEYS.OBSERVATIONS, [...stored, base]);
  return { ...base, valid: true, errors: [] };
};

/**
 * Moderates a stored observation. Only approved observations are returned by
 * `getModeratedObservations` for public display.
 *
 * @param {string} observationId
 * @param {'approved'|'rejected'|'flagged'} decision
 * @param {string} [moderatorNotes='']
 * @param {{moderatorId?: string}} [options]
 * @returns {{valid: boolean, error?: string, observation?: Object}}
 */
export const moderateCommunityObservation = (
  observationId,
  decision,
  moderatorNotes = '',
  options = {},
) => {
  const validDecisions = [
    COMMUNITY_OBSERVATION_STATUS.APPROVED,
    COMMUNITY_OBSERVATION_STATUS.REJECTED,
    COMMUNITY_OBSERVATION_STATUS.FLAGGED,
  ];

  if (!validDecisions.includes(decision)) {
    return {
      observationId,
      valid: false,
      error: `Invalid decision: ${decision}. Must be one of: ${validDecisions.join(', ')}`,
    };
  }

  const stored = loadObservations();
  const index = stored.findIndex((item) => item.id === observationId);
  if (index === -1) {
    return {
      observationId,
      valid: false,
      error: 'Observation not found. Submission must be stored before moderation.',
    };
  }

  const now = new Date().toISOString();
  const updated = {
    ...stored[index],
    status: decision,
    moderatorNotes: sanitizePlainText(moderatorNotes, {
      max: 500,
      multiline: true,
    }),
    moderatedAt: now,
    moderatedBy: normalizeString(options.moderatorId) || 'moderator',
    updatedAt: now,
    auditTrail: [
      ...(Array.isArray(stored[index].auditTrail)
        ? stored[index].auditTrail
        : []),
      {
        action: `moderation-${decision}`,
        at: now,
        actor: normalizeString(options.moderatorId) || 'moderator',
        reason: sanitizePlainText(moderatorNotes, {
          max: 500,
          multiline: true,
        }),
      },
    ],
  };

  const next = [...stored];
  next[index] = updated;
  writeStoredArray(FEE_EVIDENCE_STORAGE_KEYS.OBSERVATIONS, next);

  return {
    observationId,
    decision,
    moderatorNotes: updated.moderatorNotes,
    moderatedAt: now,
    valid: true,
    observation: publicObservation(updated),
  };
};

/**
 * Returns observations for public display. By default only APPROVED
 * observations are returned. Moderators can request another status explicitly.
 *
 * @param {string} serviceId
 * @param {'approved'|'rejected'|'flagged'|'pending'|null} [statusFilter=null]
 * @returns {Array<Object>} sanitized observations (no userId, no evidence payload)
 */
export const getModeratedObservations = (serviceId, statusFilter = null) => {
  const requestedStatus = statusFilter || COMMUNITY_OBSERVATION_STATUS.APPROVED;
  return loadObservations()
    .filter(
      (observation) =>
        observation?.serviceId === serviceId &&
        observation.status === requestedStatus,
    )
    .sort((left, right) =>
      String(right.createdAt).localeCompare(String(left.createdAt)),
    )
    .map(publicObservation);
};

/**
 * Returns pending observations for a moderator queue.
 */
export const getPendingCommunityObservations = (serviceId = null) =>
  loadObservations()
    .filter(
      (observation) =>
        observation.status === COMMUNITY_OBSERVATION_STATUS.PENDING &&
        (!serviceId || observation.serviceId === serviceId),
    )
    .sort((left, right) =>
      String(right.createdAt).localeCompare(String(left.createdAt)),
    )
    .map(publicObservation);

/**
 * Clears locally stored community observations.
 */
export const resetCommunityObservations = () => {
  inMemoryStore.delete(FEE_EVIDENCE_STORAGE_KEYS.OBSERVATIONS);
  memoryFallbackKeys.delete(FEE_EVIDENCE_STORAGE_KEYS.OBSERVATIONS);
  try {
    const storage = getsBrowserStorage();
    if (storage) storage.removeItem(FEE_EVIDENCE_STORAGE_KEYS.OBSERVATIONS);
  } catch {
    // Non-fatal.
  }
};

/**
 * Clears all local assistant data. Intended for tests and explicit user reset.
 */
export const resetFeeEvidenceAssistantData = () => {
  resetFeeHistory();
  resetCommunityObservations();
};

// ============================================================
// EXPORTS
// ============================================================

export default {
  FEE_VERSION_STATUS,
  FEE_COMPONENT_TYPES,
  COMMUNITY_OBSERVATION_STATUS,
  RECEIPT_REDACTION_DEFAULT,
  FEE_EVIDENCE_STORAGE_KEYS,
  createFeeFingerprint,
  createVersionedFeeRecord,
  createGovernmentFee,
  createPortalCharge,
  createAuthorisedCentreCharge,
  createOptionalServiceCharge,
  validateVersionedFeeRecord,
  getFeeHistory,
  recordFeeVersion,
  getFeeVersion,
  getApplicableFeeVersion,
  getApplicableFeeSchedule,
  listVerifiedServices,
  resetFeeHistory,
  redactReceiptText,
  redactIdentifier,
  createReceiptEvidence,
  correctOcrText,
  detectOcrCorrections,
  inferFeeComponentType,
  parseReceiptText,
  generateDiscrepancyReport,
  getGrievanceRoute,
  containsPaymentCredentials,
  createCommunityFeeObservation,
  moderateCommunityObservation,
  getModeratedObservations,
  getPendingCommunityObservations,
  resetCommunityObservations,
  resetFeeEvidenceAssistantData,
  JURISDICTION_LEVELS,
  JURISDICTION_LEVEL_LABELS,
  INDIAN_STATES_AND_UTS,
};
