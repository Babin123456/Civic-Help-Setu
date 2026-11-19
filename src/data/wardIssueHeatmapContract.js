/**
 * src/data/wardIssueHeatmapContract.js
 * Domain model, entity contracts, normalization schemas, validation rules,
 * privacy thresholds, and state transitions for Anonymized Ward-Level Civic Issue Heatmap (#763).
 */

export const SCHEMA_VERSION = '1.0.0';

export const TIME_WINDOWS = {
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  LAST_90_DAYS: 'last_90_days',
  YEAR_TO_DATE: 'year_to_date',
};

export const TIME_WINDOW_LABELS = {
  [TIME_WINDOWS.LAST_7_DAYS]: 'Last 7 Days',
  [TIME_WINDOWS.LAST_30_DAYS]: 'Last 30 Days',
  [TIME_WINDOWS.LAST_90_DAYS]: 'Last 90 Days',
  [TIME_WINDOWS.YEAR_TO_DATE]: 'Year to Date (2026)',
};

export const ISSUE_CATEGORIES = {
  potholes_road_damage: {
    id: 'potholes_road_damage',
    label: 'Potholes & Road Damage',
    aliases: ['pothole', 'road damage', 'crater', 'asphalt', 'tar road', 'road repair'],
    defaultSeverity: 'medium',
    description: 'Road cave-ins, potholes, damaged asphalt, uneven pedestrian street surfaces',
  },
  garbage_solid_waste: {
    id: 'garbage_solid_waste',
    label: 'Garbage & Solid Waste',
    aliases: ['garbage', 'trash', 'waste', 'dump', 'black spot', 'litter', 'debris'],
    defaultSeverity: 'medium',
    description: 'Uncollected domestic refuse, overflowing public community bins, illegal open dumping',
  },
  water_supply_leakage: {
    id: 'water_supply_leakage',
    label: 'Water Supply & Leakage',
    aliases: ['water leak', 'pipe burst', 'no water', 'contaminated water', 'pipeline', 'water supply'],
    defaultSeverity: 'high',
    description: 'Municipal pipeline bursts, contaminated drinking supply, low water pressure',
  },
  street_lighting_electrical: {
    id: 'street_lighting_electrical',
    label: 'Street Lighting & Electrical',
    aliases: ['street light', 'dark road', 'lamp post', 'exposed wire', 'transformer', 'electrical'],
    defaultSeverity: 'low',
    description: 'Non-functional street lamps, hazardous sagging overhead cables, unshielded junction boxes',
  },
  drainage_waterlogging: {
    id: 'drainage_waterlogging',
    label: 'Drainage & Waterlogging',
    aliases: ['drainage', 'waterlogging', 'flooding', 'culvert', 'stormwater', 'stagnant water'],
    defaultSeverity: 'high',
    description: 'Monsoon water stagnation, choked stormwater drains, blocked road culverts',
  },
  sewage_overflow: {
    id: 'sewage_overflow',
    label: 'Sewage Overflow',
    aliases: ['sewage', 'drain overflow', 'manhole', 'sanitary sewer', 'septic', 'foul smell'],
    defaultSeverity: 'critical',
    description: 'Open sanitary sewer manholes, overflowing domestic wastewater on thoroughfares',
  },
  tree_greenery_hazard: {
    id: 'tree_greenery_hazard',
    label: 'Tree & Greenery Hazard',
    aliases: ['tree fall', 'branch', 'dangerous tree', 'leaning tree', 'greenery hazard'],
    defaultSeverity: 'medium',
    description: 'Fallen limbs on carriageways, dangerously leaning trees intersecting power lines',
  },
  unauthorized_encroachment: {
    id: 'unauthorized_encroachment',
    label: 'Unauthorized Encroachment',
    aliases: ['encroachment', 'footpath blocked', 'illegal stall', 'construction debris obstruction'],
    defaultSeverity: 'low',
    description: 'Obstruction of pedestrian rights of way, unpermitted commercial footpath occupations',
  },
};

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];

export const EVENT_STATUSES = {
  REPORTED: 'reported',
  VERIFIED: 'verified',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
};

export const EVENT_STATUS_TRANSITIONS = {
  [EVENT_STATUSES.REPORTED]: [EVENT_STATUSES.VERIFIED, EVENT_STATUSES.RESOLVED],
  [EVENT_STATUSES.VERIFIED]: [EVENT_STATUSES.IN_PROGRESS, EVENT_STATUSES.RESOLVED],
  [EVENT_STATUSES.IN_PROGRESS]: [EVENT_STATUSES.RESOLVED],
  [EVENT_STATUSES.RESOLVED]: [EVENT_STATUSES.VERIFIED], // Reopen on verified audit shortfall
};

