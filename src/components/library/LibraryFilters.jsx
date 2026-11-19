import { Search, RotateCcw } from 'lucide-react';
import { INDIAN_STATES_AND_UTS } from '../../data/jurisdictions';
import { LIBRARY_TYPES, LIBRARY_TYPE_LABELS } from '../../data/libraryContract';

export default function LibraryFilters({
  filters,
  onChange,
  onReset,
}) {
  const handleTextChange = (key, val) => {
    onChange({ ...filters, [key]: val });
  };

  const handleToggle = (key) => {
    onChange({ ...filters, [key]: !filters[key] });
  };

  return (
    <section
      aria-label="Filter public libraries and learning resources"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '1rem',
        padding: '1.25rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Top Search Bar */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search
          size={18}
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
          }}
        />
        <input
          type="search"
          value={filters.searchQuery || ''}
          onChange={(e) => handleTextChange('searchQuery', e.target.value)}
          placeholder="Search by library name, authority, locality, or digital repository (e.g. NDLI, Cubbon Park, DPL)..."
          aria-label="Search libraries and learning resources"
          style={{
            width: '100%',
            padding: '0.75rem 1rem 0.75rem 2.75rem',
            borderRadius: '0.6rem',
            border: '1px solid var(--border-main)',
            backgroundColor: 'var(--bg-main)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Primary Selectors Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <label htmlFor="filter-state" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            State / UT
          </label>
          <select
            id="filter-state"
            value={filters.state || ''}
            onChange={(e) => handleTextChange('state', e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="">All States / UTs</option>
            {INDIAN_STATES_AND_UTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-district" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            District / City
          </label>
          <input
            id="filter-district"
            type="text"
            value={filters.district || ''}
            onChange={(e) => handleTextChange('district', e.target.value)}
            placeholder="e.g. Central Delhi, Kolkata, Chennai"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label htmlFor="filter-type" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            Library Type
          </label>
          <select
            id="filter-type"
            value={filters.libraryType || 'all'}
            onChange={(e) => handleTextChange('libraryType', e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">All Library Categories</option>
            {LIBRARY_TYPES.map((t) => (
              <option key={t} value={t}>
                {LIBRARY_TYPE_LABELS[t] || t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feature Checkboxes & Reset */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.onlyWheelchair)}
              onChange={() => handleToggle('onlyWheelchair')}
            />
            Wheelchair Accessible
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.onlyBraille)}
              onChange={() => handleToggle('onlyBraille')}
            />
            Braille Section
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.onlyScreenReaders)}
              onChange={() => handleToggle('onlyScreenReaders')}
            />
            Screen Reader Terminals
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(filters.onlyDigitalResources)}
              onChange={() => handleToggle('onlyDigitalResources')}
            />
            Digital Learning Repositories (NDLI)
          </label>
        </div>

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid var(--border-main)',
              borderRadius: '0.4rem',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>
    </section>
  );
}

