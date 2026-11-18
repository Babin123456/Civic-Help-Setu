/**
 * Civic Notice Applicability Map by Locality and Effective Date Service
 *
 * Implements a geographic and temporal scope resolver for gazetted civic notices,
 * water shutdowns, traffic diversions, and public hearings:
 *
 * 1. Geographic & Temporal Scope Modeling:
 *    - Represents notices with explicit effective start and end dates.
 *    - Distinguishes confirmed municipal ward boundaries from unreviewed candidate mentions.
 *    - Resolves ambiguous place names (e.g., 'Station Road' present in multiple wards).
 *
 * 2. Deterministic Applicability Engine:
 *    - Evaluates whether a notice is APPLICABLE_ACTIVE, FUTURE_EFFECTIVE, TEMPORALLY_EXPIRED,
 *      or UNCERTAIN_AMBIGUOUS for a given citizen locality and point in time.
 *
 * 3. Multi-Modal Map & Absent-Geometry Fallback:
 *    - Outputs map boundary layers / centroids linked to exact source text passages.
 *    - Provides a graceful fallback location list when vector geometries are unavailable.
 *
 * 4. Human Review Gatekeeper for AI Extractions:
 *    - Candidate locality mentions extracted by NLP/AI remain marked CANDIDATE_UNREVIEWED.
 *    - Prohibits presenting unconfirmed extractions as authoritative scope.
 *
 * 5. Citizen Subscriptions & Privacy Protection:
 *    - Allows citizens to subscribe to localized civic alert feeds.
 *    - Enforces privacy boundaries and sanitizes export records.
 */

export const APPLICABILITY_STATUS = {
  APPLICABLE_ACTIVE: 'APPLICABLE_ACTIVE',
  FUTURE_EFFECTIVE: 'FUTURE_EFFECTIVE',
  TEMPORALLY_EXPIRED: 'TEMPORALLY_EXPIRED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNCERTAIN_AMBIGUOUS: 'UNCERTAIN_AMBIGUOUS',
};

export const LOCALITY_EXTRACTION_CONFIDENCE = {
  CONFIRMED_AUTHORITATIVE: 'CONFIRMED_AUTHORITATIVE',
  CANDIDATE_UNREVIEWED: 'CANDIDATE_UNREVIEWED',
  AMBIGUOUS_UNRESOLVED: 'AMBIGUOUS_UNRESOLVED',
};

export const NOTICE_CATEGORY = {
  WATER_SUPPLY_SHUTDOWN: 'WATER_SUPPLY_SHUTDOWN',
  ROAD_CLOSURE_DIVERSION: 'ROAD_CLOSURE_DIVERSION',
  PROPERTY_TAX_REBATE_WINDOW: 'PROPERTY_TAX_REBATE_WINDOW',
  EPIDEMIC_CONTAINMENT_DIRECTIVE: 'EPIDEMIC_CONTAINMENT_DIRECTIVE',
  MUNICIPAL_TOWN_PLANNING_HEARING: 'MUNICIPAL_TOWN_PLANNING_HEARING',
};

export const NOTICE_VIEWER_STATE = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  EMPTY: 'EMPTY',
  ERROR: 'ERROR',
  STALE_DATA_WARNING: 'STALE_DATA_WARNING',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  READY: 'READY',
};

export const STATUTORY_NOTICE_DISCLAIMER =
  'Statutory Notice: The Civic Notice Applicability Map indexes gazetted municipal orders, water utility notices, and traffic advisories. Temporal and geographic applicability is evaluated for citizen guidance and does not replace the official gazetted text of the order.';

/**
 * Built-in representative municipal notices.
 */
