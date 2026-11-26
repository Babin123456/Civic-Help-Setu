/**
 * UP Seasonal Flood Evacuation Route Service
 * 
 * Handles:
 * - Route segment management (blocking/unblocking with timestamps)
 * - Temporary community report expiration/revalidation
 * - Official vs community data distinction
 * - Route recommendation logic (never through blocked segments)
 * - Shelter verification and status
 */

// ============================================================
// Evacuation Route Segments
// ============================================================

/**
 * Route segment status enum
 */
export const RouteSegmentStatus = {
  OPEN: 'open',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
};

/**
 * Route segment types
 */
export const RouteSegmentType = {
  MAIN_ROAD: 'main_road',
  SUB_ROAD: 'sub_road',
  BRIDGE: 'bridge',
  LOW_LYING_CROSSING: 'low_lying_crossing',
  ALTERNATE_PATH: 'alternate_path',
};

// ============================================================
// UP Flood-Prone District - Gorakhpur Evacuation Routes
// ============================================================

/**
 * Route segment represents a piece of an evacuation route.
 * Includes status, warnings, and metadata for official vs community data.
 */
export const EVACUATION_ROUTE_SEGMENTS = [
  // Route: Gorakhpur District Hospital to Relief Camp A
  {
    id: 'route-gorakhpur-hospital-segment-1',
    name: 'NH-29 Main Road Segment 1',
    type: RouteSegmentType.MAIN_ROAD,
    from: 'Gorakhpur District Hospital',
    to: 'Kumar Ghat',
    status: RouteSegmentStatus.OPEN,
    official: true,
    warnings: [],
    lastVerified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    validityPeriodDays: 30,
    bridgeInfo: {
      name: 'Kumar Ghat Bridge',
      lowClearance: false,
      floodWarning: false,
      lastInspected: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    accessibility: {
      wheelchairAccessible: true,
      emergencyVehicleAccess: true,
    },
    notes: 'Primary route for hospital evacuations',
  },
  {
    id: 'route-gorakhpur-hospital-segment-2',
    name: 'Kumar Ghat to Relief Camp A',
    type: RouteSegmentType.MAIN_ROAD,
    from: 'Kumar Ghat',
    to: 'Relief Camp A (Gorakhpur)',
    status: RouteSegmentStatus.OPEN,
    official: true,
    warnings: [],
    lastVerified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    validityPeriodDays: 30,
    bridgeInfo: {
      name: 'Kumar Ghat Bridge',
      lowClearance: false,
      floodWarning: false,
      lastInspected: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    accessibility: {
      wheelchairAccessible: true,
      emergencyVehicleAccess: true,
    },
    notes: 'Main evacuation route to Relief Camp A',
  },

  // Route: Gorakhpur Circuit House to Relief Camp B
  {
    id: 'route-gorakhpur-circuit-house-segment-1',
    name: 'Circuit House Road Segment 1',
    type: RouteSegmentType.MAIN_ROAD,
    from: 'Gorakhpur Circuit House',
    to: 'Baba Gorakhnath Temple Crossing',
    status: RouteSegmentStatus.OPEN,
    official: true,
    warnings: [],
    lastVerified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    validityPeriodDays: 30,
    bridgeInfo: {
      name: 'Temple Crossing Bridge',
      lowClearance: false,
      floodWarning: false,
      lastInspected: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    accessibility: {
      wheelchairAccessible: true,
      emergencyVehicleAccess: true,
    },
    notes: 'Route for northern sector evacuations',
  },
  {
    id: 'route-gorakhpur-circuit-house-segment-2',
    name: 'Baba Gorakhnath to Relief Camp B',
    type: RouteSegmentType.MAIN_ROAD,
    from: 'Baba Gorakhnath Temple Crossing',
    to: 'Relief Camp B (Gorakhpur)',
    status: RouteSegmentStatus.OPEN,
    official: true,
    warnings: [],
    lastVerified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    validityPeriodDays: 30,
    bridgeInfo: {
      name: 'Temple Crossing Bridge',
      lowClearance: false,
      floodWarning: false,
      lastInspected: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    accessibility: {
      wheelchairAccessible: true,
      emergencyVehicleAccess: true,
    },
    notes: 'Route for northern sector evacuations - Camp B',
  },

  // Route: Pipraich Road - Low lying crossing warnings
  {
    id: 'route-gorakhpur-pipraich-segment-1',
    name: 'Pipraich Road Low-Lying Crossing',
    type: RouteSegmentType.LOW_LYING_CROSSING,
    from: 'Pipraich Chowk',
    to: 'Rapti River Bridge',
    status: RouteSegmentStatus.OPEN,
    official: true,
    warnings: [
      {
        id: 'warning-1',
        type: 'low_lying_crossing',
        message: 'Road floods during high tide + rainfall > 50mm',
        severity: 'high',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        reportedBy: 'District Disaster Management Authority',
        evidence: 'GPS coordinate verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    lastVerified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    validityPeriodDays: 30,
    bridgeInfo: {
      name: 'Rapti River Bridge',
      lowClearance: true,
      floodWarning: true,
      lastInspected: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    accessibility: {
      wheelchairAccessible: false,
      emergencyVehicleAccess: true,
    },
    notes: 'This segment frequently floods; alternate route recommended when warnings active',
  },

  // Community observation (temporary - will expire unless revalidated)
  {
    id: 'route-gorakhpur-community-block-1',
    name: 'Sector 7 Road Blockage (Community Report)',
    type: RouteSegmentType.SUB_ROAD,
    from: 'Sector 7',
    to: 'Sector 8',
    status: RouteSegmentStatus.OPEN,
    official: false,
    warnings: [
      {
        id: 'warning-comm-1',
        type: 'blockage',
        message: 'Water level above road surface - reported by local resident',
        severity: 'high',
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
        reportedBy: 'Community Member (anonymous)',
        evidence: 'Photo submitted via mobile',
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        // This report will auto-expire unless revalidated by approved responder
      },
    ],
    lastVerified: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    validityPeriodDays: 1,
    notes: 'Temporary community report - expires unless revalidated by approved responder',
  },
];

// ============================================================
// Shelter Locations (Verified Authority Sources)
// ============================================================

export const ShelterAttribute = {
  ACCESSIBILITY_WHEELCHAIR: 'wheelchair',
  ACCESSIBILITY_EMERGENCY_VEHICLE: 'emergency_vehicle',
  FACILITY_WATER: 'water',
  FACILITY_SANITATION: 'sanitation',
  FACILITY_POWER: 'power',
  FACILITY_STORAGE: 'storage',
};

// ============================================================
// Verified Shelters - Gorakhpur District
// ============================================================

export const GORAKHPUR_SHELTERS = [
  {
    id: 'shelter-gorakhpur-camp-a',
    name: 'Relief Camp A - Gorakhpur',
    type: 'evacuation_camp',
    authority: 'Gorakhpur District Disaster Management Authority',
    source: 'official_district_authority',
    address: 'Gorakhpur Sadar, Gorakhpur, Uttar Pradesh',
    contact: '0551-2200100',
    altContact: '1070',
    capacity: 800,
    currentOccupancy: 0,
    coordinates: { lat: 26.7606, lng: 83.3758 },
    disasterTypes: ['FLOOD'],
    attributes: {
      [ShelterAttribute.ACCESSIBILITY_WHEELCHAIR]: true,
      [ShelterAttribute.ACCESSIBILITY_EMERGENCY_VEHICLE]: true,
      [ShelterAttribute.FACILITY_WATER]: true,
      [ShelterAttribute.FACILITY_SANITATION]: true,
      [ShelterAttribute.FACILITY_POWER]: true,
      [ShelterAttribute.FACILITY_STORAGE]: true,
    },
    lastVerified: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    verificationFrequencyDays: 7,
    validityPeriodDays: 30,
    suppliesAvailable: [
      'Dry Ration Packets',
      'Purified Water Tankers',
      'First Aid Station',
      'Emergency Generator',
      'Blankets',
    ],
    accessibilityNotes: 'Wheelchair accessible pathways; ramp access at main entrance',
    sanitationNotes: 'Chemical toilets with regular servicing; 200+ users per day',
    waterNotes: 'Water tanker supply every 4 hours; purified water available',
  },
  {
    id: 'shelter-gorakhpur-camp-b',
    name: 'Relief Camp B - Gorakhpur',
    type: 'evacuation_camp',
    authority: 'Gorakhpur District Disaster Management Authority',
    source: 'official_district_authority',
    address: 'Baba Gorakhnath Complex, Gorakhpur, Uttar Pradesh',
    contact: '0551-2200200',
    altContact: '1070',
    capacity: 650,
    currentOccupancy: 0,
    coordinates: { lat: 26.7700, lng: 83.3820 },
    disasterTypes: ['FLOOD'],
    attributes: {
      [ShelterAttribute.ACCESSIBILITY_WHEELCHAIR]: true,
      [ShelterAttribute.ACCESSIBILITY_EMERGENCY_VEHICLE]: true,
      [ShelterAttribute.FACILITY_WATER]: true,
      [ShelterAttribute.FACILITY_SANITATION]: false,
      [ShelterAttribute.FACILITY_POWER]: true,
      [ShelterAttribute.FACILITY_STORAGE]: true,
    },
    lastVerified: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    verificationFrequencyDays: 7,
    validityPeriodDays: 30,
    suppliesAvailable: [
      'Dry Ration Packets',
      'Water Purification Tablets',
      'First Aid Station',
      'Mobile Medical Van (Tue/Thu/Sat)',
    ],
    accessibilityNotes: 'Partial wheelchair access; main courtyard accessible',
    sanitationNotes: 'Portable chemical toilets; serviced daily by authority',
    waterNotes: 'Borewell water - purification tablets recommended',
  },
  {
    id: 'shelter-gorakhpur-camp-c',
    name: 'Relief Camp C - Belghat',
    type: 'temporary_shelter',
    authority: 'Gorakhpur District Administration',
    source: 'official_district_authority',
    address: 'Belghat area, Gorakhpur, Uttar Pradesh',
    contact: '0551-2200300',
    altContact: '1070',
    capacity: 400,
    currentOccupancy: 0,
    coordinates: { lat: 26.8200, lng: 83.4500 },
    disasterTypes: ['FLOOD'],
    attributes: {
      [ShelterAttribute.ACCESSIBILITY_WHEELCHAIR]: false,
      [ShelterAttribute.ACCESSIBILITY_EMERGENCY_VEHICLE]: true,
      [ShelterAttribute.FACILITY_WATER]: true,
      [ShelterAttribute.FACILITY_SANITATION]: true,
      [ShelterAttribute.FACILITY_POWER]: false,
      [ShelterAttribute.FACILITY_STORAGE]: true,
    },
    lastVerified: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    verificationFrequencyDays: 14,
    validityPeriodDays: 14,
    suppliesAvailable: [
      'Emergency Ration',
      'Water Storage Tanks',
      'Basic First Aid',
    ],
    accessibilityNotes: 'Unpaved ground; not wheelchair accessible',
    sanitationNotes: 'Deep trench latrines',
    waterNotes: 'Tanker-supplied water; boil before drinking',
  },
];

// ============================================================
// Emergency Helplines - UP Specific
// ============================================================

export const UP_EMERGENCY_HELPLINES = [
  {
    id: 'up-disaster-management-1070',
    name: 'Uttar Pradesh Disaster Management Helpline',
    number: '1070',
    category: 'Disaster Relief',
    description: 'State-controlled room for flood, cyclone, earthquake, and extreme weather disaster relief and rescue coordination. Available in Hindi and English.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#f97316',
    authority: 'Uttar Pradesh State Disaster Management Authority',
    isPrimary: true,
  },
  {
    id: 'up-police-112',
    name: 'Uttar Pradesh Police ERSS',
    number: '112',
    category: 'All-in-One Emergency',
    description: 'Single unified emergency number for Police, Fire, and Ambulance across Uttar Pradesh.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#ef4444',
    authority: 'Uttar Pradesh Police',
  },
  {
    id: 'up-fire-101',
    name: 'Uttar Pradesh Fire Service',
    number: '101',
    category: 'Fire & Rescue',
    description: 'Fire emergency and rescue operations during flood situations.',
    timing: '24 Hours / 7 Days',
    tollFree: true,
    badgeColor: '#dc2626',
    authority: 'Uttar Pradesh Fire Services',
  },
];

// ============================================================
// Household Preparedness Checklist (Printable)
// ============================================================

export const FLOOD_PREPAREDNESS_CHECKLIST = [
  {
    id: 'pc-1',
    item: 'Copies of Aadhaar, Voter ID, Ration Card in waterproof zip pouch',
    essential: true,
    category: 'documents',
  },
  {
    id: 'pc-2',
    item: '3-day supply of non-perishable dry food (chana, biscuits, dry fruits)',
    essential: true,
    category: 'food',
  },
  {
    id: 'pc-3',
    item: '3 liters of potable drinking water per family member',
    essential: true,
    category: 'water',
  },
  {
    id: 'pc-4',
    item: 'First aid box: Paracetamol, ORS packets, antiseptic ointment, bandages',
    essential: true,
    category: 'medical',
  },
  {
    id: 'pc-5',
    item: 'LED torch / flashlight with extra batteries and charged power bank',
    essential: true,
    category: 'lighting',
  },
  {
    id: 'pc-6',
    item: 'Whistle to signal rescue teams in zero visibility',
    essential: false,
    category: 'signaling',
  },
  {
    id: 'pc-7',
    item: 'Essential prescription medicines for senior citizens or chronic patients',
    essential: true,
    category: 'medical',
  },
  {
    id: 'pc-8',
    item: 'Waterproof jacket / rain gear',
    essential: false,
    category: 'clothing',
  },
  {
    id: 'pc-9',
    item: 'Full charge on all mobile phones and power banks',
    essential: true,
    category: 'connectivity',
  },
  {
    id: 'pc-10',
    item: 'Family emergency contact card (including 1070, 112, local authority numbers)',
    essential: true,
    category: 'contacts',
  },
  {
    id: 'pc-11',
    item: 'Cash in small denominations (ATMs may be non-functional)',
    essential: false,
    category: 'financial',
  },
  {
    id: 'pc-12',
    item: 'Pet supplies (food, water, carrier) if applicable',
    essential: false,
    category: 'pets',
  },
];

// ============================================================
// Low-Bandwidth Text-Only Route Directory
// ============================================================

export const LOW_BANDWIDTH_ROUTE_DIRECTORY = {
  header: 'GORAKHPUR FLOOD EVACUATION ROUTE DIRECTORY',
  subtitle: 'Official routes (verified) | Community reports (temp, expire unless revalidated)',
  generatedAt: new Date().toISOString(),
  routes: [
    {
      id: 'official-1',
      name: 'NH-29 Hospital to Relief Camp A',
      status: 'OPEN',
      from: 'Gorakhpur District Hospital',
      to: 'Relief Camp A',
      notes: 'Primary route. Watch low-lying crossing at Rapti River Bridge.',
      warnings: 'Low-lying crossing floods at high tide + rain > 50mm',
    },
    {
      id: 'official-2',
      name: 'Circuit House to Relief Camp B',
      status: 'OPEN',
      from: 'Gorakhpur Circuit House',
      to: 'Relief Camp B',
      notes: 'Northern sector evacuation route.',
      warnings: 'None',
    },
    {
      id: 'temp-1',
      name: 'Sector 7 Road Blockage',
      status: 'BLOCKED (TEMPORARY)',
      from: 'Sector 7',
      to: 'Sector 8',
      notes: 'Water level above road surface. Reported by resident 36hr ago.',
      warnings: 'EXPIRES unless revalidated by approved responder. Do not use if blocked.',
    },
  ],
  emergencyContacts: [
    'PRIMARY: 1070 - UP Disaster Management Helpline',
    'SECONDARY: 112 - UP Police ERSS',
    'FIRE: 101 - UP Fire Service',
  ],
  notes: 'Never calculate a route through a reported flooded segment. Always verify current status before departure.',
};

// ============================================================
// Route Blocking / Unblocking Management
// ============================================================

/**
 * Mark a route segment as blocked or reopened by an approved local responder.
 * Includes timestamp and evidence. Unverified community reports auto-expire.
 * 
 * @param segmentId - The ID of the route segment to update
 * @param blocked - true to block, false to reopen/unblock
 * @param evidence - Description of the blockage or reopening evidence
 * @param responderId - ID of the approved responder performing the action
 * @returns The updated segment or null if segment not found
 */
export function markRouteSegmentBlocked(segmentId, blocked, evidence, responderId) {
  const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === segmentId);
  
  if (!segment) {
    console.error(`Route segment ${segmentId} not found`);
    return null;
  }

  // Update the segment status
  segment.status = blocked ? RouteSegmentStatus.BLOCKED : RouteSegmentStatus.OPEN;
  
  // Add or update warning with timestamp and evidence
  const now = new Date().toISOString();
  const warning = {
    id: `warning-${segmentId}-${Date.now()}`,
    type: blocked ? 'blockage' : 'clear',
    message: blocked 
      ? 'Route blocked - confirmed by approved responder'
      : 'Route unblocked - confirmed by approved responder',
    severity: blocked ? 'high' : 'low',
    timestamp: now,
    reportedBy: `Responder ${responderId}`,
    evidence: evidence || 'No additional evidence provided',
    expiresAt: blocked ? calculateExpiryForNewReport() : undefined,
  };

  // If this is a community report (official: false) and it's being blocked,
  // set a short expiration unless revalidated
  if (!segment.official && blocked) {
    warning.expiresAt = calculateExpiryForNewReport();
    segment.notes = segment.notes || '';
    segment.notes += ' Report requires revalidation within 12 hours or auto-expires';
  }

  // Add warning to segment
  if (!segment.warnings.includes(warning)) {
    segment.warnings = [...segment.warnings, warning];
  }

  // If unblocking, remove old temporary block warning if it exists
  if (!blocked) {
    segment.warnings = segment.warnings.filter(w => 
      w.type !== 'blockage' || w.id.startsWith(`warning-${segmentId}-revalidated`)
    );
    segment.notes = segment.notes?.replace('| Report requires revalidation within 12 hours or auto-expires', '');
  }

  return segment;
}

/**
 * Calculate expiration time for a new community report.
 * Reports expire after 12 hours unless revalidated by an approved responder.
 */
function calculateExpiryForNewReport() {
  return new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12 hours
}

/**
 * Revalidate a temporary community report - extends its expiration.
 * Only approved local responders can revalidate.
 * 
 * @param segmentId - The ID of the route segment to revalidate
 * @param evidence - New evidence for the revalidation
 * @param responderId - ID of the approved responder
 * @returns true if revalidation successful, false otherwise
 */
export function revalidateRouteSegment(segmentId, evidence, responderId) {
  const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === segmentId);
  
  if (!segment) {
    console.error(`Route segment ${segmentId} not found for revalidation`);
    return false;
  }

  if (segment.official) {
    console.error(`Cannot revalidate official route segment ${segmentId}`);
    return false;
  }

  // Find the existing block warning and update its expiration
  const blockWarning = segment.warnings.find(w => w.type === 'blockage');
  
  if (!blockWarning) {
    console.error(`No block warning found on segment ${segmentId}`);
    return false;
  }

  // Extend expiration by 12 hours from now
  blockWarning.expiresAt = calculateExpiryForNewReport();
  blockWarning.evidence = evidence || blockWarning.evidence;
  blockWarning.reportedBy = `Responder ${responderId} (revalidated)`;
  blockWarning.timestamp = new Date().toISOString();

  // Update notes to reflect revalidation
  segment.notes = segment.notes || '';
  segment.notes += segment.notes ? ' | ' : '';
  segment.notes += `Revalidated by responder ${responderId} on ${new Date().toLocaleString()}`;

  return true;
}

/**
 * Auto-expire stale/unverified reports older than their expiration.
 * Should be called periodically (e.g., every hour) in production.
 */
export function autoExpireStaleReports() {
  const now = new Date().toISOString();

  EVACUATION_ROUTE_SEGMENTS.forEach(segment => {
    // Only process non-official (community) segments with warnings
    if (segment.official) return;

    segment.warnings.forEach(warning => {
      if (warning.expiresAt && new Date(warning.expiresAt) < new Date(now)) {
        // Mark warning as expired
        warning.message = warning.message + ' [EXPIRED]';
        warning.severity = 'low';
        
        // If all warnings are expired, mark segment as unknown/Open
        if (segment.status === RouteSegmentStatus.BLOCKED) {
          segment.status = RouteSegmentStatus.UNKNOWN;
          segment.notes = segment.notes || '';
          segment.notes += ' | All temporary reports expired; status reset to unknown';
        }
      }
    });
  });
}

/**
 * Check if a route segment has an unresolved blockage.
 * A route with an unresolved blockage is not recommended.
 * 
 * @param segmentId - The ID of the route segment to check
 * @returns true if the segment has an unresolved blockage
 */
export function hasUnresolvedBlockage(segmentId) {
  const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === segmentId);
  
  if (!segment) return false;

  // Check for any blockage warnings that haven't expired
  const now = new Date().toISOString();
  
  const activeBlockages = segment.warnings.filter(w => 
    w.type === 'blockage' && 
    ( !w.expiresAt || new Date(w.expiresAt) > new Date(now) )
  );

  // Also check segment status
  const hasBlockStatus = segment.status === RouteSegmentStatus.BLOCKED;
  
  return activeBlockages.length > 0 || hasBlockStatus;
}

/**
 * Get the effective status of a route segment for display/recommendation.
 * Distinguishes between official, community, and expired statuses.
 */
export function getEffectiveSegmentStatus(segmentId) {
  const segment = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === segmentId);
  
  if (!segment) {
    return {
      status: 'UNKNOWN',
      isRecommended: false,
      displayLabel: 'Route segment not found',
      emergencyOverride: false,
    };
  }

  // If segment has unresolved blockage, not recommended
  if (hasUnresolvedBlockage(segmentId)) {
    return {
      status: 'BLOCKED',
      isRecommended: false,
      displayLabel: `${segment.name} - BLOCKED (do not use)`,
      emergencyOverride: true,
    };
  }

  // If official and open, recommended
  if (segment.official && segment.status === RouteSegmentStatus.OPEN) {
    return {
      status: 'OPEN',
      isRecommended: true,
      displayLabel: `${segment.name} - OPEN (official route)`,
      emergencyOverride: false,
    };
  }

  // If community report and still valid (not expired), show with distinction
  if (!segment.official && segment.status === RouteSegmentStatus.OPEN) {
    // Check if any warnings are active
    const now = new Date().toISOString();
    const activeWarnings = segment.warnings.filter(w => 
      w.expiresAt && new Date(w.expiresAt) > new Date(now)
    );
    
    if (activeWarnings.length > 0) {
      return {
        status: 'OPEN_WITH_CAUTION',
        isRecommended: false,
        displayLabel: `${segment.name} - COMMUNITY REPORT (cautions apply)`,
        emergencyOverride: false,
      };
    }
    
    return {
      status: 'OPEN',
      isRecommended: true,
      displayLabel: `${segment.name} - COMMUNITY REPORT (verified)`,
      emergencyOverride: false,
    };
  }

  // Default
  return {
    status: segment.status,
    isRecommended: segment.status === RouteSegmentStatus.OPEN,
    displayLabel: segment.name,
    emergencyOverride: false,
  };
}

// ============================================================
// Shelter Management
// ============================================================

/**
 * Get a shelter by ID from the verified Gorakhpur shelters list.
 */
export function getShelterById(shelterId) {
  return GORAKHPUR_SHELTERS.find(s => s.id === shelterId);
}

/**
 * Get all verified shelters for a district.
 * Includes source, authority, and last verification info.
 */
export function getAllShelters() {
  return [...GORAKHPUR_SHELTERS];
}

/**
 * Get the primary emergency helpline (always shown first).
 */
export function getPrimaryHelpline(helplines) {
  const primary = helplines.find(h => h.isPrimary);
  return primary || helplines[0];
}

/**
 * Get all UP emergency helplines, with primary first.
 */
export function getAllHelplines() {
  const primary = UP_EMERGENCY_HELPLINES.find(h => h.isPrimary);
  const others = UP_EMERGENCY_HELPLINES.filter(h => !h.isPrimary);
  return primary ? [primary, ...others] : others;
}

/**
 * Get emergency helpline based on category.
 */
export function getHelplineByCategory(category) {
  return UP_EMERGENCY_HELPLINES.find(h => h.category === category);
}

/**
 * Check if a shelter has been recently verified.
 * 
 * @param shelterId - The shelter ID to check
 * @param maxDaysAgo - Maximum days since last verification to be "recent"
 * @returns true if shelter was verified within maxDaysAgo
 */
export function isShelterRecentlyVerified(shelterId, maxDaysAgo = 7) {
  const shelter = getShelterById(shelterId);
  if (!shelter) return false;
  
  const lastVerified = new Date(shelter.lastVerified);
  const now = new Date();
  const diffDays = (now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24);
  
  return diffDays <= maxDaysAgo;
}

/**
 * Get shelter attributes summary for display.
 */
export function getShelterAttributesSummary(shelterId) {
  const shelter = getShelterById(shelterId);
  if (!shelter) return null;
  
  const attrs = shelter.attributes;
  return {
    wheelchair: attrs[ShelterAttribute.ACCESSIBILITY_WHEELCHAIR] || false,
    emergencyVehicle: attrs[ShelterAttribute.ACCESSIBILITY_EMERGENCY_VEHICLE] || false,
    water: attrs[ShelterAttribute.FACILITY_WATER] || false,
    sanitation: attrs[ShelterAttribute.FACILITY_SANITATION] || false,
    power: attrs[ShelterAttribute.FACILITY_POWER] || false,
    storage: attrs[ShelterAttribute.FACILITY_STORAGE] || false,
    notes: shelter.accessibilityNotes || shelter.sanitationNotes || shelter.waterNotes || '',
  };
}

// ============================================================
// Route Directory (Low-Bandwidth Text Format)
// ============================================================

/**
 * Generate the low-bandwidth text-only route directory.
 * Uses only text - no graphics, no colors, minimal data.
 */
export function generateLowBandwidthRouteDirectory() {
  const { header, subtitle, routes, emergencyContacts } = LOW_BANDWIDTH_ROUTE_DIRECTORY;
  const now = new Date().toLocaleString();
  
  let output = '';
  output += `${header}\n`;
  output += `${subtitle}\n`;
  output += `Generated: ${now}\n`;
  output += `${'-'.repeat(50)}\n\n`;
  
  output += 'ROUTE DIRECTORY:\n';
  output += `${'-'.repeat(50)}\n\n`;
  
  routes.forEach((route, index) => {
    output += `${index + 1}. ${route.name}\n`;
    output += `   Status: ${route.status}\n`;
    output += `   From: ${route.from}\n`;
    output += `   To: ${route.to}\n`;
    if (route.notes) {
      output += `   Notes: ${route.notes}\n`;
    }
    if (route.warnings) {
      output += `   Warnings: ${route.warnings}\n`;
    }
    output += '\n';
  });
  
  output += 'EMERGENCY CONTACTS (PRIORITY ORDER):\n';
  output += `${'-'.repeat(50)}\n\n`;
  
  emergencyContacts.forEach((contact, index) => {
    output += `${index + 1}. ${contact}\n`;
  });
  
  output += `\nIMPORTANT: Never calculate a route through a reported flooded segment.\n`;
  output += `Always verify current status before departure.\n`;
  
  return output;
}

/**
 * Printable household preparedness list.
 */
export function generatePrintableChecklist() {
  const checklist = FLOOD_PREPAREDNESS_CHECKLIST;
  const now = new Date().toLocaleString();
  
  let output = '';
  output += 'FLOOD PREPAREDNESS CHECKLIST\n';
  output += `Generated: ${now}\n`;
  output += `District: Gorakhpur (Flood-Prone) | Pilot District\n`;
  output += `${'-'.repeat(50)}\n\n`;
  
  output += 'ESSENTIAL ITEMS (must have):\n';
  output += `${'-'.repeat(50)}\n\n`;
  
  checklist.filter(c => c.essential).forEach((item, index) => {
    output += `${index + 1}. ${item.item}\n`;
  });
  
  output += '\nRECOMMENDED ITEMS (good to have):\n';
  output += `${'-'.repeat(50)}\n\n`;
  
  checklist.filter(c => !c.essential).forEach((item, index) => {
    output += `${index + 1}. ${item.item}\n`;
  });
  
  output += `\nEMERGENCY CONTACTS:\n`;
  output += `${'-'.repeat(50)}\n`;
  
  const helplines = getAllHelplines();
  helplines.forEach((h, idx) => {
    output += `${idx + 1}. ${h.name}: ${h.number} (${h.category})\n`;
  });
  
  output += `\nINSTRUCTIONS:\n`;
  output += `• Never calculate a route through a reported flooded segment\n`;
  output += `• Official emergency contact first: 1070 (UP Disaster Management)\n`;
  output += `• Verify route status before departure\n`;
  output += `• Check shelter availability and facilities en route\n`;
  output += `• Keep this list in a waterproof location\n`;
  
  return output;
}

// ============================================================
// Route Recommendation Engine
// ============================================================

/**
 * Get recommended evacuation routes based on current status.
 * Never routes through a reported flooded segment.
 * 
 * @param origin - Starting location/area
 * @param destination - Target shelter or safe area
 * @returns Recommended route segments (never through blocked segments)
 */
export function getRecommendedRoutes(origin, destination) {
  const allSegments = EVACUATION_ROUTE_SEGMENTS;
  const recommendations = [];

  // Filter segments that could connect origin to destination
  // and that are recommended (no unresolved blockages)
  allSegments.forEach(segment => {
    const effectiveStatus = getEffectiveSegmentStatus(segment.id);
    
    // Include segments that are officially open or valid community reports
    // without unresolved blockages
    if (effectiveStatus.isRecommended) {
      recommendations.push({
        segmentId: segment.id,
        name: segment.name,
        from: segment.from,
        to: segment.to,
        status: effectiveStatus.status,
        isRecommended: effectiveStatus.isRecommended,
      });
    }
  });

  // Sort: official routes first, then community-verified
  recommendations.sort((a, b) => {
    const aIsOfficial = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === a.segmentId)?.official || false;
    const bIsOfficial = EVACUATION_ROUTE_SEGMENTS.find(s => s.id === b.segmentId)?.official || false;
    
    if (aIsOfficial && !bIsOfficial) return -1;
    if (!aIsOfficial && bIsOfficial) return 1;
    
    if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
    if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;
    
    return 0;
  });

  return recommendations;
}

/**
 * Check if there's any route available from origin to destination
 * that doesn't go through blocked segments.
 */
export function isRouteAvailable(origin, destination) {
  const recommended = getRecommendedRoutes(origin, destination);
  
  if (recommended.length === 0) {
    return {
      available: false,
      recommendedRoutes: [],
      alternativeRoutes: [],
    };
  }
  
  return {
    available: true,
    recommendedRoutes: recommended.filter(r => r.isRecommended),
    alternativeRoutes: recommended.filter(r => !r.isRecommended),
  };
}

// End of floodRouteService.js