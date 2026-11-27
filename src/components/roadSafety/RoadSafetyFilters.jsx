import { Search, RotateCcw, Filter } from 'lucide-react';
import { CASE_STATES, CASE_STATE_LABELS } from '../../data/roadSafetyContract';

export default function RoadSafetyFilters({
  filters,
  onChange,
  onReset,
}) {
  const handleInputChange = (field, value) => {
    onChange({
      ...filters,
      [field]: value,
    });
  };

  return (
    <div
      role="search"
      aria-label="Filter blackspot cases"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
          <Filter size={16} color="var(--accent-main)" />
          <span>Corridor & Blackspot Filters</span>
        </div>

        <button
          type="button"
          onClick={onReset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.78rem',
            cursor: 'pointer',
            padding: '0.2rem 0.4rem',
            borderRadius: '0.35rem',
          }}
        >
          <RotateCcw size={13} />
          Reset Filters
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          alignItems: 'end',
        }}
      >
        {/* Search Input */}
        <div>
          <label
            htmlFor="blackspot-search-query"
            style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}
          >
            Search Corridor / District
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
            />
            <input
              id="blackspot-search-query"
              type="text"
              value={filters.searchQuery || ''}
              onChange={(e) => handleInputChange('searchQuery', e.target.value)}
              placeholder="e.g. NH-44, Hebbal, Ring Road..."
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-main)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>
        </div>

        {/* State Filter */}
        <div>
          <label
            htmlFor="blackspot-state-filter"
            style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}
          >
            Jurisdiction / State
          </label>
          <select
            id="blackspot-state-filter"
            value={filters.state || 'all'}
            onChange={(e) => handleInputChange('state', e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          >
            <option value="all">All States</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Delhi">Delhi</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
            <option value="West Bengal">West Bengal</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label
            htmlFor="blackspot-status-filter"
            style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}
          >
            Review Status
          </label>
          <select
            id="blackspot-status-filter"
            value={filters.status || 'all'}
            onChange={(e) => handleInputChange('status', e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          >
            <option value="all">All Statuses</option>
            {Object.entries(CASE_STATES).map(([key, val]) => (
              <option key={key} value={val}>
                {CASE_STATE_LABELS[val]}
              </option>
            ))}
          </select>
        </div>

        {/* Min Risk Score Threshold */}
        <div>
          <label
            htmlFor="blackspot-score-filter"
            style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}
          >
            Min Composite Risk Score: {filters.minScore || 0}
          </label>
          <input
            id="blackspot-score-filter"
            type="range"
            min="0"
            max="100"
            step="5"
            value={filters.minScore || 0}
            onChange={(e) => handleInputChange('minScore', Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-main)' }}
          />
        </div>
      </div>
    </div>
  );
}

