/**
 * src/data/pedestrianBarrierContract.js
 * Domain model, enums, schema validation, state machines, and lifecycle contracts
 * for the Accessible Pedestrian Route Barrier Map for Public Infrastructure (#757).
 */

export const SCHEMA_VERSION = '1.0.0';

/**
 * Types of physical barriers identified on pedestrian segments and crossings.
 */
export const BARRIER_TYPES = Object.freeze({
  missing_curb_ramp: {
    id: 'missing_curb_ramp',
    label: 'Missing or Broken Curb Ramp',
    description: 'Absence of dropped kerb or abrupt vertical lip preventing wheelchair / stroller access.',
    category: 'curb_ramp',
    requiresImmediateAttention: true,
  },
  damaged_footpath: {
    id: 'damaged_footpath',
    label: 'Damaged / Broken Pavement',
    description: 'Uneven paving slabs, deep fissures, or missing tiles posing tripping and wheel entrapment hazards.',
    category: 'footpath',
    requiresImmediateAttention: false,
  },
  steep_gradient: {
    id: 'steep_gradient',
    label: 'Excessive Gradient / Slope',
    description: 'Pedestrian slope exceeding statutory accessibility standards (>8% gradient without landings).',
    category: 'gradient',
    requiresImmediateAttention: false,
  },
  missing_tactile_paving: {
    id: 'missing_tactile_paving',
    label: 'Missing Tactile Blister / Guiding Pavers',
    description: 'Lack of directional or hazard warning tactile pavers for low-vision and cane users.',
    category: 'tactile',
    requiresImmediateAttention: false,
  },
  open_drain_hazard: {
    id: 'open_drain_hazard',
    label: 'Open Drain / Uncovered Chamber',
    description: 'Uncovered stormwater drain, inspection pit, or missing grating creating severe fall risk.',
    category: 'safety',
    requiresImmediateAttention: true,
  },
  construction_debris: {
    id: 'construction_debris',
    label: 'Construction Debris / Dug-Up Trench',
    description: 'Roadwork, utility excavation, or construction materials blocking pedestrian right-of-way.',
    category: 'temporary',
    requiresImmediateAttention: true,
  },
  vendor_encroachment: {
    id: 'vendor_encroachment',
    label: 'Encroachment / Permanent Physical Obstacle',
    description: 'Kiosks, utility poles, or merchandise reducing clear walking width below 1.5m.',
    category: 'width',
    requiresImmediateAttention: false,
  },
  parked_vehicle_block: {
    id: 'parked_vehicle_block',
    label: 'Parked Vehicle Obstructing Path',
    description: 'Two-wheelers or cars parked across footpaths or dropped curb ramps.',
    category: 'temporary',
    requiresImmediateAttention: false,
  },
});

/**
 * Barrier severity classification and mobility impedance levels.
 */
export const BARRIER_SEVERITIES = Object.freeze({
  low_friction: {
    id: 'low_friction',
    label: 'Low Friction',
    description: 'Minor surface imperfection; navigable with minimal detour or caution.',
    penaltyMultiplier: 1.25,
    badgeClass: 'badge-info',
  },
  moderate_impediment: {
    id: 'moderate_impediment',
    label: 'Moderate Impediment',
    description: 'Causes significant slowdown; difficult for manual wheelchairs and crutch users.',
    penaltyMultiplier: 2.0,
    badgeClass: 'badge-warning',
  },
  high_barrier: {
    id: 'high_barrier',
    label: 'High Barrier',
    description: 'Dangerous or requiring assistance; strongly avoided unless no other route exists.',
    penaltyMultiplier: 4.5,
    badgeClass: 'badge-danger',
  },
  impassable: {
    id: 'impassable',
    label: 'Impassable Obstacle',
    description: 'Completely blocks passage for wheeled mobility devices; path is severed.',
    penaltyMultiplier: 100.0,
    badgeClass: 'badge-danger',
  },
});

/**
 * Barrier Observation lifecycle state machine.
 */
