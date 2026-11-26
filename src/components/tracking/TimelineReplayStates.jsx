import {
  AlertTriangle,
  Clock3,
  Inbox,
  Lock,
  RefreshCw,
} from 'lucide-react';

const STATE_CONTENT = {
  loading: {
    icon: Clock3,
    title: 'Loading recorded events',
    message: 'Reading the append-only application timeline from this device.',
    role: 'status',
  },
  empty: {
    icon: Inbox,
    title: 'No recorded events yet',
    message:
      'No submission, acknowledgement, review, query, or outcome events have been recorded for this application.',
    role: 'status',
  },
  error: {
    icon: AlertTriangle,
    title: 'Timeline could not be loaded',
    message: 'The recorded events are unavailable. Nothing has been changed.',
    role: 'alert',
  },
  stale: {
    icon: Clock3,
    title: 'Timeline may be stale',
    message:
      'This view uses the last successfully loaded event records. Reload before relying on a status comparison.',
    role: 'status',
  },
  permission_denied: {
    icon: Lock,
    title: 'You do not have access to this timeline',
    message:
      'Sign in with the account that owns this application, or ask an authorised reviewer for access.',
    role: 'alert',
  },
};

export default function TimelineReplayState({
  state = 'empty',
  message,
  onRetry = null,
  actionLabel = 'Retry',
}) {
  const content = STATE_CONTENT[state] || STATE_CONTENT.empty;
  const Icon = content.icon;

  return (
    <div
      className="timeline-replay-state"
      role={content.role}
      aria-live={content.role === 'status' ? 'polite' : undefined}
    >
      <Icon size={24} aria-hidden="true" />
      <div>
        <h3>{content.title}</h3>
        <p>{message || content.message}</p>
        {onRetry && state !== 'permission_denied' ? (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            <RefreshCw size={15} aria-hidden="true" /> {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
