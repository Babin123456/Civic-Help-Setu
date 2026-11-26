/**
 * External Commercial Provider Adapter
 * Connects to external commercial model APIs with mandatory pre-inference PII scrubbing.
 */

import { BaseModelAdapter } from './BaseAdapter.js';
import { ADAPTER_TYPE, RESIDENCY_TIER, GATEWAY_ERROR_CODES } from '../gatewayTypes.js';

export class ExternalProviderAdapter extends BaseModelAdapter {
  constructor(config = {}) {
    super(config);
    this.id = config.id || 'external-frontier-model';
    this.name = config.name || 'External Commercial Frontier Model';
    this.apiKey = config.apiKey || null;
    this.endpoint = config.endpoint || null;
    this.simulateLatencyMs = config.simulateLatencyMs ?? 300;
    this.simulateFailure = config.simulateFailure ?? false;
  }

  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      type: ADAPTER_TYPE.EXTERNAL_PROVIDER,
      residencyTier: RESIDENCY_TIER.CROSS_BORDER_SCRUBBED,
      costRateKey: 'external-frontier',
      supportedLanguages: ['en', 'hi', 'ta', 'bn'],
      estimatedLatencyMs: 650,
    };
  }

  async generate(payload, options = {}) {
    // Hard security check: external calls strictly require certified PII scrubbing
    if (!payload.piiScrubbed) {
      const err = new Error('Cross-border external API call blocked: pre-inference PII scrubbing unverified.');
      err.code = GATEWAY_ERROR_CODES.RESIDENCY_POLICY_VIOLATION;
      throw err;
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, this.simulateLatencyMs));

    if (this.simulateFailure || options.forceFailure) {
      const err = new Error('External model provider API rate limit exceeded (HTTP 429 Too Many Requests)');
      err.code = GATEWAY_ERROR_CODES.ADAPTER_FAILURE;
      throw err;
    }

    const query = payload.sanitizedQuery || payload.query || '';

    return {
      status: 'success',
      grounded: true,
      data: {
        title: 'Synthesized Guidance (External Model)',
        summary: `Synthesized answer for sanitized inquiry: "${query}". Guidance cross-referenced with public civic guidelines.`,
        steps: [
          'Submit statutory application at official portal',
          'Pay required fees via approved treasury payment gateway',
          'Attend physical verification if summoned by desk officer',
        ],
        documents: ['Identity Card', 'Proof of Address', 'Self-declaration'],
        fees: 'Varies by municipality',
        processingTime: '10-20 working days',
        officialSources: [
          {
            name: 'National Government Services Portal',
            url: 'https://services.india.gov.in',
            verified: true,
          },
        ],
      },
      serviceId: payload.serviceId || 'external-service',
      suggestions: [
        'Check fee concession rules',
        'Download official application form',
      ],
      citations: [{ source: 'National Services Portal', section: 'general-public-service' }],
    };
  }

  async healthCheck() {
    return !this.simulateFailure;
  }
}