export const BARRIER_STATUSES = Object.freeze({
  reported: {
    id: 'reported',
    label: 'Reported by Citizen',
    description: 'Community-submitted observation awaiting municipal/reviewer inspection.',
    badgeClass: 'badge-info',
  },
  under_review: {
    id: 'under_review',
    label: 'Under Field Review',
    description: 'Queued for ground verification or physical audit by municipal staff.',
    badgeClass: 'badge-warning',
  },
  verified: {
    id: 'verified',
    label: 'Verified Official Defect',
    description: 'Confirmed by municipal inspector; factored into active routing penalties.',
    badgeClass: 'badge-danger',
  },
  rejected: {
    id: 'rejected',
    label: 'Rejected / Invalid Report',
    description: 'Dismissed due to inaccurate coordinates, duplication, or non-existent obstruction.',
    badgeClass: 'badge-muted',
  },
  resolved: {
    id: 'resolved',
    label: 'Rectified & Cleared',
    description: 'Remedial works completed or obstruction removed; barrier cleared from routing penalty.',
    badgeClass: 'badge-success',
  },
});

/**
 * Valid domain transitions for barrier observations.
 */
export const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  reported: ['under_review', 'verified', 'rejected'],
  under_review: ['verified', 'rejected'],
  verified: ['resolved', 'under_review'],
  rejected: ['under_review'], // Re-open on administrative appeal
  resolved: ['under_review'], // Re-open if defect recurs
});

/**
 * Surface types for pedestrian links.
 */
export const SURFACE_TYPES = Object.freeze({
  paved_asphalt: { id: 'paved_asphalt', label: 'Smooth Paved Asphalt', penalty: 1.0 },
  concrete_paver: { id: 'concrete_paver', label: 'Concrete Interlocking Paver', penalty: 1.1 },
  cobblestone: { id: 'cobblestone', label: 'Cobblestone / Rough Stone', penalty: 1.8 },
  unpaved_dirt: { id: 'unpaved_dirt', label: 'Unpaved Dirt / Gravel', penalty: 2.5 },
  broken_slab: { id: 'broken_slab', label: 'Broken Slabs / Loose Gravel', penalty: 3.2 },
});

/**
 * Curb ramp statuses.
 */
export const CURB_RAMP_STATUSES = Object.freeze({
  present_compliant: { id: 'present_compliant', label: 'Present & Wheelchair Compliant', penalty: 1.0 },
  present_steep_or_damaged: { id: 'present_steep_or_damaged', label: 'Present but Steep / Damaged Lip', penalty: 2.2 },
  missing: { id: 'missing', label: 'Missing / Abrupt Curb (>15cm drop)', penalty: 8.0 },
});

/**
 * Tactile paving statuses for vision-impaired guidance.
 */
export const TACTILE_PAVING_STATUSES = Object.freeze({
  continuous: { id: 'continuous', label: 'Continuous Guiding & Hazard Tiles', penalty: 1.0 },
  interrupted: { id: 'interrupted', label: 'Interrupted / Broken Tactile Tiles', penalty: 1.6 },
  absent: { id: 'absent', label: 'No Tactile Paving Present', penalty: 2.8 },
});

/**
 * Sidewalk configuration.
 */
export const SIDEWALK_TYPES = Object.freeze({
  elevated_kerb: { id: 'elevated_kerb', label: 'Dedicated Elevated Footpath' },
  flush_shared: { id: 'flush_shared', label: 'Flush Shared Pedestrian-Vehicle Street' },
  no_sidewalk: { id: 'no_sidewalk', label: 'No Sidewalk / Walking on Carriageway' },
});

/**
 * Pedestrian road crossing types.
 */
export const CROSSING_TYPES = Object.freeze({
  zebra_marked: { id: 'zebra_marked', label: 'Zebra Crossing (At Grade)' },
  pelican_signal: { id: 'pelican_signal', label: 'Signalized Crossing with Pelican/Pedestrian Light' },
  grade_separated_subway: { id: 'grade_separated_subway', label: 'Pedestrian Subway / Underpass' },
  grade_separated_overpass: { id: 'grade_separated_overpass', label: 'Foot Overbridge (FOB)' },
  informal_crossing: { id: 'informal_crossing', label: 'Informal Crossing Location' },
});

/**
 * Default citizen route constraints (strictly functional without requiring medical diagnosis).
 */
export const DEFAULT_ROUTE_PREFERENCES = Object.freeze({
  avoidStairsAndSteps: true,
  requireCurbRamps: true,
  maxGradientPct: 8, // Standard 1:12 (8.3%) maximum slope
  requireTactilePaving: false,
  requireAudibleSignals: false,
  avoidUnpavedSurfaces: true,
  maxDetourFactor: 1.5,
});

