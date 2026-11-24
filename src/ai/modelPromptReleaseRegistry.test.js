import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModelPromptReleaseRegistry,
  hashPromptTemplate,
  validateNonSecretConfig,
  ENVIRONMENT_TIERS
} from './modelPromptReleaseRegistry.js';

describe('modelPromptReleaseRegistry', () => {
  describe('hashPromptTemplate', () => {
    it('generates consistent deterministic prompt hashes', () => {
      const template = 'You are an accurate civic assistant for India.';
      const h1 = hashPromptTemplate(template);
      const h2 = hashPromptTemplate(template);

      expect(h1).toBe(h2);
      expect(h1).toMatch(/^pmt_[a-f0-9]{8}$/);
    });

    it('returns default hash for empty input', () => {
      expect(hashPromptTemplate(null)).toBe('hash_empty');
    });
  });

  describe('validateNonSecretConfig', () => {
    it('approves standard non-secret configuration objects', () => {
      const config = {
        modelId: 'gemini-1.5-pro',
        topK: 5,
        threshold: 0.7
      };
      expect(validateNonSecretConfig(config)).toBe(true);
    });

    it('rejects configurations containing API keys or password secrets', () => {
      const leakingConfig = {
        modelId: 'gemini-pro',
        api_key: 'AIzaSyBogusSecretKey'
      };
      expect(validateNonSecretConfig(leakingConfig)).toBe(false);
    });
  });

  describe('ModelPromptReleaseRegistry', () => {
    let registry;

    beforeEach(() => {
      registry = new ModelPromptReleaseRegistry();
    });

    it('registers valid release and stores prompt hash', () => {
      const release = registry.registerRelease({
        versionTag: '2026.11-v1',
        modelId: 'gemini-1.5-pro',
        promptTemplate: 'Civic assistant baseline template.',
        author: 'lead_engineer'
      });

      expect(release.versionTag).toBe('2026.11-v1');
      expect(release.promptHash).toMatch(/^pmt_/);
      expect(release.registeredAt).toBeDefined();
    });

    it('rejects release registration with secret fields', () => {
      expect(() => {
        registry.registerRelease({
          versionTag: '2026.11-v2',
          modelId: 'gemini-pro',
          promptTemplate: 'Prompt with secret',
          author: 'dev',
          retrievalConfig: { secret_token: 'secret123' }
        });
      }).toThrow(/Contains sensitive credentials/);
    });

    it('promotes and rolls back active production releases smoothly', () => {
      // 1. Register v1 and v2
      registry.registerRelease({
        versionTag: 'v1.0.0',
        modelId: 'gemini-1.5-pro',
        promptTemplate: 'Version 1 prompt',
        author: 'eng_1'
      });
      registry.registerRelease({
        versionTag: 'v2.0.0',
        modelId: 'gemini-1.5-flash',
        promptTemplate: 'Version 2 prompt',
        author: 'eng_2'
      });

      // 2. Promote v1 to prod
      registry.promoteRelease('v1.0.0', ENVIRONMENT_TIERS.PRODUCTION, 'release_manager');
      expect(registry.getActiveRelease(ENVIRONMENT_TIERS.PRODUCTION).versionTag).toBe('v1.0.0');

      // 3. Promote v2 to prod
      registry.promoteRelease('v2.0.0', ENVIRONMENT_TIERS.PRODUCTION, 'release_manager');
      expect(registry.getActiveRelease(ENVIRONMENT_TIERS.PRODUCTION).versionTag).toBe('v2.0.0');

      // 4. Rollback to v1
      const restored = registry.rollback('v1.0.0', ENVIRONMENT_TIERS.PRODUCTION, 'qa_lead');
      expect(restored.versionTag).toBe('v1.0.0');
      expect(registry.getActiveRelease(ENVIRONMENT_TIERS.PRODUCTION).versionTag).toBe('v1.0.0');
    });

    it('throws error when promoting or rolling back to non-existent version', () => {
      expect(() => {
        registry.promoteRelease('v9.9.9', ENVIRONMENT_TIERS.PRODUCTION, 'admin');
      }).toThrow(/unknown release version/);

      expect(() => {
        registry.rollback('v9.9.9', ENVIRONMENT_TIERS.PRODUCTION, 'admin');
      }).toThrow(/Target rollback version does not exist/);
    });
  });
});
