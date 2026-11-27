import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { MicroVolunteerStatusBadge, MicroVolunteerLoadingButton } from './MicroVolunteerStates.jsx';
import { TASK_STATUS_TONE, formatDate, formatDateTime, formatMinutes } from './presentation.js';

export default function MicroVolunteerTaskDetail({
  task,
  approvedOutcomes = [],
  canClaim,
  isSignedIn,
  busy,
  error,
  onClaim,
  onBack,
}) {
  const accepting = ['open', 'assigned', 'reopened'].includes(task.status) && task.openPlaces > 0;

  return (
    <section className="mv-card" aria-labelledby="mv-task-detail-heading">
      <div className="mv-inline-actions" style={{ justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <button type="button" className="mv-button mv-button-ghost" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to the board
        </button>
        <MicroVolunteerStatusBadge
          status={task.status}
          label={task.statusLabel}
          tone={TASK_STATUS_TONE[task.status] || 'neutral'}
        />
      </div>

      <h2 id="mv-task-detail-heading" style={{ marginTop: 0 }}>
        {task.title}
      </h2>
      <p className="mv-small mv-muted">
        Public reference {task.publicRef} · {task.categoryLabel}
      </p>

      <div className="mv-meta-row" style={{ marginBottom: '0.9rem' }}>
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
          <Users size={14} aria-hidden="true" /> {task.openPlaces} of {task.capacity} open
        </span>
      </div>

      <h3>What to do</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{task.instructions}</p>

      <h3>Evidence to include</h3>
      <ul>
        {task.evidenceRequirements.map((requirement) => (
          <li key={requirement}>{requirement}</li>
        ))}
      </ul>

      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '0.65rem',
          padding: '0.75rem',
          marginBottom: '0.9rem',
        }}
      >
        <ShieldCheck size={20} aria-hidden="true" style={{ color: '#f59e0b', flexShrink: 0 }} />
        <div>
          <strong>Safety and privacy</strong>
          <p style={{ margin: '0.25rem 0 0' }}>{task.safetyNote}</p>
          <p style={{ margin: '0.35rem 0 0' }} className="mv-small">
            This is a neighbourhood contribution, not an official government application or decision.
            Never collect identity documents, contact details or exact home addresses.
          </p>
        </div>
      </div>

      <p className="mv-small mv-muted">
        Source: {task.source} · Published {formatDateTime(task.createdAt)} · Updated{' '}
        {formatDateTime(task.updatedAt)}
      </p>

      {approvedOutcomes.length > 0 && (
        <section aria-labelledby="mv-approved-outcomes-heading" style={{ marginTop: '1rem' }}>
          <h3 id="mv-approved-outcomes-heading">Approved public outcomes</h3>
          <ul>
            {approvedOutcomes.map((outcome) => (
              <li key={outcome.submissionPublicRef}>
                <CheckCircle2 size={14} aria-hidden="true" /> {outcome.publicOutcomeNote}{' '}
                <span className="mv-small mv-muted">({formatDateTime(outcome.approvedAt)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="mv-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </p>
      )}

      <div className="mv-inline-actions" style={{ marginTop: '1rem' }}>
        {!isSignedIn && (
          <p className="mv-help" style={{ margin: 0 }}>
            Sign in as a citizen contributor to claim this task.
          </p>
        )}
        {isSignedIn && canClaim && (
          <MicroVolunteerLoadingButton
            className="mv-button"
            loading={busy}
            onClick={onClaim}
            disabled={!accepting}
          >
            {accepting ? 'Claim this task' : 'No places available'}
          </MicroVolunteerLoadingButton>
        )}
      </div>
    </section>
  );
}
