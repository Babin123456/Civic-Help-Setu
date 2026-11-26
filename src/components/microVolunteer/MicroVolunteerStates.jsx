import {
  AlertTriangle,
  WifiOff,
  Clock,
  ShieldAlert,
  Inbox,
  RefreshCw,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react';

const panelStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-main)',
  borderRadius: '0.85rem',
  padding: '1.25rem',
};

export function MicroVolunteerSkeleton({ count = 4 }) {
  return (
    <div
      className="mv-skeleton-grid"
      role="status"
      aria-live="polite"
      aria-label="Loading micro-volunteer tasks"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} style={{ ...panelStyle, minHeight: '150px' }} aria-hidden="true">
          <div className="mv-skeleton-line" style={{ width: '40%' }} />
          <div className="mv-skeleton-line" style={{ width: '80%', height: '1.4rem' }} />
          <div className="mv-skeleton-line" style={{ width: '65%' }} />
          <div className="mv-skeleton-line" style={{ width: '50%' }} />
        </div>
      ))}
      <span className="sr-only">Loading the latest tasks from this device.</span>
    </div>
  );
}

export function MicroVolunteerEmptyState({ title, description, action = null }) {
  return (
    <section style={{ ...panelStyle, textAlign: 'center' }} aria-live="polite">
      <Inbox size={32} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
      <h2 style={{ margin: '0.75rem 0 0.35rem', fontSize: '1.1rem' }}>{title}</h2>
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{description}</p>
      {action}
    </section>
  );
}

export function MicroVolunteerErrorState({ title = 'The board could not be loaded', message, onRetry }) {
  return (
    <section role="alert" style={{ ...panelStyle, borderColor: 'rgba(239, 68, 68, 0.45)' }}>
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
        <AlertTriangle size={22} aria-hidden="true" style={{ color: '#ef4444', flexShrink: 0 }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h2>
          <p style={{ margin: '0.4rem 0 0.8rem', color: 'var(--text-secondary)' }}>{message}</p>
          {onRetry && (
            <button type="button" className="mv-button mv-button-secondary" onClick={onRetry}>
              <RefreshCw size={16} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function MicroVolunteerPermissionDenied({ action = 'view this section' }) {
  return (
    <section role="status" style={{ ...panelStyle }}>
      <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
        <ShieldAlert size={22} aria-hidden="true" style={{ color: '#f59e0b', flexShrink: 0 }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>You do not have access to {action}</h2>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)' }}>
            Ask a board administrator to assign the right role or ward. Nothing was changed.
          </p>
        </div>
      </div>
    </section>
  );
}

export function MicroVolunteerOfflineBanner({ lastSavedAt }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'center',
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '0.75rem',
        padding: '0.75rem 0.9rem',
        marginBottom: '1rem',
      }}
    >
      <WifiOff size={18} aria-hidden="true" style={{ color: '#f59e0b' }} />
      <span>
        You are offline. The board is showing the copy saved on this device
        {lastSavedAt ? ` at ${new Date(lastSavedAt).toLocaleString()}` : ''}. New claims cannot be
        submitted until the connection returns.
      </span>
    </div>
  );
}

export function MicroVolunteerStaleNotice({ lastSavedAt, onRefresh }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        background: 'rgba(56, 189, 248, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: '0.75rem',
        padding: '0.7rem 0.9rem',
        marginBottom: '1rem',
      }}
    >
      <Clock size={18} aria-hidden="true" style={{ color: 'var(--accent-main)' }} />
      <span>
        Saved on this device{lastSavedAt ? ` at ${new Date(lastSavedAt).toLocaleString()}` : ''}. Check
        the latest status before acting.
      </span>
      {onRefresh && (
        <button type="button" className="mv-button mv-button-secondary" onClick={onRefresh}>
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      )}
    </div>
  );
}

export function MicroVolunteerLoadingButton({ loading, children, ...props }) {
  return (
    <button type="button" {...props} disabled={loading || props.disabled} aria-busy={loading}>
      {loading ? <Loader2 size={16} aria-hidden="true" className="mv-spin" /> : null}
      {children}
    </button>
  );
}

const TONE_STYLES = {
  success: { color: '#10b981', icon: CheckCircle2 },
  warning: { color: '#f59e0b', icon: Clock },
  danger: { color: '#ef4444', icon: AlertTriangle },
  neutral: { color: 'var(--text-secondary)', icon: Circle },
  accent: { color: 'var(--accent-main)', icon: Circle },
};

/**
 * Status is never conveyed by colour alone: every badge includes an icon and the
 * status text, so it survives greyscale, high-contrast mode and screen readers.
 */
export function MicroVolunteerStatusBadge({ status, label, tone = 'neutral' }) {
  const style = TONE_STYLES[tone] || TONE_STYLES.neutral;
  const Icon = style.icon;
  return (
    <span
      className="mv-badge"
      style={{ color: style.color, borderColor: 'currentColor' }}
      title={label || status}
    >
      <Icon size={13} aria-hidden="true" />
      <span>{label || status}</span>
    </span>
  );
}
