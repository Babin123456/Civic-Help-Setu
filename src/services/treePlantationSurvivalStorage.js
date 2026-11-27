/**
 * src/services/treePlantationSurvivalStorage.js
 *
 * Offline-first storage for Tree-Plantation Survival & Public Green Asset Registry (#1441).
 */

import {
  appendGreenAssetEvidence,
  migrateGreenAssetStoreState,
  registerGreenAsset,
} from './treePlantationSurvivalService.js';

export const GREEN_ASSET_STORAGE_KEY = 'civicbridge_tree_plantation_survival_v1';

let memoryFallback = null;

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function loadLocalGreenAssetState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(GREEN_ASSET_STORAGE_KEY);
      if (raw) {
        return migrateGreenAssetStoreState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateGreenAssetStoreState(memoryFallback);
  }
  return migrateGreenAssetStoreState({});
}

export function saveLocalGreenAssetState(state) {
  const migrated = migrateGreenAssetStoreState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(GREEN_ASSET_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore
    }
  }
  return migrated;
}

export function resetLocalGreenAssetState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(GREEN_ASSET_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function registerLocalGreenAsset(input, actorId = 'local-steward') {
  const state = loadLocalGreenAssetState();
  const res = registerGreenAsset(state.assets, input, actorId);
  if (!res.valid) {
    throw new Error(res.errors.join(' '));
  }
  const next = saveLocalGreenAssetState({
    ...state,
    assets: [res.asset, ...state.assets],
  });
  return { asset: res.asset, state: next };
}

export function addLocalGreenAssetEvidence(assetId, input, actorId = 'local-citizen') {
  const state = loadLocalGreenAssetState();
  const target = state.assets.find((a) => a.assetId === assetId);
  const updated = appendGreenAssetEvidence(target, input, actorId);
  const next = saveLocalGreenAssetState({
    ...state,
    assets: state.assets.map((a) => (a.assetId === assetId ? updated : a)),
  });
  return { asset: updated, state: next };
}
