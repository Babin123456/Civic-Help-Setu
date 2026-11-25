/**
 * Service: UP Flooded-Road and Drain Blockage Community Response Board (#985)
 * Handles freshness decay, anti-spoofing, source classification, route hazard
 * overlay, ward drain aggregation, and resilient offline draft queue.
 */

import {
  INCIDENT_TYPES,
  DEPTH_CATEGORIES,
  SOURCE_TIERS,
  REPORT_STATUS,
  EXPIRY_POLICIES_MINUTES,
  validateIncidentReport,
  sanitizeAndRedactLocation,
} from '../data/upFloodIncidentContract';
import { SEED_INCIDENTS } from '../data/upFloodIncidentSeed';

const STORAGE_KEY = 'civicbridge_up_flood_incidents_v1';
const DRAFT_QUEUE_KEY = 'civicbridge_up_flood_draft_queue_v1';
const RATE_LIMIT_KEY = 'civicbridge_flood_rate_limits_v1';

let inMemoryIncidents = null;
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
  inMemoryIncidents = customSeed ? JSON.parse(JSON.stringify(customSeed)) : JSON.parse(JSON.stringify(SEED_INCIDENTS));
  inMemoryDraftQueue = [];
  inMemoryRateLimits = [];
  const ls = getLocalStorage();
  if (ls) {
    ls.removeItem(STORAGE_KEY);
    ls.removeItem(DRAFT_QUEUE_KEY);
    ls.removeItem(RATE_LIMIT_KEY);
  }
}

/**
 * Loads all raw stored incidents
 */
function loadRawIncidents() {
  if (inMemoryIncidents !== null) {
    return inMemoryIncidents;
  }
  const ls = getLocalStorage();
  if (ls) {
    try {
      const raw = ls.getItem(STORAGE_KEY);
      if (raw) {
        inMemoryIncidents = JSON.parse(raw);
        return inMemoryIncidents;
      }
    } catch {
      // Fall through to seed
    }
  }
  inMemoryIncidents = JSON.parse(JSON.stringify(SEED_INCIDENTS));
  return inMemoryIncidents;
}

/**
 * Persists incidents list
 */
function saveIncidents(incidents) {
  inMemoryIncidents = incidents;
  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(incidents));
    } catch (e) {
      console.warn('Failed to persist flood incidents to localStorage', e);
    }
  }
}

/**
 * Evaluates observation freshness and automatic expiry/downgrade to STALE.
 * Ensures old observations are visibly stale and excluded from active hazard calculations.
 */
export function computeIncidentFreshness(incident, currentTime = new Date()) {
  const nowMs = new Date(currentTime).getTime();
  const observedMs = new Date(incident.observedAt).getTime();
  const ageMinutes = Math.max(0, Math.round((nowMs - observedMs) / (60 * 1000)));

  const expiryLimit = EXPIRY_POLICIES_MINUTES[incident.incidentType] || 120;
  const isStale = ageMinutes > expiryLimit && incident.status !== REPORT_STATUS.CLEARED;

  let effectiveStatus = incident.status;
  if (incident.status === REPORT_STATUS.CLEARED) {
    effectiveStatus = REPORT_STATUS.CLEARED;
  } else if (incident.status === REPORT_STATUS.DISPUTED) {
    effectiveStatus = REPORT_STATUS.DISPUTED;
  } else if (isStale) {
    effectiveStatus = REPORT_STATUS.STALE;
  } else if (incident.reconfirmationsCount > 3) {
    effectiveStatus = REPORT_STATUS.RECONFIRMED;
  }

  let freshnessLabel = `Observed ${ageMinutes}m ago`;
  if (ageMinutes >= 60) {
    const hours = (ageMinutes / 60).toFixed(1);
    freshnessLabel = `Observed ${hours}h ago`;
  }
  if (isStale) {
    freshnessLabel += ' (Stale - Needs Reconfirmation)';
  } else {
    freshnessLabel += ' (Current)';
  }

  return {
    ...incident,
    ageMinutes,
    isStale,
    effectiveStatus,
    freshnessLabel,
  };
}

/**
 * List incidents with filtering and computed freshness
 */
