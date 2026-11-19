/**
 * Relief Operations input validation and sanitisation (#747).
 *
 * Every write that crosses the trusted service boundary is validated here:
 * strict enums, lengths, ranges, coordinate formats, date formats, and PII
 * rejection. Client-side checks are a usability layer only and are never trusted.
 */

import {
  RELIEF_ERROR_CODES,
  RELIEF_CATEGORIES,
  RELIEF_DISASTER_TYPES,
  URGENCY_LEVELS,
  INCIDENT_STATUS,
  INCIDENT_TRANSITIONS,
  ALLOCATION_STATUS,
  ALLOCATION_TRANSITIONS,
  DELIVERY_STATUS,
  PARTNER_STATUS,
  RESOURCE_STATUS,
  RELIEF_LIMITS,
} from './reliefOperationsConstants';

export class ReliefServiceError extends Error {
  constructor(code, message, details = null) {
    super(message || code);
    this.name = 'ReliefServiceError';
    this.code = code || RELIEF_ERROR_CODES.VALIDATION_ERROR;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/** Removes script/style blocks, HTML tags, control characters, and trims. */
export const sanitizeText = (text, maxLength = 500) => {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

/** Normalises a jurisdiction code (e.g. "ward-42" → "WARD-42"). */
export const normalizeJurisdictionId = (value, { required = false } = {}) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    if (required) {
      throw new ReliefServiceError(
        RELIEF_ERROR_CODES.VALIDATION_ERROR,
        'A jurisdiction identifier is required.'
      );
    }
    return null;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(raw)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Jurisdiction identifiers must be 2–40 characters using letters, digits, hyphens or underscores.'
    );
  }
  return raw.toUpperCase();
};

// ── PII detection (defence in depth, not a substitute for data minimisation) ──

export const PII_PATTERNS = Object.freeze({
  aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  pan: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i,
  phone: /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
});

/**
 * Returns the list of PII pattern names found in free text. We reject rather
 * than silently strip so the reporter knows their private details were not saved.
 */
export const detectPiiPatterns = (text) => {
  if (typeof text !== 'string' || !text) return [];
  return Object.entries(PII_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
};

const assertNoPii = (text, fieldLabel) => {
  const found = detectPiiPatterns(text);
  if (found.length > 0) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} appears to contain personal identifiers (${found.join(', ')}). Remove them; report only the need, not personal contact details.`
    );
  }
};

export const assertEnum = (value, allowed, fieldLabel) => {
  if (!Object.values(allowed).includes(value)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} must be one of: ${Object.values(allowed).join(', ')}.`
    );
  }
  return value;
};

const assertNumberInRange = (value, min, max, fieldLabel) => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} must be a number between ${min} and ${max}.`
    );
  }
  return num;
};

const assertIsoDate = (value, fieldLabel) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} must be an ISO date string.`
    );
  }
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      `${fieldLabel} must be a valid date.`
    );
  }
  return new Date(time).toISOString();
};

export const validateCoordinates = (coordinates, { required = false } = {}) => {
  if (!coordinates) {
    if (required) {
      throw new ReliefServiceError(
        RELIEF_ERROR_CODES.VALIDATION_ERROR,
        'Coordinates are required for this record.'
      );
    }
    return null;
  }
  if (typeof coordinates !== 'object') {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Coordinates must be an object with numeric lat and lng.'
    );
  }
  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Latitude must be between -90 and 90.'
    );
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Longitude must be between -180 and 180.'
    );
  }
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
};

const assertTransition = (machine, from, to, entityLabel) => {
  const allowed = machine[from] || [];
  if (!allowed.includes(to)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
      `Cannot move ${entityLabel} from "${from}" to "${to}". Allowed next states: ${allowed.join(', ') || 'none'}.`,
      { from, to, allowed }
    );
  }
  return to;
};

// ── Incident ─────────────────────────────────────────────────────────────────

