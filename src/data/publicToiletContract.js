/**
 * Public Toilet Availability, Accessibility, and Maintenance Data Contract (#758)
 *
 * Provides normalized schemas, state transitions, validation boundaries,
 * operating-hour logic, zero-PII sanitization, and public view projections.
 */

export const SCHEMA_VERSION = 1;

export const FACILITY_STATUS = Object.freeze({
  VERIFIED_ACTIVE: 'verified_active',
  TEMPORARILY_CLOSED: 'temporarily_closed',
  UNDER_MAINTENANCE: 'under_maintenance',
  DECOMMISSIONED: 'decommissioned',
});

export const FACILITY_CATEGORIES = Object.freeze({
  STANDALONE_URINAL: 'standalone_urinal',
  PUBLIC_CONVENIENCE_COMPLEX: 'public_convenience_complex',
  SHE_TOILET: 'she_toilet',
  TRANSIT_HUB_TOILET: 'transit_hub_toilet',
  DELUXE_PAY_AND_USE: 'deluxe_pay_and_use',
});

export const CATEGORY_LABELS = Object.freeze({
  [FACILITY_CATEGORIES.STANDALONE_URINAL]: 'Standalone Public Urinal',
  [FACILITY_CATEGORIES.PUBLIC_CONVENIENCE_COMPLEX]: 'Public Convenience Complex (Community Block)',
  [FACILITY_CATEGORIES.SHE_TOILET]: 'She-Toilet (Exclusively for Women & Children)',
  [FACILITY_CATEGORIES.TRANSIT_HUB_TOILET]: 'Transit Hub Toilet (Bus / Metro / Railway)',
  [FACILITY_CATEGORIES.DELUXE_PAY_AND_USE]: 'Deluxe Pay-and-Use Complex',
});

export const FEE_TYPES = Object.freeze({
  FREE: 'free',
  PAY_AND_USE: 'pay_and_use',
  SUBSIDIZED: 'subsidized',
});

export const TICKET_STATUS = Object.freeze({
  REPORTED: 'reported',
  ACKNOWLEDGED: 'acknowledged',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REJECTED: 'rejected',
});

export const TICKET_SEVERITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const TICKET_CATEGORIES = Object.freeze({
  PLUMBING_LEAK: 'plumbing_leak',
  CLOGGED_DRAIN: 'clogged_drain',
  BROKEN_FIXTURE: 'broken_fixture',
  LIGHTING_ELECTRICAL: 'lighting_electrical',
  DOOR_LOCK_BROKEN: 'door_lock_broken',
  WATER_OUTAGE: 'water_outage',
  CONSUMABLES_EMPTY: 'consumables_empty',
  HYGIENE_CLEANLINESS: 'hygiene_cleanliness',
  STRUCTURAL_DAMAGE: 'structural_damage',
});

export const FEEDBACK_MODERATION_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const ROLES = Object.freeze({
  CITIZEN: 'citizen',
  OPERATOR: 'operator',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
});

// Explicit state machine transitions
export const FACILITY_STATE_TRANSITIONS = Object.freeze({
  [FACILITY_STATUS.VERIFIED_ACTIVE]: [
    FACILITY_STATUS.TEMPORARILY_CLOSED,
    FACILITY_STATUS.UNDER_MAINTENANCE,
    FACILITY_STATUS.DECOMMISSIONED,
  ],
  [FACILITY_STATUS.TEMPORARILY_CLOSED]: [
    FACILITY_STATUS.VERIFIED_ACTIVE,
    FACILITY_STATUS.UNDER_MAINTENANCE,
    FACILITY_STATUS.DECOMMISSIONED,
  ],
  [FACILITY_STATUS.UNDER_MAINTENANCE]: [
    FACILITY_STATUS.VERIFIED_ACTIVE,
    FACILITY_STATUS.TEMPORARILY_CLOSED,
    FACILITY_STATUS.DECOMMISSIONED,
  ],
  [FACILITY_STATUS.DECOMMISSIONED]: [], // Terminal state
});

export const TICKET_STATE_TRANSITIONS = Object.freeze({
  [TICKET_STATUS.REPORTED]: [
    TICKET_STATUS.ACKNOWLEDGED,
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.REJECTED,
  ],
  [TICKET_STATUS.ACKNOWLEDGED]: [
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.REJECTED,
  ],
  [TICKET_STATUS.IN_PROGRESS]: [
    TICKET_STATUS.RESOLVED,
    TICKET_STATUS.ACKNOWLEDGED,
  ],
  [TICKET_STATUS.RESOLVED]: [
    TICKET_STATUS.CLOSED,
    TICKET_STATUS.IN_PROGRESS,
  ],
  [TICKET_STATUS.CLOSED]: [], // Terminal state
  [TICKET_STATUS.REJECTED]: [], // Terminal state
});

