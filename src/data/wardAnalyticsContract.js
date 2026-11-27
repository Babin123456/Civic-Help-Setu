/**
 * src/data/wardAnalyticsContract.js
 * Domain model, enums, schema validation, and privacy contracts for
 * Differentially Private Ward-Level Civic Analytics (#1163).
 */

export const SCHEMA_VERSION = '1.0.0';

export const CIVIC_ISSUE_CATEGORIES = Object.freeze({
  potholes_roads: {
    id: 'potholes_roads',
    label: 'Roads & Potholes',
    description: 'Pothole hazards, cratering, broken asphalt, and damaged footpaths.',
    icon: 'AlertTriangle',
  },
  sanitation_garbage: {
    id: 'sanitation_garbage',
    label: 'Sanitation & Solid Waste',
    description: 'Overflowing bins, uncollected domestic waste, and open dumping spots.',
    icon: 'Trash2',
  },
  water_supply: {
    id: 'water_supply',
    label: 'Drinking Water Supply',
    description: 'Pipeline bursts, contaminated tap water, low pressure, and tanker delays.',
    icon: 'Droplets',
  },
  streetlights: {
    id: 'streetlights',
    label: 'Street Lighting & Electrical',
    description: 'Non-functional streetlights, dangling wires, and dark corridor hazards.',
    icon: 'Lightbulb',
  },
  drainage_flooding: {
    id: 'drainage_flooding',
    label: 'Stormwater Drainage & Flooding',
    description: 'Blocked culverts, sewage backflow, and monsoon waterlogging.',
    icon: 'Waves',
  },
  public_health: {
    id: 'public_health',
    label: 'Public Health & Vector Control',
    description: 'Stagnant water, mosquito breeding, and stray animal hazards.',
    icon: 'Activity',
  },
});

export const VALID_TIME_WINDOWS = Object.freeze(['7d', '14d', '30d', '90d']);

export const PRIVACY_LIMITS = Object.freeze({
  MIN_EPSILON: 0.1,
  MAX_EPSILON: 2.0,
  DEFAULT_EPSILON: 0.5,
  DEFAULT_SPARSE_THRESHOLD: 5,
  MIN_SPARSE_THRESHOLD: 3,
  MAX_SPARSE_THRESHOLD: 20,
  GLOBAL_SENSITIVITY: 1,
  DEFAULT_SESSION_BUDGET: 3.0,
  DEFAULT_QUERY_BUDGET_COST: 0.5,
  IDEMPOTENT_CACHE_TTL_MS: 300000, // 5 minutes
});

export const STATUTORY_MUNICIPAL_DISCLAIMER = Object.freeze(
  'Advisory statistical disclosure under Section 13B of the Municipal Corporation Act. ' +
  'Counts are sanitized via Differential Privacy with sparse cell suppression to safeguard citizen confidentiality ' +
  'under the DPDP Act 2023. These estimates do not represent judicial grievance findings or official municipal decree.'
);

/**
 * Sanitizes untrusted text input against control characters and length bounds.
 */
export const sanitizeText = (input, maxLen = 100) => {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>'"\\;]/g, '')
    .slice(0, maxLen);
};

/**
 * Validates untrusted query parameters for analytics requests.
 */
export const validateAnalyticsQuery = (params = {}) => {
  const errors = [];
  if (!params || typeof params !== 'object') {
    return { valid: false, errors: ['Query parameters must be provided as an object.'] };
  }

  // Ward ID validation (optional filter, but if provided must be alphanumeric format)
  if (params.wardId !== undefined && params.wardId !== null && params.wardId !== '') {
    if (typeof params.wardId !== 'string') {
      errors.push('wardId must be a string identifier.');
    } else {
      const trimmed = params.wardId.trim();
      if (!/^WARD-[A-Z0-9_-]{1,15}$/i.test(trimmed) && !/^\d{1,4}$/.test(trimmed)) {
        errors.push('wardId must be a valid identifier (e.g., WARD-101 or 101).');
      }
    }
  }

  // Category validation (optional filter)
  if (params.category !== undefined && params.category !== null && params.category !== '') {
    if (typeof params.category !== 'string' || !CIVIC_ISSUE_CATEGORIES[params.category]) {
      errors.push(`category must be one of: ${Object.keys(CIVIC_ISSUE_CATEGORIES).join(', ')}.`);
    }
  }

  // Time window validation (defaults to '30d')
  const timeWindow = params.timeWindow || '30d';
  if (!VALID_TIME_WINDOWS.includes(timeWindow)) {
    errors.push(`timeWindow must be one of: ${VALID_TIME_WINDOWS.join(', ')}.`);
  }

  // Epsilon validation
  if (params.epsilon !== undefined && params.epsilon !== null) {
    const eps = Number(params.epsilon);
    if (Number.isNaN(eps) || eps < PRIVACY_LIMITS.MIN_EPSILON || eps > PRIVACY_LIMITS.MAX_EPSILON) {
      errors.push(
        `epsilon must be a number between ${PRIVACY_LIMITS.MIN_EPSILON} and ${PRIVACY_LIMITS.MAX_EPSILON}.`
      );
    }
  }

  // Sparse threshold validation
  if (params.sparseThreshold !== undefined && params.sparseThreshold !== null) {
    const tau = Number(params.sparseThreshold);
    if (
      !Number.isInteger(tau) ||
      tau < PRIVACY_LIMITS.MIN_SPARSE_THRESHOLD ||
      tau > PRIVACY_LIMITS.MAX_SPARSE_THRESHOLD
    ) {
      errors.push(
        `sparseThreshold must be an integer between ${PRIVACY_LIMITS.MIN_SPARSE_THRESHOLD} and ${PRIVACY_LIMITS.MAX_SPARSE_THRESHOLD}.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a civic complaint record before aggregation.
 */
export const validateRawCivicReport = (record) => {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be an object.'] };
  }

  if (!record.id || typeof record.id !== 'string') {
    errors.push('Record id is required.');
  }

  if (!record.wardId || typeof record.wardId !== 'string') {
    errors.push('Record wardId is required.');
  }

  if (!record.category || !CIVIC_ISSUE_CATEGORIES[record.category]) {
    errors.push(`Valid category is required. Received: ${record.category}`);
  }

  if (!record.timestamp || Number.isNaN(new Date(record.timestamp).getTime())) {
    errors.push('Valid ISO timestamp is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
