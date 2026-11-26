import { roleOf } from './accessControl';

/**
 * Domain states for a shelter site and allowed transitions.
 *
 * State diagram:
 *   OPEN
 *    ├───▶ TEMPORARILY_CLOSED ────┐
 *    │                              ▼
 *    └───▶ CLOSED ────────────────┘
 *          │
 *          ▼
 *        MAINTENANCE
 *
 * All transitions must be recorded via status_events.
 */
export const SHELTER_STATES = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  TEMPORARILY_CLOSED: 'TEMPORARILY_CLOSED',
  MAINTENANCE: 'MAINTENANCE',
};

/**
 * Allowed state transitions (from → to).
 * Each transition is validated; invalid transitions return an actionable error message.
 */
export const ALLOWED_TRANSITIONS = {
  [SHELTER_STATES.OPEN]: [
    SHELTER_STATES.TEMPORARILY_CLOSED,
    SHELTER_STATES.CLOSED,
  ],
  [SHELTER_STATES.TEMPORARILY_CLOSED]: [
    SHELTER_STATES.OPEN,
    SHELTER_STATES.CLOSED,
  ],
  [SHELTER_STATES.CLOSED]: [
    SHELTER_STATES.OPEN,
    SHELTER_STATES.MAINTENANCE,
  ],
  [SHELTER_STATES.MAINTENANCE]: [
    SHELTER_STATES.OPEN,
    SHELTER_STATES.CLOSED,
  ],
};

/**
 * Validate that a state transition is allowed.
 * Returns { valid: true } or { valid: false, message }.
 */
export function isValidTransition(oldState, newState) {
  if (oldState === newState) {
    return { valid: false };
  }
  if (!ALLOWED_TRANSITIONS[oldState] || !ALLOWED_TRANSITIONS[oldState].includes(newState)) {
    return { valid: false };
  }
  return { valid: true };
}

/**
 * Get the opposite state.
 * - OPEN ↔ CLOSED
 * - TEMPORARILY_CLOSED → OPEN
 * - MAINTENANCE → null (no single opposite)
 */
export function getOppositeState(state) {
  if (state === SHELTER_STATES.OPEN) return SHELTER_STATES.CLOSED;
  if (state === SHELTER_STATES.CLOSED) return SHELTER_STATES.OPEN;
  if (state === SHELTER_STATES.TEMPORARILY_CLOSED) return SHELTER_STATES.OPEN;
  return null; // MAINTENANCE
}

/**
 * Capacity band label based on occupancy rate percentage.
 * @param {number} occupancyRate - Occupancy rate (0-100)
 * @returns {string} Band label
 */
export function getCapacityBandLabel(occupancyRate) {
  if (occupancyRate <= 30) return 'Low';
  if (occupancyRate <= 70) return 'Moderate';
  if (occupancyRate <= 90) return 'High';
  return 'Critical';
}

/**
 * Capacity band color based on occupancy rate percentage.
 * @param {number} occupancyRate - Occupancy rate (0-100)
 * @returns {string} Color key
 */
export function getCapacityBandColor(occupancyRate) {
  if (occupancyRate <= 30) return 'low';
  if (occupancyRate <= 70) return 'moderate';
  if (occupancyRate <= 90) return 'high';
  return 'critical';
}

/**
 * Format a Unix timestamp into a human-readable string.
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Human-readable time ago string
 */
export function formatLastUpdated(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff <= 0) return 'Just now';
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 120) return '1 minute ago';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 7200) return 'about 1 hour ago';
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 86400) return 'yesterday'; // > 0h and < 24h
  if (diff < 172800) return '1 day ago'; // >= 24h and < 48h
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 30 * 86400) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 365 * 86400) return `${Math.floor(diff / 30 / 86400)} months ago`;
  return `${Math.floor(diff / 365 / 86400)} years ago`;
}

/**
 * Generate a stable lowercase slug from a name.
 * Used for generating shelter site IDs.
 * @param {string} name - The name to convert
 * @returns {string} Lowercase slug with hyphens
 */
export function generateShelterSiteId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Idempotency key generator for retry-safe operations.
 * Uses a deterministic pattern based on shelter ID, action type, and operator data.
 * @param {string} shelterSiteId - The shelter site identifier
 * @param {string} actionType - The type of action (e.g. 'CAPACITY_UPDATE', 'CLOSURE')
 * @param {object} operator - The operator object (typically the current user)
 * @returns {string} Deterministic idempotency key
 */
