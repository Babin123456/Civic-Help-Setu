/**
 * @file publicParksDirectoryData.js
 * @description Ward-level directory data of verified public parks, gardens, and urban open spaces.
 * Captures accessibility attributes (step-free ramps, tactile paths, wheelchair-accessible toilets),
 * playground amenities, maintenance schedules, and verification metadata.
 */

export const PUBLIC_PARKS_DIRECTORY = [
  {
    id: 'park_ka_blr_001',
    name: 'Cubbon Park (Sri Chamarajendra Park)',
    jurisdictionId: 'IN-KA-BLR',
    wardNumber: 111,
    wardName: 'Shantala Nagar',
    type: 'REGIONAL_PARK',
    address: 'Kasturba Road, Sampangi Rama Nagar, Bengaluru, Karnataka 560001',
    coordinates: { lat: 12.9763, lng: 77.5929 },
    areaAcres: 300,
    timings: {
      open: '06:00',
      close: '19:00',
      trafficFreeHours: '05:00 - 08:00 daily; 24h on Sundays'
    },
    accessibility: {
      stepFreeAccess: true,
      hasWheelchairRamps: true,
      tactilePaving: true,
      accessibleToilets: true,
      reservedAccessibleParking: true
    },
    amenities: [
      'WALKING_TRACK',
      'OPEN_GYM',
      'CHILDRENS_PLAY_AREA',
      'DRINKING_WATER',
      'SEATING_BENCHES',
      'DOG_PARK'
    ],
    maintenanceAuthority: {
      name: 'Department of Horticulture, Government of Karnataka',
      officerContact: 'horticulture-blr@karnataka.gov.in',
      inspectionCycle: 'WEEKLY'
    },
    verification: {
      lastAuditedAt: '2026-03-15T10:00:00Z',
      verifiedBy: 'Civic Accessibility Audit Team',
      status: 'VERIFIED'
    }
  },
  {
    id: 'park_ka_blr_002',
    name: 'Madhavan Park (Ward 143)',
    jurisdictionId: 'IN-KA-BLR',
    wardNumber: 143,
    wardName: 'Jayanagar 1st Block',
    type: 'NEIGHBORHOOD_PARK',
    address: '10th Main Rd, 1st Block, Jayanagar, Bengaluru, Karnataka 560011',
    coordinates: { lat: 12.9392, lng: 77.5873 },
    areaAcres: 4.5,
    timings: {
      open: '05:30',
      close: '10:00',
      eveningOpen: '16:30',
      eveningClose: '20:30'
    },
    accessibility: {
      stepFreeAccess: true,
      hasWheelchairRamps: true,
      tactilePaving: false,
      accessibleToilets: true,
      reservedAccessibleParking: false
    },
    amenities: [
      'WALKING_TRACK',
      'OPEN_GYM',
      'CHILDRENS_PLAY_AREA',
      'SEATING_BENCHES',
      'DRINKING_WATER'
    ],
    maintenanceAuthority: {
      name: 'Bruhat Bengaluru Mahanagara Palike (BBMP) South Zone',
      officerContact: 'ee-south@bbmp.gov.in',
      inspectionCycle: 'BI_WEEKLY'
    },
    verification: {
      lastAuditedAt: '2026-03-20T14:30:00Z',
      verifiedBy: 'Ward 143 Citizen Committee',
      status: 'VERIFIED'
    }
  },
  {
    id: 'park_dl_nd_001',
    name: 'Lodhi Gardens',
    jurisdictionId: 'IN-DL-ND',
    wardNumber: 22,
    wardName: 'Lodhi Colony',
    type: 'HERITAGE_PARK',
    address: 'Lodhi Rd, Lodhi Estate, New Delhi, Delhi 110003',
    coordinates: { lat: 28.5933, lng: 77.2197 },
    areaAcres: 90,
    timings: {
      open: '05:00',
      close: '20:00'
    },
    accessibility: {
      stepFreeAccess: true,
      hasWheelchairRamps: true,
      tactilePaving: true,
      accessibleToilets: true,
      reservedAccessibleParking: true
    },
    amenities: [
      'WALKING_TRACK',
      'SEATING_BENCHES',
      'DRINKING_WATER',
      'HISTORICAL_MONUMENTS',
      'PUBLIC_RESTROOMS'
    ],
    maintenanceAuthority: {
      name: 'New Delhi Municipal Council (NDMC) Horticulture Wing',
      officerContact: 'director-hort@ndmc.gov.in',
      inspectionCycle: 'DAILY'
    },
    verification: {
      lastAuditedAt: '2026-03-18T09:00:00Z',
      verifiedBy: 'NDMC Field Inspectorate',
      status: 'VERIFIED'
    }
  }
];