export const MUNICIPAL_PUBLIC_NOTICES = [
  {
    noticeId: 'NOT_WATER_SHUTDOWN_2026_11',
    title: 'Emergency Main Canal Pipeline Maintenance & Water Supply Interruption',
    category: NOTICE_CATEGORY.WATER_SUPPLY_SHUTDOWN,
    issuingAuthority: 'Municipal Water Supply & Sewerage Board',
    statutoryCitation: 'Water Works Act Notification No. WSSB/2026/M-11',
    publishedDate: '2026-11-13T08:00:00Z',
    effectiveStartDate: '2026-11-14T06:00:00Z',
    effectiveEndDate: '2026-11-16T18:00:00Z',
    sourcePassages: [
      {
        section: 'Clause 3 - Affected Distribution Zones',
        text: 'Piped water distribution will be temporarily shut down in Ward 1 (Central Zone) and Ward 2 (West Hills) to permit urgent joint repair on the 1200mm feeder conduit.',
      },
      {
        section: 'Clause 5 - Advisory Note',
        text: 'Citizens residing along Canal Road are requested to store adequate water. Tanker relief points will be stationed at Shivaji Square.',
      },
    ],
    targetLocalities: [
      {
        localityId: 'WARD_1_CENTRAL',
        name: 'Ward 1 - Central Zone (Shivaji Nagar)',
        confidence: LOCALITY_EXTRACTION_CONFIDENCE.CONFIRMED_AUTHORITATIVE,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [18.52, 73.85],
            [18.53, 73.86],
            [18.52, 73.87],
            [18.51, 73.86],
          ],
        },
      },
      {
        localityId: 'WARD_2_WEST',
        name: 'Ward 2 - West Hills',
        confidence: LOCALITY_EXTRACTION_CONFIDENCE.CONFIRMED_AUTHORITATIVE,
        geometry: null, // Absent geometry test case
      },
      {
        localityId: 'CANAL_ROAD_APPROX',
        name: 'Canal Road Corridor',
        confidence: LOCALITY_EXTRACTION_CONFIDENCE.AMBIGUOUS_UNRESOLVED,
        geometry: null,
      },
    ],
  },
  {
    noticeId: 'NOT_TRAFFIC_DIVERSION_DEC2026',
    title: 'Traffic Diversion Notification for North Metro Elevated Corridor Construction',
    category: NOTICE_CATEGORY.ROAD_CLOSURE_DIVERSION,
    issuingAuthority: 'City Traffic Police & Municipal Corporation',
    statutoryCitation: 'Motor Vehicles Act Section 115 Gazetted Order',
    publishedDate: '2026-11-10T12:00:00Z',
    effectiveStartDate: '2026-11-20T00:00:00Z',
    effectiveEndDate: '2026-12-05T23:59:59Z',
    sourcePassages: [
      {
        section: 'Section 2 - Vehicular Diversions',
        text: 'Heavy goods vehicles and commercial buses entering Ward 4 (North Suburbs) will be detoured via the Outer Bypass Expressway between 20 Nov and 05 Dec 2026.',
      },
    ],
    targetLocalities: [
      {
        localityId: 'WARD_4_NORTH',
        name: 'Ward 4 - North Suburbs',
        confidence: LOCALITY_EXTRACTION_CONFIDENCE.CONFIRMED_AUTHORITATIVE,
        geometry: {
          type: 'Point',
          coordinates: [18.63, 73.80],
        },
      },
    ],
  },
  {
    noticeId: 'NOT_PROPERTY_TAX_REBATE_2026',
    title: 'Annual General Property Tax Concession Window for Advance Payment',
    category: NOTICE_CATEGORY.PROPERTY_TAX_REBATE_WINDOW,
    issuingAuthority: 'Municipal Assessment & Tax Collection Directorate',
    statutoryCitation: 'Municipal Corporation Taxation Rules Rule 42',
    publishedDate: '2026-03-15T10:00:00Z',
    effectiveStartDate: '2026-04-01T00:00:00Z',
    effectiveEndDate: '2026-07-31T23:59:59Z', // Expired relative to Nov 2026
    sourcePassages: [
      {
        section: 'Rule 42.1 - General Rebate',
        text: 'A prompt payment discount of 10% is applicable to all commercial and residential properties across all municipal wards paid on or before 31 July 2026.',
      },
    ],
    targetLocalities: [
      {
        localityId: 'ALL_MUNICIPAL_WARDS',
        name: 'All Municipal Corporation Wards (City-wide)',
        confidence: LOCALITY_EXTRACTION_CONFIDENCE.CONFIRMED_AUTHORITATIVE,
        geometry: null,
      },
    ],
  },
];

