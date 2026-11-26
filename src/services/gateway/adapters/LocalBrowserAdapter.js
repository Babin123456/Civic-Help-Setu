/**
 * Local Browser Model Adapter
 * Performs zero-network, privacy-preserving in-browser grounded evaluation.
 */

import { BaseModelAdapter } from './BaseAdapter.js';
import { ADAPTER_TYPE, RESIDENCY_TIER } from '../gatewayTypes.js';
import { retrieveGroundedChunks } from '../../../ai/sourceGroundedRetriever.js';
import { getActiveBuiltInServices } from '../../serviceCatalog.js';

export class LocalBrowserAdapter extends BaseModelAdapter {
  constructor(config = {}) {
    super(config);
    this.id = config.id || 'local-browser-engine';
    this.name = config.name || 'Local In-Browser Sovereign Engine';
  }

  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      type: ADAPTER_TYPE.LOCAL_BROWSER,
      residencyTier: RESIDENCY_TIER.LOCAL_ONLY,
      costRateKey: 'local-browser',
      supportedLanguages: ['en', 'hi', 'ta', 'bn'],
      estimatedLatencyMs: 80,
    };
  }

  async generate(payload, options = {}) { // eslint-disable-line no-unused-vars
    const query = payload.sanitizedQuery || payload.query || '';
    const retrieval = retrieveGroundedChunks(query);

    if (retrieval.grounded && retrieval.retrievedChunks.length > 0) {
      const bestChunk = retrieval.retrievedChunks[0];
      const services = getActiveBuiltInServices();
      const matchedService = services.find((s) => s.id === bestChunk.serviceId) || null;

      return {
        status: 'success',
        grounded: true,
        data: {
          title: matchedService ? matchedService.name : bestChunk.title,
          summary: bestChunk.text,
          officialSources: matchedService?.officialSources || retrieval.sources || [],
          steps: matchedService?.steps || [],
          documents: matchedService?.documents || [],
          fees: matchedService?.fees || 'Refer to verified government portal',
          processingTime: matchedService?.processingTime || 'Standard government timeline',
        },
        serviceId: matchedService ? matchedService.id : bestChunk.serviceId,
        citations: retrieval.retrievedChunks.map((c) => ({
          chunkId: c.chunkId,
          serviceId: c.serviceId,
          section: c.section,
        })),
        suggestions: [
          'What are the mandatory documents?',
          'What are the official government fees?',
          'Where is the nearest verified civic office?',
        ],
      };
    }

    // Direct catalog search fallback within local engine
    const services = getActiveBuiltInServices();
    const lower = query.toLowerCase();
    const serviceMatch = services.find((s) =>
      lower.includes(s.name.toLowerCase()) || lower.includes(s.id.toLowerCase())
    );

    if (serviceMatch) {
      return {
        status: 'success',
        grounded: true,
        data: {
          title: serviceMatch.name,
          summary: serviceMatch.shortDescription,
          officialSources: serviceMatch.officialSources || [],
          steps: serviceMatch.steps || [],
          documents: serviceMatch.documents || [],
          fees: serviceMatch.fees || 'Statutory government fee',
          processingTime: serviceMatch.processingTime,
        },
        serviceId: serviceMatch.id,
        citations: [{ serviceId: serviceMatch.id, section: 'catalog-overview' }],
        suggestions: [
          `Check required proofs for ${serviceMatch.name}`,
          `Locate nearest office for ${serviceMatch.name}`,
        ],
      };
    }

    return {
      status: 'unsupported',
      grounded: false,
      data: {
        title: 'Information Not Found in Bundled Catalog',
        summary: `No verified guidelines were found locally for "${query}".`,
        officialSources: [
          {
            name: 'National Government Services Portal',
            url: 'https://services.india.gov.in',
            verified: true,
          },
        ],
      },
      serviceId: null,
      citations: [],
      suggestions: ['Check National Services Portal', 'Search nearby government offices'],
    };
  }

  async healthCheck() {
    return true;
  }
}
