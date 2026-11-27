/**
 * src/services/agentApprovalInboxStorage.js
 *
 * Offline-first local persistence for Civic Agent Approval Inbox (#1446).
 */

import {
  decideActionProposal,
  migrateApprovalInboxState,
  simulateActionProposal,
} from './agentApprovalInboxService.js';

export const APPROVAL_INBOX_STORAGE_KEY = 'civicbridge_agent_approval_inbox_v1';

let memoryFallback = null;

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore restricted storage
  }
  return null;
}

export function loadLocalApprovalInboxState() {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(APPROVAL_INBOX_STORAGE_KEY);
      if (raw) {
        return migrateApprovalInboxState(JSON.parse(raw));
      }
    } catch {
      // Fallback
    }
  }
  if (memoryFallback) {
    return migrateApprovalInboxState(memoryFallback);
  }
  return migrateApprovalInboxState({});
}

export function saveLocalApprovalInboxState(state) {
  const migrated = migrateApprovalInboxState(state);
  memoryFallback = migrated;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(APPROVAL_INBOX_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // Ignore quota
    }
  }
  return migrated;
}

export function resetLocalApprovalInboxState() {
  memoryFallback = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(APPROVAL_INBOX_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export function runLocalDryRunSimulation(proposalId) {
  const state = loadLocalApprovalInboxState();
  const target = state.proposals.find((p) => p.proposalId === proposalId);
  if (!target) throw new Error('Proposal not found.');
  const simulation = simulateActionProposal(target);
  const updated = { ...target, simulation };
  const next = saveLocalApprovalInboxState({
    ...state,
    proposals: state.proposals.map((p) => (p.proposalId === proposalId ? updated : p)),
  });
  return { proposal: updated, simulation, state: next };
}

export function decideLocalProposal(proposalId, params) {
  const state = loadLocalApprovalInboxState();
  const target = state.proposals.find((p) => p.proposalId === proposalId);
  const prevLogHash = state.decisionLog[0]?.hash || '0'.repeat(64);
  const res = decideActionProposal(target, { ...params, prevLogHash });
  const nextLog = res.logEntry ? [res.logEntry, ...state.decisionLog] : state.decisionLog;
  const next = saveLocalApprovalInboxState({
    ...state,
    proposals: state.proposals.map((p) => (p.proposalId === proposalId ? res.proposal : p)),
    decisionLog: nextLog,
  });
  return { ...res, state: next };
}
