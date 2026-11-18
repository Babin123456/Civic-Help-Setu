/**
 * src/components/wardHeatmap/WardHeatmapStates.jsx
 * Accessible state containers: Loading, Empty, Offline, Stale-Data, and Recoverable-Error.
 */
import { AlertTriangle, WifiOff, RefreshCw, Clock, Inbox } from 'lucide-react';

export const WardHeatmapSkeleton = () => (
  <div className="ward-heatmap-skeleton" aria-busy="true" aria-label="Loading ward issue heatmap data" style={{ padding: '1rem 0' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="skeleton-card"
          style={{
            height: '180px',
            borderRadius: '1rem',
            background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--border-light) 50%, var(--bg-card) 75%)',
            backgroundSize: '200% 100%',
            animation: 'skeleton-loading 1.5s infinite',
            border: '1px solid var(--border-light)',
          }}
        />
      ))}
    </div>
  </div>
);

export const WardHeatmapEmptyState = ({ onResetFilters, message }) => (
  <div
    role="status"
    className="glass-panel"
    style={{
      textAlign: 'center',
      padding: '3rem 1.5rem',
      borderRadius: '1rem',
      marginTop: '1.5rem',
      border: '1px dashed var(--border-light)',
    }}
  >
    <Inbox size={42} style={{ color: 'var(--text-tertiary)', marginBottom: '0.75rem' }} />
    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>No Civic Issues Found</h3>
    <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.25rem auto', fontSize: '0.9rem' }}>
      {message || 'No civic issue events match the current filter criteria or time window. Try expanding your search or selecting a different category.'}
    </p>
    {onResetFilters && (
      <button type="button" onClick={onResetFilters} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
        Reset Filters
      </button>
    )}
  </div>
);

export const WardHeatmapOfflineBanner = ({ lastSyncedAt, onRetry }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.75rem',
      padding: '0.85rem 1.25rem',
      background: 'rgba(234, 179, 8, 0.12)',
      border: '1px solid rgba(234, 179, 8, 0.35)',
      borderRadius: '0.75rem',
      marginBottom: '1rem',
      color: '#ca8a04',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <WifiOff size={18} />
      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
        Working in Offline Mode. Serving locally cached aggregate metrics.
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
      {lastSyncedAt && <span>Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}</span>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: 'auto' }}
        >
          <RefreshCw size={14} style={{ marginRight: '0.3rem' }} /> Reconnect
        </button>
      )}
    </div>
  </div>
);

export const WardHeatmapStaleDataNotice = ({ lastAggregatedAt, onRefresh }) => (
  <div
    role="note"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.5rem',
      padding: '0.6rem 1rem',
      background: 'var(--glass-bg)',
      border: '1px solid var(--border-light)',
      borderRadius: '0.5rem',
      marginBottom: '1rem',
      fontSize: '0.825rem',
      color: 'var(--text-secondary)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <Clock size={15} color="var(--accent-main)" />
      <span>
        Analytics generated on: <strong>{lastAggregatedAt ? new Date(lastAggregatedAt).toLocaleString() : 'Recent'}</strong>
      </span>
    </div>
    {onRefresh && (
      <button
        type="button"
        onClick={onRefresh}
        className="btn btn-secondary"
        style={{ padding: '0.25rem 0.6rem', fontSize: '0.775rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
        aria-label="Refresh latest aggregate metrics"
      >
        <RefreshCw size={13} /> Refresh
      </button>
    )}
  </div>
);

export const WardHeatmapErrorCard = ({ error, onRetry }) => (
  <div
    role="alert"
    className="glass-panel"
    style={{
      padding: '2rem',
      borderRadius: '1rem',
      border: '1px solid #ef4444',
      background: 'rgba(239, 68, 68, 0.05)',
      marginTop: '1.5rem',
      textAlign: 'center',
    }}
  >
    <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
    <h3 style={{ color: '#ef4444', fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 600 }}>
      Unable to Load Heatmap Data
    </h3>
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.25rem auto' }}>
      {error?.message || 'An unexpected error occurred while calculating anonymized ward metrics. No citizen data was exposed.'}
    </p>
    {onRetry && (
      <button type="button" onClick={onRetry} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
        <RefreshCw size={15} style={{ marginRight: '0.4rem' }} /> Retry Calculation
      </button>
    )}
  </div>
);
