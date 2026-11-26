/**
 * src/services/wardIssueHeatmapStorage.js

 * Storage adapter and synthetic civic issue repository for ward analytics (#1163).
 *
 * Provides persistent and in-memory storage of civic reports with
 * deterministic seed generation for tests and demonstration.
 */

import { validateRawCivicReport } from '../data/wardAnalyticsContract';

export const STORAGE_KEY = 'civic_ward_issue_reports_v1';

/**
 * Generates deterministic synthetic complaint reports across municipal wards.
 * Deliberately contains both dense clusters (20-30 reports) and sparse cohorts (1-3 reports)
 * to test sparse-cell suppression.
 */
export const generateDefaultCivicReports = () => {
  const reports = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const categories = [
    'potholes_roads',
    'sanitation_garbage',
    'water_supply',
    'streetlights',
    'drainage_flooding',
    'public_health',
  ];

  const wards = [
    'WARD-101', 'WARD-102', 'WARD-103', 'WARD-104', 'WARD-105',
    'WARD-106', 'WARD-107', 'WARD-108', 'WARD-109', 'WARD-110',
  ];

  let counter = 1000;

  // Distribution matrix configuration
  wards.forEach((ward, wIdx) => {
    categories.forEach((cat, cIdx) => {
      // Deterministic pseudo-count: some high, some medium, some sparse (< 5)
      let count;
      if (wIdx % 3 === 0 && cIdx % 2 === 0) {
        count = 18 + (wIdx * 2); // Dense cell
      } else if (wIdx % 2 === 1 && cIdx % 3 === 1) {
        count = 8 + cIdx; // Medium cell
      } else if ((wIdx + cIdx) % 4 === 0) {
        count = 2; // Sparse cell (< 5, should be suppressed)
      } else if ((wIdx + cIdx) % 5 === 0) {
        count = 1; // Extremely sparse cell
      } else {
        count = 6; // Just above threshold
      }

      for (let i = 0; i < count; i++) {
        counter++;
        // Distribute timestamp within the last 60 days
        const daysAgo = (i * 3 + wIdx + cIdx) % 60;
        const timestamp = new Date(now - (daysAgo * dayMs) - (i * 3600000)).toISOString();

        reports.push({
          id: `RPT-${counter}`,
          wardId: ward,
          category: cat,
          timestamp,
          status: i % 2 === 0 ? 'resolved' : 'in_progress',
        });
      }
    });
  });

  return reports;
};

let memoryStore = null;

/**
 * Retrieves all stored civic reports, initializing with synthetic seeds if empty.
 */
export const getCivicReports = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  if (!memoryStore) {
    memoryStore = generateDefaultCivicReports();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
      } catch {
        // Storage write fail
      }
    }
  }

  return [...memoryStore];
};

/**
 * Appends a new validated civic report.
 */
export const saveCivicReport = (report) => {
  const validation = validateRawCivicReport(report);
  if (!validation.valid) {
    throw new Error(`Invalid report: ${validation.errors.join(', ')}`);
  }

  const reports = getCivicReports();
  reports.push(report);
  memoryStore = reports;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    } catch {
      // Storage write fail
    }
  }

  return report;
};

/**
 * Resets storage to default synthetic dataset.
 */
export const resetCivicReports = (customReports = null) => {
  memoryStore = customReports ? [...customReports] : generateDefaultCivicReports();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
    } catch {
      // Storage write fail
    }
  }
  return [...memoryStore];
};

/**
 * Filters a report list by rolling time window ('7d', '14d', '30d', '90d').
 */
