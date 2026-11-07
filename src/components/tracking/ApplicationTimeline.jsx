import {
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  Calendar,
  Hourglass,
  HelpCircle,
  Check,
} from 'lucide-react';

/**
 * ApplicationTimeline Component
 *
 * Renders an accessible, responsive vertical timeline of service application stages.
 * Distinguishes Completed, In Progress, Action Needed, Delayed, and Upcoming states
 * with distinct text labels, shape glyphs, and high-contrast borders rather than color alone.
 * Provides explicit fallbacks for missing dates, descriptions, or status indicators.
 */
const ApplicationTimeline = ({ stages = [] }) => {
  if (!stages || stages.length === 0) {
    return (
      <div
        role="status"
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'var(--glass-bg, rgba(255, 255, 255, 0.02))',
          borderRadius: '0.75rem',
          border: '1px dashed var(--border-light)',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          No application milestone stages have been recorded for this application yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="application-timeline-wrapper"
      role="region"
      aria-label="Application Milestone Progress Timeline"
      style={{
        position: 'relative',
        padding: '1rem 0.5rem 1rem 0.5rem',
      }}
    >
      {/* Accessible Status Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          padding: '0.65rem 0.85rem',
          background: 'var(--glass-bg, rgba(255, 255, 255, 0.02))',
          borderRadius: '0.6rem',
          border: '1px solid var(--border-light)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
          <CheckCircle2 size={13} color="var(--success, #10b981)" aria-hidden="true" />
          <span>Completed</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
          <Clock size={13} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <span>In Progress</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
          <AlertTriangle size={13} color="#ef4444" aria-hidden="true" />
          <span>Action Required</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
          <Hourglass size={13} color="#d97706" aria-hidden="true" />
          <span>Delayed</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
          <Circle size={13} color="var(--text-tertiary, #94a3b8)" aria-hidden="true" />
          <span>Upcoming</span>
        </span>
      </div>

      {/* Main Ordered Timeline List */}
      <ol
        className="application-timeline-list"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
          position: 'relative',
        }}
      >
        {stages.map((stage, idx) => {
          const isDone = Boolean(stage.completed);
          const isAction = !isDone && Boolean(stage.actionRequired);
          const isDelayed = !isDone && Boolean(stage.isDelayed);
          const isInProgress = !isDone && !isAction && Boolean(stage.inProgress);
          const isUpcoming = !isDone && !isAction && !isInProgress;

          // State textual badge and icon representation
          let statusLabel = 'Upcoming';
          let StatusIcon = Circle;
          let iconColor = 'var(--text-tertiary, #94a3b8)';
          let badgeBg = 'rgba(148, 163, 184, 0.1)';
          let badgeColor = 'var(--text-secondary)';

          if (isDone) {
            statusLabel = 'Completed';
            StatusIcon = CheckCircle2;
            iconColor = 'var(--success, #10b981)';
            badgeBg = 'rgba(16, 185, 129, 0.15)';
            badgeColor = 'var(--success, #10b981)';
          } else if (isAction) {
            statusLabel = 'Action Required';
            StatusIcon = AlertTriangle;
            iconColor = '#ef4444';
            badgeBg = 'rgba(239, 68, 68, 0.15)';
            badgeColor = '#ef4444';
          } else if (isDelayed) {
            statusLabel = 'Delayed Step';
            StatusIcon = Hourglass;
            iconColor = '#d97706';
            badgeBg = 'rgba(217, 119, 6, 0.15)';
            badgeColor = '#d97706';
          } else if (isInProgress) {
            statusLabel = 'In Progress';
            StatusIcon = Clock;
            iconColor = 'var(--accent-main, #38bdf8)';
            badgeBg = 'rgba(56, 189, 248, 0.15)';
            badgeColor = 'var(--accent-main, #38bdf8)';
          }

          const titleText = stage.title || `Stage ${idx + 1}`;
          const descriptionText = stage.description || 'No detailed progress notes provided by the department for this milestone.';
          const timestampText = stage.timestamp || 'Date pending';

          return (
            <li
              key={stage.id || idx}
              className="application-timeline-item"
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'flex-start',
                position: 'relative',
              }}
            >
              {/* Vertical Connector Line between items */}
              {idx < stages.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '1.15rem',
                    top: '2.5rem',
                    bottom: '-1.75rem',
                    width: '2px',
                    background: isDone ? 'var(--success, #10b981)' : 'var(--border-light, #334155)',
                    zIndex: 0,
                  }}
                />
              )}

              {/* Stage Icon Node */}
              <div
                style={{
                  width: '2.4rem',
                  height: '2.4rem',
                  borderRadius: '50%',
                  background: isDone
                    ? 'rgba(16, 185, 129, 0.12)'
                    : isInProgress
                    ? 'rgba(56, 189, 248, 0.12)'
                    : isAction
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'var(--bg-main)',
                  border: `2px solid ${iconColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  zIndex: 1,
                  boxShadow: isInProgress ? '0 0 10px rgba(56, 189, 248, 0.3)' : 'none',
                }}
                aria-label={`Status: ${statusLabel}`}
              >
                <StatusIcon size={18} color={iconColor} aria-hidden="true" />
              </div>

              {/* Stage Content Card */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: isInProgress
                    ? 'rgba(56, 189, 248, 0.04)'
                    : isAction
                    ? 'rgba(239, 68, 68, 0.04)'
                    : 'transparent',
                  padding: isInProgress || isAction ? '0.85rem 1rem' : '0.2rem 0',
                  borderRadius: '0.75rem',
                  border: isInProgress
                    ? '1px solid rgba(56, 189, 248, 0.3)'
                    : isAction
                    ? '1px solid rgba(239, 68, 68, 0.3)'
                    : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    flexWrap: 'wrap',
                    marginBottom: '0.25rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    Stage {idx + 1}
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.55rem',
                      borderRadius: '99px',
                      background: badgeBg,
                      color: badgeColor,
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>

                <h4
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: '700',
                    margin: '0 0 0.35rem 0',
                    color: isDone
                      ? 'var(--text-primary)'
                      : isAction
                      ? '#ef4444'
                      : isInProgress
                      ? 'var(--accent-main)'
                      : 'var(--text-secondary)',
                    wordBreak: 'break-word',
                  }}
                >
                  {titleText}
                </h4>

                <p
                  style={{
                    color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
                    fontSize: '0.9rem',
                    margin: '0 0 0.5rem 0',
                    lineHeight: '1.55',
                    wordBreak: 'break-word',
                  }}
                >
                  {descriptionText}
                </p>

                {/* Explicit Timestamp or Fallback */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    color: stage.timestamp ? 'var(--text-tertiary)' : 'var(--text-muted, #64748b)',
                    background: 'var(--glass-bg, rgba(255, 255, 255, 0.02))',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.4rem',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <Calendar size={12} aria-hidden="true" />
                  <span>{timestampText}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default ApplicationTimeline;
