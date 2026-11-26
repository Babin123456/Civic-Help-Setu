/**
 * api/_lib/versioning/index.js
 *
 * Public barrel for the API Versioning Layer.
 */

export {
  VERSION_SOURCES,
  VERSION_HEADER_NAMES,
  extractFromAcceptHeader,
  extractFromCustomHeaders,
  extractFromUrlPath,
  extractFromQueryParam,
  normalizeVersion,
  getDeprecationInfo,
  negotiateVersion,
  buildVersionHeaders,
  isVersionSupported,
  getSupportedVersions,
} from './negotiator.js';

export {
  SUPPORTED_VERSIONS,
  DEFAULT_VERSION,
  VERSION_PATTERN,
  DEPRECATION_POLICY,
  VERSION_CONFIG,
  COMPATIBILITY_MATRIX,
  OPENAPI_SPEC_URLS,
  getVersionConfig,
  isCurrentVersion,
  getLatestVersion,
} from './versionConfig.js';

export {
  ContractRegistry,
  createRegistryWithEmbeddedContracts,
  getDefaultRegistry,
  setDefaultRegistry,
  CONTRACT_CACHE_TTL_MS,
} from './contractRegistry.js';