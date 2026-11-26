/**
 * Data contract and validation for UP Community Heatwave Exposure and Cooling-Relief Coordination Map (#983).
 * Enforces verified facility provenance, separation of permanent attributes from temporary availability,
 * seasonal validity expiration, automatic stale decay calculation, zero-PII sanitization, and UP geo-bounds.
 */

export const UP_HEATWAVE_SCHEMA_VERSION = 1;

/**
 * Supported Heat-Relief Facility Types
 */
export const RELIEF_FACILITY_TYPES = {
  COOLING_CENTRE: 'cooling_centre',
  DRINKING_WATER_POINT: 'drinking_water_point',
  SHADED_REST_STOP: 'shaded_rest_stop',
  PUBLIC_RELIEF_BUILDING: 'public_relief_building',
  HEALTH_HEAT_HELPDESK: 'health_heat_helpdesk',
};

export const RELIEF_FACILITY_TYPE_LABELS = {
  cooling_centre: 'Cooling Centre (Air-Cooled Public Hall / Shelter)',
  drinking_water_point: 'Verified Potable Drinking Water / Cold Piyau',
  shaded_rest_stop: 'Shaded Rest Area / Transit Shelter',
  public_relief_building: 'Designated Public Heat-Relief Building',
  health_heat_helpdesk: 'Public Health Heat-Respite & ORS Help Desk',
};

/**
 * Operational Status (Dynamic availability vs permanent existence)
 */
export const OPERATIONAL_STATUS = {
  OPEN: 'open',
  TEMPORARILY_CLOSED: 'temporarily_closed',
  AT_CAPACITY: 'at_capacity',
  UNVERIFIED: 'unverified',
};

export const OPERATIONAL_STATUS_LABELS = {
  open: 'Open & Operational',
  temporarily_closed: 'Temporarily Closed / Under Maintenance',
  at_capacity: 'At Capacity / Full',
  unverified: 'Unverified / Awaiting Inspection',
};

/**
 * Capacity Status
 */
export const CAPACITY_STATUS = {
  AVAILABLE: 'available',
  CROWDED: 'crowded',
  FULL: 'full',
  UNKNOWN: 'unknown',
};

export const CAPACITY_STATUS_LABELS = {
  available: 'Seats / Space Available',
  crowded: 'Crowded (High Demand)',
  full: 'Full / No Free Space',
  unknown: 'Capacity Unspecified',
};

/**
 * Source Classification Tiers
 */
export const SOURCE_TIERS = {
  OFFICIAL_AUTHORITY: 'official_authority', // LMC, DDMA, CMO, UP Jal Nigam
  VERIFIED_PARTNER: 'verified_partner', // Red Cross, Civil Defence, Authorized RWA/NGO
  CITIZEN_OBSERVATION: 'citizen_observation', // Time-stamped community report
};

export const SOURCE_TIER_LABELS = {
  official_authority: 'Designated Government Authority (DDMA / Municipal Corp)',
  verified_partner: 'Verified Local Humanitarian Partner',
  citizen_observation: 'Community Citizen Observation',
};

/**
 * Official Heat Alert Levels (aligned with IMD / UPSDMA Heat Action Plans)
 */
export const HEAT_ALERT_LEVELS = {
  NORMAL: 'normal', // Green (< 40°C or normal for season)
  HEAT_WATCH: 'heat_watch', // Yellow (40°C - 42.9°C)
  HEAT_ALERT: 'heat_alert', // Orange (43°C - 44.9°C)
  SEVERE_EMERGENCY: 'severe_emergency', // Red (>= 45°C or persistent extreme heat)
};

export const HEAT_ALERT_LABELS = {
  normal: 'Green: Normal Summer Conditions',
  heat_watch: 'Yellow: Heatwave Watch (Stay Hydrated)',
  heat_alert: 'Orange: Heatwave Alert (Avoid Direct Midday Sun)',
  severe_emergency: 'Red: Severe Heatwave Emergency (Take Immediate Shelter)',
};

/**
 * Expiry and Stale Policy in Minutes
 */
export const FRESHNESS_POLICIES_HOURS = {
  PARTNER_UPDATE_VALIDITY_HOURS: 24, // Partner capacity/status update valid for 24h
  CITIZEN_OBSERVATION_VALIDITY_HOURS: 6, // Citizen observation fresh for 6h
  FACILITY_REVERIFICATION_DAYS: 14, // Facilities unverified for > 14 days flagged for re-verification
  SEASON_START_MONTH: 3, // March (0-indexed: 2, but 1-based month 3)
  SEASON_END_MONTH: 7, // July (1-based month 7)
};

