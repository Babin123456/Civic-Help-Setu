import React from 'react';
import { ClipboardList, PlusCircle } from 'lucide-react';

const SurveyEmptyState = ({ onResetFilters, onCreateNew }) => {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3.5rem 1.5rem',
        background: 'var(--bg-card)',
        borderRadius: '1rem',
        border: '1px dashed var(--border-light)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.1)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
          color: 'var(--accent-main)',
        }}
      >
        <ClipboardList size={28} />
      </div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Civic Surveys Found</h3>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
        No survey projects match your selected filters, or no consultation consultations have been published for this jurisdiction yet.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {onResetFilters && (
          <button type="button" onClick={onResetFilters} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Reset Filters
          </button>
        )}
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <PlusCircle size={16} /> Create Survey Project
          </button>
        )}
      </div>
    </div>
  );
};

export default SurveyEmptyState;