export const validateIncidentInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Incident details are required.');
  }
  const name = sanitizeText(input.name, 120);
  if (name.length < 3) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Incident name must be at least 3 characters.');
  }
  const locality = sanitizeText(input.locality, RELIEF_LIMITS.maxLocalityLength);
  if (locality.length < 2) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Incident locality is required.');
  }
  assertNoPii(`${name} ${locality}`.trim(), 'Incident name or locality');
  return {
    name,
    locality,
    jurisdictionId: normalizeJurisdictionId(input.jurisdictionId, { required: true }),
    disasterType: assertEnum(input.disasterType, RELIEF_DISASTER_TYPES, 'Disaster type'),
    status: input.status ? assertEnum(input.status, INCIDENT_STATUS, 'Incident status') : INCIDENT_STATUS.ACTIVE,
    startedAt: input.startedAt ? assertIsoDate(input.startedAt, 'Incident start') : new Date().toISOString(),
    summary: sanitizeText(input.summary, RELIEF_LIMITS.maxDescriptionLength),
    publicSummary: sanitizeText(input.publicSummary, 500),
    coordinates: validateCoordinates(input.coordinates),
  };
};

export const assertIncidentTransition = (from, to) =>
  assertTransition(INCIDENT_TRANSITIONS, from, to, 'relief incident');

// ── Need report ──────────────────────────────────────────────────────────────

export const validateNeedReportInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Need report details are required.');
  }

  const category = assertEnum(input.category, RELIEF_CATEGORIES, 'Need category');
  const locality = sanitizeText(input.locality, RELIEF_LIMITS.maxLocalityLength);
  if (locality.length < 2) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Locality is required (at least 2 characters).');
  }

  const description = sanitizeText(input.description, RELIEF_LIMITS.maxDescriptionLength);
  if (description.length < 10) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Describe the need in at least 10 characters so responders can act on it.'
    );
  }
  assertNoPii(description, 'Need description');

  const quantity = Math.round(
    assertNumberInRange(input.quantity, 1, RELIEF_LIMITS.maxNeedQuantity, 'Requested quantity')
  );
  const peopleAffected = Math.round(
    assertNumberInRange(input.peopleAffected, 1, RELIEF_LIMITS.maxPeopleAffected, 'People affected')
  );

  const urgency = input.urgency
    ? assertEnum(input.urgency, URGENCY_LEVELS, 'Urgency')
    : URGENCY_LEVELS.MODERATE;

  const jurisdictionId = normalizeJurisdictionId(input.jurisdictionId, { required: true });
  const reporterRef = sanitizeText(input.reporterRef, 64);
  if (reporterRef) {
    assertNoPii(reporterRef, 'Reporter reference');
  }

  return {
    category,
    locality,
    jurisdictionId,
    description,
    quantity,
    peopleAffected,
    urgency,
    incidentId: input.incidentId ? sanitizeText(input.incidentId, 60) : null,
    siteId: input.siteId ? sanitizeText(input.siteId, 60) : null,
    coordinates: validateCoordinates(input.coordinates),
    reporterRef: reporterRef || null,
    reporterType: ['citizen', 'partner', 'field_team'].includes(input.reporterType)
      ? input.reporterType
      : 'citizen',
    partnerId: input.partnerId ? sanitizeText(input.partnerId, 60) : null,
    idempotencyKey: input.idempotencyKey ? sanitizeText(input.idempotencyKey, 80) : null,
    dedupeFingerprint: input.dedupeFingerprint ? sanitizeText(input.dedupeFingerprint, 120) : null,
  };
};

// ── Resource stock ───────────────────────────────────────────────────────────

