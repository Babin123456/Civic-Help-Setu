import { AlertCircle, WifiOff, RefreshCw, Map as MapIcon, Table as TableIcon, ShieldAlert } from 'lucide-react';

/**
 * Loading Skeleton for Corridor Cards & Table
 */
export function RoadSafetySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading road safety blackspot records..."
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        marginBottom: '1.5rem',
      }}
    >
      {[1, 2, 3].map((idx) => (
        <div
          key={idx}
          style={{
            height: '76px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            borderRadius: '0.75rem',
            animation: 'pulse 1.5s infinite ease-in-out',
            opacity: 0.6,
          }}
        />
      ))}
      <span className="sr-only">Loading road safety blackspot records...</span>
    </div>
  );
}

/**
 * Offline Mode Banner
 */
export function RoadSafetyOfflineBanner({ pendingCount = 0 }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        marginBottom: '1.25rem',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '0.5rem',
        color: 'var(--text-primary)',
        fontSize: '0.84rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <WifiOff size={18} color="#ef4444" style={{ flexShrink: 0 }} />
        <span>
          <strong>Offline Mode Active:</strong> You are currently working disconnected. Corridor data is served from your local encrypted browser storage. New inspection entries and hazard reports will be saved locally.
          {pendingCount > 0 && ` (${pendingCount} pending local entries)`}
        </span>
      </div>
    </div>
  );
}

/**
 * Stale Data & Source Attribution Notice
 */
export function RoadSafetyStaleDataNotice({
  publishedPeriod = '2025 Q4 (Oct - Dec)',
  sourceAgency = 'Ministry of Road Transport and Highways (MoRTH) & State Police Digests',
}) {
  return (
    <div
      role="note"
      aria-label="Official data source and period notice"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        padding: '0.65rem 0.9rem',
        marginBottom: '1.25rem',
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        borderRadius: '0.5rem',
        fontSize: '0.78rem',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertCircle size={15} color="var(--accent-main)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Statutory Baseline:</strong> Crash figures reflect <strong>{publishedPeriod}</strong> official aggregates from <em>{sourceAgency}</em>. Exposure denominators without ADT census are marked with uncertainty bounds.
        </span>
      </div>
    </div>
  );
}

/**
 * Recoverable Error State Card
 */
export function RoadSafetyErrorState({
  message = 'Failed to load blackspot records.',
  onRetry = () => {},
}) {
  return (
    <div
      role="alert"
      style={{
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '0.75rem',
        margin: '1.5rem 0',
      }}
    >
      <AlertCircle size={36} color="#ef4444" style={{ margin: '0 auto 0.75rem' }} />
      <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
        Unable to Load Road Safety Data
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 1.25rem' }}>
        {message}
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={onRetry}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
      >
        <RefreshCw size={14} />
        <span>Retry Data Recovery</span>
      </button>
    </div>
  );
}

/**
 * Permission Denied State Card
 */
export function RoadSafetyPermissionDeniedState({
  requiredRole = 'Certified Safety Officer or Transport Administrator',
  onDismiss = null,
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '0.75rem',
        margin: '1.5rem 0',
      }}
    >
      <ShieldAlert size={36} color="#ef4444" style={{ margin: '0 auto 0.75rem' }} />
      <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
        Access Restricted: Authorized Personnel Only
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.25rem' }}>
        Managing road corridor inspections, state transitions, and engineering countermeasures requires {requiredRole} credentials under the Indian Road Congress (IRC SP:88) guidelines.
      </p>
      {onDismiss && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onDismiss}
        >
          Return to Monitored Corridors
        </button>
      )}
    </div>
  );
}

/**
 * View Switcher: Table View (Accessible Default) vs Spatial Hotspot Map
 */
export function RoadSafetyViewToggle({ activeView = 'table', onViewChange = () => {} }) {
  return (
    <div
      role="group"
      aria-label="Display view mode"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-main)',
        padding: '0.2rem',
        borderRadius: '0.5rem',
        border: '1px solid var(--border-main)',
        gap: '0.25rem',
      }}
    >
      <button
        type="button"
        className={`btn btn-sm ${activeView === 'table' ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => onViewChange('table')}
        aria-pressed={activeView === 'table'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.78rem',
          padding: '0.3rem 0.65rem',
        }}
      >
        <TableIcon size={14} />
        <span>Evidence Table (Accessible)</span>
      </button>
      <button
        type="button"
        className={`btn btn-sm ${activeView === 'map' ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => onViewChange('map')}
        aria-pressed={activeView === 'map'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.78rem',
          padding: '0.3rem 0.65rem',
        }}
      >
        <MapIcon size={14} />
        <span>Spatial Hotspot Map</span>
      </button>
    </div>
  );
}
