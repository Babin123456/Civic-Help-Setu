import { describe, it, expect, beforeEach } from 'vitest';
import {
  OperationalRunbookService,
  ActionRiskLevel,
  RunbookError
} from './operationalRunbookService.js';

describe('OperationalRunbookService', () => {
  let service;

  beforeEach(() => {
    service = new OperationalRunbookService();
  });

  it('runs dry-run simulation and flags high risk approval requirements', async () => {
    const dryRun = await service.dryRun('rb_emergency_database_failover');
    expect(dryRun.isDryRunSuccess).toBe(true);
    expect(dryRun.requiresHumanApproval).toBe(true);
    expect(dryRun.riskLevel).toBe(ActionRiskLevel.HIGH_DANGEROUS);
    expect(dryRun.executionPlan.length).toBe(2);
  });

  it('blocks high risk execution without explicit human approval', async () => {
    await expect(service.executeRunbook('rb_emergency_database_failover', {
      operatorId: 'ops_bot_auto'
    })).rejects.toThrow(RunbookError);
  });

  it('executes runbook successfully when approved', async () => {
    const execution = await service.executeRunbook('rb_emergency_database_failover', {
      operatorId: 'ops_lead_1',
      approvedBy: 'infra_director_99'
    });

    expect(execution.status).toBe('COMPLETED');
    expect(execution.completedSteps.length).toBe(2);
    expect(execution.approvedBy).toBe('infra_director_99');
  });

  it('triggers automatic compensating rollback upon partial failure', async () => {
    try {
      await service.executeRunbook('rb_purge_dead_letter_queue', {
        operatorId: 'ops_bot',
        simulateStepFailure: 'scale_consumer'
      });
      expect.fail('Should have thrown execution error');
    } catch (err) {
      expect(err).toBeInstanceOf(RunbookError);
      expect(err.details.rollbacksExecuted.length).toBe(1);
      expect(err.details.rollbacksExecuted[0].compensatingAction).toBe('RESTORE_DLQ_FROM_GCS');
    }
  });
});
