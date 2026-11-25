/**
 * Persistent Storage & In-Memory Fallback for Civic Data Clean Room (#1164)
 * Supports browser localStorage with graceful inMemory fallback for Node/Vitest environments.
 */

import {
  SEED_WORKSPACES,
  SEED_AUDIT_LOGS,
  SEED_DATASETS,
} from '../data/cleanRoomSeed.js';

const STORAGE_KEY_WORKSPACES = 'civic_cleanroom_workspaces_v1';
const STORAGE_KEY_AUDIT_LOGS = 'civic_cleanroom_audit_logs_v1';
const STORAGE_KEY_QUERY_HISTORY = 'civic_cleanroom_query_history_v1';

const inMemoryStore = new Map();

const safeGetItem = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    }
    if (inMemoryStore.has(key)) {
      return inMemoryStore.get(key);
    }
    return fallback;
  } catch (err) {
    console.warn(`[cleanRoomStorage] Error reading ${key}:`, err);
    return fallback;
  }
};

const safeSetItem = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
    inMemoryStore.set(key, JSON.parse(JSON.stringify(value)));
  } catch (err) {
    console.warn(`[cleanRoomStorage] Error saving ${key}:`, err);
  }
};

/**
 * Load all workspaces
 */
export const loadStoredWorkspaces = () => {
  return safeGetItem(STORAGE_KEY_WORKSPACES, SEED_WORKSPACES);
};

/**
 * Save all workspaces
 */
export const saveStoredWorkspaces = (workspaces) => {
  safeSetItem(STORAGE_KEY_WORKSPACES, workspaces);
};

/**
 * Load single workspace by ID
 */
export const getStoredWorkspaceById = (workspaceId) => {
  const workspaces = loadStoredWorkspaces();
  return workspaces.find((w) => w.workspaceId === workspaceId) || null;
};

/**
 * Upsert workspace
 */
export const saveStoredWorkspace = (workspace) => {
  const workspaces = loadStoredWorkspaces();
  const idx = workspaces.findIndex((w) => w.workspaceId === workspace.workspaceId);
  let updated;
  if (idx >= 0) {
    updated = [...workspaces];
    updated[idx] = workspace;
  } else {
    updated = [workspace, ...workspaces];
  }
  saveStoredWorkspaces(updated);
  return workspace;
};

/**
 * Load audit logs
 */
export const loadStoredAuditLogs = () => {
  return safeGetItem(STORAGE_KEY_AUDIT_LOGS, SEED_AUDIT_LOGS);
};

/**
 * Append audit log entry
 */
export const appendStoredAuditLog = (entry) => {
  const logs = loadStoredAuditLogs();
  const updated = [entry, ...logs].slice(0, 500); // Retain latest 500 audit logs
  safeSetItem(STORAGE_KEY_AUDIT_LOGS, updated);
  return entry;
};

/**
 * Load query history for a workspace (used for differencing attack analysis)
 */
export const loadStoredQueryHistory = (workspaceId) => {
  const historyMap = safeGetItem(STORAGE_KEY_QUERY_HISTORY, {});
  return historyMap[workspaceId] || [];
};

/**
 * Append query history for a workspace
 */
export const appendStoredQueryHistory = (workspaceId, queryRecord) => {
  const historyMap = safeGetItem(STORAGE_KEY_QUERY_HISTORY, {});
  const workspaceHistory = historyMap[workspaceId] || [];
  const updated = [queryRecord, ...workspaceHistory].slice(0, 50); // Keep last 50 queries per workspace
  historyMap[workspaceId] = updated;
  safeSetItem(STORAGE_KEY_QUERY_HISTORY, historyMap);
};

/**
 * Fetch dataset records (strictly in-memory / synthetic)
 */
export const getCleanRoomDataset = (datasetId) => {
  return SEED_DATASETS[datasetId] || null;
};

/**
 * Reset storage back to clean state
 */
export const resetCleanRoomStorage = () => {
  safeSetItem(STORAGE_KEY_WORKSPACES, SEED_WORKSPACES);
  safeSetItem(STORAGE_KEY_AUDIT_LOGS, SEED_AUDIT_LOGS);
  safeSetItem(STORAGE_KEY_QUERY_HISTORY, {});
};
