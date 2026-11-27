/**
 * src/services/digitalTwinStorage.js
 * Persistent storage, audit trails, and export formatting for the Civic Workflow Digital Twin (#1157).
 *
 * All stored simulation traces and workflows undergo mandatory PII sanitization
 * prior to persistence to guarantee that real citizen records are never retained.
 */

import { SEED_WORKFLOWS } from '../data/digitalTwinSeed';
import {
  validateWorkflowGraph,
  sanitizeSimulationPayload,
} from '../data/digitalTwinContract';
import { sanitizeDigitalTwinExport } from './civicWorkflowDigitalTwinService';

export const STORAGE_KEYS = Object.freeze({
  WORKFLOWS: 'civicbridge_digital_twin_workflows_v1',
  SIMULATIONS: 'civicbridge_digital_twin_simulations_v1',
  AUDIT_LOGS: 'civicbridge_digital_twin_audit_logs_v1',
});

const inMemoryFallback = new Map();

const safeGetItem = (key, fallback) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    }
    if (inMemoryFallback.has(key)) {
      return inMemoryFallback.get(key);
    }
    return fallback;
  } catch (err) {
    console.warn(`[digitalTwinStorage] Failed reading ${key}:`, err);
    return fallback;
  }
};

const safeSetItem = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
    inMemoryFallback.set(key, JSON.parse(JSON.stringify(value)));
  } catch (err) {
    console.warn(`[digitalTwinStorage] Failed writing ${key}:`, err);
  }
};

/**
 * Loads all available workflows (defaults to canonical seed set).
 *
 * @returns {object[]} List of workflow objects
 */
export function loadStoredWorkflows() {
  const workflows = safeGetItem(STORAGE_KEYS.WORKFLOWS, null);
  if (!workflows || !Array.isArray(workflows) || workflows.length === 0) {
    safeSetItem(STORAGE_KEYS.WORKFLOWS, SEED_WORKFLOWS);
    return SEED_WORKFLOWS;
  }
  return workflows;
}

/**
 * Persists or updates a workflow.
 *
 * @param {object} workflow - Workflow to persist
 * @returns {{ success: boolean, errors?: string[] }}
 */
export function saveStoredWorkflow(workflow) {
  const sanitized = sanitizeSimulationPayload(workflow);
  const validation = validateWorkflowGraph(sanitized);

  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  const current = loadStoredWorkflows();
  const existingIndex = current.findIndex((w) => w.id === sanitized.id);

  let updated;
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = sanitized;
  } else {
    updated = [sanitized, ...current];
  }

  safeSetItem(STORAGE_KEYS.WORKFLOWS, updated);
  return { success: true };
}

/**
 * Loads saved simulation execution runs.
 *
 * @returns {object[]}
 */
export function loadStoredSimulations() {
  return safeGetItem(STORAGE_KEYS.SIMULATIONS, []);
}

/**
 * Saves a simulation result record with automated sanitization.
 *
 * @param {object} record
 * @returns {object} The saved sanitized record
 */
export function saveStoredSimulation(record) {
  const sanitized = sanitizeDigitalTwinExport(record);
  const recordWithMeta = {
    ...sanitized,
    id: sanitized.id || `sim-run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    savedAt: sanitized.savedAt || new Date().toISOString(),
  };

  const current = loadStoredSimulations();
  const updated = [recordWithMeta, ...current.slice(0, 49)]; // Retain up to 50 recent runs
  safeSetItem(STORAGE_KEYS.SIMULATIONS, updated);
  return recordWithMeta;
}

/**
 * Loads maintainer audit logs and publishing decisions.
 *
 * @returns {object[]}
 */
export function loadStoredAuditLogs() {
  return safeGetItem(STORAGE_KEYS.AUDIT_LOGS, []);
}

/**
 * Records a formal human-in-the-loop review decision for a workflow revision.
 *
 * @param {object} decision - { workflowId, version, decision: 'APPROVED'|'REJECTED', reviewerId, rationale }
 * @returns {object} The recorded audit record
 */
export function saveStoredAuditLog(decision) {
  const sanitized = sanitizeSimulationPayload(decision);
  const auditRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    workflowId: sanitized.workflowId,
    version: sanitized.version,
    decision: sanitized.decision, // 'APPROVED_FOR_PUBLICATION' | 'BLOCKED_BREAKING_CHANGES'
    reviewerRole: sanitized.reviewerRole || 'CATALOGUE_MAINTAINER',
    rationale: sanitized.rationale || 'Reviewed via Digital Twin Simulation Engine',
  };

  const current = loadStoredAuditLogs();
  const updated = [auditRecord, ...current];
  safeSetItem(STORAGE_KEYS.AUDIT_LOGS, updated);
  return auditRecord;
}

/**
 * Clears simulation state and restores initial canonical seed workflows.
 */
export function resetDigitalTwinStorage() {
  safeSetItem(STORAGE_KEYS.WORKFLOWS, SEED_WORKFLOWS);
  safeSetItem(STORAGE_KEYS.SIMULATIONS, []);
  safeSetItem(STORAGE_KEYS.AUDIT_LOGS, []);
}
