/* global process */
/**
 * Multi-Region Read Integration for API Handlers
 *
 * Provides drop-in helpers for existing API handlers to use multi-region reads.
 * Wraps Firestore access with region-aware routing.
 */

import { createMultiRegionReadLayer, createMultiRegionMiddleware } from '../../src/services/multiRegionRead/index.js';
import { getFirestoreAdmin } from './firebaseAdmin.js';

// ============================================================================
// Singleton Instance (initialized on first use)
// ============================================================================

let multiRegionInstance = null;
let initializationPromise = null;

/** Get or create the multi-region read layer instance */
export const getMultiRegionInstance = async () => {
  if (multiRegionInstance) return multiRegionInstance;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    // Initialize Firestore admin for primary region
    await getFirestoreAdmin();

    // Create multi-region layer
    multiRegionInstance = createMultiRegionReadLayer({
      config: {
        ENABLED: process.env.MULTI_REGION_READS_ENABLED !== 'false',
        ROLLOUT_PERCENT: parseInt(process.env.MULTI_REGION_READS_ROLLOUT_PERCENT || '100', 10),
        PRIMARY_REGION_ID: process.env.MULTI_REGION_PRIMARY_REGION || 'asia-south1',
      },
      tokenSecret: process.env.RYW_TOKEN_SECRET,
      onAlert: (alert) => {
        console.log('[MultiRegion Alert]', JSON.stringify(alert));
        // In production: send to alerting system (PagerDuty, DataDog, etc.)
      },
      onConfigChange: (config) => {
        console.log('[MultiRegion Config]', JSON.stringify(config));
        // In production: persist to config store
      },
      onMetrics: () => {
        // In production: send to metrics system (Prometheus, Cloud Monitoring)
      },
    });

    return multiRegionInstance;
  })();

  return initializationPromise;
};

// ============================================================================
// Firestore Replica Client Factory
// ============================================================================

/** Cache of Firestore clients per region */
const firestoreClients = new Map();

/** Get Firestore client for a region */
export const getFirestoreForRegion = async (regionId) => {
  if (firestoreClients.has(regionId)) {
    return firestoreClients.get(regionId);
  }

  const multiRegion = await getMultiRegionInstance();
  const regionConfig = multiRegion.registryValidation?.valid
    ? multiRegion.getRegion?.(regionId)
    : null;

  // Base Firestore admin instance
  const db = await getFirestoreAdmin();

  // Wrap with region metadata
  const client = {
    db,
    regionId,
    displayName: regionConfig?.displayName || regionId,
    residency: regionConfig?.residency || 'global',
    databaseId: regionConfig?.firestoreDatabaseId || '(default)',
    readOnly: regionConfig?.readOnly ?? (regionId !== 'asia-south1'),
    isPrimary: regionId === 'asia-south1',
  };

  firestoreClients.set(regionId, client);
  return client;
};

// ============================================================================
// Read Execution Helpers
// ============================================================================

/**
 * Execute a read operation on the appropriate region.
 * Automatically handles routing, RYW tokens, and response decoration.
 */
export const executeMultiRegionRead = async (req, res, collectionPath, readFn, options = {}) => {
  const multiRegion = await getMultiRegionInstance();

  // Build client context
  const user = req.auth?.userId ? { id: req.auth.userId, role: req.auth.role } : null;
  const clientContext = multiRegion.buildClientContext(req.headers, user);

  // Route the read
  const routingDecision = await multiRegion.routeRead({
    collectionPath,
    clientContext,
    requiredConsistency: options.requiredConsistency,
  });

  // Get Firestore client for the selected region
  const firestore = await getFirestoreForRegion(routingDecision.regionId);

  // Track draining request if replica is in draining state
  const isDraining = multiRegion.failoverController?.drainingRequests?.has(routingDecision.regionId);
  if (isDraining) {
    multiRegion.trackDrainingRequest(routingDecision.regionId, 1);
  }

  try {
    // Execute the read function with region context
    const result = await readFn({
      db: firestore.db,
      regionId: routingDecision.regionId,
      replicaId: routingDecision.replicaId,
      routingDecision,
      isPrimary: firestore.isPrimary,
    });

    // Decorate response
    multiRegion.decorateResponse(res, routingDecision, {
      requestId: req.id || req.headers['x-request-id'],
      includeDebugHeaders: process.env.NODE_ENV !== 'production',
    });

    return { result, routingDecision };
  } catch (error) {
    // Record error for health monitoring
    multiRegion.healthMonitor.recordError?.(routingDecision.regionId);
    throw error;
  } finally {
    if (isDraining) {
      multiRegion.trackDrainingRequest(routingDecision.regionId, -1);
    }
  }
};

