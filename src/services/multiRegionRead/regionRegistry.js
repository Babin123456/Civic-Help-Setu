/* global process */
/**
 * Region Registry — Declares approved regions and their configurations
 *
 * Pure configuration module. No I/O, no side effects.
 * All region definitions are explicit and version-controlled.
 */

import {
  RESIDENCY_CLASS,
  createRegionConfig,
  DEFAULT_CONFIG,
  requiresIndiaResidency,
} from './types.js';

// ============================================================================
// Region Definitions
// ============================================================================

/**
 * Canonical region registry.
 * Each region declares its residency classification, Firestore connection,
 * and routing weight.
 *
 * PRIMARY REGION: asia-south1 (Mumbai) — handles all writes and sensitive reads
 * REPLICA REGIONS: Read-only replicas for public reference data
 */
export const REGION_REGISTRY = Object.freeze({
  // PRIMARY — India residency, handles all writes + sensitive reads
  'asia-south1': createRegionConfig({
    id: 'asia-south1',
    displayName: 'Mumbai (Primary)',
    residency: RESIDENCY_CLASS.INDIA,
    firestoreDatabaseId: '(default)',
    firestoreProjectId: null, // Same project
    weight: 1000, // High weight for primary
    maxLagMs: 0,  // Primary has no lag
    maxLagCriticalMs: 0,
    readOnly: false,
  }),

  // REPLICA — Global residency, public reference data only
  'us-central1': createRegionConfig({
    id: 'us-central1',
    displayName: 'Iowa, USA',
    residency: RESIDENCY_CLASS.GLOBAL,
    firestoreDatabaseId: 'replica-us-central1',
    firestoreProjectId: null, // Same project, different database
    weight: 100,
    maxLagMs: 2000,
    maxLagCriticalMs: 10000,
    readOnly: true,
    capacityPercent: 100,
  }),

  'europe-west1': createRegionConfig({
    id: 'europe-west1',
    displayName: 'Belgium, EU',
    residency: RESIDENCY_CLASS.GLOBAL,
    firestoreDatabaseId: 'replica-europe-west1',
    firestoreProjectId: null,
    weight: 100,
    maxLagMs: 2000,
    maxLagCriticalMs: 10000,
    readOnly: true,
    capacityPercent: 100,
  }),

  'asia-southeast1': createRegionConfig({
    id: 'asia-southeast1',
    displayName: 'Singapore',
    residency: RESIDENCY_CLASS.GLOBAL,
    firestoreDatabaseId: 'replica-asia-southeast1',
    firestoreProjectId: null,
    weight: 100,
    maxLagMs: 2000,
    maxLagCriticalMs: 10000,
    readOnly: true,
    capacityPercent: 100,
  }),

  'australia-southeast1': createRegionConfig({
    id: 'australia-southeast1',
    displayName: 'Sydney, Australia',
    residency: RESIDENCY_CLASS.GLOBAL,
    firestoreDatabaseId: 'replica-australia-southeast1',
    firestoreProjectId: null,
    weight: 50, // Lower weight, further from India
    maxLagMs: 3000,
    maxLagCriticalMs: 15000,
    readOnly: true,
    capacityPercent: 100,
  }),

  // FUTURE: India secondary region for DR (read-only, India residency)
  // 'asia-south2': createRegionConfig({
  //   id: 'asia-south2',
  //   displayName: 'Delhi (DR Replica)',
  //   residency: RESIDENCY_CLASS.INDIA,
  //   firestoreDatabaseId: 'replica-asia-south2',
  //   firestoreProjectId: null,
  //   weight: 200,
  //   maxLagMs: 1000,
  //   maxLagCriticalMs: 5000,
  //   readOnly: true,
  // }),
});

// ============================================================================
// Registry API
// ============================================================================

/** Get all region configs */
export const getAllRegions = () => Object.values(REGION_REGISTRY);

/** Get region config by ID */
export const getRegion = (regionId) => REGION_REGISTRY[regionId] || null;

/** Get primary region config */
export const getPrimaryRegion = () => REGION_REGISTRY[DEFAULT_CONFIG.PRIMARY_REGION_ID];

/** Get all replica regions (read-only, non-primary) */
export const getReplicaRegions = () =>
  Object.values(REGION_REGISTRY).filter((r) => r.readOnly && r.id !== DEFAULT_CONFIG.PRIMARY_REGION_ID);

/** Get regions by residency class */
export const getRegionsByResidency = (residency) =>
  Object.values(REGION_REGISTRY).filter((r) => r.residency === residency);

/** Get regions that can serve a given collection (respects residency) */
export const getRegionsForCollection = (collectionPath) => {
  const needsIndia = requiresIndiaResidency(collectionPath);
  if (needsIndia) {
    return getRegionsByResidency(RESIDENCY_CLASS.INDIA);
  }
  // Public data can be served from any region
  return getAllRegions();
};

