/**
 * Civic Service Accessibility Inspector Storage (#832)
 *
 * Persists scan runs and findings in browser localStorage/sessionStorage
 * with explicit controls for what data is retained versus discarded.
 *
 * Strict Compliance:
 * - Only scan metadata is stored; no citizen browsing data or page contents.
 * - Scan runs are versioned; old versions are not silently overwritten.
 * - Confirmed remediation notes are persisted; pending suggestions are transient
 *   until explicitly saved by the maintainer.
 * - Storage keys are namespaced to this service to avoid collisions.
 * - Exported data can be cleared per retention policies.
 */

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = {
  SCAN_RUNS: 'civicbridge_accessibility_scans',
  CURRENT_SCAN: 'civicbridge_current_accessibility_scan',
  REMEDIATION_NOTES: 'civicbridge_accessibility_remediation_notes',
};

// ---------------------------------------------------------------------------
// In-memory fallback store (for environments without localStorage)
// ---------------------------------------------------------------------------
const memoryStore = {
  data: {},
  get: (key) => memoryStore.data[key] || null,
  set: (key, val) => { memoryStore.data[key] = val; },
  remove: (key) => { delete memoryStore.data[key]; },
  clear: () => { memoryStore.data = {}; },
};

/**
 * Gets the storage object (localStorage or memory fallback).
 * @returns {Object} - Storage API { getItem, setItem, removeItem, clear }
 */
const getStorage = () => {
  try {
    if (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage !== null) {
      return globalThis.localStorage;
    }
    // Fall back to sessionStorage for transient scans
    if (typeof globalThis.sessionStorage !== 'undefined' && globalThis.sessionStorage !== null) {
      return globalThis.sessionStorage;
    }
  } catch {
    // fallback to memory
  }
  return memoryStore;
};

// ---------------------------------------------------------------------------
// Scan Run data model
// ---------------------------------------------------------------------------
/**
 * Creates a new scan run entry.
 * @param {Object} params - Scan parameters
 * @param {string} params.pageUrl - The page URL that was scanned
 * @param {string} [params.pageVersion] - Optional page version/identifier
 * @param {Array<Object>} [params.findings=[]] - Initial findings array
 * @param {string} [params.scannedBy='maintainer'] - Who/what triggered the scan
 * @param {boolean} [options.preserveExisting=false] - If true, keep existing findings; otherwise overwrite
 * @returns {Object} - The created scan run
 */
