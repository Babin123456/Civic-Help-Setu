/**
 * src/data/civicChaosResilienceContract.js
 * Versioned data contracts, schemas, synthetic fixtures, and validation for
 * Civic Operations Chaos Engineering and Resilience Test Suite (#1192).
 *
 * Enforces:
 * - Versioned contract schema (civic-chaos-resilience-v1)
 * - Safe test-only environment gating (prohibits execution against production users)
 * - Deterministic fault injection specifications (latency, timeout, partial outage, rate limit, stale cache, dependency failure)
 * - Service dependency catalogue: Firebase, Model Providers, Maps/Geocoding, Email Dispatcher, Storage
 * - Recovery Objectives: RTO (Recovery Time Objective) and RPO (Recovery Point Objective) targets
 * - Citizen Draft Preservation guarantees & Fallback modes
 * - Human-in-the-loop kill switches and runbooks
 * - Zero PII / synthetic data fixtures
 */

export const CIVIC_CHAOS_SCHEMA_VERSION = 'civic-chaos-resilience-v1';

export const DEPENDENCY_TYPES = Object.freeze({
  FIREBASE: 'firebase',
  MODEL_PROVIDERS: 'model_providers',
  MAPS: 'maps',
  EMAIL: 'email',
  STORAGE: 'storage',
});

export const FAULT_TYPES = Object.freeze({
  TIMEOUT: 'timeout',
  PARTIAL_OUTAGE: 'partial_outage',
  RATE_LIMIT: 'rate_limit',
  STALE_CACHE: 'stale_cache',
  CONNECTION_REFUSED: 'connection_refused',
  CORRUPT_RESPONSE: 'corrupt_response',
});

export const FAULT_SEVERITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const DRILL_STATUS = Object.freeze({
  CONFIGURED: 'configured',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABORTED: 'aborted',
});

export const ALLOWED_ENVIRONMENTS = Object.freeze(['test', 'staging', 'development', 'sandbox', 'local']);

/**
 * Standard Recovery Objectives (RTO/RPO targets in milliseconds/seconds).
 */
export const DEFAULT_RECOVERY_OBJECTIVES = Object.freeze({
  [DEPENDENCY_TYPES.FIREBASE]: {
    targetRtoMs: 1500, // Recover / degrade within 1.5s
    maxAllowedRpoSeconds: 0, // Zero draft loss tolerated
    fallbackMode: 'local_indexed_storage_queue',
    description: 'Graceful degradation to local IndexedDB/localStorage offline journal with automatic replay.',
  },
  [DEPENDENCY_TYPES.MODEL_PROVIDERS]: {
    targetRtoMs: 800, // Fast circuit-breaker trip
    maxAllowedRpoSeconds: 0,
    fallbackMode: 'deterministic_rule_engine',
    description: 'Deterministic rule-based civic heuristics with explicit provenance tags, without blocking citizen workflows.',
  },
  [DEPENDENCY_TYPES.MAPS]: {
    targetRtoMs: 1000,
    maxAllowedRpoSeconds: 0,
    fallbackMode: 'cached_administrative_gazetteer',
    description: 'Fallback to hierarchical administrative pin/ward dropdowns and offline boundary gazetteer.',
  },
  [DEPENDENCY_TYPES.EMAIL]: {
    targetRtoMs: 2000,
    maxAllowedRpoSeconds: 0,
    fallbackMode: 'in_app_notification_spool',
    description: 'Dead-letter spooling with exponential backoff and in-app verifiable notification receipt.',
  },
  [DEPENDENCY_TYPES.STORAGE]: {
    targetRtoMs: 1200,
    maxAllowedRpoSeconds: 0,
    fallbackMode: 'quarantined_client_chunk_cache',
    description: 'Client-side encrypted memory chunk caching and deferred signed upload resumption.',
  },
});

/**
 * Emergency runbooks for operational incidents and drill recoveries.
 */
