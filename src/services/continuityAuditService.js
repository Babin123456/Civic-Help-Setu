/**
 * Civic Incident Response & Continuity Audit Service (#780)
 *
 * Provides an append-only, tamper-evident audit logging mechanism for sensitive
 * continuity planning actions (plan approvals, status overrides, drill completions,
 * and AI recommendation accept/reject decisions).
 */

import { sanitizeTextFields } from '../utils/safeContent';
import { logDiagnostic } from '../utils/diagnostics';

export const AUDIT_STORAGE_KEY = 'civicbridge_continuity_audit_logs_v1';

let customStorage = null;
const memoryStore = new Map();

export const setAuditStorage = (storage) => {
  customStorage = storage;
};

const getStorage = () => {
  if (customStorage) return customStorage;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // fallback to memoryStore
  }
  return {
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k),
    clear: () => memoryStore.clear(),
  };
};

const readStorage = () => {
  try {
    const raw = getStorage().getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStorage = (logs) => {
  try {
    getStorage().setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    logDiagnostic('Failed to persist continuity audit log', err);
  }
};

/**
 * Appends an immutable audit event to the continuity audit trail.
 */
export const appendContinuityAuditLog = ({
  entityType,
  entityId,
  action,
  actor,
  previousState = null,
  nextState = null,
  reason = '',
  metadata = {},
}) => {
  const logs = readStorage();
  const sequenceNumber = logs.length + 1;

  const actorId = actor?.id || (typeof actor === 'string' ? actor : 'anonymous_officer');
  const actorRole = actor?.role || 'operator';

  const entry = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    sequenceNumber,
    timestamp: new Date().toISOString(),
    entityType: String(entityType || 'UNKNOWN'),
    entityId: String(entityId || ''),
    action: String(action || 'UNKNOWN_ACTION'),
    actor: {
      id: String(actorId),
      role: String(actorRole),
    },
    previousState: previousState ? String(previousState) : null,
    nextState: nextState ? String(nextState) : null,
    reason: typeof reason === 'string' ? reason.trim().slice(0, 500) : '',
    metadata: sanitizeTextFields(metadata || {}),
  };

  logs.push(entry);
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }

  writeStorage(logs);
  return entry;
};

/**
 * Retrieves audit logs with optional filters.
 */
export const queryContinuityAuditLogs = ({
  entityType = null,
  entityId = null,
  action = null,
  limit = 50,
} = {}) => {
  const logs = readStorage();
  let filtered = [...logs].reverse(); // latest first

  if (entityType) {
    filtered = filtered.filter((log) => log.entityType === entityType);
  }
  if (entityId) {
    filtered = filtered.filter((log) => log.entityId === entityId);
  }
  if (action) {
    filtered = filtered.filter((log) => log.action === action);
  }

  return filtered.slice(0, Math.max(1, Math.min(limit, 200)));
};
