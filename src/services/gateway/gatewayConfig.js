/**
 * Model Gateway Configuration & Settings Migration Engine (#1153)
 * Manages runtime parameters, environment flags, and configuration schema migrations.
 */

import { RESIDENCY_TIER } from './gatewayTypes.js';

const CONFIG_STORAGE_KEY = 'civicbridge_gateway_config_v1';

export const DEFAULT_GATEWAY_CONFIG = Object.freeze({
  version: '1.0.0',
  defaultResidencyTier: RESIDENCY_TIER.LOCAL_ONLY,
  circuitBreaker: {
    enabled: true,
    failureThreshold: 3,
    cooldownPeriodMs: 30000,
    defaultTimeoutMs: 4500,
    maxRetries: 1,
  },
  costCeilings: {
    maxDailyCostINR: 50.0,
    maxTokensPerRequest: 1800,
  },
  fallbackMode: 'deterministic', // 'deterministic' or 'error_notice'
});

let inMemoryConfig = { ...DEFAULT_GATEWAY_CONFIG };

/**
 * Migrates and normalizes legacy or invalid config states.
 *
 * @param {Object} raw
 * @returns {Object} Validated config object
 */
export function migrateGatewayConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_GATEWAY_CONFIG };
  }

  const migrated = {
    ...DEFAULT_GATEWAY_CONFIG,
    ...raw,
    circuitBreaker: {
      ...DEFAULT_GATEWAY_CONFIG.circuitBreaker,
      ...(raw.circuitBreaker || {}),
    },
    costCeilings: {
      ...DEFAULT_GATEWAY_CONFIG.costCeilings,
      ...(raw.costCeilings || {}),
    },
  };

  // Ensure residency tier is strictly valid
  if (!Object.values(RESIDENCY_TIER).includes(migrated.defaultResidencyTier)) {
    migrated.defaultResidencyTier = RESIDENCY_TIER.LOCAL_ONLY;
  }

  return migrated;
}

/**
 * Loads the active gateway configuration with fallback to defaults.
 *
 * @returns {Object}
 */
export function getGatewayConfig() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return migrateGatewayConfig(parsed);
      }
    } catch {
      // Return memory config upon parsing/access failure
    }
  }
  return inMemoryConfig;
}

/**
 * Persists an updated gateway configuration.
 *
 * @param {Object} partialConfig
 * @returns {Object}
 */
export function updateGatewayConfig(partialConfig) {
  const current = getGatewayConfig();
  const updated = migrateGatewayConfig({
    ...current,
    ...partialConfig,
    circuitBreaker: {
      ...current.circuitBreaker,
      ...(partialConfig.circuitBreaker || {}),
    },
  });

  inMemoryConfig = updated;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore write failures in restricted contexts
    }
  }

  return updated;
}

/**
 * Resets gateway configuration to factory defaults.
 */
export function resetGatewayConfig() {
  inMemoryConfig = { ...DEFAULT_GATEWAY_CONFIG };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
  return inMemoryConfig;
}
