/**
 * src/components/waterQuality/WaterQualityFilters.jsx
 * Filter bar and controls for Community Water Quality Register (#754).
 */

import { Search, LayoutGrid, Table, UserCheck } from 'lucide-react';
import { WATER_POINT_TYPES, OPERATIONAL_STATUSES } from '../../data/waterQualityContract.js';

export default function WaterQualityFilters({
  filters,
  onFilterChange,
  availableCities,
  availableWards,
  viewMode,
  onViewModeChange,
  userRole,
  onRoleChange,
}) {
  return (
    <div className="wq-filters-card">
      {/* Search and Role Row */}
      <div className="wq-search-row">
        <div className="wq-search-box">
          <Search size={16} className="wq-search-icon" />
          <input
            type="text"
            placeholder="Search by water point name, ward, landmark, or ID..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            aria-label="Search water points"
          />
        </div>

        {/* View mode toggle and Role selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="wq-view-toggle">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`wq-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              aria-label="Grid card view"
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`wq-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              aria-label="Accessible table view"
            >
              <Table size={14} />
              <span>Table</span>
            </button>
          </div>

          {/* Role switcher for verified authority testing */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <UserCheck size={16} style={{ color: '#10b981' }} />
            <label htmlFor="role-select" className="sr-only">Role View</label>
            <select
              id="role-select"
              value={userRole}
              onChange={(e) => onRoleChange(e.target.value)}
              className="wq-select"
              style={{ width: 'auto', fontWeight: 600 }}
            >
              <option value="public">Role: Public Resident</option>
              <option value="sampler">Role: Certified Sampler</option>
              <option value="lab_analyst">Role: NABL Lab Analyst</option>
              <option value="official_reviewer">Role: Municipal Health Officer</option>
              <option value="admin">Role: Central Administrator</option>
            </select>
          </div>
        </div>
      </div>

      {/* Multi-Filter dropdowns */}
      <div className="wq-filters-grid">
        {/* City Filter */}
        <div className="wq-field-group">
          <label className="wq-field-label">
            City / ULB
          </label>
          <select
            value={filters.city}
            onChange={(e) => onFilterChange({ ...filters, city: e.target.value, ward: 'All' })}
            className="wq-select"
          >
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {/* Ward Filter */}
        <div className="wq-field-group">
          <label className="wq-field-label">
            Ward / Locality
          </label>
          <select
            value={filters.ward}
            onChange={(e) => onFilterChange({ ...filters, ward: e.target.value })}
            className="wq-select"
          >
            {availableWards.map((ward) => (
              <option key={ward} value={ward}>
                {ward}
              </option>
            ))}
          </select>
        </div>

        {/* Water Point Type */}
        <div className="wq-field-group">
          <label className="wq-field-label">
            Water Point Type
          </label>
          <select
            value={filters.pointType}
            onChange={(e) => onFilterChange({ ...filters, pointType: e.target.value })}
            className="wq-select"
          >
            <option value="all">All Point Types</option>
            {Object.entries(WATER_POINT_TYPES).map(([key, def]) => (
              <option key={key} value={key}>
                {def.label}
              </option>
            ))}
          </select>
        </div>

        {/* Compliance Status */}
        <div className="wq-field-group">
          <label className="wq-field-label">
            Compliance (IS 10500)
          </label>
          <select
            value={filters.compliance}
            onChange={(e) => onFilterChange({ ...filters, compliance: e.target.value })}
            className="wq-select"
          >
            <option value="all">All Compliance States</option>
            <option value="compliant">IS 10500 Compliant</option>
            <option value="exceeded">Statutory Limits Exceeded</option>
            <option value="critical_hazard">Critical Hazard / Pathogen</option>
            <option value="pending">Pending Lab Analysis</option>
          </select>
        </div>

        {/* Operational Status */}
        <div className="wq-field-group">
          <label className="wq-field-label">
            Asset State
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
            className="wq-select"
          >
            <option value="all">All Operational States</option>
            {Object.entries(OPERATIONAL_STATUSES).map(([key, def]) => (
              <option key={key} value={key}>
                {def.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
