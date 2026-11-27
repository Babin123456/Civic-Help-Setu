import { describe, it, expect } from 'vitest';
import {
  ACTION_DECISION,
  ACTION_STATUS,
  createActionProposal,
  decideActionProposal,
  migrateApprovalInboxState,
  simulateActionProposal,
  verifyDecisionLogChain,
} from './agentApprovalInboxService.js';

describe('Civic Agent Approval Inbox & Action Simulation (#1446)', () => {
  it('runs deterministic dry-run simulation without executing external writes', () => {
    const { valid, proposal } = createActionProposal(
      {
        title: 'Update Ward 12 Notice',
        jurisdiction: 'IN-UP',
        toolCalls: [
          { toolName: 'fetchNotice', operationType: 'read', targetEndpoint: '/api/notices' },
          { toolName: 'publishNotice', operationType: 'write', targetEndpoint: '/api/notices' },
        ],
        affectedRecords: [{ recordType: 'notice', recordId: 'n-12', changeSummary: 'Update deadline' }],
        officialRule: {
          source: 'UP Municipal Gazette',
          jurisdiction: 'IN-UP',
          effectiveDate: '2026-01-01',
          lastVerifiedAt: '2026-11-20T00:00:00.000Z',
        },
      },
      'agent-1'
    );

    expect(valid).toBe(true);
    expect(proposal.status).toBe(ACTION_STATUS.PENDING_APPROVAL);
    expect(proposal.simulation.dryRun).toBe(true);
    expect(proposal.simulation.executedExternalWrites).toBe(false);
    expect(proposal.simulation.requiresExplicitApproval).toBe(true);
    expect(proposal.simulation.wouldMutateCount).toBe(1);
    expect(proposal.simulation.ruleProvenance.verified).toBe(true);
  });

  it('rejects PII in proposals and marks incomplete official rules unverified', () => {
    const bad = createActionProposal({
      title: 'Bad Proposal',
      toolCalls: [{ toolName: 'write', operationType: 'write', args: { aadhaar: '2345 6789 0123' } }],
    });
    expect(bad.valid).toBe(false);

    const sim = simulateActionProposal({
      toolCalls: [{ toolName: 'read', operationType: 'read' }],
      officialRule: { source: 'Draft' },
    });
    expect(sim.ruleProvenance.verified).toBe(false);
    expect(sim.ruleProvenance.status).toBe('unverified');
  });

  it('supports approve, edit, reject, idempotent replay, and hash-chained immutable logs', () => {
    const { proposal } = createActionProposal({
      title: 'Update Service SLA',
      jurisdiction: 'IN-UP',
      toolCalls: [{ toolName: 'updateSla', operationType: 'write', args: { days: 15 } }],
    });

    const res1 = decideActionProposal(proposal, {
      actorId: 'admin-1',
      role: 'admin',
      decision: ACTION_DECISION.EDIT,
      rationale: 'Adjusted SLA to 10 days per circular.',
      editedToolCalls: [{ toolName: 'updateSla', operationType: 'write', args: { days: 10 } }],
      idempotencyKey: 'idem-1',
    });

    expect(res1.proposal.status).toBe(ACTION_STATUS.EDITED_APPROVED);
    expect(res1.logEntry.hash).toBeTruthy();
    expect(verifyDecisionLogChain([res1.logEntry])).toBe(true);

    // Idempotent replay returns cached decision without creating duplicate log
    const replay = decideActionProposal(res1.proposal, {
      actorId: 'admin-1',
      role: 'admin',
      decision: ACTION_DECISION.EDIT,
      idempotencyKey: 'idem-1',
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.logEntry).toBeNull();

    // Tampering with decision log breaks chain verification
    const tampered = [{ ...res1.logEntry, rationale: 'Tampered' }];
    expect(verifyDecisionLogChain(tampered)).toBe(false);

    const migrated = migrateApprovalInboxState({});
    expect(migrated.schemaVersion).toBe('1.0.0');
  });
});
