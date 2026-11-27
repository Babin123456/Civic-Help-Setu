import { ShieldCheck, AlertCircle, Zap } from 'lucide-react';

export default function CleanRoomBudgetBadge({ workspace }) {
  if (!workspace) return null;

  const queryBudgetTotal = workspace.queryBudgetTotal || 40;
  const queryBudgetRemaining = workspace.queryBudgetRemaining ?? queryBudgetTotal;
  const epsilonBudgetTotal = workspace.epsilonBudgetTotal || 4.0;
  const epsilonBudgetRemaining = workspace.epsilonBudgetRemaining ?? epsilonBudgetTotal;

  const queryPct = Math.round((queryBudgetRemaining / queryBudgetTotal) * 100);
  const epsilonPct = Math.round((epsilonBudgetRemaining / epsilonBudgetTotal) * 100);

  const isLowBudget = queryBudgetRemaining <= 5 || epsilonBudgetRemaining <= 0.5;
  const isExhausted = queryBudgetRemaining <= 0 || epsilonBudgetRemaining <= 0;

  return (
    <div
      className="card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                background:
                  workspace.status === 'approved'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : workspace.status === 'pending_approval'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                color:
                  workspace.status === 'approved'
                    ? '#10b981'
                    : workspace.status === 'pending_approval'
                    ? '#f59e0b'
                    : '#ef4444',
                border: '1px solid currentColor',
              }}
            >
              {workspace.status.replace('_', ' ')}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Tier: <strong style={{ color: 'var(--text-primary)' }}>{workspace.tier}</strong>
            </span>
          </div>
          <h3 style={{ margin: '0.2rem 0', fontSize: '1.15rem' }}>{workspace.partnerOrg}</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Lead Researcher: {workspace.partnerName} &bull; {workspace.partnerEmail}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Query Tokens Budget */}
          <div style={{ minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                <Zap size={14} color="#f59e0b" /> Query Tokens
              </span>
              <strong>
                {queryBudgetRemaining} / {queryBudgetTotal}
              </strong>
            </div>
            <div
              style={{
                height: '8px',
                borderRadius: '4px',
                background: 'var(--border-light)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, queryPct))}%`,
                  background: isExhausted ? '#ef4444' : isLowBudget ? '#f59e0b' : '#3b82f6',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Differential Privacy Epsilon Budget */}
          <div style={{ minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={14} color="#10b981" /> Privacy Budget (ε)
              </span>
              <strong>
                {epsilonBudgetRemaining.toFixed(1)} / {epsilonBudgetTotal.toFixed(1)}
              </strong>
            </div>
            <div
              style={{
                height: '8px',
                borderRadius: '4px',
                background: 'var(--border-light)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, epsilonPct))}%`,
                  background: isExhausted ? '#ef4444' : isLowBudget ? '#f59e0b' : '#10b981',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {isExhausted && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.6rem 0.8rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '0.4rem',
            fontSize: '0.85rem',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} />
          <span>
            Workspace query budget is exhausted. You cannot execute queries until replenished by a Municipal Data Steward.
          </span>
        </div>
      )}
    </div>
  );
}
