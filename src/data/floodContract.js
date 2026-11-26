// ── Schema Versioning ────────────────────────────────────────────────────────
export const FLOOD_SCHEMA_VERSION = 1;

// ── Storage Keys ─────────────────────────────────────────────────────────────
export const FLOOD_STORAGE_KEYS = {
  RAINFALL_OBSERVATIONS: 'civicbridge_flood_rainfall_observations_v1',
  DRAINAGE_ASSETS: 'civicbridge_flood_drainage_assets_v1',
  ELEVATION_TILES: 'civicbridge_flood_elevation_tiles_v1',
  FLOOD_REPORTS: 'civicbridge_flood_reports_v1',
  FORECAST_RUNS: 'civicbridge_flood_forecast_runs_v1',
  HOTSPOT_CELLS: 'civicbridge_flood_hotspot_cells_v1',
  ROUTE_SEGMENTS: 'civicbridge_flood_route_segments_v1',
  SOURCE_REGISTRY: 'civicbridge_flood_source_registry_v1',
  RATE_LIMIT: 'civicbridge_flood_rate_limit_v1',
  AUDIT_LOGS: 'civicbridge_flood_audit_logs_v1',
};

// ── Domain State Machines ─────────────────────────────────────────────────────

/**
 * FloodReport status lifecycle:
 *   submitted  →  moderated  →  validated  →  resolved
 *   submitted  →  rejected  (moderator action)
 *   submitted  →  spam  (abuse flag)
 */
export const FLOOD_REPORT_STATES = {
  SUBMITTED: 'submitted',
  MODERATED: 'moderated',
  VALIDATED: 'validated',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
  SPAM: 'spam',
};

/**
 * FloodReport state label for UI display.
 */
export const FLOOD_REPORT_STATE_LABELS = {
  [FLOOD_REPORT_STATES.SUBMITTED]: 'Submitted (Awaiting Moderation)',
  [FLOOD_REPORT_STATES.MODERATED]: 'Moderated',
  [FLOOD_REPORT_STATES.VALIDATED]: 'Validated',
  [FLOOD_REPORT_STATES.RESOLVED]: 'Resolved',
  [FLOOD_REPORT_STATES.REJECTED]: 'Rejected',
  [FLOOD_REPORT_STATES.SPAM]: 'Flagged as Spam',
};

/**
 * Strict Finite State Machine: Only allow documented state transitions.
 * Governed by: moderation queue, administrator review, and automated calibration.
 */
export const FLOOD_REPORT_ALLOWED_TRANSITIONS = {
  [FLOOD_REPORT_STATES.SUBMITTED]: [
    FLOOD_REPORT_STATES.MODERATED,
    FLOOD_REPORT_STATES.SPAM,
  ],
  [FLOOD_REPORT_STATES.MODERATED]: [
    FLOOD_REPORT_STATES.VALIDATED,
    FLOOD_REPORT_STATES.REJECTED,
  ],
  [FLOOD_REPORT_STATES.VALIDATED]: [
    FLOOD_REPORT_STATES.RESOLVED,
  ],
  [FLOOD_REPORT_STATES.RESOLVED]: [],
  [FLOOD_REPORT_STATES.REJECTED]: [
    FLOOD_REPORT_STATES.SUBMITTED, // Re-open for resubmission
  ],
  [FLOOD_REPORT_STATES.SPAM]: [
    FLOOD_REPORT_STATES.SUBMITTED, // Re-open if user contests
  ],
};

/**
 * ForecastRun status lifecycle:
 *   preparing  →  running  →  completed  →  archived
 */
