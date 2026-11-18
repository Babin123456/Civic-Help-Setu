import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function LibraryErrorState({ error, onRetry }) {
  const message = error?.message || 'Failed to load verified library directory. Please check network connectivity.';

  return (
    <div
      role="alert"
      aria-label="Library directory loading failure"
      style={{
        padding: '2rem 1.5rem',
        borderRadius: '1rem',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        textAlign: 'center',
        margin: '2rem 0',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          color: 'var(--danger, #ef4444)',
        }}
      >
        <AlertTriangle size={26} />
      </div>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--danger, #ef4444)', marginBottom: '0.4rem' }}>
        Unable to Load Verified Library Directory
      </h3>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1.2rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-main)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={15} /> Retry
        </button>
      )}
    </div>
  );
}

