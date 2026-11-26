/**
 * Multi-Region Read Layer — Core Types
 *
 * Pure type definitions and constants. No side effects, no I/O.
 * Shared by all multi-region read components.
 */

// ============================================================================
// Region & Replica Definitions
// ============================================================================

/** Residency classification for data governance */
export const RESIDENCY_CLASS = Object.freeze({
  INDIA: 'india',        // Data must stay in India (sensitive citizen data)
  GLOBAL: 'global',      // Public reference data, can replicate anywhere approved
});

/** Consistency levels for read operations */
export const CONSISTENCY_LEVEL = Object.freeze({
  /** Strong consistency: read from primary, or replica validated via RYW token */
  STRONG: 'strong',
  /** Bounded staleness: read from nearest healthy replica, disclose lag */
  BOUNDED_STALE: 'bounded_stale',
  /** Eventual consistency: read from any replica, no lag disclosure required */
  EVENTUAL: 'eventual',
});

/** Replica health status */
export const REPLICA_HEALTH = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  DRAINING: 'draining',
  RECOVERING: 'recovering',
});

/** Read routing decision reason codes */
export const ROUTING_REASON = Object.freeze({
  PRIMARY_ONLY: 'primary_only',                 // Sensitive data, primary required
  RYW_TOKEN_VALID: 'ryw_token_valid',           // RYW token validated, replica caught up
  RYW_TOKEN_FORCED_PRIMARY: 'ryw_token_forced_primary', // RYW token but replica lagging
  NEAREST_HEALTHY: 'nearest_healthy',           // Default: nearest healthy replica
  FAILOVER_TO_PRIMARY: 'failover_to_primary',   // All replicas unhealthy
  FAILOVER_TO_REPLICA: 'failover_to_replica',   // Primary failed, read from replica
  EXPLICIT_REGION: 'explicit_region',           // Client requested specific region
  WEIGHTED_RANDOM: 'weighted_random',           // Load balanced across healthy replicas
});

/** Region configuration */
export const createRegionConfig = ({
  id,
  displayName,
  residency = RESIDENCY_CLASS.GLOBAL,
  firestoreDatabaseId = '(default)',
  firestoreProjectId = null, // null = same project
  weight = 100,              // Routing weight (0-1000)
  maxLagMs = 5000,           // Max acceptable lag before marking degraded
  maxLagCriticalMs = 10000,  // Max lag before marking unhealthy
  readOnly = true,           // Replicas are read-only
} = {}) => ({
  id,
  displayName,
  residency,
  firestoreDatabaseId,
  firestoreProjectId,
  weight,
  maxLagMs,
  maxLagCriticalMs,
  readOnly,
});

/** Replica runtime state */
export const createReplicaState = ({
  regionId,
  health = REPLICA_HEALTH.HEALTHY,
  lastHeartbeatAt = null,
  lastReplicatedCommitTs = 0,
  lagMs = 0,
  errorRate5m = 0,
  consecutiveErrors = 0,
  weight = 100,              // Effective weight (adjusted by health)
  drainingSince = null,
  recoveringSince = null,
} = {}) => ({
  regionId,
  health,
  lastHeartbeatAt,
  lastReplicatedCommitTs,
  lagMs,
  errorRate5m,
  consecutiveErrors,
  weight,
  drainingSince,
  recoveringSince,
});

// ============================================================================
// Read-Your-Writes Token Types
// ============================================================================

/** RYW token payload (JWS) */
export const RYW_TOKEN_CLAIMS = Object.freeze({
  SUB: 'sub',                 // User ID
  PRIMARY_COMMIT_TS: 'pct',   // Primary commit timestamp (ms since epoch)
  WRITE_OP_ID: 'woi',         // Unique write operation ID
  ISSUED_AT: 'iat',           // Token issuance timestamp
  EXPIRY: 'exp',              // Token expiry timestamp
  NONCE: 'nonce',             // Cryptographic nonce
});

/** Create RYW token payload */
export const createRywTokenPayload = ({
  userId,
  primaryCommitTs,
  writeOpId,
  issuedAt = Date.now(),
  ttlMs = 3600000, // 1 hour default
  nonce = crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), ''),
} = {}) => ({
  [RYW_TOKEN_CLAIMS.SUB]: userId,
  [RYW_TOKEN_CLAIMS.PRIMARY_COMMIT_TS]: primaryCommitTs,
  [RYW_TOKEN_CLAIMS.WRITE_OP_ID]: writeOpId,
  [RYW_TOKEN_CLAIMS.ISSUED_AT]: issuedAt,
  [RYW_TOKEN_CLAIMS.EXPIRY]: issuedAt + ttlMs,
  [RYW_TOKEN_CLAIMS.NONCE]: nonce,
});

