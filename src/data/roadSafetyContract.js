/**
 * Road-Safety Blackspot Detection and Evidence Review Dashboard Contract
 * MoRTH / Indian Road Congress (IRC SP:88) Grounded Domain Model
 */

export const ROAD_SAFETY_SCHEMA_VERSION = 1;

export const ROAD_SAFETY_STORAGE_KEYS = {
  SEGMENTS: 'civicbridge_road_segments_v1',
  CRASHES: 'civicbridge_crash_aggregates_v1',
  HAZARDS: 'civicbridge_hazard_reports_v1',
  FEATURES: 'civicbridge_road_features_v1',
  RUNS: 'civicbridge_risk_runs_v1',
  CASES: 'civicbridge_review_cases_v1',
  INTERVENTIONS: 'civicbridge_intervention_records_v1',
  RATE_LIMIT: 'civicbridge_road_safety_rate_limit_v1',
  AUDIT_LOGS: 'civicbridge_road_safety_audit_logs_v1',
};

export const CASE_STATES = {
  CANDIDATE: 'candidate',
  INSPECTION_SCHEDULED: 'inspection_scheduled',
  INSPECTED: 'inspected',
  INTERVENTION_PLANNED: 'intervention_planned',
  IN_PROGRESS: 'in_progress',
  MONITORING: 'monitoring',
  RESOLVED: 'resolved',
  DISMISSED_FALSE_POSITIVE: 'dismissed_false_positive',
  DEFERRED: 'deferred',
};

export const CASE_STATE_LABELS = {
  [CASE_STATES.CANDIDATE]: 'Candidate Hotspot (Unverified)',
  [CASE_STATES.INSPECTION_SCHEDULED]: 'Inspection Scheduled',
  [CASE_STATES.INSPECTED]: 'Site Inspected',
  [CASE_STATES.INTERVENTION_PLANNED]: 'Intervention Planned',
  [CASE_STATES.IN_PROGRESS]: 'Engineering Work In Progress',
  [CASE_STATES.MONITORING]: 'Post-Intervention Monitoring',
  [CASE_STATES.RESOLVED]: 'Intervention Completed & Resolved',
  [CASE_STATES.DISMISSED_FALSE_POSITIVE]: 'Dismissed (False Positive)',
  [CASE_STATES.DEFERRED]: 'Deferred / Under Observation',
};

/**
 * Strict Finite State Machine: Only allow documented state transitions.
 */
export const ALLOWED_STATE_TRANSITIONS = {
  [CASE_STATES.CANDIDATE]: [
    CASE_STATES.INSPECTION_SCHEDULED,
    CASE_STATES.DISMISSED_FALSE_POSITIVE,
    CASE_STATES.DEFERRED,
  ],
  [CASE_STATES.INSPECTION_SCHEDULED]: [
    CASE_STATES.INSPECTED,
    CASE_STATES.CANDIDATE, // Rescheduled or cancelled
    CASE_STATES.DEFERRED,
  ],
  [CASE_STATES.INSPECTED]: [
    CASE_STATES.INTERVENTION_PLANNED,
    CASE_STATES.DEFERRED,
    CASE_STATES.DISMISSED_FALSE_POSITIVE,
  ],
  [CASE_STATES.INTERVENTION_PLANNED]: [
    CASE_STATES.IN_PROGRESS,
    CASE_STATES.INSPECTED, // Need re-inspection or scope revision
    CASE_STATES.DEFERRED,
  ],
  [CASE_STATES.IN_PROGRESS]: [
    CASE_STATES.MONITORING,
    CASE_STATES.INTERVENTION_PLANNED, // Halted/re-planned
  ],
  [CASE_STATES.MONITORING]: [
    CASE_STATES.RESOLVED,
    CASE_STATES.INTERVENTION_PLANNED, // Remediation failed; secondary intervention needed
  ],
  [CASE_STATES.RESOLVED]: [
    CASE_STATES.CANDIDATE, // Reopened if recurring crashes resume
  ],
  [CASE_STATES.DISMISSED_FALSE_POSITIVE]: [
    CASE_STATES.CANDIDATE, // Reopened if new statistical threshold met
  ],
  [CASE_STATES.DEFERRED]: [
    CASE_STATES.CANDIDATE,
    CASE_STATES.INSPECTION_SCHEDULED,
  ],
};

