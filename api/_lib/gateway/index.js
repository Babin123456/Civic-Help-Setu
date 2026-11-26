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

// Adaptive Concurrency & Backpressure
export {
  createConcurrencyController,
  PRIORITY_CLASSES,
  DEFAULT_ROUTE_CONFIG,
  DEFAULT_PRIORITY_LANE_CONFIG,
  DEFAULT_EMERGENCY_BRAKE_CONFIG,
} from '../concurrencyController.js';

export {
  createBoundedQueue,
  QUEUE_PRIORITIES,
  PRIORITY_RANK,
  DEFAULT_QUEUE_CONFIG,
} from '../boundedQueue.js';

export {
  createBackpressureMiddleware,
  createDefaultBackpressureMiddleware,
  BACKPRESSURE_MODES,
  DEFAULT_BACKPRESSURE_CONFIG,
} from '../backpressureMiddleware.js';