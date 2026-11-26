/**
 * Process-local civic event staging and dispatch prototype.
 *
 * Versioned admission uses the repository-reviewed event registry. Existing
 * 1.0.0 releases preserve legacy JSON behavior; typed releases are explicit opt-ins.
 * Maps, retry logs and replay audit are volatile: this module does not atomically
 * commit domain state, authenticate callers or provide a durable database outbox.
 * Producer/consumer ownership fields are declarations, not authorization proofs.
 * See docs/CIVIC_EVENT_CONTRACTS.md for migration, limits and operator recovery.
 */

import registry from '../data/contracts/registry.json';
import {
  CIVIC_EVENT_TYPE,
  assertEventContract,
  canonicalEventValue,
  consumerContractVersions,
} from '../data/contracts/eventCompatibility.js';

export { CIVIC_EVENT_TYPE };
const eventContracts = structuredClone(registry.events);
let contractRejectedCount = 0;
let consumerContractFailureCount = 0;

export const OUTBOX_STATUS = {
  PENDING_DELIVERY: 'PENDING_DELIVERY',
  DISPATCHING: 'DISPATCHING',
  DELIVERED: 'DELIVERED',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  DEAD_LETTERED: 'DEAD_LETTERED',
};

export const EVENT_BUS_STATE = {
  IDLE: 'IDLE',
  PROCESSING: 'PROCESSING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  EMPTY: 'EMPTY',
};

export const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialBackoffMs: 100,
  backoffMultiplier: 2,
};

// Volatile, process-local stores; restarting loses staged events and execution logs.
const outboxStore = new Map();
const deadLetterStore = new Map();
const consumerRegistry = new Map();
const consumerExecutionLogs = new Map();
const administrativeAuditLog = [];

/**
 * Scrubs sensitive citizen PII from event payloads, keeping scoped tokens.
 *
 * @param {Object} payload
 * @returns {Object} Sanitized payload
 */
export function sanitizeEventPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};

  const sanitized = JSON.parse(JSON.stringify(payload));

  // Scrub direct identifiers
  if (sanitized.applicantName) sanitized.applicantName = 'CITIZEN_REDACTED';
  if (sanitized.phone) sanitized.phone = 'XXXXXX_REDACTED';
  if (sanitized.email) sanitized.email = 'REDACTED@DOMAIN.LOCAL';
  if (sanitized.aadhaarNumber) sanitized.aadhaarNumber = 'XXXX-XXXX-REDACTED';
  if (sanitized.panNumber) sanitized.panNumber = 'XXXXX_REDACTED';
  if (sanitized.authTokens) delete sanitized.authTokens;

  return sanitized;
}

/**
 * Stages a domain event in the transactional outbox with idempotency protection.
 *
 * @param {Object} input
 * @returns {Object} Staged outbox event
 */