export const filterReportsByWindow = (reports = [], windowStr = '30d') => {
  const windowDays = parseInt(windowStr, 10) || 30;
  const cutoffTime = Date.now() - (windowDays * 24 * 60 * 60 * 1000);

  return reports.filter((rpt) => {
    const reportTime = new Date(rpt.timestamp).getTime();
    return !Number.isNaN(reportTime) && reportTime >= cutoffTime;
  });

/**
 * Persistence, initial bootstrap seeding, migrations, and rollback support
 * for Anonymized Ward-Level Civic Issue Heatmap and Trend Explorer (#763).
 */

import {
  SCHEMA_VERSION,
  MUNICIPAL_WARDS,
  DEFAULT_PRIVACY_RULES,
  TIME_WINDOWS,
  EVENT_STATUSES,
  RECOMMENDATION_STATUSES,
} from '../data/wardIssueHeatmapContract.js';

export const WARD_HEATMAP_STORAGE_KEYS = {
  EVENTS: 'civicbridge_ward_issue_events_v1',
  GEOMETRIES: 'civicbridge_ward_geometries_v1',
  METRICS: 'civicbridge_ward_metrics_v1',
  AGGREGATION_RUNS: 'civicbridge_aggregation_runs_v1',
  PRIVACY_RULES: 'civicbridge_privacy_rules_v1',
  RECOMMENDATIONS: 'civicbridge_ward_recommendations_v1',
  AUDIT_LOGS: 'civicbridge_ward_issue_audit_logs_v1',
  RATE_LIMIT: 'civicbridge_ward_issue_rate_limit_v1',
  MIGRATION_BACKUP: 'civicbridge_ward_heatmap_migration_backup_v1',
};

const getStorageInstance = (custom) => {
  if (custom) return custom;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  const memory = new Map();
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
    clear: () => memory.clear(),
  };
};

