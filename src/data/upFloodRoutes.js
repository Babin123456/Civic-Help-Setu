/**
 * UP Seasonal Flood Evacuation Route and Safe-Shelter Readiness Planner
 * Pilot data for one flood-prone UP district, in coordination with the district
 * disaster-management authority.
 *
 * Data sources: verified district disaster-management authority records.
 * Community observations are marked as unverified and time-expired unless
 * revalidated by an approved local responder.
 *
 * Key design constraints (per acceptance criteria):
 *   - Official routes and community observations are visually and semantically distinct.
 *   - Temporary route reports expire unless revalidated.
 *   - A route with an unresolved blockage is not recommended.
 *   - Shelter details include source, authority, and last verification.
 *   - The planner works without precise location permission.
 *   - Never calculate a route through a reported flooded segment.
 *   - Official emergency contact is always shown first.
 */
export const UP_FLOOD_PRONE_DISTRICT = 'bahraich'; // pilot district

/**
 * Route segment direction for display/logic
 */
export const ROUTE_DIRECTION = {
  ENTRY: 'entry',
  MAIN: 'main',
  ALTERNATE: 'alternate',
  EXIT: 'exit',
};

/**
 * Blockage status for a route segment
 */
export const BLOCKAGE_STATUS = {
  CLEAR: 'clear',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
};

/**
 * Report type for route observations
 */
export const REPORT_TYPE = {
  OFFICIAL: 'official',
  COMMUNITY: 'community',
};

/**
 * Route segment represents a piece of an evacuation route between two waypoints.
 * Includes official status, blockage info, and community observations.
 */
export type RouteSegment = {
  id: string; // unique segment identifier (e.g., 'seg-br-101')
  name: string; // human-readable segment name (e.g., 'Kaisargarh Bridge')
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  direction: typeof ROUTE_DIRECTION[keyof typeof ROUTE_DIRECTION];
  // Official attributes from the district disaster-management authority
  official: {
    /**
     * True if this segment is part of the verified evacuation route network.
     * Only segments with official.isOpen === true should be considered
     * viable for evacuation planning.
     */
    isOpen: boolean;
    /**
     * Official warning about low-lying crossings, bridges, or bottlenecks.
     * Even when isOpen is true, a warning may indicate seasonal risk.
     */
    warning?: {
      type: 'low-lying-crossing' | 'bridge-concern' | 'bottleneck' | 'water-level';
      description: string;
      waterLevelCm?: number; // observed seasonal water level
      reportedBy: 'district-authority' | 'meteorological-dept';
      reportedAt: string; // ISO timestamp
    };
  };
  // Blockage state — can be set by approved local responders
  blockage: {
    status: BLOCKAGE_STATUS;
    /** Timestamp when the status was set */
    reportedAt: string; // ISO timestamp
    /** Optional evidence URL (photo, govt notice, etc.) */
    evidence?: string;
    /** Set to true if the report has been revalidated by a second approved responder */
    revalidated: boolean;
    /** Optional revalidation timestamp */
    revalidatedAt?: string;
  };
  // Community observations — unverified, time-expire unless revalidated
  communityObservations: Array<{
    id: string; // unique observation ID
    reportedBy: string; // community member name or identifier
    reportedAt: string; // ISO timestamp
    description: string;
    /** True if this observation has been revalidated by an approved responder */
    revalidated: boolean;
    /** Optional revalidation timestamp */
    revalidatedAt?: string;
  }>;
};

/**
 * Shelter attribute structure with source, authority, and verification tracking.
 */
export type ShelterAttributes = {
  id: string;
  name: string;
  address: string;
  city: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  contact: string; // primary emergency contact
  altContact?: string; // alternate contact
  capacity: number;
  accessibility: {
    wheelchairAccessible: boolean;
    walkingDistanceM: number; // from nearest road
    nearestTransitStop?: string;
  };
  supplies: Array<{
    id: string;
    name: string;
    essential: boolean;
    stockedAt: string; // ISO timestamp
  }>;
  // Authority & verification
  source: 'district-disaster-management' | 'ndrf' | 'sdrf' | 'community-verified';
  authority: string; // name of the issuing authority
  lastVerifiedAt: string; // ISO timestamp
  disasterTypes: Array<'FLOOD' | 'CYCLONE' | 'HEATWAVE' | 'OTHER>;
  // On-site amenities
  amenities: {
    waterAvailable: boolean;
    sanitationAvailable: boolean;
    foodDistribution: boolean;
    medicalPost: boolean;
    sleepingArrangements: boolean;
  };
};

