/**
 * api/_lib/treePlantationSurvivalStore.js
 *
 * Persistent store for Tree-Plantation Survival & Public Green Asset Registry (#1441).
 */

import {
  GREEN_ASSET_SCHEMA_VERSION,
  migrateGreenAssetStoreState,
} from '../../src/services/treePlantationSurvivalService.js';

const MAX_ASSETS = 1000;
const MAX_AUDIT_LOG = 200;

export class InMemoryTreePlantationStore {
  constructor(initialState = {}) {
    const migrated = migrateGreenAssetStoreState(initialState);
    this.schemaVersion = migrated.schemaVersion || GREEN_ASSET_SCHEMA_VERSION;
    this.assets = new Map();
    this.assetOrder = [];
    this.auditLog = migrated.auditLog || [];

    for (const a of migrated.assets) {
      if (a?.assetId) {
        this.assets.set(a.assetId, a);
        this.assetOrder.push(a.assetId);
      }
    }
  }

  async saveAsset(asset) {
    if (!asset?.assetId) throw new Error('Asset requires assetId');
    if (!this.assets.has(asset.assetId)) {
      this.assetOrder.push(asset.assetId);
      while (this.assetOrder.length > MAX_ASSETS) {
        const oldest = this.assetOrder.shift();
        this.assets.delete(oldest);
      }
    }
    this.assets.set(asset.assetId, asset);
    return asset;
  }

  async getAsset(assetId) {
    return this.assets.get(assetId) || null;
  }

  async listAssets() {
    return Array.from(this.assets.values());
  }

  async appendAuditLog(entry) {
    const safeEntry = {
      id: `tree-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      action: String(entry.action || 'UNKNOWN'),
      actorId: String(entry.actorId || 'system'),
      role: String(entry.role || 'unknown'),
      jurisdiction: String(entry.jurisdiction || 'UNSPECIFIED'),
      targetId: entry.targetId ? String(entry.targetId) : null,
      status: String(entry.status || 'ok'),
      summary: String(entry.summary || '').slice(0, 240),
    };
    this.auditLog.unshift(safeEntry);
    if (this.auditLog.length > MAX_AUDIT_LOG) {
      this.auditLog.length = MAX_AUDIT_LOG;
    }
    return safeEntry;
  }

  async listAuditLog({ limit = 50 } = {}) {
    return this.auditLog.slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
  }
}

let defaultStore = null;

export function getDefaultTreePlantationStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryTreePlantationStore();
  }
  return defaultStore;
}

export function resetDefaultTreePlantationStoreForTests() {
  defaultStore = null;
}

export async function getProductionTreePlantationStore() {
  return getDefaultTreePlantationStore();
}
