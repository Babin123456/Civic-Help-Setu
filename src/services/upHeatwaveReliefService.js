/**
 * Service: UP Community Heatwave Exposure and Cooling-Relief Coordination Map (#983).
 * Manages verified facility listings, stale record re-verification flags, seasonal expiry,
 * partner status updates, citizen time-stamped corrections, conflicting report resolution,
 * district heat-alert context, and resilient offline draft caching.
 */

import {
  RELIEF_FACILITY_TYPES,
  OPERATIONAL_STATUS,
  CAPACITY_STATUS,
  SOURCE_TIERS,
  HEAT_ALERT_LEVELS,
  calculateFacilityFreshness,
  validateCommunityObservation,
  sanitizeAndRedactText,
  snapCoordinates,
  isCoordinateWithinUP,
} from '../data/upHeatwaveReliefContract';
import { SEED_HEATWAVE_FACILITIES } from '../data/upHeatwaveReliefSeed';

const STORAGE_KEY = 'civicbridge_up_heat_relief_facilities_v1';
const OBSERVATIONS_KEY = 'civicbridge_up_heat_observations_v1';
const DRAFT_QUEUE_KEY = 'civicbridge_up_heat_draft_queue_v1';
const RATE_LIMIT_KEY = 'civicbridge_up_heat_rate_limits_v1';

let inMemoryFacilities = null;
let inMemoryObservations = null;
let inMemoryDraftQueue = null;
let inMemoryRateLimits = [];

const getLocalStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

/**
 * Reset helper for deterministic test isolation
 */
export function _resetStorageForTesting(customSeed = null) {
  inMemoryFacilities = customSeed
    ? JSON.parse(JSON.stringify(customSeed))
    : JSON.parse(JSON.stringify(SEED_HEATWAVE_FACILITIES));
  inMemoryObservations = [];
  inMemoryDraftQueue = [];
  inMemoryRateLimits = [];

  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.removeItem(STORAGE_KEY);
      ls.removeItem(OBSERVATIONS_KEY);
      ls.removeItem(DRAFT_QUEUE_KEY);
      ls.removeItem(RATE_LIMIT_KEY);
    } catch {
      // Ignore in testing envs without localStorage
    }
  }
}

/**
 * Loads all raw stored facilities
 */
function loadRawFacilities() {
  if (inMemoryFacilities !== null) {
    return inMemoryFacilities;
  }
  const ls = getLocalStorage();
  if (ls) {
    try {
      const raw = ls.getItem(STORAGE_KEY);
      if (raw) {
        inMemoryFacilities = JSON.parse(raw);
        return inMemoryFacilities;
      }
    } catch {
      // Fallback to seed
    }
  }
  inMemoryFacilities = JSON.parse(JSON.stringify(SEED_HEATWAVE_FACILITIES));
  return inMemoryFacilities;
}

/**
 * Persists facilities list
 */
function saveFacilities(facilities) {
  inMemoryFacilities = facilities;
  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(facilities));
    } catch {
      // Storage unavailable or full
    }
  }
}

/**
 * Loads community observations
 */
function loadObservations() {
  if (inMemoryObservations !== null) {
    return inMemoryObservations;
  }
  const ls = getLocalStorage();
  if (ls) {
    try {
      const raw = ls.getItem(OBSERVATIONS_KEY);
      if (raw) {
        inMemoryObservations = JSON.parse(raw);
        return inMemoryObservations;
      }
    } catch {
      // Fallback
    }
  }
  inMemoryObservations = [];
  return inMemoryObservations;
}

/**
 * Persists observations
 */
function saveObservations(obs) {
  inMemoryObservations = obs;
  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.setItem(OBSERVATIONS_KEY, JSON.stringify(obs));
    } catch {
      // Storage unavailable
    }
  }
}

/**
 * Calculates Haversine distance in kilometers between two coordinate pairs
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number'
  ) {
    return null;
  }

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Resolves conflicting reports and calculates effective operational status.
 * Acceptance criteria:
 * - Temporary availability is clearly distinguished from permanent facility details.
 * - Stale records are automatically marked for re-verification.
 * - Conflicting reports are detected and surfaced as disputed rather than silently overwriting.
 */