export const validateResourceInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Resource details are required.');
  }
  const name = sanitizeText(input.name, 120);
  if (name.length < 3) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Resource name must be at least 3 characters.');
  }
  const batchRef = sanitizeText(input.batchRef, 60);
  return {
    name,
    category: assertEnum(input.category, RELIEF_CATEGORIES, 'Resource category'),
    unit: sanitizeText(input.unit, 24) || 'unit',
    jurisdictionId: normalizeJurisdictionId(input.jurisdictionId, { required: true }),
    siteId: input.siteId ? sanitizeText(input.siteId, 60) : null,
    batchRef: batchRef || null,
    quantityOnHand: Math.round(
      assertNumberInRange(input.quantityOnHand, 0, 1000000, 'Quantity on hand')
    ),
    quantityReserved: Math.round(
      assertNumberInRange(input.quantityReserved ?? 0, 0, 1000000, 'Quantity reserved')
    ),
    expiresAt: input.expiresAt ? assertIsoDate(input.expiresAt, 'Expiry date') : null,
    status: input.status
      ? assertEnum(input.status, RESOURCE_STATUS, 'Resource status')
      : RESOURCE_STATUS.AVAILABLE,
    donationSource: sanitizeText(input.donationSource, 120),
  };
};

export const validateSiteInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Distribution site details are required.');
  }
  const name = sanitizeText(input.name, 120);
  if (name.length < 3) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Site name must be at least 3 characters.');
  }
  const address = sanitizeText(input.address, 240);
  if (address.length < 5) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Site address must be at least 5 characters.');
  }
  assertNoPii(`${name} ${address}`, 'Site name or address');
  return {
    name,
    address,
    locality: sanitizeText(input.locality, RELIEF_LIMITS.maxLocalityLength),
    jurisdictionId: normalizeJurisdictionId(input.jurisdictionId, { required: true }),
    coordinates: validateCoordinates(input.coordinates),
    capacityPerDay: Math.round(assertNumberInRange(input.capacityPerDay ?? 100, 1, 100000, 'Daily capacity')),
    publicContactRole: sanitizeText(input.publicContactRole, 80) || 'Site coordinator',
    isPublic: input.isPublic !== false,
  };
};

// ── Allocation proposal ──────────────────────────────────────────────────────

export const validateAllocationProposalInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Allocation proposal details are required.');
  }
  const needId = sanitizeText(input.needId, 60);
  if (!needId) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'A need report must be selected.');
  }
  const resourceId = sanitizeText(input.resourceId, 60);
  if (!resourceId) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'A resource stock item must be selected.');
  }
  const quantity = Math.round(
    assertNumberInRange(input.quantity, 1, RELIEF_LIMITS.maxNeedQuantity, 'Allocation quantity')
  );
  const siteId = input.siteId ? sanitizeText(input.siteId, 60) : null;
  const category = assertEnum(input.category, RELIEF_CATEGORIES, 'Allocation category');

  let recommendation = null;
  if (input.recommendation && typeof input.recommendation === 'object') {
    const decision = sanitizeText(input.recommendation.decision, 20);
    if (!['accepted', 'edited', 'rejected'].includes(decision)) {
      throw new ReliefServiceError(
        RELIEF_ERROR_CODES.VALIDATION_ERROR,
        'Recommendation decision must be accepted, edited or rejected.'
      );
    }
    recommendation = {
      recommendationId: sanitizeText(input.recommendation.recommendationId, 80),
      modelVersion: sanitizeText(input.recommendation.modelVersion, 80),
      decision,
      recommendedQuantity: input.recommendation.recommendedQuantity
        ? Math.round(Number(input.recommendation.recommendedQuantity))
        : null,
      operatorNote: sanitizeText(input.recommendation.operatorNote, RELIEF_LIMITS.maxNotesLength),
      executedAt: input.recommendation.executedAt
        ? assertIsoDate(input.recommendation.executedAt, 'Recommendation execution time')
        : null,
    };
  }

  return {
    needId,
    resourceId,
    quantity,
    siteId,
    category,
    recommendation,
    operatorNote: sanitizeText(input.operatorNote, RELIEF_LIMITS.maxNotesLength),
    idempotencyKey: input.idempotencyKey ? sanitizeText(input.idempotencyKey, 80) : null,
  };
};

export const validateDecisionInput = (input = {}, { requireReason = false } = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'A decision payload is required.');
  }
  const decision = sanitizeText(input.decision, 30);
  if (!['approve', 'reject'].includes(decision)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Decision must be "approve" or "reject".'
    );
  }
  const reason = sanitizeText(input.reason, RELIEF_LIMITS.maxReasonLength);
  if ((requireReason || decision === 'reject') && reason.length < 5) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'A reason of at least 5 characters is required for this decision.'
    );
  }
  assertNoPii(reason, 'Decision reason');
  return { decision, reason };
};

