import { AlertCircle, WifiOff, RefreshCw, ShieldAlert, FileSearch, Clock } from 'lucide-react';

export const LineageSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }} aria-busy="true" aria-label="Loading provenance lineage data">
    <div style={{ height: '36px', width: '60%', background: 'var(--border-light)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
      <div style={{ height: '120px', background: 'var(--border-light)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
      <div style={{ height: '120px', background: 'var(--border-light)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
      <div style={{ height: '120px', background: 'var(--border-light)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
    </div>
    <div style={{ height: '280px', background: 'var(--border-light)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
  </div>
);

export const LineageEmptyState = ({
  onReset,
  onSelectSample,
  message = 'No provenance records match your current filters.',
}) => (
  <div
    className="card"
    style={{
      padding: '3rem 1.5rem',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      background: 'var(--glass-bg)',
    }}
  >
    <FileSearch size={44} color="var(--text-tertiary)" />
    <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>No Provenance Records Found</h3>
    <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '480px', fontSize: '0.9rem' }}>
      {message}
    </p>
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
      {onSelectSample && (
        <>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSelectSample('tree-pruning-permission')}
            style={{ fontSize: '0.85rem' }}
          >
            View Tree Pruning Permission
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSelectSample('aadhaar-card')}
            style={{ fontSize: '0.85rem' }}
          >
            View Aadhaar Card Lineage
          </button>
        </>
      )}
      {onReset && (
        <button type="button" className="btn btn-secondary" onClick={onReset} style={{ fontSize: '0.85rem' }}>
          Reset Filters
        </button>
      )}
    </div>
  </div>
);

export const LineageStaleBanner = ({ daysOld, onRefresh }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1rem',
      background: 'rgba(245, 158, 11, 0.12)',
      border: '1px solid rgba(245, 158, 11, 0.4)',
      borderRadius: '8px',
      color: '#d97706',
      marginBottom: '1rem',
      fontSize: '0.875rem',
      gap: '0.75rem',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Clock size={18} />
      <span>
        <strong>Notice:</strong> This statutory source was last retrieved {daysOld} days ago and is pending statutory re-audit.
      </span>
    </div>
    {onRefresh && (
      <button
        type="button"
        onClick={onRefresh}
        className="btn btn-secondary"
        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'rgba(245, 158, 11, 0.5)' }}
      >
        Re-verify Now
      </button>
    )}
  </div>
);

export const LineageOfflineBanner = () => (
  <div
    role="status"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
      padding: '0.65rem 1rem',
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.35)',
      borderRadius: '8px',
      color: 'var(--accent-main)',
      fontSize: '0.85rem',
      marginBottom: '1rem',
    }}
  >
    <WifiOff size={16} />
    <span>
      <strong>Offline Mode:</strong> Viewing locally cached immutable provenance records and cached source snapshots.
    </span>
  </div>
);

export const LineagePermissionDenied = ({ role = 'citizen' }) => (
  <div
    className="card"
    role="alert"
    style={{
      padding: '2.5rem 1.5rem',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      borderLeft: '4px solid #ef4444',
    }}
  >
    <ShieldAlert size={40} color="#ef4444" />
    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Access Restricted</h3>
    <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '450px', fontSize: '0.9rem' }}>
      Editing statutory sources, recording editorial overrides, and inspecting private reviewer deliberations requires an Administrator or Reviewer role. Your current role is <code>{role}</code>.
    </p>
  </div>
);

export const LineageErrorState = ({ error, onRetry }) => (
  <div
    className="card"
    role="alert"
    style={{
      padding: '2rem 1.5rem',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      borderLeft: '4px solid #ef4444',
      background: 'var(--glass-bg)',
    }}
  >
    <AlertCircle size={38} color="#ef4444" />
    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Lineage Traversal Error</h3>
    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px' }}>
      {error || 'An unexpected error occurred while resolving the provenance graph.'}
    </p>
    {onRetry && (
      <button type="button" className="btn btn-primary" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <RefreshCw size={15} />
        Retry Traversal
      </button>
    )}
  </div>
);