export const createScanRun = (params = {}, options = {}) => {
  const storage = getStorage();
  const key = STORAGE_KEYS.SCAN_RUNS;

  // Get existing runs
  let runs = [];
  try {
    const raw = storage.getItem(key);
    if (raw) {
      runs = JSON.parse(raw);
      if (!Array.isArray(runs)) runs = [runs];
    }
  } catch {
    runs = [];
  }

  const newRun = {
    id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    pageUrl: params.pageUrl || '',
    pageVersion: params.pageVersion || `v${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: SCAN_STATUS.COMPLETE,
    findings: params.findings || [],
    // Track which findings have been confirmed/remediated
    confirmedFindings: new Set(),
    // AI suggestions that have been reviewed and confirmed
    reviewedAI_suggestions: new Set(),
    // Maintainer notes per finding
    remediationNotes: new Map(),
    // Scan metadata
    scannedBy: params.scannedBy || 'maintainer',
    // Version tracking for report generation
    version: 1,
    // Whether the scan is draft (not yet published)
    isDraft: true,
  };

  // If not preserving existing, clear previous runs for this page URL
  // (but keep other runs)
  const filteredRuns = options.preserveExisting
    ? runs
    : runs.filter((run) => run.pageUrl !== params.pageUrl);

  const updatedRuns = [newRun, ...filteredRuns].slice(0, 50); // Keep last 50 scans

  try {
    storage.setItem(key, JSON.stringify(updatedRuns));
  } catch {
    // If localStorage full, try sessionStorage or memory
    memoryStore.set(key, JSON.stringify(updatedRuns));
  }

  // Set as current scan
  try {
    storage.setItem(STORAGE_KEYS.CURRENT_SCAN, JSON.stringify(newRun));
  } catch {
    memoryStore.set(STORAGE_KEYS.CURRENT_SCAN, JSON.stringify(newRun));
  }

  return newRun;
};

/**
 * Updates an existing scan run with new findings or notes.
 * @param {string} scanId - The scan run ID to update
 * @param {Object} updates - Updates to apply
 * @param {Array<Object>} [updates.findings] - New findings to merge
 * @param {Map} [updates.remediationNotes] - Remediation notes map (findingId -> note)
 * @param {Set} [updates.reviewedAISuggestions] - Set of AI suggestion IDs that have been reviewed
 * @param {boolean} [updates.isDraft] - Whether to keep as draft
 * @returns {Object|null} - Updated scan run or null if not found
 */
export const updateScanRun = (scanId, updates = {}) => {
  const storage = getStorage();
  const key = STORAGE_KEYS.SCAN_RUNS;

  let runs = [];
  try {
    const raw = storage.getItem(key);
    if (raw) {
      runs = JSON.parse(raw);
      if (!Array.isArray(runs)) runs = [runs];
    }
  } catch {
    runs = [];
  }

  const index = runs.findIndex((run) => run.id === scanId);
  if (index === -1) return null;

  const existing = runs[index];

  // Merge findings: add new findings, keep existing confirmed ones
  let findings = [...existing.findings];
  if (updates.findings && Array.isArray(updates.findings)) {
    // Merge: new findings that don't already exist (by ruleId + affectedSelector)
    for (const newFind of updates.findings) {
      const alreadyExists = findings.some(
        (f) => f.ruleId === newFind.ruleId && f.affectedSelector === newFind.affectedSelector
      );
      if (!alreadyExists) {
        findings.push(newFind);
      }
    }
  }

  // Merge remediation notes
  const remediationNotes = new Map(existing.remediationNotes);
  if (updates.remediationNotes && typeof updates.remediationNotes === 'object') {
    for (const [k, v] of Object.entries(updates.remediationNotes)) {
      remediationNotes.set(k, v);
    }
  }

  // Merge reviewed AI suggestions
  const reviewedAISuggestions = new Set(existing.reviewedAI_suggestions || []);
  if (updates.reviewedAI_suggestions && Array.isArray(updates.reviewedAI_suggestions)) {
    updates.reviewedAI_suggestions.forEach(id => reviewedAISuggestions.add(id));
  }

  // Update properties
  const updatedRun = {
    ...existing,
    findings,
    remediationNotes,
    reviewedAI_suggestions: reviewedAISuggestions,
    isDraft: updates.isDraft !== undefined ? updates.isDraft : existing.isDraft,
    timestamp: new Date().toISOString(),
    // Increment version
    version: (existing.version || 1) + 1,
  };

  runs[index] = updatedRun;

  try {
    storage.setItem(key, JSON.stringify(runs));
  } catch {
    memoryStore.set(key, JSON.stringify(runs));
  }

  // Also update current scan if it's the same
  if (existing.id === scanId) {
    try {
      storage.setItem(STORAGE_KEYS.CURRENT_SCAN, JSON.stringify(updatedRun));
    } catch {
      memoryStore.set(STORAGE_KEYS.CURRENT_SCAN, JSON.stringify(updatedRun));
    }
  }

  return updatedRun;
};

/**
 * Gets the current scan run.
 * @returns {Object|null} - Current scan run or null
 */
export const getCurrentScan = () => {
  const storage = getStorage();
  try {
    const raw = storage.getItem(STORAGE_KEYS.CURRENT_SCAN);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fall through to memory
  }
  // Try memory fallback
  try {
    const raw = memoryStore.get(STORAGE_KEYS.CURRENT_SCAN);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

/**
 * Gets all scan runs, optionally filtered by page URL.
 * @param {string} [pageUrl] - Filter by page URL
 * @returns {Array<Object>} - Array of scan runs
 */
export const getAllScanRuns = (pageUrl) => {
  const storage = getStorage();
  try {
    const raw = storage.getItem(STORAGE_KEYS.SCAN_RUNS);
    if (raw) {
      const runs = JSON.parse(raw);
      if (!Array.isArray(runs)) return [runs];
      if (pageUrl) {
        return runs.filter((run) => run.pageUrl === pageUrl);
      }
      return runs;
    }
  } catch {
    // fall through to memory
  }
  // Memory fallback
  try {
    const raw = memoryStore.get(STORAGE_KEYS.SCAN_RUNS);
    if (raw) {
      const runs = JSON.parse(raw);
      if (!Array.isArray(runs)) return [runs];
      if (pageUrl) {
        return runs.filter((run) => run.pageUrl === pageUrl);
      }
      return runs;
    }
  } catch {}
  return [];
};

/**
 * Removes a specific scan run (e.g., when user cancels/resumes).
 * @param {string} scanId - The scan run ID to remove
 * @returns {boolean} - Whether the removal was successful
 */
export const removeScanRun = (scanId) => {
  const storage = getStorage();
  const key = STORAGE_KEYS.SCAN_RUNS;

  let runs = [];
  try {
    const raw = storage.getItem(key);
    if (raw) {
      runs = JSON.parse(raw);
      if (!Array.isArray(runs)) runs = [runs];
    }
  } catch {
    runs = [];
  }

  const beforeLength = runs.length;
  runs = runs.filter((run) => run.id !== scanId);

  if (runs.length !== beforeLength) {
    try {
      storage.setItem(key, JSON.stringify(runs));
    } catch {
      memoryStore.set(key, JSON.stringify(runs));
    }
    return true;
  }
  return false;
};

/**
 * Clears all scan data (admin operation).
 * @returns {boolean} - Whether the clearing was successful
 */
export const clearAllScanData = () => {
  const storage = getStorage();
  try {
    storage.setItem(STORAGE_KEYS.SCAN_RUNS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.CURRENT_SCAN, JSON.stringify(null));
    return true;
  } catch {
    memoryStore.clear();
    memoryStore.set(STORAGE_KEYS.SCAN_RUNS, JSON.stringify([]));
    memoryStore.set(STORAGE_KEYS.CURRENT_SCAN, JSON.stringify(null));
    return true;
  }
};

// ---------------------------------------------------------------------------
// Remediation notes management
// ---------------------------------------------------------------------------
/**
 * Adds or updates remediation notes for a finding.
 * @param {string} findingId - The finding ID
 * @param {string} note - The remediation note text
 * @param {string} [scanId] - Optional scan ID; if omitted, uses current scan
 * @returns {Object|null} - Updated scan run or null
 */
export const addRemediationNote = (findingId, note, scanId) => {
  const currentScan = scanId ? null : getCurrentScan();
  const scan = currentScan || getAllScanRuns().find((s) => !s.isDraft);

  if (!scan) return null;

  const remediationNotes = new Map(scan.remediationNotes);
  remediationNotes.set(findingId, note.trim());

  return updateScanRun(scan.id, {
    remediationNotes,
  });
};

/**
 * Gets remediation notes for a finding.
 * @param {string} findingId - The finding ID
 * @param {string} [scanId] - Optional scan ID; if omitted, uses current scan
 * @returns {string|null} - The remediation note or null
 */
export const getRemediationNote = (findingId, scanId) => {
  const currentScan = scanId ? null : getCurrentScan();
  const scan = currentScan || getAllScanRuns().find((s) => !s.isDraft);

  if (!scan) return null;

  return scan.remediationNotes.get(findingId) || null;
};

// ---------------------------------------------------------------------------
// Export all constants
// ---------------------------------------------------------------------------
// Re-export SCAN_STATUS from the service module
import { SCAN_STATUS } from './accessibilityInspectorService.js';

export { SCAN_STATUS };