/** Validation result for RYW token */
export const RYW_VALIDATION_RESULT = Object.freeze({
  ALLOWED: 'allowed',                    // Replica caught up, read allowed
  ROUTED_TO_PRIMARY: 'routed_to_primary', // Replica lagging, routed to primary
  EXPIRED: 'expired',                     // Token expired
  INVALID: 'invalid',                     // Token malformed or signature invalid
  USER_MISMATCH: 'user_mismatch',         // Token user doesn't match request user
});

// ============================================================================
// Request & Response Types
// ============================================================================

/** Client context for routing decisions */
export const createClientContext = ({
  userId = null,
  explicitRegion = null,      // Client-requested region (header)
  geoRegion = null,           // Geo-IP inferred region
  sessionToken = null,        // RYW token from client
  consistencyHint = null,     // Client-requested consistency level
  isAdmin = false,            // Admin bypasses some restrictions
} = {}) => ({
  userId,
  explicitRegion,
  geoRegion,
  sessionToken,
  consistencyHint,
  isAdmin,
});

/** Routing decision output */
export const createRoutingDecision = ({
  replicaId,
  regionId,
  consistencyLevel = CONSISTENCY_LEVEL.BOUNDED_STALE,
  reason = ROUTING_REASON.NEAREST_HEALTHY,
  replicaLagMs = 0,
  primaryCommitTs = 0,
  tokenValidated = false,
  staleRead = false,
  failover = false,
} = {}) => ({
  replicaId,
  regionId,
  consistencyLevel,
  reason,
  replicaLagMs,
  primaryCommitTs,
  tokenValidated,
  staleRead,
  failover,
});

/** Response metadata injected by response decorator */
export const createResponseMeta = ({
  servedByRegion,
  consistencyLevel,
  replicaLagMs = 0,
  primaryRegion,
  staleRead = false,
  failover = false,
  routingReason = null,
} = {}) => ({
  servedByRegion,
  consistencyLevel,
  replicaLagMs,
  primaryRegion,
  staleRead,
  failover,
  routingReason,
});

// ============================================================================
// Heartbeat & Monitoring Types
// ============================================================================

/** Replica heartbeat document (stored in Firestore) */
export const createHeartbeatDoc = ({
  replicaId,
  regionId,
  lastReplicatedCommitTs,
  lagMs,
  healthy = true,
  errorRate5m = 0,
  version = 1,
} = {}) => ({
  replicaId,
  regionId,
  lastReplicatedCommitTs,
  lagMs,
  healthy,
  errorRate5m,
  version,
  updatedAt: new Date().toISOString(),
});

/** Health check result */
export const createHealthCheckResult = ({
  replicaId,
  regionId,
  healthy,
  lagMs,
  errorRate5m,
  lastHeartbeatAgeMs,
  issues = [],
} = {}) => ({
  replicaId,
  regionId,
  healthy,
  lagMs,
  errorRate5m,
  lastHeartbeatAgeMs,
  issues,
  checkedAt: Date.now(),
});

// ============================================================================
// Configuration Constants
// ============================================================================

export const DEFAULT_CONFIG = Object.freeze({
  // Heartbeat
  HEARTBEAT_INTERVAL_MS: 10000,
  HEARTBEAT_TTL_MS: 60000,           // Missing heartbeat = unhealthy after 60s

  // Health thresholds
  DEGRADED_LAG_MS: 2000,             // Lag > 2s = degraded
  UNHEALTHY_LAG_MS: 10000,           // Lag > 10s = unhealthy
  MAX_ERROR_RATE_5M: 0.05,           // 5% error rate = unhealthy
  MAX_CONSECUTIVE_ERRORS: 5,         // 5 consecutive errors = unhealthy

  // Failover
  DRAIN_TIMEOUT_MS: 30000,           // Max time to drain in-flight requests
  RECOVERY_OBSERVATION_MS: 60000,    // Must be healthy for 60s before re-enable
  RECOVERY_RAMP_STEPS: [0.1, 0.5, 1.0], // 10% -> 50% -> 100% over 5 min
  RECOVERY_RAMP_INTERVAL_MS: 100000, // ~1.6 min per step

  // RYW Tokens
  RYW_TOKEN_TTL_MS: 3600000,         // 1 hour
  RYW_TOKEN_MAX_AGE_MS: 86400000,    // Max token age 24h (for cleanup)

  // Routing
  DEFAULT_CONSISTENCY: CONSISTENCY_LEVEL.BOUNDED_STALE,
  PRIMARY_REGION_ID: 'asia-south1',  // Mumbai - primary for India residency

  // Feature flag
  ENABLED: true,
  ROLLOUT_PERCENT: 100,
});