export const FORECAST_RUN_STATES = {
  PREPARING: 'preparing',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

export const FORECAST_RUN_STATE_LABELS = {
  [FORECAST_RUN_STATES.PREPARING]: 'Preparing',
  [FORECAST_RUN_STATES.RUNNING]: 'Running',
  [FORECAST_RUN_STATES.COMPLETED]: 'Completed',
  [FORECAST_RUN_STATES.ARCHIVED]: 'Archived',
};

/**
 * HotspotCell risk level:
 *   low  →  moderate  →  high  →  critical
 */
export const HOTSPOT_RISK_LEVELS = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const HOTSPOT_RISK_LEVEL_LABELS = {
  [HOTSPOT_RISK_LEVELS.LOW]: 'Low Risk',
  [HOTSPOT_RISK_LEVELS.MODERATE]: 'Moderate Risk',
  [HOTSPOT_RISK_LEVELS.HIGH]: 'High Risk',
  [HOTSPOT_RISK_LEVELS.CRITICAL]: 'Critical Risk',
};

/**
 * RouteAdvisory status:
 *   active  →  expired  →  cancelled
 */
export const ROUTE_ADVISORY_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

export const ROUTE_ADVISORY_STATUS_LABELS = {
  [ROUTE_ADVISORY_STATUS.ACTIVE]: 'Active',
  [ROUTE_ADVISORY_STATUS.EXPIRED]: 'Expired',
  [ROUTE_ADVISORY_STATUS.CANCELLED]: 'Cancelled',
};

// ── Contributing Signals (for model explainability) ───────────────────────────
export const CONTRIBUTING_SIGNALS = {
  RAINFALL_FORECAST: 'rainfall_forecast',
  DRAINAGE_CAPACITY: 'drainage_capacity',
  ELEVATION: 'elevation',
  TERRAIN_SLOPE: 'terrain_slope',
  COMMUNITY_OBSERVATIONS: 'community_observations',
  RECENT_REPORTS: 'recent_reports',
  TIDE_LEVEL: 'tide_level',
  SEASONAL_FACTOR: 'seasonal_factor',
};

// ── Seed Data Types (for migrations & bootstrapping) ─────────────────────────
export const FLOOD_HAZARD_TYPES = {
  WATERLOGGING: 'waterlogging',
  DRAINAGE_FAILURE: 'drainage_failure',
  OVERFLOW: 'overflow',
  ROAD_SUBMERGED: 'road_submerged',
  PONDING: 'ponding',
};

export const FLOOD_HAZARD_TYPE_LABELS = {
  [FLOOD_HAZARD_TYPES.WATERLOGGING]: 'Waterlogging',
  [FLOOD_HAZARD_TYPES.DRAINAGE_FAILURE]: 'Drainage Failure',
  [FLOOD_HAZARD_TYPES.OVERFLOW]: 'Overflow',
  [FLOOD_HAZARD_TYPES.ROAD_SUBMERGED]: 'Road Submerged',
  [FLOOD_HAZARD_TYPES.PONDING]: 'Ponding',
};

/**
 * Idempotency key prefix for flood report submissions.
 * Ensures retried submissions are deduplicated safely.
 */
export const IDEMPOTENCY_PREFIX = 'flood-report-';

/**
 * Rate limiting configuration for public submissions.
 * Strict anti-abuse guard on the public submission endpoint.
 */
export const RATE_LIMIT_MAX_SUBMISSIONS = 3;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 15 minutes

// ── Coordinate precision controls ─────────────────────────────────────────────
// Store coordinates with 6 decimal places (~10cm precision ~10m at equator)
export const COORDINATE_PRECISION = 6;

// ── Source registry entries ───────────────────────────────────────────────────
export const SOURCE_TYPES = {
  WEATHER_API: 'weather_api',
  MUNICIPAL_FEED: 'municipal_feed',
  COMMUNITY_REPORT: 'community_report',
  HISTORICAL_OBSERVATION: 'historical_observation',
};

export const SOURCE_TYPE_LABELS = {
  [SOURCE_TYPES.WEATHER_API]: 'Approved Weather API',
  [SOURCE_TYPES.MUNICIPAL_FEED]: 'Municipal Drainage Feed',
  [SOURCE_TYPES.COMMUNITY_REPORT]: 'Community Observation',
  [SOURCE_TYPES.HISTORICAL_OBSERVATION]: 'Historical Record',
};

// ── Audit event types ─────────────────────────────────────────────────────────
export const FLOOD_AUDIT_EVENTS = {
  REPORT_SUBMITTED: 'report_submitted',
  REPORT_MODERATED: 'report_moderated',
  REPORT_VALIDATED: 'report_validated',
  REPORT_RESOLVED: 'report_resolved',
  REPORT_REJECTED: 'report_rejected',
  REPORT_FLAGGED_SPAM: 'report_flagged_spam',
  FORECAST_RUN_EXECUTED: 'forecast_run_executed',
  HOTSPOT_CELL_COMPUTED: 'hotspot_cell_computed',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  STORAGE_MIGRATION_EXECUTED: 'storage_migration_executed',
  STORAGE_ROLLBACK_EXECUTED: 'storage_rollback_executed',
};

// ── Default/Seed Data ────────────────────────────────────────────────────────

/**
 * Minimal drainage asset record shape.
 * Used for initial seed data when none exists in storage.
 */
export const MINIMAL_DRAINAGE_ASSET = {
  id: '',
  name: '',
  type: '',
  capacityLitersPerSecond: 0,
  location: { lat: 0, lng: 0 },
  status: 'operational',
  lastInspectedAt: '',
  schemaVersion: FLOOD_SCHEMA_VERSION,
};

/**
 * Minimal elevation tile record shape.
 */
export const MINIMAL_ELEVATION_TILE = {
  id: '',
  quadKey: '',
  bounds: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
  elevationMeters: 0,
  schemaVersion: FLOOD_SCHEMA_VERSION,
};

/**
 * Minimal rainfall observation record shape.
 */
export const MINIMAL_RAINFALL_OBSERVATION = {
  id: '',
  source: SOURCE_TYPES.WEATHER_API,
  sourceTimestamp: '',
  precipitationMm: 0,
  forecastWindowStart: '',
  forecastWindowEnd: '',
  location: { lat: 0, lng: 0 },
  schemaVersion: FLOOD_SCHEMA_VERSION,
};

/**
 * Minimal source registry entry shape.
 */
export const MINIMAL_SOURCE_REGISTRY_ENTRY = {
  id: '',
  sourceType: SOURCE_TYPES.WEATHER_API,
  sourceName: '',
  sourceUrl: '',
  lastFetchedAt: '',
  schemaVersion: FLOOD_SCHEMA_VERSION,
};

/**
 * Minimal flood report record shape (submitted state).
 */
export const MINIMAL_FLOOD_REPORT = {
  id: '',
  idempotencyKey: null,
  reporterRole: 'citizen',
  status: FLOOD_REPORT_STATES.SUBMITTED,
  hazardType: FLOOD_HAZARD_TYPES.WATERLOGGING,
  severity: 'medium',
  description: '',
  location: { lat: 0, lng: 0 },
  altitudeMeters: 0,
  confidence: 0.5, // 0.0 - 1.0, from model or user estimate
  sourceTimestamp: '',
  createdAt: '',
  updatedAt: '',
  schemaVersion: FLOOD_SCHEMA_VERSION,
};

/**
 * Minimal forecast run record shape (preparing state).
 */
export const MINIMAL_FORECAST_RUN = {
  id: '',
  runTimestamp: '',
  featureWindowStart: '',
  featureWindowEnd: '',
  inputRecordsCount: 0,
  hotspotCellsGenerated: 0,
  status: FORECAST_RUN_STATES.PREPARING,
  executedBy: 'Flood Intelligence Engine',
  disclaimer:
    'Flood hotspot forecasts are generated from a calibrated geospatial risk model using approved rainfall forecasts, drainage asset data, terrain elevation, and community observations. All automated suggestions require human verification before routing traffic or closing roads. Never rely on forecast certainty alone; defer to official emergency instructions.',
  schemaVersion: FLOOD_SCHEMA_VERSION,
};

/**
 * Minimal hotspot cell record shape.
 */
export const MINIMAL_HOTSPOT_CELL = {
  id: '',
  runId: '',
  gridIndex: 0,
  lat: 0,
  lng: 0,
  riskLevel: HOTSPOT_RISK_LEVELS.LOW,
  contributingSignals: [],
  confidence: 0.5,
  forecastWindowStart: '',
  forecastWindowEnd: '',
  areaSqKm: 0,
  associatedDrainageAssetId: '',
  note: '',
  schemaVersion: FLOOD_SCHEMA_VERSION,
};

/**
 * Minimal route segment record shape.
 */
export const MINIMAL_ROUTE_SEGMENT = {
  id: '',
  startCoords: { lat: 0, lng: 0 },
  endCoords: { lat: 0, lng: 0 },
  distanceKm: 0,
  alternativeRouteId: '',
  status: ROUTE_ADVISORY_STATUS.ACTIVE,
  avoidanceReason: '',
  estimatedDelayMinutes: 0,
  schemaVersion: FLOOD_SCHEMA_VERSION,
};

/**
 * Minimal route advisory record shape.
 */
export const MINIMAL_ROUTE_ADVISORY = {
  id: '',
  requestId: '',
  origin: { lat: 0, lng: 0 },
  destination: { lat: 0, lng: 0 },
  suggestedRouteId: '',
  estimatedTimeMinutes: 0,
  avoidFloodHotspots: true,
  hotspotCellIds: [],
  status: ROUTE_ADVISORY_STATUS.ACTIVE,
  createdAt: '',
  expiresAt: '',
  schemaVersion: FLOOD_SCHEMA_VERSION,
};
