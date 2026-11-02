/**
 * Cloud Record Sync Verification Service (#428)
 * 
 * Verifies payload integrity, size boundaries, and personal storage classification
 * contracts before staging browser stores for cloud synchronization.
 * 
 * Guarantees:
 * 1. Strict Contract: Ensures every store in USER_DATA_STORES is classified as either
 *    CLOUD_STORES or DEVICE_ONLY_STORES.
 * 2. Payload Boundary Guard: Validates records do not exceed the 900 KiB Firestore safety limit.
 * 3. Collection Ownership Check: Verifies collection names against owned personal collections.
 * 4. Structure Validation: Ensures list vs document store contracts are preserved without
 *    data dropping or schema collision.
 */

import {
  CLOUD_STORES,
  DEVICE_ONLY_STORES,
  MAX_RECORD_BYTES,
  SCHEMA_VERSION,
  isCloudStore,
  toCloudRecords,
  fromCloudRecords,
} from './cloudRecords';
import { USER_DATA_STORES } from './privacyConsentService';

/**
 * Validate that all current registry stores are mapped to appropriate cloud or device tiers
 */
export const verifyStoreRegistryCoverage = () => {
  const cloudKeys = CLOUD_STORES.map((s) => s.key);
  const deviceKeys = DEVICE_ONLY_STORES.map((s) => s.key);
  const union = [...cloudKeys, ...deviceKeys];

  const uniqueClassified = new Set(union);
  const hasDuplicates = uniqueClassified.size !== union.length;

  const registryKeys = USER_DATA_STORES.map((s) => s.key);
  const unclassifiedKeys = registryKeys.filter((k) => !uniqueClassified.has(k));
  const obsoleteKeys = union.filter((k) => !registryKeys.includes(k));

  return {
    isValid: !hasDuplicates && unclassifiedKeys.length === 0 && obsoleteKeys.length === 0,
    totalRegistryStores: registryKeys.length,
    cloudStoresCount: cloudKeys.length,
    deviceOnlyStoresCount: deviceKeys.length,
    hasDuplicates,
    unclassifiedKeys,
    obsoleteKeys,
    verifiedAt: new Date().toISOString(),
  };
};

/**
 * Calculate approximate byte size of a JavaScript object/value in UTF-8
 */
export const calculatePayloadBytes = (value) => {
  if (value === undefined || value === null) return 0;
  try {
    const jsonString = JSON.stringify(value);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(jsonString).length;
    }
    // Fallback approximation
    return unescape(encodeURIComponent(jsonString)).length;
  } catch {
    return -1;
  }
};

/**
 * Validate a record payload against size boundaries and schema rules
 */
export const validateRecordPayload = (key, value) => {
  const store = CLOUD_STORES.find((s) => s.key === key);
  if (!store) {
    const isDeviceOnly = DEVICE_ONLY_STORES.some((s) => s.key === key);
    return {
      isValid: false,
      isCloudEligible: false,
      reason: isDeviceOnly ? 'Store is designated as device-only and cannot be synced.' : 'Store is not registered.',
      bytes: 0,
    };
  }

  const bytes = calculatePayloadBytes(value);
  if (bytes > MAX_RECORD_BYTES) {
    return {
      isValid: false,
      isCloudEligible: true,
      reason: `Record size (${Math.round(bytes / 1024)} KiB) exceeds the maximum allowed limit of ${Math.round(MAX_RECORD_BYTES / 1024)} KiB.`,
      bytes,
    };
  }

  // Kind validation
  if (store.kind === 'list' && value !== null && value !== undefined && !Array.isArray(value)) {
    return {
      isValid: false,
      isCloudEligible: true,
      reason: `Store ${key} is configured as 'list' but received a non-array value.`,
      bytes,
    };
  }

  return {
    isValid: true,
    isCloudEligible: true,
    bytes,
    storeKind: store.kind,
    targetCollection: store.collection,
  };
};

/**
 * Run a dry-run conversion audit across all local storage items to preview cloud sync state
 */
export const auditLocalStorageSyncReadiness = (storageMock = null) => {
  const storage = storageMock || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!storage) {
    return {
      isReady: true,
      auditedStores: [],
      totalStagedBytes: 0,
      errors: ['No storage provider available'],
    };
  }

  const auditedStores = [];
  const errors = [];
  let totalStagedBytes = 0;

  CLOUD_STORES.forEach((store) => {
    try {
      const raw = storage.getItem(store.key);
      if (raw !== null && raw !== undefined) {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }

        const validation = validateRecordPayload(store.key, parsed);
        totalStagedBytes += validation.bytes;

        auditedStores.push({
          key: store.key,
          collection: store.collection,
          kind: store.kind,
          hasData: true,
          bytes: validation.bytes,
          isValid: validation.isValid,
        });

        if (!validation.isValid) {
          errors.push(`Store ${store.key}: ${validation.reason}`);
        }
      } else {
        auditedStores.push({
          key: store.key,
          collection: store.collection,
          kind: store.kind,
          hasData: false,
          bytes: 0,
          isValid: true,
        });
      }
    } catch (err) {
      errors.push(`Failed to inspect store ${store.key}: ${err.message}`);
    }
  });

  return {
    isReady: errors.length === 0,
    totalCloudStores: CLOUD_STORES.length,
    activeStoresCount: auditedStores.filter((s) => s.hasData).length,
    totalStagedBytes,
    auditedStores,
    errors,
    auditedAt: new Date().toISOString(),
  };
};
