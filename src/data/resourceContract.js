// Resource category enumeration for the Neighbourhood Resource Exchange
export const ITEM_CATEGORIES = [
  'book',
  'mobility_aid',
  'tool',
  'emergency_supply',
  'baby_gear',
  'other',
];

export const ITEM_CONDITIONS = [
  'like_new',
  'good',
  'fair',
  'poor',
];

export const AVAILABILITY_WINDOWS = [
  'within_24_hours',
  'within_3_days',
  'within_1_week',
  'within_2_weeks',
  'flexible',
];

export const REQUEST_STATES = [
  'pending',
  'accepted',
  'handover_completed',
  'rejected',
  'expired',
];

export const HANDOVER_STATES = [
  'pending',
  'confirmed',
  'completed',
];

export const MODERATION_FLAGS_TYPES = [
  'prohibited_item',
  'spam',
  'inaccurate',
  'unsafe',
  'other',
];

export const RESOURCE_LISTING_STATES = [
  'active',
  'expired',
  'closed',
  'moderation_pending',
];

export const SCHEMA_VERSION = 2;

// Validation helpers
export const isValidCategory = (v) => typeof v === 'string' && ITEM_CATEGORIES.includes(v);
export const isValidCondition = (v) => typeof v === 'string' && ITEM_CONDITIONS.includes(v);
export const isValidAvailabilityWindow = (v) => typeof v === 'string' && AVAILABILITY_WINDOWS.includes(v);
export const isValidRequestState = (v) => typeof v === 'string' && REQUEST_STATES.includes(v);
export const isValidHandoverState = (v) => typeof v === 'string' && HANDOVER_STATES.includes(v);
export const isValidModerationFlagType = (v) => typeof v === 'string' && MODERATION_FLAGS_TYPES.includes(v);
export const isValidResourceListingState = (v) => typeof v === 'string' && RESOURCE_LISTING_STATES.includes(v);
export const isValidSchemaVersion = (v) => v === SCHEMA_VERSION || v === String(SCHEMA_VERSION);

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isTextList = (v) => Array.isArray(v) && v.every(isText);

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

// Core domain entity: ResourceListing
export function validateResourceListing(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  // Forbidden fields scan
  const FORBIDDEN_FIELDS = [
    'userId', 'email', 'phone', 'password', 'token', 'aadhaarNumber', 'aadhaar',
    'panNumber', 'documentUrl', 'profile', 'address',
  ];
  function scanForbidden(node, path) {
    if (Array.isArray(node)) {
      node.forEach((item, i) => scanForbidden(item, `${path}[${i}]`));
      return;
    }
    if (!isObject(node)) return;
    for (const [key, child] of Object.entries(node)) {
      const where = path ? `${path}.${key}` : key;
      if (FORBIDDEN_FIELDS.includes(key)) fail(where, 'personal or sensitive data is not allowed');
      else scanForbidden(child, where);
    }
  }
  scanForbidden(record, '');

  if (!isText(record.id)) fail('id', 'is required and must be a non-empty string');
  if (!isText(record.title)) fail('title', 'is required and must be a non-empty string');
  if (!isValidCategory(record.category)) fail('category', `must be one of: ${ITEM_CATEGORIES.join(', ')}`);
  if (!isText(record.description)) fail('description', 'is required and must be a non-empty string');
  if (!isValidCondition(record.condition)) fail('condition', `must be one of: ${ITEM_CONDITIONS.join(', ')}`);
  if (!isValidAvailabilityWindow(record.availabilityWindow)) fail('availabilityWindow', `must be one of: ${AVAILABILITY_WINDOWS.join(', ')}`);
  if (!isText(record.pickupArea)) fail('pickupArea', 'is required and must be a non-empty string');
  if (!isText(record.expiresAt)) fail('expiresAt', 'is required and must be a valid date');
  if (!isText(record.state)) fail('state', `must be one of: ${RESOURCE_LISTING_STATES.join(', ')}`);
  if (!isText(record.createdBy)) fail('createdBy', 'is required and must be a non-empty string');
  if (!isValidSchemaVersion(record.schemaVersion)) fail('schemaVersion', `must be ${SCHEMA_VERSION}`);

  // Validate timestamps
  const createdAt = record.createdAt ? new Date(record.createdAt) : null;
  const expiresAt = record.expiresAt ? new Date(record.expiresAt) : null;
  if (createdAt && isNaN(createdAt.getTime())) fail('createdAt', 'must be a valid date');
  if (expiresAt && isNaN(expiresAt.getTime())) fail('expiresAt', 'must be a valid date');
  if (createdAt && expiresAt && !isNaN(createdAt.getTime()) && !isNaN(expiresAt.getTime()) && expiresAt <= createdAt) {
    fail('expiresAt', 'must be after createdAt');
  }

  return errors;
}

