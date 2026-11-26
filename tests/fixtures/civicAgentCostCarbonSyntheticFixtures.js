/**
 * tests/fixtures/civicAgentCostCarbonSyntheticFixtures.js
 *
 * Synthetic fixtures for the Civic Agent Cost and Carbon Budget Governor (#1185).
 *
 * These are synthetic, non-citizen records: made-up workflow ids, model ids,
 * hashed prompts, and fabricated cost/token/latency/carbon aggregates. No
 * citizen records, credentials, raw documents, or sensitive prompts are
 * included. Safe to commit and share.
 */

import { createSeedStore, createEmptyStore, DEFAULT_COST_CARBON_POLICY } from '../src/services/civicAgentCostCarbonMigrations.js';
import {
  COST_CARBON_STATUS,
  CALL_SOURCE,
  CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
} from '../src/data/civicAgentCostCarbonConstants.js';

const NOW = '2026-11-24T10:00:00Z';

/** A synthetic workflow id. */
export function syntheticWorkflowId(label) {
  return `workflow-synth-${label}`;
}

/** A synthetic run id. */
export function syntheticRunId(label) {
  return `run-synth-${label}`;
}

/** A synthetic call id. */
export function syntheticCallId(label) {
  return `call-synth-${label}`;
}

/** A synthetic model id (made-up, no real provider). */
export function syntheticModelId(label = 'mini') {
  return `synth-model-${label}`;
}

/** A synthetic hashed prompt (never a real prompt). */
export function syntheticPromptHash(label) {
  return `h-${String(label).padStart(8, '0')}`;
}

/** A synthetic budget policy. */
export function syntheticPolicy(overrides = {}) {
  return {
    ...DEFAULT_COST_CARBON_POLICY,
    ...overrides,
    id: overrides.id || 'policy-synth-default',
    version: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
    updatedAt: NOW,
  };
}

/** A synthetic run record (aggregated metadata only). */
export function syntheticRun(overrides = {}) {
  return {
    id: overrides.id || syntheticRunId('001'),
    workflowId: overrides.workflowId || syntheticWorkflowId('assistant'),
    policyId: overrides.policyId || 'policy-synth-default',
    policyVersion: 1,
    modelId: overrides.modelId || syntheticModelId(),
    status: overrides.status || COST_CARBON_STATUS.COMPLETED,
    callSource: overrides.callSource || CALL_SOURCE.LLM,
    isHighImpact: overrides.isHighImpact ?? false,
    humanApproved: overrides.humanApproved ?? false,
    createdAt: NOW,
    updatedAt: NOW,
    startedAt: NOW,
    totals: {
      calls: overrides.calls ?? 3,
      inputTokens: overrides.inputTokens ?? 1200,
      outputTokens: overrides.outputTokens ?? 800,
      costUSD: overrides.costUSD ?? '0.004500',
      energyKWh: overrides.energyKWh ?? '0.000004000',
      carbonGCO2e: overrides.carbonGCO2e ?? '1.890000',
      latencyMs: overrides.latencyMs ?? 2400,
      fallbackCalls: overrides.fallbackCalls ?? 0,
      blockedCalls: overrides.blockedCalls ?? 0,
      billingMetadataGaps: overrides.billingMetadataGaps ?? 0,
    },
    stopTrigger: overrides.stopTrigger ?? null,
    schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
    disclaimer: DEFAULT_COST_CARBON_POLICY.disclaimer,
    noCitizenData: true,
    untrusted: true,
    requiresHumanReview: false,
  };
}

/** A synthetic call record (aggregated metadata only). */
export function syntheticCall(overrides = {}) {
  return {
    id: overrides.id || syntheticCallId('001'),
    runId: overrides.runId || syntheticRunId('001'),
    workflowId: overrides.workflowId || syntheticWorkflowId('assistant'),
    modelId: overrides.modelId || syntheticModelId(),
    callSource: overrides.callSource || CALL_SOURCE.LLM,
    promptHash: overrides.promptHash || syntheticPromptHash('abc12345'),
    promptLength: overrides.promptLength ?? 60,
    outputLength: overrides.outputLength ?? 200,
    inputTokens: overrides.inputTokens ?? 400,
    outputTokens: overrides.outputTokens ?? 300,
    totalTokens: overrides.totalTokens ?? 700,
    costUSD: overrides.costUSD ?? '0.001500',
    energyKWh: overrides.energyKWh ?? '0.000001260',
    carbonGCO2e: overrides.carbonGCO2e ?? '0.592200',
    latencyMs: overrides.latencyMs ?? 800,
    billingMetadata: overrides.billingMetadata ?? { verified: false, source: 'estimate' },
    billingMetadataGap: overrides.billingMetadataGap ?? true,
    estimated: true,
    isHighImpact: overrides.isHighImpact ?? false,
    status: overrides.status || COST_CARBON_STATUS.COMPLETED,
    recordedAt: NOW,
    schemaVersion: CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION,
    disclaimer: DEFAULT_COST_CARBON_POLICY.disclaimer,
    noCitizenData: true,
    untrusted: true,
  };
}

/** A synthetic seeded store with a few runs/calls. */
export function syntheticStore() {
  const store = createSeedStore({ now: NOW });
  store.workflows = [
    { id: syntheticWorkflowId('assistant'), name: 'Civic assistant query flow', createdAt: NOW, updatedAt: NOW },
    { id: syntheticWorkflowId('grievance'), name: 'Grievance drafting flow', createdAt: NOW, updatedAt: NOW },
  ];
  store.runs = [syntheticRun(), syntheticRun({ status: COST_CARBON_STATUS.STOPPED, modelId: syntheticModelId('sonnet') })];
  store.calls = [
    syntheticCall(),
    syntheticCall({ id: syntheticCallId('002'), modelId: syntheticModelId('sonnet'), callSource: CALL_SOURCE.FALLBACK }),
  ];
  return store;
}

/** A synthetic empty store. */
export function syntheticEmptyStore() {
  return createEmptyStore({ now: NOW });
}

export { NOW, COST_CARBON_STATUS, CALL_SOURCE, CIVIC_AGENT_COST_CARBON_SCHEMA_VERSION };