// Anti-PII regex safeguarding
export const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
export const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
export const PHONE_REGEX = /\b(\+91[-\s]?)?[6-9]\d{9}\b/;
export const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

export const sanitizeText = (val, maxLen = 1500) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags to avoid XSS
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const checkForForbiddenPII = (val) => {
  if (typeof val !== 'string') return null;
  if (AADHAAR_REGEX.test(val)) return 'Contains 12-digit Aadhaar number pattern';
  if (PAN_REGEX.test(val)) return 'Contains PAN identifier pattern';
  if (PHONE_REGEX.test(val)) return 'Contains telephone contact number';
  if (EMAIL_REGEX.test(val)) return 'Contains private email address';
  return null;
};

/**
 * Validates state machine transition.
 */
export const canTransitionBarrierStatus = (currentStatus, targetStatus, role = 'citizen') => {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true;

  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) return false;

  // Role authorization gates
  if (targetStatus === 'verified' || targetStatus === 'rejected' || targetStatus === 'resolved') {
    return ['operator', 'reviewer', 'admin'].includes(role);
  }

  return true;
};

/**
 * Validates citizen barrier observation submission.
 */
export const validateBarrierObservationPayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be an object.'];
  }

  if (!body.segmentId || typeof body.segmentId !== 'string') {
    errors.push('A valid segmentId or crossingId is required.');
  }

  if (!body.barrierType || !BARRIER_TYPES[body.barrierType]) {
    errors.push(`Barrier type must be one of: ${Object.keys(BARRIER_TYPES).join(', ')}.`);
  }

  if (!body.severity || !BARRIER_SEVERITIES[body.severity]) {
    errors.push(`Severity must be one of: ${Object.keys(BARRIER_SEVERITIES).join(', ')}.`);
  }

  const ward = sanitizeText(body.ward || '', 60);
  if (!ward || ward.length < 2) {
    errors.push('Ward / Jurisdiction identifier is required (e.g. "Ward 150 - Bellandur").');
  }

  const description = sanitizeText(body.description || '', 1000);
  if (!description || description.length < 15) {
    errors.push('Description must be at least 15 characters detailing the pedestrian obstruction.');
  }

  const pii = checkForForbiddenPII(description);
  if (pii) {
    errors.push(`Description ${pii}. Do not include personal phone, email, or identity numbers.`);
  }

  if (body.photoUrl) {
    const urlStr = String(body.photoUrl).trim();
    if (!urlStr.startsWith('https://') && !urlStr.startsWith('http://') && !urlStr.startsWith('data:image/')) {
      errors.push('Photo URL must be a valid secure URL or image attachment.');
    }
    if (urlStr.length > 500) {
      errors.push('Photo URL exceeds allowable length of 500 characters.');
    }
  }

  return errors;
};

/**
 * Validates staff verification event submission.
 */
export const validateVerificationEventPayload = (body) => {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['Request body must be an object.'];
  }

  if (!body.observationId || typeof body.observationId !== 'string') {
    errors.push('observationId is required.');
  }

  const validActions = ['verify', 'reject', 'resolve', 'reopen'];
  if (!validActions.includes(body.action)) {
    errors.push(`Action must be one of: ${validActions.join(', ')}.`);
  }

  const reasonCode = sanitizeText(body.reasonCode || '', 100);
  if (!reasonCode || reasonCode.length < 5) {
    errors.push('A structured audit reason code is required (min 5 characters).');
  }

  const reviewerNotes = sanitizeText(body.reviewerNotes || '', 1000);
  const pii = checkForForbiddenPII(reviewerNotes);
  if (pii) {
    errors.push(`Reviewer notes ${pii}.`);
  }

  return errors;
};

/**
 * Validates route calculation parameters.
 */
export const validateRoutePreferences = (preferences) => {
  const merged = { ...DEFAULT_ROUTE_PREFERENCES, ...(preferences || {}) };
  const errors = [];

  const maxGrad = Number(merged.maxGradientPct);
  if (Number.isNaN(maxGrad) || maxGrad < 1 || maxGrad > 25) {
    errors.push('maxGradientPct must be a number between 1 and 25 percent.');
  }

  const detour = Number(merged.maxDetourFactor);
  if (Number.isNaN(detour) || detour < 1.0 || detour > 4.0) {
    errors.push('maxDetourFactor must be a number between 1.0 and 4.0.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: merged,
  };
};
