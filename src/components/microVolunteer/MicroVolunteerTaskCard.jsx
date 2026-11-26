import { Clock, MapPin, Users, CalendarDays, ArrowRight } from 'lucide-react';
import { MicroVolunteerStatusBadge } from './MicroVolunteerStates.jsx';
import { TASK_STATUS_TONE, formatDate, formatMinutes } from './presentation.js';

/**
 * One task in the browsable board. The card is a real button so the whole
 * surface is keyboard reachable, and the visible focus ring is defined in CSS.
 */
export default function MicroVolunteerTaskCard({ task, selected, onSelect }) {
  return (
    <button
      type="button"
      className="mv-card mv-task-card mv-card-button"
      data-selected={selected ? 'true' : 'false'}
      aria-pressed={selected}
      onClick={() => onSelect(task.publicRef)}
      style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
    >
      <div className="mv-inline-actions" style={{ justifyContent: 'space-between' }}>
        <MicroVolunteerStatusBadge
          status={task.status}
          label={task.statusLabel}
          tone={TASK_STATUS_TONE[task.status] || 'neutral'}
        />
        <span className="mv-small mv-muted">{task.categoryLabel}</span>
      </div>
      <h3>{task.title}</h3>
      <div className="mv-meta-row">
        <span>
          <MapPin size={14} aria-hidden="true" /> {task.locality} ({task.jurisdictionId})
        </span>
        <span>
          <Clock size={14} aria-hidden="true" /> {formatMinutes(task.timeEstimateMinutes)}
        </span>
        <span>
          <CalendarDays size={14} aria-hidden="true" /> Due {formatDate(task.dueDate)}
        </span>
        <span>
          <Users size={14} aria-hidden="true" /> {task.openPlaces} of {task.capacity} place
          {task.capacity === 1 ? '' : 's'} open
        </span>
      </div>
      <p className="mv-small mv-muted" style={{ margin: 0 }}>
        {task.instructions.length > 150 ? `${task.instructions.slice(0, 147)}…` : task.instructions}
      </p>
      <span className="mv-small" style={{ color: 'var(--accent-main)', fontWeight: 700 }}>
        View details and evidence requirements <ArrowRight size={14} aria-hidden="true" />
      </span>
    </button>
  );
}