export const SEVERITY_WEIGHTS = {
  FATAL: 5.0,
  SEVERE_INJURY: 3.0,
  MINOR_INJURY: 1.0,
  PROPERTY_DAMAGE: 0.2,
};

export const DEFAULT_RISK_WEIGHTS = {
  crashFrequencyWeight: 0.35,
  crashSeverityWeight: 0.35,
  infrastructureHazardWeight: 0.20,
  exposureDenominatorWeight: 0.10,
};

export const ROAD_TYPES = {
  NATIONAL_HIGHWAY: 'national_highway',
  STATE_HIGHWAY: 'state_highway',
  MAJOR_DISTRICT_ROAD: 'major_district_road',
  URBAN_ARTERIAL: 'urban_arterial',
  COLLECTOR_STREET: 'collector_street',
};

export const ROAD_TYPE_LABELS = {
  [ROAD_TYPES.NATIONAL_HIGHWAY]: 'National Highway (NH)',
  [ROAD_TYPES.STATE_HIGHWAY]: 'State Highway (SH)',
  [ROAD_TYPES.MAJOR_DISTRICT_ROAD]: 'Major District Road (MDR)',
  [ROAD_TYPES.URBAN_ARTERIAL]: 'Urban Arterial Corridor',
  [ROAD_TYPES.COLLECTOR_STREET]: 'Urban Collector / Sub-Arterial',
};

export const LIGHTING_QUALITIES = {
  ADEQUATE: 'adequate',
  INTERMITTENT: 'intermittent',
  POOR: 'poor',
  UNLIT: 'unlit',
};

export const CROSSING_TYPES = {
  SIGNALIZED: 'signalized',
  ZEBRA_UNSIGNALIZED: 'zebra_unsignalized',
  GRADE_SEPARATED_FOB: 'grade_separated_fob',
  NONE: 'none',
};

export const HAZARD_TYPES = {
  POTHOLE_SURFACE: 'pothole_surface',
  MISSING_SIGNAGE: 'missing_signage',
  POOR_STREETLIGHT: 'poor_streetlight',
  BROKEN_MEDIAN: 'broken_median',
  BLIND_CURVE_ENCROACHMENT: 'blind_curve_encroachment',
  DANGEROUS_INTERSECTION: 'dangerous_intersection',
  MISSING_PEDESTRIAN_CROSSING: 'missing_pedestrian_crossing',
};

export const HAZARD_TYPE_LABELS = {
  [HAZARD_TYPES.POTHOLE_SURFACE]: 'Potholes / Severe Surface Rutting',
  [HAZARD_TYPES.MISSING_SIGNAGE]: 'Missing Regulatory / Speed Signage',
  [HAZARD_TYPES.POOR_STREETLIGHT]: 'Non-Functional or Insufficient Streetlighting',
  [HAZARD_TYPES.BROKEN_MEDIAN]: 'Damaged Median / Unauthorized U-Turn Cut',
  [HAZARD_TYPES.BLIND_CURVE_ENCROACHMENT]: 'Obscured Sightline / Blind Curve Encroachment',
  [HAZARD_TYPES.DANGEROUS_INTERSECTION]: 'Uncontrolled Geometric Intersection',
  [HAZARD_TYPES.MISSING_PEDESTRIAN_CROSSING]: 'High-Pedestrian Crossing Without Safe Refuge',
};

export const INTERVENTION_TYPES = {
  RUMBLE_STRIPS: 'rumble_strips',
  SPEED_TABLE_PEDESTRIAN: 'speed_table_pedestrian',
  HIGH_MAST_LED_LIGHTING: 'high_mast_led_lighting',
  SOLAR_BLINKS_SIGNAGE: 'solar_blinks_signage',
  MEDIAN_CLOSURE_KERB: 'median_closure_kerb',
  GEOMETRIC_JUNCTION_REALIGNMENT: 'geometric_junction_realignment',
  TRAFFIC_SIGNAL_INSTALLATION: 'traffic_signal_installation',
  GUARD_RAIL_BARRIER: 'guard_rail_barrier',
};

