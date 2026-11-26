import { describe, it, expect, beforeEach } from 'vitest';
import {
  SafeMigrationRollbackService,
  MIGRATION_TYPE,
  REMEDIATION_STRATEGY
} from './safeMigrationRollbackService.js';

describe('SafeMigrationRollbackService', () => {
  let service;

  beforeEach(() => {
    service = new SafeMigrationRollbackService();
  });

  it('prescribes automatic rollback for reversible migrations with rollback scripts', () => {
    const id = service.registerMigration({
      type: MIGRATION_TYPE.ADDITIVE_SCHEMA,
      isReversible: true,
      rollbackScript: 'ALTER TABLE citizens DROP COLUMN IF EXISTS temp_status;',
      affectedRecordCount: 500
    });

    const remediation = service.evaluateFailureRemediation(id, { recordsPartiallyCommitted: 100 });
    expect(remediation.strategy).toBe(REMEDIATION_STRATEGY.AUTOMATIC_ROLLBACK);
    expect(remediation.canRollback).toBe(true);
    expect(remediation.rollbackScript).toBeDefined();
  });

  it('mandates forward-fix only for destructive or non-reversible data migrations', () => {
    const id = service.registerMigration({
      type: MIGRATION_TYPE.DESTRUCTIVE_SCHEMA,
      isReversible: false,
      forwardFixPlaybook: 'docs/runbooks/db-forward-fix-citizen-id-v2.md',
      affectedRecordCount: 50000
    });

    const remediation = service.evaluateFailureRemediation(id, {
      errorType: 'FOREIGN_KEY_VIOLATION',
      recordsPartiallyCommitted: 25000
    });

    expect(remediation.strategy).toBe(REMEDIATION_STRATEGY.FORWARD_FIX_ONLY);
    expect(remediation.canRollback).toBe(false);
    expect(remediation.playbook).toBe('docs/runbooks/db-forward-fix-citizen-id-v2.md');
    expect(remediation.requiresApproval).toBe(true);
  });

  it('generates accurate registry audit report', () => {
    service.registerMigration({ type: MIGRATION_TYPE.ADDITIVE_SCHEMA, isReversible: true });
    service.registerMigration({ type: MIGRATION_TYPE.DESTRUCTIVE_SCHEMA, isReversible: false });

    const audit = service.generateMigrationAuditReport();
    expect(audit.totalMigrations).toBe(2);
    expect(audit.reversibleCount).toBe(1);
  });
});
