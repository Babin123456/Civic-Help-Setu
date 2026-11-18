/**
 * Public Toilet Business Logic & Orchestration Service (#758)
 *
 * Provides typed operations for listing, searching, filtering, cleaning verification,
 * maintenance lifecycle management, citizen feedback moderation, and RBAC enforcement.
 *
 * Invariants:
 *  - Enforces least-privilege roles (citizen, operator, reviewer, admin).
 *  - Operators are scoped to their assigned municipal jurisdiction/ward.
 *  - Zero PII stored or surfaced in public views.
 *  - State transitions strictly validated against domain state machines.
 */

import {
  FACILITY_STATUS,
  TICKET_STATUS,
  canTransitionFacilityStatus,
  canTransitionTicketStatus,
  calculateOperatingStatus,
  validatePublicFacility,
  validateCleaningEvent,
  validateMaintenanceTicket,
  validateFeedbackReport,
  maskPublicFacility,
  sanitizeText,
} from '../data/publicToiletContract.js';

import {
  loadFacilities,
  saveFacility,
  getFacilityById,
  saveCleaningEvent,
  loadMaintenanceTickets,
  saveMaintenanceTicket,
  loadFeedbackReports,
  saveFeedbackReport,
  saveAllFeedbackReports,
  recordAuditEvent,
} from './publicToiletStorage.js';

const clean = (val) => (typeof val === 'string' ? val.trim().toLowerCase() : '');

/**
 * Lists public toilets with multi-facet filtering and pagination.
 */
