import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import FilterToolbar from './FilterToolbar';

describe('FilterToolbar grouping and header (#566)', () => {
  const defaultProps = {
    searchQuery: '',
    onSearchChange: vi.fn(),
    searchSuggestions: [],
    selectedMode: 'All',
    onModeChange: vi.fn(),
    selectedDifficulty: 'All',
    onDifficultyChange: vi.fn(),
    departments: ['Revenue', 'Transport', 'UIDAI'],
    selectedDepartment: 'All',
    onDepartmentChange: vi.fn(),
    selectedState: 'All',
    selectedDistrict: 'All',
    districtOptions: [],
    onStateChange: vi.fn(),
    onDistrictChange: vi.fn(),
    feeType: 'All',
    onFeeTypeChange: vi.fn(),
    speedFilter: 'All',
    onSpeedFilterChange: vi.fn(),
    sortBy: 'relevance',
    onSortChange: vi.fn(),
    totalResults: 42,
    onResetFilters: vi.fn(),
    hasActiveFilters: false,
  };

  it('renders search input with correct aria labels and total count', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FilterToolbar {...defaultProps} />
      </MemoryRouter>
    );

    expect(html).toContain('aria-label="Search public services"');
    expect(html).toContain('Showing');
    expect(html).toContain('42');
    expect(html).toContain('service guides');
    expect(html).toContain('Authority &amp; Department');
    expect(html).toContain('State / District Scope');
    expect(html).toContain('Fee Structure &amp; Speed');
  });

  it('renders active filter badge and reset all button when active filters exist', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FilterToolbar
          {...defaultProps}
          searchQuery="driving"
          selectedMode="Online"
          hasActiveFilters={true}
        />
      </MemoryRouter>
    );

    expect(html).toContain('active filters');
    expect(html).toContain('2 active');
    expect(html).toContain('Reset all');
  });

  it('renders mode and difficulty filter facet buttons with correct aria-pressed states', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FilterToolbar
          {...defaultProps}
          selectedMode="Online"
          selectedDifficulty="Easy"
        />
      </MemoryRouter>
    );

    expect(html).toContain('Mode:');
    expect(html).toContain('Online');
    expect(html).toContain('Offline');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Difficulty:');
    expect(html).toContain('Easy');
    expect(html).toContain('Hard');
  });

  it('renders sort selector dropdown with available options', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FilterToolbar {...defaultProps} />
      </MemoryRouter>
    );

    expect(html).toContain('aria-label="Sort service guides"');
    expect(html).toContain('Most Relevant');
    expect(html).toContain('Fastest Processing');
    expect(html).toContain('Name (A – Z)');
  });
});