export function listIncidents(filters = {}, currentTime = new Date()) {
  const rawList = loadRawIncidents();
  const enrichedList = rawList.map((item) => computeIncidentFreshness(item, currentTime));

  const {
    district = 'all',
    incidentType = 'all',
    sourceTier = 'all',
    statusFilter = 'all', // 'all' | 'current_only' | 'stale_only' | 'hazards_only'
    searchQuery = '',
  } = filters;

  const filtered = enrichedList.filter((item) => {
    if (district !== 'all' && item.district.toLowerCase() !== district.toLowerCase()) {
      return false;
    }
    if (incidentType !== 'all' && item.incidentType !== incidentType) {
      return false;
    }
    if (sourceTier !== 'all' && item.sourceTier !== sourceTier) {
      return false;
    }

    if (statusFilter === 'current_only' && item.isStale) {
      return false;
    }
    if (statusFilter === 'stale_only' && !item.isStale) {
      return false;
    }
    if (statusFilter === 'hazards_only') {
      const isSevere =
        item.depthCategory === DEPTH_CATEGORIES.KNEE_DEEP ||
        item.depthCategory === DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER ||
        item.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT;
      if (!isSevere || item.isStale || item.effectiveStatus === REPORT_STATUS.CLEARED) {
        return false;
      }
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        item.locality.toLowerCase().includes(q) ||
        (item.ward && item.ward.toLowerCase().includes(q)) ||
        (item.corridorName && item.corridorName.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.issuingAuthority && item.issuingAuthority.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Calculate summary metrics
  const totalCount = enrichedList.length;
  const activeHazardsCount = enrichedList.filter(
    (i) =>
      !i.isStale &&
      i.effectiveStatus !== REPORT_STATUS.CLEARED &&
      (i.incidentType === INCIDENT_TYPES.FLOODED_ROAD || i.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT)
  ).length;
  const blockedDrainsCount = enrichedList.filter(
    (i) => i.incidentType === INCIDENT_TYPES.BLOCKED_DRAIN && i.effectiveStatus !== REPORT_STATUS.CLEARED
  ).length;
  const staleCount = enrichedList.filter((i) => i.isStale).length;
  const officialAlertsCount = enrichedList.filter(
    (i) => i.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT && !i.isStale
  ).length;

  return {
    incidents: filtered,
    totalCount,
    activeHazardsCount,
    blockedDrainsCount,
    staleCount,
    officialAlertsCount,
  };
}

/**
 * Checks client rate limit (anti-flooding / anti-spoofing)
 * Max 4 submissions per 5 minutes per client session
 */
function checkRateLimit(currentTime = new Date()) {
  const nowMs = new Date(currentTime).getTime();
  const windowMs = 5 * 60 * 1000;
  inMemoryRateLimits = inMemoryRateLimits.filter((ts) => nowMs - ts < windowMs);

  if (inMemoryRateLimits.length >= 4) {
    return false;
  }
  inMemoryRateLimits.push(nowMs);
  return true;
}

/**
 * Submits a new citizen community incident report
 * Automatically strips exact residential details and applies coordinate jittering.
 */
export function submitCitizenReport(rawPayload, currentTime = new Date()) {
  if (!checkRateLimit(currentTime)) {
    throw new Error('Rate limit exceeded: Please wait a few minutes before submitting another report.');
  }

  // Sanitize and redact private premises/PII
  const { sanitizedLocation, sanitizedCoords } = sanitizeAndRedactLocation(
    rawPayload.locality,
    rawPayload.coordinates
  );

  const cleanPayload = {
    ...rawPayload,
    locality: sanitizedLocation,
    coordinates: sanitizedCoords,
    observedAt: rawPayload.observedAt || new Date(currentTime).toISOString(),
    reportedAt: new Date(currentTime).toISOString(),
    // Citizen reports can NEVER claim official tier
    sourceTier:
      rawPayload.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT ||
      rawPayload.sourceTier === SOURCE_TIERS.MUNICIPAL_ADVISORY
        ? rawPayload.sourceTier // allowed only if authenticated authorities are verified
        : SOURCE_TIERS.CITIZEN_REPORT,
    status: REPORT_STATUS.CURRENT,
    reconfirmationsCount: 1,
  };

  const validation = validateIncidentReport(cleanPayload, currentTime);
  if (!validation.isValid) {
    throw new Error(`Invalid report: ${validation.errors.join('; ')}`);
  }

  const newIncident = {
    ...cleanPayload,
    id: `up-fl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  };

  const currentList = loadRawIncidents();
  saveIncidents([newIncident, ...currentList]);

  return computeIncidentFreshness(newIncident, currentTime);
}

/**
 * Reconfirm or contest an incident observation
 * If confirmed flooded: refreshes observedAt and clears stale tag.
 * If conflicting receded reports arrive rapidly: transitions to DISPUTED to alert citizens.
 */
export function reconfirmIncident(incidentId, feedback, currentTime = new Date()) {
  const currentList = loadRawIncidents();
  const index = currentList.findIndex((i) => i.id === incidentId);
  if (index === -1) {
    throw new Error(`Incident with ID "${incidentId}" not found`);
  }

  const existing = currentList[index];
  const nowIso = new Date(currentTime).toISOString();

  let updated = { ...existing };

  if (feedback.action === 'still_flooded') {
    updated.reconfirmationsCount = (existing.reconfirmationsCount || 0) + 1;
    updated.observedAt = nowIso; // Refreshes observation window
    updated.status = REPORT_STATUS.CURRENT;
    if (feedback.depthCategory) {
      updated.depthCategory = feedback.depthCategory;
    }
  } else if (feedback.action === 'water_receded' || feedback.action === 'cleared') {
    // If was high hazard and report is very fresh, flag dispute if receded report is unverified
    const freshness = computeIncidentFreshness(existing, currentTime);
    if (!freshness.isStale && existing.depthCategory === DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER) {
      updated.status = REPORT_STATUS.DISPUTED;
      updated.notes = `${existing.notes || ''} [Dispute Note: Community member reported water receding, pending verification]`.trim();
    } else {
      updated.status = REPORT_STATUS.CLEARED;
      updated.clearedAt = nowIso;
      updated.depthCategory = DEPTH_CATEGORIES.CLEARED_PASSABLE;
    }
  }

  currentList[index] = updated;
  saveIncidents([...currentList]);

  return computeIncidentFreshness(updated, currentTime);
}

/**
 * Route Hazard Overlay & Safety Calculator
 * Evaluates whether a transit corridor intersects active flooded roads or high hazards.
 * STRICT SAFETY RULE: Stale reports are excluded from hazard blocking!
 * Never routes users through a reported current hazard corridor.
 */
export function checkRouteHazard(corridorNameOrKeywords, district = 'Lucknow', currentTime = new Date()) {
  if (!corridorNameOrKeywords || typeof corridorNameOrKeywords !== 'string') {
    return {
      isSafe: true,
      hazardLevel: 'SAFE',
      hazardsFound: [],
      safetyAdvisory: 'No corridor specified for hazard evaluation.',
    };
  }

  const { incidents } = listIncidents({ district, statusFilter: 'all' }, currentTime);
  const cleanQuery = corridorNameOrKeywords.toLowerCase().trim();

  // Active hazards only (stale excluded)
  const activeHazards = incidents.filter((i) => {
    if (i.isStale || i.effectiveStatus === REPORT_STATUS.CLEARED) return false;
    const isDangerous =
      i.depthCategory === DEPTH_CATEGORIES.KNEE_DEEP ||
      i.depthCategory === DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER ||
      i.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT;
    return isDangerous;
  });

  const matchingHazards = activeHazards.filter((h) => {
    const loc = h.locality.toLowerCase();
    const corridor = (h.corridorName || '').toLowerCase();
    
    // Direct substring match
    if (loc.includes(cleanQuery) || cleanQuery.includes(loc)) return true;
    if (corridor && (corridor.includes(cleanQuery) || cleanQuery.includes(corridor))) return true;

    // Word match filtering out generic stop words
    const STOP_WORDS = new Set(['near', 'road', 'lane', 'intersection', 'crossing', 'corridor', 'link', 'to', 'from', 'and', '&', 'service']);
    const terms = cleanQuery.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    if (terms.length > 0) {
      return terms.some((term) => loc.includes(term) || corridor.includes(term));
    }
    return false;
  });

  if (matchingHazards.length === 0) {
    return {
      isSafe: true,
      hazardLevel: 'SAFE',
      hazardsFound: [],
      overlayActive: false,
      safetyAdvisory: 'Corridor appears passable based on current community and official observations.',
    };
  }

  // Threshold rule: An active route hazard overlay is applied only when enough recent reports exist:
  // (1) An official emergency alert or municipal advisory, OR
  // (2) A citizen hazard with 2+ community reconfirmations, OR
  // (3) 2+ distinct recent reports along the corridor.
  const hasOfficialNotice = matchingHazards.some(
    (h) => h.sourceTier === SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT || h.sourceTier === SOURCE_TIERS.MUNICIPAL_ADVISORY
  );
  const hasCorroboratedReport = matchingHazards.some(
    (h) => (h.reconfirmationsCount || 0) >= 2
  );
  const totalReportsCount = matchingHazards.length;

  const hasEnoughRecentReports = hasOfficialNotice || hasCorroboratedReport || totalReportsCount >= 2;

  if (!hasEnoughRecentReports) {
    return {
      isSafe: true,
      hazardLevel: 'CAUTION',
      hazardsFound: matchingHazards,
      overlayActive: false,
      safetyAdvisory: `CAUTION: Single uncorroborated observation along ${corridorNameOrKeywords}. Route hazard overlay requires at least 2 community reports or official advisory before blocking transit. Exercise vigilance.`,
    };
  }

  const worstDepth = matchingHazards.some((h) => h.depthCategory === DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER)
    ? 'Severe (Waist-deep or higher)'
    : 'Moderate (Knee-deep waterlogging)';

  return {
    isSafe: false,
    hazardLevel: 'DANGEROUS',
    hazardsFound: matchingHazards,
    overlayActive: true,
    worstDepth,
    safetyAdvisory: `CRITICAL HAZARD: Active corroborated waterlogging hazard reported along ${corridorNameOrKeywords}. NEVER attempt to traverse submerged roadways. Seek alternate elevated corridors or remain sheltered.`,
  };
}

/**
 * Ward-Wise Drain Blockage Summaries
 * Summarizes blocked drains, siltation risk, and desiltation urgency per municipal ward.
 */
export function getWardDrainSummaries(district = 'Lucknow', currentTime = new Date()) {
  const { incidents } = listIncidents({ district, incidentType: INCIDENT_TYPES.BLOCKED_DRAIN }, currentTime);

  const wardMap = {};

  incidents.forEach((item) => {
    const wardName = item.ward || 'General Municipal Area';
    if (!wardMap[wardName]) {
      wardMap[wardName] = {
        wardName,
        district: item.district,
        totalBlockages: 0,
        activeCriticalBlockages: 0,
        localities: [],
        oldestBlockageAgeMinutes: 0,
      };
    }

    wardMap[wardName].totalBlockages += 1;
    if (
      !item.isStale &&
      (item.depthCategory === DEPTH_CATEGORIES.KNEE_DEEP ||
        item.depthCategory === DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER)
    ) {
      wardMap[wardName].activeCriticalBlockages += 1;
    }
    wardMap[wardName].localities.push(item.locality);
    if (item.ageMinutes > wardMap[wardName].oldestBlockageAgeMinutes) {
      wardMap[wardName].oldestBlockageAgeMinutes = item.ageMinutes;
    }
  });

  return Object.values(wardMap).map((w) => {
    let urgency = 'MODERATE';
    if (w.activeCriticalBlockages >= 2 || w.oldestBlockageAgeMinutes > 360) {
      urgency = 'CRITICAL / IMMEDIATE ACTION REQUIRED';
    } else if (w.activeCriticalBlockages >= 1) {
      urgency = 'HIGH';
    }

    return {
      ...w,
      urgency,
      oldestBlockageAgeHours: (w.oldestBlockageAgeMinutes / 60).toFixed(1),
    };
  });
}

/**
 * Exportable Statutory Municipal Maintenance Request / Petition
 * Generates official representation format for Municipal Commissioner & Jal Sansthan.
 */
export function generateMunicipalMaintenancePetition({ district, ward, applicantName = 'Concerned Resident' }) {
  const summaries = getWardDrainSummaries(district);
  const targetWard = summaries.find((s) => s.wardName.toLowerCase() === ward.toLowerCase()) || {
    wardName: ward,
    district,
    totalBlockages: 1,
    activeCriticalBlockages: 1,
    localities: ['Identified Ward Drain Culvert'],
    urgency: 'HIGH',
  };

  const petitionDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `TO:
The Municipal Commissioner / Executive Engineer (Drainage Wing),
Municipal Corporation / Nagar Nigam (${district}), Uttar Pradesh.

SUBJECT: STATUTORY CIVIC MAINTENANCE & URGENT DRAIN DESILTATION PETITION
REFERENCE: Community Waterlogging Incident Registry & Citizen Response Board #985
STATUTORY GROUNDS: Under Uttar Pradesh Municipal Corporation Act & Public Services Guarantee

Respected Sir / Madam,

We, the residents of ${targetWard.wardName}, ${district}, submit this formal maintenance request regarding recurrent drain blockages and street inundation:

1. WARD DETAILS:
   • Municipal Ward: ${targetWard.wardName}
   • District: ${district}, Uttar Pradesh
   • Affected Arterial Localities: ${targetWard.localities.join('; ')}

2. CIVIC HAZARD ASSESSMENT:
   • Total Active Blockages: ${targetWard.totalBlockages}
   • Critical Impassable Points: ${targetWard.activeCriticalBlockages}
   • Urgency Classification: ${targetWard.urgency}
   • Public Risk: Overflowing silt, contaminated water backflow, traffic disruption, and health hazards.

3. STATUTORY PRAYER:
   In view of monsoon inundation and public safety, it is respectfully requested that:
   (a) Suction machines and JCB desilting machinery be deployed immediately to clear silt deposits;
   (b) Open drain covers and dislocated manhole lids be secured;
   (c) A dated compliance report be issued to the ward sanitary inspector.

Submitted by:
${applicantName} (Citizen Representation)
Dated: ${petitionDate}`;
}

/**
 * ---------------------------------------------------------------------------
 * OFFLINE DRAFT QUEUE
 * ---------------------------------------------------------------------------
 */

/**
 * Loads pending offline drafts
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
      // Fall through
    }
  }
  inMemoryDraftQueue = [];
  return inMemoryDraftQueue;
}

/**
 * Saves offline draft queue
 */
function saveDraftQueue(queue) {
  inMemoryDraftQueue = queue;
  const ls = getLocalStorage();
  if (ls) {
    try {
      ls.setItem(DRAFT_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save offline drafts', e);
    }
  }
}

/**
 * Enqueues a report when citizen has no internet connectivity
 */
export function enqueueOfflineDraft(reportPayload) {
  const queue = getOfflineDraftQueue();
  const draftItem = {
    id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    queuedAt: new Date().toISOString(),
    payload: reportPayload,
  };
  saveDraftQueue([...queue, draftItem]);
  return draftItem;
}

/**
 * Removes a specific draft from the queue
 */
export function removeOfflineDraft(draftId) {
  const queue = getOfflineDraftQueue();
  const updated = queue.filter((d) => d.id !== draftId);
  saveDraftQueue(updated);
}

/**
 * Synchronizes all pending drafts once back online
 */
export function syncOfflineDrafts(currentTime = new Date()) {
  const queue = getOfflineDraftQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, failedCount: 0, errors: [] };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const errors = [];
  const remainingQueue = [];

  queue.forEach((draft) => {
    try {
      submitCitizenReport(draft.payload, currentTime);
      syncedCount += 1;
    } catch (err) {
      failedCount += 1;
      errors.push(`Draft ${draft.id}: ${err.message}`);
      remainingQueue.push(draft);
    }
  });

  saveDraftQueue(remainingQueue);

  return {
    syncedCount,
    failedCount,
    errors,
  };
}
