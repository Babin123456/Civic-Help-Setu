import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardDrive,
  Inbox,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { CONTACT_FRESHNESS } from '../../services/offlineEmergencyCardConstants.js';
import { safeHttpUrl } from '../../utils/safeContent.js';

export function OfflineCardSkeleton({ count = 4 }) {
  return (
    <div
      role="status"
      aria-label="Loading the offline emergency card"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            minHeight: '140px',
          }}
        >
          <div style={{ height: '0.85rem', width: '40%', background: 'var(--border-main)', borderRadius: 4, marginBottom: '0.9rem' }} />
          <div style={{ height: '1.5rem', width: '70%', background: 'var(--border-light)', borderRadius: 4, marginBottom: '0.65rem' }} />
          <div style={{ height: '0.8rem', width: '90%', background: 'var(--border-light)', borderRadius: 4, marginBottom: '0.45rem' }} />
          <div style={{ height: '0.8rem', width: '60%', background: 'var(--border-light)', borderRadius: 4 }} />
        </div>
      ))}
      <span className="sr-only">Loading the verified local contacts saved for this card.</span>
    </div>
  );
}

export function OfflineCardOfflineBanner({ lastRefreshedAt, onRefresh, canRefresh = true }) {
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
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem' }}>
        <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Offline mode.</strong> You are seeing the card saved on this device
          {lastRefreshedAt ? ` (last refreshed ${new Date(lastRefreshedAt).toLocaleString()})` : ''}.
          Search and open still work. A refresh uses the last approved copy on this device; new
          approvals appear after the connection returns.
        </div>
      </div>
      {canRefresh && onRefresh && (
        <button type="button" className="btn btn-secondary" onClick={onRefresh} style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh offline copy
        </button>
      )}
    </div>
  );
}

export function OfflineCardStaleNotice({ contactName, lastVerifiedAt, source, onRefresh }) {
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
        background: 'rgba(220, 38, 38, 0.08)',
        border: '1px solid rgba(220, 38, 38, 0.3)',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <Clock size={17} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Outdated contact.</strong>{' '}
          {contactName ? `"${contactName}"` : 'One contact on this card'} has not been verified
          for more than a year
          {lastVerifiedAt ? ` (last verified ${new Date(lastVerifiedAt).toLocaleDateString()})` : ''}.
          It stays visible with this warning so an emergency number never disappears silently.
          {source?.title ? (
            <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Source to re-check: {source.title}
            </span>
          ) : null}
        </div>
      </div>
      {onRefresh && (
        <button type="button" className="btn btn-secondary" onClick={onRefresh} style={{ fontSize: '0.8rem' }}>
          <RefreshCw size={14} aria-hidden="true" /> Check for updates
        </button>
      )}
    </div>
  );
}

export function OfflineCardLowStorageBanner({ storage }) {
  if (!storage || (storage.persisted !== false && storage.level !== 'near_limit' && storage.level !== 'memory_only')) {
    return null;
  }
  const memoryOnly = storage.persisted === false || storage.level === 'memory_only';
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.8rem 1rem',
        background: 'rgba(217, 119, 6, 0.1)',
        border: '1px solid rgba(217, 119, 6, 0.35)',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.85rem',
      }}
    >
      <HardDrive size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>{memoryOnly ? 'Low device storage.' : 'Device storage is almost full.'}</strong>{' '}
        {memoryOnly
          ? 'This browser could not save the card. It stays available for this visit only. Free some space or allow local storage, then install again.'
          : 'Delete an older card or free device storage before installing more contacts. The card you have now still opens.'}
      </div>
    </div>
  );
}

export function OfflineCardEmptyState({ title = 'No contacts to show', message, actionLabel, onAction }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '2.5rem 1.5rem',
        background: 'var(--bg-surface)',
        border: '1px dashed var(--border-main)',
        borderRadius: '0.75rem',
      }}
    >
      <Inbox size={30} aria-hidden="true" style={{ color: 'var(--text-secondary)', marginBottom: '0.6rem' }} />
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{title}</h3>
      <p style={{ margin: '0 auto 1.25rem', maxWidth: '540px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {message ||
          'No verified contact matches this filter yet. Try another category, clear the search, or ask a municipal operator to add the contact from an official source.'}
      </p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function OfflineCardErrorState({ message, code, onRetry }) {
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
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem' }}>The card could not be loaded</h3>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {message || 'Something went wrong while reading the saved card. Your previous data was kept.'}
          </p>
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

export function OfflineCardPermissionDenied({ message, role }) {
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

const TONES = {
  neutral: { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'var(--border-main)' },
  success: { background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', border: 'rgba(22, 163, 74, 0.35)' },
  warning: { background: 'rgba(217, 119, 6, 0.12)', color: '#b45309', border: 'rgba(217, 119, 6, 0.35)' },
  danger: { background: 'rgba(220, 38, 38, 0.1)', color: '#b91c1c', border: 'rgba(220, 38, 38, 0.3)' },
  info: { background: 'rgba(37, 99, 235, 0.1)', color: '#1d4ed8', border: 'rgba(37, 99, 235, 0.3)' },
};

export function OfflineCardStatusBadge({ label, tone = 'neutral', icon: Icon = null }) {
  const palette = TONES[tone] || TONES.neutral;
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

export function OfflineCardFreshnessBadge({ freshness }) {
  if (!freshness) return null;
  if (freshness.state === CONTACT_FRESHNESS.FRESH) {
    return <OfflineCardStatusBadge label="Recently verified" tone="success" icon={ShieldCheck} />;
  }
  if (freshness.state === CONTACT_FRESHNESS.REVIEW_DUE) {
    return <OfflineCardStatusBadge label="Review due soon" tone="warning" icon={Clock} />;
  }
  if (freshness.state === CONTACT_FRESHNESS.STALE) {
    return <OfflineCardStatusBadge label="Outdated — verify before relying on it" tone="danger" icon={AlertTriangle} />;
  }
  return <OfflineCardStatusBadge label="Not verified" tone="warning" icon={Clock} />;
}

export function OfflineCardVerifiedLine({ contact }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.9rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <CheckCircle2 size={13} aria-hidden="true" />
        Last verified:{' '}
        {contact?.lastVerifiedAt
          ? new Date(contact.lastVerifiedAt).toLocaleDateString()
          : 'not recorded'}
      </span>
      {contact?.source?.title ? (
        <span>
          Source:{' '}
          {contact.source.url && safeHttpUrl(contact.source.url) ? (
            <a href={safeHttpUrl(contact.source.url)} target="_blank" rel="noreferrer noopener">
              {contact.source.publisher || contact.source.title}
            </a>
          ) : (
            contact.source.publisher || contact.source.title
          )}
        </span>
      ) : (
        <span>Source: not recorded</span>
      )}
      {contact?.versionLabel ? <span>Version {contact.versionLabel}</span> : null}
    </div>
  );
}

export function OfflineCardSummary({ summary, label = 'Card coverage' }) {
  if (!summary) return null;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.6rem',
        marginBottom: '1rem',
      }}
      aria-label={label}
    >
      {[
        { label: 'Contacts', value: summary.totalContacts },
        { label: 'Recently verified', value: summary.freshContacts },
        { label: 'Review due', value: summary.reviewDueContacts },
        { label: 'Outdated', value: summary.staleContacts },
        { label: 'Categories covered', value: summary.categoriesCovered },
      ].map((item) => (
        <div
          key={item.label}
          style={{
            padding: '0.65rem 0.75rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.6rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{item.label}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{item.value ?? 0}</div>
        </div>
      ))}
    </div>
  );
}