export const RECOMMENDATION_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  IMPLEMENTED: 'implemented',
};

export const RECOMMENDATION_TRANSITIONS = {
  [RECOMMENDATION_STATUSES.PENDING]: [RECOMMENDATION_STATUSES.ACCEPTED, RECOMMENDATION_STATUSES.REJECTED],
  [RECOMMENDATION_STATUSES.ACCEPTED]: [RECOMMENDATION_STATUSES.IMPLEMENTED, RECOMMENDATION_STATUSES.REJECTED],
  [RECOMMENDATION_STATUSES.REJECTED]: [RECOMMENDATION_STATUSES.PENDING],
  [RECOMMENDATION_STATUSES.IMPLEMENTED]: [],
};

export const DEFAULT_PRIVACY_RULES = {
  minCohortThreshold: 5, // Cells with < 5 events are suppressed
  differentialPrivacyEpsilon: 1.0, // Laplace scale parameter for published metric counts
  suppressSparseCells: true,
  coordinatePerturbation: 'ward_centroid_only',
  rulesetVersion: 'v1.0.0-k5',
  updatedAt: '2026-11-01T00:00:00.000Z',
  updatedBy: 'system',
};

export const MUNICIPAL_WARDS = [
  {
    id: 'ward-101',
    code: '101',
    name: 'Indiranagar',
    zone: 'East Zone',
    population: 42500,
    areaKm2: 3.4,
    center: [12.9784, 77.6408],
    bounds: { north: 12.989, south: 12.967, east: 77.652, west: 77.629 },
  },
  {
    id: 'ward-102',
    code: '102',
    name: 'Koramangala',
    zone: 'South Zone',
    population: 51200,
    areaKm2: 4.1,
    center: [12.9352, 77.6245],
    bounds: { north: 12.946, south: 12.924, east: 77.636, west: 77.613 },
  },
  {
    id: 'ward-150',
    code: '150',
    name: 'Bellandur',
    zone: 'Mahadevapura',
    population: 84300,
    areaKm2: 11.2,
    center: [12.9304, 77.6784],
    bounds: { north: 12.951, south: 12.909, east: 77.701, west: 77.656 },
  },
  {
    id: 'ward-174',
    code: '174',
    name: 'HSR Layout',
    zone: 'Bommanahalli',
    population: 68100,
    areaKm2: 7.0,
    center: [12.9121, 77.6446],
    bounds: { north: 12.928, south: 12.896, east: 77.662, west: 77.627 },
  },
  {
    id: 'ward-72',
    code: '72',
    name: 'Malleshwaram',
    zone: 'West Zone',
    population: 46800,
    areaKm2: 3.8,
    center: [13.0031, 77.5643],
    bounds: { north: 13.018, south: 12.988, east: 77.576, west: 77.552 },
  },
  {
    id: 'ward-85',
    code: '85',
    name: 'Whitefield',
    zone: 'Mahadevapura',
    population: 79200,
    areaKm2: 9.5,
    center: [12.9698, 77.7499],
    bounds: { north: 12.988, south: 12.951, east: 77.768, west: 77.731 },
  },
  {
    id: 'ward-112',
    code: '112',
    name: 'Jayanagar',
    zone: 'South Zone',
    population: 49400,
    areaKm2: 4.5,
    center: [12.9308, 77.5838],
    bounds: { north: 12.945, south: 12.916, east: 77.596, west: 77.571 },
  },
  {
    id: 'ward-160',
    code: '160',
    name: 'BTM Layout',
    zone: 'South Zone',
    population: 58900,
    areaKm2: 5.2,
    center: [12.9166, 77.6101],
    bounds: { north: 12.929, south: 12.904, east: 77.623, west: 77.597 },
  },
  {
    id: 'ward-45',
    code: '45',
    name: 'Hebbal',
    zone: 'North Zone',
    population: 62400,
    areaKm2: 6.8,
    center: [13.0358, 77.597],
    bounds: { north: 13.052, south: 13.019, east: 77.612, west: 77.582 },
  },
  {
    id: 'ward-198',
    code: '198',
    name: 'RR Nagar',
    zone: 'RR Nagar',
    population: 71500,
    areaKm2: 8.9,
    center: [12.9279, 77.5154],
    bounds: { north: 12.946, south: 12.909, east: 77.534, west: 77.496 },
  },
];

