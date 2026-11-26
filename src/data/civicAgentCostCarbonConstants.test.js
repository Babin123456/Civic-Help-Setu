/**
 * src/data/civicAgentCostCarbonConstants.test.js
 *
 * Unit tests for versioned schema, model rate table and estimation constants
 * for the Civic Agent Cost and Carbon Budget Governor (#1185).
 */

import { describe, it, expect } from 'vitest';
import {
  CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
  DEFAULT_COST_CARBON_POLICY,
  MODEL_RATE_TABLE,
  getModelRate,
  CHARS_PER_TOKEN_ESTIMATE,
  DEFAULT_CARBON_INTENSITY_GCO2E_PER_KWH,
} from './civicAgentCostCarbonConstants.js';

describe('civicAgentCostCarbonConstants', () => {
  it('exposes a schema version', () => {
    expect(CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION).toBe(1);
  });

  it('default policy has budget ceilings and disclaimer', () => {
    expect(DEFAULT_COST_CARBON_POLICY.id).toBe('default-civic-agent-budget-v1');
    expect(DEFAULT_COST_CARBON_POLICY.maxTotalCostUSD).toBeGreaterThan(0);
    expect(DEFAULT_COST_CARBON_POLICY.maxTotalTokens).toBeGreaterThan(0);
    expect(DEFAULT_COST_CARBON_POLICY.maxCallsPerRun).toBeGreaterThan(0);
    expect(DEFAULT_COST_CARBON_POLICY.disclaimer).toContain('estimates');
  });

  it('model rate table contains known models', () => {
    expect(MODEL_RATE_TABLE['gpt-4o-mini'].provider).toBe('openai');
    expect(MODEL_RATE_TABLE['gpt-4o-mini'].estimated).toBe(true);
    expect(MODEL_RATE_TABLE['deterministic-rules-v1'].inputCostUSDPer1kTokens).toBe(0);
  });

  it('getModelRate returns a known rate and a fallback for unknown models', () => {
    const known = getModelRate('gpt-4o-mini');
    expect(known.inputCostUSDPer1kTokens).toBe(0.00015);
    const unknown = getModelRate('no-such-model');
    expect(unknown.estimated).toBe(true);
    expect(unknown.notes).toContain('Unknown model');
  });

  it('CHAR_PER_TOKEN_ESTIMATE and carbon intensity defaults are sane', () => {
    expect(CHARS_PER_TOKEN_ESTIMATE).toBe(4);
    expect(DEFAULT_CARBON_INTENSITY_GCO2E_PER_KWH).toBe(470);
  });
});
