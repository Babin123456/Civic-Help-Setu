import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_GATEWAY_CONFIG,
  getGatewayConfig,
  updateGatewayConfig,
  resetGatewayConfig,
  migrateGatewayConfig,
} from './gatewayConfig.js';
import { RESIDENCY_TIER } from './gatewayTypes.js';

describe('GatewayConfig & Migrations (#1153)', () => {
  beforeEach(() => {
    resetGatewayConfig();
  });

  it('loads factory defaults with version 1.0.0 and LOCAL_ONLY residency', () => {
    const config = getGatewayConfig();
    expect(config.version).toBe('1.0.0');
    expect(config.defaultResidencyTier).toBe(RESIDENCY_TIER.LOCAL_ONLY);
    expect(config.circuitBreaker.failureThreshold).toBe(3);
  });

  it('migrates invalid or partial configs safely to valid schema', () => {
    const invalidRaw = {
      defaultResidencyTier: 'invalid_extraterrestrial_tier',
      circuitBreaker: { failureThreshold: 5 },
    };

    const migrated = migrateGatewayConfig(invalidRaw);
    expect(migrated.defaultResidencyTier).toBe(RESIDENCY_TIER.LOCAL_ONLY); // Reverted safely
    expect(migrated.circuitBreaker.failureThreshold).toBe(5); // Preserved
    expect(migrated.circuitBreaker.defaultTimeoutMs).toBe(DEFAULT_GATEWAY_CONFIG.circuitBreaker.defaultTimeoutMs);
  });

  it('updates and persists configuration changes in memory', () => {
    updateGatewayConfig({
      costCeilings: { maxDailyCostINR: 100.0, maxTokensPerRequest: 2500 },
    });

    const current = getGatewayConfig();
    expect(current.costCeilings.maxDailyCostINR).toBe(100.0);
    expect(current.costCeilings.maxTokensPerRequest).toBe(2500);
  });
});
