import { useState, useMemo } from 'react';
import { Clock, Ticket, AlertCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import {
  getCurrentIntakeStatus,
  getOfficeIntakeSchedule,
  formatIntakeTimeRemaining,
  INTAKE_PHASES,
} from '../../services/intakeWindowService';

export default function IntakeWindowBadge({ office }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const status = useMemo(() => {
    return getCurrentIntakeStatus(office);
  }, [office]);

  const schedule = useMemo(() => {
    return getOfficeIntakeSchedule(office);
  }, [office]);

  const getBadgeColors = (variant) => {
    switch (variant) {
      case 'success':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          border: 'rgba(16, 185, 129, 0.3)',
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.3)',
        };
      case 'danger':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)',
        };
      case 'info':
      default:
        return {
          bg: 'rgba(56, 189, 248, 0.15)',
          color: '#38bdf8',
          border: 'rgba(56, 189, 248, 0.3)',
        };
    }
  };

  const colors = getBadgeColors(status.badgeVariant);

  return (
    <div
      style={{
        marginTop: '0.5rem',
        borderRadius: '8px',
        border: `1px solid ${colors.border}`,
        background: 'rgba(0, 0, 0, 0.15)',
        overflow: 'hidden',
        fontSize: '0.8rem',
      }}
      role="region"
      aria-label="Public service intake window status"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.4rem 0.65rem',
          cursor: 'pointer',
          background: colors.bg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: colors.color, fontWeight: 700 }}>
          {status.isAcceptingTokens ? <Ticket size={14} /> : <Clock size={14} />}
          <span>{status.label}</span>
        </div>

        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: colors.color,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-expanded={isExpanded}
          aria-label="Toggle intake window schedule"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div
          style={{
            padding: '0.65rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.4rem' }}>
            Daily Counter & Token Schedule:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {schedule.map((slot) => {
              const isCurrent = status.currentWindow?.id === slot.id;
              return (
                <div
                  key={slot.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.25rem 0.4rem',
                    borderRadius: '4px',
                    background: isCurrent ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    borderLeft: isCurrent ? '2px solid var(--accent-main, #38bdf8)' : '2px solid transparent',
                  }}
                >
                  <span style={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#38bdf8' : 'inherit' }}>
                    {slot.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                    {String(slot.startHour).padStart(2, '0')}:{String(slot.startMin).padStart(2, '0')} -{' '}
                    {String(slot.endHour).padStart(2, '0')}:{String(slot.endMin).padStart(2, '0')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
