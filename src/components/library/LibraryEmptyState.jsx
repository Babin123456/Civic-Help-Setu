import { BookX, RotateCcw } from 'lucide-react';

export default function LibraryEmptyState({ onReset }) {
  return (
    <div
      role="region"
      aria-label="No library results found"
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '1rem',
        border: '1px dashed var(--border-main)',
        margin: '2rem 0',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          color: 'var(--warning, #f59e0b)',
        }}
      >
        <BookX size={28} />
      </div>

      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        No Verified Libraries Found
      </h3>

      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
        No public libraries or digital learning centres matched your current search filters. Try clearing filters or searching by a broader state or city jurisdiction.
      </p>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1.25rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            borderRadius: '0.5rem',
            backgroundColor: 'var(--accent-main)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={15} /> Reset All Filters
        </button>
      )}
    </div>
  );
}

