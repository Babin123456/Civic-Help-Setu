/**
 * api/_lib/gateway/index.js
 *
 * Public barrel for the API Gateway Layer.
 */

export {
  CONSUMER_TIERS,
  TIER_DEFAULTS,
  AUTH_METHODS,
  createConsumerRecord,
  ConsumerRegistry,
  createConsumerRegistryWithDefaults,
  getDefaultConsumerRegistry,
  setDefaultConsumerRegistry,
} from './consumerRegistry.js';

export {
  DEPRECATION_STAGES,
  getDeprecationStage,
  getDeprecationDetail,
  buildDeprecationHeaders,
  shouldRejectVersion,
  getSunsetRejection,
  getDeprecationWarning,
  getAllVersionsDeprecationStatus,
  DeprecationManager,
} from './deprecationManager.js';

export {
  COMPATIBILITY_LEVELS,
  analyzeCompatibility,
  generateCompatibilityMatrix,
  generateMigrationGuide,
  generateUpgradeAdvisory,
  generateCompatibilityReport,
  checkRuntimeCompatibility,
  generateOpenAPICompatibilityExtension,
} from './compatibilityReporter.js';

export {
  createGatewayMiddleware,
  createDefaultGatewayMiddleware,
  getGatewayHealth,
  getGatewayMetrics,
  FEATURES,
} from './gatewayMiddleware.js';