/**
 * Administrative Boundaries for Uttar Pradesh
 * Lat: 23.8°N - 30.5°N, Lng: 77.0°E - 84.7°E
 */
export const UP_GEO_BOUNDS = {
  MIN_LAT: 23.8,
  MAX_LAT: 30.5,
  MIN_LNG: 77.0,
  MAX_LNG: 84.7,
};

/**
 * Pilot Uttar Pradesh Districts
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
  'Aligarh',
  'Jhansi',
  'Moradabad',
  'Saharanpur',
  'Ghaziabad',
  'Mathura',
];

/**
 * PII detection patterns (door/flat numbers, phone numbers, emails, Aadhaar)
 */
const FORBIDDEN_PII_PATTERNS = [
  /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, // Indian mobile numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // Email addresses
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Aadhaar-like 12-digit numbers
  /\b(?:flat|door|plot|house|h\.?\s*no\.?|room|apartment|apt\.?)\s*#?\s*\w+[\d\w\-/]*/gi, // Exact house/flat addresses
];

/**
 * Sanitizes text and redacts exact home addresses / personal contact information
 */
export function sanitizeAndRedactText(text) {
  if (!text || typeof text !== 'string') {
    return { sanitizedText: '', wasRedacted: false };
  }

  let sanitized = text.trim();
  let wasRedacted = false;

  FORBIDDEN_PII_PATTERNS.forEach((pattern) => {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '[REDACTED_DETAIL]');
      wasRedacted = true;
    }
  });

  return {
    sanitizedText: sanitized,
    wasRedacted,
  };
}

/**
 * Snaps latitude/longitude to ~1.1 km bounding grid (2 decimal places)
 * Prevents exact tracking of private homes while preserving ward-level utility.
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
 * Checks whether coordinates fall within the administrative borders of UP
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
 * Validates whether a facility record complies with seasonal validity.
 * Active heatwave season in UP is March through July (months 3 to 7).
 * Facilities can also define custom `seasonalValidity` ({ startMonth: 3, endMonth: 7 }).
 */
export function isFacilitySeasonallyActive(facility, referenceDate = new Date()) {
  if (!facility) return false;
  const date = new Date(referenceDate);
  const currentMonth = date.getMonth() + 1; // 1-12

  const start = facility.seasonalValidity?.startMonth ?? FRESHNESS_POLICIES_HOURS.SEASON_START_MONTH;
  const end = facility.seasonalValidity?.endMonth ?? FRESHNESS_POLICIES_HOURS.SEASON_END_MONTH;

  if (start <= end) {
    return currentMonth >= start && currentMonth <= end;
  }
  // Wrap-around season if ever applicable
  return currentMonth >= start || currentMonth <= end;
}

/**
 * Evaluates whether a facility record or observation is stale and requires re-verification.
 * Acceptance criteria: Stale records are automatically marked for re-verification.
 */
export function calculateFacilityFreshness(facility, referenceDate = new Date()) {
  const nowMs = new Date(referenceDate).getTime();
  const verifiedMs = facility.verifiedAt ? new Date(facility.verifiedAt).getTime() : 0;
  const lastReportMs = facility.lastReportedAt ? new Date(facility.lastReportedAt).getTime() : verifiedMs;

  const daysSinceVerification = verifiedMs > 0 ? (nowMs - verifiedMs) / (1000 * 60 * 60 * 24) : 999;
  const hoursSinceLastReport = lastReportMs > 0 ? (nowMs - lastReportMs) / (1000 * 60 * 60) : 999;

  const isVerificationStale = daysSinceVerification > FRESHNESS_POLICIES_HOURS.FACILITY_REVERIFICATION_DAYS;
  const isDynamicReportStale = hoursSinceLastReport > FRESHNESS_POLICIES_HOURS.CITIZEN_OBSERVATION_VALIDITY_HOURS;
  const isSeasonActive = isFacilitySeasonallyActive(facility, referenceDate);

  let statusBadge = 'fresh';
  let verificationNote = 'Verified & Current';

  if (!isSeasonActive) {
    statusBadge = 'seasonal_inactive';
    verificationNote = 'Inactive (Outside March-July Heatwave Season)';
  } else if (!facility.verifiedAt || !facility.sourceUrl || !facility.responsibleAuthority) {
    statusBadge = 'unverified';
    verificationNote = 'Unverified Facility - Awaiting Authority Inspection';
  } else if (isVerificationStale) {
    statusBadge = 'stale_verification';
    verificationNote = `Stale Verification (${Math.floor(daysSinceVerification)} days old) - Marked for Re-verification`;
  } else if (isDynamicReportStale && facility.lastReportedAt) {
    statusBadge = 'stale_observation';
    verificationNote = `Live status older than ${Math.floor(hoursSinceLastReport)}h - Awaiting Fresh Citizen Report`;
  }

  return {
    isStale: isVerificationStale || statusBadge === 'stale_verification',
    isSeasonActive,
    statusBadge,
    verificationNote,
    daysSinceVerification: Math.max(0, Math.floor(daysSinceVerification)),
    hoursSinceLastReport: Math.max(0, Math.floor(hoursSinceLastReport)),
  };
}

