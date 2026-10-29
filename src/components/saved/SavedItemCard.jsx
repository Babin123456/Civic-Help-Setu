import { Link } from 'react-router-dom';
import {
  Bookmark,
  Calendar,
  Edit3,
  Trash2,
  ArrowRight,
  Folder,
  Star,
  Bell,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { calculateDaysRemaining } from '../../services/reminderNotificationService';

const SavedItemCard = ({
  item,
  service,
  reminder = null,
  onEditNotes,
  onScheduleReminder,
  onToggleFavorite,
  onRemove,
}) => {
  const isHighPriority = item.priority === 'high';
  const isMedPriority = item.priority === 'medium';
  const isFavorite = Boolean(item.isFavorite);

  const daysLeft = reminder?.deadlineDate ? calculateDaysRemaining(reminder.deadlineDate) : null;

  return (
    <div
      className="card animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        padding: '2rem',
        position: 'relative',
        border: isFavorite ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-light)',
      }}
    >
      <div>
        {/* Top Badges Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '99px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--border-light)',
                color: 'var(--accent-main)',
                fontWeight: '600',
              }}
            >
              <Folder size={12} /> {item.folder || 'General'}
            </span>

            {isHighPriority && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '99px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--error, #ef4444)',
                  fontWeight: '700',
                }}
              >
                High Priority
              </span>
            )}
            {isMedPriority && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '99px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--warning, #f59e0b)',
                  fontWeight: '700',
                }}
              >
                Medium
              </span>
            )}

            {/* Reminder Badge */}
            {reminder && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '99px',
                  background:
                    daysLeft != null && daysLeft <= 7
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(56, 189, 248, 0.15)',
                  color:
                    daysLeft != null && daysLeft <= 7 ? '#ef4444' : 'var(--accent-main)',
                  fontWeight: '700',
                }}
              >
                <Bell size={11} />
                {daysLeft != null
                  ? daysLeft > 0
                    ? `Due in ${daysLeft}d`
                    : daysLeft === 0
                    ? 'Due Today'
                    : 'Overdue'
                  : 'Reminder Set'}
              </span>
            )}
          </div>

          {/* Action Icons: Favorite Star & Remove */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              onClick={() => onToggleFavorite(service.id)}
              aria-label={isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
              title={isFavorite ? 'Favorited' : 'Mark favorite'}
              style={{
                background: 'none',
                border: 'none',
                color: isFavorite ? '#f59e0b' : 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Star size={18} fill={isFavorite ? '#f59e0b' : 'none'} />
            </button>

            <button
              type="button"
              onClick={() => onRemove(service.id)}
              aria-label="Remove bookmark"
              title="Remove from saved hub"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--error)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <h3
          style={{
            fontSize: '1.35rem',
            fontWeight: '800',
            marginBottom: '0.5rem',
            color: 'var(--text-primary)',
          }}
        >
          {service.name}
        </h3>
        {service.archived === true && (
          <p className="retired-badge">Retired guide, no longer in the directory</p>
        )}

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            marginBottom: '1rem',
          }}
        >
          {service.shortDescription}
        </p>

        {/* Notes preview if present */}
        {item.notes ? (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--glass-bg-subtle)',
              border: '1px solid var(--border-light)',
              borderRadius: '0.75rem',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                fontWeight: '700',
              }}
            >
              Citizen Notes:
            </span>
            <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{item.notes}"</p>
          </div>
        ) : null}

        {/* Reminder details snippet */}
        {reminder && reminder.reminderNote && (
          <div
            style={{
              padding: '0.6rem 0.85rem',
              borderRadius: '0.5rem',
              background: 'rgba(56, 189, 248, 0.05)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}
          >
            <span style={{ fontWeight: '600', color: 'var(--accent-main)', display: 'block' }}>
              Target: {reminder.deadlineDate} ({reminder.reminderType})
            </span>
            <span>{reminder.reminderNote}</span>
          </div>
        )}
      </div>

      {/* Card Footer with Details & Actions */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '1rem',
          borderTop: '1px dashed var(--border-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => onEditNotes(item, service)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Edit3 size={14} /> Notes
          </button>

          <button
            type="button"
            onClick={() => onScheduleReminder(service)}
            style={{
              background: 'none',
              border: 'none',
              color: reminder ? 'var(--accent-main)' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Bell size={14} /> {reminder ? 'Edit Reminder' : 'Set Reminder'}
          </button>
        </div>

        <Link
          to={`/services/${service.id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            fontWeight: '600',
            color: 'var(--accent-main)',
          }}
        >
          <span>Open Guide</span>
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
};

export default SavedItemCard;
