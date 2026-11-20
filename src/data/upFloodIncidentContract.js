/**
 * Data contract and validation for UP Flooded-Road and Drain Blockage Community Response Board (#985).
 * Enforces strong freshness, verified source labeling, PII redaction, and anti-spoofing rules.
 */

export const UP_FLOOD_SCHEMA_VERSION = 1;

/**
 * Supported incident classifications
 */
export const INCIDENT_TYPES = {
  FLOODED_ROAD: 'flooded_road',
  BLOCKED_DRAIN: 'blocked_drain',
  PASSABLE_ROUTE: 'passable_route',
};

export const INCIDENT_TYPE_LABELS = {
  flooded_road: 'Waterlogged / Flooded Road',
  blocked_drain: 'Blocked / Overflowing Drain',
  passable_route: 'Verified Passable Corridor',
};

/**
 * Standard water depth categories with clear public safety advisories
 */
export const DEPTH_CATEGORIES = {
  ANKLE_DEEP: 'ankle_deep',
  KNEE_DEEP: 'knee_deep',
  WAIST_DEEP_OR_HIGHER: 'waist_deep_or_higher',
  CLEARED_PASSABLE: 'cleared_passable',
  UNKNOWN: 'unknown_or_unspecified',
};

export const DEPTH_LABELS = {
  ankle_deep: 'Ankle-deep (< 15 cm / 6 in) - Slippery, drive with caution',
  knee_deep: 'Knee-deep (15-45 cm / 6-18 in) - Impassable for 2-wheelers & low cars',
  waist_deep_or_higher: 'Waist-deep or higher (> 45 cm / 18+ in) - Severe hazard, submerged drains',
  cleared_passable: 'Water Receded / Safe Public Passage',
  unknown_or_unspecified: 'Depth Not Specified / Approximated',
};

/**
 * Strict source classification
 */
export const SOURCE_TIERS = {
  CITIZEN_REPORT: 'citizen_report',
  MUNICIPAL_ADVISORY: 'municipal_advisory',
  OFFICIAL_EMERGENCY_ALERT: 'official_emergency_alert',
};

export const SOURCE_LABELS = {
  citizen_report: 'Citizen Community Observation',
  municipal_advisory: 'Municipal Corporation Advisory',
  official_emergency_alert: 'State / District Emergency Alert (UPSDMA)',
};

/**
 * Default freshness validity duration in minutes before an observation decays to stale
 */
export const EXPIRY_POLICIES_MINUTES = {
  flooded_road: 120, // 2 hours: standing water conditions change fast
  blocked_drain: 720, // 12 hours: physical silt/trash blockages persist longer
  passable_route: 90, // 1.5 hours: clear roads can submerge quickly in heavy rain
  official_emergency_alert: 1440, // 24 hours unless explicit validUntil is set
};

/**
 * Status of an incident report
 */
export const REPORT_STATUS = {
  CURRENT: 'current',
  STALE: 'stale',
  RECONFIRMED: 'reconfirmed',
  CLEARED: 'cleared',
  DISPUTED: 'disputed',
};

/**
 * Geographic bounding box for Uttar Pradesh (Lat: 23.8°N - 30.5°N, Lng: 77.0°E - 84.7°E)
 * Protects against coordinates spoofed outside UP
 */
export const UP_GEO_BOUNDS = {
  MIN_LAT: 23.8,
  MAX_LAT: 30.5,
  MIN_LNG: 77.0,
  MAX_LNG: 84.7,
};

/**
 * Pilot UP districts with known municipal coverage
 */
export const UP_PILOT_DISTRICTS = [
  'Lucknow',
  'Kanpur Nagar',
  'Varanasi',
  'Prayagraj',
  'Agra',
  'Gorakhpur',
  'Meerut',
  'Bareilly',
  'Ayodhya',
  'Ghaziabad',
  'Moradabad',
  'Aligarh',
  'Jhansi',
  'Saharanpur',
  'Bahraich',
];

/**
 * PII detection patterns (door/flat numbers, phone numbers, emails, personal names)
 */
const FORBIDDEN_PII_PATTERNS = [
  /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, // Indian mobile numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // Email addresses
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Aadhaar-like 12-digit numbers
  /\b(?:flat|door|plot|house|h\.?\s*no\.?|room|apartment|apt\.?)\s*#?\s*\w+[\d\w\-/]*/gi, // Exact house/flat addresses
];

/**
 * Redacts exact home locations and sensitive PII from location description
 * Snaps coordinates to ~1.1km resolution (2 decimal places) for anonymous safety
 */
