import React from 'react';
import { Clock, RefreshCw } from 'lucide-react';

const SurveyStaleDataNotice = ({ lastUpdated, onRefresh }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '0.75rem',
        marginBottom: '1.25rem',
        fontSize: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
        <Clock size={16} color="#f59e0b" />
        <span>
          Offline / Cached mode: Local surveys were last synced at{' '}
          <strong>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'recently'}</strong>.
        </span>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
        >
          <RefreshCw size={12} /> Sync Latest
        </button>
      )}
    </div>
  );
};

export default SurveyStaleDataNotice;

