/**
 * src/components/wardHeatmap/WardHeatmapFilters.jsx
 * Filter bar for time windows, categories, zones, view modes, and user role scoping (#763).
 */
import { Search, Grid, Table, TrendingUp, Sparkles, UserCheck } from 'lucide-react';
import {
  TIME_WINDOW_LABELS,
  ISSUE_CATEGORIES,
} from '../../data/wardIssueHeatmapContract.js';

export default function WardHeatmapFilters({
  timeWindow,
  onTimeWindowChange,
  selectedCategory,
  onCategoryChange,
  selectedZone,
  onZoneChange,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  zones = [],
  userRole,
  onRoleChange,
}) {
  return (
    <div
      className="glass-panel"
      style={{
        borderRadius: '1rem',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Top row: Search, Category, Zone, Time Window */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
            }}
          />
          <input
            type="text"
            placeholder="Search ward name or code..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search ward by name or number"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category-select" className="sr-only">Filter by Category</label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="">All Issue Categories</option>
            {Object.values(ISSUE_CATEGORIES).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Zone */}
        <div>
          <label htmlFor="zone-select" className="sr-only">Filter by Municipal Zone</label>
          <select
            id="zone-select"
            value={selectedZone}
            onChange={(e) => onZoneChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="">All Municipal Zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>

        {/* Time Window */}
        <div>
          <label htmlFor="time-window-select" className="sr-only">Time Window</label>
          <select
            id="time-window-select"
            value={timeWindow}
            onChange={(e) => onTimeWindowChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          >
            {Object.entries(TIME_WINDOW_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom row: View Mode switcher & Role selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        {/* View Mode Buttons */}
        <div role="tablist" aria-label="Heatmap Presentation Modes" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'grid'}
            onClick={() => onViewModeChange('grid')}
            className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Grid size={15} />
            <span>Heatmap Grid</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'table'}
            onClick={() => onViewModeChange('table')}
            className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Table size={15} />
            <span>Accessible Table View</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'trends'}
            onClick={() => onViewModeChange('trends')}
            className={`btn ${viewMode === 'trends' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <TrendingUp size={15} />
            <span>Trend Comparison</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'recommendations'}
            onClick={() => onViewModeChange('recommendations')}
            className={`btn ${viewMode === 'recommendations' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Sparkles size={15} />
            <span>Explainable Interventions</span>
          </button>
        </div>

        {/* Role Scoping Simulator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
          <UserCheck size={15} style={{ color: 'var(--accent-main)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>View Scope:</span>
          <select
            value={userRole}
            onChange={(e) => onRoleChange(e.target.value)}
            aria-label="Simulate User Role Access Scope"
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
            }}
          >
            <option value="public">Public Citizen (Aggregates Only)</option>
            <option value="operator">Municipal Operator (Triage &amp; Review)</option>
            <option value="admin">Administrator (Audit &amp; Full Access)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
