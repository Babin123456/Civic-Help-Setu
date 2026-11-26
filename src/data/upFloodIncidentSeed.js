/**
 * Seed data for UP Flooded-Road and Drain Blockage Community Response Board (#985)
 * Grounded in authentic UP municipal wards, major arterial corridors, and disaster authorities.
 * Uses dynamic relative timestamps to ensure rock-solid freshness decay across all test and runtime clocks.
 */

import {
  INCIDENT_TYPES,
  DEPTH_CATEGORIES,
  SOURCE_TIERS,
  REPORT_STATUS,
} from './upFloodIncidentContract';

// Dynamic relative timestamp anchor
const getRelativeIso = (minutesAgo) => {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
};

export const SEED_INCIDENTS = [
  // 1. Official Emergency Alert (UPSDMA) - Active High Hazard
  {
    id: 'up-fl-001',
    district: 'Lucknow',
    ward: 'Ward 14 (Qaiserbagh)',
    locality: 'Begum Hazrat Mahal Park Underpass & Parivartan Chowk',
    incidentType: INCIDENT_TYPES.FLOODED_ROAD,
    depthCategory: DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER,
    sourceTier: SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT,
    issuingAuthority: 'UP State Disaster Management Authority (UPSDMA) Control Room',
    officialBulletinRef: 'UPSDMA/LKO-MONSOON/2026-BULLETIN-14',
    observedAt: getRelativeIso(35), // 35m ago - Fresh
    reportedAt: getRelativeIso(30),
    status: REPORT_STATUS.CURRENT,
    reconfirmationsCount: 18,
    corridorName: 'Parivartan Chowk to KD Singh Babu Stadium Link',
    coordinates: { lat: 26.86, lng: 80.93 },
    notes: 'Severe waterlogging due to Gomti backflow surge. Underpass impassable. Traffic Police diverted via University Bridge.',
  },

  // 2. Municipal Advisory (Lucknow Nagar Nigam) - Drain Siltation & Desilting Team Dispatched
  {
    id: 'up-fl-002',
    district: 'Lucknow',
    ward: 'Ward 24 (Alambagh)',
    locality: 'Kanpur Road Nallah near Singar Nagar Metro Station',
    incidentType: INCIDENT_TYPES.BLOCKED_DRAIN,
    depthCategory: DEPTH_CATEGORIES.KNEE_DEEP,
    sourceTier: SOURCE_TIERS.MUNICIPAL_ADVISORY,
    issuingAuthority: 'Lucknow Municipal Corporation (LMC / Nagar Nigam) Drainage Wing',
    officialBulletinRef: 'LMC/DRAIN-CLR/ZONE-5/2026/412',
    observedAt: getRelativeIso(110), // ~1.8 hours ago - Fresh for drain (12h limit)
    reportedAt: getRelativeIso(105),
    status: REPORT_STATUS.CURRENT,
    reconfirmationsCount: 7,
    corridorName: 'Singar Nagar Metro Service Lane',
    coordinates: { lat: 26.81, lng: 80.90 },
    notes: 'Major arterial culvert clogged with solid silt and plastic debris. Pumping teams and JCB excavators mobilized on site.',
  },

  // 3. Fresh Citizen Report - Flooded Road (Knee deep)
  {
    id: 'up-fl-003',
    district: 'Lucknow',
    ward: 'Ward 12 (Hazratganj)',
    locality: 'Ashok Marg near Shakti Bhawan intersection',
    incidentType: INCIDENT_TYPES.FLOODED_ROAD,
    depthCategory: DEPTH_CATEGORIES.KNEE_DEEP,
    sourceTier: SOURCE_TIERS.CITIZEN_REPORT,
    observedAt: getRelativeIso(20), // 20m ago - Very Fresh
    reportedAt: getRelativeIso(18),
    status: REPORT_STATUS.CURRENT,
    reconfirmationsCount: 5,
    corridorName: 'Ashok Marg corridor',
    coordinates: { lat: 26.85, lng: 80.94 },
    notes: 'Water reaching knee level near petrol pump. Two-wheelers stalling. Open drain cover flagged with tree branch by locals.',
  },

  // 4. Stale Citizen Report - Flooded Road (>3 hours ago, unconfirmed - Must be marked STALE & excluded from hazard)
  {
    id: 'up-fl-004',
    district: 'Lucknow',
    ward: 'Ward 33 (Indira Nagar)',
    locality: 'Munshi Pulia Intersection Service Lane',
    incidentType: INCIDENT_TYPES.FLOODED_ROAD,
    depthCategory: DEPTH_CATEGORIES.ANKLE_DEEP,
    sourceTier: SOURCE_TIERS.CITIZEN_REPORT,
    observedAt: getRelativeIso(320), // > 5 hours ago - STALE!
    reportedAt: getRelativeIso(315),
    status: REPORT_STATUS.STALE,
    reconfirmationsCount: 0,
    corridorName: 'Munshi Pulia to Sector 16 route',
    coordinates: { lat: 26.89, lng: 80.99 },
    notes: 'Water accumulated near market entrance. Old report, requires reconfirmation before navigation warning.',
  },

  // 5. Citizen Report - Blocked Drain in Kanpur Nagar
  {
    id: 'up-fl-005',
    district: 'Kanpur Nagar',
    ward: 'Ward 18 (Sisamau)',
    locality: 'Sisamau Main Nallah overflow near Chaman Ganj',
    incidentType: INCIDENT_TYPES.BLOCKED_DRAIN,
    depthCategory: DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER,
    sourceTier: SOURCE_TIERS.CITIZEN_REPORT,
    observedAt: getRelativeIso(150),
    reportedAt: getRelativeIso(145),
    status: REPORT_STATUS.CURRENT,
    reconfirmationsCount: 12,
    corridorName: 'Chaman Ganj Bazaar Road',
    coordinates: { lat: 26.47, lng: 80.34 },
    notes: 'Nallah wall breach caused blackwater surge into shops. Municipal suction pump requested immediately.',
  },

  // 6. Passable Route Observation - Tested Safe Public Passage
  {
    id: 'up-fl-006',
    district: 'Lucknow',
    ward: 'Ward 12 (Hazratganj)',
    locality: 'Lohia Path elevated bypass & 1090 Crossing',
    incidentType: INCIDENT_TYPES.PASSABLE_ROUTE,
    depthCategory: DEPTH_CATEGORIES.CLEARED_PASSABLE,
    sourceTier: SOURCE_TIERS.CITIZEN_REPORT,
    observedAt: getRelativeIso(25), // 25m ago - Fresh Passable
    reportedAt: getRelativeIso(22),
    status: REPORT_STATUS.CURRENT,
    reconfirmationsCount: 9,
    corridorName: 'Lohia Path Expressway bypass',
    coordinates: { lat: 26.86, lng: 80.97 },
    notes: 'Elevated flyover and main corridor completely free of water. Safe transit between Gomti Nagar and Hazratganj.',
  },

  // 7. Varanasi - Municipal Advisory - Assi Ghat Corridor
  {
    id: 'up-fl-007',
    district: 'Varanasi',
    ward: 'Ward 08 (Bhelupur)',
    locality: 'Assi Nallah culvert & Ravidas Gate link',
    incidentType: INCIDENT_TYPES.BLOCKED_DRAIN,
    depthCategory: DEPTH_CATEGORIES.KNEE_DEEP,
    sourceTier: SOURCE_TIERS.MUNICIPAL_ADVISORY,
    issuingAuthority: 'Varanasi Nagar Nigam (VNN) Health & Sanitation Dept',
    officialBulletinRef: 'VNN/SWM-FLOOD/2026/108',
    observedAt: getRelativeIso(180),
    reportedAt: getRelativeIso(170),
    status: REPORT_STATUS.CURRENT,
    reconfirmationsCount: 8,
    corridorName: 'Ravidas Gate to Assi Ghat link road',
    coordinates: { lat: 25.29, lng: 82.99 },
    notes: 'Ganga tributary backflow causing drain overflow. Pedestrians advised to avoid Assi Ghat lower market road.',
  },

  // 8. Prayagraj - Official Alert - Civil Lines Submerged Road
  {
    id: 'up-fl-008',
    district: 'Prayagraj',
    ward: 'Ward 15 (Civil Lines)',
    locality: 'Nawab Yusuf Road Railway Underpass',
    incidentType: INCIDENT_TYPES.FLOODED_ROAD,
    depthCategory: DEPTH_CATEGORIES.WAIST_DEEP_OR_HIGHER,
    sourceTier: SOURCE_TIERS.OFFICIAL_EMERGENCY_ALERT,
    issuingAuthority: 'District Magistrate Prayagraj Disaster Management Cell',
    officialBulletinRef: 'PRYJ/DDMA-RELIEF/ALERT-03',
    observedAt: getRelativeIso(45),
    reportedAt: getRelativeIso(40),
    status: REPORT_STATUS.CURRENT,
    reconfirmationsCount: 22,
    corridorName: 'Nawab Yusuf Underpass',
    coordinates: { lat: 25.45, lng: 81.84 },
    notes: 'Underpass flooded with over 4 feet of rainwater. Barricaded by civil police. Use MG Marg overbridge instead.',
  },
];