export const readStore = (key, defaultValue, storage) => {
  const store = getStorageInstance(storage);
  try {
    const raw = store.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
};

export const writeStore = (key, value, storage) => {
  const store = getStorageInstance(storage);
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/**
 * Generates initial realistic historical events over the past 90 days.
 * Includes both high-density clusters and sparse cohorts (< 5 events)
 * to demonstrate small-cell privacy suppression.
 */
export const buildInitialSeedEvents = () => {
  const now = new Date('2026-11-15T12:00:00.000Z').getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const events = [];

  const addCluster = (wardId, category, count, severity, daysBackRange, source = 'citizen_portal') => {
    for (let i = 0; i < count; i += 1) {
      const daysAgo = Math.floor(daysBackRange[0] + Math.random() * (daysBackRange[1] - daysBackRange[0]));
      const timestamp = new Date(now - daysAgo * DAY_MS - i * 1300000).toISOString();
      const ward = MUNICIPAL_WARDS.find((w) => w.id === wardId);
      events.push({
        id: `EVT-${wardId.replace('ward-', '')}-${category.slice(0, 4).toUpperCase()}-${1000 + events.length}`,
        wardId,
        wardName: ward?.name || 'Indiranagar',
        zone: ward?.zone || 'East Zone',
        category,
        severity,
        status: i % 3 === 0 ? EVENT_STATUSES.RESOLVED : i % 2 === 0 ? EVENT_STATUSES.IN_PROGRESS : EVENT_STATUSES.VERIFIED,
        source,
        coarseLocation: `${ward?.name} Sector Area Block ${1 + (i % 5)}`,
        approximateCoords: ward?.center || [12.9784, 77.6408],
        reporterIdHash: `ANON-${((i * 997 + 101) % 9000 + 1000).toString(16).toUpperCase()}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        schemaVersion: SCHEMA_VERSION,
      });
    }
  };

  // High density: Bellandur Drainage & Waterlogging (Monsoon surge)
  addCluster('ward-150', 'drainage_waterlogging', 38, 'high', [1, 30]);
  addCluster('ward-150', 'drainage_waterlogging', 14, 'high', [31, 90]);

  // High density: Indiranagar Potholes & Road Damage
  addCluster('ward-101', 'potholes_road_damage', 26, 'medium', [1, 30]);
  addCluster('ward-101', 'potholes_road_damage', 18, 'medium', [31, 90]);

  // High density: Koramangala Garbage & Solid Waste
  addCluster('ward-102', 'garbage_solid_waste', 22, 'medium', [1, 30]);
  addCluster('ward-102', 'garbage_solid_waste', 19, 'medium', [31, 90]);

  // Medium density: HSR Layout Street Lighting & Electrical
  addCluster('ward-174', 'street_lighting_electrical', 16, 'low', [1, 30]);
  addCluster('ward-174', 'street_lighting_electrical', 12, 'low', [31, 90]);

  // Medium density: Whitefield Water Supply Leakage
  addCluster('ward-85', 'water_supply_leakage', 18, 'high', [1, 30]);
  addCluster('ward-85', 'water_supply_leakage', 15, 'high', [31, 90]);

  // Medium density: Jayanagar Potholes
  addCluster('ward-112', 'potholes_road_damage', 14, 'medium', [1, 30]);

  // Sparse cohorts (< 5 events) for small-cell privacy suppression testing:
  // Malleshwaram Sewage: only 2 events in last 30 days
  addCluster('ward-72', 'sewage_overflow', 2, 'critical', [2, 20]);

  // RR Nagar Tree Hazard: only 1 event in last 30 days
  addCluster('ward-198', 'tree_greenery_hazard', 1, 'medium', [5, 15]);

  // Hebbal Unauthorized Encroachment: only 3 events in last 30 days
  addCluster('ward-45', 'unauthorized_encroachment', 3, 'low', [10, 25]);

  // BTM Layout Drainage: only 2 events
  addCluster('ward-160', 'drainage_waterlogging', 2, 'high', [4, 18]);

  return events;
};

export const buildInitialRecommendations = () => [
  {
    id: 'REC-2026-001',
    wardId: 'ward-150',
    wardName: 'Bellandur',
    category: 'drainage_waterlogging',
    urgency: 'urgent',
    title: 'Preemptive Monsoon Stormwater Desilting & Culvert Clearing',
    recommendation: 'Deploy municipal mechanical desilting jetting units along primary arterial culverts before expected rainfall window. Coordinate with Ward Committee for designated disposal.',
    whyProduced: 'Drainage waterlogging reports increased by 48% over the preceding 30-day baseline in Ward 150 (Bellandur), reaching 38 validated events.',
    influencedBy: ['30d_waterlogging_spike_48%', 'culvert_density_v1', 'repeat_cluster_flag'],
    rulesetVersion: 'v1.0.0-k5',
    inputFeatureWindow: 'last_30_days',
    createdAt: '2026-11-14T08:30:00.000Z',
    status: RECOMMENDATION_STATUSES.PENDING,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
  },
  {
    id: 'REC-2026-002',
    wardId: 'ward-101',
    wardName: 'Indiranagar',
    category: 'potholes_road_damage',
    urgency: 'elevated',
    title: 'Coordinated Rapid Cold-Mix Asphalt Patching Program',
    recommendation: 'Issue work bundle for 26 reported road depressions on 100-Feet Road and 12th Main before weekend peak commuter traffic.',
    whyProduced: 'Pothole reports consistently exceed ward baseline threshold by 24% with multiple reports on commercial corridors.',
    influencedBy: ['30d_pothole_volume_26', 'traffic_corridor_weight'],
    rulesetVersion: 'v1.0.0-k5',
    inputFeatureWindow: 'last_30_days',
    createdAt: '2026-11-13T14:15:00.000Z',
    status: RECOMMENDATION_STATUSES.ACCEPTED,
    reviewedBy: 'Executive Engineer (East Zone)',
    reviewedAt: '2026-11-14T10:00:00.000Z',
    reviewNotes: 'Approved for night-shift road rehabilitation tender bundle.',
  },
];

export const buildInitialAggregationRuns = () => [
  {
    runId: 'RUN-2026-11-15-01',
    timestamp: '2026-11-15T06:00:00.000Z',
    timeWindow: TIME_WINDOWS.LAST_30_DAYS,
    inputEventCount: 182,
    publishedMetricCount: 80,
    suppressedCohortCount: 14,
    rulesetVersion: 'v1.0.0-k5',
    differentialPrivacyEpsilon: 1.0,
    minCohortThreshold: 5,
    executedBy: 'scheduler_service',
    status: 'completed',
  },
];

export const initializeWardHeatmapSeedData = (storage, force = false) => {
  const store = getStorageInstance(storage);
  const existingEvents = store.getItem(WARD_HEATMAP_STORAGE_KEYS.EVENTS);
  if (existingEvents && !force) {
    return false;
  }

  const events = buildInitialSeedEvents();
  const privacyRules = { ...DEFAULT_PRIVACY_RULES };
  const recommendations = buildInitialRecommendations();
  const aggregationRuns = buildInitialAggregationRuns();

  writeStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, events, store);
  writeStore(WARD_HEATMAP_STORAGE_KEYS.GEOMETRIES, MUNICIPAL_WARDS, store);
  writeStore(WARD_HEATMAP_STORAGE_KEYS.PRIVACY_RULES, privacyRules, store);
  writeStore(WARD_HEATMAP_STORAGE_KEYS.RECOMMENDATIONS, recommendations, store);
  writeStore(WARD_HEATMAP_STORAGE_KEYS.AGGREGATION_RUNS, aggregationRuns, store);
  writeStore(WARD_HEATMAP_STORAGE_KEYS.AUDIT_LOGS, [
    {
      id: 'AUD-001',
      action: 'SYSTEM_BOOTSTRAP',
      details: 'Initialized anonymized ward issue heatmap storage and seed events.',
      actor: 'system',
      timestamp: '2026-11-15T00:00:00.000Z',
    },
  ], store);

  return true;
};

export const resetWardIssueHeatmapData = (storage) => {
  const store = getStorageInstance(storage);
  Object.values(WARD_HEATMAP_STORAGE_KEYS).forEach((k) => store.removeItem(k));
  initializeWardHeatmapSeedData(storage, true);
};

export const migrateStorage = (storage) => {
  const store = getStorageInstance(storage);
  const events = readStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, [], store);

  // Backup existing data before mutating
  const backup = {
    events,
    privacyRules: readStore(WARD_HEATMAP_STORAGE_KEYS.PRIVACY_RULES, null, store),
    timestamp: new Date().toISOString(),
  };
  writeStore(WARD_HEATMAP_STORAGE_KEYS.MIGRATION_BACKUP, backup, store);

  let migratedCount = 0;
  const migratedEvents = events.map((evt) => {
    let changed = false;
    const clean = { ...evt };
    if (!clean.schemaVersion || clean.schemaVersion !== SCHEMA_VERSION) {
      clean.schemaVersion = SCHEMA_VERSION;
      changed = true;
    }
    if (!clean.coarseLocation) {
      clean.coarseLocation = 'Ward General Sector';
      changed = true;
    }
    if (changed) migratedCount += 1;
    return clean;
  });

  writeStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, migratedEvents, store);
  return { success: true, migratedCount, total: events.length };
};

export const rollbackStorage = (storage) => {
  const store = getStorageInstance(storage);
  const backup = readStore(WARD_HEATMAP_STORAGE_KEYS.MIGRATION_BACKUP, null, store);
  if (!backup || !Array.isArray(backup.events)) {
    return { success: false, reason: 'No valid migration backup found' };
  }
  writeStore(WARD_HEATMAP_STORAGE_KEYS.EVENTS, backup.events, store);
  if (backup.privacyRules) {
    writeStore(WARD_HEATMAP_STORAGE_KEYS.PRIVACY_RULES, backup.privacyRules, store);
  }
  return { success: true, restoredCount: backup.events.length, backupTimestamp: backup.timestamp };

};