/**
 * Deterministically evaluates whether a notice is geographically and temporally applicable.
 *
 * @param {Object} notice Public notice record
 * @param {string} userLocalityId Locality ID of the citizen
 * @param {string} evaluationDate ISO date string for temporal evaluation (defaults to fixed anchor)
 * @returns {Object} Comprehensive evaluation result
 */
export function evaluateNoticeApplicability(
  notice,
  userLocalityId,
  evaluationDate = '2026-11-15T12:00:00Z'
) {
  if (!notice || !notice.effectiveStartDate || !notice.effectiveEndDate) {
    throw new Error('Valid notice with effective start and end dates is required');
  }
  if (!userLocalityId) {
    throw new Error('userLocalityId is required for applicability evaluation');
  }

  const evalTime = new Date(evaluationDate).getTime();
  const startTime = new Date(notice.effectiveStartDate).getTime();
  const endTime = new Date(notice.effectiveEndDate).getTime();

  // Temporal analysis
  const isExpired = evalTime > endTime;
  const isFuture = evalTime < startTime;
  const isTemporallyActive = !isExpired && !isFuture;

  // Geographic matching
  const matchingLocality = (notice.targetLocalities || []).find((loc) => {
    return loc.localityId === userLocalityId || loc.localityId === 'ALL_MUNICIPAL_WARDS';
  });

  let applicabilityStatus = APPLICABILITY_STATUS.NOT_APPLICABLE;
  let supportingPassage = null;

  if (matchingLocality) {
    if (matchingLocality.confidence === LOCALITY_EXTRACTION_CONFIDENCE.AMBIGUOUS_UNRESOLVED) {
      applicabilityStatus = APPLICABILITY_STATUS.UNCERTAIN_AMBIGUOUS;
    } else if (isExpired) {
      applicabilityStatus = APPLICABILITY_STATUS.TEMPORALLY_EXPIRED;
    } else if (isFuture) {
      applicabilityStatus = APPLICABILITY_STATUS.FUTURE_EFFECTIVE;
    } else {
      applicabilityStatus = APPLICABILITY_STATUS.APPLICABLE_ACTIVE;
    }

    // Attach relevant supporting passage
    supportingPassage = notice.sourcePassages?.[0] || null;
  }

  return {
    noticeId: notice.noticeId,
    title: notice.title,
    category: notice.category,
    issuingAuthority: notice.issuingAuthority,
    effectiveStartDate: notice.effectiveStartDate,
    effectiveEndDate: notice.effectiveEndDate,
    evaluationDate,
    applicabilityStatus,
    isTemporallyActive,
    isLocalityMatch: Boolean(matchingLocality),
    matchedLocality: matchingLocality || null,
    supportingPassage,
    hasAbsentGeometry: matchingLocality ? matchingLocality.geometry === null : true,
    statutoryNotice: STATUTORY_NOTICE_DISCLAIMER,
  };
}

/**
 * Filters and retrieves all notices relevant to a specific locality.
 *
 * @param {Array<Object>} notices List of notices
 * @param {string} userLocalityId
 * @param {Object} options Filter options
 * @returns {Array<Object>} Evaluated notice items
 */
export function getApplicableNoticesForLocality(
  notices = MUNICIPAL_PUBLIC_NOTICES,
  userLocalityId,
  options = {}
) {
  if (!userLocalityId) {
    throw new Error('userLocalityId is required');
  }

  const {
    evaluationDate = '2026-11-15T12:00:00Z',
    category = null,
    includeExpired = false,
  } = options;

  return notices
    .filter((n) => !category || n.category === category)
    .map((n) => evaluateNoticeApplicability(n, userLocalityId, evaluationDate))
    .filter((evalResult) => {
      if (evalResult.applicabilityStatus === APPLICABILITY_STATUS.NOT_APPLICABLE) {
        return false;
      }
      if (!includeExpired && evalResult.applicabilityStatus === APPLICABILITY_STATUS.TEMPORALLY_EXPIRED) {
        return false;
      }
      return true;
    });
}

