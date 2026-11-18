import { AlertCircle, RefreshCw } from 'lucide-react';

export default function AddressChangeErrorState({ error, onRetry }) {
  return (
    <div
      role="alert"
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '0.75rem',
        margin: '1.5rem 0',
      }}
    >
      <AlertCircle size={40} color="#dc2626" style={{ margin: '0 auto 1rem auto' }} />
      <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>
        Unable to Load Address Planner Data
      </h4>
      <p style={{ fontSize: '0.85rem', color: '#7f1d1d', maxWidth: '450px', margin: '0 auto 1.25rem auto' }}>
        {error?.message || 'An unexpected error occurred while parsing address update records or client storage.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-primary"
          style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={14} /> Retry Loading
        </button>
      )}
    </div>
  );
}

