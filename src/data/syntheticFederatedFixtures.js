/**
 * src/data/syntheticFederatedFixtures.js
 * 100% Synthetic, anonymous civic datasets for federated query demonstrations & testing.
 *
 * PRIVACY INVARIANT:
 * Contains ZERO real citizen names, Aadhaar, PAN, phone numbers, or private addresses.
 * All wards and metrics are synthetic approximations designed to test aggregation,
 * k-anonymity privacy thresholds, and cross-department correlations.
 */

export const SYNTHETIC_WARDS = [
  { id: 1, name: "Ward 1 - Gandhi Nagar", zone: "North" },
  { id: 2, name: "Ward 2 - Subhash Chowk", zone: "North" },
  { id: 3, name: "Ward 3 - Nehru Enclave", zone: "Central" },
  { id: 4, name: "Ward 4 - Patel Nagar", zone: "Central" },
  { id: 5, name: "Ward 5 - Shivaji Park", zone: "South" },
  { id: 6, name: "Ward 6 - Ambedkar Vihar", zone: "South" },
  { id: 7, name: "Ward 7 - Tagore Garden", zone: "East" },
  { id: 8, name: "Ward 8 - Shastri Colony", zone: "West" },
];

/**
 * Synthetic Department 1: Water Supply & Sewerage
 */
export const SYNTHETIC_WATER_DATA = [
  { id: "WS-001", wardId: 1, type: "leakage", severity: "medium", resolved: true, timestamp: "2026-11-20" },
  { id: "WS-002", wardId: 1, type: "low_pressure", severity: "low", resolved: true, timestamp: "2026-11-21" },
  { id: "WS-003", wardId: 1, type: "contamination", severity: "high", resolved: false, timestamp: "2026-11-22" },
  { id: "WS-004", wardId: 1, type: "outage", severity: "critical", resolved: true, timestamp: "2026-11-23" },
  // Ward 2 has a high volume of water incidents
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `WS-02-${i + 1}`,
    wardId: 2,
    type: i % 2 === 0 ? "leakage" : "outage",
    severity: i % 3 === 0 ? "critical" : "medium",
    resolved: i % 2 === 0,
    timestamp: "2026-11-22",
  })),
  // Ward 3 has a low volume (4 incidents) - designed to test k-anonymity threshold suppression (k < 10)
  { id: "WS-03-1", wardId: 3, type: "tanker_request", severity: "medium", resolved: true, timestamp: "2026-11-22" },
  { id: "WS-03-2", wardId: 3, type: "tanker_request", severity: "high", resolved: false, timestamp: "2026-11-23" },
  { id: "WS-03-3", wardId: 3, type: "low_pressure", severity: "low", resolved: true, timestamp: "2026-11-24" },
  { id: "WS-03-4", wardId: 3, type: "outage", severity: "medium", resolved: false, timestamp: "2026-11-24" },
  // Ward 4 normal volume (14 incidents)
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `WS-04-${i + 1}`,
    wardId: 4,
    type: "leakage",
    severity: "low",
    resolved: true,
    timestamp: "2026-11-23",
  })),
  // Ward 5 normal volume (22 incidents)
  ...Array.from({ length: 22 }, (_, i) => ({
    id: `WS-05-${i + 1}`,
    wardId: 5,
    type: "outage",
    severity: "high",
    resolved: i % 2 === 0,
    timestamp: "2026-11-24",
  })),
];

/**
 * Synthetic Department 2: Public Works & Roads
 */
export const SYNTHETIC_ROADS_DATA = [
  // Ward 1 has 12 pothole reports
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `RD-01-${i + 1}`,
    wardId: 1,
    type: "pothole",
    severity: i % 2 === 0 ? "high" : "medium",
    status: i % 2 === 0 ? "repaired" : "open",
    repairCostEstimate: 4500 + i * 200,
    timestamp: "2026-11-21",
  })),
  // Ward 2 has 25 road defects
  ...Array.from({ length: 25 }, (_, i) => ({
    id: `RD-02-${i + 1}`,
    wardId: 2,
    type: i % 3 === 0 ? "pothole" : "uneven_surface",
    severity: "critical",
    status: "in_progress",
    repairCostEstimate: 8000 + i * 150,
    timestamp: "2026-11-22",
  })),
  // Ward 3 has 5 defects (k < 10 test case)
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `RD-03-${i + 1}`,
    wardId: 3,
    type: "missing_signage",
    severity: "low",
    status: "repaired",
    repairCostEstimate: 1200,
    timestamp: "2026-11-23",
  })),
  // Ward 4 has 16 defects
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `RD-04-${i + 1}`,
    wardId: 4,
    type: "street_light_outage",
    severity: "medium",
    status: "open",
    repairCostEstimate: 3000,
    timestamp: "2026-11-24",
  })),
  // Ward 5 has 19 defects
  ...Array.from({ length: 19 }, (_, i) => ({
    id: `RD-05-${i + 1}`,
    wardId: 5,
    type: "pothole",
    severity: "high",
    status: "repaired",
    repairCostEstimate: 6500,
    timestamp: "2026-11-24",
  })),
];

