/**
 * src/services/wardBudgetStorage.js
 * Persistent storage and offline queue management for Participatory Ward Budget (#765).
 */

import {
  INITIAL_BUDGET_CYCLE,
  INITIAL_PROPOSALS,
  INITIAL_COMMENTS,
  INITIAL_DECISIONS,
  INITIAL_IMPLEMENTATION_UPDATES,
} from '../data/wardBudgetSeed.js';
import { SCHEMA_VERSION } from '../data/wardBudgetContract.js';
import { logDiagnostic } from '../utils/diagnostics';

const STORAGE_KEY_PROPOSALS = 'civicbridge_ward_proposals_v1';
const STORAGE_KEY_CYCLE = 'civicbridge_ward_cycle_v1';
const STORAGE_KEY_COMMENTS = 'civicbridge_ward_comments_v1';
const STORAGE_KEY_DECISIONS = 'civicbridge_ward_decisions_v1';
const STORAGE_KEY_UPDATES = 'civicbridge_ward_updates_v1';
const STORAGE_KEY_VOTES = 'civicbridge_ward_votes_v1';
const STORAGE_KEY_OFFLINE_QUEUE = 'civicbridge_ward_offline_queue_v1';

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
    logDiagnostic(`[wardBudgetStorage] Error reading ${key}`, err);
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
    logDiagnostic(`[wardBudgetStorage] Error saving ${key}`, err);
  }
};

export const loadStoredBudgetCycle = () => {
  return safeGetItem(STORAGE_KEY_CYCLE, INITIAL_BUDGET_CYCLE);
};

export const saveStoredBudgetCycle = (cycle) => {
  safeSetItem(STORAGE_KEY_CYCLE, cycle);
};

export const loadStoredProposals = () => {
  const proposals = safeGetItem(STORAGE_KEY_PROPOSALS, null);
  if (!proposals || !Array.isArray(proposals)) {
    // Seed default
    safeSetItem(STORAGE_KEY_PROPOSALS, INITIAL_PROPOSALS);
    return INITIAL_PROPOSALS;
  }
  return proposals;
};

export const saveStoredProposals = (proposals) => {
  safeSetItem(STORAGE_KEY_PROPOSALS, proposals);
};

export const loadStoredComments = () => {
  const comments = safeGetItem(STORAGE_KEY_COMMENTS, null);
  if (!comments || !Array.isArray(comments)) {
    safeSetItem(STORAGE_KEY_COMMENTS, INITIAL_COMMENTS);
    return INITIAL_COMMENTS;
  }
  return comments;
};

export const saveStoredComments = (comments) => {
  safeSetItem(STORAGE_KEY_COMMENTS, comments);
};

export const loadStoredDecisions = () => {
  const decisions = safeGetItem(STORAGE_KEY_DECISIONS, null);
  if (!decisions || !Array.isArray(decisions)) {
    safeSetItem(STORAGE_KEY_DECISIONS, INITIAL_DECISIONS);
    return INITIAL_DECISIONS;
  }
  return decisions;
};

export const saveStoredDecisions = (decisions) => {
  safeSetItem(STORAGE_KEY_DECISIONS, decisions);
};

export const loadStoredUpdates = () => {
  const updates = safeGetItem(STORAGE_KEY_UPDATES, null);
  if (!updates || !Array.isArray(updates)) {
    safeSetItem(STORAGE_KEY_UPDATES, INITIAL_IMPLEMENTATION_UPDATES);
    return INITIAL_IMPLEMENTATION_UPDATES;
  }
  return updates;
};

export const saveStoredUpdates = (updates) => {
  safeSetItem(STORAGE_KEY_UPDATES, updates);
};

export const loadStoredVotes = () => {
  return safeGetItem(STORAGE_KEY_VOTES, []);
};

export const saveStoredVotes = (votes) => {
  safeSetItem(STORAGE_KEY_VOTES, votes);
};

// Offline Queue Operations
export const loadOfflineQueue = () => {
  return safeGetItem(STORAGE_KEY_OFFLINE_QUEUE, []);
};

export const enqueueOfflineAction = (action) => {
  const queue = loadOfflineQueue();
  const entry = {
    ...action,
    queuedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };
  queue.push(entry);
  safeSetItem(STORAGE_KEY_OFFLINE_QUEUE, queue);
  return entry;
};

export const clearOfflineQueue = () => {
  safeSetItem(STORAGE_KEY_OFFLINE_QUEUE, []);
};

// Reset to initial seed state
export const resetWardBudgetData = () => {
  safeSetItem(STORAGE_KEY_CYCLE, INITIAL_BUDGET_CYCLE);
  safeSetItem(STORAGE_KEY_PROPOSALS, INITIAL_PROPOSALS);
  safeSetItem(STORAGE_KEY_COMMENTS, INITIAL_COMMENTS);
  safeSetItem(STORAGE_KEY_DECISIONS, INITIAL_DECISIONS);
  safeSetItem(STORAGE_KEY_UPDATES, INITIAL_IMPLEMENTATION_UPDATES);
  safeSetItem(STORAGE_KEY_VOTES, []);
  safeSetItem(STORAGE_KEY_OFFLINE_QUEUE, []);
};