import { SearchX, FilterX, FolderOpen, RotateCcw, X } from 'lucide-react';

const DirectoryEmptyState = ({
  searchQuery = '',
  activeCategory = 'All',
  hasActiveFilters = false,
  hasFilters = false,
  totalServices,
  onReset,
  onClearSearch,
}) => {
  const trimmedQuery = typeof searchQuery === 'string' ? searchQuery.trim() : '';
  const hasSearch = trimmedQuery.length > 0;
  const filtersActive = Boolean(
    hasActiveFilters ||
    hasFilters ||
    (activeCategory && activeCategory.toLowerCase() !== 'all')
  );

  // Distinguish between:
  // 1. Completely empty service catalogue
  // 2. No results because of search
  // 3. No results because of active filters
  const isCatalogueEmpty =
    (typeof totalServices === 'number' && totalServices === 0) ||
    (totalServices === undefined && !hasSearch && !filtersActive);

  const isSearchEmpty = !isCatalogueEmpty && hasSearch;
  const isFilterEmpty = !isCatalogueEmpty && !hasSearch && filtersActive;

  const handleClearSearch = onClearSearch || onReset;

  let Icon = SearchX;
  let title = 'No Matching Civic Services Found';
  let description = null;
  let tips = [];
  let showClearSearch = false;
  let showResetFilters = false;

  if (isCatalogueEmpty) {
    Icon = FolderOpen;
    title = 'No Civic Services Available';
    description = (
      <>
        There are currently no civic service guides listed in the directory.
        Please check back later as new public services are continuously added.
      </>
    );
    tips = [];
    showClearSearch = false;
    showResetFilters = false;
  } else if (isSearchEmpty) {
    Icon = SearchX;
    showClearSearch = Boolean(handleClearSearch);

    if (filtersActive) {
      title = 'No Matching Services Found';
      description = (
        <>
          No service guides found for <strong>"{trimmedQuery}"</strong> with the current filters applied
          {activeCategory && activeCategory.toLowerCase() !== 'all' ? ` in the ${activeCategory} category` : ''}.
        </>
      );
      tips = [
        'Clear your search query to browse services matching your active filters.',
        'Reset all filters to search across the entire directory.',
        'Check for spelling mistakes or try alternative civic terms.',
      ];
      showResetFilters = Boolean(onReset);
    } else {
      title = 'No Search Results Found';
      description = (
        <>
          No service guides found matching <strong>"{trimmedQuery}"</strong>.
        </>
      );
      tips = [
        'Check your query for spelling mistakes or typos.',
        'Try searching with broader keywords (e.g. "certificate", "license", "pension").',
        'Search by issuing department, scheme name, or required documents.',
      ];
      showResetFilters = false;
    }
  } else if (isFilterEmpty) {
    Icon = FilterX;
    title = 'No Services Match Selected Filters';
    description = (
      <>
        No service guides currently match the selected filter criteria
        {activeCategory && activeCategory.toLowerCase() !== 'all' ? ` within the ${activeCategory} category` : ''}.
      </>
    );
    tips = [
      'Expand your category, department, or jurisdiction filters.',
      'Try switching between Online, Offline, and Hybrid service modes.',
      'Reset filters to view all available civic service guides.',
    ];
    showClearSearch = false;
    showResetFilters = Boolean(onReset);
  }

  return (
    <section
      className="glass-panel animate-fade-in"
      role="status"
      aria-labelledby="directory-empty-title"
      style={{
        textAlign: 'center',
        padding: 'clamp(2.5rem, 6vw, 4rem) clamp(1rem, 4vw, 2.5rem)',
        margin: '2rem auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '720px',
      }}
    >
      <div
        style={{
          width: '4.5rem',
          height: '4.5rem',
          borderRadius: '50%',
          background: 'var(--accent-light, rgba(56, 189, 248, 0.1))',
          color: 'var(--accent-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={36} aria-hidden="true" />
      </div>

      <div style={{ maxWidth: '580px', width: '100%' }}>
        <h2
          id="directory-empty-title"
          style={{
            fontSize: 'clamp(1.25rem, 3vw, 1.65rem)',
            fontWeight: '800',
            marginBottom: '0.5rem',
            color: 'var(--text-primary)',
            lineHeight: '1.3',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            margin: '0 auto',
            lineHeight: '1.6',
            fontSize: '0.95rem',
            wordBreak: 'break-word',
          }}
        >
          {description}
        </p>
      </div>

      {tips.length > 0 && (
        <ul
          style={{
            textAlign: 'left',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            maxWidth: '480px',
            margin: '0 auto',
            paddingLeft: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          {tips.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      )}

      {(showClearSearch || showResetFilters) && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '0.5rem',
          }}
        >
          {showClearSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="btn btn-secondary"
              aria-label="Clear search"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.4rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <X size={16} aria-hidden="true" />
              <span>Clear search</span>
            </button>
          )}

          {showResetFilters && (
            <button
              type="button"
              onClick={onReset}
              className="btn btn-secondary"
              aria-label={showClearSearch ? 'Reset all filters' : 'Reset filters'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.4rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>{showClearSearch ? 'Reset all filters' : 'Reset filters'}</span>
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default DirectoryEmptyState;