/**
 * Strict validator for a listed relief facility catalog item
 * Acceptance criteria: Every listed facility has a source, responsible authority, and last-verified date.
 */
export function validateFacilityRecord(facility) {
  const errors = [];

  if (!facility || typeof facility !== 'object') {
    return { isValid: false, errors: ['Facility must be an object'] };
  }

  if (!facility.id || typeof facility.id !== 'string') {
    errors.push('Facility requires a unique string ID');
  }

  if (!facility.name || typeof facility.name !== 'string' || facility.name.trim().length < 3) {
    errors.push('Facility name must be at least 3 characters');
  }

  if (!Object.values(RELIEF_FACILITY_TYPES).includes(facility.facilityType)) {
    errors.push(`Invalid facilityType: "${facility.facilityType}". Allowed: ${Object.values(RELIEF_FACILITY_TYPES).join(', ')}`);
  }

  if (!facility.district || !UP_PILOT_DISTRICTS.includes(facility.district)) {
    errors.push(`District must be a valid UP pilot district. Received: "${facility.district}"`);
  }

  if (!facility.wardOrVillage || typeof facility.wardOrVillage !== 'string' || facility.wardOrVillage.trim().length < 2) {
    errors.push('wardOrVillage is required for ward/village level navigation');
  }

  // Provenance requirements (Acceptance Criteria #1)
  if (!facility.responsibleAuthority || typeof facility.responsibleAuthority !== 'string' || facility.responsibleAuthority.trim().length < 3) {
    errors.push('Every listed facility must have an assigned responsibleAuthority (e.g. LMC, DDMA, CMO)');
  }

  if (!facility.sourceUrl || typeof facility.sourceUrl !== 'string' || !/^https?:\/\//i.test(facility.sourceUrl)) {
    errors.push('Every listed facility must have a valid authoritative source URL (https://)');
  }

  if (!facility.verifiedAt || isNaN(new Date(facility.verifiedAt).getTime())) {
    errors.push('Every listed facility must have a valid verifiedAt ISO date');
  }

  // Coordinates
  if (!facility.coordinates || typeof facility.coordinates.lat !== 'number' || typeof facility.coordinates.lng !== 'number') {
    errors.push('Facility coordinates with valid numeric lat and lng are required');
  } else if (!isCoordinateWithinUP(facility.coordinates.lat, facility.coordinates.lng)) {
    errors.push(`Coordinates (${facility.coordinates.lat}, ${facility.coordinates.lng}) fall outside Uttar Pradesh`);
  }

  // Operating hours
  if (!facility.operatingHours || typeof facility.operatingHours !== 'string') {
    errors.push('Facility must state operatingHours (e.g. "08:00 - 19:00" or "24x7")');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a community citizen observation / correction payload
 */
export function validateCommunityObservation(payload, referenceDate = new Date()) {
  const errors = [];
  const nowMs = new Date(referenceDate).getTime();

  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Payload must be an object'] };
  }

  if (!payload.facilityId || typeof payload.facilityId !== 'string') {
    errors.push('Observation requires a target facilityId');
  }

  if (!payload.observedStatus || !Object.values(OPERATIONAL_STATUS).includes(payload.observedStatus)) {
    errors.push(`Invalid observedStatus: "${payload.observedStatus}". Allowed: ${Object.values(OPERATIONAL_STATUS).join(', ')}`);
  }

  if (!payload.timestamp) {
    errors.push('Observation must contain a timestamp');
  } else {
    const timeMs = new Date(payload.timestamp).getTime();
    if (isNaN(timeMs)) {
      errors.push('Observation timestamp is invalid');
    } else if (timeMs > nowMs + 5 * 60 * 1000) {
      errors.push('Observation timestamp cannot be in the future (anti-spoofing)');
    } else if (nowMs - timeMs > 48 * 60 * 60 * 1000) {
      errors.push('Observation timestamp is older than 48 hours and cannot be accepted');
    }
  }

  // If user attached coordinates, validate within UP
  if (payload.coordinates) {
    const { lat, lng } = payload.coordinates;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      errors.push('Observation coordinates must be numeric');
    } else if (!isCoordinateWithinUP(lat, lng)) {
      errors.push('Observation coordinates must be within Uttar Pradesh');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
