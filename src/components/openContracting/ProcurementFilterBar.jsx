import { Search, Filter, RotateCcw, UserCheck } from 'lucide-react';
import {
  PROCUREMENT_CATEGORIES,
  SEVERITY_LEVELS,
  REVIEW_STATUSES,
  USER_ROLES,
} from '../../data/openContractingContract.js';

export default function ProcurementFilterBar({
  search,
  onSearchChange,
  jurisdiction,
  onJurisdictionChange,
  category,
  onCategoryChange,
  severity,
  onSeverityChange,
  status,
  onStatusChange,
  userRole,
  onRoleChange,
  onResetFilters,
}) {
  return (
    <div
      className="card filter-bar-card"
      style={{
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
        background: 'var(--bg-card, #1e293b)',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          paddingBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={18} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            Analytics Filters &amp; Scopes
          </h2>
        </div>

        {/* Persona / RBAC Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCheck size={16} color="var(--accent-main, #38bdf8)" aria-hidden="true" />
          <label htmlFor="user-role-select" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Active Persona:
          </label>
          <select
            id="user-role-select"
            value={userRole}
            onChange={(e) => onRoleChange(e.target.value)}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
              background: 'var(--bg-elevated, #0f172a)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
            }}
          >
            {Object.values(USER_ROLES).map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search tender title, ref #..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search procurement records by title or tender reference"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              background: 'var(--bg-elevated, #0f172a)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
            }}
          />
        </div>

        {/* Jurisdiction */}
        <div>
          <select
            value={jurisdiction}
            onChange={(e) => onJurisdictionChange(e.target.value)}
            aria-label="Filter by municipal jurisdiction"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              background: 'var(--bg-elevated, #0f172a)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
            }}
          >
            <option value="all">All Jurisdictions</option>
            <option value="Bengaluru Urban, Karnataka">Bengaluru Urban, Karnataka</option>
            <option value="Pune, Maharashtra">Pune, Maharashtra</option>
            <option value="Delhi NCR">Delhi NCR</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Filter by procurement category"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              background: 'var(--bg-elevated, #0f172a)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
            }}
          >
            <option value="all">All Categories</option>
            {Object.values(PROCUREMENT_CATEGORIES).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div>
          <select
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value)}
            aria-label="Filter by anomaly severity"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              background: 'var(--bg-elevated, #0f172a)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
            }}
          >
            <option value="all">All Severities</option>
            {Object.values(SEVERITY_LEVELS).map((sev) => (
              <option key={sev.id} value={sev.id}>
                {sev.label} Severity
              </option>
            ))}
          </select>
        </div>

        {/* Review Status */}
        <div>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter by review status"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              background: 'var(--bg-elevated, #0f172a)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
            }}
          >
            <option value="all">All Review Statuses</option>
            {Object.values(REVIEW_STATUSES).map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reset */}
        <div>
          <button
            type="button"
            onClick={onResetFilters}
            className="btn btn-secondary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.48rem 0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}