export const validateDispatchInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Dispatch details are required.');
  }
  const teamName = sanitizeText(input.teamName, RELIEF_LIMITS.maxTeamNameLength);
  if (teamName.length < 3) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'A delivery team name is required.');
  }
  const vehicleRef = sanitizeText(input.vehicleRef, RELIEF_LIMITS.maxVehicleRefLength);
  assertNoPii(`${teamName} ${vehicleRef}`.trim(), 'Team or vehicle reference');
  return {
    teamName,
    vehicleRef: vehicleRef || null,
    siteId: input.siteId ? sanitizeText(input.siteId, 60) : null,
    notes: sanitizeText(input.notes, RELIEF_LIMITS.maxNotesLength),
    idempotencyKey: input.idempotencyKey ? sanitizeText(input.idempotencyKey, 80) : null,
  };
};

export const validateDeliveryConfirmationInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Delivery confirmation details are required.');
  }
  const deliveredQuantity = Math.round(
    assertNumberInRange(input.deliveredQuantity, 0, RELIEF_LIMITS.maxNeedQuantity, 'Delivered quantity')
  );
  const receivedByRole = sanitizeText(input.receivedByRole, 80);
  if (!receivedByRole) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Record the receiving role (for example "Shelter coordinator"), not a personal name.'
    );
  }
  assertNoPii(receivedByRole, 'Receiving role');
  const note = sanitizeText(input.note, RELIEF_LIMITS.maxNotesLength);
  assertNoPii(note, 'Delivery note');
  return {
    deliveredQuantity,
    receivedByRole,
    note,
    confirmedAt: input.confirmedAt
      ? assertIsoDate(input.confirmedAt, 'Confirmation time')
      : new Date().toISOString(),
    idempotencyKey: input.idempotencyKey ? sanitizeText(input.idempotencyKey, 80) : null,
  };
};

export const validatePartnerInput = (input = {}) => {
  if (!input || typeof input !== 'object') {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Partner verification details are required.');
  }
  const organisationName = sanitizeText(input.organisationName, 120);
  if (organisationName.length < 3) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Organisation name is required.');
  }
  return {
    organisationName,
    jurisdictionId: normalizeJurisdictionId(input.jurisdictionId, { required: true }),
    registrationRef: sanitizeText(input.registrationRef, 80),
    status: input.status ? assertEnum(input.status, PARTNER_STATUS, 'Partner status') : PARTNER_STATUS.PENDING,
    verificationNote: sanitizeText(input.verificationNote, RELIEF_LIMITS.maxNotesLength),
  };
};

// ── Listing helpers ──────────────────────────────────────────────────────────

export const validatePagination = ({ page = 1, pageSize = RELIEF_LIMITS.defaultPageSize } = {}) => {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeSize = Math.min(
    RELIEF_LIMITS.maxPageSize,
    Math.max(1, Math.floor(Number(pageSize) || RELIEF_LIMITS.defaultPageSize))
  );
  return { page: safePage, pageSize: safeSize };
};

export const paginate = (items = [], pagination = {}) => {
  const { page, pageSize } = validatePagination(pagination);
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};

/** Re-exported so callers do not need to import the transition constants twice. */
export const assertStateTransition = (machine, from, to, entityLabel) =>
  assertTransition(machine, from, to, entityLabel);

export const assertAllocationTransition = (from, to) =>
  assertTransition(ALLOCATION_TRANSITIONS, from, to, 'allocation proposal');

export const ALLOWED_DECISIONS = Object.freeze(['approve', 'reject']);
export const ALLOWED_DELIVERY_STATUSES = Object.values(DELIVERY_STATUS);
export const ALLOWED_ALLOCATION_STATUSES = Object.values(ALLOCATION_STATUS);
export const ALLOWED_PARTNER_STATUSES = Object.values(PARTNER_STATUS);
