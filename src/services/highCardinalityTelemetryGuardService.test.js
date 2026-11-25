import { describe, it, expect, beforeEach } from 'vitest';
import {
  HighCardinalityTelemetryGuardService,
  TelemetryGuardError
} from './highCardinalityTelemetryGuardService.js';

describe('HighCardinalityTelemetryGuardService', () => {
  let service;

  beforeEach(() => {
    service = new HighCardinalityTelemetryGuardService({
      maxCardinalityBudget: 5,
      sampleRate: 0.1
    });
  });

  it('redacts sensitive PII labels like user_id and aadhaar', () => {
    const sanitizedUser = service.sanitizeLabelValue('user_id', 'usr_john_doe_99');
    expect(sanitizedUser).toBe('[REDACTED_PII]');

    const sanitizedAadhaar = service.sanitizeLabelValue('aadhaar', '9999-8888-7777');
    expect(sanitizedAadhaar).toBe('[REDACTED_PII]');
  });

  it('normalizes high-cardinality UUIDs and numeric IDs in endpoint routes', () => {
    const normalized = service.sanitizeLabelValue('route', '/api/grievances/12345/details');
    expect(normalized).toBe('/api/grievances/:id/details');

    const uuidRoute = service.sanitizeLabelValue('route', '/api/cases/3fa85f64-5717-4562-b3fc-2c963f66afa6');
    expect(uuidRoute).toBe('/api/cases/:id');
  });

  it('enforces cardinality budgets and routes excess permutations to overflow bucket', () => {
    const metricName = 'http_requests_total';

    // Record 5 distinct routes
    for (let i = 1; i <= 5; i++) {
      const res = service.recordMetric(metricName, 1, { method: 'GET', route: `/api/resource_${i}` });
      expect(res.isOverflown).toBe(false);
    }

    // 6th distinct label set should overflow
    const overflowResult = service.recordMetric(metricName, 1, { method: 'GET', route: '/api/resource_6' });
    expect(overflowResult.isOverflown).toBe(true);
    expect(overflowResult.effectiveLabels).toBe('_overflow_="true"');

    const status = service.getCardinalityStatus(metricName);
    expect(status.allocatedSeries).toBe(5);
    expect(status.utilizationRatio).toBe(1.0);
  });

  it('implements tail-based trace sampling preserving errors and high latency traces', () => {
    const errorTrace = service.shouldSampleTrace({ isError: true, httpStatus: 500 });
    expect(errorTrace.sampled).toBe(true);
    expect(errorTrace.reason).toBe('TAIL_ERROR');

    const slowTrace = service.shouldSampleTrace({ durationMs: 1450, httpStatus: 200 });
    expect(slowTrace.sampled).toBe(true);
    expect(slowTrace.reason).toBe('TAIL_SLOW_REQUEST');
  });
});