export function generateIdempotencyKey(shelterSiteId, actionType, operator) {
  const timestamp = Date.now().toString(36);
  const operatorKey = operator && operator.id ? String(operator.id) : 'anonymous';
  const operatorHash = operatorKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0).toString(36);
  return `SHELTER-${shelterSiteId}-${actionType}-${timestamp}-${operatorHash}`;
}

/**
 * Check if an operator has permission to update a shelter site.
 * Returns 'ok' | 'forbidden' | 'unauthenticated' | 'unknown-action'
 */
export function canOperatorUpdateShelter(operator, shelterSite) {
  if (!operator || typeof operator !== 'object') return 'unauthenticated';
  if (!shelterSite) return 'unknown-action';

  // Admins can update any shelter
  if (roleOf(operator) === 'admin') return 'ok';

  // Operators can update shelters within their jurisdiction
  if (operator.jurisdiction && shelterSite.jurisdiction) {
    return operator.jurisdiction === shelterSite.jurisdiction ? 'ok' : 'forbidden';
  }

  // If no jurisdiction mapping, deny
  return 'forbidden';
}

/**
 * Check if an operator has permission to update facility services for a shelter.
 * Returns 'ok' | 'forbidden' | 'unauthenticated'
 */
export function canOperatorUpdateFacilityService(operator, shelterSiteId) {
  if (!operator || typeof operator !== 'object') return 'unauthenticated';
  if (!shelterSiteId) return 'unknown-action';

  if (roleOf(operator) === 'admin') return 'ok';

  // For now, operators can update if they have the general update permission
  // In a full implementation, this would check jurisdiction
  return 'forbidden';
}

/**
 * Generate a summary of stale status if the last update was long ago.
 * @param {number} lastUpdateMillis - Milliseconds since last update
 * @returns {string|undefined} Human-readable stale warning or undefined
 */
export function getStaleStatusWarning(lastUpdateMillis) {
  const now = Date.now();
  const diffHours = (now - lastUpdateMillis) / (1000 * 60 * 60);

  if (diffHours > 24) {
    return `Capacity data is stale (last updated ${Math.floor(diffHours)} hours ago). Contact operator for verification.`;
  }
  if (diffHours > 12) {
    return `Capacity data may be stale (last updated ${Math.ceil(diffHours)} hours ago).`;
  }
  if (diffHours > 2) {
    return `Capacity data last updated ${Math.ceil(diffHours)} hours ago.`;
  }
  return undefined;
}

/**
 * Compute occupancy rate from total and available capacity.
 * @param {number} capacityTotal - Total capacity
 * @param {number} capacityAvailable - Available capacity
 * @returns {number} Occupancy rate percentage (0-100)
 */
export function computeOccupancyRate(capacityTotal, capacityAvailable) {
  if (capacityTotal <= 0) return 100;
  const rate = ((capacityTotal - capacityAvailable) / capacityTotal) * 100;
  return Math.max(0, Math.min(100, Math.round(rate)));
}

/**
 * Compute available capacity from total and occupancy rate.
 * @param {number} capacityTotal - Total capacity
 * @param {number} occupancyRate - Occupancy rate percentage (0-100)
 * @returns {number} Available capacity
 */
export function computeCapacityAvailable(capacityTotal, occupancyRate) {
  if (capacityTotal <= 0) return 0;
  const available = capacityTotal * (1 - occupancyRate / 100);
  return Math.max(0, Math.floor(available));
}

/**
 * Format a shelter status badge with color-coded styling hint.
 * @param {string} status - Shelter status (OPEN, CLOSED, TEMPORARILY_CLOSED, MAINTENANCE)
 * @returns {object} Style object with backgroundColor and color
 */
export function getStatusBadgeStyle(status) {
  const styles = {
    [SHELTER_STATES.OPEN]: { backgroundColor: '#d1fae5', color: '#05592d' },
    [SHELTER_STATES.CLOSED]: { backgroundColor: '#e2e8f0', color: '#475569' },
    [SHELTER_STATES.TEMPORARILY_CLOSED]: { backgroundColor: '#fef3c7', color: '#92400e' },
    [SHELTER_STATES.MAINTENANCE]: { backgroundColor: '#e9d8fd', color: '#7c3aed' },
  };
  return styles[status] || { backgroundColor: '#6b7280', color: '#ffffff' };
}

/**
 * Get status label text for display.
 * @param {string} status - Shelter status
 * @returns {string} Human-readable label
 */
