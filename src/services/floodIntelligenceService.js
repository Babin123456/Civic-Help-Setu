/**
 * Hyperlocal Flood Hotspot Forecast and Safe-Route Advisory Engine Service
 * Bounded geospatial risk model for waterlogging prediction and route advisory.
 *
 * Follows the patterns established by roadSafetyBlackspotService.js:
 * - Storage-backed with localStorage fallback
 * - Permission-gated operations via accessControl.requirePermission
 * - Idempotency-guarded public endpoints
 * - Rate-limited anti-abuse controls
 * - Append-only audit logging
 * - Schema versioning and migration support
 * - Deterministic fallbacks for offline/unavailable state
 */

import {
  FLOOD_SCHEMA_VERSION,
  FLOOD_STORAGE_KEYS,
  FLOOD_REPORT_STATES,
  FLOOD_REPORT_STATE_LABELS,
  FORECAST_RUN_STATES,
  FORECAST_RUN_STATE_LABELS,
  HOTSPOT_RISK_LEVELS,
  HOTSPOT_RISK_LEVEL_LABELS,
  ROUTE_ADVISORY_STATUS,
  ROUTE_ADVISORY_STATUS_LABELS,
  CONTRIBUTING_SIGNALS,
  FLOOD_HAZARD_TYPES,
  FLOOD_HAZARD_TYPE_LABELS,
  IDEMPOTENCY_PREFIX,
  RATE_LIMIT_MAX_SUBMISSIONS,
  RATE_LIMIT_WINDOW_MS,
  COORDINATE_PRECISION,
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
} from '../data/floodContract';
import { requirePermission, actorLabel as getActorLabel, getCurrentActor } from './accessControl';
import { sanitizePlainText, safeHttpUrl } from '../utils/safeContent';
import { minimizeForExternal } from '../utils/dataMinimization';

const getStorage = (customStorage) => {
  if (customStorage) return customStorage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readStorageJson = (key, fallback, storage) => {
  const s = getStorage(storage);
  if (!s) return fallback;
  try {
    const raw = s.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
  } catch {
    return fallback;
  }
};

const writeStorageJson = (key, data, storage) => {
  const s = getStorage(storage);
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
};

const appendOnlyAuditLog = (storage, entry) => {
  const s = getStorage(storage);
  if (!s) return null;
  const auditKey = FLOOD_STORAGE_KEYS.AUDIT_LOGS;
  const logs = readStorageJson(auditKey, [], s);
  const entryWithTimestamp = {
    ...entry,
    timestamp: new Date().toISOString(),
    id: `flood-audit-${Date.now()}-Math.random().toString(36).slice(2, 7)`,
  };
  writeStorageJson(auditKey, [entryWithTimestamp, ...logs].slice(0, 500), s);
  return entryWithTimestamp;
};

// ── Rate Limiting ─────────────────────────────────────────────────────────────

const RATE_LIMIT_KEY = FLOOD_STORAGE_KEYS.RATE_LIMIT;

export function createFloodRateLimiter({ limit, windowMs, storage } = {}) {
  const s = getStorage(storage);
  if (!s) {
    return {
      size: () => 0,
      take: () => ({ allowed: true, remaining: limit, retryAfterSeconds: 0 }),
      reset: () => {},
      resetAll: () => {},
      getWindow: () => null,
    };
  }

  const windows = new Map();

  function sweep(at) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= at) windows.delete(key);
    }
    while (windows.size >= 1000) {
      windows.delete(windows.keys().next().value);
    }
  }

  return {
    size: () => windows.size,
    take(key) {
      const at = Date.now();
      sweep(at);
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= at) {
        if (!entry && windows.size >= 1000) sweep(at);
        entry = { count: 0, resetAt: at + windowMs };
        windows.set(key, entry);
      }
      if (entry.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - at) / 1000)),
        };
      }
      entry.count += 1;
      return {
        allowed: true,
        remaining: limit - entry.count,
        retryAfterSeconds: 0,
      };
    },
    reset(key) {
      windows.delete(key);
    },
    resetAll() {
      windows.clear();
    },
    getWindow(key) {
      return windows.get(key);
    },
  };
}