export const canTransitionFacilityStatus = (currentStatus, targetStatus) => {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true;
  const allowed = FACILITY_STATE_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
};

export const canTransitionTicketStatus = (currentStatus, targetStatus) => {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true;
  const allowed = TICKET_STATE_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
};

// Zero-PII Regex Safeguards
const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(?:\+91|0)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export const containsPII = (text) => {
  if (typeof text !== 'string') return false;
  return (
    AADHAAR_REGEX.test(text) ||
    PAN_REGEX.test(text) ||
    PHONE_REGEX.test(text) ||
    EMAIL_REGEX.test(text)
  );
};

export const sanitizeText = (val, maxLen = 500) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // strip HTML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

/**
 * Calculates current open/closed status from operating windows and closure status.
 * Handles 24/7, cross-midnight shifts (e.g. 18:00 to 02:00), and closure expiration.
 */
export const calculateOperatingStatus = (operatingWindows, temporaryClosure = null, referenceDate = new Date()) => {
  const now = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();

  // 1. Check temporary closure first
  if (temporaryClosure && temporaryClosure.isClosed) {
    const reopenDate = temporaryClosure.reopenExpectedAt
      ? new Date(temporaryClosure.reopenExpectedAt)
      : null;

    if (!reopenDate || reopenDate > now) {
      return {
        isOpen: false,
        statusTag: 'temporarily_closed',
        label: 'Temporarily Closed',
        reason: temporaryClosure.reason || 'Closed for maintenance/inspection',
        reopenExpectedAt: temporaryClosure.reopenExpectedAt || null,
        isTemporary: true,
      };
    }
    // Closure timestamp has passed; closure expired, proceed to regular window
  }

  // 2. Check 24/7 flag
  if (operatingWindows?.is24x7) {
    return {
      isOpen: true,
      statusTag: 'open_24x7',
      label: 'Open 24/7',
      reason: 'Open continuously 24 hours daily',
      is24x7: true,
    };
  }

  const schedule = operatingWindows?.schedule;
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return {
      isOpen: true,
      statusTag: 'standard_hours',
      label: 'Hours Not Specified',
      reason: 'General operating window applies',
    };
  }

  const currentDay = now.getDay(); // 0 is Sunday, 6 is Saturday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Check if today is scheduled
  const dayWindow = schedule.find((item) => item.day === currentDay);
  if (!dayWindow || dayWindow.isOff) {
    return {
      isOpen: false,
      statusTag: 'closed_for_day',
      label: 'Closed Today',
      reason: 'Scheduled weekly closure/maintenance day',
    };
  }

  const parseTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const openMin = parseTime(dayWindow.open);
  const closeMin = parseTime(dayWindow.close);

  if (openMin === null || closeMin === null) {
    return {
      isOpen: true,
      statusTag: 'open_default',
      label: 'Open',
      reason: 'Standard municipal window',
    };
  }

  // Handle standard vs cross-midnight window
  const isOpenNow = closeMin > openMin
    ? currentMinutes >= openMin && currentMinutes < closeMin
    : currentMinutes >= openMin || currentMinutes < closeMin;

  return {
    isOpen: isOpenNow,
    statusTag: isOpenNow ? 'open_now' : 'closed_now',
    label: isOpenNow ? 'Open Now' : 'Closed Now',
    reason: isOpenNow
      ? `Open until ${dayWindow.close}`
      : `Closed (Hours: ${dayWindow.open} - ${dayWindow.close})`,
    todayHours: `${dayWindow.open} - ${dayWindow.close}`,
  };
};

/**
 * Validates a PublicFacility entity.
 */