export const INTERVENTION_TYPE_LABELS = {
  [INTERVENTION_TYPES.RUMBLE_STRIPS]: 'Thermoplastic Rumble Strips & Bar Markings',
  [INTERVENTION_TYPES.SPEED_TABLE_PEDESTRIAN]: 'Raised Pedestrian Crosswalk / Speed Table',
  [INTERVENTION_TYPES.HIGH_MAST_LED_LIGHTING]: 'High-Mast LED Illumination Installation',
  [INTERVENTION_TYPES.SOLAR_BLINKS_SIGNAGE]: 'High-Intensity Retroreflective Signage & Solar Blinkers',
  [INTERVENTION_TYPES.MEDIAN_CLOSURE_KERB]: 'Median Hazard Remediation & Kerb Channelizer',
  [INTERVENTION_TYPES.GEOMETRIC_JUNCTION_REALIGNMENT]: 'Geometric Junction Realignment & Island Roundabout',
  [INTERVENTION_TYPES.TRAFFIC_SIGNAL_INSTALLATION]: 'Adaptive Traffic Signal & Pedestrian Push-Button Phase',
  [INTERVENTION_TYPES.GUARD_RAIL_BARRIER]: 'W-Beam Crash Guardrail & Pedestrian Fencing',
};

export const ETHICAL_NON_FAULT_NOTICE =
  'Statutory Road-Safety Analytics Disclaimer: Blackspot detection and corridor risk scores are calculated strictly from aggregate crash frequencies, physical road geometry, and traffic exposure indicators. Civic Help Setu never infers individual fault, driver liability, or personal responsibility. All automated prioritization requires human site inspection and multidisciplinary engineering review before executing civic interventions.';

/**
 * Valid initial Indian corridors for road safety review.
 */
