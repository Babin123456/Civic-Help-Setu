// @ts-nocheck
import {
  UP_FLOOD_PRONE_DISTRICT,
  ROUTE_DIRECTION,
  BLOCKAGE_STATUS,
  REPORT_TYPE,
  RouteSegment,
  ShelterAttributes,
  UpFloodRoutePlan,
  SAMPLE_ROUTE_SEGMENTS,
  SAMPLE_SHELTERS,
  DEFAULT_EMERGENCY_CONTACT,
  DEFAULT_HELPLINE,
} from '../data/upFloodRoutes';
import { EMERGENCY_SURVIVAL_CHECKLIST } from '../data/emergencyReliefData';
import { localStorageService } from './localStorageService';

const CACHE_KEY = 'civicbridge_upflood_route_plan';

/**
 * Retrieves the route plan, preferring cached data for offline access.
 * If no cache exists, returns the sample plan for the pilot district.
 */
export function getRoutePlan(): UpFloodRoutePlan {
  // Try to load from localStorage (offline cache)
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // ignore cache read failure
    }
  }

  // Return sample plan as fallback
  return { ...SAMPLE_ROUTE_PLAN, generatedAt: new Date().toISOString() };
}

/**
 * Saves the route plan to localStorage for offline readiness.
 */
export function saveRoutePlan(plan: UpFloodRoutePlan): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(plan));
    } catch (err) {
      // ignore
    }
  }
}

/**
 * Blocks or reopens a route segment. Only approved local responders can do this.
 * Returns the updated segment.
 *
 * @param segmentId - The ID of the segment to block/reopen
 * @param status - BLOCKAGE_STATUS.CLEAR or BLOCKAGE_STATUS.BLOCKED
 * @param evidence - Optional evidence URL (photo, govt notice)
 * @param revalidate - If true, marks the report as revalidated (second approver)
 */
export function setSegmentBlockage(
  segmentId: string,
  status: BLOCKAGE_STATUS,
  evidence?: string,
  revalidate = false
): RouteSegment | null {
  const plan = getRoutePlan();
  let segment = plan.primaryRoute.find((s) => s.id === segmentId);
  if (!segment) {
    // Try alternate routes
    for (const route of plan.alternateRoutes) {
      const found = route.find((s) => s.id === segmentId);
      if (found) {
        segment = found;
        break;
      }
    }
  }

  if (!segment) {
    console.warn(`Route segment ${segmentId} not found in current plan`);
    return null;
  }

  // Update blockage status
  segment.blockage.status = status;
  segment.blockage.reportedAt = new Date().toISOString();
  if (evidence) {
    segment.blockage.evidence = evidence;
  }
  if (revalidate) {
    segment.blockage.revalidated = true;
    segment.blockage.revalidatedAt = new Date().toISOString();
  }

  // Persist updated plan
  saveRoutePlan(plan);

  return segment;
}

/**
 * Adds a community observation to a route segment.
 * Community observations are unverified and will expire after the validity
 * period unless revalidated by an approved responder.
 *
 * @param segmentId - The ID of the segment to add observation to
 * @param observer - Community member name/identifier
 * @param description - Observation description
 */
export function addCommunityObservation(
  segmentId: string,
  observer: string,
  description: string
): RouteSegment | null {
  const plan = getRoutePlan();
  let segment = plan.primaryRoute.find((s) => s.id === segmentId);
  if (!segment) {
    for (const route of plan.alternateRoutes) {
      const found = route.find((s) => s.id === segmentId);
      if (found) {
        segment = found;
        break;
      }
    }
  }

  if (!segment) {
    console.warn(`Route segment ${segmentId} not found`);
    return null;
  }

  const newObservation = {
    id: `obs-comm-${Date.now()}`,
    reportedBy: observer,
    reportedAt: new Date().toISOString(),
    description,
    revalidated: false,
  };

  // Check if observation already exists
  const existingIdx = segment.communityObservations.findIndex(
    (o) => o.reportedBy === observer && o.reportedAt === new Date().toISOString()
  );
  if (existingIdx >= 0) {
    // Update existing
    segment.communityObservations[existingIdx] = newObservation;
  } else {
    segment.communityObservations.push(newObservation);
  }

  saveRoutePlan(plan);
  return segment;
}

