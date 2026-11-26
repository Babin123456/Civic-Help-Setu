import { AlertCircle, RefreshCw, WifiOff, Clock, ShieldAlert } from 'lucide-react';

export function ToiletSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading public sanitation facilities"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.25rem',
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '1rem',
            padding: '1.5rem',
            height: '240px',
            animation: 'pulse 1.5s infinite ease-in-out',
          }}
        >
          <div style={{ height: '20px', width: '60%', backgroundColor: 'var(--border-main)', borderRadius: '4px', marginBottom: '1rem' }} />
          <div style={{ height: '14px', width: '90%', backgroundColor: 'var(--border-main)', borderRadius: '4px', marginBottom: '0.5rem' }} />
          <div style={{ height: '14px', width: '40%', backgroundColor: 'var(--border-main)', borderRadius: '4px', marginBottom: '1.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ height: '24px', width: '70px', backgroundColor: 'var(--border-main)', borderRadius: '999px' }} />
            <div style={{ height: '24px', width: '90px', backgroundColor: 'var(--border-main)', borderRadius: '999px' }} />
          </div>
          <div style={{ height: '36px', width: '100%', backgroundColor: 'var(--border-main)', borderRadius: '0.5rem' }} />
        </div>
      ))}
    </div>
  );
}

export function ToiletEmptyState({ onReset }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        backgroundColor: 'var(--bg-surface)',
        border: '1px dashed var(--border-main)',
        borderRadius: '1rem',
        marginTop: '1.5rem',
      }}
    >
      <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        No Facilities Match Your Filters
      </h3>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.25rem auto', fontSize: '0.95rem' }}>
        No verified municipal toilets found matching the selected accessibility features, ward, or operating hours.
      </p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={15} /> Reset All Filters
        </button>
      )}
    </div>
  );
}

export function ToiletErrorState({ error, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        padding: '1.5rem',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <AlertCircle size={24} style={{ color: 'var(--danger-main, #ef4444)' }} />
        <div>
          <strong style={{ display: 'block', color: 'var(--danger-main, #ef4444)' }}>
            Unable to Load Sanitation Data
          </strong>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {error || 'A temporary data synchronization error occurred.'}
          </span>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-outline"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export function ToiletStaleDataNotice({ lastSynced }) {
  if (!lastSynced) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.825rem',
        color: 'var(--text-muted)',
        marginBottom: '1rem',
      }}
    >
      <Clock size={13} />
      <span>Last synchronized with municipal registry: {new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
}

export function ToiletOfflineNotice() {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '0.75rem',
        color: 'var(--warning-main, #ca8a04)',
        fontSize: '0.875rem',
        marginBottom: '1.25rem',
      }}
    >
      <WifiOff size={16} />
      <span>
        <strong>Offline Mode:</strong> Viewing cached sanitation facilities. Live supervisor submissions and reports will sync once reconnected.
      </span>
    </div>
  );
}

export function ToiletPermissionDeniedState({ message }) {
  return (
    <div
      role="alert"
      style={{
        padding: '1.25rem',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: 'var(--text-primary)',
        margin: '1rem 0',
      }}
    >
      <ShieldAlert size={22} style={{ color: 'var(--danger-main, #ef4444)' }} />
      <div>
        <strong style={{ display: 'block', color: 'var(--danger-main, #ef4444)' }}>
          Restricted Action (Operator Access Required)
        </strong>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {message || 'Your current role does not have authorization to modify municipal sanitation records or log supervisor cleans.'}
        </span>
      </div>
    </div>
  );
}

