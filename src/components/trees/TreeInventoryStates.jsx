import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Inbox,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';

const panelStyle = {
  padding: '1.1rem 1.25rem',
  border: '1px solid var(--border-main)',
  borderRadius: '0.85rem',
  background: 'var(--surface-raised, var(--glass-bg))',
};

export const TreeInventorySkeleton = ({ label = 'Loading the municipal tree register…' }) => (
  <div role="status" aria-live="polite" style={{ ...panelStyle, display: 'grid', gap: '0.75rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-secondary)' }}>
      <Loader2 size={20} className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
    {[1, 2, 3].map((item) => (
      <div
        key={item}
        aria-hidden="true"
        style={{ height: '2.6rem', borderRadius: '0.55rem', background: 'var(--glass-bg)', opacity: 0.7 }}
      />
    ))}
  </div>
);

export const TreeInventoryEmptyState = ({ title = 'No trees match these filters', message, onReset }) => (
  <div role="status" style={{ ...panelStyle, textAlign: 'center', display: 'grid', gap: '0.6rem', justifyItems: 'center' }}>
    <Inbox size={30} aria-hidden="true" style={{ color: 'var(--text-tertiary)' }} />
    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{title}</h3>
    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '48ch' }}>
      {message || 'Try a wider ward, species or condition filter. The public register only shows approved fields.'}
    </p>
    {onReset && (
      <button type="button" className="btn btn-secondary" onClick={onReset}>
        Reset filters
      </button>
    )}
  </div>
);

export const TreeInventoryErrorState = ({ error, onRetry, title = 'The tree register could not be loaded' }) => (
  <div
    role="alert"
    style={{ ...panelStyle, borderColor: 'rgba(239, 68, 68, 0.35)', display: 'grid', gap: '0.65rem' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--error, #ef4444)', fontWeight: 700 }}>
      <AlertTriangle size={20} aria-hidden="true" />
      <h3 style={{ margin: 0, fontSize: '1.02rem' }}>{title}</h3>
    </div>
    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
      {error?.userMessage || error?.message || 'A recoverable error occurred. Your existing records were not changed.'}
    </p>
    {error?.code && (
      <p style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
        Error code: {error.code}
      </p>
    )}
    {onRetry && (
      <button type="button" className="btn btn-secondary" onClick={onRetry} style={{ justifySelf: 'start' }}>
        <RefreshCw size={15} aria-hidden="true" /> Retry
      </button>
    )}
  </div>
);

export const TreePermissionDenied = ({
  title = 'Staff workspace requires a municipal tree role',
  message = 'Sign in with an operator, arborist, reviewer or administrator account. Citizen accounts can still browse the public register and submit an observation.',
  signInHref = '/login',
}) => (
  <div role="alert" style={{ ...panelStyle, borderColor: 'rgba(245, 158, 11, 0.35)', display: 'grid', gap: '0.7rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--warning, #f59e0b)', fontWeight: 700 }}>
      <Lock size={20} aria-hidden="true" />
      <h3 style={{ margin: 0, fontSize: '1.02rem' }}>{title}</h3>
    </div>
    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{message}</p>
    <a className="btn btn-secondary" href={signInHref} style={{ justifySelf: 'start' }}>
      <ShieldAlert size={15} aria-hidden="true" /> Sign in
    </a>
  </div>
);

export const TreeOfflineNotice = () => (
  <div
    role="status"
    style={{
      ...panelStyle,
      borderColor: 'rgba(245, 158, 11, 0.35)',
      display: 'flex',
      gap: '0.6rem',
      alignItems: 'flex-start',
      marginBottom: '1rem',
    }}
  >
    <WifiOff size={19} aria-hidden="true" style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
      <strong>Offline mode.</strong> You can still browse the last saved register and record an inspection or observation on
      this device. Changes are stored locally and should be reviewed before sharing; nothing is silently sent to a third party.
    </p>
  </div>
);

export const TreeStaleDataNotice = ({ freshness }) => {
  if (!freshness?.isStale) return null;
  return (
    <div
      role="status"
      style={{
        ...panelStyle,
        borderColor: 'rgba(245, 158, 11, 0.35)',
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'flex-start',
        marginBottom: '1rem',
      }}
    >
      <CloudOff size={19} aria-hidden="true" style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0, marginTop: 2 }} />
      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
        <strong>Data may be stale.</strong> The register was last updated{' '}
        {freshness?.lastUpdatedAt ? new Date(freshness.lastUpdatedAt).toLocaleString('en-IN') : 'at an unknown time'}.
        Reconfirm inspection due dates before planning work.
      </p>
    </div>
  );
};

const TONE_STYLES = {
  healthy: { bg: 'rgba(16, 185, 129, 0.14)', color: '#047857', label: 'Healthy' },
  fair: { bg: 'rgba(245, 158, 11, 0.16)', color: '#b45309', label: 'Fair' },
  poor: { bg: 'rgba(249, 115, 22, 0.16)', color: '#c2410c', label: 'Poor' },
  critical: { bg: 'rgba(239, 68, 68, 0.16)', color: '#b91c1c', label: 'Critical' },
  dead: { bg: 'rgba(120, 113, 108, 0.2)', color: '#44403c', label: 'Dead' },
  unknown: { bg: 'rgba(148, 163, 184, 0.18)', color: '#475569', label: 'Not assessed' },
  overdue: { bg: 'rgba(239, 68, 68, 0.14)', color: '#b91c1c', label: 'Overdue' },
  due_soon: { bg: 'rgba(245, 158, 11, 0.16)', color: '#92400e', label: 'Due soon' },
  scheduled: { bg: 'rgba(56, 189, 248, 0.14)', color: '#0369a1', label: 'Scheduled' },
  unscheduled: { bg: 'rgba(148, 163, 184, 0.18)', color: '#475569', label: 'Unscheduled' },
  success: { bg: 'rgba(16, 185, 129, 0.14)', color: '#047857', label: 'Verified' },
  neutral: { bg: 'rgba(148, 163, 184, 0.18)', color: '#334155', label: 'Status' },
};

/**
 * Status pills always include a text label and an icon-free prefix (for example
 * "Status: Overdue"), so colour is never the only signal.
 */
export const TreeStatusBadge = ({ tone = 'neutral', label, prefix = 'Status' }) => {
  const style = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.18rem 0.55rem',
        borderRadius: '999px',
        background: style.bg,
        color: style.color,
        fontSize: '0.78rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <CheckCircle2 size={12} aria-hidden="true" />
      <span>
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{prefix}: </span>
        {label || style.label}
      </span>
    </span>
  );
};

export const TreeInlineAlert = ({ tone = 'warning', title, children }) => {
  const colour = tone === 'error' ? 'var(--error, #ef4444)' : tone === 'success' ? 'var(--success, #10b981)' : 'var(--warning, #f59e0b)';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} style={{ ...panelStyle, borderColor: colour, display: 'grid', gap: '0.45rem' }}>
      {title && (
        <strong style={{ color: colour, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {tone === 'error' ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          {title}
        </strong>
      )}
      <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  );
};