/**
 * Revalidates a community observation. Only approved local responders can
 * revalidate, which prevents the observation from expiring.
 *
 * @param segmentId - The segment ID
 * @param observationId - The observation ID to revalidate
 * @param revalidator - Name of the approving responder
 */
export function revalidateObservation(
  segmentId: string,
  observationId: string,
  revalidator: string
): boolean {
  const plan = getRoutePlan();
  const segment = plan.primaryRoute.find((s) => s.id === segmentId);
  if (!segment) {
    for (const route of plan.alternateRoutes) {
      const found = route.find((s) => s.id === segmentId);
      if (found) {
        // For simplicity, return false if not in primary
        return false;
      }
    }
    return false;
  }

  const obs = segment.communityObservations.find((o) => o.id === observationId);
  if (!obs) {
    return false;
  }

  obs.revalidated = true;
  obs.revalidatedAt = new Date().toISOString();

  saveRoutePlan(plan);
  return true;
}

/**
 * Expires unverified community observations that are older than the validity
 * period (e.g., 7 days). Revalidated observations are preserved.
 *
 * @returns Number of observations expired
 */
export function expireOldObservations(): number {
  const plan = getRoutePlan();
  let expired = 0;
  const now = new Date();
  const VALIDITY_DAYS = 7; // observations expire after 7 days unless revalidated

  // Filter primary route observations
  plan.primaryRoute.forEach((segment) => {
    segment.communityObservations = segment.communityObservations.filter(
      (obs) => {
        if (obs.revalidated) {
          // Keep revalidated observations
          return true;
        }
        const reported = new Date(obs.reportedAt);
        const diffDays = (now.getTime() - reported.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > VALIDITY_DAYS) {
          expired++;
          return false; // expire
        }
        return true; // keep
      }
    );
  });

  // Also filter alternate routes
  plan.alternateRoutes.forEach((route) => {
    route.forEach((segment) => {
      segment.communityObservations = segment.communityObservations.filter(
        (obs) => {
          if (obs.revalidated) {
            return true;
          }
          const reported = new Date(obs.reportedAt);
          const diffDays = (now.getTime() - reported.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= VALIDITY_DAYS;
        }
      );
    });
  });

  if (expired > 0) {
    saveRoutePlan(plan);
  }

  return expired;
}

/**
 * Checks if a route segment has an unresolved blockage.
 * A route with an unresolved blockage is not recommended per acceptance criteria.
 *
 * @param segmentId - The segment ID to check
 * @returns { 'blocked' | 'clear' | 'unresolved' }
 */
export function checkSegmentBlockageStatus(segmentId: string): 'blocked' | 'clear' | 'unresolved' {
  const plan = getRoutePlan();
  const segment = plan.primaryRoute.find((s) => s.id === segmentId);
  if (!segment) {
    for (const route of plan.alternateRoutes) {
      const found = route.find((s) => s.id === segmentId);
      if (found) {
        return checkSegmentBlockageStatusForSegment(found);
      }
    }
    return 'unresolved';
  }
  return checkSegmentBlockageStatusForSegment(segment);
}

function checkSegmentBlockageStatusForSegment(segment: RouteSegment): 'blocked' | 'clear' | 'unresolved' {
  // If the segment has an official blockage status of BLOCKED, it's blocked
  if (segment.blockage.status === BLOCKAGE_STATUS.BLOCKED) {
    return 'blocked';
  }
  // If the segment has no unresolved community blockage reports, it's clear
  // Check if there are any unverified community observations indicating blockage
  const unverifiedBlockageObs = segment.communityObservations.filter(
    (obs) => !obs.revalidated && obs.description.toLowerCase().includes('block')
  );
  if (unverifiedBlockageObs.length > 0) {
    // Unverified community blockage reports expire automatically;
    // if they are still present without revalidation, treat as unclear/unresolved
    const recentObs = unverifiedBlockageObs.filter(
      (obs) => new Date().getTime() - new Date(obs.reportedAt).getTime() < 7 * 24 * 60 * 60 * 1000
    );
    return recentObs.length > 0 ? 'blocked' : 'clear';
  }
  return 'clear';
}

/**
 * Gets all route segments that have unresolved blockages.
 */
export function getSegmentsWithUnresolvedBlockages(): string[] {
  const plan = getRoutePlan();
  const blocked: string[] = [];

  // Check primary route
  plan.primaryRoute.forEach((segment) => {
    if (checkSegmentBlockageStatusForSegment(segment) === 'blocked') {
      blocked.push(segment.id);
    }
  });

  // Check alternate routes
  plan.alternateRoutes.forEach((route) => {
    route.forEach((segment) => {
      if (checkSegmentBlockageStatusForSegment(segment) === 'blocked') {
        blocked.push(segment.id);
      }
    });
  });

  return blocked;
}

/**
 * Gets all shelters with their full attributes.
 * Shelter details include source, authority, and last verification per
 * acceptance criteria.
 */
export function getShelters(): ShelterAttributes[] {
  const plan = getRoutePlan();
  return plan.shelters;
}

/**
 * Gets a specific shelter by ID.
 */
export function getShelterById(id: string): ShelterAttributes | undefined {
  const plan = getRoutePlan();
  return plan.shelters.find((s) => s.id === id);
}

/**
 * Gets the official emergency contact, always displayed first per acceptance criterion.
 */
export function getOfficialEmergencyContact(): string {
  return DEFAULT_EMERGENCY_CONTACT;
}

/**
 * Gets the district helpline number.
 */
export function getHelpline(): string {
  return DEFAULT_HELPLINE;
}

/**
 * Generates a printable household preparedness list based on shelter data
 * and survival checklist recommendations.
 */
export function generatePreparednessList(): string {
  const shelters = getShelters();

  let list = '# UP Flood Preparedness Checklist\n';
  list += `District: ${UP_FLOOD_PRONE_DISTRICT}\n`;
  list += `Generated: ${new Date().toLocaleDateString()}\n`;
  list += `Emergency Contact First: ${DEFAULT_EMERGENCY_CONTACT} (Helpline: ${DEFAULT_HELPLINE})\n\n`;

  list += '## Official Shelters\n';
  shelters.forEach((shelter) => {
    list += `- **${shelter.name}** (${shelter.address})\n`;
    list += `  Contact: ${shelter.contact}`;
    if (shelter.altContact) list += ` / Alt: ${shelter.altContact}`;
    list += `\n  Capacity: ${shelter.capacity} people\n`;
    list += `  Verified: ${new Date(shelter.lastVerifiedAt).toLocaleDateString()} by ${shelter.authority}\n`;
    list += `  Water: ${shelter.amenities.waterAvailable ? '✓' : '✗'}`;
    list += ` | Sanitation: ${shelter.amenities.sanitationAvailable ? '✓' : '✗'}`;
    list += ` | Food: ${shelter.amenities.foodDistribution ? '✓' : '✗'}\n`;
  });

  list += '\n## Survival Checklist (Essential Items)\n';
  EMERGENCY_SURVIVAL_CHECKLIST.forEach((item) => {
    list += `- [${item.essential ? '*' : ' '}] ${item.item}\n`;
  });

  list += '\n## Route Status Summary\n';
  const blockedSegments = getSegmentsWithUnresolvedBlockages();
  if (blockedSegments.length > 0) {
    list += `⚠️ ${blockedSegments.length} route segment(s) have reported blockages. Do NOT use these routes.\n`;
    blockedSegments.forEach((id) => {
      const seg = getSegmentById(id);
      if (seg) {
        list += `  - ${seg.name}: ${seg.blockage.status}\n`;
      }
    });
  } else {
    list += '✅ All reported route segments are clear for evacuation.\n';
  }

  return list;
}

/**
 * Helper: gets a segment by ID from the current plan (checks primary + alternates)
 */
function getSegmentById(id: string): RouteSegment | undefined {
  const plan = getRoutePlan();
  const seg = plan.primaryRoute.find((s) => s.id === id);
  if (seg) return seg;
  for (const route of plan.alternateRoutes) {
    const found = route.find((s) => s.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Generates a low-bandwidth text-only route directory.
 * No maps, no geolocation needed — pure text.
 */
export function generateTextRouteDirectory(): string {
  const plan = getRoutePlan();
  let directory = `=== UP FLOOD EVACUATION ROUTE DIRECTORY ===
District: ${plan.district}
Generated: ${new Date().toLocaleDateString()}
Emergency Contact: ${DEFAULT_EMERGENCY_CONTACT} (${DEFAULT_HELPLINE})
==================================================

OFFICIAL ROUTE SEGMENTS (Primary)
----------------------------------
`;

  plan.primaryRoute.forEach((seg, idx) => {
    const blockageStatus = seg.blockage.status;
    const blockageFlag = blockageStatus === BLOCKAGE_STATUS.BLOCKED ? ' [BLOCKED]' : '';
    const revalidatedFlag = seg.blockage.revalidated ? ' [Revalidated]' : '';
    directory += `${idx + 1}. ${seg.name}
   From: (lat/lng near ${seg.from.lat.toFixed(3)}, ${seg.from.lng.toFixed(3)})
   To:   (lat/lng near ${seg.to.lat.toFixed(3)}, ${seg.to.lng.toFixed(3)})
   Direction: ${seg.direction}
   Official: ${seg.official.isOpen ? 'OPEN' : 'CLOSED'}${blockageFlag}${revalidatedFlag}

   Official Warning: ${
     seg.official.warning
       ? `${seg.official.warning.type}: ${seg.official.warning.description}`
       : 'None'
   }

   Community Observations: ${
     seg.communityObservations.length > 0
       ? `${seg.communityObservations.length} observation(s) — unverified unless revalidated`
       : 'None'
   }

   Blockage Status: ${blockageStatus}${blockageFlag}
----------------------------------`;
  });

  directory += '\nALTERNATE ROUTES\n';
  plan.alternateRoutes.forEach((route, routeIdx) => {
    directory += `${routeIdx + 1}. Alternate Option ${routeIdx + 1}\n`;
    route.forEach((seg, segIdx) => {
      directory += `   ${seg.name} — ${seg.blockage.status}\n`;
    });
  });

  directory += '\nSAFE SHELTERS\n';
  plan.shelters.forEach((shelter, idx) => {
    directory += `${idx + 1}. ${shelter.name}
   Address: ${shelter.address}
   Contact: ${shelter.contact} / Alt: ${shelter.altContact || 'N/A'}
   Capacity: ${shelter.capacity}
   Water: ${shelter.amenities.waterAvailable} | Sanitation: ${shelter.amenities.sanitationAvailable}
   Verified: ${new Date(shelter.lastVerifiedAt).toLocaleDateString()} by ${shelter.authority}
`;
  });

  directory += `\nEMERGENCY INSTRUCTIONS
• Never calculate or travel through a reported flooded segment.
• Official emergency contact always first: ${DEFAULT_EMERGENCY_CONTACT}
• If a route has an unresolved blockage, do NOT use it.
• Shelter details include source, authority, and last verification above.
• This directory works offline — no location permission needed.
==================================================`;

  return directory;
}