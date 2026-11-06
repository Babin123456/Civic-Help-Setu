import { useState, useMemo } from 'react';
import { MAX_SEARCH_LENGTH } from '../../utils/searchParams';
import { Search, X, ArrowUpDown, Filter, RotateCcw, SlidersHorizontal, Check } from 'lucide-react';
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

  // Compute number of active filters to show in badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count += 1;
    if (selectedDepartment && selectedDepartment !== 'All') count += 1;
    if (selectedState && selectedState !== 'All') count += 1;
    if (selectedDistrict && selectedDistrict !== 'All') count += 1;
    if (feeType && feeType !== 'All') count += 1;
    if (speedFilter && speedFilter !== 'All') count += 1;
    if (selectedMode && selectedMode !== 'All') count += 1;
    if (selectedDifficulty && selectedDifficulty !== 'All') count += 1;
    if (sortBy && sortBy !== 'relevance') count += 1;
    return count;
  }, [
    searchQuery,
    selectedDepartment,
    selectedState,
    selectedDistrict,
    feeType,
    speedFilter,
    selectedMode,
    selectedDifficulty,
    sortBy,
  ]);

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
      className="filter-toolbar-container"
      style={{
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.03))',
        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
        borderRadius: '1.25rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Top Section: Prominent Search Input & Status Summary */}
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
          style={{ position: 'relative', flex: '1 1 340px' }}
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
              left: '1.15rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              pointerEvents: 'none',
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
              padding: '0.75rem 3.25rem 0.75rem 3rem',
              fontSize: '0.95rem',
              borderRadius: '99px',
              width: '100%',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-main)',
              color: 'var(--text-primary)',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: '0.9rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                background: 'transparent',
                border: 'none',
                padding: '4px',
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
                zIndex: 25,
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

        {/* Results Counter & Reset Filter Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              fontWeight: '600',
            }}
          >
            <span>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{totalResults}</strong> {totalResults === 1 ? 'service guide' : 'service guides'}
            </span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--accent-main)',
                  color: 'var(--bg-main)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  borderRadius: '99px',
                  padding: '0.1rem 0.5rem',
                  marginLeft: '0.25rem',
                }}
                aria-label={`${activeFilterCount} active filters`}
              >
                {activeFilterCount} active
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Reset all filters"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.82rem',
                color: 'var(--accent-main)',
                fontWeight: '600',
                cursor: 'pointer',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.35rem 0.75rem',
                borderRadius: '99px',
                transition: 'all 0.2s ease',
              }}
            >
              <RotateCcw size={12} />
              <span>Reset all</span>
            </button>
          )}
        </div>
      </div>

      {/* Middle Filter Group: Department & Geographic Jurisdiction */}
      <div
        className="filter-group-row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)' }}>
            Authority & Department
          </label>
          <DepartmentFilterSelect
            departments={departments}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={onDepartmentChange}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)' }}>
            State / District Scope
          </label>
          <JurisdictionFilterSelect
            state={selectedState}
            district={selectedDistrict}
            districtOptions={districtOptions}
            onStateChange={onStateChange}
            onDistrictChange={onDistrictChange}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)' }}>
            Fee Structure & Speed
          </label>
          <FeeAndSpeedFilter
            feeType={feeType}
            onFeeTypeChange={onFeeTypeChange}
            speedFilter={speedFilter}
            onSpeedFilterChange={onSpeedFilterChange}
          />
        </div>
      </div>

      {/* Bottom Filter Group: Application Mode, Complexity, and Sorting Facets */}
      <div
        className="filter-facets-row"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
          {/* Application Mode Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-tertiary)', fontWeight: '600' }}>Mode:</span>
            {['All', 'Online', 'Offline'].map((m) => {
              const isSelected = selectedMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModeChange(m)}
                  aria-pressed={isSelected}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '99px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    background: isSelected ? 'var(--text-primary)' : 'var(--glass-bg)',
                    color: isSelected ? 'var(--bg-main)' : 'var(--text-secondary)',
                    border: isSelected ? '1px solid transparent' : '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* Difficulty Filter */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-tertiary)', fontWeight: '600' }}>Difficulty:</span>
            {['All', 'Easy', 'Medium', 'Hard'].map((d) => {
              const isSelected = selectedDifficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDifficultyChange(d)}
                  aria-pressed={isSelected}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: '99px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    background: isSelected ? 'var(--text-primary)' : 'var(--glass-bg)',
                    color: isSelected ? 'var(--bg-main)' : 'var(--text-secondary)',
                    border: isSelected ? '1px solid transparent' : '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <ArrowUpDown size={14} color="var(--text-tertiary)" />
          <span style={{ color: 'var(--text-tertiary)', fontWeight: '600' }}>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label="Sort service guides"
            style={{
              padding: '0.38rem 0.85rem',
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