export function stageOutboxEvent(input = {}) {
  const {
    eventType,
    aggregateId,
    producerDomain = 'CIVIC_CORE',
    schemaVersion = '1.0.0',
    idempotencyKey,
    payload = {},
    metadata = {},
    tenantId = 'DEFAULT_TENANT',
  } = input;

  if (typeof eventType !== 'string' || !Object.hasOwn(CIVIC_EVENT_TYPE, eventType)) {
    throw new Error(`Invalid or unsupported eventType: '${eventType}'`);
  }

  if (!aggregateId || typeof aggregateId !== 'string') {
    throw new Error('Valid aggregateId is required for event staging');
  }

  // Validate admission before duplicate lookup, so retry keys cannot bypass a contract.
  let sanitizedPayload;
  try {
    sanitizedPayload = sanitizeEventPayload(payload);
    assertEventContract(eventContracts, eventType, schemaVersion, producerDomain, sanitizedPayload);
    for (const consumer of consumerRegistry.values()) {
      if (!consumer.enabled || (consumer.tenantScope && consumer.tenantScope !== tenantId) || !consumer.eventTypes.includes(eventType)) continue;
      if (!consumer.contractVersions[eventType].includes(schemaVersion)) throw new Error(`Consumer '${consumer.consumerId}' does not accept ${eventType}@${schemaVersion}; migrate it before publishing`);
    }
  } catch (error) {
    contractRejectedCount += 1;
    throw error;
  }

  if (idempotencyKey) {
    for (const existing of outboxStore.values()) {
      if (existing.idempotencyKey !== idempotencyKey || existing.tenantId !== tenantId || existing.producerDomain !== producerDomain) continue;
      if (existing.eventType !== eventType || existing.schemaVersion !== schemaVersion || existing.aggregateId !== aggregateId || canonicalEventValue(existing.payload) !== canonicalEventValue(sanitizedPayload)) throw new Error('Idempotency key conflicts with the admitted event contract or payload');
      return existing;
    }
  }

  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const outboxEntry = {
    eventId,
    eventType,
    schemaVersion,
    aggregateId,
    producerDomain,
    tenantId,
    idempotencyKey: idempotencyKey || `idemp_${eventId}`,
    payload: sanitizedPayload,
    metadata: {
      correlationId: metadata.correlationId || `corr_${eventId}`,
      causationId: metadata.causationId || null,
      jurisdiction: metadata.jurisdiction || 'CENTRAL',
      ...metadata,
    },
    status: OUTBOX_STATUS.PENDING_DELIVERY,
    deliveryAttempts: 0,
    maxAttempts: input.maxAttempts || DEFAULT_RETRY_CONFIG.maxAttempts,
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
    occurredAt: new Date().toISOString(),
    deliveredAt: null,
  };

  outboxStore.set(eventId, outboxEntry);
  return outboxEntry;
}

/**
 * Registers a domain consumer for specified event types.
 *
 * @param {string} consumerId Unique identifier for consumer service
 * @param {Array<string>} eventTypes List of CIVIC_EVENT_TYPE strings
 * @param {Function} handlerFn Async or sync processing function: (event) => Promise<void>
 * @param {Object} [options] Consumer configuration
 */
export function registerEventConsumer(consumerId, eventTypes, handlerFn, options = {}) {
  if (!consumerId || typeof consumerId !== 'string') {
    throw new Error('Valid consumerId is required');
  }

  if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
    throw new Error('eventTypes must be a non-empty array of CIVIC_EVENT_TYPE strings');
  }

  if (typeof handlerFn !== 'function') {
    throw new Error('handlerFn must be a valid executable function');
  }

  if (new Set(eventTypes).size !== eventTypes.length || eventTypes.some(type => !Object.hasOwn(CIVIC_EVENT_TYPE, type))) throw new Error('Consumer subscriptions contain unknown or duplicate event types');
  const declared = eventContracts.consumers.find(row => row.id === consumerId);
  if (declared?.status === 'retired') throw new Error('Consumer is retired in the repository inventory');
  if (declared && canonicalEventValue([...eventTypes].sort()) !== canonicalEventValue([...declared.eventTypes].sort())) throw new Error('Consumer subscriptions differ from the repository inventory');
  const contractVersions = consumerContractVersions(eventContracts, eventTypes, options.contractVersions ?? declared?.contractVersions);
  if (declared && canonicalEventValue(contractVersions) !== canonicalEventValue(consumerContractVersions(eventContracts, eventTypes, declared.contractVersions))) throw new Error('Consumer versions differ from the repository inventory');
  consumerRegistry.set(consumerId, {
    consumerId,
    eventTypes: [...eventTypes],
    handlerFn,
    tenantScope: options.tenantScope || null,
    enabled: options.enabled !== false,
    contractVersions,
    owner: declared?.owner ?? options.owner ?? null,
    declared: Boolean(declared),
  });
}

/**
 * Unregisters an event consumer.
 *
 * @param {string} consumerId
 * @returns {boolean}
 */
export function unregisterEventConsumer(consumerId) {
  return consumerRegistry.delete(consumerId);
}

/**
 * Dispatches pending outbox events to registered consumers.
 * Handles retries, backoff, offset isolation, and DLQ routing.
 *
 * @param {Object} [options]
 * @returns {Promise<Object>} Dispatch summary
 */
