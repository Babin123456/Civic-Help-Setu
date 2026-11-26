import crypto from 'node:crypto';

/**
 * Migration Operation Types and Decision Outcomes
 */
export const MIGRATION_TYPE = Object.freeze({
  ADDITIVE_SCHEMA: 'ADDITIVE_SCHEMA', // Adding nullable columns / tables
  DESTRUCTIVE_SCHEMA: 'DESTRUCTIVE_SCHEMA', // Dropping columns, altering types
  DATA_TRANSFORMATION: 'DATA_TRANSFORMATION', // Backfills, format re-encoding
  INDEX_CHANGE: 'INDEX_CHANGE'
});

export const REMEDIATION_STRATEGY = Object.freeze({
  AUTOMATIC_ROLLBACK: 'AUTOMATIC_ROLLBACK',
  FORWARD_FIX_ONLY: 'FORWARD_FIX_ONLY',
  MANUAL_INTERVENTION_REQUIRED: 'MANUAL_INTERVENTION_REQUIRED'
});

/**
 * Safe Rollback and Forward-Fix Decision Framework Service
 */
export class SafeMigrationRollbackService {
  constructor() {
    this.migrationRegistry = new Map();
  }

  registerMigration(migration) {
    const { id, type, isReversible, rollbackScript, forwardFixPlaybook, affectedRecordCount } = migration;
    const migrationId = id || `MIG-${crypto.randomBytes(4).toString('hex')}`;

    this.migrationRegistry.set(migrationId, {
      id: migrationId,
      type,
      isReversible: Boolean(isReversible),
      hasRollbackScript: Boolean(rollbackScript),
      hasForwardFixPlaybook: Boolean(forwardFixPlaybook),
      rollbackScript: rollbackScript || null,
      forwardFixPlaybook: forwardFixPlaybook || null,
      affectedRecordCount: Number(affectedRecordCount) || 0,
      registeredAt: new Date().toISOString()
    });

    return migrationId;
  }

  evaluateFailureRemediation(migrationId, failureContext = {}) {
    const migration = this.migrationRegistry.get(migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found in registry.`);
    }

    const { errorType, recordsPartiallyCommitted = 0 } = failureContext;

    // Destructive or non-reversible migrations with data committed MUST use forward-fix
    if (!migration.isReversible || migration.type === MIGRATION_TYPE.DESTRUCTIVE_SCHEMA) {
      return {
        migrationId,
        strategy: REMEDIATION_STRATEGY.FORWARD_FIX_ONLY,
        canRollback: false,
        recommendedAction: 'Execute registered forward-fix playbook to align state without data loss',
        playbook: migration.forwardFixPlaybook,
        requiresApproval: true
      };
    }

    // Additive reversible migrations with valid rollback script can safely rollback
    if (migration.isReversible && migration.hasRollbackScript) {
      return {
        migrationId,
        strategy: REMEDIATION_STRATEGY.AUTOMATIC_ROLLBACK,
        canRollback: true,
        recommendedAction: 'Execute pre-validated backward rollback script',
        rollbackScript: migration.rollbackScript,
        requiresApproval: recordsPartiallyCommitted > 10000
      };
    }

    return {
      migrationId,
      strategy: REMEDIATION_STRATEGY.MANUAL_INTERVENTION_REQUIRED,
      canRollback: false,
      recommendedAction: 'Escalate to database reliability engineering team for manual reconciliation',
      requiresApproval: true
    };
  }

  generateMigrationAuditReport() {
    const all = Array.from(this.migrationRegistry.values());
    return {
      totalMigrations: all.length,
      reversibleCount: all.filter(m => m.isReversible).length,
      forwardFixGuardedCount: all.filter(m => m.hasForwardFixPlaybook).length,
      migrations: all
    };
  }
}