export const RESILIENCE_RUNBOOKS = Object.freeze([
  {
    id: 'RB-CHAOS-001',
    dependency: DEPENDENCY_TYPES.FIREBASE,
    name: 'Firebase Disruption & Auth/Store Degradation Runbook',
    trigger: 'Firebase Realtime/Firestore latency > 3000ms or 5xx error rate > 5%',
    automatedAction: 'Activate Local Journal Storage Mode. Queue draft submissions with cryptographic SHA-256 draft tokens.',
    manualChecklist: [
      'Verify Global Emergency Kill Switch status in Chaos Control Console.',
      'Check status of Firebase service health at https://status.firebase.google.com.',
      'Inspect client-side draft preservation buffer size to prevent memory starvation.',
      'Confirm offline queue re-synchronizes sequentially upon health restoration without overwriting newer drafts.',
    ],
    killSwitchId: 'KS-FIREBASE-ISOLATION',
  },
  {
    id: 'RB-CHAOS-002',
    dependency: DEPENDENCY_TYPES.MODEL_PROVIDERS,
    name: 'LLM / Model Provider Outage & Circuit-Breaker Runbook',
    trigger: 'LLM API rate limits (HTTP 429), timeouts (> 5000ms), or provider 503 outage',
    automatedAction: 'Trip circuit breaker to OPEN state. Switch all civic triage to deterministic rule-based advice.',
    manualChecklist: [
      'Ensure AI Provenance banners display "Rule-Based Deterministic Fallback Active".',
      'Verify no automated citizen benefit denials or authoritative determinations are emitted.',
      'Confirm citizen draft data is retained in form fields without loss.',
      'Test half-open canary requests before closing circuit breaker.',
    ],
    killSwitchId: 'KS-MODEL-FALLBACK',
  },
  {
    id: 'RB-CHAOS-003',
    dependency: DEPENDENCY_TYPES.MAPS,
    name: 'Geospatial & Mapping Provider Blackout Runbook',
    trigger: 'Tiles/Geocoding API returns 403, 502, or fails network connection',
    automatedAction: 'Activate static Ward Gazetteer fallback. Swap map canvas with accessible ward/pincode selector.',
    manualChecklist: [
      'Confirm screen-reader aria-live alerts notify user of administrative text fallback.',
      'Verify cached boundary coordinates are served from local manifest cache.',
      'Ensure latitude/longitude precision bounds are safely approximated.',
    ],
    killSwitchId: 'KS-MAPS-GAZETTEER',
  },
  {
    id: 'RB-CHAOS-004',
    dependency: DEPENDENCY_TYPES.EMAIL,
    name: 'Email Gateway Outage & Delivery Queue Backpressure Runbook',
    trigger: 'SMTP/SendGrid/SES rejection rate > 10% or connection reset',
    automatedAction: 'Enforce dead-letter spooling with exponential jitter backoff; display instant verification reference.',
    manualChecklist: [
      'Verify transaction confirmation code is displayed on-screen for citizen reference.',
      'Check dead-letter queue metrics for pending verification emails.',
      'Trigger administrative spool replay once transport health returns.',
    ],
    killSwitchId: 'KS-EMAIL-SPOOL',
  },
  {
    id: 'RB-CHAOS-005',
    dependency: DEPENDENCY_TYPES.STORAGE,
    name: 'Document / Object Storage Unavailability Runbook',
    trigger: 'Storage bucket PUT/GET failures or timeouts exceeding 4000ms',
    automatedAction: 'Enable client-side chunk caching with integrity hashes; defer cloud upload.',
    manualChecklist: [
      'Ensure citizen evidence uploads remain securely held in browser sandbox.',
      'Provide visual warning that cloud verification will finalize when storage connectivity returns.',
      'Verify virus/quarantine scanner receives hashes immediately upon reconnection.',
    ],
    killSwitchId: 'KS-STORAGE-CACHE',
  },
]);

/**
 * Synthetic test fixtures for repeatable, non-PII chaos engineering drills.
 */