/** Get the default/primary region for a collection */
export const getPrimaryRegionForCollection = (collectionPath) => {
  const regions = getRegionsForCollection(collectionPath);
  return regions.find((r) => !r.readOnly) || regions[0] || getPrimaryRegion();
};

/** Validate region ID exists in registry */
export const isValidRegion = (regionId) => regionId in REGION_REGISTRY;

/** Get region display name */
export const getRegionDisplayName = (regionId) => {
  const region = getRegion(regionId);
  return region?.displayName || regionId;
};

/** Get effective weight for a region (can be overridden at runtime) */
export const getRegionWeight = (regionId, runtimeOverrides = {}) => {
  const region = getRegion(regionId);
  if (!region) return 0;
  return runtimeOverrides[regionId] ?? region.weight;
};

/** Set runtime weight override (for gradual rollout, draining, etc.) */
export const setRegionWeightOverride = (overrides, regionId, weight) => {
  overrides[regionId] = Math.max(0, Math.min(1000, weight));
  return overrides;
};

/** Clear all runtime weight overrides */
export const clearRegionWeightOverrides = (overrides) => {
  Object.keys(overrides).forEach((key) => delete overrides[key]);
};

// ============================================================================
// Collection Routing Rules
// ============================================================================

/**
 * Determines the required consistency level for a collection.
 * Sensitive collections always require STRONG consistency (primary).
 */
export const getRequiredConsistencyForCollection = (collectionPath) => {
  if (requiresIndiaResidency(collectionPath)) {
    return 'strong'; // Must read from primary
  }
  return 'bounded_stale'; // Default for public data
};

/**
 * Determines if a collection can be read from a specific region.
 */
export const canReadFromRegion = (collectionPath, regionId) => {
  const region = getRegion(regionId);
  if (!region) return false;

  const needsIndia = requiresIndiaResidency(collectionPath);
  if (needsIndia && region.residency !== RESIDENCY_CLASS.INDIA) {
    return false;
  }
  return true;
};

/**
 * Get allowed regions for a read operation on a collection.
 */
export const getAllowedRegionsForRead = (collectionPath, clientContext = {}) => {
  const { explicitRegion, isAdmin } = clientContext;

  // Admin can read from primary for any collection
  if (isAdmin) {
    return getRegionsForCollection(collectionPath);
  }

  // Client requested explicit region
  if (explicitRegion && isValidRegion(explicitRegion)) {
    if (canReadFromRegion(collectionPath, explicitRegion)) {
      return [getRegion(explicitRegion)];
    }
    // Explicit region not allowed for this collection — fall through to default
  }

  return getRegionsForCollection(collectionPath);
};

// ============================================================================
// Configuration Validation
// ============================================================================

/** Validate registry consistency at startup */
export const validateRegistry = () => {
  const errors = [];
  const warnings = [];

  const primary = getPrimaryRegion();
  if (!primary) {
    errors.push(`Primary region ${DEFAULT_CONFIG.PRIMARY_REGION_ID} not found in registry`);
  } else if (primary.readOnly) {
    errors.push('Primary region must not be readOnly');
  } else if (primary.residency !== RESIDENCY_CLASS.INDIA) {
    warnings.push('Primary region should have INDIA residency for sensitive data');
  }

  const replicas = getReplicaRegions();
  if (replicas.length === 0) {
    warnings.push('No replica regions configured — multi-region reads will route to primary only');
  }

  for (const replica of replicas) {
    if (!replica.readOnly) {
      warnings.push(`Replica ${replica.id} is not marked readOnly`);
    }
    if (replica.weight <= 0) {
      warnings.push(`Replica ${replica.id} has weight <= 0`);
    }
    if (replica.maxLagCriticalMs <= replica.maxLagMs) {
      errors.push(`Replica ${replica.id}: maxLagCriticalMs must be > maxLagMs`);
    }
  }

  // Check for duplicate database IDs
  const dbIds = new Map();
  for (const region of getAllRegions()) {
    const key = `${region.firestoreProjectId || 'default'}/${region.firestoreDatabaseId}`;
    if (dbIds.has(key)) {
      errors.push(`Duplicate Firestore database: ${key} used by ${dbIds.get(key)} and ${region.id}`);
    }
    dbIds.set(key, region.id);
  }

  return { valid: errors.length === 0, errors, warnings };
};

// ============================================================================
// Runtime Configuration (Feature Flags)
// ============================================================================

/** Runtime config that can be overridden via env vars */
export const createRuntimeConfig = (env = process.env) => ({
  enabled: env.MULTI_REGION_READS_ENABLED !== 'false',
  rolloutPercent: parseInt(env.MULTI_REGION_READS_ROLLOUT_PERCENT || '100', 10),
  primaryRegionId: env.MULTI_REGION_PRIMARY_REGION || DEFAULT_CONFIG.PRIMARY_REGION_ID,
  weightOverrides: {}, // Populated dynamically by failover controller
});

export const DEFAULT_RUNTIME_CONFIG = createRuntimeConfig({});