// Core domain entity: ExchangeRequest
export function validateExchangeRequest(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  const FORBIDDEN_FIELDS = [
    'userId', 'email', 'phone', 'password', 'token', 'aadhaarNumber', 'aadhaar',
    'panNumber', 'documentUrl', 'profile', 'address',
  ];
  function scanForbidden(node, path) {
    if (Array.isArray(node)) {
      node.forEach((item, i) => scanForbidden(item, `${path}[${i}]`));
      return;
    }
    if (!isObject(node)) return;
    for (const [key, child] of Object.entries(node)) {
      const where = path ? `${path}.${key}` : key;
      if (FORBIDDEN_FIELDS.includes(key)) fail(where, 'personal or sensitive data is not allowed');
      else scanForbidden(child, where);
    }
  }
  scanForbidden(record, '');

  if (!isText(record.id)) fail('id', 'is required and must be a non-empty string');
  if (!isText(record.listingId)) fail('listingId', 'is required and must reference a ResourceListing');
  if (!isText(record.requesterId)) fail('requesterId', 'is required and must be a non-empty string');
  if (record.responderId && !isText(record.responderId)) fail('responderId', 'must be a non-empty string');
  if (!isValidRequestState(record.state)) fail('state', `must be one of: ${REQUEST_STATES.join(', ')}`);
  if (!isText(record.handoverLocation)) fail('handoverLocation', 'is required and must be a non-empty string');
  if (!isText(record.handoverWindow)) fail('handoverWindow', 'is required and must be a non-empty string');
  if (!isText(record.statusMessage)) fail('statusMessage', 'is required and must be a non-empty string');
  if (!isValidSchemaVersion(record.schemaVersion)) fail('schemaVersion', `must be ${SCHEMA_VERSION}`);

  return errors;
}

// Core domain entity: HandoverConfirmation
export function validateHandoverConfirmation(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  const FORBIDDEN_FIELDS = [
    'userId', 'email', 'phone', 'password', 'token', 'aadhaarNumber', 'aadhaar',
    'panNumber', 'documentUrl', 'profile', 'address',
  ];
  function scanForbidden(node, path) {
    if (Array.isArray(node)) {
      node.forEach((item, i) => scanForbidden(item, `${path}[${i}]`));
      return;
    }
    if (!isObject(node)) return;
    for (const [key, child] of Object.entries(node)) {
      const where = path ? `${path}.${key}` : key;
      if (FORBIDDEN_FIELDS.includes(key)) fail(where, 'personal or sensitive data is not allowed');
      else scanForbidden(child, where);
    }
  }
  scanForbidden(record, '');

  if (!isText(record.id)) fail('id', 'is required and must be a non-empty string');
  if (!isText(record.exchangeRequestId)) fail('exchangeRequestId', 'is required and must reference an ExchangeRequest');
  if (!isText(record.confirmerId)) fail('confirmerId', 'is required and must be a non-empty string');
  if (!isText(record.handoverLocation)) fail('handoverLocation', 'is required and must be a non-empty string');
  if (!isText(record.confirmedAt)) fail('confirmedAt', 'is required and must be a valid date');
  if (!isValidHandoverState(record.state)) fail('state', `must be one of: ${HANDOVER_STATES.join(', ')}`);
  if (!isValidSchemaVersion(record.schemaVersion)) fail('schemaVersion', `must be ${SCHEMA_VERSION}`);

  return errors;
}

