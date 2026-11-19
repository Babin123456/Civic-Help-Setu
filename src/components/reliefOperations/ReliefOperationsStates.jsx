import {
  AlertTriangle,
  WifiOff,
  Clock,
  ShieldAlert,
  Inbox,
  RefreshCw,
  CheckCircle2,
  CircleSlash,
  Info,
  HelpCircle,
} from 'lucide-react';
import {
  PRIORITY_TIER_LABELS,
  CONFIDENCE_LABELS,
  NEED_STATUS_LABELS,
  ALLOCATION_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  INCIDENT_STATUS_LABELS,
  RESOURCE_STATUS_LABELS,
  PARTNER_STATUS_LABELS,
  RELIEF_ERROR_GUIDANCE,
} from '../../services/reliefOperationsConstants';

export function ReliefSkeleton({ count = 3 }) {
  return (
    <div className="relief-skeleton-grid" aria-label="Loading relief operations data" role="status">
      {Array.from({ length: count }).map((_, index) => (
        <div className="relief-skeleton-card" key={index}>
          <div className="relief-skeleton-line relief-skeleton-line--title" />
          <div className="relief-skeleton-line" />
          <div className="relief-skeleton-line relief-skeleton-line--short" />
        </div>
      ))}
      <span className="sr-only">Loading relief operations data…</span>
    </div>
  );
}

export function ReliefOfflineBanner() {
  return (
    <div className="relief-banner relief-banner--offline" role="status">
      <WifiOff size={18} aria-hidden="true" />
      <div>
        <strong>Offline mode:</strong> You are viewing the last saved relief data on this device. Changes
        are saved locally and will be available after a reload; do not assume other operators can see
        them until a connection is restored.
      </div>
    </div>
  );
}

export function ReliefStaleNotice({ lastRefreshed, onRefresh, staleReason }) {
  return (
    <div className="relief-banner relief-banner--stale" role="status">
      <Clock size={18} aria-hidden="true" />
      <div>
        <strong>Data freshness:</strong>{' '}
        {lastRefreshed
          ? `last verified ${new Date(lastRefreshed).toLocaleString()}`
          : 'no verification timestamp is available'}
        . {staleReason || 'Some figures may be older than the freshness limit.'}
      </div>
      {onRefresh && (
        <button type="button" className="relief-button relief-button--ghost" onClick={onRefresh}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      )}
    </div>
  );
}

export function ReliefEmptyState({
  title = 'Nothing to show yet',
  message = 'Reports will appear here once they are submitted.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="relief-empty" role="status">
      <Inbox size={28} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="relief-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ReliefErrorState({ error, onRetry, errorCode }) {
  const message = typeof error === 'string' ? error : error?.message || 'An unexpected error occurred.';
  const guidance = RELIEF_ERROR_GUIDANCE[errorCode || error?.code];
  return (
    <div className="relief-error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <div>
        <strong>We could not complete that action.</strong>
        <p>{guidance || message}</p>
        {guidance && <p className="relief-muted">Technical detail: {message}</p>}
      </div>
      {onRetry && (
        <button type="button" className="relief-button" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" /> Retry
        </button>
      )}
    </div>
  );
}

export function ReliefPermissionDenied({ requiredCapability = 'operator access' }) {
  return (
    <div className="relief-empty" role="alert">
      <ShieldAlert size={28} aria-hidden="true" />
      <h3>Access restricted</h3>
      <p>
        Your current role does not include <strong>{requiredCapability}</strong>. Switch to an
        authorised perspective or ask a relief administrator to review your access. Public aggregate
        information remains available in the Public status tab.
      </p>
    </div>
  );
}

export function ReliefPriorityBadge({ tier, score }) {
  return (
    <span className={`relief-badge relief-badge--priority-${tier}`}>
      <AlertTriangle size={12} aria-hidden="true" />
      {PRIORITY_TIER_LABELS[tier] || tier}
      {typeof score === 'number' ? ` (${score})` : ''}
    </span>
  );
}

export function ReliefConfidenceBadge({ confidence }) {
  const Icon = confidence === 'high' ? CheckCircle2 : confidence === 'medium' ? Info : HelpCircle;
  return (
    <span className={`relief-badge relief-badge--confidence-${confidence}`}>
      <Icon size={12} aria-hidden="true" />
      {CONFIDENCE_LABELS[confidence] || confidence}
    </span>
  );
}

export function ReliefStatusBadge({ status, type = 'need' }) {
  const labelsByType = {
    allocation: ALLOCATION_STATUS_LABELS,
    delivery: DELIVERY_STATUS_LABELS,
    incident: INCIDENT_STATUS_LABELS,
    resource: RESOURCE_STATUS_LABELS,
    partner: PARTNER_STATUS_LABELS,
    need: NEED_STATUS_LABELS,
  };
  const labels = labelsByType[type] || NEED_STATUS_LABELS;
  const Icon = ['fulfilled', 'confirmed', 'verified', 'available'].includes(status)
    ? CheckCircle2
    : ['rejected', 'duplicate', 'cancelled', 'failed', 'expired', 'revoked', 'suspended'].includes(status)
      ? CircleSlash
      : Info;
  return (
    <span className={`relief-badge relief-badge--status-${status}`}>
      <Icon size={12} aria-hidden="true" />
      {labels[status] || status}
    </span>
  );
}

export function ReliefMedicalNotice({ children }) {
  return (
    <p className="relief-medical-notice" role="note">
      <Info size={16} aria-hidden="true" /> {children}
    </p>
  );
}
