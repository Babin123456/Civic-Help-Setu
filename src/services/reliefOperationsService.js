/**
 * Trusted service boundary for the Relief Operations Workspace (#747).
 *
 * Every protected read and write passes through this module. It owns:
 *  - role and jurisdiction enforcement
 *  - strict input validation (delegated to reliefOperationsValidation)
 *  - idempotency and duplicate handling
 *  - finite state transitions for needs, incidents, allocations and deliveries
 *  - transactional stock reservations (a failure restores the previous snapshot)
 *  - append-only audit events with override reasons
 *  - public projections that expose aggregate or explicitly approved fields only
 */

import {
  RELIEF_ERROR_CODES,
  RELIEF_CATEGORIES,
  RELIEF_CATEGORY_LABELS,
  RELIEF_ROLES,
  RELIEF_STAFF_ROLES,
  NEED_STATUS,
  NEED_STATUS_LABELS,
  NEED_TRANSITIONS,
  INCIDENT_STATUS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_TRANSITIONS,
  ALLOCATION_STATUS,
  ALLOCATION_STATUS_LABELS,
  ALLOCATION_TRANSITIONS,
  DELIVERY_STATUS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_TRANSITIONS,
  RESOURCE_STATUS,
  STOCK_MOVEMENT_TYPES,
  PARTNER_STATUS,
  PARTNER_STATUS_LABELS,
  PRIORITY_TIERS,
  CONFIDENCE_LEVELS,
  RELIEF_FORECAST_MODEL_VERSION,
  RELIEF_LIMITS,
} from './reliefOperationsConstants';
import {
  ReliefServiceError,
  sanitizeText,
  validateNeedReportInput,
  validateIncidentInput,
  validateResourceInput,
  validateSiteInput,
  validateAllocationProposalInput,
  validateDecisionInput,
  validateDispatchInput,
  validateDeliveryConfirmationInput,
  validatePartnerInput,
  paginate,
  assertIncidentTransition,
} from './reliefOperationsValidation';
import {
  assertReliefCapability,
  assertReliefJurisdiction,
  assertVerifiedPartner,
  resolveReliefRole,
  resolveReliefScope,
  isReliefStaff,
} from './reliefOperationsAccessControl';
import {
  ensureReliefData,
  persistReliefData,
} from './reliefOperationsMigrations';
import {
  runNeedsForecast,
  summarizeUnmetNeeds,
  isOpenNeed,
  remainingQuantity,
  isNeedStale,
} from './reliefForecastEngine';

// ── Utilities ────────────────────────────────────────────────────────────────

const generateId = (prefix) => {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${time}-${random}`;
};

const generateTrackingToken = (existing = []) => {
  const taken = new Set(existing.map((need) => need.trackingToken).filter(Boolean));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const token = `TRK-RLF-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!taken.has(token)) return token;
  }
  return `TRK-RLF-${Date.now().toString().slice(-6)}`;
};

const actorId = (actor) => actor?.id || actor?.username || 'anonymous';
const actorRole = (actor) => resolveReliefRole(actor);
const clone = (value) => JSON.parse(JSON.stringify(value));
const normalize = (value) => String(value || '').trim().toUpperCase();