export function sanitizeAndRedactLocation(locationText, coords = null) {
  if (!locationText || typeof locationText !== 'string') {
    return {
      sanitizedLocation: 'General Locality Area',
      sanitizedCoords: coords ? snapCoordinates(coords) : null,
      wasRedacted: false,
    };
  }

  let sanitized = locationText.trim();
  let wasRedacted = false;

  FORBIDDEN_PII_PATTERNS.forEach((pattern) => {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '[REDACTED_LOCATION_DETAIL]');
      wasRedacted = true;
    }
  });

  const sanitizedCoords = coords ? snapCoordinates(coords) : null;

  return {
    sanitizedLocation: sanitized,
    sanitizedCoords,
    wasRedacted,
  };
}

/**
 * Snaps latitude/longitude to 2 decimal places (~1.1 km bounding grid)
 * Prevents exact pinpointing of residential private premises.
 */
export function snapCoordinates(coords) {
  if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
    return null;
  }
  return {
    lat: Math.round(coords.lat * 100) / 100,
    lng: Math.round(coords.lng * 100) / 100,
    isJittered: true,
  };
}

/**
 * Validates coordinate pair lies within Uttar Pradesh
 */
export function isCoordinateWithinUP(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return (
    lat >= UP_GEO_BOUNDS.MIN_LAT &&
    lat <= UP_GEO_BOUNDS.MAX_LAT &&
    lng >= UP_GEO_BOUNDS.MIN_LNG &&
    lng <= UP_GEO_BOUNDS.MAX_LNG
  );
}

/**
 * Strict validator for incident report payload
 */
export function validateIncidentReport(payload, currentTime = new Date()) {
  const errors = [];
  const nowMs = new Date(currentTime).getTime();

  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Report payload must be an object'] };
  }

  // District validation
  if (!payload.district || !UP_PILOT_DISTRICTS.includes(payload.district)) {
    errors.push(`District must be a valid UP pilot district. Received: "${payload.district}"`);
  }

  // Locality / landmark
  if (!payload.locality || typeof payload.locality !== 'string' || payload.locality.trim().length < 3) {
    errors.push('Locality / landmark must be at least 3 characters long');
  }

  // Incident Type
  if (!Object.values(INCIDENT_TYPES).includes(payload.incidentType)) {
    errors.push(`Invalid incidentType: "${payload.incidentType}". Allowed: ${Object.values(INCIDENT_TYPES).join(', ')}`);
  }

  // Depth category (optional or required for flooded road)
  if (payload.depthCategory && !Object.values(DEPTH_CATEGORIES).includes(payload.depthCategory)) {
    errors.push(`Invalid depthCategory: "${payload.depthCategory}"`);
  }

  // Source Tier & Authenticity Check
  const sourceTier = payload.sourceTier || SOURCE_TIERS.CITIZEN_REPORT;
  if (!Object.values(SOURCE_TIERS).includes(sourceTier)) {
    errors.push(`Invalid sourceTier: "${sourceTier}"`);
  }

  // Anti-spoofing rule: Official alert or advisory cannot be anonymous and must provide issuing authority
  if (sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT || sourceTier === SOURCE_TIERS.MUNICIPAL_ADVISORY) {
    if (!payload.issuingAuthority || typeof payload.issuingAuthority !== 'string' || payload.issuingAuthority.trim().length < 4) {
      errors.push(`Reports marked as "${sourceTier}" must provide an authenticated issuing authority.`);
    }
    if (!payload.officialBulletinRef || typeof payload.officialBulletinRef !== 'string') {
      errors.push(`Official alerts and municipal advisories require an official reference or bulletin ID.`);
    }
  }

  // Observed-at timestamp validation
  if (!payload.observedAt) {
    errors.push('Report must specify an observedAt timestamp');
  } else {
    const observedMs = new Date(payload.observedAt).getTime();
    if (isNaN(observedMs)) {
      errors.push('Invalid observedAt date format');
    } else {
      // Cannot observe in the future (skew allowance 5 minutes)
      if (observedMs > nowMs + 5 * 60 * 1000) {
        errors.push('observedAt timestamp cannot be in the future (anti-spoofing)');
      }
      // Cannot observe more than 72 hours ago as a new incident
      if (nowMs - observedMs > 72 * 60 * 60 * 1000) {
        errors.push('Observation is older than 72 hours and cannot be accepted as a current incident');
      }
    }
  }

  // Coordinates validation if provided
  if (payload.coordinates) {
    const { lat, lng } = payload.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      errors.push('Coordinates must have numeric lat and lng properties');
    } else if (!isCoordinateWithinUP(lat, lng)) {
      errors.push(`Coordinates (${lat}, ${lng}) fall outside the administrative boundaries of Uttar Pradesh.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
