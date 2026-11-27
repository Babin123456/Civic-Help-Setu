/**
 * api/_lib/agentApprovalInboxStore.js
 *
 * Persistent store for Civic Agent Approval Inbox and Action Simulation (#1446).
 */

import {
  APPROVAL_INBOX_SCHEMA_VERSION,
  migrateApprovalInboxState,
  verifyDecisionLogChain,
} from '../../src/services/agentApprovalInboxService.js';

const MAX_PROPOSALS = 300;

export class InMemoryAgentApprovalInboxStore {
  constructor(initialState = {}) {
    const migrated = migrateApprovalInboxState(initialState);
    this.schemaVersion = migrated.schemaVersion || APPROVAL_INBOX_SCHEMA_VERSION;
    this.proposals = new Map();
    this.proposalOrder = [];
    this.idempotencyIndex = new Map();
    this.decisionLog = migrated.decisionLog || [];

    for (const p of migrated.proposals) {
      if (p?.proposalId) {
        this.proposals.set(p.proposalId, p);
        this.proposalOrder.push(p.proposalId);
        if (p.idempotencyKey) {
          this.idempotencyIndex.set(p.idempotencyKey, p.proposalId);
        }
      }
    }
  }

  async findByIdempotencyKey(key) {
    if (!key) return null;
    const id = this.idempotencyIndex.get(key);
    return id ? this.proposals.get(id) || null : null;
  }

  async saveProposal(proposal) {
    if (!proposal?.proposalId) throw new Error('Proposal requires proposalId');
    if (!this.proposals.has(proposal.proposalId)) {
      this.proposalOrder.push(proposal.proposalId);
      while (this.proposalOrder.length > MAX_PROPOSALS) {
        const oldest = this.proposalOrder.shift();
        this.proposals.delete(oldest);
      }
    }
    this.proposals.set(proposal.proposalId, proposal);
    if (proposal.idempotencyKey) {
      this.idempotencyIndex.set(proposal.idempotencyKey, proposal.proposalId);
    }
    return proposal;
  }

  async getProposal(proposalId) {
    return this.proposals.get(proposalId) || null;
  }

  async listProposals({ status = null, jurisdiction = null, limit = 50 } = {}) {
    let items = Array.from(this.proposals.values());
    if (status && status !== 'all') {
      items = items.filter((p) => p.status === status);
    }
    if (jurisdiction) {
      const target = jurisdiction.trim().toLowerCase();
      items = items.filter((p) => String(p.jurisdiction || '').toLowerCase() === target);
    }
    items.sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    return items.slice(0, Math.min(100, Math.max(1, Number(limit) || 50)));
  }

  async getLatestLogHash() {
    if (this.decisionLog.length === 0) return '0'.repeat(64);
    return this.decisionLog[0].hash;
  }

  async appendDecisionLog(entry) {
    if (!entry) return null;
    this.decisionLog.unshift(entry);
    return entry;
  }

  async listDecisionLog({ limit = 50 } = {}) {
    return {
      entries: this.decisionLog.slice(0, Math.min(100, Math.max(1, Number(limit) || 50))),
      chainValid: verifyDecisionLogChain(this.decisionLog),
    };
  }
}

let defaultStore = null;

export function getDefaultAgentApprovalInboxStore() {
  if (!defaultStore) {
    defaultStore = new InMemoryAgentApprovalInboxStore();
  }
  return defaultStore;
}

export function resetDefaultAgentApprovalInboxStoreForTests() {
  defaultStore = null;
}

export async function getProductionAgentApprovalInboxStore() {
  return getDefaultAgentApprovalInboxStore();
}
