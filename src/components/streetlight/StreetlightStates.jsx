import {
  AlertTriangle,
  WifiOff,
  Clock,
  ShieldAlert,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import {
  PRIORITY_TIER_LABELS,
  CLUSTER_STATUS_LABELS,
  WORK_ORDER_STATUS_LABELS,
} from '../../services/streetlightConstants';

export function StreetlightSkeleton({ count = 3 }) {
  return (
    <div className="streetlight-skeleton-grid" style={{ display: 'grid', gap: '1rem', width: '100%' }} aria-label="Loading streetlight data">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            animation: 'pulse 1.5s infinite',
          }}
        >
          <div style={{ height: '1.25rem', width: '40%', background: 'var(--border-main)', borderRadius: '4px', marginBottom: '0.75rem' }} />
          <div style={{ height: '0.9rem', width: '70%', background: 'var(--border-light)', borderRadius: '4px', marginBottom: '0.5rem' }} />
          <div style={{ height: '0.9rem', width: '50%', background: 'var(--border-light)', borderRadius: '4px' }} />
        </div>
      ))}
    </div>
  );
}

export function StreetlightOfflineBanner() {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        color: '#f59e0b',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.875rem',
      }}
    >
      <WifiOff size={18} aria-hidden="true" />
      <div>
        <strong>Offline Mode:</strong> Viewing cached streetlight outage data. New reports and repairs will be queued and synchronized once connection is restored.
      </div>
    </div>
  );
}

export function StreetlightStaleNotice({ lastRefreshed, onRefresh }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: '0.6rem 0.9rem',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        color: 'var(--text-secondary)',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.825rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Clock size={16} aria-hidden="true" />
        <span>
          Data last verified at: <strong style={{ color: 'var(--text-primary)' }}>{lastRefreshed ? new Date(lastRefreshed).toLocaleTimeString() : 'Recently'}</strong>
        </span>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.65rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '0.375rem',
            border: '1px solid var(--border-main)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} aria-hidden="true" />
          Refresh
        </button>
      )}
    </div>
  );
}

export function StreetlightEmptyState({ title = 'No outage clusters found', message = 'Try adjusting your search criteria or jurisdiction filter.', onReset }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        background: 'var(--bg-surface)',
        borderRadius: '0.75rem',
        border: '1px dashed var(--border-main)',
      }}
    >
      <Inbox size={40} style={{ color: 'var(--text-tertiary)', marginBottom: '0.75rem' }} aria-hidden="true" />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 1rem' }}>{message}</p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            borderRadius: '0.375rem',
            border: '1px solid var(--border-main)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}

export function StreetlightErrorState({ error, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        padding: '1.5rem',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '0.75rem',
        color: '#991b1b',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        <AlertTriangle size={20} aria-hidden="true" />
        <span>Streetlight Maintenance Error</span>
      </div>
      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
        {error?.message || (typeof error === 'string' ? error : 'An unexpected error occurred while loading streetlight data.')}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-primary btn-sm" style={{ background: '#b91c1c', borderColor: '#b91c1c' }}>
          Retry Request
        </button>
      )}
    </div>
  );
}

export function StreetlightPermissionDenied({ requiredCapability }) {
  return (
    <div
      role="alert"
      style={{
        padding: '2rem 1.5rem',
        textAlign: 'center',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        color: 'var(--text-secondary)',
      }}
    >
      <ShieldAlert size={36} style={{ color: '#ef4444', marginBottom: '0.75rem' }} aria-hidden="true" />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Access Restricted</h3>
      <p style={{ fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto' }}>
        You do not have the required permissions ({requiredCapability || 'Operator / Staff'}) to modify streetlight clusters or dispatch work orders.
      </p>
    </div>
  );
}

export function StreetlightStatusBadge({ status, type = 'cluster' }) {
  const label =
    type === 'workOrder'
      ? WORK_ORDER_STATUS_LABELS[status] || status
      : CLUSTER_STATUS_LABELS[status] || status;

  let bg = '#f1f5f9';
  let color = '#475569';
  let border = '#cbd5e1';

  if (status === 'resolved' || status === 'closed') {
    bg = '#ecfdf5';
    color = '#065f46';
    border = '#a7f3d0';
  } else if (status === 'in_progress' || status === 'on_site') {
    bg = '#eff6ff';
    color = '#1e40af';
    border = '#bfdbfe';
  } else if (status === 'work_order_created' || status === 'dispatched' || status === 'triaged') {
    bg = '#fef3c7';
    color = '#92400e';
    border = '#fde68a';
  } else if (status === 'open' || status === 'parts_pending') {
    bg = '#fff1f2';
    color = '#9f1239';
    border = '#fecdd3';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.55rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        borderRadius: '9999px',
        background: bg,
        color,
        border: `1px solid ${border}`,
        textTransform: 'capitalize',
      }}
    >
      {label}
    </span>
  );
}

export function StreetlightPriorityBadge({ tier, score }) {
  let bg = '#f1f5f9';
  let color = '#334155';
  let border = '#cbd5e1';

  if (tier === 'critical') {
    bg = '#fef2f2';
    color = '#991b1b';
    border = '#fca5a5';
  } else if (tier === 'high') {
    bg = '#fff7ed';
    color = '#9a3412';
    border = '#fdba74';
  } else if (tier === 'medium') {
    bg = '#fefce8';
    color = '#854d0e';
    border = '#fde047';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.55rem',
        fontSize: '0.75rem',
        fontWeight: 700,
        borderRadius: '9999px',
        background: bg,
        color,
        border: `1px solid ${border}`,
      }}
      title={`Priority Tier: ${tier.toUpperCase()} (${score || 0}/100)`}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: color,
        }}
        aria-hidden="true"
      />
      {PRIORITY_TIER_LABELS[tier] || tier.toUpperCase()}
      {score !== undefined && <span style={{ opacity: 0.85 }}>({score})</span>}
    </span>
  );
}
