/**
 * src/ai/civicAgentCostCarbonWrapper.test.js
 *
 * Unit tests for the governed AI caller wrapper (#1185).
 * Covers estimate-before-call, record-after-call, budget-block fallback,
 * provider-error fallback, and deterministic routing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGovernedAICaller } from './civicAgentCostCarbonWrapper.js';
import { resetCostCarbonStoreToEmpty } from '../services/civicAgentCostCarbonMigrations.js';
import { CALL_SOURCE } from '../data/civicAgentCostCarbonConstants.js';

describe('civicAgentCostCarbonWrapper', () => {
  beforeEach(() => {
    resetCostCarbonStoreToEmpty();
  });

  it('requires a providerCall and workflowId', () => {
    expect(() => createGovernedAICaller({})).toThrow(/providerCall/);
    expect(() => createGovernedAICaller({ providerCall: () => {} })).toThrow(/workflowId/);
  });

  it('executes a successful call and records it', async () => {
    const providerCall = vi.fn().mockResolvedValue({ text: 'Official guidance.', usage: { inputTokens: 20, outputTokens: 30 }, billing: { verified: true, source: 'provider' } });
    const caller = createGovernedAICaller({
      providerCall,
      workflowId: 'wf-1',
      modelId: 'gpt-4o-mini',
    });

    const started = await caller.startRun({ modelId: 'gpt-4o-mini', prompt: 'Summarize ration card rules.' });
    expect(started.ok).toBe(true);

    const result = await caller.call({ prompt: 'Summarize ration card rules.', modelId: 'gpt-4o-mini', options: { runId: started.run.id } });
    expect(result.success).toBe(true);
    expect(result.output).toBe('Official guidance.');
    expect(result.fallback).toBe(false);
    expect(result.governed).toBe(true);
    expect(result.estimate.estimated).toBe(true);
    expect(providerCall).toHaveBeenCalledTimes(1);
  });

  it('routes to deterministic fallback when preflight blocks the call', async () => {
    const providerCall = vi.fn();
    const deterministicFallback = vi.fn().mockResolvedValue('Deterministic answer.');
    const caller = createGovernedAICaller({
      providerCall,
      deterministicFallback,
      workflowId: 'wf-1',
      modelId: 'gpt-4o-mini',
      policy: { maxTokensPerCall: 1 }, // tiny budget -> block
      routeToFallbackOnBudgetExceeded: true,
    });

    const result = await caller.call({ prompt: 'This is a long enough prompt to exceed the tiny token budget certainly.' });
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.output).toBe('Deterministic answer.');
    expect(providerCall).not.toHaveBeenCalled();
    expect(deterministicFallback).toHaveBeenCalledTimes(1);
  });

  it('blocks without a fallback when preflight blocks and no fallback configured', async () => {
    const providerCall = vi.fn();
    const caller = createGovernedAICaller({
      providerCall,
      workflowId: 'wf-1',
      modelId: 'gpt-4o-mini',
      policy: { maxTokensPerCall: 1 },
      routeToFallbackOnBudgetExceeded: false,
    });

    const result = await caller.call({ prompt: 'This is a long enough prompt to exceed the tiny token budget certainly.' });
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(false);
    expect(providerCall).not.toHaveBeenCalled();
  });

  it('routes to fallback when the provider errors', async () => {
    const providerCall = vi.fn().mockRejectedValue(new Error('UPSTREAM_DOWN'));
    const deterministicFallback = vi.fn().mockResolvedValue('Deterministic answer.');
    const caller = createGovernedAICaller({
      providerCall,
      deterministicFallback,
      workflowId: 'wf-1',
      modelId: 'gpt-4o-mini',
      routeToFallbackOnBudgetExceeded: true,
    });

    const result = await caller.call({ prompt: 'Hello.' });
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.output).toBe('Deterministic answer.');
    expect(deterministicFallback).toHaveBeenCalledTimes(1);
  });

  it('marks billing metadata gap when provider returns no verified billing', async () => {
    const providerCall = vi.fn().mockResolvedValue({ text: 'ok' }); // no usage/billing
    const caller = createGovernedAICaller({
      providerCall,
      workflowId: 'wf-1',
      modelId: 'gpt-4o-mini',
    });

    const started = await caller.startRun({ modelId: 'gpt-4o-mini', prompt: 'Hello.' });
    expect(started.ok).toBe(true);

    const result = await caller.call({ prompt: 'Hello.', modelId: 'gpt-4o-mini', options: { runId: started.run.id } });
    expect(result.success).toBe(true);
    expect(result.billingMetadataGap).toBe(true);
    expect(result.estimate.estimated).toBe(true);
  });

  it('exposes startRun / getRun / listPolicies', () => {
    const providerCall = vi.fn().mockResolvedValue({ text: 'ok' });
    const caller = createGovernedAICaller({ providerCall, workflowId: 'wf-1' });
    expect(typeof caller.startRun).toBe('function');
    expect(typeof caller.getRun).toBe('function');
    expect(typeof caller.listPolicies).toBe('function');
    expect(Array.isArray(caller.listPolicies())).toBe(true);
  });

  it('uses CALL_SOURCE constants', () => {
    expect(CALL_SOURCE.LLM).toBe('llm');
    expect(CALL_SOURCE.FALLBACK).toBe('fallback');
    expect(CALL_SOURCE.DETERMINISTIC).toBe('deterministic');
  });
});
