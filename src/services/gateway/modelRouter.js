/**
 * Multi-Criteria Model Router
 * Routes requests across adapters based on Residency Policy, Task Risk, Language, and Latency SLA.
 */

import { RESIDENCY_TIER, TASK_RISK } from './gatewayTypes.js';
import { evaluateResidencyPolicy } from './residencyPolicyEngine.js';
import { circuitBreaker } from './circuitBreaker.js';
import { LocalBrowserAdapter } from './adapters/LocalBrowserAdapter.js';
import { SovereignCloudAdapter } from './adapters/SovereignCloudAdapter.js';
import { ExternalProviderAdapter } from './adapters/ExternalProviderAdapter.js';
import { DeterministicFallbackAdapter } from './adapters/DeterministicFallbackAdapter.js';

export class ModelRouter {
  constructor(options = {}) {
    this.adapters = new Map();

    // Register standard adapters
    this.registerAdapter(new LocalBrowserAdapter(options.localBrowserConfig));
    this.registerAdapter(new SovereignCloudAdapter(options.sovereignCloudConfig));
    this.registerAdapter(new ExternalProviderAdapter(options.externalProviderConfig));
    this.registerAdapter(new DeterministicFallbackAdapter(options.fallbackConfig));
  }

  registerAdapter(adapter) {
    const meta = adapter.getMetadata();
    this.adapters.set(meta.id, adapter);
  }

  getAdapter(adapterId) {
    return this.adapters.get(adapterId) || null;
  }

  getFallbackAdapter() {
    return this.getAdapter('deterministic-catalog-fallback') || new DeterministicFallbackAdapter();
  }

  /**
   * Evaluates criteria and selects primary and fallback adapters.
   *
   * @param {Object} context
   * @param {string} [context.requestedTier]
   * @param {string} [context.taskRisk=TASK_RISK.LOW]
   * @param {string} [context.language='en']
   * @param {string} [context.categoryId]
   * @param {boolean} [context.piiScrubbed=false]
   * @param {number} [context.latencySLA] - Desired latency SLA in ms
   * @returns {{
   *   primaryAdapter: Object,
   *   fallbackAdapter: Object,
   *   effectiveTier: string,
   *   routingReason: string,
   *   downgraded: boolean
   * }}
   */
  route(context = {}) {
    const {
      requestedTier = null,
      taskRisk = TASK_RISK.LOW,
      categoryId = null,
      piiScrubbed = false,
      latencySLA = null,
    } = context;

    const fallbackAdapter = this.getFallbackAdapter();

    // 1. Evaluate Data Residency Rules
    const policyResult = evaluateResidencyPolicy({
      requestedTier,
      taskRisk,
      categoryId,
      piiScrubbed,
    });

    const effectiveTier = policyResult.effectiveTier;

    // 2. Strict Local Tier
    if (effectiveTier === RESIDENCY_TIER.LOCAL_ONLY) {
      const localAdapter = this.getAdapter('local-browser-engine');
      return {
        primaryAdapter: localAdapter,
        fallbackAdapter,
        effectiveTier,
        routingReason: policyResult.downgraded
          ? `residency_downgraded_to_local: ${policyResult.reason}`
          : 'residency_enforced_local_zero_egress',
        downgraded: policyResult.downgraded,
      };
    }

    // 3. Fast Latency SLA constraint (<200ms demands local processing)
    if (latencySLA && latencySLA <= 200) {
      const localAdapter = this.getAdapter('local-browser-engine');
      return {
        primaryAdapter: localAdapter,
        fallbackAdapter,
        effectiveTier: RESIDENCY_TIER.LOCAL_ONLY,
        routingReason: `latency_sla_exceeded: requested ${latencySLA}ms demands local execution`,
        downgraded: true,
      };
    }

    // 4. Sovereign Domestic Cloud Tier
    if (effectiveTier === RESIDENCY_TIER.SOVEREIGN_DOMESTIC) {
      const sovereignAdapter = this.getAdapter('sovereign-national-engine');
      if (sovereignAdapter && circuitBreaker.canExecute(sovereignAdapter.id)) {
        return {
          primaryAdapter: sovereignAdapter,
          fallbackAdapter,
          effectiveTier,
          routingReason: 'sovereign_domestic_approved',
          downgraded: false,
        };
      }
      // If circuit breaker is tripped, fall back to local browser
      return {
        primaryAdapter: this.getAdapter('local-browser-engine'),
        fallbackAdapter,
        effectiveTier: RESIDENCY_TIER.LOCAL_ONLY,
        routingReason: 'sovereign_circuit_breaker_tripped_failover_to_local',
        downgraded: true,
      };
    }

    // 5. Cross-Border Scrubbed Tier
    if (effectiveTier === RESIDENCY_TIER.CROSS_BORDER_SCRUBBED) {
      const externalAdapter = this.getAdapter('external-frontier-model');
      if (externalAdapter && circuitBreaker.canExecute(externalAdapter.id)) {
        return {
          primaryAdapter: externalAdapter,
          fallbackAdapter,
          effectiveTier,
          routingReason: 'cross_border_scrubbed_approved',
          downgraded: false,
        };
      }
      return {
        primaryAdapter: this.getAdapter('local-browser-engine'),
        fallbackAdapter,
        effectiveTier: RESIDENCY_TIER.LOCAL_ONLY,
        routingReason: 'external_circuit_breaker_tripped_failover_to_local',
        downgraded: true,
      };
    }

    // Default safe fallback
    return {
      primaryAdapter: this.getAdapter('local-browser-engine'),
      fallbackAdapter,
      effectiveTier: RESIDENCY_TIER.LOCAL_ONLY,
      routingReason: 'default_safe_local_routing',
      downgraded: false,
    };
  }
}

export const modelRouter = new ModelRouter();
