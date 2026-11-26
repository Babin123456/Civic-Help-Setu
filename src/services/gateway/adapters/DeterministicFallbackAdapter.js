/**
 * Deterministic Non-LLM Fallback Adapter
 * Guarantees reliable failover to verified catalog matching and physical civic offices.
 */

import { BaseModelAdapter } from './BaseAdapter.js';
import { ADAPTER_TYPE, RESIDENCY_TIER } from '../gatewayTypes.js';
import { buildCivicAssistantFallback } from '../../../ai/civicAssistantFallback.js';
import { getActiveBuiltInServices } from '../../serviceCatalog.js';

export class DeterministicFallbackAdapter extends BaseModelAdapter {
  constructor(config = {}) {
    super(config);
    this.id = config.id || 'deterministic-catalog-fallback';
    this.name = config.name || 'Deterministic Catalog & Office Fallback';
  }

  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      type: ADAPTER_TYPE.DETERMINISTIC_FALLBACK,
      residencyTier: RESIDENCY_TIER.LOCAL_ONLY,
      costRateKey: 'local-browser',
      supportedLanguages: ['en', 'hi', 'ta', 'bn'],
      estimatedLatencyMs: 30,
    };
  }

  async generate(payload, options = {}) {
    const query = payload.sanitizedQuery || payload.query || '';
    const activeServices = getActiveBuiltInServices();
    const fallbackResponse = buildCivicAssistantFallback(query, {
      activeServices,
      coords: options.coords || null,
      timeout: Boolean(options.timeout),
    });

    const officialSources = fallbackResponse.data?.officialSources
      ? fallbackResponse.data.officialSources
      : fallbackResponse.data?.officialSource
      ? [fallbackResponse.data.officialSource]
      : [];

    return {
      status: fallbackResponse.status || 'success',
      grounded: true,
      data: fallbackResponse.data,
      serviceId: fallbackResponse.serviceId || null,
      suggestions: fallbackResponse.suggestions || [],
      officialSources,
      fallbackTriggered: true,
      fallbackReason: options.fallbackReason || 'deterministic_fallback_invoked',
    };
  }

  async healthCheck() {
    return true;
  }
}