export function resolveFacilityDynamicStatus(facility, observations = [], currentTime = new Date()) {
  const freshness = calculateFacilityFreshness(facility, currentTime);
  const nowMs = new Date(currentTime).getTime();

  // Find recent observations for this facility within last 4 hours
  const recentObservations = observations
    .filter((o) => o.facilityId === facility.id)
    .filter((o) => {
      const t = new Date(o.timestamp).getTime();
      return nowMs - t <= 4 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  let effectiveStatus = facility.operationalStatus || OPERATIONAL_STATUS.OPEN;
  let effectiveCapacity = facility.currentCapacityStatus || CAPACITY_STATUS.AVAILABLE;
  let temporaryReason = facility.temporaryClosureReason || null;
  let isDisputed = false;
  let disputeDetails = null;

  // Check for conflicting citizen reports against official status
  const contradictoryReports = recentObservations.filter((o) => {
    // If official says open, but citizen reports temporarily closed
    if (effectiveStatus === OPERATIONAL_STATUS.OPEN && o.observedStatus === OPERATIONAL_STATUS.TEMPORARILY_CLOSED) {
      return true;
    }
    // If official says closed, but citizen reports open
    if (effectiveStatus === OPERATIONAL_STATUS.TEMPORARILY_CLOSED && o.observedStatus === OPERATIONAL_STATUS.OPEN) {
      return true;
    }
    return false;
  });

  if (contradictoryReports.length >= 2) {
    isDisputed = true;
    disputeDetails = {
      contradictoryCount: contradictoryReports.length,
      latestReportSummary: contradictoryReports[0].feedbackNote || 'Recent citizen observations conflict with recorded authority status.',
      reportedStatus: contradictoryReports[0].observedStatus,
    };
  }

  // If there is a fresh single observation that is not contradictory, update capacity estimate
  if (recentObservations.length > 0 && !isDisputed) {
    if (recentObservations[0].currentCapacityStatus) {
      effectiveCapacity = recentObservations[0].currentCapacityStatus;
    }
  }

  return {
    ...facility,
    freshness,
    effectiveOperationalStatus: effectiveStatus,
    effectiveCapacityStatus: effectiveCapacity,
    temporaryClosureReason: temporaryReason,
    isDisputed,
    disputeDetails,
    isStale: freshness.isStale,
    isSeasonActive: freshness.isSeasonActive,
    recentObservationsCount: recentObservations.length,
  };
}

/**
 * Returns filtered heatwave relief facilities with freshness and conflict analysis
 * Acceptance Criteria:
 * - Every listed facility has a source, responsible authority, and last-verified date.
 * - Temporary availability is distinguished from permanent details.
 * - Stale records are automatically marked for re-verification.
 * - District filters and accessible queries.
 * - No precise user location stored without explicit consent.
 */
export function listHeatReliefFacilities(filters = {}, currentTime = new Date()) {
  const rawFacilities = loadRawFacilities();
  const observations = loadObservations();

  const {
    district = 'Lucknow',
    wardOrVillage = '',
    facilityType = 'all',
    onlyOpen = false,
    onlyWheelchair = false,
    onlyOrsAvailable = false,
    onlyDrinkingWater = false,
    searchQuery = '',
    userCoordinates = null,
    locationConsentGranted = false, // Strictly gate GPS distance on explicit consent
  } = filters;

  return rawFacilities
    .filter((facility) => {
      // District filter (case-insensitive)
      if (district && facility.district.toLowerCase() !== district.toLowerCase()) {
        return false;
      }

      // Ward / Village filter
      if (wardOrVillage && !facility.wardOrVillage.toLowerCase().includes(wardOrVillage.toLowerCase())) {
        return false;
      }

      // Facility Type filter
      if (facilityType && facilityType !== 'all' && facility.facilityType !== facilityType) {
        return false;
      }

      // Wheelchair accessibility filter
      if (onlyWheelchair && !facility.accessibility?.wheelchairAccessible) {
        return false;
      }

      // ORS availability filter
      if (onlyOrsAvailable && !facility.accessibility?.orsAvailable) {
        return false;
      }

      // Potable drinking water filter
      if (onlyDrinkingWater && !facility.accessibility?.drinkingWaterAvailable && facility.facilityType !== RELIEF_FACILITY_TYPES.DRINKING_WATER_POINT) {
        return false;
      }

      // Search Query filter (searches name, address, ward, authority)
      if (searchQuery && searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesName = facility.name.toLowerCase().includes(q);
        const matchesAddress = facility.address.toLowerCase().includes(q);
        const matchesWard = facility.wardOrVillage.toLowerCase().includes(q);
        const matchesAuthority = facility.responsibleAuthority.toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesWard && !matchesAuthority) {
          return false;
        }
      }

      return true;
    })
    .map((facility) => {
      const resolved = resolveFacilityDynamicStatus(facility, observations, currentTime);

      // Distance calculation only if explicit location consent was granted
      let distanceKm = null;
      if (locationConsentGranted && userCoordinates && userCoordinates.lat && userCoordinates.lng) {
        distanceKm = calculateDistanceKm(
          userCoordinates.lat,
          userCoordinates.lng,
          facility.coordinates.lat,
          facility.coordinates.lng
        );
      }

      return {
        ...resolved,
        distanceKm,
      };
    })
    .filter((resolved) => {
      // Only open filter
      if (onlyOpen) {
        if (!resolved.isSeasonActive) return false;
        if (resolved.effectiveOperationalStatus !== OPERATIONAL_STATUS.OPEN) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // If distance is available, sort nearest first; otherwise sort by verified freshness
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return (b.verifiedAt ? new Date(b.verifiedAt).getTime() : 0) - (a.verifiedAt ? new Date(a.verifiedAt).getTime() : 0);
    });
}

/**
 * Submits a citizen observation / correction report
 */
export function submitCommunityObservation(rawPayload, currentTime = new Date()) {
  const validation = validateCommunityObservation(rawPayload, currentTime);
  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Anti-flooding / rate-limit check (in memory)
  const nowMs = new Date(currentTime).getTime();
  inMemoryRateLimits = inMemoryRateLimits.filter((t) => nowMs - t < 10 * 60 * 1000);
  if (inMemoryRateLimits.length >= 8) {
    return {
      success: false,
      errors: ['Rate limit reached. Please wait a few minutes before submitting another report.'],
    };
  }
  inMemoryRateLimits.push(nowMs);

  // Redact PII from feedback
  const { sanitizedText } = sanitizeAndRedactText(rawPayload.feedbackNote || '');

  // Snap coordinates if attached
  const snappedCoords = rawPayload.coordinates ? snapCoordinates(rawPayload.coordinates) : null;

  const observation = {
    id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    facilityId: rawPayload.facilityId,
    observedStatus: rawPayload.observedStatus,
    currentCapacityStatus: rawPayload.currentCapacityStatus || CAPACITY_STATUS.UNKNOWN,
    feedbackNote: sanitizedText,
    timestamp: rawPayload.timestamp || new Date(currentTime).toISOString(),
    sourceTier: SOURCE_TIERS.CITIZEN_OBSERVATION,
    coordinates: snappedCoords,
  };

  const observations = loadObservations();
  observations.unshift(observation);
  saveObservations(observations);

  // If observation is submitted by a user, also update the facility's lastReportedAt
  const facilities = loadRawFacilities();
  const index = facilities.findIndex((f) => f.id === rawPayload.facilityId);
  if (index !== -1) {
    facilities[index].lastReportedAt = observation.timestamp;
    facilities[index].lastReportSource = SOURCE_TIERS.CITIZEN_OBSERVATION;
    saveFacilities(facilities);
  }

  return {
    success: true,
    observation,
  };
}

/**
 * Updates facility temporary status by authorized local partner or municipal authority
 */
export function updatePartnerFacilityStatus(partnerPayload, currentTime = new Date()) {
  const {
    facilityId,
    operationalStatus,
    currentCapacityStatus,
    temporaryClosureReason,
    partnerName,
    partnerRole,
  } = partnerPayload;

  if (!facilityId) {
    return { success: false, errors: ['facilityId is required'] };
  }
  if (!partnerName || !partnerRole) {
    return { success: false, errors: ['Authorized partner identity (name & role) is required'] };
  }
  if (operationalStatus && !Object.values(OPERATIONAL_STATUS).includes(operationalStatus)) {
    return { success: false, errors: [`Invalid operationalStatus: "${operationalStatus}"`] };
  }

  const facilities = loadRawFacilities();
  const index = facilities.findIndex((f) => f.id === facilityId);
  if (index === -1) {
    return { success: false, errors: [`Facility "${facilityId}" not found`] };
  }

  const updatedTimestamp = new Date(currentTime).toISOString();

  if (operationalStatus) {
    facilities[index].operationalStatus = operationalStatus;
  }
  if (currentCapacityStatus) {
    facilities[index].currentCapacityStatus = currentCapacityStatus;
  }
  if (temporaryClosureReason !== undefined) {
    facilities[index].temporaryClosureReason = temporaryClosureReason;
  }

  facilities[index].lastReportedAt = updatedTimestamp;
  facilities[index].lastReportSource = SOURCE_TIERS.VERIFIED_PARTNER;
  saveFacilities(facilities);

  return {
    success: true,
    updatedFacility: facilities[index],
  };
}

/**
 * Returns district official heat-alert context (aligned with UPSDMA / IMD)
 * Non-medical disclaimer included as required by implementation criteria.
 */
export function getDistrictHeatAlert(district = 'Lucknow') {
  const normDistrict = (district || '').trim().toLowerCase();

  const districtAlerts = {
    lucknow: {
      district: 'Lucknow',
      alertLevel: HEAT_ALERT_LEVELS.HEAT_ALERT, // Orange
      maxTemperature: '43.8°C',
      feelsLike: '46.2°C',
      advisoryHeadline: 'ORANGE HEAT ALERT: High Dehydration Risk for Outdoor Workers & Commuters',
      officialSource: 'India Meteorological Department (IMD) & UP State Disaster Management Authority (UPSDMA)',
      issuingAuthority: 'District Disaster Management Authority (DDMA), Lucknow',
      bulletinId: 'UPSDMA/HEAT-ACTION-PLAN/LKO-2026/044',
      safetyGuidance: [
        'Avoid direct sun exposure between 11:30 AM and 03:30 PM.',
        'Drink lemon-salt water, chaach, or ORS frequently even if not feeling thirsty.',
        'Employers of outdoor labor and street vendors must ensure shaded rest breaks.',
        'Seek immediate rest in municipal cooling centers if dizziness or headache occurs.',
      ],
      emergencyContacts: {
        ddmaEmergencyRoom: '1077 (District Disaster Control Room)',
        stateDisasterHelpline: '1070 (Toll Free UPSDMA)',
        medicalAmbulance: '108 (Emergency Hospital Transport)',
        chiefMedicalOfficerControl: '0522-2622026 (Lucknow CMO Office)',
      },
    },
    'kanpur nagar': {
      district: 'Kanpur Nagar',
      alertLevel: HEAT_ALERT_LEVELS.SEVERE_EMERGENCY, // Red
      maxTemperature: '45.4°C',
      feelsLike: '48.1°C',
      advisoryHeadline: 'RED SEVERE HEAT EMERGENCY: Critical Heatstroke Warning',
      officialSource: 'IMD & Kanpur Nagar Disaster Management Cell',
      issuingAuthority: 'District Disaster Management Authority, Kanpur Nagar',
      bulletinId: 'UPSDMA/HEAT-ACTION-PLAN/KNP-2026/051',
      safetyGuidance: [
        'Severe heatwave conditions: Stay indoors in cooled areas during peak daytime hours.',
        'Keep livestock and pets in shaded spaces with continuous water availability.',
        'Utilize municipal emergency cooling shelters and cold water points.',
      ],
      emergencyContacts: {
        ddmaEmergencyRoom: '1077',
        stateDisasterHelpline: '1070',
        medicalAmbulance: '108',
      },
    },
    varanasi: {
      district: 'Varanasi',
      alertLevel: HEAT_ALERT_LEVELS.HEAT_WATCH, // Yellow
      maxTemperature: '41.5°C',
      feelsLike: '43.2°C',
      advisoryHeadline: 'YELLOW HEAT WATCH: Elevated Temperatures Across Ghats & City',
      officialSource: 'IMD & Varanasi DDMA',
      issuingAuthority: 'District Disaster Management Authority, Varanasi',
      bulletinId: 'UPSDMA/HEAT-ACTION-PLAN/VNS-2026/038',
      safetyGuidance: [
        'Wear lightweight cotton clothing and carry drinking water when outdoors.',
        'ORS packet distribution active at all government health help desks.',
      ],
      emergencyContacts: {
        ddmaEmergencyRoom: '1077',
        stateDisasterHelpline: '1070',
        medicalAmbulance: '108',
      },
    },
  };

  const defaultAlert = {
    district: district || 'Uttar Pradesh',
    alertLevel: HEAT_ALERT_LEVELS.HEAT_WATCH,
    maxTemperature: '41.0°C',
    feelsLike: '43.0°C',
    advisoryHeadline: 'YELLOW HEAT WATCH: Moderate Heat Conditions',
    officialSource: 'UPSDMA State Advisory Bulletin',
    issuingAuthority: 'State Disaster Management Authority (UPSDMA)',
    bulletinId: 'UPSDMA/STATE-BULLETIN/2026',
    safetyGuidance: [
      'Carry covered water bottles and stay hydrated throughout the day.',
      'Check cooling center locations before traveling through town.',
    ],
    emergencyContacts: {
      ddmaEmergencyRoom: '1077',
      stateDisasterHelpline: '1070',
      medicalAmbulance: '108',
    },
  };

  const found = districtAlerts[normDistrict] || defaultAlert;

  return {
    ...found,
    medicalDisclaimer:
      'Official disaster management advisory for public protection. Not a medical diagnostic tool or substitute for emergency medical care. In case of heat stroke symptoms (loss of consciousness, lack of sweating, high fever), call 108 emergency ambulance immediately.',
  };
}

/**
 * Offline Draft Queue Management
 */
export function getOfflineDraftQueue() {
  if (inMemoryDraftQueue !== null) {
    return inMemoryDraftQueue;
  }
  const ls = getLocalStorage();
  if (ls) {
    try {
      const raw = ls.getItem(DRAFT_QUEUE_KEY);
      if (raw) {
        inMemoryDraftQueue = JSON.parse(raw);
        return inMemoryDraftQueue;
      }
    } catch {
      // Ignore
    }
  }
  inMemoryDraftQueue = [];
  return inMemoryDraftQueue;
}

export function enqueueOfflineDraft(observationPayload) {
  const queue = getOfflineDraftQueue();
  const draft = {
    ...observationPayload,
    draftId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    queuedAt: new Date().toISOString(),
  };
  queue.push(draft);
  inMemoryDraftQueue = queue;

  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.setItem(DRAFT_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore
    }
  }
  return draft;
}

export function removeOfflineDraft(draftId) {
  const queue = getOfflineDraftQueue().filter((d) => d.draftId !== draftId);
  inMemoryDraftQueue = queue;
  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.setItem(DRAFT_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore
    }
  }
}

export function syncOfflineDrafts(currentTime = new Date()) {
  const queue = getOfflineDraftQueue();
  const results = { synced: 0, failed: 0, errors: [] };

  const remaining = [];
  queue.forEach((draft) => {
    const res = submitCommunityObservation(draft, currentTime);
    if (res.success) {
      results.synced += 1;
    } else {
      results.failed += 1;
      results.errors.push({ draftId: draft.draftId, errors: res.errors });
      remaining.push(draft);
    }
  });

  inMemoryDraftQueue = remaining;
  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.setItem(DRAFT_QUEUE_KEY, JSON.stringify(remaining));
    } catch {
      // Ignore
    }
  }

  return results;
}