// ============================================================================
// Data Classification (which collections replicate where)
// ============================================================================

/** Collections that are PUBLIC REFERENCE DATA — replicate globally */
export const PUBLIC_REFERENCE_COLLECTIONS = Object.freeze([
  'services',
  'notices',
  'barrierInsights',
  'service_versions',
  'change_events',
  'task_categories',
  'micro_tasks',
  'publicToiletSubmissions', // moderated view only
  'shelter_sites',
  'capacity_snapshots',
  'facility_services',
  'operator_accounts', // public fields only
  'status_events',
  'verification_checks',
  'review_approvals',
  'communityAudits', // public view
]);

/** Collections that are CITIZEN SUBMISSIONS (anonymized) — replicate globally */
export const ANONYMIZED_SUBMISSION_COLLECTIONS = Object.freeze([
  'errorReports',
  'serviceSubmissions',
  'barrierReports',
  'bottleneckFeedback',
  // communityAudits votes are public
]);

/** Collections that are SENSITIVE CITIZEN DATA — NEVER replicate, primary only */
export const SENSITIVE_CITIZEN_COLLECTIONS = Object.freeze([
  'users',                    // users/{uid}/* — all subcollections
  'vaultDocs',
  'applications',
  'grievanceTickets',
  'applicantProfiles',
  'privacyExports',
  'privacyExportAudit',
  'auditLogs',
  'roles',
  'reviewOverrides',
  'sourceConflicts',
  'delivery_attempts',
  'user_subscriptions',
  'task_claims',
  'completion_submissions',
  'moderation_events',
  'officeTokens',
  'reminders',
  'settings',
  'assessments',
  'checklists',
  'drafts',
  'scorecards',
  'assistantChats',
  'saved',
]);

/** Admin/Operator collections — primary only */
export const ADMIN_ONLY_COLLECTIONS = Object.freeze([
  'roles',
  'operator_accounts', // full docs
  'reviewOverrides',
  'sourceConflicts',
  'auditLogs',
]);

/** Check if a collection path should be replicated */
export const shouldReplicateCollection = (collectionPath) => {
  // Sensitive data: never replicate
  for (const sensitive of SENSITIVE_CITIZEN_COLLECTIONS) {
    if (collectionPath === sensitive || collectionPath.startsWith(`${sensitive}/`)) {
      return false;
    }
  }
  // Admin only: never replicate
  for (const admin of ADMIN_ONLY_COLLECTIONS) {
    if (collectionPath === admin || collectionPath.startsWith(`${admin}/`)) {
      return false;
    }
  }
  // Public reference: replicate
  for (const pub of PUBLIC_REFERENCE_COLLECTIONS) {
    if (collectionPath === pub || collectionPath.startsWith(`${pub}/`)) {
      return true;
    }
  }
  // Anonymized submissions: replicate
  for (const anon of ANONYMIZED_SUBMISSION_COLLECTIONS) {
    if (collectionPath === anon || collectionPath.startsWith(`${anon}/`)) {
      return true;
    }
  }
  // Default: deny replication for safety
  return false;
};

/** Check if a collection requires India residency */
export const requiresIndiaResidency = (collectionPath) => {
  for (const sensitive of SENSITIVE_CITIZEN_COLLECTIONS) {
    if (collectionPath === sensitive || collectionPath.startsWith(`${sensitive}/`)) {
      return true;
    }
  }
  for (const admin of ADMIN_ONLY_COLLECTIONS) {
    if (collectionPath === admin || collectionPath.startsWith(`${admin}/`)) {
      return true;
    }
  }
  return false;
};

// ============================================================================
// HTTP Header Names
// ============================================================================

export const HTTP_HEADERS = Object.freeze({
  // Request headers
  CLIENT_REGION: 'x-client-region',
  CONSISTENCY_HINT: 'x-consistency-hint',
  RYW_TOKEN: 'x-read-your-writes-token',

  // Response headers
  SERVED_BY_REGION: 'x-served-by-region',
  CONSISTENCY_LEVEL: 'x-consistency-level',
  REPLICA_LAG_MS: 'x-replica-lag-ms',
  PRIMARY_REGION: 'x-primary-region',
  STALE_READ: 'x-stale-read',
  FAILOVER: 'x-failover',
  ROUTING_REASON: 'x-routing-reason',
  RYW_TOKEN_ISSUED: 'x-read-your-writes-token', // Same name for issued token
});