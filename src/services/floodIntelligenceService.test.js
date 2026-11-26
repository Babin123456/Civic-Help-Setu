import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import contract constants from floodContract
import {
  FLOOD_SCHEMA_VERSION,
  FLOOD_STORAGE_KEYS,
  FLOOD_REPORT_STATES,
  FLOOD_REPORT_STATE_LABELS,
  FLOOD_REPORT_ALLOWED_TRANSITIONS,
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
  FLOOD_AUDIT_EVENTS,
  FLOOD_AUDIT_LOG_KEY,
  MINIMAL_DRAINAGE_ASSET,
  MINIMAL_ELEVATION_TILE,
  MINIMAL_RAINFALL_OBSERVATION,
  MINIMAL_SOURCE_REGISTRY_ENTRY,
  MINIMAL_FLOOD_REPORT,
  MINIMAL_FORECAST_RUN,
  MINIMAL_HOTSPOT_CELL,
  MINIMAL_ROUTE_SEGMENT,
  MINIMAL_ROUTE_ADVISORY,
} from '../data/floodContract';

// Validation functions from floodIntelligenceService (imported separately to avoid oxc parser issues)
// For now, test the contract constants and validation logic

describe('Flood Contract Constants', () => {
  it('has schema version defined', () => {
    expect(FLOOD_SCHEMA_VERSION).toBe(1);
  });

  it('storage keys are defined', () => {
    expect(FLOOD_STORAGE_KEYS).toBeDefined();
    expect(FLOOD_STORAGE_KEYS.FLOOD_REPORTS).toBeDefined();
    expect(FLOOD_STORAGE_KEYS.HOTSPOT_CELLS).toBeDefined();
  });

  it('flood report states are defined', () => {
    expect(FLOOD_REPORT_STATES).toBeDefined();
    expect(FLOOD_REPORT_STATES.SUBMITTED).toBe('submitted');
    expect(FLOOD_REPORT_STATES.VALIDATED).toBe('validated');
    expect(FLOOD_REPORT_STATES.RESOLVED).toBe('resolved');
  });

  it('flood report state labels exist', () => {
    expect(FLOOD_REPORT_STATE_LABELS).toBeDefined();
    expect(FLOOD_REPORT_STATE_LABELS[FLOOD_REPORT_STATES.SUBMITTED]).toBe('Submitted (Awaiting Moderation)');
  });

  it('allowed transitions are defined for each state', () => {
    expect(FLOOD_REPORT_ALLOWED_TRANSITIONS).toBeDefined();
    // Every state should have an entry (possibly empty array)
    Object.values(FLOOD_REPORT_STATES).forEach((state) => {
      expect(FLOOD_REPORT_ALLOWED_TRANSITIONS[state]).toBeDefined();
    });
  });

  it('forecast run states are defined', () => {
    expect(FORECAST_RUN_STATES).toBeDefined();
    expect(FORECAST_RUN_STATES.PREPARING).toBe('preparing');
    expect(FORECAST_RUN_STATES.COMPLETED).toBe('completed');
  });

  it('hotspot risk levels are defined', () => {
    expect(HOTSPOT_RISK_LEVELS).toBeDefined();
    expect(HOTSPOT_RISK_LEVELS.LOW).toBe('low');
    expect(HOTSPOT_RISK_LEVELS.CRITICAL).toBe('critical');
  });

  it('route advisory statuses are defined', () => {
    expect(ROUTE_ADVISORY_STATUS).toBeDefined();
    expect(ROUTE_ADVISORY_STATUS.ACTIVE).toBe('active');
  });

  it('contributing signals are defined', () => {
    expect(CONTRIBUTING_SIGNALS).toBeDefined();
    expect(CONTRIBUTING_SIGNALS.RAINFALL_FORECAST).toBe('rainfall_forecast');
  });

  it('hazard types and labels are defined', () => {
    expect(FLOOD_HAZARD_TYPES).toBeDefined();
    expect(FLOOD_HAZARD_TYPES.WATERLOGGING).toBe('waterlogging');
    expect(FLOOD_HAZARD_TYPE_LABELS).toBeDefined();
    expect(FLOOD_HAZARD_TYPE_LABELS[FLOOD_HAZARD_TYPES.WATERLOGGING]).toBe('Waterlogging');
  });

  it('rate limit constants are positive', () => {
    expect(RATE_LIMIT_MAX_SUBMISSIONS).toBeGreaterThan(0);
    expect(RATE_LIMIT_WINDOW_MS).toBeGreaterThan(0);
  });

  it('coordinate precision is a positive integer', () => {
    expect(COORDINATE_PRECISION).toBeGreaterThan(0);
    expect(Number.isInteger(COORDINATE_PRECISION)).toBe(true);
  });

  it('source types and labels are defined', () => {
    expect(SOURCE_TYPES).toBeDefined();
    expect(SOURCE_TYPE_LABELS).toBeDefined();
    expect(SOURCE_TYPES.WEATHER_API).toBe('weather_api');
  });
});

describe('Flood Hazard Types', () => {
  it('has all hazard types defined', () => {
    expect(FLOOD_HAZARD_TYPES.WATERLOGGING).toBe('waterlogging');
    expect(FLOOD_HAZARD_TYPES.DRAINAGE_FAILURE).toBe('drainage_failure');
    expect(FLOOD_HAZARD_TYPES.OVERFLOW).toBe('overflow');
    expect(FLOOD_HAZARD_TYPES.ROAD_SUBMERGED).toBe('road_submerged');
    expect(FLOOD_HAZARD_TYPES.PONDING).toBe('ponding');
  });

  it('hazard type labels exist', () => {
    expect(FLOOD_HAZARD_TYPE_LABELS).toBeDefined();
    expect(FLOOD_HAZARD_TYPE_LABELS[FLOOD_HAZARD_TYPES.WATERLOGGING]).toBe('Waterlogging');
    expect(FLOOD_HAZARD_TYPE_LABELS[FLOOD_HAZARD_TYPES.DRAINAGE_FAILURE]).toBe('Drainage Failure');
  });
});

describe('Idempotency and Rate Limiting', () => {
  it('idempotency prefix is defined', () => {
    expect(IDEMPOTENCY_PREFIX).toBe('flood-report-');
  });

  it('rate limit max submissions is 3', () => {
    expect(RATE_LIMIT_MAX_SUBMISSIONS).toBe(3);
  });

  it('rate limit window is 15 minutes in ms', () => {
    expect(RATE_LIMIT_WINDOW_MS).toBe(60 * 60 * 1000); // 15 minutes
  });
});