export const SEED_ROAD_SEGMENTS = [
  {
    id: 'seg-ka-blr-nh44-01',
    code: 'KA-BLR-NH44-KM14',
    name: 'NH-44 Outer Ring Road - Hebbal Flyover Down-Ramp',
    jurisdiction: {
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      ward: 'Ward 19 (Sanjayanagar)',
      zone: 'North Zone',
    },
    startCoords: { lat: 13.0358, lng: 77.5970 },
    endCoords: { lat: 13.0412, lng: 77.5992 },
    lengthMeters: 650,
    roadType: ROAD_TYPES.NATIONAL_HIGHWAY,
    speedLimitKmph: 80,
    carriagewayWidthMeters: 14.5,
    surfaceType: 'Asphaltic Concrete',
    medianPresent: true,
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2026-02-10T11:30:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
  {
    id: 'seg-mh-mum-weh-02',
    code: 'MH-MUM-WEH-GOREGAON',
    name: 'Western Express Highway - Hub Mall Junction & Flyover Underpass',
    jurisdiction: {
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      ward: 'P/South Ward',
      zone: 'Western Suburbs',
    },
    startCoords: { lat: 19.1553, lng: 72.8524 },
    endCoords: { lat: 19.1610, lng: 72.8541 },
    lengthMeters: 720,
    roadType: ROAD_TYPES.URBAN_ARTERIAL,
    speedLimitKmph: 70,
    carriagewayWidthMeters: 16.0,
    surfaceType: 'Mastic Asphalt',
    medianPresent: true,
    createdAt: '2025-02-01T09:00:00Z',
    updatedAt: '2026-03-01T14:15:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
  {
    id: 'seg-dl-del-ring-03',
    code: 'DL-DEL-RR-ASHRAM',
    name: 'Inner Ring Road - Ashram Chowk Underpass Transition',
    jurisdiction: {
      state: 'Delhi',
      district: 'South East Delhi',
      ward: 'Ward 142 (Lajpat Nagar)',
      zone: 'South Zone',
    },
    startCoords: { lat: 28.5714, lng: 77.2588 },
    endCoords: { lat: 28.5760, lng: 77.2635 },
    lengthMeters: 550,
    roadType: ROAD_TYPES.URBAN_ARTERIAL,
    speedLimitKmph: 60,
    carriagewayWidthMeters: 12.0,
    surfaceType: 'Bituminous Concrete',
    medianPresent: true,
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2026-02-28T16:00:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
  {
    id: 'seg-tn-chn-gst-04',
    code: 'TN-CHN-GST-GUINDY',
    name: 'Grand Southern Trunk (GST) Road - Guindy Industrial Estate Crossing',
    jurisdiction: {
      state: 'Tamil Nadu',
      district: 'Chennai',
      ward: 'Zone 13 (Adyar)',
      zone: 'South Chennai',
    },
    startCoords: { lat: 13.0067, lng: 80.2023 },
    endCoords: { lat: 13.0115, lng: 80.2071 },
    lengthMeters: 580,
    roadType: ROAD_TYPES.STATE_HIGHWAY,
    speedLimitKmph: 60,
    carriagewayWidthMeters: 15.0,
    surfaceType: 'Asphalt',
    medianPresent: true,
    createdAt: '2025-03-01T08:30:00Z',
    updatedAt: '2026-03-10T12:00:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
  {
    id: 'seg-wb-kol-vip-05',
    code: 'WB-KOL-VIP-TEGHORIA',
    name: 'VIP Road (Kazi Nazrul Islam Avenue) - Teghoria Major Crossing',
    jurisdiction: {
      state: 'West Bengal',
      district: 'North 24 Parganas',
      ward: 'Bidhannagar Municipal Ward 11',
      zone: 'Rajarhat-Bidhannagar',
    },
    startCoords: { lat: 22.6180, lng: 88.4350 },
    endCoords: { lat: 22.6235, lng: 88.4382 },
    lengthMeters: 620,
    roadType: ROAD_TYPES.URBAN_ARTERIAL,
    speedLimitKmph: 60,
    carriagewayWidthMeters: 13.5,
    surfaceType: 'Asphalt',
    medianPresent: true,
    createdAt: '2025-02-15T11:00:00Z',
    updatedAt: '2026-03-05T15:00:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
];

export const SEED_CRASH_AGGREGATES = [
  {
    id: 'crash-nh44-2025-q4',
    segmentId: 'seg-ka-blr-nh44-01',
    periodStart: '2025-10-01',
    periodEnd: '2025-12-31',
    fatalCount: 3,
    severeInjuryCount: 7,
    minorInjuryCount: 12,
    propertyDamageCount: 16,
    totalCrashes: 38,
    trafficVolumeADT: 85000,
    exposureDenominator: 50.4, // Million vehicle-kilometers
    sourceAgency: 'State Traffic Police & MoRTH Road Accident Data Record',
    sourceNoticeUrl: 'https://morth.nic.in/road-accident-in-india',
    publishedAt: '2026-01-20T10:00:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
  {
    id: 'crash-weh-2025-q4',
    segmentId: 'seg-mh-mum-weh-02',
    periodStart: '2025-10-01',
    periodEnd: '2025-12-31',
    fatalCount: 2,
    severeInjuryCount: 5,
    minorInjuryCount: 14,
    propertyDamageCount: 22,
    totalCrashes: 43,
    trafficVolumeADT: 110000,
    exposureDenominator: 72.8,
    sourceAgency: 'Mumbai Traffic Police Road Safety Cell',
    sourceNoticeUrl: 'https://trafficpolicemumbai.maharashtra.gov.in',
    publishedAt: '2026-01-25T11:00:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
  {
    id: 'crash-ashram-2025-q4',
    segmentId: 'seg-dl-del-ring-03',
    periodStart: '2025-10-01',
    periodEnd: '2025-12-31',
    fatalCount: 4,
    severeInjuryCount: 9,
    minorInjuryCount: 8,
    propertyDamageCount: 11,
    totalCrashes: 32,
    trafficVolumeADT: 95000,
    exposureDenominator: 48.0,
    sourceAgency: 'Delhi Traffic Police Annual Crash Statistics',
    sourceNoticeUrl: 'https://delhitrafficpolice.nic.in',
    publishedAt: '2026-02-01T09:30:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
  {
    id: 'crash-guindy-2025-q4',
    segmentId: 'seg-tn-chn-gst-04',
    periodStart: '2025-10-01',
    periodEnd: '2025-12-31',
    fatalCount: 1,
    severeInjuryCount: 4,
    minorInjuryCount: 9,
    propertyDamageCount: 14,
    totalCrashes: 28,
    trafficVolumeADT: null, // Test denominator missing with uncertainty bounds
    exposureDenominator: null,
    sourceAgency: 'Greater Chennai Traffic Police Accident Database',
    sourceNoticeUrl: 'https://chennaitrafficpolice.tn.gov.in',
    publishedAt: '2026-02-10T14:00:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
  {
    id: 'crash-teghoria-2025-q4',
    segmentId: 'seg-wb-kol-vip-05',
    periodStart: '2025-10-01',
    periodEnd: '2025-12-31',
    fatalCount: 2,
    severeInjuryCount: 6,
    minorInjuryCount: 11,
    propertyDamageCount: 15,
    totalCrashes: 34,
    trafficVolumeADT: 78000,
    exposureDenominator: 44.5,
    sourceAgency: 'Bidhannagar Traffic Commissionerate Quarterly Record',
    sourceNoticeUrl: 'https://bidhannagarcitypolice.org',
    publishedAt: '2026-02-12T10:30:00Z',
    schemaVersion: ROAD_SAFETY_SCHEMA_VERSION,
  },
];

export const SEED_ROAD_FEATURES = [
  {
    id: 'feat-nh44-01',
    segmentId: 'seg-ka-blr-nh44-01',
    lightingQuality: LIGHTING_QUALITIES.INTERMITTENT,
    crossingType: CROSSING_TYPES.NONE,
    speedCalming: 'none',
    pedestrianFootpath: 'none',
    blindCurve: false,
    surfaceCondition: 'fair',
    lastAuditedAt: '2025-11-10T10:00:00Z',
    auditedBy: 'Karnataka PWD Road Safety Audit Cell',
  },
  {
    id: 'feat-weh-02',
    segmentId: 'seg-mh-mum-weh-02',
    lightingQuality: LIGHTING_QUALITIES.ADEQUATE,
    crossingType: CROSSING_TYPES.GRADE_SEPARATED_FOB,
    speedCalming: 'rumble_strips',
    pedestrianFootpath: 'continuous',
    blindCurve: true,
    surfaceCondition: 'good',
    lastAuditedAt: '2025-12-05T14:30:00Z',
    auditedBy: 'MMRDA Traffic Safety Review Group',
  },
  {
    id: 'feat-ashram-03',
    segmentId: 'seg-dl-del-ring-03',
    lightingQuality: LIGHTING_QUALITIES.POOR,
    crossingType: CROSSING_TYPES.ZEBRA_UNSIGNALIZED,
    speedCalming: 'none',
    pedestrianFootpath: 'intermittent',
    blindCurve: false,
    surfaceCondition: 'deteriorated',
    lastAuditedAt: '2025-11-20T11:00:00Z',
    auditedBy: 'Delhi PWD Safety Audit Division',
  },
  {
    id: 'feat-guindy-04',
    segmentId: 'seg-tn-chn-gst-04',
    lightingQuality: LIGHTING_QUALITIES.INTERMITTENT,
    crossingType: CROSSING_TYPES.SIGNALIZED,
    speedCalming: 'rumble_strips',
    pedestrianFootpath: 'continuous',
    blindCurve: false,
    surfaceCondition: 'fair',
    lastAuditedAt: '2025-10-18T16:00:00Z',
    auditedBy: 'Highways Department Tamil Nadu',
  },
  {
    id: 'feat-teghoria-05',
    segmentId: 'seg-wb-kol-vip-05',
    lightingQuality: LIGHTING_QUALITIES.POOR,
    crossingType: CROSSING_TYPES.NONE,
    speedCalming: 'none',
    pedestrianFootpath: 'none',
    blindCurve: true,
    surfaceCondition: 'deteriorated',
    lastAuditedAt: '2025-12-14T10:15:00Z',
    auditedBy: 'KMDA Urban Infrastructure Audit',
  },
];

export const SEED_HAZARD_REPORTS = [
  {
    id: 'haz-nh44-01',
    segmentId: 'seg-ka-blr-nh44-01',
    hazardType: HAZARD_TYPES.MISSING_PEDESTRIAN_CROSSING,
    severity: 'critical',
    description: 'High volume of pedestrians crossing highway at Hebbal down-ramp without any signal or refuge island.',
    locationHint: 'Near BMTC Hebbal bus shelter',
    reporterRole: 'citizen',
    reportedAt: '2026-02-05T08:15:00Z',
    status: 'validated',
  },
  {
    id: 'haz-ashram-02',
    segmentId: 'seg-dl-del-ring-03',
    hazardType: HAZARD_TYPES.POOR_STREETLIGHT,
    severity: 'high',
    description: 'Underpass exit streetlights are completely non-operational, causing severe night glare and blind braking.',
    locationHint: 'Underpass northern exit toward Sarai Kale Khan',
    reporterRole: 'patrol',
    reportedAt: '2026-02-12T21:40:00Z',
    status: 'validated',
  },
];