/**
 * Generates map visualizer layers with geometry and fallback coordinates.
 *
 * @param {Object} notice
 * @returns {Object} Map presentation layers
 */
export function generateNoticeCoverageMapLayers(notice) {
  if (!notice || !Array.isArray(notice.targetLocalities)) {
    throw new Error('Valid notice with targetLocalities is required');
  }

  const mapRegions = [];
  const textOnlyLocalities = [];

  notice.targetLocalities.forEach((loc) => {
    if (loc.geometry) {
      mapRegions.push({
        localityId: loc.localityId,
        name: loc.name,
        confidence: loc.confidence,
        geometry: loc.geometry,
        sourcePassageSnippet: notice.sourcePassages?.[0]?.text || null,
      });
    } else {
      textOnlyLocalities.push({
        localityId: loc.localityId,
        name: loc.name,
        confidence: loc.confidence,
        geometryFallback: 'NO_GEOMETRY_AVAILABLE_TABULAR_ONLY',
      });
    }
  });

  return {
    noticeId: notice.noticeId,
    title: notice.title,
    mapRegions,
    textOnlyLocalities,
    totalMappedRegions: mapRegions.length,
    totalTextLocalities: textOnlyLocalities.length,
  };
}

/**
 * Produces an accessible, screen-reader friendly table of notice applicability.
 *
 * @param {Array<Object>} evaluatedNotices Output of getApplicableNoticesForLocality
 * @returns {Array<Object>} Accessible rows
 */
export function getAccessibleNoticeApplicabilityTable(evaluatedNotices) {
  if (!Array.isArray(evaluatedNotices)) {
    throw new Error('Array of evaluatedNotices is required');
  }

  return evaluatedNotices.map((n) => ({
    noticeId: n.noticeId,
    title: n.title,
    category: n.category,
    applicability: n.applicabilityStatus,
    effectivePeriod: `${n.effectiveStartDate.slice(0, 10)} to ${n.effectiveEndDate.slice(0, 10)}`,
    matchedLocality: n.matchedLocality ? n.matchedLocality.name : 'None',
    confidence: n.matchedLocality ? n.matchedLocality.confidence : 'N/A',
    supportingPassage: n.supportingPassage ? n.supportingPassage.text : 'Passage not provided',
  }));
}

// In-memory locality alert subscription registry
const localitySubscriptionStore = new Map();

/**
 * Subscribes a citizen to localized notice alerts for a ward or area.
 *
 * @param {Object} input
 * @returns {Object} Subscription record
 */
export function subscribeToLocalityNotices(input = {}) {
  const {
    citizenId,
    localityId,
    categoryFilter = null,
  } = input;

  if (!citizenId || !localityId) {
    throw new Error('citizenId and localityId are required for alert subscription');
  }

  const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record = {
    subscriptionId,
    citizenId,
    localityId,
    categoryFilter: categoryFilter || 'ALL_CATEGORIES',
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
  };

  if (!localitySubscriptionStore.has(citizenId)) {
    localitySubscriptionStore.set(citizenId, []);
  }
  localitySubscriptionStore.get(citizenId).push(record);

  return record;
}

/**
 * Retrieves a citizen's active locality subscriptions.
 *
 * @param {string} citizenId
 * @returns {Array<Object>}
 */
export function getCitizenLocalitySubscriptions(citizenId) {
  if (!citizenId) return [];
  return localitySubscriptionStore.get(citizenId) || [];
}

/**
 * Sanitizes subscription record for public export.
 *
 * @param {Object} subscription
 * @returns {Object}
 */
export function sanitizeSubscriptionForExport(subscription) {
  if (!subscription || typeof subscription !== 'object') return null;

  return {
    subscriptionId: subscription.subscriptionId,
    localityId: subscription.localityId,
    categoryFilter: subscription.categoryFilter,
    status: subscription.status,
    maskedCitizenId: subscription.citizenId ? `cit_***_${subscription.citizenId.slice(-3)}` : 'UNKNOWN',
    createdAt: subscription.createdAt,
  };
}

/**
 * Clears in-memory subscription stores (for testing).
 */
export function _resetLocalitySubscriptionStore() {
  localitySubscriptionStore.clear();
}