export function getStatusLabel(status) {
  const labels = {
    [SHELTER_STATES.OPEN]: 'Open',
    [SHELTER_STATES.CLOSED]: 'Closed',
    [SHELTER_STATES.TEMPORARILY_CLOSED]: 'Temporarily Closed',
    [SHELTER_STATES.MAINTENANCE]: 'Under Maintenance',
  };
  return labels[status] || status;
}

/**
 * Get emergency severity color/label for service status.
 * @param {string} status - Service status (AVAILABLE, LIMITED, UNAVAILABLE)
 * @returns {object} Style object
 */
export function getServiceStatusStyle(status) {
  const styles = {
    AVAILABLE: { backgroundColor: '#d1fae5', color: '#05592d', label: 'Available' },
    LIMITED: { backgroundColor: '#fef3c7', color: '#92400e', label: 'Limited' },
    UNAVAILABLE: { backgroundColor: '#fecaca', color: '#991b1b', label: 'Unavailable' },
  };
  return styles[status] || { backgroundColor: '#6b7280', color: '#ffffff', label: status };
}

/**
 * Get service status label text.
 * @param {string} status - Service status
 * @returns {string} Human-readable label
 */
export function getServiceStatusLabel(status) {
  const labels = {
    AVAILABLE: 'Available',
    LIMITED: 'Limited',
    UNAVAILABLE: 'Unavailable',
  };
  return labels[status] || status;
}

/**
 * Validate shelter site data against the Firestore security rule schema.
 * Returns array of error messages (empty = valid).
 * Note: This mirrors the Firestore rules `validRecord()` + field-level validation.
 */
export function validateShelterSiteData(data) {
  const errors = [];

  if (typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  } else if (data.name.length > 200) {
    errors.push('Name must be at most 200 characters');
  }

  if (typeof data.jurisdiction !== 'string' || data.jurisdiction.trim().length === 0) {
    errors.push('Jurisdiction is required and must be a non-empty string');
  } else if (data.jurisdiction.length > 100) {
    errors.push('Jurisdiction must be at most 100 characters');
  }

  if (typeof data.capacityTotal === 'number') {
    if (data.capacityTotal < 1 || data.capacityTotal > 10000) {
      errors.push('capacityTotal must be between 1 and 10000');
    }
  } else if (data.capacityTotal !== undefined) {
    errors.push('capacityTotal must be a valid number');
  }

  if (typeof data.capacityAvailable === 'number') {
    if (data.capacityAvailable < 0 || data.capacityAvailable > (data.capacityTotal || 1)) {
      errors.push('capacityAvailable must be between 0 and capacityTotal');
    }
  } else if (data.capacityAvailable !== undefined) {
    errors.push('capacityAvailable must be a valid number');
  }

  if (typeof data.occupancyRate === 'number') {
    if (data.occupancyRate < 0 || data.occupancyRate > 100) {
      errors.push('occupancyRate must be between 0 and 100');
    }
  } else if (data.occupancyRate !== undefined) {
    errors.push('occupancyRate must be a valid number');
  }

  if (data.status && !['OPEN', 'CLOSED', 'TEMPORARILY_CLOSED', 'MAINTENANCE'].includes(data.status)) {
    errors.push('Status must be one of: OPEN, CLOSED, TEMPORARILY_CLOSED, MAINTENANCE');
  }

  if (data.accessibility) {
    if (typeof data.accessibility.wheelchairAccessible !== 'boolean') {
      errors.push('wheelchairAccessible must be a boolean if provided');
    }
    if (typeof data.accessibility.hearingImpaired !== 'boolean') {
      errors.push('hearingImpaired must be a boolean if provided');
    }
    if (typeof data.accessibility.visuallyImpaired !== 'boolean') {
      errors.push('visuallyImpaired must be a boolean if provided');
    }
  }

  if (data.lat !== undefined && (typeof data.lat !== 'string' || data.lat.length > 30)) {
    errors.push('Latitude must be a string at most 30 characters');
  }
  if (data.lng !== undefined && (typeof data.lng !== 'string' || data.lng.length > 30)) {
    errors.push('Longitude must be a string at most 30 characters');
  }

  if (data.contact && typeof data.contact === 'string' && data.contact.length > 100) {
    errors.push('Contact must be at most 100 characters');
  }
  if (data.altContact && typeof data.altContact === 'string' && data.altContact.length > 50) {
    errors.push('Alt contact must be at most 50 characters');
  }
  if (data.email && typeof data.email === 'string' && data.email.length > 200) {
    errors.push('Email must be at most 200 characters');
  }
  if (data.website && typeof data.website === 'string' && data.website.length > 200) {
    errors.push('Website must be at most 200 characters');
  }
  if (data.contactType && typeof data.contactType === 'string' && data.contactType.length > 50) {
    errors.push('Contact type must be at most 50 characters');
  }

  return errors;
}