const stableFingerprint = (value) => {
  let hash = 0x811c9dc5;
  const text = JSON.stringify(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fp_${(hash >>> 0).toString(16)}`;
};

const collectionSnapshot = (data) => ({
  incidents: clone(data.incidents || []),
  needs: clone(data.needs || []),
  resources: clone(data.resources || []),
  movements: clone(data.movements || []),
  sites: clone(data.sites || []),
  allocations: clone(data.allocations || []),
  deliveries: clone(data.deliveries || []),
  partners: clone(data.partners || []),
  forecastRuns: clone(data.forecastRuns || []),
  auditLogs: clone(data.auditLogs || []),
  archive: clone(data.archive || { incidents: [], needs: [], auditLogs: [] }),
});

/**
 * Runs a multi-record mutation as one unit. If the mutator throws, the previous
 * snapshot is written back, so no partial reservation or status change survives.
 */
const transaction = (mutator) => {
  const current = ensureReliefData();
  const snapshot = collectionSnapshot(current);
  const draft = collectionSnapshot(current);
  try {
    const result = mutator(draft);
    persistReliefData(draft);
    return result;
  } catch (error) {
    persistReliefData(snapshot);
    if (error instanceof ReliefServiceError) throw error;
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.TRANSACTION_FAILED,
      `The relief operation could not be saved completely: ${error?.message || 'unknown error'}`,
      { cause: error?.message }
    );
  }
};

const appendAudit = (
  data,
  { action, entityType, entityId, actor, reason = '', details = {}, jurisdictionId = null, before = null, after = null }
) => {
  const entry = {
    id: generateId('AUDIT-RLF'),
    action,
    entityType,
    entityId,
    actorId: actorId(actor),
    actorRole: actorRole(actor),
    reason: sanitizeText(reason, RELIEF_LIMITS.maxReasonLength),
    details,
    before,
    after,
    jurisdictionId: jurisdictionId ? normalize(jurisdictionId) : null,
    timestamp: new Date().toISOString(),
    schemaVersion: 1,
  };
  data.auditLogs.unshift(entry);
  return entry;
};

const applyScope = (items, actor, field = 'jurisdictionId') => {
  const scope = resolveReliefScope(actor);
  if (!scope.length) return items;
  return items.filter((item) => scope.includes(normalize(item[field])));
};

const assertNotExpiredResource = (resource) => {
  if (!resource) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'The selected resource stock was not found.');
  }
  if (resource.status === RESOURCE_STATUS.EXPIRED || resource.status === RESOURCE_STATUS.QUARANTINED) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.STOCK_EXPIRED,
      `Stock batch ${resource.batchRef || resource.id} is ${resource.status} and cannot be allocated.`
    );
  }
  if (resource.expiresAt && Date.parse(resource.expiresAt) <= Date.now()) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.STOCK_EXPIRED,
      `Stock batch ${resource.batchRef || resource.id} has passed its expiry date and cannot be allocated.`
    );
  }
};

const availableQuantity = (resource) =>
  Math.max(0, Number(resource.quantityOnHand || 0) - Number(resource.quantityReserved || 0));

const syncResourceStatus = (resource, now = new Date().toISOString()) => {
  if (resource.status === RESOURCE_STATUS.EXPIRED || resource.status === RESOURCE_STATUS.QUARANTINED) {
    return resource;
  }
  const available = availableQuantity(resource);
  resource.status =
    available <= 0
      ? RESOURCE_STATUS.DEPLETED
      : Number(resource.quantityReserved) > 0
        ? RESOURCE_STATUS.RESERVED
        : RESOURCE_STATUS.AVAILABLE;
  resource.updatedAt = now;
  return resource;
};

const addMovement = (data, { resource, allocationId, type, quantity, reason, actor, jurisdictionId, now }) => {
  const movement = {
    id: generateId('MOV-RLF'),
    resourceId: resource.id,
    allocationId: allocationId || null,
    type,
    quantity,
    balanceAfter: Number(resource.quantityOnHand || 0),
    reservedAfter: Number(resource.quantityReserved || 0),
    jurisdictionId: normalize(jurisdictionId || resource.jurisdictionId),
    reason: sanitizeText(reason, RELIEF_LIMITS.maxReasonLength),
    actorId: actorId(actor),
    actorRole: actorRole(actor),
    createdAt: now,
    schemaVersion: 1,
  };
  data.movements.unshift(movement);
  return movement;
};

// ── Public projections ───────────────────────────────────────────────────────

/**
 * The only need fields ever returned to an unauthenticated caller.
 * Deliberately omits: description, incidentId, reporterRef, partnerId,
 * privateNote, coordinates, duplicate links, internal idempotency keys.
 */
export const toPublicNeedProjection = (need) => {
  if (!need) return null;
  return {
    trackingToken: need.trackingToken,
    category: need.category,
    categoryLabel: RELIEF_CATEGORY_LABELS[need.category] || need.category,
    locality: need.locality,
    jurisdictionId: need.jurisdictionId,
    quantity: need.quantity,
    fulfilledQuantity: need.fulfilledQuantity || 0,
    peopleAffected: need.peopleAffected,
    urgency: need.urgency,
    status: need.status,
    statusLabel: NEED_STATUS_LABELS[need.status] || need.status,
    submittedAt: need.createdAt,
    updatedAt: need.updatedAt,
  };
};

export const toPublicSiteProjection = (site) => {
  if (!site || site.isPublic === false) return null;
  return {
    id: site.id,
    name: site.name,
    address: site.address,
    locality: site.locality,
    jurisdictionId: site.jurisdictionId,
    coordinates: site.coordinates,
    capacityPerDay: site.capacityPerDay,
    publicContactRole: site.publicContactRole,
  };
};

export const toPublicIncidentProjection = (incident) => {
  if (!incident || incident.status === INCIDENT_STATUS.DRAFT) return null;
  return {
    id: incident.id,
    name: incident.name,
    disasterType: incident.disasterType,
    status: incident.status,
    statusLabel: INCIDENT_STATUS_LABELS[incident.status] || incident.status,
    locality: incident.locality,
    jurisdictionId: incident.jurisdictionId,
    publicSummary: incident.publicSummary,
    startedAt: incident.startedAt,
    updatedAt: incident.updatedAt,
  };
};

const toStaffAllocation = (allocation, data) => {
  const need = data.needs.find((item) => item.id === allocation.needId) || null;
  const resource = data.resources.find((item) => item.id === allocation.resourceId) || null;
  const site = data.sites.find((item) => item.id === allocation.siteId) || null;
  const delivery = data.deliveries.find((item) => item.allocationId === allocation.id) || null;
  return {
    ...allocation,
    statusLabel: ALLOCATION_STATUS_LABELS[allocation.status] || allocation.status,
    needSummary: need
      ? {
          id: need.id,
          trackingToken: need.trackingToken,
          category: need.category,
          locality: need.locality,
          quantity: need.quantity,
          fulfilledQuantity: need.fulfilledQuantity,
          status: need.status,
        }
      : null,
    resourceSummary: resource
      ? {
          id: resource.id,
          name: resource.name,
          unit: resource.unit,
          batchRef: resource.batchRef,
          availableQuantity: availableQuantity(resource),
          expiresAt: resource.expiresAt,
        }
      : null,
    siteSummary: site ? { id: site.id, name: site.name, locality: site.locality } : null,
    deliverySummary: delivery
      ? {
          id: delivery.id,
          status: delivery.status,
          statusLabel: DELIVERY_STATUS_LABELS[delivery.status] || delivery.status,
          teamName: delivery.teamName,
          vehicleRef: delivery.vehicleRef,
        }
      : null,
  };
};

// ── Public submission rate limiter ──────────────────────────────────────────

const submissionWindows = new Map();

export const resetReliefRateLimiter = () => submissionWindows.clear();

const checkPublicRateLimit = (clientId) => {
  const now = Date.now();
  const key = clientId || 'anonymous';
  const windowMs = RELIEF_LIMITS.publicSubmissionWindowMs;
  const history = (submissionWindows.get(key) || []).filter((time) => now - time < windowMs);
  if (history.length >= RELIEF_LIMITS.publicSubmissionLimit) {
    submissionWindows.set(key, history);
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.RATE_LIMITED,
      'Too many relief need reports were submitted from this client. Wait a few minutes before trying again.'
    );
  }
  history.push(now);
  submissionWindows.set(key, history);
};

// ── Incidents ────────────────────────────────────────────────────────────────

export const createIncident = (input, actor) => {
  assertReliefCapability('incident.manage', actor);
  const validated = validateIncidentInput(input);
  assertReliefJurisdiction(actor, validated.jurisdictionId);

  return transaction((data) => {
    const now = new Date().toISOString();
    const incident = {
      id: generateId('INC-RLF'),
      ...validated,
      status: validated.status,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId(actor),
      schemaVersion: 1,
    };
    data.incidents.unshift(incident);
    appendAudit(data, {
      action: 'INCIDENT_CREATED',
      entityType: 'Incident',
      entityId: incident.id,
      actor,
      jurisdictionId: incident.jurisdictionId,
      details: { disasterType: incident.disasterType, status: incident.status },
    });
    return incident;
  });
};

export const transitionIncident = (incidentId, nextStatus, { reason = '' } = {}, actor) => {
  assertReliefCapability('incident.manage', actor);
  const data = ensureReliefData();
  const incident = data.incidents.find((item) => item.id === incidentId);
  if (!incident) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, `Incident "${incidentId}" was not found.`);
  }
  assertReliefJurisdiction(actor, incident.jurisdictionId);
  try {
    assertIncidentTransition(incident.status, nextStatus);
  } catch {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
      `Cannot move incident from "${incident.status}" to "${nextStatus}".`,
      { allowed: INCIDENT_TRANSITIONS[incident.status] || [] }
    );
  }

  return transaction((draft) => {
    const target = draft.incidents.find((item) => item.id === incidentId);
    const previousStatus = target.status;
    target.status = nextStatus;
    target.updatedAt = new Date().toISOString();
    appendAudit(draft, {
      action: 'INCIDENT_TRANSITIONED',
      entityType: 'Incident',
      entityId: target.id,
      actor,
      reason,
      jurisdictionId: target.jurisdictionId,
      before: { status: previousStatus },
      after: { status: nextStatus },
    });
    return target;
  });
};

export const listIncidents = (filters = {}, actor) => {
  assertReliefCapability('incident.read', actor, { allowAnonymous: true });
  const data = ensureReliefData();
  let incidents = data.incidents
    .filter((incident) => incident.status !== INCIDENT_STATUS.DRAFT)
    .map(toPublicIncidentProjection)
    .filter(Boolean);

  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    incidents = incidents.filter(
      (incident) => normalize(incident.jurisdictionId) === normalize(filters.jurisdictionId)
    );
  }
  if (filters.status && filters.status !== 'all') {
    incidents = incidents.filter((incident) => incident.status === filters.status);
  }
  incidents = applyScope(incidents, actor);
  return incidents.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
};

// ── Need reports ─────────────────────────────────────────────────────────────

const findDuplicateNeed = (data, validated) => {
  const windowStart = Date.now() - RELIEF_LIMITS.dedupeWindowHours * 60 * 60 * 1000;
  const descriptionTokens = new Set(
    validated.description
      .toLowerCase()
      .split(/\W+/)
      .filter((token) => token.length > 3)
  );

  return (
    data.needs.find((need) => {
      if (
        need.status === NEED_STATUS.DUPLICATE ||
        need.status === NEED_STATUS.REJECTED ||
        need.status === NEED_STATUS.FULFILLED
      ) {
        return false;
      }
      if (normalize(need.jurisdictionId) !== validated.jurisdictionId) return false;
      if (need.category !== validated.category) return false;
      if (sanitizeText(need.locality, 80).toLowerCase() !== validated.locality.toLowerCase()) return false;
      if (Date.parse(need.createdAt || 0) < windowStart) return false;

      if (validated.dedupeFingerprint && need.dedupeFingerprint === validated.dedupeFingerprint) {
        return true;
      }

      const needTokens = new Set(
        sanitizeText(need.description, RELIEF_LIMITS.maxDescriptionLength)
          .toLowerCase()
          .split(/\W+/)
          .filter((token) => token.length > 3)
      );
      if (descriptionTokens.size && needTokens.size) {
        const intersection = [...descriptionTokens].filter((token) => needTokens.has(token)).length;
        const union = new Set([...descriptionTokens, ...needTokens]).size;
        if (union > 0 && intersection / union >= 0.7) return true;
      }

      if (
        validated.coordinates &&
        need.coordinates &&
        Math.abs(need.coordinates.lat - validated.coordinates.lat) < 0.0025 &&
        Math.abs(need.coordinates.lng - validated.coordinates.lng) < 0.0025
      ) {
        return true;
      }
      return false;
    }) || null
  );
};

/**
 * Submits a relief need. Public and citizen submissions are accepted with rate
 * limits; partner submissions additionally require a verified partner record.
 */
export const submitNeedReport = (rawInput, actor, { clientId = 'client' } = {}) => {
  const role = assertReliefCapability('need.submit', actor, { allowAnonymous: true });
  if (role !== RELIEF_ROLES.PARTNER && role !== RELIEF_ROLES.OPERATOR && role !== RELIEF_ROLES.REVIEWER && role !== RELIEF_ROLES.ADMIN) {
    checkPublicRateLimit(clientId);
  }

  const validated = validateNeedReportInput(rawInput);
  const data = ensureReliefData();

  // Partner submissions must map to a verified partner in the same jurisdiction.
  if (role === RELIEF_ROLES.PARTNER) {
    const partnerId =
      rawInput.partnerId || actor?.partnerId || actor?.raw?.publicMetadata?.partnerId;
    const partner = data.partners.find((item) => item.id === partnerId);
    assertVerifiedPartner(partner, validated.jurisdictionId);
    validated.partnerId = partner.id;
    validated.reporterType = 'partner';
  }

  // Idempotency: replay returns the same record; a conflicting payload is refused.
  if (validated.idempotencyKey) {
    const existing = data.needs.find((need) => need.idempotencyKey === validated.idempotencyKey);
    if (existing) {
      const fingerprint = stableFingerprint(validated);
      if (existing.idempotencyFingerprint && existing.idempotencyFingerprint !== fingerprint) {
        throw new ReliefServiceError(
          RELIEF_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          'This idempotency key was already used with different details. Use a new key for a new report.'
        );
      }
      return { ...toPublicNeedProjection(existing), idempotentReplay: true, deduplicated: false };
    }
  }

  const duplicate = findDuplicateNeed(data, validated);
  const idempotencyFingerprint = validated.idempotencyKey
    ? stableFingerprint(validated)
    : null;

  return transaction((draft) => {
    const now = new Date().toISOString();
    const trackingToken = generateTrackingToken(draft.needs);
    const need = {
      id: generateId('NEED-RLF'),
      trackingToken,
      incidentId: validated.incidentId,
      category: validated.category,
      locality: validated.locality,
      jurisdictionId: validated.jurisdictionId,
      description: validated.description,
      quantity: validated.quantity,
      fulfilledQuantity: 0,
      peopleAffected: validated.peopleAffected,
      urgency: validated.urgency,
      status: duplicate ? NEED_STATUS.DUPLICATE : NEED_STATUS.SUBMITTED,
      reporterType: validated.reporterType,
      partnerId: validated.partnerId,
      reporterRef: validated.reporterRef,
      coordinates: validated.coordinates,
      siteId: validated.siteId,
      dedupeFingerprint: validated.dedupeFingerprint,
      duplicateOfId: duplicate ? duplicate.id : null,
      duplicateCount: 0,
      duplicateReportIds: [],
      privateNote: '',
      verifiedBy: null,
      verifiedAt: null,
      idempotencyKey: validated.idempotencyKey,
      idempotencyFingerprint,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId(actor),
      schemaVersion: 1,
    };

    if (duplicate) {
      const primary = draft.needs.find((item) => item.id === duplicate.id);
      if (primary) {
        primary.duplicateCount = (primary.duplicateCount || 0) + 1;
        primary.duplicateReportIds = [...(primary.duplicateReportIds || []), need.id];
        primary.updatedAt = now;
      }
    }

    draft.needs.unshift(need);
    appendAudit(draft, {
      action: duplicate ? 'NEED_REPORT_DEDUPLICATED' : 'NEED_REPORT_SUBMITTED',
      entityType: 'NeedReport',
      entityId: need.id,
      actor,
      jurisdictionId: need.jurisdictionId,
      details: {
        category: need.category,
        quantity: need.quantity,
        duplicateOfId: need.duplicateOfId,
      },
    });

    return {
      ...toPublicNeedProjection(need),
      deduplicated: Boolean(duplicate),
      duplicateOfTrackingToken: duplicate?.trackingToken || null,
    };
  });
};

export const trackNeedByToken = (token) => {
  const data = ensureReliefData();
  const cleanToken = String(token || '').trim().toUpperCase();
  if (!cleanToken) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'A tracking token is required.');
  }
  const need = data.needs.find((item) => normalize(item.trackingToken) === cleanToken);
  if (!need) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.NOT_FOUND,
      `No relief need report was found for token "${token}".`
    );
  }
  return toPublicNeedProjection(need);
};

/**
 * Operator verification / triage / rejection. Reason is mandatory for rejection.
 */
export const reviewNeedReport = (needId, { decision, reason = '', privateNote = '' } = {}, actor) => {
  assertReliefCapability('need.verify', actor);
  const data = ensureReliefData();
  const need = data.needs.find((item) => item.id === needId);
  if (!need) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, `Need report "${needId}" was not found.`);
  }
  assertReliefJurisdiction(actor, need.jurisdictionId);

  const nextStatusMap = {
    verify: NEED_STATUS.VERIFIED,
    triage: NEED_STATUS.TRIAGED,
    reject: NEED_STATUS.REJECTED,
  };
  const nextStatus = nextStatusMap[decision];
  if (!nextStatus) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Decision must be "verify", "triage" or "reject".'
    );
  }
  if (decision === 'reject' && sanitizeText(reason, RELIEF_LIMITS.maxReasonLength).length < 5) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'A reason of at least 5 characters is required to reject a need report.'
    );
  }
  if (!(NEED_TRANSITIONS[need.status] || []).includes(nextStatus)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
      `Cannot move need from "${need.status}" to "${nextStatus}". Allowed: ${(NEED_TRANSITIONS[need.status] || []).join(', ') || 'none'}.`,
      { from: need.status, to: nextStatus, allowed: NEED_TRANSITIONS[need.status] || [] }
    );
  }

  return transaction((draft) => {
    const target = draft.needs.find((item) => item.id === needId);
    const previousStatus = target.status;
    const now = new Date().toISOString();
    target.status = nextStatus;
    target.updatedAt = now;
    if (nextStatus === NEED_STATUS.VERIFIED || nextStatus === NEED_STATUS.TRIAGED) {
      target.verifiedBy = actorId(actor);
      target.verifiedAt = now;
    }
    if (privateNote) target.privateNote = sanitizeText(privateNote, RELIEF_LIMITS.maxNotesLength);
    if (reason && nextStatus === NEED_STATUS.REJECTED) {
      target.rejectionReason = sanitizeText(reason, RELIEF_LIMITS.maxReasonLength);
    }
    appendAudit(draft, {
      action: `NEED_${nextStatus.toUpperCase()}`,
      entityType: 'NeedReport',
      entityId: target.id,
      actor,
      reason,
      jurisdictionId: target.jurisdictionId,
      before: { status: previousStatus },
      after: { status: nextStatus },
    });
    return { ...target, statusLabel: NEED_STATUS_LABELS[target.status] || target.status };
  });
};

const filterNeeds = (needs, filters = {}) => {
  let results = [...needs];
  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    results = results.filter((need) => normalize(need.jurisdictionId) === normalize(filters.jurisdictionId));
  }
  if (filters.category && filters.category !== 'all') {
    results = results.filter((need) => need.category === filters.category);
  }
  if (filters.status && filters.status !== 'all') {
    results = results.filter((need) => need.status === filters.status);
  }
  if (filters.locality) {
    results = results.filter((need) => normalize(need.locality) === normalize(filters.locality));
  }
  if (filters.incidentId) {
    results = results.filter((need) => need.incidentId === filters.incidentId);
  }
  if (filters.searchQuery) {
    const query = String(filters.searchQuery).toLowerCase().trim();
    results = results.filter(
      (need) =>
        need.id.toLowerCase().includes(query) ||
        (need.trackingToken || '').toLowerCase().includes(query) ||
        (need.locality || '').toLowerCase().includes(query) ||
        (need.description || '').toLowerCase().includes(query)
    );
  }
  if (filters.openOnly) results = results.filter(isOpenNeed);
  return results.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
};

export const listNeedReports = (filters = {}, actor) => {
  assertReliefCapability('need.read', actor);
  const data = ensureReliefData();
  let needs = applyScope(data.needs, actor);
  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    assertReliefJurisdiction(actor, filters.jurisdictionId, { forRead: true });
  }
  needs = filterNeeds(needs, filters);
  const page = paginate(needs, filters);
  return {
    ...page,
    items: page.items.map((need) => ({
      ...need,
      statusLabel: NEED_STATUS_LABELS[need.status] || need.status,
      remainingQuantity: remainingQuantity(need),
      isStale: isNeedStale(need),
    })),
  };
};

/** Unmet needs aggregated by category and locality, plus the raw (scoped) list. */
export const getUnmetNeedsSummary = (filters = {}, actor) => {
  assertReliefCapability('need.read', actor);
  const data = ensureReliefData();
  let needs = applyScope(data.needs, actor);
  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    assertReliefJurisdiction(actor, filters.jurisdictionId, { forRead: true });
    needs = needs.filter((need) => normalize(need.jurisdictionId) === normalize(filters.jurisdictionId));
  }
  if (filters.incidentId) needs = needs.filter((need) => need.incidentId === filters.incidentId);
  if (filters.category && filters.category !== 'all') {
    needs = needs.filter((need) => need.category === filters.category);
  }
  return {
    summary: summarizeUnmetNeeds(needs, { now: filters.now || Date.now() }),
    needs: filterNeeds(needs, { ...filters, openOnly: true }),
    evaluatedAt: new Date().toISOString(),
  };
};

export const addNeedPrivateNote = (needId, note, actor) => {
  assertReliefCapability('need.verify', actor);
  const sanitized = sanitizeText(note, RELIEF_LIMITS.maxNotesLength);
  if (sanitized.length < 3) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'A private note must be at least 3 characters.');
  }
  return transaction((data) => {
    const need = data.needs.find((item) => item.id === needId);
    if (!need) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Need report not found.');
    assertReliefJurisdiction(actor, need.jurisdictionId);
    need.privateNote = sanitized;
    need.updatedAt = new Date().toISOString();
    appendAudit(data, {
      action: 'NEED_PRIVATE_NOTE_UPDATED',
      entityType: 'NeedReport',
      entityId: need.id,
      actor,
      jurisdictionId: need.jurisdictionId,
      details: { noteLength: sanitized.length },
    });
    return need;
  });
};

// ── Distribution sites ───────────────────────────────────────────────────────

export const createDistributionSite = (input, actor) => {
  assertReliefCapability('inventory.manage', actor);
  const validated = validateSiteInput(input);
  assertReliefJurisdiction(actor, validated.jurisdictionId);
  return transaction((data) => {
    const now = new Date().toISOString();
    const site = {
      id: generateId('SITE-RLF'),
      ...validated,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId(actor),
      schemaVersion: 1,
    };
    data.sites.unshift(site);
    appendAudit(data, {
      action: 'SITE_CREATED',
      entityType: 'DistributionSite',
      entityId: site.id,
      actor,
      jurisdictionId: site.jurisdictionId,
      details: { isPublic: site.isPublic },
    });
    return site;
  });
};

export const listDistributionSites = (filters = {}, actor) => {
  assertReliefCapability('need.read_public', actor, { allowAnonymous: true });
  const data = ensureReliefData();
  const isStaff = isReliefStaff(actor);
  let sites = data.sites.filter((site) => (isStaff ? true : site.isPublic !== false));
  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    sites = sites.filter((site) => normalize(site.jurisdictionId) === normalize(filters.jurisdictionId));
  }
  sites = applyScope(sites, actor);
  return sites.map((site) => (isStaff ? site : toPublicSiteProjection(site))).filter(Boolean);
};

// ── Resources & stock ────────────────────────────────────────────────────────

export const createResource = (input, actor) => {
  assertReliefCapability('inventory.manage', actor);
  const validated = validateResourceInput(input);
  assertReliefJurisdiction(actor, validated.jurisdictionId);
  if (validated.quantityReserved > validated.quantityOnHand) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Reserved quantity cannot exceed quantity on hand.'
    );
  }

  return transaction((data) => {
    const now = new Date().toISOString();
    const resource = {
      id: generateId('RES-RLF'),
      ...validated,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId(actor),
      schemaVersion: 1,
    };
    syncResourceStatus(resource, now);
    data.resources.unshift(resource);
    if (resource.quantityOnHand > 0) {
      addMovement(data, {
        resource,
        type: STOCK_MOVEMENT_TYPES.RECEIPT,
        quantity: resource.quantityOnHand,
        reason: 'Initial stock entry',
        actor,
        now,
      });
    }
    appendAudit(data, {
      action: 'RESOURCE_CREATED',
      entityType: 'ResourceItem',
      entityId: resource.id,
      actor,
      jurisdictionId: resource.jurisdictionId,
      details: { category: resource.category, quantityOnHand: resource.quantityOnHand },
    });
    return resource;
  });
};

export const listResources = (filters = {}, actor) => {
  assertReliefCapability('inventory.read', actor);
  const data = ensureReliefData();
  let resources = applyScope(data.resources, actor);
  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    assertReliefJurisdiction(actor, filters.jurisdictionId, { forRead: true });
    resources = resources.filter((resource) => normalize(resource.jurisdictionId) === normalize(filters.jurisdictionId));
  }
  if (filters.category && filters.category !== 'all') {
    resources = resources.filter((resource) => resource.category === filters.category);
  }
  if (filters.status && filters.status !== 'all') {
    resources = resources.filter((resource) => resource.status === filters.status);
  }
  if (filters.searchQuery) {
    const query = String(filters.searchQuery).toLowerCase();
    resources = resources.filter(
      (resource) =>
        resource.name.toLowerCase().includes(query) ||
        (resource.batchRef || '').toLowerCase().includes(query) ||
        resource.id.toLowerCase().includes(query)
    );
  }
  const withAvailability = resources.map((resource) => ({
    ...resource,
    availableQuantity: availableQuantity(resource),
    isExpired:
      resource.status === RESOURCE_STATUS.EXPIRED ||
      (resource.expiresAt ? Date.parse(resource.expiresAt) <= Date.now() : false),
  }));
  return paginate(withAvailability, filters);
};

export const addStock = (resourceId, { quantity, reason = '' } = {}, actor) => {
  assertReliefCapability('inventory.manage', actor);
  const amount = Math.round(Number(quantity));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Stock quantity must be a whole number between 1 and 1,000,000.'
    );
  }
  return transaction((data) => {
    const resource = data.resources.find((item) => item.id === resourceId);
    if (!resource) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Resource stock not found.');
    assertReliefJurisdiction(actor, resource.jurisdictionId);
    const now = new Date().toISOString();
    resource.quantityOnHand = Number(resource.quantityOnHand || 0) + amount;
    syncResourceStatus(resource, now);
    addMovement(data, {
      resource,
      type: STOCK_MOVEMENT_TYPES.RECEIPT,
      quantity: amount,
      reason: reason || 'Stock received',
      actor,
      now,
    });
    appendAudit(data, {
      action: 'STOCK_RECEIVED',
      entityType: 'ResourceItem',
      entityId: resource.id,
      actor,
      reason,
      jurisdictionId: resource.jurisdictionId,
      details: { quantity: amount, balanceAfter: resource.quantityOnHand },
    });
    return resource;
  });
};

export const quarantineResource = (resourceId, { reason = '' } = {}, actor) => {
  assertReliefCapability('inventory.manage', actor);
  if (sanitizeText(reason, RELIEF_LIMITS.maxReasonLength).length < 5) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'A reason of at least 5 characters is required to write off or quarantine stock.'
    );
  }
  return transaction((data) => {
    const resource = data.resources.find((item) => item.id === resourceId);
    if (!resource) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Resource stock not found.');
    assertReliefJurisdiction(actor, resource.jurisdictionId);
    const now = new Date().toISOString();
    resource.status = RESOURCE_STATUS.EXPIRED;
    resource.updatedAt = now;
    addMovement(data, {
      resource,
      type: STOCK_MOVEMENT_TYPES.EXPIRY,
      quantity: Math.max(0, Number(resource.quantityOnHand || 0) - Number(resource.quantityReserved || 0)),
      reason,
      actor,
      now,
    });
    appendAudit(data, {
      action: 'STOCK_WRITTEN_OFF',
      entityType: 'ResourceItem',
      entityId: resource.id,
      actor,
      reason,
      jurisdictionId: resource.jurisdictionId,
    });
    return resource;
  });
};

export const listStockMovements = (filters = {}, actor) => {
  assertReliefCapability('inventory.read', actor);
  const data = ensureReliefData();
  let movements = applyScope(data.movements, actor);
  if (filters.resourceId) movements = movements.filter((movement) => movement.resourceId === filters.resourceId);
  if (filters.allocationId) movements = movements.filter((movement) => movement.allocationId === filters.allocationId);
  if (filters.type && filters.type !== 'all') movements = movements.filter((movement) => movement.type === filters.type);
  movements.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return paginate(movements, filters);
};

// ── Allocation proposals ────────────────────────────────────────────────────

export const proposeAllocation = (input, actor) => {
  assertReliefCapability('allocation.propose', actor);
  const validated = validateAllocationProposalInput(input);
  const data = ensureReliefData();
  const need = data.needs.find((item) => item.id === validated.needId);
  if (!need) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'The selected need report was not found.');
  const resource = data.resources.find((item) => item.id === validated.resourceId);
  if (!resource) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'The selected resource stock was not found.');
  const site = validated.siteId ? data.sites.find((item) => item.id === validated.siteId) : null;
  if (validated.siteId && !site) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'The selected distribution site was not found.');

  assertReliefJurisdiction(actor, need.jurisdictionId);
  assertReliefJurisdiction(actor, resource.jurisdictionId);
  if (normalize(need.jurisdictionId) !== normalize(resource.jurisdictionId)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'The need and the stock item belong to different jurisdictions.'
    );
  }
  if (![NEED_STATUS.VERIFIED, NEED_STATUS.TRIAGED].includes(need.status)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
      need.status === NEED_STATUS.SUBMITTED
        ? 'Verify the need report before proposing an allocation.'
        : `A need in status "${need.status}" cannot be allocated.`
    );
  }
  if (resource.category !== validated.category || need.category !== validated.category) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'The allocation category must match both the need and the stock item.'
    );
  }
  if (validated.quantity > remainingQuantity(need)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      `Allocation quantity (${validated.quantity}) exceeds the remaining need (${remainingQuantity(need)}).`
    );
  }
  assertNotExpiredResource(resource);
  if (availableQuantity(resource) < validated.quantity) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INSUFFICIENT_STOCK,
      `Only ${availableQuantity(resource)} ${resource.unit || 'units'} are currently unreserved; ${validated.quantity} requested.`
    );
  }

  if (validated.idempotencyKey) {
    const existing = data.allocations.find((item) => item.idempotencyKey === validated.idempotencyKey);
    if (existing) {
      return { ...toStaffAllocation(existing, data), idempotentReplay: true };
    }
  }

  return transaction((draft) => {
    const now = new Date().toISOString();
    const allocation = {
      id: generateId('ALLOC-RLF'),
      needId: need.id,
      resourceId: resource.id,
      category: validated.category,
      quantity: validated.quantity,
      fulfilledQuantity: 0,
      status: ALLOCATION_STATUS.PENDING_APPROVAL,
      siteId: validated.siteId,
      jurisdictionId: normalize(need.jurisdictionId),
      recommendation: validated.recommendation,
      operatorNote: validated.operatorNote,
      idempotencyKey: validated.idempotencyKey,
      createdBy: actorId(actor),
      approvedBy: null,
      approvedAt: null,
      rejectedReason: null,
      deliveryId: null,
      reservedAt: null,
      dispatchedAt: null,
      deliveredAt: null,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    draft.allocations.unshift(allocation);
    appendAudit(draft, {
      action: 'ALLOCATION_PROPOSED',
      entityType: 'AllocationProposal',
      entityId: allocation.id,
      actor,
      jurisdictionId: allocation.jurisdictionId,
      details: {
        needId: allocation.needId,
        resourceId: allocation.resourceId,
        quantity: allocation.quantity,
        recommendationDecision: allocation.recommendation?.decision || null,
        modelVersion: allocation.recommendation?.modelVersion || null,
      },
    });
    return toStaffAllocation(allocation, draft);
  });
};

/**
 * Human approval gate. Approval and stock reservation happen in one
 * transaction; if stock is insufficient the proposal stays pending.
 * Separation of duty: the proposer cannot approve their own proposal.
 */
export const decideAllocation = (allocationId, input, actor) => {
  assertReliefCapability('allocation.approve', actor);
  const { decision, reason } = validateDecisionInput(input, { requireReason: true });
  const data = ensureReliefData();
  const allocation = data.allocations.find((item) => item.id === allocationId);
  if (!allocation) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, `Allocation "${allocationId}" was not found.`);
  assertReliefJurisdiction(actor, allocation.jurisdictionId);
  if (allocation.createdBy === actorId(actor)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.SEPARATION_OF_DUTY,
      'The person who created a proposal cannot approve or reject it. Ask another reviewer.'
    );
  }
  if (!(ALLOCATION_TRANSITIONS[allocation.status] || []).includes(
    decision === 'approve' ? ALLOCATION_STATUS.APPROVED : ALLOCATION_STATUS.REJECTED
  )) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
      `An allocation in status "${allocation.status}" cannot be ${decision === 'approve' ? 'approved' : 'rejected'}.`,
      { allowed: ALLOCATION_TRANSITIONS[allocation.status] || [] }
    );
  }

  if (decision === 'reject') {
    return transaction((draft) => {
      const target = draft.allocations.find((item) => item.id === allocationId);
      target.status = ALLOCATION_STATUS.REJECTED;
      target.rejectedReason = reason;
      target.approvedBy = actorId(actor);
      target.approvedAt = new Date().toISOString();
      target.updatedAt = target.approvedAt;
      appendAudit(draft, {
        action: 'ALLOCATION_REJECTED',
        entityType: 'AllocationProposal',
        entityId: target.id,
        actor,
        reason,
        jurisdictionId: target.jurisdictionId,
      });
      return toStaffAllocation(target, draft);
    });
  }

  // Validate stock inside the transaction so two approvals cannot over-reserve.
  return transaction((draft) => {
    const target = draft.allocations.find((item) => item.id === allocationId);
    const resource = draft.resources.find((item) => item.id === target.resourceId);
    const need = draft.needs.find((item) => item.id === target.needId);
    if (!resource) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'The stock item no longer exists.');
    if (!need) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'The need report no longer exists.');
    assertReliefJurisdiction(actor, resource.jurisdictionId);
    assertNotExpiredResource(resource);
    if (availableQuantity(resource) < target.quantity) {
      throw new ReliefServiceError(
        RELIEF_ERROR_CODES.INSUFFICIENT_STOCK,
        `Only ${availableQuantity(resource)} ${resource.unit || 'units'} remain unreserved; ${target.quantity} requested.`
      );
    }

    const now = new Date().toISOString();
    const reservedBefore = Number(resource.quantityReserved || 0);
    resource.quantityReserved = reservedBefore + target.quantity;
    syncResourceStatus(resource, now);
    addMovement(draft, {
      resource,
      allocationId: target.id,
      type: STOCK_MOVEMENT_TYPES.RESERVATION,
      quantity: target.quantity,
      reason: 'Reserved on allocation approval',
      actor,
      now,
    });

    target.status = ALLOCATION_STATUS.RESERVED;
    target.approvedBy = actorId(actor);
    target.approvedAt = now;
    target.reservedAt = now;
    target.updatedAt = now;

    if (need.status === NEED_STATUS.VERIFIED) {
      need.status = NEED_STATUS.TRIAGED;
      need.updatedAt = now;
    }
    if (need.status === NEED_STATUS.TRIAGED) {
      need.status = NEED_STATUS.ALLOCATED;
      need.updatedAt = now;
    } else if (need.status !== NEED_STATUS.ALLOCATED) {
      throw new ReliefServiceError(
        RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
        `The linked need is in status "${need.status}" and cannot be allocated.`
      );
    }

    appendAudit(draft, {
      action: 'ALLOCATION_APPROVED_AND_RESERVED',
      entityType: 'AllocationProposal',
      entityId: target.id,
      actor,
      reason,
      jurisdictionId: target.jurisdictionId,
      before: { resourceReserved: reservedBefore },
      after: { resourceReserved: resource.quantityReserved, status: target.status },
    });

    return toStaffAllocation(target, draft);
  });
};

export const listAllocations = (filters = {}, actor) => {
  assertReliefCapability('allocation.read', actor);
  const data = ensureReliefData();
  let allocations = applyScope(data.allocations, actor);
  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    assertReliefJurisdiction(actor, filters.jurisdictionId, { forRead: true });
    allocations = allocations.filter(
      (allocation) => normalize(allocation.jurisdictionId) === normalize(filters.jurisdictionId)
    );
  }
  if (filters.status && filters.status !== 'all') {
    allocations = allocations.filter((allocation) => allocation.status === filters.status);
  }
  if (filters.category && filters.category !== 'all') {
    allocations = allocations.filter((allocation) => allocation.category === filters.category);
  }
  if (filters.needId) allocations = allocations.filter((allocation) => allocation.needId === filters.needId);
  if (filters.searchQuery) {
    const query = String(filters.searchQuery).toLowerCase();
    allocations = allocations.filter(
      (allocation) =>
        allocation.id.toLowerCase().includes(query) ||
        (allocation.needId || '').toLowerCase().includes(query)
    );
  }
  allocations.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const page = paginate(allocations, filters);
  return { ...page, items: page.items.map((allocation) => toStaffAllocation(allocation, data)) };
};

export const getAllocation = (allocationId, actor) => {
  assertReliefCapability('allocation.read', actor);
  const data = ensureReliefData();
  const allocation = data.allocations.find((item) => item.id === allocationId);
  if (!allocation) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Allocation not found.');
  assertReliefJurisdiction(actor, allocation.jurisdictionId);
  return toStaffAllocation(allocation, data);
};

export const dispatchAllocation = (allocationId, input, actor) => {
  assertReliefCapability('allocation.dispatch', actor);
  const validated = validateDispatchInput(input);
  const data = ensureReliefData();
  const allocation = data.allocations.find((item) => item.id === allocationId);
  if (!allocation) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Allocation not found.');
  assertReliefJurisdiction(actor, allocation.jurisdictionId);
  if (!(ALLOCATION_TRANSITIONS[allocation.status] || []).includes(ALLOCATION_STATUS.DISPATCHED)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
      `Only a reserved allocation can be dispatched. Current status: "${allocation.status}".`
    );
  }
  const siteId = validated.siteId || allocation.siteId;
  if (siteId && !data.sites.some((site) => site.id === siteId)) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'The distribution site was not found.');
  }

  return transaction((draft) => {
    const target = draft.allocations.find((item) => item.id === allocationId);
    const now = new Date().toISOString();
    const delivery = {
      id: generateId('DEL-RLF'),
      allocationId: target.id,
      needId: target.needId,
      siteId,
      jurisdictionId: target.jurisdictionId,
      status: DELIVERY_STATUS.EN_ROUTE,
      teamName: validated.teamName,
      vehicleRef: validated.vehicleRef,
      notes: validated.notes,
      dispatchedBy: actorId(actor),
      dispatchedAt: now,
      deliveredQuantity: 0,
      receivedByRole: null,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId(actor),
      schemaVersion: 1,
    };
    target.status = ALLOCATION_STATUS.DISPATCHED;
    target.deliveryId = delivery.id;
    target.dispatchedAt = now;
    target.updatedAt = now;
    draft.deliveries.unshift(delivery);
    appendAudit(draft, {
      action: 'ALLOCATION_DISPATCHED',
      entityType: 'AllocationProposal',
      entityId: target.id,
      actor,
      jurisdictionId: target.jurisdictionId,
      details: { deliveryId: delivery.id, teamName: delivery.teamName, siteId },
    });
    return { allocation: toStaffAllocation(target, draft), delivery };
  });
};

/**
 * Confirms a distribution. Reserved stock is converted into issued stock,
 * unused reservation is released, the need's fulfilled quantity rises, and all
 * records change together or not at all.
 */
export const confirmDelivery = (deliveryOrAllocationId, input, actor) => {
  assertReliefCapability('delivery.confirm', actor);
  const validated = validateDeliveryConfirmationInput(input);
  const data = ensureReliefData();
  const delivery =
    data.deliveries.find((item) => item.id === deliveryOrAllocationId) ||
    data.deliveries.find((item) => item.allocationId === deliveryOrAllocationId);
  if (!delivery) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Delivery record not found.');
  const allocation = data.allocations.find((item) => item.id === delivery.allocationId);
  if (!allocation) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Linked allocation not found.');
  assertReliefJurisdiction(actor, allocation.jurisdictionId);
  if (!(DELIVERY_TRANSITIONS[delivery.status] || []).includes(DELIVERY_STATUS.CONFIRMED)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
      `A delivery in status "${delivery.status}" cannot be confirmed.`
    );
  }
  if (validated.deliveredQuantity < 1) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Delivered quantity must be at least 1. Record a failed delivery instead of confirming zero.'
    );
  }
  if (validated.deliveredQuantity > allocation.quantity) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      `Delivered quantity cannot exceed the reserved quantity of ${allocation.quantity}.`
    );
  }

  return transaction((draft) => {
    const targetDelivery = draft.deliveries.find((item) => item.id === delivery.id);
    const targetAllocation = draft.allocations.find((item) => item.id === allocation.id);
    const resource = draft.resources.find((item) => item.id === targetAllocation.resourceId);
    const need = draft.needs.find((item) => item.id === targetAllocation.needId);
    if (!resource || !need) {
      throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Linked stock or need record no longer exists.');
    }
    if (Number(resource.quantityReserved || 0) < targetAllocation.quantity) {
      throw new ReliefServiceError(
        RELIEF_ERROR_CODES.INSUFFICIENT_STOCK,
        'The reserved stock no longer matches this allocation; refresh before confirming.'
      );
    }

    const now = validated.confirmedAt;
    const released = targetAllocation.quantity - validated.deliveredQuantity;

    resource.quantityOnHand = Math.max(0, Number(resource.quantityOnHand || 0) - validated.deliveredQuantity);
    resource.quantityReserved = Math.max(0, Number(resource.quantityReserved || 0) - targetAllocation.quantity);
    syncResourceStatus(resource, now);
    addMovement(draft, {
      resource,
      allocationId: targetAllocation.id,
      type: STOCK_MOVEMENT_TYPES.ISSUE,
      quantity: validated.deliveredQuantity,
      reason: 'Distribution confirmed',
      actor,
      now,
    });
    if (released > 0) {
      addMovement(draft, {
        resource,
        allocationId: targetAllocation.id,
        type: STOCK_MOVEMENT_TYPES.RELEASE,
        quantity: released,
        reason: 'Unused reservation released after partial delivery',
        actor,
        now,
      });
    }

    targetAllocation.status = ALLOCATION_STATUS.CONFIRMED;
    targetAllocation.fulfilledQuantity = validated.deliveredQuantity;
    targetAllocation.deliveredAt = now;
    targetAllocation.confirmedAt = now;
    targetAllocation.updatedAt = now;

    targetDelivery.status = DELIVERY_STATUS.CONFIRMED;
    targetDelivery.deliveredQuantity = validated.deliveredQuantity;
    targetDelivery.receivedByRole = validated.receivedByRole;
    targetDelivery.note = validated.note;
    targetDelivery.confirmedAt = now;
    targetDelivery.updatedAt = now;

    need.fulfilledQuantity = Math.min(
      need.quantity,
      Number(need.fulfilledQuantity || 0) + validated.deliveredQuantity
    );
    need.status =
      need.fulfilledQuantity >= need.quantity ? NEED_STATUS.FULFILLED : NEED_STATUS.ALLOCATED;
    need.updatedAt = now;

    appendAudit(draft, {
      action: 'DELIVERY_CONFIRMED',
      entityType: 'Delivery',
      entityId: targetDelivery.id,
      actor,
      jurisdictionId: targetAllocation.jurisdictionId,
      details: {
        allocationId: targetAllocation.id,
        deliveredQuantity: validated.deliveredQuantity,
        releasedQuantity: released,
        receivedByRole: validated.receivedByRole,
      },
    });

    return {
      delivery: targetDelivery,
      allocation: toStaffAllocation(targetAllocation, draft),
      need: toPublicNeedProjection(need),
      resource,
    };
  });
};

export const cancelAllocation = (allocationId, { reason = '' } = {}, actor) => {
  assertReliefCapability('allocation.dispatch', actor);
  if (sanitizeText(reason, RELIEF_LIMITS.maxReasonLength).length < 5) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'A reason of at least 5 characters is required to cancel an allocation.'
    );
  }
  const data = ensureReliefData();
  const allocation = data.allocations.find((item) => item.id === allocationId);
  if (!allocation) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Allocation not found.');
  assertReliefJurisdiction(actor, allocation.jurisdictionId);
  if (!(ALLOCATION_TRANSITIONS[allocation.status] || []).includes(ALLOCATION_STATUS.CANCELLED)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.INVALID_STATE_TRANSITION,
      `An allocation in status "${allocation.status}" cannot be cancelled.`
    );
  }

  return transaction((draft) => {
    const target = draft.allocations.find((item) => item.id === allocationId);
    const now = new Date().toISOString();
    const wasReserved = [ALLOCATION_STATUS.RESERVED, ALLOCATION_STATUS.DISPATCHED].includes(target.status);

    if (wasReserved) {
      const resource = draft.resources.find((item) => item.id === target.resourceId);
      if (resource) {
        resource.quantityReserved = Math.max(0, Number(resource.quantityReserved || 0) - target.quantity);
        syncResourceStatus(resource, now);
        addMovement(draft, {
          resource,
          allocationId: target.id,
          type: STOCK_MOVEMENT_TYPES.RELEASE,
          quantity: target.quantity,
          reason: `Allocation cancelled: ${reason}`,
          actor,
          now,
        });
      }
    }

    const need = draft.needs.find((item) => item.id === target.needId);
    if (need && need.status === NEED_STATUS.ALLOCATED) {
      need.status = NEED_STATUS.TRIAGED;
      need.updatedAt = now;
    }

    draft.deliveries
      .filter((delivery) => delivery.allocationId === target.id && delivery.status !== DELIVERY_STATUS.CONFIRMED)
      .forEach((delivery) => {
        delivery.status = DELIVERY_STATUS.CANCELLED;
        delivery.updatedAt = now;
      });

    target.status = ALLOCATION_STATUS.CANCELLED;
    target.cancellationReason = reason;
    target.updatedAt = now;

    appendAudit(draft, {
      action: 'ALLOCATION_CANCELLED',
      entityType: 'AllocationProposal',
      entityId: target.id,
      actor,
      reason,
      jurisdictionId: target.jurisdictionId,
      details: { releasedReservation: wasReserved },
    });
    return toStaffAllocation(target, draft);
  });
};

// ── Forecast runs & recommendations ─────────────────────────────────────────

export const runReliefForecast = (options = {}, actor) => {
  assertReliefCapability('forecast.run', actor);
  const data = ensureReliefData();
  let needs = applyScope(data.needs, actor);
  if (options.jurisdictionId && options.jurisdictionId !== 'all') {
    assertReliefJurisdiction(actor, options.jurisdictionId);
    needs = needs.filter((need) => normalize(need.jurisdictionId) === normalize(options.jurisdictionId));
  }

  const run = runNeedsForecast(needs, {
    now: options.now,
    windowDays: options.windowDays,
    fallback: options.fallback,
    engineAvailable: options.engineAvailable,
  });

  return transaction((draft) => {
    draft.forecastRuns.unshift({
      ...run,
      jurisdictionId: options.jurisdictionId || 'all',
      requestedBy: actorId(actor),
      createdAt: run.executedAt,
      schemaVersion: 1,
    });
    // Keep the 50 most recent runs; older runs are still available in exports.
    draft.forecastRuns = draft.forecastRuns.slice(0, 50);
    appendAudit(draft, {
      action: 'FORECAST_RUN',
      entityType: 'ForecastRun',
      entityId: run.runId,
      actor,
      jurisdictionId: options.jurisdictionId || null,
      details: {
        modelVersion: run.modelVersion,
        recommendationCount: run.recommendations.length,
        fallbackMode: run.fallbackMode,
        featureWindowDays: run.featureWindow.days,
      },
    });
    return { ...run, jurisdictionId: options.jurisdictionId || 'all' };
  });
};

export const getLatestForecastRun = (filters = {}, actor) => {
  assertReliefCapability('allocation.read', actor);
  const data = ensureReliefData();
  const runs = data.forecastRuns.filter((run) => {
    if (!filters.jurisdictionId || filters.jurisdictionId === 'all') return true;
    return run.jurisdictionId === filters.jurisdictionId || run.jurisdictionId === 'all';
  });
  return runs[0] || null;
};

/**
 * Records an operator's explicit accept/edit/reject decision on a
 * recommendation. Rejections are audit-only; accepted and edited decisions are
 * captured on the allocation proposal that follows.
 */
export const recordRecommendationDecision = (
  { recommendationId, modelVersion, decision, recommendedQuantity, operatorNote = '', executedAt },
  actor
) => {
  assertReliefCapability('allocation.propose', actor);
  if (!['accepted', 'edited', 'rejected'].includes(decision)) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'Recommendation decision must be accepted, edited or rejected.'
    );
  }
  if (decision === 'edited' && !Number.isFinite(Number(recommendedQuantity))) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'An edited recommendation requires a numeric quantity.'
    );
  }
  return transaction((draft) => {
    const entry = appendAudit(draft, {
      action: `RECOMMENDATION_${decision.toUpperCase()}`,
      entityType: 'Recommendation',
      entityId: sanitizeText(recommendationId, 80),
      actor,
      details: {
        modelVersion: sanitizeText(modelVersion, 80),
        recommendedQuantity: recommendedQuantity ?? null,
        note: sanitizeText(operatorNote, RELIEF_LIMITS.maxNotesLength),
        executedAt: executedAt || null,
      },
    });
    return entry;
  });
};

// ── Public status ────────────────────────────────────────────────────────────

/**
 * Safe aggregate view for citizens. No need IDs, descriptions, coordinates,
 * tokens, private notes or reporter references are included.
 */
export const getPublicReliefStatus = ({ jurisdictionId = null, now = Date.now() } = {}) => {
  const data = ensureReliefData();
  const inScope = (item) =>
    !jurisdictionId || normalize(item.jurisdictionId) === normalize(jurisdictionId);

  const needs = data.needs.filter((need) => isOpenNeed(need) && !need.archived && inScope(need));
  const summary = summarizeUnmetNeeds(needs, { now });
  const incidents = data.incidents
    .filter((incident) => inScope(incident))
    .map(toPublicIncidentProjection)
    .filter(Boolean);
  const sites = data.sites
    .filter((site) => site.isPublic !== false && inScope(site))
    .map(toPublicSiteProjection)
    .filter(Boolean);
  const recentDeliveries = data.allocations.filter(
    (allocation) => allocation.status === ALLOCATION_STATUS.CONFIRMED && inScope(allocation)
  );
  const lastUpdated = needs.reduce((latest, need) => {
    const stamp = Date.parse(need.updatedAt || need.createdAt || 0);
    return Number.isNaN(stamp) ? latest : Math.max(latest, stamp);
  }, 0);
  const confirmedUnits = recentDeliveries.reduce(
    (sum, allocation) => sum + Number(allocation.fulfilledQuantity || 0),
    0
  );

  return {
    generatedAt: new Date(now).toISOString(),
    jurisdictionId: jurisdictionId ? normalize(jurisdictionId) : null,
    openNeedCount: summary.totalOpenReports,
    peopleAffected: summary.totalPeopleAffected,
    confirmedDistributionCount: recentDeliveries.length,
    confirmedUnitsDistributed: confirmedUnits,
    byCategory: summary.byCategory.map((item) => ({
      category: item.category,
      categoryLabel: item.categoryLabel,
      reportCount: item.reportCount,
      remainingQuantity: item.remainingQuantity,
      peopleAffected: item.peopleAffected,
      staleCount: item.staleCount,
    })),
    byLocality: summary.byLocality.map((item) => ({
      locality: item.locality,
      jurisdictionId: item.jurisdictionId,
      reportCount: item.reportCount,
      peopleAffected: item.peopleAffected,
      remainingQuantity: item.remainingQuantity,
      staleCount: item.staleCount,
      lastUpdatedAt: item.lastUpdatedAt,
    })),
    incidents,
    distributionSites: sites,
    lastUpdatedAt: lastUpdated ? new Date(lastUpdated).toISOString() : null,
    publicFields: [
      'category',
      'locality',
      'peopleAffected',
      'remainingQuantity',
      'incident name and public summary',
      'public distribution site details',
    ],
    disclaimer:
      'Figures are aggregated from verified and submitted reports. They are indicative, may lag field assessments, and do not replace emergency instructions from district authorities.',
  };
};

// ── Operator metrics ─────────────────────────────────────────────────────────

export const getReliefMetrics = (filters = {}, actor) => {
  assertReliefCapability('need.read', actor);
  const data = ensureReliefData();
  const scoped = (items) => {
    const itemsInScope = applyScope(items, actor);
    const requested = filters.jurisdictionId;
    if (!requested || requested === 'all') return itemsInScope;
    const target = normalize(requested);
    return itemsInScope.filter((item) => normalize(item.jurisdictionId) === target);
  };
  const needs = scoped(data.needs);
  const resources = scoped(data.resources);
  const allocations = scoped(data.allocations);
  const incidents = scoped(data.incidents);
  const deliveries = scoped(data.deliveries);

  const openNeeds = needs.filter((need) => isOpenNeed(need) && !need.archived);
  const pendingApprovals = allocations.filter(
    (allocation) => allocation.status === ALLOCATION_STATUS.PENDING_APPROVAL
  );
  const reservedUnits = resources.reduce((sum, resource) => sum + Number(resource.quantityReserved || 0), 0);

  return {
    activeIncidents: incidents.filter((incident) =>
      [INCIDENT_STATUS.ACTIVE, INCIDENT_STATUS.CONTAINMENT].includes(incident.status)
    ).length,
    openNeeds: openNeeds.length,
    peopleAffected: openNeeds.reduce((sum, need) => sum + Number(need.peopleAffected || 0), 0),
    unverifiedNeeds: openNeeds.filter((need) => need.status === NEED_STATUS.SUBMITTED).length,
    staleNeeds: openNeeds.filter((need) => isNeedStale(need)).length,
    pendingApprovals: pendingApprovals.length,
    reservedUnits,
    confirmedDeliveries: deliveries.filter((delivery) => delivery.status === DELIVERY_STATUS.CONFIRMED).length,
    inventoryItems: resources.length,
    expiredInventoryItems: resources.filter(
      (resource) => resource.status === RESOURCE_STATUS.EXPIRED || resource.status === RESOURCE_STATUS.QUARANTINED
    ).length,
    generatedAt: new Date().toISOString(),
  };
};

// ── Partner verification ─────────────────────────────────────────────────────

export const createPartnerVerification = (input, actor) => {
  assertReliefCapability('partner.verify', actor);
  const validated = validatePartnerInput(input);
  return transaction((data) => {
    const now = new Date().toISOString();
    const partner = {
      id: generateId('PARTNER-RLF'),
      ...validated,
      verifiedBy: validated.status === PARTNER_STATUS.VERIFIED ? actorId(actor) : null,
      verifiedAt: validated.status === PARTNER_STATUS.VERIFIED ? now : null,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId(actor),
      schemaVersion: 1,
    };
    data.partners.unshift(partner);
    appendAudit(data, {
      action: 'PARTNER_RECORD_CREATED',
      entityType: 'PartnerVerification',
      entityId: partner.id,
      actor,
      jurisdictionId: partner.jurisdictionId,
      details: { status: partner.status },
    });
    return partner;
  });
};

export const setPartnerStatus = (partnerId, { status, reason = '' } = {}, actor) => {
  assertReliefCapability('partner.verify', actor);
  if (!Object.values(PARTNER_STATUS).includes(status)) {
    throw new ReliefServiceError(RELIEF_ERROR_CODES.VALIDATION_ERROR, 'Invalid partner status.');
  }
  if (status !== PARTNER_STATUS.VERIFIED && sanitizeText(reason, RELIEF_LIMITS.maxReasonLength).length < 5) {
    throw new ReliefServiceError(
      RELIEF_ERROR_CODES.VALIDATION_ERROR,
      'A reason is required when suspending or revoking a partner.'
    );
  }
  return transaction((data) => {
    const partner = data.partners.find((item) => item.id === partnerId);
    if (!partner) throw new ReliefServiceError(RELIEF_ERROR_CODES.NOT_FOUND, 'Partner record not found.');
    const now = new Date().toISOString();
    const previous = partner.status;
    partner.status = status;
    partner.verificationNote = reason || partner.verificationNote;
    partner.updatedAt = now;
    if (status === PARTNER_STATUS.VERIFIED) {
      partner.verifiedBy = actorId(actor);
      partner.verifiedAt = now;
    }
    appendAudit(data, {
      action: 'PARTNER_STATUS_CHANGED',
      entityType: 'PartnerVerification',
      entityId: partner.id,
      actor,
      reason,
      jurisdictionId: partner.jurisdictionId,
      before: { status: previous },
      after: { status },
    });
    return partner;
  });
};

export const listPartners = (filters = {}, actor) => {
  assertReliefCapability('audit.read', actor);
  const data = ensureReliefData();
  let partners = applyScope(data.partners, actor);
  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    partners = partners.filter((partner) => normalize(partner.jurisdictionId) === normalize(filters.jurisdictionId));
  }
  if (filters.status && filters.status !== 'all') {
    partners = partners.filter((partner) => partner.status === filters.status);
  }
  return partners.map((partner) => ({
    ...partner,
    statusLabel: PARTNER_STATUS_LABELS[partner.status] || partner.status,
  }));
};

// ── Audit ────────────────────────────────────────────────────────────────────

export const getReliefAuditTrail = (filters = {}, actor) => {
  assertReliefCapability('audit.read', actor);
  const data = ensureReliefData();
  let logs = applyScope(data.auditLogs, actor);
  if (filters.entityType) logs = logs.filter((entry) => entry.entityType === filters.entityType);
  if (filters.entityId) logs = logs.filter((entry) => entry.entityId === filters.entityId);
  if (filters.action) logs = logs.filter((entry) => entry.action === filters.action);
  if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
    logs = logs.filter((entry) => normalize(entry.jurisdictionId) === normalize(filters.jurisdictionId));
  }
  return paginate(logs, filters);
};

// ── Reference exports used by the UI ────────────────────────────────────────

export const RELIEF_UI_REFERENCE = Object.freeze({
  roles: RELIEF_ROLES,
  staffRoles: RELIEF_STAFF_ROLES,
  needStatuses: NEED_STATUS,
  needStatusLabels: NEED_STATUS_LABELS,
  allocationStatuses: ALLOCATION_STATUS,
  allocationStatusLabels: ALLOCATION_STATUS_LABELS,
  deliveryStatuses: DELIVERY_STATUS,
  deliveryStatusLabels: DELIVERY_STATUS_LABELS,
  categories: RELIEF_CATEGORIES,
  categoryLabels: RELIEF_CATEGORY_LABELS,
  priorityTiers: PRIORITY_TIERS,
  confidenceLevels: CONFIDENCE_LEVELS,
  modelVersion: RELIEF_FORECAST_MODEL_VERSION,
});

export const RELIEF_SERVICE_ERROR_CODES = RELIEF_ERROR_CODES;
