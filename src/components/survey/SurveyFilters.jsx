import React from 'react';
import { Search, Filter, RotateCcw } from 'lucide-react';
import { SURVEY_STATUS } from '../../data/surveyContract.js';

const SurveyFilters = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  categories = [],
  onReset,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '1rem',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: '0.75rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ position: 'relative', flex: '1 1 240px' }}>
        <Search
          size={16}
          style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
        />
        <input
          type="text"
          placeholder="Search by survey title, topic, or department..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem 0.5rem 2.25rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-main)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
          }}
          aria-label="Search surveys"
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Filter size={15} color="var(--text-tertiary)" />
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
            aria-label="Filter by lifecycle status"
          >
            <option value="all">All Statuses</option>
            <option value={SURVEY_STATUS.PUBLISHED}>Published / Open</option>
            <option value={SURVEY_STATUS.DRAFT}>Draft</option>
            <option value={SURVEY_STATUS.UNDER_REVIEW}>Under Review</option>
            <option value={SURVEY_STATUS.PAUSED}>Paused</option>
            <option value={SURVEY_STATUS.CLOSED}>Closed</option>
          </select>
        </div>

        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{
              padding: '0.45rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={onReset}
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          aria-label="Reset all filters"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>
    </div>
  );
};

export default SurveyFilters;

