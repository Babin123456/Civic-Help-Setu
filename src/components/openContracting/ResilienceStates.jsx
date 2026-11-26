import { AlertCircle, RefreshCw, WifiOff, ShieldX, Search } from 'lucide-react';

export function ProcurementLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading procurement analytics"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
      }}
    >
      <div style={{ height: '40px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', animation: 'pulse 1.5s infinite' }} />
      <div style={{ height: '120px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', animation: 'pulse 1.5s infinite' }} />
      <div style={{ height: '120px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', animation: 'pulse 1.5s infinite' }} />
    </div>
  );
}

export function ProcurementEmptyState({ message = 'No red flags or procurement notices match your search criteria.', onReset }) {
  return (
    <div
      role="status"
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '0.75rem',
        border: '1px dashed var(--border-light, rgba(255, 255, 255, 0.15))',
      }}
    >
      <Search size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} aria-hidden="true" />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
        No Records Found
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
        {message}
      </p>
      {onReset && (
        <button type="button" onClick={onReset} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          Clear Active Filters
        </button>
      )}
    </div>
  );
}

export function ProcurementStaleDataNotice({ onRefresh, lastUpdated }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        color: '#fbbf24',
        fontSize: '0.85rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertCircle size={16} aria-hidden="true" />
        <span>
          Dataset may be stale {lastUpdated ? `(last computed: ${new Date(lastUpdated).toLocaleTimeString()})` : ''}. Refresh to execute the latest analytics ruleset.
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="btn btn-secondary"
        style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <RefreshCw size={12} aria-hidden="true" />
        Rerun Analytics
      </button>
    </div>
  );
}

export function ProcurementOfflineNotice({ queuedCount = 0 }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        background: 'rgba(100, 116, 139, 0.2)',
        border: '1px solid rgba(100, 116, 139, 0.4)',
        color: '#cbd5e1',
        fontSize: '0.85rem',
        marginBottom: '1rem',
      }}
    >
      <WifiOff size={16} aria-hidden="true" />
      <span>
        Operating in offline mode. Any recorded audit reviews will be stored in your browser queue ({queuedCount} pending) and synchronized automatically upon reconnection.
      </span>
    </div>
  );
}

export function ProcurementPermissionDenied({ role = 'citizen', requiredRole = 'auditor' }) {
  return (
    <div
      role="alert"
      style={{
        padding: '1.5rem',
        textAlign: 'center',
        borderRadius: '0.75rem',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#f87171',
      }}
    >
      <ShieldX size={36} style={{ marginBottom: '0.5rem' }} aria-hidden="true" />
      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
        Permission Denied
      </h3>
      <p style={{ fontSize: '0.85rem', margin: 0, color: '#fca5a5' }}>
        Your active persona ({role}) has read-only access. Recording audit decisions or clearing red flags requires an authenticated {requiredRole} role. Switch your persona in the filter bar above to test oversight capabilities.
      </p>
    </div>
  );
}

export function ProcurementErrorState({ error, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        padding: '1.5rem',
        textAlign: 'center',
        borderRadius: '0.75rem',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#f87171',
      }}
    >
      <AlertCircle size={36} style={{ marginBottom: '0.5rem' }} aria-hidden="true" />
      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
        Unable to Load Procurement Analytics
      </h3>
      <p style={{ fontSize: '0.85rem', margin: '0 0 1rem 0', color: '#fca5a5' }}>
        {error?.message || 'A recoverable data or calculation error occurred.'}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          Retry Analytics Engine
        </button>
      )}
    </div>
  );
}