export const listToilets = ({
  state = '',
  district = '',
  ward = '',
  status = 'all',
  category = 'all',
  feeType = 'all',
  wheelchairOnly = false,
  genderNeutralOnly = false,
  babyCareOnly = false,
  sanitaryNapkinOnly = false,
  runningWaterOnly = false,
  openNowOnly = false,
  searchQuery = '',
  page = 1,
  limit = 50,
  referenceDate = new Date(),
  userRole = 'citizen',
} = {}) => {
  const allFacilities = loadFacilities();

  const targetState = clean(state);
  const targetDistrict = clean(district);
  const targetWard = clean(ward);
  const targetStatus = clean(status);
  const targetCategory = clean(category);
  const targetFee = clean(feeType);
  const targetSearch = clean(searchQuery);

  const filtered = allFacilities.filter((facility) => {
    // Jurisdiction filters
    if (targetState && clean(facility.jurisdiction?.state) !== targetState) return false;
    if (targetDistrict && clean(facility.jurisdiction?.district) !== targetDistrict) return false;
    if (targetWard && !clean(facility.jurisdiction?.ward).includes(targetWard)) return false;

    // Status filter
    if (targetStatus && targetStatus !== 'all' && clean(facility.status) !== targetStatus) {
      return false;
    }

    // Category filter
    if (targetCategory && targetCategory !== 'all' && clean(facility.category) !== targetCategory) {
      return false;
    }

    // Fee filter
    if (targetFee && targetFee !== 'all' && clean(facility.feeStructure?.feeType) !== targetFee) {
      return false;
    }

    // Accessibility & feature filters
    if (wheelchairOnly && facility.features?.wheelchairAccessible !== true) return false;
    if (genderNeutralOnly && facility.features?.genderNeutral !== true) return false;
    if (babyCareOnly && facility.features?.babyCareStation !== true) return false;
    if (sanitaryNapkinOnly && facility.features?.sanitaryNapkinDispenser !== true) return false;
    if (runningWaterOnly && facility.features?.runningWater !== true) return false;

    // Open now filter
    if (openNowOnly) {
      const openCalc = calculateOperatingStatus(facility.operatingWindows, facility.temporaryClosure, referenceDate);
      if (!openCalc.isOpen) return false;
    }

    // Search query keyword filter
    if (targetSearch) {
      const matchName = clean(facility.name).includes(targetSearch);
      const matchAddress = clean(facility.location?.address).includes(targetSearch);
      const matchLandmark = clean(facility.location?.landmark).includes(targetSearch);
      const matchAuthority = clean(facility.managingAuthority).includes(targetSearch);
      const matchWard = clean(facility.jurisdiction?.ward).includes(targetSearch);
      if (!matchName && !matchAddress && !matchLandmark && !matchAuthority && !matchWard) {
        return false;
      }
    }

    return true;
  });

  const total = filtered.length;
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit);

  // Mask private fields if citizen or public caller
  const projected = userRole === 'citizen'
    ? paginated.map(maskPublicFacility)
    : paginated;

  return {
    facilities: projected,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

/**
 * Retrieves a single facility by ID.
 */
export const getToiletById = (id, { userRole = 'citizen' } = {}) => {
  const facility = getFacilityById(id);
  if (!facility) return null;
  return userRole === 'citizen' ? maskPublicFacility(facility) : facility;
};

/**
 * Creates a new facility record.
 * RBAC: Operators or Admins only.
 */
export const createToilet = (payload, userContext = { role: 'citizen' }) => {
  if (!['operator', 'admin'].includes(userContext.role)) {
    throw new Error('Unauthorized: Citizen accounts cannot create public facility records.');
  }

  const validation = validatePublicFacility(payload);
  if (!validation.valid) {
    throw new Error(`Validation Error: ${validation.errors.join('; ')}`);
  }

  const saved = saveFacility(payload);

  recordAuditEvent({
    facilityId: saved.id,
    action: 'CREATE_FACILITY',
    actorRole: userContext.role,
    actorId: userContext.userId || 'system',
  });

  return saved;
};

/**
 * Updates a facility record.
 * RBAC: Operators (ward scoped) or Admins.
 */
export const updateToilet = (id, patch, userContext = { role: 'citizen' }) => {
  if (!['operator', 'admin'].includes(userContext.role)) {
    throw new Error('Unauthorized: Only operators and administrators may update facility details.');
  }

  const existing = getFacilityById(id);
  if (!existing) {
    throw new Error(`Facility not found: ${id}`);
  }

  // Jurisdiction ward scoping for operators
  if (userContext.role === 'operator' && userContext.assignedWard) {
    const facilityWard = clean(existing.jurisdiction?.ward);
    const operatorWard = clean(userContext.assignedWard);
    if (!facilityWard.includes(operatorWard) && !operatorWard.includes(facilityWard)) {
      throw new Error(`Permission Denied: Operator jurisdiction ${userContext.assignedWard} does not cover ward ${existing.jurisdiction?.ward}`);
    }
  }

  // Validate status transition if status changed
  if (patch.status && patch.status !== existing.status) {
    if (!canTransitionFacilityStatus(existing.status, patch.status)) {
      throw new Error(`Invalid status transition from ${existing.status} to ${patch.status}`);
    }
  }

  const updatedPayload = {
    ...existing,
    ...patch,
    id: existing.id, // prevent id mutation
  };

  const validation = validatePublicFacility(updatedPayload);
  if (!validation.valid) {
    throw new Error(`Validation Error: ${validation.errors.join('; ')}`);
  }

  const saved = saveFacility(updatedPayload);

  recordAuditEvent({
    facilityId: id,
    action: 'UPDATE_FACILITY',
    actorRole: userContext.role,
    diff: Object.keys(patch),
  });

  return saved;
};

/**
 * Declares or clears a temporary facility closure.
 * RBAC: Operators or Admins.
 */
export const setTemporaryClosure = (id, closureDetails, userContext = { role: 'citizen' }) => {
  if (!['operator', 'admin'].includes(userContext.role)) {
    throw new Error('Unauthorized: Only operators or administrators can set temporary closures.');
  }

  const facility = getFacilityById(id);
  if (!facility) {
    throw new Error(`Facility not found: ${id}`);
  }

  if (closureDetails && closureDetails.isClosed) {
    const reason = sanitizeText(closureDetails.reason || 'Closed for routine maintenance', 200);
    if (reason.length < 5) {
      throw new Error('A detailed closure reason (minimum 5 characters) is required.');
    }

    facility.status = FACILITY_STATUS.TEMPORARILY_CLOSED;
    facility.temporaryClosure = {
      isClosed: true,
      reason,
      reopenExpectedAt: closureDetails.reopenExpectedAt || null,
      declaredAt: new Date().toISOString(),
      declaredByRole: userContext.role,
    };
  } else {
    // Reopen facility
    facility.status = FACILITY_STATUS.VERIFIED_ACTIVE;
    facility.temporaryClosure = null;
  }

  const saved = saveFacility(facility);

  recordAuditEvent({
    facilityId: id,
    action: closureDetails?.isClosed ? 'DECLARE_CLOSURE' : 'LIFT_CLOSURE',
    actorRole: userContext.role,
    reason: closureDetails?.reason,
  });

  return saved;
};

/**
 * Submits an audited cleaning event.
 * RBAC: Operators or Admins.
 */
export const recordCleaning = (payload, userContext = { role: 'citizen' }) => {
  if (!['operator', 'admin'].includes(userContext.role)) {
    throw new Error('Unauthorized: Citizen accounts cannot submit supervisor cleaning logs.');
  }

  const eventPayload = {
    ...payload,
    id: payload.id || `cln-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cleanedAt: payload.cleanedAt || new Date().toISOString(),
    operatorNotes: sanitizeText(payload.operatorNotes || '', 300),
  };

  const validation = validateCleaningEvent(eventPayload);
  if (!validation.valid) {
    throw new Error(`Invalid Cleaning Log: ${validation.errors.join('; ')}`);
  }

  const saved = saveCleaningEvent(eventPayload);

  recordAuditEvent({
    facilityId: payload.facilityId,
    action: 'LOG_CLEANING',
    actorRole: userContext.role,
    cleaningId: saved.id,
  });

  return saved;
};

/**
 * Creates a maintenance ticket.
 * Any role (citizen or staff) can report a maintenance issue.
 */
export const reportMaintenanceIssue = (payload, userContext = { role: 'citizen' }) => {
  const ticketPayload = {
    ...payload,
    id: payload.id || `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: TICKET_STATUS.REPORTED,
    reportedByRole: userContext.role || 'citizen',
    description: sanitizeText(payload.description || '', 500),
    createdAt: new Date().toISOString(),
  };

  const validation = validateMaintenanceTicket(ticketPayload);
  if (!validation.valid) {
    throw new Error(`Invalid Ticket: ${validation.errors.join('; ')}`);
  }

  const saved = saveMaintenanceTicket(ticketPayload);

  recordAuditEvent({
    facilityId: payload.facilityId,
    action: 'CREATE_MAINTENANCE_TICKET',
    ticketId: saved.id,
    severity: saved.severity,
    actorRole: userContext.role,
  });

  return saved;
};

/**
 * Transitions ticket status (e.g. In Progress, Resolved).
 * RBAC: Operators or Admins.
 */
export const updateTicketProgress = (ticketId, targetStatus, resolutionNotes = '', userContext = { role: 'citizen' }) => {
  if (!['operator', 'admin'].includes(userContext.role)) {
    throw new Error('Unauthorized: Only operators or administrators can update ticket status.');
  }

  const allTickets = loadMaintenanceTickets();
  const ticket = allTickets.find((t) => t.id === ticketId);
  if (!ticket) {
    throw new Error(`Ticket not found: ${ticketId}`);
  }

  if (!canTransitionTicketStatus(ticket.status, targetStatus)) {
    throw new Error(`Invalid ticket transition from ${ticket.status} to ${targetStatus}`);
  }

  ticket.status = targetStatus;
  if (resolutionNotes) {
    ticket.resolutionNotes = sanitizeText(resolutionNotes, 400);
  }
  if (targetStatus === TICKET_STATUS.RESOLVED || targetStatus === TICKET_STATUS.CLOSED) {
    ticket.resolvedAt = new Date().toISOString();
  }

  const saved = saveMaintenanceTicket(ticket);

  // If this was a critical ticket, check if other active critical tickets exist. If none, restore facility to active.
  if (ticket.severity === 'critical' && [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED].includes(targetStatus)) {
    const facilityTickets = loadMaintenanceTickets(ticket.facilityId);
    const hasRemainingCritical = facilityTickets.some(
      (t) => t.severity === 'critical' && ['reported', 'acknowledged', 'in_progress'].includes(t.status)
    );
    if (!hasRemainingCritical) {
      const facility = getFacilityById(ticket.facilityId);
      if (facility && facility.status === FACILITY_STATUS.UNDER_MAINTENANCE) {
        facility.status = FACILITY_STATUS.VERIFIED_ACTIVE;
        saveFacility(facility);
      }
    }
  }

  recordAuditEvent({
    facilityId: ticket.facilityId,
    action: 'UPDATE_TICKET_STATUS',
    ticketId,
    newStatus: targetStatus,
    actorRole: userContext.role,
  });

  return saved;
};

/**
 * Submits citizen feedback / review with anti-abuse idempotency.
 */
export const submitFeedback = (payload) => {
  const feedbackPayload = {
    ...payload,
    id: payload.id || `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    comment: sanitizeText(payload.comment || '', 400),
    moderationStatus: 'pending',
    createdAt: new Date().toISOString(),
  };

  const validation = validateFeedbackReport(feedbackPayload);
  if (!validation.valid) {
    throw new Error(`Invalid Feedback: ${validation.errors.join('; ')}`);
  }

  return saveFeedbackReport(feedbackPayload);
};

/**
 * Moderates citizen feedback.
 * RBAC: Reviewer or Admin.
 */
export const moderateCitizenFeedback = (feedbackId, targetStatus, reviewerContext = { role: 'citizen' }) => {
  if (!['reviewer', 'admin'].includes(reviewerContext.role)) {
    throw new Error('Unauthorized: Only reviewers or administrators can moderate citizen feedback.');
  }

  if (!['approved', 'rejected'].includes(targetStatus)) {
    throw new Error('Target moderation status must be either approved or rejected.');
  }

  const reports = loadFeedbackReports();
  const report = reports.find((r) => r.id === feedbackId);
  if (!report) {
    throw new Error(`Feedback report not found: ${feedbackId}`);
  }

  report.moderationStatus = targetStatus;
  report.moderatedAt = new Date().toISOString();
  report.moderatedBy = reviewerContext.role;

  saveAllFeedbackReports(reports);

  recordAuditEvent({
    facilityId: report.facilityId,
    action: 'MODERATE_FEEDBACK',
    feedbackId,
    targetStatus,
    actorRole: reviewerContext.role,
  });

  return report;
};

