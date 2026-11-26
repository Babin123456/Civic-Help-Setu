import { describe, it, expect, beforeEach } from 'vitest';
import {
  estimateTokens,
  calculateEstimatedCostINR,
  recordGatewayTelemetry,
  getGatewayTelemetryLogs,
  getGatewayMetricsSummary,
  clearGatewayTelemetry,
} from './gatewayTelemetry.js';

describe('GatewayTelemetry (#1153)', () => {
  beforeEach(() => {
    clearGatewayTelemetry();
  });

  it('estimates tokens conservatively based on text character length', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('Hello world')).toBe(3); // 11 / 4 = 2.75 -> 3
  });

  it('calculates cost according to provider rates', () => {
    expect(calculateEstimatedCostINR('local-browser', 5000)).toBe(0);
    expect(calculateEstimatedCostINR('sovereign-domestic', 1000)).toBe(0.05);
    expect(calculateEstimatedCostINR('external-frontier', 2000)).toBe(0.5);
  });

  it('records telemetry safely without storing raw prompt text or citizen PII', () => {
    recordGatewayTelemetry({
      adapterType: 'local_browser',
      modelName: 'local-test-model',
      residencyTier: 'local_only',
      routingReason: 'default_local',
      latencyMs: 120,
      tokenUsage: { promptTokens: 20, completionTokens: 40, totalTokens: 60 },
      estimatedCostINR: 0,
      fallbackTriggered: false,
      // Attempting to pass sensitive PII should not be stored
      rawCitizenQuery: 'Aadhaar 2345-6789-0123',
    });

    const logs = getGatewayTelemetryLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].latencyMs).toBe(120);
    expect(logs[0].totalTokens).toBe(60);
    expect(logs[0].rawCitizenQuery).toBeUndefined(); // Guard against PII leakage
  });

  it('aggregates summary metrics accurately', () => {
    recordGatewayTelemetry({
      residencyTier: 'local_only',
      latencyMs: 100,
      tokenUsage: { totalTokens: 50 },
      estimatedCostINR: 0,
      fallbackTriggered: false,
    });

    recordGatewayTelemetry({
      residencyTier: 'sovereign_domestic',
      latencyMs: 200,
      tokenUsage: { totalTokens: 150 },
      estimatedCostINR: 0.05,
      fallbackTriggered: true,
      fallbackReason: 'TIMEOUT_EXCEEDED',
    });

    const summary = getGatewayMetricsSummary();
    expect(summary.totalRequests).toBe(2);
    expect(summary.fallbackCount).toBe(1);
    expect(summary.fallbackRate).toBe(50.0);
    expect(summary.avgLatencyMs).toBe(150);
    expect(summary.totalTokens).toBe(200);
    expect(summary.totalCostINR).toBe(0.05);
    expect(summary.tierDistribution['local_only']).toBe(1);
    expect(summary.tierDistribution['sovereign_domestic']).toBe(1);
  });
});