/**
 * Execute a write operation (always on primary) and issue RYW token.
 */
export const executeMultiRegionWrite = async (req, res, writeFn) => {
  const multiRegion = await getMultiRegionInstance();

  // Writes always go to primary
  const firestore = await getFirestoreForRegion('asia-south1');

  const userId = req.auth?.userId;
  const writeOpId = `w_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const result = await writeFn({
    db: firestore.db,
    regionId: 'asia-south1',
    isPrimary: true,
    writeOpId,
  });

  // Issue RYW token after successful write
  if (userId && result?.success !== false) {
    const primaryCommitTs = Date.now(); // In production, get from Firestore commit timestamp
    const { token } = await multiRegion.issueToken(userId, primaryCommitTs, writeOpId);

    // Return token in response header
    res.setHeader('x-read-your-writes-token', token);
  }

  return { result, writeOpId };
};

// ============================================================================
// Collection-Specific Helpers
// ============================================================================

/** Check if a collection requires primary-only reads */
export const isPrimaryOnlyCollection = (collectionPath) => {
  const primaryOnlyPrefixes = [
    'users/',
    'vaultDocs',
    'applications',
    'grievanceTickets',
    'applicantProfiles',
    'privacyExports',
    'auditLogs',
    'roles/',
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
    'saved/',
  ];

  return primaryOnlyPrefixes.some((prefix) =>
    collectionPath === prefix.replace('/', '') || collectionPath.startsWith(prefix)
  );
};

/** Get the required consistency level for a collection */
export const getCollectionConsistency = (collectionPath) => {
  if (isPrimaryOnlyCollection(collectionPath)) return 'strong';
  return 'bounded_stale';
};

// ============================================================================
// Middleware for Express/Vercel
// ============================================================================

/** Express/Vercel middleware that attaches multi-region helpers to req */
export const multiRegionMiddleware = async (req, res, next) => {
  const multiRegion = await getMultiRegionInstance();
  const middleware = createMultiRegionMiddleware(multiRegion);
  return middleware(req, res, next);
};

// ============================================================================
// Response Helpers
// ============================================================================

/** Send a response with multi-region headers already applied */
export const sendMultiRegionResponse = async (res, statusCode, body, routingDecision, requestId) => {
  const multiRegion = await getMultiRegionInstance();
  if (multiRegion) {
    multiRegion.decorateResponse(res, routingDecision, { requestId });
  }
  return res.status(statusCode).json(body);
};

// ============================================================================
// Health Check Endpoint Data
// ============================================================================

/** Get health status for /healthz or monitoring endpoints */
export const getMultiRegionHealth = async () => {
  const multiRegion = await getMultiRegionInstance();
  return multiRegion.getFailoverStatus();
};

/** Get metrics for Prometheus/DataDog scraping */
export const getMultiRegionMetrics = async () => {
  const multiRegion = await getMultiRegionInstance();
  return multiRegion.exportMetrics();
};

// ============================================================================
// Testing Helpers
// ============================================================================

/** Reset singleton (for testing) */
export const resetMultiRegionInstance = () => {
  multiRegionInstance = null;
  initializationPromise = null;
  firestoreClients.clear();
};

/** Set mock instance (for testing) */
export const setMultiRegionInstance = (instance) => {
  multiRegionInstance = instance;
};