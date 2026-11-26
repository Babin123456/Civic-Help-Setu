/**
 * Civic Agent Evaluation Harness — Provider-Neutral Target Adapters
 *
 * Wraps Civic Help Setu's real execution pipelines behind a uniform adapter
 * interface so scenarios run end-to-end without coupling to any specific LLM SDK.
 */

import { runCivicAgentPipeline } from '../agents/agentOrchestrator.js';
import { askGroundedCivicAssistant } from '../groundedCivicAssistant.js';
import { executeModelGateway } from '../../services/gateway/modelGatewayService.js';

/**
 * Wraps the multi-agent contract orchestrator (guardrail -> synthesizer -> fallback).
 */
export const civicAgentPipelineAdapter = {
  id: 'civic-agent-pipeline',
  label: 'Civic Multi-Agent Contract Pipeline',
  async execute(scenario, options = {}) {
    const response = await runCivicAgentPipeline(scenario.query, {
      correlationId: options.correlationId,
      deadlineMs: options.timeoutMs || scenario.maxLatencyMs || 4500,
      serviceContextId: scenario.serviceContextId || null,
    });
    return {
      output: response,
      hops: response?.contractMeta?.hops || [],
      adapterMeta: {
        targetId: 'civic-agent-pipeline',
        schemaVersion: response?.contractMeta?.schemaVersion || '2.0',
        modelId: options.modelId || 'local-grounded-v1',
        modelVersion: options.modelVersion || '1.0.0',
        promptVersion: options.promptVersion || 'v1.0',
      },
    };
  },
};

/**
 * Wraps the source-grounded RAG assistant directly.
 */
export const groundedRagAdapter = {
  id: 'grounded-rag-assistant',
  label: 'Source-Grounded RAG Assistant',
  async execute(scenario, options = {}) {
    const response = await askGroundedCivicAssistant(scenario.query, {
      jurisdictionCode: scenario.jurisdiction || null,
      serviceContextId: scenario.serviceContextId || null,
    });
    return {
      output: response,
      hops: [{ agent: 'grounded-rag', ok: response?.status !== 'error', schemaVersion: '1.0', attempts: 1 }],
      adapterMeta: {
        targetId: 'grounded-rag-assistant',
        modelId: options.modelId || 'bm25-entailment-v1',
        modelVersion: options.modelVersion || '1.0.0',
        promptVersion: options.promptVersion || 'v1.0',
      },
    };
  },
};

/**
 * Wraps the Civic Model Gateway (residency policy + router + circuit breaker).
 */
export const modelGatewayAdapter = {
  id: 'model-gateway',
  label: 'Civic Model Gateway',
  async execute(scenario, options = {}) {
    const response = await executeModelGateway({
      query: scenario.query,
      language: scenario.language || 'en',
      timeoutMs: options.timeoutMs || scenario.maxLatencyMs || 4500,
    });
    const hasSources =
      Array.isArray(response?.officialSources) && response.officialSources.length > 0;
    const normalized = {
      ...response,
      grounded:
        response?.status === 'success' &&
        hasSources &&
        !String(response?.data?.title || '').toLowerCase().includes('no verified'),
      data: {
        ...(response?.data || {}),
        officialSources: response?.officialSources || response?.data?.officialSources || [],
      },
    };
    return {
      output: normalized,
      hops: [
        {
          agent: response?.meta?.adapterType || 'model-gateway',
          ok: response?.status !== 'error',
          schemaVersion: response?.meta?.contractVersion || '1.0.0',
          attempts: 1,
        },
      ],
      adapterMeta: {
        targetId: 'model-gateway',
        modelId: options.modelId || response?.meta?.modelName || 'local-browser',
        modelVersion: options.modelVersion || '1.0.0',
        promptVersion: options.promptVersion || 'v1.0',
        residencyTier: response?.meta?.residencyTier,
        estimatedCostINR: response?.meta?.estimatedCostINR || 0,
        tokenUsage: response?.meta?.tokenUsage || null,
      },
    };
  },
};

/**
 * Creates a default adapter registry, optionally extending with custom adapters.
 * @param {Object} [customAdapters]
 * @returns {Map<string, Object>}
 */
export function createHarnessAdapterRegistry(customAdapters = {}) {
  const registry = new Map([
    [civicAgentPipelineAdapter.id, civicAgentPipelineAdapter],
    [groundedRagAdapter.id, groundedRagAdapter],
    [modelGatewayAdapter.id, modelGatewayAdapter],
  ]);

  for (const [id, adapter] of Object.entries(customAdapters || {})) {
    if (adapter && typeof adapter.execute === 'function') {
      registry.set(id, adapter);
    }
  }
  return registry;
}

/**
 * Resolves an adapter by targetId from a registry.
 * @param {string} targetId
 * @param {Map<string, Object>} [registry]
 */
export function resolveHarnessAdapter(targetId, registry = createHarnessAdapterRegistry()) {
  const adapter = registry.get(targetId);
  if (!adapter) {
    throw new Error(`Unknown evaluation target adapter: ${targetId}`);
  }
  return adapter;
}
