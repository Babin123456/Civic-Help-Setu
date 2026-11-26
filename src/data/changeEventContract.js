// Data contract for change events and service versioning.
// This defines the schema for the Versioned Civic Service Change Feed feature.

import { JURISDICTION_LEVELS, JURISDICTION_LEVEL_LABELS } from './jurisdictions.js';

export const CHANGE_EVENT_SCHEMA_VERSION = 1;
export const SUPPORTED_CHANGE_SCHEMA_VERSIONS = [1];

/** Safe ID generator without external dependency */
export const generateId = (prefix = 'id') => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/** Text sanitizer stripping script tags with contents, all HTML tags, and control characters */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim();
}

// Reasons for change (for audit trail)
export const CHANGE_REASONS = [
  'editorial',
  'policy',
  'regulatory',
  'user_feedback',
  'system_migration',
  'correction',
];

// Allowed types of changes to service records
export const CHANGE_TYPES = [
  'DOCUMENT_SIMPLIFICATION',
  'VALIDITY_UPDATE',
  'PROCEDURE_UPDATE',
  'ELIGIBILITY_UPDATE',
  'POLICY_CHANGE',
  'FEE_SCHEDULE_UPDATE',
  'OFFICIAL_SOURCE_UPDATE',
  'GUIDANCE_UPDATE',
  'CATEGORY_UPDATE',
  'JURISDICTION_UPDATE',
];

// Status of a change event
export const CHANGE_STATUS = [
  'pending',
  'approved',
  'rejected',
  'archived',
];

// Effective date range for a change
export const CHANGE_EFFECTIVE_STATUSES = ['upcoming', 'active', 'expired', 'archived'];

// Allowed transitions for change events
export const CHANGE_TRANSITIONS = {
  pending: ['approved', 'rejected', 'archived'],
  approved: ['archived'],
  rejected: ['pending', 'approved'],
  archived: [],
};

// Notification frequency for subscribed users
export const SUBSCRIPTION_FREQUENCIES = {
  IMMEDIATE: { id: 'immediate', label: 'Immediate Alert' },
  HOURLY: { id: 'hourly', label: 'Hourly Digest' },
  DAILY: { id: 'daily', label: 'Daily Digest' },
  WEEKLY: { id: 'weekly', label: 'Weekly Digest' },
};

// Subscription types
export const SUBSCRIPTION_TYPES = {
  SERVICE: { id: 'service', label: 'Specific Service' },
  JURISDICTION: { id: 'jurisdiction', label: 'Jurisdiction' },
  CATEGORY: { id: 'category', label: 'Service Category' },
};

// Notification delivery status
export const DELIVERY_STATUS = {
  sent: 'sent',
  failed: 'failed',
  deferred: 'deferred',
  pending: 'pending',
};

// Type for ServiceVersion
export function isServiceVersion(v) {
  return Boolean(
    v && typeof v === 'object' && 
    typeof v.serviceId === 'string' && 
    typeof v.version === 'string' &&
    Array.isArray(v.changes) &&
    typeof v.effectiveDate === 'string' &&
    typeof v.editorId === 'string'
  );
}

// Type for ChangeEvent
export function isChangeEvent(e) {
  return Boolean(
    e && typeof e === 'object' &&
    typeof e.id === 'string' &&
    typeof e.serviceId === 'string' &&
    typeof e.changeType === 'string' &&
    typeof e.changeReason === 'string' &&
    typeof e.effectiveDate === 'string' &&
    typeof e.editorId === 'string' &&
    typeof e.changedAt === 'string' &&
    Array.isArray(e.affectedJurisdictions)
  );
}

// Type for Subscription
export function isSubscription(s) {
  return Boolean(
    s && typeof s === 'object' &&
    typeof s.id === 'string' &&
    typeof s.userId === 'string' &&
    typeof s.serviceId === 'string' &&
    typeof s.jurisdictionId === 'string' &&
    typeof s.frequency === 'string'
  );
}

// Type for ReviewApproval
export function isReviewApproval(a) {
  return Boolean(
    a && typeof a === 'object' &&
    typeof a.id === 'string' &&
    typeof a.changeEventId === 'string' &&
    typeof a.approverId === 'string' &&
    typeof a.decision === 'string' &&
    typeof a.decidedAt === 'string'
  );
}

// Type for DeliveryAttempt
export function isDeliveryAttempt(d) {
  return Boolean(
    d && typeof d === 'object' &&
    typeof d.id === 'string' &&
    typeof d.changeEventId === 'string' &&
    typeof d.recipientId === 'string' &&
    typeof d.deliveryChannel === 'string' &&
    typeof d.status === 'string' &&
    typeof d.attemptedAt === 'string'
  );
}