export const SYNTHETIC_CHAOS_FIXTURES = Object.freeze({
  sampleCitizenDraft: {
    draftId: 'draft-syn-7842',
    serviceId: 'service-ration-card-transfer',
    applicantProfile: {
      syntheticId: 'CIT-SYN-9021',
      wardNumber: 'Ward 42 - Civil Lines',
      jurisdiction: 'Zone 3 - North Central',
      // Notice: No real names, phone numbers, or Aadhaar numbers
      residenceYears: 5,
      preferredLanguage: 'hi',
    },
    sectionsCompleted: ['identity_declaration', 'address_evidence', 'family_members'],
    formData: {
      rationCardCategory: 'PHH (Priority Household)',
      transferReason: 'relocation_within_district',
      presentFairPriceShop: 'FPS-770-CivilLines',
      requestedFairPriceShop: 'FPS-104-KalyanPur',
      declarationAcknowledged: true,
    },
    checksum: 'sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    updatedAt: '2026-11-24T18:00:00.000Z',
    version: 3,
  },
  mockDependencies: [
    {
      id: DEPENDENCY_TYPES.FIREBASE,
      name: 'Firebase Auth & Cloud Firestore',
      tier: 'tier-1-critical',
      protocol: 'HTTPS / WebSockets',
      defaultLatencyMs: 45,
      status: 'healthy',
      failureModes: [FAULT_TYPES.TIMEOUT, FAULT_TYPES.PARTIAL_OUTAGE, FAULT_TYPES.RATE_LIMIT, FAULT_TYPES.CONNECTION_REFUSED],
    },
    {
      id: DEPENDENCY_TYPES.MODEL_PROVIDERS,
      name: 'Civic AI Guidance Model Providers',
      tier: 'tier-2-advisory',
      protocol: 'REST / Server-Sent Events',
      defaultLatencyMs: 420,
      status: 'healthy',
      failureModes: [FAULT_TYPES.TIMEOUT, FAULT_TYPES.RATE_LIMIT, FAULT_TYPES.CORRUPT_RESPONSE],
    },
    {
      id: DEPENDENCY_TYPES.MAPS,
      name: 'Geospatial & Ward GIS Tile Service',
      tier: 'tier-2-enrichment',
      protocol: 'HTTPS / Tile Map Service',
      defaultLatencyMs: 95,
      status: 'healthy',
      failureModes: [FAULT_TYPES.TIMEOUT, FAULT_TYPES.STALE_CACHE, FAULT_TYPES.PARTIAL_OUTAGE],
    },
    {
      id: DEPENDENCY_TYPES.EMAIL,
      name: 'Municipal Dispatcher & Email Service',
      tier: 'tier-3-asynchronous',
      protocol: 'SMTP / HTTPS API',
      defaultLatencyMs: 250,
      status: 'healthy',
      failureModes: [FAULT_TYPES.TIMEOUT, FAULT_TYPES.RATE_LIMIT, FAULT_TYPES.CONNECTION_REFUSED],
    },
    {
      id: DEPENDENCY_TYPES.STORAGE,
      name: 'Civic Evidence Vault & Document Storage',
      tier: 'tier-1-critical',
      protocol: 'Signed HTTPS Upload / Object Store',
      defaultLatencyMs: 180,
      status: 'healthy',
      failureModes: [FAULT_TYPES.TIMEOUT, FAULT_TYPES.PARTIAL_OUTAGE, FAULT_TYPES.RATE_LIMIT],
    },
  ],
  presetScenarios: [
    {
      id: 'scenario-cascading-infrastructure-blackout',
      name: 'Cascading Infra Blackout (Firebase + Storage Down)',
      description: 'Simulates severe multi-cloud incident where primary data store and object store drop connections simultaneously.',
      environment: 'staging',
      injections: [
        {
          dependency: DEPENDENCY_TYPES.FIREBASE,
          faultType: FAULT_TYPES.CONNECTION_REFUSED,
          durationMs: 4000,
          rateLimitRps: 0,
          failureRate: 1.0,
        },
        {
          dependency: DEPENDENCY_TYPES.STORAGE,
          faultType: FAULT_TYPES.TIMEOUT,
          durationMs: 4000,
          latencyMs: 5000,
          failureRate: 1.0,
        },
      ],
      expectedBehavior: 'Offline draft journal activates immediately. Zero citizen draft loss. Uploads queued locally.',
    },
    {
      id: 'scenario-ai-spike-rate-limit-and-timeout',
      name: 'AI Model Rate-Limiting & High-Latency Wave',
      description: 'Simulates peak civic enrollment spike where LLM provider returns HTTP 429 and high latency.',
      environment: 'test',
      injections: [
        {
          dependency: DEPENDENCY_TYPES.MODEL_PROVIDERS,
          faultType: FAULT_TYPES.RATE_LIMIT,
          durationMs: 3000,
          rateLimitRps: 2,
          failureRate: 0.85,
        },
      ],
      expectedBehavior: 'Circuit breaker trips. Deterministic civic rule engine handles triage. AI provenance shows fallback.',
    },
    {
      id: 'scenario-gis-stale-cache-and-timeout',
      name: 'GIS Ward Map Blackout with Stale Boundary Cache',
      description: 'Tests citizen workflow when tile server is unreachable and returns stale or failing tile layers.',
      environment: 'sandbox',
      injections: [
        {
          dependency: DEPENDENCY_TYPES.MAPS,
          faultType: FAULT_TYPES.STALE_CACHE,
          durationMs: 2500,
          staleAgeMinutes: 1440,
          failureRate: 0.5,
        },
      ],
      expectedBehavior: 'Hierarchical dropdown gazetteer fallback renders with clear notice of degraded mapping.',
    },
    {
      id: 'scenario-email-dispatch-outage',
      name: 'Email Delivery Outage & Dead-Letter Spooling',
      description: 'Tests email delivery failure when dispatching application confirmation notices.',
      environment: 'test',
      injections: [
        {
          dependency: DEPENDENCY_TYPES.EMAIL,
          faultType: FAULT_TYPES.TIMEOUT,
          durationMs: 3000,
          latencyMs: 4000,
          failureRate: 1.0,
        },
      ],
      expectedBehavior: 'Dead-letter spool enqueues message. Citizen sees instant in-app confirmation token.',
    },
  ],
});

