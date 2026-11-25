import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeatureAvailabilitySloService,
  CRITICAL_FEATURE
} from './featureAvailabilitySloService.js';

describe('FeatureAvailabilitySloService', () => {
  let service;

  beforeEach(() => {
    service = new FeatureAvailabilitySloService();
  });

  it('evaluates 100% compliant telemetry correctly', () => {
    for (let i = 0; i < 50; i++) {
      service.recordEvent(CRITICAL_FEATURE.CIVIC_SEARCH, true, 120);
    }

    const metrics = service.computeFeatureSloMetrics(CRITICAL_FEATURE.CIVIC_SEARCH, 60);
    expect(metrics.totalEvents).toBe(50);
    expect(metrics.availabilityPercent).toBe(100.0);
    expect(metrics.meetsAvailabilitySlo).toBe(true);
    expect(metrics.meetsLatencySlo).toBe(true);
    expect(metrics.errorBudgetRemainingPercent).toBe(100.0);
  });

  it('detects availability drop and error budget consumption', () => {
    // 95 successes, 5 failures = 95% availability (SLO is 99.9%)
    for (let i = 0; i < 95; i++) {
      service.recordEvent(CRITICAL_FEATURE.GRIEVANCE_SUBMISSION, true, 200);
    }
    for (let i = 0; i < 5; i++) {
      service.recordEvent(CRITICAL_FEATURE.GRIEVANCE_SUBMISSION, false, 500);
    }

    const metrics = service.computeFeatureSloMetrics(CRITICAL_FEATURE.GRIEVANCE_SUBMISSION, 60);
    expect(metrics.availabilityPercent).toBe(95.0);
    expect(metrics.meetsAvailabilitySlo).toBe(false);
    expect(metrics.errorBudgetRemainingPercent).toBe(0);
  });

  it('generates system-wide dashboard summary', () => {
    service.recordEvent(CRITICAL_FEATURE.CIVIC_SEARCH, true, 80);
    service.recordEvent(CRITICAL_FEATURE.SERVICE_DISCOVERY, true, 95);

    const dashboard = service.generateDashboardSummary(60);
    expect(dashboard.features.length).toBe(5);
    expect(dashboard.allFeaturesCompliant).toBe(true);
  });
});