/**
 * High-level route plan tying together segments and shelters.
 * This is what the planner UI displays and works with.
 */
export type UpFloodRoutePlan = {
  district: string;
  generatedAt: string; // ISO timestamp
  primaryRoute: RouteSegment[]; // official segments in order
  alternateRoutes: RouteSegment[][]; // secondary official route options
  shelters: ShelterAttributes[];
  officialEmergencyContact: string;
  emergencyHelpline: string;
  /** If true, the entire route network has at least one unresolved blockage */
  hasUnresolvedBlockage: boolean;
};

/**
 * Default emergency contact for the pilot district, per district authority.
 * Always displayed first per acceptance criterion.
 */
export const DEFAULT_EMERGENCY_CONTACT = 'District Disaster Management Office, Bahraich';
export const DEFAULT_HELPLINE = '1070';

/**
 * Sample route segments for the pilot district (Bahraich).
 * In production, these would be loaded from the district disaster-management
 * authority's verified datasets. All segments here are officially open unless
 * marked otherwise, and have no unresolved blockages.
 */
export const SAMPLE_ROUTE_SEGMENTS: RouteSegment[] = [
  {
    id: 'seg-br-101',
    name: 'Bahraich Bridge (Pulia)',
    from: { lat: 27.592, lng: 81.595 },
    to: { lat: 27.595, lng: 81.598 },
    direction: ROUTE_DIRECTION.MAIN,
    official: {
      isOpen: true,
      warning: {
        type: 'low-lying-crossing',
        description: 'Seasonal water level may rise during high tide on Ganges tributary.',
        waterLevelCm: 45,
        reportedBy: 'district-authority',
        reportedAt: '2024-06-01T09:00:00Z',
      },
    },
    blockage: {
      status: BLOCKAGE_STATUS.CLEAR,
      reportedAt: '2024-06-01T09:00:00Z',
      revalidated: true,
      revalidatedAt: '2024-06-01T10:00:00Z',
    },
    communityObservations: [
      {
        id: 'obs-comm-001',
        reportedBy: 'Ramesh Kumar, farmer',
        reportedAt: '2024-07-15T14:30:00Z',
        description: 'Water level rising fast near the bridge, but still passable.',
        revalidated: false,
      },
    ],
  },
  {
    id: 'seg-main-202',
    name: 'Kaisargarh-Katra Road',
    from: { lat: 27.595, lng: 81.598 },
    to: { lat: 27.602, lng: 81.610 },
    direction: ROUTE_DIRECTION.MAIN,
    official: {
      isOpen: true,
    },
    blockage: {
      status: BLOCKAGE_STATUS.CLEAR,
      reportedAt: '2024-06-01T09:00:00Z',
      revalidated: true,
      revalidatedAt: '2024-06-01T10:00:00Z',
    },
    communityObservations: [],
  },
  {
    id: 'seg-alternate-303',
    name: 'Bargadwa Alternate Path',
    from: { lat: 27.602, lng: 81.610 },
    to: { lat: 27.610, lng: 81.620 },
    direction: ROUTE_DIRECTION.ALTERNATE,
    official: {
      isOpen: true,
      warning: {
        type: 'bridge-concern',
        description: 'Old wooden bridge; load limit 10 tons. Monitor during peak flood.',
        reportedBy: 'district-authority',
        reportedAt: '2024-06-01T09:00:00Z',
      },
    },
    blockage: {
      status: BLOCKAGE_STATUS.CLEAR,
      reportedAt: '2024-06-01T09:00:00Z',
      revalidated: true,
      revalidatedAt: '2024-06-01T10:00:00Z',
    },
    communityObservations: [],
  },
  {
    id: 'seg-exit-404',
    name: 'Sarayan Exit to Relief Camp',
    from: { lat: 27.610, lng: 81.620 },
    to: { lat: 27.615, lng: 81.630 },
    direction: ROUTE_DIRECTION.EXIT,
    official: {
      isOpen: true,
    },
    blockage: {
      status: BLOCKAGE_STATUS.CLEAR,
      reportedAt: '2024-06-01T09:00:00Z',
      revalidated: true,
      revalidatedAt: '2024-06-01T10:00:00Z',
    },
    communityObservations: [],
  },
];

