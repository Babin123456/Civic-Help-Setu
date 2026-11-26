/**
 * src/data/federatedQueryContract.js
 * Versioned schema and domain contracts for the Federated Civic Data Query Layer (#1162).
 *
 * Enforces:
 * - Versioned query and response contracts (v1.0.0).
 * - Authorized civic purposes.
 * - Supported aggregation functions (No raw row fetching).
 * - Minimum aggregation threshold (k >= 10) for differential privacy / k-anonymity.
 * - Comprehensive schema and payload validation helpers.
 */

export const FEDERATED_SCHEMA_VERSION = "1.0.0";

/**
 * Minimum aggregation threshold to prevent inference / re-identification attacks.
 * Any cohort count where 0 < count < MINIMUM_AGGREGATION_THRESHOLD will be suppressed.
 */
export const MINIMUM_AGGREGATION_THRESHOLD = 10;
export const SUPPRESSED_DISPLAY_VALUE = "< 10 (Suppressed for Privacy)";

/**
 * Registered department connectors in the civic federation.
 */
export const FEDERATED_DEPARTMENTS = Object.freeze({
  WATER_SUPPLY: {
    id: "water_supply",
    name: "Department of Water Supply & Sewerage",
    code: "DWSS",
    category: "Utilities & Water",
    defaultSlaMs: 1500,
  },
  ROADS_INFRASTRUCTURE: {
    id: "roads_infrastructure",
    name: "Public Works & Roads Department",
    code: "PWRD",
    category: "Infrastructure",
    defaultSlaMs: 1500,
  },
  HEALTH_SANITATION: {
    id: "health_sanitation",
    name: "Municipal Health & Sanitation Directorate",
    code: "MHSD",
    category: "Public Health",
    defaultSlaMs: 1500,
  },
  URBAN_TRANSPORT: {
    id: "urban_transport",
    name: "Directorate of Urban Public Transit",
    code: "DUPT",
    category: "Transit",
    defaultSlaMs: 1500,
  },
});

/**
 * Approved civic purposes for federated queries.
 * Queries lacking an authorized purpose must be rejected.
 */
export const AUTHORIZED_CIVIC_PURPOSES = Object.freeze({
  INFRASTRUCTURE_MONITORING: {
    id: "INFRASTRUCTURE_MONITORING",
    label: "Civic Infrastructure Planning & Maintenance",
    description: "Monitoring road defects, water supply continuity, and public facilities.",
  },
  DISASTER_MITIGATION: {
    id: "DISASTER_MITIGATION",
    label: "Emergency & Disaster Mitigation",
    description: "Tracking monsoon flooding, water shortages, and emergency resource allocation.",
  },
  PUBLIC_HEALTH_SURVEILLANCE: {
    id: "PUBLIC_HEALTH_SURVEILLANCE",
    label: "Public Health & Sanitation Monitoring",
    description: "Evaluating disease outbreak correlations, waste accumulation, and hygiene risks.",
  },
  TRANSIT_ACCESSIBILITY: {
    id: "TRANSIT_ACCESSIBILITY",
    label: "Public Transit Accessibility Optimization",
    description: "Measuring bus frequency, commuter congestion, and road accessibility barriers.",
  },
});

/**
 * Allowed aggregation operations. Raw row-level queries are strictly disallowed.
 */
export const ALLOWED_AGGREGATIONS = Object.freeze(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

/**
 * Availability state enumeration for partial availability handling.
 */
export const AVAILABILITY_STATES = Object.freeze({
  FULL: "FULL_AVAILABILITY",
  PARTIAL: "PARTIAL_AVAILABILITY",
  NONE: "SERVICE_UNAVAILABLE",
});

/**
 * Validates a federated query request.
 * @param {object} req - Request object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFederatedQueryRequest(req) {
  const errors = [];
  if (!req || typeof req !== "object") {
    return { valid: false, errors: ["Query request must be a valid JSON object."] };
  }

  // Purpose check
  if (!req.purpose || !AUTHORIZED_CIVIC_PURPOSES[req.purpose]) {
    errors.push(
      `Invalid or missing purpose. Must be one of: ${Object.keys(AUTHORIZED_CIVIC_PURPOSES).join(", ")}.`
    );
  }

  // Target departments check
  if (!Array.isArray(req.targetDepartments) || req.targetDepartments.length === 0) {
    errors.push("targetDepartments must be a non-empty array of department IDs.");
  } else {
    for (const deptId of req.targetDepartments) {
      if (!Object.values(FEDERATED_DEPARTMENTS).some((d) => d.id === deptId)) {
        errors.push(`Unknown department ID '${deptId}'.`);
      }
    }
  }

  // Ward filter check (Optional, but if present must be sanitized string or integer)
  if (req.ward !== undefined && req.ward !== null && req.ward !== "ALL") {
    const wardNum = parseInt(req.ward, 10);
    if (Number.isNaN(wardNum) || wardNum < 1 || wardNum > 500) {
      errors.push("Ward must be 'ALL' or an integer between 1 and 500.");
    }
  }

  // Metric type check
  if (req.metricType && typeof req.metricType !== "string") {
    errors.push("metricType must be a valid string identifier.");
  }

  // Aggregation check
  if (req.aggregation && !ALLOWED_AGGREGATIONS.includes(req.aggregation)) {
    errors.push(
      `aggregation must be one of: ${ALLOWED_AGGREGATIONS.join(", ")}.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Enforces minimum aggregation threshold on a numerical metric.
 * @param {number} count - The raw count
 * @param {number} threshold - Minimum allowed threshold (default 10)
 * @returns {{ value: number|null, displayValue: string, isSuppressed: boolean }}
 */
export function applyPrivacyThreshold(count, threshold = MINIMUM_AGGREGATION_THRESHOLD) {
  if (typeof count !== "number" || Number.isNaN(count)) {
    return { value: 0, displayValue: "0", isSuppressed: false };
  }
  if (count > 0 && count < threshold) {
    return {
      value: null,
      displayValue: SUPPRESSED_DISPLAY_VALUE,
      isSuppressed: true,
    };
  }
  return {
    value: count,
    displayValue: String(count),
    isSuppressed: false,
  };
}