/** Validate jurisdiction item within affectedJurisdictions */
export function validateJurisdiction(j, fail) {
  if (!isObject(j)) {
    fail('jurisdiction', 'must be an object');
    return false;
  }
  if (!j.level || typeof j.level !== 'string') {
    fail('jurisdiction.level', 'is required and must be a string');
    return false;
  }
  if (!JURISDICTION_LEVELS.includes(j.level)) {
    fail('jurisdiction.level', `must be one of: ${JURISDICTION_LEVELS.join(', ')}`);
    return false;
  }
  return true;
}

// Validate a change event payload
export function validateChangeEvent(event) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isObject(event)) {
    fail('(event)', 'must be an object');
    return errors;
  }

  if (!isText(event.serviceId)) fail('serviceId', 'is required and must be a non-empty string');
  if (!CHANGE_TYPES.includes(event.changeType)) fail('changeType', `must be one of: ${CHANGE_TYPES.join(', ')}`);
  if (!isText(event.changeReason)) fail('changeReason', 'is required and must be a non-empty string');
  if (!isRealDate(event.effectiveDate)) fail('effectiveDate', 'must be a real date in YYYY-MM-DD format');
  if (!isText(event.editorId)) fail('editorId', 'is required and must be a non-empty string');
  if (!isRealDate(event.changedAt)) fail('changedAt', 'must be a real date in YYYY-MM-DD format');
  if (!Array.isArray(event.affectedJurisdictions) || event.affectedJurisdictions.length === 0) {
    fail('affectedJurisdictions', 'must be a non-empty array of jurisdiction objects');
  } else {
    event.affectedJurisdictions.forEach((j, i) => {
      if (!isObject(j)) fail(`affectedJurisdictions[${i}]`, 'must be a jurisdiction object');
      else validateJurisdiction(j, fail);
    });
  }
  if (!isText(event.changeTitle)) fail('changeTitle', 'is required and must be a non-empty string');
  if (event.changeMetadata !== undefined && !isObject(event.changeMetadata)) {
    fail('changeMetadata', 'must be an object when present');
  }

  return errors;
}

// Validate a subscription payload
export function validateSubscription(subData) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isText(subData.userId)) fail('userId', 'is required and must be a non-empty string');
  if (!isText(subData.serviceId) && !isText(subData.jurisdictionId)) {
    fail('serviceIdOrJurisdictionId', 'either serviceId or jurisdictionId is required');
  }
  if (isText(subData.serviceId) && !isValidServiceSlug(subData.serviceId)) fail('serviceId', 'must be a valid service slug');
  if (isText(subData.jurisdictionId) && !isValidJurisdictionId(subData.jurisdictionId)) fail('jurisdictionId', 'must be a valid jurisdiction identifier');
  if (!SUBSCRIPTION_FREQUENCIES[subData.frequency]) fail('frequency', `must be one of: ${Object.values(SUBSCRIPTION_FREQUENCIES).map(f => f.id).join(', ')}`);
  if (!SUBSCRIPTION_TYPES[subData.type]) fail('type', `must be one of: ${Object.values(SUBSCRIPTION_TYPES).map(t => t.id).join(', ')}`);

  return errors;
}

// Validate a review approval payload
export function validateReviewApproval(approval) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isText(approval.changeEventId)) fail('changeEventId', 'is required and must be a non-empty string');
  if (!isText(approval.approverId)) fail('approverId', 'is required and must be a non-empty string');
  if (!CHANGE_STATUS.includes(approval.decision)) fail('decision', `must be one of: ${CHANGE_STATUS.join(', ')}`);
  if (!isRealDate(approval.decidedAt)) fail('decidedAt', 'must be a real date in YYYY-MM-DD format');

  return errors;
}

// Validate a delivery attempt payload
export function validateDeliveryAttempt(attempt) {
  const errors = [];
  const fail = (field, reason) => errors.push({ field, reason });

  if (!isText(attempt.changeEventId)) fail('changeEventId', 'is required and must be a non-empty string');
  if (!isText(attempt.recipientId)) fail('recipientId', 'is required and must be a non-empty string');
  if (!DELIVERY_STATUS[attempt.status]) fail('status', `must be one of: ${Object.values(DELIVERY_STATUS).join(', ')}`);
  if (!isText(attempt.deliveryChannel)) fail('deliveryChannel', 'is required and must be a non-empty string');
  if (!isRealDate(attempt.attemptedAt)) fail('attemptedAt', 'must be a real date in YYYY-MM-DD format');

  return errors;
}

// Helper checks
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isRealDate = (value) => {
  if (typeof value !== 'string') return false;
  // Support both YYYY-MM-DD and ISO 8601 strings
  const dateOnly = value.split('T')[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const isValidServiceSlug = (slug) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
const isValidJurisdictionId = (id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);

export {
  JURISDICTION_LEVELS,
  JURISDICTION_LEVEL_LABELS,
  isValidServiceSlug,
  isValidJurisdictionId,
};
