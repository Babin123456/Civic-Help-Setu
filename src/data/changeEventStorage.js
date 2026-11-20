// Persistent storage for the Versioned Civic Service Change Feed feature.
// Uses localStorage with fallback to in-memory state.

import { 
  CHANGE_EVENT_SCHEMA_VERSION, 
  CHANGE_REASONS,
  CHANGE_STATUS,
  CHANGE_EFFECTIVE_STATUSES,
  SUBSCRIPTION_FREQUENCIES,
  SUBSCRIPTION_TYPES,
  DELIVERY_STATUS,
  CHANGE_TRANSITIONS,
  validateChangeEvent,
  generateId,
  sanitizeText,
} from './changeEventContract.js';

// Storage keys
const CHANGE_EVENTS_KEY = 'civicbridge_change_events';

// Maximum number of change events to retain (prevent unbounded growth)
const MAX_CHANGE_EVENTS = 1000;
// Maximum number of delivery attempts to retain
const MAX_DELIVERY_ATTEMPTS = 500;

// Initialize storage with schema version tracking
export function initChangeFeedStorage() {
  const existing = loadChangeFeed();
  if (!existing || existing.schemaVersion !== CHANGE_EVENT_SCHEMA_VERSION) {
    const fresh = {
      schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
      changeEvents: [],
      serviceVersions: [],
      userSubscriptions: [],
      deliveryAttempts: [],
      reviewApprovals: [],
    };
    saveChangeFeed(fresh);
    return fresh;
  }
  return existing;
}

// Reset change feed storage (for tests and cleanups)
export function resetChangeFeedStorage() {
  const fresh = {
    schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
    changeEvents: [],
    serviceVersions: [],
    userSubscriptions: [],
    deliveryAttempts: [],
    reviewApprovals: [],
  };
  saveChangeFeed(fresh);
  return fresh;
}

// Load all change feed data from storage
export function loadChangeFeed() {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
        changeEvents: [],
        serviceVersions: [],
        userSubscriptions: [],
        deliveryAttempts: [],
        reviewApprovals: [],
      };
    }
    const raw = localStorage.getItem(CHANGE_EVENTS_KEY);
    if (!raw) return initChangeFeedStorage();
    const parsed = JSON.parse(raw);
    if (!parsed.schemaVersion) {
      parsed.schemaVersion = CHANGE_EVENT_SCHEMA_VERSION;
      saveChangeFeed(parsed);
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load change feed storage', err);
    return {
      schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
      changeEvents: [],
      serviceVersions: [],
      userSubscriptions: [],
      deliveryAttempts: [],
      reviewApprovals: [],
    };
  }
}

