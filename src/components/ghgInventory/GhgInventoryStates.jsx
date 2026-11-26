import {
  AlertTriangle,
  WifiOff,
  Clock,
  ShieldAlert,
  Inbox,
  RefreshCw,
} from 'lucide-react';

export function GhgInventorySkeleton({ count = 4 }) {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}
      role="status"
      aria-label="Loading greenhouse-gas inventory"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            minHeight: '120px',
          }}
        >
          <div style={{ height: '0.9rem', width: '45%', background: 'var(--border-main)', borderRadius: 4, marginBottom: '0.9rem' }} />
          <div style={{ height: '1.6rem', width: '65%', background: 'var(--border-light)', borderRadius: 4, marginBottom: '0.6rem' }} />
          <div style={{ height: '0.8rem', width: '80%', background: 'var(--border-light)', borderRadius: 4 }} />
        </div>
      ))}
      <span className="sr-only">Loading the latest inventory data.</span>
    </div>
  );
}

export function GhgOfflineBanner({ cachedAt }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.65rem',
        padding: '0.75rem 1rem',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        color: 'var(--text-primary)',
        fontSize: '0.875rem',
      }}
    >
      <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>Offline mode.</strong> You are seeing the last inventory saved on this device
        {cachedAt ? ` (${new Date(cachedAt).toLocaleString()})` : ''}. New submissions and
        calculations stay local until the connection returns; they are never presented as
        published data.
      </div>
    </div>
  );
}

export function GhgStaleNotice({ lastCalculatedAt, reason, onRecalculate, canRecalculate }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: '0.75rem 1rem',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <Clock size={17} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Stale calculation.</strong> {reason || 'Approved data changed after the last calculation.'}
          <span style={{ display: 'block', color: 'var(--text-secondary)' }}>
            {lastCalculatedAt
              ? `Last calculation: ${new Date(lastCalculatedAt).toLocaleString()}`
              : 'This period has not been calculated yet.'}
          </span>
        </div>
      </div>
      {canRecalculate && onRecalculate && (
        <button type="button" className="btn btn-secondary" onClick={onRecalculate} style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} aria-hidden="true" /> Run calculation
        </button>
      )}
    </div>
  );
}

export function GhgEmptyState({ title = 'No records yet', message, actionLabel, onAction }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '2.75rem 1.5rem',
        background: 'var(--bg-surface)',
        border: '1px dashed var(--border-main)',
        borderRadius: '0.75rem',
      }}
    >
      <Inbox size={30} aria-hidden="true" style={{ color: 'var(--text-secondary)', marginBottom: '0.6rem' }} />
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{title}</h3>
      <p style={{ margin: '0 auto 1.25rem', maxWidth: '520px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {message || 'There is nothing to show for this filter. Adjust the period or filters and try again.'}
      </p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function GhgErrorState({ message, code, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        padding: '1.25rem',
        background: 'var(--bg-surface)',
        border: '1px solid rgba(220, 38, 38, 0.35)',
        borderRadius: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        <AlertTriangle size={20} aria-hidden="true" style={{ color: '#dc2626', flexShrink: 0 }} />
        <div>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>The inventory could not be loaded</h3>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{message}</p>
          {code && (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Error code: <code>{code}</code>
            </p>
          )}
          {onRetry && (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              <RefreshCw size={14} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GhgPermissionDenied({ message, role }) {
  return (
    <div
      role="alert"
      style={{
        padding: '1.25rem',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        <ShieldAlert size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
        <div>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>Your role cannot open this section</h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {message ||
              `The "${role || 'current'}" role does not have this permission. Switch to an authorised role or ask a municipal administrator.`}
          </p>
        </div>
      </div>
    </div>
  );
}

export function GhgStatusBadge({ label, tone = 'neutral', icon: Icon = null }) {
  const tones = {
    neutral: { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'var(--border-main)' },
    success: { background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', border: 'rgba(22, 163, 74, 0.35)' },
    warning: { background: 'rgba(217, 119, 6, 0.12)', color: '#b45309', border: 'rgba(217, 119, 6, 0.35)' },
    danger: { background: 'rgba(220, 38, 38, 0.1)', color: '#b91c1c', border: 'rgba(220, 38, 38, 0.3)' },
    info: { background: 'rgba(37, 99, 235, 0.1)', color: '#1d4ed8', border: 'rgba(37, 99, 235, 0.3)' },
  };
  const palette = tones[tone] || tones.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '999px',
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        fontSize: '0.72rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {label}
    </span>
  );
}

export function GhgSummaryTable({ rows, caption }) {
  if (!rows?.length) return null;
  return (
    <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <caption style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.4rem' }}>
          {caption}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Category</th>
            <th scope="col" style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Total tCO2e</th>
            <th scope="col" style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Measured</th>
            <th scope="col" style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Estimated</th>
            <th scope="col" style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-main)' }}>Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.categoryLabel || row.label || row.category}>
              <th scope="row" style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>
                {row.categoryLabel || row.label || row.category}
              </th>
              <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{Number(row.tCO2e ?? 0).toFixed(3)}</td>
              <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{Number(row.measuredTCO2e ?? 0).toFixed(3)}</td>
              <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{Number(row.estimatedTCO2e ?? 0).toFixed(3)}</td>
              <td style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>{row.sharePercent != null ? `${row.sharePercent}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