export const validatePublicFacility = (facility) => {
  const errors = [];
  if (!facility || typeof facility !== 'object') {
    return { valid: false, errors: ['Facility payload must be a non-null object.'] };
  }

  if (!facility.id || typeof facility.id !== 'string' || facility.id.trim().length < 3) {
    errors.push('Facility id is required and must be at least 3 characters.');
  }

  if (!facility.name || typeof facility.name !== 'string' || facility.name.trim().length < 3) {
    errors.push('Facility name is required and must be at least 3 characters.');
  }

  if (!Object.values(FACILITY_CATEGORIES).includes(facility.category)) {
    errors.push(`Invalid facility category: ${facility.category}`);
  }

  if (!facility.jurisdiction || typeof facility.jurisdiction !== 'object') {
    errors.push('Jurisdiction object is required.');
  } else {
    if (!facility.jurisdiction.state) errors.push('Jurisdiction state is required.');
    if (!facility.jurisdiction.district) errors.push('Jurisdiction district is required.');
    if (!facility.jurisdiction.ward) errors.push('Jurisdiction ward is required.');
  }

  if (!facility.location || typeof facility.location !== 'object') {
    errors.push('Location object is required.');
  } else {
    const { latitude, longitude, address } = facility.location;
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      errors.push('Latitude must be a valid number between -90 and 90.');
    }
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      errors.push('Longitude must be a valid number between -180 and 180.');
    }
    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      errors.push('Location address must be at least 5 characters.');
    }
  }

  if (!Object.values(FACILITY_STATUS).includes(facility.status)) {
    errors.push(`Invalid facility status: ${facility.status}`);
  }

  if (facility.features && typeof facility.features !== 'object') {
    errors.push('Features must be an object.');
  }

  if (containsPII(facility.name) || containsPII(facility.location?.address)) {
    errors.push('Facility payload contains prohibited personal information.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a CleaningEvent entity.
 */
export const validateCleaningEvent = (event) => {
  const errors = [];
  if (!event || typeof event !== 'object') {
    return { valid: false, errors: ['Cleaning event payload must be an object.'] };
  }

  if (!event.id || typeof event.id !== 'string') errors.push('id is required.');
  if (!event.facilityId || typeof event.facilityId !== 'string') errors.push('facilityId is required.');
  if (!event.cleanedAt || isNaN(new Date(event.cleanedAt).getTime())) {
    errors.push('cleanedAt must be a valid ISO date timestamp.');
  }

  if (!event.checklist || typeof event.checklist !== 'object') {
    errors.push('Checklist object is required.');
  } else {
    if (typeof event.checklist.waterSupplyVerified !== 'boolean') {
      errors.push('checklist.waterSupplyVerified must be a boolean.');
    }
    if (typeof event.checklist.floorSanitized !== 'boolean') {
      errors.push('checklist.floorSanitized must be a boolean.');
    }
    if (typeof event.checklist.suppliesRestocked !== 'boolean') {
      errors.push('checklist.suppliesRestocked must be a boolean.');
    }
  }

  if (event.operatorNotes && containsPII(event.operatorNotes)) {
    errors.push('Cleaning event notes contain forbidden personal contact information.');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates a MaintenanceTicket entity.
 */
export const validateMaintenanceTicket = (ticket) => {
  const errors = [];
  if (!ticket || typeof ticket !== 'object') {
    return { valid: false, errors: ['Maintenance ticket payload must be an object.'] };
  }

  if (!ticket.id || typeof ticket.id !== 'string') errors.push('id is required.');
  if (!ticket.facilityId || typeof ticket.facilityId !== 'string') errors.push('facilityId is required.');

  if (!Object.values(TICKET_CATEGORIES).includes(ticket.category)) {
    errors.push(`Invalid ticket category: ${ticket.category}`);
  }

  if (!Object.values(TICKET_SEVERITY).includes(ticket.severity)) {
    errors.push(`Invalid ticket severity: ${ticket.severity}`);
  }

  if (!Object.values(TICKET_STATUS).includes(ticket.status)) {
    errors.push(`Invalid ticket status: ${ticket.status}`);
  }

  if (!ticket.description || typeof ticket.description !== 'string' || ticket.description.trim().length < 5) {
    errors.push('Ticket description must be at least 5 characters.');
  }

  if (containsPII(ticket.description)) {
    errors.push('Ticket description contains forbidden personal identification numbers or contact info.');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Validates a FeedbackReport entity.
 */
export const validateFeedbackReport = (report) => {
  const errors = [];
  if (!report || typeof report !== 'object') {
    return { valid: false, errors: ['Feedback report payload must be an object.'] };
  }

  if (!report.id || typeof report.id !== 'string') errors.push('id is required.');
  if (!report.facilityId || typeof report.facilityId !== 'string') errors.push('facilityId is required.');

  if (typeof report.rating !== 'number' || report.rating < 1 || report.rating > 5) {
    errors.push('Rating must be an integer between 1 and 5.');
  }

  if (report.cleanlinessLevel && !['spotless', 'clean', 'moderate', 'dirty', 'unusable'].includes(report.cleanlinessLevel)) {
    errors.push('Invalid cleanlinessLevel.');
  }

  if (report.comment && containsPII(report.comment)) {
    errors.push('Feedback comment contains prohibited personal identifiers (phone, Aadhaar, PAN, email).');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Strips internal operator metadata and staff details before serving public endpoints.
 */
export const maskPublicFacility = (facility) => {
  if (!facility || typeof facility !== 'object') return null;
  const clone = JSON.parse(JSON.stringify(facility));

  // Remove internal identifiers, staff contact details, private notes
  delete clone.internalNotes;
  delete clone.privateStaffContacts;
  delete clone.contractorContractId;
  delete clone.auditAccessToken;

  return clone;
};