export async function dispatchPendingOutboxEvents(options = {}) {
  const { batchSize = 10, targetEventId } = options;
  const now = new Date();

  // Find eligible events
  const pendingEvents = [];
  for (const event of outboxStore.values()) {
    if (targetEventId && event.eventId !== targetEventId) continue;

    const isPending =
      event.status === OUTBOX_STATUS.PENDING_DELIVERY ||
      (event.status === OUTBOX_STATUS.FAILED_RETRYABLE && new Date(event.nextAttemptAt) <= now);

    if (isPending) {
      // Reserve the whole batch before the first await; concurrent dispatchers cannot share it.
      event.status = OUTBOX_STATUS.DISPATCHING;
      event.deliveryAttempts += 1;
      pendingEvents.push(event);
      if (pendingEvents.length >= batchSize) break;
    }
  }

  if (pendingEvents.length === 0) {
    return {
      status: EVENT_BUS_STATE.EMPTY,
      dispatchedCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      deadLetterCount: 0,
    };
  }

  let deliveredCount = 0;
  let failedCount = 0;
  let deadLetterCount = 0;

  for (const event of pendingEvents) {
    // Identify consumers for this event
    const applicableConsumers = [];
    for (const consumer of consumerRegistry.values()) {
      if (!consumer.enabled) continue;
      if (consumer.tenantScope && consumer.tenantScope !== event.tenantId) continue;
      if (consumer.eventTypes.includes(event.eventType)) {
        applicableConsumers.push(consumer);
      }
    }

    let allConsumersSucceeded = true;
    let latestFailureError = null;

    for (const consumer of applicableConsumers) {
      const execKey = `${consumer.consumerId}:${event.eventId}`;

      // Idempotent consumer check: skip if already successfully executed
      if (consumerExecutionLogs.has(execKey)) {
        continue;
      }

      try {
        if (!consumer.contractVersions[event.eventType].includes(event.schemaVersion)) {
          consumerContractFailureCount += 1;
          throw new Error(`Consumer '${consumer.consumerId}' no longer accepts the admitted contract`);
        }
        await consumer.handlerFn(event);
        consumerExecutionLogs.set(execKey, {
          consumerId: consumer.consumerId,
          eventId: event.eventId,
          completedAt: new Date().toISOString(),
          status: 'SUCCESS',
        });
      } catch (err) {
        allConsumersSucceeded = false;
        latestFailureError = err.message || 'Consumer invocation failed';
        break; // Stop downstream processing for this event on error
      }
    }

    if (allConsumersSucceeded) {
      event.status = OUTBOX_STATUS.DELIVERED;
      event.deliveredAt = new Date().toISOString();
      event.lastError = null;
      deliveredCount += 1;
    } else {
      event.lastError = latestFailureError;
      failedCount += 1;

      if (event.deliveryAttempts >= event.maxAttempts) {
        // Route to Dead Letter Queue (DLQ)
        event.status = OUTBOX_STATUS.DEAD_LETTERED;
        deadLetterCount += 1;

        const deadLetterEntry = {
          deadLetterId: `dlq_${event.eventId}`,
          originalEvent: JSON.parse(JSON.stringify(event)),
          failedAt: new Date().toISOString(),
          failureReason: latestFailureError,
          totalAttempts: event.deliveryAttempts,
          replayedAt: null,
          replayStatus: 'UNRESOLVED',
        };

        deadLetterStore.set(deadLetterEntry.deadLetterId, deadLetterEntry);
      } else {
        // Schedule retry with exponential backoff
        event.status = OUTBOX_STATUS.FAILED_RETRYABLE;
        const backoffMs =
          DEFAULT_RETRY_CONFIG.initialBackoffMs *
          Math.pow(DEFAULT_RETRY_CONFIG.backoffMultiplier, event.deliveryAttempts - 1);
        event.nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();
      }
    }

    outboxStore.set(event.eventId, event);
  }

  return {
    status: EVENT_BUS_STATE.IDLE,
    dispatchedCount: pendingEvents.length,
    deliveredCount,
    failedCount,
    deadLetterCount,
  };
}

/**
 * Replays a dead-lettered event with administrative authorization and audit logging.
 *
 * @param {string} deadLetterId
 * @param {string} operatorId Authenticated administrative operator
 * @param {string} justification Reason for replaying
 * @returns {Promise<Object>}
 */