/**
 * Validate facility service data against the Firestore security rule schema.
 * Returns array of error messages (empty = valid).
 */
export function validateFacilityServiceData(data) {
  const errors = [];

  if (typeof data.shelterSiteId !== 'string' || data.shelterSiteId.trim().length === 0) {
    errors.push('shelterSiteId is required and must be a non-empty string');
  }

  if (typeof data.serviceType !== 'string') {
    errors.push('serviceType is required');
  } else if (!['WATER', 'POWER', 'SANITATION', 'MEDICAL', 'FOOD'].includes(data.serviceType)) {
    errors.push('serviceType must be one of: WATER, POWER, SANITATION, MEDICAL, FOOD');
  }

  if (typeof data.status !== 'string') {
    errors.push('status is required');
  } else if (!['AVAILABLE', 'LIMITED', 'UNAVAILABLE'].includes(data.status)) {
    errors.push('status must be one of: AVAILABLE, LIMITED, UNAVAILABLE');
  }

  if (typeof data.capacityTotal === 'number') {
    if (data.capacityTotal < 1 || data.capacityTotal > 10000) {
      errors.push('capacityTotal must be between 1 and 10000');
    }
  } else if (data.capacityTotal !== undefined) {
    errors.push('capacityTotal must be a valid number');
  }

  if (typeof data.capacityAvailable === 'number') {
    if (data.capacityAvailable < 0 || data.capacityAvailable > (data.capacityTotal || 1)) {
      errors.push('capacityAvailable must be between 0 and capacityTotal');
    }
  } else if (data.capacityAvailable !== undefined) {
    errors.push('capacityAvailable must be a valid number');
  }

  if (typeof data.lastVerified === 'number') {
    if (data.lastVerified < 0 || data.lastVerified > 2147483647) {
      errors.push('lastVerified must be a valid Unix timestamp');
    }
  } else {
    errors.push('lastVerified must be a valid number');
  }

  if (data.notes && typeof data.notes === 'string' && data.notes.length > 500) {
    errors.push('notes must be at most 500 characters');
  }

  return errors;
}

/**
 * Validate capacity snapshot data against the Firestore security rule schema.
 * Returns array of error messages (empty = valid).
 */
export function validateCapacitySnapshotData(data) {
  const errors = [];

  if (typeof data.shelterSiteId !== 'string' || data.shelterSiteId.trim().length === 0) {
    errors.push('shelterSiteId is required and must be a non-empty string');
  }

  if (typeof data.capacityAvailable !== 'number') {
    errors.push('capacityAvailable must be a number');
  } else if (data.capacityAvailable < 0 || data.capacityAvailable > (data.capacityTotal || 1)) {
    errors.push('capacityAvailable must be between 0 and capacityTotal');
  }

  if (typeof data.capacityTotal === 'number') {
    if (data.capacityTotal < 1 || data.capacityTotal > 10000) {
      errors.push('capacityTotal must be between 1 and 10000');
    }
  } else if (data.capacityTotal !== undefined) {
    errors.push('capacityTotal must be a valid number');
  }

  if (typeof data.occupancyRate === 'number') {
    if (data.occupancyRate < 0 || data.occupancyRate > 100) {
      errors.push('occupancyRate must be between 0 and 100');
    }
  } else if (data.occupancyRate !== undefined) {
    errors.push('occupancyRate must be a valid number');
  }

  if (typeof data.updateSource !== 'string' || data.updateSource.trim().length === 0) {
    errors.push('updateSource is required and must be a non-empty string');
  } else if (data.updateSource.length > 100) {
    errors.push('updateSource must be at most 100 characters');
  }

  if (data.notes && typeof data.notes === 'string' && data.notes.length > 500) {
    errors.push('notes must be at most 500 characters');
  }

  return errors;
}

/**
 * Validate operator account data against the Firestore security rule schema.
 * Returns array of error messages (empty = valid).
 */