// Core domain entity: ModerationFlag
export function validateModerationFlag(record) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(record)) {
    fail('(record)', 'must be an object');
    return errors;
  }

  const FORBIDDEN_FIELDS = [
    'userId', 'email', 'phone', 'password', 'token', 'aadhaarNumber', 'aadhaar',
    'panNumber', 'documentUrl', 'profile', 'address',
  ];
  function scanForbidden(node, path) {
    if (Array.isArray(node)) {
      node.forEach((item, i) => scanForbidden(item, `${path}[${i}]`));
      return;
    }
    if (!isObject(node)) return;
    for (const [key, child] of Object.entries(node)) {
      const where = path ? `${path}.${key}` : key;
      if (FORBIDDEN_FIELDS.includes(key)) fail(where, 'personal or sensitive data is not allowed');
      else scanForbidden(child, where);
    }
  }
  scanForbidden(record, '');

  const listingId = record.resourceListingId || record.listingId;
  const flagType = record.type || record.flagType;
  if (!isText(record.id)) fail('id', 'is required and must be a non-empty string');
  if (!isText(listingId)) fail('resourceListingId', 'is required and must reference a ResourceListing');
  if (!isValidModerationFlagType(flagType)) fail('type', `must be one of: ${MODERATION_FLAGS_TYPES.join(', ')}`);
  if (!isText(record.reason)) fail('reason', 'is required and must be a non-empty string');
  if (!isValidSchemaVersion(record.schemaVersion)) fail('schemaVersion', `must be ${SCHEMA_VERSION}`);

  return errors;
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Schema validation for catalogue envelope
export function validateResourceCatalogue(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (![SCHEMA_VERSION].includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: [${SCHEMA_VERSION}]`,
    });
    return { valid: false, errors };
  }
  if (!Array.isArray(envelope.resourceListings)) {
    errors.push({ serviceId: null, field: 'resourceListings', reason: 'must be an array of resource listings' });
    return { valid: false, errors };
  }
  envelope.resourceListings.forEach((record, index) => {
    const serviceId = isObject(record) && isText(record.id) ? record.id : `#${index}`;
    for (const e of validateResourceListing(record)) errors.push({ serviceId, ...e });
  });
  return { valid: errors.length === 0, errors };
}

// Schema validation for exchange requests catalogue envelope
export function validateExchangeCatalogue(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (![SCHEMA_VERSION].includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: [${SCHEMA_VERSION}]`,
    });
    return { valid: false, errors };
  }
  if (!Array.isArray(envelope.exchangeRequests)) {
    errors.push({ serviceId: null, field: 'exchangeRequests', reason: 'must be an array of exchange requests' });
    return { valid: false, errors };
  }
  envelope.exchangeRequests.forEach((record, index) => {
    const serviceId = isObject(record) && isText(record.id) ? record.id : `#${index}`;
    for (const e of validateExchangeRequest(record)) errors.push({ serviceId, ...e });
  });
  return { valid: errors.length === 0, errors };
}

// Schema validation for handover confirmations catalogue envelope
export function validateHandoverCatalogue(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (![SCHEMA_VERSION].includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: [${SCHEMA_VERSION}]`,
    });
    return { valid: false, errors };
  }
  if (!Array.isArray(envelope.handoverConfirmations)) {
    errors.push({ serviceId: null, field: 'handoverConfirmations', reason: 'must be an array of handover confirmations' });
    return { valid: false, errors };
  }
  envelope.handoverConfirmations.forEach((record, index) => {
    const serviceId = isObject(record) && isText(record.id) ? record.id : `#${index}`;
    for (const e of validateHandoverConfirmation(record)) errors.push({ serviceId, ...e });
  });
  return { valid: errors.length === 0, errors };
}

// Schema validation for moderation flags catalogue envelope
export function validateModerationCatalogue(envelope) {
  const errors = [];
  const version = envelope?.schemaVersion;
  if (![SCHEMA_VERSION].includes(version)) {
    errors.push({
      serviceId: null,
      field: 'schemaVersion',
      reason: `unsupported schema version ${JSON.stringify(version)}; supported versions: [${SCHEMA_VERSION}]`,
    });
    return { valid: false, errors };
  }
  if (!Array.isArray(envelope.moderationFlags)) {
    errors.push({ serviceId: null, field: 'moderationFlags', reason: 'must be an array of moderation flags' });
    return { valid: false, errors };
  }
  envelope.moderationFlags.forEach((record, index) => {
    const serviceId = isObject(record) && isText(record.id) ? record.id : `#${index}`;
    for (const e of validateModerationFlag(record)) errors.push({ serviceId, ...e });
  });
  return { valid: errors.length === 0, errors };
}

/** One-line human readable form of an error, e.g. for logs. */
export const formatContractError = (e) => `${e.serviceId ? `${e.serviceId}: ` : ''}${e.field} ${e.reason}`;