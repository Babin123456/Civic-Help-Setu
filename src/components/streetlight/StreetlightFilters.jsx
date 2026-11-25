import { Search, Filter, RotateCcw, Map, List } from 'lucide-react';
import {
  CLUSTER_STATUS,
  CLUSTER_STATUS_LABELS,
  PRIORITY_TIERS,
  PRIORITY_TIER_LABELS,
} from '../../services/streetlightConstants';

export default function StreetlightFilters({
  filters,
  onChange,
  onReset,
  viewMode,
  onViewModeToggle,
}) {
  const handleFilterChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div
      className="streetlight-filters"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.85rem',
        padding: '0.85rem 1rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-main)',
        borderRadius: '0.75rem',
        marginBottom: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search by street, landmark, or pole ID..."
            value={filters.searchQuery || ''}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.25rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
            aria-label="Search streetlight outages"
          />
        </div>

        {/* Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Filter size={15} style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
          <select
            value={filters.status || 'all'}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
            aria-label="Filter by cluster status"
          >
            <option value="all" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>All Statuses</option>
            {Object.entries(CLUSTER_STATUS).map(([key, val]) => (
              <option key={key} value={val} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                {CLUSTER_STATUS_LABELS[val]}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Tier Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <select
            value={filters.priorityTier || 'all'}
            onChange={(e) => handleFilterChange('priorityTier', e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-main)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
            aria-label="Filter by priority tier"
          >
            <option value="all" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>All Priorities</option>
            {Object.entries(PRIORITY_TIERS).map(([key, val]) => (
              <option key={key} value={val} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                {PRIORITY_TIER_LABELS[val]}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        <button
          type="button"
          onClick={onReset}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.8rem',
            padding: '0.45rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-main)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
          title="Reset filters"
        >
          <RotateCcw size={13} aria-hidden="true" />
          Reset
        </button>
      </div>

      {/* View Mode Toggle (Accessible Map / List Alternative) */}
      <div
        style={{
          display: 'inline-flex',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.5rem',
          padding: '2px',
          gap: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => onViewModeToggle('list')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: 'pointer',
            background: viewMode === 'list' ? 'var(--accent-main)' : 'transparent',
            color: viewMode === 'list' ? '#050505' : 'var(--text-secondary)',
            fontWeight: viewMode === 'list' ? 700 : 500,
          }}
          aria-pressed={viewMode === 'list'}
        >
          <List size={14} aria-hidden="true" />
          List View
        </button>
        <button
          type="button"
          onClick={() => onViewModeToggle('map')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '0.375rem',
            border: 'none',
            cursor: 'pointer',
            background: viewMode === 'map' ? 'var(--accent-main)' : 'transparent',
            color: viewMode === 'map' ? '#050505' : 'var(--text-secondary)',
            fontWeight: viewMode === 'map' ? 700 : 500,
          }}
          aria-pressed={viewMode === 'map'}
        >
          <Map size={14} aria-hidden="true" />
          Interactive Map
        </button>
      </div>
    </div>
  );
}
