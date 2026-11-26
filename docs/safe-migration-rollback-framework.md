# Safe Rollback and Forward-Fix Decision Framework for Data Migrations

## Purpose
Establishes a principled decision framework for evaluating database migration failures and determining whether to trigger an automated rollback or mandate a forward-fix compensating transaction.

## Decision Matrix
1. **Additive Reversible Migrations**: Schema alterations that do not discard data (e.g., adding nullable columns) can execute automated rollback via validated drop/revert scripts.
2. **Destructive / Non-Reversible Migrations**: Migrations involving column removals, type truncations, or irreversible re-encodings require an audited **forward-fix playbook** to prevent permanent data loss.
3. **Threshold Gates**: Partial migrations affecting large record counts require mandatory human approval before applying either strategy.
