import { SearchX } from 'lucide-react';

export default function AddressChangeEmptyState({ onResetSearch }) {
  return (
    <div
      role="status"
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        backgroundColor: 'var(--bg-surface)',
        border: '1px dashed var(--border-main)',
        borderRadius: '0.75rem',
        margin: '1rem 0',
      }}
    >
      <SearchX size={40} color="var(--text-muted, #9ca3af)" style={{ margin: '0 auto 1rem auto' }} />
      <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        No Address Update Records Found
      </h4>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '450px', margin: '0 auto 1.25rem auto' }}>
        No records match your active search keyword or current move scope filter. Try clearing your search or selecting additional records.
      </p>
      {onResetSearch && (
        <button
          type="button"
          onClick={onResetSearch}
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem' }}
        >
          Reset Search Filter
        </button>
      )}
    </div>
  );
}