export const PUBLIC_FIELDS_WHITELIST = [
  'metricId',
  'wardId',
  'wardName',
  'zone',
  'category',
  'categoryLabel',
  'timeWindow',
  'displayCount',
  'ratePer10kPopulation',
  'suppressed',
  'suppressionReason',
  'trendDirection',
  'percentChange',
  'severityBreakdown',
  'anomalyScore',
  'lastAggregatedAt',
  'schemaVersion',
];

// PII & sensitive data detection regexes
const AADHAAR_REGEX = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i;
const PHONE_REGEX = /\b(?:\+91|0)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

export const sanitizeText = (val, maxLen = 500) => {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '') // strip HTML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, maxLen);
};

export const containsPii = (input) => {
  if (!input) return false;
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return (
    AADHAAR_REGEX.test(str) ||
    PAN_REGEX.test(str) ||
    PHONE_REGEX.test(str) ||
    EMAIL_REGEX.test(str)
  );
};

export const normalizeIssueCategory = (rawCategory) => {
  if (!rawCategory || typeof rawCategory !== 'string') return 'potholes_road_damage';
  const clean = rawCategory.trim().toLowerCase();
  for (const [key, cat] of Object.entries(ISSUE_CATEGORIES)) {
    if (key === clean) return key;
    if (cat.label.toLowerCase() === clean) return key;
    if (cat.aliases.some((alias) => clean.includes(alias))) return key;
  }
  return 'potholes_road_damage';
};

export const normalizeWardId = (rawWard) => {
  if (!rawWard || typeof rawWard !== 'string') return 'ward-101';
  const clean = rawWard.trim().toLowerCase();
  for (const w of MUNICIPAL_WARDS) {
    if (w.id.toLowerCase() === clean) return w.id;
    if (w.name.toLowerCase() === clean) return w.id;
    if (clean.includes(w.name.toLowerCase()) || clean.includes(w.code)) return w.id;
  }
  return 'ward-101';
};

export function validateEventPayload(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return ['Event payload must be a valid object.'];
  }

  if (containsPii(data)) {
    errors.push('Personal identifiable information (Aadhaar, PAN, phone number, or email) is strictly forbidden in civic reports.');
  }

  const wardId = normalizeWardId(data.wardId || data.ward);
  if (!MUNICIPAL_WARDS.some((w) => w.id === wardId)) {
    errors.push(`Invalid ward identifier: ${data.wardId}`);
  }

  const category = normalizeIssueCategory(data.category);
  if (!ISSUE_CATEGORIES[category]) {
    errors.push(`Invalid category: ${data.category}`);
  }

  if (data.severity && !SEVERITIES.includes(data.severity)) {
    errors.push(`Invalid severity: ${data.severity}. Must be one of: ${SEVERITIES.join(', ')}`);
  }

  if (data.status && !Object.values(EVENT_STATUSES).includes(data.status)) {
    errors.push(`Invalid status: ${data.status}`);
  }

  return errors;
}

export function validatePrivacyRulePayload(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return ['Privacy rule payload must be an object.'];
  }

  if (typeof data.minCohortThreshold !== 'number' || data.minCohortThreshold < 3 || data.minCohortThreshold > 50) {
    errors.push('minCohortThreshold must be an integer between 3 and 50.');
  }

  if (data.differentialPrivacyEpsilon !== undefined) {
    if (typeof data.differentialPrivacyEpsilon !== 'number' || data.differentialPrivacyEpsilon <= 0 || data.differentialPrivacyEpsilon > 10) {
      errors.push('differentialPrivacyEpsilon must be a positive number up to 10.0.');
    }
  }

  return errors;
}

export function validateRecommendationReviewPayload(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return ['Review payload must be an object.'];
  }

  if (![RECOMMENDATION_STATUSES.ACCEPTED, RECOMMENDATION_STATUSES.REJECTED].includes(data.status)) {
    errors.push('Review status must be either "accepted" or "rejected".');
  }

  if (!data.notes || typeof data.notes !== 'string' || data.notes.trim().length < 5) {
    errors.push('Review notes explaining the operational decision are required (minimum 5 characters).');
  }

  if (containsPii(data.notes)) {
    errors.push('Review notes must not contain citizen personal identifiers or contact details.');
  }

  return errors;
}