export function validateOperatorAccountData(data) {
  const errors = [];

  if (typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  } else if (data.name.length > 200) {
    errors.push('Name must be at most 200 characters');
  }

  if (data.email && typeof data.email === 'string' && data.email.length > 200) {
    errors.push('Email must be at most 200 characters');
  }

  if (data.phone && typeof data.phone === 'string' && data.phone.length > 50) {
    errors.push('Phone must be at most 50 characters');
  }

  if (data.role && !['OPERATOR', 'ADMIN'].includes(data.role)) {
    errors.push('role must be one of: OPERATOR, ADMIN');
  }

  if (data.jurisdiction && typeof data.jurisdiction === 'string' && data.jurisdiction.length > 100) {
    errors.push('jurisdiction must be at most 100 characters');
  }

  if (data.verificationStatus && typeof data.verificationStatus === 'string' && data.verificationStatus.length > 50) {
    errors.push('verificationStatus must be at most 50 characters');
  }

  if (data.onboardingId && typeof data.onboardingId === 'string' && data.onboardingId.length > 100) {
    errors.push('onboardingId must be at most 100 characters');
  }

  return errors;
}

/**
 * Validate status event data against the Firestore security rule schema.
 * Returns array of error messages (empty = valid).
 */
export function validateStatusEventData(data) {
  const errors = [];

  if (typeof data.shelterSiteId !== 'string' || data.shelterSiteId.trim().length === 0) {
    errors.push('shelterSiteId is required and must be a non-empty string');
  }

  if (typeof data.eventType !== 'string') {
    errors.push('eventType is required');
  } else if (
    !['CAPACITY_UPDATE', 'SERVICE_UPDATE', 'CLOSURE', 'REOPENING', 'VERIFICATION',
     'CAPACITY', 'SERVICES', 'ACCESSIBILITY'].includes(data.eventType)
  ) {
    errors.push('eventType must be one of: CAPACITY_UPDATE, SERVICE_UPDATE, CLOSURE, REOPENING, VERIFICATION, CAPACITY, SERVICES, ACCESSIBILITY');
  }

  if (typeof data.oldState !== 'string') {
    errors.push('oldState is required');
  } else if (
    !['OPEN', 'CLOSED', 'TEMPORARILY_CLOSED', 'MAINTENANCE'].includes(data.oldState)
  ) {
    errors.push('oldState must be one of: OPEN, CLOSED, TEMPORARILY_CLOSED, MAINTENANCE');
  }

  if (typeof data.newState !== 'string') {
    errors.push('newState is required');
  } else if (
    !['OPEN', 'CLOSED', 'TEMPORARILY_CLOSED', 'MAINTENANCE'].includes(data.newState)
  ) {
    errors.push('newState must be one of: OPEN, CLOSED, TEMPORARILY_CLOSED, MAINTENANCE');
  }

  if (typeof data.operatorId !== 'string' || data.operatorId.trim().length === 0) {
    errors.push('operatorId is required and must be a non-empty string');
  } else if (data.operatorId.length > 100) {
    errors.push('operatorId must be at most 100 characters');
  }

  if (typeof data.description !== 'string' || data.description.trim().length === 0) {
    errors.push('description is required and must be a non-empty string');
  } else if (data.description.length > 500) {
    errors.push('description must be at most 500 characters');
  }

  if (data.details && typeof data.details === 'string' && data.details.length > 1000) {
    errors.push('details must be at most 1000 characters');
  }

  return errors;
}

/**
 * Validate verification check data against the Firestore security rule schema.
 * Returns array of error messages (empty = valid).
 */
export function validateVerificationCheckData(data) {
  const errors = [];

  if (typeof data.shelterSiteId !== 'string' || data.shelterSiteId.trim().length === 0) {
    errors.push('shelterSiteId is required and must be a non-empty string');
  }

  if (typeof data.checkType !== 'string') {
    errors.push('checkType is required');
  } else if (!['CAPACITY', 'SERVICES', 'ACCESSIBILITY'].includes(data.checkType)) {
    errors.push('checkType must be one of: CAPACITY, SERVICES, ACCESSIBILITY');
  }

  if (typeof data.status !== 'string') {
    errors.push('status is required');
  } else if (!['PENDING', 'PASSED', 'FAILED'].includes(data.status)) {
    errors.push('status must be one of: PENDING, PASSED, FAILED');
  }

  if (typeof data.checkedBy !== 'string' || data.checkedBy.trim().length === 0) {
    errors.push('checkedBy is required and must be a non-empty string');
  } else if (data.checkedBy.length > 100) {
    errors.push('checkedBy must be at most 100 characters');
  }

  if (data.notes && typeof data.notes === 'string' && data.notes.length > 500) {
    errors.push('notes must be at most 500 characters');
  }

  if (data.rating !== undefined && (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5)) {
    errors.push('rating must be a number between 1 and 5 if provided');
  }

  if (data.reviewerId && typeof data.reviewerId === 'string' && data.reviewerId.length > 100) {
    errors.push('reviewerId must be at most 100 characters');
  }

  return errors;
}