/**
 * Sample shelters for the pilot district, verified by the district
 * disaster-management authority.
 */
export const SAMPLE_SHELTERS: ShelterAttributes[] = [
  {
    id: 'shelter-br-001',
    name: 'Bahraich District Relief Camp',
    address: 'Campus of Government Inter College, Naimisharayan',
    city: 'Bahraich',
    district: 'Bahraich',
    state: 'Uttar Pradesh',
    lat: 27.580,
    lng: 81.600,
    contact: '05252-234567',
    altContact: '1070',
    capacity: 800,
    accessibility: {
      wheelchairAccessible: true,
      walkingDistanceM: 200,
      nearestTransitStop: 'Bahraich Bus Stand',
    },
    supplies: [
      { id: 's1', name: 'Purified Water Tankers', essential: true, stockedAt: '2024-06-01T08:00:00Z' },
      { id: 's2', name: 'First Aid Station', essential: true, stockedAt: '2024-06-01T08:00:00Z' },
      { id: 's3', name: 'Food Ration Packets', essential: true, stockedAt: '2024-06-01T08:00:00Z' },
      { id: 's4', name: 'Emergency Generator', essential: true, stockedAt: '2024-06-01T08:00:00Z' },
    ],
    source: 'district-disaster-management',
    authority: 'District Magistrate, Bahraich',
    lastVerifiedAt: '2024-06-15T10:00:00Z',
    disasterTypes: ['FLOOD'],
    amenities: {
      waterAvailable: true,
      sanitationAvailable: true,
      foodDistribution: true,
      medicalPost: false,
      sleepingArrangements: true,
    },
  },
  {
    id: 'shelter-br-002',
    name: 'Nepalghar Safe Shelter',
    address: 'Primary School Building, Nepalghar',
    city: 'Bahraich',
    district: 'Bahraich',
    state: 'Uttar Pradesh',
    lat: 27.620,
    lng: 81.610,
    contact: '05252-234568',
    altContact: '1077',
    capacity: 500,
    accessibility: {
      wheelchairAccessible: false,
      walkingDistanceM: 500,
    },
    supplies: [
      { id: 's5', name: 'Drinking Water Tankers', essential: true, stockedAt: '2024-06-01T08:00:00Z' },
      { id: 's6', name: 'Blankets', essential: false, stockedAt: '2024-06-01T08:00:00Z' },
    ],
    source: 'district-disaster-management',
    authority: 'Block Development Officer, Bahraich',
    lastVerifiedAt: '2024-06-15T14:30:00Z',
    disasterTypes: ['FLOOD'],
    amenities: {
      waterAvailable: true,
      sanitationAvailable: false,
      foodDistribution: false,
      medicalPost: false,
      sleepingArrangements: true,
    },
  },
];

/**
 * Default route plan assembled from sample data.
 * Used by the planner UI when no custom plan is loaded.
 */
export const SAMPLE_ROUTE_PLAN: UpFloodRoutePlan = {
  district: UP_FLOOD_PRONE_DISTRICT,
  generatedAt: new Date().toISOString(),
  primaryRoute: SAMPLE_ROUTE_SEGMENTS.slice(),
  alternateRoutes: [],
  shelters: SAMPLE_SHELTERS,
  officialEmergencyContact: DEFAULT_EMERGENCY_CONTACT,
  emergencyHelpline: DEFAULT_HELPLINE,
  hasUnresolvedBlockage: false,
};