// Save change feed data to storage
export function saveChangeFeed(data) {
  try {
    if (typeof localStorage === 'undefined') return true;
    localStorage.setItem(CHANGE_EVENTS_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Failed to save change feed storage', err);
    return false;
  }
}

// --- Change Events ---

/** Append a new change event, truncating if over max */
export function appendChangeEvent(event) {
  const data = loadChangeFeed();
  const now = new Date().toISOString();
  const candidate = {
    ...event,
    changedAt: event.changedAt || now.split('T')[0],
  };

  const validation = validateChangeEvent(candidate);
  if (validation.length > 0) {
    throw new Error(`Invalid change event: ${validation.map(v => v.field + ': ' + v.reason).join('; ')}`);
  }

  const normalizedEvent = {
    id: candidate.id || generateId('change'),
    serviceId: candidate.serviceId,
    changeType: candidate.changeType,
    changeReason: sanitizeText(candidate.changeReason),
    changeTitle: sanitizeText(candidate.changeTitle) || 'Service change',
    effectiveDate: candidate.effectiveDate,
    editorId: candidate.editorId,
    changedAt: candidate.changedAt,
    affectedJurisdictions: candidate.affectedJurisdictions,
    changeMetadata: candidate.changeMetadata || {},
    status: candidate.status || 'pending',
    isMaterial: Boolean(candidate.isMaterial),
    materialityRecommendation: candidate.materialityRecommendation || null,
    delta: candidate.delta || null,
    officialGazetteCitation: sanitizeText(candidate.officialGazetteCitation || ''),
    idempotencyKey: candidate.idempotencyKey || generateId('idemp'),
    schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
  };

  if (data.changeEvents.length >= MAX_CHANGE_EVENTS) {
    data.changeEvents = data.changeEvents.slice(-MAX_CHANGE_EVENTS + 1);
  }
  data.changeEvents.push(normalizedEvent);
  saveChangeFeed(data);
  return normalizedEvent.id;
}

/** Get change events for a specific service */
export function getChangeEventsByService(serviceId, options = {}) {
  const data = loadChangeFeed();
  const { status, limit = Infinity, skip = 0 } = options;
  let events = serviceId ? data.changeEvents.filter(e => e.serviceId === serviceId) : data.changeEvents;

  if (status && status !== 'all') {
    events = events.filter(e => e.status === status);
  }

  events.sort((a, b) => new Date(b.changedAt || 0) - new Date(a.changedAt || 0));
  return events.slice(skip, skip + limit);
}

/** Get change events by status */
export function getChangeEventsByStatus(serviceId, status, options = {}) {
  const data = loadChangeFeed();
  const { limit = Infinity } = options;
  return data.changeEvents
    .filter(e => (!serviceId || e.serviceId === serviceId) && e.status === status)
    .sort((a, b) => new Date(b.changedAt || 0) - new Date(a.changedAt || 0))
    .slice(0, limit);
}

/** Get pending change events */
export function getPendingChangeEvents(options = {}) {
  const data = loadChangeFeed();
  const { limit = Infinity } = options;
  return data.changeEvents
    .filter(e => e.status === 'pending')
    .sort((a, b) => new Date(b.changedAt || 0) - new Date(a.changedAt || 0))
    .slice(0, limit);
}

/** Update change event status */
export function updateChangeEventStatus(eventId, newStatus, reason) {
  const data = loadChangeFeed();
  const event = data.changeEvents.find(e => e.id === eventId);
  if (!event) throw new Error(`Change event ${eventId} not found`);

  const allowed = CHANGE_TRANSITIONS[event.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid transition from ${event.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`);
  }

  event.status = newStatus;
  if (newStatus === 'rejected' && reason) {
    event.rejectionReason = reason;
  }
  saveChangeFeed(data);
  return event;
}

/** Approve a pending change event and create review approval record */
export function approveChangeEvent(eventId, approverId, reason) {
  const data = loadChangeFeed();
  const event = data.changeEvents.find(e => e.id === eventId);
  if (!event) throw new Error(`Change event ${eventId} not found`);

  updateChangeEventStatus(eventId, 'approved', reason);

  const approval = {
    id: generateId('approval'),
    changeEventId: eventId,
    approverId,
    decision: 'approved',
    decidedAt: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  };
  appendReviewApproval(approval);
  return approval;
}

/** Reject a pending change event */
export function rejectChangeEvent(eventId, approverId, reason) {
  const data = loadChangeFeed();
  const event = data.changeEvents.find(e => e.id === eventId);
  if (!event) throw new Error(`Change event ${eventId} not found`);

  updateChangeEventStatus(eventId, 'rejected', reason);

  const approval = {
    id: generateId('approval'),
    changeEventId: eventId,
    approverId,
    decision: 'rejected',
    decidedAt: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  };
  appendReviewApproval(approval);
  return approval;
}

// --- Service Versions ---

/** Append a new service version */
export function appendServiceVersion(version) {
  const data = loadChangeFeed();
  const normalized = {
    id: version.id || generateId('version'),
    serviceId: version.serviceId,
    version: version.version,
    effectiveDate: version.effectiveDate,
    changes: version.changes || [],
    circularNumber: version.circularNumber || '',
    issuingAuthority: version.issuingAuthority || '',
    title: version.title || '',
    guidanceText: version.guidanceText || '',
    requiredDocuments: version.requiredDocuments || [],
    fees: version.fees || [],
    slaDays: version.slaDays ?? null,
    changeType: version.changeType || 'POLICY_CHANGE',
    sourceUrl: version.sourceUrl || '',
    editorId: version.editorId,
    supersedesVersionId: version.supersedesVersionId || null,
    rollbackNotice: version.rollbackNotice || null,
    createdAt: version.createdAt || new Date().toISOString(),
    schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
  };

  if (data.serviceVersions.length >= MAX_CHANGE_EVENTS) {
    data.serviceVersions = data.serviceVersions.slice(-MAX_CHANGE_EVENTS + 1);
  }
  data.serviceVersions.push(normalized);
  saveChangeFeed(data);
  return normalized.id;
}

/** Get service versions for a specific service */
export function getServiceVersions(serviceId, options = {}) {
  const data = loadChangeFeed();
  const { limit = Infinity, skip = 0 } = options;
  return data.serviceVersions
    .filter(v => (!serviceId || v.serviceId === serviceId))
    .sort((a, b) => new Date(b.effectiveDate || 0) - new Date(a.effectiveDate || 0))
    .slice(skip, skip + limit);
}

/** Get the latest version of a service */
export function getLatestServiceVersion(serviceId) {
  const versions = getServiceVersions(serviceId, { limit: 1 });
  return versions.length > 0 ? versions[0] : null;
}

/** Rollback procedure: Never overwrite; publish a superseding version restoring target version */
export function rollbackServiceVersion(serviceId, targetVersionId, reason, authorId) {
  const data = loadChangeFeed();
  const versions = data.serviceVersions.filter(v => v.serviceId === serviceId);
  const target = versions.find(v => v.id === targetVersionId);
  if (!target) throw new Error(`Target version ${targetVersionId} not found for rollback`);

  const latest = getLatestServiceVersion(serviceId);
  const nextVersionNumber = latest ? `v${parseInt((latest.version || 'v1').replace(/\D/g, '') || '1', 10) + 1}.0-restored` : 'v2.0-restored';

  const rollbackVersion = {
    ...target,
    id: generateId('version'),
    version: nextVersionNumber,
    effectiveDate: new Date().toISOString().split('T')[0],
    editorId: authorId,
    supersedesVersionId: latest?.id || null,
    rollbackNotice: {
      rolledBackFrom: latest?.id || 'unknown',
      restoredFrom: targetVersionId,
      reason,
      timestamp: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  appendServiceVersion(rollbackVersion);
  return rollbackVersion;
}

// --- User Subscriptions ---

/** Append a new user subscription */
export function appendSubscription(subscription) {
  const data = loadChangeFeed();
  const normalized = {
    id: subscription.id || generateId('sub'),
    userId: subscription.userId,
    serviceId: subscription.serviceId || '',
    jurisdictionId: subscription.jurisdictionId || '',
    type: subscription.type || 'service',
    frequency: subscription.frequency || 'immediate',
    createdAt: subscription.createdAt || new Date().toISOString(),
    schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
  };

  data.userSubscriptions.push(normalized);
  saveChangeFeed(data);
  return normalized.id;
}

/** Get subscriptions for a user */
export function getSubscriptionsByUser(userId, options = {}) {
  const data = loadChangeFeed();
  const { serviceId, jurisdictionId, type, limit = Infinity } = options;
  let subscriptions = data.userSubscriptions.filter(s => s.userId === userId);

  if (serviceId) {
    subscriptions = subscriptions.filter(s => s.serviceId === serviceId);
  }
  if (jurisdictionId) {
    subscriptions = subscriptions.filter(s => s.jurisdictionId === jurisdictionId);
  }
  if (type) {
    subscriptions = subscriptions.filter(s => s.type === type);
  }

  return subscriptions.slice(0, limit);
}

/** Get subscriptions for a service */
export function getSubscriptionsByService(serviceId, options = {}) {
  const data = loadChangeFeed();
  const { jurisdictionId, limit = Infinity } = options;
  let subscriptions = data.userSubscriptions.filter(s => s.serviceId === serviceId);

  if (jurisdictionId) {
    subscriptions = subscriptions.filter(s => s.jurisdictionId === jurisdictionId);
  }

  return subscriptions.slice(0, limit);
}

/** Update subscription frequency */
export function updateSubscriptionFrequency(subscriptionId, newFrequency) {
  const data = loadChangeFeed();
  const idx = data.userSubscriptions.findIndex(s => s.id === subscriptionId);
  if (idx === -1) throw new Error(`Subscription ${subscriptionId} not found`);

  if (!SUBSCRIPTION_FREQUENCIES[newFrequency]) {
    throw new Error(`Invalid frequency: ${newFrequency}`);
  }

  data.userSubscriptions[idx].frequency = newFrequency;
  saveChangeFeed(data);
  return data.userSubscriptions[idx];
}

/** Remove a subscription */
export function removeSubscription(subscriptionId) {
  const data = loadChangeFeed();
  const idx = data.userSubscriptions.findIndex(s => s.id === subscriptionId);
  if (idx === -1) throw new Error(`Subscription ${subscriptionId} not found`);

  data.userSubscriptions.splice(idx, 1);
  saveChangeFeed(data);
  return true;
}

// --- Delivery Attempts ---

/** Append a new delivery attempt with idempotency */
export function appendDeliveryAttempt(attempt) {
  const data = loadChangeFeed();
  const idempotencyKey = attempt.idempotencyKey || `${attempt.changeEventId}:${attempt.recipientId}:${attempt.deliveryChannel}`;

  // Check existing delivery attempt with same idempotency key
  const existing = data.deliveryAttempts.find(d => d.idempotencyKey === idempotencyKey);
  if (existing) {
    existing.attempts = (existing.attempts || 1) + 1;
    existing.lastAttemptAt = new Date().toISOString();
    existing.status = attempt.status || existing.status;
    saveChangeFeed(data);
    return existing.id;
  }

  const normalized = {
    id: attempt.id || generateId('delivery'),
    idempotencyKey,
    changeEventId: attempt.changeEventId,
    recipientId: attempt.recipientId,
    deliveryChannel: attempt.deliveryChannel,
    status: attempt.status || DELIVERY_STATUS.pending,
    attempts: 1,
    attemptedAt: attempt.attemptedAt || new Date().toISOString(),
    schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
  };

  data.deliveryAttempts.push(normalized);

  if (data.deliveryAttempts.length > MAX_DELIVERY_ATTEMPTS) {
    data.deliveryAttempts = data.deliveryAttempts.slice(-MAX_DELIVERY_ATTEMPTS + 1);
  }
  saveChangeFeed(data);
  return normalized.id;
}

/** Get delivery attempts for a change event */
export function getDeliveryAttemptsByChangeEvent(changeEventId, options = {}) {
  const data = loadChangeFeed();
  const { limit = Infinity } = options;
  return data.deliveryAttempts
    .filter(d => d.changeEventId === changeEventId)
    .sort((a, b) => new Date(b.attemptedAt || 0) - new Date(a.attemptedAt || 0))
    .slice(0, limit);
}

/** Get failed delivery attempts */
export function getFailedDeliveryAttempts(options = {}) {
  const data = loadChangeFeed();
  const { limit = Infinity } = options;
  return data.deliveryAttempts
    .filter(d => d.status === DELIVERY_STATUS.failed)
    .sort((a, b) => new Date(b.attemptedAt || 0) - new Date(a.attemptedAt || 0))
    .slice(0, limit);
}

// --- Review Approvals ---

/** Append a new review approval */
export function appendReviewApproval(approval) {
  const data = loadChangeFeed();
  const normalized = {
    id: approval.id || generateId('approval'),
    changeEventId: approval.changeEventId,
    approverId: approval.approverId,
    decision: approval.decision,
    decidedAt: approval.decidedAt || new Date().toISOString(),
    reason: approval.reason || '',
    schemaVersion: CHANGE_EVENT_SCHEMA_VERSION,
  };

  data.reviewApprovals.push(normalized);
  saveChangeFeed(data);
  return normalized.id;
}

/** Get review approvals for a change event */
export function getReviewApprovalsByChangeEvent(changeEventId, options = {}) {
  const data = loadChangeFeed();
  const { limit = Infinity } = options;
  return data.reviewApprovals
    .filter(a => a.changeEventId === changeEventId)
    .sort((a, b) => new Date(b.decidedAt || 0) - new Date(a.decidedAt || 0))
    .slice(0, limit);
}

/** Get all review approvals */
export function getAllReviewApprovals(options = {}) {
  const data = loadChangeFeed();
  const { limit = Infinity } = options;
  return data.reviewApprovals
    .sort((a, b) => new Date(b.decidedAt || 0) - new Date(a.decidedAt || 0))
    .slice(0, limit);
}

export {
  CHANGE_REASONS,
  CHANGE_STATUS,
  CHANGE_EFFECTIVE_STATUSES,
  SUBSCRIPTION_FREQUENCIES,
  SUBSCRIPTION_TYPES,
  DELIVERY_STATUS,
  CHANGE_TRANSITIONS,
};