export async function replayDeadLetterEvent(deadLetterId, operatorId, justification) {
  if (!operatorId || typeof operatorId !== 'string') {
    throw new Error('Operator ID is required for administrative replay');
  }

  if (!justification || typeof justification !== 'string') {
    throw new Error('Valid operational justification is required for audit trail');
  }

  const dlqEntry = deadLetterStore.get(deadLetterId);
  if (!dlqEntry) {
    throw new Error(`Dead-letter record '${deadLetterId}' not found`);
  }

  const originalEvent = dlqEntry.originalEvent;
  const eventInStore = outboxStore.get(originalEvent.eventId);

  if (eventInStore) {
    // Reset delivery counters
    eventInStore.status = OUTBOX_STATUS.PENDING_DELIVERY;
    eventInStore.deliveryAttempts = 0;
    eventInStore.nextAttemptAt = new Date().toISOString();
    eventInStore.lastError = null;
    outboxStore.set(eventInStore.eventId, eventInStore);
  }

  // Clear previous failed consumer execution logs for this event
  for (const key of consumerExecutionLogs.keys()) {
    if (key.endsWith(`:${originalEvent.eventId}`)) {
      consumerExecutionLogs.delete(key);
    }
  }

  dlqEntry.replayedAt = new Date().toISOString();
  dlqEntry.replayStatus = 'REPLAYED';
  deadLetterStore.set(deadLetterId, dlqEntry);

  // Log administrative audit event
  const auditEvent = {
    auditId: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action: 'REPLAY_DEAD_LETTER_EVENT',
    targetEventId: originalEvent.eventId,
    deadLetterId,
    operatorId,
    justification,
    timestamp: new Date().toISOString(),
  };
  administrativeAuditLog.push(auditEvent);

  // Re-dispatch event
  const dispatchResult = await dispatchPendingOutboxEvents({ targetEventId: originalEvent.eventId });

  return {
    replayedEventId: originalEvent.eventId,
    deadLetterId,
    auditId: auditEvent.auditId,
    dispatchResult,
  };
}

/**
 * Retrieves observable health metrics for the event bus.
 *
 * @returns {Object} Operational health metrics
 */
export function getEventBusHealthMetrics() {
  let pendingCount = 0;
  let deliveredCount = 0;
  let deadLetterCount = 0;

  for (const ev of outboxStore.values()) {
    if (ev.status === OUTBOX_STATUS.PENDING_DELIVERY || ev.status === OUTBOX_STATUS.FAILED_RETRYABLE) {
      pendingCount += 1;
    } else if (ev.status === OUTBOX_STATUS.DELIVERED) {
      deliveredCount += 1;
    } else if (ev.status === OUTBOX_STATUS.DEAD_LETTERED) {
      deadLetterCount += 1;
    }
  }

  return {
    outboxDepth: outboxStore.size,
    pendingCount,
    deliveredCount,
    deadLetterCount,
    activeConsumersCount: consumerRegistry.size,
    contractRejectedCount,
    consumerContractFailureCount,
    undeclaredConsumersCount: [...consumerRegistry.values()].filter(consumer => !consumer.declared).length,
    administrativeAuditEventsCount: administrativeAuditLog.length,
    status: deadLetterCount > 0 ? 'ATTENTION_REQUIRED' : 'HEALTHY',
  };
}

/**
 * Retrieves audit log of administrative operations.
 *
 * @returns {Array<Object>}
 */
export function getAdministrativeAuditLog() {
  return [...administrativeAuditLog];
}

/** Metadata only; handler functions and citizen payloads are never included. */
export function getEventConsumerInventory() {
  return [...consumerRegistry.values()].map(({ consumerId, eventTypes, contractVersions, owner, declared, tenantScope, enabled }) => ({
    consumerId, eventTypes: [...eventTypes], contractVersions: structuredClone(contractVersions), owner, declared, tenantScope, enabled,
  })).sort((a, b) => a.consumerId.localeCompare(b.consumerId));
}

/**
 * Internal cleanup utility for unit tests.
 */
export function _resetEventBusInternalStores() {
  outboxStore.clear();
  deadLetterStore.clear();
  consumerRegistry.clear();
  consumerExecutionLogs.clear();
  administrativeAuditLog.length = 0;
  contractRejectedCount = 0;
  consumerContractFailureCount = 0;
}