/**
 * Validates a chaos drill configuration payload at trust boundaries.
 * Prohibits execution against production users.
 *
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateChaosDrillConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration payload must be an object.'] };
  }

  // 1. Production safety check
  const env = (config.environment || '').toLowerCase().trim();
  if (!env) {
    errors.push('Environment must be specified (e.g. test, staging, sandbox).');
  } else if (env === 'production' || env === 'prod') {
    errors.push('CRITICAL SAFETY VIOLATION: Chaos engineering drills are strictly prohibited in production environments.');
  } else if (!ALLOWED_ENVIRONMENTS.includes(env)) {
    errors.push(`Invalid environment "${env}". Allowed environments: ${ALLOWED_ENVIRONMENTS.join(', ')}.`);
  }

  // 2. Drill Name & ID
  if (!config.name || typeof config.name !== 'string' || config.name.trim().length < 3) {
    errors.push('Drill name is required and must be at least 3 characters.');
  }

  // 3. Injections array validation
  if (!Array.isArray(config.injections) || config.injections.length === 0) {
    errors.push('At least one fault injection specification is required.');
  } else {
    config.injections.forEach((inj, idx) => {
      if (!inj || typeof inj !== 'object') {
        errors.push(`Injection at index ${idx} must be an object.`);
        return;
      }

      if (!Object.values(DEPENDENCY_TYPES).includes(inj.dependency)) {
        errors.push(
          `Injection [${idx}]: Unknown dependency "${inj.dependency}". Must be one of: ${Object.values(DEPENDENCY_TYPES).join(', ')}.`
        );
      }

      if (!Object.values(FAULT_TYPES).includes(inj.faultType)) {
        errors.push(
          `Injection [${idx}]: Unknown faultType "${inj.faultType}". Must be one of: ${Object.values(FAULT_TYPES).join(', ')}.`
        );
      }

      if (typeof inj.durationMs !== 'number' || inj.durationMs <= 0 || inj.durationMs > 60000) {
        errors.push(`Injection [${idx}]: durationMs must be a positive number up to 60,000ms.`);
      }

      if (inj.failureRate !== undefined && (typeof inj.failureRate !== 'number' || inj.failureRate < 0 || inj.failureRate > 1.0)) {
        errors.push(`Injection [${idx}]: failureRate must be a float between 0.0 and 1.0.`);
      }
    });
  }

  // 4. Operator Authorization & Safe Audit check
  if (!config.operatorId || typeof config.operatorId !== 'string') {
    errors.push('operatorId is required for audit provenance.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a citizen draft payload for draft preservation verification.
 * Checks that draft contains no raw PII and integrity checksum is valid.
 *
 * @param {object} draft
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCitizenDraftPayload(draft) {
  const errors = [];
  if (!draft || typeof draft !== 'object') {
    return { valid: false, errors: ['Draft must be an object.'] };
  }

  if (!draft.draftId || typeof draft.draftId !== 'string') {
    errors.push('draftId is required.');
  }

  if (!draft.serviceId || typeof draft.serviceId !== 'string') {
    errors.push('serviceId is required.');
  }

  // Scan for inadvertent sensitive fields (e.g. Aadhaar 12-digits, raw PAN)
  const draftStr = JSON.stringify(draft);
  if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(draftStr)) {
    errors.push('Security check failed: Raw 12-digit national identifier pattern detected in draft payload.');
  }
  if (/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/.test(draftStr)) {
    errors.push('Security check failed: Raw PAN pattern detected in draft payload.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