/**
 * Synthetic Department 3: Municipal Health & Sanitation
 */
export const SYNTHETIC_HEALTH_DATA = [
  // Ward 1 has 15 sanitation records
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `HS-01-${i + 1}`,
    wardId: 1,
    type: "garbage_overflow",
    severity: "medium",
    inspectionDone: true,
    timestamp: "2026-11-21",
  })),
  // Ward 2 has 28 records (high sanitation complaints)
  ...Array.from({ length: 28 }, (_, i) => ({
    id: `HS-02-${i + 1}`,
    wardId: 2,
    type: i % 2 === 0 ? "garbage_overflow" : "clogged_drain",
    severity: "high",
    inspectionDone: false,
    timestamp: "2026-11-22",
  })),
  // Ward 3 has 3 records (k < 10 test case)
  { id: "HS-03-1", wardId: 3, type: "pest_fogging_request", severity: "low", inspectionDone: true, timestamp: "2026-11-22" },
  { id: "HS-03-2", wardId: 3, type: "garbage_overflow", severity: "low", inspectionDone: true, timestamp: "2026-11-23" },
  { id: "HS-03-3", wardId: 3, type: "pest_fogging_request", severity: "low", inspectionDone: true, timestamp: "2026-11-24" },
  // Ward 4 has 11 records
  ...Array.from({ length: 11 }, (_, i) => ({
    id: `HS-04-${i + 1}`,
    wardId: 4,
    type: "clogged_drain",
    severity: "medium",
    inspectionDone: true,
    timestamp: "2026-11-24",
  })),
  // Ward 5 has 20 records
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `HS-05-${i + 1}`,
    wardId: 5,
    type: "garbage_overflow",
    severity: "high",
    inspectionDone: i % 2 === 0,
    timestamp: "2026-11-24",
  })),
];

/**
 * Synthetic Department 4: Directorate of Urban Public Transit
 */
export const SYNTHETIC_TRANSIT_DATA = [
  // Ward 1 has 20 transit incidents
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `TR-01-${i + 1}`,
    wardId: 1,
    type: "bus_delay",
    delayMinutes: 12 + (i % 15),
    accessibilityBarrier: i % 4 === 0,
    timestamp: "2026-11-21",
  })),
  // Ward 2 has 35 transit incidents
  ...Array.from({ length: 35 }, (_, i) => ({
    id: `TR-02-${i + 1}`,
    wardId: 2,
    type: i % 2 === 0 ? "bus_delay" : "overcrowded_station",
    delayMinutes: 20 + (i % 25),
    accessibilityBarrier: i % 3 === 0,
    timestamp: "2026-11-22",
  })),
  // Ward 3 has 7 transit incidents (k < 10 test case)
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `TR-03-${i + 1}`,
    wardId: 3,
    type: "bus_delay",
    delayMinutes: 5,
    accessibilityBarrier: false,
    timestamp: "2026-11-23",
  })),
  // Ward 4 has 18 transit incidents
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `TR-04-${i + 1}`,
    wardId: 4,
    type: "stop_shelter_damaged",
    delayMinutes: 8,
    accessibilityBarrier: true,
    timestamp: "2026-11-24",
  })),
  // Ward 5 has 24 transit incidents
  ...Array.from({ length: 24 }, (_, i) => ({
    id: `TR-05-${i + 1}`,
    wardId: 5,
    type: "bus_delay",
    delayMinutes: 15,
    accessibilityBarrier: i % 2 === 0,
    timestamp: "2026-11-24",
  })),
];
