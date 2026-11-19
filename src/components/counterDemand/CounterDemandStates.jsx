import { AlertCircle, RefreshCw, WifiOff, ShieldAlert, Clock, Inbox } from 'lucide-react';

export const CounterDemandSkeleton = () => (
  <div className="counter-demand-skeleton animate-pulse" aria-label="Loading forecast data" role="status">
    <div style={{ height: '48px', background: 'var(--border)', borderRadius: '8px', marginBottom: '1.5rem' }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: '90px', background: 'var(--border)', borderRadius: '8px' }} />
      ))}
    </div>
    <div style={{ height: '320px', background: 'var(--border)', borderRadius: '12px', marginBottom: '1.5rem' }} />
    <span className="sr-only">Loading counter demand forecast...</span>
  </div>
);

export const CounterDemandEmptyState = ({ onReset, message }) => (
  <div
    className="card"
    style={{
      padding: '3rem 1.5rem',
      textAlign: 'center',
      border: '1px dashed var(--border)',
      background: 'var(--bg-card)',
      borderRadius: '12px',
      margin: '1.5rem 0',
    }}
  >
    <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'var(--bg-secondary)', marginBottom: '1rem' }}>
      <Inbox size={32} color="var(--text-secondary)" />
    </div>
    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>No Historical Footfall Aggregates</h3>
    <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
      {message || 'No historical appointment or counter aggregates found for this selection. Try selecting South Delhi or Dadar West.'}
    </p>
    {onReset && (
      <button type="button" className="btn btn-primary" onClick={onReset}>
        Reset to Reference Office
      </button>
    )}
  </div>
);

export const CounterDemandStaleNotice = ({ lastUpdated }) => (
  <div
    className="notice-banner"
    style={{
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
      borderRadius: '8px',
      background: 'var(--warning-bg, #fef3c7)',
      border: '1px solid var(--warning-border, #f59e0b)',
      color: 'var(--warning-text, #92400e)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      fontSize: '0.875rem',
    }}
    role="status"
  >
    <Clock size={18} />
    <div>
      <strong>Notice:</strong> Showing cached baseline data. Last verified aggregate sync was at{' '}
      {lastUpdated ? new Date(lastUpdated).toLocaleDateString() : 'earlier this week'}.
    </div>
  </div>
);

export const CounterDemandOfflineNotice = () => (
  <div
    className="notice-banner"
    style={{
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
      borderRadius: '8px',
      background: 'var(--info-bg, #e0f2fe)',
      border: '1px solid var(--info-border, #0284c7)',
      color: 'var(--info-text, #075985)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      fontSize: '0.875rem',
    }}
    role="status"
  >
    <WifiOff size={18} />
    <div>
      <strong>Offline Mode:</strong> You are browsing offline. All demand projections and capacity calculations
      are executing client-side using cached historical profiles.
    </div>
  </div>
);

export const CounterDemandPermissionDenied = ({ requiredRole = 'centre_manager' }) => (
  <div
    className="card"
    style={{
      padding: '2.5rem 1.5rem',
      textAlign: 'center',
      border: '1px solid var(--danger-border, #fca5a5)',
      background: 'var(--bg-card)',
      borderRadius: '12px',
      margin: '1.5rem 0',
    }}
    role="alert"
  >
    <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'var(--danger-bg, #fee2e2)', marginBottom: '1rem' }}>
      <ShieldAlert size={32} color="var(--danger-text, #dc2626)" />
    </div>
    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>Access Restricted</h3>
    <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
      You need <strong>{requiredRole}</strong> or higher permissions to submit and approve official queue staffing capacity plans.
      Citizens and guests have read-only access to historical aggregates.
    </p>
  </div>
);

export const CounterDemandErrorState = ({ error, onRetry }) => (
  <div
    className="card"
    style={{
      padding: '2rem 1.5rem',
      textAlign: 'center',
      border: '1px solid var(--danger-border, #fca5a5)',
      background: 'var(--bg-card)',
      borderRadius: '12px',
      margin: '1.5rem 0',
    }}
    role="alert"
  >
    <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'var(--danger-bg, #fee2e2)', marginBottom: '0.75rem' }}>
      <AlertCircle size={28} color="var(--danger-text, #dc2626)" />
    </div>
    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem' }}>Unable to Compute Forecast</h3>
    <p style={{ color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto 1.25rem auto', fontSize: '0.9rem' }}>
      {error || 'A calculation error occurred while estimating queue parameters. Please retry.'}
    </p>
    {onRetry && (
      <button type="button" className="btn btn-secondary" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <RefreshCw size={16} />
        Retry Calculation
      </button>
    )}
  </div>
);

