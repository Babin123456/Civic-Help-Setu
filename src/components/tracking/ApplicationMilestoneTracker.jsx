import { useMemo } from 'react';
import { CheckCircle2, Clock, AlertTriangle, Calendar, Layers } from 'lucide-react';
import { estimateStageMilestones } from '../../services/applicationMilestoneEstimator';

export default function ApplicationMilestoneTracker({ application }) {
  const milestoneData = useMemo(() => estimateStageMilestones(application), [application]);

  if (!application || !milestoneData || milestoneData.stages.length === 0) return null;

  const { stages, hasBottleneck, bottleneckStage } = milestoneData;

  return (
    <div
      className="glass-panel"
      role="region"
      aria-label="Application Milestone Timeline and Bottlenecks"
      style={{
        marginTop: '1.25rem',
        padding: '1.25rem',
        borderRadius: '0.875rem',
        border: '1px solid var(--border-light, #334155)',
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.02))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>
            Estimated Milestone Schedule &amp; Stage Velocity
          </h4>
        </div>
        {hasBottleneck ? (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
            }}
          >
            Stalled Stage Detected
          </span>
        ) : (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
            }}
          >
            Progressing on Schedule
          </span>
        )}
      </div>

      {/* Bottleneck Warning Alert */}
      {hasBottleneck && bottleneckStage && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
          }}
        >
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.82rem' }}>
            <strong style={{ color: '#ef4444' }}>
              Potential Delay at {bottleneckStage.stageName}:
            </strong>{' '}
            <span style={{ color: 'var(--text-secondary)' }}>
              This stage has exceeded its standard milestone window by <strong>{bottleneckStage.delayedDays} days</strong>. Most delays at this step occur during physical record verification or field officer deputation.
            </span>
          </div>
        </div>
      )}

      {/* Milestone Step Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {stages.map((st) => {
          const isDone = st.status === 'COMPLETED';
          const isCurrent = st.status === 'IN_PROGRESS';
          const dateStr = st.targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

          return (
            <div
              key={st.index}
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: isCurrent
                  ? st.isDelayed ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--accent-main)'
                  : isDone
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : '1px solid var(--border-light, #334155)',
                background: isCurrent
                  ? st.isDelayed ? 'rgba(239, 68, 68, 0.06)' : 'rgba(56, 189, 248, 0.06)'
                  : isDone
                  ? 'rgba(34, 197, 94, 0.04)'
                  : 'rgba(255, 255, 255, 0.01)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                  STAGE {st.index + 1}
                </span>
                {isDone ? (
                  <CheckCircle2 size={14} color="#22c55e" />
                ) : isCurrent ? (
                  <Clock size={14} color={st.isDelayed ? '#ef4444' : 'var(--accent-main)'} />
                ) : (
                  <Clock size={14} color="#64748b" />
                )}
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {st.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <Calendar size={11} />
                <span>Target: {dateStr} ({st.expectedDays}d)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
