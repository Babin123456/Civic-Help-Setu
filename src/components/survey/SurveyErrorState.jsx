import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const SurveyErrorState = ({ message, onRetry }) => {
  return (
    <div
      style={{
        padding: '2rem',
        borderRadius: '1rem',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        textAlign: 'center',
      }}
    >
      <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem' }}>
        Survey Workspace Error
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
        {message || 'An error occurred while loading survey data or validating workflows.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} /> Retry Operation
        </button>
      )}
    </div>
  );
};

export default SurveyErrorState;

