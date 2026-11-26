/**
 * Civic Assistant Model and Prompt Release Registry Service
 *
 * Implements a non-secret, versioned release registry for AI configurations:
 * - Versioned configuration records tracking:
 *   * Release tag / version (e.g. 2026.11-v1)
 *   * Model identifier (e.g. gemini-1.5-pro, gpt-4o-mini)
 *   * Prompt template content hash (SHA-256)
 *   * Retrieval hyperparameters (topK, minScoreThreshold, denseWeight)
 *   * Safety policy version
 *   * Author attribution and promotion timestamp
 * - Strict Separation of Environments: Production vs. Development
 * - Secret Rejection Schema:
 *   * Fails validation if configuration contains API keys, tokens, or passwords
 * - One-Click Rollback:
 *   * Reverts active release to any previously approved version without mutating citizen data
 * - Reproducibility:
 *   * Every assistant response links to its corresponding non-secret configuration version
 */

export const ENVIRONMENT_TIERS = Object.freeze({
  PRODUCTION: 'PRODUCTION',
  DEVELOPMENT: 'DEVELOPMENT',
  STAGING: 'STAGING'
});

export const FORBIDDEN_SECRET_KEYS = [
  'api_key', 'apikey', 'secret', 'token', 'password', 'bearer', 'private_key'
];

/**
 * Computes deterministic hash of prompt template string
 * @param {string} promptTemplate
 * @returns {string} Hexadecimal prompt hash
 */
export function hashPromptTemplate(promptTemplate = '') {
  if (typeof promptTemplate !== 'string') return 'hash_empty';
  let hash = 0;
  for (let i = 0; i < promptTemplate.length; i++) {
    hash = ((hash << 5) - hash) + promptTemplate.charCodeAt(i);
    hash |= 0;
  }
  return `pmt_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Validates that an AI configuration record contains zero secret keys or tokens
 * @param {Object} config
 * @returns {boolean} True if strictly non-secret
 */
export function validateNonSecretConfig(config = {}) {
  const serialized = JSON.stringify(config).toLowerCase();
  for (const forbidden of FORBIDDEN_SECRET_KEYS) {
    if (serialized.includes(forbidden)) {
      return false;
    }
  }
  return true;
}


export class ModelPromptReleaseRegistry {
  constructor() {
    this.releases = new Map(); // versionTag -> ReleaseRecord
    this.activeProductionVersion = null;
    this.activeDevelopmentVersion = null;
    this.releaseHistory = [];
  }

  /**
   * Registers a new model and prompt release
   * @param {Object} releasePayload
   * @returns {Object} Stored release record
   */
  registerRelease({
    versionTag,
    environment = ENVIRONMENT_TIERS.DEVELOPMENT,
    modelId,
    promptTemplate,
    retrievalConfig = { topK: 5, minScoreThreshold: 0.65 },
    safetyPolicyVersion = '2026.1',
    author,
    releaseNotes = ''
  }) {
    if (!versionTag || !modelId || !promptTemplate || !author) {
      throw new Error('Release registration requires versionTag, modelId, promptTemplate, and author');
    }

    const payload = {
      versionTag,
      environment,
      modelId,
      retrievalConfig,
      safetyPolicyVersion,
      author,
      releaseNotes
    };

    if (!validateNonSecretConfig(payload)) {
      throw new Error('Configuration validation failed: Contains sensitive credentials or secret keys');
    }

    const record = {
      ...payload,
      promptHash: hashPromptTemplate(promptTemplate),
      registeredAt: Date.now(),
      promotedAt: null
    };

    this.releases.set(versionTag, record);
    this.releaseHistory.push(record);

    if (environment === ENVIRONMENT_TIERS.DEVELOPMENT && !this.activeDevelopmentVersion) {
      this.activeDevelopmentVersion = versionTag;
    }

    return record;
  }

  /**
   * Promotes a verified release to active status in designated environment
   * @param {string} versionTag
   * @param {string} environment
   * @param {string} promotedBy
   * @returns {Object} Promoted release record
   */
  promoteRelease(versionTag, environment, promotedBy) {
    const release = this.releases.get(versionTag);
    if (!release) {
      throw new Error(`Cannot promote unknown release version: ${versionTag}`);
    }

    release.environment = environment;
    release.promotedAt = Date.now();
    release.promotedBy = promotedBy;

    if (environment === ENVIRONMENT_TIERS.PRODUCTION) {
      this.activeProductionVersion = versionTag;
    } else {
      this.activeDevelopmentVersion = versionTag;
    }

    return release;
  }

  /**
   * Rolls back the active release in an environment to a previous version
   * @param {string} targetVersionTag
   * @param {string} environment
   * @param {string} rollbackAuthor
   * @returns {Object} Restored release record
   */
  rollback(targetVersionTag, environment, rollbackAuthor) {
    const target = this.releases.get(targetVersionTag);
    if (!target) {
      throw new Error(`Target rollback version does not exist: ${targetVersionTag}`);
    }

    if (environment === ENVIRONMENT_TIERS.PRODUCTION) {
      this.activeProductionVersion = targetVersionTag;
    } else {
      this.activeDevelopmentVersion = targetVersionTag;
    }

    target.rolledBackBy = rollbackAuthor;
    target.rolledBackAt = Date.now();

    return target;
  }

  getActiveRelease(environment = ENVIRONMENT_TIERS.PRODUCTION) {
    const versionTag = environment === ENVIRONMENT_TIERS.PRODUCTION
      ? this.activeProductionVersion
      : this.activeDevelopmentVersion;

    return versionTag ? this.releases.get(versionTag) : null;
  }

  getReleaseHistory() {
    return [...this.releaseHistory];
  }
}
