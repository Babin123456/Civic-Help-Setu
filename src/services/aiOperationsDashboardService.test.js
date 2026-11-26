import { describe, it, expect, beforeEach } from 'vitest';
import {
  AiOperationsDashboardService,
  calculateLatencyPercentiles,
  FAILURE_TYPES,
  TELEMETRY_WINDOWS
} from './aiOperationsDashboardService.js';

describe('aiOperationsDashboardService', () => {
  describe('calculateLatencyPercentiles', () => {
    it('computes exact P50 and P95 latency percentiles', () => {
      const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      const res = calculateLatencyPercentiles(latencies);

      expect(res.p50).toBe(500);
      expect(res.p95).toBe(1000);
    });

    it('handles empty arrays gracefully with zeroes', () => {
      const res = calculateLatencyPercentiles([]);
      expect(res.p50).toBe(0);
      expect(res.p95).toBe(0);
    });
  });

  describe('AiOperationsDashboardService', () => {
    let service;
    const maintainerActor = { username: 'admin_lead', role: 'MAINTAINER' };
    const citizenActor = { username: 'citizen_user', role: 'CITIZEN' };

    beforeEach(() => {
      service = new AiOperationsDashboardService();
    });

    it('blocks non-maintainer actors from accessing telemetry dashboard', () => {
      expect(() => {
        service.getDashboardMetrics({}, citizenActor);
      }).toThrow(/requires MAINTAINER privileges/);
    });

    it('records purely numeric operational events without sensitive strings', () => {
      const event = service.recordInferenceEvent({
        latencyMs: 350,
        modelId: 'gemini-1.5-pro',
        configVersion: 'v1.0',
        success: true
      });

      expect(event.latencyMs).toBe(350);
      expect(event.modelId).toBe('gemini-1.5-pro');
      expect(event.success).toBe(true);
    });

    it('distinguishes provider timeouts from local validation rejections', () => {
      const now = Date.now();
      // Record 12 events to exceed sample threshold
      for (let i = 0; i < 8; i++) {
        service.recordInferenceEvent({ timestamp: now, success: true, latencyMs: 200 });
      }
      service.recordInferenceEvent({
        timestamp: now,
        success: false,
        failureType: FAILURE_TYPES.PROVIDER_TIMEOUT,
        fallbackActivated: true,
        latencyMs: 3000
      });
      service.recordInferenceEvent({
        timestamp: now,
        success: false,
        failureType: FAILURE_TYPES.PROVIDER_ERROR,
        fallbackActivated: true,
        latencyMs: 500
      });
      service.recordInferenceEvent({
        timestamp: now,
        success: false,
        failureType: FAILURE_TYPES.LOCAL_VALIDATION_REJECTION,
        fallbackActivated: false,
        latencyMs: 10
      });
      service.recordInferenceEvent({ timestamp: now, success: true, latencyMs: 250 });

      const metrics = service.getDashboardMetrics({ now }, maintainerActor);

      expect(metrics.totalRequests).toBe(12);
      expect(metrics.isLowVolume).toBe(false);
      expect(metrics.breakdown.providerErrors).toBe(2);
      expect(metrics.breakdown.localValidationRejections).toBe(1);
      expect(metrics.breakdown.fallbackInvocations).toBe(2);
      expect(metrics.fallbackRate).toBe(0.17);
    });

    it('flags low sample volume when requests are below threshold', () => {
      const now = Date.now();
      service.recordInferenceEvent({ timestamp: now, success: true, latencyMs: 200 });

      const metrics = service.getDashboardMetrics({ now }, maintainerActor);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.isLowVolume).toBe(true);
      expect(metrics.lowVolumeWarning).toContain('below threshold');
    });

    it('filters telemetry accurately by time window', () => {
      const now = Date.now();
      // 2 hours ago
      service.recordInferenceEvent({ timestamp: now - (2 * 60 * 60 * 1000), success: true, latencyMs: 150 });
      // 10 minutes ago
      service.recordInferenceEvent({ timestamp: now - (10 * 60 * 1000), success: true, latencyMs: 180 });

      const metrics1h = service.getDashboardMetrics({ window: TELEMETRY_WINDOWS.ONE_HOUR, now }, maintainerActor);
      expect(metrics1h.totalRequests).toBe(1);

      const metrics24h = service.getDashboardMetrics({ window: TELEMETRY_WINDOWS.TWENTY_FOUR_HOURS, now }, maintainerActor);
      expect(metrics24h.totalRequests).toBe(2);
    });
  });
});