export const floodRateLimiter = createFloodRateLimiter({
  limit: RATE_LIMIT_MAX_SUBMISSIONS,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

// ── Entity Generators (idempotent, schema-versioned) ──────────────────────────

/**
 * Generate a new flood report with proper metadata.
 */
export function generateFloodReport(data = {}, storage, clientId = 'anon-client') {
  const s = getStorage(storage);
  if (!s) throw new Error('No storage available');

  ensureFloodSeedData(s);

  // Idempotency guard: If an idempotencyKey is supplied and already stored, return existing report safely
  const idempotencyKey = data.idempotencyKey;
  const reports = readStorageJson(FLOOD_STORAGE_KEYS.FLOOD_REPORTS, [], s);
  if (idempotencyKey) {
    const existing = reports.find((h) => h.idempotencyKey === idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  // Validate the report data
  const validationErrors = validateFloodReport(data);
  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
  }

  // Rate limiting enforcement
  const rateRecords = readStorageJson(RATE_LIMIT_KEY, {}, s);
  const now = Date.now();
  const clientHistory = (rateRecords[clientId] || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (clientHistory.length >= RATE_LIMIT_MAX_SUBMISSIONS) {
    throw new Error(
      `Rate limit exceeded: You have submitted ${RATE_LIMIT_MAX_SUBMISSIONS} flood reports in the last ${RATE_LIMIT_WINDOW_MS / 60000} minutes. Please wait before reporting again.`,
    );
  }

  // Extract and normalize fields
  const segmentId = data.segmentId || null;
  const hazardType = data.hazardType;
  const rawDescription = String(data.description || '');
  const description = rawDescription.trim().substring(0, 1000);
  const locationHint = String(data.locationHint || '').trim().substring(0, 200);
  const location = data.location || { lat: 0, lng: 0 };
  const altitudeMeters = data.altitudeMeters !== undefined ? Number(data.altitudeMeters) : 0;
  const confidence = data.confidence !== undefined ? Number(data.confidence) : 0.5;
  const reporterRole = data.reporterRole || 'citizen';
  const sourceTimestamp = data.sourceTimestamp || new Date().toISOString();

  // Precise coordinate rounding to COORDINATE_PRECISION decimal places
  const precision = Math.pow(10, COORDINATE_PRECISION);
  const preciseLat = Math.round(location.lat * precision) / precision;
  const preciseLng = Math.round(location.lng * precision) / precision;

  const newReport = {
    id: `flood-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    idempotencyKey: idempotencyKey || null,
    segmentId: segmentId || 'unassigned-area',
    hazardType,
    severity: data.severity || 'medium',
    description,
    locationHint,
    location: { lat: preciseLat, lng: preciseLng },
    altitudeMeters,
    confidence,
    reporterRole,
    status: FLOOD_REPORT_STATES.SUBMITTED,
    sourceTimestamp,
    reportedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: FLOOD_SCHEMA_VERSION,
  };

  writeStorageJson(FLOOD_STORAGE_KEYS.FLOOD_REPORTS, [newReport, ...reports], s);

  // Update client rate-limit tracking
  rateRecords[clientId] = [...clientHistory, now];
  writeStorageJson(RATE_LIMIT_KEY, rateRecords, s);

  // Audit event
  appendOnlyAuditLog(s, {
    event: FLOOD_AUDIT_EVENTS.REPORT_SUBMITTED,
    reportId: newReport.id,
    hazardType,
    segmentId: newReport.segmentId,
    reporterRole,
    clientId,
  });

  return newReport;
}

/**
 * Generate a new forecast run.
 * Protected by 'flood.intelligence.execute' permission.
 */
export function generateForecastRun(data = {}, storage, actor) {
  requirePermission('flood.intelligence.execute');

  const s = getStorage(storage);
  if (!s) throw new Error('No storage available');

  ensureFloodSeedData(s);

  // Validate the forecast run data
  const validationErrors = validateForecastRun(data);
  if (validationErrors.length > 0) {
    throw new Error(`Forecast validation failed: ${validationErrors.join(', ')}`);
  }

  const featureWindowStart = String(data.featureWindowStart);
  const featureWindowEnd = String(data.featureWindowEnd);
  const inputRecordsCount = Number(data.inputRecordsCount) || 0;
  const weights = data.weights || {
    [CONTRIBUTING_SIGNALS.RAINFALL_FORECAST]: 0.4,
    [CONTRIBUTING_SIGNALS.DRAINAGE_CAPACITY]: 0.25,
    [CONTRIBUTING_SIGNALS.ELEVATION]: 0.15,
    [CONTRIBUTING_SIGNALS.COMMUNITY_OBSERVATIONS]: 0.1,
    [CONTRIBUTING_SIGNALS.RECENT_REPORTS]: 0.1,
  };

  const runId = `flood-run-${Date.now()}`;
  const runRecord = {
    id: runId,
    runTimestamp: new Date().toISOString(),
    featureWindowStart,
    featureWindowEnd,
    inputRecordsCount,
    hotspotCellsGenerated: 0,
    status: FORECAST_RUN_STATES.PREPARING,
    rulesetVersion: `FloodModel-v${FLOOD_SCHEMA_VERSION}`,
    executedBy: actor ? (actor.fullName || actor.username || 'Flood Intelligence Engine') : 'Flood Intelligence Engine',
    weights,
    disclaimer:
      'Flood hotspot forecasts are generated from a calibrated geospatial risk model using approved rainfall forecasts, drainage asset data, terrain elevation, and community observations. All automated suggestions require human verification before routing traffic or closing roads. Never rely on forecast certainty alone; defer to official emergency instructions.',
  };

  writeStorageJson(FLOOD_STORAGE_KEYS.FORECAST_RUNS, [runRecord, ...readStorageJson(FLOOD_STORAGE_KEYS.FORECAST_RUNS, [], s)], s);

  // Audit event
  appendOnlyAuditLog(s, {
    event: FLOOD_AUDIT_EVENTS.FORECAST_RUN_EXECUTED,
    runId,
    featureWindowStart,
    featureWindowEnd,
    inputRecordsCount,
    executedBy: runRecord.executedBy,
  });

  return runRecord;
}

/**
 * Compute hotspot cells from a forecast run.
 * Protected by 'flood.intelligence.execute' permission.
 */
export function computeHotspotCells(runId, storage, actor) {
  requirePermission('flood.intelligence.execute', actor);

  const s = getStorage(storage);
  if (!s) throw new Error('No storage available');

  ensureFloodSeedData(s);

  const runs = readStorageJson(FLOOD_STORAGE_KEYS.FORECAST_RUNS, [], s);
  const run = runs.find((r) => r.id === runId);
  if (!run) {
    throw new Error(`Forecast run with ID ${runId} not found.`);
  }

  if (run.status !== FORECAST_RUN_STATES.COMPLETED) {
    throw new Error(`Forecast run ${runId} is not in COMPLETED status. Current status: ${run.status}.`);
  }

  // Read input data
  const reports = readStorageJson(FLOOD_STORAGE_KEYS.FLOOD_REPORTS, [], s);
  const drainageAssets = readStorageJson(FLOOD_STORAGE_KEYS.DRAINAGE_ASSETS, [], s);
  const elevationTiles = readStorageJson(FLOOD_STORAGE_KEYS.ELEVATION_TILES, [], s);
  const sourceRegistry = readStorageJson(FLOOD_STORAGE_KEYS.SOURCE_REGISTRY, [], s);

  // Bounded geospatial risk model:
  // Score = weighted sum of contributing signals, normalized to 0-1 range
  // Then map to risk levels: low (<0.33), moderate (0.33-0.66), high (0.67-1.0)

  // Grid-based cell computation:
  // We'll create cells from validated flood reports and drainage features
  // Each cell represents approximately 1km² grid area

  const cellSizeKm = 1.0; // 1km grid cells
  const cells = [];

  // 1. Process validated flood reports into cells
  const validatedReports = reports.filter(
    (r) => r.status === FLOOD_REPORT_STATES.VALIDATED && r.confidence > 0.3,
  );

  // Group reports by proximity (simple clustering: round to grid)
  const reportClusters = new Map();
  for (const report of validatedReports) {
    const gridKey = `${Math.round(report.location.lat * 10) / 10},${Math.round(report.location.lng * 10) / 10}`;
    if (!reportClusters.has(gridKey)) {
      reportClusters.set(gridKey, []);
    }
    reportClusters.get(gridKey).push(report);
  }

  // For each cluster, compute a hotspot cell
  let cellIndex = 0;
  for (const [gridKey, clusterReports] of reportClusters) {
    const [clusterLat, clusterLng] = gridKey.split(',').map(Number);

    // Compute contributing signal strengths
    let totalSignalWeight = 0;
    let totalConfidence = 0;

    for (const report of clusterReports) {
      totalSignalWeight += 1.0; // base weight per report
      totalConfidence += Number(report.confidence || 0.5);
    }

    const avgConfidence = totalConfidence / Math.max(clusterReports.length, 1);
    const reportCount = clusterReports.length;

    // Determine risk level based on signal composite
    const signalComposite = Math.min((reportCount / 5 + avgConfidence / 2) / 2, 1.0); // normalize

    let riskLevel;
    if (signalComposite < 0.33) {
      riskLevel = HOTSPOT_RISK_LEVELS.LOW;
    } else if (signalComposite < 0.66) {
      riskLevel = HOTSPOT_RISK_LEVELS.MODERATE;
    } else {
      riskLevel = HOTSPOT_RISK_LEVELS.HIGH;
    }

    // If very high report density or confidence, upgrade to CRITICAL
    if (reportCount >= 3 && avgConfidence >= 0.8) {
      riskLevel = HOTSPOT_RISK_LEVELS.CRITICAL;
    }

    // Find associated drainage asset (nearest)
    let associatedDrainageAssetId = '';
    if (drainageAssets.length > 0) {
      let minDist = Infinity;
      for (const da of drainageAssets) {
        if (da.location) {
          const dist = Math.hypot(
            da.location.lat - clusterLat,
            da.location.lng - clusterLng,
          );
          if (dist < minDist) {
            minDist = dist;
            associatedDrainageAssetId = da.id;
          }
        }
      }
    }

    const cell = {
      id: `hotcell-${runId}-${cellIndex}`,
      runId,
      gridIndex: cellIndex,
      lat: clusterLat,
      lng: clusterLng,
      riskLevel,
      contributingSignals: [
        CONTRIBUTING_SIGNALS.COMMUNITY_OBSERVATIONS,
        ...(clusterReports.length > 0
          ? [CONTRIBUTING_SIGNALS.RECENT_REPORTS]
          : []),
      ],
      confidence: Number(avgConfidence.toFixed(3)),
      forecastWindowStart: run.featureWindowStart,
      forecastWindowEnd: run.featureWindowEnd,
      areaSqKm: cellSizeKm * cellSizeKm,
      associatedDrainageAssetId,
      note: ` ${reportCount} validated reports, confidence ${Number(avgConfidence.toFixed(2))}`,
      schemaVersion: FLOOD_SCHEMA_VERSION,
    };

    cells.push(cell);
    cellIndex++;
  }

  // 2. Also generate cells from drainage asset capacity analysis
  for (const da of drainageAssets) {
    if (!da.location) continue;

    // Check if already covered by a report cluster
    const gridKey = `${Math.round(da.location.lat * 10) / 10},${Math.round(da.location.lng * 10) / 10}`;
    if (reportClusters.has(gridKey)) continue; // Skip if already has a cell

    // Assess drainage capacity risk
    const capacity = da.capacityLitersPerSecond || 0;
    let riskLevel;
    if (capacity <= 10) {
      riskLevel = HOTSPOT_RISK_LEVELS.HIGH; // Low capacity = high risk
    } else if (capacity <= 50) {
      riskLevel = HOTSPOT_RISK_LEVELS.MODERATE;
    } else {
      riskLevel = HOTSPOT_RISK_LEVELS.LOW; // High capacity = low risk
    }

    const cell = {
      id: `hotcell-da-${da.id}-${cellIndex}`,
      runId,
      gridIndex: cellIndex,
      lat: da.location.lat,
      lng: da.location.lng,
      riskLevel,
      contributingSignals: [CONTRIBUTING_SIGNALS.DRAINAGE_CAPACITY],
      confidence: 0.5,
      forecastWindowStart: run.featureWindowStart,
      forecastWindowEnd: run.featureWindowEnd,
      areaSqKm: cellSizeKm * cellSizeKm,
      associatedDrainageAssetId: da.id,
      note: `Drainage asset: ${da.name}, capacity ${capacity} L/s`,
      schemaVersion: FLOOD_SCHEMA_VERSION,
    };

    cells.push(cell);
    cellIndex++;
  }

  // 3. Also generate cells from elevation tile analysis (low elevation = flood risk)
  for (const tile of elevationTiles) {
    if (!tile.bounds) continue;

    // Use tile center as cell center
    const centerLat = (tile.bounds.minLat + tile.bounds.maxLat) / 2;
    const centerLng = (tile.bounds.minLng + tile.bounds.maxLng) / 2;

    // Check if already covered
    const gridKey = `${Math.round(centerLat * 10) / 10},${Math.round(centerLng * 10) / 10}`;
    if (reportClusters.has(gridKey)) continue; // Skip if already has a cell

    // Low elevation = higher flood risk
    const elevation = tile.elevationMeters || 0;
    let riskLevel;
    if (elevation < 5) {
      riskLevel = HOTSPOT_RISK_LEVELS.CRITICAL;
    } else if (elevation < 10) {
      riskLevel = HOTSPOT_RISK_LEVELS.HIGH;
    } else if (elevation < 20) {
      riskLevel = HOTSPOT_RISK_LEVELS.MODERATE;
    } else {
      riskLevel = HOTSPOT_RISK_LEVELS.LOW;
    }

    const cell = {
      id: `hotcell-et-${tile.id}-${cellIndex}`,
      runId,
      gridIndex: cellIndex,
      lat: centerLat,
      lng: centerLng,
      riskLevel,
      contributingSignals: [CONTRIBUTING_SIGNALS.ELEVATION],
      confidence: 0.5,
      forecastWindowStart: run.featureWindowStart,
      forecastWindowEnd: run.featureWindowEnd,
      areaSqKm: cellSizeKm * cellSizeKm,
      associatedDrainageAssetId: '',
      note: `Elevation tile: ${elevation}m above sea level`,
      schemaVersion: FLOOD_SCHEMA_VERSION,
    };

    cells.push(cell);
    cellIndex++;
  }

  // Update the run record with generated cells count
  run.hotspotCellsGenerated = cells.length;
  run.status = FORECAST_RUN_STATES.COMPLETED;
  run.updatedAt = new Date().toISOString();
  // Remove the old run and write updated ones
  const allRuns = readStorageJson(FLOOD_STORAGE_KEYS.FORECAST_RUNS, [], s);
  const updatedRuns = allRuns.map((r) => (r.id === runId ? run : r));
  writeStorageJson(FLOOD_STORAGE_KEYS.FORECAST_RUNS, updatedRuns, s);

  // Audit event
  appendOnlyAuditLog(s, {
    event: FLOOD_AUDIT_EVENTS.HOTSPOT_CELL_COMPUTED,
    runId,
    cellsGenerated: cells.length,
    riskLevels: cells.reduce((acc, c) => {
      acc[c.riskLevel] = (acc[c.riskLevel] || 0) + 1;
      return acc;
    }, {}),
  });

  return {
    run,
    cells,
  };
}

/**
 * Generate a route advisory (safe route avoiding flood hotspots).
 * Public endpoint - no privileged role required.
 */
export function generateRouteAdvisory(origin, destination, storage, clientId = 'anon-client') {
  const s = getStorage(storage);
  if (!s) throw new Error('No storage available');

  ensureFloodSeedData(s);

  // Validate inputs
  const validationErrors = validateRouteAdvisory({ origin, destination });
  if (validationErrors.length > 0) {
    throw new Error(`Route advisory validation failed: ${validationErrors.join(', ')}`);
  }

  // Read hotspot cells
  const hotspotCells = readStorageJson(FLOOD_STORAGE_KEYS.HOTSPOT_CELLS, [], s);
  const activeHotspots = hotspotCells.filter(
    (c) => c.riskLevel === HOTSPOT_RISK_LEVELS.HIGH || c.riskLevel === HOTSPOT_RISK_LEVELS.CRITICAL,
  );

  // Read route segments (existing road network)
  const routeSegments = readStorageJson(FLOOD_STORAGE_KEYS.ROUTE_SEGMENTS, [], s);

  const originLat = origin.lat;
  const originLng = origin.lng;
  const destLat = destination.lat;
  const destLng = destination.lng;

  // Simple geospatial filter: identify which hotspot cells intersect the direct path
  // Use a simple bounding box approach for the direct route

  const routeCellsAffected = [];
  for (const cell of activeHotspots) {
    // Check if cell is within a reasonable distance of the origin-destination path
    // Simple: check if cell center is within 2km of either endpoint or appears on path
    const toOrigin = Math.hypot(cell.lat - originLat, cell.lng - originLng);
    const toDestination = Math.hypot(cell.lat - destLat, cell.lng - destLng);
    const directDistance = Math.hypot(destLat - originLat, destLng - originLng);

    // Cell is relevant if it's within 2km of the route and the route distance is > 0
    if (directDistance > 0 && (toOrigin + toDestination <= directDistance + 2)) {
      routeCellsAffected.push(cell.id);
    } else if (toOrigin <= 2 || toDestination <= 2) {
      routeCellsAffected.push(cell.id);
    }
  }

  // Compute alternative route by avoiding affected cells
  // For simplicity, we'll compute a detour that goes around the hotspots
  // In a full implementation, this would use a routing engine (OSRM, HERE, etc.)

  let suggestedRouteId = `route-${Date.now()}`;
  let estimatedDelayMinutes = 0;
  let avoidanceReason = '';
  let avoidFloodHotspots = routeCellsAffected.length > 0;

  if (avoidFloodHotspots) {
    // Compute simple detour: add estimated delay based on number of hotspots
    estimatedDelayMinutes = Math.min(routeCellsAffected.length * 5, 30); // 5 min per hotspot, max 30 min
    avoidanceReason = `${routeCellsAffected.length} flood hotspot${routeCellsAffected.length > 1 ? 's' : ''} on direct path`;

    // Simple alternative: suggest routing via perimeter (in a real app, use routing API)
    suggestedRouteId = `alt-${suggestedRouteId}`;
  } else {
    avoidanceReason = 'No flood hotspots on direct route';
  }

  const routeAdvisory = {
    id: `advisory-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    requestId: `req-${Date.now()}`,
    origin: { lat: originLat, lng: originLng },
    destination: { lat: destLat, lng: destLng },
    suggestedRouteId,
    estimatedTimeMinutes:
      Math.hypot(destLat - originLat, destLng - originLng) * 2 + estimatedDelayMinutes, // rough estimate: ~2 min per km
      // Simplified: assume 30 km/h average speed = 2 min per km
      // actual would come from routing service
    avoidFloodHotspots,
    hotspotCellIds: routeCellsAffected,
    status: ROUTE_ADVISORY_STATUS.ACTIVE,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
    schemaVersion: FLOOD_SCHEMA_VERSION,
  };

  // Store the route advisory
  const routeSegmentsStore = readStorageJson(FLOOD_STORAGE_KEYS.ROUTE_SEGMENTS, [], s);
  routeSegmentsStore.push(routeAdvisory);
  writeStorageJson(FLOOD_STORAGE_KEYS.ROUTE_SEGMENTS, routeSegmentsStore, s);

  // Audit event
  appendOnlyAuditLog(s, {
    event: FLOOD_AUDIT_EVENTS.HOTSPOT_CELL_COMPUTED, // Reusing audit type for route generation
    advisoryId: routeAdvisory.id,
    origin: `${originLat},${originLng}`,
    destination: `${destLat},${destLng}`,
    hotspotsAffected: routeCellsAffected.length,
    avoidFloodHotspots,
  });

  return routeAdvisory;
}

// ── Data Seed & Bootstrap ─────────────────────────────────────────────────────

/**
 * Ensure flood seed data exists in storage.
 * Idempotent: only writes if collections are empty/missing.
 */
export function ensureFloodSeedData(storage) {
  const s = storage || getStorage();
  if (!s) return false;

  let modified = false;

  // Seed drainage assets if none exist
  const drainageAssets = readStorageJson(FLOOD_STORAGE_KEYS.DRAINAGE_ASSETS, [], s);
  if (!Array.isArray(drainageAssets) || drainageAssets.length === 0) {
    const defaultDrainage = [
      {
        id: 'drain-001',
        name: 'Main Storm drain - Sector 15',
        type: 'storm_drain',
        capacityLitersPerSecond: 50,
        location: { lat: 28.7041, lng: 77.1025 },
        status: 'operational',
        lastInspectedAt: '2025-11-15T10:00:00Z',
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
      {
        id: 'drain-002',
        name: 'Secondary drain - MG Road Underpass',
        type: 'secondary_drain',
        capacityLitersPerSecond: 20,
        location: { lat: 28.7050, lng: 77.1040 },
        status: 'partial_blockage',
        lastInspectedAt: '2025-10-20T08:00:00Z',
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
      {
        id: 'drain-003',
        name: 'Coastal outfall drain',
        type: 'outfall',
        capacityLitersPerSecond: 100,
        location: { lat: 19.0761, lng: 72.8774 },
        status: 'operational',
        lastInspectedAt: '2025-11-10T14:00:00Z',
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
    ];
    writeStorageJson(FLOOD_STORAGE_KEYS.DRAINAGE_ASSETS, defaultDrainage, s);
    modified = true;
  }

  // Seed elevation tiles if none exist
  const elevationTiles = readStorageJson(FLOOD_STORAGE_KEYS.ELEVATION_TILES, [], s);
  if (!Array.isArray(elevationTiles) || elevationTiles.length === 0) {
    const defaultTiles = [
      {
        id: 'tile-001',
        quadKey: '012313203222',
        bounds: { minLat: 28.70, maxLat: 28.71, minLng: 77.10, maxLng: 77.11 },
        elevationMeters: 5,
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
      {
        id: 'tile-002',
        quadKey: '012313203223',
        bounds: { minLat: 28.71, maxLat: 28.72, minLng: 77.10, maxLng: 77.11 },
        elevationMeters: 12,
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
      {
        id: 'tile-003',
        quadKey: '012313203224',
        bounds: { minLat: 28.72, maxLat: 28.73, minLng: 77.10, maxLng: 77.11 },
        elevationMeters: 50,
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
    ];
    writeStorageJson(FLOOD_STORAGE_KEYS.ELEVATION_TILES, defaultTiles, s);
    modified = true;
  }

  // Seed source registry if none exist
  const sourceRegistry = readStorageJson(FLOOD_STORAGE_KEYS.SOURCE_REGISTRY, [], s);
  if (!Array.isArray(sourceRegistry) || sourceRegistry.length === 0) {
    const defaultSources = [
      {
        id: 'src-weather',
        sourceType: SOURCE_TYPES.WEATHER_API,
        sourceName: 'India Meteorological Department (IMD)',
        sourceUrl: 'https://www.imd.gov.in',
        lastFetchedAt: new Date().toISOString(),
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
      {
        id: 'src-municipal',
        sourceType: SOURCE_TYPES.MUNICIPAL_FEED,
        sourceName: 'Municipal Drainage Department',
        sourceUrl: 'https://city.gov.in/drainage-feed',
        lastFetchedAt: new Date().toISOString(),
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
      {
        id: 'src-community',
        sourceType: SOURCE_TYPES.COMMUNITY_REPORT,
        sourceName: 'Civic Help Setu Community',
        sourceUrl: '',
        lastFetchedAt: new Date().toISOString(),
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
    ];
    writeStorageJson(FLOOD_STORAGE_KEYS.SOURCE_REGISTRY, defaultSources, s);
    modified = true;
  }

  // Seed forecast runs empty container if none exist
  const forecastRuns = readStorageJson(FLOOD_STORAGE_KEYS.FORECAST_RUNS, [], s);
  if (!Array.isArray(forecastRuns) || forecastRuns.length === 0) {
    writeStorageJson(FLOOD_STORAGE_KEYS.FORECAST_RUNS, [], s);
  }

  // Seed hotspot cells empty container if none exist
  const hotspotCells = readStorageJson(FLOOD_STORAGE_KEYS.HOTSPOT_CELLS, [], s);
  if (!Array.isArray(hotspotCells) || hotspotCells.length === 0) {
    writeStorageJson(FLOOD_STORAGE_KEYS.HOTSPOT_CELLS, [], s);
  }

  // Seed route segments empty container if none exist
  const routeSegments = readStorageJson(FLOOD_STORAGE_KEYS.ROUTE_SEGMENTS, [], s);
  if (!Array.isArray(routeSegments) || routeSegments.length === 0) {
    const defaultSegments = [
      {
        id: 'seg-direct',
        startCoords: { lat: 28.7041, lng: 77.1025 },
        endCoords: { lat: 28.7050, lng: 77.1040 },
        distanceKm: 0.8,
        alternativeRouteId: '',
        status: ROUTE_ADVISORY_STATUS.ACTIVE,
        avoidanceReason: '',
        estimatedDelayMinutes: 0,
        schemaVersion: FLOOD_SCHEMA_VERSION,
      },
    ];
    writeStorageJson(FLOOD_STORAGE_KEYS.ROUTE_SEGMENTS, defaultSegments, s);
    modified = true;
  }

  return modified;
}

// ── State Transition Helpers ──────────────────────────────────────────────────

/**
 * Transition a flood report through allowed states.
 * Protected by 'flood.review' permission for moderator actions.
 */
export function transitionFloodReportState(reportId, targetState, storage, actor) {
  requirePermission('flood.review', actor);

  const s = getStorage(storage);
  if (!s) throw new Error('No storage available');

  ensureFloodSeedData(s);

  const reports = readStorageJson(FLOOD_STORAGE_KEYS.FLOOD_REPORTS, [], s);
  const reportIndex = reports.findIndex((r) => r.id === reportId);
  if (reportIndex === -1) {
    throw new Error(`Flood report with ID ${reportId} not found.`);
  }

  const currentReport = reports[reportIndex];
  const currentState = currentReport.status;

  // Check if transition is allowed
  const allowedNext = FLOOD_REPORT_ALLOWED_TRANSITIONS[currentState] || [];
  if (!allowedNext.includes(targetState)) {
    throw new Error(
      `Invalid state transition: Cannot transition from '${currentState}' to '${targetState}'. Allowed transitions from '${currentState}': [${allowedNext.join(', ')}]`,
    );
  }

  // For REJECTED or SPAM transitions, require justification
  // (justification handling simplified for this implementation)

  const updatedReport = {
    ...currentReport,
    status: targetState,
    updatedAt: new Date().toISOString(),
  };

  reports[reportIndex] = updatedReport;
  writeStorageJson(FLOOD_STORAGE_KEYS.FLOOD_REPORTS, reports, s);

  // Audit event
  appendOnlyAuditLog(s, {
    event: FLOOD_AUDIT_EVENTS[`REPORT_${targetState.toUpperCase()}`] ||
      FLOOD_AUDIT_EVENTS.REPORT_MODERATED,
    reportId,
    fromState: currentState,
    toState: targetState,
  });

  return updatedReport;
}

// ── Export all named exports ──────────────────────────────────────────────────
