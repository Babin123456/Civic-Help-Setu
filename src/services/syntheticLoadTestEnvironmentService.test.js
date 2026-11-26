import { describe, it, expect, beforeEach } from 'vitest';
import {
  SyntheticLoadTestEnvironmentService,
  LOAD_PROFILE
} from './syntheticLoadTestEnvironmentService.js';

describe('SyntheticLoadTestEnvironmentService', () => {
  let service;

  beforeEach(() => {
    service = new SyntheticLoadTestEnvironmentService();
  });

  it('generates privacy-safe synthetic citizen datasets', () => {
    const dataset = service.generateSyntheticDataset(25);
    expect(dataset.length).toBe(25);
    expect(dataset[0].syntheticId).toMatch(/^SYN-CIT-[a-f0-9]{12}$/);
    expect(dataset[0].jurisdiction).toBeDefined();
    expect(dataset[0].serviceType).toBeDefined();
  });

  it('configures distinct load scenarios correctly', () => {
    const baseline = service.createLoadScenario(LOAD_PROFILE.BASELINE, 30);
    const spike = service.createLoadScenario(LOAD_PROFILE.SPIKE, 15);

    expect(baseline.targetRps).toBe(50);
    expect(spike.targetRps).toBe(350);
    expect(spike.tolerableP99LatencyMs).toBeGreaterThan(baseline.tolerableP99LatencyMs);
  });

  it('simulates scenario runs and evaluates SLO conformance', () => {
    const scenario = service.createLoadScenario(LOAD_PROFILE.BASELINE, 10);
    const mockSamples = Array.from({ length: 100 }, (_, i) => ({
      latencyMs: 100 + (i % 50),
      error: false
    }));

    const result = service.simulateRun(scenario, mockSamples);
    expect(result.status).toBe('PASSED');
    expect(result.meetsSlo).toBe(true);
    expect(result.p99LatencyMs).toBeLessThanOrEqual(scenario.tolerableP99LatencyMs);
  });
});
