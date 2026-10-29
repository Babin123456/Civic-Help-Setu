import { useState } from 'react';
import { MAX_SEARCH_LENGTH } from '../../utils/searchParams';
import { Search, X, ArrowUpDown } from 'lucide-react';
import DepartmentFilterSelect from './DepartmentFilterSelect';
import FeeAndSpeedFilter from './FeeAndSpeedFilter';
import JurisdictionFilterSelect from './JurisdictionFilterSelect';

const FilterToolbar = ({
  searchQuery,
  onSearchChange,
  searchSuggestions = [],
  selectedMode,
  onModeChange,
  selectedDifficulty,
  onDifficultyChange,
  departments = [],
  selectedDepartment = 'All',
  onDepartmentChange = () => {},
  selectedState = 'All',
  selectedDistrict = 'All',
  districtOptions = [],
  onStateChange = () => {},
  onDistrictChange = () => {},
  feeType = 'All',
  onFeeTypeChange = () => {},
  speedFilter = 'All',
  onSpeedFilterChange = () => {},
  sortBy,
  onSortChange,
  totalResults,
  onResetFilters,
  hasActiveFilters,
}) => {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionListId = 'service-search-suggestions';

  const chooseSuggestion = (suggestion) => {
    onSearchChange(suggestion.label);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  };

  const handleSearchKeyDown = (event) => {
    if (!searchSuggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestion((current) => Math.min(current + 1, searchSuggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && suggestionsOpen && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(searchSuggestions[activeSuggestion]);
    } else if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  };

  return (
    <div
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--border-light)',
        borderRadius: '1.25rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Top Row: Search and Result Counter */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{ position: 'relative', flex: '1 1 320px' }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setSuggestionsOpen(false);
              setActiveSuggestion(-1);
            }
          }}
        >
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
            type="text"
            aria-label="Search public services"
            maxLength={MAX_SEARCH_LENGTH}
            placeholder="Search by title, documents, or keywords..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setSuggestionsOpen(true);
              setActiveSuggestion(-1);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={handleSearchKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen && searchSuggestions.length > 0}
            aria-controls={suggestionListId}
            aria-activedescendant={activeSuggestion >= 0 ? `service-suggestion-${activeSuggestion}` : undefined}
            className="input-field"
            style={{
              // Reserve room for the conditional clear button so long search
              // text and the caret never render underneath it.
              padding: '0.65rem 3rem 0.65rem 2.75rem',
              fontSize: '0.95rem',
              borderRadius: '99px',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          )}
          {suggestionsOpen && searchSuggestions.length > 0 && (
            <ul
              id={suggestionListId}
              role="listbox"
              aria-label="Suggested service searches"
              style={{
                position: 'absolute',
                zIndex: 20,
                top: 'calc(100% + 0.4rem)',
                left: 0,
                right: 0,
                margin: 0,
                padding: '0.4rem',
                listStyle: 'none',
                border: '1px solid var(--border-light)',
                borderRadius: '0.9rem',
                background: 'var(--bg-main)',
                boxShadow: '0 14px 32px rgba(0, 0, 0, 0.18)',
              }}
            >
              {searchSuggestions.map((suggestion, index) => (
                <li key={`${suggestion.kind}-${suggestion.label}`}>
                  <button
                    id={`service-suggestion-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeSuggestion === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseSuggestion(suggestion)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      padding: '0.55rem 0.75rem',
                      border: 'none',
                      borderRadius: '0.6rem',
                      background: activeSuggestion === index ? 'var(--glass-bg)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{suggestion.label}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
                      {suggestion.kind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
            Showing <strong>{totalResults}</strong> {totalResults === 1 ? 'service guide' : 'service guides'}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              style={{
                fontSize: '0.8rem',
                color: 'var(--accent-main)',
                textDecoration: 'underline',
                fontWeight: '600',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
              }}
            >
              Reset all
            </button>
          )}
        </div>
      </div>

      {/* Middle Row: Department, Fee Structure & Processing Speed */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        <DepartmentFilterSelect
          departments={departments}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={onDepartmentChange}
        />

        <JurisdictionFilterSelect
          state={selectedState}
          district={selectedDistrict}
          districtOptions={districtOptions}
          onStateChange={onStateChange}
          onDistrictChange={onDistrictChange}
        />

        <FeeAndSpeedFilter
          feeType={feeType}
          onFeeTypeChange={onFeeTypeChange}
          speedFilter={speedFilter}
          onSpeedFilterChange={onSpeedFilterChange}
        />
      </div>

      {/* Bottom Row: Mode, Difficulty, and Sorting Facets */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        {/* Application Mode Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: '600' }}>Mode:</span>
          {['All', 'Online', 'Offline'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: selectedMode === m ? 'var(--text-primary)' : 'var(--glass-bg)',
                color: selectedMode === m ? 'var(--bg-main)' : 'var(--text-secondary)',
                border: selectedMode === m ? '1px solid transparent' : '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Difficulty Filter */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: '600' }}>Difficulty:</span>
          {['All', 'Easy', 'Medium', 'Hard'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDifficultyChange(d)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '99px',
                fontSize: '0.8rem',
                fontWeight: '600',
                background: selectedDifficulty === d ? 'var(--text-primary)' : 'var(--glass-bg)',
                color: selectedDifficulty === d ? 'var(--bg-main)' : 'var(--text-secondary)',
                border: selectedDifficulty === d ? '1px solid transparent' : '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <ArrowUpDown size={14} color="var(--text-tertiary)" />
          <span style={{ color: 'var(--text-tertiary)', fontWeight: '600' }}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '99px',
              fontSize: '0.825rem',
              background: 'var(--glass-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="relevance" style={{ background: 'var(--bg-main)' }}>Most Relevant</option>
            <option value="popularity" style={{ background: 'var(--bg-main)' }}>Most Popular</option>
            <option value="speed-asc" style={{ background: 'var(--bg-main)' }}>Fastest Processing</option>
            <option value="name-asc" style={{ background: 'var(--bg-main)' }}>Name (A – Z)</option>
            <option value="name-desc" style={{ background: 'var(--bg-main)' }}>Name (Z – A)</option>
            <option value="difficulty-asc" style={{ background: 'var(--bg-main)' }}>Difficulty (Easiest first)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default FilterToolbar;
