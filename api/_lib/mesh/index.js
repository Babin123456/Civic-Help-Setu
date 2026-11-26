/**
 * api/_lib/mesh/index.js
 *
 * Public barrel for the Internal Service Mesh Readiness Layer (#1276).
 */

export {
  parseTraceparent,
  formatTraceparent,
  extractOrCreateTraceContext,
  createChildSpanContext,
  injectTraceHeaders,
  scrubTelemetryPayload,
  createTelemetryCollector,
} from './traceContext.js';

export {
  KEY_STATUS,
  MESH_TRANSPORT_MODES,
  DEFAULT_CLOCK_SKEW_SECONDS,
  DEFAULT_ASSERTION_TTL_SECONDS,
  generateServiceKeyPair,
  computeRequestDigest,
  createServiceKeyring,
  signServiceAssertion,
  signServerProof,
  verifyServerProof,
  parseXfccHeader,
  verifyServiceRequest,
} from './serviceIdentity.js';

export {
  BREAKER_STATES,
  DEFAULT_RESILIENCE_CONFIG,
  MeshResilienceError,
  computeBackoffMs,
  createDependencyPolicy,
  createMeshServiceClient,
} from './resilience.js';

export {
  MESH_AUTH_MODES,
  resolveMeshConfig,
  createMeshReadinessLayer,
} from './middleware.js';
