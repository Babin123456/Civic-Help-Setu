/**
 * Base Model Adapter Interface
 * All model providers (local, sovereign, commercial) must implement this contract.
 */

export class BaseModelAdapter {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Adapter metadata including residency, provider type, and pricing.
   *
   * @returns {{
   *   id: string,
   *   name: string,
   *   type: string,
   *   residencyTier: string,
   *   costRateKey: string,
   *   supportedLanguages: string[],
   *   estimatedLatencyMs: number
   * }}
   */
  getMetadata() {
    throw new Error('getMetadata() must be implemented by subclass');
  }

  /**
   * Generates a grounded response for a prompt payload.
   *
   * @param {Object} payload - { query, sanitizedQuery, language, context }
   * @param {Object} [options] - { timeoutMs, signal }
   * @returns {Promise<Object>}
   */
  async generate(payload, options = {}) { // eslint-disable-line no-unused-vars
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Probes adapter connectivity and health.
   *
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    return true;
  }
}
