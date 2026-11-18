import { CheckSquare, Square } from 'lucide-react';
import { VERIFIED_ADDRESS_CHANGE_RECORDS } from '../../data/addressChangeRecords';

export default function RecordSelector({ selectedRecordIds, onToggleRecord, onSelectAll, onClearAll }) {
  const isSelected = (id) => selectedRecordIds.includes(id);

  return (
    <div
      className="card"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Step 2: Select Records to Update
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
            Choose the official records and services you hold. Your action plan will adapt its dependency order accordingly.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onSelectAll}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        role="group"
        aria-label="Government records selection"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {VERIFIED_ADDRESS_CHANGE_RECORDS.map((record) => {
          const checked = isSelected(record.id);
          return (
            <div
              key={record.id}
              onClick={() => onToggleRecord(record.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: checked
                  ? '1px solid var(--accent-main)'
                  : '1px solid var(--border-main)',
                backgroundColor: checked
                  ? 'var(--accent-light)'
                  : 'var(--glass-bg)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <div style={{ marginTop: '2px', color: checked ? 'var(--accent-main)' : 'var(--text-tertiary)' }}>
                {checked ? <CheckSquare size={18} /> : <Square size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {record.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {record.authority.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

